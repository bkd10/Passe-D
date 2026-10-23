import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: { insertFigure: (attrs: { src: string; alt?: string; caption?: string; credit?: string }) => ReturnType };
    callout: { toggleCallout: () => ReturnType };
  }
}

/** Image avec légende et crédit : <figure><img><figcaption>Légende · © Crédit</figcaption></figure>. */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      credit: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector("img");
          if (!img) return false;
          const cap = (el as HTMLElement).querySelector("figcaption")?.textContent ?? "";
          const [caption, credit] = cap.split(" · © ");
          return { src: img.getAttribute("src"), alt: img.getAttribute("alt") ?? "", caption: caption ?? "", credit: img.getAttribute("data-credit") ?? credit ?? "" };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { src, alt, caption, credit } = node.attrs as Record<string, string>;
    const text = [caption, credit ? `© ${credit}` : ""].filter(Boolean).join(" · ");
    return ["figure", {}, ["img", { src, alt, "data-credit": credit, loading: "lazy" }], ...(text ? [["figcaption", {}, text]] : [])] as never;
  },
  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

/** Encadré : <aside class="callout">…</aside> */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "aside" }, { tag: "div.callout" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { class: "callout" }), 0];
  },
  addCommands() {
    return {
      toggleCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});
