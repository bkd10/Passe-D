import { Masthead } from "@/components/masthead";
import { Footer } from "@/components/footer";
import { listPublic, navCategories } from "@/lib/queries";
import { SITE_NAME, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

function hhmm(d: Date | null) {
  if (!d) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

// Identité du média pour Google (nom, logo, comptes sociaux) : aide à l'affichage du logo et du panneau de marque.
const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${SITE_URL}/#organisation`,
    name: `${SITE_NAME} Média`,
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
    sameAs: ["https://www.instagram.com/media_passe.d/"],
  },
  { "@context": "https://schema.org", "@type": "WebSite", name: `${SITE_NAME} Média`, alternateName: SITE_NAME, url: SITE_URL, inLanguage: "fr-FR", publisher: { "@id": `${SITE_URL}/#organisation` } },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Le fil « En direct » ne montre que les articles des dernières 24 h ; vide, il disparaît.
  const [cats, latest] = await Promise.all([navCategories(), listPublic({ limit: 8, since: new Date(Date.now() - 24 * 3600_000) })]);
  const navCats = cats.filter((c) => !c.parentId);
  return (
    <>
      <Masthead
        cats={navCats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, inNav: c.inNav }))}
        ticker={latest.map((a) => ({ slug: a.slug, title: a.title, time: hhmm(a.publishedAt) }))}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      <main id="contenu">{children}</main>
      <Footer cats={navCats} />
    </>
  );
}
