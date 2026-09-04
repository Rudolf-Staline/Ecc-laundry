import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { PointageDirect } from "@/components/pointage-direct";

export const metadata: Metadata = { title: "Pointage" };
export const dynamic = "force-dynamic";

/**
 * Cible des QR codes collés sur les machines : l'appareil photo du téléphone
 * ouvre cette page, le pointage se fait tout seul. Aucune application à
 * installer, aucune permission à accorder.
 */
export default async function PagePointageDirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await exigerProfil();
  const { code } = await params;
  return <PointageDirect code={code} />;
}
