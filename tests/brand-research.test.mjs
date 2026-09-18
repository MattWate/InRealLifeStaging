import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configure, calls } from './sql-mock.mjs';
import { digest } from '../netlify/lib/admin-auth.ts';
import { validateBrandResearchDocument } from '../netlify/lib/brand-research-schema.ts';
import { handler as importResearch } from '../netlify/functions/admin-brand-research-import.ts';
import { handler as reviewResearch } from '../netlify/functions/admin-brand-research-review.ts';
import { handler as manageInvitations } from '../netlify/functions/admin-brand-profile-invitations.ts';
import { handler as confirmProfile } from '../netlify/functions/brand-profile-invitation.ts';
import { buildResearchImportRequest, parseResearchJson } from '../src/admin/research-import.ts';

process.env.APP_ORIGIN = 'https://irl.example';
process.env.DATABASE_URL = 'test-only';

const valid = JSON.parse(readFileSync(new URL('./fixtures/brand-research-nomu-valid.json', import.meta.url), 'utf8'));
const invalid = JSON.parse(readFileSync(new URL('./fixtures/brand-research-invalid.json', import.meta.url), 'utf8'));
const token = 'b'.repeat(64);
const adminId = '11111111-1111-4111-8111-111111111111';
const organisationId = '22222222-2222-4222-8222-222222222222';

