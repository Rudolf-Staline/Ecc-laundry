import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { creerClientServeur } from "@/lib/supabase/server";
import { urlSite, NOM_APP } from "@/lib/config";
import { Tambour } from "@/components/marque";
import { Bouton } from "@/components/ui";
import type { Machine, Room } from "@/lib/types";

export const metadata: Metadata = { title: "Étiquettes QR" };
export const dynamic = "force-dynamic";

/**
 * Planche d'étiquettes à imprimer et coller sur les machines. Le QR pointe
 * vers /pointage/<code> : l'appareil photo du téléphone suffit, aucune
 * application à installer.
 */
export default async function PageEtiquettes() {
  const supabase = await creerClientServeur();
  const [{ data: machines }, { data: salles }] = await Promise.all([
    supabase.from("machines").select("*").order("room_id").order("position"),
    supabase.from("rooms").select("*").order("position"),
  ]);

  const parc = (machines as Machine[]) ?? [];
  const buanderies = (salles as Room[]) ?? [];

  const etiquettes = await Promise.all(
    parc.map(async (m) => ({
      machine: m,
      salle: buanderies.find((b) => b.id === m.room_id),
      svg: await QRCode.toString(`${urlSite}/pointage/${m.qr_code}`, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      }),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Impression</p>
          <h1 className="display text-3xl mt-2 text-chalk">Étiquettes QR</h1>
          <p className="text-sm text-mist mt-2 max-w-xl leading-relaxed">
            Une étiquette par machine. Imprimez, découpez, collez sur le hublot.
            Un étudiant qui scanne avec son appareil photo est pointé en une seconde.
          </p>
        </div>
        <Link href="/admin/machines">
          <Bouton variante="secondaire">← Retour aux machines</Bouton>
        </Link>
      </div>

      {parc.length === 0 ? (
        <div className="panel corners px-6 py-12 text-center text-mist no-print">
          Aucune machine à étiqueter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
          {etiquettes.map(({ machine, salle, svg }) => (
            <article
              key={machine.id}
              className="bg-white text-black rounded-[3px] p-5 flex flex-col items-center
                text-center break-inside-avoid border border-line"
            >
              <div className="flex items-center gap-2 self-start">
                <Tambour size={18} className="text-black" strokeWidth={2} />
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase">{NOM_APP}</span>
              </div>

              <div
                className="w-[150px] h-[150px] my-4"
                dangerouslySetInnerHTML={{ __html: svg }}
              />

              <p className="text-lg font-bold leading-tight">{machine.name}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{salle?.name ?? ""}</p>

              <p className="text-[10px] mt-3 pt-3 border-t border-black/15 w-full leading-relaxed">
                Scannez pour pointer votre réservation.
              </p>
              <code className="text-[9px] tracking-[0.08em] opacity-55 mt-1.5 break-all">
                {machine.qr_code}
              </code>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
