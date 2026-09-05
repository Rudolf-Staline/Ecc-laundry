import { NextResponse, type NextRequest } from "next/server";
import { creerClientService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Entretien périodique, déclenché par le cron Vercel (cf. vercel.json) :
 *  — clôt les cycles arrivés à terme, sur leur horaire ;
 *  — purge la file d'attente périmée.
 */
export async function GET(request: NextRequest) {
  const attendu = process.env.CRON_SECRET;
  const recu = request.headers.get("authorization");

  // Vercel signe ses appels avec CRON_SECRET ; sans secret configuré, on refuse
  // plutôt que d'exposer un point d'entrée ouvert.
  if (!attendu) {
    return NextResponse.json({ erreur: "CRON_SECRET non configuré." }, { status: 503 });
  }
  if (recu !== `Bearer ${attendu}`) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = creerClientService();
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("sweep_maintenance");

  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(data as object) });
}
