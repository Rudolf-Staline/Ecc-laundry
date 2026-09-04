"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ } from "@/components/ui";
import type { Profile } from "@/lib/types";

export function Preferences({ profil, urlBase }: { profil: Profile; urlBase: string }) {
  const router = useRouter();
  const toast = useToast();
  const [promo, setPromo] = useState(profil.promo?.toString() ?? "");
  const [rappels, setRappels] = useState(profil.notify_reminders);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);

  const lienAgenda = `${urlBase}/api/agenda/${profil.ics_token}`;

  async function enregistrer() {
    setEnCours(true);
    const supabase = creerClientNavigateur();
    const annee = promo.trim() ? Number(promo.trim()) : null;

    if (annee !== null && (Number.isNaN(annee) || annee < 2015 || annee > 2100)) {
      toast({ ton: "erreur", titre: "Année de promotion invalide" });
      setEnCours(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ promo: annee, notify_reminders: rappels })
      .eq("id", profil.id);
    setEnCours(false);

    if (error) toast({ ton: "erreur", titre: "Enregistrement impossible", detail: messageErreur(error) });
    else {
      toast({ ton: "ok", titre: "Préférences enregistrées" });
      router.refresh();
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(lienAgenda);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      toast({ ton: "info", titre: "Copie manuelle", detail: lienAgenda });
    }
  }

  return (
    <>
      <section className="panel corners p-6">
        <p className="eyebrow">Préférences</p>
        <h2 className="display text-xl mt-2 text-chalk">Vos réglages</h2>

        <div className="mt-5 space-y-5">
          <Champ
            name="promo"
            etiquette="Promotion"
            inputMode="numeric"
            placeholder="2028"
            value={promo}
            onChange={(e) => setPromo(e.target.value.replace(/\D/g, "").slice(0, 4))}
            aide="Facultatif — sert aux statistiques agrégées de la vie étudiante."
          />

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={rappels}
              onChange={(e) => setRappels(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-klein shrink-0"
            />
            <span>
              <span className="text-sm text-chalk group-hover:text-white transition-colors">
                Rappels avant mes créneaux
              </span>
              <span className="block text-xs text-dim mt-1 leading-relaxed">
                Un message avant le début du créneau, pour ne pas oublier de descendre.
              </span>
            </span>
          </label>
        </div>

        <Bouton variante="primaire" onClick={enregistrer} enCours={enCours} className="mt-6">
          Enregistrer
        </Bouton>
      </section>

      <section className="panel corners p-6">
        <p className="eyebrow">Agenda</p>
        <h2 className="display text-xl mt-2 text-chalk">Vos créneaux dans votre calendrier</h2>
        <p className="text-sm text-mist mt-3 leading-relaxed">
          Ajoutez ce lien comme <span className="text-chalk">calendrier par URL</span> dans
          Google Agenda, Apple Calendrier ou Outlook. Vos réservations y apparaissent
          automatiquement, avec un rappel dix minutes avant.
        </p>

        <div className="mt-4 flex gap-2">
          <code className="flex-1 min-w-0 bg-ink-2 border border-line rounded-[3px] px-3 py-2.5
            text-[11px] font-mono text-mist truncate" title={lienAgenda}>
            {lienAgenda}
          </code>
          <Bouton variante="secondaire" onClick={copier}>
            {copie ? "Copié ✓" : "Copier"}
          </Bouton>
        </div>

        <p className="text-[11px] text-dim mt-3 leading-relaxed">
          Ce lien vaut mot de passe : ne le partagez pas.
        </p>
      </section>
    </>
  );
}
