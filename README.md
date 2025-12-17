# RAS CRM — дневник развития (MVP)
Веб‑приложение для детского сада/центра, работающего с детьми с РАС/АСД: быстрый ввод данных педагогами и понятные отчёты для родителей.

## Стек (фиксированный)
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide
- Supabase (PostgreSQL + Auth)
- TanStack Query (React Query)
- React Hook Form + Zod
- Recharts

## Запуск
1. Создайте `.env.local` по примеру `.env.example` и заполните:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (только для админ‑API приглашений; не публиковать)
2. Запуск dev‑сервера: `npm run dev`
3. Откройте `http://localhost:3000`

## Supabase (БД + RLS)
Миграции:
- `supabase/migrations/20251217120000_init.sql` — ядро схемы + RLS/RBAC
- `supabase/migrations/20251217123000_timeline_events.sql` — лента событий дня (`timeline_events`)

Таблицы (ядро):
- `profiles`, `children`, `therapist_children`
- `daily_logs`, `behavior_incidents`
- `skill_goals`, `skill_tracking`
- `timeline_events`

## Роли и доступ (RBAC)
- `admin`: управление пользователями/детьми/назначениями
- `therapist`: быстрый ввод логов, инциденты ABC, цели/навыки
- `parent`: только просмотр данных своего ребёнка (портал родителя)

## Маршруты (MVP)
- `/auth/login` — вход (если Supabase не настроен, доступен демо‑вход по ролям)
- `/app` — редирект по роли
- Админка: `/app/admin`, `/app/admin/users`, `/app/admin/children`, `/app/admin/assignments`
- Терапевт: `/app/therapist`, `/app/therapist/incidents`, `/app/therapist/incidents/[id]`, `/app/therapist/abc-analysis`, `/app/therapist/goals`, `/app/therapist/goals/[id]`
- Родитель: `/app/parent`

## Примечания
- В демо‑режиме данные показываются примерные, без синхронизации с БД.
- “Быстрый ввод” записывает события для ленты дня в `timeline_events` (питание/настроение/сон) и инциденты в `behavior_incidents`.
