"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  Moon,
  Siren,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BehaviorIncident, Child, DailyLog, FoodIntake } from "@/types/models";

type UpsertDailyLogInput = {
  childId: string;
  date: string; // YYYY-MM-DD
  patch: Partial<Pick<DailyLog, "food_intake" | "mood_score" | "sleep_duration">>;
};

function dateKeyToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimeRu(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(d);
}

async function fetchDailyLog(childId: string, date: string): Promise<DailyLog | null> {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("child_id", childId)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as DailyLog | null;
}

async function upsertDailyLog(input: UpsertDailyLogInput): Promise<DailyLog> {
  const nowIso = new Date().toISOString();

  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      child_id: input.childId,
      date: input.date,
      mood_score: input.patch.mood_score ?? null,
      sleep_duration: input.patch.sleep_duration ?? null,
      food_intake: input.patch.food_intake ?? null,
      toilet_data: {},
      created_by: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      id: crypto.randomUUID(),
      child_id: input.childId,
      date: input.date,
      mood_score: input.patch.mood_score ?? null,
      sleep_duration: input.patch.sleep_duration ?? null,
      food_intake: input.patch.food_intake ?? null,
      toilet_data: {},
      created_by: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  const payload = {
    child_id: input.childId,
    date: input.date,
    ...input.patch,
  };

  const { data, error } = await supabase
    .from("daily_logs")
    .upsert(payload, { onConflict: "child_id,date" })
    .select("*")
    .single();

  if (error) throw error;
  return data as DailyLog;
}

async function createBehaviorIncident(childId: string): Promise<BehaviorIncident> {
  const nowIso = new Date().toISOString();

  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      child_id: childId,
      timestamp: nowIso,
      antecedent: null,
      behavior: null,
      consequence: null,
      intensity: 5,
      created_by: null,
      created_at: nowIso,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      id: crypto.randomUUID(),
      child_id: childId,
      timestamp: nowIso,
      antecedent: null,
      behavior: null,
      consequence: null,
      intensity: 5,
      created_by: null,
      created_at: nowIso,
    };
  }

  const payload = {
    child_id: childId,
    timestamp: nowIso,
    intensity: 5,
  };

  const { data, error } = await supabase
    .from("behavior_incidents")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as BehaviorIncident;
}

type MoodOption = { score: 1 | 2 | 3 | 4 | 5; emoji: string; label: string };

const moodOptions: MoodOption[] = [
  { score: 5, emoji: "😊", label: "Очень хорошо" },
  { score: 4, emoji: "🙂", label: "Хорошо" },
  { score: 3, emoji: "😐", label: "Нейтрально" },
  { score: 2, emoji: "😟", label: "Тревожно" },
  { score: 1, emoji: "😣", label: "Мелтдаун" },
];

const foodOptions: Array<{ value: FoodIntake; label: string; icon: "full" | "half" | "none" | "refusal" }> =
  [
    { value: "all", label: "Всё съел", icon: "full" },
    { value: "half", label: "Половина", icon: "half" },
    { value: "none", label: "Не ел", icon: "none" },
    { value: "refusal", label: "Отказ", icon: "refusal" },
  ];

