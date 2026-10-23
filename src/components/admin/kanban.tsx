"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Status } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/permissions";

type Item = { id: number; title: string; status: Status; priority: number; deadline: string | null; scheduledAt: string | null; authorName: string | null; assigneeName: string | null; categoryName: string | null };
const COLS: Status[] = ["idea", "assigned", "writing", "review", "changes", "approved", "scheduled", "update_needed"];

export function Kanban({ items, editor }: { items: Item[]; editor: boolean }) {
  const [list, setList] = useState(items);
  const [over, setOver] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function move(id: number, to: Status) {
    const item = list.find((i) => i.id === id);
    if (!item || item.status === to) return;
    if (to === "scheduled") {
      setError("Pour programmer, ouvrez l'article et choisissez la date.");
      return;
    }
    const before = list;
    setList((l) => l.map((i) => (i.id === id ? { ...i, status: to } : i)));
    const res = await fetch(`/api/admin/articles/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Changement refusé.");
      setList(before);
    } else {
      setError("");
      router.refresh();
    }
  }

  return (
    <>
      {error && <div className="alert err" role="alert">{error}</div>}
      <p className="hint" style={{ marginTop: 0 }}>Glissez une carte pour changer son statut{editor ? "" : " (selon vos droits)"}.</p>
      <div className="kanban">
        {COLS.map((col) => {
          const cards = list.filter((i) => i.status === col);
          return (
            <section
              key={col}
              className={`kcol ${over === col ? "drop" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(Number(e.dataTransfer.getData("text/plain")), col);
              }}
              aria-label={STATUS_LABELS[col]}
            >
              <h3>
                <span className={`st st-${col}`}>{STATUS_LABELS[col]}</span>
                <span className="meta">{cards.length}</span>
              </h3>
              {cards.map((c) => {
                const late = c.deadline && new Date(c.deadline) < new Date() && !["approved", "scheduled"].includes(c.status);
                return (
                  <article key={c.id} className={`kcard ${c.priority === 1 ? "prio-1" : ""}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}>
                    <Link href={`/admin/articles/${c.id}`}>{c.title}</Link>
                    <span className="meta">{c.categoryName ?? "Sans rubrique"} · {c.assigneeName ?? c.authorName ?? "—"}</span>
                    {c.deadline && <span className={`meta ${late ? "late" : ""}`}>⏱ {new Date(c.deadline).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                    {c.scheduledAt && c.status === "scheduled" && <span className="meta">📅 {new Date(c.scheduledAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                    <select
                      className="input"
                      style={{ height: 30, fontSize: 12.5 }}
                      value={c.status}
                      onChange={(e) => move(c.id, e.target.value as Status)}
                      aria-label={`Changer le statut de ${c.title}`}
                    >
                      {COLS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      <option value="published">{STATUS_LABELS.published}</option>
                      <option value="archived">{STATUS_LABELS.archived}</option>
                    </select>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
