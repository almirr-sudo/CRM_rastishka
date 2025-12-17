import { TherapistDashboard } from "@/components/therapist/TherapistDashboard";
import { requireRole } from "@/lib/auth/server";

export default async function TherapistHomePage() {
  await requireRole(["therapist"]);
  return <TherapistDashboard />;
}

