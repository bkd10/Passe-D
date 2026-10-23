import "server-only";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

declare global {
  var __qsDb: Promise<DB> | undefined;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
    return drizzlePg(pool, { schema });
  }
  // Sans DATABASE_URL : base Postgres embarquée (PGlite) pour le développement et les tests.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalThis.__qsDb) {
    globalThis.__qsDb = connect().catch((e) => {
      globalThis.__qsDb = undefined; // on retentera à la prochaine requête
      throw e;
    });
  }
  return globalThis.__qsDb;
}

export { schema };
