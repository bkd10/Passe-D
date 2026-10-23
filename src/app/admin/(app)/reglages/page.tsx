import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can, isEditor } from "@/lib/permissions";
import { getSetting } from "@/lib/queries";
import { formatDateTime } from "@/lib/util";
import { closePollAction, createPollAction, saveFigureAction } from "../site-actions";
import { storageMode } from "@/lib/storage";

export const metadata = { title: "Une et réglages" };

export default async function SettingsPage() {
  const u = await requireUser();
  const actor = { id: u.id, role: u.role, active: u.active };
  if (!isEditor(actor) && !can.manageSettings(actor)) redirect("/admin");
  const db = await getDb();
  const [figure, polls, [subs], audit] = await Promise.all([
    getSetting<{ value: string; label: string; source: string } | null>("chiffre_du_jour", null),
    db.select().from(schema.polls).orderBy(desc(schema.polls.createdAt)).limit(5),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.subscribers),
    can.viewAudit(actor)
      ? db
          .select({ id: schema.auditLog.id, action: schema.auditLog.action, entity: schema.auditLog.entity, entityId: schema.auditLog.entityId, createdAt: schema.auditLog.createdAt, name: schema.users.name })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
          .orderBy(desc(schema.auditLog.createdAt))
          .limit(60)
      : Promise.resolve([]),
  ]);
  const checks: [string, boolean, string][] = [
    ["Base de données", Boolean(process.env.DATABASE_URL), process.env.DATABASE_URL ? "PostgreSQL connecté" : "Base embarquée de développement (pas pour la production)"],
    ["Stockage des médias", storageMode() === "supabase", storageMode() === "supabase" ? "Supabase Storage" : "Dossier local (développement uniquement)"],
    ["Adresse du site", Boolean(process.env.NEXT_PUBLIC_SITE_URL), process.env.NEXT_PUBLIC_SITE_URL || "NEXT_PUBLIC_SITE_URL non renseignée (liens SEO incorrects)"],
    ["Envoi de la newsletter", false, "Non connecté : les inscriptions sont collectées, l'envoi se branchera sur Brevo ou Resend"],
  ];
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Une et réglages</h1>
          <p>Les modules de la page d&apos;accueil qui ne sont pas des articles, et l&apos;état du site.</p>
        </div>
      </div>
      <div className="panels">
        <form action={saveFigureAction} className="panel">
          <h2>Le chiffre du jour</h2>
          <label className="lbl" htmlFor="v">Chiffre</label>
          <input id="v" name="value" className="input" defaultValue={figure?.value} placeholder="Ex. : 1 140" />
          <label className="lbl" htmlFor="l">Explication (une phrase)</label>
          <textarea id="l" name="label" className="input" rows={2} defaultValue={figure?.label} placeholder="Ex. : clubs amateurs franciliens ont une section féminine cette saison." />
          <label className="lbl" htmlFor="s">Source (obligatoire pour publier un chiffre)</label>
          <input id="s" name="source" className="input" defaultValue={figure?.source} placeholder="Ex. : Ligue de Paris-IDF, 2026" />
          <button className="btn dark" style={{ marginTop: 12 }}>Enregistrer</button>
          <p className="hint">Laissez le chiffre vide pour retirer le module de la une.</p>
        </form>
        <section className="panel">
          <h2>Le débat du vestiaire (sondage)</h2>
          {polls.filter((p) => p.active).map((p) => (
            <div key={p.id} className="note" style={{ marginBottom: 10 }}>
              <b>{p.question}</b>
              <ul style={{ margin: "6px 0", paddingLeft: 18 }}>{p.options.map((o, i) => <li key={i}>{o} : {p.votes[i] ?? 0}</li>)}</ul>
              <form action={closePollAction}><input type="hidden" name="id" value={p.id} /><button className="btn ghost sm">Clôturer</button></form>
            </div>
          ))}
          <form action={createPollAction}>
            <label className="lbl" htmlFor="q">Nouvelle question (remplace la précédente)</label>
            <input id="q" name="question" className="input" required minLength={5} placeholder="La VAR doit-elle arriver en National 3 ?" />
            <label className="lbl" htmlFor="o">Réponses (une par ligne)</label>
            <textarea id="o" name="options" className="input" rows={3} required defaultValue={"Oui\nNon\nSeulement en phase finale"} />
            <button className="btn dark" style={{ marginTop: 12 }}>Lancer le sondage</button>
          </form>
        </section>
        <section className="panel">
          <h2>État du site</h2>
          <table className="tbl"><tbody>
            {checks.map(([k, ok, d]) => <tr key={k}><td className="t">{ok ? "✅" : "⚠️"} {k}</td><td style={{ fontSize: 13 }}>{d}</td></tr>)}
          </tbody></table>
          <h2 style={{ marginTop: 16 }}>Newsletter</h2>
          <p style={{ margin: 0 }}>{subs.n} inscrit(s). <a className="btn ghost sm" href="/api/admin/subscribers">Exporter en CSV</a></p>
        </section>
      </div>
      {audit.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Journal des actions sensibles</h2>
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl"><tbody>
              {audit.map((a) => <tr key={a.id}><td className="meta">{formatDateTime(a.createdAt)}</td><td>{a.name ?? "—"}</td><td>{a.action}</td><td>{a.entity} {a.entityId}</td></tr>)}
            </tbody></table>
          </div>
        </section>
      )}
    </>
  );
}
