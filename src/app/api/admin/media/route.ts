import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireApiUser, AuthError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { can } from "@/lib/permissions";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, storeImage, VIDEO_TYPES } from "@/lib/media";
import { newKey, putObject, storageMode } from "@/lib/storage";
import { audit } from "@/lib/audit";

export function GET(req: Request) {
  return handle(async () => {
    await requireApiUser(req);
    const u = new URL(req.url);
    const q = u.searchParams.get("q")?.trim();
    const kind = u.searchParams.get("kind");
    const folder = u.searchParams.get("folder");
    const offset = Number(u.searchParams.get("offset") || 0);
    const where: SQL[] = [];
    if (q) {
      const t = `%${q.replace(/[%_]/g, "")}%`;
      where.push(or(ilike(schema.media.filename, t), ilike(schema.media.alt, t), ilike(schema.media.caption, t), ilike(schema.media.credit, t), ilike(schema.media.keywords, t), ilike(schema.media.folder, t))!);
    }
    if (kind === "image" || kind === "video") where.push(eq(schema.media.kind, kind));
    if (folder) where.push(eq(schema.media.folder, folder));
    const db = await getDb();
    const items = await db
      .select()
      .from(schema.media)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(schema.media.createdAt))
      .limit(48)
      .offset(offset);
    const folders = await db.selectDistinct({ folder: schema.media.folder }).from(schema.media);
    return NextResponse.json({ items, folders: folders.map((f) => f.folder).filter(Boolean).sort(), storage: storageMode() });
  });
}

/** Import d'un fichier (multipart). Les vidéos lourdes passent par un lien d'envoi direct (voir /sign). */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(req);
    if (!can.uploadMedia({ id: user.id, role: user.role, active: user.active })) throw new AuthError("Import refusé");
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    const meta = {
      alt: String(fd.get("alt") ?? "").slice(0, 300),
      caption: String(fd.get("caption") ?? "").slice(0, 500),
      credit: String(fd.get("credit") ?? "").slice(0, 200),
      rights: String(fd.get("rights") ?? "").slice(0, 200),
      folder: String(fd.get("folder") ?? "").slice(0, 100),
      keywords: String(fd.get("keywords") ?? "").slice(0, 300),
    };
    const buf = Buffer.from(await file.arrayBuffer());
    if (IMAGE_TYPES.includes(file.type)) {
      if (buf.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image trop lourde (15 Mo maximum)." }, { status: 413 });
      try {
        const row = await storeImage(buf, file.name, user.id, meta);
        await audit(user.id, "upload", "media", row.id, { name: file.name });
        return NextResponse.json({ item: row });
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Image refusée." }, { status: 422 });
      }
    }
    if (VIDEO_TYPES.includes(file.type)) {
      if (buf.length > MAX_VIDEO_BYTES) return NextResponse.json({ error: "Vidéo trop lourde. Utilisez YouTube ou Vimeo pour les vidéos longues." }, { status: 413 });
      const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
      const key = newKey(ext);
      const url = await putObject(key, buf, file.type);
      const db = await getDb();
      const [row] = await db
        .insert(schema.media)
        .values({ url, storageKey: key, kind: "video", mime: file.type, filename: file.name.slice(0, 200), size: buf.length, uploadedBy: user.id, ...meta })
        .returning();
      await audit(user.id, "upload", "media", row.id, { name: file.name });
      return NextResponse.json({ item: row });
    }
    return NextResponse.json({ error: "Format non pris en charge (JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV)." }, { status: 415 });
  });
}