const request = (body, origin = process.env.APP_ORIGIN) => ({
  httpMethod: 'POST',
  headers: { origin, cookie: `__Host-irl_admin=${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
  queryStringParameters: {},
});

test('the worked NOMU research document passes the v1 contract', () => {
  const result = validateBrandResearchDocument(valid);
  assert.equal(result.success, true);
  assert(result.warnings.some(warning => warning.code === 'low_confidence'));
});

test('unknown keys and field registry violations are blocking errors', () => {
  const result = validateBrandResearchDocument(invalid);
  assert.equal(result.success, false);
  assert(result.errors.some(error => error.path === 'unexpected_instruction'));
  assert(result.errors.some(error => error.path === 'claims.0.field_key'));
});

test('semantic validation blocks invented gaps, entity mismatches and unsafe URLs', () => {
  const research = structuredClone(valid);
  research.claims[0].entity_key = 'missing_brand';
  research.claims[2].review_required = false;
  research.claims.at(-1).value = 'invented audience';
  const result = validateBrandResearchDocument(research);
  assert.equal(result.success, false);
  const messages = result.errors.map(error => error.message).join(' ');
  assert.match(messages, /Unknown entity/);
  assert.match(messages, /must require review/);
  assert.match(messages, /null value/);

  const unsafe = structuredClone(valid);
  unsafe.sources[0].url = 'http://nomu.example';
  const unsafeResult = validateBrandResearchDocument(unsafe);
  assert.equal(unsafeResult.success, false);
  assert.match(unsafeResult.errors.map(error => error.message).join(' '), /HTTPS/);
});

test('research and assumption claims cannot be submitted with an empty source register', () => {
  const research = structuredClone(valid);
  research.sources = [];
  research.claims = research.claims.map(claim => ({ ...claim, source_ids: [] }));
  const result = validateBrandResearchDocument(research);
  assert.equal(result.success, false);
  assert(result.errors.some(error => error.code === 'sources_required'));
});

test('research imports require an authenticated same-origin admin request', async () => {
  configure();
  const anonymous = request({ organisation_id: organisationId, research: valid });
  anonymous.headers.cookie = '';
  assert.equal((await importResearch(anonymous, {})).statusCode, 401);
  assert.equal(calls.length, 0);

  configure();
  const crossOrigin = request({ organisation_id: organisationId, research: valid }, 'https://evil.example');
  assert.equal((await importResearch(crossOrigin, {})).statusCode, 403);
  assert.equal(calls.length, 0);
});

test('the admin brand picker returns only parameterised brand search results', async () => {
  configure(query => query.includes('join public.irl_admin_users')
    ? [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }]
    : query.includes("o.organisation_type = 'brand'")
      ? [{ id: organisationId, name: 'NOMU', country_code: 'ZA', website: 'https://nomu.co.za' }]
      : []);
  const get = {
    httpMethod: 'GET',
    headers: { cookie: `__Host-irl_admin=${token}` },
    body: null,
    queryStringParameters: { q: "%' OR true --" },
  };
  const response = await importResearch(get, {});
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).brands[0].name, 'NOMU');
  const query = calls.find(call => call.query.includes("o.organisation_type = 'brand'"));
  assert(!query.query.includes('OR true --'));
  assert(query.values.some(value => String(value).includes('OR true --')));
});

test('validate-only preview reports conflicts without opening a write transaction', async () => {
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }];
    if (query.startsWith('select o.id')) return [{ id: organisationId, name: 'Different brand', organisation_type: 'brand', country_code: 'GB', website: 'https://different.example' }];
    return [];
  });
  const response = await importResearch(request({ organisation_id: organisationId, validate_only: true, research: valid }), {});
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.valid, true);
  assert.equal(body.summary.brand_name, 'NOMU');
  assert(body.warnings.some(warning => warning.code === 'organisation_name_conflict'));
  assert(!calls.some(call => call.query === 'BEGIN'));
  assert(!calls.some(call => call.query.startsWith('insert into')));
});

test('admin import helpers parse uploads and require an explicit target', () => {
  assert.deepEqual(parseResearchJson(JSON.stringify({ example: true })), { example: true });
  assert.throws(() => parseResearchJson('{not json'), /not valid JSON/);
  assert.throws(() => buildResearchImportRequest(valid, 'existing', '', true), /Select the existing brand/);
  assert.deepEqual(buildResearchImportRequest(valid, 'new', '', true), {
    create_organisation: true,
    validate_only: true,
    research: valid,
  });
});

test('invalid research is rejected before any import write begins', async () => {
  configure(query => query.includes('join public.irl_admin_users')
    ? [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }]
    : []);
  const response = await importResearch(request({ organisation_id: organisationId, research: invalid }), {});
  assert.equal(response.statusCode, 422);
  assert(!calls.some(call => call.query === 'BEGIN'));
  assert(!calls.some(call => call.query.startsWith('insert into public.brand_research_imports')));
});

test('a valid import is stored transactionally without changing canonical profile data', async () => {
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }];
    if (query.startsWith('select o.id')) return [{ id: organisationId, name: 'NOMU', organisation_type: 'brand', country_code: 'ZA', website: 'https://nomu.co.za' }];
    return [];
  });
  const response = await importResearch(request({ organisation_id: organisationId, research: valid }), {});
  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body);
  assert.equal(body.organisation_id, organisationId);
  assert.equal(body.counts.claims, valid.claims.length);
  assert.equal(calls[0].values[0], digest(token));
  assert(calls.some(call => call.query.startsWith('insert into public.brand_research_imports')));
  assert.equal(calls.filter(call => call.query.startsWith('insert into public.brand_research_claims')).length, valid.claims.length);
  const dataGapInsert = calls.find(call => call.query.startsWith('insert into public.brand_research_claims') && call.values[5] === 'audience.description');
  assert.equal(dataGapInsert.values[6], null, 'data gaps must use SQL NULL rather than the JSON null value');
  assert.equal(calls.at(-1).query, 'COMMIT');
  assert(!calls.some(call => /(?:insert into|update) public\.brand_onboarding_(?:profiles|products)/.test(call.query)));
  assert(!calls.some(call => call.query.startsWith('update public.organisations')));
});

test('creating a brand and its research records happens in the same transaction', async () => {
  configure(query => query.includes('join public.irl_admin_users')
    ? [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }]
    : []);
  const response = await importResearch(request({ create_organisation: true, research: valid }), {});
  assert.equal(response.statusCode, 201);
  const begin = calls.findIndex(call => call.query === 'BEGIN');
  assert(begin >= 0);
  assert(calls[begin + 1].query.startsWith('insert into public.organisations'));
  assert(calls[begin + 2].query.startsWith('insert into public.brand_research_imports'));
  assert.equal(calls.at(-1).query, 'COMMIT');
});

test('a failed claim write does not report a successful import', async () => {
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, role: 'admin' }];
    if (query.startsWith('select o.id')) return [{ id: organisationId, name: 'NOMU', organisation_type: 'brand', country_code: 'ZA', website: 'https://nomu.co.za' }];
    if (query.startsWith('insert into public.brand_research_claims')) throw new Error('test write failure');
    return [];
  });
  const previous = console.error;
  console.error = () => {};
  try {
    const response = await importResearch(request({ organisation_id: organisationId, research: valid }), {});
    assert.equal(response.statusCode, 503);
    assert(!response.body.includes('test write failure'));
    assert(!calls.some(call => call.query === 'COMMIT'));
  } finally {
    console.error = previous;
  }
});

test('claim review accepts, edits and rejects research without updating canonical profiles', async () => {
  const importId = '33333333-3333-4333-8333-333333333333';
  const claimA = '44444444-4444-4444-8444-444444444444';
  const claimB = '55555555-5555-4555-8555-555555555555';
  const payload = { ...valid, products: valid.products };
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }];
    if (query.startsWith('select id, organisation_id, raw_payload')) return [{ id: importId, organisation_id: organisationId, raw_payload: payload, validation_report: { valid: true, warnings: [] } }];
    if (query.startsWith('select id, field_key')) return [
      { id: claimA, field_key: 'brand.website', proposed_value: 'https://nomu.co.za', research_provenance: 'research_verified', admin_decision: 'pending', reviewed_value: null },
      { id: claimB, field_key: 'brand.positioning_tier_code', proposed_value: 'mass_premium', research_provenance: 'research_assumption', admin_decision: 'pending', reviewed_value: null },
    ];
    return [];
  });
  const reviewRequest = request({
    import_id: importId,
    selected_product_keys: ['product_nomu_instant_cappuccino'],
    claims: [
      { claim_id: claimA, decision: 'accepted' },
      { claim_id: claimB, decision: 'edited', reviewed_value: 'premium' },
    ],
  });
  reviewRequest.httpMethod = 'PATCH';
  const response = await reviewResearch(reviewRequest, {});
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).status, 'reviewed');
  assert.equal(calls.filter(call => call.query.startsWith('update public.brand_research_claims')).length, 2);
  assert(calls.some(call => call.query.startsWith('update public.brand_research_imports')));
  assert.equal(calls.at(-1).query, 'COMMIT');
  assert(!calls.some(call => /brand_onboarding_profiles|brand_onboarding_products/.test(call.query) && call.query.startsWith('update')));
});

test('claim review blocks edited values outside the field registry', async () => {
  const importId = '33333333-3333-4333-8333-333333333333';
  const claimId = '55555555-5555-4555-8555-555555555555';
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, role: 'admin' }];
    if (query.startsWith('select id, organisation_id, raw_payload')) return [{ id: importId, organisation_id: organisationId, raw_payload: valid, validation_report: {} }];
    if (query.startsWith('select id, field_key')) return [{ id: claimId, field_key: 'brand.positioning_tier_code', proposed_value: 'mass_premium', research_provenance: 'research_assumption', admin_decision: 'pending', reviewed_value: null }];
    return [];
  });
  const reviewRequest = request({ import_id: importId, selected_product_keys: ['product_nomu_instant_cappuccino'], claims: [{ claim_id: claimId, decision: 'edited', reviewed_value: 'ultra_exclusive' }] });
  reviewRequest.httpMethod = 'PATCH';
  const response = await reviewResearch(reviewRequest, {});
  assert.equal(response.statusCode, 422);
  assert(!calls.some(call => call.query === 'BEGIN'));
});

test('a reviewed import creates a hashed, one-time customer invitation without applying research', async () => {
  const importId = '33333333-3333-4333-8333-333333333333';
  const claimId = '44444444-4444-4444-8444-444444444444';
  configure(query => {
    if (query.includes('join public.irl_admin_users')) return [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }];
    if (query.startsWith('select i.id, i.organisation_id')) return [{
      id: importId, organisation_id: organisationId, status: 'reviewed', raw_payload: valid,
      validation_report: { admin_review: { selected_product_keys: ['product_nomu_instant_cappuccino'] } }, organisation_name: 'NOMU',
    }];
    if (query.startsWith('select id, entity_type')) return [{ id: claimId, entity_type: 'brand', entity_key: 'brand_nomu', field_key: 'brand.name', reviewed_value: 'NOMU', admin_decision: 'accepted', presentation_action: 'show_confirm' }];
    if (query.startsWith('select id, name from public.brand_onboarding_products')) return [];
    return [];
  });
  const response = await manageInvitations(request({ import_id: importId, recipient_name: 'Jared', recipient_email: 'jared@example.com', expiry_days: 14 }), {});
  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body);
  assert.match(body.customer_url, /^https:\/\/irl\.example\/confirm-brand\/[a-f0-9]{64}$/);
  const rawToken = body.customer_url.split('/').at(-1);
  const insert = calls.find(call => call.query.startsWith('insert into public.brand_profile_invitations'));
  assert(insert.values.includes(digest(rawToken)));
  assert(!insert.values.includes(rawToken));
  assert(calls.some(call => call.query.startsWith('insert into public.brand_profile_field_responses')));
  assert(!calls.some(call => call.query.startsWith('update public.organisations set name=')));
  assert(!calls.some(call => call.query.includes('set website=') && call.query.startsWith('update public.brand_onboarding_profiles')));
  assert.equal(calls.at(-1).query, 'COMMIT');
});

test('an unfinished research review cannot create a customer invitation', async () => {
  const importId = '33333333-3333-4333-8333-333333333333';
  configure(query => query.includes('join public.irl_admin_users') ? [{ id: adminId, role: 'admin' }] : []);
  const response = await manageInvitations(request({ import_id: importId, recipient_email: 'jared@example.com' }), {});
  assert.equal(response.statusCode, 409);
  assert(!calls.some(call => call.query === 'BEGIN'));
});

test('the public profile endpoint validates only a token digest and never returns the raw token', async () => {
  const customerToken = 'c'.repeat(64);
  const invitationId = '66666666-6666-4666-8666-666666666666';
  configure(query => {
    if (query.startsWith('insert into public.irl_login_limits')) return [{ attempts: 1 }];
    if (query.startsWith('select i.id, i.organisation_id')) return [{ id: invitationId, organisation_id: organisationId, organisation_name: 'NOMU', research_import_id: '33333333-3333-4333-8333-333333333333', onboarding_session_id: '77777777-7777-4777-8777-777777777777', recipient_name: 'Jared', status: 'active', expires_at: new Date(Date.now() + 86400000).toISOString() }];
    return [];
  });
  const response = await confirmProfile({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip':'127.0.0.1' }, body: null, queryStringParameters: { token: customerToken } }, {});
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).brand.name, 'NOMU');
  assert(!response.body.includes(customerToken));
  const lookup = calls.find(call => call.query.startsWith('select i.id, i.organisation_id'));
  assert(lookup.values.includes(digest(customerToken)));
  assert(!lookup.values.includes(customerToken));
  assert(calls.some(call => call.query.startsWith("update public.brand_profile_invitations set status='opened'")));
});

test('customer submission applies only confirmed and answered fields before completing the invitation', async () => {
  const customerToken = 'd'.repeat(64);
  const invitationId = '66666666-6666-4666-8666-666666666666';
  const sessionId = '77777777-7777-4777-8777-777777777777';
  const preparedId = '88888888-8888-4888-8888-888888888888';
  const claimId = '99999999-9999-4999-8999-999999999999';
  const invitation = { id: invitationId, organisation_id: organisationId, organisation_name: 'NOMU', research_import_id: '33333333-3333-4333-8333-333333333333', onboarding_session_id: sessionId, recipient_name: 'Jared', status: 'opened', expires_at: new Date(Date.now() + 86400000).toISOString() };
  const stored = [{ id: preparedId, research_claim_id: claimId, entity_type: 'brand', product_id: null, field_key: 'brand.name', response_status: 'untouched', original_value: 'NOMU', submitted_value: null }];
  configure(query => {
    if (query.startsWith('insert into public.irl_login_limits')) return [{ attempts: 1 }];
    if (query.startsWith('select i.id, i.organisation_id')) return [invitation];
    if (query.startsWith('select id, research_claim_id')) return stored;
    if (query.startsWith('select product_id as id')) return [];
    return [];
  });
  const direct = [
    ['audience.description','Health-conscious urban professionals'],
    ['audience.evidence_source_code','customer_or_sales_data'],
    ['audience.geography_code','primarily_south_african'],
    ['audience.age_group_codes',['25_34']],
    ['audience.life_stage_codes',['single_or_young_professional']],
    ['audience.lifestyle_codes',['wellness_and_health_conscious']],
    ['brand.sales_channel_codes',['brand_website']],
  ].map(([field_key, submitted_value]) => ({ entity_type: String(field_key).startsWith('audience.') ? 'audience' : 'brand', product_id: null, field_key, response_status: 'answered', submitted_value }));
  const event = {
    httpMethod: 'POST', headers: { origin: process.env.APP_ORIGIN, 'x-nf-client-connection-ip':'127.0.0.1' },
    queryStringParameters: { token: customerToken },
    body: JSON.stringify({ action:'submit', responses:[{ response_id:preparedId, entity_type:'brand', product_id:null, field_key:'brand.name', response_status:'confirmed', submitted_value:'tampered' }, ...direct] }),
  };
  const response = await confirmProfile(event, {});
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).status, 'submitted');
  assert(calls.some(call => call.query.startsWith('update public.organisations set name=') && call.values.includes('NOMU')));
  assert(!calls.some(call => call.values.includes('tampered')));
  assert(calls.some(call => call.query.startsWith("update public.brand_profile_invitations set status='submitted'")));
  assert.equal(calls.at(-1).query, 'COMMIT');
});
