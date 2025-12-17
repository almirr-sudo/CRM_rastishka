import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured, supabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/public-env";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "manager", "therapist", "parent"]),
  temp_password: z.string().min(6).max(72).optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 500 });
  }

  if (!isServiceRoleConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Не задан SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase не настроен (server client)" },
      { status: 500 },
    );
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: myProfile, error: myProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (myProfileError || myProfile?.role !== "admin") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { email, full_name, role, temp_password } = parsed.data;

  let createdUserId: string | null = null;

  if (temp_password) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temp_password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    createdUserId = data.user?.id ?? null;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name } },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    createdUserId = data.user?.id ?? null;
  }

  if (!createdUserId) {
    return NextResponse.json(
      { error: "Не удалось создать пользователя" },
      { status: 500 },
    );
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    { id: createdUserId, email, full_name, role },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json(
      {
        error: `Пользователь создан, но профиль не обновлён: ${profileError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId: createdUserId });
}
