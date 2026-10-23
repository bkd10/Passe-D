"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Callout, Figure } from "./editor-extensions";
import { MediaPicker, thumb, type MediaItem } from "./media-picker";
import { Toolbar } from "./article-editor";
import { parseParisLocal } from "@/lib/util";
import { SocialShare } from "@/components/admin/social-share";

type Opt = { id: number; name: string };
type Action = "publish" | "schedule" | "review" | "draft";

const ARCHIVE_CHOICES = [
  { value: "never", label: "Ne jamais archiver", days: 0 },
  { value: "7", label: "Au bout de 7 jours", days: 7 },
  { value: "30", label: "Au bout de 30 jours", days: 30 },
  { value: "90", label: "Au bout de 3 mois", days: 90 },
  { value: "365", label: "Au bout d'un an", days: 365 },
  { value: "date", label: "À une date précise", days: 0 },
];

const DRAFT_KEY = "qs-publication-rapide";

type Draft = {
  categoryId: string;
  title: string;
  dek: string;
  cover: MediaItem | null;
  videoUrl: string;
  videoName: string;
  authorId: string;
  archive: string;
  archiveDate: string;
  scheduleDate: string;
  body: unknown;
};

const empty: Draft = { categoryId: "", title: "", dek: "", cover: null, videoUrl: "", videoName: "", authorId: "", archive: "never", archiveDate: "", scheduleDate: "", body: null };

