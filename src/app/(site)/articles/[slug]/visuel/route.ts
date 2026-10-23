import { getPublicArticle } from "@/lib/queries";
import { SOCIAL_FORMATS, socialImage, type SocialFormat } from "@/lib/social-image";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Visuel réseaux sociaux d'un article publié : ?format=post (Instagram), story ou og (aperçu de lien). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "post") as SocialFormat;
  if (!(format in SOCIAL_FORMATS)) return new Response("Format inconnu.", { status: 400 });
  const a = await getPublicArticle(slug);
  if (!a) return new Response("Article introuvable.", { status: 404 });
  const img = await socialImage(
    {
      title: a.article.title,
      dek: a.article.dek,
      categoryName: a.category?.name,
      mercatoStatus: a.article.mercatoStatus,
      sponsored: a.article.sponsored,
      cover: a.cover ? { url: a.cover.url, storageKey: a.cover.storageKey } : null,
      siteHost: new URL(SITE_URL).host,
    },
    format,
  );
  const headers = new Headers(img.headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  if (url.searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="passe-d-${slug}-${format}.png"`);
  return new Response(img.body, { status: 200, headers });
}
