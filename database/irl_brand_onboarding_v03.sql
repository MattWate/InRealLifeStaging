begin;

-- Approved Brand Onboarding Questionnaire V03.
-- Additive only: V01 columns and submissions remain available for audit/history.

alter table public.brand_onboarding_profiles
  add column if not exists differentiator_code text,
  add column if not exists values_code text,
  add column if not exists competitor_lockouts text,
  add column if not exists brand_self_perception text;

alter table public.brand_contacts
  add column if not exists partnership_role_code text;

alter table public.brand_onboarding_products
  add column if not exists has_webpage boolean,
  add column if not exists international_shipping_code text,
  add column if not exists international_shipping_regions text,
  add column if not exists legal_safety_compliance text,
  add column if not exists legal_review_required boolean not null default false,
  add column if not exists brand_suggested_placement_codes text[] not null default '{}',
  add column if not exists engine_recommended_placement_codes text[] not null default '{}',
  add column if not exists irl_selected_placement_codes text[] not null default '{}',
  add column if not exists observed_placement_performance jsonb not null default '{}'::jsonb,
  add column if not exists initial_supply_limit text;

alter table public.brand_audience_profiles
  add column if not exists evidence_source_code text,
  add column if not exists confidence_flag text,
  add column if not exists review_required boolean not null default false,
  add column if not exists spending_power_codes text[] not null default '{}',
  add column if not exists travel_purpose_code text,
  add column if not exists discovery_channel_codes text[] not null default '{}',
  add column if not exists decision_factor_rank_codes text[] not null default '{}',
  add column if not exists customer_outcome_code text,
  add column if not exists customer_outcome_detail text,
  add column if not exists evidence_layer text not null default 'brand_stated'
    check (evidence_layer in ('brand_stated','research_derived','observed'));

create table if not exists public.brand_value_add_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  marketing_channel_codes text[] not null default '{}',
  marketing_channel_rank_codes text[] not null default '{}',
  measured_acquisition_channel_code text,
  paid_marketing_code text,
  experiential_history_codes text[] not null default '{}',
  experiential_effectiveness_code text,
  experiential_evidence_code text,
  primary_opportunity_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_success_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  primary_success_result text,
  reporting_signal_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_brand_value_add_profiles_updated_at on public.brand_value_add_profiles;
create trigger set_brand_value_add_profiles_updated_at
before update on public.brand_value_add_profiles
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_success_profiles_updated_at on public.brand_success_profiles;
create trigger set_brand_success_profiles_updated_at
before update on public.brand_success_profiles
for each row execute function public.set_brand_onboarding_updated_at();

create index if not exists brand_audience_review_idx
  on public.brand_audience_profiles(review_required)
  where review_required = true;

create index if not exists brand_products_legal_review_idx
  on public.brand_onboarding_products(legal_review_required)
  where legal_review_required = true;

commit;
