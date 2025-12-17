import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/server";

export default async function AppIndexPage() {
  const profile = await requireProfile();

  if (profile.role === "admin") redirect("/app/admin");
  if (profile.role === "manager") redirect("/app/business");
  if (profile.role === "parent") redirect("/app/parent");

  redirect("/app/therapist");
}
