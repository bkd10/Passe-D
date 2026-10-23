import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Mesure d'audience sans cookie ni donnée personnelle : un compteur par article et par jour,
// plus le domaine d'origine du visiteur (moteur de recherche, réseau social, direct…).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 204 });
  if (!rateLimit(`view:${id}:${clientIp(req)}`, 1, 30 * 60_000)) return new NextResponse(null, { status: 204 });
  if (/bot|crawl|spider|preview/i.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  let source = "direct";
  try {
    if (body.ref) {
      const host = new URL(String(body.ref)).hostname.replace(/^www\./, "");
      const self = new URL(req.url).hostname.replace(/^www\./, "");
      source = host === self ? "interne" : host.slice(0, 60);
    }
  } catch {}
  const day = new Date().toISOString().slice(0, 10);
  const db = await getDb();
  const updated = await db
    .update(schema.articles)
    .set({ views: sql`${schema.articles.views} + 1` })
    .where(eq(schema.articles.id, id))
    .returning({ id: schema.articles.id });
  if (!updated.length) return new NextResponse(null, { status: 204 });
  await db
    .insert(schema.dailyViews)
    .values({ day, articleId: id, views: 1, referrers: { [source]: 1 } })
    .onConflictDoUpdate({
      target: [schema.dailyViews.day, schema.dailyViews.articleId],
      set: {
        views: sql`${schema.dailyViews.views} + 1`,
        referrers: sql`jsonb_set(${schema.dailyViews.referrers}, ${`{${source}}`}::text[], to_jsonb(coalesce((${schema.dailyViews.referrers}->>${source})::int, 0) + 1))`,
      },
    });
  return new NextResponse(null, { status: 204 });
}
