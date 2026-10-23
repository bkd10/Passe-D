import Link from "next/link";
import type { Card } from "@/lib/queries";
import { FORMAT_LABELS, MERCATO_LABELS, moduleBySlug } from "@/lib/editorial";
import { timeAgo } from "@/lib/util";
import type { Format, MercatoStatus } from "@/db/schema";

export function pickImage(c: { coverUrl: string | null; coverVariants: Record<string, string> | null }, size: "sm" | "md" | "lg" = "md") {
  if (!c.coverUrl) return null;
  return c.coverVariants?.[size] || c.coverVariants?.lg || c.coverUrl;
}

export function srcSet(c: { coverUrl: string | null; coverVariants: Record<string, string> | null }) {
  const v = c.coverVariants ?? {};
  const parts = [v.sm && `${v.sm} 480w`, v.md && `${v.md} 960w`, v.lg && `${v.lg} 1600w`].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export function Kicker({ c }: { c: Card }) {
  const mod = c.module ? moduleBySlug(c.module) : null;
  return (
    <span className="kicker" style={{ ["--cat" as string]: c.categoryColor ?? undefined }}>
      <span className="dot" />
      {mod ? mod.name : c.categoryName ?? FORMAT_LABELS[c.format as Format]}
      {c.format !== "article" && !mod && c.categoryName ? ` · ${FORMAT_LABELS[c.format as Format]}` : ""}
    </span>
  );
}

export function Badges({ c }: { c: Card }) {
  const m = c.mercatoStatus ? MERCATO_LABELS[c.mercatoStatus as MercatoStatus] : null;
  if (!c.sponsored && !m && c.format !== "video") return null;
  return (
    <div className="badge-row">
      {c.sponsored && <span className="badge sponsor">Sponsorisé</span>}
      {m && <span className={`badge ${m.tone === "lime" ? "lime-soft" : m.tone}`}>{m.label}</span>}
      {c.format === "video" && <span className="badge lime">▶ Vidéo</span>}
    </div>
  );
}

export function ArticleCard({
  c,
  variant = "default",
  showDek = true,
  sizes = "(max-width: 720px) 100vw, 33vw",
}: {
  c: Card;
  variant?: "default" | "row" | "text";
  showDek?: boolean;
  sizes?: string;
}) {
  const img = pickImage(c, variant === "row" ? "sm" : "md");
  return (
    <article className={`card ${variant === "row" ? "row" : ""}`} style={{ ["--cat" as string]: c.categoryColor ?? undefined }}>
      {variant !== "text" && (
        <div className="cover">
          <Badges c={c} />
          {img ? (
            <img src={img} srcSet={srcSet(c)} sizes={sizes} alt={c.coverAlt ?? ""} loading="lazy" decoding="async" />
          ) : (
            <div className="placeholder" aria-hidden>{c.categoryName ?? "QS"}</div>
          )}
        </div>
      )}
      <div>
        <Kicker c={c} />
        <h3 className="title" style={{ margin: "8px 0 6px" }}>
          <Link href={`/articles/${c.slug}`}>{c.title}</Link>
        </h3>
        {showDek && variant !== "row" && c.dek && <p className="dek" style={{ margin: "0 0 8px" }}>{c.dek}</p>}
        <div className="meta">
          {c.authorName && <>{c.authorName} · </>}
          {c.publishedAt && <time dateTime={new Date(c.publishedAt).toISOString()}>{timeAgo(c.publishedAt)}</time>}
          {" · "}
          {c.readingMinutes} min
          {c.sponsored && c.sponsorName ? ` · avec ${c.sponsorName}` : ""}
        </div>
      </div>
    </article>
  );
}
