import { NextResponse } from "next/server";
import { z } from "zod";
import { actorOf, requireApiUser } from "@/lib/auth";
import { addCorrection, duplicateArticle, restoreRevision } from "@/lib/articles";
import { handle } from "@/lib/api";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("restore"), revisionId: z.number().int() }),
  z.object({ action: z.literal("correction"), body: z.string().trim().min(3).max(1000) }),
]);

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const id = Number((await params).id);
    const body = input.parse(await req.json());
    const actor = actorOf(user);
    if (body.action === "duplicate") {
      const copy = await duplicateArticle(actor, id);
      return NextResponse.json({ ok: true, id: copy.id });
    }
    if (body.action === "restore") {
      await restoreRevision(actor, id, body.revisionId);
      return NextResponse.json({ ok: true });
    }
    await addCorrection(actor, id, body.body);
    return NextResponse.json({ ok: true });
  });
}
