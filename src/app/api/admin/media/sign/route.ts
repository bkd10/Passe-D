import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { MAX_VIDEO_BYTES, VIDEO_TYPES } from "@/lib/media";
import { newKey, signedUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";

const signInput = z.object({ step: z.literal("sign"), mime: z.string(), size: z.number().int().positive() });
const doneInput = z.object({
  step: z.literal("done"),
  key: z.string().regex(/^\d{4}\/\d{2}\/[a-f0-9]{20}\.(mp4|webm|mov)$/),
  publicUrl: z.string().url(),
  mime: z.string(),
  size: z.number().int().positive(),
  filename: z.string().max(200),
});

// Vidéos lourdes : 1) on demande un lien signé, 2) le navigateur envoie le fichier à Supabase, 3) on enregistre le média.
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const body = await req.json();
    if (body.step === "sign") {
      const b = signInput.parse(body);
      if (!VIDEO_TYPES.includes(b.mime)) return NextResponse.json({ error: "Format vidéo non pris en charge (MP4, WebM, MOV)." }, { status: 415 });
      if (b.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "Vidéo trop lourde (200 Mo maximum). Utilisez YouTube ou Vimeo." }, { status: 413 });
      const ext = b.mime === "video/webm" ? "webm" : b.mime === "video/quicktime" ? "mov" : "mp4";
      const key = newKey(ext);
      const signed = await signedUpload(key);
      if (!signed) return NextResponse.json({ direct: false });
      return NextResponse.json({ direct: true, key, ...signed });
    }
    const b = doneInput.parse(body);
    if (!b.publicUrl.endsWith(b.key)) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
    const db = await getDb();
    const [row] = await db
      .insert(schema.media)
      .values({ url: b.publicUrl, storageKey: b.key, kind: "video", mime: b.mime, filename: b.filename, size: b.size, uploadedBy: user.id })
      .returning();
    await audit(user.id, "upload", "media", row.id, { name: b.filename });
    return NextResponse.json({ item: row });
  });
}
