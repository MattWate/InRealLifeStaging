import { randomUUID } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { adminOnlyWithUser, database, reply } from '../lib/admin-auth';
import {
  validateBrandResearchDocument,
  type BrandResearchDocument,
  type BrandResearchWarning,
} from '../lib/brand-research-schema';

const MAX_IMPORT_BYTES = 1024 * 1024;

const requestSchema = z.object({
  organisation_id: z.string().uuid().optional(),
  create_organisation: z.boolean().optional().default(false),
  validate_only: z.boolean().optional().default(false),
  research: z.unknown(),
}).strict().superRefine((request, context) => {
  if (!Object.prototype.hasOwnProperty.call(request, 'research')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['research'], message: 'A research document is required.' });
  }
  if (Boolean(request.organisation_id) === request.create_organisation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organisation_id'],
      message: 'Select an existing organisation or explicitly create a new one.',
    });
  }
});

type ImportRequest = {
  organisation_id?: string;
  create_organisation: boolean;
  validate_only: boolean;
  research: unknown;
};
type ExistingOrganisation = {
  id: string;
  name: string;
  organisation_type: string;
  country_code: string | null;
  website: string | null;
};

export const handler: Handler = adminOnlyWithUser(async (event, _context, admin) => {
  if (event.httpMethod === 'GET') {
    const q = (event.queryStringParameters?.q || '').trim().slice(0, 150);
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const sql = database();
    const rows = await sql`
      select o.id, o.name, o.country_code, p.website
      from public.organisations o
      left join public.brand_onboarding_profiles p on p.organisation_id = o.id
      where o.organisation_type = 'brand'
        and (${q} = '' or o.name ilike ${pattern} or p.website ilike ${pattern})
      order by o.name asc, o.id asc
      limit 101
    `;
    return reply(200, { brands: rows.slice(0, 100), has_more: rows.length > 100 });
  }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_IMPORT_BYTES) {
    return reply(413, { error: 'The research import exceeds the 1 MB limit.' });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(event.body || '');
  } catch {
    return reply(400, { error: 'The request is not valid JSON.' });
  }

  const request = requestSchema.safeParse(raw);
  if (!request.success) {
    return reply(400, {
      error: 'Choose an existing brand or create a new one, then provide the research document.',
      details: request.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  const validation = validateBrandResearchDocument(request.data.research);
  if (!validation.success) {
    return reply(422, {
      error: 'The research document did not pass validation.',
      errors: 'errors' in validation ? validation.errors : [],
      warnings: validation.warnings,
    });
  }

  const sql = database();
  try {
    const parsedRequest = request.data as ImportRequest;
    if (parsedRequest.validate_only) {
      const preview = await previewBrandResearch(sql, parsedRequest, validation.data, validation.warnings);
      return reply(200, preview);
    }
    const result = await importBrandResearch(sql, admin.id, parsedRequest, validation.data, validation.warnings);
    return reply(201, result);
  } catch (error) {
    if (error instanceof ImportConflictError) return reply(error.statusCode, { error: error.message });
    throw error;
  }
});

export async function previewBrandResearch(
  sql: any,
  request: ImportRequest,
  document: BrandResearchDocument,
  initialWarnings: BrandResearchWarning[] = [],
) {
  const warnings = [...initialWarnings];
  if (request.organisation_id) {
    const organisation = await loadOrganisation(sql, request.organisation_id);
    warnings.push(...organisationWarnings(organisation, document));
  }
  return {
    ok: true,
    valid: true,
    summary: {
      brand_name: document.brand.reference_name,
      products: document.products.length,
      claims: document.claims.length,
      sources: document.sources.length,
    },
    warnings,
  };
}

export async function importBrandResearch(
  sql: any,
  adminUserId: string,
  request: ImportRequest,
  document: BrandResearchDocument,
  initialWarnings: BrandResearchWarning[] = [],
) {
  let organisation: ExistingOrganisation | null = null;
  let organisationId = request.organisation_id || randomUUID();
  const warnings = [...initialWarnings];

  if (request.organisation_id) {
    organisation = await loadOrganisation(sql, request.organisation_id);
    organisationId = organisation.id;
    warnings.push(...organisationWarnings(organisation, document));
  }

  const importId = randomUUID();
  const createOrganisation = request.create_organisation
    ? sql`
        insert into public.organisations (
          id, name, slug, organisation_type, country_code, status, onboarding_status, metadata
        ) values (
          ${organisationId}::uuid,
          ${document.brand.reference_name},
          ${`${slugify(document.brand.reference_name)}-${organisationId.slice(0, 8)}`},
          'brand',
          ${proposedCountry(document)},
          'pending',
          'in_progress',
          ${JSON.stringify({ research_assisted: true, research_schema_version: document.schema_version })}::jsonb
        )
      `
    : null;

  const insertImport = sql`
    insert into public.brand_research_imports (
      id, organisation_id, schema_version, generated_at,
      generator_name, generator_version, generator_model,
      profile_context, raw_payload, validation_report, status,
      created_by_admin_user_id
    ) values (
      ${importId}::uuid,
      ${organisationId}::uuid,
      ${document.schema_version},
      ${document.generated_at}::timestamptz,
      ${document.generator.name},
      ${document.generator.version},
      ${document.generator.model || null},
      ${JSON.stringify(document.profile_context)}::jsonb,
      ${JSON.stringify(document)}::jsonb,
      ${JSON.stringify({ valid: true, errors: [], warnings })}::jsonb,
      'ready_for_review',
      ${adminUserId}::uuid
    )
  `;

  const sources = new Map(document.sources.map(source => [source.source_id, source]));
  const insertClaims = document.claims.map(claim => sql`
    insert into public.brand_research_claims (
      import_id, organisation_id, claim_key, entity_type, entity_key,
      field_key, proposed_value, research_provenance, confidence,
      presentation_action, review_required, source_ids,
      source_references, rationale
    ) values (
      ${importId}::uuid,
      ${organisationId}::uuid,
      ${claim.claim_id},
      ${claim.entity_type},
      ${claim.entity_key},
      ${claim.field_key},
      ${JSON.stringify(claim.value)}::jsonb,
      ${claim.research_provenance},
      ${claim.confidence},
      ${claim.presentation_action},
      ${claim.review_required},
      ${pgTextArray(claim.source_ids)}::text[],
      ${JSON.stringify(claim.source_ids.map(sourceId => sources.get(sourceId)).filter(Boolean))}::jsonb,
      ${claim.rationale}
    )
  `);

  await sql.transaction([
    ...(createOrganisation ? [createOrganisation] : []),
    insertImport,
    ...insertClaims,
  ]);

  return {
    ok: true,
    import_id: importId,
    organisation_id: organisationId,
    organisation_created: request.create_organisation,
    status: 'ready_for_review',
    counts: {
      products: document.products.length,
      claims: document.claims.length,
      sources: document.sources.length,
      warnings: warnings.length,
    },
    warnings,
  };
}

async function loadOrganisation(sql: any, organisationId: string): Promise<ExistingOrganisation> {
  const rows = await sql`
    select o.id, o.name, o.organisation_type, o.country_code, p.website
    from public.organisations o
    left join public.brand_onboarding_profiles p on p.organisation_id = o.id
    where o.id = ${organisationId}::uuid
    limit 1
  `;
  const organisation = rows[0] || null;
  if (!organisation) throw new ImportConflictError(404, 'The selected organisation could not be found.');
  if (organisation.organisation_type !== 'brand') throw new ImportConflictError(409, 'Research can only be imported into a brand organisation.');
  return organisation;
}

function organisationWarnings(organisation: ExistingOrganisation, document: BrandResearchDocument) {
  const warnings: BrandResearchWarning[] = [];
  if (normalise(organisation.name) !== normalise(document.brand.reference_name)) {
    warnings.push({
      code: 'organisation_name_conflict',
      path: 'brand.reference_name',
      message: `The import names ${document.brand.reference_name}, while the selected organisation is ${organisation.name}.`,
    });
  }
  const proposedWebsite = claimValue(document, 'brand.website') || document.brand.match_hints?.website;
  if (organisation.website && proposedWebsite && normaliseUrl(organisation.website) !== normaliseUrl(String(proposedWebsite))) {
    warnings.push({ code: 'organisation_website_conflict', path: 'brand.match_hints.website', message: 'The imported website differs from the selected organisation.' });
  }
  const country = proposedCountry(document);
  if (organisation.country_code && country && organisation.country_code !== country) {
    warnings.push({ code: 'organisation_country_conflict', path: 'brand.match_hints.country_code', message: 'The imported country differs from the selected organisation.' });
  }
  return warnings;
}

function proposedCountry(document: BrandResearchDocument) {
  const claimed = claimValue(document, 'brand.country_code');
  return typeof claimed === 'string' ? claimed : document.brand.match_hints?.country_code || null;
}

function claimValue(document: BrandResearchDocument, fieldKey: string) {
  return document.claims.find(claim => claim.entity_type === 'brand' && claim.field_key === fieldKey && claim.value !== null)?.value;
}

function normalise(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function normaliseUrl(value: string) {
  try { const url = new URL(value); return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase(); }
  catch { return value.trim().toLowerCase().replace(/\/$/, ''); }
}
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'brand'; }
function pgTextArray(values: string[]) { return `{${values.map(item => `"${item.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`; }

class ImportConflictError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
