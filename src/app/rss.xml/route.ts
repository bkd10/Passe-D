import { listPublic } from "@/lib/queries";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/util";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const items = await listPublic({ limit: 40 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${SITE_URL}</link>
<description>${esc(SITE_TAGLINE)}</description>
<language>fr-fr</language>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (a) => `<item>
<title>${esc(a.title)}</title>
<link>${SITE_URL}/articles/${a.slug}</link>
<guid>${SITE_URL}/articles/${a.slug}</guid>
${a.publishedAt ? `<pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : ""}
${a.categoryName ? `<category>${esc(a.categoryName)}</category>` : ""}
<description>${esc(a.dek)}</description>
<enclosure url="${SITE_URL}/articles/${a.slug}/visuel?format=post" type="image/png" length="0"/>
<media:content url="${SITE_URL}/articles/${a.slug}/visuel?format=post" medium="image" type="image/png" width="1080" height="1350"/>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300" } });
}
