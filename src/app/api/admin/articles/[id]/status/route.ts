import { NextResponse } from "next/server";
import { z } from "zod";
import { STATUSES } from "@/db/schema";
import { actorOf, requireApiUser } from "@/lib/auth";
import { changeStatus } from "@/lib/articles";
import { handle } from "@/lib/api";

const input = z.object({ to: z.enum(STATUSES), scheduledAt: z.string().nullable().optional(), note: z.string().max(2000).optional() });

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser(req);
    const { id } = await params;
    const body = input.parse(await req.json());
    const saved = await changeStatus(actorOf(user), Number(id), body.to, {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      note: body.note,
    });
    return NextResponse.json({ ok: true, status: saved.status, version: saved.version, publishedAt: saved.publishedAt, scheduledAt: saved.scheduledAt, slug: saved.slug });
  });
}
