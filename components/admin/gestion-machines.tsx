"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Champ, Etiquette, Selecteur, Vide } from "@/components/ui";
import { Tambour } from "@/components/marque";
import type { Machine, MachineKind, MachineStatus, Room } from "@/lib/types";

const STATUTS: Record<MachineStatus, { label: string; ton: "libre" | "occupe" | "panne" }> = {
  operational: { label: "en service", ton: "libre" },
  maintenance: { label: "maintenance", ton: "occupe" },
  out_of_order: { label: "hors service", ton: "panne" },
};

type Brouillon = {
  id?: string;
  room_id: string;
  name: string;
  kind: MachineKind;
  status: MachineStatus;
  capacity_kg: string;
  cycle_minutes: string;
  brand: string;
  model: string;
  position: string;
  note: string;
};

function vierge(roomId: string): Brouillon {
  return {
    room_id: roomId, name: "", kind: "washer", status: "operational",
    capacity_kg: "8", cycle_minutes: "60", brand: "", model: "", position: "1", note: "",
  };
}

export function GestionMachines({
  machinesInitiales,
  buanderies,
}: {
  machinesInitiales: Machine[];
  buanderies: Room[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [edition, setEdition] = useState<Brouillon | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState<string | null>(null);

  if (buanderies.length === 0) {
    return (
      <Vide
        titre="Aucune buanderie"
        detail="Créez d'abord une buanderie : une machine appartient toujours à une salle, qui porte les horaires et la durée des créneaux."
        action={<Link href="/admin/salles"><Bouton variante="primaire">Créer une buanderie</Bouton></Link>}
      />
    );
  }

  const parSalle = buanderies.map((b) => ({
    salle: b,
    machines: machinesInitiales.filter((m) => m.room_id === b.id),
  }));

  async function enregistrer(b: Brouillon) {
    if (!b.name.trim()) {
      toast({ ton: "erreur", titre: "Donnez un nom à la machine." });
      return;
    }
    setEnCours(true);
    const supabase = creerClientNavigateur();

    const charge: Record<string, unknown> = {
      room_id: b.room_id,
      name: b.name.trim(),
      kind: b.kind,
      status: b.status,
      capacity_kg: b.capacity_kg.trim() ? Number(b.capacity_kg) : null,
      cycle_minutes: Number(b.cycle_minutes) || 60,
      brand: b.brand.trim() || null,
      model: b.model.trim() || null,
      position: Number(b.position) || 0,
      note: b.note.trim() || null,
    };

    const { error } = b.id
      ? await supabase.from("machines").update(charge).eq("id", b.id)
      : await supabase.from("machines").insert(charge);

    setEnCours(false);
    if (error) {
      toast({ ton: "erreur", titre: "Enregistrement refusé", detail: messageErreur(error) });
    } else {
      toast({ ton: "ok", titre: b.id ? "Machine mise à jour" : `${b.name} ajoutée au parc` });
      setEdition(null);
      router.refresh();
    }
  }

  async function changerStatut(m: Machine, statut: MachineStatus) {
    const supabase = creerClientNavigateur();
    const { error } = await supabase.from("machines").update({ status: statut }).eq("id", m.id);
    if (error) toast({ ton: "erreur", titre: "Changement refusé", detail: messageErreur(error) });
    else {
      toast({
        ton: statut === "operational" ? "ok" : "info",
        titre: `${m.name} · ${STATUTS[statut].label}`,
        detail: statut === "operational"
          ? "La machine réapparaît dans le planning."
          : "Les créneaux déjà réservés restent, mais plus aucune nouvelle réservation n'est possible.",
      });
      router.refresh();
    }
  }

  async function supprimer(m: Machine) {
    if (suppression !== m.id) {
      setSuppression(m.id);
      setTimeout(() => setSuppression((s) => (s === m.id ? null : s)), 4000);
      return;
    }
    const supabase = creerClientNavigateur();
    const { error } = await supabase.from("machines").delete().eq("id", m.id);
    setSuppression(null);
    if (error) toast({ ton: "erreur", titre: "Suppression refusée", detail: messageErreur(error) });
    else {
      toast({
        ton: "info", titre: `${m.name} supprimée`,
        detail: "Les réservations associées ont été supprimées avec elle.",
      });
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Bouton variante="primaire" onClick={() => setEdition(vierge(buanderies[0].id))}>
          + Ajouter une machine
        </Bouton>
        <Link href="/admin/etiquettes">
          <Bouton variante="secondaire">Imprimer les QR codes</Bouton>
        </Link>
      </div>

      {parSalle.map(({ salle, machines }) => (
        <section key={salle.id}>
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <p className="eyebrow">{salle.name}</p>
            <span className="text-[11px] font-mono text-dim">
              {salle.opens_at.slice(0, 5)}–{salle.closes_at.slice(0, 5)} · créneaux de {salle.slot_minutes} min
            </span>
            {!salle.is_active && <Etiquette ton="panne">fermée</Etiquette>}
          </div>

          {machines.length === 0 ? (
            <div className="panel p-5 text-sm text-dim">Aucune machine dans cette buanderie.</div>
          ) : (
            <ul className="grid gap-2">
              {machines.map((m) => (
                <li key={m.id} className="panel p-4 flex flex-wrap items-center gap-3">
                  <Tambour
                    size={30}
                    className={m.status === "operational"
                      ? m.kind === "washer" ? "text-cat-lavage" : "text-cat-sechage"
                      : "text-coral"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk font-medium truncate">{m.name}</p>
                    <p className="text-[11px] font-mono text-dim mt-0.5 truncate">
                      {m.kind === "washer" ? "lavage" : "séchage"}
                      {m.capacity_kg ? ` · ${m.capacity_kg} kg` : ""}
                      {` · ${m.cycle_minutes} min`}
                      {m.brand ? ` · ${m.brand}` : ""}
                    </p>
                  </div>

                  <Etiquette ton={STATUTS[m.status].ton}>{STATUTS[m.status].label}</Etiquette>

                  <select
                    aria-label={`Statut de ${m.name}`}
                    value={m.status}
                    onChange={(e) => changerStatut(m, e.target.value as MachineStatus)}
                    className="bg-ink-2 border border-line rounded-[8px] px-2 py-1.5 text-[11px]
                      font-mono text-mist outline-none focus:border-klein"
                  >
                    <option value="operational">en service</option>
                    <option value="maintenance">maintenance</option>
                    <option value="out_of_order">hors service</option>
                  </select>

                  <Bouton
                    taille="sm" variante="fantome"
                    onClick={() => setEdition({
                      id: m.id, room_id: m.room_id, name: m.name, kind: m.kind, status: m.status,
                      capacity_kg: m.capacity_kg?.toString() ?? "", cycle_minutes: m.cycle_minutes.toString(),
                      brand: m.brand ?? "", model: m.model ?? "",
                      position: m.position.toString(), note: m.note ?? "",
                    })}
                  >
                    Modifier
                  </Bouton>

                  <Bouton
                    taille="sm"
                    variante={suppression === m.id ? "primaire" : "danger"}
                    onClick={() => supprimer(m)}
                  >
                    {suppression === m.id ? "Confirmer ?" : "Supprimer"}
                  </Bouton>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {edition && (
        <FormulaireMachine
          brouillon={edition}
          buanderies={buanderies}
          enCours={enCours}
          onChange={setEdition}
          onFermer={() => setEdition(null)}
          onEnregistrer={() => enregistrer(edition)}
        />
      )}
    </div>
  );
}

function FormulaireMachine({
  brouillon, buanderies, enCours, onChange, onFermer, onEnregistrer,
}: {
  brouillon: Brouillon;
  buanderies: Room[];
  enCours: boolean;
  onChange: (b: Brouillon) => void;
  onFermer: () => void;
  onEnregistrer: () => void;
}) {
  const set = (k: keyof Brouillon, v: string) => onChange({ ...brouillon, [k]: v });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/85 backdrop-blur-sm overflow-y-auto"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); onEnregistrer(); }}
        className="panel p-6 w-full max-w-lg reveal my-8"
      >
        <p className="eyebrow">{brouillon.id ? "Modification" : "Nouvelle machine"}</p>
        <h2 className="display text-xl mt-2 mb-5 text-chalk">
          {brouillon.id ? brouillon.name : "Ajouter au parc"}
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Champ
              name="nom" etiquette="Nom" value={brouillon.name} autoFocus
              onChange={(e) => set("name", e.target.value)}
              placeholder="Lave-linge 3"
              aide="Ce nom apparaît sur le planning et sur l'étiquette collée sur la machine."
            />
          </div>

          <Selecteur
            etiquette="Buanderie" value={brouillon.room_id}
            onChange={(e) => set("room_id", e.target.value)}
          >
            {buanderies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Selecteur>

          <Selecteur
            etiquette="Type" value={brouillon.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            <option value="washer">Lave-linge</option>
            <option value="dryer">Sèche-linge</option>
          </Selecteur>

          <Champ
            name="capacite" etiquette="Capacité (kg)" inputMode="decimal"
            value={brouillon.capacity_kg} onChange={(e) => set("capacity_kg", e.target.value)}
            placeholder="8"
          />

          <Champ
            name="cycle" etiquette="Durée de cycle (min)" inputMode="numeric"
            value={brouillon.cycle_minutes} onChange={(e) => set("cycle_minutes", e.target.value)}
          />

          <Champ
            name="marque" etiquette="Marque" value={brouillon.brand}
            onChange={(e) => set("brand", e.target.value)} placeholder="Miele"
          />

          <Champ
            name="ordre" etiquette="Ordre d'affichage" inputMode="numeric"
            value={brouillon.position} onChange={(e) => set("position", e.target.value)}
          />

          <div className="sm:col-span-2">
            <Selecteur
              etiquette="Statut" value={brouillon.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="operational">En service</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_order">Hors service</option>
            </Selecteur>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Bouton type="submit" variante="primaire" enCours={enCours} className="flex-1">
            {brouillon.id ? "Enregistrer" : "Ajouter"}
          </Bouton>
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
        </div>
      </form>
    </div>
  );
}
