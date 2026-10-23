import "server-only";
import sharp from "sharp";
import { getDb, schema } from "@/db";
import { newKey, putObject, readObject } from "./storage";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MIN_IMAGE_WIDTH = 600;

const SIZES = { sm: 480, md: 960, lg: 1600 } as const;

export type MediaMeta = { alt?: string; caption?: string; credit?: string; rights?: string; folder?: string; keywords?: string };

/** Optimise une image : versions WebP 480/960/1600 px pour les différents écrans. */
export async function storeImage(buf: Buffer, filename: string, uploadedBy: number, meta: MediaMeta = {}) {
  const img = sharp(buf, { failOn: "error" }).rotate();
  const info = await img.metadata();
  if (!info.width || !info.height) throw new Error("Image illisible.");
  if (info.width < MIN_IMAGE_WIDTH) throw new Error(`Image trop petite (${info.width} px de large, minimum ${MIN_IMAGE_WIDTH} px).`);
  const variants: Record<string, string> = {};
  const baseKey = newKey("webp").replace(/\.webp$/, "");
  for (const [name, width] of Object.entries(SIZES)) {
    if (name !== "sm" && info.width < width * 0.7) continue;
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    variants[name] = await putObject(`${baseKey}-${name}.webp`, out, "image/webp");
  }
  // L'original est conservé (ré-encodé sans métadonnées EXIF ni GPS) pour de futurs recadrages.
  const master = await sharp(buf).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const key = `${baseKey}.jpg`;
  const url = await putObject(key, master, "image/jpeg");
  const masterInfo = await sharp(master).metadata();
  const db = await getDb();
  const [row] = await db
    .insert(schema.media)
    .values({
      url,
      storageKey: key,
      kind: "image",
      mime: "image/jpeg",
      filename: filename.slice(0, 200),
      size: master.length,
      width: masterInfo.width ?? null,
      height: masterInfo.height ?? null,
      variants,
      uploadedBy,
      alt: meta.alt ?? "",
      caption: meta.caption ?? "",
      credit: meta.credit ?? "",
      rights: meta.rights ?? "",
      folder: meta.folder ?? "",
      keywords: meta.keywords ?? "",
    })
    .returning();
  return row;
}

/** Recadre une image existante autour d'un point d'intérêt et l'enregistre comme nouveau média. */
export async function cropImage(source: typeof schema.media.$inferSelect, ratio: number, fx: number, fy: number, uploadedBy: number) {
  const buf = await readObject(source.url, source.storageKey);
  const meta = await sharp(buf).metadata();
  const W = meta.width!;
  const H = meta.height!;
  let w = W;
  let h = Math.round(W / ratio);
  if (h > H) {
    h = H;
    w = Math.round(H * ratio);
  }
  const left = Math.min(Math.max(0, Math.round(fx * W - w / 2)), W - w);
  const top = Math.min(Math.max(0, Math.round(fy * H - h / 2)), H - h);
  const out = await sharp(buf).extract({ left, top, width: w, height: h }).toBuffer();
  return storeImage(out, source.filename.replace(/(\.\w+)?$/, `-recadre$1`), uploadedBy, {
    alt: source.alt,
    caption: source.caption,
    credit: source.credit,
    rights: source.rights,
    folder: source.folder,
    keywords: source.keywords,
  });
}
