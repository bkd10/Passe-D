import "server-only";
import { z } from "zod";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "@/db";
import { FORMATS, MERCATO_STATUSES, STATUSES, type Status } from "@/db/schema";
import {
  allowedTransitions,
  canDeleteArticle,
  canEditArticle,
  canEditSeo,
  canTransition,
  canViewArticle,
  isEditor,
  type Actor,
  type ArticleRef,
} from "./permissions";
import { cleanArticleHtml } from "./sanitize";
import { readingMinutes, slugify } from "./util";
import { audit } from "./audit";
import { promoteScheduled } from "./queries";

const { articles } = schema;
export type ArticleRow = typeof articles.$inferSelect;

export class ArticleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : v === null ? null : undefined))
  .refine((d) => d === undefined || d === null || !isNaN(d.getTime()), "Date invalide");

export const articleInput = z.object({
  version: z.number().int().optional(),
  title: z.string().trim().max(200).optional(),
  slug: z.string().trim().max(120).optional(),
  dek: z.string().trim().max(600).optional(),
  body: z.unknown().optional(),
  bodyHtml: z.string().max(400_000).optional(),
  format: z.enum(FORMATS).optional(),
  categoryId: z.number().int().nullable().optional(),
  authorId: z.number().int().nullable().optional(),
  assigneeId: z.number().int().nullable().optional(),
  contributorIds: z.array(z.number().int()).max(20).optional(),
  coverId: z.number().int().nullable().optional(),
  gallery: z.array(z.number().int()).max(60).optional(),
  videoUrl: z.string().trim().max(500).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  deadline: optionalDate,
  scheduledAt: optionalDate,
  featured: z.boolean().optional(),
  module: z.string().max(60).optional(),
  sponsored: z.boolean().optional(),
  sponsorName: z.string().trim().max(120).optional(),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  canonicalUrl: z.string().trim().max(500).optional(),
  ogImageId: z.number().int().nullable().optional(),
  mercatoStatus: z.union([z.enum(MERCATO_STATUSES), z.literal("")]).optional(),
  mercatoSource: z.string().trim().max(300).optional(),
  tagNames: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  relatedIds: z.array(z.number().int()).max(10).optional(),
  revisionNote: z.string().max(200).optional(),
});
export type ArticleInput = z.infer<typeof articleInput>;

// Champs que seuls les chefs peuvent modifier.
const EDITOR_ONLY: (keyof ArticleInput)[] = ["assigneeId", "priority", "deadline", "featured", "sponsored", "sponsorName", "authorId"];
// Champs ouverts au rôle SEO même s'il n'est pas auteur.
const SEO_FIELDS: (keyof ArticleInput)[] = ["seoTitle", "seoDescription", "canonicalUrl", "ogImageId", "tagNames", "slug", "relatedIds", "version"];

export async function loadRef(db: DB, id: number): Promise<{ row: ArticleRow; ref: ArticleRef }> {
  const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!row) throw new ArticleError("Article introuvable", 404);
  const contribs = await db
    .select({ id: schema.articleContributors.userId })
    .from(schema.articleContributors)
    .where(eq(schema.articleContributors.articleId, id));
  return {
    row,
    ref: {
      status: row.status,
      authorId: row.authorId,
      assigneeId: row.assigneeId,
      createdBy: row.createdBy,
      contributorIds: contribs.map((c) => c.id),
    },
  };
}

