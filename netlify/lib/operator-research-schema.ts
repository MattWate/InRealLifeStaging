import { z } from 'zod';

export const OPERATOR_RESEARCH_VERSION = 'irl-operator-research-v1' as const;

export const OPERATOR_FIELD_RULES = {
  'property.name': 'text', 'property.website': 'url', 'property.address': 'text',
  'property.city': 'text', 'property.country_code': 'country',
  'property.property_type': 'text', 'property.positioning': 'text',
  'property.description': 'text', 'property.design_character': 'text',
  'property.total_rooms': 'number', 'property.operator_name': 'text',
  'property.guest_proposition': 'text', 'property.local_context': 'text',
  'room.name': 'text', 'room.unit_count': 'number', 'room.max_guests': 'number',
  'room.amenities': 'list', 'room.description': 'text',
  'space.name': 'text', 'space.type': 'text', 'space.amenities': 'list',
  'space.guest_access': 'text', 'space.description': 'text',
  'audience.segment': 'text', 'audience.travel_purposes': 'list',
  'audience.lifestyle_signals': 'list', 'audience.geography': 'text',
  'zone.strength': 'text', 'zone.physical_locations': 'list',
  'zone.category_opportunities': 'list', 'zone.evidence_notes': 'text',
  'operations.booking_platforms': 'list', 'operations.reporting_capability': 'text',
  'operations.placement_constraints': 'text', 'operations.fulfilment_owner': 'text',
} as const;

export type OperatorFieldKey = keyof typeof OPERATOR_FIELD_RULES;
export const EXPERIENCE_ZONE_CODES = [
  'sleep_recovery', 'bath_body', 'food_drink', 'living_social',
  'work_focus', 'arrival_welcome', 'outdoor_movement',
] as const;

const key = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).max(150);
const httpsUrl = z.string().url().max(2048).refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !/(^localhost$|\.localhost$|\.local$)/i.test(url.hostname) && !/^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname); }
  catch { return false; }
}, 'Use a public HTTPS URL.');

const item = z.object({
  external_key: key,
  reference_name: z.string().trim().min(1).max(200),
}).strict();
const source = z.object({
  source_id: key, source_type: z.enum(['official_website','booking_platform','review_platform','social','publication','other']),
  title: z.string().trim().min(1).max(300), url: httpsUrl,
  accessed_at: z.string().datetime({ offset: true }),
}).strict();

const claim = z.object({
  claim_id: key,
  entity_type: z.enum(['property','room','space','audience','zone','operations']),
  entity_key: key,
  field_key: z.enum(Object.keys(OPERATOR_FIELD_RULES) as [OperatorFieldKey, ...OperatorFieldKey[]]),
  value: z.union([z.string().max(5000), z.number().finite().nonnegative(), z.array(z.string().max(300)).max(30), z.null()]),
  research_provenance: z.enum(['research_verified','research_assumption','data_gap']),
  confidence: z.enum(['high','medium','low','unknown']),
  presentation_action: z.enum(['show_confirm','ask','internal_only','defer']),
  review_required: z.boolean(), source_ids: z.array(key).max(30),
  rationale: z.string().trim().min(1).max(1000),
}).strict();

export const operatorResearchSchema = z.object({
  schema_version: z.literal(OPERATOR_RESEARCH_VERSION),
  generated_at: z.string().datetime({ offset: true }),
  generator: z.object({ name: z.string().trim().min(1).max(200), version: z.string().trim().min(1).max(100), model: z.string().max(200).optional() }).strict(),
  property: z.object({ external_key: key, reference_name: z.string().trim().min(1).max(200), match_hints: z.object({ website: httpsUrl.optional(), city: z.string().max(200).optional(), country_code: z.string().regex(/^[A-Z]{2}$/).optional() }).strict() }).strict(),
  rooms: z.array(item).max(100), spaces: z.array(item).max(150),
  audiences: z.array(item).max(30),
  zones: z.array(z.object({ external_key: z.enum(EXPERIENCE_ZONE_CODES), reference_name: z.string().max(200) }).strict()).max(7),
  claims: z.array(claim).max(1000), sources: z.array(source).max(250),
}).strict().superRefine((doc, ctx) => {
  const entityKeys = new Set([
    `property:${doc.property.external_key}`, `operations:${doc.property.external_key}`,
    ...doc.rooms.map(v => `room:${v.external_key}`), ...doc.spaces.map(v => `space:${v.external_key}`),
    ...doc.audiences.map(v => `audience:${v.external_key}`), ...doc.zones.map(v => `zone:${v.external_key}`),
  ]);
  const sourceIds = new Set(doc.sources.map(s => s.source_id));
  const claimIds = new Set<string>();
  for (const [index, row] of doc.claims.entries()) {
    const where = ['claims', index];
    if (claimIds.has(row.claim_id)) ctx.addIssue({ code:'custom', path:[...where,'claim_id'], message:'Duplicate claim ID.' });
    claimIds.add(row.claim_id);
    if (!entityKeys.has(`${row.entity_type}:${row.entity_key}`)) ctx.addIssue({ code:'custom', path:[...where,'entity_key'], message:'Unknown research entity.' });
    if (!row.field_key.startsWith(`${row.entity_type}.`)) ctx.addIssue({ code:'custom', path:[...where,'field_key'], message:'Field does not belong to this entity type.' });
    if (row.source_ids.some(id => !sourceIds.has(id))) ctx.addIssue({ code:'custom', path:[...where,'source_ids'], message:'Unknown source ID.' });
    if (row.research_provenance === 'research_verified' && row.source_ids.length === 0) ctx.addIssue({ code:'custom', path:[...where,'source_ids'], message:'Verified research requires a source.' });
    if (row.research_provenance === 'data_gap' && (row.value !== null || !row.review_required)) ctx.addIssue({ code:'custom', path:where, message:'Data gaps must have null values and require review.' });
    const kind = OPERATOR_FIELD_RULES[row.field_key];
    if (row.value !== null && ((kind === 'number' && typeof row.value !== 'number') || (kind === 'list' && !Array.isArray(row.value)) || (!['number','list'].includes(kind) && typeof row.value !== 'string'))) ctx.addIssue({ code:'custom', path:[...where,'value'], message:`Expected ${kind} value.` });
    if (row.value !== null && kind === 'country' && !/^[A-Z]{2}$/.test(String(row.value))) ctx.addIssue({ code:'custom', path:[...where,'value'], message:'Use a two-letter country code.' });
    if (row.value !== null && kind === 'url' && !httpsUrl.safeParse(row.value).success) ctx.addIssue({ code:'custom', path:[...where,'value'], message:'Use a public HTTPS URL.' });
  }
  for (const [label, entries] of [['rooms',doc.rooms],['spaces',doc.spaces],['audiences',doc.audiences],['zones',doc.zones]] as const) {
    if (new Set(entries.map(v => v.external_key)).size !== entries.length) ctx.addIssue({ code:'custom', path:[label], message:'Entity keys must be unique.' });
  }
  if (sourceIds.size !== doc.sources.length) ctx.addIssue({ code:'custom', path:['sources'], message:'Source IDs must be unique.' });
});

export type OperatorResearchDocument = z.infer<typeof operatorResearchSchema>;
export function validateOperatorResearch(input: unknown) { return operatorResearchSchema.safeParse(input); }
