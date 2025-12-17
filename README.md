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
2. Запуск dev‑сервера: `npm run dev`
3. Откройте `http://localhost:3000`

Если Supabase не настроен, приложение запускается в демо‑режиме (UI работает, данные не сохраняются в БД).

## База данных (Supabase)
- Миграция схемы: `supabase/migrations/20251217120000_init.sql`
- Таблицы (ядро): `profiles`, `children`, `daily_logs`, `behavior_incidents`, `skill_goals`, `skill_tracking`, `therapist_children`
- Включены RLS‑политики для ролей `admin` / `therapist` / `parent`

## Текущее состояние MVP
- Стартовая страница `/`: «Быстрый ввод» (панель терапевта) — сетка детей + быстрый лог в drawer
