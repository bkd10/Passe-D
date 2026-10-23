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
} catch (e) {
  console.error("[migrate] échec :", e);
  process.exit(1);
} finally {
  await pool.end();
}
