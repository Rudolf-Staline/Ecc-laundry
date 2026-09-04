#!/usr/bin/env node
/**
 * Applique les migrations de supabase/migrations/ sur une base Supabase.
 *
 *   npm run db:setup
 *   SUPABASE_DB_URL="postgresql://…" npm run db:setup
 *
 * La chaîne de connexion se trouve dans Supabase →
 * Project Settings → Database → Connection string → URI.
 */
import { readFile, readdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import pg from "pg";

const RACINE = path.join(import.meta.dirname, "..");
const DOSSIER = path.join(RACINE, "supabase", "migrations");

const gris = (t) => `\x1b[2m${t}\x1b[0m`;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

async function chaineConnexion() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL.trim();

  console.log(gras("\n  Tambour · installation de la base\n"));
  console.log(gris("  Supabase → Project Settings → Database → Connection string → URI"));
  console.log(gris("  (pensez à remplacer [YOUR-PASSWORD] par le mot de passe de la base)\n"));

  const rl = createInterface({ input: stdin, output: stdout });
  const reponse = await rl.question("  Connection string : ");
  rl.close();
  return reponse.trim();
}

const url = await chaineConnexion();

if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error(rouge("\n  ✗ Chaîne de connexion invalide (attendu : postgresql://…)\n"));
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1")
    ? undefined
    : { rejectUnauthorized: false },
});

try {
  await client.connect();
} catch (e) {
  console.error(rouge(`\n  ✗ Connexion impossible : ${e.message}\n`));
  process.exit(1);
}

const fichiers = (await readdir(DOSSIER))
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`\n  ${fichiers.length} migration(s) à appliquer\n`);

let echecs = 0;

for (const fichier of fichiers) {
  const sql = await readFile(path.join(DOSSIER, fichier), "utf8");
  process.stdout.write(`  ${fichier.padEnd(28)}`);

  try {
    // Chaque migration dans sa transaction : en cas d'échec, rien n'est
    // appliqué à moitié.
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(vert("✓"));
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.log(rouge("✗"));
    console.error(rouge(`\n     ${e.message}`));
    if (e.hint) console.error(gris(`     ${e.hint}`));
    echecs++;
    break;
  }
}

if (echecs === 0) {
  const { rows } = await client.query(
    `select
       (select count(*) from public.rooms)    as salles,
       (select count(*) from public.machines) as machines,
       (select count(*) from public.settings) as reglages`,
  );
  const { salles, machines, reglages } = rows[0];

  console.log(vert(`\n  ✓ Base prête — ${salles} buanderie(s), ${machines} machine(s), ${reglages} réglages\n`));
  console.log("  Étapes suivantes :");
  console.log(gris("    1. Renseigner les variables d'environnement (voir .env.example)"));
  console.log(gris("    2. Régler Authentication → URL Configuration dans Supabase"));
  console.log(gris("    3. Se connecter une fois sur le site, puis dans le SQL Editor :"));
  console.log(gris("       select public.promote_admin('prenom.nom@centrale-casablanca.ma');\n"));
}

await client.end();
process.exit(echecs === 0 ? 0 : 1);
