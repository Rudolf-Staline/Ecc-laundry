"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Etiquette } from "@/components/ui";
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

  async function agir(p: Profile, action: "promouvoir" | "retrograder") {
    setEnCours(p.id);
    const supabase = creerClientNavigateur();

    const { error } = await supabase.rpc("admin_set_role", {
      p_user_id: p.id,
      p_role: action === "promouvoir" ? "admin" : "student",
    });

    setEnCours(null);
    if (error) {
      toast({ ton: "erreur", titre: "Action refusée", detail: messageErreur(error) });
    } else {
      const messages = {
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

      <ul className="grid gap-2 reveal-stagger">
        {profils.map((p) => (
          <li key={p.id} className="panel p-4 flex flex-wrap items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-klein/15 border border-klein/35 grid place-items-center
              text-[10px] font-mono text-klein-2 shrink-0">
              {p.first_name[0]}{p.last_name[0]}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-chalk truncate">{p.display_name}</p>
              <p className="text-[11px] font-mono text-dim truncate">{p.email}</p>
            </div>

            {p.role === "admin" && (
              <div className="flex gap-1.5 flex-wrap items-center">
                <Etiquette ton="info">admin</Etiquette>
              </div>
            )}

            <div className="flex gap-1.5 shrink-0">
              <Bouton
                taille="sm" variante="fantome"
                enCours={enCours === p.id}
                onClick={() => agir(p, p.role === "admin" ? "retrograder" : "promouvoir")}
              >
                {p.role === "admin" ? "Retirer admin" : "Promouvoir"}
              </Bouton>
            </div>
          </li>
        ))}
      </ul>

      {profils.length === 0 && (
        <div className="panel px-6 py-12 text-center text-mist">
          Aucun compte ne correspond.
        </div>
      )}
    </div>
  );
}
