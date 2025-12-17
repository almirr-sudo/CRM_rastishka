"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, UsersRound } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Profile, SpecialistWorkingHours } from "@/types/models";

type TherapistLite = Pick<Profile, "id" | "full_name" | "email">;

type DayDraft = { enabled: boolean; start: string; end: string };

const WEEKDAYS: Array<{ value: number; label: string; full: string }> = [
  { value: 1, label: "Пн", full: "Понедельник" },
  { value: 2, label: "Вт", full: "Вторник" },
  { value: 3, label: "Ср", full: "Среда" },
  { value: 4, label: "Чт", full: "Четверг" },
  { value: 5, label: "Пт", full: "Пятница" },
  { value: 6, label: "Сб", full: "Суббота" },
  { value: 0, label: "Вс", full: "Воскресенье" },
];

function hhmm(v: string | null | undefined) {
  const s = (v ?? "").trim();
  if (!s) return "";
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function timeToMinutes(v: string) {
  const [hRaw, mRaw] = v.split(":");
  const h = Number(hRaw ?? 0);
  const m = Number(mRaw ?? 0);
  return h * 60 + m;
}

function toDbTime(v: string) {
  const s = v.trim();
  if (!s) return s;
  return s.length === 5 ? `${s}:00` : s;
}

function buildDefaultDraft(): Record<number, DayDraft> {
  const out: Record<number, DayDraft> = {};
  WEEKDAYS.forEach((d) => {
    out[d.value] = { enabled: false, start: "09:00", end: "18:00" };
  });
  return out;
}

function buildDraftFromRows(rows: SpecialistWorkingHours[]) {
  const next = buildDefaultDraft();
  rows.forEach((row) => {
    next[row.weekday] = {
      enabled: true,
      start: hhmm(row.start_time),
      end: hhmm(row.end_time),
    };
  });
  return next;
}

async function fetchTherapists(): Promise<TherapistLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "therapist")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TherapistLite[];
}

async function fetchHours(specialistId: string): Promise<SpecialistWorkingHours[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("specialist_working_hours")
    .select("*")
    .eq("specialist_id", specialistId);
  if (error) throw error;
  return (data ?? []) as SpecialistWorkingHours[];
}

function SpecialistHoursEditor({
  specialistId,
  initialRows,
}: {
  specialistId: string;
  initialRows: SpecialistWorkingHours[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<number, DayDraft>>(() => buildDraftFromRows(initialRows));
  const [errorText, setErrorText] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase не настроен");
      if (!specialistId) throw new Error("Выберите специалиста");

      setErrorText(null);
      setSavedHint(null);

      for (const d of WEEKDAYS) {
        const row = draft[d.value];
        if (!row?.enabled) continue;
        if (!row.start || !row.end) throw new Error(`Заполните время для: ${d.full}`);
        if (timeToMinutes(row.end) <= timeToMinutes(row.start)) {
          throw new Error(`Некорректный интервал для: ${d.full}`);
        }
      }

      const enabled = WEEKDAYS.filter((d) => draft[d.value]?.enabled);
      const disabled = WEEKDAYS.filter((d) => !draft[d.value]?.enabled);

      if (enabled.length > 0) {
        const rows = enabled.map((d) => ({
          specialist_id: specialistId,
          weekday: d.value,
          start_time: toDbTime(draft[d.value]!.start),
          end_time: toDbTime(draft[d.value]!.end),
        }));
        const { error: upsertError } = await supabase
          .from("specialist_working_hours")
          .upsert(rows, { onConflict: "specialist_id,weekday" });
        if (upsertError) throw upsertError;
      }

      if (disabled.length > 0) {
        const { error: deleteError } = await supabase
          .from("specialist_working_hours")
          .delete()
          .eq("specialist_id", specialistId)
          .in("weekday", disabled.map((d) => d.value));
        if (deleteError) throw deleteError;
      }
    },
    onSuccess: async () => {
      setSavedHint("Сохранено");
      await queryClient.invalidateQueries({ queryKey: ["business", "specialistHours", specialistId] });
      window.setTimeout(() => setSavedHint(null), 2000);
    },
    onError: (err: unknown) => {
      setErrorText(err instanceof Error ? err.message : "Не удалось сохранить расписание");
    },
  });

  return (
    <>
      <div className="grid gap-2">
        {WEEKDAYS.map((d) => {
          const row = draft[d.value];
          const enabled = row?.enabled ?? false;
          return (
            <div
              key={d.value}
              className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={enabled}
                  onCheckedChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      [d.value]: {
                        ...(prev[d.value] ?? { enabled: false, start: "09:00", end: "18:00" }),
                        enabled: Boolean(v),
                      },
                    }))
                  }
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{d.full}</div>
                  <div className="text-xs text-muted-foreground">{enabled ? "Работает" : "Выходной"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
                <Input
                  type="time"
                  className="h-11"
                  value={row?.start ?? "09:00"}
                  disabled={!enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [d.value]: {
                        ...(prev[d.value] ?? { enabled: false, start: "09:00", end: "18:00" }),
                        start: e.target.value,
                      },
                    }))
                  }
                />
                <Input
                  type="time"
                  className="h-11"
                  value={row?.end ?? "18:00"}
                  disabled={!enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [d.value]: {
                        ...(prev[d.value] ?? { enabled: false, start: "09:00", end: "18:00" }),
                        end: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {errorText ? <div className="rounded-lg border bg-card p-3 text-sm text-destructive">{errorText}</div> : null}

      <div className="flex items-center justify-end gap-2">
        {savedHint ? <div className="text-sm text-muted-foreground">{savedHint}</div> : null}
        <Button type="button" className="h-11" disabled={!supabase || !specialistId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="size-4" />
          Сохранить
        </Button>
      </div>
    </>
  );
}

export function SpecialistScheduleManager() {
  const therapistsQuery = useQuery({
    queryKey: ["business", "therapists"],
    queryFn: fetchTherapists,
    enabled: Boolean(supabase),
  });

  const therapists = therapistsQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string>("");
  const effectiveId = useMemo(() => selectedId || therapists[0]?.id || "", [selectedId, therapists]);

  const hoursQuery = useQuery({
    queryKey: ["business", "specialistHours", effectiveId],
    queryFn: () => fetchHours(effectiveId),
    enabled: Boolean(supabase) && Boolean(effectiveId),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Расписание специалистов</h1>
        <p className="text-sm text-muted-foreground">
          Рабочие часы нужны для быстрого планирования и проверки доступности.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Нет подключения к Supabase</AlertTitle>
          <AlertDescription>Настройте Supabase и миграции, чтобы управлять расписанием.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UsersRound className="size-4 text-muted-foreground" />
              Специалист
            </div>
            <Select value={effectiveId} onValueChange={setSelectedId} disabled={!supabase || therapists.length <= 1}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={therapistsQuery.isLoading ? "Загрузка…" : "Выберите специалиста"} />
              </SelectTrigger>
              <SelectContent>
                {therapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {(t.full_name || "Без имени") + (t.email ? ` · ${t.email}` : "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {!effectiveId ? (
            <div className="text-sm text-muted-foreground">Нет специалистов.</div>
          ) : hoursQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка расписания…</div>
          ) : hoursQuery.isError ? (
            <div className="text-sm text-destructive">Не удалось загрузить расписание.</div>
          ) : (
            <SpecialistHoursEditor key={effectiveId} specialistId={effectiveId} initialRows={hoursQuery.data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
