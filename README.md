<div align="center">

# TAMBOUR

**La buanderie de l'École Centrale Casablanca.**

Réserver une machine pour une heure ou deux, pointer sur place, récupérer son
linge à l'heure. Quatre réservations par semaine et par étudiant — vérifiées
par la base de données, pas par le navigateur.

</div>

---

## Ce que ça fait

| | |
|---|---|
| **Accès centralien** | Seules les adresses `prenom.nom@centrale-casablanca.ma` créent un compte. Contrôle appliqué par un trigger sur `auth.users` : impossible à contourner depuis le client. Connexion par code à six chiffres, sans mot de passe. |
| **Créneaux d'1 h ou 2 h** | L'étudiant choisit la longueur de son créneau ; une réservation compte pour une, quelle que soit sa durée. La grille est ouverte 24 h/24. |
| **Quota de 4 par semaine** | Compté sur la semaine ISO en heure de Casablanca. Modifiable par l'admin depuis l'interface, sans redéploiement. Une annulation anticipée ne consomme rien ; une absence, si. |
| **Horizon de 24 h glissantes** | Un créneau devient réservable 24 h avant son début. Personne ne bloque la semaine entière le lundi matin. |
| **La nuit, hors quota** | Les créneaux de 00 h à 06 h ne se décomptent pas : c'est la soupape de ceux qui ont épuisé leurs quatre réservations. Ils restent réservables quota épuisé, dans le même horizon de 24 h que les autres. |
| **Planning en direct** | Grille machines × créneaux, mise à jour par Supabase Realtime. Un créneau pris disparaît de l'écran des autres dans la seconde. |
| **Zéro double réservation** | Contrainte d'exclusion GiST sur `(machine, intervalle)`. Deux clics simultanés sur le même créneau : un seul passe, garanti par le moteur, pas par une vérification applicative. |
| **Pointage par QR** | Une étiquette par machine. L'appareil photo du téléphone suffit — aucune application à installer. Sans pointage dans le quart d'heure, le créneau repart au pot commun. |
| **File d'attente** | S'inscrire sur un créneau complet ; à la première annulation, la machine est attribuée automatiquement au premier de la file. |
| **Signalement de panne** | Trois signalements par des étudiants distincts retirent la machine du planning d'elle-même. |
| **Chaque réservation a une référence** | `TB-1042`, lisible et citable. Une fiche par réservation : détail du créneau, compte à rebours, déroulé de la réservée à la terminée, et les actions au bon moment. |
| **Historique filtrable** | Toutes ses réservations passées, cherchables par machine ou référence, filtrables par état et par buanderie, avec le total d'heures et le compte d'absences. |
| **Réclamations suivies** | Linge sorti d'une machine, créneau occupé, pointage qui refuse : l'étudiant ouvre un dossier `REC-0001` rattaché à sa réservation et suit les réponses de l'équipe dans un fil, en direct. Côté admin, un triage par état. |
| **Motif de réservation** | Courant, draps, sport, délicat, volumineux — renseigné à la réservation, utile pour l'entretien du parc. |
| **Console admin** | Machines et buanderies (CRUD complet), comptes, suspensions, signalements, réclamations, annonces, réglages, planche de QR codes à imprimer. |
| **Le reste** | Affluence jour × heure sur 8 semaines, statistiques personnelles, empreinte eau/électricité, export iCal, PWA installable, thème clair et sombre. |

## Architecture

```
Navigateur ─┬─ Server Components ── Supabase (session utilisateur, RLS active)
            └─ Client Components ── Supabase Realtime + RPC

                         ┌──────────────────────────────────┐
Vercel Cron ── /api/cron │  PostgreSQL                      │
  toutes les 10 min      │  • triggers = règles métier      │
                         │  • RLS + privilèges par colonne  │
                         │  • contrainte GiST anti-collision│
                         └──────────────────────────────────┘
```

**Le principe :** aucune règle métier ne vit dans le navigateur. Le quota, les
horaires, le domaine e-mail, l'unicité des créneaux sont posés dans PostgreSQL.
L'interface les affiche et traduit les refus — elle ne les décide pas.

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript strict
- **Tailwind CSS v4**, jetons de couleur validés WCAG AA en clair et en sombre
- **Supabase** — Postgres, Auth, Realtime, RLS
- Aucune dépendance d'animation : tout est en CSS

