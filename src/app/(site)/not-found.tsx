import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <header className="page-head">
        <span className="kicker">Erreur 404</span>
        <h1>Hors-jeu</h1>
        <p>Cette page n&apos;existe pas ou plus. Le ballon est par ici :</p>
        <p style={{ marginTop: 20 }}><Link className="btn" href="/">Retour à l&apos;accueil</Link> <Link className="btn ghost" href="/recherche">Rechercher</Link></p>
      </header>
    </div>
  );
}
