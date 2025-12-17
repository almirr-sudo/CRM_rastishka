"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
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
import { supabase } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/models";

const inviteSchema = z.object({
  email: z.string().email("Введите корректный email"),
  full_name: z.string().min(1, "Введите имя").max(120),
  role: z.enum(["admin", "manager", "therapist", "parent"]),
  temp_password: z
    .string()
    .min(6, "Минимум 6 символов")
    .max(72)
    .optional()
    .or(z.literal("")),
});

type InviteValues = z.infer<typeof inviteSchema>;

function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Администратор";
    case "manager":
      return "Менеджер";
    case "therapist":
      return "Терапевт";
    case "parent":
      return "Родитель";
    default:
      return role;
  }
}

async function fetchProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: fetchProfiles,
    enabled: Boolean(supabase),
  });

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "therapist",
      temp_password: "",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteValues) => {
      setMessage(null);
      const payload = {
        email: values.email,
        full_name: values.full_name,
        role: values.role,
        temp_password: values.temp_password ? values.temp_password : undefined,
      };
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(json?.error || "Не удалось пригласить пользователя");
      }
      return json;
    },
    onSuccess: () => {
      setMessage("Готово: пользователь создан/приглашён");
      form.reset({ email: "", full_name: "", role: "therapist", temp_password: "" });
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] }),
  });

  const profiles = profilesQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Пользователи</h1>
          <p className="text-sm text-muted-foreground">
            Приглашение сотрудников и родителей, управление ролями.
          </p>
        </div>
      </div>

      {!supabase ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>
            Для работы админ‑панели настройте Supabase и переменную
            `SUPABASE_SERVICE_ROLE_KEY`.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4 text-muted-foreground" />
            Пригласить / создать пользователя
          </div>

          {message ? (
            <div className="text-sm text-muted-foreground">{message}</div>
          ) : null}

          <Form {...form}>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
            >
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Анна Иванова" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Эл. почта</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="name@school.ru" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Роль</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Выберите роль" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="manager">Менеджер</SelectItem>
                        <SelectItem value="therapist">Терапевт</SelectItem>
                        <SelectItem value="parent">Родитель</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temp_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Временный пароль (опционально)</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        placeholder="Если пусто — отправим приглашение по email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="h-11"
                  disabled={!supabase || inviteMutation.isPending}
                >
                  <UserPlus className="size-4" />
                  Создать / пригласить
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-muted-foreground" />
            Список пользователей
          </div>

          <div className="grid gap-2 md:hidden">
            {profiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {profilesQuery.isLoading ? "Загрузка…" : "Нет данных"}
              </div>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.full_name || "—"}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.email}</div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Роль</div>
                    <Select
                      value={p.role}
                      onValueChange={(v) => updateRoleMutation.mutate({ id: p.id, role: v as UserRole })}
                      disabled={!supabase || updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                        <SelectItem value="manager">{roleLabel("manager")}</SelectItem>
                        <SelectItem value="therapist">{roleLabel("therapist")}</SelectItem>
                        <SelectItem value="parent">{roleLabel("parent")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Эл. почта</TableHead>
                  <TableHead className="w-[220px]">Роль</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      {profilesQuery.isLoading ? "Загрузка…" : "Нет данных"}
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        <Select
                          value={p.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ id: p.id, role: v as UserRole })}
                          disabled={!supabase || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                            <SelectItem value="manager">{roleLabel("manager")}</SelectItem>
                            <SelectItem value="therapist">{roleLabel("therapist")}</SelectItem>
                            <SelectItem value="parent">{roleLabel("parent")}</SelectItem>
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
