"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkCredentials, createSession, destroySession, hashPassword, validatePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { slugify } from "@/lib/util";
import { seedDefaults } from "@/lib/seed";

export type FormState = { error?: string } | undefined;

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`login:${await ip()}`, 20, 15 * 60_000)) return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  const res = await checkCredentials(email, password);
  if (!res.ok) return { error: res.error };
  await createSession(res.user.id);
  await audit(res.user.id, "login", "user", res.user.id);
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
  if (n > 0) return { error: "Le site est déjà configuré. Connectez-vous." };
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (process.env.NODE_ENV === "production" && !expected) {
    return { error: "Ajoutez la variable ADMIN_SETUP_TOKEN dans l'hébergeur, puis rechargez cette page." };
  }
  if (expected && String(fd.get("token") ?? "") !== expected) return { error: "Code d'installation incorrect." };
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Nom et e-mail valides requis." };
  const pwErr = validatePassword(password);
  if (pwErr) return { error: pwErr };
  const [u] = await db
    .insert(schema.users)
    .values({ name, email, slug: slugify(name), role: "admin", passwordHash: await hashPassword(password) })
    .returning();
  await seedDefaults(u.id);
  await createSession(u.id);
  await audit(u.id, "setup", "user", u.id);
  redirect("/admin?bienvenue=1");
}

export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const pwErr = validatePassword(password);
  if (pwErr) return { error: pwErr };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas." };
  const db = await getDb();
  const [u] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.inviteToken, token), gt(schema.users.inviteExpiresAt, new Date())))
    .limit(1);
  if (!u || !u.active) return { error: "Invitation expirée ou invalide. Demandez un nouveau lien à l'administrateur." };
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), inviteToken: null, inviteExpiresAt: null })
    .where(eq(schema.users.id, u.id));
  await createSession(u.id);
  await audit(u.id, "accept_invite", "user", u.id);
  redirect("/admin");
}
