import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false } };

export default function Legal() {
  return (
    <div className="wrap">
      <header className="page-head">
        <span className="kicker">Le journal</span>
        <h1>Mentions légales</h1>
      </header>
      <div className="prose" style={{ maxWidth: 760, padding: "36px 0 60px" }}>
        <h2>Éditeur</h2>
        <p>Passe D. Directeur de la publication : à compléter dans le back-office avant l&apos;ouverture officielle (raison sociale, adresse, contact).</p>
        <h2>Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Base de données et médias : Supabase.</p>
        <h2>Données personnelles</h2>
        <p>La mesure d&apos;audience n&apos;utilise aucun cookie et ne conserve aucune adresse IP : seuls des compteurs agrégés par article et par jour sont enregistrés. Les adresses e-mail de la newsletter servent uniquement à son envoi et peuvent être supprimées sur simple demande.</p>
      </div>
    </div>
  );
}
