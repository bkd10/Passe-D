import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { actorOf, requireApiUser } from "@/lib/auth";
import { ArticleError, loadRef } from "@/lib/articles";
import { canEditArticle } from "@/lib/permissions";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { textToHtml } from "@/lib/translation";
import { getDb, schema } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

const input = z.object({
  title: z.string().trim().max(200),
  dek: z.string().trim().max(600),
  text: z.string().max(100_000),
  published: z.boolean(),
});

export function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const id = Number((await params).id);
    const db = await getDb();
    const { ref } = await loadRef(db, id);
    if (!canEditArticle(actorOf(user), ref)) throw new ArticleError("Vous ne pouvez pas modifier cet article.", 403);
    const v = input.parse(await req.json());
    const title = v.title;
    const html = textToHtml(v.text);
    if (v.published && (!title || !html)) throw new ArticleError("Pour publier la version anglaise, il faut au moins un titre et un texte.");
    await db
      .update(schema.articles)
      .set({ enTitle: title, enDek: v.dek, enBodyHtml: html, enPublished: v.published })
      .where(eq(schema.articles.id, id));
    await audit(user.id, "article.english", "article", id, { published: v.published });
    return NextResponse.json({ ok: true });
  });
}
