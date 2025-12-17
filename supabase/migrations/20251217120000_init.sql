-- MVP: Special Needs Child Development CRM (RAS/ASD)
-- Supabase / PostgreSQL schema + RLS policies

create extension if not exists "pgcrypto";

-- =========================
-- ENUM TYPES
-- =========================
do $$ begin
  create type public.user_role as enum ('admin', 'therapist', 'parent');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.food_intake as enum ('all', 'half', 'none', 'refusal');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_status as enum ('in_progress', 'mastered');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.prompt_level as enum ('independent', 'verbal', 'gestural', 'physical');
exception
  when duplicate_object then null;
end $$;

-- =========================
-- HELPERS
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =========================
-- USERS (profiles)
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.user_role not null default 'parent',
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Автосоздание профиля при регистрации пользователя через Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'parent'::public.user_role
  )
  on conflict (id) do update
  set
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- =========================
-- CHILDREN + ASSIGNMENTS
-- =========================
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date,
  diagnosis text,
  dietary_restrictions text,
  avatar_url text,
  parent_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists children_parent_id_idx on public.children(parent_id);

drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at
before update on public.children
for each row
execute function public.set_updated_at();

-- Связь "ребёнок ↔ терапевт" (группа/кураторство)
create table if not exists public.therapist_children (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(child_id, therapist_id)
);

create index if not exists therapist_children_therapist_id_idx on public.therapist_children(therapist_id);
create index if not exists therapist_children_child_id_idx on public.therapist_children(child_id);

-- =========================
-- DAILY LOGS
-- =========================
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null default current_date,
  mood_score smallint check (mood_score between 1 and 5),
  -- В минутах за день (MVP). Можно заменить на jsonb с сессиями сна позже.
  sleep_duration integer check (sleep_duration >= 0),
  food_intake public.food_intake,
  toilet_data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(child_id, date)
);

create index if not exists daily_logs_child_date_idx on public.daily_logs(child_id, date);

drop trigger if exists daily_logs_set_updated_at on public.daily_logs;
create trigger daily_logs_set_updated_at
before update on public.daily_logs
for each row
execute function public.set_updated_at();

-- =========================
-- BEHAVIOR INCIDENTS (ABC)
-- =========================
create table if not exists public.behavior_incidents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  timestamp timestamptz not null default now(),
  antecedent text,
  behavior text,
  consequence text,
  intensity smallint check (intensity between 1 and 10),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists behavior_incidents_child_ts_idx on public.behavior_incidents(child_id, timestamp);

-- =========================
-- SKILLS & GOALS (IEP)
-- =========================
create table if not exists public.skill_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  goal_title text not null,
  status public.goal_status not null default 'in_progress',
  target_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_goals_child_id_idx on public.skill_goals(child_id);

drop trigger if exists skill_goals_set_updated_at on public.skill_goals;
create trigger skill_goals_set_updated_at
before update on public.skill_goals
for each row
execute function public.set_updated_at();

