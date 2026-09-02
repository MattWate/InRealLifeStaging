begin;

create table if not exists public.irl_admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  role text not null default 'admin' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.irl_admin_sessions (
  token_hash text primary key,
  user_id uuid not null references public.irl_admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists irl_admin_sessions_user_idx on public.irl_admin_sessions(user_id);

create table if not exists public.irl_login_limits (
  key_hash text primary key,
  attempts integer not null,
  reset_at timestamptz not null
);

-- Freeze the final questionnaire independently of subsequent draft writes.
-- Existing submissions are read from onboarding_answers when no snapshot exists.
create table if not exists public.irl_submission_snapshots (
  session_id uuid primary key references public.onboarding_sessions(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now()
);
create index if not exists irl_submitted_sessions_idx
  on public.onboarding_sessions(submitted_at desc, id) where status = 'submitted';

commit;
