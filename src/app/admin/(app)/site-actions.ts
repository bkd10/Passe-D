"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can, isEditor, type Actor } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/util";

const RESERVED = ["admin", "api", "articles", "auteurs", "sujets", "recherche", "contribuer", "charte", "mentions-legales", "rss.xml", "sitemap.xml", "robots.txt"];

async function guard(check: (a: Actor) => boolean) {
  const u = await requireUser();
  const a = { id: u.id, role: u.role, active: u.active };
  if (!check(a)) throw new Error("Action non autorisée pour votre rôle.");
  return u;
}

export async function saveCategoryAction(fd: FormData) {
  const u = await guard(can.manageTaxonomy);
  const d = z
    .object({
      id: z.coerce.number().int().optional(),
      name: z.string().trim().min(2).max(60),
      slug: z.string().trim().max(60).optional(),
      description: z.string().trim().max(300).default(""),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#d7ff3a"),
      parentId: z.coerce.number().int().optional(),
      position: z.coerce.number().int().default(0),
    })
    .parse(Object.fromEntries([...fd.entries()].filter(([, v]) => v !== "")));
  const slug = slugify(d.slug || d.name);
  if (RESERVED.includes(slug)) throw new Error("Cette adresse est réservée.");
  const db = await getDb();
  const values = { name: d.name, slug, description: d.description, color: d.color, parentId: d.parentId ?? null, position: d.position, inNav: fd.get("inNav") === "on" };
  if (d.id) await db.update(schema.categories).set(values).where(eq(schema.categories.id, d.id));
  else await db.insert(schema.categories).values(values);
  await audit(u.id, d.id ? "update" : "create", "category", d.id ?? "", { name: d.name });
  revalidatePath("/admin/rubriques");
}

export async function deleteCategoryAction(fd: FormData) {
  const u = await guard((a) => a.role === "admin" || a.role === "publisher");
  const id = Number(fd.get("id"));
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.categoryId, id));
  if (n > 0) throw new Error(`Cette rubrique contient ${n} article(s). Déplacez-les d'abord.`);
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  await audit(u.id, "delete", "category", id);
  revalidatePath("/admin/rubriques");
}

export async function saveTagAction(fd: FormData) {
  await guard(can.manageTaxonomy);
  const d = z
    .object({ id: z.coerce.number().int(), name: z.string().trim().min(1).max(60), kind: z.enum(["sujet", "joueur", "club", "metier", "competition"]), description: z.string().trim().max(400).default("") })
    .parse(Object.fromEntries(fd));
  const db = await getDb();
  await db.update(schema.tags).set({ name: d.name, kind: d.kind, description: d.description }).where(eq(schema.tags.id, d.id));
  revalidatePath("/admin/rubriques");
}

export async function deleteTagAction(fd: FormData) {
  await guard(can.manageTaxonomy);
  const db = await getDb();
  await db.delete(schema.tags).where(eq(schema.tags.id, Number(fd.get("id"))));
  revalidatePath("/admin/rubriques");
}

export async function reviewSubmissionAction(fd: FormData) {
  const u = await guard(can.moderateSubmissions);
  const id = Number(fd.get("id"));
  const status = z.enum(["nouveau", "en-cours", "accepte", "refuse"]).parse(fd.get("status"));
  const db = await getDb();
  await db.update(schema.submissions).set({ status, reviewNote: String(fd.get("reviewNote") ?? "").slice(0, 1000), reviewedBy: u.id }).where(eq(schema.submissions.id, id));
  revalidatePath("/admin/contributions");
}

export async function submissionToDraftAction(fd: FormData) {
  const u = await guard(isEditor);
  const id = Number(fd.get("id"));
  const db = await getDb();
  const [s] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id)).limit(1);
  if (!s) throw new Error("Contribution introuvable");
  const [cat] = await db.select().from(schema.categories).where(eq(schema.categories.slug, "football-amateur")).limit(1);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    s.body
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("") + `<aside class="callout"><p>Source : ${esc(s.contactName)} (${esc(s.clubName)}). Informations à vérifier avant publication.</p></aside>`;
  const { createArticle, saveArticle } = await import("@/lib/articles");
  const actor = { id: u.id, role: u.role, active: u.active };
  const art = await createArticle(actor, { title: s.title, categoryId: cat?.id ?? null, status: "writing" });
  await saveArticle(actor, art.id, { bodyHtml: html, tagNames: [s.clubName] });
  await db.update(schema.submissions).set({ status: "en-cours", reviewedBy: u.id }).where(eq(schema.submissions.id, id));
  const { redirect } = await import("next/navigation");
  redirect(`/admin/articles/${art.id}`);
}

export async function saveFigureAction(fd: FormData) {
  await guard(isEditor);
  const value = { value: String(fd.get("value") ?? "").trim().slice(0, 20), label: String(fd.get("label") ?? "").trim().slice(0, 240), source: String(fd.get("source") ?? "").trim().slice(0, 200) };
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key: "chiffre_du_jour", value: value.value ? value : null })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: value.value ? value : null } });
  revalidatePath("/admin/reglages");
  revalidatePath("/");
}

export async function createPollAction(fd: FormData) {
  await guard(isEditor);
  const question = String(fd.get("question") ?? "").trim().slice(0, 200);
  const options = String(fd.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (question.length < 5 || options.length < 2) throw new Error("Une question et au moins deux réponses.");
  const db = await getDb();
  await db.update(schema.polls).set({ active: false });
  await db.insert(schema.polls).values({ question, options, votes: options.map(() => 0) });
  revalidatePath("/admin/reglages");
}

export async function closePollAction(fd: FormData) {
  await guard(isEditor);
  const db = await getDb();
  await db.update(schema.polls).set({ active: false }).where(eq(schema.polls.id, Number(fd.get("id"))));
  revalidatePath("/admin/reglages");
}
