import { AdminChildren } from "@/components/admin/AdminChildren";
import { requireRole } from "@/lib/auth/server";

export default async function AdminChildrenPage() {
  await requireRole(["admin"]);
  return <AdminChildren />;
}

