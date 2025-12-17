-- =========================
-- Новая роль: manager (доступ к бизнес-модулю)
-- =========================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'user_role'
      and e.enumlabel = 'manager'
  ) then
    alter type public.user_role add value 'manager';
  end if;
end $$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'::public.user_role
  );
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_manager();
$$;

-- Расширяем доступ менеджера на детей (для расписания/финансов).
create or replace function public.can_read_child(child_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_manager()
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
    public.is_admin_or_manager()
    or exists (
      select 1
      from public.therapist_children tc
      where tc.child_id = child_uuid
        and tc.therapist_id = auth.uid()
    );
$$;

-- Профили нужны для выбора специалистов в календаре. Разрешаем select для admin/manager.
drop policy if exists "profiles_select_admin_or_manager" on public.profiles;
create policy "profiles_select_admin_or_manager"
on public.profiles
for select
to authenticated
using (public.is_admin_or_manager());

