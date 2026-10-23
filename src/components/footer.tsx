import Link from "next/link";

export function Footer({ cats }: { cats: { slug: string; name: string }[] }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <h4>Passe D</h4>
            <p className="dek" style={{ margin: 0, maxWidth: 360 }}>
              Talents, terrains amateurs, métiers de l&apos;ombre et idées qui changent le jeu.
            </p>
          </div>
          <div>
            <h4>Rubriques</h4>
            <ul>
              {cats.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <Link href={`/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Participer</h4>
            <ul>
              <li><Link href="/#newsletter">Newsletter</Link></li>
              <li><Link href="/contribuer">Proposer une info (clubs)</Link></li>
              <li><Link href="/rss.xml">Flux RSS</Link></li>
            </ul>
          </div>
          <div>
            <h4>Le journal</h4>
            <ul>
              <li><Link href="/charte">Charte éditoriale</Link></li>
              <li><Link href="/mentions-legales">Mentions légales</Link></li>
              <li><Link href="/admin" rel="nofollow">Espace rédaction</Link></li>
            </ul>
          </div>
        </div>
        <div className="big-sign" aria-hidden>Passe D</div>
        <div className="legal meta">
          <span>© {new Date().getFullYear()} Passe D. Contenus sponsorisés toujours signalés.</span>
          <span>Mesure d&apos;audience sans cookie.</span>
        </div>
      </div>
    </footer>
  );
}
