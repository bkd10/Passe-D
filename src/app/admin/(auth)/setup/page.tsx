import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { sql } from "drizzle-orm";
import { SetupForm } from "@/components/auth-forms";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Installation" };

export default async function SetupPage() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
  if (n > 0) redirect("/admin/login");
  return (
    <div className="auth-card">
      <span className="logo"><LogoMark />Installation</span>
      <h1>Premier compte</h1>
      <p style={{ color: "#bdbdbd", margin: 0 }}>Créez le compte administrateur. Les rubriques de base seront créées automatiquement.</p>
      <SetupForm needToken={Boolean(process.env.ADMIN_SETUP_TOKEN) || process.env.NODE_ENV === "production"} />
    </div>
  );
}
