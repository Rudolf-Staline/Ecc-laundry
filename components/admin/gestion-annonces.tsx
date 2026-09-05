"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Etiquette, Selecteur } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import type { Announcement } from "@/lib/types";

const NIVEAUX = {
  info: { label: "information", ton: "info" as const },
  warning: { label: "avertissement", ton: "occupe" as const },
  critical: { label: "critique", ton: "panne" as const },
};

export function GestionAnnonces({ annonces }: { annonces: Announcement[] }) {
  const router = useRouter();
  const toast = useToast();
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [niveau, setNiveau] = useState<"info" | "warning" | "critical">("info");
  const [enCours, setEnCours] = useState(false);

  async function publier(e: React.FormEvent) {
    e.preventDefault();
    if (titre.trim().length < 2 || corps.trim().length < 2) {
      toast({ ton: "erreur", titre: "Titre et message sont requis." });
      return;
    }

    setEnCours(true);
    const supabase = creerClientNavigateur();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({
      title: titre.trim(), body: corps.trim(), level: niveau, author_id: user?.id ?? null,
    });
    setEnCours(false);

    if (error) toast({ ton: "erreur", titre: "Publication refusée", detail: messageErreur(error) });
    else {
      toast({ ton: "ok", titre: "Annonce publiée", detail: "Visible immédiatement par tous." });
      setTitre(""); setCorps("");
      router.refresh();
    }
  }

  async function basculer(a: Announcement) {
    const supabase = creerClientNavigateur();
    const { error } = await supabase
      .from("announcements").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) toast({ ton: "erreur", titre: "Action refusée", detail: messageErreur(error) });
    else { toast({ ton: "info", titre: a.is_active ? "Annonce retirée" : "Annonce réactivée" }); router.refresh(); }
  }

  async function supprimer(a: Announcement) {
    const supabase = creerClientNavigateur();
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) toast({ ton: "erreur", titre: "Suppression refusée", detail: messageErreur(error) });
    else { toast({ ton: "info", titre: "Annonce supprimée" }); router.refresh(); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={publier} className="panel corners p-6">
        <p className="eyebrow mb-4">Nouvelle annonce</p>
        <div className="space-y-4">
          <Champ
            name="titre" etiquette="Titre" value={titre} maxLength={120}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Coupure d'eau mardi matin"
          />
          <div>
            <label htmlFor="corps" className="eyebrow block mb-2">Message</label>
            <textarea
              id="corps" rows={3} maxLength={2000} value={corps}
              onChange={(e) => setCorps(e.target.value)}
              placeholder="Les buanderies seront fermées de 8 h à 12 h. Les créneaux concernés ont été annulés."
              className="w-full bg-ink-2 border border-line rounded-[8px] px-3.5 py-3 text-sm text-chalk
                placeholder:text-dim outline-none focus:border-klein transition-colors resize-none"
            />
          </div>
          <Selecteur etiquette="Niveau" value={niveau}
                     onChange={(e) => setNiveau(e.target.value as typeof niveau)}>
            <option value="info">Information</option>
            <option value="warning">Avertissement</option>
            <option value="critical">Critique</option>
          </Selecteur>
        </div>
        <Bouton type="submit" variante="primaire" enCours={enCours} className="mt-5">
          Publier
        </Bouton>
      </form>

      <ul className="grid gap-2.5">
        {annonces.map((a) => (
          <li key={a.id} className={`panel corners p-5 ${a.is_active ? "" : "opacity-55"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-sm text-chalk font-medium">{a.title}</p>
                  <Etiquette ton={NIVEAUX[a.level].ton}>{NIVEAUX[a.level].label}</Etiquette>
                  {!a.is_active && <Etiquette ton="neutre">retirée</Etiquette>}
                </div>
                <p className="text-[11px] font-mono text-dim mt-1.5">{fmtDateTime(a.starts_at)}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Bouton taille="sm" variante="fantome" onClick={() => basculer(a)}>
                  {a.is_active ? "Retirer" : "Réactiver"}
                </Bouton>
                <Bouton taille="sm" variante="danger" onClick={() => supprimer(a)}>
                  Supprimer
                </Bouton>
              </div>
            </div>
            <p className="text-sm text-mist mt-3 leading-relaxed">{a.body}</p>
          </li>
        ))}
      </ul>

      {annonces.length === 0 && (
        <div className="panel corners px-6 py-12 text-center text-mist">Aucune annonce.</div>
      )}
    </div>
  );
}
