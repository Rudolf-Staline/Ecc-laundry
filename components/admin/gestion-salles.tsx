"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Etiquette, Selecteur } from "@/components/ui";
import type { Machine, Room } from "@/lib/types";

type Brouillon = {
  id?: string;
  name: string; building: string; description: string;
  opens_at: string; closes_at: string; slot_minutes: string;
  max_blocks: string;
  is_active: boolean; position: string;
};

const VIERGE: Brouillon = {
  name: "", building: "", description: "",
  opens_at: "00:00", closes_at: "24:00", slot_minutes: "60", max_blocks: "2",
  is_active: true, position: "1",
};

export function GestionSalles({
  sallesInitiales, machines,
}: {
  sallesInitiales: Room[];
  machines: Pick<Machine, "id" | "room_id">[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [edition, setEdition] = useState<Brouillon | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState<string | null>(null);

  const compte = (id: string) => machines.filter((m) => m.room_id === id).length;

  async function enregistrer(b: Brouillon) {
    if (!b.name.trim()) {
      toast({ ton: "erreur", titre: "Donnez un nom à la buanderie." });
      return;
    }
    if (b.closes_at <= b.opens_at) {
      toast({ ton: "erreur", titre: "L'heure de fermeture doit suivre l'ouverture." });
      return;
    }

    setEnCours(true);
    const supabase = creerClientNavigateur();
    const charge = {
      name: b.name.trim(),
      building: b.building.trim() || null,
      description: b.description.trim() || null,
      opens_at: b.opens_at,
      closes_at: b.closes_at,
      slot_minutes: Number(b.slot_minutes),
      max_blocks: Number(b.max_blocks) || 1,
      is_active: b.is_active,
      position: Number(b.position) || 0,
    };

    const { error } = b.id
      ? await supabase.from("rooms").update(charge).eq("id", b.id)
      : await supabase.from("rooms").insert(charge);

    setEnCours(false);
    if (error) toast({ ton: "erreur", titre: "Enregistrement refusé", detail: messageErreur(error) });
    else {
      toast({ ton: "ok", titre: b.id ? "Buanderie mise à jour" : `${b.name} créée` });
      setEdition(null);
      router.refresh();
    }
  }

  async function supprimer(s: Room) {
    if (suppression !== s.id) {
      setSuppression(s.id);
      setTimeout(() => setSuppression((x) => (x === s.id ? null : x)), 4000);
      return;
    }
    const supabase = creerClientNavigateur();
    const { error } = await supabase.from("rooms").delete().eq("id", s.id);
    setSuppression(null);
    if (error) toast({ ton: "erreur", titre: "Suppression refusée", detail: messageErreur(error) });
    else {
      toast({
        ton: "info", titre: `${s.name} supprimée`,
        detail: `${compte(s.id)} machine(s) et leurs réservations ont été supprimées.`,
      });
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <Bouton variante="primaire" onClick={() => setEdition({ ...VIERGE })}>
        + Nouvelle buanderie
      </Bouton>

      <ul className="grid gap-2.5">
        {sallesInitiales.map((s) => (
          <li key={s.id} className="panel p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-sm text-chalk font-medium">{s.name}</p>
                {s.is_active
                  ? <Etiquette ton="libre">ouverte</Etiquette>
                  : <Etiquette ton="panne">fermée</Etiquette>}
              </div>
              <p className="text-[11px] font-mono text-dim mt-1.5">
                {s.building ? `${s.building} · ` : ""}
                {s.closes_at.startsWith("24") && s.opens_at.startsWith("00")
                  ? "en continu"
                  : `${s.opens_at.slice(0, 5)}–${s.closes_at.slice(0, 5)}`}
                {` · créneaux de ${s.slot_minutes} min`}
                {s.max_blocks > 1 && `, jusqu'à ${(s.slot_minutes * s.max_blocks) / 60} h`}
                {` · ${compte(s.id)} machine${compte(s.id) > 1 ? "s" : ""}`}
              </p>
              {s.description && <p className="text-xs text-mist mt-1.5">{s.description}</p>}
            </div>

            <Bouton
              taille="sm" variante="fantome"
              onClick={() => setEdition({
                id: s.id, name: s.name, building: s.building ?? "", description: s.description ?? "",
                opens_at: s.opens_at.slice(0, 5), closes_at: s.closes_at.slice(0, 5),
                slot_minutes: s.slot_minutes.toString(),
                max_blocks: (s.max_blocks ?? 2).toString(), is_active: s.is_active,
                position: s.position.toString(),
              })}
            >
              Modifier
            </Bouton>
            <Bouton
              taille="sm"
              variante={suppression === s.id ? "primaire" : "danger"}
              onClick={() => supprimer(s)}
            >
              {suppression === s.id ? `Confirmer (${compte(s.id)} machines) ?` : "Supprimer"}
            </Bouton>
          </li>
        ))}
      </ul>

      {sallesInitiales.length === 0 && (
        <div className="panel px-6 py-12 text-center text-mist">
          Aucune buanderie enregistrée.
        </div>
      )}

      {edition && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/85 backdrop-blur-sm overflow-y-auto"
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setEdition(null); }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); enregistrer(edition); }}
            className="panel p-6 w-full max-w-lg reveal my-8"
          >
            <p className="eyebrow">{edition.id ? "Modification" : "Nouvelle buanderie"}</p>
            <h2 className="display text-xl mt-2 mb-5 text-chalk">
              {edition.id ? edition.name : "Créer une buanderie"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Champ
                  name="nom" etiquette="Nom" autoFocus value={edition.name}
                  onChange={(e) => setEdition({ ...edition, name: e.target.value })}
                  placeholder="Buanderie Résidence A"
                />
              </div>
              <Champ
                name="batiment" etiquette="Bâtiment" value={edition.building}
                onChange={(e) => setEdition({ ...edition, building: e.target.value })}
                placeholder="Résidence A"
              />
              <Champ
                name="ordre" etiquette="Ordre d'affichage" inputMode="numeric" value={edition.position}
                onChange={(e) => setEdition({ ...edition, position: e.target.value })}
              />
              <Champ
                name="ouverture" etiquette="Ouverture" type="time" value={edition.opens_at}
                onChange={(e) => setEdition({ ...edition, opens_at: e.target.value })}
              />
              <Champ
                name="fermeture" etiquette="Fermeture" type="time" value={edition.closes_at}
                onChange={(e) => setEdition({ ...edition, closes_at: e.target.value })}
              />
              <Selecteur
                etiquette="Pas de la grille"
                value={edition.slot_minutes}
                onChange={(e) => setEdition({ ...edition, slot_minutes: e.target.value })}
              >
                {[30, 45, 60, 90, 120].map((v) => (
                  <option key={v} value={v}>{v} minutes</option>
                ))}
              </Selecteur>
              <Selecteur
                etiquette="Créneau le plus long"
                value={edition.max_blocks}
                onChange={(e) => setEdition({ ...edition, max_blocks: e.target.value })}
              >
                {[1, 2, 3, 4].map((v) => (
                  <option key={v} value={v}>
                    {v} bloc{v > 1 ? "s" : ""} — {(Number(edition.slot_minutes) * v) / 60} h
                  </option>
                ))}
              </Selecteur>
              <div className="sm:col-span-2">
                <Champ
                  name="description" etiquette="Description" value={edition.description}
                  onChange={(e) => setEdition({ ...edition, description: e.target.value })}
                  placeholder="Rez-de-chaussée, aile est"
                />
              </div>
              <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox" checked={edition.is_active}
                  onChange={(e) => setEdition({ ...edition, is_active: e.target.checked })}
                  className="w-4 h-4 accent-klein"
                />
                <span className="text-sm text-chalk">
                  Ouverte aux réservations
                  <span className="block text-xs text-dim mt-0.5">
                    Décocher retire la buanderie du planning sans supprimer ses machines.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex gap-2 mt-6">
              <Bouton type="submit" variante="primaire" enCours={enCours} className="flex-1">
                {edition.id ? "Enregistrer" : "Créer"}
              </Bouton>
              <Bouton type="button" variante="fantome" onClick={() => setEdition(null)}>
                Annuler
              </Bouton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
