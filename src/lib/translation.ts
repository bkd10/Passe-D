import { cleanArticleHtml } from "./sanitize";

/*
 * Version anglaise : la rédaction la saisit en texte simple, sans éditeur riche.
 *   ## Intertitre        - élément de liste      1. liste numérotée
 *   > citation           **gras**  *italique*    [texte](https://lien)
 * Une ligne vide sépare les paragraphes.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function textToHtml(text: string): string {
  const out: string[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const h = lines[0].match(/^(#{2,3})\s+(.*)$/);
    if (h && lines.length === 1) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (lines.every((l) => /^[-•]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-•]\s+/, ""))}</li>`).join("")}</ul>`);
    } else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      const start = parseInt(lines[0], 10);
      out.push(`<ol${start !== 1 ? ` start="${start}"` : ""}>${lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`);
    } else if (lines.every((l) => l.startsWith(">"))) {
      out.push(`<blockquote><p>${lines.map((l) => inline(l.replace(/^>\s?/, ""))).join("<br>")}</p></blockquote>`);
    } else {
      out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
    }
  }
  return cleanArticleHtml(out.join(""));
}

const unesc = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function inlineBack(s: string) {
  return unesc(
    s
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
      .replace(/<(strong|b)>(.*?)<\/\1>/g, "**$2**")
      .replace(/<(em|i)>(.*?)<\/\1>/g, "*$2*")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Retour au texte simple, pour réafficher dans l'admin une version déjà enregistrée. */
export function htmlToText(html: string): string {
  const blocks: string[] = [];
  const re = /<(h2|h3|p|ul|ol|blockquote)([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(re)) {
    const [, tag, attrs, inner] = m;
    if (tag === "h2" || tag === "h3") blocks.push(`${tag === "h2" ? "##" : "###"} ${inlineBack(inner)}`);
    else if (tag === "p") blocks.push(inlineBack(inner));
    else if (tag === "blockquote") blocks.push(inlineBack(inner.replace(/<\/?p>/g, "")).split("\n").map((l) => `> ${l}`).join("\n"));
    else {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => inlineBack(x[1]).replace(/\n/g, " "));
      const start = Number(attrs.match(/start="(\d+)"/)?.[1] ?? 1);
      blocks.push(items.map((it, i) => (tag === "ul" ? `- ${it}` : `${start + i}. ${it}`)).join("\n"));
    }
  }
  return blocks.join("\n\n");
}
