"use client";

import { useState } from "react";
import { Dropzone, thumb, useMediaList, type MediaItem } from "./media-picker";

const RIGHTS = ["", "Photo de la rédaction", "Fournie par le club (accord écrit)", "Agence (licence payée)", "Libre de droits", "Usage éditorial uniquement", "Droits à vérifier"];
const RATIOS: [string, number][] = [["16:9", 16 / 9], ["3:2", 3 / 2], ["4:5 (portrait)", 4 / 5], ["1:1", 1], ["9:16 (vertical)", 9 / 16]];

export function MediaLibrary({ meId }: { meId: number }) {
  const list = useMediaList();
  const [sel, setSel] = useState<MediaItem | null>(null);
  void meId;
  return (
    <>
      <Dropzone onUploaded={(m) => list.setItems((cur) => [m, ...cur])} />
      <div className="filters">
        <input className="input grow" placeholder="Rechercher : nom, légende, crédit, joueur, club…" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
        <select className="input" value={list.folder} onChange={(e) => list.setFolder(e.target.value)} aria-label="Dossier">
          <option value="">Tous les dossiers</option>
          {list.folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {list.loading && !list.items.length ? (
        <p className="hint">Chargement…</p>
      ) : list.items.length === 0 ? (
        <div className="panel" style={{ textAlign: "center" }}>Aucun média pour l&apos;instant.</div>
      ) : (
        <div className="media-grid">
          {list.items.map((m) => (
            <button key={m.id} className="media-item" onClick={() => setSel(m)}>
              <div className="im">{m.kind === "image" ? <img src={thumb(m)} alt={m.alt} loading="lazy" /> : "▶ Vidéo"}</div>
              <div className="cap">
                <b>{m.caption || m.filename}</b>
                <span className="meta">{m.credit ? `© ${m.credit}` : "⚠ crédit manquant"}{m.folder ? ` · ${m.folder}` : ""}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {list.more && <div style={{ textAlign: "center", marginTop: 12 }}><button className="btn ghost" onClick={() => list.load(list.items.length)}>Plus</button></div>}
      {sel && (
        <MediaDetail
          m={sel}
          folders={list.folders}
          onClose={() => setSel(null)}
          onSaved={(m, isNew) => {
            list.setItems((cur) => (isNew ? [m, ...cur] : cur.map((x) => (x.id === m.id ? m : x))));
            setSel(m);
          }}
          onDeleted={(id) => {
            list.setItems((cur) => cur.filter((x) => x.id !== id));
            setSel(null);
          }}
        />
      )}
    </>
  );
}

function MediaDetail({ m, folders, onClose, onSaved, onDeleted }: { m: MediaItem; folders: string[]; onClose: () => void; onSaved: (m: MediaItem, isNew?: boolean) => void; onDeleted: (id: number) => void }) {
  const [f, setF] = useState({ alt: m.alt, caption: m.caption, credit: m.credit, rights: m.rights, folder: m.folder, keywords: m.keywords });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [focal, setFocal] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [ratio, setRatio] = useState(RATIOS[0][1]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/media/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      onSaved(d.item);
      setMsg({ t: "Enregistré" });
    } else setMsg({ t: d.error ?? "Erreur", err: true });
  };
  const crop = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/media/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crop: { ratio, fx: focal.x, fy: focal.y } }) });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      onSaved(d.item, true);
      setMsg({ t: "Version recadrée créée (l'original est conservé)." });
    } else setMsg({ t: d.error ?? "Erreur", err: true });
  };
  const del = async () => {
    if (!confirm("Supprimer ce média ?")) return;
    const res = await fetch(`/api/admin/media/${m.id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) onDeleted(m.id);
    else setMsg({ t: d.error ?? "Erreur", err: true });
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Détail du média">
        <div className="modal-head">
          <h2>{m.filename}</h2>
          <button className="btn ghost" onClick={onClose}>Fermer</button>
        </div>
        <div className="media-detail">
          <div>
            {m.kind === "image" ? (
              <div style={{ position: "relative", cursor: "crosshair" }} onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setFocal({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
              }}>
                <img src={m.variants?.lg || m.url} alt={m.alt} style={{ width: "100%" }} />
                <span style={{ position: "absolute", left: `${focal.x * 100}%`, top: `${focal.y * 100}%`, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: "50%", border: "3px solid #f2b631", boxShadow: "0 0 0 2px #000" }} />
              </div>
            ) : (
              <video src={m.url} controls style={{ width: "100%", borderRadius: 8 }} />
            )}
            <p className="hint">
              {m.width && `${m.width} × ${m.height} px · `}
              {(m.size / 1024 / 1024).toFixed(2)} Mo · {m.mime} · importé le {new Date(m.createdAt).toLocaleDateString("fr-FR")}
              {Object.keys(m.variants ?? {}).length > 0 && ` · formats générés : ${Object.keys(m.variants).join(", ")}`}
            </p>
            {m.kind === "image" && (
              <div className="panel" style={{ marginTop: 10 }}>
                <h2>Recadrer</h2>
                <p className="hint" style={{ marginTop: 0 }}>Cliquez sur le sujet de la photo (visage, ballon…), choisissez un format puis recadrez.</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {RATIOS.map(([l, r]) => <button key={l} className={`btn sm ${ratio === r ? "dark" : "ghost"}`} onClick={() => setRatio(r)}>{l}</button>)}
                  <button className="btn sm" onClick={crop} disabled={busy}>Créer la version recadrée</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="lbl" htmlFor="alt">Texte alternatif (décrit l&apos;image pour les malvoyants)</label>
            <input id="alt" className="input" value={f.alt} onChange={(e) => setF({ ...f, alt: e.target.value })} />
            <label className="lbl" htmlFor="cap">Légende</label>
            <textarea id="cap" className="input" rows={2} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
            <label className="lbl" htmlFor="cr">Crédit</label>
            <input id="cr" className="input" value={f.credit} onChange={(e) => setF({ ...f, credit: e.target.value })} />
            <label className="lbl" htmlFor="rights">Droits d&apos;utilisation</label>
            <select id="rights" className="input" value={f.rights} onChange={(e) => setF({ ...f, rights: e.target.value })}>
              {RIGHTS.map((r) => <option key={r} value={r}>{r || "— Non renseigné —"}</option>)}
            </select>
            <label className="lbl" htmlFor="folder">Dossier (sujet, joueur, club, événement)</label>
            <input id="folder" className="input" list="folders" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} />
            <datalist id="folders">{folders.map((x) => <option key={x} value={x} />)}</datalist>
            <label className="lbl" htmlFor="kw">Mots-clés</label>
            <input id="kw" className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="joueur, club, compétition…" />
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn dark" onClick={save} disabled={busy}>Enregistrer</button>
              <button className="btn ghost" onClick={() => navigator.clipboard.writeText(m.url)}>Copier le lien</button>
              <button className="btn danger" onClick={del}>Supprimer</button>
            </div>
            {msg && <p className={`alert ${msg.err ? "err" : "ok"}`} style={{ marginTop: 12 }}>{msg.t}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
