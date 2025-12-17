"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

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
import { supabase } from "@/lib/supabase/client";
import type { Child, Profile } from "@/types/models";

type Therapist = Pick<Profile, "id" | "full_name" | "email">;
type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  children: Array<{ child_id: string; child: Pick<Child, "name"> | null }>;
  staff: Array<{ therapist_id: string; therapist: Pick<Profile, "full_name" | "email"> | null }>;
};

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

async function fetchGroups(): Promise<GroupRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("groups")
    .select("id,name,description, group_children(child_id, child:children(name)), group_staff(therapist_id, therapist:profiles(full_name,email))")
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const childrenRaw = (r.group_children as Array<Record<string, unknown>> | null) ?? [];
    const staffRaw = (r.group_staff as Array<Record<string, unknown>> | null) ?? [];
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      description: r.description === null || r.description === undefined ? null : String(r.description),
      children: childrenRaw.map((c) => ({
        child_id: String(c.child_id),
        child: c.child
          ? {
              name: String((c.child as Record<string, unknown>).name ?? ""),
            }
          : null,
      })),
      staff: staffRaw.map((s) => ({
        therapist_id: String(s.therapist_id),
        therapist: s.therapist
          ? {
              full_name: String((s.therapist as Record<string, unknown>).full_name ?? ""),
              email: String((s.therapist as Record<string, unknown>).email ?? ""),
            }
          : null,
      })),
    } as GroupRow;
  });
}

async function createGroup(values: { name: string; description: string }) {
  if (!supabase) throw new Error("Supabase не настроен");
  const payload = { name: values.name.trim(), description: values.description.trim() || null };
  if (!payload.name) throw new Error("Введите название группы");
  const { error } = await supabase.from("groups").insert(payload);
  if (error) throw error;
}

async function toggleGroupChild(groupId: string, childId: string, add: boolean) {
  if (!supabase) throw new Error("Supabase не настроен");
  if (add) {
    const { error } = await supabase.from("group_children").upsert({ group_id: groupId, child_id: childId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("group_children").delete().eq("group_id", groupId).eq("child_id", childId);
    if (error) throw error;
  }
}

async function toggleGroupStaff(groupId: string, therapistId: string, add: boolean) {
  if (!supabase) throw new Error("Supabase не настроен");
  if (add) {
    const { error } = await supabase.from("group_staff").upsert({ group_id: groupId, therapist_id: therapistId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("group_staff").delete().eq("group_id", groupId).eq("therapist_id", therapistId);
    if (error) throw error;
  }
}

export function AdminAssignments() {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

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

  const groupsQuery = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: fetchGroups,
    enabled: Boolean(supabase),
  });

  const assignedSet = useMemo(() => {
    return new Set((assignmentsQuery.data ?? []).map((a) => a.therapist_id));
  }, [assignmentsQuery.data]);

  const createGroupMutation = useMutation({
    mutationFn: () => createGroup({ name: groupName, description: groupDescription }),
    onSuccess: async () => {
      setGroupName("");
      setGroupDescription("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
    },
  });

  const toggleGroupChildMutation = useMutation({
    mutationFn: ({ groupId, childId, add }: { groupId: string; childId: string; add: boolean }) =>
      toggleGroupChild(groupId, childId, add),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });

  const toggleGroupStaffMutation = useMutation({
    mutationFn: ({ groupId, therapistId, add }: { groupId: string; therapistId: string; add: boolean }) =>
      toggleGroupStaff(groupId, therapistId, add),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });

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
          Привязка детей к терапевтам/педагогам и группам.
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
            Группы
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Название группы"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={!supabase || createGroupMutation.isPending}
            />
            <Input
              placeholder="Описание (опционально)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              disabled={!supabase || createGroupMutation.isPending}
            />
            <Button
              type="button"
              className="h-11"
              onClick={() => createGroupMutation.mutate()}
              disabled={!supabase || createGroupMutation.isPending}
            >
              <Plus className="size-4" />
              Создать
            </Button>
          </div>

          <div className="grid gap-3">
            {groupsQuery.data?.length ? (
              groupsQuery.data.map((g) => {
                const childSet = new Set(g.children.map((c) => c.child_id));
                const staffSet = new Set(g.staff.map((s) => s.therapist_id));
                return (
                  <div key={g.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.description || "Без описания"}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Дети</div>
                        <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                          {children.map((c) => {
                            const checked = childSet.has(c.id);
                            return (
                              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={checked}
                                  onChange={(e) =>
                                    toggleGroupChildMutation.mutate({
                                      groupId: g.id,
                                      childId: c.id,
                                      add: e.target.checked,
                                    })
                                  }
                                  disabled={!supabase || toggleGroupChildMutation.isPending}
                                />
                                <span className="truncate">{c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Сотрудники</div>
                        <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                          {therapists.map((t) => {
                            const checked = staffSet.has(t.id);
                            return (
                              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={checked}
                                  onChange={(e) =>
                                    toggleGroupStaffMutation.mutate({
                                      groupId: g.id,
                                      therapistId: t.id,
                                      add: e.target.checked,
                                    })
                                  }
                                  disabled={!supabase || toggleGroupStaffMutation.isPending}
                                />
                                <div className="min-w-0">
                                  <div className="truncate">{t.full_name || "Без имени"}</div>
                                  <div className="truncate text-xs text-muted-foreground">{t.email}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">
                {groupsQuery.isLoading ? "Загрузка групп…" : "Групп пока нет"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
