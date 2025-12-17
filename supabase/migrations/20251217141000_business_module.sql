-- =========================
-- Бизнес-модуль: услуги / расписание / финансы
-- =========================

create extension if not exists "btree_gist";

-- =========================
-- ENUM TYPES
-- =========================
do $$ begin
  create type public.appointment_status as enum ('pending', 'confirmed', 'canceled', 'completed', 'no_show');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_type as enum ('charge', 'payment');
exception
  when duplicate_object then null;
end $$;

-- =========================
-- SERVICES
-- =========================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_min integer not null default 30 check (duration_min > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  color text not null default '#2f6f5e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name)
);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

-- =========================
-- SPECIALIST WORKING HOURS
-- =========================
create table if not exists public.specialist_working_hours (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(specialist_id, weekday),
  check (end_time > start_time)
);

drop trigger if exists specialist_working_hours_set_updated_at on public.specialist_working_hours;
create trigger specialist_working_hours_set_updated_at
before update on public.specialist_working_hours
for each row
execute function public.set_updated_at();

-- =========================
-- APPOINTMENTS
-- =========================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  specialist_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text,
  is_recurring boolean not null default false,
  recurrence_group_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists appointments_start_time_idx on public.appointments(start_time);
create index if not exists appointments_child_time_idx on public.appointments(child_id, start_time);
create index if not exists appointments_specialist_time_idx on public.appointments(specialist_id, start_time);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

-- Запрещаем пересечения по специалисту и ребёнку (кроме отменённых).
alter table public.appointments
  drop constraint if exists appointments_no_overlap_specialist;
alter table public.appointments
  add constraint appointments_no_overlap_specialist
  exclude using gist (
    specialist_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status <> 'canceled');

alter table public.appointments
  drop constraint if exists appointments_no_overlap_child;
alter table public.appointments
  add constraint appointments_no_overlap_child
  exclude using gist (
    child_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status <> 'canceled');

-- =========================
-- TRANSACTIONS (финансы)
-- =========================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  type public.transaction_type not null,
  date timestamptz not null default now(),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(appointment_id, type)
);

create index if not exists transactions_child_date_idx on public.transactions(child_id, date desc);
create index if not exists transactions_type_date_idx on public.transactions(type, date desc);

-- Автоначисление при завершении занятия
create or replace function public.handle_appointment_completed_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  child_name text;
  descr text;
begin
  if new.status = 'completed'::public.appointment_status
     and (old.status is distinct from new.status) then

    select s.name, s.price, s.duration_min into svc
    from public.services s
    where s.id = new.service_id;

    select c.name into child_name
    from public.children c
    where c.id = new.child_id;

    descr :=
      'Начисление: '
      || coalesce(svc.name, 'Услуга')
      || ' — '
      || coalesce(child_name, 'ребёнок')
      || ' ('
      || to_char(new.start_time, 'DD.MM.YYYY HH24:MI')
      || ')';

    insert into public.transactions (
      child_id,
      appointment_id,
      amount,
      type,
      date,
      description,
      created_by
    )
    values (
      new.child_id,
      new.id,
      coalesce(svc.price, 0),
      'charge'::public.transaction_type,
      new.end_time,
      descr,
      auth.uid()
    )
    on conflict (appointment_id, type) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_charge_on_complete on public.appointments;
create trigger appointments_charge_on_complete
after update of status on public.appointments
for each row
execute function public.handle_appointment_completed_charge();

-- =========================
-- RLS
-- =========================
alter table public.services enable row level security;
alter table public.specialist_working_hours enable row level security;
alter table public.appointments enable row level security;
alter table public.transactions enable row level security;

-- SERVICES: читать можно всем, управлять — admin/manager
drop policy if exists "services_select_authenticated" on public.services;
create policy "services_select_authenticated"
on public.services
for select
to authenticated
using (true);

drop policy if exists "services_write_admin_or_manager" on public.services;
create policy "services_write_admin_or_manager"
on public.services
for all
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

-- WORKING HOURS: admin/manager + просмотр собственного расписания специалистом
drop policy if exists "specialist_hours_select" on public.specialist_working_hours;
create policy "specialist_hours_select"
on public.specialist_working_hours
for select
to authenticated
using (public.is_admin_or_manager() or specialist_id = auth.uid());

drop policy if exists "specialist_hours_write_admin_or_manager" on public.specialist_working_hours;
create policy "specialist_hours_write_admin_or_manager"
on public.specialist_working_hours
for all
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

-- APPOINTMENTS: читать можно admin/manager, специалисту и тем, у кого есть доступ к ребёнку
drop policy if exists "appointments_select_by_access" on public.appointments;
create policy "appointments_select_by_access"
on public.appointments
for select
to authenticated
using (
  public.is_admin_or_manager()
  or specialist_id = auth.uid()
  or public.can_read_child(child_id)
);

drop policy if exists "appointments_insert_admin_or_manager" on public.appointments;
create policy "appointments_insert_admin_or_manager"
on public.appointments
for insert
to authenticated
with check (public.is_admin_or_manager());

drop policy if exists "appointments_update_admin_or_manager_or_specialist" on public.appointments;
create policy "appointments_update_admin_or_manager_or_specialist"
on public.appointments
for update
to authenticated
using (public.is_admin_or_manager() or specialist_id = auth.uid())
with check (public.is_admin_or_manager() or specialist_id = auth.uid());

drop policy if exists "appointments_delete_admin_or_manager" on public.appointments;
create policy "appointments_delete_admin_or_manager"
on public.appointments
for delete
to authenticated
using (public.is_admin_or_manager());

-- TRANSACTIONS: читать могут admin/manager и те, у кого есть доступ к ребёнку
drop policy if exists "transactions_select_by_child_access" on public.transactions;
create policy "transactions_select_by_child_access"
on public.transactions
for select
to authenticated
using (public.is_admin_or_manager() or public.can_read_child(child_id));

-- Вставка: admin/manager (платежи/ручные операции) + начисления специалистом по своим занятиям
drop policy if exists "transactions_insert_admin_or_manager_or_specialist_charge" on public.transactions;
create policy "transactions_insert_admin_or_manager_or_specialist_charge"
on public.transactions
for insert
to authenticated
with check (
  public.is_admin_or_manager()
  or (
    type = 'charge'::public.transaction_type
    and appointment_id is not null
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and a.specialist_id = auth.uid()
    )
  )
);

drop policy if exists "transactions_update_admin_or_manager" on public.transactions;
create policy "transactions_update_admin_or_manager"
on public.transactions
for update
to authenticated
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

drop policy if exists "transactions_delete_admin_or_manager" on public.transactions;
create policy "transactions_delete_admin_or_manager"
on public.transactions
for delete
to authenticated
using (public.is_admin_or_manager());

