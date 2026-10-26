import "server-only";
import { isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_CATEGORIES } from "./editorial";
import { LAUNCH_ARTICLES } from "./launch";
import { readingMinutes } from "./util";

/** Crée les rubriques de base et les articles de lancement (au statut « Prêt ») s'ils n'existent pas encore. */
export async function seedDefaults(authorId?: number) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.categories);
  if (n === 0) {
    await db.insert(schema.categories).values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, position: i, inNav: c.slug !== "culture-football" })));
  }
  if (!authorId) return;
  // Les articles publiés avant la création du premier compte (par migration) sont signés par ce compte.
  await db.update(schema.articles).set({ authorId, createdBy: authorId }).where(isNull(schema.articles.authorId));
  const [{ a }] = await db
    .select({ a: sql<number>`count(*)::int` })
    .from(schema.articles)
    .where(sql`${schema.articles.slug} in ${LAUNCH_ARTICLES.map((l) => l.slug)}`);
  if (a > 0) return;
  const cats = await db.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
  await db.insert(schema.articles).values(
    LAUNCH_ARTICLES.map((l) => ({
      title: l.title,
      slug: l.slug,
      dek: l.dek,
      bodyHtml: l.bodyHtml,
      readingMinutes: readingMinutes(l.bodyHtml),
      status: "approved" as const,
      categoryId: cats.find((c) => c.slug === l.category)?.id ?? null,
      authorId,
      createdBy: authorId,
    })),
  );
}
