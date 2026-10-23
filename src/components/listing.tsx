import Link from "next/link";
import { ArticleCard } from "./card";
import type { Card } from "@/lib/queries";

export const PER_PAGE = 13;

export function Listing({ items, page, base, hasMore }: { items: Card[]; page: number; base: string; hasMore: boolean }) {
  if (!items.length) {
    return (
      <div className="empty">
        <strong>Pas encore d&apos;article ici</strong>
        La rédaction y travaille. Revenez vite, ou abonnez-vous à la newsletter.
      </div>
    );
  }
  const sep = base.includes("?") ? "&" : "?";
  return (
    <>
      <div className="list-grid">
        {items.map((a, i) => (
          <ArticleCard key={a.id} c={a} sizes={i === 0 && page === 1 ? "(max-width: 720px) 100vw, 66vw" : "(max-width: 720px) 100vw, 33vw"} />
        ))}
      </div>
      <nav className="pagination" aria-label="Pagination">
        {page > 1 && <Link className="btn ghost" href={page === 2 ? base : `${base}${sep}page=${page - 1}`} rel="prev">← Plus récents</Link>}
        {hasMore && <Link className="btn ghost" href={`${base}${sep}page=${page + 1}`} rel="next">Plus anciens →</Link>}
      </nav>
    </>
  );
}
