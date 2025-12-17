-- =========================
-- HOME NOTES (чат родитель ↔ специалисты)
-- =========================

create table if not exists public.home_notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_notes_child_created_at_idx
  on public.home_notes(child_id, created_at desc);

drop trigger if exists home_notes_set_updated_at on public.home_notes;
create trigger home_notes_set_updated_at
before update on public.home_notes
for each row
execute function public.set_updated_at();

alter table public.home_notes enable row level security;

drop policy if exists "home_notes_select_by_child_access" on public.home_notes;
create policy "home_notes_select_by_child_access"
on public.home_notes
for select
using (public.can_read_child(child_id));

drop policy if exists "home_notes_insert_by_child_access" on public.home_notes;
create policy "home_notes_insert_by_child_access"
on public.home_notes
for insert
with check (
  public.can_read_child(child_id)
  and author_id = auth.uid()
);

drop policy if exists "home_notes_update_by_author_or_admin" on public.home_notes;
create policy "home_notes_update_by_author_or_admin"
on public.home_notes
for update
using (
  public.is_admin()
  or author_id = auth.uid()
)
with check (
  public.is_admin()
  or author_id = auth.uid()
);

drop policy if exists "home_notes_admin_delete" on public.home_notes;
create policy "home_notes_admin_delete"
on public.home_notes
for delete
using (public.is_admin());

