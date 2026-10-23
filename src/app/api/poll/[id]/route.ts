import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!rateLimit(`poll:${id}:${clientIp(req)}`, 3, 3600_000)) {
    return NextResponse.json({ message: "Vous avez déjà voté." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const option = Number(body.option);
  const db = await getDb();
  const [poll] = await db.select().from(schema.polls).where(eq(schema.polls.id, Number(id))).limit(1);
  if (!poll || !poll.active || !Number.isInteger(option) || option < 0 || option >= poll.options.length) {
    return NextResponse.json({ message: "Sondage introuvable." }, { status: 404 });
  }
  const votes = poll.options.map((_, i) => (poll.votes[i] ?? 0) + (i === option ? 1 : 0));
  await db.update(schema.polls).set({ votes }).where(eq(schema.polls.id, poll.id));
  return NextResponse.json({ votes });
}
