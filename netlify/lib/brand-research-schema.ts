import { z } from 'zod';

export const BRAND_RESEARCH_SCHEMA_VERSION = 'irl-brand-research-v1' as const;

const KEY = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const CODE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const ISO_CODE = /^[A-Z]{2}$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const REGION_CODES = new Set([
  'GLOBAL', 'AFRICA', 'SOUTHERN_AFRICA', 'EAST_AFRICA', 'WEST_AFRICA',
  'EUROPE', 'EU', 'MIDDLE_EAST', 'NORTH_AMERICA', 'LATIN_AMERICA', 'ASIA_PACIFIC',
]);

const PRIMARY_CATEGORIES = [
  'food_and_beverage', 'health_and_wellness', 'beauty_and_personal_care',
  'sleep_and_bedding', 'home_and_living', 'outdoor_and_movement', 'other',
] as const;
const POSITIONING_TIERS = ['value', 'mainstream', 'mass_premium', 'premium', 'luxury', 'unknown'] as const;
const SALES_CHANNELS = [
  'brand_website', 'brand_owned_stores', 'major_retail', 'independent_retail',
  'online_marketplaces', 'hospitality', 'professional_or_trade_channels', 'subscription', 'other',
] as const;
const AUDIENCE_EVIDENCE = [
  'customer_or_sales_data', 'surveys_or_customer_feedback', 'social_media_analytics',
  'industry_research', 'founders_direct_experience', 'assumption_not_yet_tested', 'other',
] as const;
const AUDIENCE_GEOGRAPHY = [
  'primarily_south_african', 'primarily_international', 'both_local_and_international',
  'specific_countries_or_regions', 'geography_not_a_priority',
] as const;
const AGE_GROUPS = ['18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] as const;
const LIFE_STAGES = [
  'single_or_young_professional', 'couple_no_children', 'parents_young_children',
  'parents_older_children_or_teens', 'multigenerational_household',
  'empty_nesters_or_older_adults', 'students',
] as const;
const LIFESTYLES = [
  'wellness_and_health_conscious', 'adventure_and_exploration', 'family_and_togetherness',
  'social_connection_and_community', 'comfort_and_relaxation',
  'sustainability_and_conscious_living', 'design_culture_and_discovery',
] as const;
const MARKETING_CHANNELS = [
  'social_media_organic', 'paid_social_ads', 'google_or_search_ads',
  'influencer_or_creator_partnerships', 'email_marketing', 'pr_or_media_coverage',
  'retail_or_in_store_presence', 'word_of_mouth', 'events_or_activations', 'own_website', 'other',
] as const;
const INTERNATIONAL_SHIPPING = ['yes', 'yes_specific_regions', 'no', 'unknown'] as const;

type FieldRule = {
  kind: 'text' | 'url' | 'code' | 'country' | 'currency' | 'number' | 'codes' | 'markets';
  allowed?: readonly string[];
  maxLength?: number;
  maxItems?: number;
};

export const BRAND_RESEARCH_FIELD_REGISTRY = {
  'brand.name': { kind: 'text', maxLength: 200 },
  'brand.website': { kind: 'url' },
  'brand.country_code': { kind: 'country' },
  'brand.city': { kind: 'text', maxLength: 200 },
  'brand.parent_company_name': { kind: 'text', maxLength: 200 },
  'brand.proposition': { kind: 'text', maxLength: 200 },
  'brand.primary_category_code': { kind: 'code', allowed: PRIMARY_CATEGORIES },
  'brand.secondary_category_codes': { kind: 'codes', allowed: PRIMARY_CATEGORIES },
  'brand.positioning_tier_code': { kind: 'code', allowed: POSITIONING_TIERS },
  'brand.active_market_codes': { kind: 'markets' },
  'brand.sales_channel_codes': { kind: 'codes', allowed: SALES_CHANNELS },
  'brand.marketing_channel_codes': { kind: 'codes', allowed: MARKETING_CHANNELS },
  'brand.marketing_channel_rank_codes': { kind: 'codes', allowed: MARKETING_CHANNELS, maxItems: 3 },
  'brand.measured_acquisition_channel_code': { kind: 'code', allowed: [...MARKETING_CHANNELS, 'we_dont_currently_know'] },
  'brand.research_summary': { kind: 'text', maxLength: 5000 },
  'product.name': { kind: 'text', maxLength: 200 },
  'product.webpage': { kind: 'url' },
  'product.category_code': { kind: 'code', allowed: PRIMARY_CATEGORIES },
  'product.subcategory_code': { kind: 'code' },
  'product.format_description': { kind: 'text', maxLength: 1000 },
  'product.currency_code': { kind: 'currency' },
  'product.retail_price_min': { kind: 'number' },
  'product.retail_price_max': { kind: 'number' },
  'product.variants': { kind: 'text', maxLength: 2000 },
  'product.market_codes': { kind: 'markets' },
  'product.sales_channel_codes': { kind: 'codes', allowed: SALES_CHANNELS },
  'product.international_shipping_code': { kind: 'code', allowed: INTERNATIONAL_SHIPPING },
  'product.handling_requirement_codes': { kind: 'codes' },
  'product.supply_capability_code': { kind: 'code' },
  'product.research_notes': { kind: 'text', maxLength: 5000 },
  'audience.description': { kind: 'text', maxLength: 200 },
  'audience.evidence_source_code': { kind: 'code', allowed: AUDIENCE_EVIDENCE },
  'audience.geography_code': { kind: 'code', allowed: AUDIENCE_GEOGRAPHY },
  'audience.geography_detail': { kind: 'text', maxLength: 1000 },
  'audience.age_group_codes': { kind: 'codes', allowed: AGE_GROUPS },
  'audience.life_stage_codes': { kind: 'codes', allowed: LIFE_STAGES },
  'audience.lifestyle_codes': { kind: 'codes', allowed: LIFESTYLES, maxItems: 3 },
} as const satisfies Record<string, FieldRule>;

export type BrandResearchFieldKey = keyof typeof BRAND_RESEARCH_FIELD_REGISTRY;

const generatorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200).optional(),
}).strict();

