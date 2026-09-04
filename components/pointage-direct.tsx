"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { Bouton } from "@/components/ui";
import { Tambour } from "@/components/marque";
import { fmtTime } from "@/lib/time";

export function PointageDirect({ code }: { code: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"encours" | "ok" | "echec">("encours");
  const [message, setMessage] = useState("");
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return; // React 19 monte deux fois en développement
    lance.current = true;

    (async () => {
      const supabase = creerClientNavigateur();
      const { data, error } = await supabase.rpc("check_in", { p_qr: code.toLowerCase() });

      if (error) {
        setEtat("echec");
        setMessage(messageErreur(error));
        return;
      }
      const b = Array.isArray(data) ? data[0] : data;
      setEtat("ok");
      setMessage(b?.ends_at ? `Fin du cycle prévue à ${fmtTime(b.ends_at)}.` : "Créneau confirmé.");
      setTimeout(() => { router.refresh(); router.push("/tableau"); }, 2600);
    })();
  }, [code, router]);

  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <Tambour
        size={92}
        spinning={etat === "encours" ? "cycle" : etat === "ok" ? "slow" : false}
        className={`mx-auto ${
          etat === "ok" ? "text-acid" : etat === "echec" ? "text-coral" : "text-klein"
        }`}
      />

      <h1 className="display text-3xl mt-7 text-chalk">
        {etat === "encours" ? "Pointage…" : etat === "ok" ? "C'est parti." : "Pointage refusé"}
      </h1>

      <p className="text-mist mt-3 leading-relaxed">
        {etat === "encours" ? "Vérification de votre réservation." : message}
      </p>

      {etat === "ok" && (
        <p className="text-xs text-dim font-mono mt-6">Redirection vers votre tableau de bord…</p>
      )}

      {etat === "echec" && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-8">
          <Link href="/reserver">
            <Bouton variante="primaire">Voir le planning</Bouton>
          </Link>
          <Link href="/pointage">
            <Bouton variante="secondaire">Saisir un autre code</Bouton>
          </Link>
        </div>
      )}
    </div>
  );
}
