import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTag, listPublic } from "@/lib/queries";
import { Listing, PER_PAGE } from "@/components/listing";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

const KIND_LABEL: Record<string, string> = { sujet: "Sujet", joueur: "Joueur", club: "Club", metier: "Métier", competition: "Compétition" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTag(slug);
  if (!t) return { title: "Sujet introuvable" };
  return { title: t.name, description: t.description || `Tout Passe D sur ${t.name}.`, alternates: { canonical: `${SITE_URL}/sujets/${t.slug}` } };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const t = await getTag(slug);
  if (!t) notFound();
  const items = await listPublic({ tagId: t.id, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE });
  return (
    <div className="wrap">
      <header className="page-head">
        <span className="kicker"><span className="dot" />{KIND_LABEL[t.kind] ?? "Sujet"}</span>
        <h1>{t.name}</h1>
        {t.description && <p>{t.description}</p>}
      </header>
      <Listing items={items.slice(0, PER_PAGE)} page={page} base={`/sujets/${t.slug}`} hasMore={items.length > PER_PAGE} />
    </div>
  );
}