const contextSchema = z.object({
  purpose: z.literal('opportunity_confirmation'),
  notes: z.string().trim().max(5000).optional(),
}).strict();

const brandSchema = z.object({
  external_key: z.string().regex(KEY).max(150),
  reference_name: z.string().trim().min(1).max(200),
  match_hints: z.object({
    website: z.string().url().refine(isSafePublicUrl, 'URL must use HTTPS.').optional(),
    country_code: z.string().regex(ISO_CODE, 'Use a two-letter uppercase ISO country code.').optional(),
  }).strict().optional(),
}).strict();

const productSchema = z.object({
  external_key: z.string().regex(KEY).max(150),
  reference_name: z.string().trim().min(1).max(200),
  suggest_for_opportunity: z.boolean(),
}).strict();

const claimSchema = z.object({
  claim_id: z.string().regex(KEY).max(150),
  entity_type: z.enum(['brand', 'product']),
  entity_key: z.string().regex(KEY).max(150),
  field_key: z.enum(Object.keys(BRAND_RESEARCH_FIELD_REGISTRY) as [BrandResearchFieldKey, ...BrandResearchFieldKey[]]),
  value: z.unknown().nullable(),
  research_provenance: z.enum(['research_verified', 'research_assumption', 'brand_supplied', 'data_gap']),
  confidence: z.enum(['high', 'medium', 'low', 'unknown']),
  presentation_action: z.enum(['show_confirm', 'ask', 'internal_only', 'defer']),
  review_required: z.boolean(),
  source_ids: z.array(z.string().regex(KEY).max(150)).max(100),
  rationale: z.string().trim().min(1).max(1000),
}).strict();

