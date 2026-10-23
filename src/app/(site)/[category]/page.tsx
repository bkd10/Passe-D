import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, listPublic, navCategories } from "@/lib/queries";
import { Listing, PER_PAGE } from "@/components/listing";
import { FORMAT_LABELS, MERCATO_LABELS } from "@/lib/editorial";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string; format?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = await getCategory(category);
  if (!c) return { title: "Rubrique introuvable" };
  return {
    title: c.name,
    description: c.description,
    alternates: { canonical: `${SITE_URL}/${c.slug}` },
    openGraph: { title: c.name, description: c.description, url: `${SITE_URL}/${c.slug}` },
  };
}

// Filtres utiles propres à chaque rubrique.
const RUBRIC_FORMATS: Record<string, string[]> = {
  talents: ["portrait", "entretien", "analyse"],
  "football-amateur": ["reportage", "portrait", "breve"],
  mercato: ["breve", "analyse"],
  innovations: ["analyse", "dossier", "entretien"],
  "metiers-du-football": ["portrait", "entretien", "reportage"],
  videos: ["video"],
  "culture-football": ["dossier", "reportage", "portrait"],
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const c = await getCategory(category);
  if (!c) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const format = sp.format && sp.format in FORMAT_LABELS ? sp.format : undefined;
  const items = await listPublic({ categorySlug: c.slug, format, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE });
  const subs = (await navCategories()).filter((x) => x.parentId === c.id);
  const formats = RUBRIC_FORMATS[c.slug] ?? [];
  const base = `/${c.slug}${format ? `?format=${format}` : ""}`;
  return (
    <div className="wrap">
      <header className="page-head" style={{ ["--cat" as string]: c.color }}>
        <span className="kicker"><span className="dot" />Rubrique</span>
        <h1>{c.name}</h1>
        <p>{c.description}</p>
        {(formats.length > 0 || subs.length > 0) && (
          <div className="feed-filters" style={{ marginTop: 22, marginBottom: 0 }}>
            <Link className={`chip ${!format ? "active" : ""}`} href={`/${c.slug}`}>Tout</Link>
            {formats.map((f) => (
              <Link key={f} className={`chip ${format === f ? "active" : ""}`} href={`/${c.slug}?format=${f}`}>
                {FORMAT_LABELS[f as keyof typeof FORMAT_LABELS]}
              </Link>
            ))}
            {subs.map((s) => (
              <Link key={s.slug} className="chip" href={`/${s.slug}`}>{s.name}</Link>
            ))}
          </div>
        )}
        {c.slug === "mercato" && (
          <div className="feed-filters" style={{ marginTop: 16, marginBottom: 0 }} aria-label="Légende des statuts">
            {Object.values(MERCATO_LABELS).map((m) => (
              <span key={m.label} className={`badge ${m.tone === "lime" ? "lime-soft" : m.tone}`} title={m.help}>{m.label}</span>
            ))}
          </div>
        )}
        {c.slug === "football-amateur" && (
          <p style={{ marginTop: 18, fontSize: 16 }}>
            Résultats et classements : seules les données validées par la rédaction ou issues de sources officielles sont publiées.{" "}
            <Link href="/contribuer" style={{ color: "var(--link)", textDecoration: "underline" }}>Votre club peut nous écrire.</Link>
          </p>
        )}
      </header>
      <Listing items={items.slice(0, PER_PAGE)} page={page} base={base} hasMore={items.length > PER_PAGE} />
    </div>
  );
}
