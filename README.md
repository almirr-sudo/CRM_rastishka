# RAS CRM — журнал развития и CRM (MVP)
Веб‑приложение для детского сада/центра, работающего с детьми с РАС (ASD): быстрый ввод событий педагогом/терапевтом и наглядные отчёты для родителей.

## Стек (строго)
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide
- Supabase (PostgreSQL + Auth)
- TanStack Query (React Query)
- React Hook Form + Zod
- Recharts

## Быстрый старт
1. Установить зависимости: `npm install`
2. Настроить переменные окружения:
   - Скопировать `.env.example` → `.env.local`
   - Заполнить значения (см. раздел “Настройка Supabase”)
3. Запустить dev‑сервер: `npm run dev`
4. Открыть `http://localhost:3000`

> На Windows Turbopack иногда показывает “Invalid source map…”. По умолчанию `npm run dev` запускает dev‑сервер в режиме webpack. Если нужен Turbopack: `npm run dev:turbo`.

## Настройка Supabase
### 1) Где взять `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`
1. Создайте проект в Supabase.
2. Откройте **Settings → API**.
3. Скопируйте:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (для админ‑инвайтов) **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (только сервер, не публиковать!)

Заполните эти значения в `.env.local` и перезапустите `npm run dev`.

### 2) Применить миграции БД (SQL)
Миграции лежат в `supabase/migrations/`:
- `supabase/migrations/20251217120000_init.sql`
- `supabase/migrations/20251217123000_timeline_events.sql`
- `supabase/migrations/20251217130000_home_notes.sql`
- `supabase/migrations/20251217130500_profiles_related_select.sql`

**Вариант A (проще):** Supabase Dashboard → **SQL Editor** → выполните миграции по порядку.

**Вариант B (CLI):** установите Supabase CLI и примените миграции через него (удобно для командной разработки).

### 3) Первый администратор
По умолчанию у новых пользователей роль `parent`. Чтобы создать первого `admin`, после регистрации выполните в SQL Editor:
```sql
update public.profiles
set role = 'admin'
where email = 'ВАШ_EMAIL';
```

## Роли и разделы (MVP)
- `admin`: управление пользователями, детьми и назначениями
- `therapist`: быстрый ввод событий (еда/настроение/сон), инциденты ABC, цели/трекинг
- `parent`: просмотр таймлайна и графиков, домашние заметки

## Скрипты
- `npm run dev` — dev‑режим (webpack)
- `npm run dev:turbo` — dev‑режим (Turbopack)
- `npm run build` — сборка
- `npm run start` — запуск production‑сборки
- `npm run lint` — линтер
