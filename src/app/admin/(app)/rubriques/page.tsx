import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { deleteCategoryAction, deleteTagAction, saveCategoryAction, saveTagAction } from "../site-actions";

export const metadata = { title: "Rubriques et sujets" };

const KINDS: [string, string][] = [["sujet", "Sujet"], ["joueur", "Joueur"], ["club", "Club"], ["metier", "Métier"], ["competition", "Compétition"]];

export default async function TaxonomyPage() {
  const u = await requireUser();
  if (!can.manageTaxonomy({ id: u.id, role: u.role, active: u.active })) redirect("/admin");
  const db = await getDb();
  const [cats, tags] = await Promise.all([
    db
      .select({ c: schema.categories, n: sql<number>`(select count(*)::int from ${schema.articles} where ${schema.articles.categoryId} = ${schema.categories.id})` })
      .from(schema.categories)
      .orderBy(schema.categories.position),
    db
      .select({ t: schema.tags, n: sql<number>`(select count(*)::int from ${schema.articleTags} where ${schema.articleTags.tagId} = ${schema.tags.id})` })
      .from(schema.tags)
      .orderBy(desc(sql`2`), schema.tags.name)
      .limit(300),
  ]);
  void eq;
  const CatForm = ({ c }: { c?: typeof schema.categories.$inferSelect }) => (
    <form action={saveCategoryAction} style={{ display: "grid", gridTemplateColumns: "56px 1.2fr 1fr 2fr 1fr 70px auto auto", gap: 8, alignItems: "center" }}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="color" name="color" defaultValue={c?.color ?? "#d7ff3a"} aria-label="Couleur" style={{ width: 48, height: 36, border: 0, background: "none" }} />
      <input className="input" name="name" defaultValue={c?.name} placeholder="Nom" required aria-label="Nom" />
      <input className="input" name="slug" defaultValue={c?.slug} placeholder="adresse" aria-label="Adresse" />
      <input className="input" name="description" defaultValue={c?.description} placeholder="Description (SEO et page rubrique)" aria-label="Description" />
      <select className="input" name="parentId" defaultValue={c?.parentId ?? ""} aria-label="Rubrique parente">
        <option value="">— Principale —</option>
        {cats.filter((x) => x.c.id !== c?.id && !x.c.parentId).map((x) => <option key={x.c.id} value={x.c.id}>{x.c.name}</option>)}
      </select>
      <input className="input" name="position" type="number" defaultValue={c?.position ?? cats.length} aria-label="Ordre" />
      <label className="check" style={{ fontSize: 12 }}><input type="checkbox" name="inNav" defaultChecked={c?.inNav ?? true} /> Menu</label>
      <button className="btn ghost sm">{c ? "Enregistrer" : "Ajouter"}</button>
    </form>
  );
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Rubriques et sujets</h1>
          <p>Les rubriques structurent le site ; les sujets (joueurs, clubs, métiers…) créent des pages thématiques automatiques.</p>
        </div>
      </div>
      <section className="panel" style={{ overflowX: "auto" }}>
        <h2>Rubriques</h2>
        <div style={{ display: "grid", gap: 8, minWidth: 900 }}>
          {cats.map(({ c, n }) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}><CatForm c={c} /></div>
              <Link className="meta" href={`/${c.slug}`} target="_blank">{n} art.</Link>
              {n === 0 && (
                <form action={deleteCategoryAction}><input type="hidden" name="id" value={c.id} /><button className="btn danger sm" aria-label={`Supprimer ${c.name}`}>×</button></form>
              )}
            </div>
          ))}
          <p className="lbl" style={{ marginTop: 10 }}>Nouvelle rubrique ou sous-rubrique</p>
          <CatForm />
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Sujets <span className="meta">créés automatiquement depuis l&apos;éditeur</span></h2>
        {tags.length === 0 ? (
          <p className="hint">Aucun sujet pour l&apos;instant. Ajoutez-en depuis l&apos;éditeur d&apos;article.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, overflowX: "auto" }}>
            {tags.map(({ t, n }) => (
              <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 720 }}>
                <form action={saveTagAction} style={{ display: "grid", gridTemplateColumns: "1fr 140px 2fr auto", gap: 8, flex: 1 }}>
                  <input type="hidden" name="id" value={t.id} />
                  <input className="input" name="name" defaultValue={t.name} aria-label="Nom du sujet" />
                  <select className="input" name="kind" defaultValue={t.kind} aria-label="Type">
                    {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input className="input" name="description" defaultValue={t.description} placeholder="Présentation (page /sujets/…)" aria-label="Description" />
                  <button className="btn ghost sm">OK</button>
                </form>
                <Link className="meta" href={`/sujets/${t.slug}`} target="_blank" style={{ width: 50 }}>{n} art.</Link>
                <form action={deleteTagAction}><input type="hidden" name="id" value={t.id} /><button className="btn danger sm" aria-label={`Supprimer ${t.name}`}>×</button></form>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
