"use client";

import { useState } from "react";
import { LinkIcon, ShareIcon } from "./icons";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
      } catch {}
      return;
    }
    window.open(`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <>
      <button className="icon-btn" onClick={share} aria-label="Partager">
        <ShareIcon />
      </button>
      <a
        className="icon-btn"
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur WhatsApp"
        style={{ fontWeight: 800, fontSize: 12 }}
      >
        WA
      </a>
      <button className="icon-btn" onClick={copy} aria-label="Copier le lien">
        {copied ? "✓" : <LinkIcon />}
      </button>
    </>
  );
}
