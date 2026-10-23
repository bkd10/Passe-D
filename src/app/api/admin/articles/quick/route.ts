import { NextResponse } from "next/server";
import { z } from "zod";
import { actorOf, requireApiUser } from "@/lib/auth";
import { getDb } from "@/db";
import { ArticleError, changeStatus, createArticle, loadRef, saveArticle } from "@/lib/articles";
import { can, isEditor } from "@/lib/permissions";
import { handle } from "@/lib/api";

const input = z.object({
  action: z.enum(["publish", "schedule", "review", "draft"]),
  categoryId: z.number().int().nullable(),
  title: z.string().trim().max(200),
  dek: z.string().trim().max(600).default(""),
  coverId: z.number().int().nullable().default(null),
  videoUrl: z.string().trim().max(500).default(""),
  body: z.unknown().optional(),
  bodyHtml: z.string().max(400_000).default(""),
  authorId: z.number().int().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  archiveAt: z.string().nullable().optional(),
});

/** Publication rapide : crée l'article, le remplit et lui donne son statut en un seul envoi. */
export function POST(req: Request) {
  return handle(async () => {
    const actor = actorOf(await requireApiUser(req));
    const b = input.parse(await req.json());
    if ((b.action === "publish" || b.action === "schedule") && !can.publish(actor)) {
      throw new ArticleError("Seule la rédaction en chef peut publier. Envoyez l'article en relecture.", 403);
    }
    if (b.action !== "draft") {
      const missing: string[] = [];
      if (!b.categoryId) missing.push("la rubrique");
      if (!b.title) missing.push("le titre");
      if (b.bodyHtml.replace(/<[^>]+>/g, "").trim().length < 20 && !b.videoUrl) missing.push("le texte (ou une vidéo)");
      if (missing.length) throw new ArticleError(`Il manque ${missing.join(", ")}.`, 422);
    }
    const row = await createArticle(actor, {
      title: b.title,
      categoryId: b.categoryId,
      status: "writing",
      format: b.videoUrl && b.bodyHtml.replace(/<[^>]+>/g, "").trim().length < 200 ? "video" : "article",
    });
    await saveArticle(actor, row.id, {
      dek: b.dek,
      coverId: b.coverId,
      videoUrl: b.videoUrl,
      body: b.body,
      bodyHtml: b.bodyHtml,
      archiveAt: b.archiveAt ?? null,
      ...(isEditor(actor) && b.authorId && b.authorId !== actor.id ? { authorId: b.authorId } : {}),
      revisionNote: "Publication rapide",
    });
    const to = { publish: "published", schedule: "scheduled", review: "review", draft: null }[b.action] as "published" | "scheduled" | "review" | null;
    if (to) {
      try {
        await changeStatus(actor, row.id, to, { scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : undefined });
      } catch (e) {
        // L'article est gardé en brouillon : on renvoie vers l'éditeur avec le message.
        const msg = e instanceof Error ? e.message : "Statut refusé";
        return NextResponse.json({ id: row.id, error: `${msg} L'article est enregistré en brouillon.` }, { status: 422 });
      }
    }
    const { row: saved } = await loadRef(await getDb(), row.id);
    return NextResponse.json({ id: row.id, slug: saved.slug, status: saved.status });
  });
}
