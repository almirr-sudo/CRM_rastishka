import { requireRole } from "@/lib/auth/server";

import { ParentPortal } from "@/components/parent/ParentPortal";

export default async function ParentHomePage() {
  await requireRole(["parent"]);

  return <ParentPortal />;
}
