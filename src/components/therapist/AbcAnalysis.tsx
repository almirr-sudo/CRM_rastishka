"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Flame, Siren } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/client";
import type { BehaviorIncident, Child } from "@/types/models";

type IncidentLite = Pick<BehaviorIncident, "child_id" | "timestamp">;
const EMPTY_INCIDENTS: IncidentLite[] = [];

function startIso(date: string) {
  return new Date(date + "T00:00:00.000").toISOString();
}

function endIso(date: string) {
  return new Date(date + "T23:59:59.999").toISOString();
}

function localDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabelRu(dateKey: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateKey + "T00:00:00"));
}

function lastDaysRange(n: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - (n - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function heatColor(value: number, max: number) {
  if (value <= 0) return "rgba(47,111,94,0.06)";
  const t = max <= 0 ? 0 : value / max;
  const alpha = 0.18 + 0.82 * Math.min(1, Math.max(0, t));
  return `rgba(47,111,94,${alpha.toFixed(3)})`;
}

function HeatCell({
  cx,
  cy,
  payload,
  max,
}: {
  cx?: number;
  cy?: number;
  payload?: { value?: number };
  max: number;
}) {
  if (cx == null || cy == null) return null;
  const value = payload?.value ?? 0;
  const size = 14;
  return (
    <rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      rx={3}
      ry={3}
      fill={heatColor(value, max)}
      stroke="rgba(47,111,94,0.18)"
    />
  );
}

function HeatmapTooltip({
  active,
  payload,
  label,
  days,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: { hour?: number; dayIndex?: number; value?: number };
  }>;
  label?: string | number;
  days: string[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const day = typeof p.dayIndex === "number" ? days[p.dayIndex] : null;
  const hour = p.hour ?? null;
  const value = p.value ?? 0;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">Инциденты</div>
      <div className="text-muted-foreground">
        {day ? dayLabelRu(day) : label} · {hour != null ? `${String(hour).padStart(2, "0")}:00` : "—"}
      </div>
      <div className="mt-1">Количество: {value}</div>
    </div>
  );
}

async function fetchChildrenLite(): Promise<Array<Pick<Child, "id" | "name">>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("children")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Pick<Child, "id" | "name">>;
}

async function fetchIncidents(params: {
  childId?: string;
  from: string;
  to: string;
}): Promise<IncidentLite[]> {
  if (!supabase) return [];

  let q = supabase
    .from("behavior_incidents")
    .select("child_id,timestamp")
    .gte("timestamp", startIso(params.from))
    .lte("timestamp", endIso(params.to))
    .order("timestamp", { ascending: true })
    .limit(2000);

  if (params.childId) q = q.eq("child_id", params.childId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as IncidentLite[];
}

export function AbcAnalysis() {
  const range = useMemo(() => lastDaysRange(7), []);
  const [childId, setChildId] = useState<string>("");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const childrenQuery = useQuery({
    queryKey: ["therapist", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const incidentsQuery = useQuery({
    queryKey: ["therapist", "abc-heatmap", { childId, from, to }],
    queryFn: () =>
      fetchIncidents({
        childId: childId || undefined,
        from,
        to,
      }),
    enabled: Boolean(supabase) && Boolean(from) && Boolean(to),
  });

  const days = useMemo(() => datesBetween(from, to), [from, to]);
  const incidents = incidentsQuery.data ?? EMPTY_INCIDENTS;

  const points = useMemo(() => {
    const map = new Map<string, number>();
    incidents.forEach((i) => {
      const d = new Date(i.timestamp);
      const hour = d.getHours();
      const dayKey = localDateKey(i.timestamp);
      const key = `${dayKey}|${hour}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const out: Array<{ hour: number; dayIndex: number; value: number; day: string }> = [];
    days.forEach((day, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        out.push({
          hour,
          dayIndex,
          day,
          value: map.get(`${day}|${hour}`) ?? 0,
        });
      }
    });
    return out;
  }, [days, incidents]);

  const maxValue = useMemo(() => {
    return points.reduce((m, p) => Math.max(m, p.value), 0);
  }, [points]);

  const children = childrenQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">ABC анализ</h1>
        <p className="text-sm text-muted-foreground">
          Тепловая карта: в какие часы чаще происходят инциденты.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>Настройте Supabase, чтобы видеть аналитику.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-muted-foreground" />
            Период и фильтры
          </div>
          <Separator />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs font-medium text-muted-foreground">Ребёнок</div>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Все дети" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все дети</SelectItem>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium text-muted-foreground">С</div>
              <Input className="h-10" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-muted-foreground">По</div>
              <Input className="h-10" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Flame className="size-4 text-muted-foreground" />
              Тепловая карта по часам
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Siren className="size-4 text-destructive" />
              Всего: {incidents.length}
            </div>
          </div>
          <Separator />

          {days.length === 0 ? (
            <div className="text-sm text-muted-foreground">Выберите корректный период</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ left: 24, right: 16, top: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    dataKey="hour"
                    domain={[0, 23]}
                    ticks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                    tickFormatter={(v) => `${String(v).padStart(2, "0")}:00`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="dayIndex"
                    domain={[0, days.length - 1]}
                    ticks={days.map((_, i) => i)}
                    tickFormatter={(v) => (typeof v === "number" ? dayLabelRu(days[v]!) : "")}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip
                    content={(props: unknown) => {
                      const p = props as {
                        active?: boolean;
                        payload?: unknown;
                        label?: string | number;
                      };
                      return (
                        <HeatmapTooltip
                          active={p.active}
                          payload={
                            p.payload as ReadonlyArray<{
                              payload?: { hour?: number; dayIndex?: number; value?: number };
                            }>
                          }
                          label={p.label}
                          days={days}
                        />
                      );
                    }}
                  />
                  <Scatter
                    data={points}
                    shape={(props: { cx?: number; cy?: number; payload?: { value?: number } }) => (
                      <HeatCell {...props} max={maxValue} />
                    )}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {incidentsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка данных…</div>
          ) : null}
          {incidentsQuery.isError ? (
            <div className="text-sm text-destructive">Не удалось загрузить данные</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
