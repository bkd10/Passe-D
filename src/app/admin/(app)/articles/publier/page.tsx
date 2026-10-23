import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { actorOf, requireUser } from "@/lib/auth";
import { can, isEditor } from "@/lib/permissions";
import { QuickPublishForm } from "@/components/admin/quick-publish-form";
import { SITE_URL } from "@/lib/util";

export const metadata = { title: "Publier un article" };

export default async function QuickPublish() {
  const user = await requireUser();
  const actor = actorOf(user);
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
          <h1>Publier un article</h1>
          <p>Tout sur une seule page : remplissez, puis publiez. Vous pourrez toujours le retoucher ensuite.</p>
        </div>
        <Link className="btn ghost" href="/admin/articles/nouveau">Préparer un sujet ou l&apos;assigner</Link>
      </div>
      <QuickPublishForm cats={cats} people={people} me={{ id: user.id, name: user.name }} canPublish={isEditor(actor)} siteUrl={SITE_URL} />
    </>
  );
}
