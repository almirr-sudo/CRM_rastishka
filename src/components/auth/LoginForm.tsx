"use client";

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEMO_NAME_COOKIE, DEMO_ROLE_COOKIE, type DemoRole } from "@/lib/auth/demo"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

type LoginValues = z.infer<typeof loginSchema>;

function setCookie(name: string, value: string) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=2592000`;
}

function clearCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0`;
}

function translateSupabaseAuthError(message: string) {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials")) return "Неверный email или пароль";
  if (msg.includes("email not confirmed")) return "Эл. почта не подтверждена";
  if (msg.includes("user not found")) return "Пользователь не найден";
  if (msg.includes("password")) return "Проверьте пароль";
  return "Не удалось выполнить вход. Попробуйте ещё раз.";
}

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const safeNextUrl = nextUrl?.startsWith("/") ? nextUrl : "/app";

  const [showPassword, setShowPassword] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole>("therapist");
  const [demoName, setDemoName] = useState("Демо пользователь");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginValues) => {
      if (!supabase) throw new Error("Supabase не настроен");
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) throw error;
    },
    onSuccess: () => {
      router.replace(safeNextUrl);
      router.refresh();
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? translateSupabaseAuthError(error.message) : "Ошибка входа";
      form.setError("email", { message: msg });
    },
  });

  const demoLogin = () => {
    clearCookie(DEMO_ROLE_COOKIE);
    clearCookie(DEMO_NAME_COOKIE);
    setCookie(DEMO_ROLE_COOKIE, demoRole);
    setCookie(DEMO_NAME_COOKIE, demoName.trim() || "Демо пользователь");
    router.replace("/app");
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      {!isSupabaseConfigured ? (
        <Alert>
          <AlertTitle>Демо‑режим</AlertTitle>
          <AlertDescription>
            Supabase не настроен — можно войти в демо и посмотреть интерфейс.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold leading-tight">Вход</h1>
        <p className="text-sm text-muted-foreground">
          Для сотрудников и родителей. Все данные защищены политиками доступа.
        </p>
      </div>

      {isSupabaseConfigured ? (
        <Form {...form}>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Эл. почта</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="name@school.ru"
                      autoComplete="email"
                      inputMode="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Пароль</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="h-11" disabled={loginMutation.isPending}>
              <LogIn className="size-4" />
              Войти
            </Button>
          </form>
        </Form>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Роль</label>
            <Select value={demoRole} onValueChange={(v) => setDemoRole(v as DemoRole)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Администратор</SelectItem>
                <SelectItem value="manager">Менеджер</SelectItem>
                <SelectItem value="therapist">Терапевт / педагог</SelectItem>
                <SelectItem value="parent">Родитель</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Имя</label>
            <Input
              className="h-11"
              value={demoName}
              onChange={(e) => setDemoName(e.target.value)}
              placeholder="Например: Анна Иванова"
            />
          </div>

          <Button type="button" className="h-11" onClick={demoLogin}>
            Войти в демо
          </Button>
        </div>
      )}
    </div>
  );
}
