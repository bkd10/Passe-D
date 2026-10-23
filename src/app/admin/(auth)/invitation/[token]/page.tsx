import { and, eq, gt } from "drizzle-orm";
import { LogoMark } from "@/components/logo";
import { InviteForm } from "@/components/auth-forms";
import { getDb, schema } from "@/db";
import { ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [u] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.inviteToken, token), gt(schema.users.inviteExpiresAt, new Date())))
    .limit(1);
  return (
    <div className="auth-card">
      <span className="logo"><LogoMark />Rédaction</span>
      {u ? (
        <>
          <h1>Bienvenue {u.name.split(" ")[0]}</h1>
          <p style={{ color: "#bdbdbd", margin: 0 }}>Vous rejoignez la rédaction en tant que {ROLE_LABELS[u.role].toLowerCase()}. Choisissez votre mot de passe.</p>
          <InviteForm token={token} />
        </>
      ) : (
        <>
          <h1>Lien expiré</h1>
          <p style={{ color: "#bdbdbd" }}>Ce lien d&apos;invitation n&apos;est plus valable. Demandez-en un nouveau à l&apos;administrateur.</p>
        </>
      )}
    </div>
  );
}
