import { TherapistHomeNotes } from "@/components/therapist/TherapistHomeNotes";
import { requireRole } from "@/lib/auth/server";

export default async function TherapistNotesPage() {
  await requireRole(["therapist"]);
  return <TherapistHomeNotes />;
}

