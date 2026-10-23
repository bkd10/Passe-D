import { MERCATO_LABELS } from "@/lib/editorial";
import type { MercatoStatus } from "@/db/schema";

type CaptionInput = {
  title: string;
  dek?: string | null;
  slug: string;
  categoryName?: string | null;
  mercatoStatus?: string | null;
  sponsored?: boolean;
  sponsorName?: string | null;
  tags?: { name: string }[];
};

const hashtag = (s: string) =>
  "#" +
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

/** Légendes prêtes à coller : Instagram (lien en bio) et les réseaux qui acceptent un lien (X, Facebook, LinkedIn). */
export function socialCaptions(a: CaptionInput, siteUrl: string) {
  const url = `${siteUrl}/articles/${a.slug}`;
  const status = a.mercatoStatus ? MERCATO_LABELS[a.mercatoStatus as MercatoStatus]?.label : null;
  const head = [status ? `${status.toUpperCase()} · ` : "", a.title].join("");
  const sponsor = a.sponsored ? `\n\nPartenariat${a.sponsorName ? ` avec ${a.sponsorName}` : ""}.` : "";
  const tags = Array.from(
    new Set(["#PasseD", "#Football", ...(a.categoryName ? [hashtag(a.categoryName)] : []), ...(a.tags ?? []).slice(0, 3).map((t) => hashtag(t.name))]),
  ).join(" ");
  const dek = a.dek ? `\n\n${a.dek}` : "";
  return {
    instagram: `${head}${dek}\n\nL'article complet : lien en bio.${sponsor}\n\n${tags}`,
    lien: `${head}${dek}\n\n${url}${sponsor}\n\n${tags}`,
    url,
  };
}
