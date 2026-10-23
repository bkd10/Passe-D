import Link from "next/link";
import { and, desc, eq, gte, inArray, isNotNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { isEditor } from "@/lib/permissions";
import { MiniList } from "@/components/admin/bits";
import { formatDateTime } from "@/lib/util";
import { promoteScheduled } from "@/lib/queries";

export const metadata = { title: "Tableau de bord" };

const { articles, users } = schema;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const user = await requireUser();
  const { bienvenue } = await searchParams;
  await promoteScheduled(true);
  const db = await getDb();
  const author = alias(users, "author");
  const assignee = alias(users, "assignee");
  const mini = {
    id: articles.id,
    title: articles.title,
    status: articles.status,
    deadline: articles.deadline,
    scheduledAt: articles.scheduledAt,
    publishedAt: articles.publishedAt,
    updatedAt: articles.updatedAt,
    priority: articles.priority,
    authorName: author.name,
    assigneeName: assignee.name,
  };
  const q = () =>
    db.select(mini).from(articles).leftJoin(author, eq(author.id, articles.authorId)).leftJoin(assignee, eq(assignee.id, articles.assigneeId));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const open = ["idea", "assigned", "writing", "review", "changes", "update_needed"] as const;
  const sixMonths = new Date(Date.now() - 180 * 86400_000);

  const [mine, review, scheduled, late, stale, [counts], activity] = await Promise.all([
    q()
      .where(and(or(eq(articles.assigneeId, user.id), eq(articles.authorId, user.id)), inArray(articles.status, [...open])))
      .orderBy(articles.deadline, desc(articles.updatedAt))
      .limit(8),
    q().where(eq(articles.status, "review")).orderBy(articles.updatedAt).limit(8),
    q().where(eq(articles.status, "scheduled")).orderBy(articles.scheduledAt).limit(8),
    q()
      .where(and(isNotNull(articles.deadline), lt(articles.deadline, new Date()), inArray(articles.status, [...open])))
      .orderBy(articles.deadline)
      .limit(8),
    q()
      .where(or(eq(articles.status, "update_needed"), and(eq(articles.status, "published"), lte(articles.publishedAt, sixMonths), sql`${articles.views} > 50`)))
      .orderBy(desc(articles.views))
      .limit(6),
    db
      .select({
        today: sql<number>`count(*) filter (where ${articles.status} = 'published' and ${articles.publishedAt} >= ${startOfDay})::int`,
        review: sql<number>`count(*) filter (where ${articles.status} = 'review')::int`,
        scheduled: sql<number>`count(*) filter (where ${articles.status} = 'scheduled')::int`,
        late: sql<number>`count(*) filter (where ${articles.deadline} < now() and ${articles.status} in ('idea','assigned','writing','review','changes','update_needed'))::int`,
        published: sql<number>`count(*) filter (where ${articles.status} in ('published','update_needed'))::int`,
      })
      .from(articles),
    db
      .select({ id: schema.auditLog.id, action: schema.auditLog.action, entity: schema.auditLog.entity, entityId: schema.auditLog.entityId, detail: schema.auditLog.detail, createdAt: schema.auditLog.createdAt, name: users.name })
      .from(schema.auditLog)
      .leftJoin(users, eq(users.id, schema.auditLog.userId))
      .where(and(gte(schema.auditLog.createdAt, new Date(Date.now() - 7 * 86400_000)), notInArray(schema.auditLog.action, ["login"])))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(12),
  ]);
  const editor = isEditor({ id: user.id, role: user.role, active: user.active });
  const ACTIONS: Record<string, string> = {
    create: "a créé",
    status: "a changé le statut de",
    delete: "a supprimé",
    duplicate: "a dupliqué",
    restore: "a restauré une version de",
    correction: "a ajouté une correction à",
    invite: "a invité",
    update: "a modifié",
    upload: "a importé",
    setup: "a installé le site",
    accept_invite: "a rejoint la rédaction",
  };

  return (
    <>
      {bienvenue && (
        <div className="alert ok">
          Bienvenue ! Le site est prêt. Prochaine étape : <Link href="/admin/articles/publier" style={{ textDecoration: "underline" }}>écrire votre premier article</Link>, puis{" "}
          <Link href="/admin/equipe" style={{ textDecoration: "underline" }}>inviter vos journalistes</Link>.
        </div>
      )}
      <div className="adm-head">
        <div>
          <h1>Bonjour {user.name.split(" ")[0]}</h1>
          <p>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })}</p>
        </div>
        <Link className="btn dark" href="/admin/articles/publier">+ Publier un article</Link>
      </div>
      <div className="stats">
        <div className="stat"><div className="v">{counts.today}</div><div className="l">publiés aujourd&apos;hui</div></div>
        <div className="stat"><div className="v">{counts.review}</div><div className="l">à relire</div></div>
        <div className="stat"><div className="v">{counts.scheduled}</div><div className="l">programmés</div></div>
        <div className={`stat ${counts.late ? "warn" : ""}`}><div className="v">{counts.late}</div><div className="l">en retard</div></div>
        <div className="stat"><div className="v">{counts.published}</div><div className="l">articles en ligne</div></div>
      </div>
      <div className="panels">
        <section className="panel">
          <h2>Mes sujets <Link className="meta" href={`/admin/articles?personne=${user.id}`}>Tout →</Link></h2>
          <MiniList items={mine} empty="Rien d'assigné pour l'instant." show="deadline" />
        </section>
        {editor && (
          <section className="panel">
            <h2>En attente de relecture <Link className="meta" href="/admin/articles?statut=review">Tout →</Link></h2>
            <MiniList items={review} empty="Aucun article à relire." />
          </section>
        )}
        <section className="panel">
          <h2>Programmés <Link className="meta" href="/admin/articles?vue=calendrier">Calendrier →</Link></h2>
          <MiniList items={scheduled} empty="Aucune publication programmée." show="scheduled" />
        </section>
        <section className="panel">
          <h2>En retard</h2>
          <MiniList items={late} empty="Aucun retard. Bravo." show="deadline" />
        </section>
        <section className="panel">
          <h2>À actualiser</h2>
          <MiniList items={stale} empty="Aucun contenu à remettre à jour." />
          <p className="hint">Articles marqués « à actualiser » et articles de plus de 6 mois encore très lus.</p>
        </section>
        <section className="panel">
          <h2>Activité de la rédaction</h2>
          {activity.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>Pas encore d&apos;activité.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {activity.map((a) => (
                <li key={a.id} style={{ fontSize: 13.5 }}>
                  <b>{a.name ?? "Quelqu'un"}</b> {ACTIONS[a.action] ?? a.action}{" "}
                  {a.entity === "article" && a.action !== "delete" ? (
                    <Link href={`/admin/articles/${a.entityId}`} style={{ textDecoration: "underline" }}>
                      {String((a.detail as Record<string, unknown>).title ?? `l'article n°${a.entityId}`)}
                    </Link>
                  ) : (
                    String((a.detail as Record<string, unknown>).title ?? (a.detail as Record<string, unknown>).name ?? "")
                  )}
                  {a.action === "status" && <> → {String((a.detail as Record<string, unknown>).to)}</>}
                  <div className="meta" style={{ fontSize: 11 }}>{formatDateTime(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
