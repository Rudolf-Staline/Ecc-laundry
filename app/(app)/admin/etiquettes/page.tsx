import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { creerClientServeur } from "@/lib/supabase/server";
import { urlSite, NOM_APP } from "@/lib/config";
import { Tambour } from "@/components/marque";
import { Bouton, Etiquette } from "@/components/ui";
import type { MachineCode } from "@/lib/types";

export const metadata: Metadata = { title: "Étiquettes QR" };
export const dynamic = "force-dynamic";

/**
 * Planche d'étiquettes à imprimer et coller sur les machines. Le QR pointe
 * vers /pointage/<code> : l'appareil photo du téléphone suffit, aucune
 * application à installer.
 *
 * Les codes ne sont pas lisibles depuis l'API — le privilège SELECT sur la
 * colonne est retiré au client. Ils transitent uniquement par cette fonction,
 * qui vérifie le rôle : sinon n'importe qui pourrait pointer sans venir.
 */
export default async function PageEtiquettes() {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("admin_machine_codes");
  const parc = (data as MachineCode[]) ?? [];

  const etiquettes = await Promise.all(
    parc.map(async (m) => ({
      ...m,
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

      <div className="no-print panel corners p-4 flex items-start gap-3">
        <Etiquette ton="info">confidentiel</Etiquette>
        <p className="text-xs text-mist leading-relaxed">
          Ces codes valent preuve de présence devant la machine : ils ne sont
          lisibles que par un administrateur. Ne les diffusez pas autrement
          qu&apos;imprimés et collés sur les machines.
        </p>
      </div>

      {error ? (
        <div className="panel corners px-6 py-12 text-center text-coral no-print">
          {error.message}
        </div>
      ) : parc.length === 0 ? (
        <div className="panel corners px-6 py-12 text-center text-mist no-print">
          Aucune machine à étiqueter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
          {etiquettes.map((m) => (
            <article
              key={m.machine_id}
              className="bg-white text-black rounded-[3px] p-5 flex flex-col items-center
                text-center break-inside-avoid border border-line"
            >
              <div className="flex items-center gap-2 self-start">
                <Tambour size={18} className="text-black" strokeWidth={2} />
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase">{NOM_APP}</span>
              </div>

              <div className="w-[150px] h-[150px] my-4" dangerouslySetInnerHTML={{ __html: m.svg }} />

              <p className="text-lg font-bold leading-tight">{m.machine_name}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{m.room_name}</p>

              <p className="text-[10px] mt-3 pt-3 border-t border-black/15 w-full leading-relaxed">
                Scannez pour pointer votre réservation.
              </p>
              <code className="text-[9px] tracking-[0.08em] opacity-55 mt-1.5 break-all">
                {m.qr_code}
              </code>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
