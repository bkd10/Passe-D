import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Actor } from "./permissions";

const COOKIE = "qs_session";
const SESSION_DAYS = 14;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type SessionUser = typeof schema.users.$inferSelect;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Le mot de passe doit mêler lettres et chiffres.";
  return null;
}

export async function createSession(userId: number) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user || !user.active) return null;
  return user;
}

/** Pour les pages et actions du back-office : redirige vers la connexion si besoin. */
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/admin/login");
  return u;
}

export const actorOf = (u: SessionUser): Actor => ({ id: u.id, role: u.role, active: u.active });

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Pour les routes API : vérifie la session et l'origine de la requête (protection CSRF). */
export async function requireApiUser(req: Request): Promise<SessionUser> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = (await headers()).get("host");
    if (!origin || !host || new URL(origin).host !== host) throw new AuthError("Origine refusée", 403);
  }
  const u = await currentUser();
  if (!u) throw new AuthError("Connexion requise", 401);
  return u;
}

let dummyHash: string | undefined;

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

export async function checkCredentials(email: string, password: string): Promise<LoginResult> {
  const db = await getDb();
  const generic = "Adresse e-mail ou mot de passe incorrect.";
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user || !user.passwordHash) {
    // Même coût de calcul qu'une vraie vérification, pour ne pas révéler l'existence du compte.
    dummyHash ??= await bcrypt.hash("qs-dummy-password", 11);
    await bcrypt.compare(password, dummyHash);
    return { ok: false, error: generic };
  }
  if (!user.active) return { ok: false, error: "Ce compte est désactivé." };
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }
  const good = await bcrypt.compare(password, user.passwordHash);
  if (!good) {
    const failed = user.failedLogins + 1;
    await db
      .update(schema.users)
      .set({
        failedLogins: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(schema.users.id, user.id));
    return { ok: false, error: generic };
  }
  await db
    .update(schema.users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));
  return { ok: true, user };
}

export const newInviteToken = () => randomBytes(24).toString("base64url");
