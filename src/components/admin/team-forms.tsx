"use client";

import { useActionState, useState } from "react";
import { inviteAction, resetLinkAction, updateProfileAction, updateUserAction, type TeamState } from "@/app/admin/(app)/equipe/actions";
import { MediaPicker, thumb } from "./media-picker";

function Result({ s }: { s: TeamState }) {
  const [copied, setCopied] = useState(false);
  if (!s) return null;
  if (s.error) return <div className="alert err" role="alert">{s.error}</div>;
  const full = s.link ? `${location.origin}${s.link}` : "";
  return (
    <div className="alert ok" role="status">
      {s.ok}
      {s.link && (
        <>
          <p style={{ margin: "8px 0 4px", fontWeight: 500 }}>Envoyez ce lien à la personne (SMS, e-mail, WhatsApp). Aucun e-mail n&apos;est envoyé automatiquement.</p>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="input" readOnly value={full} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn dark" onClick={() => navigator.clipboard.writeText(full).then(() => setCopied(true))}>{copied ? "Copié" : "Copier"}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function InviteForm({ roles }: { roles: [string, string][] }) {
  const [state, action, pending] = useActionState(inviteAction, undefined);
  return (
    <form action={action} className="panel">
      <h2>Inviter un membre</h2>
      <Result s={state} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div><label className="lbl" htmlFor="in-name">Nom public</label><input id="in-name" name="name" className="input" required /></div>
        <div><label className="lbl" htmlFor="in-email">E-mail</label><input id="in-email" name="email" type="email" className="input" required /></div>
        <div>
          <label className="lbl" htmlFor="in-role">Rôle</label>
          <select id="in-role" name="role" className="input" defaultValue="journalist">
            {roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <button className="btn dark" style={{ marginTop: 12 }} disabled={pending}>Créer le lien d&apos;invitation</button>
    </form>
  );
}

type U = { id: number; name: string; email: string; role: string; bio: string; specialties: string; avatarUrl: string | null; active: boolean; categoryIds: number[] };

export function EditUserForm({ u, roles, cats }: { u: U; roles: [string, string][]; cats: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(updateUserAction, undefined);
  const [reset, resetAction, resetPending] = useActionState(resetLinkAction, undefined);
  const [avatar, setAvatar] = useState(u.avatarUrl ?? "");
  const [pick, setPick] = useState(false);
  return (
    <>
      <form action={action} className="panel" style={{ maxWidth: 760 }}>
        <Result s={state} />
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="avatarUrl" value={avatar} />
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 6 }}>
          <button type="button" className="cover-pick" style={{ width: 84, height: 84, aspectRatio: "1", borderRadius: "50%" }} onClick={() => setPick(true)}>
            {avatar ? <img src={avatar} alt="" /> : "Photo"}
          </button>
          <div className="hint">Photo de profil affichée sur les articles et la page auteur.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div><label className="lbl" htmlFor="name">Nom public</label><input id="name" name="name" className="input" defaultValue={u.name} required /></div>
          <div><label className="lbl" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={u.email} required /></div>
          <div>
            <label className="lbl" htmlFor="role">Rôle</label>
            <select id="role" name="role" className="input" defaultValue={u.role}>
              {roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="lbl" htmlFor="sp">Spécialités</label><input id="sp" name="specialties" className="input" defaultValue={u.specialties} placeholder="Scouting, football féminin…" /></div>
        </div>
        <label className="lbl" htmlFor="bio">Biographie</label>
        <textarea id="bio" name="bio" className="input" rows={3} defaultValue={u.bio} />
        <label className="lbl">Rubriques attribuées</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cats.map((c) => (
            <label key={c.id} className="check" style={{ fontWeight: 500 }}>
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={u.categoryIds.includes(c.id)} /> {c.name}
            </label>
          ))}
        </div>
        <label className="check" style={{ marginTop: 14 }}>
          <input type="checkbox" name="active" defaultChecked={u.active} /> Compte actif (décocher pour désactiver sans perdre l&apos;historique)
        </label>
        <button className="btn dark" style={{ marginTop: 14 }} disabled={pending}>Enregistrer</button>
      </form>
      <form action={resetAction} className="panel" style={{ maxWidth: 760, marginTop: 14 }}>
        <h2>Accès</h2>
        <Result s={reset} />
        <input type="hidden" name="id" value={u.id} />
        <p className="hint" style={{ marginTop: 0 }}>Mot de passe oublié ou invitation expirée : générez un nouveau lien pour choisir un mot de passe.</p>
        <button className="btn ghost" disabled={resetPending}>Générer un lien d&apos;accès</button>
      </form>
      <MediaPicker open={pick} kind="image" onClose={() => setPick(false)} onPick={(i) => setAvatar(thumb(i[0]))} title="Photo de profil" />
    </>
  );
}

export function ProfileForm({ u }: { u: U }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  const [avatar, setAvatar] = useState(u.avatarUrl ?? "");
  const [pick, setPick] = useState(false);
  return (
    <form action={action} className="panel" style={{ maxWidth: 680 }}>
      <Result s={state} />
      <input type="hidden" name="avatarUrl" value={avatar} />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <button type="button" className="cover-pick" style={{ width: 84, height: 84, aspectRatio: "1", borderRadius: "50%" }} onClick={() => setPick(true)}>
          {avatar ? <img src={avatar} alt="" /> : "Photo"}
        </button>
        <div className="hint">{u.email}</div>
      </div>
      <label className="lbl" htmlFor="name">Nom public</label>
      <input id="name" name="name" className="input" defaultValue={u.name} required />
      <label className="lbl" htmlFor="sp">Spécialités</label>
      <input id="sp" name="specialties" className="input" defaultValue={u.specialties} />
      <label className="lbl" htmlFor="bio">Biographie (affichée sous vos articles)</label>
      <textarea id="bio" name="bio" className="input" rows={4} defaultValue={u.bio} />
      <label className="lbl" htmlFor="pw">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
      <input id="pw" name="password" type="password" className="input" autoComplete="new-password" minLength={10} />
      <button className="btn dark" style={{ marginTop: 14 }} disabled={pending}>Enregistrer</button>
      <MediaPicker open={pick} kind="image" onClose={() => setPick(false)} onPick={(i) => setAvatar(thumb(i[0]))} title="Photo de profil" />
    </form>
  );
}
