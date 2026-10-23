"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Callout, Figure } from "./editor-extensions";
import { MediaPicker, thumb, type MediaItem } from "./media-picker";
import { StatusPill } from "./bits";
import type { Status } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/permissions";
import { slugify, toParisLocal, parseParisLocal } from "@/lib/util";
import { SocialShare } from "@/components/admin/social-share";

type Opt = { id: number; name: string };
type Note = { id: number; body: string; kind: string; resolved: boolean; createdAt: string; author: string | null };
type Rev = { id: number; note: string; createdAt: string; author: string | null; title: string };

type Initial = {
  id: number;
  title: string;
  slug: string;
  dek: string;
  body: unknown;
  bodyHtml: string;
  format: string;
  status: Status;
  categoryId: number | null;
  authorId: number | null;
  assigneeId: number | null;
  coverId: number | null;
  gallery: number[];
  videoUrl: string;
  priority: number;
  deadline: string | null;
  scheduledAt: string | null;
  archiveAt: string | null;
  publishedAt: string | null;
  featured: boolean;
  module: string;
  sponsored: boolean;
  sponsorName: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImageId: number | null;
  mercatoStatus: string;
  mercatoSource: string;
  readingMinutes: number;
  version: number;
  views: number;
  updatedAt: string;
  tagNames: string[];
  contributorIds: number[];
  related: { id: number; title: string; status: Status }[];
  cover: MediaItem | null;
  ogImage: MediaItem | null;
  galleryItems: MediaItem[];
};

type Perms = { edit: boolean; seo: boolean; editor: boolean; del: boolean; transitions: Status[]; create: boolean };
type Options = {
  cats: Opt[];
  people: Opt[];
  formats: [string, string][];
  modules: { slug: string; name: string; rule: string }[];
  mercato: string[][];
  allTags: string[];
  siteUrl: string;
};

type SaveState = { kind: "idle" | "dirty" | "saving" | "saved" | "error"; msg?: string; at?: Date };

const EDITABLE = [
  "title", "slug", "dek", "bodyHtml", "body", "format", "categoryId", "authorId", "assigneeId", "contributorIds", "coverId", "gallery",
  "videoUrl", "priority", "deadline", "featured", "module", "sponsored", "sponsorName", "seoTitle", "seoDescription", "canonicalUrl",
  "ogImageId", "mercatoStatus", "mercatoSource", "tagNames", "relatedIds", "archiveAt",
] as const;
type Field = (typeof EDITABLE)[number];

