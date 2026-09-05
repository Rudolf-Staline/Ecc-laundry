"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Selecteur } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import {
  CATEGORIES_RECLAMATION, type ClaimCategory, type HistoryRow, type MachineLive,
} from "@/lib/types";

type Reservation = Pick<HistoryRow, "id" | "reference" | "starts_at" | "machine_name" | "room_name" | "status">;
type Machine = Pick<MachineLive, "machine_id" | "name" | "room_name">;

/** Catégories qui appellent naturellement une réservation ou une machine. */
const DEMANDE_RESERVATION: ClaimCategory[] = ["linge_sorti", "linge_abime", "creneau_occupe", "pointage"];
const DEMANDE_MACHINE: ClaimCategory[] = ["linge_sorti", "linge_abime", "creneau_occupe", "pointage", "proprete"];

export function FormulaireReclamation({
  reservations, machines, reservationPreselectionnee, machinePreselectionnee,
}: {
  reservations: Reservation[];
  machines: Machine[];
  reservationPreselectionnee?: string;
  machinePreselectionnee?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [categorie, setCategorie] = useState<ClaimCategory>("linge_sorti");
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [reservationId, setReservationId] = useState(
    reservations.find((r) => r.reference === reservationPreselectionnee)?.id ?? "",
  );
  const [machineId, setMachineId] = useState(machinePreselectionnee ?? "");
  const [enCours, setEnCours] = useState(false);

  const montrerReservation = DEMANDE_RESERVATION.includes(categorie);
  const montrerMachine = DEMANDE_MACHINE.includes(categorie);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();

    if (sujet.trim().length < 3) {
      toast({ ton: "erreur", titre: "Résumez le problème en quelques mots." });
      return;
    }
    if (message.trim().length < 10) {
      toast({
        ton: "erreur",
        titre: "Décrivez ce qui s'est passé",
        detail: "Quelques phrases suffisent, mais l'équipe a besoin de savoir quand et où.",
      });
      return;
    }

    setEnCours(true);
    const supabase = creerClientNavigateur();
    const { data, error } = await supabase.rpc("file_claim", {
      p_category: categorie,
      p_subject: sujet.trim(),
      p_message: message.trim(),
      p_booking_id: montrerReservation && reservationId ? reservationId : null,
      p_machine_id: montrerMachine && machineId ? machineId : null,
    });
    setEnCours(false);

    if (error) {
      toast({ ton: "erreur", titre: "Dépôt impossible", detail: messageErreur(error) });
      return;
    }

    const dossier = Array.isArray(data) ? data[0] : data;
    toast({
      ton: "ok",
      titre: `Dossier ${dossier?.reference ?? ""} ouvert`,
      detail: "Vous recevrez les réponses de l'équipe dans le fil.",
    });
    router.push(`/reclamations/${dossier?.reference ?? ""}`);
    router.refresh();
  }

  return (
    <form onSubmit={envoyer} className="panel corners p-6 space-y-5">
      <Selecteur
        etiquette="De quoi s'agit-il ?"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value as ClaimCategory)}
      >
        {Object.entries(CATEGORIES_RECLAMATION).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </Selecteur>

      {montrerReservation && (
        <Selecteur
          etiquette="Réservation concernée"
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
        >
          <option value="">— aucune en particulier —</option>
          {reservations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.reference} · {r.machine_name} · {fmtDateTime(r.starts_at)}
            </option>
          ))}
        </Selecteur>
      )}

      {montrerMachine && (
        <Selecteur
          etiquette="Machine concernée"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
        >
          <option value="">— aucune en particulier —</option>
          {machines.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              {m.name} · {m.room_name}
            </option>
          ))}
        </Selecteur>
      )}

      <Champ
        name="sujet"
        etiquette="En une phrase"
        value={sujet}
        maxLength={120}
        onChange={(e) => setSujet(e.target.value)}
        placeholder="Mon linge était posé par terre à la fin du créneau"
      />

      <div>
        <label htmlFor="corps" className="eyebrow block mb-2">Ce qui s&apos;est passé</label>
        <textarea
          id="corps"
          rows={5}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Quand, où, ce que vous avez constaté. S'il y a des témoins ou une machine voisine concernée, dites-le : ça accélère le traitement."
          className="w-full bg-ink-2 border border-line rounded-[3px] px-3.5 py-3 text-sm text-chalk
            placeholder:text-dim outline-none focus:border-klein transition-colors resize-y"
        />
        <p className="text-[11px] text-dim mt-2">{message.length} / 4000</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Bouton type="submit" variante="primaire" enCours={enCours}>
          Ouvrir le dossier
        </Bouton>
        <Bouton type="button" variante="fantome" onClick={() => router.back()}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
