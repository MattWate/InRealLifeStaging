begin;

create extension if not exists pgcrypto;

create table if not exists public.rate_engine_benchmarks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  rate_per_experience numeric(12,2) not null check (rate_per_experience >= 0),
  tier text not null check (tier in ('low','medium','high')),
  confidence_level text not null default 'medium' check (confidence_level in ('low','medium','high')),
  evidence_note text,
  source_note text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_engine_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text not null,
  brand_organisation_id uuid references public.organisations(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  benchmark_id uuid references public.rate_engine_benchmarks(id) on delete set null,
  exposure_score smallint check (exposure_score between 1 and 5),
  interaction_score smallint check (interaction_score between 1 and 5),
  environment_score smallint check (environment_score between 1 and 5),
  context_score smallint check (context_score between 1 and 5),
  irl_index integer check (irl_index >= 0),
  index_tier text check (index_tier in ('below_threshold','low','medium','high')),
  recommended_rate numeric(12,2) check (recommended_rate >= 0),
  rooms_in_scope integer check (rooms_in_scope > 0),
  campaign_days integer check (campaign_days > 0),
  average_occupancy_percentage numeric(5,2) check (average_occupancy_percentage > 0 and average_occupancy_percentage <= 100),
  average_guests_per_room numeric(6,2) check (average_guests_per_room > 0),
  estimated_room_nights integer check (estimated_room_nights >= 0),
  estimated_experiences integer check (estimated_experiences >= 0),
  estimated_campaign_fee numeric(14,2) check (estimated_campaign_fee >= 0),
  rationale text,
  assumptions text,
  status text not null default 'draft' check (status in ('draft','ready_for_review','approved','archived')),
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  approved_by uuid references public.user_profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rate_engine_scenarios_status_idx on public.rate_engine_scenarios(status, updated_at desc);
create index if not exists rate_engine_scenarios_brand_idx on public.rate_engine_scenarios(brand_name);
create index if not exists rate_engine_scenarios_property_idx on public.rate_engine_scenarios(property_id) where property_id is not null;

create or replace function public.set_rate_engine_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rate_engine_benchmarks_updated_at on public.rate_engine_benchmarks;
create trigger set_rate_engine_benchmarks_updated_at before update on public.rate_engine_benchmarks
for each row execute function public.set_rate_engine_updated_at();

drop trigger if exists set_rate_engine_scenarios_updated_at on public.rate_engine_scenarios;
create trigger set_rate_engine_scenarios_updated_at before update on public.rate_engine_scenarios
for each row execute function public.set_rate_engine_updated_at();

insert into public.rate_engine_benchmarks
  (code, name, rate_per_experience, tier, confidence_level, evidence_note, source_note, sort_order)
values
  ('sloom', 'Sloom', 381, 'high', 'low', 'OOH/DOOH dwell-time premium benchmark.', 'Single-sourced; use with caution until additional evidence is added.', 30),
  ('tingtang', 'Ting Tang', 72, 'medium', 'high', 'Sampling benchmark triangulated across three independent datasets.', 'Current strongest benchmark anchor.', 20),
  ('wiser', 'Wiser Health', 52, 'low', 'medium', 'PortMA sampling benchmark with a confirmed R51–R52 range.', 'Best suited to lower-interaction or lower-context placements.', 10)
on conflict (code) do update set
  name=excluded.name,
  rate_per_experience=excluded.rate_per_experience,
  tier=excluded.tier,
  confidence_level=excluded.confidence_level,
  evidence_note=excluded.evidence_note,
  source_note=excluded.source_note,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

commit;

select code, name, rate_per_experience, tier, confidence_level
from public.rate_engine_benchmarks
order by sort_order desc;
