// Applique les migrations SQL du dossier drizzle/ (appelé automatiquement avant chaque build).
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL absent : base embarquée, migrations appliquées au démarrage.");
  process.exit(0);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL || url,
  max: 1,
  ssl: local ? undefined : { rejectUnauthorized: false },
});
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("[migrate] base à jour");
  // Supabase expose le schéma public par son API REST : la sécurité par ligne (RLS), sans règle,
  // y ferme l'accès à toutes les tables. Le site, propriétaire des tables, n'est pas concerné.
  // Refait à chaque build pour couvrir aussi les tables ajoutées plus tard.
  const { rows } = await pool.query(`
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity LOOP
        BEGIN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
        EXCEPTION WHEN insufficient_privilege THEN
          RAISE WARNING 'RLS non activée sur % (droits insuffisants)', t.relname;
        END;
      END LOOP;
    END $$;
    SELECT count(*)::int AS open FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;`).then((r) => (Array.isArray(r) ? r[1] : r));
  console.log(`[migrate] sécurité par ligne active sur les tables publiques (${rows[0].open} restante(s) ouverte(s))`);
} catch (e) {
  console.error("[migrate] échec :", e);
  process.exit(1);
} finally {
  await pool.end();
}
