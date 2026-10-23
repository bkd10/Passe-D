"use client";

import { useActionState } from "react";
import { acceptInviteAction, loginAction, setupAction, type FormState } from "@/app/admin/(auth)/actions";

function Err({ s }: { s: FormState }) {
  return s?.error ? <div className="alert err" role="alert" style={{ marginTop: 14 }}>{s.error}</div> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action}>
      <Err s={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" className="input" required autoComplete="username" autoFocus />
      <label htmlFor="password">Mot de passe</label>
      <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      <button className="btn" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

export function SetupForm({ needToken }: { needToken: boolean }) {
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <form action={action}>
      <Err s={state} />
      {needToken && (
        <>
          <label htmlFor="token">Code d&apos;installation (ADMIN_SETUP_TOKEN)</label>
          <input id="token" name="token" className="input" required autoComplete="off" />
        </>
      )}
      <label htmlFor="name">Votre nom public</label>
      <input id="name" name="name" className="input" required />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" className="input" required autoComplete="username" />
      <label htmlFor="password">Mot de passe (10 caractères minimum, lettres et chiffres)</label>
      <input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" />
      <button className="btn" disabled={pending}>{pending ? "Création…" : "Créer le compte administrateur"}</button>
    </form>
  );
}

export function InviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action}>
      <Err s={state} />
      <input type="hidden" name="token" value={token} />
      <label htmlFor="password">Choisissez un mot de passe</label>
      <input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" />
      <label htmlFor="confirm">Confirmez</label>
      <input id="confirm" name="confirm" type="password" className="input" required minLength={10} autoComplete="new-password" />
      <button className="btn" disabled={pending}>{pending ? "…" : "Activer mon compte"}</button>
    </form>
  );
}
