import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateSubmission } from '../lib/onboarding-validation';

type FormValue = string | string[];
type Payload = {
  session_id?: string | null;
  flow?: 'operator' | 'brand';
  current_step?: string;
  completion_percentage?: number;
  submit?: boolean;
  form?: Record<string, FormValue>;
};

const SECTION_BY_FIELD: Record<string, string> = {
  operatorName: 'organisation', operatorFirstName: 'organisation', operatorLastName: 'organisation',
  operatorEmail: 'organisation', operatorRole: 'organisation',
  propertyName: 'property', propertyCity: 'property', propertyCountry: 'property', propertyType: 'property',
  totalRooms: 'property', totalUnits: 'property', propertyDescription: 'property',
  guestTypes: 'guests', guestPriorities: 'guests', reviewIssue: 'guests', seasonality: 'guests',
  spaces: 'spaces', categoryOpportunities: 'spaces', categoryRestrictions: 'spaces',
  deliveryOwner: 'operations', placementOwner: 'operations', evidenceOwner: 'operations', operationsConfidence: 'operations',
  bookingPlatforms: 'data', pms: 'data', reportingCapability: 'data',
};

export const handler: Handler = async (event) => {
  if (!['POST', 'PUT'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed.' });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return reply(500, { error: 'DATABASE_URL is not configured.' });

  try {
    if ((event.body?.length || 0) > 262144) return reply(413, { error: 'This form is too large to save.' });
    const body = JSON.parse(event.body || '{}') as Payload;
    const invalid = validateSubmission(body, 'operator');
    if (invalid) return reply(400, { error: invalid });
    if (body.flow !== 'operator') return reply(400, { error: 'This endpoint currently supports operator onboarding.' });
    const form = body.form || {};
    const operatorName = text(form.operatorName);
    if (!operatorName) return reply(400, { error: 'Enter the operator or group name before saving online.' });

    const sql = neon(databaseUrl);
    const result = await saveOperatorOnboarding(sql, body, form, operatorName);
    return reply(200, result);
  } catch (error) {
    console.error('Operator onboarding save failed', error);
    return reply(error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'Invalid request.' : 'Unable to save online. Please try again.' });
  }
};

async function saveOperatorOnboarding(sql: any, body: Payload, form: Record<string, FormValue>, operatorName: string) {
  let organisationId: string;
  let propertyId: string | null = null;
  let sessionId = body.session_id || null;

  if (sessionId) {
    const sessions = await sql`
      select id, organisation_id, property_id, status, submitted_at
      from public.onboarding_sessions
      where id = ${sessionId}::uuid and onboarding_type = 'operator'
      limit 1
    `;
    if (!sessions.length) throw new Error('The saved onboarding session could not be found. Clear the local draft and start again.');
    if (sessions[0].status === 'submitted') return { ok: true, session_id: sessionId, status: 'submitted', saved_at: sessions[0].submitted_at };
    organisationId = sessions[0].organisation_id;
    propertyId = sessions[0].property_id || null;
  } else {
    const organisationSlug = `${slugify(operatorName)}-${Date.now().toString(36)}`;
    const organisationRows = await sql`
      insert into public.organisations (
        name, slug, organisation_type, primary_email, country_code, city,
        status, onboarding_status, metadata
      ) values (
        ${operatorName}, ${organisationSlug}, 'operator', ${nullable(form.operatorEmail)},
        ${countryCode(form.propertyCountry)}, ${nullable(form.propertyCity)},
        'pending', 'in_progress', ${JSON.stringify(contactMetadata(form))}::jsonb
      ) returning id
    `;
    organisationId = organisationRows[0].id;

    const propertyName = text(form.propertyName);
    if (propertyName) propertyId = await createProperty(sql, organisationId, propertyName, form);

    const sessionRows = await sql`
      insert into public.onboarding_sessions (
        organisation_id, property_id, onboarding_type, current_step, status, completion_percentage
      ) values (
        ${organisationId}::uuid, ${propertyId}::uuid, 'operator', ${nullable(body.current_step)},
        'in_progress', ${percentage(body.completion_percentage)}
      ) returning id
    `;
    sessionId = sessionRows[0].id;
  }

  await sql`
    update public.organisations set
      name = ${operatorName},
      primary_email = ${nullable(form.operatorEmail)},
      country_code = coalesce(${countryCode(form.propertyCountry)}, country_code),
      city = coalesce(${nullable(form.propertyCity)}, city),
      onboarding_status = ${body.submit ? 'submitted' : 'in_progress'},
      metadata = metadata || ${JSON.stringify(contactMetadata(form))}::jsonb,
      updated_at = now()
    where id = ${organisationId}::uuid
  `;

  const propertyName = text(form.propertyName);
  if (propertyName && !propertyId) {
    propertyId = await createProperty(sql, organisationId, propertyName, form);
  } else if (propertyId) {
    await updateProperty(sql, propertyId, form, body.submit === true);
  }

  await sql`
    insert into public.operator_profiles (
      organisation_id, operator_type, number_of_properties, primary_pms,
      other_systems, reporting_capability, description, notes
    ) values (
      ${organisationId}::uuid, 'hospitality_operator', 1, ${nullable(form.pms)},
      ${pgTextArray(form.bookingPlatforms)}::text[], ${reportingCapability(form.reportingCapability)},
      ${nullable(form.propertyDescription)}, ${nullable(operationsSummary(form))}
    )
    on conflict (organisation_id) do update set
      primary_pms = excluded.primary_pms,
      other_systems = excluded.other_systems,
      reporting_capability = excluded.reporting_capability,
      description = excluded.description,
      notes = excluded.notes,
      updated_at = now()
  `;

  const answerStatus = body.submit ? 'submitted' : 'draft';
  for (const [fieldKey, answer] of Object.entries(form)) {
    if (!SECTION_BY_FIELD[fieldKey]) continue;
    await sql`
      insert into public.onboarding_answers (
        onboarding_session_id, section_key, field_key, answer_json, status
      ) values (
        ${sessionId}::uuid, ${SECTION_BY_FIELD[fieldKey]}, ${fieldKey},
        ${JSON.stringify(answer)}::jsonb, ${answerStatus}
      )
      on conflict (onboarding_session_id, section_key, field_key) do update set
        answer_json = excluded.answer_json,
        status = excluded.status,
        updated_at = now()
    `;
  }

  if (propertyId) await syncSpaces(sql, propertyId, form.spaces);

  const finalUpdate = sql`
    update public.onboarding_sessions set
      property_id = ${propertyId}::uuid,
      current_step = ${nullable(body.current_step)},
      completion_percentage = case when status = 'submitted' or ${body.submit === true} then 100 else ${percentage(body.completion_percentage)} end,
      status = case when status = 'submitted' or ${body.submit === true} then 'submitted' else status end,
      submitted_at = coalesce(submitted_at, ${body.submit ? new Date().toISOString() : null}::timestamptz),
      updated_at = now()
    where id = ${sessionId}::uuid
  `;
  if (body.submit) await sql.transaction([
    finalUpdate,
    sql`insert into public.irl_submission_snapshots (session_id, answers) values (${sessionId}::uuid, ${JSON.stringify(form)}::jsonb) on conflict (session_id) do nothing`,
  ]);
  else await finalUpdate;

  return {
    ok: true,
    session_id: sessionId,
    organisation_id: organisationId,
    property_id: propertyId,
    status: body.submit ? 'submitted' : 'in_progress',
    saved_at: new Date().toISOString(),
  };
}

async function createProperty(sql: any, organisationId: string, propertyName: string, form: Record<string, FormValue>) {
  const propertySlug = `${slugify(propertyName)}-${Date.now().toString(36)}`;
  const rows = await sql`
    insert into public.properties (
      operator_organisation_id, name, slug, property_type, description_operator,
      city, country_code, total_rooms, total_units, status, onboarding_status
    ) values (
      ${organisationId}::uuid, ${propertyName}, ${propertySlug}, ${propertyType(form.propertyType)},
      ${nullable(form.propertyDescription)}, ${nullable(form.propertyCity)}, ${countryCode(form.propertyCountry)},
      ${integerOrNull(form.totalRooms)}, ${integerOrNull(form.totalUnits)}, 'draft', 'in_progress'
    ) returning id
  `;
  return rows[0].id;
}

async function updateProperty(sql: any, propertyId: string, form: Record<string, FormValue>, submitted: boolean) {
  await sql`
    update public.properties set
      name = coalesce(${nullable(form.propertyName)}, name),
      property_type = coalesce(${propertyType(form.propertyType)}, property_type),
      description_operator = ${nullable(form.propertyDescription)},
      city = ${nullable(form.propertyCity)},
      country_code = ${countryCode(form.propertyCountry)},
      total_rooms = ${integerOrNull(form.totalRooms)},
      total_units = ${integerOrNull(form.totalUnits)},
      peak_season_notes = ${nullable(form.seasonality)},
      onboarding_status = ${submitted ? 'submitted' : 'in_progress'},
      updated_at = now()
    where id = ${propertyId}::uuid
  `;
}

async function syncSpaces(sql: any, propertyId: string, value: FormValue | undefined) {
  const spaces = Array.isArray(value) ? value : [];
  for (const space of spaces) {
    await sql`
      insert into public.spaces (property_id, name, space_type, private_or_communal, active)
      values (${propertyId}::uuid, ${space}, ${slugify(space)}, ${spacePrivacy(space)}, true)
      on conflict (property_id, name) do update set active = true, updated_at = now()
    `;
  }
}

function contactMetadata(form: Record<string, FormValue>) {
  return {
    onboarding_primary_contact: {
      first_name: text(form.operatorFirstName) || null,
      last_name: text(form.operatorLastName) || null,
      email: text(form.operatorEmail) || null,
      role: text(form.operatorRole) || null,
    },
    onboarding_operations: {
      delivery_owner: text(form.deliveryOwner) || null,
      placement_owner: text(form.placementOwner) || null,
      evidence_owner: text(form.evidenceOwner) || null,
      confidence: first(form.operationsConfidence) || null,
    },
  };
}

function operationsSummary(form: Record<string, FormValue>) {
  const parts = [
    text(form.deliveryOwner) && `Deliveries: ${text(form.deliveryOwner)}`,
    text(form.placementOwner) && `Placement: ${text(form.placementOwner)}`,
    text(form.evidenceOwner) && `Evidence: ${text(form.evidenceOwner)}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

function reportingCapability(value: FormValue | undefined) {
  const selected = first(value).toLowerCase();
  if (selected === 'yes, easily') return 'export';
  if (selected === 'yes, with help') return 'manual';
  if (selected === 'no') return 'none';
  return 'unknown';
}

function propertyType(value: FormValue | undefined) {
  const selected = first(value);
  const map: Record<string, string> = {
    Hotel: 'hotel', Hostel: 'hostel', Guesthouse: 'guesthouse',
    'Boutique hotel': 'boutique_hotel', 'Serviced apartments': 'serviced_apartments',
    'Self-catering': 'self_catering', 'Hybrid hospitality': 'hybrid_hospitality',
  };
  return map[selected] || 'other';
}

function spacePrivacy(space: string) {
  return ['Guest rooms', 'Bathrooms'].includes(space) ? 'private' : 'communal';
}

function countryCode(value: FormValue | undefined) {
  const raw = text(value).trim();
  if (!raw) return null;
  const map: Record<string, string> = {
    'south africa': 'ZA', 'united kingdom': 'GB', 'uk': 'GB', 'zimbabwe': 'ZW',
    'united states': 'US', 'usa': 'US', 'united arab emirates': 'AE', 'uae': 'AE',
  };
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return map[raw.toLowerCase()] || null;
}

function percentage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}
function integerOrNull(value: FormValue | undefined) {
  const number = Number(text(value));
  return Number.isInteger(number) && number >= 0 ? number : null;
}
function pgTextArray(value: FormValue | undefined) {
  const values = Array.isArray(value) ? value : [];
  return `{${values.map((item) => `"${String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}
function first(value: FormValue | undefined) { return Array.isArray(value) ? String(value[0] || '') : text(value); }
function text(value: FormValue | undefined) { return typeof value === 'string' ? value.trim() : ''; }
function nullable(value: FormValue | undefined) { return text(value) || null; }
function isBlank(value: FormValue) { return Array.isArray(value) ? value.length === 0 : !value.trim(); }
function slugify(value: unknown) { return String(value || 'record').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70); }
function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as any).message);
  return 'Unknown database error.';
}
function reply(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}
