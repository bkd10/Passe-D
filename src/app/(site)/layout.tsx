import { Masthead } from "@/components/masthead";
import { Footer } from "@/components/footer";
import { listPublic, navCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

function hhmm(d: Date | null) {
  if (!d) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [cats, latest] = await Promise.all([navCategories(), listPublic({ limit: 6 })]);
  const navCats = cats.filter((c) => !c.parentId);
  return (
    <>
      <Masthead
        cats={navCats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, inNav: c.inNav }))}
        ticker={latest.map((a) => ({ slug: a.slug, title: a.title, time: hhmm(a.publishedAt) }))}
      />
      <main id="contenu">{children}</main>
      <Footer cats={navCats} />
    </>
  );
}