-- =========================
-- SKILL TRACKING
-- =========================
create table if not exists public.skill_tracking (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.skill_goals(id) on delete cascade,
  date date not null default current_date,
  prompt_level public.prompt_level not null,
  success boolean not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists skill_tracking_goal_date_idx on public.skill_tracking(goal_id, date);

-- =========================
-- RLS HELPERS (roles + access checks)
-- =========================
-- SECURITY DEFINER функции используются в RLS, чтобы избежать рекурсии и
-- безопасно проверять роль/доступ без раскрытия лишних данных.
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'parent'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_role() = 'admin'::public.user_role;
$$;

create or replace function public.can_read_child(child_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.children c
      where c.id = child_uuid
        and c.parent_id = auth.uid()
    )
    or exists (
      select 1
      from public.therapist_children tc
      where tc.child_id = child_uuid
        and tc.therapist_id = auth.uid()
    );
$$;

create or replace function public.can_write_child(child_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.therapist_children tc
      where tc.child_id = child_uuid
        and tc.therapist_id = auth.uid()
    );
$$;

-- =========================
-- RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.therapist_children enable row level security;
alter table public.daily_logs enable row level security;
alter table public.behavior_incidents enable row level security;
alter table public.skill_goals enable row level security;
alter table public.skill_tracking enable row level security;

-- PROFILES
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- CHILDREN
drop policy if exists "children_select_by_access" on public.children;
create policy "children_select_by_access"
on public.children
for select
to authenticated
using (public.can_read_child(id));

drop policy if exists "children_admin_write" on public.children;
create policy "children_admin_write"
on public.children
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- THERAPIST_CHILDREN
drop policy if exists "therapist_children_select_self_or_admin" on public.therapist_children;
create policy "therapist_children_select_self_or_admin"
on public.therapist_children
for select
to authenticated
using (therapist_id = auth.uid() or public.is_admin());

drop policy if exists "therapist_children_admin_write" on public.therapist_children;
create policy "therapist_children_admin_write"
on public.therapist_children
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- DAILY_LOGS
drop policy if exists "daily_logs_select_by_child_access" on public.daily_logs;
create policy "daily_logs_select_by_child_access"
on public.daily_logs
for select
to authenticated
using (public.can_read_child(child_id));

drop policy if exists "daily_logs_insert_by_therapist_or_admin" on public.daily_logs;
create policy "daily_logs_insert_by_therapist_or_admin"
on public.daily_logs
for insert
to authenticated
with check (public.can_write_child(child_id));

drop policy if exists "daily_logs_update_by_therapist_or_admin" on public.daily_logs;
create policy "daily_logs_update_by_therapist_or_admin"
on public.daily_logs
for update
to authenticated
using (public.can_write_child(child_id))
with check (public.can_write_child(child_id));

drop policy if exists "daily_logs_admin_delete" on public.daily_logs;
create policy "daily_logs_admin_delete"
on public.daily_logs
for delete
to authenticated
using (public.is_admin());

-- BEHAVIOR_INCIDENTS
drop policy if exists "behavior_incidents_select_by_child_access" on public.behavior_incidents;
create policy "behavior_incidents_select_by_child_access"
on public.behavior_incidents
for select
to authenticated
using (public.can_read_child(child_id));

drop policy if exists "behavior_incidents_insert_by_therapist_or_admin" on public.behavior_incidents;
create policy "behavior_incidents_insert_by_therapist_or_admin"
on public.behavior_incidents
for insert
to authenticated
with check (public.can_write_child(child_id));

drop policy if exists "behavior_incidents_update_by_therapist_or_admin" on public.behavior_incidents;
create policy "behavior_incidents_update_by_therapist_or_admin"
on public.behavior_incidents
for update
to authenticated
using (public.can_write_child(child_id))
with check (public.can_write_child(child_id));

drop policy if exists "behavior_incidents_admin_delete" on public.behavior_incidents;
create policy "behavior_incidents_admin_delete"
on public.behavior_incidents
for delete
to authenticated
using (public.is_admin());

-- SKILL_GOALS
drop policy if exists "skill_goals_select_by_child_access" on public.skill_goals;
create policy "skill_goals_select_by_child_access"
on public.skill_goals
for select
to authenticated
using (public.can_read_child(child_id));

drop policy if exists "skill_goals_insert_by_therapist_or_admin" on public.skill_goals;
create policy "skill_goals_insert_by_therapist_or_admin"
on public.skill_goals
for insert
to authenticated
with check (public.can_write_child(child_id));

drop policy if exists "skill_goals_update_by_therapist_or_admin" on public.skill_goals;
create policy "skill_goals_update_by_therapist_or_admin"
on public.skill_goals
for update
to authenticated
using (public.can_write_child(child_id))
with check (public.can_write_child(child_id));

drop policy if exists "skill_goals_admin_delete" on public.skill_goals;
create policy "skill_goals_admin_delete"
on public.skill_goals
for delete
to authenticated
using (public.is_admin());

-- SKILL_TRACKING (привязано к skill_goals -> child_id)
drop policy if exists "skill_tracking_select_by_child_access" on public.skill_tracking;
create policy "skill_tracking_select_by_child_access"
on public.skill_tracking
for select
to authenticated
using (
  exists (
    select 1
    from public.skill_goals g
    where g.id = goal_id
      and public.can_read_child(g.child_id)
  )
);

drop policy if exists "skill_tracking_insert_by_therapist_or_admin" on public.skill_tracking;
create policy "skill_tracking_insert_by_therapist_or_admin"
on public.skill_tracking
for insert
to authenticated
with check (
  exists (
    select 1
    from public.skill_goals g
    where g.id = goal_id
      and public.can_write_child(g.child_id)
  )
);

drop policy if exists "skill_tracking_update_by_therapist_or_admin" on public.skill_tracking;
create policy "skill_tracking_update_by_therapist_or_admin"
on public.skill_tracking
for update
to authenticated
using (
  exists (
    select 1
    from public.skill_goals g
    where g.id = goal_id
      and public.can_write_child(g.child_id)
  )
)
with check (
  exists (
    select 1
    from public.skill_goals g
    where g.id = goal_id
      and public.can_write_child(g.child_id)
  )
);

drop policy if exists "skill_tracking_admin_delete" on public.skill_tracking;
create policy "skill_tracking_admin_delete"
on public.skill_tracking
for delete
to authenticated
using (public.is_admin());
