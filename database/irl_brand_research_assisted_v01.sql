begin;

create extension if not exists pgcrypto;

-- Research-assisted Brand Onboarding V01.
--
-- This migration is deliberately additive. It leaves the full Brand
-- Onboarding V03 flow intact while adding the persistence required for:
--   1. immutable, versioned research imports;
--   2. field-level admin review;
--   3. customer-specific Lite invitations; and
--   4. field-level customer confirmation and correction.

-- --------------------------------------------------------------------------
-- Canonical profile fields required by the research-assisted workflow
-- --------------------------------------------------------------------------

alter table public.brand_onboarding_profiles
  add column if not exists positioning_tier_code text,
  add column if not exists readiness_status text not null default 'not_assessed';

alter table public.brand_onboarding_products
  add column if not exists format_description text;

alter table public.brand_audience_profiles
  add column if not exists geography_detail text,
  add column if not exists lifestyle_codes text[] not null default '{}';

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brand_profiles_positioning_tier_check'
      and conrelid = 'public.brand_onboarding_profiles'::regclass
  ) then
    alter table public.brand_onboarding_profiles
      add constraint brand_profiles_positioning_tier_check
      check (
        positioning_tier_code is null
        or positioning_tier_code in (
          'value',
          'mainstream',
          'mass_premium',
          'premium',
          'luxury',
          'unknown'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'brand_profiles_readiness_status_check'
      and conrelid = 'public.brand_onboarding_profiles'::regclass
  ) then
    alter table public.brand_onboarding_profiles
      add constraint brand_profiles_readiness_status_check
      check (
        readiness_status in (
          'not_assessed',
          'research_prepared',
          'confirmation_requested',
          'match_ready',
          'full_profile_complete'
        )
      );
  end if;
end
$migration$;

-- Existing submitted V03 profiles have already completed the full journey.
update public.brand_onboarding_profiles
set readiness_status = 'full_profile_complete'
where status = 'submitted'
  and readiness_status = 'not_assessed';

-- Composite keys below let dependent tables enforce that records belong to
-- the same organisation, rather than relying on application code alone.
create unique index if not exists brand_products_id_org_idx
  on public.brand_onboarding_products(id, organisation_id);

-- --------------------------------------------------------------------------
-- Research imports and field-level claims
-- --------------------------------------------------------------------------

create table if not exists public.brand_research_imports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  schema_version text not null check (length(btrim(schema_version)) > 0),
  generated_at timestamptz,
  generator_name text,
  generator_version text,
  generator_model text,
  profile_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile_context) = 'object'),
  raw_payload jsonb not null
    check (jsonb_typeof(raw_payload) = 'object'),
  validation_report jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation_report) = 'object'),
  status text not null default 'imported'
    check (status in (
      'imported',
      'validation_failed',
      'ready_for_review',
      'reviewed',
      'superseded',
      'archived'
    )),
  created_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  reviewed_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id)
);

create table if not exists public.brand_research_claims (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  claim_key text not null check (length(btrim(claim_key)) > 0),
  entity_type text not null check (entity_type in ('brand', 'product')),
  entity_key text not null check (length(btrim(entity_key)) > 0),
  product_id uuid references public.brand_onboarding_products(id) on delete set null,
  field_key text not null check (length(btrim(field_key)) > 0),
  proposed_value jsonb,
  research_provenance text not null check (research_provenance in (
    'research_verified',
    'research_assumption',
    'brand_supplied',
    'data_gap'
  )),
  confidence text not null default 'unknown'
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  presentation_action text not null check (presentation_action in (
    'show_confirm',
    'ask',
    'internal_only',
    'defer'
  )),
  review_required boolean not null default false,
  source_ids text[] not null default '{}',
  source_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_references) = 'array'),
  rationale text,
  admin_decision text not null default 'pending'
    check (admin_decision in ('pending', 'accepted', 'edited', 'rejected')),
  reviewed_value jsonb,
  reviewed_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, claim_key),
  foreign key (import_id, organisation_id)
    references public.brand_research_imports(id, organisation_id) on delete cascade,
  check (
    (research_provenance = 'data_gap' and proposed_value is null)
    or (research_provenance <> 'data_gap' and proposed_value is not null)
  ),
  check (
    research_provenance not in ('research_assumption', 'data_gap')
    or review_required = true
  ),
  check (
    admin_decision not in ('accepted', 'edited')
    or reviewed_value is not null
  )
);

-- The imported research is an audit record. Workflow metadata may change,
-- but the source payload and its identifying metadata may not be overwritten.
create or replace function public.protect_brand_research_import_payload()
returns trigger language plpgsql as $$
begin
  if new.organisation_id is distinct from old.organisation_id
    or new.schema_version is distinct from old.schema_version
    or new.generated_at is distinct from old.generated_at
    or new.generator_name is distinct from old.generator_name
    or new.generator_version is distinct from old.generator_version
    or new.generator_model is distinct from old.generator_model
    or new.profile_context is distinct from old.profile_context
    or new.raw_payload is distinct from old.raw_payload
    or new.created_by_admin_user_id is distinct from old.created_by_admin_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Brand research import source fields are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_brand_research_import_payload
  on public.brand_research_imports;
create trigger protect_brand_research_import_payload
before update on public.brand_research_imports
for each row execute function public.protect_brand_research_import_payload();

