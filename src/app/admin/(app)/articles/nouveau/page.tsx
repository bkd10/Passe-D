import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can, isEditor } from "@/lib/permissions";
import { NewArticleForm } from "@/components/admin/new-article-form";
import { FORMAT_LABELS, MODULES } from "@/lib/editorial";

export const metadata = { title: "Nouvel article" };

export default async function NewArticle() {
  const user = await requireUser();
  const actor = { id: user.id, role: user.role, active: user.active };
  if (!can.createArticle(actor)) redirect("/admin/articles");
  const db = await getDb();
  const [cats, people] = await Promise.all([
    db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(schema.categories.position),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true)).orderBy(schema.users.name),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Nouvel article</h1>
          <p>Trois infos pour démarrer. Tout se modifie ensuite dans l&apos;éditeur.</p>
        </div>
      </div>
      <NewArticleForm
        cats={cats}
        people={people}
        formats={Object.entries(FORMAT_LABELS)}
        modules={MODULES.map((m) => ({ slug: m.slug, name: m.name, rule: m.rule }))}
        editor={isEditor(actor)}
      />
    </>
  );
}
