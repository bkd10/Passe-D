import sanitizeHtml from "sanitize-html";

const VIDEO_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.dailymotion.com"];

/** Nettoie le HTML produit par l'éditeur avant stockage et affichage. */
export function cleanArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "strong", "em", "s", "u", "a", "br", "hr",
      "figure", "figcaption", "img", "iframe", "div", "aside", "code", "pre", "span", "cite",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "data-credit"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow", "title", "loading"],
      div: ["data-youtube-video", "class", "data-type"],
      aside: ["class", "data-type"],
      span: ["class"],
      figure: ["class"],
      p: ["class"],
    },
    allowedClasses: {
      div: ["callout", "embed"],
      aside: ["callout", "callout-info", "callout-key", "callout-fact"],
      p: ["lead"],
      span: ["highlight"],
      figure: ["wide", "inline"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedIframeHostnames: VIDEO_HOSTS,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const external = /^https?:\/\//.test(href) && !href.startsWith(process.env.NEXT_PUBLIC_SITE_URL || "@@");
        const out: Record<string, string> = external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href };
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
      iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", allowfullscreen: "true" } }),
    },
  });
}

export const plainText = (s: string, max = 500) =>
  sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);
