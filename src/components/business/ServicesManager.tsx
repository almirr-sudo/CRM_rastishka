"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Plus, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Service } from "@/types/models";

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120),
  duration_min: z.coerce.number().int().min(5, "Минимум 5 минут").max(600, "Слишком долго"),
  price: z.coerce.number().min(0, "Цена не может быть отрицательной").max(1000000),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #RRGGBB"),
});

type ServiceFormValues = z.input<typeof serviceSchema>;
type ServiceValues = z.output<typeof serviceSchema>;

async function fetchServices(): Promise<Service[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Service[];
}

async function upsertService(values: ServiceValues & { id?: string }): Promise<void> {
  if (!supabase) throw new Error("Supabase не настроен");
  const payload = {
    id: values.id,
    name: values.name,
    duration_min: values.duration_min,
    price: values.price,
    color: values.color,
  };
  if (values.id) {
    const { error } = await supabase.from("services").update(payload).eq("id", values.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("services").insert(payload);
  if (error) throw error;
}

async function deleteService(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase не настроен");
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

function moneyRu(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

export function ServicesManager() {
  const queryClient = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["business", "services"],
    queryFn: fetchServices,
    enabled: Boolean(supabase),
  });

  const services = servicesQuery.data ?? [];

  const form = useForm<ServiceFormValues, unknown, ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      duration_min: 30,
      price: 0,
      color: "#2f6f5e",
    },
  });

  const title = useMemo(() => (editing ? "Редактирование услуги" : "Новая услуга"), [editing]);

  const openCreate = () => {
    setEditing(null);
    setMessage(null);
    form.reset({ name: "", duration_min: 30, price: 0, color: "#2f6f5e" });
    setDrawerOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setMessage(null);
    form.reset({
      name: s.name,
      duration_min: s.duration_min,
      price: s.price,
      color: s.color,
    });
    setDrawerOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: ServiceValues) => {
      setMessage(null);
      await upsertService({ ...values, id: editing?.id });
    },
    onSuccess: async () => {
      setDrawerOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["business", "services"] });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить услугу");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteService(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["business", "services"] });
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Услуги</h1>
          <p className="text-sm text-muted-foreground">
            Каталог услуг центра: длительность, цена и цвет для календаря.
          </p>
        </div>
        <Button type="button" className="h-11" onClick={openCreate} disabled={!supabase}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Нет подключения к Supabase</AlertTitle>
          <AlertDescription>Настройте переменные окружения и миграции, чтобы управлять услугами.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Список</div>
          <Separator />

          {services.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {servicesQuery.isLoading ? "Загрузка…" : "Пока нет услуг"}
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:hidden">
                {services.map((s) => (
                  <div key={s.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <div className="truncate text-sm font-semibold">{s.name}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.duration_min} мин · {moneyRu(s.price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" className="h-10" onClick={() => openEdit(s)}>
                          Редактировать
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-10"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            const ok = window.confirm(`Удалить услугу “${s.name}”?`);
                            if (ok) deleteMutation.mutate(s.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Длительность</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Цвет</TableHead>
                      <TableHead className="w-[220px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.duration_min} мин</TableCell>
                        <TableCell className="text-muted-foreground">{moneyRu(s.price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-xs text-muted-foreground">{s.color}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" className="h-9" onClick={() => openEdit(s)}>
                              Редактировать
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                const ok = window.confirm(`Удалить услугу “${s.name}”?`);
                                if (ok) deleteMutation.mutate(s.id);
                              }}
                              aria-label="Удалить"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="mx-auto w-full max-w-xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {message ? (
              <div className="mb-3 rounded-lg border bg-card p-3 text-sm text-destructive">
                {message}
              </div>
            ) : null}

            <Form {...form}>
              <form
                className="grid gap-4"
                onSubmit={form.handleSubmit((values) => upsertMutation.mutate(values))}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="Например: Логопед (30 мин)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="duration_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Длительность (мин)</FormLabel>
                        <FormControl>
                          <Input
                            className="h-11"
                            type="number"
                            inputMode="numeric"
                            min={5}
                            step={5}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={
                              typeof field.value === "number"
                                ? field.value
                                : Number.isFinite(Number(field.value))
                                  ? Number(field.value)
                                  : 0
                            }
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Цена</FormLabel>
                        <FormControl>
                          <Input
                            className="h-11"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={50}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={
                              typeof field.value === "number"
                                ? field.value
                                : Number.isFinite(Number(field.value))
                                  ? Number(field.value)
                                  : 0
                            }
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Цвет</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Input
                              className={cn("h-11 w-16 p-1", "bg-transparent")}
                              type="color"
                              aria-label="Цвет услуги"
                              {...field}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Palette className="size-4" />
                            {field.value}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11"
                    onClick={() => setDrawerOpen(false)}
                    disabled={upsertMutation.isPending}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="h-11" disabled={upsertMutation.isPending}>
                    <Save className="size-4" />
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
