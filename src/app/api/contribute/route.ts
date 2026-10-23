import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { plainText } from "@/lib/sanitize";

const input = z.object({
  kind: z.enum(["resultat", "compte-rendu", "portrait", "evenement", "correction", "sujet"]),
  clubName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(200),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(8000),
  consent: z.literal(true),
  website: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  if (!rateLimit(`contrib:${clientIp(req)}`, 5, 3600_000)) {
    return NextResponse.json({ message: "Trop d'envois, réessayez dans une heure." }, { status: 429 });
  }
  const parsed = input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Merci de remplir tous les champs obligatoires et d'accepter les conditions." }, { status: 400 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ message: "Merci !" });
  const db = await getDb();
  await db.insert(schema.submissions).values({
    kind: d.kind,
    clubName: plainText(d.clubName, 120),
    contactName: plainText(d.contactName, 120),
    contactEmail: d.contactEmail.toLowerCase(),
    title: plainText(d.title, 200),
    body: plainText(d.body, 8000),
  });
  return NextResponse.json({ message: "Merci ! Votre contribution est entre les mains de la rédaction. Rien n'est publié sans vérification." });
}
