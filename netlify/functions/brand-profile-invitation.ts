import type { Handler, HandlerEvent } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, digest, origin, reply } from '../lib/admin-auth';
import { validateBrandResearchFieldValue, type BrandResearchFieldKey } from '../lib/brand-research-schema';

const TOKEN = /^[a-f0-9]{64}$/;
const statusSchema = z.enum(['untouched', 'confirmed', 'corrected', 'not_applicable', 'answered']);
const responseSchema = z.object({
  response_id: z.string().uuid().optional(),
  entity_type: z.enum(['brand', 'product', 'audience']),
  product_id: z.string().uuid().nullable().optional(),
  field_key: z.string().max(120),
  response_status: statusSchema,
  submitted_value: z.unknown().nullable().optional(),
}).strict();
const requestSchema = z.object({
  action: z.enum(['save', 'submit']),
  responses: z.array(responseSchema).max(250),
}).strict();

const DIRECT_FIELDS = new Set<BrandResearchFieldKey>([
  'audience.description', 'audience.evidence_source_code', 'audience.geography_code',
  'audience.geography_detail', 'audience.age_group_codes', 'audience.life_stage_codes',
  'audience.lifestyle_codes', 'brand.sales_channel_codes', 'brand.marketing_channel_codes',
  'brand.marketing_channel_rank_codes', 'brand.measured_acquisition_channel_code',
]);
const REQUIRED_DIRECT = [
  'audience.description', 'audience.evidence_source_code', 'audience.geography_code',
  'audience.age_group_codes', 'audience.life_stage_codes', 'audience.lifestyle_codes',
  'brand.sales_channel_codes',
];

type Invitation = {
  id: string; organisation_id: string; organisation_name: string; research_import_id: string;
  onboarding_session_id: string; recipient_name: string | null; status: string; expires_at: string;
};
type StoredResponse = {
  id: string; entity_type: 'brand' | 'product' | 'audience'; product_id: string | null;
  field_key: BrandResearchFieldKey; response_status: string; original_value: unknown; submitted_value: unknown;
  research_claim_id: string | null;
};

export const handler: Handler = async event => {
  try {
    const token = event.queryStringParameters?.token || '';
    if (!TOKEN.test(token)) return reply(404, { error: 'This confirmation link is invalid.' });
    const sql = database();
    await limitRequest(sql, event, token, event.httpMethod === 'GET' ? 120 : 40);
    const invitation = await findInvitation(sql, token);
    if (!invitation) return reply(404, { error: 'This confirmation link is invalid.' });
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await sql`update public.brand_profile_invitations set status='expired', updated_at=now() where id=${invitation.id}::uuid and status in ('active','opened')`;
      return reply(410, { error: 'This confirmation link has expired. Please contact IRL for a new link.' });
    }
    if (invitation.status === 'revoked' || invitation.status === 'expired') return reply(410, { error: 'This confirmation link is no longer active.' });

    if (event.httpMethod === 'GET') return reply(200, await invitationDetail(sql, invitation));
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    if (event.headers.origin !== origin().origin) return reply(403, { error: 'Request origin is not allowed.' });
    if (invitation.status === 'submitted') return reply(409, { error: 'This profile has already been submitted.' });
    if (Buffer.byteLength(event.body || '', 'utf8') > 128 * 1024) return reply(413, { error: 'The profile update is too large.' });
    let raw: unknown;
    try { raw = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'The profile update is not valid JSON.' }); }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) return reply(400, { error: 'Check the profile answers and try again.' });
    return reply(200, await saveResponses(sql, invitation, parsed.data));
  } catch (error) {
    if (error instanceof PublicError) return reply(error.status, { error: error.message, details: error.details });
    console.error('Brand profile confirmation failed', error);
    return reply(503, { error: 'Your profile could not be saved right now. Please try again.' });
  }
};

