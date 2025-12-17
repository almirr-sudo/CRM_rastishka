"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Child, Transaction, TransactionType } from "@/types/models";

type ChildLite = Pick<Child, "id" | "name">;

type AppointmentLite = {
  id: string;
  start_time: string;
  service?: { name: string } | null;
  specialist?: { full_name: string | null; email: string } | null;
} | null;

type TransactionRow = Omit<Transaction, "amount"> & {
  amount: number;
  appointment?: AppointmentLite;
};

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function moneyRu(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function dateTimeRu(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function paymentMethodLabel(v: "cash" | "card" | "transfer") {
  if (v === "cash") return "Наличные";
  if (v === "card") return "Карта";
  return "Перевод";
}

function typeLabel(t: TransactionType) {
  return t === "charge" ? "Начисление" : "Платёж";
}

function typeBadgeVariant(t: TransactionType) {
  return t === "charge" ? ("outline" as const) : ("secondary" as const);
}

function normalizeOne<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (typeof raw === "object") return raw as T;
  return null;
}

function normalizeAppointment(raw: unknown): AppointmentLite {
  const a = normalizeOne<{ id: unknown; start_time: unknown; service?: unknown; specialist?: unknown }>(raw);
  if (!a) return null;

  const id = typeof a.id === "string" ? a.id : "";
  const start_time = typeof a.start_time === "string" ? a.start_time : "";
  if (!id || !start_time) return null;

  const service = normalizeOne<{ name: unknown }>(a.service);
  const specialist = normalizeOne<{ full_name: unknown; email: unknown }>(a.specialist);

  return {
    id,
    start_time,
    service: service && typeof service.name === "string" ? { name: service.name } : null,
    specialist:
      specialist && typeof specialist.email === "string"
        ? {
            full_name: typeof specialist.full_name === "string" ? specialist.full_name : null,
            email: specialist.email,
          }
        : null,
  };
}

async function fetchChildrenLite(): Promise<ChildLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("children").select("id,name").order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ChildLite[]).filter((c) => c.id);
}

async function fetchChildTransactions(childId: string): Promise<TransactionRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*, appointment:appointments(id,start_time,service:services(name),specialist:profiles(full_name,email))")
    .eq("child_id", childId)
    .order("date", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => {
    return {
      ...(r as unknown as Transaction),
      amount: toNumber(r.amount),
      appointment: normalizeAppointment(r.appointment),
    };
  });
}

async function fetchIncome(fromIso: string, toIso: string): Promise<TransactionRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*, appointment:appointments(id,start_time,service:services(name),specialist:profiles(full_name,email))")
    .eq("type", "charge")
    .gte("date", fromIso)
    .lt("date", toIso)
    .order("date", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => {
    return {
      ...(r as unknown as Transaction),
      amount: toNumber(r.amount),
      appointment: normalizeAppointment(r.appointment),
    };
  });
}

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "Введите сумму").max(1_000_000),
  date: z.string().min(1, "Укажите дату"),
  method: z.enum(["cash", "card", "transfer"]),
  description: z.string().max(2000).optional().or(z.literal("")),
});

type PaymentValues = z.infer<typeof paymentSchema>;

function firstDayIso(daysBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString();
}

