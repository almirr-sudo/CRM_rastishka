import { requireRole } from "@/lib/auth/server";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin", "manager"]);
  return children;
}

