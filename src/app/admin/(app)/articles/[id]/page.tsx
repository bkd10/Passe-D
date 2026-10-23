import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { actorOf, requireUser } from "@/lib/auth";
import { loadRef, publishProblems } from "@/lib/articles";
import {
  allowedTransitions,
  canDeleteArticle,
  canEditArticle,
  canEditSeo,
  canViewArticle,
  isEditor,
} from "@/lib/permissions";
import { ArticleEditor } from "@/components/admin/article-editor";
import { FORMAT_LABELS, MERCATO_LABELS, MODULES } from "@/lib/editorial";
import { SITE_URL } from "@/lib/util";

export const metadata = { title: "Éditeur" };

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  let loaded;
  try {
    loaded = await loadRef(db, id);
  } catch {
    notFound();
  }
  const { row: a, ref } = loaded;
  const actor = actorOf(user);
  if (!canViewArticle(actor, ref)) {
    return (
      <div className="panel">
        <p>Vous n&apos;avez pas accès à cet article.</p>
        <Link className="btn ghost" href="/admin/articles">Retour</Link>
      </div>
    );
  }

  const mediaIds = [a.coverId, a.ogImageId, ...a.gallery].filter((x): x is number => typeof x === "number");
  const [cats, people, media, tagRows, relatedRows, notes, revisions, mercato, corrections] = await Promise.all([
    db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(schema.categories.position),
    db.select({ id: schema.users.id, name: schema.users.name, active: schema.users.active }).from(schema.users).orderBy(schema.users.name),
    mediaIds.length ? db.select().from(schema.media).where(inArray(schema.media.id, mediaIds)) : Promise.resolve([]),
    db
      .select({ name: schema.tags.name })
      .from(schema.articleTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.articleTags.tagId))
      .where(eq(schema.articleTags.articleId, id)),
    db
      .select({ id: schema.articles.id, title: schema.articles.title, status: schema.articles.status })
      .from(schema.articleRelated)
      .innerJoin(schema.articles, eq(schema.articles.id, schema.articleRelated.relatedId))
      .where(eq(schema.articleRelated.articleId, id)),
    db
      .select({ id: schema.notes.id, body: schema.notes.body, kind: schema.notes.kind, resolved: schema.notes.resolved, createdAt: schema.notes.createdAt, author: schema.users.name })
      .from(schema.notes)
      .leftJoin(schema.users, eq(schema.users.id, schema.notes.authorId))
      .where(eq(schema.notes.articleId, id))
      .orderBy(desc(schema.notes.createdAt)),
    db
      .select({ id: schema.revisions.id, note: schema.revisions.note, createdAt: schema.revisions.createdAt, author: schema.users.name, title: schema.revisions.snapshot })
      .from(schema.revisions)
      .leftJoin(schema.users, eq(schema.users.id, schema.revisions.authorId))
      .where(eq(schema.revisions.articleId, id))
      .orderBy(desc(schema.revisions.createdAt))
      .limit(40),
    db.select().from(schema.mercatoUpdates).where(eq(schema.mercatoUpdates.articleId, id)).orderBy(desc(schema.mercatoUpdates.createdAt)),
    db.select().from(schema.corrections).where(eq(schema.corrections.articleId, id)).orderBy(desc(schema.corrections.createdAt)),
  ]);
  const allTags = await db.select({ name: schema.tags.name }).from(schema.tags).orderBy(schema.tags.name).limit(500);
  const byId = (mid: number | null) => media.find((m) => m.id === mid) ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ser = (v: unknown): any => JSON.parse(JSON.stringify(v)); // dates → chaînes pour le composant client

  return (
    <ArticleEditor
      initial={ser({
        ...a,
        tagNames: tagRows.map((t) => t.name),
        contributorIds: ref.contributorIds ?? [],
        related: relatedRows,
        cover: byId(a.coverId),
        ogImage: byId(a.ogImageId),
        galleryItems: a.gallery.map((g) => byId(g)).filter(Boolean),
      })}
      perms={{
        edit: canEditArticle(actor, ref),
        seo: canEditSeo(actor, ref),
        editor: isEditor(actor),
        del: canDeleteArticle(actor, ref),
        transitions: allowedTransitions(actor, ref),
        create: actor.role !== "contributor",
      }}
      problems={publishProblems(a)}
      options={{
        cats,
        people: people.filter((p) => p.active || p.id === a.authorId || p.id === a.assigneeId).map((p) => ({ id: p.id, name: p.name })),
        formats: Object.entries(FORMAT_LABELS),
        modules: MODULES.map((m) => ({ slug: m.slug, name: m.name, rule: m.rule })),
        mercato: Object.entries(MERCATO_LABELS).map(([k, v]) => [k, v.label]),
        allTags: allTags.map((t) => t.name),
        siteUrl: SITE_URL,
      }}
      notes={ser(notes)}
      revisions={ser(revisions.map((r) => ({ id: r.id, note: r.note, createdAt: r.createdAt, author: r.author, title: String((r.title as Record<string, unknown>).title ?? "") })))}
      mercatoHistory={ser(mercato)}
      corrections={ser(corrections)}
    />
  );
}