async function limitRequest(sql: any, event: HandlerEvent, token: string, limit: number) {
  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const rows = await sql`
    insert into public.irl_login_limits (key_hash, attempts, reset_at)
    values (${digest(`brand-profile:${digest(token)}:${ip}`)}, 1, now() + interval '15 minutes')
    on conflict (key_hash) do update set
      attempts=case when irl_login_limits.reset_at <= now() then 1 else irl_login_limits.attempts + 1 end,
      reset_at=case when irl_login_limits.reset_at <= now() then now() + interval '15 minutes' else irl_login_limits.reset_at end
    returning attempts
  `;
  if (Number(rows[0]?.attempts || 0) > limit) throw new PublicError(429, 'Too many requests. Please wait 15 minutes and try again.');
}

async function findInvitation(sql: any, token: string): Promise<Invitation | null> {
  const rows = await sql`
    select i.id, i.organisation_id, i.research_import_id, i.onboarding_session_id,
      i.recipient_name, i.status, i.expires_at, o.name as organisation_name
    from public.brand_profile_invitations i
    join public.organisations o on o.id=i.organisation_id
    where i.token_hash=${digest(token)} limit 1
  `;
  return rows[0] || null;
}

async function invitationDetail(sql: any, invitation: Invitation) {
  const responses = await sql`
    select r.id, r.research_claim_id, r.entity_type, r.product_id, r.field_key,
      r.response_status, r.original_value, r.submitted_value
    from public.brand_profile_field_responses r
    where r.invitation_id=${invitation.id}::uuid
    order by case r.entity_type when 'brand' then 0 when 'product' then 1 else 2 end, r.field_key
  `;
  const products = await sql`
    select p.id, coalesce(p.name, name_claim.reviewed_value #>> '{}', 'Product') as name, ip.product_order
    from public.brand_profile_invitation_products ip
    join public.brand_onboarding_products p on p.id=ip.product_id
    left join lateral (
      select c.reviewed_value from public.brand_research_claims c
      where c.import_id=${invitation.research_import_id}::uuid and c.product_id=p.id and c.field_key='product.name'
      limit 1
    ) name_claim on true
    where ip.invitation_id=${invitation.id}::uuid order by ip.product_order
  `;
  if (invitation.status === 'active') await sql`
    update public.brand_profile_invitations set status='opened', opened_at=coalesce(opened_at,now()), updated_at=now()
    where id=${invitation.id}::uuid and status='active'
  `;
  return {
    invitation: { recipient_name: invitation.recipient_name, status: invitation.status, expires_at: invitation.expires_at },
    brand: { name: invitation.organisation_name }, products, responses,
  };
}

