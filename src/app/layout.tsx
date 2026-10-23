import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/util";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description:
    "Talents émergents, football amateur, métiers de l'ombre, innovations et mercato vérifié : Quotidien Sportif raconte le football que les autres ne racontent pas.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": `${SITE_URL}/rss.xml` } },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0e0b" },
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
  ],
};

// Applique le thème choisi avant l'affichage pour éviter un flash.
const themeScript = `try{var t=localStorage.getItem("qs-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