const sourceSchema = z.object({
  source_id: z.string().regex(KEY).max(150),
  source_type: z.enum([
    'official_website', 'official_product_page', 'official_social', 'retailer',
    'publication', 'public_registry', 'brand_conversation', 'other',
  ]),
  title: z.string().trim().min(1).max(500),
  publisher: z.string().trim().min(1).max(300),
  url: z.string().url().refine(isSafePublicUrl, 'URL must use HTTPS.').optional(),
  accessed_at: z.string().datetime({ offset: true }),
}).strict().superRefine((source, context) => {
  if (source.source_type !== 'brand_conversation' && !source.url) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message: 'A URL is required for this source type.' });
  }
});

export const brandResearchDocumentSchema = z.object({
  schema_version: z.literal(BRAND_RESEARCH_SCHEMA_VERSION),
  generated_at: z.string().datetime({ offset: true }),
  generator: generatorSchema,
  profile_context: contextSchema,
  brand: brandSchema,
  products: z.array(productSchema).max(250),
  claims: z.array(claimSchema).max(5000),
  sources: z.array(sourceSchema).max(1000),
}).strict();

export type BrandResearchClaim = {
  claim_id: string;
  entity_type: 'brand' | 'product';
  entity_key: string;
  field_key: BrandResearchFieldKey;
  value: unknown | null;
  research_provenance: 'research_verified' | 'research_assumption' | 'brand_supplied' | 'data_gap';
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  presentation_action: 'show_confirm' | 'ask' | 'internal_only' | 'defer';
  review_required: boolean;
  source_ids: string[];
  rationale: string;
};
export type BrandResearchDocument = {
  schema_version: typeof BRAND_RESEARCH_SCHEMA_VERSION;
  generated_at: string;
  generator: { name: string; version: string; model?: string };
  profile_context: { purpose: 'opportunity_confirmation'; notes?: string };
  brand: { external_key: string; reference_name: string; match_hints?: { website?: string; country_code?: string } };
  products: Array<{ external_key: string; reference_name: string; suggest_for_opportunity: boolean }>;
  claims: BrandResearchClaim[];
  sources: Array<{
    source_id: string;
    source_type: 'official_website' | 'official_product_page' | 'official_social' | 'retailer' | 'publication' | 'public_registry' | 'brand_conversation' | 'other';
    title: string;
    publisher: string;
    url?: string;
    accessed_at: string;
  }>;
};
export type BrandResearchWarning = { code: string; message: string; path?: string };
export type BrandResearchError = { code: string; message: string; path?: string };

export type BrandResearchValidation =
  | { success: true; data: BrandResearchDocument; warnings: BrandResearchWarning[] }
  | { success: false; errors: BrandResearchError[]; warnings: BrandResearchWarning[] };

