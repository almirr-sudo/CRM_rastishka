"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, UsersRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Child } from "@/types/models";

import { QuickLogDrawer } from "./QuickLogDrawer";

const demoChildren: Child[] = [
  {
    id: "demo-1",
    name: "Артём",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: "Без глютена",
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    name: "София",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: null,
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    name: "Максим",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: "Без лактозы",
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    name: "Амина",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: null,
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-5",
    name: "Илья",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: null,
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-6",
    name: "Ева",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: "Избегать орехов",
    avatar_url: null,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function fetchChildren(): Promise<Child[]> {
  if (!supabase) return demoChildren;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return demoChildren;

  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Child[];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "Р";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function formatTodayLongRu(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function TherapistDashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const todayLabel = useMemo(() => formatTodayLongRu(new Date()), []);

  const sessionQuery = useQuery({
    queryKey: ["authSession"],
    queryFn: async () => {
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    enabled: isSupabaseConfigured,
  });

  const hasSession = Boolean(sessionQuery.data?.user);
  const showDemoLabel =
    !isSupabaseConfigured || (sessionQuery.isSuccess && !hasSession);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: fetchChildren,
    enabled: isSupabaseConfigured,
    initialData: demoChildren,
  });

  const children = childrenQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-muted-foreground" />
            <h1 className="truncate text-lg font-semibold leading-tight">Быстрый ввод</h1>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="capitalize">{todayLabel}</span>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
            Демо‑режим. Настройте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </div>
        ) : showDemoLabel ? (
          <div className="rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
            Демо‑режим. Войдите в Supabase Auth, чтобы включить синхронизацию.
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            className={cn(
              "group text-left outline-none",
              "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg",
            )}
            onClick={() => {
              setSelectedChild(child);
              setDrawerOpen(true);
            }}
          >
            <Card className="h-full transition-shadow group-hover:shadow-sm">
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center sm:flex-row sm:items-center sm:gap-3 sm:p-3 sm:text-left">
                <Avatar className="size-14 sm:size-12">
                  <AvatarImage src={child.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-sm font-semibold">
                    {getInitials(child.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 w-full">
                  <div className="truncate text-base font-semibold leading-tight">
                    {child.name}
                  </div>
                  {child.dietary_restrictions ? (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      Питание: {child.dietary_restrictions}
                    </div>
                  ) : (
                    <div className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
                      Нет ограничений по питанию
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <QuickLogDrawer
        key={selectedChild?.id ?? "no-child"}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        child={selectedChild}
        hasSession={hasSession}
      />
    </div>
  );
}
