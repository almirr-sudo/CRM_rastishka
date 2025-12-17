"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventResizeDoneArg,
} from "@fullcalendar/core";
import ruLocale from "@fullcalendar/core/locales/ru";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardCopy, CopyCheck, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus, Child, Profile, Service } from "@/types/models";

type AppointmentRow = Appointment & {
  child?: Pick<Child, "id" | "name"> | null;
  service?: Pick<Service, "id" | "name" | "color" | "duration_min" | "price"> | null;
  specialist?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

type ChildLite = Pick<Child, "id" | "name">;
type TherapistLite = Pick<Profile, "id" | "full_name" | "email">;
type ServiceLite = Pick<Service, "id" | "name" | "duration_min" | "price" | "color">;

const statusOptions: Array<{ value: AppointmentStatus; label: string }> = [
  { value: "pending", label: "Ожидает" },
  { value: "confirmed", label: "Подтверждено" },
  { value: "completed", label: "Завершено" },
  { value: "no_show", label: "Не явился" },
  { value: "canceled", label: "Отменено" },
];

const weekdayOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

function toLocalDateTimeInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalDateTimeInputValue(v: string) {
  const s = v.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseDateYYYYMMDD(v: string) {
  const s = v.trim();
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isConflictError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: string; message?: string };
  const code = anyErr.code ?? "";
  const message = anyErr.message ?? "";
  return (
    code === "23P01" ||
    message.toLowerCase().includes("exclude") ||
    message.toLowerCase().includes("overlap") ||
    message.toLowerCase().includes("appointments_no_overlap")
  );
}

function formatTimeRu(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDateLongRu(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso));
}

function buildReminderText(input: { childName: string; serviceName: string; startIso: string }) {
  const date = formatDateLongRu(input.startIso);
  const time = formatTimeRu(input.startIso);
  return `Напоминание: ${input.childName} записан(а) на «${input.serviceName}» ${date} в ${time}.`;
}

async function fetchChildrenLite(): Promise<ChildLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("children").select("id,name").order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ChildLite[]).filter((c) => c.id);
}

async function fetchTherapists(): Promise<TherapistLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "therapist")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TherapistLite[]).filter((t) => t.id);
}

async function fetchServices(): Promise<ServiceLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("services")
    .select("id,name,duration_min,price,color")
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ServiceLite[]).filter((s) => s.id);
}

async function fetchAppointments(range: { startIso: string; endIso: string }): Promise<AppointmentRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "*, child:children(id,name), service:services(id,name,color,duration_min,price), specialist:profiles(id,full_name,email)",
    )
    .lt("start_time", range.endIso)
    .gt("end_time", range.startIso)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppointmentRow[];
}

async function updateAppointment(id: string, patch: Partial<Appointment>) {
  if (!supabase) throw new Error("Supabase не настроен");
  const { error } = await supabase.from("appointments").update(patch).eq("id", id);
  if (error) throw error;
}

