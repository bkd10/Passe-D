import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthError, requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export function GET(req: Request) {
  return handle(async () => {
    const u = await requireApiUser(req);
    if (!can.manageSettings({ id: u.id, role: u.role, active: u.active })) throw new AuthError("Réservé à l'administration");
    const db = await getDb();
    const rows = await db.select().from(schema.subscribers).orderBy(desc(schema.subscribers.createdAt));
    await audit(u.id, "export", "subscribers", "", { count: rows.length });
    const csv = ["email;thematiques;inscription", ...rows.map((r) => `${r.email};${r.topics.join(",")};${r.createdAt.toISOString()}`)].join("\n");
    return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=newsletter.csv" } });
  });
}
