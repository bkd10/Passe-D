import { NextResponse } from "next/server";
import { actorOf, requireApiUser } from "@/lib/auth";
import { deleteArticle, saveArticle } from "@/lib/articles";
import { handle } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const { id } = await params;
    const saved = await saveArticle(actorOf(user), Number(id), await req.json());
    return NextResponse.json({ ok: true, version: saved.version, slug: saved.slug, readingMinutes: saved.readingMinutes, updatedAt: saved.updatedAt });
  });
}

export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const { id } = await params;
    await deleteArticle(actorOf(user), Number(id));
    return NextResponse.json({ ok: true });
  });
}
