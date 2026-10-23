import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Stockage des fichiers : Supabase Storage en production, dossier public/uploads en local.
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

let bucketReady = false;

/** Crée le bucket public des médias s'il n'existe pas encore (une fois par instance). */
async function ensureBucket(cfg: { url: string; key: string }) {
  if (bucketReady) return;
  const res = await fetch(`${cfg.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 200 * 1024 * 1024 }),
  });
  if (res.ok || res.status === 409 || res.status === 400) bucketReady = true;
}

// Fichiers locaux (développement / auto-hébergement), servis par la route /uploads/[...path].
export const LOCAL_DIR = path.join(process.cwd(), process.env.LOCAL_UPLOADS_DIR || ".data/uploads");

/** Lit un fichier stocké (local ou distant) pour le retravailler côté serveur. */
export async function readObject(url: string, key: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    const { readFile } = await import("node:fs/promises");
    return readFile(path.join(LOCAL_DIR, key));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fichier source introuvable.");
  return Buffer.from(await res.arrayBuffer());
}

export const storageMode = () => (supabaseConfig() ? "supabase" : "local");

export function newKey(ext: string) {
  const d = new Date();
  const folder = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${folder}/${randomBytes(10).toString("hex")}.${ext}`;
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<string> {
  const cfg = supabaseConfig();
  if (cfg) {
    await ensureBucket(cfg);
    const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        apikey: cfg.key,
        "Content-Type": contentType,
        "Cache-Control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Stockage Supabase : ${res.status} ${await res.text()}`);
    return `${cfg.url}/storage/v1/object/public/${BUCKET}/${key}`;
  }
  if (process.env.VERCEL) {
    throw new Error("Stockage des médias non configuré : renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  }
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return `/uploads/${key}`;
}

export async function deleteObject(key: string) {
  const cfg = supabaseConfig();
  if (cfg) {
    await fetch(`${cfg.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [key] }),
    });
    return;
  }
  await unlink(path.join(LOCAL_DIR, key)).catch(() => {});
}

/** Lien d'envoi direct vers Supabase (contourne la limite de taille des fonctions serveur). */
export async function signedUpload(key: string): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  await ensureBucket(cfg);
  const res = await fetch(`${cfg.url}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Stockage Supabase : ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { url: string };
  return { uploadUrl: `${cfg.url}/storage/v1${data.url}`, publicUrl: `${cfg.url}/storage/v1/object/public/${BUCKET}/${key}` };
}
