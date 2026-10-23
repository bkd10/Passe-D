"use client";

import { useState } from "react";
import { socialCaptions } from "@/lib/social-caption";

type Props = {
  slug: string;
  siteUrl: string;
  title: string;
  dek: string;
  categoryName?: string | null;
  mercatoStatus?: string | null;
  sponsored?: boolean;
  sponsorName?: string | null;
  tags?: string[];
};

/** Visuels et légendes prêts à poster pour un article publié. */
export function SocialShare(p: Props) {
  const [stamp, setStamp] = useState(() => Date.now());
  const [copied, setCopied] = useState<string | null>(null);
  const caps = socialCaptions({ ...p, tags: (p.tags ?? []).map((name) => ({ name })) }, p.siteUrl);
  const img = (format: string, download = false) => `/articles/${p.slug}/visuel?format=${format}&v=${stamp}${download ? "&download" : ""}`;
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };
  return (
    <div className="social-share">
      <img src={img("post")} alt="Visuel Instagram de l'article" className="social-preview" />
      <div className="social-actions">
        <a className="btn sm" href={img("post", true)} download>Visuel Instagram</a>
        <a className="btn ghost sm" href={img("story", true)} download>Story</a>
        <a className="btn ghost sm" href={img("og", true)} download>X / Facebook</a>
      </div>
      <div className="social-actions">
        <button type="button" className="btn ghost sm" onClick={() => copy("insta", caps.instagram)}>{copied === "insta" ? "Copié ✓" : "Copier la légende Instagram"}</button>
        <button type="button" className="btn ghost sm" onClick={() => copy("lien", caps.lien)}>{copied === "lien" ? "Copié ✓" : "Copier le texte avec lien"}</button>
      </div>
      <button type="button" className="linkish" onClick={() => setStamp(Date.now())}>Régénérer le visuel après une modification</button>
    </div>
  );
}
