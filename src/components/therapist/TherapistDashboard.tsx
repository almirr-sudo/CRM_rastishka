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
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <UsersRound className="size-5 text-muted-foreground" />
              <h1 className="truncate text-lg font-semibold leading-tight">
                Быстрый ввод
              </h1>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              <span className="capitalize">{todayLabel}</span>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <div className="text-right text-xs text-muted-foreground">
              Демо-режим
              <div className="hidden sm:block">
                Настройте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`
              </div>
            </div>
          ) : showDemoLabel ? (
            <div className="text-right text-xs text-muted-foreground">
              Демо-режим
              <div className="hidden sm:block">
                Войдите в Supabase Auth, чтобы включить синхронизацию
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
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
              <Card className="transition-shadow group-hover:shadow-sm">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="size-12">
                    <AvatarImage src={child.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-sm font-semibold">
                      {getInitials(child.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium">
                      {child.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {child.dietary_restrictions
                        ? `Питание: ${child.dietary_restrictions}`
                        : "Нет ограничений по питанию"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </main>

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
