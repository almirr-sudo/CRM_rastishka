-- =========================
-- Шаг 1: добавляем новое значение enum user_role = 'manager'
-- Отдельный файл обязателен, чтобы избежать ошибки
-- "unsafe use of new value ... must be committed before use".
-- =========================

do $$
begin
  if exists (
    select 1
    from pg_type t
    where t.typname = 'user_role'
  ) and not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'user_role'
      and e.enumlabel = 'manager'
  ) then
    alter type public.user_role add value 'manager';
  end if;
end $$;
