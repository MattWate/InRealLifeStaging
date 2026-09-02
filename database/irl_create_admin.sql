-- Run database/irl_admin_v01.sql first. Then edit the three values below and
-- run this script in Neon SQL Editor. Repeat for each administrator.
-- Passwords are stored as salted bcrypt hashes, never as plaintext.
-- Re-running for an existing email resets its password and revokes its sessions.
begin;
create extension if not exists pgcrypto;

do $$
declare
  admin_email text := 'REPLACE_EMAIL';
  admin_name text := 'REPLACE_NAME';
  admin_password text := 'REPLACE_PASSWORD';
  admin_id uuid;
begin
  admin_email := lower(trim(admin_email));
  admin_name := trim(admin_name);
  if admin_email = 'replace_email' or admin_name = 'REPLACE_NAME'
    or admin_password = 'REPLACE_PASSWORD' then
    raise exception 'Replace the email, name and password before running this script.';
  end if;
  if admin_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(admin_email) > 254 or admin_name = '' then
    raise exception 'Enter a valid email and a name.';
  end if;
  if length(admin_password) < 12 or octet_length(admin_password) > 72 then
    raise exception 'Use a password of at least 12 characters and at most 72 UTF-8 bytes.';
  end if;

  insert into public.irl_admin_users (email, name, password_hash, role, active)
  values (admin_email, admin_name, crypt(admin_password, gen_salt('bf', 12)), 'admin', true)
  on conflict (email) do update set
    name = excluded.name,
    password_hash = excluded.password_hash,
    role = 'admin',
    active = true
  returning id into admin_id;

  delete from public.irl_admin_sessions where user_id = admin_id;
  delete from public.irl_login_limits
    where key_hash = encode(digest('email:' || admin_email, 'sha256'), 'hex');
end;
$$;
commit;
