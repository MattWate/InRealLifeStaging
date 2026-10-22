import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { adminOnlyWithUser, database, reply } from '../lib/admin-auth';
import { OPERATOR_FIELD_RULES, validateOperatorResearch } from '../lib/operator-research-schema';

const requestSchema = z.object({
  research: z.unknown(), validate_only: z.boolean().optional().default(false),
  property_id: z.string().uuid().nullable().optional(),
}).strict();
const MAX_BYTES = 1024 * 1024;
const reviewSchema = z.object({
  claim_id: z.string().uuid(), decision: z.enum(['accepted','edited','rejected','pending']),
  reviewed_value: z.unknown().optional(),
}).strict();

export const handler: Handler = adminOnlyWithUser(async (event, _context, admin) => {
  const sql = database();
  if (event.httpMethod === 'PATCH') {
    if (Buffer.byteLength(event.body || '', 'utf8') > 8192) return reply(413, { error:'Review update is too large.' });
    let body: unknown;
    try { body = JSON.parse(event.body || ''); } catch { return reply(400, {error:'Invalid JSON.'}); }
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return reply(400, { error: 'Invalid claim review.', issues: parsed.error.issues });
    const { claim_id, decision, reviewed_value } = parsed.data;
    const rows = await sql`select c.id, c.field_key, c.proposed_value, c.import_id, i.status
      from public.operator_research_claims c join public.operator_research_imports i on i.id=c.import_id where c.id=${claim_id} limit 1`;
    if (!rows.length) return reply(404, {error:'Claim not found.'});
    if (rows[0].status === 'archived') return reply(409, {error:'Archived research cannot be edited.'});
    if (decision === 'edited' && !validEditedValue(rows[0].field_key, reviewed_value)) return reply(400, {error:'Enter a value compatible with the research field.'});
    const value = decision === 'edited' ? reviewed_value : decision === 'accepted' ? rows[0].proposed_value : null;
    await sql`update public.operator_research_claims set admin_decision=${decision}, reviewed_value=${value === null ? null : JSON.stringify(value)}::jsonb, reviewed_at=now(), reviewed_by_admin_user_id=${admin.id} where id=${claim_id}`;
    await sql`update public.operator_research_imports set status='reviewed', reviewed_at=now() where id=${rows[0].import_id} and status='imported'`;
    return reply(200, {claim_id, decision, reviewed_value:value});
  }
  if (event.httpMethod === 'GET') {
    const id = event.queryStringParameters?.id;
    if (id) {
      if (!z.string().uuid().safeParse(id).success) return reply(400, { error: 'Invalid import ID.' });
      const [imports, claims, sources] = await Promise.all([
        sql`select id, property_id, property_name, property_website, property_city, schema_version, generated_at, generator, raw_payload, status, created_at from public.operator_research_imports where id=${id} limit 1`,
        sql`select * from public.operator_research_claims where import_id=${id} order by entity_type, entity_key, field_key`,
        sql`select source_key, source_type, title, url, accessed_at from public.operator_research_sources where import_id=${id} order by source_key`,
      ]);
      return imports.length ? reply(200, { research_import: imports[0], claims, sources }) : reply(404, { error: 'Research import not found.' });
    }
    const imports = await sql`select id, property_id, property_name, property_city, property_website, status, created_at from public.operator_research_imports order by created_at desc limit 100`;
    return reply(200, { imports });
  }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, PATCH' });
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BYTES) return reply(413, { error: 'Research exceeds the 1 MB upload limit.' });
  let body: unknown;
  try { body = JSON.parse(event.body || ''); } catch { return reply(400, { error: 'Invalid JSON.' }); }
  const request = requestSchema.safeParse(body);
  if (!request.success) return reply(400, { error: 'Invalid research import request.', issues: request.error.issues });
  const validated = validateOperatorResearch(request.data.research);
  if (!validated.success) return reply(422, {
    error: 'Research failed contract validation.',
    issues: validated.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
  });
  const document = validated.data;
  const summary = { property_name: document.property.reference_name, rooms: document.rooms.length, spaces: document.spaces.length, audiences: document.audiences.length, zones: document.zones.length, claims: document.claims.length, sources: document.sources.length };
  if (request.data.validate_only) return reply(200, { valid: true, summary });

  if (request.data.property_id) {
    const found = await sql`select id from public.properties where id=${request.data.property_id} limit 1`;
    if (!found.length) return reply(404, { error: 'Selected property does not exist.' });
  }
  // Imports remain separate from canonical property data until an admin review.
  const inserted = await sql`insert into public.operator_research_imports (property_id, property_name, property_website, property_city, property_country_code, schema_version, generated_at, generator, raw_payload, created_by_admin_user_id)
    values (${request.data.property_id || null}, ${document.property.reference_name}, ${document.property.match_hints.website || null}, ${document.property.match_hints.city || null}, ${document.property.match_hints.country_code || null}, ${document.schema_version}, ${document.generated_at}, ${JSON.stringify(document.generator)}::jsonb, ${JSON.stringify(document)}::jsonb, ${admin.id}) returning id`;
  const importId = inserted[0].id as string;
  // Child inserts are idempotent for an import ID and can safely be retried if a function fails.
  try {
    await sql`insert into public.operator_research_claims (import_id, claim_key, entity_type, entity_key, field_key, proposed_value, research_provenance, confidence, presentation_action, review_required, source_ids, rationale)
      select ${importId}, c.claim_id, c.entity_type, c.entity_key, c.field_key, c.value, c.research_provenance, c.confidence, c.presentation_action, c.review_required, c.source_ids, c.rationale
      from jsonb_to_recordset(${JSON.stringify(document.claims)}::jsonb) as c(
        claim_id text, entity_type text, entity_key text, field_key text, value jsonb,
        research_provenance text, confidence text, presentation_action text,
        review_required boolean, source_ids text[], rationale text
      )`;
    await sql`insert into public.operator_research_sources (import_id, source_key, source_type, title, url, accessed_at)
      select ${importId}, s.source_id, s.source_type, s.title, s.url, s.accessed_at
      from jsonb_to_recordset(${JSON.stringify(document.sources)}::jsonb) as s(
        source_id text, source_type text, title text, url text, accessed_at timestamptz
      )`;
  } catch (error) {
    // Do not leave a seemingly usable partial import behind.
    await sql`delete from public.operator_research_imports where id=${importId}`;
    throw error;
  }
  return reply(201, { import_id: importId, summary, status: 'imported' });
});

function validEditedValue(field: string, value: unknown) {
  const kind = OPERATOR_FIELD_RULES[field as keyof typeof OPERATOR_FIELD_RULES];
  if (!kind || value === null || value === undefined) return false;
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (kind === 'list') return Array.isArray(value) && value.length <= 30 && value.every(item => typeof item === 'string' && item.length <= 300);
  if (typeof value !== 'string' || value.length > 5000) return false;
  if (kind === 'country') return /^[A-Z]{2}$/.test(value);
  if (kind === 'url') { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }
  return true;
}
