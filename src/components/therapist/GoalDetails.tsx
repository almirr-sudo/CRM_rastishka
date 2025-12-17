"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plus, RefreshCcw, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";
import type { Child, PromptLevel, SkillGoal, SkillTracking } from "@/types/models";

type GoalRow = SkillGoal & { child?: Pick<Child, "name"> | null };
const EMPTY_TRACKING: SkillTracking[] = [];

const trackingSchema = z.object({
  date: z.string().min(1, "Выберите дату"),
  prompt_level: z.enum(["independent", "verbal", "gestural", "physical"]),
  success: z.boolean(),
});

type TrackingValues = z.infer<typeof trackingSchema>;

function promptLabel(p: PromptLevel) {
  switch (p) {
    case "independent":
      return "Самостоятельно";
    case "verbal":
      return "Вербальная подсказка";
    case "gestural":
      return "Жестовая подсказка";
    case "physical":
      return "Физическая подсказка";
    default:
      return p;
  }
}

function statusLabel(status: SkillGoal["status"]) {
  return status === "mastered" ? "Освоено" : "В процессе";
}

async function fetchGoal(goalId: string): Promise<GoalRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("skill_goals")
    .select("*, child:children(name)")
    .eq("id", goalId)
    .single();
  if (error) throw error;
  return (data ?? null) as GoalRow | null;
}

async function fetchTracking(goalId: string): Promise<SkillTracking[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("skill_tracking")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SkillTracking[];
}

export function GoalDetails({ goalId }: { goalId: string }) {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [message, setMessage] = useState<string | null>(null);

  const goalQuery = useQuery({
    queryKey: ["therapist", "goal", goalId],
    queryFn: () => fetchGoal(goalId),
    enabled: Boolean(supabase) && Boolean(goalId),
  });

  const trackingQuery = useQuery({
    queryKey: ["therapist", "tracking", goalId],
    queryFn: () => fetchTracking(goalId),
    enabled: Boolean(supabase) && Boolean(goalId),
  });

  const goal = goalQuery.data;
  const tracking = trackingQuery.data ?? EMPTY_TRACKING;

  const stats = useMemo(() => {
    const total = tracking.length;
    const independentSuccess = tracking.filter((t) => t.prompt_level === "independent" && t.success).length;
    const success = tracking.filter((t) => t.success).length;
    return { total, independentSuccess, success };
  }, [tracking]);

  const form = useForm<TrackingValues>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { date: today, prompt_level: "independent", success: true },
  });

  const addTrackingMutation = useMutation({
    mutationFn: async (values: TrackingValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      setMessage(null);
      const { error } = await supabase.from("skill_tracking").insert({
        goal_id: goalId,
        date: values.date,
        prompt_level: values.prompt_level,
        success: values.success,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("Запись добавлена");
      form.reset({ date: today, prompt_level: "independent", success: true });
      queryClient.invalidateQueries({ queryKey: ["therapist", "tracking", goalId] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: SkillGoal["status"]) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase.from("skill_goals").update({ status }).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["therapist", "goal", goalId] }),
  });

  if (!supabase) {
    return (
      <Alert>
        <AlertTitle>Демо‑режим</AlertTitle>
        <AlertDescription>Настройте Supabase, чтобы вести трекинг навыков.</AlertDescription>
      </Alert>
    );
  }

  if (goalQuery.isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  if (goalQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить цель</AlertDescription>
      </Alert>
    );
  }
  if (!goal) {
    return (
      <Alert>
        <AlertTitle>Не найдено</AlertTitle>
        <AlertDescription>Цель не найдена или нет доступа.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target className="size-5 text-muted-foreground" />
            <h1 className="truncate text-xl font-semibold">{goal.goal_title}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {goal.child?.name ? <span>Ребёнок: {goal.child.name}</span> : null}
            <Badge variant={goal.status === "mastered" ? "secondary" : "outline"}>
              {statusLabel(goal.status)}
            </Badge>
            {goal.target_date ? <span>До: {goal.target_date}</span> : null}
          </div>
        </div>

        <Button asChild variant="secondary" className="h-10">
          <Link href="/app/therapist/goals">
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Статистика (последние 50 попыток)</div>
          <Separator />
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Всего попыток</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Успешно</span>
              <span className="font-medium">{stats.success}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Самостоятельно (успех)</span>
              <span className="font-medium">{stats.independentSuccess}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {goal.status !== "mastered" ? (
              <Button
                type="button"
                className="h-10"
                onClick={() => updateStatusMutation.mutate("mastered")}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle2 className="size-4" />
                Отметить как «Освоено»
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="h-10"
                onClick={() => updateStatusMutation.mutate("in_progress")}
                disabled={updateStatusMutation.isPending}
              >
                <RefreshCcw className="size-4" />
                Вернуть в «В процессе»
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="size-4 text-muted-foreground" />
            Добавить попытку
          </div>
          <Separator />

          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

          <Form {...form}>
            <form className="grid gap-3" onSubmit={form.handleSubmit((v) => addTrackingMutation.mutate(v))}>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
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

                <FormField
                  control={form.control}
                  name="prompt_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Уровень подсказки</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="independent">{promptLabel("independent")}</SelectItem>
                          <SelectItem value="verbal">{promptLabel("verbal")}</SelectItem>
                          <SelectItem value="gestural">{promptLabel("gestural")}</SelectItem>
                          <SelectItem value="physical">{promptLabel("physical")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="success"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Результат</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <span className="text-sm">{field.value ? "Успешно" : "Не получилось"}</span>
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="h-11" disabled={addTrackingMutation.isPending}>
                <Plus className="size-4" />
                Добавить
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Последние попытки</div>
          <Separator />
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Подсказка</TableHead>
                  <TableHead>Успех</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      {trackingQuery.isLoading ? "Загрузка…" : "Нет данных"}
                    </TableCell>
                  </TableRow>
                ) : (
                  tracking.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.date}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {promptLabel(t.prompt_level)}
                      </TableCell>
                      <TableCell>{t.success ? "Да" : "Нет"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
