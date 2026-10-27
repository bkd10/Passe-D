"use client";

import { useState } from "react";

type Props = {
  articleId: number;
  slug: string;
  siteUrl: string;
  canEdit: boolean;
  isLive: boolean;
  initial: { title: string; dek: string; text: string; published: boolean };
};

/** Version anglaise de l'article, saisie en texte simple et publiée à part sur /en. */
export function EnglishPanel({ articleId, slug, siteUrl, canEdit, isLive, initial }: Props) {
  const [v, setV] = useState(initial);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; msg: string }>({ kind: "idle" });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    setState({ kind: "idle" });
  };

  async function save() {
    setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/english`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      setState(res.ok ? { kind: "saved" } : { kind: "error", msg: data.error || "Enregistrement impossible." });
    } catch {
      setState({ kind: "error", msg: "Connexion perdue. Réessayez." });
    }
  }

  return (
    <section className="panel">
      <h2>Version anglaise</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Facultatif. Pour les lecteurs étrangers : l&apos;article traduit a sa propre page, et la version française affiche un lien « Read in English ».
      </p>
      <label htmlFor="en-title">Title</label>
      <input id="en-title" className="input" lang="en" value={v.title} readOnly={!canEdit} onChange={(e) => set("title", e.target.value)} />
      <label htmlFor="en-dek">Standfirst (chapô)</label>
      <textarea id="en-dek" className="input" lang="en" rows={3} value={v.dek} readOnly={!canEdit} onChange={(e) => set("dek", e.target.value)} />
      <label htmlFor="en-text">Text</label>
      <textarea id="en-text" className="input" lang="en" rows={12} value={v.text} readOnly={!canEdit} onChange={(e) => set("text", e.target.value)} />
      <p className="hint">
        Une ligne vide entre les paragraphes. <code>## </code> pour un intertitre, <code>- </code> pour une liste, <code>**gras**</code>, <code>[texte](https://lien)</code>.
      </p>
      <label className="check">
        <input type="checkbox" checked={v.published} disabled={!canEdit} onChange={(e) => set("published", e.target.checked)} /> Publier la version anglaise
      </label>
      {v.published && !isLive && <p className="hint">Elle sera visible quand l&apos;article français sera publié.</p>}
      {canEdit && (
        <button type="button" className="btn sm" style={{ marginTop: 8 }} disabled={state.kind === "saving"} onClick={save}>
          {state.kind === "saving" ? "Enregistrement…" : "Enregistrer la version anglaise"}
        </button>
      )}
      {state.kind === "saved" && (
        <p className="hint" role="status">
          Enregistré.{" "}
          {v.published && isLive && (
            <a href={`/en/articles/${slug}`} target="_blank" rel="noopener">
              Voir {siteUrl.replace(/^https?:\/\//, "")}/en/articles/{slug}
            </a>
          )}
        </p>
      )}
      {state.kind === "error" && (
        <p className="hint" role="alert" style={{ color: "var(--danger, #c0392b)" }}>
          {state.msg}
        </p>
      )}
    </section>
  );
}