async function deleteAppointment(id: string) {
  if (!supabase) throw new Error("Supabase не настроен");
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

async function insertAppointmentRows(rows: Array<Omit<Appointment, "id" | "created_at" | "updated_at">>) {
  if (!supabase) throw new Error("Supabase не настроен");
  const { error } = await supabase.from("appointments").insert(rows);
  if (error) throw error;
}

const appointmentSchema = z
  .object({
    child_id: z.string().uuid("Выберите ребёнка"),
    specialist_id: z.string().uuid("Выберите специалиста"),
    service_id: z.string().uuid("Выберите услугу"),
    start_local: z.string().min(1, "Укажите дату и время"),
    duration_min: z.coerce.number().int().min(5, "Минимум 5 минут").max(600, "Слишком долго"),
    status: z.enum(["pending", "confirmed", "canceled", "completed", "no_show"]),
    notes: z.string().max(2000).optional().or(z.literal("")),
    recurring_enabled: z.boolean().default(false),
    recurring_weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    recurring_until: z.string().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    const start = parseLocalDateTimeInputValue(v.start_local);
    if (!start) {
      ctx.addIssue({ code: "custom", message: "Некорректная дата/время", path: ["start_local"] });
      return;
    }
    if (!v.recurring_enabled) return;
    const until = v.recurring_until ? parseDateYYYYMMDD(v.recurring_until) : null;
    if (!until) {
      ctx.addIssue({ code: "custom", message: "Укажите дату окончания", path: ["recurring_until"] });
    } else if (until.getTime() < new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) {
      ctx.addIssue({ code: "custom", message: "Дата окончания раньше даты начала", path: ["recurring_until"] });
    }
    if (v.recurring_weekdays.length === 0) {
      ctx.addIssue({ code: "custom", message: "Выберите дни недели", path: ["recurring_weekdays"] });
    }
  });

type AppointmentValues = z.infer<typeof appointmentSchema>;

function appointmentStatusLabel(v: AppointmentStatus) {
  return statusOptions.find((o) => o.value === v)?.label ?? v;
}

function statusBadgeVariant(status: AppointmentStatus) {
  if (status === "confirmed") return "secondary" as const;
  if (status === "completed") return "default" as const;
  return "outline" as const;
}

function statusClassName(status: AppointmentStatus) {
  if (status === "canceled") return "opacity-40 line-through";
  if (status === "no_show") return "opacity-80";
  return "";
}

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfTodayLocal() {
  const start = startOfTodayLocal();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function buildOccurrences(input: { start: Date; until: Date; weekdays: number[] }) {
  const startTime = input.start.getTime();
  const startHours = input.start.getHours();
  const startMinutes = input.start.getMinutes();

  const fromDay = new Date(input.start.getFullYear(), input.start.getMonth(), input.start.getDate(), 0, 0, 0, 0);
  const toDay = new Date(input.until.getFullYear(), input.until.getMonth(), input.until.getDate(), 23, 59, 59, 999);

  const out: Date[] = [];
  for (let d = new Date(fromDay); d.getTime() <= toDay.getTime(); d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    if (!input.weekdays.includes(weekday)) continue;
    const occ = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHours, startMinutes, 0, 0);
    if (occ.getTime() < startTime) continue;
    out.push(occ);
  }

  if (!out.some((d) => d.getTime() === startTime)) {
    out.unshift(input.start);
  }

  return out;
}

function pickInitialDuration(services: ServiceLite[], selectedServiceId: string) {
  const svc = services.find((s) => s.id === selectedServiceId);
  return svc?.duration_min ?? 30;
}

export function BusinessCalendar() {
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar | null>(null);

  const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");
  const [calendarView, setCalendarView] = useState<"timeGridWeek" | "timeGridDay" | "dayGridMonth">("timeGridWeek");

  const [range, setRange] = useState(() => {
    const start = startOfTodayLocal();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  });

  const [timelineDate, setTimelineDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const childrenQuery = useQuery({
    queryKey: ["business", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const therapistsQuery = useQuery({
    queryKey: ["business", "therapists"],
    queryFn: fetchTherapists,
    enabled: Boolean(supabase),
  });

  const servicesQuery = useQuery({
    queryKey: ["business", "services-lite"],
    queryFn: fetchServices,
    enabled: Boolean(supabase),
  });

  const appointmentsQuery = useQuery({
    queryKey: ["business", "appointments", range.startIso, range.endIso],
    queryFn: () => fetchAppointments(range),
    enabled: Boolean(supabase) && Boolean(range.startIso) && Boolean(range.endIso),
  });

  const children = childrenQuery.data ?? [];
  const therapists = therapistsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["business", "appointments"] });
  };

  const canRender = Boolean(supabase);
  const hasPrerequisites = children.length > 0 && therapists.length > 0 && services.length > 0;

  const form = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      child_id: "",
      specialist_id: "",
      service_id: "",
      start_local: "",
      duration_min: 30,
      status: "pending",
      notes: "",
      recurring_enabled: false,
      recurring_weekdays: [],
      recurring_until: "",
    },
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setMessage(null);
    setCopied(false);
  };

  const openCreate = (args: { start: Date; end: Date }) => {
    setEditing(null);
    setMessage(null);
    setCopied(false);

    const initialServiceId = services[0]?.id ?? "";
    const durationMin = pickInitialDuration(services, initialServiceId);

    form.reset({
      child_id: children[0]?.id ?? "",
      specialist_id: therapists[0]?.id ?? "",
      service_id: initialServiceId,
      start_local: toLocalDateTimeInputValue(args.start.toISOString()),
      duration_min: durationMin,
      status: "pending",
      notes: "",
      recurring_enabled: false,
      recurring_weekdays: [args.start.getDay()],
      recurring_until: "",
    });
    setDrawerOpen(true);
  };

  const openEdit = (a: AppointmentRow) => {
    setEditing(a);
    setMessage(null);
    setCopied(false);

    const duration = Math.max(
      5,
      Math.round((new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000),
    );

    form.reset({
      child_id: a.child_id,
      specialist_id: a.specialist_id,
      service_id: a.service_id,
      start_local: toLocalDateTimeInputValue(a.start_time),
      duration_min: duration,
      status: a.status,
      notes: a.notes ?? "",
      recurring_enabled: false,
      recurring_weekdays: [],
      recurring_until: "",
    });
    setDrawerOpen(true);
  };

  const openNewNow = () =>
    openCreate({ start: new Date(), end: new Date(Date.now() + 30 * 60_000) });

  const events = useMemo(() => {
    return appointments.map((a) => {
      const titleParts = [a.child?.name ?? "Ребёнок", a.service?.name ?? "Услуга"];
      const color = a.service?.color ?? "#2f6f5e";
      return {
        id: a.id,
        title: titleParts.join(" · "),
        start: a.start_time,
        end: a.end_time,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { appointment: a },
      };
    });
  }, [appointments]);

  const timelineAppointments = useMemo(() => {
    const day = parseDateYYYYMMDD(timelineDate);
    if (!day) return [];
    const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const fromMs = day.getTime();
    const toMs = next.getTime();
    return appointments
      .filter((a) => {
        const startMs = new Date(a.start_time).getTime();
        const endMs = new Date(a.end_time).getTime();
        return startMs < toMs && endMs > fromMs;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [appointments, timelineDate]);

  useEffect(() => {
    if (viewMode === "timeline") {
      const day = parseDateYYYYMMDD(timelineDate);
      if (!day) return;
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      setRange({ startIso: day.toISOString(), endIso: next.toISOString() });
      return;
    }

    const api = calendarRef.current?.getApi();
    if (!api) return;
    setRange({ startIso: api.view.activeStart.toISOString(), endIso: api.view.activeEnd.toISOString() });
  }, [viewMode, timelineDate]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setRange({ startIso: arg.start.toISOString(), endIso: arg.end.toISOString() });
  };

  const handleSelect = (arg: DateSelectArg) => {
    openCreate({ start: arg.start, end: arg.end });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const a = (arg.event.extendedProps as { appointment?: AppointmentRow }).appointment;
    if (a) openEdit(a);
  };

  const handleEventDrop = async (arg: EventDropArg) => {
    const start = arg.event.start?.toISOString();
    const end = arg.event.end?.toISOString();
    if (!start || !end) return;
    try {
      await updateAppointment(arg.event.id, { start_time: start, end_time: end });
      await queryClient.invalidateQueries({ queryKey: ["business", "appointments"] });
    } catch (err: unknown) {
      arg.revert();
      setMessage(isConflictError(err) ? "Конфликт: специалист или ребёнок уже заняты." : "Не удалось перенести запись");
    }
  };

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const start = arg.event.start?.toISOString();
    const end = arg.event.end?.toISOString();
    if (!start || !end) return;
    try {
      await updateAppointment(arg.event.id, { start_time: start, end_time: end });
      await queryClient.invalidateQueries({ queryKey: ["business", "appointments"] });
    } catch (err: unknown) {
      arg.revert();
      setMessage(isConflictError(err) ? "Конфликт: специалист или ребёнок уже заняты." : "Не удалось изменить длительность");
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: AppointmentValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      setMessage(null);

      const start = parseLocalDateTimeInputValue(values.start_local);
      if (!start) throw new Error("Некорректная дата/время");
      const end = new Date(start.getTime() + values.duration_min * 60_000);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      if (editing) {
        await updateAppointment(editing.id, {
          child_id: values.child_id,
          specialist_id: values.specialist_id,
          service_id: values.service_id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: values.status,
          notes: values.notes ? values.notes : null,
        });
        return;
      }

      if (!values.recurring_enabled) {
        await insertAppointmentRows([
          {
            child_id: values.child_id,
            specialist_id: values.specialist_id,
            service_id: values.service_id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: values.status,
            notes: values.notes ? values.notes : null,
            is_recurring: false,
            recurrence_group_id: null,
            created_by: userId,
          },
        ]);
        return;
      }

      const untilDay = values.recurring_until ? parseDateYYYYMMDD(values.recurring_until) : null;
      if (!untilDay) throw new Error("Укажите дату окончания");

      const groupId = crypto.randomUUID();
      const occStarts = buildOccurrences({ start, until: untilDay, weekdays: values.recurring_weekdays });

      const failed: Date[] = [];

      for (const occStart of occStarts) {
        const occEnd = new Date(occStart.getTime() + values.duration_min * 60_000);
        try {
          await insertAppointmentRows([
            {
              child_id: values.child_id,
              specialist_id: values.specialist_id,
              service_id: values.service_id,
              start_time: occStart.toISOString(),
              end_time: occEnd.toISOString(),
              status: values.status,
              notes: values.notes ? values.notes : null,
              is_recurring: true,
              recurrence_group_id: groupId,
              created_by: userId,
            },
          ]);
        } catch (err: unknown) {
          if (isConflictError(err)) {
            failed.push(occStart);
            continue;
          }
          throw err;
        }
      }

      if (failed.length > 0) {
        const first = failed[0]!;
        throw new Error(
          `Серия создана частично. Есть конфликты, например: ${formatDateLongRu(first.toISOString())} ${formatTimeRu(first.toISOString())}`,
        );
      }
    },
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["business", "appointments"] });
    },
    onError: (err: unknown) => {
      if (isConflictError(err)) {
        setMessage("Конфликт: специалист или ребёнок уже заняты в это время.");
        return;
      }
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить запись");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await deleteAppointment(editing.id);
    },
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["business", "appointments"] });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить запись");
    },
  });

  const watchedChildId = form.watch("child_id");
  const watchedServiceId = form.watch("service_id");
  const watchedStartLocal = form.watch("start_local");

  const reminderText = (() => {
    const start = parseLocalDateTimeInputValue(watchedStartLocal);
    if (!start) return null;
    const childName = children.find((c) => c.id === watchedChildId)?.name ?? "Ребёнок";
    const serviceName = services.find((s) => s.id === watchedServiceId)?.name ?? "Услуга";
    return buildReminderText({ childName, serviceName, startIso: start.toISOString() });
  })();

  const copyReminder = async () => {
    if (!reminderText) return;
    try {
      await navigator.clipboard.writeText(reminderText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setMessage("Не удалось скопировать текст");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-muted-foreground" />
            <h1 className="truncate text-lg font-semibold leading-tight">Календарь</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Запись на занятия, переносы, статусы и напоминания.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-10">
              <TabsTrigger value="calendar" className="h-9 px-3">
                Календарь
              </TabsTrigger>
              <TabsTrigger value="timeline" className="h-9 px-3">
                Таймлайн
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" className="h-10" onClick={refresh} disabled={!canRender}>
              <RefreshCcw className="size-4" />
              Обновить
            </Button>
            <Button type="button" className="h-10" disabled={!canRender || !hasPrerequisites} onClick={openNewNow}>
              <Plus className="size-4" />
              Новая запись
            </Button>
          </div>
        </div>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо-режим</AlertTitle>
          <AlertDescription>
            Настройте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`, чтобы включить календарь.
          </AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <div className="rounded-lg border bg-card p-3 text-sm text-destructive">{message}</div>
      ) : null}

      {supabase && !hasPrerequisites ? (
        <Alert>
          <AlertTitle>Нужно заполнить справочники</AlertTitle>
          <AlertDescription>
            Для записи на занятия добавьте хотя бы 1 услугу, 1 ребёнка и 1 специалиста.
          </AlertDescription>
        </Alert>
      ) : null}

      {viewMode === "calendar" ? (
        <>
          <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Вид</div>
              <Select
                value={calendarView}
                onValueChange={(v) => {
                  setCalendarView(v as typeof calendarView);
                  calendarRef.current?.getApi().changeView(v);
                }}
              >
                <SelectTrigger className="h-10 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timeGridDay">День</SelectItem>
                  <SelectItem value="timeGridWeek">Неделя</SelectItem>
                  <SelectItem value="dayGridMonth">Месяц</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Перетаскивайте записи и тяните за край для изменения длительности.
            </div>
          </div>

          <div className={cn("rounded-xl border bg-background", !canRender && "opacity-60")}>
            {canRender ? (
              <FullCalendar
                ref={(ref) => {
                  calendarRef.current = ref;
                }}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={calendarView}
                datesSet={handleDatesSet}
                locale={ruLocale}
                firstDay={1}
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="20:00:00"
                nowIndicator
                selectable
                selectMirror
                select={handleSelect}
                eventClick={handleEventClick}
                editable
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                events={events}
                height="auto"
                headerToolbar={false}
                dayHeaderFormat={{ weekday: "short", day: "2-digit", month: "2-digit" }}
                slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                eventClassNames={(arg) => {
                  const a = (arg.event.extendedProps as { appointment?: AppointmentRow }).appointment;
                  return [statusClassName(a?.status ?? "pending")];
                }}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Supabase не настроен.</div>
            )}
          </div>
        </CardContent>
          </Card>

          <Card className="md:hidden">
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Список (сегодня)</div>
          <div className="grid gap-2">
            {appointments
              .filter((a) => {
                const startMs = new Date(a.start_time).getTime();
                const endMs = new Date(a.end_time).getTime();
                return startMs < endOfTodayLocal().getTime() && endMs > startOfTodayLocal().getTime();
              })
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border bg-card p-3 text-left outline-none",
                    "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  onClick={() => openEdit(a)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {(a.child?.name ?? "Ребёнок") + " · " + (a.service?.name ?? "Услуга")}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatTimeRu(a.start_time)}–{formatTimeRu(a.end_time)} ·{" "}
                        {a.specialist?.full_name || a.specialist?.email || "Специалист"}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(a.status)}>{appointmentStatusLabel(a.status)}</Badge>
                  </div>
                </button>
              ))}
            {appointments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет записей.</div>
            ) : null}
          </div>
        </CardContent>
          </Card>
        </>
      ) : null}

      {viewMode === "timeline" ? (
        <Card>
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <div className="text-sm font-semibold">Таймлайн по специалистам</div>
                <div className="text-xs text-muted-foreground">
                  Группировка записей по специалистам на выбранный день.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-10 w-[170px]"
                  type="date"
                  value={timelineDate}
                  onChange={(e) => setTimelineDate(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10"
                  onClick={() => setTimelineDate(new Date().toISOString().slice(0, 10))}
                >
                  Сегодня
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3">
              {therapists.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет специалистов.</div>
              ) : (
                therapists.map((t) => {
                  const rows = timelineAppointments.filter((a) => a.specialist_id === t.id);
                  return (
                    <div key={t.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{t.full_name || "Без имени"}</div>
                          <div className="truncate text-xs text-muted-foreground">{t.email}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{rows.length} записей</div>
                      </div>

                      {rows.length === 0 ? (
                        <div className="mt-2 text-sm text-muted-foreground">На этот день записей нет.</div>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {rows.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={cn(
                                "w-full rounded-lg border bg-background p-3 text-left outline-none",
                                "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              )}
                              onClick={() => openEdit(a)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">
                                    {(a.child?.name ?? "Ребёнок") + " · " + (a.service?.name ?? "Услуга")}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {formatTimeRu(a.start_time)}–{formatTimeRu(a.end_time)}
                                  </div>
                                </div>
                                <Badge variant={statusBadgeVariant(a.status)}>{appointmentStatusLabel(a.status)}</Badge>
                              </div>
                              {a.notes ? (
                                <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.notes}</div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Drawer open={drawerOpen} onOpenChange={(v) => (v ? setDrawerOpen(true) : closeDrawer())}>
        <DrawerContent className="mx-auto w-full max-w-xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">{editing ? "Запись на занятие" : "Новая запись"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {message ? (
              <div className="mb-3 rounded-lg border bg-card p-3 text-sm text-destructive">{message}</div>
            ) : null}

            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit((values) => upsertMutation.mutate(values))}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="child_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ребёнок</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (!editing) {
                              form.setValue("duration_min", pickInitialDuration(services, v), { shouldValidate: true });
                            }
                          }}
                          disabled={!supabase}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Выберите ребёнка" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {children.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialist_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Специалист</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!supabase}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Выберите специалиста" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {therapists.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {(t.full_name || "Без имени") + (t.email ? ` · ${t.email}` : "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="service_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Услуга</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!supabase}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Выберите услугу" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Статус</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!supabase}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_local"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Начало</FormLabel>
                        <FormControl>
                          <Input className="h-11" type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Длительность (мин)</FormLabel>
                        <FormControl>
                          <Input className="h-11" type="number" inputMode="numeric" min={5} step={5} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!editing ? (
                  <div className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Повторять</div>
                        <div className="text-xs text-muted-foreground">
                          Например, вт/чт на 3 месяца.
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name="recurring_enabled"
                        render={({ field }) => (
                          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        )}
                      />
                    </div>

                    {form.watch("recurring_enabled") ? (
                      <div className="mt-3 grid gap-3">
                        <FormField
                          control={form.control}
                          name="recurring_weekdays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Дни недели</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {weekdayOptions.map((d) => {
                                  const checked = field.value.includes(d.value);
                                  return (
                                    <Button
                                      key={d.value}
                                      type="button"
                                      variant={checked ? "default" : "secondary"}
                                      className="h-10 px-3"
                                      onClick={() => {
                                        const next = checked
                                          ? field.value.filter((v) => v !== d.value)
                                          : [...field.value, d.value];
                                        field.onChange(next);
                                      }}
                                    >
                                      {d.label}
                                    </Button>
                                  );
                                })}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="recurring_until"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>До</FormLabel>
                              <FormControl>
                                <Input className="h-11" type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комментарий (опционально)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Например: первый визит, просьба позвонить заранее…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {reminderText ? (
                  <div className="grid gap-2 rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Текст напоминания</div>
                      <Button type="button" variant="secondary" className="h-10" onClick={copyReminder}>
                        {copied ? <CopyCheck className="size-4" /> : <ClipboardCopy className="size-4" />}
                        {copied ? "Скопировано" : "Копировать"}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">{reminderText}</div>
                  </div>
                ) : null}

                <Separator />

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {editing ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-11"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending || upsertMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="secondary" className="h-11" onClick={closeDrawer}>
                      Отмена
                    </Button>
                    <Button type="submit" className="h-11" disabled={upsertMutation.isPending}>
                      Сохранить
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
