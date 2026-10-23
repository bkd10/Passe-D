import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_CATEGORIES } from "./editorial";

/** Crée les rubriques de base si aucune n'existe encore. */
export async function seedDefaults() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.categories);
  if (n > 0) return;
  await db.insert(schema.categories).values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, position: i, inNav: c.slug !== "culture-football" })));
}