export function QuickLogDrawer({
  open,
  onOpenChange,
  child,
  hasSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: Child | null;
  hasSession: boolean;
}) {
  const queryClient = useQueryClient();
  const date = useMemo(() => dateKeyToday(), []);

  const [napStartedAt, setNapStartedAt] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const childId = child?.id ?? null;
  const demoMode = !isSupabaseConfigured || !hasSession;

  const dailyLogQuery = useQuery({
    queryKey: ["dailyLog", childId, date],
    queryFn: () => fetchDailyLog(childId as string, date),
    enabled: Boolean(childId) && isSupabaseConfigured && hasSession,
  });

  const dailyLog = dailyLogQuery.data ?? null;

  useEffect(() => {
    if (!lastAction) return;
    const t = window.setTimeout(() => setLastAction(null), 2000);
    return () => window.clearTimeout(t);
  }, [lastAction]);

  const upsertDailyLogMutation = useMutation({
    mutationFn: upsertDailyLog,
    onMutate: async (input) => {
      const key = ["dailyLog", input.childId, input.date] as const;

      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyLog | null>(key);

      const nowIso = new Date().toISOString();
      const next: DailyLog = {
        id: previous?.id ?? crypto.randomUUID(),
        child_id: input.childId,
        date: input.date,
        mood_score: input.patch.mood_score ?? previous?.mood_score ?? null,
        food_intake: input.patch.food_intake ?? previous?.food_intake ?? null,
        sleep_duration: input.patch.sleep_duration ?? previous?.sleep_duration ?? null,
        toilet_data: previous?.toilet_data ?? {},
        created_by: previous?.created_by ?? null,
        created_at: previous?.created_at ?? nowIso,
        updated_at: nowIso,
      };

      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, input, context) => {
      queryClient.setQueryData(["dailyLog", input.childId, input.date], context?.previous ?? null);
      setLastAction("Не удалось сохранить. Проверьте подключение.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["dailyLog", data.child_id, data.date], data);
      setLastAction("Сохранено");
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (childIdArg: string) => createBehaviorIncident(childIdArg),
    onSuccess: () => setLastAction("Инцидент зафиксирован"),
    onError: () => setLastAction("Не удалось зафиксировать инцидент"),
  });

  const canInteract = Boolean(childId);

  const moodValue = dailyLog?.mood_score ?? null;
  const foodValue = dailyLog?.food_intake ?? null;
  const sleepMinutes = dailyLog?.sleep_duration ?? null;

  const sleepLabel =
    sleepMinutes == null
      ? "Сон за день: —"
      : `Сон за день: ${Math.round(sleepMinutes)} мин`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-2xl">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg">
            {child ? `Быстрый лог: ${child.name}` : "Быстрый лог"}
          </DrawerTitle>
          {lastAction ? (
            <div className="text-sm text-muted-foreground">{lastAction}</div>
          ) : null}
        </DrawerHeader>

        <div className="px-4 pb-4">
          {demoMode ? (
            <div className="mb-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
              Демо-режим — данные не синхронизируются с Supabase.
            </div>
          ) : null}

          <div className="grid gap-4">
            <section className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <Utensils className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Еда</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {foodValue ? `Текущее: ${foodOptions.find((o) => o.value === foodValue)?.label}` : "Не заполнено"}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2">
                {foodOptions.map((opt) => {
                  const selected = foodValue === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={selected ? "default" : "secondary"}
                      className={cn("h-14 justify-start text-base", selected && "shadow-sm")}
                      disabled={!canInteract || upsertDailyLogMutation.isPending}
                      onClick={() => {
                        if (!childId) return;
                        upsertDailyLogMutation.mutate({
                          childId,
                          date,
                          patch: { food_intake: opt.value },
                        });
                      }}
                    >
                      {opt.icon === "refusal" ? (
                        <UtensilsCrossed className="size-5" />
                      ) : (
                        <Utensils className="size-5" />
                      )}
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🙂</span>
                <h2 className="text-sm font-semibold">Настроение</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {moodValue ? `Оценка: ${moodValue}/5` : "Не заполнено"}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-5 gap-2">
                {moodOptions.map((m) => {
                  const selected = moodValue === m.score;
                  return (
                    <Button
                      key={m.score}
                      type="button"
                      variant={selected ? "default" : "secondary"}
                      className={cn("h-14 px-0 text-2xl", selected && "shadow-sm")}
                      aria-label={m.label}
                      disabled={!canInteract || upsertDailyLogMutation.isPending}
                      onClick={() => {
                        if (!childId) return;
                        upsertDailyLogMutation.mutate({
                          childId,
                          date,
                          patch: { mood_score: m.score },
                        });
                      }}
                    >
                      {m.emoji}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[11px] text-muted-foreground">
                {moodOptions.map((m) => (
                  <div key={m.score} className="leading-tight">
                    {m.label}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <Moon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Сон</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {sleepLabel}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 justify-start text-base"
                  disabled={!canInteract || Boolean(napStartedAt)}
                  onClick={() => {
                    if (!childId) return;
                    const nowIso = new Date().toISOString();
                    setNapStartedAt(nowIso);
                    setLastAction("Сон начался");
                  }}
                >
                  <Moon className="size-5" />
                  Сон начался
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 justify-start text-base"
                  disabled={!canInteract || !napStartedAt || upsertDailyLogMutation.isPending}
                  onClick={() => {
                    if (!childId || !napStartedAt) return;
                    const endIso = new Date().toISOString();
                    const minutes = Math.max(
                      0,
                      Math.round(
                        (new Date(endIso).getTime() - new Date(napStartedAt).getTime()) / 60000,
                      ),
                    );
                    const next = (sleepMinutes ?? 0) + minutes;
                    setNapStartedAt(null);

                    upsertDailyLogMutation.mutate({
                      childId,
                      date,
                      patch: { sleep_duration: next },
                    });
                  }}
                >
                  <AlarmClock className="size-5" />
                  Сон закончился
                </Button>
              </div>
              {napStartedAt ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  В процессе: с {formatTimeRu(napStartedAt)}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <Siren className="size-4 text-destructive" />
                <h2 className="text-sm font-semibold">Экстренная кнопка</h2>
              </div>
              <Separator className="my-3" />
              <Button
                type="button"
                variant="destructive"
                className="h-14 w-full justify-start text-base"
                disabled={!canInteract || incidentMutation.isPending}
                onClick={() => {
                  if (!childId) return;
                  incidentMutation.mutate(childId);
                }}
              >
                <Siren className="size-5" />
                Зафиксировать инцидент (ABC)
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                Время ставится автоматически. Детали можно добавить позже.
              </div>
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