export function QuickPublishForm({ cats, people, me, canPublish, siteUrl }: { cats: Opt[]; people: Opt[]; me: Opt; canPublish: boolean; siteUrl: string }) {
  const [d, setD] = useState<Draft>(empty);
  const [picker, setPicker] = useState<null | "cover" | "video" | "inline">(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: number; slug: string; status: string } | null>(null);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      Youtube.configure({ nocookie: true, modestBranding: true, HTMLAttributes: { class: "embed" } }),
      Placeholder.configure({ placeholder: "Écrivez ou collez votre article ici (depuis Word, Google Docs, un mail…)" }),
      Figure,
      Callout,
    ],
    onUpdate: ({ editor }) => set("body", editor.getJSON()),
  });

  // Brouillon gardé dans ce navigateur : rien n'est perdu si l'onglet se ferme.
  useEffect(() => {
    if (!editor || loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = { ...empty, ...JSON.parse(raw) } as Draft;
        setD(saved);
        if (saved.body) editor.commands.setContent(saved.body as object);
        if (saved.title || saved.body) setRestored(true);
      }
    } catch {}
  }, [editor]);
  useEffect(() => {
    if (!loaded.current || done) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [d, done]);

  const reset = () => {
    setD(empty);
    editor?.commands.clearContent();
    setRestored(false);
    setDone(null);
    setError("");
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  function archiveAt(publishAt: Date): string | null {
    if (d.archive === "never") return null;
    if (d.archive === "date") return parseParisLocal(d.archiveDate)?.toISOString() ?? null;
    const days = ARCHIVE_CHOICES.find((c) => c.value === d.archive)?.days ?? 0;
    return new Date(publishAt.getTime() + days * 86_400_000).toISOString();
  }

  async function submit(action: Action) {
    setError("");
    const scheduled = action === "schedule" ? parseParisLocal(d.scheduleDate) : null;
    if (action === "schedule" && (!scheduled || scheduled.getTime() < Date.now())) {
      setError("Choisissez une date et une heure à venir pour la programmation.");
      return;
    }
    const archive = archiveAt(scheduled ?? new Date());
    if (d.archive === "date" && !archive) {
      setError("Choisissez la date d'archivage, ou une autre option.");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch("/api/admin/articles/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          categoryId: Number(d.categoryId) || null,
          title: d.title,
          dek: d.dek,
          coverId: d.cover?.id ?? null,
          videoUrl: d.videoUrl,
          body: editor?.getJSON() ?? null,
          bodyHtml: editor?.isEmpty ? "" : (editor?.getHTML() ?? ""),
          authorId: Number(d.authorId) || null,
          scheduledAt: scheduled?.toISOString() ?? null,
          archiveAt: archive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Envoi impossible.");
        if (data.id) setDone({ id: data.id, slug: "", status: "writing" });
        return;
      }
      setDone(data);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Connexion interrompue. Votre texte est gardé sur cet appareil, réessayez.");
    } finally {
      setBusy(null);
    }
  }

  if (done && !error) {
    const live = done.status === "published";
    return (
      <div className="panel qp-done">
        <p className="qp-done-kicker">{live ? "En ligne" : done.status === "scheduled" ? "Programmé" : done.status === "review" ? "Envoyé en relecture" : "Brouillon enregistré"}</p>
        <h2>{d.title || "Article enregistré"}</h2>
        <p>
          {live
            ? "L'article est publié sur le site, en tête de sa rubrique et dans le fil de l'accueil."
            : done.status === "scheduled"
              ? `Il sera publié automatiquement le ${new Date(parseParisLocal(d.scheduleDate)!).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })}.`
              : done.status === "review"
                ? "La rédaction en chef le relit et le publie."
                : "Retrouvez-le dans la liste des articles pour le terminer."}
        </p>
        <div className="qp-actions">
          {live && <a className="btn dark" href={`${siteUrl}/articles/${done.slug}`} target="_blank" rel="noreferrer">Voir sur le site ↗</a>}
          <Link className="btn ghost" href={`/admin/articles/${done.id}`}>Modifier dans l&apos;éditeur complet</Link>
          <button type="button" className="btn ghost" onClick={reset}>Publier un autre article</button>
        </div>
        {live && (
          <div className="qp-social">
            <h3>Le poster sur les réseaux</h3>
            <SocialShare
              slug={done.slug}
              siteUrl={siteUrl}
              title={d.title}
              dek={d.dek}
              categoryName={cats.find((c) => String(c.id) === String(d.categoryId))?.name}
            />
          </div>
        )}
      </div>
    );
  }

  const selected = ARCHIVE_CHOICES.find((c) => c.value === d.archive);

  return (
    <div className="qp">
      {restored && (
        <div className="alert">
          Votre brouillon précédent a été récupéré.{" "}
          <button type="button" className="linkish" onClick={reset}>Repartir d&apos;une page vide</button>
        </div>
      )}

      <section className="panel qp-step">
        <h2><span className="qp-n">1</span> Rubrique et titre</h2>
        <label className="lbl" htmlFor="qp-cat">Rubrique (où l&apos;article apparaît sur le site)</label>
        <select id="qp-cat" className="input" value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">Choisir une rubrique…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="lbl" htmlFor="qp-title">
          Titre <span className={`counter ${d.title.length > 110 ? "over" : ""}`}>{d.title.length}/110</span>
        </label>
        <input id="qp-title" className="input qp-title" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. : Le gardien de Bondy qui a stoppé trois penaltys" />
        <label className="lbl" htmlFor="qp-dek">Résumé en une ou deux phrases (facultatif, affiché sous le titre)</label>
        <textarea id="qp-dek" className="input" rows={2} value={d.dek} onChange={(e) => set("dek", e.target.value)} />
      </section>

      <section className="panel qp-step">
        <h2><span className="qp-n">2</span> Photo et vidéo</h2>
        <div className="qp-media">
          <div>
            <span className="lbl">Photo principale</span>
            <button type="button" className="cover-pick" onClick={() => setPicker("cover")}>
              {d.cover ? <img src={thumb(d.cover)} alt={d.cover.alt} /> : "+ Importer ou choisir une photo"}
            </button>
            {d.cover && (
              <div className="qp-under">
                <span className="hint">{d.cover.credit ? `© ${d.cover.credit}` : "⚠ Pensez au crédit photo (dans Médias)"}</span>
                <button type="button" className="btn ghost sm" onClick={() => set("cover", null)}>Retirer</button>
              </div>
            )}
          </div>
          <div>
            <span className="lbl">Vidéo (facultatif)</span>
            {d.videoUrl ? (
              <div className="qp-video">
                <b>{d.videoName || d.videoUrl}</b>
                <button type="button" className="btn ghost sm" onClick={() => setD((x) => ({ ...x, videoUrl: "", videoName: "" }))}>Retirer</button>
              </div>
            ) : (
              <>
                <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={() => setPicker("video")}>+ Importer une vidéo depuis l&apos;ordinateur ou le téléphone</button>
                <label className="lbl" htmlFor="qp-video">ou collez un lien YouTube, Vimeo ou Dailymotion</label>
                <input id="qp-video" className="input" placeholder="https://youtu.be/…" onBlur={(e) => e.target.value.trim() && setD((x) => ({ ...x, videoUrl: e.target.value.trim(), videoName: "" }))} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
              </>
            )}
            <p className="hint">Sans texte (ou presque), la vidéo s&apos;affiche en grand à la place de la photo.</p>
          </div>
        </div>
      </section>

      <section className="panel qp-step">
        <h2><span className="qp-n">3</span> Texte</h2>
        <div className="qp-editor">
          {editor && <Toolbar editor={editor} onImage={() => setPicker("inline")} />}
          <div className="ed-body prose">
            <EditorContent editor={editor} />
          </div>
        </div>
      </section>

      <section className="panel qp-step">
        <h2><span className="qp-n">4</span> Signature et archivage</h2>
        <div className="qp-grid">
          <div>
            <label className="lbl" htmlFor="qp-author">Signé par</label>
            {canPublish ? (
              <select id="qp-author" className="input" value={d.authorId || String(me.id)} onChange={(e) => set("authorId", e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === me.id ? " (moi)" : ""}</option>)}
              </select>
            ) : (
              <input id="qp-author" className="input" value={me.name} readOnly />
            )}
          </div>
          <div>
            <label className="lbl" htmlFor="qp-archive">Archivage automatique</label>
            <select id="qp-archive" className="input" value={d.archive} onChange={(e) => set("archive", e.target.value)}>
              {ARCHIVE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {d.archive === "date" && (
              <input aria-label="Date d'archivage" type="datetime-local" className="input" style={{ marginTop: 6 }} value={d.archiveDate} onChange={(e) => set("archiveDate", e.target.value)} />
            )}
          </div>
        </div>
        <p className="hint">
          {selected?.value === "never"
            ? "L'article reste dans sa rubrique jusqu'à ce que vous l'archiviez vous-même."
            : "Une fois archivé, l'article quitte l'accueil et sa rubrique. Son lien continue de marcher, avec la mention « Archive »."}
        </p>
      </section>

      {error && (
        <div className="alert err">
          {error}
          {done?.id ? <> <Link href={`/admin/articles/${done.id}`}>Ouvrir le brouillon dans l&apos;éditeur</Link></> : null}
        </div>
      )}

      <div className="panel qp-bar">
        {canPublish ? (
          <>
            <button type="button" className="btn dark lg" disabled={Boolean(busy)} onClick={() => submit("publish")}>{busy === "publish" ? "Publication…" : "Publier maintenant"}</button>
            <div className="qp-schedule">
              <span className="hint" style={{ margin: 0 }}>ou programmer le</span>
              <input aria-label="Date de programmation" type="datetime-local" className="input" value={d.scheduleDate} onChange={(e) => set("scheduleDate", e.target.value)} />
              <button type="button" className="btn ghost" disabled={Boolean(busy)} onClick={() => submit("schedule")}>{busy === "schedule" ? "…" : "Programmer"}</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn dark lg" disabled={Boolean(busy)} onClick={() => submit("review")}>{busy === "review" ? "Envoi…" : "Envoyer en relecture"}</button>
        )}
        <button type="button" className="btn ghost" disabled={Boolean(busy)} onClick={() => submit("draft")}>{busy === "draft" ? "…" : "Enregistrer en brouillon"}</button>
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        kind={picker === "video" ? "video" : "image"}
        title={picker === "cover" ? "Photo principale" : picker === "video" ? "Vidéo" : "Insérer une photo dans le texte"}
        onPick={([m]: MediaItem[]) => {
          if (!m) return;
          if (picker === "cover") set("cover", m);
          else if (picker === "video") setD((x) => ({ ...x, videoUrl: m.url, videoName: m.filename }));
          else if (picker === "inline" && editor) {
            editor.chain().focus().insertFigure({ src: m.variants?.lg || m.variants?.md || m.url, alt: m.alt, caption: m.caption, credit: m.credit }).run();
          }
        }}
      />
    </div>
  );
}
