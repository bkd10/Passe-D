import { and, desc, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isPublic, promoteScheduled } from "@/lib/queries";
import { SITE_NAME, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Sitemap Google Actualités : uniquement les articles des 48 dernières heures, comme le demande Google. */
export async function GET() {
  await promoteScheduled();
  const db = await getDb();
  const arts = await db
    .select({ slug: schema.articles.slug, title: schema.articles.title, publishedAt: schema.articles.publishedAt })
    .from(schema.articles)
    .where(and(isPublic(), gte(schema.articles.publishedAt, new Date(Date.now() - 48 * 3600_000))))
    .orderBy(desc(schema.articles.publishedAt))
    .limit(1000);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${arts
  .map(
    (a) => `<url>
<loc>${SITE_URL}/articles/${a.slug}</loc>
<news:news>
<news:publication><news:name>${esc(SITE_NAME)}</news:name><news:language>fr</news:language></news:publication>
<news:publication_date>${a.publishedAt!.toISOString()}</news:publication_date>
<news:title>${esc(a.title)}</news:title>
</news:news>
</url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300" } });
}
