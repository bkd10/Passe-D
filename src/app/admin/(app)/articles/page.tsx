import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { STATUSES, type Status } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isEditor, STATUS_LABELS } from "@/lib/permissions";
import { StatusPill } from "@/components/admin/bits";
import { Kanban } from "@/components/admin/kanban";
import { formatDateTime } from "@/lib/util";
import { FORMAT_LABELS } from "@/lib/editorial";
import { promoteScheduled } from "@/lib/queries";

export const metadata = { title: "Articles" };

const { articles, users, categories } = schema;
type SP = { vue?: string; q?: string; statut?: string; personne?: string; rubrique?: string; echeance?: string; mois?: string; page?: string };

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  await promoteScheduled(true);
  const db = await getDb();
  const view = sp.vue === "kanban" ? "kanban" : sp.vue === "calendrier" ? "calendrier" : "liste";
  const actor = { id: user.id, role: user.role, active: user.active };
  const author = alias(users, "author");
  const assignee = alias(users, "assignee");

  const where: SQL[] = [];
  if (sp.q) where.push(ilike(articles.title, `%${sp.q.replace(/[%_]/g, "")}%`));
  if (sp.statut && (STATUSES as readonly string[]).includes(sp.statut)) where.push(eq(articles.status, sp.statut as Status));
  if (sp.personne) where.push(or(eq(articles.authorId, Number(sp.personne)), eq(articles.assigneeId, Number(sp.personne)))!);
  if (sp.rubrique) where.push(eq(articles.categoryId, Number(sp.rubrique)));
  if (sp.echeance === "retard") where.push(and(isNotNull(articles.deadline), lt(articles.deadline, new Date()), inArray(articles.status, ["idea", "assigned", "writing", "review", "changes", "update_needed"]))!);
  if (sp.echeance === "semaine") where.push(and(isNotNull(articles.deadline), lt(articles.deadline, new Date(Date.now() + 7 * 86400_000)))!);
  if (user.role === "contributor") {
    where.push(or(eq(articles.authorId, user.id), eq(articles.assigneeId, user.id), eq(articles.createdBy, user.id))!);
  }
  if (view === "kanban" && !sp.statut) where.push(inArray(articles.status, ["idea", "assigned", "writing", "review", "changes", "approved", "scheduled", "update_needed"]));

  let monthStart: Date | null = null;
  if (view === "calendrier") {
    const [y, m] = (sp.mois ?? new Date().toISOString().slice(0, 7)).split("-").map(Number);
    monthStart = new Date(Date.UTC(y, m - 1, 1));
    const from = new Date(monthStart.getTime() - 7 * 86400_000);
    const to = new Date(Date.UTC(y, m, 1) + 7 * 86400_000);
    where.push(
      or(
        and(gte(articles.publishedAt, from), lt(articles.publishedAt, to)),
        and(gte(articles.scheduledAt, from), lt(articles.scheduledAt, to)),
        and(gte(articles.deadline, from), lt(articles.deadline, to)),
      )!,
    );
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const limit = view === "liste" ? 50 : 300;
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      format: articles.format,
      priority: articles.priority,
      deadline: articles.deadline,
      scheduledAt: articles.scheduledAt,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      views: articles.views,
      sponsored: articles.sponsored,
      authorName: author.name,
      assigneeName: assignee.name,
      categoryName: categories.name,
    })
    .from(articles)
    .leftJoin(author, eq(author.id, articles.authorId))
    .leftJoin(assignee, eq(assignee.id, articles.assigneeId))
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(articles.updatedAt))
    .limit(limit + 1)
    .offset(view === "liste" ? (page - 1) * limit : 0);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  const [people, cats] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(users.name),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.position),
  ]);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin/articles?${p}`;
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Articles</h1>
          <p>{items.length}{hasMore ? "+" : ""} contenu{items.length > 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <nav className="tabs" aria-label="Vue">
            <Link href={qs({ vue: undefined, mois: undefined })} aria-current={view === "liste" ? "page" : undefined}>Liste</Link>
            <Link href={qs({ vue: "kanban", mois: undefined })} aria-current={view === "kanban" ? "page" : undefined}>Kanban</Link>
            <Link href={qs({ vue: "calendrier" })} aria-current={view === "calendrier" ? "page" : undefined}>Calendrier</Link>
          </nav>
          <Link className="btn dark" href="/admin/articles/publier">+ Publier un article</Link>
        </div>
      </div>

      <form className="filters" action="/admin/articles">
        {view !== "liste" && <input type="hidden" name="vue" value={view} />}
        <input className="input grow" name="q" placeholder="Rechercher un titre…" defaultValue={sp.q} />
        <select className="input" name="statut" defaultValue={sp.statut ?? ""} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="input" name="personne" defaultValue={sp.personne ?? ""} aria-label="Journaliste">
          <option value="">Toute la rédaction</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" name="rubrique" defaultValue={sp.rubrique ?? ""} aria-label="Rubrique">
          <option value="">Toutes rubriques</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" name="echeance" defaultValue={sp.echeance ?? ""} aria-label="Échéance">
          <option value="">Toutes échéances</option>
          <option value="retard">En retard</option>
          <option value="semaine">Sous 7 jours</option>
        </select>
        <button className="btn ghost">Filtrer</button>
        {(sp.q || sp.statut || sp.personne || sp.rubrique || sp.echeance) && <Link className="btn ghost" href={qs({ q: undefined, statut: undefined, personne: undefined, rubrique: undefined, echeance: undefined })}>Effacer</Link>}
      </form>

      {view === "liste" &&
        (items.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ margin: "0 0 12px", fontWeight: 650 }}>Aucun article ne correspond.</p>
            <Link className="btn dark" href="/admin/articles/publier">Écrire un article</Link>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th className="hide-sm">Rubrique</th>
                  <th className="hide-sm">Auteur / assigné</th>
                  <th className="hide-sm">Échéance</th>
                  <th>Mis à jour</th>
                  <th className="hide-sm" style={{ textAlign: "right" }}>Lectures</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const late = a.deadline && a.deadline < new Date() && ["idea", "assigned", "writing", "review", "changes", "update_needed"].includes(a.status);
                  return (
                    <tr key={a.id} className={a.priority === 1 ? "prio-1" : ""}>
                      <td className="t">
                        <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                        <div className="meta" style={{ fontSize: 11 }}>
                          {FORMAT_LABELS[a.format]}
                          {a.sponsored && " · sponsorisé"}
                          {a.status === "scheduled" && a.scheduledAt && ` · le ${formatDateTime(a.scheduledAt)}`}
                        </div>
                      </td>
                      <td><StatusPill s={a.status} /></td>
                      <td className="hide-sm">{a.categoryName ?? "—"}</td>
                      <td className="hide-sm">{a.authorName ?? "—"}{a.assigneeName && a.assigneeName !== a.authorName ? ` → ${a.assigneeName}` : ""}</td>
                      <td className={`hide-sm ${late ? "late" : ""}`}>{a.deadline ? formatDateTime(a.deadline) : "—"}</td>
                      <td className="meta" style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.updatedAt)}</td>
                      <td className="hide-sm meta" style={{ textAlign: "right" }}>{a.views}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      {view === "liste" && (page > 1 || hasMore) && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          {page > 1 && <Link className="btn ghost" href={qs({ page: String(page - 1) })}>← Précédents</Link>}
          {hasMore && <Link className="btn ghost" href={qs({ page: String(page + 1) })}>Suivants →</Link>}
        </div>
      )}

      {view === "kanban" && (
        <Kanban
          editor={isEditor(actor)}
          items={items.map((a) => ({ ...a, deadline: a.deadline?.toISOString() ?? null, scheduledAt: a.scheduledAt?.toISOString() ?? null }))}
        />
      )}

      {view === "calendrier" && monthStart && <Calendar monthStart={monthStart} items={items} qs={qs} />}
    </>
  );
}

function Calendar({
  monthStart,
  items,
  qs,
}: {
  monthStart: Date;
  items: { id: number; title: string; status: Status; publishedAt: Date | null; scheduledAt: Date | null; deadline: Date | null }[];
  qs: (p: Partial<SP>) => string;
}) {
  const y = monthStart.getUTCFullYear();
  const m = monthStart.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // lundi = 0
  const gridStart = new Date(first.getTime() - startDow * 86400_000);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400_000));
  const key = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const events = new Map<string, { id: number; title: string; kind: string; time: string }[]>();
  const push = (d: Date | null, kind: string, a: { id: number; title: string }) => {
    if (!d) return;
    const k = key(d);
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    events.set(k, [...(events.get(k) ?? []), { id: a.id, title: a.title, kind, time }]);
  };
  for (const a of items) {
    if (a.status === "scheduled") push(a.scheduledAt, "scheduled", a);
    else if (a.publishedAt && ["published", "update_needed"].includes(a.status)) push(a.publishedAt, "published", a);
    if (a.deadline && !["published", "scheduled", "archived"].includes(a.status)) push(a.deadline, "deadline", a);
  }
  const prev = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 7);
  const today = key(new Date());
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Link className="btn ghost sm" href={qs({ mois: prev })}>←</Link>
        <strong style={{ fontSize: 18, textTransform: "capitalize" }}>{first.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })}</strong>
        <Link className="btn ghost sm" href={qs({ mois: next })}>→</Link>
        <span className="meta" style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <span className="st st-published">Publié</span>
          <span className="st st-scheduled">Programmé</span>
          <span className="st st-review">Échéance</span>
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div className="cal" style={{ minWidth: 720 }}>
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="dow">{d}</div>)}
          {days.map((d) => {
            const k = key(d);
            const evs = events.get(k) ?? [];
            return (
              <div key={k} className={`day ${d.getUTCMonth() !== m ? "out" : ""} ${k === today ? "today" : ""}`}>
                <span className="n">{d.getUTCDate()}</span>
                {evs.map((e, i) => (
                  <Link key={i} href={`/admin/articles/${e.id}`} className={`ev ${e.kind}`} title={e.title}>
                    {e.kind !== "deadline" ? e.time + " " : "⏱ "}
                    {e.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
