"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  CalendarDays,
  Moon,
  Siren,
  Smile,
  Utensils,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  BehaviorIncident,
  Child,
  DailyLog,
  FoodIntake,
  SkillGoal,
  SkillTracking,
  TimelineEvent,
  TimelineEventType,
} from "@/types/models";

type TimelineItem =
  | { kind: "event"; timestamp: string; type: TimelineEventType; payload: unknown }
  | { kind: "incident"; timestamp: string; intensity: number | null; id: string };

function startOfDayIso(date: string) {
  return new Date(date + "T00:00:00.000").toISOString();
}

function endOfDayIso(date: string) {
  return new Date(date + "T23:59:59.999").toISOString();
}

function timeRu(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function dateLabelRu(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(
    new Date(date + "T00:00:00"),
  );
}

function foodLabel(v: FoodIntake) {
  switch (v) {
    case "all":
      return "Всё съел";
    case "half":
      return "Половина";
    case "none":
      return "Не ел";
    case "refusal":
      return "Отказ";
    default:
      return v;
  }
}

function timelineIcon(item: TimelineItem) {
  if (item.kind === "incident") return <Siren className="size-4 text-destructive" />;
  switch (item.type) {
    case "food":
      return <Utensils className="size-4 text-muted-foreground" />;
    case "mood":
      return <Smile className="size-4 text-muted-foreground" />;
    case "nap_start":
    case "nap_end":
      return <Moon className="size-4 text-muted-foreground" />;
    default:
      return <AlarmClock className="size-4 text-muted-foreground" />;
  }
}

function timelineText(item: TimelineItem) {
  if (item.kind === "incident") {
    const intensity = item.intensity ? `${item.intensity}/10` : "—";
    return `Инцидент (ABC), интенсивность: ${intensity}`;
  }

  const payload = (item.payload ?? {}) as Record<string, unknown>;
  if (item.type === "food") {
    const v = payload.food_intake as FoodIntake | undefined;
    return v ? `Питание: ${foodLabel(v)}` : "Питание отмечено";
  }
  if (item.type === "mood") {
    const score = payload.mood_score as number | undefined;
    return score ? `Настроение: ${score}/5` : "Настроение отмечено";
  }
  if (item.type === "nap_start") return "Сон начался";
  if (item.type === "nap_end") {
    const minutes = payload.minutes as number | undefined;
    return minutes ? `Сон закончился (+${minutes} мин)` : "Сон закончился";
  }
  return "Событие";
}

function lastNDates(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function fetchMyChildren(): Promise<Child[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Child[];
}

async function fetchDailyLog(childId: string, date: string): Promise<DailyLog | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("child_id", childId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DailyLog | null;
}

async function fetchTimeline(childId: string, date: string): Promise<TimelineItem[]> {
  if (!supabase) return [];

  const startIso = startOfDayIso(date);
  const endIso = endOfDayIso(date);

  const [{ data: events, error: eventsError }, { data: incidents, error: incidentsError }] =
    await Promise.all([
      supabase
        .from("timeline_events")
        .select("*")
        .eq("child_id", childId)
        .gte("timestamp", startIso)
        .lte("timestamp", endIso)
        .order("timestamp", { ascending: true }),
      supabase
        .from("behavior_incidents")
        .select("id,timestamp,intensity")
        .eq("child_id", childId)
        .gte("timestamp", startIso)
        .lte("timestamp", endIso)
        .order("timestamp", { ascending: true }),
    ]);

  if (eventsError) throw eventsError;
  if (incidentsError) throw incidentsError;

  const eventItems: TimelineItem[] = ((events ?? []) as TimelineEvent[]).map((e) => ({
    kind: "event",
    timestamp: e.timestamp,
    type: e.type,
    payload: e.payload,
  }));

  const incidentItems: TimelineItem[] = ((incidents ?? []) as Array<
    Pick<BehaviorIncident, "id" | "timestamp" | "intensity">
  >).map((i) => ({
    kind: "incident",
    id: i.id,
    timestamp: i.timestamp,
    intensity: i.intensity,
  }));

  return [...eventItems, ...incidentItems].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

async function fetchMoodWeek(childId: string): Promise<Array<{ date: string; label: string; mood: number | null }>> {
  if (!supabase) return [];

  const dates = lastNDates(7);
  const from = dates[0]!;
  const to = dates[dates.length - 1]!;

  const { data, error } = await supabase
    .from("daily_logs")
    .select("date,mood_score")
    .eq("child_id", childId)
    .gte("date", from)
    .lte("date", to);

  if (error) throw error;

  const map = new Map<string, number>();
  (data ?? []).forEach((row) => {
    map.set(row.date as string, (row.mood_score as number | null) ?? 0);
  });

  return dates.map((d) => ({
    date: d,
    label: dateLabelRu(d),
    mood: map.has(d) ? (map.get(d)! || null) : null,
  }));
}

async function fetchGoalsAndTracking(childId: string): Promise<{
  goals: SkillGoal[];
  tracking: SkillTracking[];
}> {
  if (!supabase) return { goals: [], tracking: [] };

  const { data: goals, error: goalsError } = await supabase
    .from("skill_goals")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  if (goalsError) throw goalsError;
  const goalsList = (goals ?? []) as SkillGoal[];
  const goalIds = goalsList.map((g) => g.id);
  if (goalIds.length === 0) return { goals: goalsList, tracking: [] };

  const from = lastNDates(30)[0]!;
  const { data: tracking, error: trackingError } = await supabase
    .from("skill_tracking")
    .select("goal_id,prompt_level,success,date,created_at,id,created_by")
    .in("goal_id", goalIds)
    .gte("date", from);

  if (trackingError) throw trackingError;
  return { goals: goalsList, tracking: (tracking ?? []) as SkillTracking[] };
}

const demoChild: Child = {
  id: "demo-child-parent",
  name: "Артём",
  dob: null,
  diagnosis: "РАС",
  dietary_restrictions: "Без глютена",
  avatar_url: null,
  parent_id: "demo-parent",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_CHILDREN: Child[] = [demoChild];
const EMPTY_CHILDREN: Child[] = [];
const EMPTY_GOALS: SkillGoal[] = [];
const EMPTY_TRACKING: SkillTracking[] = [];

export function ParentPortal() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: fetchMyChildren,
    enabled: Boolean(supabase),
  });

  const children = useMemo(
    () => (supabase ? childrenQuery.data ?? EMPTY_CHILDREN : DEMO_CHILDREN),
    [childrenQuery.data],
  );
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const effectiveChildId = selectedChildId || children[0]?.id || "";

  const selectedChild = useMemo(
    () => children.find((c) => c.id === effectiveChildId) ?? null,
    [children, effectiveChildId],
  );

  const dailyLogQuery = useQuery({
    queryKey: ["parent", "dailyLog", selectedChild?.id, date],
    queryFn: () => fetchDailyLog(selectedChild!.id, date),
    enabled: Boolean(supabase) && Boolean(selectedChild?.id),
  });

  const timelineQuery = useQuery({
    queryKey: ["parent", "timeline", selectedChild?.id, date],
    queryFn: () => fetchTimeline(selectedChild!.id, date),
    enabled: Boolean(supabase) && Boolean(selectedChild?.id),
  });

  const moodWeekQuery = useQuery({
    queryKey: ["parent", "moodWeek", selectedChild?.id],
    queryFn: () => fetchMoodWeek(selectedChild!.id),
    enabled: Boolean(supabase) && Boolean(selectedChild?.id),
  });

  const goalsQuery = useQuery({
    queryKey: ["parent", "goals", selectedChild?.id],
    queryFn: () => fetchGoalsAndTracking(selectedChild!.id),
    enabled: Boolean(supabase) && Boolean(selectedChild?.id),
  });

  const timelineItems: TimelineItem[] = supabase
    ? timelineQuery.data ?? []
    : [
        { kind: "event", timestamp: new Date().toISOString(), type: "food", payload: { food_intake: "half" } },
        { kind: "event", timestamp: new Date().toISOString(), type: "mood", payload: { mood_score: 4 } },
      ];

  const moodWeek = supabase ? moodWeekQuery.data ?? [] : lastNDates(7).map((d, idx) => ({
    date: d,
    label: dateLabelRu(d),
    mood: [4, 5, 3, 4, 4, 2, 4][idx] ?? null,
  }));

  const dailyLog = dailyLogQuery.data ?? null;

  const goalsData = goalsQuery.data;
  const goals = goalsData?.goals ?? EMPTY_GOALS;
  const tracking = goalsData?.tracking ?? EMPTY_TRACKING;

  const progressByGoalId = useMemo(() => {
    const byGoal = new Map<string, { total: number; independentSuccess: number }>();
    tracking.forEach((t) => {
      const cur = byGoal.get(t.goal_id) ?? { total: 0, independentSuccess: 0 };
      cur.total += 1;
      if (t.prompt_level === "independent" && t.success) cur.independentSuccess += 1;
      byGoal.set(t.goal_id, cur);
    });
    return byGoal;
  }, [tracking]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Портал родителя</h1>
          <p className="text-sm text-muted-foreground">
            Лента дня и прогресс развития.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
          <div className="grid gap-1">
            <div className="text-xs font-medium text-muted-foreground">Ребёнок</div>
            <Select
              value={effectiveChildId}
              onValueChange={setSelectedChildId}
              disabled={!selectedChild || children.length <= 1}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Выберите ребёнка" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs font-medium text-muted-foreground">Дата</div>
            <Input className="h-10" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>
            Supabase не настроен — показаны примерные данные.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="grid gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" />
              Лента дня
            </div>
            <Separator />

            {selectedChild ? (
              <div className="grid gap-2">
                {timelineItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {timelineQuery.isLoading ? "Загрузка…" : "Пока нет событий за выбранную дату"}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {timelineItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border bg-card px-3 py-3",
                        )}
                      >
                        <div className="mt-0.5">{timelineIcon(item)}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{timelineText(item)}</div>
                          <div className="text-xs text-muted-foreground">
                            {timeRu(item.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Нет привязанных детей</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card>
            <CardContent className="grid gap-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Smile className="size-4 text-muted-foreground" />
                Стабильность настроения (7 дней)
              </div>
              <Separator />
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={moodWeek} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                    <Tooltip
                      formatter={(v) => (v ? [`${v}/5`, "Настроение"] : ["—", "Настроение"])}
                      labelFormatter={(l) => `Дата: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      stroke="var(--chart-1)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {supabase && moodWeekQuery.isError ? (
                <div className="text-xs text-muted-foreground">
                  Не удалось загрузить данные настроения
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Moon className="size-4 text-muted-foreground" />
                Сводка дня
              </div>
              <Separator />

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Настроение</span>
                  <span className="font-medium">
                    {dailyLog?.mood_score ? `${dailyLog.mood_score}/5` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Питание</span>
                  <span className="font-medium">
                    {dailyLog?.food_intake ? foodLabel(dailyLog.food_intake) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Сон</span>
                  <span className="font-medium">
                    {dailyLog?.sleep_duration != null ? `${dailyLog.sleep_duration} мин` : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Прогресс навыков</div>
          <Separator />

          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {goalsQuery.isLoading ? "Загрузка…" : "Пока нет целей"}
            </div>
          ) : (
            <div className="grid gap-3">
              {goals.map((g) => {
                const stats = progressByGoalId.get(g.id) ?? { total: 0, independentSuccess: 0 };
                const percent =
                  stats.total > 0 ? Math.round((stats.independentSuccess / stats.total) * 100) : 0;
                const statusLabel = g.status === "mastered" ? "Освоено" : "В процессе";
                return (
                  <div key={g.id} className="grid gap-2 rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{g.goal_title}</div>
                        <div className="text-xs text-muted-foreground">{statusLabel}</div>
                      </div>
                      <div className="text-sm font-semibold">
                        {stats.total > 0 ? `${percent}%` : "—"}
                      </div>
                    </div>
                    <Progress value={stats.total > 0 ? percent : 0} />
                    <div className="text-xs text-muted-foreground">
                      {stats.total > 0
                        ? `Независимо: ${stats.independentSuccess} из ${stats.total}`
                        : "Нет данных по попыткам"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
