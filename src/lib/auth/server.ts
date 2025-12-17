import "server-only";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public-env";
import type { Profile, UserRole } from "@/types/models";
import { DEMO_NAME_COOKIE, DEMO_ROLE_COOKIE, type DemoRole } from "./demo";

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value as DemoRole | undefined;
    if (!demoRole) return null;
    return `demo-${demoRole}`;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value as DemoRole | undefined;
    if (!demoRole) return null;

    const name = cookieStore.get(DEMO_NAME_COOKIE)?.value ?? "Демо пользователь";
    const nowIso = new Date().toISOString();
    return {
      id: `demo-${demoRole}`,
      email: "demo@local",
      role: demoRole,
      full_name: name,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return (data ?? null) as Profile | null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  return profile;
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/app");
  return profile;
}
