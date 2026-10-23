import type { Metadata } from "next";
import { listPublic } from "@/lib/queries";
import { Listing, PER_PAGE } from "@/components/listing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recherche", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const items = q ? await listPublic({ q, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE }) : [];
  return (
    <div className="wrap">
      <header className="page-head">
        <span className="kicker">Recherche</span>
        <h1>Chercher</h1>
        <form className="search-box" role="search" action="/recherche">
          <label htmlFor="q" className="sr-only">Rechercher un joueur, un club, un sujet</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Un joueur, un club, un métier…" autoFocus />
          <button className="btn" style={{ height: 56 }}>Rechercher</button>
        </form>
      </header>
      {q ? (
        <>
          <p className="meta" style={{ marginTop: 20 }}>Résultats pour « {q} »</p>
          <Listing items={items.slice(0, PER_PAGE)} page={page} base={`/recherche?q=${encodeURIComponent(q)}`} hasMore={items.length > PER_PAGE} />
        </>
      ) : (
        <div className="empty"><strong>Que cherches-tu ?</strong>Tape le nom d&apos;un joueur, d&apos;un club ou d&apos;un sujet.</div>
      )}
    </div>
  );
}