async function saveResponses(sql: any, invitation: Invitation, request: z.infer<typeof requestSchema>) {
  const stored = await sql`
    select id, research_claim_id, entity_type, product_id, field_key, response_status, original_value, submitted_value
    from public.brand_profile_field_responses where invitation_id=${invitation.id}::uuid
  ` as StoredResponse[];
  const byId = new Map(stored.map(row => [row.id, row]));
  const products = await sql`select product_id as id from public.brand_profile_invitation_products where invitation_id=${invitation.id}::uuid`;
  const productIds = new Set(products.map((row: any) => row.id));
  const final = new Map(stored.map(row => [responseKey(row), row]));
  const tasks: any[] = [];
  const problems: Array<{ path: string; message: string }> = [];

  request.responses.forEach((answer, index) => {
    const existing = answer.response_id ? byId.get(answer.response_id) : undefined;
    const fieldKey = answer.field_key as BrandResearchFieldKey;
    const productId = answer.product_id || null;
    if (existing && (existing.field_key !== fieldKey || existing.entity_type !== answer.entity_type || existing.product_id !== productId)) {
      problems.push({ path: `responses.${index}`, message: 'This response does not match the prepared profile.' }); return;
    }
    if (!existing && !DIRECT_FIELDS.has(fieldKey)) {
      problems.push({ path: `responses.${index}.field_key`, message: 'This field is not part of the customer questionnaire.' }); return;
    }
    if (answer.entity_type === 'product' && (!productId || !productIds.has(productId))) {
      problems.push({ path: `responses.${index}.product_id`, message: 'This product is not part of the invitation.' }); return;
    }
    const value = ['confirmed', 'corrected', 'answered'].includes(answer.response_status)
      ? (answer.response_status === 'confirmed' ? existing?.original_value : answer.submitted_value)
      : null;
    if (['confirmed', 'corrected', 'answered'].includes(answer.response_status)) {
      const errors = validateBrandResearchFieldValue(fieldKey, value);
      if (errors.length) { problems.push(...errors.map(issue => ({ path: `responses.${index}.submitted_value`, message: issue.message }))); return; }
    }
    const row: StoredResponse = {
      id: existing?.id || randomUUID(), research_claim_id: existing?.research_claim_id || null,
      entity_type: answer.entity_type, product_id: productId, field_key: fieldKey,
      response_status: answer.response_status, original_value: existing?.original_value ?? null, submitted_value: value,
    };
    final.set(responseKey(row), row);
    if (existing) tasks.push(sql`
      update public.brand_profile_field_responses set response_status=${row.response_status},
        submitted_value=${value == null ? null : JSON.stringify(value)}::jsonb, updated_at=now()
      where id=${existing.id}::uuid and invitation_id=${invitation.id}::uuid
    `);
    else tasks.push(sql`
      insert into public.brand_profile_field_responses
        (id, invitation_id, organisation_id, entity_type, product_id, field_key, response_status, submitted_value)
      values (${row.id}::uuid, ${invitation.id}::uuid, ${invitation.organisation_id}::uuid, ${row.entity_type},
        ${productId}::uuid, ${row.field_key}, ${row.response_status}, ${value == null ? null : JSON.stringify(value)}::jsonb)
    `);
  });
  if (problems.length) throw new PublicError(422, 'Some profile answers need attention.', problems);
  if (tasks.length) await sql.transaction(tasks);
  if (request.action === 'save') {
    await sql`update public.onboarding_sessions set current_step='customer-details', updated_at=now() where id=${invitation.onboarding_session_id}::uuid`;
    return { ok: true, status: 'in_progress', saved_at: new Date().toISOString() };
  }

  const finalRows = [...final.values()];
  const unconfirmed = finalRows.filter(row => row.research_claim_id && row.response_status === 'untouched');
  const missing = REQUIRED_DIRECT.filter(field => {
    const row = finalRows.find(value => value.field_key === field);
    return !row || row.response_status !== 'answered' || row.submitted_value == null
      || (Array.isArray(row.submitted_value) && row.submitted_value.length === 0);
  });
  if (unconfirmed.length || missing.length) throw new PublicError(422, 'Please review every prepared field and complete the required customer details.', [
    ...unconfirmed.map(row => ({ path: row.field_key, message: 'Confirm, correct or mark this field as not applicable.' })),
    ...missing.map(field => ({ path: field, message: 'This answer is required.' })),
  ]);
  await applyCanonical(sql, invitation, finalRows);
  return { ok: true, status: 'submitted', submitted_at: new Date().toISOString() };
}

