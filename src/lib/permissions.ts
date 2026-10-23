// Règles d'accès de la rédaction. Toutes les routes serveur passent par ces fonctions :
// l'interface ne fait que masquer ce que le serveur refuserait de toute façon.
import type { Role, Status } from "@/db/schema";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  publisher: "Directeur de publication",
  editor_in_chief: "Rédacteur en chef",
  journalist: "Journaliste",
  media: "Photographe / vidéaste",
  seo: "Éditeur SEO",
  contributor: "Contributeur externe",
};

export const STATUS_LABELS: Record<Status, string> = {
  idea: "Idée",
  assigned: "Assigné",
  writing: "En rédaction",
  review: "À relire",
  changes: "À corriger",
  approved: "Validé",
  scheduled: "Programmé",
  published: "Publié",
  update_needed: "À actualiser",
  archived: "Archivé",
};

const EDITORS: Role[] = ["admin", "publisher", "editor_in_chief"];

export type Actor = { id: number; role: Role; active: boolean };
export type ArticleRef = {
  status: Status;
  authorId: number | null;
  assigneeId: number | null;
  createdBy: number | null;
  contributorIds?: number[];
};

export const isEditor = (a: Actor) => a.active && EDITORS.includes(a.role);

export const can = {
  manageUsers: (a: Actor) => a.active && a.role === "admin",
  manageSettings: (a: Actor) => a.active && (a.role === "admin" || a.role === "publisher"),
  manageTaxonomy: (a: Actor) => isEditor(a) || (a.active && a.role === "seo"),
  viewAudit: (a: Actor) => a.active && (a.role === "admin" || a.role === "publisher"),
  viewAnalytics: (a: Actor) => isEditor(a) || (a.active && a.role === "seo"),
  moderateSubmissions: (a: Actor) => isEditor(a),
  createArticle: (a: Actor) => a.active && a.role !== "contributor",
  assign: (a: Actor) => isEditor(a),
  publish: (a: Actor) => isEditor(a),
  uploadMedia: (a: Actor) => a.active,
  editMedia: (a: Actor, uploadedBy: number | null) =>
    a.active && (isEditor(a) || a.role === "media" || a.role === "seo" || uploadedBy === a.id),
  deleteMedia: (a: Actor, uploadedBy: number | null) =>
    a.active && (isEditor(a) || a.role === "media" || uploadedBy === a.id),
};

/** L'acteur est-il impliqué dans l'article (auteur, assigné, créateur ou contributeur) ? */
export function involved(a: Actor, art: ArticleRef) {
  return (
    art.authorId === a.id ||
    art.assigneeId === a.id ||
    art.createdBy === a.id ||
    (art.contributorIds ?? []).includes(a.id)
  );
}

// Statuts dans lesquels un journaliste peut encore modifier son texte sans repasser par un chef.
const OPEN_FOR_WRITERS: Status[] = ["idea", "assigned", "writing", "changes", "update_needed"];

export function canViewArticle(a: Actor, art: ArticleRef) {
  if (!a.active) return false;
  if (isEditor(a) || a.role === "seo") return true;
  if (a.role === "contributor") return involved(a, art);
  // Journalistes et photographes voient toute la rédaction pour se coordonner.
  return true;
}

export function canEditArticle(a: Actor, art: ArticleRef) {
  if (!a.active) return false;
  if (isEditor(a)) return true;
  if (!involved(a, art)) return false;
  return OPEN_FOR_WRITERS.includes(art.status);
}

/** Le rôle SEO peut toujours retoucher titres SEO, description, tags et image de partage. */
export function canEditSeo(a: Actor, art: ArticleRef) {
  return canEditArticle(a, art) || (a.active && a.role === "seo");
}

export function canDeleteArticle(a: Actor, art: ArticleRef) {
  if (!a.active) return false;
  if (a.role === "admin" || a.role === "publisher") return true;
  return (art.status === "idea" || art.status === "writing") && art.createdBy === a.id && a.role !== "contributor";
}

/** Statuts qu'un acteur peut donner à un article, à partir de son statut actuel. */
export function allowedTransitions(a: Actor, art: ArticleRef): Status[] {
  if (!a.active) return [];
  if (isEditor(a)) {
    return ["idea", "assigned", "writing", "review", "changes", "approved", "scheduled", "published", "update_needed", "archived"];
  }
  if (!involved(a, art)) return [];
  switch (art.status) {
    case "idea":
    case "assigned":
      return ["writing", "review"];
    case "writing":
    case "changes":
    case "update_needed":
      return ["writing", "review"];
    case "review":
      return ["writing"]; // reprendre son texte tant qu'il n'est pas relu
    default:
      return [];
  }
}

export function canTransition(a: Actor, art: ArticleRef, to: Status) {
  if (to === art.status) return true;
  return allowedTransitions(a, art).includes(to);
}