-- --------------------------------------------------------------------------
-- Customer-specific Lite invitations
-- --------------------------------------------------------------------------

create table if not exists public.brand_profile_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  research_import_id uuid not null,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  recipient_name text,
  recipient_email text not null check (length(btrim(recipient_email)) > 3),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'opened', 'submitted', 'expired', 'revoked')),
  opportunity_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(opportunity_context) = 'object'),
  expires_at timestamptz not null,
  created_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  opened_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (research_import_id, organisation_id)
    references public.brand_research_imports(id, organisation_id) on delete restrict,
  check (expires_at > created_at)
);

create table if not exists public.brand_profile_invitation_products (
  invitation_id uuid not null,
  organisation_id uuid not null,
  product_id uuid not null,
  product_order integer not null default 0 check (product_order >= 0),
  created_at timestamptz not null default now(),
  primary key (invitation_id, product_id),
  foreign key (invitation_id, organisation_id)
    references public.brand_profile_invitations(id, organisation_id) on delete cascade,
  foreign key (product_id, organisation_id)
    references public.brand_onboarding_products(id, organisation_id) on delete cascade
);

create table if not exists public.brand_profile_field_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  organisation_id uuid not null,
  research_claim_id uuid references public.brand_research_claims(id) on delete set null,
  entity_type text not null check (entity_type in ('brand', 'product', 'audience')),
  product_id uuid references public.brand_onboarding_products(id) on delete set null,
  field_key text not null check (length(btrim(field_key)) > 0),
  response_status text not null default 'untouched'
    check (response_status in (
      'untouched',
      'confirmed',
      'corrected',
      'not_applicable',
      'answered'
    )),
  original_value jsonb,
  submitted_value jsonb,
  applied_to_canonical boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invitation_id, organisation_id)
    references public.brand_profile_invitations(id, organisation_id) on delete cascade,
  check (
    response_status not in ('confirmed', 'corrected', 'answered')
    or submitted_value is not null
  ),
  check (
    response_status <> 'not_applicable'
    or submitted_value is null
  ),
  check (
    applied_to_canonical = false
    or applied_at is not null
  )
);

-- NULL product IDs represent organisation/audience-level fields. An
-- expression index makes those rows unique as well as product-level rows.
create unique index if not exists brand_profile_field_responses_field_idx
  on public.brand_profile_field_responses(
    invitation_id,
    entity_type,
    field_key,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- --------------------------------------------------------------------------
-- Workflow indexes and timestamp triggers
-- --------------------------------------------------------------------------

create index if not exists brand_research_imports_org_idx
  on public.brand_research_imports(organisation_id, created_at desc);
create index if not exists brand_research_imports_review_queue_idx
  on public.brand_research_imports(status, created_at)
  where status in ('imported', 'validation_failed', 'ready_for_review');

create index if not exists brand_research_claims_import_idx
  on public.brand_research_claims(import_id, entity_type, entity_key);
create index if not exists brand_research_claims_field_idx
  on public.brand_research_claims(organisation_id, field_key);
create index if not exists brand_research_claims_review_queue_idx
  on public.brand_research_claims(import_id, admin_decision)
  where review_required = true or admin_decision = 'pending';

create index if not exists brand_profile_invitations_org_idx
  on public.brand_profile_invitations(organisation_id, created_at desc);
create index if not exists brand_profile_invitations_active_idx
  on public.brand_profile_invitations(expires_at)
  where status in ('active', 'opened');
create index if not exists brand_profile_invitation_products_product_idx
  on public.brand_profile_invitation_products(product_id);

create index if not exists brand_profile_field_responses_invitation_idx
  on public.brand_profile_field_responses(invitation_id, response_status);
create index if not exists brand_profile_field_responses_claim_idx
  on public.brand_profile_field_responses(research_claim_id)
  where research_claim_id is not null;
create index if not exists brand_profile_field_responses_apply_idx
  on public.brand_profile_field_responses(invitation_id)
  where response_status <> 'untouched' and applied_to_canonical = false;

create or replace function public.set_brand_onboarding_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_brand_research_imports_updated_at
  on public.brand_research_imports;
create trigger set_brand_research_imports_updated_at
before update on public.brand_research_imports
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_research_claims_updated_at
  on public.brand_research_claims;
create trigger set_brand_research_claims_updated_at
before update on public.brand_research_claims
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_profile_invitations_updated_at
  on public.brand_profile_invitations;
create trigger set_brand_profile_invitations_updated_at
before update on public.brand_profile_invitations
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_profile_field_responses_updated_at
  on public.brand_profile_field_responses;
create trigger set_brand_profile_field_responses_updated_at
before update on public.brand_profile_field_responses
for each row execute function public.set_brand_onboarding_updated_at();

comment on table public.brand_research_imports is
  'Immutable source envelopes for versioned, AI-assisted brand research imports.';
comment on table public.brand_research_claims is
  'Field-level research proposals, evidence and admin review decisions.';
comment on table public.brand_profile_invitations is
  'Customer-specific Lite profile confirmation links created by IRL admins.';
comment on table public.brand_profile_invitation_products is
  'Products selected for confirmation in a specific Lite invitation.';
comment on table public.brand_profile_field_responses is
  'Customer confirmations, corrections and direct answers captured per field.';

commit;
