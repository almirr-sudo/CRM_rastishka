-- =========================
-- Расширение SELECT для профилей (для чата/просмотра имён)
-- =========================

-- Разрешаем читать профили (id/full_name/role/email) пользователям,
-- которые связаны через доступные им дети (родитель ↔ терапевты группы).

drop policy if exists "profiles_select_related_by_child_access" on public.profiles;
create policy "profiles_select_related_by_child_access"
on public.profiles
for select
to authenticated
using (
  public.is_admin()
  or id = auth.uid()
  or exists (
    select 1
    from public.children c
    where public.can_read_child(c.id)
      and (
        c.parent_id = id
        or exists (
          select 1
          from public.therapist_children tc
          where tc.child_id = c.id
            and tc.therapist_id = id
        )
      )
  )
);

