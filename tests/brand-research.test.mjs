import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configure, calls } from './sql-mock.mjs';
import { digest } from '../netlify/lib/admin-auth.ts';
import { validateBrandResearchDocument } from '../netlify/lib/brand-research-schema.ts';
import { handler as importResearch } from '../netlify/functions/admin-brand-research-import.ts';
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
