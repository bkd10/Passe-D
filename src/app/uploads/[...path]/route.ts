import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_DIR } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

// Sert les médias stockés localement (sans Supabase). En production, les médias sont sur Supabase Storage.
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p.includes("..") || p.startsWith("."))) return new Response("Introuvable", { status: 404 });
  const file = path.join(LOCAL_DIR, ...parts);
  if (!file.startsWith(LOCAL_DIR)) return new Response("Introuvable", { status: 404 });
  try {
    const data = await readFile(file);
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
