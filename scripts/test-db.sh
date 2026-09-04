#!/usr/bin/env bash
# Rejoue les migrations sur un PostgreSQL local et vérifie les règles métier.
# Nécessite un serveur PostgreSQL ≥ 14 accessible et l'extension btree_gist.
set -uo pipefail

BASE="${TAMBOUR_TEST_DB:-tambour_test}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="${PSQL:-psql}"

echo ""
echo "  Tambour · tests des règles métier"
echo "  base jetable : $BASE"
echo ""

dropdb --if-exists "$BASE" >/dev/null 2>&1
createdb "$BASE" || { echo "  ✗ Impossible de créer la base $BASE"; exit 1; }

# Reproduit ce que Supabase fournit : rôles, schéma auth, auth.uid().
"$PSQL" -q -v ON_ERROR_STOP=1 -d "$BASE" -f "$RACINE/supabase/tests/shim-supabase.sql" 2>&1 \
  | grep -v "NOTICE" | grep . && { echo "  ✗ Échec de l'amorçage"; exit 1; }

echec=0
for f in "$RACINE"/supabase/migrations/0*.sql; do
  sortie=$("$PSQL" -q -v ON_ERROR_STOP=1 -d "$BASE" -f "$f" 2>&1 | grep -v "NOTICE")
  if echo "$sortie" | grep -q "ERROR"; then
    echo "  ✗ $(basename "$f")"
    echo "$sortie" | grep -A3 ERROR | head -12
    echec=1
  else
    echo "  ✓ $(basename "$f")"
  fi
done

[ "$echec" -ne 0 ] && exit 1

# Un seul passage : rejouer la suite fausserait le verdict, l'état de la base
# ayant changé entre-temps.
rapport=$("$PSQL" -q -d "$BASE" -f "$RACINE/supabase/tests/regles.test.sql" 2>&1)

echo ""
echo "$rapport" | grep -E "^ (✓|✗)|━━━" | sed 's/^/  /'
echo ""

reussites=$(echo "$rapport" | grep -c "✓")
echecs=$(echo "$rapport" | grep -c "✗")

if [ "$echecs" -ne 0 ]; then
  echo "  $echecs vérification(s) en échec sur $((reussites + echecs))."
  exit 1
fi
echo "  $reussites vérifications passées — toutes les règles sont respectées."
