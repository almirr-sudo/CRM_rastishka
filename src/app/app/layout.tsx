import { AppShell } from "@/components/app/AppShell";
import { requireProfile } from "@/lib/auth/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}

