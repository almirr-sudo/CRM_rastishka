"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import type { Child, Profile } from "@/types/models";

type Therapist = Pick<Profile, "id" | "full_name" | "email">;

async function fetchChildrenLite(): Promise<Pick<Child, "id" | "name">[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("children")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Pick<Child, "id" | "name">>;
}

async function fetchTherapists(): Promise<Therapist[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "therapist")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Therapist[];
}

async function fetchAssignments(childId: string): Promise<{ id: string; therapist_id: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("therapist_children")
    .select("id,therapist_id")
    .eq("child_id", childId);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; therapist_id: string }>;
}

export function AdminAssignments() {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const childrenQuery = useQuery({
    queryKey: ["admin", "children-lite"],
    queryFn: fetchChildrenLite,
    enabled: Boolean(supabase),
  });

  const therapistsQuery = useQuery({
    queryKey: ["admin", "therapists"],
    queryFn: fetchTherapists,
    enabled: Boolean(supabase),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["admin", "assignments", selectedChildId],
    queryFn: () => fetchAssignments(selectedChildId),
    enabled: Boolean(supabase) && Boolean(selectedChildId),
  });

  const assignedSet = useMemo(() => {
    return new Set((assignmentsQuery.data ?? []).map((a) => a.therapist_id));
  }, [assignmentsQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: async ({
      childId,
      therapistId,
      next,
    }: {
      childId: string;
      therapistId: string;
      next: boolean;
    }) => {
      if (!supabase) throw new Error("Supabase не настроен");
      if (next) {
        const { error } = await supabase
          .from("therapist_children")
          .insert({ child_id: childId, therapist_id: therapistId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("therapist_children")
          .delete()
          .eq("child_id", childId)
          .eq("therapist_id", therapistId);
        if (error) throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "assignments", selectedChildId] }),
  });

  const children = childrenQuery.data ?? [];
  const therapists = therapistsQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Назначения</h1>
        <p className="text-sm text-muted-foreground">
          Привязка детей к терапевтам/педагогам.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>Настройте Supabase, чтобы управлять назначениями.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UsersRound className="size-4 text-muted-foreground" />
            Выберите ребёнка
          </div>

          <Select value={selectedChildId} onValueChange={setSelectedChildId} disabled={!supabase}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Ребёнок не выбран" />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedChildId ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4 text-muted-foreground" />
                Терапевты
              </div>
              <div className="grid gap-2">
                {therapists.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {therapistsQuery.isLoading ? "Загрузка…" : "Нет терапевтов"}
                  </div>
                ) : (
                  therapists.map((t) => {
                    const checked = assignedSet.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {t.full_name || "—"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{t.email}</div>
                        </div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            toggleMutation.mutate({
                              childId: selectedChildId,
                              therapistId: t.id,
                              next: Boolean(v),
                            })
                          }
                          disabled={!supabase || toggleMutation.isPending}
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Выберите ребёнка, чтобы назначить терапевтов.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

