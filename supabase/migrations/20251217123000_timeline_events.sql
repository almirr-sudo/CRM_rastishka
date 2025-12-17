-- Timeline событий дня (для ленты родителя)

do $$ begin
  create type public.timeline_event_type as enum (
    'food',
    'mood',
    'nap_start',
    'nap_end',
    'note',
    'custom'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  timestamp timestamptz not null default now(),
  type public.timeline_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists timeline_events_child_ts_idx
  on public.timeline_events(child_id, timestamp);

alter table public.timeline_events enable row level security;

drop policy if exists "timeline_events_select_by_child_access" on public.timeline_events;
create policy "timeline_events_select_by_child_access"
on public.timeline_events
for select
to authenticated
using (public.can_read_child(child_id));

drop policy if exists "timeline_events_insert_by_therapist_or_admin" on public.timeline_events;
create policy "timeline_events_insert_by_therapist_or_admin"
on public.timeline_events
for insert
to authenticated
with check (public.can_write_child(child_id));

drop policy if exists "timeline_events_admin_delete" on public.timeline_events;
create policy "timeline_events_admin_delete"
on public.timeline_events
for delete
to authenticated
using (public.is_admin());