---

## Mise en route

### 1. Créer le projet Supabase

[database.new](https://database.new) → notez la région (Europe pour la latence
depuis le Maroc) et le mot de passe de la base.

### 2. Appliquer les migrations

**Option A — script automatique** (recommandé) :

```bash
cp .env.example .env.local     # renseignez les clés, voir étape 3
npm install
npm run db:setup               # applique 0001 → 0007 dans l'ordre
```

Le script demande la *connection string* de la base
(Supabase → Project Settings → Database → Connection string → URI).

**Option B — à la main :** Supabase → SQL Editor → coller le contenu de chaque
fichier de `supabase/migrations/` **dans l'ordre 0001 → 0007**, et exécuter.

### 3. Variables d'environnement

Dans `.env.local` (développement) puis dans Vercel → Settings → Environment Variables :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys — **secret**, serveur uniquement |
| `NEXT_PUBLIC_SITE_URL` | l'URL publique, ex. `https://tambour.vercel.app` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### 4. Régler l'authentification Supabase

Authentication → **URL Configuration** :
- *Site URL* : votre domaine de production
- *Redirect URLs* : ajoutez `https://votre-domaine/auth/callback` et
  `http://localhost:3000/auth/callback`

Authentication → **Email Templates** → modifiez **les deux** gabarits
suivants pour qu'ils contiennent `{{ .Token }}` — pas un seul :