async function uniqueSlug(db: DB, base: string, exceptId?: number) {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const clash = await db
      .select({ id: articles.id })
      .from(articles)
      .where(exceptId ? and(eq(articles.slug, slug), ne(articles.id, exceptId)) : eq(articles.slug, slug))
      .limit(1);
    if (!clash.length) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createArticle(actor: Actor, init: { title?: string; categoryId?: number | null; status?: Status; assigneeId?: number | null; deadline?: Date | null; format?: string; module?: string } = {}) {
  if (!actor.active || actor.role === "contributor") throw new ArticleError("Vous ne pouvez pas créer d'article.", 403);
  const db = await getDb();
  const title = init.title?.trim() || "Sans titre";
  let status: Status = init.status ?? "writing";
  if (!isEditor(actor) && !["idea", "writing"].includes(status)) status = "writing";
  const [row] = await db
    .insert(articles)
    .values({
      title,
      slug: await uniqueSlug(db, title),
      status,
      categoryId: init.categoryId ?? null,
      authorId: actor.id,
      assigneeId: isEditor(actor) ? (init.assigneeId ?? null) : null,
      deadline: isEditor(actor) ? (init.deadline ?? null) : null,
      format: (FORMATS as readonly string[]).includes(init.format ?? "") ? (init.format as never) : "article",
      module: init.module ?? "",
      createdBy: actor.id,
    })
    .returning();
  await audit(actor.id, "create", "article", row.id, { title });
  return row;
}

export async function saveArticle(actor: Actor, id: number, raw: unknown) {
  const input = articleInput.parse(raw);
  const db = await getDb();
  const { row, ref } = await loadRef(db, id);
  const fullEdit = canEditArticle(actor, ref);
  const seoEdit = canEditSeo(actor, ref);
  if (!fullEdit && !seoEdit) throw new ArticleError("Vous ne pouvez pas modifier cet article dans son statut actuel.", 403);

  const touched = (Object.keys(input) as (keyof ArticleInput)[]).filter((k) => input[k] !== undefined);
  if (!fullEdit) {
    const forbidden = touched.filter((k) => !SEO_FIELDS.includes(k));
    if (forbidden.length) throw new ArticleError("Votre rôle ne permet de modifier que le référencement.", 403);
  }
  if (!isEditor(actor)) {
    const forbidden = touched.filter((k) => EDITOR_ONLY.includes(k));
    if (forbidden.length) throw new ArticleError("Ces réglages sont réservés à la rédaction en chef.", 403);
  }
  if (input.version !== undefined && input.version !== row.version) {
    throw new ArticleError("Cet article a été modifié par quelqu'un d'autre entre-temps. Rechargez la page pour récupérer sa version.", 409);
  }

  const patch: Partial<typeof articles.$inferInsert> = { updatedAt: new Date(), version: row.version + 1 };
  const copy = <K extends keyof typeof articles.$inferInsert>(k: K, v: (typeof articles.$inferInsert)[K] | undefined) => {
    if (v !== undefined) patch[k] = v;
  };
  copy("title", input.title === "" ? "Sans titre" : input.title);
  copy("dek", input.dek);
  copy("format", input.format);
  copy("categoryId", input.categoryId);
  copy("authorId", input.authorId);
  copy("assigneeId", input.assigneeId);
  copy("coverId", input.coverId);
  copy("gallery", input.gallery);
  copy("videoUrl", input.videoUrl);
  copy("priority", input.priority);
  copy("deadline", input.deadline);
  copy("featured", input.featured);
  copy("module", input.module);
  copy("sponsored", input.sponsored);
  copy("sponsorName", input.sponsorName);
  copy("seoTitle", input.seoTitle);
  copy("seoDescription", input.seoDescription);
  copy("canonicalUrl", input.canonicalUrl);
  copy("ogImageId", input.ogImageId);
  copy("mercatoSource", input.mercatoSource);
  if (input.scheduledAt !== undefined) {
    if (!isEditor(actor)) throw new ArticleError("La programmation est réservée à la rédaction en chef.", 403);
    patch.scheduledAt = input.scheduledAt;
  }
  if (input.bodyHtml !== undefined) {
    const html = cleanArticleHtml(input.bodyHtml);
    patch.bodyHtml = html;
    patch.body = input.body ?? null;
    patch.readingMinutes = readingMinutes(html);
  }
  if (input.slug !== undefined) {
    // Une URL publiée ne change plus : on protège le référencement et les liens partagés.
    const wasPublished = row.publishedAt !== null && ["published", "update_needed"].includes(row.status);
    if (!wasPublished || isEditor(actor) || actor.role === "seo") {
      patch.slug = await uniqueSlug(db, input.slug || input.title || row.title, id);
    }
  }
  if (input.mercatoStatus !== undefined && input.mercatoStatus !== row.mercatoStatus) {
    patch.mercatoStatus = input.mercatoStatus;
    if (input.mercatoStatus) {
      await db.insert(schema.mercatoUpdates).values({
        articleId: id,
        status: input.mercatoStatus,
        source: input.mercatoSource ?? row.mercatoSource,
        authorId: actor.id,
      });
    }
  }
  if (["published", "update_needed"].includes(row.status) && (input.bodyHtml !== undefined || input.title !== undefined)) {
    patch.updatedContentAt = new Date();
  }

  const [saved] = await db.update(articles).set(patch).where(eq(articles.id, id)).returning();

  if (input.contributorIds && fullEdit) {
    await db.delete(schema.articleContributors).where(eq(schema.articleContributors.articleId, id));
    const ids = [...new Set(input.contributorIds)];
    if (ids.length) await db.insert(schema.articleContributors).values(ids.map((userId) => ({ articleId: id, userId })));
  }
  if (input.tagNames) await setTags(db, id, input.tagNames);
  if (input.relatedIds) {
    await db.delete(schema.articleRelated).where(eq(schema.articleRelated.articleId, id));
    const ids = [...new Set(input.relatedIds)].filter((r) => r !== id);
    if (ids.length) await db.insert(schema.articleRelated).values(ids.map((relatedId) => ({ articleId: id, relatedId })));
  }
  await maybeSnapshot(db, saved, actor.id, input.revisionNote);
  return saved;
}

async function setTags(db: DB, articleId: number, names: string[]) {
  const ids: number[] = [];
  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const slug = slugify(name);
    const [existing] = await db.select().from(schema.tags).where(eq(schema.tags.slug, slug)).limit(1);
    if (existing) ids.push(existing.id);
    else {
      const [t] = await db.insert(schema.tags).values({ name, slug }).returning();
      ids.push(t.id);
    }
  }
  await db.delete(schema.articleTags).where(eq(schema.articleTags.articleId, articleId));
  if (ids.length) await db.insert(schema.articleTags).values(ids.map((tagId) => ({ articleId, tagId })));
}

