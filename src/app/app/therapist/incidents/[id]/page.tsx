import { IncidentDetailsForm } from "@/components/therapist/IncidentDetailsForm";
import { requireRole } from "@/lib/auth/server";

export default async function IncidentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["therapist"]);
  const { id } = await params;
  return <IncidentDetailsForm incidentId={id} />;
}

