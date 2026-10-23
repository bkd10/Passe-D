import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const metadata = { title: "Audience" };

const { dailyViews, articles, categories } = schema;

export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const u = await requireUser();
  if (!can.viewAnalytics({ id: u.id, role: u.role, active: u.active })) redirect("/admin");
  const days = [7, 30, 90].includes(Number((await searchParams).jours)) ? Number((await searchParams).jours) : 30;
  const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const db = await getDb();
  const [byDay, top, byCat, refs, [subs], [pub]] = await Promise.all([
    db.select({ day: dailyViews.day, views: sql<number>`sum(${dailyViews.views})::int` }).from(dailyViews).where(gte(dailyViews.day, since)).groupBy(dailyViews.day).orderBy(dailyViews.day),
    db
      .select({ id: articles.id, title: articles.title, slug: articles.slug, views: sql<number>`sum(${dailyViews.views})::int` })
      .from(dailyViews)
      .innerJoin(articles, eq(articles.id, dailyViews.articleId))
      .where(gte(dailyViews.day, since))
      .groupBy(articles.id)
      .orderBy(desc(sql`4`))
      .limit(15),
    db
      .select({ name: categories.name, views: sql<number>`sum(${dailyViews.views})::int`, n: sql<number>`count(distinct ${articles.id})::int` })
      .from(dailyViews)
      .innerJoin(articles, eq(articles.id, dailyViews.articleId))
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .where(gte(dailyViews.day, since))
      .groupBy(categories.name)
      .orderBy(desc(sql`2`)),
    db.select({ r: dailyViews.referrers }).from(dailyViews).where(gte(dailyViews.day, since)),
    db.select({ n: sql<number>`count(*)::int`, recent: sql<number>`count(*) filter (where ${schema.subscribers.createdAt} >= ${new Date(since)})::int` }).from(schema.subscribers),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(articles)
      .where(and(inArray(articles.status, ["published", "update_needed"]), gte(articles.publishedAt, new Date(since)))),
  ]);
  const sources = new Map<string, number>();
  for (const { r } of refs) for (const [k, v] of Object.entries(r)) sources.set(k, (sources.get(k) ?? 0) + v);
  const srcList = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const total = byDay.reduce((s, d) => s + d.views, 0);
  const allDays = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86400_000).toISOString().slice(0, 10));
  const series = allDays.map((d) => ({ day: d, views: byDay.find((x) => x.day === d)?.views ?? 0 }));
  const max = Math.max(1, ...series.map((s) => s.views));
  const bar = (v: number, m: number) => <span style={{ display: "block", height: 6, borderRadius: 3, background: "#7a9a00", width: `${Math.max(2, (v / m) * 100)}%`, marginTop: 4 }} />;
  const label = (k: string) => (k === "direct" ? "Accès direct / applis" : k === "interne" ? "Navigation interne" : k);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Audience</h1>
          <p>Lectures comptées sans cookie (une lecture = 4 s sur la page, robots exclus). Pour mieux écrire, pas pour courir après le clic.</p>
        </div>
        <nav className="tabs">
          {[7, 30, 90].map((d) => <Link key={d} href={`/admin/audience?jours=${d}`} aria-current={d === days ? "page" : undefined}>{d} j</Link>)}
        </nav>
      </div>
      <div className="stats">
        <div className="stat"><div className="v">{total.toLocaleString("fr-FR")}</div><div className="l">lectures sur {days} jours</div></div>
        <div className="stat"><div className="v">{pub.n}</div><div className="l">articles publiés sur la période</div></div>
        <div className="stat"><div className="v">{pub.n ? Math.round(total / pub.n) : 0}</div><div className="l">lectures par article publié</div></div>
        <div className="stat"><div className="v">{subs.n}</div><div className="l">inscrits newsletter (+{subs.recent})</div></div>
      </div>
      <section className="panel">
        <h2>Lectures par jour</h2>
        {total === 0 ? (
          <p className="hint">Pas encore de lecture enregistrée sur cette période.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, borderBottom: "1px solid var(--line-strong)" }} role="img" aria-label={`Lectures quotidiennes, maximum ${max}`}>
              {series.map((s) => (
                <div key={s.day} title={`${new Date(s.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${s.views} lecture(s)`} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${(s.views / max) * 100}%`, minHeight: s.views ? 2 : 0, background: "#7a9a00", borderRadius: "4px 4px 0 0" }} />
                </div>
              ))}
            </div>
            <div className="meta" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span>{new Date(allDays[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              <span>max {max} / jour</span>
              <span>aujourd&apos;hui</span>
            </div>
            <details style={{ marginTop: 8 }}>
              <summary className="hint" style={{ cursor: "pointer" }}>Voir le tableau</summary>
              <table className="tbl"><tbody>{series.filter((s) => s.views).map((s) => <tr key={s.day}><td>{s.day}</td><td style={{ textAlign: "right" }}>{s.views}</td></tr>)}</tbody></table>
            </details>
          </>
        )}
      </section>
      <div className="panels" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>Contenus les plus lus</h2>
          {top.length === 0 ? <p className="hint">—</p> : (
            <table className="tbl"><tbody>
              {top.map((t) => (
                <tr key={t.id}><td className="t"><Link href={`/admin/articles/${t.id}`}>{t.title}</Link>{bar(t.views, top[0].views)}</td><td style={{ textAlign: "right" }} className="meta">{t.views}</td></tr>
              ))}
            </tbody></table>
          )}
        </section>
        <section className="panel">
          <h2>Par rubrique</h2>
          {byCat.length === 0 ? <p className="hint">—</p> : (
            <table className="tbl"><tbody>
              {byCat.map((c) => (
                <tr key={c.name ?? "-"}><td className="t">{c.name ?? "Sans rubrique"}{bar(c.views, byCat[0].views)}</td><td className="meta" style={{ textAlign: "right" }}>{c.views} · {c.n} art.</td></tr>
              ))}
            </tbody></table>
          )}
        </section>
        <section className="panel">
          <h2>Sources de trafic</h2>
          {srcList.length === 0 ? <p className="hint">—</p> : (
            <table className="tbl"><tbody>
              {srcList.map(([k, v]) => (
                <tr key={k}><td className="t">{label(k)}{bar(v, srcList[0][1])}</td><td className="meta" style={{ textAlign: "right" }}>{v}</td></tr>
              ))}
            </tbody></table>
          )}
          <p className="hint">Le temps d&apos;engagement détaillé et les visiteurs uniques demandent un outil dédié respectueux du RGPD (Plausible, Matomo) : voir la documentation.</p>
        </section>
      </div>
    </>
  );
}
