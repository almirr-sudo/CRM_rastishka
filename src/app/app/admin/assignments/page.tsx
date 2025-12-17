import { AdminAssignments } from "@/components/admin/AdminAssignments";
import { requireRole } from "@/lib/auth/server";

export default async function AdminAssignmentsPage() {
  await requireRole(["admin"]);
  return <AdminAssignments />;
}

