import "server-only";
import { and, desc, eq, inArray, notInArray, lte, or, sql, ilike, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";

const { articles, categories, users, media, tags, articleTags } = schema;

let lastPromotion = 0;

/** Publie les articles programmés dont l'heure est passée (pas besoin de tâche planifiée). */
export async function promoteScheduled(force = false) {
  if (!force && Date.now() - lastPromotion < 20_000) return;
  lastPromotion = Date.now();
  const db = await getDb();
  await db
    .update(articles)
    .set({ status: "published", publishedAt: sql`${articles.scheduledAt}` })
    .where(and(eq(articles.status, "scheduled"), lte(articles.scheduledAt, new Date())));
}

export const isPublic = () =>
  and(inArray(articles.status, ["published", "update_needed"]), lte(articles.publishedAt, new Date()))!;

const cover = alias(media, "cover");

export const cardFields = {
  id: articles.id,
  title: articles.title,
  slug: articles.slug,
  dek: articles.dek,
  format: articles.format,
  module: articles.module,
  publishedAt: articles.publishedAt,
  readingMinutes: articles.readingMinutes,
  sponsored: articles.sponsored,
  sponsorName: articles.sponsorName,
  mercatoStatus: articles.mercatoStatus,
  videoUrl: articles.videoUrl,
  featured: articles.featured,
  views: articles.views,
  categoryName: categories.name,
  categorySlug: categories.slug,
  categoryColor: categories.color,
  authorName: users.name,
  authorSlug: users.slug,
  coverUrl: cover.url,
  coverAlt: cover.alt,
  coverCredit: cover.credit,
  coverVariants: cover.variants,
};

export type Card = {
  id: number;
  title: string;
  slug: string;
  dek: string;
  format: string;
  module: string;
  publishedAt: Date | null;
  readingMinutes: number;
  sponsored: boolean;
  sponsorName: string;
  mercatoStatus: string;
  videoUrl: string;
  featured: boolean;
  views: number;
  categoryName: string | null;
  categorySlug: string | null;
  categoryColor: string | null;
  authorName: string | null;
  authorSlug: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  coverCredit: string | null;
  coverVariants: Record<string, string> | null;
};

export type ListOptions = {
  categorySlug?: string;
  categoryId?: number;
  authorId?: number;
  tagId?: number;
  format?: string;
  module?: string;
  q?: string;
  sort?: "recent" | "popular";
  since?: Date;
  limit?: number;
  offset?: number;
  excludeIds?: number[];
  featured?: boolean;
};

export async function listPublic(opts: ListOptions = {}): Promise<Card[]> {
  await promoteScheduled();
  const db = await getDb();
  const where: SQL[] = [isPublic()];
  if (opts.categorySlug) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, opts.categorySlug)).limit(1);
    if (!cat) return [];
    const children = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, cat.id));
    where.push(inArray(articles.categoryId, [cat.id, ...children.map((c) => c.id)]));
  }
  if (opts.categoryId) where.push(eq(articles.categoryId, opts.categoryId));
  if (opts.authorId) where.push(eq(articles.authorId, opts.authorId));
  if (opts.format) where.push(eq(articles.format, opts.format as never));
  if (opts.module) where.push(eq(articles.module, opts.module));
  if (opts.featured) where.push(eq(articles.featured, true));
  if (opts.since) where.push(sql`${articles.publishedAt} >= ${opts.since}`);
  if (opts.excludeIds?.length) where.push(notInArray(articles.id, opts.excludeIds));
  if (opts.tagId) {
    where.push(
      sql`exists (select 1 from ${articleTags} where ${articleTags.articleId} = ${articles.id} and ${articleTags.tagId} = ${opts.tagId})`,
    );
  }
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(articles.title, term), ilike(articles.dek, term), ilike(articles.bodyHtml, term))!);
  }
  return (await db
    .select(cardFields)
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .leftJoin(cover, eq(cover.id, articles.coverId))
    .where(and(...where))
    .orderBy(opts.sort === "popular" ? desc(articles.views) : desc(articles.publishedAt), desc(articles.id))
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0)) as Card[];
}

export async function getPublicArticle(slug: string) {
  await promoteScheduled();
  const db = await getDb();
  const [row] = await db
    .select({ article: articles, category: categories, author: users, cover })
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .leftJoin(cover, eq(cover.id, articles.coverId))
    .where(and(eq(articles.slug, slug), isPublic()))
    .limit(1);
  if (!row) return null;
  return enrichArticle(row);
}

