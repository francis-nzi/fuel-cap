import { ControlRoom } from "@/components/control-room";
import { requireStaffPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { principal } = await requireStaffPage();
  return <ControlRoom principal={principal} />;
}
