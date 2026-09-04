"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Etiquette } from "@/components/ui";
import { fmtRelative } from "@/lib/time";
import type { Profile } from "@/lib/types";

export function GestionEtudiants({
  profils, rechercheInitiale,
}: {
  profils: Profile[];
  rechercheInitiale: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [recherche, setRecherche] = useState(rechercheInitiale);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function agir(
    p: Profile,
    action: "suspendre" | "lever" | "promouvoir" | "retrograder",
  ) {
    setEnCours(p.id);
    const supabase = creerClientNavigateur();

    const { error } =
      action === "suspendre"
        ? await supabase.rpc("admin_set_suspension", { p_user_id: p.id, p_days: 7 })
        : action === "lever"
          ? await supabase.rpc("admin_set_suspension", { p_user_id: p.id, p_days: 0 })
          : await supabase.rpc("admin_set_role", {
              p_user_id: p.id,
              p_role: action === "promouvoir" ? "admin" : "student",
            });

    setEnCours(null);
    if (error) {
      toast({ ton: "erreur", titre: "Action refusée", detail: messageErreur(error) });
    } else {
      const messages = {
        suspendre: "Compte suspendu 7 jours",
        lever: "Suspension levée",
        promouvoir: "Promu administrateur",
        retrograder: "Droits d'administration retirés",
      };
      toast({ ton: "ok", titre: `${p.display_name} · ${messages[action]}` });
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(recherche.trim() ? `/admin/etudiants?q=${encodeURIComponent(recherche.trim())}` : "/admin/etudiants");
        }}
        className="flex gap-2 max-w-md"
      >
        <Champ
          name="q" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une adresse…"
        />
        <Bouton type="submit" variante="secondaire">Chercher</Bouton>
      </form>

      <p className="text-xs font-mono text-dim">
        {profils.length} compte{profils.length > 1 ? "s" : ""}
        {profils.length === 200 && " (200 premiers)"}
      </p>

      <ul className="grid gap-2">
        {profils.map((p) => {
          const suspendu = p.suspended_until && new Date(p.suspended_until) > new Date();
          return (
            <li key={p.id} className="panel corners p-4 flex flex-wrap items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-klein/15 border border-klein/35 grid place-items-center
                text-[10px] font-mono text-klein-2 shrink-0">
                {p.first_name[0]}{p.last_name[0]}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-chalk truncate">{p.display_name}</p>
                <p className="text-[11px] font-mono text-dim truncate">{p.email}</p>
              </div>

              <div className="flex gap-1.5 flex-wrap items-center">
                {p.role === "admin" && <Etiquette ton="info">admin</Etiquette>}
                <Etiquette ton={p.karma >= 80 ? "libre" : p.karma >= 40 ? "occupe" : "panne"}>
                  {p.karma}/100
                </Etiquette>
                {p.no_show_count > 0 && (
                  <Etiquette ton="neutre">
                    {p.no_show_count} absence{p.no_show_count > 1 ? "s" : ""}
                  </Etiquette>
                )}
                {suspendu && (
                  <Etiquette ton="panne" point>
                    suspendu · {fmtRelative(p.suspended_until!)}
                  </Etiquette>
                )}
              </div>

              <div className="flex gap-1.5 shrink-0">
                <Bouton
                  taille="sm"
                  variante={suspendu ? "acide" : "fantome"}
                  enCours={enCours === p.id}
                  onClick={() => agir(p, suspendu ? "lever" : "suspendre")}
                >
                  {suspendu ? "Lever" : "Suspendre"}
                </Bouton>
                <Bouton
                  taille="sm" variante="fantome"
                  enCours={enCours === p.id}
                  onClick={() => agir(p, p.role === "admin" ? "retrograder" : "promouvoir")}
                >
                  {p.role === "admin" ? "Retirer admin" : "Promouvoir"}
                </Bouton>
              </div>
            </li>
          );
        })}
      </ul>

      {profils.length === 0 && (
        <div className="panel corners px-6 py-12 text-center text-mist">
          Aucun compte ne correspond.
        </div>
      )}
    </div>
  );
}
