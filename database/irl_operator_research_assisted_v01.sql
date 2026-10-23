begin;

-- Research is additive: do not overwrite operator-confirmed property records.
create table if not exists public.operator_research_imports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  property_name text not null,
  property_website text,
  property_city text,
  property_country_code char(2),
  schema_version text not null check (schema_version = 'irl-operator-research-v1'),
  generated_at timestamptz not null,
  generator jsonb not null,
  raw_payload jsonb not null,
  status text not null default 'imported'
    check (status in ('imported','reviewed','archived')),
  created_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (id, property_id)
);
create index if not exists operator_research_imports_property_idx
  on public.operator_research_imports(property_id, created_at desc);

create table if not exists public.operator_research_claims (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.operator_research_imports(id) on delete cascade,
  claim_key text not null,
  entity_type text not null,
  entity_key text not null,
  field_key text not null,
  proposed_value jsonb,
  research_provenance text not null,
  confidence text not null,
  presentation_action text not null,
  review_required boolean not null,
  source_ids text[] not null default '{}',
  rationale text not null,
  admin_decision text not null default 'pending'
    check (admin_decision in ('pending','accepted','edited','rejected')),
  reviewed_value jsonb,
  reviewed_by_admin_user_id uuid references public.irl_admin_users(id) on delete set null,
  reviewed_at timestamptz,
  unique(import_id, claim_key)
);
create index if not exists operator_research_claims_import_idx
  on public.operator_research_claims(import_id, entity_type, entity_key);

create table if not exists public.operator_research_sources (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.operator_research_imports(id) on delete cascade,
  source_key text not null,
  source_type text not null,
  title text not null,
  url text not null,
  accessed_at timestamptz not null,
  unique(import_id, source_key)
);

commit;
