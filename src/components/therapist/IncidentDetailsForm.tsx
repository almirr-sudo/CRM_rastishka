"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save, Siren } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import type { BehaviorIncident, Child } from "@/types/models";

type IncidentRow = BehaviorIncident & { child?: Pick<Child, "name"> | null };

const incidentSchema = z.object({
  antecedent: z.string().max(5000).optional(),
  behavior: z.string().max(5000).optional(),
  consequence: z.string().max(5000).optional(),
  intensity: z.string().regex(/^(10|[1-9])$/, "Выберите интенсивность 1–10"),
});

type IncidentFormValues = z.infer<typeof incidentSchema>;

function dateTimeRu(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function fetchIncident(incidentId: string): Promise<IncidentRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("behavior_incidents")
    .select("*, child:children(name)")
    .eq("id", incidentId)
    .single();
  if (error) throw error;
  return (data ?? null) as IncidentRow | null;
}

function IncidentFormInner({ incident }: { incident: IncidentRow }) {
  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      antecedent: incident.antecedent ?? "",
      behavior: incident.behavior ?? "",
      consequence: incident.consequence ?? "",
      intensity: String(incident.intensity ?? 5),
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: IncidentFormValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase
        .from("behavior_incidents")
        .update({
          antecedent: values.antecedent ? values.antecedent : null,
          behavior: values.behavior ? values.behavior : null,
          consequence: values.consequence ? values.consequence : null,
          intensity: Number(values.intensity),
        })
        .eq("id", incident.id);
      if (error) throw error;
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Siren className="size-5 text-destructive" />
            <h1 className="truncate text-xl font-semibold">Инцидент (ABC)</h1>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {incident.child?.name ? `${incident.child.name} · ` : ""}
            {dateTimeRu(incident.timestamp)}
          </div>
        </div>
        <Button asChild variant="secondary" className="h-10">
          <Link href="/app/therapist/incidents">
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="text-sm font-semibold">Детали по схеме ABC</div>
          <Separator />

          <Form {...form}>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
              <FormField
                control={form.control}
                name="intensity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Интенсивность (1–10)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 10 }).map((_, idx) => (
                          <SelectItem key={idx + 1} value={String(idx + 1)}>
                            {idx + 1}
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
                name="antecedent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Предпосылка — что было ДО</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Что произошло перед поведением?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="behavior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Поведение — что сделал ребёнок</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Опишите поведение максимально конкретно" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consequence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Последствие — что было ПОСЛЕ</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Как отреагировали взрослые/окружение?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="h-11" disabled={saveMutation.isPending}>
                <Save className="size-4" />
                Сохранить
              </Button>

              {saveMutation.isSuccess ? (
                <div className="text-sm text-muted-foreground">Сохранено</div>
              ) : null}
              {saveMutation.isError ? (
                <div className="text-sm text-destructive">Не удалось сохранить</div>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export function IncidentDetailsForm({ incidentId }: { incidentId: string }) {
  const incidentQuery = useQuery({
    queryKey: ["therapist", "incident", incidentId],
    queryFn: () => fetchIncident(incidentId),
    enabled: Boolean(supabase) && Boolean(incidentId),
  });

  if (!supabase) {
    return (
      <Alert>
        <AlertTitle>Демо‑режим</AlertTitle>
        <AlertDescription>Настройте Supabase, чтобы редактировать инциденты.</AlertDescription>
      </Alert>
    );
  }

  if (incidentQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  }

  if (incidentQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить инцидент</AlertDescription>
      </Alert>
    );
  }

  const incident = incidentQuery.data;
  if (!incident) {
    return (
      <Alert>
        <AlertTitle>Не найдено</AlertTitle>
        <AlertDescription>Инцидент не найден или нет доступа.</AlertDescription>
      </Alert>
    );
  }

  return <IncidentFormInner key={incident.id} incident={incident} />;
}
