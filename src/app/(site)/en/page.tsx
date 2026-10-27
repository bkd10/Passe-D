import type { Metadata } from "next";
import Link from "next/link";
import { listEnglish } from "@/lib/queries";
import { pickImage, CoverFallback } from "@/components/card";
import { SITE_NAME, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "In English",
  description: "Passe D in English: our stories on football talent, the amateur game and the people behind the scenes, translated for readers around the world.",
  alternates: { canonical: `${SITE_URL}/en`, languages: { "en": `${SITE_URL}/en`, "fr": SITE_URL, "x-default": SITE_URL } },
  openGraph: { locale: "en_GB", url: `${SITE_URL}/en` },
};

const enDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export default async function EnglishHome() {
  const items = await listEnglish();
  return (
    <div className="wrap" lang="en">
      <section className="section" style={{ borderBottom: 0 }}>
        <div className="section-head">
          <h1 style={{ margin: 0 }}>{SITE_NAME} in English</h1>
          <Link href="/" hrefLang="fr" lang="fr" className="lang-switch">Version française</Link>
        </div>
        <p className="dek" style={{ maxWidth: 720 }}>
          A selection of our stories translated for readers around the world: football talent, the amateur game and the people behind the scenes.
        </p>
        {items.length === 0 ? (
          <p className="meta">No English stories yet. Come back soon.</p>
        ) : (
          <div className="grid-3">
            {items.map((c) => {
              const img = pickImage(c, "md");
              return (
                <article key={c.id} className="card" style={{ ["--cat" as string]: c.categoryColor ?? undefined }}>
                  <div className="cover">
                    {c.sponsored && <div className="badge-row"><span className="badge sponsor">Sponsored</span></div>}
                    {img ? <img src={img} alt={c.coverAlt ?? ""} loading="lazy" decoding="async" /> : <CoverFallback label="Passe D" />}
                  </div>
                  <div>
                    <h2 className="title" style={{ margin: "8px 0 6px" }}>
                      <Link href={`/en/articles/${c.slug}`}>{c.title}</Link>
                    </h2>
                    {c.dek && <p className="dek" style={{ margin: "0 0 8px" }}>{c.dek}</p>}
                    <div className="meta">
                      {c.authorName && <>{c.authorName} · </>}
                      {c.publishedAt && <time dateTime={new Date(c.publishedAt).toISOString()}>{enDate.format(new Date(c.publishedAt))}</time>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
