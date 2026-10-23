"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from "./icons";

type NavCat = { slug: string; name: string; description: string; inNav: boolean };

export function Masthead({ cats, ticker }: { cats: NavCat[]; ticker: { slug: string; title: string; time: string }[] }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setTheme(t);
    else setTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("qs-theme", next);
    } catch {}
  };

  const main = cats.filter((c) => c.inNav);
  return (
    <header className="masthead">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <div className="wrap masthead-row">
        <Link href="/" className="logo" aria-label="Quotidien Sportif, accueil">
          <span className="logo-mark" aria-hidden>QS</span>
          Quotidien<small>/</small>Sportif
        </Link>
        <nav className="nav" aria-label="Rubriques">
          {main.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} aria-current={pathname === `/${c.slug}` ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="masthead-tools">
          <Link href="/recherche" className="icon-btn" aria-label="Rechercher">
            <SearchIcon />
          </Link>
          <button className="icon-btn" onClick={toggleTheme} aria-label={theme === "light" ? "Passer en thème sombre" : "Passer en thème clair"}>
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="icon-btn menu-toggle" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}>
            <MenuIcon />
          </button>
        </div>
      </div>
      {ticker.length > 0 && (
        <div className="subnav">
          <div className="wrap ticker">
            <span className="ticker-label">En direct</span>
            <div className="ticker-items">
              {ticker.map((t) => (
                <Link key={t.slug} href={`/articles/${t.slug}`}>
                  <time>{t.time}</time>
                  {t.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="drawer" data-open={open} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="drawer-head">
          <span className="logo"><span className="logo-mark" aria-hidden>QS</span>Menu</span>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Toutes les rubriques">
          {cats.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`}>
              {c.name}
              <span>{c.description}</span>
            </Link>
          ))}
          <Link href="/contribuer">
            Contribuer<span>Clubs amateurs : envoyez vos résultats, comptes rendus et histoires.</span>
          </Link>
          <Link href="/recherche">
            Rechercher<span>Un joueur, un club, un métier, un sujet.</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
