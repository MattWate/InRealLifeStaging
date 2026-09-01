begin;

create extension if not exists pgcrypto;

-- Approved Brand Onboarding Questionnaire V01 persistence layer.
-- This migration is deliberately additive: it relies on the existing
-- organisations/onboarding_sessions/onboarding_answers tables but does not
-- assume the shape of any legacy brand/product tables supplied by partners.

alter table public.onboarding_sessions
  add column if not exists schema_version text;

create table if not exists public.brand_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  website text,
  parent_company_name text,
  active_market_codes text[] not null default '{}',
  primary_category_code text,
  secondary_category_codes text[] not null default '{}',
  description text,
  quality_codes text[] not null default '{}',
  sales_channel_codes text[] not null default '{}',
  marketing_channel_codes text[] not null default '{}',
  primary_opportunity_code text,
  primary_success_result text,
  mandatory_requirements text,
  messaging_requirements text,
  association_exclusions text,
  final_notes text,
  confirmed_accurate boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','reopened','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  first_name text,
  last_name text,
  work_email text,
  mobile_number text,
  job_title text,
  onboarding_role_code text,
  is_primary boolean not null default false,
  receive_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brand_contacts_primary_idx
  on public.brand_contacts(organisation_id)
  where is_primary;
create index if not exists brand_contacts_org_idx on public.brand_contacts(organisation_id);

create table if not exists public.brand_onboarding_products (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  is_primary boolean not null default false,
  scope_code text,
  name text,
  webpage text,
  category_code text,
  subcategory_code text,
  currency_code text,
  retail_price_min numeric(14,2),
  retail_price_max numeric(14,2),
  variants text,
  same_brand_availability boolean,
  market_codes text[] not null default '{}',
  sales_channel_codes text[] not null default '{}',
  usage_model_code text,
  handling_requirement_codes text[] not null default '{}',
  supply_capability_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retail_price_min is null or retail_price_min >= 0),
  check (retail_price_max is null or retail_price_max >= 0)
);

create unique index if not exists brand_onboarding_products_primary_idx
  on public.brand_onboarding_products(organisation_id)
  where is_primary;
create index if not exists brand_onboarding_products_org_idx on public.brand_onboarding_products(organisation_id);

create table if not exists public.brand_audience_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  product_id uuid references public.brand_onboarding_products(id) on delete cascade,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  is_primary boolean not null default false,
  description text,
  geography_code text,
  age_group_codes text[] not null default '{}',
  life_stage_codes text[] not null default '{}',
  decision_factor_codes text[] not null default '{}',
  discovery_openness_code text,
  exclusions text,
  evidence_source_codes text[] not null default '{}',
  notes text,
  customer_need text,
  need_context_codes text[] not null default '{}',
  current_alternative_code text,
  alternative_explanation text,
  primary_barrier_code text,
  barrier_reducer_codes text[] not null default '{}',
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brand_audience_primary_idx
  on public.brand_audience_profiles(organisation_id)
  where is_primary;
create index if not exists brand_audience_org_idx on public.brand_audience_profiles(organisation_id);
create index if not exists brand_audience_product_idx on public.brand_audience_profiles(product_id) where product_id is not null;

create table if not exists public.onboarding_audit_log (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid not null references public.onboarding_sessions(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  event_type text not null,
  schema_version text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_audit_session_idx
  on public.onboarding_audit_log(onboarding_session_id, created_at desc);

create or replace function public.set_brand_onboarding_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_brand_onboarding_profiles_updated_at on public.brand_onboarding_profiles;
create trigger set_brand_onboarding_profiles_updated_at
before update on public.brand_onboarding_profiles
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_contacts_updated_at on public.brand_contacts;
create trigger set_brand_contacts_updated_at
before update on public.brand_contacts
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_onboarding_products_updated_at on public.brand_onboarding_products;
create trigger set_brand_onboarding_products_updated_at
before update on public.brand_onboarding_products
for each row execute function public.set_brand_onboarding_updated_at();

drop trigger if exists set_brand_audience_profiles_updated_at on public.brand_audience_profiles;
create trigger set_brand_audience_profiles_updated_at
before update on public.brand_audience_profiles
for each row execute function public.set_brand_onboarding_updated_at();

commit;
