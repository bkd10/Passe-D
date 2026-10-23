import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthError, requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { can } from "@/lib/permissions";
import { deleteObject } from "@/lib/storage";
import { cropImage } from "@/lib/media";
import { audit } from "@/lib/audit";

const patch = z.object({
  alt: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  rights: z.string().max(200).optional(),
  folder: z.string().max(100).optional(),
  keywords: z.string().max(300).optional(),
  crop: z.object({ ratio: z.number().min(0.3).max(4), fx: z.number().min(0).max(1), fy: z.number().min(0).max(1) }).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const db = await getDb();
  const [m] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  return m;
}

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const m = await load(Number((await params).id));
    if (!m) return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    const actor = { id: user.id, role: user.role, active: user.active };
    const body = patch.parse(await req.json());
    if (body.crop) {
      if (m.kind !== "image") return NextResponse.json({ error: "Seules les images se recadrent." }, { status: 400 });
      const item = await cropImage(m, body.crop.ratio, body.crop.fx, body.crop.fy, user.id);
      return NextResponse.json({ item });
    }
    if (!can.editMedia(actor, m.uploadedBy)) throw new AuthError("Modification refusée");
    const { crop: _crop, ...fields } = body;
    const db = await getDb();
    const [item] = await db.update(schema.media).set(fields).where(eq(schema.media.id, m.id)).returning();
    return NextResponse.json({ item });
  });
}

export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const m = await load(Number((await params).id));
    if (!m) return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    if (!can.deleteMedia({ id: user.id, role: user.role, active: user.active }, m.uploadedBy)) throw new AuthError("Suppression refusée");
    const db = await getDb();
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.articles)
      .where(or(eq(schema.articles.coverId, m.id), eq(schema.articles.ogImageId, m.id), sql`${schema.articles.gallery} @> ${JSON.stringify([m.id])}::jsonb`, sql`${schema.articles.bodyHtml} like ${"%" + m.url + "%"}`));
    if (n > 0) return NextResponse.json({ error: `Ce média est utilisé dans ${n} article(s). Retirez-le d'abord.` }, { status: 409 });
    await db.delete(schema.media).where(eq(schema.media.id, m.id));
    await deleteObject(m.storageKey);
    for (const v of Object.values(m.variants)) {
      const key = v.startsWith("/uploads/") ? v.slice("/uploads/".length) : v.split(`/${process.env.SUPABASE_STORAGE_BUCKET || "media"}/`)[1];
      if (key) await deleteObject(key);
    }
    await audit(user.id, "delete", "media", m.id, { name: m.filename });
    return NextResponse.json({ ok: true });
  });
}