function snapshotOf(a: ArticleRow) {
  return {
    title: a.title,
    slug: a.slug,
    dek: a.dek,
    body: a.body,
    bodyHtml: a.bodyHtml,
    format: a.format,
    categoryId: a.categoryId,
    coverId: a.coverId,
    gallery: a.gallery,
    videoUrl: a.videoUrl,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    status: a.status,
  };
}

/** Une révision au plus toutes les 10 minutes par auteur, plus une à chaque note explicite. */
async function maybeSnapshot(db: DB, a: ArticleRow, authorId: number, note?: string) {
  const [last] = await db
    .select()
    .from(schema.revisions)
    .where(eq(schema.revisions.articleId, a.id))
    .orderBy(desc(schema.revisions.createdAt))
    .limit(1);
  const stale = !last || last.authorId !== authorId || Date.now() - last.createdAt.getTime() > 10 * 60_000;
  if (note || stale) {
    await db.insert(schema.revisions).values({ articleId: a.id, snapshot: snapshotOf(a), authorId, note: note ?? "" });
  }
}

export async function changeStatus(actor: Actor, id: number, to: Status, opts: { scheduledAt?: Date | null; note?: string } = {}) {
  if (!STATUSES.includes(to)) throw new ArticleError("Statut inconnu");
  const db = await getDb();
  const { row, ref } = await loadRef(db, id);
  if (!canTransition(actor, ref, to)) {
    throw new ArticleError("Vous ne pouvez pas donner ce statut à cet article.", 403);
  }
  const patch: Partial<typeof articles.$inferInsert> = { status: to, updatedAt: new Date(), version: row.version + 1 };
  if (to === "published" || to === "scheduled") {
    const problems = publishProblems(row);
    if (problems.length) throw new ArticleError("Impossible de publier : " + problems.join(" ; "), 422);
  }
  if (to === "published") {
    patch.publishedAt = row.publishedAt && ["update_needed", "archived"].includes(row.status) ? row.publishedAt : new Date();
    patch.scheduledAt = null;
  }
  if (to === "scheduled") {
    const when = opts.scheduledAt ?? row.scheduledAt;
    if (!when || when.getTime() < Date.now() - 60_000) throw new ArticleError("Choisissez une date de publication à venir.", 422);
    patch.scheduledAt = when;
    patch.publishedAt = null;
  }
  if (to === "assigned" && !row.assigneeId) throw new ArticleError("Choisissez d'abord la personne assignée.", 422);
  const [saved] = await db.update(articles).set(patch).where(eq(articles.id, id)).returning();
  if (opts.note?.trim()) {
    await db.insert(schema.notes).values({
      articleId: id,
      authorId: actor.id,
      body: opts.note.trim(),
      kind: to === "changes" ? "correction" : to === "approved" ? "validation" : "comment",
    });
  }
  await db.insert(schema.revisions).values({
    articleId: id,
    snapshot: snapshotOf(saved),
    authorId: actor.id,
    note: `Statut : ${row.status} → ${to}`,
  });
  await audit(actor.id, "status", "article", id, { from: row.status, to });
  if (to === "published" || to === "scheduled") await promoteScheduled(true);
  return saved;
}

