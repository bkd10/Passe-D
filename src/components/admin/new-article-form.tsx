"use client";

import { useActionState } from "react";
import { createArticleAction } from "@/app/admin/(app)/articles/actions";

type Opt = { id: number; name: string };

export function NewArticleForm({
  cats,
  people,
  formats,
  modules,
  editor,
}: {
  cats: Opt[];
  people: Opt[];
  formats: [string, string][];
  modules: { slug: string; name: string; rule: string }[];
  editor: boolean;
}) {
  const [state, action, pending] = useActionState(createArticleAction, undefined);
  return (
    <form action={action} className="panel" style={{ maxWidth: 720 }}>
      {state?.error && <div className="alert err">{state.error}</div>}
      <label className="lbl" htmlFor="title">Titre (provisoire)</label>
      <input id="title" name="title" className="input" placeholder="Ex. : Le gardien de Bondy qui a stoppé trois penaltys" autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div>
          <label className="lbl" htmlFor="categoryId">Rubrique</label>
          <select id="categoryId" name="categoryId" className="input">
            <option value="">À choisir plus tard</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="format">Format</label>
          <select id="format" name="format" className="input">
            {formats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="module">Format récurrent (facultatif)</label>
          <select id="module" name="module" className="input">
            <option value="">Aucun</option>
            {modules.map((m) => <option key={m.slug} value={m.slug} title={m.rule}>{m.name}</option>)}
          </select>
        </div>
      </div>
      {editor ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <label className="lbl" htmlFor="assigneeId">Assigner à</label>
            <select id="assigneeId" name="assigneeId" className="input">
              <option value="">Moi-même</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="deadline">Échéance</label>
            <input id="deadline" name="deadline" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="lbl" htmlFor="status">Démarrer comme</label>
            <select id="status" name="status" className="input" defaultValue="writing">
              <option value="writing">Article à écrire maintenant</option>
              <option value="idea">Simple idée de sujet</option>
            </select>
          </div>
        </div>
      ) : (
        <>
          <label className="lbl" htmlFor="status">Démarrer comme</label>
          <select id="status" name="status" className="input" defaultValue="writing">
            <option value="writing">Article à écrire maintenant</option>
            <option value="idea">Proposer une idée de sujet</option>
          </select>
        </>
      )}
      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        <button className="btn dark" disabled={pending}>{pending ? "Création…" : "Créer et ouvrir l'éditeur"}</button>
      </div>
    </form>
  );
}
