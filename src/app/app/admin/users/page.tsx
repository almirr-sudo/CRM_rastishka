import { AdminUsers } from "@/components/admin/AdminUsers";
import { requireRole } from "@/lib/auth/server";

export default async function AdminUsersPage() {
  await requireRole(["admin"]);
  return <AdminUsers />;
}