/** Version d'aperçu : renvoie l'article quel que soit son statut (réservé au back-office). */
export async function getArticleForPreview(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ article: articles, category: categories, author: users, cover })
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .leftJoin(cover, eq(cover.id, articles.coverId))
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return null;
  return enrichArticle(row);
}

type Row = {
  article: typeof articles.$inferSelect;
  category: typeof categories.$inferSelect | null;
  author: typeof users.$inferSelect | null;
  cover: typeof media.$inferSelect | null;
};

async function enrichArticle(row: Row) {
  const db = await getDb();
  const id = row.article.id;
  const [tagRows, contributorRows, galleryRows, mercato, corrections, relatedIds] = await Promise.all([
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug, kind: tags.kind })
      .from(articleTags)
      .innerJoin(tags, eq(tags.id, articleTags.tagId))
      .where(eq(articleTags.articleId, id)),
    db
      .select({ id: users.id, name: users.name, slug: users.slug })
      .from(schema.articleContributors)
      .innerJoin(users, eq(users.id, schema.articleContributors.userId))
      .where(eq(schema.articleContributors.articleId, id)),
    row.article.gallery.length
      ? db.select().from(media).where(inArray(media.id, row.article.gallery))
      : Promise.resolve([]),
    db
      .select()
      .from(schema.mercatoUpdates)
      .where(eq(schema.mercatoUpdates.articleId, id))
      .orderBy(desc(schema.mercatoUpdates.createdAt)),
    db
      .select()
      .from(schema.corrections)
      .where(eq(schema.corrections.articleId, id))
      .orderBy(desc(schema.corrections.createdAt)),
    db
      .select({ id: schema.articleRelated.relatedId })
      .from(schema.articleRelated)
      .where(eq(schema.articleRelated.articleId, id)),
  ]);
  const gallery = row.article.gallery
    .map((gid) => galleryRows.find((g) => g.id === gid))
    .filter((g): g is typeof media.$inferSelect => Boolean(g));
  return {
    ...row,
    tags: tagRows,
    contributors: contributorRows,
    gallery,
    mercato,
    corrections,
    relatedIds: relatedIds.map((r) => r.id),
  };
}

export type FullArticle = NonNullable<Awaited<ReturnType<typeof getPublicArticle>>>;

/** Articles associés : d'abord ceux choisis par la rédaction, puis mêmes tags, puis même rubrique. */
export async function relatedFor(a: FullArticle, limit = 4): Promise<Card[]> {
  const db = await getDb();
  const picked: Card[] = [];
  const base = () =>
    db
      .select(cardFields)
      .from(articles)
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .leftJoin(users, eq(users.id, articles.authorId))
      .leftJoin(cover, eq(cover.id, articles.coverId));
  if (a.relatedIds.length) {
    picked.push(...((await base().where(and(isPublic(), inArray(articles.id, a.relatedIds))).limit(limit)) as Card[]));
  }
  const exclude = [a.article.id, ...picked.map((p) => p.id)];
  if (picked.length < limit && a.tags.length) {
    picked.push(
      ...((await base()
        .where(
          and(
            isPublic(),
            notInArray(articles.id, exclude),
            sql`exists (select 1 from ${articleTags} where ${articleTags.articleId} = ${articles.id} and ${inArray(
              articleTags.tagId,
              a.tags.map((t) => t.id),
            )})`,
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(limit - picked.length)) as Card[]),
    );
  }
  if (picked.length < limit && a.article.categoryId) {
    const ex = [a.article.id, ...picked.map((p) => p.id)];
    picked.push(
      ...((await base()
        .where(and(isPublic(), eq(articles.categoryId, a.article.categoryId), notInArray(articles.id, ex)))
        .orderBy(desc(articles.publishedAt))
        .limit(limit - picked.length)) as Card[]),
    );
  }
  return picked;
}

export async function navCategories() {
  const db = await getDb();
  return db.select().from(categories).orderBy(categories.position, categories.name);
}

export async function getCategory(slug: string) {
  const db = await getDb();
  const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return c ?? null;
}

export async function getAuthor(slug: string) {
  const db = await getDb();
  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.slug, slug), ne(users.role, "contributor")))
    .limit(1);
  return u ?? null;
}

export async function getTag(slug: string) {
  const db = await getDb();
  const [t] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return t ?? null;
}

export async function activePoll() {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.active, true))
    .orderBy(desc(schema.polls.createdAt))
    .limit(1);
  return p ?? null;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return (row?.value as T) ?? fallback;
}
