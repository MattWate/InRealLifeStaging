import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { adminOnlyWithUser, database, reply } from '../lib/admin-auth';
import {
  validateBrandResearchFieldValue,
  type BrandResearchDocument,
  type BrandResearchFieldKey,
} from '../lib/brand-research-schema';

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

const decisionSchema = z.object({
  claim_id: z.string().uuid(),
  decision: z.enum(['pending', 'accepted', 'edited', 'rejected']),
  reviewed_value: z.unknown().optional(),
}).strict();

const reviewSchema = z.object({
  import_id: z.string().uuid(),
  selected_product_keys: z.array(z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)).max(250),
  claims: z.array(decisionSchema).max(5000),
}).strict();

type ClaimRow = {
  id: string;
  field_key: BrandResearchFieldKey;
  proposed_value: unknown;
  research_provenance: string;
  admin_decision: 'pending' | 'accepted' | 'edited' | 'rejected';
  reviewed_value: unknown;
};

export const handler: Handler = adminOnlyWithUser(async (event, _context, admin) => {
  const sql = database();
  try {
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id || '';
      if (!id) return reply(200, await listImports(sql));
      if (!UUID.test(id)) return reply(400, { error: 'Invalid research import.' });
      return reply(200, await importDetail(sql, id));
    }
    if (event.httpMethod !== 'PATCH') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, PATCH' });
    if (Buffer.byteLength(event.body || '', 'utf8') > 512 * 1024) return reply(413, { error: 'The review update is too large.' });

    let raw: unknown;
    try { raw = JSON.parse(event.body || ''); }
    catch { return reply(400, { error: 'The review update is not valid JSON.' }); }
    const parsed = reviewSchema.safeParse(raw);
    if (!parsed.success) return reply(400, {
      error: 'Check the review decisions and try again.',
      details: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
    });
    const result = await saveReview(sql, admin.id, parsed.data);
    return reply(200, result);
  } catch (error) {
    if (error instanceof ReviewError) return reply(error.statusCode, { error: error.message, details: error.details });
    throw error;
  }
});

async function listImports(sql: any) {
  const rows = await sql`
    select i.id, i.status, i.schema_version, i.generated_at, i.created_at,
      o.id as organisation_id, o.name as organisation_name,
      coalesce(i.raw_payload #>> '{brand,reference_name}', o.name) as research_brand_name,
      coalesce(jsonb_array_length(i.raw_payload->'products'), 0)::int as product_count,
      (select count(*)::int from public.brand_research_claims c where c.import_id = i.id) as claim_count,
      (select count(*)::int from public.brand_research_claims c where c.import_id = i.id and c.research_provenance <> 'data_gap' and c.admin_decision = 'pending') as pending_count,
      coalesce(i.validation_report #> '{admin_review,selected_product_keys}', '[]'::jsonb) as selected_product_keys
    from public.brand_research_imports i
    join public.organisations o on o.id = i.organisation_id
    where i.status <> 'archived'
    order by i.created_at desc, i.id desc
    limit 50
  `;
  return { imports: rows };
}

async function importDetail(sql: any, importId: string) {
  const imports = await sql`
    select i.id, i.organisation_id, i.status, i.schema_version, i.generated_at,
      i.generator_name, i.generator_version, i.generator_model,
      i.raw_payload, i.validation_report, i.created_at,
      o.name as organisation_name
    from public.brand_research_imports i
    join public.organisations o on o.id = i.organisation_id
    where i.id = ${importId}::uuid
    limit 1
  `;
  if (!imports.length) throw new ReviewError(404, 'Research import not found.');
  const claims = await sql`
    select id, claim_key, entity_type, entity_key, field_key, proposed_value,
      research_provenance, confidence, presentation_action, review_required,
      source_ids, source_references, rationale, admin_decision, reviewed_value,
      reviewed_at
    from public.brand_research_claims
    where import_id = ${importId}::uuid
    order by case when entity_type = 'brand' then 0 else 1 end, entity_key, field_key
  `;
  const payload = imports[0].raw_payload as BrandResearchDocument;
  const report = imports[0].validation_report || {};
  return {
    import: { ...imports[0], raw_payload: undefined, validation_report: undefined },
    brand: payload.brand,
    products: payload.products,
    sources: payload.sources,
    warnings: report.warnings || [],
    selected_product_keys: report.admin_review?.selected_product_keys || payload.products.filter(product => product.suggest_for_opportunity).map(product => product.external_key),
    claims,
  };
}

