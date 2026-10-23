"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/queries";
import { CoverFallback } from "@/components/card";

type Cat = { slug: string; name: string };
const FORMATS = [
  ["", "Tous formats"],
  ["portrait", "Portraits"],
  ["analyse", "Analyses"],
  ["entretien", "Entretiens"],
  ["reportage", "Reportages"],
  ["video", "Vidéos"],
  ["breve", "Brèves"],
] as const;
const PERIODS = [
  ["", "Toutes dates"],
  ["1", "Aujourd'hui"],
  ["7", "7 derniers jours"],
  ["30", "30 derniers jours"],
] as const;

function time(d: string | Date | null) {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function LiveFeed({ initial, cats }: { initial: Card[]; cats: Cat[] }) {
  const [items, setItems] = useState<Card[]>(initial);
  const [pending, setPending] = useState<Card[]>([]);
  const [cat, setCat] = useState("");
  const [format, setFormat] = useState("");
  const [period, setPeriod] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < 12);
  const first = useRef(true);

  const query = useCallback(
    (offset = 0) => {
      const p = new URLSearchParams({ offset: String(offset), limit: "12", sort });
      if (cat) p.set("cat", cat);
      if (format) p.set("format", format);
      if (period) p.set("days", period);
      return fetch(`/api/feed?${p}`).then((r) => (r.ok ? r.json() : { items: [] })) as Promise<{ items: Card[] }>;
    },
    [cat, format, period, sort],
  );

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLoading(true);
    query(0).then((r) => {
      setItems(r.items);
      setPending([]);
      setDone(r.items.length < 12);
      setLoading(false);
    });
  }, [query]);

  // Mise à jour automatique toutes les 90 s, sans recharger la page : on propose les nouveautés.
  useEffect(() => {
    if (sort !== "recent") return;
    const id = setInterval(() => {
      if (document.hidden) return;
      query(0).then((r) => {
        setItems((cur) => {
          const known = new Set(cur.map((c) => c.id));
          const fresh = r.items.filter((c) => !known.has(c.id));
          setPending(fresh);
          return cur;
        });
      });
    }, 90_000);
    return () => clearInterval(id);
  }, [query, sort]);

  const more = async () => {
    setLoading(true);
    const r = await query(items.length);
    setItems((cur) => [...cur, ...r.items.filter((c) => !cur.some((x) => x.id === c.id))]);
    setDone(r.items.length < 12);
    setLoading(false);
  };

  return (
    <div>
      <div className="feed-filters" role="group" aria-label="Filtrer le fil">
        <button className="chip" aria-pressed={cat === ""} onClick={() => setCat("")}>Tout</button>
        {cats.map((c) => (
          <button key={c.slug} className="chip" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="feed-filters">
        <select className="chip" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
          {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="chip" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Période">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="chip" aria-pressed={sort === "popular"} onClick={() => setSort(sort === "popular" ? "recent" : "popular")}>
          {sort === "popular" ? "★ Les plus lus" : "Les plus lus"}
        </button>
      </div>
      {pending.length > 0 && (
        <div style={{ textAlign: "center" }}>
          <button
            className="chip active feed-new"
            onClick={() => {
              setItems((cur) => [...pending, ...cur]);
              setPending([]);
            }}
          >
            ↑ {pending.length} nouveau{pending.length > 1 ? "x" : ""} contenu{pending.length > 1 ? "s" : ""}
          </button>
        </div>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {items.length === 0 && !loading && (
          <div className="empty">
            <strong>Rien pour ces filtres</strong>
            Essayez une autre rubrique ou une période plus large.
          </div>
        )}
        <ul className="feed-list">
          {items.map((a) => (
            <li key={a.id} className="feed-item" style={{ ["--cat" as string]: a.categoryColor ?? undefined }}>
              <time dateTime={a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined}>{time(a.publishedAt)}</time>
              <div>
                <span className="kicker"><span className="dot" />{a.categoryName}{a.sponsored ? " · Sponsorisé" : ""}</span>
                <h3 className="title"><Link href={`/articles/${a.slug}`}>{a.title}</Link></h3>
                {a.dek && <p className="dek" style={{ margin: 0, fontSize: 15 }}>{a.dek}</p>}
              </div>
              <div className="thumb">{a.coverUrl ? <img src={a.coverVariants?.sm || a.coverUrl} alt="" loading="lazy" /> : <CoverFallback small />}</div>
            </li>
          ))}
        </ul>
      </div>
      {!done && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button className="btn ghost" onClick={more} disabled={loading}>{loading ? "Chargement…" : "Charger plus"}</button>
        </div>
      )}
    </div>
  );
}