export function validateBrandResearchDocument(input: unknown): BrandResearchValidation {
  const parsed = brandResearchDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const errors: BrandResearchError[] = [];
    for (const issue of parsed.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) errors.push({
          code: issue.code,
          message: `Unknown property: ${key}.`,
          path: [...issue.path, key].join('.'),
        });
      } else errors.push({ code: issue.code, message: issue.message, path: issue.path.join('.') });
    }
    return {
      success: false,
      warnings: [],
      errors,
    };
  }

  const document = parsed.data as BrandResearchDocument;
  const errors: BrandResearchError[] = [];
  const warnings: BrandResearchWarning[] = [];
  const productKeys = new Set(document.products.map(product => product.external_key));
  const entityKeys = new Set([document.brand.external_key, ...productKeys]);
  const sourceKeys = new Set(document.sources.map(source => source.source_id));

  addDuplicateErrors(document.products.map(item => item.external_key), 'duplicate_product_key', 'products', errors);
  addDuplicateErrors(document.claims.map(item => item.claim_id), 'duplicate_claim_id', 'claims', errors);
  addDuplicateErrors(document.sources.map(item => item.source_id), 'duplicate_source_id', 'sources', errors);
  if (productKeys.has(document.brand.external_key)) {
    errors.push({ code: 'duplicate_entity_key', path: 'brand.external_key', message: 'The brand and products must use different external keys.' });
  }
  if (document.sources.length === 0 && document.claims.some(claim => !['brand_supplied', 'data_gap'].includes(claim.research_provenance))) {
    errors.push({
      code: 'sources_required',
      path: 'sources',
      message: 'Sources may be empty only when every claim is brand supplied or an explicit data gap.',
    });
  }

  for (const [index, claim] of document.claims.entries()) {
    const path = `claims.${index}`;
    if (!entityKeys.has(claim.entity_key)) {
      errors.push({ code: 'unknown_entity', path: `${path}.entity_key`, message: `Unknown entity key: ${claim.entity_key}.` });
    }
    if (claim.entity_type === 'brand' && claim.entity_key !== document.brand.external_key) {
      errors.push({ code: 'entity_type_mismatch', path: `${path}.entity_key`, message: 'Brand claims must reference the brand entity.' });
    }
    if (claim.entity_type === 'product' && !productKeys.has(claim.entity_key)) {
      errors.push({ code: 'entity_type_mismatch', path: `${path}.entity_key`, message: 'Product claims must reference a product entity.' });
    }
    if (claim.field_key.startsWith('product.') !== (claim.entity_type === 'product')) {
      errors.push({ code: 'field_entity_mismatch', path: `${path}.field_key`, message: 'The field key does not match the claim entity type.' });
    }
    for (const sourceId of claim.source_ids) {
      if (!sourceKeys.has(sourceId)) errors.push({ code: 'unknown_source', path: `${path}.source_ids`, message: `Unknown source ID: ${sourceId}.` });
    }
    if (claim.research_provenance === 'data_gap' && claim.value !== null) {
      errors.push({ code: 'invalid_gap_value', path: `${path}.value`, message: 'A data gap must have a null value.' });
    }
    if (claim.research_provenance !== 'data_gap' && claim.value === null) {
      errors.push({ code: 'missing_claim_value', path: `${path}.value`, message: 'Only a data gap may have a null value.' });
    }
    if (['research_assumption', 'data_gap'].includes(claim.research_provenance) && !claim.review_required) {
      errors.push({ code: 'review_required', path: `${path}.review_required`, message: 'Assumptions and data gaps must require review.' });
    }
    if (claim.value !== null) validateFieldValue(claim.field_key, claim.value, `${path}.value`, errors);

    if (claim.research_provenance === 'research_verified' && claim.source_ids.length === 0) {
      warnings.push({ code: 'verified_without_source', path, message: `${claim.claim_id} is verified but has no source.` });
    }
    if (claim.confidence === 'low' || claim.confidence === 'unknown') {
      warnings.push({ code: 'low_confidence', path, message: `${claim.claim_id} has ${claim.confidence} confidence.` });
    }
    if (claim.presentation_action === 'show_confirm' && [
      'product.international_shipping_code', 'product.handling_requirement_codes', 'product.supply_capability_code',
    ].includes(claim.field_key)) {
      warnings.push({ code: 'sensitive_confirmation', path, message: `${claim.field_key} should normally be internal or deferred.` });
    }
  }

  for (const product of document.products) {
    const fields = new Set(document.claims.filter(claim => claim.entity_key === product.external_key).map(claim => claim.field_key));
    if (!fields.has('product.name')) warnings.push({ code: 'product_name_missing', path: `products.${product.external_key}`, message: `${product.reference_name} has no product-name claim.` });
    if (!fields.has('product.category_code')) warnings.push({ code: 'product_category_missing', path: `products.${product.external_key}`, message: `${product.reference_name} has no product-category claim.` });
  }

  addCommercialWarnings(document, warnings);
  return errors.length ? { success: false, errors, warnings } : { success: true, data: document, warnings };
}

