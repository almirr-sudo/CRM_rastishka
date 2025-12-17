"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Filter, Siren } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type IncidentRow = Pick<
  BehaviorIncident,
  "id" | "child_id" | "timestamp" | "intensity" | "antecedent" | "behavior" | "consequence"
> & { child?: Pick<Child, "name"> | null };

function startIso(date: string) {
  return new Date(date + "T00:00:00.000").toISOString();
}

function endIso(date: string) {
  return new Date(date + "T23:59:59.999").toISOString();
}

function dateTimeRu(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
  from?: string;
  to?: string;
}): Promise<IncidentRow[]> {
  if (!supabase) return [];

  let q = supabase
    .from("behavior_incidents")
    .select("id,child_id,timestamp,intensity,antecedent,behavior,consequence, child:children(name)")
    .order("timestamp", { ascending: false })
    .limit(200);

  if (params.childId) q = q.eq("child_id", params.childId);
  if (params.from) q = q.gte("timestamp", startIso(params.from));
  if (params.to) q = q.lte("timestamp", endIso(params.to));

  const { data, error } = await q;
  if (error) throw error;
  type RawRow = {
    id: unknown;
    child_id: unknown;
    timestamp: unknown;
    intensity: unknown;
    antecedent: unknown;
    behavior: unknown;
    consequence: unknown;
    child?: unknown;
  };

  function normalizeChild(child: unknown): Pick<Child, "name"> | null {
    const v = Array.isArray(child) ? child[0] : child;
    if (!v || typeof v !== "object") return null;
    const name = (v as { name?: unknown }).name;
    return typeof name === "string" ? { name } : null;
  }

  const rows = (data ?? []) as RawRow[];
  return rows.map((r) => ({
    id: String(r.id),
    child_id: String(r.child_id),
    timestamp: String(r.timestamp),
    intensity: typeof r.intensity === "number" ? r.intensity : null,
    antecedent: typeof r.antecedent === "string" ? r.antecedent : null,
    behavior: typeof r.behavior === "string" ? r.behavior : null,
    consequence: typeof r.consequence === "string" ? r.consequence : null,
    child: normalizeChild(r.child),
  }));
}

function hasDetails(i: IncidentRow) {
  return Boolean(i.antecedent || i.behavior || i.consequence);
}

export function IncidentsList() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [childId, setChildId] = useState<string>("");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  const childrenQuery = useQuery({
    queryKey: ["therapist", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const incidentsQuery = useQuery({
    queryKey: ["therapist", "incidents", { childId, from, to }],
    queryFn: () =>
      fetchIncidents({
        childId: childId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: Boolean(supabase),
  });

  const children = childrenQuery.data ?? [];
  const incidents = incidentsQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Инциденты (ABC)</h1>
        <p className="text-sm text-muted-foreground">
          Быстро зафиксированные инциденты можно заполнить позже по схеме ABC.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>Настройте Supabase, чтобы просматривать инциденты.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="size-4 text-muted-foreground" />
            Фильтры
          </div>
          <Separator />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs font-medium text-muted-foreground">Ребёнок</div>
              <Select
                value={childId ? childId : "all"}
                onValueChange={(v) => setChildId(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Все дети" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все дети</SelectItem>
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
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-muted-foreground" />
            Список
          </div>
          <Separator />

          {incidents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {incidentsQuery.isLoading ? "Загрузка…" : "Нет инцидентов по выбранным фильтрам"}
            </div>
          ) : (
            <div className="grid gap-2">
              {incidents.map((i) => (
                <div
                  key={i.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Siren className="size-4 text-destructive" />
                      <div className="text-sm font-semibold">
                        {i.child?.name ? i.child.name : "Ребёнок"} · {dateTimeRu(i.timestamp)}
                      </div>
                      {hasDetails(i) ? (
                        <Badge variant="secondary">Заполнено</Badge>
                      ) : (
                        <Badge variant="outline">Требует заполнения</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Интенсивность: {i.intensity ?? "—"}/10
                    </div>
                  </div>

                  <Button asChild variant="secondary" className="h-9 shrink-0">
                    <Link href={`/app/therapist/incidents/${i.id}`}>
                      Открыть
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
