import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { MERCATO_LABELS } from "@/lib/editorial";
import type { MercatoStatus } from "@/db/schema";
import { readObject } from "@/lib/storage";

export const SOCIAL_FORMATS = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
} as const;
export type SocialFormat = keyof typeof SOCIAL_FORMATS;

type Input = {
  title: string;
  dek?: string | null;
  categoryName?: string | null;
  mercatoStatus?: string | null;
  sponsored?: boolean;
  cover?: { url: string; storageKey: string | null } | null;
  siteHost: string;
};

const GOLD = "#F2B631";
const INK = "#F3F3F0";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 54"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c950"/><stop offset="1" stop-color="#d9922a"/></linearGradient><linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4cc96a"/><stop offset="1" stop-color="#1f7a3a"/></linearGradient></defs><rect x="6" y="46" width="46" height="6" rx="1.6" fill="url(#r)"/><g fill="none" stroke="#f3f3f0" stroke-width=".5"><path d="M29 46v6M6 47.6h2.4v2.8H6M52 47.6h-2.4v2.8H52"/><circle cx="29" cy="49" r="1.8"/></g><g fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"><path d="M5 14V8a3 3 0 0 1 3-3h5M44 5h4a3 3 0 0 1 3 3v6M5 34v6a3 3 0 0 0 3 3h3M51 34v6a3 3 0 0 1-3 3h-3"/></g><path d="m53.5 21 6-4.2v14.4l-6-4.2z" fill="url(#g)"/><path d="M21 43.5h14c9.5 0 15.5-6.5 15.5-14.5 0-4.5-2-8.4-5.3-11l-3.6 4.2c2 1.6 3.1 4 3.1 6.8 0 4.8-3.6 8.7-9.6 8.7H22.4z" fill="url(#g)"/><path fill="#f3f3f0" fill-rule="evenodd" d="M9.5 43.5 17.5 5h15.5c9 0 14.5 5 13.5 12.3-1 7.5-7.5 12.4-16 12.4h-8.6l-2.9 13.8zM22.6 22.9h7.6c4.6 0 7.8-2.3 8.3-5.9.4-3.1-1.9-5.2-5.9-5.2h-7.6z"/><path d="m27.2 14.6 8.3 3.8-9.9 3.8z" fill="url(#g)"/></svg>`;
const MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 900; style: "normal" }[]> | null = null;
function fonts() {
  fontCache ??= (async () => {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const load = (f: string) => readFile(path.join(dir, f));
    const list = [
      ["Display", 900, "archivo-condense-black"],
      ["Sans", 700, "archivo-bold"],
      ["Mono", 700, "jetbrains-mono-bold"],
    ] as const;
    const out = [];
    for (const [name, weight, file] of list) {
      for (const sub of ["latin", "latin-ext"]) out.push({ name, weight, style: "normal" as const, data: await load(`${file}-${sub}.ttf`) });
    }
    return out;
  })();
  return fontCache;
}

