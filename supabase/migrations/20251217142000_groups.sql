-- =========================
-- Группы: объединение детей и несколько сотрудников в одну группу
-- =========================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.group_children (
  group_id uuid not null references public.groups(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, child_id)
);

create table if not exists public.group_staff (
  group_id uuid not null references public.groups(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, therapist_id)
);

alter table public.groups enable row level security;
alter table public.group_children enable row level security;
alter table public.group_staff enable row level security;

-- Политики: управлять могут admin/manager, читать могут admin/manager (при желании расширим).
create policy "groups_select_admin_manager"
on public.groups
for select
to authenticated
using (public.is_admin_or_manager());

create policy "groups_modify_admin_manager"
on public.groups
for all
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy "group_children_select_admin_manager"
on public.group_children
for select
to authenticated
using (public.is_admin_or_manager());

create policy "group_children_modify_admin_manager"
on public.group_children
for all
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy "group_staff_select_admin_manager"
on public.group_staff
for select
to authenticated
using (public.is_admin_or_manager());

create policy "group_staff_modify_admin_manager"
on public.group_staff
for all
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());