- ***Magic Link*** : utilisé quand un compte existant se reconnecte.
- ***Confirm signup*** : utilisé au tout premier passage. Comme le compte se
  crée au premier login (pas d'inscription séparée), **c'est ce gabarit que
  reçoit chaque étudiant la toute première fois** — l'oublier revient à ne
  couvrir qu'une reconnexion sur deux.

Le même contenu convient aux deux :

```html
<h2>Votre code Tambour</h2>
<p>Entrez ce code sur le site :</p>
<p style="font-size:32px;letter-spacing:8px;font-family:monospace">{{ .Token }}</p>
<p>Ou cliquez simplement <a href="{{ .ConfirmationURL }}">ici</a>. Le code expire dans 10 minutes.</p>
```

> Le gabarit *Confirm signup* de Supabase, par défaut, ne contient que le
> lien — jamais `{{ .Token }}`. Sans cette modification, le premier passage
> de chaque étudiant reçoit un mail sans code, et cliquer sur le lien échoue
> si l'URL de redirection n'est pas dans la liste ci-dessus.

> Le domaine `@centrale-casablanca.ma` est aussi imposé côté base : même si
> quelqu'un appelle l'API directement, le trigger refuse la création du compte.

**Indispensable avant toute mise en service réelle** — Authentication →
**Settings** → *SMTP Settings* → activez *Enable Custom SMTP*.

Sans ça, Supabase envoie les e-mails via son propre relais, plafonné à
**quelques envois par heure** : correct pour tester seul, bloquant dès que
plusieurs étudiants se connectent la même heure. `email rate limit exceeded`
est le message qui en résulte. Et comme l'authentification est un code à
chaque connexion plutôt qu'un mot de passe une fois pour toutes, ce n'est
pas un pic ponctuel à l'inscription : c'est le régime permanent de l'appli.

Un fournisseur externe suffit largement pour une résidence — [Resend](https://resend.com)
a un palier gratuit confortable et se déclare en cinq champs (hôte, port,
utilisateur, mot de passe, adresse d'expédition) ; Brevo, SendGrid et Postmark
conviennent tout autant si l'École en utilise déjà un.

### 5. Déployer sur Vercel

```bash
npx vercel            # première fois : lie le projet
npx vercel --prod
```

Ou : *Add New → Project* depuis le dépôt GitHub. Le `vercel.json` déclare
le cron d'entretien (toutes les 10 minutes) — il n'y a rien d'autre à configurer.

### 6. Se donner les droits d'administrateur

Connectez-vous une première fois sur le site, puis dans le **SQL Editor** de
Supabase :

```sql
select public.promote_admin('prenom.nom@centrale-casablanca.ma');
```

> Cette fonction n'est **pas** exposée au web : seul `service_role` ou l'éditeur
> SQL peut l'appeler. C'est délibéré — sinon le premier étudiant à la découvrir
> deviendrait administrateur. Une fois le premier admin en place, les suivants
> se nomment depuis *Admin → Étudiants*.

### 7. Renseigner le parc

*Admin → Buanderies* pour créer les salles (horaires, pas de la grille, créneau
le plus long), puis *Admin → Machines*. Enfin *Imprimer les QR codes* : une
étiquette par machine, à coller sur le hublot.

Les buanderies sont ouvertes en continu par défaut (`00:00` → `24:00`), ce qui
rend la tranche de nuit disponible. Vous pouvez les restreindre : la règle des
horaires est alors appliquée comme les autres.

Les migrations installent deux buanderies de démonstration avec six machines
chacune — supprimez-les ou renommez-les.

---

## Développement

```bash
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run db:test    # rejoue les migrations + la suite de tests métier
```

`npm run db:test` a besoin d'un PostgreSQL local (≥ 14) avec `btree_gist`. Il
crée une base jetable, applique les sept migrations et passe **66 vérifications** :
domaine e-mail, longueur des créneaux, quota, horizon glissant, règle des
créneaux de nuit, anti-collision, file d'attente, absences, références, motifs,
cycle de vie des réclamations et cloisonnement des droits — y compris les
tentatives d'élévation de privilèges, par un étudiant comme par un visiteur
anonyme. Une erreur SQL survenue hors assertion fait échouer la suite : sans
ce garde-fou, une section entière pourrait ne rien exécuter sans faire rougir
le total. Les créneaux visés sont calculés en décalage de `now()` : la suite rend
le même verdict à 3 h du matin qu'à midi.

### Structure

```
app/
  page.tsx                  vitrine publique + état du parc en direct
  connexion/                authentification par code
  (app)/
    tableau/                tableau de bord, cycles en cours
    reserver/               la grille de réservation
    machines/               parc en direct, signalement de panne
    historique/             réservations passées, filtres et totaux
    reservation/[reference] fiche d'une réservation, déroulé, actions
    reclamations/           dépôt et suivi des dossiers
    statistiques/           chiffres personnels, affluence
    pointage/[code]/        cible des QR codes
    compte/                 préférences, lien iCal
    admin/                  console d'administration
  api/
    agenda/[token]/         flux iCal personnel
    cron/                   entretien périodique
lib/
  time.ts                   arithmétique horaire Africa/Casablanca
  errors.ts                 SQLSTATE → message lisible
  hooks.ts                  thème, localStorage, capacités navigateur
supabase/migrations/        schéma, règles, RLS, vues, données initiales
proxy.ts                    rafraîchissement de session (ex-middleware)
```

---

## Sécurité

- **RLS active sur toutes les tables.** Un étudiant lit son profil, pas ceux des
  autres.
- **Privilèges par colonne.** `authenticated` n'a le droit `UPDATE` que sur
  `locale`, `theme`, `notify_reminders` et `promo`. Le rôle, le karma et les
  suspensions ne sont pas modifiables — il n'y a pas de politique à contourner,
  le privilège n'existe pas.
- **Aucune politique `UPDATE` sur `bookings` pour les étudiants.** Les
  transitions passent par des fonctions `SECURITY DEFINER` qui vérifient
  elles-mêmes qui appelle.
- **`EXECUTE` révoqué à `PUBLIC`** sur les fonctions d'entretien et d'amorçage —
  PostgreSQL l'accorde par défaut, révoquer sur `authenticated` seul ne suffit
  pas.
- **`/api/cron`** exige `Authorization: Bearer $CRON_SECRET`, et refuse tout
  net si le secret n'est pas configuré.
- **Le flux iCal** est authentifié par un jeton aléatoire par étudiant.

---

<div align="center">
<sub>École Centrale Casablanca</sub>
</div>
