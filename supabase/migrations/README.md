# Migrations

À exécuter **dans l'ordre**, une fois chacune, dans l'éditeur SQL Supabase
(Dashboard → SQL Editor → New query → coller → Run) :

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `0001_schema.sql` | Types, tables, index, contrainte anti-chevauchement |
| 2 | `0002_functions.sql` | Contrôle du domaine e-mail, quota hebdomadaire, horaires |
| 3 | `0003_api.sql` | RPC appelées par l'application |
| 4 | `0004_rls.sql` | Row Level Security et privilèges |
| 5 | `0005_views_seed.sql` | Vues de lecture, réglages, parc de démonstration |

Le script `scripts/setup-supabase.mjs` les applique automatiquement — voir le
README à la racine.

## Se donner les droits d'administrateur

Après votre première connexion sur le site :

```sql
select public.promote_admin('prenom.nom@centrale-casablanca.ma');
```
