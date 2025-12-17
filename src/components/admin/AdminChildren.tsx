"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, Save } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Child, Profile } from "@/types/models";

const childSchema = z.object({
  name: z.string().min(1, "Введите имя ребёнка").max(120),
  dob: z.string().optional(),
  diagnosis: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  parent_id: z.string().uuid().optional().or(z.literal("")),
});

type ChildValues = z.infer<typeof childSchema>;

type ChildRow = Child & { parent?: Pick<Profile, "full_name" | "email"> | null };

async function fetchParents(): Promise<Pick<Profile, "id" | "full_name" | "email">[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "parent")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Pick<Profile, "id" | "full_name" | "email">>;
}

async function fetchChildren(): Promise<ChildRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("children")
    .select("*, parent:profiles(full_name,email)")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChildRow[];
}

export function AdminChildren() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const parentsQuery = useQuery({
    queryKey: ["admin", "parents"],
    queryFn: fetchParents,
    enabled: Boolean(supabase),
  });

  const childrenQuery = useQuery({
    queryKey: ["admin", "children"],
    queryFn: fetchChildren,
    enabled: Boolean(supabase),
  });

  const form = useForm<ChildValues>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      name: "",
      dob: "",
      diagnosis: "",
      dietary_restrictions: "",
      parent_id: "",
    },
  });

  const createChildMutation = useMutation({
    mutationFn: async (values: ChildValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      setMessage(null);

      const payload = {
        name: values.name,
        dob: values.dob ? values.dob : null,
        diagnosis: values.diagnosis ? values.diagnosis : null,
        dietary_restrictions: values.dietary_restrictions ? values.dietary_restrictions : null,
        parent_id: values.parent_id ? values.parent_id : null,
      };

      const { error } = await supabase.from("children").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("Ребёнок добавлен");
      form.reset({ name: "", dob: "", diagnosis: "", dietary_restrictions: "", parent_id: "" });
      queryClient.invalidateQueries({ queryKey: ["admin", "children"] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    },
  });

  const updateParentMutation = useMutation({
    mutationFn: async ({ childId, parentId }: { childId: string; parentId: string | null }) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase
        .from("children")
        .update({ parent_id: parentId })
        .eq("id", childId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "children"] }),
  });

  const parents = parentsQuery.data ?? [];
  const children = childrenQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Дети</h1>
        <p className="text-sm text-muted-foreground">
          Добавление ребёнка и привязка к родителю.
        </p>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>Настройте Supabase, чтобы управлять детьми.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Baby className="size-4 text-muted-foreground" />
            Добавить ребёнка
          </div>

          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

          <Form {...form}>
            <form
              className="grid gap-3"
              onSubmit={form.handleSubmit((v) => createChildMutation.mutate(v))}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="Артём" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата рождения (опционально)</FormLabel>
                      <FormControl>
                        <Input className="h-11" type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Диагноз (опционально)</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="РАС" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Родитель (опционально)</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Не выбран" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Не выбран</SelectItem>
                          {parents.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {(p.full_name || "Без имени") + " · " + p.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dietary_restrictions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ограничения по питанию (опционально)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Например: без глютена, без лактозы…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="h-11"
                disabled={!supabase || createChildMutation.isPending}
              >
                <Save className="size-4" />
                Сохранить
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="text-sm font-semibold">Список</div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ребёнок</TableHead>
                  <TableHead>Диагноз</TableHead>
                  <TableHead className="w-[320px]">Родитель</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      {childrenQuery.isLoading ? "Загрузка…" : "Нет данных"}
                    </TableCell>
                  </TableRow>
                ) : (
                  children.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.diagnosis ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.parent_id ?? ""}
                          onValueChange={(v) =>
                            updateParentMutation.mutate({
                              childId: c.id,
                              parentId: v ? v : null,
                            })
                          }
                          disabled={!supabase || updateParentMutation.isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Не выбран" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Не выбран</SelectItem>
                            {parents.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {(p.full_name || "Без имени") + " · " + p.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
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