export function ArticleEditor({
  initial,
  perms,
  options,
  notes: initialNotes,
  revisions,
  mercatoHistory,
  corrections,
}: {
  initial: Initial;
  perms: Perms;
  problems: string[];
  options: Options;
  notes: Note[];
  revisions: Rev[];
  mercatoHistory: { id: number; status: string; source: string; createdAt: string }[];
  corrections: { id: number; body: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState(() => ({ ...initial, relatedIds: initial.related.map((r) => r.id) }));
  const [status, setStatus] = useState<Status>(initial.status);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [picker, setPicker] = useState<null | "cover" | "gallery" | "inline" | "og">(null);
  const [notes, setNotes] = useState(initialNotes);
  const [modal, setModal] = useState<null | { to: Status; title: string }>(null);
  const [related, setRelated] = useState(initial.related);
  const dirty = useRef(new Set<Field>());
  const version = useRef(initial.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const fRef = useRef(f);
  fRef.current = f;
  const readOnly = !perms.edit;
  const seoOnly = !perms.edit && perms.seo;

  const flash = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), err ? 6000 : 2500);
  };

  const doSave = useCallback(async (note?: string): Promise<boolean> => {
    if (saving.current) await saving.current;
    if (!dirty.current.size && !note) return true;
    const keys = [...dirty.current];
    dirty.current.clear();
    const cur = fRef.current as Record<string, unknown>;
    const payload: Record<string, unknown> = { version: version.current };
    for (const k of keys) payload[k] = cur[k];
    if (keys.includes("deadline")) payload.deadline = cur.deadline || null;
    if (note) payload.revisionNote = note;
    setSave({ kind: "saving" });
    const p = (async () => {
      try {
        const res = await fetch(`/api/admin/articles/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          keys.forEach((k) => dirty.current.add(k));
          setSave({ kind: "error", msg: data.error ?? "Enregistrement impossible" });
          return false;
        }
        version.current = data.version;
        setF((x) => ({ ...x, slug: data.slug, readingMinutes: data.readingMinutes }));
        setSave({ kind: dirty.current.size ? "dirty" : "saved", at: new Date() });
        return true;
      } catch {
        keys.forEach((k) => dirty.current.add(k));
        setSave({ kind: "error", msg: "Connexion perdue. Nouvel essai automatique…" });
        return false;
      }
    })();
    saving.current = p;
    const ok = await p;
    saving.current = null;
    return ok;
  }, [initial.id]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), 1800);
  }, [doSave]);

  const set = useCallback(
    <K extends Field>(key: K, value: unknown) => {
      setF((x) => ({ ...x, [key]: value }));
      dirty.current.add(key);
      setSave((s) => (s.kind === "error" && s.msg?.includes("modifié par quelqu'un") ? s : { kind: "dirty" }));
      schedule();
    },
    [schedule],
  );

  // Réessai automatique après une coupure réseau.
  useEffect(() => {
    if (save.kind !== "error" || save.msg?.includes("modifié par") || save.msg?.includes("ne pouvez")) return;
    const t = setTimeout(() => void doSave(), 8000);
    return () => clearTimeout(t);
  }, [save, doSave]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void doSave("Enregistrement manuel").then((ok) => ok && flash("Version enregistrée"));
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", key);
    };
  }, [doSave]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      Youtube.configure({ nocookie: true, modestBranding: true, HTMLAttributes: { class: "embed" } }),
      Placeholder.configure({ placeholder: "Racontez l'histoire. Tapez ici, collez depuis Word ou Google Docs…" }),
      Figure,
      Callout,
    ],
    content: (initial.body as object) ?? initial.bodyHtml ?? "",
    onUpdate: ({ editor }) => {
      setF((x) => ({ ...x, bodyHtml: editor.getHTML(), body: editor.getJSON() }));
      dirty.current.add("bodyHtml");
      dirty.current.add("body");
      setSave({ kind: "dirty" });
      schedule();
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!f.title.trim() || f.title === "Sans titre") p.push("Ajoutez un titre");
    if (f.bodyHtml.replace(/<[^>]+>/g, "").trim().length < 20 && !f.videoUrl) p.push("Le texte est vide");
    if (!f.categoryId) p.push("Choisissez une rubrique");
    if (f.sponsored && !f.sponsorName.trim()) p.push("Indiquez le partenaire du contenu sponsorisé");
    if (f.mercatoStatus && !f.mercatoSource.trim()) p.push("Une info mercato doit citer sa source");
    return p;
  }, [f]);
  const advice = useMemo(() => {
    const a: string[] = [];
    if (!f.coverId && f.format !== "breve") a.push("Pas d'image à la une");
    if (f.cover && !f.cover.alt) a.push("Texte alternatif de l'image à la une manquant");
    if (f.cover && !f.cover.credit) a.push("Crédit de l'image à la une manquant");
    if (!f.dek.trim()) a.push("Pas de chapô");
    if (!f.tagNames.length) a.push("Aucun sujet (tag)");
    if ((f.seoDescription || f.dek).length > 160) a.push("Description de partage un peu longue");
    return a;
  }, [f]);

  async function changeStatus(to: Status, extra: { scheduledAt?: string | null; note?: string } = {}) {
    if (timer.current) clearTimeout(timer.current);
    const ok = await doSave();
    if (!ok) {
      flash("Enregistrez d'abord vos modifications.", true);
      return;
    }
    const res = await fetch(`/api/admin/articles/${initial.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.error ?? "Changement de statut refusé.", true);
      return;
    }
    version.current = data.version;
    setStatus(data.status);
    setF((x) => ({ ...x, scheduledAt: data.scheduledAt, publishedAt: data.publishedAt }));
    setModal(null);
    flash(
      to === "published"
        ? "Publié ! L'article est en ligne."
        : to === "scheduled"
          ? "Programmé."
          : `Statut : ${STATUS_LABELS[to]}`,
    );
    router.refresh();
  }

  async function action(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/articles/${initial.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.error ?? "Action impossible.", true);
      return null;
    }
    return data;
  }

  async function addNote(body: string, kind: "comment" | "correction") {
    const res = await fetch(`/api/admin/articles/${initial.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, kind }),
    });
    const data = await res.json();
    if (res.ok) setNotes(data.notes);
  }

  async function resolveNote(id: number) {
    const res = await fetch(`/api/admin/articles/${initial.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolveId: id }),
    });
    if (res.ok) setNotes((await res.json()).notes);
  }

  const isLive = status === "published" || status === "update_needed";
  const publicUrl = `${options.siteUrl}/articles/${f.slug}`;
  const t = perms.transitions;

  const saveLabel =
    save.kind === "saving"
      ? "Enregistrement…"
      : save.kind === "dirty"
        ? "Modifications non enregistrées"
        : save.kind === "error"
          ? save.msg
          : save.kind === "saved"
            ? `Enregistré à ${save.at?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : `Version ${version.current}`;

  return (
    <>
      <div className="ed-bar">
        <Link href="/admin/articles" className="btn ghost sm">← Articles</Link>
        <StatusPill s={status} />
        <span className={`save-state ${save.kind === "error" ? "err" : ""}`} role="status">
          {saveLabel}
          {save.kind === "error" && save.msg?.includes("modifié par") && (
            <button className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => location.reload()}>Recharger</button>
          )}
        </span>
        <a className="btn ghost sm" href={`/admin/apercu/${initial.id}`} target="_blank" rel="noreferrer" onClick={() => void doSave()}>Aperçu</a>
        {isLive && <a className="btn ghost sm" href={publicUrl} target="_blank" rel="noreferrer">Voir en ligne ↗</a>}
        {!perms.editor && t.includes("review") && status !== "review" && (
          <button className="btn dark sm" onClick={() => changeStatus("review")}>Envoyer en relecture</button>
        )}
        {perms.editor && !isLive && (
          <button className="btn sm" onClick={() => setModal({ to: "published", title: "Publier maintenant" })}>Publier</button>
        )}
        {perms.editor && isLive && dirty.current.size === 0 && <span className="meta">En ligne</span>}
      </div>

      {readOnly && (
        <div className="alert">
          {seoOnly
            ? "Mode SEO : vous pouvez modifier le référencement, les sujets et les articles associés."
            : status === "review"
              ? "Article en relecture : la rédaction en chef le valide ou vous le renvoie avec des corrections."
              : "Lecture seule : cet article n'est plus modifiable avec votre rôle dans son statut actuel."}
        </div>
      )}

      <div className="ed">
        <div style={{ minWidth: 0 }}>
          <div className="ed-paper">
            <textarea
              className="ed-title"
              value={f.title === "Sans titre" ? "" : f.title}
              placeholder="Titre de l'article"
              onChange={(e) => set("title", e.target.value)}
              readOnly={readOnly}
              rows={1}
              aria-label="Titre"
              maxLength={200}
            />
            <textarea
              className="ed-dek"
              value={f.dek}
              placeholder="Chapô : en deux phrases, pourquoi lire cet article ?"
              onChange={(e) => set("dek", e.target.value)}
              readOnly={readOnly}
              rows={2}
              aria-label="Chapô"
              maxLength={600}
            />
            {!readOnly && editor && <Toolbar editor={editor} onImage={() => setPicker("inline")} />}
            <div className="ed-body prose">
              <EditorContent editor={editor} />
            </div>
          </div>
          <p className="hint" style={{ textAlign: "right" }}>
            {f.readingMinutes} min de lecture · Enregistrement automatique · Ctrl/Cmd + S pour créer une version
          </p>
        </div>

        <div className="ed-side">
          {/* Publication */}
          <section className="panel">
            <h2>Publication</h2>
            {problems.length > 0 && !isLive && (
              <div className="alert" style={{ fontWeight: 500, fontSize: 13 }}>
                <b>Avant de publier :</b>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            {advice.length > 0 && (
              <details style={{ fontSize: 13, marginBottom: 10 }}>
                <summary style={{ cursor: "pointer", color: "var(--fg-2)" }}>{advice.length} conseil{advice.length > 1 ? "s" : ""} qualité</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{advice.map((p) => <li key={p}>{p}</li>)}</ul>
              </details>
            )}
            {f.publishedAt && <p className="hint" style={{ marginTop: 0 }}>Publié le {new Date(f.publishedAt).toLocaleString("fr-FR")}</p>}
            {status === "scheduled" && f.scheduledAt && (
              <p className="hint" style={{ marginTop: 0 }}><b>Programmé pour le {new Date(f.scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</b></p>
            )}
            {perms.edit && status !== "archived" && (
              <>
                <label htmlFor="arch">Archivage automatique (facultatif)</label>
                <input id="arch" type="datetime-local" className="input" value={toParisLocal(f.archiveAt)} onChange={(e) => set("archiveAt", parseParisLocal(e.target.value)?.toISOString() ?? null)} />
                <p className="hint">À cette date, l&apos;article quitte l&apos;accueil et sa rubrique. Son lien reste lisible.</p>
              </>
            )}
            <div style={{ display: "grid", gap: 6 }}>
              {perms.editor ? (
                <>
                  {!isLive && <button className="btn" onClick={() => setModal({ to: "published", title: "Publier maintenant" })}>Publier maintenant</button>}
                  {!isLive && <button className="btn ghost" onClick={() => setModal({ to: "scheduled", title: "Programmer la publication" })}>Programmer…</button>}
                  {status === "review" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <button className="btn ghost" onClick={() => setModal({ to: "approved", title: "Valider l'article" })}>Valider</button>
                      <button className="btn ghost" onClick={() => setModal({ to: "changes", title: "Demander des corrections" })}>À corriger</button>
                    </div>
                  )}
                  {isLive && status !== "update_needed" && <button className="btn ghost" onClick={() => changeStatus("update_needed")}>Marquer « à actualiser »</button>}
                  {status === "update_needed" && <button className="btn ghost" onClick={() => changeStatus("published")}>Actualisation terminée</button>}
                  {(isLive || status === "scheduled") && <button className="btn ghost" onClick={() => setModal({ to: "archived", title: "Archiver l'article" })}>Archiver maintenant</button>}
                  {isLive && <button className="btn danger" onClick={() => setModal({ to: "writing", title: "Retirer du site" })}>Retirer du site</button>}
                  <label htmlFor="st">Changer le statut</label>
                  <select id="st" className="input" value={status} onChange={(e) => {
                    const to = e.target.value as Status;
                    if (to === "scheduled" || to === "published") setModal({ to, title: to === "published" ? "Publier maintenant" : "Programmer la publication" });
                    else void changeStatus(to);
                  }}>
                    {t.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </>
              ) : t.length ? (
                <>
                  {t.includes("review") && <button className="btn" onClick={() => changeStatus("review")}>Envoyer en relecture</button>}
                  {t.includes("writing") && status !== "writing" && <button className="btn ghost" onClick={() => changeStatus("writing")}>Reprendre la rédaction</button>}
                  <p className="hint">La publication est validée par la rédaction en chef.</p>
                </>
              ) : (
                <p className="hint" style={{ margin: 0 }}>Aucune action disponible pour votre rôle.</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {perms.create && (
                <button className="btn ghost sm" onClick={async () => {
                  const d = await action({ action: "duplicate" });
                  if (d) router.push(`/admin/articles/${d.id}`);
                }}>Dupliquer</button>
              )}
              {perms.del && (
                <button className="btn danger sm" onClick={async () => {
                  if (!confirm("Supprimer définitivement cet article ? Cette action est irréversible.")) return;
                  const res = await fetch(`/api/admin/articles/${initial.id}`, { method: "DELETE" });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) router.push("/admin/articles");
                  else flash(d.error ?? "Suppression refusée", true);
                }}>Supprimer</button>
              )}
            </div>
          </section>

          {isLive && (
            <section className="panel">
              <h2>Réseaux sociaux</h2>
              <SocialShare
                slug={f.slug}
                siteUrl={options.siteUrl}
                title={f.title}
                dek={f.dek}
                categoryName={options.cats.find((c) => c.id === f.categoryId)?.name}
                mercatoStatus={f.mercatoStatus}
                sponsored={f.sponsored}
                sponsorName={f.sponsorName}
                tags={f.tagNames}
              />
            </section>
          )}

          {/* Organisation */}
          <section className="panel">
            <h2>Organisation</h2>
            <label htmlFor="cat">Rubrique</label>
            <select id="cat" className="input" value={f.categoryId ?? ""} disabled={readOnly} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Choisir —</option>
              {options.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label htmlFor="fmt">Format</label>
            <select id="fmt" className="input" value={f.format} disabled={readOnly} onChange={(e) => set("format", e.target.value)}>
              {options.formats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label htmlFor="mod">Format récurrent</label>
            <select id="mod" className="input" value={f.module} disabled={readOnly} onChange={(e) => set("module", e.target.value)}>
              <option value="">Aucun</option>
              {options.modules.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
            </select>
            {f.module && <p className="hint">{options.modules.find((m) => m.slug === f.module)?.rule}</p>}
            <label htmlFor="author">Auteur principal</label>
            <select id="author" className="input" value={f.authorId ?? ""} disabled={!perms.editor} onChange={(e) => set("authorId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {options.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label>Contributeurs</label>
            <MultiPeople people={options.people} value={f.contributorIds} disabled={readOnly} onChange={(v) => set("contributorIds", v)} />
            {perms.editor && (
              <>
                <label htmlFor="assignee">Assigné à</label>
                <select id="assignee" className="input" value={f.assigneeId ?? ""} onChange={(e) => set("assigneeId", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Personne</option>
                  {options.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label htmlFor="dl">Échéance</label>
                    <input id="dl" type="datetime-local" className="input" value={toParisLocal(f.deadline)} onChange={(e) => set("deadline", parseParisLocal(e.target.value)?.toISOString() ?? null)} />
                  </div>
                  <div>
                    <label htmlFor="prio">Priorité</label>
                    <select id="prio" className="input" value={f.priority} onChange={(e) => set("priority", Number(e.target.value))}>
                      <option value={1}>Haute</option>
                      <option value={2}>Normale</option>
                      <option value={3}>Basse</option>
                    </select>
                  </div>
                </div>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> À la une de la page d&apos;accueil
                </label>
              </>
            )}
          </section>

          {/* Médias */}
          <section className="panel">
            <h2>Médias</h2>
            <label>Image à la une</label>
            <button type="button" className="cover-pick" disabled={readOnly} onClick={() => setPicker("cover")}>
              {f.cover ? <img src={thumb(f.cover)} alt={f.cover.alt} /> : "+ Choisir ou importer"}
            </button>
            {f.cover && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 6, alignItems: "center" }}>
                <span className="hint" style={{ margin: 0 }}>{f.cover.credit ? `© ${f.cover.credit}` : "⚠ crédit manquant"}{f.cover.alt ? "" : " · ⚠ texte alternatif manquant"}</span>
                {!readOnly && <button className="btn ghost sm" onClick={() => { set("coverId", null); setF((x) => ({ ...x, cover: null })); }}>Retirer</button>}
              </div>
            )}
            <label>Galerie ({f.gallery.length})</label>
            <div className="thumbs">
              {f.galleryItems.map((g) => (
                <div key={g.id} className="th">
                  <img src={thumb(g)} alt={g.alt} />
                  {!readOnly && (
                    <button aria-label="Retirer de la galerie" onClick={() => {
                      const next = f.galleryItems.filter((x) => x.id !== g.id);
                      setF((x) => ({ ...x, galleryItems: next }));
                      set("gallery", next.map((x) => x.id));
                    }}>×</button>
                  )}
                </div>
              ))}
              {!readOnly && <button type="button" className="cover-pick" style={{ aspectRatio: "1" }} onClick={() => setPicker("gallery")}>+</button>}
            </div>
            <label htmlFor="video">Vidéo (YouTube, Vimeo, Dailymotion ou lien MP4)</label>
            <input id="video" className="input" value={f.videoUrl} readOnly={readOnly} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtu.be/…" />
            <p className="hint">Format « Vidéo » : la vidéo remplace l&apos;image en tête d&apos;article. Sous-titres activés par défaut quand la plateforme les propose.</p>
          </section>

          {/* Sujets & liens */}
          <section className="panel">
            <h2>Sujets et liens</h2>
            <label>Sujets : joueurs, clubs, métiers, thèmes</label>
            <TagInput value={f.tagNames} suggestions={options.allTags} disabled={!perms.edit && !perms.seo} onChange={(v) => set("tagNames", v)} />
            <label>Articles associés</label>
            <RelatedPicker
              value={related}
              disabled={!perms.edit && !perms.seo}
              selfId={initial.id}
              onChange={(v) => {
                setRelated(v);
                set("relatedIds", v.map((r) => r.id));
              }}
            />
          </section>

          {/* Mercato */}
          {(f.mercatoStatus || options.cats.find((c) => c.id === f.categoryId)?.name === "Mercato") && (
            <section className="panel">
              <h2>Mercato</h2>
              <label htmlFor="ms">Niveau de confirmation</label>
              <select id="ms" className="input" value={f.mercatoStatus} disabled={readOnly} onChange={(e) => set("mercatoStatus", e.target.value)}>
                <option value="">— Non concerné —</option>
                {options.mercato.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <label htmlFor="msrc">Source</label>
              <input id="msrc" className="input" value={f.mercatoSource} readOnly={readOnly} onChange={(e) => set("mercatoSource", e.target.value)} placeholder="Ex. : L'Équipe, communiqué du club, notre rédaction" />
              <p className="hint">Chaque changement de statut est horodaté et affiché aux lecteurs.</p>
              {mercatoHistory.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                  {mercatoHistory.map((m) => <li key={m.id}>{new Date(m.createdAt).toLocaleString("fr-FR")} : {options.mercato.find(([k]) => k === m.status)?.[1]} {m.source && `· ${m.source}`}</li>)}
                </ul>
              )}
            </section>
          )}
          {!f.mercatoStatus && options.cats.find((c) => c.id === f.categoryId)?.name !== "Mercato" && !readOnly && (
            <button className="btn ghost sm" onClick={() => set("mercatoStatus", "rumeur")}>+ Ajouter un statut mercato</button>
          )}

          {/* SEO */}
          <section className="panel">
            <h2>Référencement et partage</h2>
            <label htmlFor="slug">Adresse (URL)</label>
            <input id="slug" className="input" value={f.slug} readOnly={!perms.edit && !perms.seo} onChange={(e) => set("slug", slugify(e.target.value))} />
            <p className="hint">{options.siteUrl}/articles/{f.slug}{isLive && " · URL publiée : la changer casse les liens partagés."}</p>
            <label htmlFor="seot">Titre pour Google <span className={`counter ${(f.seoTitle || f.title).length > 60 ? "over" : ""}`}>{(f.seoTitle || f.title).length}/60</span></label>
            <input id="seot" className="input" value={f.seoTitle} placeholder={f.title} readOnly={!perms.seo} onChange={(e) => set("seoTitle", e.target.value)} />
            <label htmlFor="seod">Description <span className={`counter ${(f.seoDescription || f.dek).length > 160 ? "over" : ""}`}>{(f.seoDescription || f.dek).length}/160</span></label>
            <textarea id="seod" className="input" rows={3} value={f.seoDescription} placeholder={f.dek || "Reprend le chapô si vide"} readOnly={!perms.seo} onChange={(e) => set("seoDescription", e.target.value)} />
            <label>Image de partage (réseaux sociaux)</label>
            <button type="button" className="cover-pick" style={{ aspectRatio: "1.91" }} disabled={!perms.seo} onClick={() => setPicker("og")}>
              {f.ogImage ? <img src={thumb(f.ogImage)} alt="" /> : f.cover ? <img src={thumb(f.cover)} alt="" style={{ opacity: 0.5 }} /> : "Image à la une par défaut"}
            </button>
            {f.ogImage && perms.seo && <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => { set("ogImageId", null); setF((x) => ({ ...x, ogImage: null })); }}>Revenir à l&apos;image à la une</button>}
            <details style={{ marginTop: 10 }}>
              <summary className="hint" style={{ cursor: "pointer" }}>URL canonique (avancé)</summary>
              <input className="input" value={f.canonicalUrl} readOnly={!perms.seo} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="Vide = adresse de l'article" />
            </details>
            <div className="serp" aria-label="Aperçu Google">
              <div className="u">{options.siteUrl.replace(/^https?:\/\//, "")} › articles › {f.slug}</div>
              <div className="t">{(f.seoTitle || f.title).slice(0, 65)}</div>
              <div className="d">{(f.seoDescription || f.dek || "Ajoutez un chapô ou une description.").slice(0, 160)}</div>
            </div>
          </section>

          {/* Sponsorisé */}
          <section className="panel">
            <h2>Partenariat</h2>
            <label className="check">
              <input type="checkbox" checked={f.sponsored} disabled={!perms.editor} onChange={(e) => set("sponsored", e.target.checked)} /> Contenu sponsorisé
            </label>
            {f.sponsored && (
              <>
                <label htmlFor="sp">Partenaire (affiché aux lecteurs)</label>
                <input id="sp" className="input" value={f.sponsorName} readOnly={!perms.editor} onChange={(e) => set("sponsorName", e.target.value)} />
              </>
            )}
            <p className="hint">Un contenu sponsorisé est toujours signalé sur le site, les cartes et la page article.</p>
          </section>

          {/* Notes internes */}
          <section className="panel">
            <h2>Notes internes <span className="meta">{notes.filter((n) => !n.resolved).length} ouverte(s)</span></h2>
            <NoteForm onSubmit={addNote} />
            <div className="notes" style={{ marginTop: 10 }}>
              {notes.map((n) => (
                <div key={n.id} className={`note ${n.kind}`} style={{ opacity: n.resolved ? 0.55 : 1 }}>
                  <span className="meta">{n.author ?? "?"} · {new Date(n.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{n.kind === "correction" ? " · correction demandée" : n.kind === "validation" ? " · validation" : ""}</span>
                  {n.body}
                  {!n.resolved && n.kind !== "validation" && <button className="btn ghost sm" style={{ marginTop: 6, display: "block" }} onClick={() => resolveNote(n.id)}>Marquer comme traité</button>}
                </div>
              ))}
            </div>
          </section>

          {/* Corrections publiques */}
          {perms.editor && isLive && (
            <section className="panel">
              <h2>Corrections publiques</h2>
              <p className="hint" style={{ marginTop: 0 }}>Pour une erreur factuelle corrigée après publication : la mention s&apos;affiche en bas de l&apos;article.</p>
              {corrections.map((c) => <p key={c.id} style={{ fontSize: 13 }}><span className="meta">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</span> — {c.body}</p>)}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("corr") as HTMLInputElement;
                if (await action({ action: "correction", body: input.value })) {
                  flash("Correction ajoutée");
                  input.value = "";
                  router.refresh();
                }
              }}>
                <input name="corr" className="input" placeholder="Ex. : le score était 2-1 et non 3-1" minLength={3} required />
                <button className="btn ghost sm" style={{ marginTop: 6 }}>Ajouter la correction</button>
              </form>
            </section>
          )}

          {/* Versions */}
          <section className="panel">
            <h2>Versions <span className="meta">{revisions.length}</span></h2>
            {revisions.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>Les versions apparaissent au fil de l&apos;écriture.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {revisions.map((r) => (
                  <li key={r.id} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span>
                      <b>{new Date(r.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {r.author ?? "?"}
                      <br />
                      <span className="meta">{r.note || r.title}</span>
                    </span>
                    {perms.edit && (
                      <button className="btn ghost sm" onClick={async () => {
                        if (!confirm("Restaurer cette version ? La version actuelle reste dans l'historique.")) return;
                        await doSave();
                        if (await action({ action: "restore", revisionId: r.id })) location.reload();
                      }}>Restaurer</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        kind={picker === "inline" || picker === "cover" || picker === "og" || picker === "gallery" ? "image" : undefined}
        multiple={picker === "gallery"}
        title={picker === "cover" ? "Image à la une" : picker === "gallery" ? "Ajouter à la galerie" : picker === "og" ? "Image de partage" : "Insérer une image"}
        onClose={() => setPicker(null)}
        onPick={(items) => {
          if (picker === "cover") {
            setF((x) => ({ ...x, cover: items[0] }));
            set("coverId", items[0].id);
          } else if (picker === "og") {
            setF((x) => ({ ...x, ogImage: items[0] }));
            set("ogImageId", items[0].id);
          } else if (picker === "gallery") {
            const next = [...f.galleryItems, ...items.filter((i) => !f.galleryItems.some((g) => g.id === i.id))];
            setF((x) => ({ ...x, galleryItems: next }));
            set("gallery", next.map((g) => g.id));
          } else if (picker === "inline" && editor) {
            const m = items[0];
            editor.chain().focus().insertFigure({ src: m.variants?.lg || m.variants?.md || m.url, alt: m.alt, caption: m.caption, credit: m.credit }).run();
          }
        }}
      />

      {modal && (
        <StatusModal
          modal={modal}
          problems={problems}
          defaultWhen={f.scheduledAt}
          onCancel={() => setModal(null)}
          onConfirm={(extra) => changeStatus(modal.to, extra)}
        />
      )}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`} role="status">{toast.msg}</div>}
    </>
  );
}

