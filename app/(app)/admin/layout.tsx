import { exigerAdmin } from "@/lib/supabase/session";
import { SousNavAdmin } from "@/components/admin/sous-nav";

export default async function EnveloppeAdmin({ children }: { children: React.ReactNode }) {
  await exigerAdmin();
  return (
    <div className="space-y-7">
      <SousNavAdmin />
      {children}
    </div>
  );
}
