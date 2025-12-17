"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { Child, SkillGoal } from "@/types/models";

const EMPTY_CHILDREN: Array<Pick<Child, "id" | "name">> = [];

const goalSchema = z.object({
  child_id: z.string().uuid("Выберите ребёнка"),
  goal_title: z.string().min(2, "Введите цель").max(200),
  target_date: z.string().optional(),
});

type GoalValues = z.infer<typeof goalSchema>;

function statusLabel(status: SkillGoal["status"]) {
  return status === "mastered" ? "Освоено" : "В процессе";
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

async function fetchGoals(childId: string): Promise<SkillGoal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("skill_goals")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SkillGoal[];
}

export function GoalsManager() {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["therapist", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const children = childrenQuery.data ?? EMPTY_CHILDREN;
  const effectiveChildId = selectedChildId || children[0]?.id || "";
  const selectedChild = useMemo(
    () => children.find((c) => c.id === effectiveChildId) ?? null,
    [children, effectiveChildId],
  );

  const goalsQuery = useQuery({
    queryKey: ["therapist", "goals", effectiveChildId],
    queryFn: () => fetchGoals(effectiveChildId),
    enabled: Boolean(supabase) && Boolean(effectiveChildId),
  });

  const goals = goalsQuery.data ?? [];

  const form = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      child_id: effectiveChildId || "",
      goal_title: "",
      target_date: "",
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (values: GoalValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      setMessage(null);

      const payload = {
        child_id: values.child_id,
        goal_title: values.goal_title,
        status: "in_progress" as const,
        target_date: values.target_date ? values.target_date : null,
      };

      const { error } = await supabase.from("skill_goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("Цель добавлена");
      form.reset({ child_id: effectiveChildId || "", goal_title: "", target_date: "" });
      queryClient.invalidateQueries({ queryKey: ["therapist", "goals", effectiveChildId] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    },
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Цели и навыки</h1>
        <p className="text-sm text-muted-foreground">
          План (IEP) и трекинг попыток: уровень подсказки и успешность.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>Настройте Supabase, чтобы вести цели и трекинг.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-muted-foreground" />
            Ребёнок
          </div>
          <Separator />
          <Select
            value={effectiveChildId}
            onValueChange={setSelectedChildId}
            disabled={!supabase || children.length === 0}
          >
            <SelectTrigger className="h-11">
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
          {children.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {childrenQuery.isLoading ? "Загрузка…" : "Нет назначенных детей"}
            </div>
          ) : null}
          {selectedChild ? (
            <div className="text-xs text-muted-foreground">Текущий: {selectedChild.name}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="size-4 text-muted-foreground" />
            Добавить цель
          </div>
          <Separator />

          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

          <Form {...form}>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={form.handleSubmit((values) => createGoalMutation.mutate(values))}
            >
              <FormField
                control={form.control}
                name="child_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ребёнок</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!supabase || children.length === 0}
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
                name="target_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевая дата (опционально)</FormLabel>
                    <FormControl>
                      <Input className="h-11" type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="goal_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название цели</FormLabel>
                      <FormControl>
                        <Input
                          className="h-11"
                          placeholder="Например: надевать обувь самостоятельно"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="h-11"
                  disabled={!supabase || createGoalMutation.isPending}
                >
                  <Plus className="size-4" />
                  Добавить
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Список целей</div>
          <Separator />

          {!effectiveChildId ? (
            <div className="text-sm text-muted-foreground">Выберите ребёнка</div>
          ) : goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {goalsQuery.isLoading ? "Загрузка…" : "Пока нет целей"}
            </div>
          ) : (
            <div className="grid gap-2">
              {goals.map((g) => (
                <div
                  key={g.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{g.goal_title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={g.status === "mastered" ? "secondary" : "outline"}>
                        {statusLabel(g.status)}
                      </Badge>
                      {g.target_date ? (
                        <span className="text-xs text-muted-foreground">
                          До: {g.target_date}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild variant="secondary" className="h-9 shrink-0">
                    <Link href={`/app/therapist/goals/${g.id}`}>
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
