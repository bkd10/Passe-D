import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/util";
import { reviewSubmissionAction, submissionToDraftAction } from "../site-actions";

export const metadata = { title: "Contributions des clubs" };

const KIND: Record<string, string> = { resultat: "Résultat", "compte-rendu": "Compte rendu", portrait: "Portrait", evenement: "Événement", correction: "Correction", sujet: "Sujet proposé" };
const ST: Record<string, [string, string]> = { nouveau: ["Nouveau", "review"], "en-cours": ["En cours", "writing"], accepte: ["Accepté", "published"], refuse: ["Refusé", "archived"] };

export default async function ContributionsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const u = await requireUser();
  if (!can.moderateSubmissions({ id: u.id, role: u.role, active: u.active })) redirect("/admin");
  const { statut } = await searchParams;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.submissions)
    .where(statut ? eq(schema.submissions.status, statut) : undefined)
    .orderBy(desc(schema.submissions.createdAt))
    .limit(100);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Contributions clubs</h1>
          <p>Envoyées depuis la page publique « Contribuer ». Rien n&apos;est publié sans validation.</p>
        </div>
        <nav className="tabs">
          <a href="/admin/contributions" aria-current={!statut ? "page" : undefined}>Toutes</a>
          {Object.entries(ST).map(([k, [l]]) => <a key={k} href={`/admin/contributions?statut=${k}`} aria-current={statut === k ? "page" : undefined}>{l}</a>)}
        </nav>
      </div>
      {rows.length === 0 ? (
        <div className="panel" style={{ textAlign: "center" }}>Aucune contribution. Partagez le lien <b>/contribuer</b> aux clubs de votre territoire.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((s) => (
            <article key={s.id} className="panel">
              <h2>
                <span>{KIND[s.kind] ?? s.kind} · {s.clubName}</span>
                <span className={`st st-${ST[s.status]?.[1] ?? "idea"}`}>{ST[s.status]?.[0] ?? s.status}</span>
              </h2>
              <p style={{ margin: "0 0 4px", fontWeight: 700 }}>{s.title}</p>
              <p style={{ whiteSpace: "pre-wrap", margin: "0 0 8px" }}>{s.body}</p>
              <p className="meta">{s.contactName} · <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> · reçu {formatDateTime(s.createdAt)}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
                <form action={reviewSubmissionAction} style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                  <input type="hidden" name="id" value={s.id} />
                  <input className="input" name="reviewNote" defaultValue={s.reviewNote} placeholder="Note de vérification (interne)" style={{ flex: "1 1 220px" }} />
                  <select className="input" name="status" defaultValue={s.status} style={{ width: 140 }} aria-label="Statut">
                    {Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <button className="btn ghost">Mettre à jour</button>
                </form>
                <form action={submissionToDraftAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn dark">Transformer en brouillon</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
