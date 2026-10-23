import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { EditUserForm } from "@/components/admin/team-forms";
import { StatusPill } from "@/components/admin/bits";
import { formatDateTime } from "@/lib/util";

export const metadata = { title: "Membre" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (!can.manageUsers({ id: me.id, role: me.role, active: me.active })) redirect("/admin/equipe");
  const id = Number((await params).id);
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!u) notFound();
  const [cats, history] = await Promise.all([
    db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(schema.categories.position),
    db
      .select({ id: schema.articles.id, title: schema.articles.title, status: schema.articles.status, updatedAt: schema.articles.updatedAt })
      .from(schema.articles)
      .where(or(eq(schema.articles.authorId, id), eq(schema.articles.assigneeId, id)))
      .orderBy(desc(schema.articles.updatedAt))
      .limit(30),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{u.name}</h1>
          <p>{ROLE_LABELS[u.role]} · <Link href={`/auteurs/${u.slug}`} target="_blank" style={{ textDecoration: "underline" }}>page auteur publique</Link></p>
        </div>
        <Link className="btn ghost" href="/admin/equipe">← Équipe</Link>
      </div>
      <EditUserForm u={{ ...u, categoryIds: u.categoryIds }} roles={ROLES.map((r) => [r, ROLE_LABELS[r]])} cats={cats} />
      <section className="panel" style={{ marginTop: 14, maxWidth: 760 }}>
        <h2>Historique des contributions</h2>
        {history.length === 0 ? <p className="hint">Aucun article.</p> : (
          <table className="tbl"><tbody>
            {history.map((a) => (
              <tr key={a.id}><td className="t"><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></td><td><StatusPill s={a.status} /></td><td className="meta">{formatDateTime(a.updatedAt)}</td></tr>
            ))}
          </tbody></table>
        )}
      </section>
    </>
  );
}
