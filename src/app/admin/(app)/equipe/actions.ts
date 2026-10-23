"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { requireUser, newInviteToken, hashPassword, validatePassword } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/util";

export type TeamState = { error?: string; ok?: string; link?: string } | undefined;

async function admin() {
  const u = await requireUser();
  if (!can.manageUsers({ id: u.id, role: u.role, active: u.active })) throw new Error("Réservé aux administrateurs.");
  return u;
}

async function uniqueUserSlug(name: string, exceptId?: number) {
  const db = await getDb();
  const base = slugify(name);
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db.select({ id: schema.users.id }).from(schema.users).where(exceptId ? and(eq(schema.users.slug, slug), ne(schema.users.id, exceptId)) : eq(schema.users.slug, slug)).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${Date.now()}`;
}

const inviteInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
});

export async function inviteAction(_: TeamState, fd: FormData): Promise<TeamState> {
  let me;
  try {
    me = await admin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = inviteInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Nom, e-mail et rôle valides requis." };
  const db = await getDb();
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  if (exists) return { error: "Un compte existe déjà avec cet e-mail." };
  const token = newInviteToken();
  const [u] = await db
    .insert(schema.users)
    .values({
      ...parsed.data,
      slug: await uniqueUserSlug(parsed.data.name),
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + 7 * 86400_000),
    })
    .returning();
  await audit(me.id, "invite", "user", u.id, { name: u.name, role: u.role });
  revalidatePath("/admin/equipe");
  return { ok: `${u.name} est invité(e).`, link: `/admin/invitation/${token}` };
}

export async function resetLinkAction(_: TeamState, fd: FormData): Promise<TeamState> {
  let me;
  try {
    me = await admin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = Number(fd.get("id"));
  const token = newInviteToken();
  const db = await getDb();
  await db.update(schema.users).set({ inviteToken: token, inviteExpiresAt: new Date(Date.now() + 7 * 86400_000) }).where(eq(schema.users.id, id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await audit(me.id, "reset_link", "user", id);
  return { ok: "Nouveau lien d'accès créé (valable 7 jours). Les sessions ouvertes de ce compte ont été fermées.", link: `/admin/invitation/${token}` };
}

const updateInput = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  bio: z.string().trim().max(800).default(""),
  specialties: z.string().trim().max(200).default(""),
  avatarUrl: z.string().trim().max(500).default(""),
  active: z.string().optional(),
});

export async function updateUserAction(_: TeamState, fd: FormData): Promise<TeamState> {
  let me;
  try {
    me = await admin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = updateInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Champs invalides." };
  const d = parsed.data;
  const active = d.active === "on";
  const db = await getDb();
  if (d.id === me.id && (!active || d.role !== "admin")) return { error: "Vous ne pouvez pas retirer vos propres droits d'administrateur." };
  const [{ admins }] = await db.select({ admins: sql<number>`count(*)::int` }).from(schema.users).where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true), ne(schema.users.id, d.id)));
  if (admins === 0 && (d.role !== "admin" || !active)) return { error: "Il doit rester au moins un administrateur actif." };
  const categoryIds = fd.getAll("categoryIds").map(Number).filter(Boolean);
  await db
    .update(schema.users)
    .set({ name: d.name, email: d.email, role: d.role, bio: d.bio, specialties: d.specialties, avatarUrl: d.avatarUrl || null, active, categoryIds, slug: await uniqueUserSlug(d.name, d.id) })
    .where(eq(schema.users.id, d.id));
  if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, d.id));
  await audit(me.id, "update", "user", d.id, { name: d.name, role: d.role, active });
  revalidatePath("/admin/equipe");
  return { ok: active ? "Profil enregistré." : "Compte désactivé. Son historique et ses articles sont conservés." };
}

const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(800).default(""),
  specialties: z.string().trim().max(200).default(""),
  avatarUrl: z.string().trim().max(500).default(""),
  password: z.string().optional(),
});

export async function updateProfileAction(_: TeamState, fd: FormData): Promise<TeamState> {
  const me = await requireUser();
  const parsed = profileInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Champs invalides." };
  const d = parsed.data;
  const patch: Partial<typeof schema.users.$inferInsert> = { name: d.name, bio: d.bio, specialties: d.specialties, avatarUrl: d.avatarUrl || null, slug: await uniqueUserSlug(d.name, me.id) };
  if (d.password) {
    const err = validatePassword(d.password);
    if (err) return { error: err };
    patch.passwordHash = await hashPassword(d.password);
  }
  const db = await getDb();
  await db.update(schema.users).set(patch).where(eq(schema.users.id, me.id));
  await audit(me.id, "update", "user", me.id, { name: d.name, password: Boolean(d.password) });
  revalidatePath("/admin/profil");
  return { ok: "Profil enregistré." };
}
