"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaItem = {
  id: number;
  url: string;
  kind: string;
  mime: string;
  filename: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  credit: string;
  rights: string;
  folder: string;
  keywords: string;
  variants: Record<string, string>;
  createdAt: string;
};

export const thumb = (m: Pick<MediaItem, "url" | "variants">) => m.variants?.sm || m.variants?.md || m.url;

const SAFE_BYTES = 4 * 1024 * 1024; // limite des fonctions serveur de l'hébergeur (~4,5 Mo)

/** Réduit une photo trop lourde dans le navigateur avant l'envoi (2400 px, JPEG 88 %). */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SAFE_BYTES || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.88, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= SAFE_BYTES) return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  }
  throw new Error("Image trop lourde même après compression.");
}

export async function uploadFile(file: File, meta: Record<string, string> = {}, onProgress?: (p: number) => void): Promise<MediaItem> {
  if (file.type.startsWith("video/")) {
    const sign = await fetch("/api/admin/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "sign", mime: file.type, size: file.size }),
    }).then((r) => r.json());
    if (sign.error) throw new Error(sign.error);
    if (sign.direct) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sign.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => onProgress?.(e.loaded / e.total);
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Envoi refusé par le stockage.")));
        xhr.onerror = () => reject(new Error("Connexion interrompue."));
        xhr.send(file);
      });
      const done = await fetch("/api/admin/media/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "done", key: sign.key, publicUrl: sign.publicUrl, mime: file.type, size: file.size, filename: file.name }),
      }).then((r) => r.json());
      if (done.error) throw new Error(done.error);
      return done.item;
    }
  }
  const prepared = file.type.startsWith("image/") ? await shrinkImage(file) : file;
  const fd = new FormData();
  fd.set("file", prepared);
  for (const [k, v] of Object.entries(meta)) fd.set(k, v);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data: { item?: MediaItem; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 300 && data.item) resolve(data.item);
      else reject(new Error(data.error ?? (xhr.status === 413 ? "Fichier trop lourd." : "Import impossible.")));
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue."));
    xhr.send(fd);
  });
}

export function useMediaList(kind?: string) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [storage, setStorage] = useState("");
  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      const p = new URLSearchParams({ offset: String(offset) });
      if (q) p.set("q", q);
      if (kind) p.set("kind", kind);
      if (folder) p.set("folder", folder);
      const data = await fetch(`/api/admin/media?${p}`).then((r) => r.json());
      setItems((cur) => (offset ? [...cur, ...data.items] : data.items));
      setFolders(data.folders ?? []);
      setStorage(data.storage ?? "");
      setMore(data.items.length === 48);
      setLoading(false);
    },
    [q, kind, folder],
  );
  useEffect(() => {
    const t = setTimeout(() => load(0), 250);
    return () => clearTimeout(t);
  }, [load]);
  return { items, setItems, folders, q, setQ, folder, setFolder, loading, more, load, storage };
}

export function Dropzone({ onUploaded, accept = "image/*,video/mp4,video/webm,video/quicktime" }: { onUploaded: (m: MediaItem) => void; accept?: string }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [credit, setCredit] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    for (const f of Array.from(files)) {
      try {
        setBusy(`Import de ${f.name}…`);
        const item = await uploadFile(f, credit ? { credit } : {}, (p) => setBusy(`Import de ${f.name} : ${Math.round(p * 100)} %`));
        onUploaded(item);
      } catch (e) {
        setError(`${f.name} : ${e instanceof Error ? e.message : "échec"}`);
      }
    }
    setBusy("");
  };
  return (
    <div
      className={`dropzone ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
    >
      <p style={{ margin: "0 0 10px", fontWeight: 650 }}>{busy || "Glissez des photos ou vidéos ici"}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Crédit photo (ex. : Karim D. / QS)" value={credit} onChange={(e) => setCredit(e.target.value)} aria-label="Crédit appliqué aux fichiers importés" />
        <button type="button" className="btn dark" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
          Choisir des fichiers
        </button>
      </div>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={(e) => handle(e.target.files)} />
      <p className="hint">JPG, PNG, WebP (600 px de large minimum, optimisées automatiquement). Vidéos MP4/WebM/MOV jusqu&apos;à 200 Mo ; au-delà, utilisez YouTube ou Vimeo.</p>
      {error && <p className="alert err" style={{ marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

export function MediaPicker({
  open,
  onClose,
  onPick,
  multiple = false,
  kind,
  title = "Choisir un média",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (items: MediaItem[]) => void;
  multiple?: boolean;
  kind?: "image" | "video";
  title?: string;
}) {
  const list = useMediaList(kind);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  useEffect(() => {
    if (!open) setSelected([]);
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const toggle = (m: MediaItem) => {
    if (!multiple) {
      onPick([m]);
      onClose();
      return;
    }
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]));
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {multiple && (
              <button
                className="btn dark"
                disabled={!selected.length}
                onClick={() => {
                  onPick(selected);
                  onClose();
                }}
              >
                Ajouter {selected.length || ""}
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>Fermer</button>
          </div>
        </div>
        <Dropzone
          accept={kind === "image" ? "image/*" : kind === "video" ? "video/*" : undefined}
          onUploaded={(m) => {
            list.setItems((cur) => [m, ...cur]);
            if (!multiple) {
              onPick([m]);
              onClose();
            } else setSelected((s) => [...s, m]);
          }}
        />
        <div className="filters">
          <input className="input grow" placeholder="Rechercher (nom, légende, crédit, mot-clé…)" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          <select className="input" value={list.folder} onChange={(e) => list.setFolder(e.target.value)} aria-label="Dossier">
            <option value="">Tous les dossiers</option>
            {list.folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        {list.loading && !list.items.length ? (
          <p className="hint">Chargement…</p>
        ) : list.items.length === 0 ? (
          <p className="hint">Aucun média. Importez votre première photo ci-dessus.</p>
        ) : (
          <div className="media-grid">
            {list.items.map((m) => (
              <button key={m.id} type="button" className="media-item" aria-pressed={selected.some((s) => s.id === m.id)} onClick={() => toggle(m)}>
                <div className="im">{m.kind === "image" ? <img src={thumb(m)} alt={m.alt} loading="lazy" /> : "▶ Vidéo"}</div>
                <div className="cap">
                  <b>{m.caption || m.filename}</b>
                  <span className="meta">{m.credit ? `© ${m.credit}` : "Crédit manquant"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {list.more && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button className="btn ghost" onClick={() => list.load(list.items.length)}>Plus de médias</button>
          </div>
        )}
      </div>
    </div>
  );
}
