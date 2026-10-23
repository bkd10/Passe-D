"use client";

import { useEffect } from "react";

export function ViewTracker({ id }: { id: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const body = JSON.stringify({ id, ref: document.referrer });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/view", new Blob([body], { type: "application/json" }));
      else fetch("/api/view", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }, 4000); // une lecture compte après 4 s sur la page
    const bar = document.querySelector<HTMLElement>(".progress");
    const onScroll = () => {
      if (!bar) return;
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      bar.style.width = `${Math.min(100, p * 100)}%`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [id]);
  return <div className="progress" aria-hidden />;
}
