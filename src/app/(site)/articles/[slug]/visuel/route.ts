import sharp from "sharp";
import { getPublicArticle } from "@/lib/queries";
import { SOCIAL_FORMATS, socialImage, type SocialFormat } from "@/lib/social-image";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Visuel réseaux sociaux d'un article publié : ?format=post (Instagram), story ou og (aperçu de lien) ; &lang=en pour la version anglaise. &type=jpg pour la publication automatique Instagram, qui n'accepte que le JPEG. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "post") as SocialFormat;
  if (!(format in SOCIAL_FORMATS)) return new Response("Format inconnu.", { status: 400 });
  const a = await getPublicArticle(slug);
  if (!a) return new Response("Article introuvable.", { status: 404 });
  // &lang=en : visuel de la version anglaise, si elle est publiée.
  const en = url.searchParams.get("lang") === "en";
  if (en && !(a.article.enPublished && a.article.enTitle)) return new Response("Pas de version anglaise publiée.", { status: 404 });
  const img = await socialImage(
    {
      title: en ? a.article.enTitle : a.article.title,
      dek: en ? a.article.enDek : a.article.dek,
      lang: en ? "en" : "fr",
      categoryName: a.category?.name,
      mercatoStatus: a.article.mercatoStatus,
      sponsored: a.article.sponsored,
      cover: a.cover ? { url: a.cover.url, storageKey: a.cover.storageKey } : null,
      siteHost: new URL(SITE_URL).host,
    },
    format,
  );
  const jpg = url.searchParams.get("type") === "jpg";
  const headers = new Headers(img.headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  if (url.searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="passe-d-${slug}${en ? "-en" : ""}-${format}.${jpg ? "jpg" : "png"}"`);
  if (!jpg) return new Response(img.body, { status: 200, headers });
  const out = await sharp(Buffer.from(await img.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
  headers.set("Content-Type", "image/jpeg");
  headers.delete("Content-Length");
  return new Response(new Uint8Array(out), { status: 200, headers });
}