export function validateBrandResearchFieldValue(fieldKey: BrandResearchFieldKey, value: unknown) {
  const errors: BrandResearchError[] = [];
  validateFieldValue(fieldKey, value, 'value', errors);
  return errors;
}

function validateFieldValue(fieldKey: BrandResearchFieldKey, value: unknown, path: string, errors: BrandResearchError[]) {
  const rule: FieldRule = BRAND_RESEARCH_FIELD_REGISTRY[fieldKey];
  const invalid = (message: string) => errors.push({ code: 'invalid_field_value', path, message });

  if (rule.kind === 'text') {
    if (typeof value !== 'string' || !value.trim() || value.length > (rule.maxLength || 10000)) invalid(`${fieldKey} must be non-empty text of the permitted length.`);
    return;
  }
  if (rule.kind === 'url') {
    if (typeof value !== 'string' || !isSafePublicUrl(value)) invalid(`${fieldKey} must be a valid HTTPS URL.`);
    return;
  }
  if (rule.kind === 'country') {
    if (typeof value !== 'string' || !ISO_CODE.test(value)) invalid(`${fieldKey} must be a two-letter uppercase ISO country code.`);
    return;
  }
  if (rule.kind === 'currency') {
    if (typeof value !== 'string' || !CURRENCY_CODE.test(value)) invalid(`${fieldKey} must be a three-letter uppercase ISO currency code.`);
    return;
  }
  if (rule.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid(`${fieldKey} must be a number greater than or equal to zero.`);
    return;
  }
  if (rule.kind === 'code') {
    if (typeof value !== 'string' || !CODE.test(value) || (rule.allowed && !rule.allowed.includes(value))) invalid(`${fieldKey} contains an unsupported code.`);
    return;
  }
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string') || new Set(value).size !== value.length) {
    invalid(`${fieldKey} must be an array of unique codes.`);
    return;
  }
  if (rule.maxItems && value.length > rule.maxItems) invalid(`${fieldKey} allows at most ${rule.maxItems} values.`);
  if (rule.kind === 'markets') {
    if (value.some(item => !ISO_CODE.test(item) && !REGION_CODES.has(item))) invalid(`${fieldKey} contains an unsupported market code.`);
  } else if (value.some(item => !CODE.test(item) || (rule.allowed && !rule.allowed.includes(item)))) {
    invalid(`${fieldKey} contains an unsupported code.`);
  }
}

function addDuplicateErrors(values: string[], code: string, path: string, errors: BrandResearchError[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push({ code, path, message: `Duplicate key: ${value}.` });
    seen.add(value);
  }
}

function addCommercialWarnings(document: BrandResearchDocument, warnings: BrandResearchWarning[]) {
  for (const product of document.products) {
    const claims = document.claims.filter(claim => claim.entity_key === product.external_key && claim.value !== null);
    const get = (key: BrandResearchFieldKey) => claims.find(claim => claim.field_key === key)?.value;
    const min = get('product.retail_price_min');
    const max = get('product.retail_price_max');
    const currency = get('product.currency_code');
    if ((typeof min === 'number' || typeof max === 'number') && !currency) warnings.push({ code: 'price_without_currency', path: `products.${product.external_key}`, message: `${product.reference_name} has a price but no currency.` });
    if (typeof min === 'number' && typeof max === 'number' && max < min) warnings.push({ code: 'price_range_reversed', path: `products.${product.external_key}`, message: `${product.reference_name} has a maximum price below its minimum price.` });
  }
  const marketing = document.claims.find(claim => claim.field_key === 'brand.marketing_channel_codes')?.value;
  const rank = document.claims.find(claim => claim.field_key === 'brand.marketing_channel_rank_codes')?.value;
  if (Array.isArray(marketing) && Array.isArray(rank) && rank.some(code => !marketing.includes(code))) {
    warnings.push({ code: 'marketing_rank_mismatch', path: 'claims', message: 'A ranked marketing channel is not present in the marketing channel list.' });
  }
}

function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}