export function FinanceManager() {
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const childFromUrl = searchParams.get("child");

  const [childId, setChildId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [incomeView, setIncomeView] = useState<"specialists" | "services">("specialists");
  const [fromIso, setFromIso] = useState(() => firstDayIso(30));
  const [toIso, setToIso] = useState(() => new Date().toISOString());

  const childrenQuery = useQuery({
    queryKey: ["business", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const children = childrenQuery.data ?? [];
  const childFromUrlValid =
    childFromUrl && children.some((c) => c.id === childFromUrl) ? childFromUrl : "";
  const effectiveChildId = childId || childFromUrlValid || children[0]?.id || "";

  const transactionsQuery = useQuery({
    queryKey: ["business", "transactions", effectiveChildId],
    queryFn: () => fetchChildTransactions(effectiveChildId),
    enabled: Boolean(supabase) && Boolean(effectiveChildId),
  });

  const incomeQuery = useQuery({
    queryKey: ["business", "income", fromIso, toIso],
    queryFn: () => fetchIncome(fromIso, toIso),
    enabled: Boolean(supabase),
  });

  const transactions = transactionsQuery.data ?? [];

  const totals = useMemo(() => {
    let charges = 0;
    let payments = 0;
    for (const t of transactions) {
      if (t.type === "charge") charges += t.amount;
      else payments += t.amount;
    }
    const balance = payments - charges;
    return { charges, payments, balance };
  }, [transactions]);

  const incomeData = useMemo(() => {
    const rows = incomeQuery.data ?? [];
    const map = new Map<string, number>();
    rows.forEach((t) => {
      const serviceName = t.appointment?.service?.name ?? "Без услуги";
      const specialistName =
        t.appointment?.specialist?.full_name || t.appointment?.specialist?.email || "Без специалиста";

      const key = incomeView === "services" ? serviceName : specialistName;
      map.set(key, (map.get(key) ?? 0) + t.amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [incomeQuery.data, incomeView]);

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      method: "card",
      description: "",
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (values: PaymentValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      if (!effectiveChildId) throw new Error("Выберите ребёнка");

      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      const dateIso = new Date(values.date + "T12:00:00").toISOString();
      const methodText = paymentMethodLabel(values.method);
      const desc = values.description?.trim();
      const description = desc ? `${methodText} · ${desc}` : methodText;

      const { error } = await supabase.from("transactions").insert({
        child_id: effectiveChildId,
        appointment_id: null,
        amount: values.amount,
        type: "payment",
        date: dateIso,
        description,
        created_by: userId,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setDrawerOpen(false);
      paymentForm.reset({
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        method: "card",
        description: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["business", "transactions", effectiveChildId] });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Не удалось добавить платёж");
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase.from("transactions").delete().eq("id", id).eq("type", "payment");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business", "transactions", effectiveChildId] }),
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <h1 className="truncate text-lg font-semibold leading-tight">Финансы</h1>
          </div>
          <p className="text-sm text-muted-foreground">Баланс, начисления и платежи.</p>
        </div>

        <Button type="button" className="h-10" onClick={() => setDrawerOpen(true)} disabled={!supabase || !effectiveChildId}>
          <Plus className="size-4" />
          Добавить платёж
        </Button>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо-режим</AlertTitle>
          <AlertDescription>
            Настройте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`, чтобы включить финансы.
          </AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <div className="rounded-lg border bg-card p-3 text-sm text-destructive">{message}</div>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="grid gap-2">
            <div className="text-sm font-semibold">Ребёнок</div>
            <Select value={effectiveChildId} onValueChange={setChildId} disabled={!supabase || children.length <= 1}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={childrenQuery.isLoading ? "Загрузка…" : "Выберите ребёнка"} />
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">Баланс</div>
              <div
                className={cn(
                  "mt-1 text-lg font-semibold",
                  totals.balance < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {moneyRu(totals.balance)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {totals.balance < 0 ? "Отрицательный = долг" : "Положительный = предоплата"}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">Начислено</div>
              <div className="mt-1 text-lg font-semibold">{moneyRu(totals.charges)}</div>
              <div className="mt-1 text-xs text-muted-foreground">По завершённым занятиям</div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">Оплачено</div>
              <div className="mt-1 text-lg font-semibold">{moneyRu(totals.payments)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Ручные платежи</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">Доход</div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={incomeView} onValueChange={(v) => setIncomeView(v as typeof incomeView)}>
                <SelectTrigger className="h-10 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specialists">По специалистам</SelectItem>
                  <SelectItem value="services">По услугам</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                className="h-10"
                onClick={() => {
                  setFromIso(firstDayIso(30));
                  setToIso(new Date().toISOString());
                }}
              >
                30 дней
              </Button>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => moneyRu(Number(v))} />
                <Bar dataKey="value" fill="#2f6f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground">
            Отчёт строится по начислениям (тип `charge`) за выбранный период.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Операции</div>

          <div className="grid gap-2 md:hidden">
            {transactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {transactionsQuery.isLoading ? "Загрузка…" : "Пока нет операций"}
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={typeBadgeVariant(t.type)}>{typeLabel(t.type)}</Badge>
                        <div className={cn("text-sm font-semibold", t.type === "charge" && "text-destructive")}>
                          {t.type === "charge" ? "-" : "+"}{moneyRu(t.amount)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{dateTimeRu(t.date)}</div>
                      {t.appointment?.service?.name ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.appointment.service.name}
                          {t.appointment.specialist?.full_name || t.appointment.specialist?.email
                            ? ` · ${t.appointment.specialist?.full_name || t.appointment.specialist?.email}`
                            : ""}
                        </div>
                      ) : null}
                      {t.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                      ) : null}
                    </div>

                    {t.type === "payment" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => deletePaymentMutation.mutate(t.id)}
                        disabled={deletePaymentMutation.isPending}
                        aria-label="Удалить платёж"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Детали</TableHead>
                  <TableHead className="w-[64px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {transactionsQuery.isLoading ? "Загрузка…" : "Пока нет операций"}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{dateTimeRu(t.date)}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant(t.type)}>{typeLabel(t.type)}</Badge>
                      </TableCell>
                      <TableCell className={cn("font-semibold", t.type === "charge" && "text-destructive")}>
                        {t.type === "charge" ? "-" : "+"}{moneyRu(t.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.appointment?.service?.name ? (
                          <div className="truncate">
                            {t.appointment.service.name}
                            {t.appointment.specialist?.full_name || t.appointment.specialist?.email
                              ? ` · ${t.appointment.specialist?.full_name || t.appointment.specialist?.email}`
                              : ""}
                          </div>
                        ) : t.description ? (
                          <div className="truncate">{t.description}</div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {t.type === "payment" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => deletePaymentMutation.mutate(t.id)}
                            disabled={deletePaymentMutation.isPending}
                            aria-label="Удалить платёж"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="mx-auto w-full max-w-xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">Добавить платёж</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Form {...paymentForm}>
              <form className="grid gap-4" onSubmit={paymentForm.handleSubmit((v) => addPaymentMutation.mutate(v))}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={paymentForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сумма</FormLabel>
                        <FormControl>
                          <Input className="h-11" type="number" inputMode="decimal" min={0} step={50} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={paymentForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата</FormLabel>
                        <FormControl>
                          <Input className="h-11" type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={paymentForm.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Способ</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Наличные</SelectItem>
                          <SelectItem value="card">Карта</SelectItem>
                          <SelectItem value="transfer">Перевод</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комментарий (опционально)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Например: чек №123, оплата за декабрь…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="secondary" className="h-11" onClick={() => setDrawerOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" className="h-11" disabled={addPaymentMutation.isPending}>
                    Сохранить
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