/** La photo de couverture, recadrée au bon format et passée en JPEG (le moteur de rendu ne lit pas le WebP). */
async function coverData(cover: Input["cover"], width: number, height: number) {
  if (!cover) return null;
  try {
    const buf = await readObject(cover.url, cover.storageKey ?? "");
    const out = await sharp(buf).rotate().resize({ width, height, fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

const titleSize = (t: string, f: SocialFormat) => {
  const n = t.length;
  const base = f === "og" ? [74, 64, 54, 46] : f === "story" ? [140, 118, 100, 86] : [128, 108, 92, 78];
  return n <= 40 ? base[0] : n <= 70 ? base[1] : n <= 100 ? base[2] : base[3];
};

/** Visuel Passe D d'un article : photo, rubrique, titre et logo, aux formats Instagram, story et aperçu de lien. */
export async function socialImage(a: Input, format: SocialFormat) {
  const { width, height } = SOCIAL_FORMATS[format];
  const isOg = format === "og";
  const photoH = isOg ? height : format === "story" ? 1100 : 720;
  const photoW = isOg ? 640 : width;
  const photo = await coverData(a.cover, photoW, photoH);
  const status = a.mercatoStatus ? MERCATO_LABELS[a.mercatoStatus as MercatoStatus]?.label : null;
  const kicker = [a.sponsored ? "Partenariat" : null, status ?? a.categoryName ?? "Passe D"].filter(Boolean).join(" · ");
  const pad = isOg ? 56 : 72;

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <img src={MARK_URI} width={isOg ? 74 : 112} height={isOg ? 62 : 95} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Display", fontSize: isOg ? 40 : 58, color: INK, lineHeight: 1 }}>
          PASSE<span style={{ color: GOLD, marginLeft: 10 }}>D</span>
        </div>
        <div style={{ display: "flex", fontFamily: "Mono", fontSize: isOg ? 13 : 17, letterSpacing: 7, color: INK, marginTop: 6 }}>MÉDIA</div>
      </div>
    </div>
  );
  const pill = (
    <div style={{ display: "flex", alignSelf: "flex-start", fontFamily: "Mono", fontSize: isOg ? 20 : 26, letterSpacing: 4, textTransform: "uppercase", color: "#1f1500", background: GOLD, padding: isOg ? "8px 16px" : "10px 22px", borderRadius: 8 }}>
      {kicker}
    </div>
  );
  const title = (
    <div style={{ display: "flex", fontFamily: "Display", fontSize: titleSize(a.title, format), lineHeight: 0.95, color: INK, textTransform: "uppercase", letterSpacing: -1 }}>
      {a.title}
    </div>
  );
  // Le chapô n'apparaît que s'il reste de la place sous le titre.
  const dekText = a.dek && a.dek.length > 110 ? `${a.dek.slice(0, 107).replace(/\s+\S*$/, "")}…` : a.dek;
  const room = format === "story" ? 220 : 170;
  const dek = !isOg && dekText && a.title.length + dekText.length <= room ? (
    <div style={{ display: "flex", fontFamily: "Sans", fontSize: format === "story" ? 40 : 34, lineHeight: 1.3, color: "#c9c9c2" }}>{dekText}</div>
  ) : null;
  const footer = (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: "Mono", fontSize: isOg ? 18 : 24, letterSpacing: 2, color: "#bdbdb6" }}>
      <div style={{ display: "flex", width: 56, height: 4, background: GOLD }} />
      {format === "story" ? "LIEN EN BIO" : a.siteHost.toUpperCase()}
    </div>
  );
  const fallback = (w: number, h: number) => (
    <div style={{ display: "flex", width: w, height: h, alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 30%, #3a2c10 0%, #121110 60%, #0a0a0a 100%)" }}>
      <img src={MARK_URI} width={w * 0.42} height={w * 0.42 * (54 / 64)} style={{ opacity: 0.9 }} />
    </div>
  );

  const body = isOg ? (
    <div style={{ display: "flex", width, height, background: "#0a0a0a" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: width - photoW, height, padding: pad }}>
        {brand}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {pill}
          {title}
        </div>
        {footer}
      </div>
      <div style={{ display: "flex", position: "relative", width: photoW, height }}>
        {photo ? <img src={photo} width={photoW} height={height} /> : fallback(photoW, height)}
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 160, height, background: "linear-gradient(90deg, #0a0a0a, rgba(10,10,10,0))" }} />
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", width, height, background: "#0a0a0a", position: "relative" }}>
      <div style={{ display: "flex", position: "relative", width, height: photoH }}>
        {photo ? <img src={photo} width={width} height={photoH} /> : fallback(width, photoH)}
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width, height: 260, background: "linear-gradient(180deg, rgba(10,10,10,.85), rgba(10,10,10,0))" }} />
        <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width, height: 320, background: "linear-gradient(0deg, #0a0a0a, rgba(10,10,10,0))" }} />
        <div style={{ display: "flex", position: "absolute", left: pad, top: pad - 12 }}>{brand}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "space-between", padding: `0 ${pad}px ${pad}px`, marginTop: -150 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {pill}
          {title}
          {dek}
        </div>
        {footer}
      </div>
      <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width, height: 10, background: "linear-gradient(90deg, #4cc96a, #1f7a3a)" }} />
    </div>
  );

  return new ImageResponse(body, { width, height, fonts: await fonts() });
}
