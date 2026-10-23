"use client";

import { useState } from "react";

export function Newsletter({ cats }: { cats: { slug: string; name: string }[] }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), topics: fd.getAll("topics"), website: fd.get("website") }),
    });
    const data = await res.json().catch(() => ({}));
    setState(res.ok ? "ok" : "err");
    setMsg(data.message ?? (res.ok ? "Merci !" : "Une erreur est survenue."));
  }

  return (
    <div className="newsletter">
      <div>
        <span className="kicker">Newsletter · gratuite</span>
        <h2>Le brief du matin</h2>
        <p>Un talent, une histoire, un chiffre et le mercato vérifié. Chaque matin, cinq minutes de lecture. Désinscription en un clic.</p>
      </div>
      <form onSubmit={submit}>
        <div className="form-inline">
          <label className="sr-only" htmlFor="nl-email">Adresse e-mail</label>
          <input id="nl-email" className="input" type="email" name="email" required placeholder="ton@email.fr" autoComplete="email" />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden />
          <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Envoi…" : "Je m'inscris"}</button>
        </div>
        <fieldset className="topics" style={{ border: 0, padding: 0 }}>
          <legend className="meta" style={{ marginBottom: 6 }}>Alertes thématiques (facultatif)</legend>
          {cats.map((c) => (
            <label key={c.slug}>
              <input type="checkbox" name="topics" value={c.slug} /> {c.name}
            </label>
          ))}
        </fieldset>
        <p className={`form-msg ${state === "ok" ? "ok" : state === "err" ? "err" : ""}`} role="status">{msg}</p>
      </form>
    </div>
  );
}
