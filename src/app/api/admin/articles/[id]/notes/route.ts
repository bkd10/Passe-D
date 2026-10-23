import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { actorOf, requireApiUser } from "@/lib/auth";
import { ArticleError, loadRef } from "@/lib/articles";
import { canViewArticle } from "@/lib/permissions";
import { handle } from "@/lib/api";

const input = z.object({
  body: z.string().trim().min(1).max(2000).optional(),
  kind: z.enum(["comment", "correction"]).default("comment"),
  resolveId: z.number().int().optional(),
});

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const articleId = Number((await params).id);
    const db = await getDb();
    const { ref } = await loadRef(db, articleId);
    if (!canViewArticle(actorOf(user), ref)) throw new ArticleError("Accès refusé", 403);
    const body = input.parse(await req.json());
    if (body.resolveId) {
      await db.update(schema.notes).set({ resolved: true }).where(eq(schema.notes.id, body.resolveId));
    } else if (body.body) {
      await db.insert(schema.notes).values({ articleId, authorId: user.id, body: body.body, kind: body.kind });
    }
    const notes = await db
      .select({ id: schema.notes.id, body: schema.notes.body, kind: schema.notes.kind, resolved: schema.notes.resolved, createdAt: schema.notes.createdAt, author: schema.users.name })
      .from(schema.notes)
      .leftJoin(schema.users, eq(schema.users.id, schema.notes.authorId))
      .where(eq(schema.notes.articleId, articleId))
      .orderBy(desc(schema.notes.createdAt));
    return NextResponse.json({ notes });
  });
}
