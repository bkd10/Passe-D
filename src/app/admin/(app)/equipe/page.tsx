import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { can, isEditor, ROLE_LABELS } from "@/lib/permissions";
import { InviteForm } from "@/components/admin/team-forms";
import { formatDate } from "@/lib/util";

export const metadata = { title: "Équipe" };

const RIGHTS: Record<string, string> = {
  admin: "Tout : paramètres, comptes, publication.",
  publisher: "Supervise, valide et publie. Réglages du site.",
  editor_in_chief: "Affecte les sujets, relit, valide, programme et publie.",
  journalist: "Écrit et modifie ses articles, les envoie en relecture.",
  media: "Importe et gère les médias, contribue aux articles.",
  seo: "Optimise titres, descriptions, URL, sujets et liens.",
  contributor: "Accès limité aux articles qui lui sont confiés.",
};

export default async function TeamPage() {
  const me = await requireUser();
  const actor = { id: me.id, role: me.role, active: me.active };
  if (!can.manageUsers(actor) && !isEditor(actor)) redirect("/admin");
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      invited: sql<boolean>`${schema.users.passwordHash} is null`,
      lastLoginAt: schema.users.lastLoginAt,
      published: sql<number>`(select count(*)::int from ${schema.articles} where ${schema.articles.authorId} = ${schema.users.id} and ${schema.articles.status} in ('published','update_needed'))`,
      open: sql<number>`(select count(*)::int from ${schema.articles} where ${schema.articles.assigneeId} = ${schema.users.id} and ${schema.articles.status} in ('assigned','writing','changes','update_needed'))`,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.active), schema.users.name);
  void eq;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Équipe</h1>
          <p>{rows.filter((r) => r.active).length} membre(s) actif(s)</p>
        </div>
      </div>
      {can.manageUsers(actor) && <InviteForm roles={ROLES.map((r) => [r, ROLE_LABELS[r]])} />}
      <div className="tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl">
          <thead>
            <tr><th>Nom</th><th>Rôle</th><th className="hide-sm">Publiés</th><th className="hide-sm">En cours</th><th className="hide-sm">Dernière connexion</th><th>État</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td className="t">
                  {can.manageUsers(actor) ? <Link href={`/admin/equipe/${r.id}`}>{r.name}</Link> : r.name}
                  <div className="meta" style={{ fontSize: 11 }}>{r.email}</div>
                </td>
                <td>{ROLE_LABELS[r.role]}</td>
                <td className="hide-sm"><Link href={`/admin/articles?personne=${r.id}&statut=published`}>{r.published}</Link></td>
                <td className="hide-sm"><Link href={`/admin/articles?personne=${r.id}`}>{r.open}</Link></td>
                <td className="hide-sm meta">{r.lastLoginAt ? formatDate(r.lastLoginAt) : "—"}</td>
                <td>{!r.active ? <span className="st st-archived">Désactivé</span> : r.invited ? <span className="st st-review">Invitation en attente</span> : <span className="st st-published">Actif</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Rôles et permissions</h2>
        <table className="tbl"><tbody>
          {ROLES.map((r) => <tr key={r}><td className="t" style={{ whiteSpace: "nowrap" }}>{ROLE_LABELS[r]}</td><td>{RIGHTS[r]}</td></tr>)}
        </tbody></table>
        <p className="hint">Les permissions sont vérifiées par le serveur à chaque action, pas seulement par l&apos;affichage des boutons.</p>
      </section>
    </>
  );
}
