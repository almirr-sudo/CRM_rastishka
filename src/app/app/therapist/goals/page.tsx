import { GoalsManager } from "@/components/therapist/GoalsManager";
import { requireRole } from "@/lib/auth/server";

export default async function TherapistGoalsPage() {
  await requireRole(["therapist"]);
  return <GoalsManager />;
}

