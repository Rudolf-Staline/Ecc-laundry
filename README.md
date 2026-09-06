<div align="center">

# Laundry

**Plateforme indépendante de réservation des machines de buanderie destinée aux étudiants de l'École Centrale Casablanca.**

Consulter les machines disponibles, réserver un créneau, suivre le planning de la buanderie et gérer ses réservations depuis une interface unique.

</div>

---

> [!IMPORTANT]
> **Laundry est un projet indépendant et non officiel.**
>
> Il n'est ni développé, ni édité, ni administré par l'École Centrale Casablanca et ne constitue pas un service institutionnel de l'École. L'utilisation du nom de l'établissement sert uniquement à identifier la communauté à laquelle l'application est destinée.

## Fonctionnalités

### Réservation

- réservation d'un lave-linge ou d'un sèche-linge ;
- créneaux de **1 h ou 2 h** ;
- réservation possible dans un horizon glissant de **24 heures** ;
- quota hebdomadaire configurable ;
- les créneaux de nuit sont soumis au **même quota** que les autres créneaux ;
- contrôle des collisions directement en base de données ;
- mise à jour du planning en temps réel avec Supabase Realtime.

Chaque réservation possède une référence unique permettant de la retrouver rapidement.

### Calendrier

La page **Calendrier** donne une vue journalière de l'activité de la buanderie :

- une colonne par machine ;
- visualisation des créneaux actuellement réservés ;
- navigation entre les journées ;
- filtrage par machine ;
- sélection de la buanderie lorsqu'il en existe plusieurs.

Cette vue permet de comprendre rapidement l'occupation générale du parc sans afficher les informations privées des autres utilisateurs.

### Machines

Les étudiants peuvent consulter l'état des machines disponibles et signaler une panne.

Plusieurs signalements indépendants peuvent entraîner automatiquement le retrait temporaire d'une machine du planning afin d'éviter de nouvelles réservations sur un équipement potentiellement défectueux.

### File d'attente

Lorsqu'un créneau n'est plus disponible, un étudiant peut rejoindre sa file d'attente.

En cas d'annulation, le créneau peut être réattribué automatiquement selon l'ordre d'inscription.

### Historique

Chaque utilisateur dispose d'un historique de ses réservations avec notamment :

- la machine utilisée ;
- la buanderie ;
- la date et l'heure ;
- la durée ;
- le statut ;
- la référence de réservation.

### Administration

Une interface dédiée permet aux administrateurs de gérer :

- les buanderies ;
- les machines ;
- les étudiants ;
- les signalements de panne ;
- les annonces ;
- les paramètres généraux de réservation.

Les règles sensibles ne dépendent pas de l'interface cliente : elles sont appliquées au niveau de PostgreSQL et des fonctions Supabase.

---

## Authentification

L'accès est réservé aux comptes utilisant une adresse institutionnelle autorisée.

La connexion repose sur :

- **e-mail + mot de passe** ;
- validation de l'adresse lors de l'inscription ;
- récupération du mot de passe par code à usage unique.

La restriction du domaine e-mail est également contrôlée côté base de données afin qu'elle ne puisse pas être contournée simplement depuis le navigateur.

---

## Architecture

```text
┌──────────────────────────────┐
│          Navigateur          │
│ Next.js / React / TypeScript │
└──────────────┬───────────────┘
               │
      ┌────────┴─────────┐
      │                  │
      ▼                  ▼
Server Components   Client Components
      │                  │
      │            Supabase Realtime
      │                  │
      └────────┬─────────┘
               ▼
┌──────────────────────────────┐
│           Supabase           │
│                              │
│  PostgreSQL                  │
│  Auth                        │
│  Realtime                    │
│  Row Level Security          │
│  Triggers / RPC              │
└──────────────────────────────┘
               ▲
               │
        entretien périodique
               │
        ┌──────┴──────┐
        │ Vercel Cron │
        └─────────────┘
```

Le principe général est simple : **les règles métier importantes sont garanties par la base de données, pas seulement par l'interface.**

Cela concerne notamment :

- les quotas ;
- les droits d'accès ;
- les horaires ;
- les collisions entre réservations ;
- les transitions d'état ;
- les permissions administrateur.

---

## Stack technique

| Technologie | Utilisation |
|---|---|
| **Next.js 16** | Framework web, App Router et Server Components |
| **React 19** | Interface utilisateur |
| **TypeScript** | Typage statique |
| **Tailwind CSS 4** | Styles et responsive design |
| **Supabase Auth** | Authentification |
| **PostgreSQL** | Stockage et règles métier |
| **Supabase Realtime** | Synchronisation du planning |
| **Row Level Security** | Isolation et contrôle d'accès |
| **Vercel** | Hébergement et tâches planifiées |

