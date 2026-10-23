import type { Metadata } from "next";

export const metadata: Metadata = { title: "Charte éditoriale", description: "Nos engagements : vérification, sources, mercato transparent, mineurs protégés, contenus sponsorisés signalés." };

const RULES = [
  ["Raconter autrement", "Nous couvrons les talents émergents, le football amateur, les métiers de l'ombre, les innovations et les histoires humaines autant que les grandes affiches."],
  ["Vérifier avant de publier", "Chaque information factuelle est vérifiée. Les chiffres citent leur source et leur périmètre. Aucune citation, aucun résultat, aucune statistique n'est inventé."],
  ["Un mercato transparent", "Chaque information de transfert affiche son niveau de confirmation (rumeur, intérêt rapporté, négociations, accord annoncé, confirmé, démenti), sa source et sa date de mise à jour. Nous n'utilisons pas de « score de fiabilité » arbitraire."],
  ["Corriger visiblement", "Une erreur est corrigée sur la page, avec la date et la nature de la correction."],
  ["Protéger les mineurs", "Pour les joueurs mineurs : prénom et initiale par défaut, accord des responsables légaux pour un portrait, aucune donnée personnelle sensible."],
  ["Séparer l'éditorial du commercial", "Les contenus sponsorisés et partenariats sont toujours signalés comme tels et produits séparément du travail indépendant de la rédaction."],
  ["L'IA sous contrôle humain", "Les outils d'aide (suggestions, résumés, corrections) restent facultatifs et validés par un journaliste. Ils ne produisent jamais de citation, de résultat ou d'information de transfert."],
];

export default function Charte() {
  return (
    <div className="wrap">
      <header className="page-head">
        <span className="kicker">Le journal</span>
        <h1>Notre charte</h1>
        <p>Le football raconté avec exigence.</p>
      </header>
      <div className="prose" style={{ maxWidth: 760, padding: "36px 0 60px" }}>
        {RULES.map(([t, d], i) => (
          <div key={t}>
            <h2><span className="meta" style={{ marginRight: 10 }}>{String(i + 1).padStart(2, "0")}</span>{t}</h2>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
