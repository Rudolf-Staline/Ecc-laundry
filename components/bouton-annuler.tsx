"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";

/** Annulation en deux temps : un clic pour armer, un second pour confirmer. */
export function BoutonAnnuler({
  idReservation,
  libelle,
}: {
  idReservation: string;
  libelle?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [arme, setArme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function annuler() {
    if (!arme) {
      setArme(true);
      setTimeout(() => setArme(false), 4000);
      return;
    }

    setEnCours(true);
    const supabase = creerClientNavigateur();
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: idReservation });
    setEnCours(false);
    setArme(false);

    if (error) {
      toast({ ton: "erreur", titre: "Annulation impossible", detail: messageErreur(error) });
    } else {
      toast({
        ton: "info",
        titre: libelle ? `${libelle} libérée` : "Réservation annulée",
        detail: "Le créneau est rendu aux autres étudiants.",
      });
      router.refresh();
    }
  }

  return (
    <button
      onClick={annuler}
      disabled={enCours}
      className={`text-[11px] font-medium px-3 py-1.5 border rounded-[8px]
        transition-all disabled:opacity-50 ${
          arme
            ? "border-coral bg-coral text-white"
            : "border-line text-dim hover:text-coral hover:border-coral/50"
        }`}
    >
      {enCours ? "…" : arme ? "Confirmer ?" : "Annuler"}
    </button>
  );
}
