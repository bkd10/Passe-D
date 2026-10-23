import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const input = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  topics: z.array(z.string().max(60)).max(20).default([]),
  website: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  if (!rateLimit(`nl:${clientIp(req)}`, 5, 3600_000)) {
    return NextResponse.json({ message: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }
  const parsed = input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ message: "Adresse e-mail invalide." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ message: "Merci !" }); // pot de miel anti-robots
  const db = await getDb();
  await db
    .insert(schema.subscribers)
    .values({ email: parsed.data.email, topics: parsed.data.topics })
    .onConflictDoUpdate({ target: schema.subscribers.email, set: { topics: parsed.data.topics } });
  return NextResponse.json({
    message: "C'est noté ! Vous recevrez la newsletter dès son lancement.",
  });
}
