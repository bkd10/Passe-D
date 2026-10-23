import type { Format, MercatoStatus } from "@/db/schema";

export const FORMAT_LABELS: Record<Format, string> = {
  article: "Article",
  portrait: "Portrait",
  analyse: "Analyse",
  entretien: "Entretien",
  reportage: "Reportage",
  dossier: "Dossier",
  breve: "Brève",
  video: "Vidéo",
  chiffre: "Le chiffre",
  debat: "Débat",
};

export const MERCATO_LABELS: Record<MercatoStatus, { label: string; tone: string; help: string }> = {
  rumeur: { label: "Rumeur", tone: "grey", help: "Information non vérifiée, relayée avec prudence." },
  interet: { label: "Intérêt rapporté", tone: "blue", help: "Un intérêt est rapporté par une ou plusieurs sources." },
  negociations: { label: "Négociations rapportées", tone: "amber", help: "Des discussions sont rapportées entre les parties." },
  accord: { label: "Accord annoncé", tone: "lime", help: "Un accord est annoncé, pas encore officialisé." },
  confirme: { label: "Transfert confirmé", tone: "green", help: "Officialisé par au moins un des clubs." },
  dementi: { label: "Démenti / corrigé", tone: "red", help: "L'information a été démentie ou corrigée." },
};

/** Formats éditoriaux récurrents : chacun a sa place en une, son habillage et sa règle de publication. */
export const MODULES = [
  {
    slug: "talent-a-suivre",
    name: "Le talent à suivre",
    kicker: "Talent",
    rule: "Un joueur ou une joueuse présenté en profondeur. Âge, poste, club, parcours, points forts vérifiés. Mineurs : accord des responsables légaux.",
  },
  {
    slug: "football-invisible",
    name: "Le football invisible",
    kicker: "Histoire",
    rule: "Une histoire méconnue du football. Au moins deux sources ou témoins.",
  },
  {
    slug: "derriere-le-match",
    name: "Derrière le match",
    kicker: "Métiers",
    rule: "Un métier ou une personne qui rend le football possible. Toujours un témoignage direct.",
  },
  {
    slug: "radar-scouting",
    name: "Le radar du scouting",
    kicker: "Scouting",
    rule: "Trois à cinq profils à découvrir. Chaque donnée chiffrée doit citer sa source.",
  },
  {
    slug: "foot-d-a-cote",
    name: "Le foot d'à côté",
    kicker: "Amateur",
    rule: "Résultats, clubs et héros du football amateur. Aucun résultat non validé présenté comme officiel.",
  },
  {
    slug: "idee-qui-change-le-jeu",
    name: "L'idée qui change le jeu",
    kicker: "Innovation",
    rule: "Une innovation tactique, technologique ou économique, expliquée simplement, avec ses limites.",
  },
  {
    slug: "mercato-decrypte",
    name: "Le mercato décrypté",
    kicker: "Mercato",
    rule: "Rumeurs, confirmations et analyses. Statut de confirmation, source et date de mise à jour obligatoires.",
  },
  {
    slug: "minute-terrain",
    name: "La minute terrain",
    kicker: "Vidéo",
    rule: "Une vidéo courte ou verticale, sous-titrée.",
  },
  {
    slug: "chiffre-du-jour",
    name: "Le chiffre du jour",
    kicker: "Data",
    rule: "Une statistique expliquée simplement. Source et périmètre indiqués.",
  },
  {
    slug: "debat-du-vestiaire",
    name: "Le débat du vestiaire",
    kicker: "Débat",
    rule: "Une question qui invite la communauté à réagir, associée à un sondage.",
  },
] as const;

export type ModuleSlug = (typeof MODULES)[number]["slug"];
export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);

/** Rubriques créées au premier démarrage. Modifiables ensuite dans le back-office. */
export const DEFAULT_CATEGORIES = [
  { slug: "actualites", name: "Actualités", color: "#f5f5f3", description: "L'essentiel du jour, vérifié et mis en perspective." },
  { slug: "talents", name: "Talents", color: "#f2b631", description: "Portraits, profils à suivre, parcours et observations de terrain." },
  { slug: "football-amateur", name: "Football amateur", color: "#e9c46a", description: "Résultats, clubs, comptes rendus et héros locaux." },
  { slug: "mercato", name: "Mercato", color: "#ff9f43", description: "Rumeurs, négociations et transferts, avec leur niveau de confirmation." },
  { slug: "innovations", name: "Innovations", color: "#d9b26f", description: "Data, technologies, équipements, méthodes et évolutions tactiques." },
  { slug: "metiers-du-football", name: "Métiers du football", color: "#f4d58d", description: "Scouts, analystes, intendants, arbitres, groundsmen : ceux qu'on ne voit pas." },
  { slug: "videos", name: "Vidéos", color: "#ffcf5c", description: "Interviews, reportages, analyses, formats courts et coulisses." },
  { slug: "culture-football", name: "Culture football", color: "#c8a97e", description: "Histoires, supporters, archives, économie et phénomènes de société." },
];
