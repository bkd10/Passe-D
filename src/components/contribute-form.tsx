"use client";

import { useState } from "react";

const KINDS = [
  ["resultat", "Un résultat de match"],
  ["compte-rendu", "Un compte rendu"],
  ["portrait", "Un portrait (joueur, éducateur, bénévole)"],
  ["evenement", "Un événement à venir"],
  ["correction", "Corriger une information sur notre club"],
  ["sujet", "Proposer un sujet à la rédaction"],
];

export function ContributeForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(fd), consent: fd.get("consent") === "on" }),
    });
    const data = await res.json().catch(() => ({}));
    setState(res.ok ? "ok" : "err");
    setMsg(data.message ?? "");
    if (res.ok) e.currentTarget.reset();
  }
  if (state === "ok") {
    return (
      <div className="notice" role="status" style={{ fontSize: 16 }}>
        <strong>Bien reçu</strong>
        {msg}
      </div>
    );
  }
  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="kind">Vous nous envoyez…</label>
        <select id="kind" name="kind" className="input" required>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="clubName">Club</label>
        <input id="clubName" name="clubName" className="input" required maxLength={120} placeholder="Ex. : AS Bondy, U17 R1" />
      </div>
      <div className="field">
        <label htmlFor="contactName">Votre nom et votre rôle au club</label>
        <input id="contactName" name="contactName" className="input" required maxLength={120} placeholder="Ex. : Karim D., éducateur U17" />
      </div>
      <div className="field">
        <label htmlFor="contactEmail">E-mail (non publié)</label>
        <input id="contactEmail" name="contactEmail" type="email" className="input" required />
      </div>
      <div className="field">
        <label htmlFor="title">Titre</label>
        <input id="title" name="title" className="input" required maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="body">Votre message</label>
        <textarea id="body" name="body" className="input" rows={8} required minLength={10} maxLength={8000} />
        <span className="hint">Score, date, compétition, buteurs… Pour un mineur, ne donnez que le prénom et assurez-vous de l&apos;accord des parents.</span>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden />
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, marginBottom: 18 }}>
        <input type="checkbox" name="consent" required style={{ marginTop: 4 }} />
        J&apos;accepte que la rédaction me recontacte pour vérifier ces informations. Rien n&apos;est publié sans validation.
      </label>
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Envoi…" : "Envoyer à la rédaction"}</button>
      {state === "err" && <p className="form-msg err" role="alert">{msg || "Une erreur est survenue."}</p>}
    </form>
  );
}