function StatusModal({
  modal,
  problems,
  defaultWhen,
  onCancel,
  onConfirm,
}: {
  modal: { to: Status; title: string };
  problems: string[];
  defaultWhen: string | null;
  onCancel: () => void;
  onConfirm: (extra: { scheduledAt?: string | null; note?: string }) => void;
}) {
  const tomorrow = new Date(Date.now() + 86400_000);
  tomorrow.setHours(8, 0, 0, 0);
  const [when, setWhen] = useState(toParisLocal(defaultWhen && new Date(defaultWhen) > new Date() ? defaultWhen : tomorrow));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const blocking = (modal.to === "published" || modal.to === "scheduled") && problems.length > 0;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal sm" role="dialog" aria-modal="true" aria-label={modal.title}>
        <div className="modal-head"><h2>{modal.title}</h2></div>
        {blocking ? (
          <div className="alert err">
            Impossible pour l&apos;instant :
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ) : (
          <>
            {modal.to === "published" && <p>L&apos;article sera visible immédiatement sur le site, dans le fil et le sitemap.</p>}
            {modal.to === "archived" && <p>L&apos;article quitte l&apos;accueil et sa rubrique. Son lien reste lisible avec la mention « Archive ». Il peut être republié à tout moment.</p>}
            {modal.to === "writing" && <p>L&apos;article n&apos;est plus visible du tout sur le site (son lien affichera « page introuvable »). Il repasse en rédaction et peut être republié.</p>}
            {modal.to === "scheduled" && (
              <>
                <label className="lbl" htmlFor="when">Date et heure de publication (heure de Paris)</label>
                <input id="when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
                <p className="hint">L&apos;article passera en ligne automatiquement à cette heure.</p>
              </>
            )}
            {(modal.to === "changes" || modal.to === "approved") && (
              <>
                <label className="lbl" htmlFor="note">{modal.to === "changes" ? "Corrections demandées (visible par l'auteur)" : "Commentaire (facultatif)"}</label>
                <textarea id="note" className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} required={modal.to === "changes"} />
              </>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn ghost" onClick={onCancel}>Annuler</button>
          {!blocking && (
            <button
              className={modal.to === "writing" ? "btn danger" : "btn dark"}
              disabled={busy || (modal.to === "changes" && !note.trim())}
              onClick={async () => {
                setBusy(true);
                await onConfirm({
                  scheduledAt: modal.to === "scheduled" ? parseParisLocal(when)?.toISOString() ?? null : undefined,
                  note: note || undefined,
                });
                setBusy(false);
              }}
            >
              {busy ? "…" : "Confirmer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      callout: e.isActive("callout"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const B = ({ on, label, title, run, disabled }: { on?: boolean; label: React.ReactNode; title: string; run: () => void; disabled?: boolean }) => (
    <button type="button" aria-pressed={on ? "true" : "false"} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={run} disabled={disabled}>
      {label}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="ed-toolbar" role="toolbar" aria-label="Mise en forme">
      <B on={s.h2} label="Intertitre" title="Intertitre" run={() => c().toggleHeading({ level: 2 }).run()} />
      <B on={s.h3} label="H3" title="Sous-intertitre" run={() => c().toggleHeading({ level: 3 }).run()} />
      <span className="sep" />
      <B on={s.bold} label={<b>G</b>} title="Gras" run={() => c().toggleBold().run()} />
      <B on={s.italic} label={<i>I</i>} title="Italique" run={() => c().toggleItalic().run()} />
      <B
        on={s.link}
        label="Lien"
        title="Lien"
        run={() => {
          if (s.link) return void c().unsetLink().run();
          const url = prompt("Adresse du lien (https://… ou /articles/…)");
          if (url) c().extendMarkRange("link").setLink({ href: url }).run();
        }}
      />
      <span className="sep" />
      <B on={s.ul} label="• Liste" title="Liste à puces" run={() => c().toggleBulletList().run()} />
      <B on={s.ol} label="1. Liste" title="Liste numérotée" run={() => c().toggleOrderedList().run()} />
      <B on={s.quote} label="« Citation »" title="Citation" run={() => c().toggleBlockquote().run()} />
      <B on={s.callout} label="Encadré" title="Encadré" run={() => c().toggleCallout().run()} />
      <B label="—" title="Séparateur" run={() => c().setHorizontalRule().run()} />
      <span className="sep" />
      <B label="Image" title="Insérer une image" run={onImage} />
      <B
        label="Vidéo"
        title="Insérer une vidéo YouTube"
        run={() => {
          const url = prompt("Lien YouTube");
          if (url) c().setYoutubeVideo({ src: url }).run();
        }}
      />
      <span className="sep" />
      <B label="↶" title="Annuler" run={() => c().undo().run()} disabled={!s.canUndo} />
      <B label="↷" title="Rétablir" run={() => c().redo().run()} disabled={!s.canRedo} />
    </div>
  );
}

function TagInput({ value, suggestions, onChange, disabled }: { value: string[]; suggestions: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setText("");
  };
  const matches = text ? suggestions.filter((s) => s.toLowerCase().includes(text.toLowerCase()) && !value.includes(s)).slice(0, 6) : [];
  return (
    <div>
      <div className="tagbox">
        {value.map((t) => (
          <span key={t} className="tagpill">
            {t}
            {!disabled && <button type="button" aria-label={`Retirer ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>}
          </span>
        ))}
        {!disabled && (
          <input
            value={text}
            placeholder="Ajouter puis Entrée"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
            }}
            aria-label="Ajouter un sujet"
          />
        )}
      </div>
      {matches.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {matches.map((m) => <button type="button" key={m} className="btn ghost sm" onClick={() => add(m)}>{m}</button>)}
        </div>
      )}
    </div>
  );
}

function MultiPeople({ people, value, onChange, disabled }: { people: Opt[]; value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
        {value.map((id) => (
          <span key={id} className="tagpill">
            {people.find((p) => p.id === id)?.name ?? "?"}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="Retirer">×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <select className="input" value="" onChange={(e) => e.target.value && onChange([...value, Number(e.target.value)])} aria-label="Ajouter un contributeur">
          <option value="">+ Ajouter</option>
          {people.filter((p) => !value.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </div>
  );
}

function RelatedPicker({
  value,
  onChange,
  disabled,
  selfId,
}: {
  value: { id: number; title: string; status: Status }[];
  onChange: (v: { id: number; title: string; status: Status }[]) => void;
  disabled?: boolean;
  selfId: number;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; title: string; status: Status }[]>([]);
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const d = await fetch(`/api/admin/articles/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setResults((d.items ?? []).filter((i: { id: number }) => i.id !== selfId && !value.some((v) => v.id === i.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, selfId, value]);
  return (
    <div>
      {value.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 13, padding: "4px 0" }}>
          <span>{r.title}</span>
          {!disabled && <button className="btn ghost sm" onClick={() => onChange(value.filter((x) => x.id !== r.id))}>×</button>}
        </div>
      ))}
      {!disabled && value.length < 10 && (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un article…" />
          {results.map((r) => (
            <button key={r.id} type="button" className="btn ghost sm" style={{ display: "block", width: "100%", textAlign: "left", marginTop: 4, height: "auto", padding: 6 }} onClick={() => { onChange([...value, r]); setQ(""); }}>
              {r.title} <span className="meta">· {STATUS_LABELS[r.status]}</span>
            </button>
          ))}
          <p className="hint">Sinon, des articles proches sont proposés automatiquement (mêmes sujets, même rubrique).</p>
        </>
      )}
    </div>
  );
}

function NoteForm({ onSubmit }: { onSubmit: (body: string, kind: "comment" | "correction") => Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await onSubmit(text, "comment");
        setText("");
      }}
    >
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Une remarque pour l'équipe…" aria-label="Note interne" />
      <button className="btn ghost sm" style={{ marginTop: 6 }} disabled={!text.trim()}>Ajouter la note</button>
    </form>
  );
}
