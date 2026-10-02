-- FuelCap Control Room: staff roles and the security audit log.
-- Runs in the Supabase project the control room signs in with: for now the customer project (DEC-064), later a
-- separate staff project (see apps/admin/docs/ADMIN_AUTH.md). It only adds admin_* objects and changes nothing else.
--
-- Rules:
--   * Every rule for signed-in users also requires an MFA-verified session (JWT aal = 'aal2'). These are
--     RESTRICTIVE policies, so no other policy can open a table to a password-only (aal1) session.
--   * Staff read their own record; platform administrators (PA) and auditors (AU) read everyone's.
--   * Browsers can't write either table. Invites, role changes and audit records go through the admin server
--     using the service role.
--   * The audit log is append-only for everyone, including the service role.

create table if not exists public.admin_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 80),
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['PA','OP','RT','FR','CF','CS','DI','AU','DP']),
  organisation_ids text[] not null default '{}',
  active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Auditors and demo presenters hold a single role (mirrors @fuelcap/authz assignmentConflict).
  constraint admin_staff_exclusive_roles check (
    (not ('AU' = any (roles)) or roles = array['AU']) and (not ('DP' = any (roles)) or roles = array['DP'])
  )
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event text not null,
  outcome text not null check (outcome in ('success', 'failure', 'denied', 'info')),
  user_id uuid,
  email text,
  ip text,
  user_agent text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_log_occurred_at on public.admin_audit_log (occurred_at desc);
create index if not exists admin_audit_log_user on public.admin_audit_log (user_id, occurred_at desc);

alter table public.admin_staff enable row level security;
alter table public.admin_staff force row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

-- True only when the request's JWT shows the session passed MFA.
create or replace function public.admin_session_is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

-- Role check for policies. SECURITY DEFINER so it can read admin_staff without re-entering its policies.
create or replace function public.admin_has_role(wanted text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_staff s
    where s.user_id = (select auth.uid()) and s.active and s.roles && wanted
  )
$$;
revoke all on function public.admin_has_role(text[]) from public;
grant execute on function public.admin_has_role(text[]) to authenticated;
grant execute on function public.admin_session_is_aal2() to authenticated;

-- Browsers (anon) get nothing; signed-in users may only SELECT, and RLS narrows that further.
revoke all on public.admin_staff, public.admin_audit_log from anon, authenticated;
grant select on public.admin_staff, public.admin_audit_log to authenticated;

drop policy if exists admin_staff_requires_aal2 on public.admin_staff;
create policy admin_staff_requires_aal2 on public.admin_staff
  as restrictive for all to authenticated
  using (public.admin_session_is_aal2())
  with check (public.admin_session_is_aal2());

drop policy if exists admin_staff_read_own on public.admin_staff;
create policy admin_staff_read_own on public.admin_staff
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists admin_staff_read_all_for_admins on public.admin_staff;
create policy admin_staff_read_all_for_admins on public.admin_staff
  for select to authenticated
  using (public.admin_has_role(array['PA', 'AU']));

drop policy if exists admin_audit_requires_aal2 on public.admin_audit_log;
create policy admin_audit_requires_aal2 on public.admin_audit_log
  as restrictive for all to authenticated
  using (public.admin_session_is_aal2())
  with check (public.admin_session_is_aal2());

drop policy if exists admin_audit_read_for_admins on public.admin_audit_log;
create policy admin_audit_read_for_admins on public.admin_audit_log
  for select to authenticated
  using (public.admin_has_role(array['PA', 'AU']));

-- Append-only: nobody (not even the service role) can edit or delete audit records.
create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_audit_log is append-only';
end
$$;
drop trigger if exists admin_audit_log_no_update on public.admin_audit_log;
create trigger admin_audit_log_no_update before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();
drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_append_only();

create or replace function public.admin_staff_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
drop trigger if exists admin_staff_updated_at on public.admin_staff;
create trigger admin_staff_updated_at before update on public.admin_staff
  for each row execute function public.admin_staff_touch_updated_at();
