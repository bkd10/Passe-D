"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/admin/(auth)/actions";
import { MenuIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";

type NavItem = { href: string; label: string; count?: number } | { sep: string };

export function AdminShell({
  nav,
  me,
  canCreate,
  children,
}: {
  nav: NavItem[];
  me: { name: string; role: string };
  canCreate: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, sp]);
  const current = pathname + (sp.get("vue") ? `?vue=${sp.get("vue")}` : "");
  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === "/admin" : href.includes("?") ? current === href : current === href || (pathname.startsWith(href + "/") && !sp.get("vue"));

  return (
    <div className="adm">
      <div className="adm-top">
        <button className="icon-btn" style={{ color: "#fff" }} onClick={() => setOpen(true)} aria-label="Menu">
          <MenuIcon />
        </button>
        <span className="logo"><LogoMark />Rédaction</span>
        {canCreate ? <Link className="btn sm" href="/admin/articles/publier">+ Article</Link> : <span />}
      </div>
      <aside className="adm-side" data-open={open} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <Link href="/admin" className="logo"><LogoMark />Rédaction</Link>
        {canCreate && <Link className="btn new-btn" href="/admin/articles/publier">+ Publier un article</Link>}
        {nav.map((n, i) =>
          "sep" in n ? (
            <div key={i} className="sep">{n.sep}</div>
          ) : (
            <Link key={n.href} href={n.href} className="nav-item" aria-current={isCurrent(n.href) ? "page" : undefined}>
              {n.label}
              {n.count ? <span className="count">{n.count}</span> : null}
            </Link>
          ),
        )}
        <div className="sep">Site</div>
        <a className="nav-item" href="/" target="_blank" rel="noreferrer">Voir le site ↗</a>
        <div className="me">
          <strong>{me.name}</strong>
          {me.role}
          <form action={logoutAction} style={{ marginTop: 8 }}>
            <button className="btn ghost sm" style={{ background: "transparent", color: "#c3c6bb", borderColor: "#3a3f34" }}>Se déconnecter</button>
          </form>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
