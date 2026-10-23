import { notFound, redirect } from "next/navigation";
import "../../../globals.css";
import { currentUser, actorOf } from "@/lib/auth";
import { getArticleForPreview, relatedFor } from "@/lib/queries";
import { getDb } from "@/db";
import { loadRef } from "@/lib/articles";
import { canViewArticle, STATUS_LABELS } from "@/lib/permissions";
import { ArticleView } from "@/components/article-view";
import { Masthead } from "@/components/masthead";
import { navCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aperçu", robots: { index: false, follow: false } };

// Aperçu fidèle : même rendu que le site public, quel que soit le statut de l'article.
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const id = Number((await params).id);
  if (!user) redirect(`/admin/login?next=/admin/apercu/${id}`);
  const db = await getDb();
  const ref = await loadRef(db, id).catch(() => null);
  if (!ref || !canViewArticle(actorOf(user), ref.ref)) notFound();
  const a = await getArticleForPreview(id);
  if (!a) notFound();
  const [related, cats] = await Promise.all([relatedFor(a), navCategories()]);
  return (
    <>
      <div className="preview-bar">
        <span>Aperçu · statut « {STATUS_LABELS[a.article.status]} » · non visible du public tant que l&apos;article n&apos;est pas publié</span>
        <a href={`/admin/articles/${id}`} style={{ textDecoration: "underline" }}>← Retour à l&apos;éditeur</a>
      </div>
      <Masthead cats={cats.filter((c) => !c.parentId).map((c) => ({ slug: c.slug, name: c.name, description: c.description, inNav: c.inNav }))} ticker={[]} />
      <main>
        <ArticleView a={a} related={related} preview />
      </main>
    </>
  );
}
