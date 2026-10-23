import { NextResponse } from "next/server";
import { desc, ilike } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export function GET(req: Request) {
  return handle(async () => {
    await requireApiUser(req);
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const db = await getDb();
    const rows = await db
      .select({ id: schema.articles.id, title: schema.articles.title, slug: schema.articles.slug, status: schema.articles.status })
      .from(schema.articles)
      .where(q ? ilike(schema.articles.title, `%${q.replace(/[%_]/g, "")}%`) : undefined)
      .orderBy(desc(schema.articles.updatedAt))
      .limit(12);
    return NextResponse.json({ items: rows });
  });
}
