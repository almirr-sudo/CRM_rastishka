import { IncidentsList } from "@/components/therapist/IncidentsList";
import { requireRole } from "@/lib/auth/server";

export default async function TherapistIncidentsPage() {
  await requireRole(["therapist"]);
  return <IncidentsList />;
}

