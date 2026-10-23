import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthor, listPublic } from "@/lib/queries";
import { Listing, PER_PAGE } from "@/components/listing";
import { ROLE_LABELS } from "@/lib/permissions";
import { SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = await getAuthor(slug);
  if (!u) return { title: "Auteur introuvable" };
  return { title: u.name, description: u.bio || `Les articles de ${u.name} sur Quotidien Sportif.`, alternates: { canonical: `${SITE_URL}/auteurs/${u.slug}` } };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const u = await getAuthor(slug);
  if (!u) notFound();
  const items = await listPublic({ authorId: u.id, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE });
  const ld = { "@context": "https://schema.org", "@type": "Person", name: u.name, description: u.bio, url: `${SITE_URL}/auteurs/${u.slug}`, image: u.avatarUrl ?? undefined };
  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <header className="author-head">
        {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <div className="ph" />}
        <div>
          <span className="kicker">{ROLE_LABELS[u.role]}{u.specialties ? ` · ${u.specialties}` : ""}</span>
          <h1>{u.name}</h1>
          {u.bio && <p className="dek" style={{ margin: 0, maxWidth: 640 }}>{u.bio}</p>}
        </div>
      </header>
      <Listing items={items.slice(0, PER_PAGE)} page={page} base={`/auteurs/${u.slug}`} hasMore={items.length > PER_PAGE} />
    </div>
  );
}
