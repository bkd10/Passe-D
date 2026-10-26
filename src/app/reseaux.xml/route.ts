import { listPublic } from "@/lib/queries";
import { socialCaptions } from "@/lib/social-caption";
import { SITE_NAME, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Flux pour la publication automatique (Make, Buffer) : la description est la légende Instagram, l'image est le visuel JPEG 1080×1350. */
export async function GET() {
  const items = await listPublic({ limit: 20 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(SITE_NAME)} · réseaux sociaux</title>
<link>${SITE_URL}</link>
<description>Légendes et visuels prêts à publier</description>
<language>fr-fr</language>
<atom:link href="${SITE_URL}/reseaux.xml" rel="self" type="application/rss+xml"/>
${items
  .map((a) => {
    const image = `${SITE_URL}/articles/${a.slug}/visuel?format=post&type=jpg`;
    const caption = socialCaptions(a, SITE_URL).instagram;
    return `<item>
<title>${esc(a.title)}</title>
<link>${SITE_URL}/articles/${a.slug}</link>
<guid isPermaLink="false">${SITE_URL}/articles/${a.slug}</guid>
${a.publishedAt ? `<pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : ""}
<description>${esc(caption)}</description>
<enclosure url="${esc(image)}" type="image/jpeg" length="0"/>
<media:content url="${esc(image)}" medium="image" type="image/jpeg" width="1080" height="1350"/>
</item>`;
  })
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300" } });
}
