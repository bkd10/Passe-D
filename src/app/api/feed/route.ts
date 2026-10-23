import { NextResponse } from "next/server";
import { listPublic } from "@/lib/queries";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const days = Number(u.searchParams.get("days") || 0);
  const items = await listPublic({
    categorySlug: u.searchParams.get("cat") || undefined,
    format: u.searchParams.get("format") || undefined,
    sort: u.searchParams.get("sort") === "popular" ? "popular" : "recent",
    since: days > 0 ? new Date(Date.now() - days * 86400_000) : undefined,
    limit: Math.min(Number(u.searchParams.get("limit") || 12), 30),
    offset: Math.max(Number(u.searchParams.get("offset") || 0), 0),
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
