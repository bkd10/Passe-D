import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { getPublicArticle, relatedFor } from "@/lib/queries";
import { excerpt, SITE_NAME, SITE_URL } from "@/lib/util";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicArticle(slug);
  if (!a) return { title: "Article introuvable" };
  const art = a.article;
  // Par défaut, l'aperçu de lien est le visuel Passe D de l'article (titre + photo + logo).
  let og: string | undefined = `${SITE_URL}/articles/${art.slug}/visuel?format=og`;
  if (art.ogImageId) {
    const db = await getDb();
    const [m] = await db.select().from(schema.media).where(eq(schema.media.id, art.ogImageId)).limit(1);
    if (m) og = m.variants?.lg || m.url;
  }
  const description = art.seoDescription || art.dek || excerpt(art.bodyHtml);
  const title = art.seoTitle || art.title;
  return {
    title,
    description,
    alternates: { canonical: art.canonicalUrl || `${SITE_URL}/articles/${art.slug}` },
    authors: a.author ? [{ name: a.author.name, url: `${SITE_URL}/auteurs/${a.author.slug}` }] : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE_URL}/articles/${art.slug}`,
      images: og ? [{ url: og, width: art.ogImageId ? undefined : 1200, height: art.ogImageId ? undefined : 630 }] : undefined,
      publishedTime: art.publishedAt?.toISOString(),
      modifiedTime: (art.updatedContentAt ?? art.publishedAt)?.toISOString(),
      section: a.category?.name,
      tags: a.tags.map((t) => t.name),
    },
    twitter: { card: "summary_large_image", title, description, images: og ? [og] : undefined },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicArticle(slug);
  if (!a) notFound();
  const related = await relatedFor(a);
  const art = a.article;
  const img = a.cover?.variants?.lg || a.cover?.url;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": art.format === "video" ? "VideoObject" : "NewsArticle",
    headline: art.title,
    description: art.seoDescription || art.dek || excerpt(art.bodyHtml),
    image: img ? [img] : undefined,
    datePublished: art.publishedAt?.toISOString(),
    dateModified: (art.updatedContentAt ?? art.publishedAt)?.toISOString(),
    author: a.author ? [{ "@type": "Person", name: a.author.name, url: `${SITE_URL}/auteurs/${a.author.slug}` }] : undefined,
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` } },
    mainEntityOfPage: `${SITE_URL}/articles/${art.slug}`,
    articleSection: a.category?.name,
    keywords: a.tags.map((t) => t.name).join(", ") || undefined,
    isAccessibleForFree: true,
  };
  if (art.format === "video") {
    jsonLd.name = art.title;
    jsonLd.uploadDate = art.publishedAt?.toISOString();
    jsonLd.thumbnailUrl = img ? [img] : undefined;
    jsonLd.embedUrl = art.videoUrl || undefined;
  }
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      ...(a.category ? [{ "@type": "ListItem", position: 2, name: a.category.name, item: `${SITE_URL}/${a.category.slug}` }] : []),
      { "@type": "ListItem", position: a.category ? 3 : 2, name: art.title, item: `${SITE_URL}/articles/${art.slug}` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <ArticleView a={a} related={related} />
    </>
  );
}
