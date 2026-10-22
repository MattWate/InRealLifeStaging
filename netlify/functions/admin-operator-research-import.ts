import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { adminOnlyWithUser, database, reply } from '../lib/admin-auth';
import { validateOperatorResearch } from '../lib/operator-research-schema';

const requestSchema = z.object({
  research: z.unknown(), validate_only: z.boolean().optional().default(false),
  property_id: z.string().uuid().nullable().optional(),
}).strict();
const MAX_BYTES = 1024 * 1024;

export const handler: Handler = adminOnlyWithUser(async (event, _context, admin) => {
  const sql = database();
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
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
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
  // One SQL transaction ensures that claims and sources never appear partially.
  const results = await sql.transaction([
    sql`insert into public.operator_research_imports (property_id, property_name, property_website, property_city, property_country_code, schema_version, generated_at, generator, raw_payload, created_by_admin_user_id)
      values (${request.data.property_id || null}, ${document.property.reference_name}, ${document.property.match_hints.website || null}, ${document.property.match_hints.city || null}, ${document.property.match_hints.country_code || null}, ${document.schema_version}, ${document.generated_at}, ${JSON.stringify(document.generator)}::jsonb, ${JSON.stringify(document)}::jsonb, ${admin.id}) returning id`,
  ]);
  const importId = results[0][0].id as string;
  // Child inserts are idempotent for an import ID and can safely be retried if a function fails.
  try {
    await Promise.all([
      ...document.claims.map(claim => sql`insert into public.operator_research_claims (import_id, claim_key, entity_type, entity_key, field_key, proposed_value, research_provenance, confidence, presentation_action, review_required, source_ids, rationale)
        values (${importId}, ${claim.claim_id}, ${claim.entity_type}, ${claim.entity_key}, ${claim.field_key}, ${JSON.stringify(claim.value)}::jsonb, ${claim.research_provenance}, ${claim.confidence}, ${claim.presentation_action}, ${claim.review_required}, ${claim.source_ids}, ${claim.rationale}) on conflict (import_id, claim_key) do nothing`),
      ...document.sources.map(source => sql`insert into public.operator_research_sources (import_id, source_key, source_type, title, url, accessed_at)
        values (${importId}, ${source.source_id}, ${source.source_type}, ${source.title}, ${source.url}, ${source.accessed_at}) on conflict (import_id, source_key) do nothing`),
    ]);
  } catch (error) {
    // Do not leave a seemingly usable partial import behind.
    await sql`delete from public.operator_research_imports where id=${importId}`;
    throw error;
  }
  return reply(201, { import_id: importId, summary, status: 'imported' });
});
