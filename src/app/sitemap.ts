import type { MetadataRoute } from "next";
import { desc, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isPublic, navCategories, promoteScheduled } from "@/lib/queries";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await promoteScheduled();
  const db = await getDb();
  const [arts, cats, authors] = await Promise.all([
    db
      .select({ slug: schema.articles.slug, publishedAt: schema.articles.publishedAt, updated: schema.articles.updatedContentAt, en: schema.articles.enPublished, enTitle: schema.articles.enTitle })
      .from(schema.articles)
      .where(isPublic())
      .orderBy(desc(schema.articles.publishedAt))
      .limit(45000),
    navCategories(),
    db.select({ slug: schema.users.slug }).from(schema.users).where(ne(schema.users.role, "contributor")),
  ]);
  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    ...cats.map((c) => ({ url: `${SITE_URL}/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...arts.map((a) => ({ url: `${SITE_URL}/articles/${a.slug}`, lastModified: a.updated ?? a.publishedAt ?? undefined, priority: 0.7 })),
    ...(arts.some((a) => a.en && a.enTitle) ? [{ url: `${SITE_URL}/en`, changeFrequency: "daily" as const, priority: 0.6 }] : []),
    ...arts.filter((a) => a.en && a.enTitle).map((a) => ({ url: `${SITE_URL}/en/articles/${a.slug}`, lastModified: a.updated ?? a.publishedAt ?? undefined, priority: 0.6 })),
    ...authors.map((u) => ({ url: `${SITE_URL}/auteurs/${u.slug}`, priority: 0.3 })),
  ];
}
