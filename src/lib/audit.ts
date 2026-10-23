import "server-only";
import { getDb, schema } from "@/db";

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number = "",
  detail: Record<string, unknown> = {},
) {
  try {
    const db = await getDb();
    await db.insert(schema.auditLog).values({ userId, action, entity, entityId: String(entityId), detail });
  } catch (e) {
    console.error("[audit]", e);
  }
}