async function applyCanonical(sql: any, invitation: Invitation, rows: StoredResponse[]) {
  const applicable = rows.filter(row => ['confirmed', 'corrected', 'answered'].includes(row.response_status));
  const value = (field: string, productId?: string | null) => applicable.find(row => row.field_key === field && (productId === undefined || row.product_id === productId))?.submitted_value;
  const list = (field: string) => pgTextArray(Array.isArray(value(field)) ? value(field) as string[] : []);
  const products = [...new Set(rows.filter(row => row.entity_type === 'product' && row.product_id).map(row => row.product_id!))];
  const tasks: any[] = [];
  const brandName = value('brand.name');
  if (brandName) tasks.push(sql`update public.organisations set name=${brandName}, updated_at=now() where id=${invitation.organisation_id}::uuid`);
  tasks.push(sql`
    update public.organisations set country_code=coalesce(${value('brand.country_code') || null},country_code),
      city=coalesce(${value('brand.city') || null},city), onboarding_status='submitted', updated_at=now()
    where id=${invitation.organisation_id}::uuid
  `);
  tasks.push(sql`
    update public.brand_onboarding_profiles set
      website=coalesce(${value('brand.website') || null},website),
      parent_company_name=coalesce(${value('brand.parent_company_name') || null},parent_company_name),
      description=coalesce(${value('brand.proposition') || null},description),
      primary_category_code=coalesce(${value('brand.primary_category_code') || null},primary_category_code),
      positioning_tier_code=coalesce(${value('brand.positioning_tier_code') || null},positioning_tier_code),
      secondary_category_codes=case when ${value('brand.secondary_category_codes') != null} then ${list('brand.secondary_category_codes')}::text[] else secondary_category_codes end,
      active_market_codes=case when ${value('brand.active_market_codes') != null} then ${list('brand.active_market_codes')}::text[] else active_market_codes end,
      sales_channel_codes=case when ${value('brand.sales_channel_codes') != null} then ${list('brand.sales_channel_codes')}::text[] else sales_channel_codes end,
      marketing_channel_codes=case when ${value('brand.marketing_channel_codes') != null} then ${list('brand.marketing_channel_codes')}::text[] else marketing_channel_codes end,
      confirmed_accurate=true, status='submitted', readiness_status='match_ready', updated_at=now()
    where organisation_id=${invitation.organisation_id}::uuid
  `);
  if (value('brand.marketing_channel_codes') != null || value('brand.marketing_channel_rank_codes') != null || value('brand.measured_acquisition_channel_code') != null) tasks.push(sql`
    insert into public.brand_value_add_profiles
      (organisation_id,onboarding_session_id,marketing_channel_codes,marketing_channel_rank_codes,measured_acquisition_channel_code)
    values (${invitation.organisation_id}::uuid,${invitation.onboarding_session_id}::uuid,
      ${list('brand.marketing_channel_codes')}::text[],${list('brand.marketing_channel_rank_codes')}::text[],${value('brand.measured_acquisition_channel_code') || null})
    on conflict (organisation_id) do update set
      onboarding_session_id=excluded.onboarding_session_id,
      marketing_channel_codes=case when ${value('brand.marketing_channel_codes') != null} then excluded.marketing_channel_codes else brand_value_add_profiles.marketing_channel_codes end,
      marketing_channel_rank_codes=case when ${value('brand.marketing_channel_rank_codes') != null} then excluded.marketing_channel_rank_codes else brand_value_add_profiles.marketing_channel_rank_codes end,
      measured_acquisition_channel_code=coalesce(excluded.measured_acquisition_channel_code,brand_value_add_profiles.measured_acquisition_channel_code),updated_at=now()
  `);
  for (const productId of products) tasks.push(sql`
    update public.brand_onboarding_products set
      name=coalesce(${value('product.name', productId) || null},name), webpage=coalesce(${value('product.webpage', productId) || null},webpage),
      category_code=coalesce(${value('product.category_code', productId) || null},category_code),
      subcategory_code=coalesce(${value('product.subcategory_code', productId) || null},subcategory_code),
      format_description=coalesce(${value('product.format_description', productId) || null},format_description),
      currency_code=coalesce(${value('product.currency_code', productId) || null},currency_code),
      retail_price_min=coalesce(${value('product.retail_price_min', productId) ?? null},retail_price_min),
      retail_price_max=coalesce(${value('product.retail_price_max', productId) ?? null},retail_price_max),
      variants=coalesce(${value('product.variants', productId) || null},variants),
      market_codes=case when ${value('product.market_codes', productId) != null} then ${pgTextArray(value('product.market_codes', productId) as string[])}::text[] else market_codes end,
      sales_channel_codes=case when ${value('product.sales_channel_codes', productId) != null} then ${pgTextArray(value('product.sales_channel_codes', productId) as string[])}::text[] else sales_channel_codes end,
      international_shipping_code=coalesce(${value('product.international_shipping_code', productId) || null},international_shipping_code),
      handling_requirement_codes=case when ${value('product.handling_requirement_codes', productId) != null} then ${pgTextArray(value('product.handling_requirement_codes', productId) as string[])}::text[] else handling_requirement_codes end,
      supply_capability_code=coalesce(${value('product.supply_capability_code', productId) || null},supply_capability_code),updated_at=now()
    where id=${productId}::uuid and organisation_id=${invitation.organisation_id}::uuid
  `);
  const firstProduct = products[0] || null;
  tasks.push(sql`
    insert into public.brand_audience_profiles
      (organisation_id,product_id,onboarding_session_id,is_primary,description,evidence_source_code,evidence_source_codes,
       geography_code,geography_detail,age_group_codes,life_stage_codes,lifestyle_codes,evidence_layer,review_required)
    values (${invitation.organisation_id}::uuid,${firstProduct}::uuid,${invitation.onboarding_session_id}::uuid,true,
      ${value('audience.description')},${value('audience.evidence_source_code')},${pgTextArray([value('audience.evidence_source_code') as string])}::text[],
      ${value('audience.geography_code')},${value('audience.geography_detail') || null},${list('audience.age_group_codes')}::text[],
      ${list('audience.life_stage_codes')}::text[],${list('audience.lifestyle_codes')}::text[],'brand_stated',false)
    on conflict (organisation_id) where is_primary do update set
      product_id=excluded.product_id,onboarding_session_id=excluded.onboarding_session_id,description=excluded.description,
      evidence_source_code=excluded.evidence_source_code,evidence_source_codes=excluded.evidence_source_codes,
      geography_code=excluded.geography_code,geography_detail=coalesce(excluded.geography_detail,brand_audience_profiles.geography_detail),age_group_codes=excluded.age_group_codes,
      life_stage_codes=excluded.life_stage_codes,lifestyle_codes=excluded.lifestyle_codes,evidence_layer='brand_stated',review_required=false,updated_at=now()
  `);
  const snapshot = Object.fromEntries(applicable.map(row => [responseKey(row), row.submitted_value]));
  tasks.push(
    sql`update public.brand_profile_field_responses set applied_to_canonical=true, applied_at=now(), updated_at=now()
      where invitation_id=${invitation.id}::uuid and response_status in ('confirmed','corrected','answered')`,
    sql`update public.brand_profile_invitations set status='submitted',submitted_at=now(),updated_at=now() where id=${invitation.id}::uuid`,
    sql`update public.onboarding_sessions set current_step='review',status='submitted',completion_percentage=100,submitted_at=coalesce(submitted_at,now()),updated_at=now() where id=${invitation.onboarding_session_id}::uuid`,
    sql`insert into public.irl_submission_snapshots (session_id,answers) values (${invitation.onboarding_session_id}::uuid,${JSON.stringify(snapshot)}::jsonb) on conflict (session_id) do nothing`,
    sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details)
      values (${invitation.onboarding_session_id}::uuid,${invitation.organisation_id}::uuid,'submitted','brand-profile-confirmation-v1',${JSON.stringify({ invitation_id: invitation.id })}::jsonb)`,
  );
  await sql.transaction(tasks);
}

function responseKey(row: { entity_type: string; field_key: string; product_id?: string | null }) {
  return `${row.entity_type}:${row.product_id || ''}:${row.field_key}`;
}
function pgTextArray(values: unknown) {
  const list = Array.isArray(values) ? values : [];
  return `{${list.filter(Boolean).map(value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}

class PublicError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;
  constructor(status: number, message: string, details?: Array<{ path: string; message: string }>) {
    super(message); this.status = status; this.details = details;
  }
}
