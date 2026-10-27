import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { getEnglishArticle } from "@/lib/queries";
import { excerpt, SITE_NAME, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getEnglishArticle(slug);
  if (!a) return { title: "Article not found" };
  const art = a.article;
  const url = `${SITE_URL}/en/articles/${art.slug}`;
  const og = `${SITE_URL}/articles/${art.slug}/visuel?format=og`;
  const description = art.enDek || excerpt(art.enBodyHtml);
  return {
    title: art.enTitle,
    description,
    alternates: { canonical: url, languages: { en: url, fr: `${SITE_URL}/articles/${art.slug}`, "x-default": `${SITE_URL}/articles/${art.slug}` } },
    openGraph: { type: "article", locale: "en_GB", title: art.enTitle, description, url, images: [{ url: og, width: 1200, height: 630 }], publishedTime: art.publishedAt?.toISOString() },
    twitter: { card: "summary_large_image", title: art.enTitle, description, images: [og] },
  };
}

export default async function EnglishArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await getEnglishArticle(slug);
  if (!a) notFound();
  const art = a.article;
  const url = `${SITE_URL}/en/articles/${art.slug}`;
  const img = a.cover?.variants?.lg || a.cover?.url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: art.enTitle,
    description: art.enDek || excerpt(art.enBodyHtml),
    inLanguage: "en",
    image: [img ?? `${SITE_URL}/articles/${art.slug}/visuel?format=og`],
    datePublished: art.publishedAt?.toISOString(),
    author: a.author ? [{ "@type": "Person", name: a.author.name, url: `${SITE_URL}/auteurs/${a.author.slug}` }] : undefined,
    publisher: { "@type": "NewsMediaOrganization", "@id": `${SITE_URL}/#organisation`, name: `${SITE_NAME} Média`, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 } },
    mainEntityOfPage: url,
    translationOfWork: { "@type": "NewsArticle", "@id": `${SITE_URL}/articles/${art.slug}`, inLanguage: "fr" },
    isAccessibleForFree: true,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ArticleView a={a} related={[]} lang="en" />
    </>
  );
}
