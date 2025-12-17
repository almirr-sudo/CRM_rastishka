import { GoalDetails } from "@/components/therapist/GoalDetails";
import { requireRole } from "@/lib/auth/server";

export default async function GoalDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["therapist"]);
  const { id } = await params;
  return <GoalDetails goalId={id} />;
}

