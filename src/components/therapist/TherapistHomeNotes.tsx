"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { HomeNotesThread } from "@/components/notes/HomeNotesThread";
import { supabase } from "@/lib/supabase/client";
import type { Child } from "@/types/models";

const DEMO_CHILDREN: Child[] = [
  {
    id: "demo-1",
    name: "Миша",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: "Без ограничений",
    avatar_url: null,
    parent_id: null,
    created_at: "2025-12-17T00:00:00.000Z",
    updated_at: "2025-12-17T00:00:00.000Z",
  },
  {
    id: "demo-2",
    name: "Аня",
    dob: null,
    diagnosis: "РАС",
    dietary_restrictions: "Без глютена",
    avatar_url: null,
    parent_id: null,
    created_at: "2025-12-17T00:00:00.000Z",
    updated_at: "2025-12-17T00:00:00.000Z",
  },
];

const EMPTY_CHILDREN: Child[] = [];

async function fetchChildren(): Promise<Child[]> {
  if (!supabase) return DEMO_CHILDREN;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Child[];
}

export function TherapistHomeNotes() {
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const childrenQuery = useQuery({
    queryKey: ["therapist", "children"],
    queryFn: fetchChildren,
  });

  const children = childrenQuery.data ?? (supabase ? EMPTY_CHILDREN : DEMO_CHILDREN);
  const effectiveChildId = selectedChildId || children[0]?.id || "";

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Домашние заметки</h1>
        <p className="text-sm text-muted-foreground">
          Сообщения от родителей и ответы специалистов по ребёнку.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>
            Supabase не настроен — показаны демонстрационные данные.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" />
              Ребёнок
            </div>
            <Select
              value={effectiveChildId}
              onValueChange={setSelectedChildId}
              disabled={children.length <= 1}
            >
              <SelectTrigger className="h-10">
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
          </div>

          <Separator />

          {effectiveChildId ? (
            <HomeNotesThread childId={effectiveChildId} myRole="therapist" />
          ) : (
            <div className="text-sm text-muted-foreground">
              {childrenQuery.isLoading ? "Загрузка…" : "Нет доступных детей."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
