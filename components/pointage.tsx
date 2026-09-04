"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { useCapacite } from "@/lib/hooks";
import { Bouton, Champ, Etiquette, TitreSection } from "@/components/ui";
import { Tambour } from "@/components/marque";
import { fmtTime, fmtRelative } from "@/lib/time";
import type { BoardRow } from "@/lib/types";

/**
 * Le pointage confirme qu'on est bien devant la machine. Trois voies, de la
 * plus simple à la plus manuelle : appareil photo du téléphone sur le QR
 * collé sur la machine (qui ouvre directement /pointage/<code>), scanner
 * intégré si le navigateur le propose, saisie du code à défaut.
 */
export function Pointage({ aPointer }: { aPointer: BoardRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [scanne, setScanne] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);

  const scannerDispo = useCapacite(
    useCallback(() => "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia), []),
  );

  const arreterCamera = useCallback(() => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
  }, []);

  useEffect(() => arreterCamera, [arreterCamera]);

  async function lancerScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      flux.current = stream;
      setScanne(true);
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }

      // @ts-expect-error — BarcodeDetector n'est pas encore dans lib.dom
      const detecteur = new window.BarcodeDetector({ formats: ["qr_code"] });

      const boucle = async () => {
        if (!flux.current || !video.current) return;
        try {
          const codes = await detecteur.detect(video.current);
          if (codes.length > 0) {
            const brut: string = codes[0].rawValue ?? "";
            const extrait = brut.split("/").pop()?.trim() ?? "";
            if (extrait) {
              arreterCamera();
              setScanne(false);
              await pointer(extrait);
              return;
            }
          }
        } catch {
          /* image illisible sur cette frame : on retente */
        }
        requestAnimationFrame(() => void boucle());
      };
      void boucle();
    } catch {
      toast({
        ton: "erreur",
        titre: "Appareil photo indisponible",
        detail: "Saisissez le code inscrit sous le QR de la machine.",
      });
      setScanne(false);
    }
  }

  async function pointer(valeur: string) {
    const propre = valeur.trim().toLowerCase();
    if (!propre) return;

    setEnCours(true);
    const supabase = creerClientNavigateur();
    const { data, error } = await supabase.rpc("check_in", { p_qr: propre });
    setEnCours(false);

    if (error) {
      toast({ ton: "erreur", titre: "Pointage refusé", detail: messageErreur(error) });
      return;
    }

    const b = Array.isArray(data) ? data[0] : data;
    toast({
      ton: "ok",
      titre: "Pointage confirmé",
      detail: b?.ends_at
        ? `Cycle lancé. Fin prévue à ${fmtTime(b.ends_at)}.`
        : "Votre créneau est confirmé.",
    });
    setCode("");
    router.refresh();
    router.push("/tableau");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <TitreSection surtitre="Sur place" titre="Pointer sur la machine" />

      <p className="text-mist leading-relaxed">
        Un QR code est collé sur chaque machine. Scannez-le en arrivant : votre créneau
        passe en cycle et le compte à rebours démarre. Sans pointage dans le quart d&apos;heure,
        le créneau repart au pot commun — c&apos;est ce qui empêche les machines de rester
        bloquées à vide.
      </p>

      {/* Créneaux pointables */}
      {aPointer.length > 0 ? (
        <section className="space-y-2.5">
          <p className="eyebrow">En attente de votre pointage</p>
          {aPointer.map((r) => (
            <div key={r.id} className="panel corners p-4 flex items-center gap-4 border-acid/30">
              <Tambour size={34} className="text-acid" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-chalk font-medium truncate">{r.machine_name}</p>
                <p className="text-xs text-mist mt-0.5">
                  {fmtTime(r.starts_at)} → {fmtTime(r.ends_at)}
                </p>
              </div>
              <Etiquette ton="libre">{fmtRelative(r.starts_at)}</Etiquette>
            </div>
          ))}
        </section>
      ) : (
        <div className="panel corners p-5 border-line">
          <p className="text-sm text-mist">
            Aucun créneau à pointer dans l&apos;heure qui vient. Le pointage s&apos;ouvre
            dix minutes avant le début de votre réservation.
          </p>
        </div>
      )}

      {/* Scanner */}
      {scannerDispo && (
        <section className="panel corners p-5">
          <p className="eyebrow mb-3">Scanner</p>
          {scanne ? (
            <div className="space-y-3">
              <div className="relative rounded-[3px] overflow-hidden border border-klein/40 bg-ink-2">
                <video ref={video} playsInline muted className="w-full aspect-video object-cover" />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="w-40 h-40 border-2 border-acid/70 rounded-[3px]" />
                </div>
              </div>
              <Bouton
                variante="fantome"
                onClick={() => { arreterCamera(); setScanne(false); }}
                className="w-full"
              >
                Arrêter la caméra
              </Bouton>
            </div>
          ) : (
            <Bouton variante="primaire" onClick={lancerScanner} className="w-full">
              Ouvrir l&apos;appareil photo
            </Bouton>
          )}
        </section>
      )}

      {/* Saisie manuelle */}
      <form
        onSubmit={(e) => { e.preventDefault(); void pointer(code); }}
        className="panel corners p-5"
      >
        <p className="eyebrow mb-3">Saisie manuelle</p>
        <Champ
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="a1b2c3d4e5f6g7h8i9"
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
          aide="Le code figure sous le QR code, sur l'étiquette de la machine."
        />
        <Bouton
          type="submit"
          variante="acide"
          enCours={enCours}
          disabled={!code.trim()}
          className="w-full mt-4"
        >
          Pointer
        </Bouton>
      </form>
    </div>
  );
}