export function publishProblems(a: ArticleRow): string[] {
  const p: string[] = [];
  if (!a.title.trim() || a.title === "Sans titre") p.push("le titre manque");
  if (a.bodyHtml.replace(/<[^>]+>/g, "").trim().length < 20 && !a.videoUrl) p.push("le texte est vide");
  if (!a.categoryId) p.push("choisissez une rubrique");
  if (a.sponsored && !a.sponsorName.trim()) p.push("indiquez le partenaire du contenu sponsorisé");
  if (a.mercatoStatus && !a.mercatoSource.trim()) p.push("une info mercato doit citer sa source");
  return p;
}

export async function duplicateArticle(actor: Actor, id: number) {
  const db = await getDb();
  const { row, ref } = await loadRef(db, id);
  if (!canViewArticle(actor, ref) || actor.role === "contributor") throw new ArticleError("Accès refusé", 403);
  const copy = await createArticle(actor, { title: `${row.title} (copie)`, categoryId: row.categoryId, format: row.format, module: row.module });
  await db
    .update(articles)
    .set({ dek: row.dek, body: row.body, bodyHtml: row.bodyHtml, coverId: row.coverId, gallery: row.gallery, videoUrl: row.videoUrl, readingMinutes: row.readingMinutes })
    .where(eq(articles.id, copy.id));
  await audit(actor.id, "duplicate", "article", copy.id, { from: id });
  return copy;
}

export async function deleteArticle(actor: Actor, id: number) {
  const db = await getDb();
  const { row, ref } = await loadRef(db, id);
  if (!canDeleteArticle(actor, ref)) throw new ArticleError("Suppression refusée. Archivez plutôt l'article.", 403);
  await db.delete(articles).where(eq(articles.id, id));
  await audit(actor.id, "delete", "article", id, { title: row.title, slug: row.slug });
}

export async function restoreRevision(actor: Actor, articleId: number, revisionId: number) {
  const db = await getDb();
  const { ref } = await loadRef(db, articleId);
  if (!canEditArticle(actor, ref)) throw new ArticleError("Accès refusé", 403);
  const [rev] = await db
    .select()
    .from(schema.revisions)
    .where(and(eq(schema.revisions.id, revisionId), eq(schema.revisions.articleId, articleId)))
    .limit(1);
  if (!rev) throw new ArticleError("Version introuvable", 404);
  const s = rev.snapshot as Record<string, unknown>;
  const [saved] = await db
    .update(articles)
    .set({
      title: String(s.title ?? ""),
      dek: String(s.dek ?? ""),
      body: s.body ?? null,
      bodyHtml: String(s.bodyHtml ?? ""),
      coverId: (s.coverId as number | null) ?? null,
      gallery: (s.gallery as number[]) ?? [],
      videoUrl: String(s.videoUrl ?? ""),
      seoTitle: String(s.seoTitle ?? ""),
      seoDescription: String(s.seoDescription ?? ""),
      updatedAt: new Date(),
      version: sql`${articles.version} + 1`,
    })
    .where(eq(articles.id, articleId))
    .returning();
  await db.insert(schema.revisions).values({ articleId, snapshot: snapshotOf(saved), authorId: actor.id, note: `Restauration de la version du ${rev.createdAt.toISOString().slice(0, 16).replace("T", " ")}` });
  await audit(actor.id, "restore", "article", articleId, { revisionId });
  return saved;
}

export async function addCorrection(actor: Actor, articleId: number, body: string) {
  if (!isEditor(actor)) throw new ArticleError("Réservé à la rédaction en chef", 403);
  const db = await getDb();
  await db.insert(schema.corrections).values({ articleId, body: body.trim().slice(0, 1000) });
  await db.update(articles).set({ updatedContentAt: new Date() }).where(eq(articles.id, articleId));
  await audit(actor.id, "correction", "article", articleId, { body });
}

export { allowedTransitions };