async function saveReview(
  sql: any,
  adminUserId: string,
  input: z.infer<typeof reviewSchema>,
) {
  const imports = await sql`
    select id, organisation_id, raw_payload, validation_report
    from public.brand_research_imports
    where id = ${input.import_id}::uuid and status <> 'archived'
    limit 1
  `;
  if (!imports.length) throw new ReviewError(404, 'Research import not found.');
  const payload = imports[0].raw_payload as BrandResearchDocument;
  const productKeys = new Set(payload.products.map(product => product.external_key));
  if (new Set(input.selected_product_keys).size !== input.selected_product_keys.length) throw new ReviewError(400, 'A product was selected more than once.');
  const unknownProduct = input.selected_product_keys.find(key => !productKeys.has(key));
  if (unknownProduct) throw new ReviewError(400, `Unknown product selection: ${unknownProduct}.`);

  const claims = await sql`
    select id, field_key, proposed_value, research_provenance, admin_decision, reviewed_value
    from public.brand_research_claims
    where import_id = ${input.import_id}::uuid
  ` as ClaimRow[];
  const claimMap = new Map(claims.map(claim => [claim.id, claim]));
  if (new Set(input.claims.map(claim => claim.claim_id)).size !== input.claims.length) throw new ReviewError(400, 'A claim was reviewed more than once.');

  const updates: Array<{ id: string; decision: ClaimRow['admin_decision']; value: unknown }> = [];
  const problems: Array<{ path: string; message: string }> = [];
  for (const [index, decision] of input.claims.entries()) {
    const claim = claimMap.get(decision.claim_id);
    if (!claim) { problems.push({ path: `claims.${index}.claim_id`, message: 'This claim does not belong to the selected import.' }); continue; }
    if (claim.research_provenance === 'data_gap' && !['pending', 'rejected'].includes(decision.decision)) {
      problems.push({ path: `claims.${index}.decision`, message: 'Data gaps are answered by the brand and cannot be accepted as researched values.' });
      continue;
    }
    let value: unknown = null;
    if (decision.decision === 'accepted') value = claim.proposed_value;
    if (decision.decision === 'edited') {
      if (!Object.prototype.hasOwnProperty.call(decision, 'reviewed_value')) {
        problems.push({ path: `claims.${index}.reviewed_value`, message: 'Enter the reviewed value.' });
        continue;
      }
      const errors = validateBrandResearchFieldValue(claim.field_key, decision.reviewed_value);
      if (errors.length) {
        problems.push(...errors.map(error => ({ path: `claims.${index}.reviewed_value`, message: error.message })));
        continue;
      }
      value = decision.reviewed_value;
    }
    updates.push({ id: claim.id, decision: decision.decision, value });
  }
  if (problems.length) throw new ReviewError(422, 'Some review decisions are invalid.', problems);

  const effective = new Map(claims.map(claim => [claim.id, claim.admin_decision]));
  for (const update of updates) effective.set(update.id, update.decision);
  const pending = claims.filter(claim => claim.research_provenance !== 'data_gap' && effective.get(claim.id) === 'pending').length;
  const productsReady = payload.products.length === 0 || input.selected_product_keys.length > 0;
  const completed = pending === 0 && productsReady;
  const previousReport = imports[0].validation_report || {};
  const reviewReport = {
    ...previousReport,
    admin_review: {
      selected_product_keys: input.selected_product_keys,
      completed,
      pending_claims: pending,
      reviewed_by_admin_user_id: adminUserId,
      reviewed_at: new Date().toISOString(),
    },
  };

  await sql.transaction([
    ...updates.map(update => sql`
      update public.brand_research_claims set
        admin_decision = ${update.decision},
        reviewed_value = ${update.decision === 'accepted' || update.decision === 'edited' ? JSON.stringify(update.value) : null}::jsonb,
        reviewed_by_admin_user_id = ${update.decision === 'pending' ? null : adminUserId}::uuid,
        reviewed_at = ${update.decision === 'pending' ? null : new Date().toISOString()}::timestamptz,
        updated_at = now()
      where id = ${update.id}::uuid and import_id = ${input.import_id}::uuid
    `),
    sql`
      update public.brand_research_imports set
        status = ${completed ? 'reviewed' : 'ready_for_review'},
        validation_report = ${JSON.stringify(reviewReport)}::jsonb,
        reviewed_by_admin_user_id = ${completed ? adminUserId : null}::uuid,
        reviewed_at = ${completed ? new Date().toISOString() : null}::timestamptz,
        updated_at = now()
      where id = ${input.import_id}::uuid
    `,
  ]);

  return { ok: true, status: completed ? 'reviewed' : 'ready_for_review', completed, pending_claims: pending, selected_product_keys: input.selected_product_keys };
}

class ReviewError extends Error {
  statusCode: number;
  details?: Array<{ path: string; message: string }>;
  constructor(statusCode: number, message: string, details?: Array<{ path: string; message: string }>) {
    super(message); this.statusCode = statusCode; this.details = details;
  }
}
