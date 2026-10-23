import "../admin.css";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { can, isEditor, ROLE_LABELS } from "@/lib/permissions";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Rédaction", template: "%s · Rédaction Passe D" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const actor = { id: user.id, role: user.role, active: user.active };
  const db = await getDb();
  const [[review], [subs], [mine]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.status, "review")),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.submissions).where(eq(schema.submissions.status, "nouveau")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.articles)
      .where(and(eq(schema.articles.assigneeId, user.id), inArray(schema.articles.status, ["assigned", "writing", "changes", "update_needed"]))),
  ]);
  const nav = [
    { href: "/admin", label: "Tableau de bord", count: mine.n },
    { href: "/admin/articles", label: "Articles", count: isEditor(actor) ? review.n : 0 },
    { href: "/admin/articles?vue=kanban", label: "Kanban" },
    { href: "/admin/articles?vue=calendrier", label: "Calendrier" },
    { href: "/admin/medias", label: "Médiathèque" },
    ...(can.moderateSubmissions(actor) ? [{ href: "/admin/contributions", label: "Contributions clubs", count: subs.n }] : []),
    ...(can.viewAnalytics(actor) ? [{ href: "/admin/audience", label: "Audience" }] : []),
    { sep: "Organisation" },
    ...(can.manageUsers(actor) || isEditor(actor) ? [{ href: "/admin/equipe", label: "Équipe" }] : []),
    ...(can.manageTaxonomy(actor) ? [{ href: "/admin/rubriques", label: "Rubriques et sujets" }] : []),
    ...(can.manageSettings(actor) || isEditor(actor) ? [{ href: "/admin/reglages", label: "Une et réglages" }] : []),
    { href: "/admin/profil", label: "Mon profil" },
  ];
  return (
    <AdminShell nav={nav} me={{ name: user.name, role: ROLE_LABELS[user.role] }} canCreate={can.createArticle(actor)}>
      {children}
    </AdminShell>
  );
}
