import { redirect } from "next/navigation";

/**
 * L'accueil n'est plus une vitrine : on y arrive seulement pour repartir
 * aussitôt vers la connexion (elle-même renvoie vers /tableau si une
 * session valide existe déjà — voir middleware.ts).
 */
export default function Accueil() {
  redirect("/connexion");
}