Les animations de l'interface sont principalement réalisées en CSS afin de conserver une application légère.

---

## Installation

### Prérequis

- Node.js récent ;
- npm ;
- un projet Supabase ;
- PostgreSQL local si vous souhaitez lancer les tests de base de données.

### Cloner le dépôt

```bash
git clone https://github.com/Rudolf-Staline/Ecc-laundry.git
cd Ecc-laundry
npm install
```

### Variables d'environnement

Copiez le fichier d'exemple :

```bash
cp .env.example .env.local
```

Puis renseignez :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` est une clé sensible et ne doit jamais être exposée côté client.

---

## Base de données

Les migrations SQL se trouvent dans :

```text
supabase/migrations/
```

Elles peuvent être appliquées automatiquement avec :

```bash
npm run db:setup
```

Le script demande la chaîne de connexion PostgreSQL du projet Supabase.

Il est également possible d'exécuter les migrations manuellement depuis le **SQL Editor** de Supabase en respectant leur ordre.

---

## Configuration de Supabase Auth

Dans :

```text
Authentication → URL Configuration
```

configurez l'URL publique du site et ajoutez notamment les redirections :

```text
http://localhost:3000/auth/callback
https://votre-domaine.tld/auth/callback
```

### Confirmation d'inscription

Laundry utilise un **code saisi par l'utilisateur** plutôt qu'un lien de confirmation comme mécanisme principal.

Le template Supabase *Confirm signup* peut par exemple contenir :

```html
<h2>Confirmez votre inscription</h2>
<p>Entrez ce code sur Laundry :</p>
<p style="font-size:32px;letter-spacing:8px;font-family:monospace">
  {{ .Token }}
</p>
<p>Ce code est temporaire.</p>
```

### Mot de passe oublié

Le même principe est utilisé pour la récupération du compte :

```html
<h2>Réinitialisation de votre mot de passe</h2>
<p>Entrez ce code sur Laundry :</p>
<p style="font-size:32px;letter-spacing:8px;font-family:monospace">
  {{ .Token }}
</p>
<p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
```

Cette approche évite de dépendre exclusivement de liens à usage unique susceptibles d'être préouverts par certains systèmes de sécurité de messagerie.

Pour un déploiement réel avec plusieurs utilisateurs, l'utilisation d'un **SMTP externe** est recommandée plutôt que le relais de test fourni par défaut par Supabase.

---

## Développement

Lancer le serveur :

```bash
npm run dev
```

L'application est ensuite disponible sur `http://localhost:3000`.

### Vérifications

```bash
npm run typecheck
npm run lint
npm run build
```

### Tests de la base de données

```bash
npm run db:test
```

Les tests vérifient notamment les règles métier et les restrictions de sécurité directement au niveau PostgreSQL.

---

## Déploiement

Le projet est prévu pour être déployé sur **Vercel**.

### Avec Vercel CLI

```bash
npx vercel
npx vercel --prod
```

### Depuis GitHub

Le dépôt peut également être importé directement depuis l'interface Vercel.

Ajoutez ensuite dans les variables d'environnement du projet les mêmes valeurs que celles définies dans `.env.local`.

---

## Structure du projet

```text
app/
├── connexion/
├── inscription/
├── reinitialiser-mot-de-passe/
│
├── (app)/
│   ├── tableau/
│   ├── reserver/
│   ├── calendrier/
│   ├── machines/
│   ├── historique/
│   ├── reservation/
│   ├── compte/
│   └── admin/
│
└── api/
    ├── agenda/
    └── cron/

components/
lib/

supabase/
└── migrations/

scripts/
```

---

## Sécurité

Plusieurs protections sont appliquées directement côté serveur et base de données :

- **Row Level Security** sur les données utilisateurs ;
- séparation des privilèges étudiant / administrateur ;
- validation du domaine e-mail ;
- contrôle des quotas en base ;
- prévention des doubles réservations ;
- opérations sensibles réalisées via des fonctions contrôlées ;
- protection de l'endpoint Cron par secret ;
- gestion des mots de passe entièrement déléguée à Supabase Auth.

Aucune clé `service_role` ne doit être exposée au navigateur.

---

## Statut du projet

Laundry est actuellement un **projet indépendant destiné à faciliter l'organisation de la buanderie étudiante**.

Il peut être adapté à d'autres résidences ou établissements en modifiant notamment :

- le domaine e-mail autorisé ;
- les buanderies ;
- le parc de machines ;
- les horaires ;
- les quotas de réservation.

---

## Affiliation

Ce dépôt est un projet indépendant.

**Laundry n'est pas un produit officiel de l'École Centrale Casablanca et n'implique aucune approbation, certification ou responsabilité de sa part.**

Les marques, noms ou références à des établissements tiers restent la propriété de leurs détenteurs respectifs.
