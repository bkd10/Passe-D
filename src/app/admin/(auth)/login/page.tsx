import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { LoginForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion à la rédaction" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/admin");
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
  if (n === 0) redirect("/admin/setup");
  const { next } = await searchParams;
  return (
    <div className="auth-card">
      <span className="logo"><span className="logo-mark">QS</span>Rédaction</span>
      <h1>Connexion</h1>
      <p style={{ color: "#b9bcb2", margin: 0 }}>Espace réservé à l&apos;équipe de Quotidien Sportif.</p>
      <LoginForm next={next} />
      <p style={{ fontSize: 13, color: "#80847a", marginTop: 18 }}>
        Mot de passe oublié ? Demandez un nouveau lien d&apos;accès à l&apos;administrateur. <Link href="/" style={{ textDecoration: "underline" }}>Retour au site</Link>
      </p>
    </div>
  );
}
