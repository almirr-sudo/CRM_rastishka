import { AbcAnalysis } from "@/components/therapist/AbcAnalysis";
import { requireRole } from "@/lib/auth/server";

export default async function AbcAnalysisPage() {
  await requireRole(["therapist"]);
  return <AbcAnalysis />;
}

