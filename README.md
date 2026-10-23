# Passe D

Média football nouvelle génération : site public éditorialisé et back-office de rédaction
(articles, médias, équipe, relecture, programmation, SEO). Next.js 15, PostgreSQL (Supabase), Drizzle.

> « Le football que tu ne regardes pas encore. »

## Mettre le site en ligne (≈ 15 minutes, sans coder)

1. **Supabase** (gratuit) : créez un projet sur [supabase.com](https://supabase.com), région Europe (Paris).
   - *Project Settings → Database → Connection string → Transaction pooler* : copiez l'URL (remplacez `[YOUR-PASSWORD]`). C'est `DATABASE_URL`.
   - *Project Settings → API* : copiez l'URL du projet (`SUPABASE_URL`) et la clé `service_role` (`SUPABASE_SERVICE_ROLE_KEY`).
   - Le bucket public `media` est créé automatiquement au premier import.
2. **Vercel** (gratuit) : [vercel.com/new](https://vercel.com/new) → importez ce dépôt GitHub.
   - Ajoutez les variables de `.env.example` (`NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SETUP_TOKEN`).
   - Déployez. Les tables sont créées automatiquement pendant le build.
3. Ouvrez `https://votre-site/admin` : saisissez le code `ADMIN_SETUP_TOKEN` et créez le compte administrateur.
   Les 8 rubriques de base sont créées. Vous pouvez publier.
4. **Nom de domaine** : Vercel → *Settings → Domains* → ajoutez `passe-d.net` et `www.passe-d.net`, puis suivez les
   instructions DNS chez votre registrar. Mettez `NEXT_PUBLIC_SITE_URL` à jour et redéployez.
   Les anciennes adresses `index.html` et `login.html` redirigent vers l'accueil et la connexion.

Chaque `git push` sur la branche principale redéploie le site. Les « Preview deployments » de Vercel servent
d'environnement de test (pointez-les vers un second projet Supabase si vous voulez une base séparée).

## Ce qui fonctionne réellement

- **Publier un article** (`/admin/articles/publier`) : une seule page avec rubrique en menu déroulant, titre, résumé, photo, vidéo (import ou lien YouTube/Vimeo/Dailymotion), texte, signature et archivage automatique (jamais, 7 j, 30 j, 3 mois, 1 an ou date précise). Publier maintenant, programmer, envoyer en relecture (journalistes) ou garder en brouillon. Le brouillon est gardé dans le navigateur tant qu'il n'est pas envoyé.
- **Archivage** : un article archivé quitte l'accueil, les rubriques et le flux, mais son lien reste lisible avec la mention « Archive ». « Retirer du site » le rend introuvable.

**Site public**
- Accueil éditorialisé : une (article mis en avant + secondaires), manifeste, fil d'actualité filtrable
  (rubrique, format, période, popularité) avec rafraîchissement automatique sans rechargement, mercato décrypté
  avec statuts, chiffre du jour, sondage « débat du vestiaire », plus lus, talent à suivre, foot d'à côté,
  vidéos (rail vertical), derrière le match, l'idée qui change le jeu, football invisible, rubriques, newsletter.
  Les modules vides se masquent : aucun faux contenu.
- Pages rubrique (filtres propres à chaque rubrique, légende mercato), article, auteur, sujet (joueur, club,
  métier…), recherche, contribution des clubs, charte éditoriale, mentions légales, 404.
- Thème sombre / clair (préférence système + bouton), mobile d'abord, navigation clavier, lien d'évitement,
  textes alternatifs, animations désactivées si l'utilisateur le demande.
- SEO : URL lisibles `/articles/mon-titre`, métadonnées, Open Graph/Twitter, image de partage dédiée,
  JSON-LD `NewsArticle`/`VideoObject`/`BreadcrumbList`/`Person`, canoniques, `sitemap.xml`, `robots.txt`, `rss.xml`.
- Mesure d'audience sans cookie ni IP stockée (compteurs agrégés par jour, source de trafic par domaine).

**Back-office (`/admin`)**
- Comptes, invitations par lien (7 jours), désactivation sans perte d'historique, verrouillage après 5 échecs,
  sessions en base (cookie httpOnly), protection CSRF, journal des actions sensibles.
- 7 rôles : administrateur, directeur de publication, rédacteur en chef, journaliste, photographe/vidéaste,
  éditeur SEO, contributeur externe. Permissions vérifiées côté serveur (`src/lib/permissions.ts`).
- Éditeur : titre, chapô, texte riche (intertitres, gras, italique, liens, listes, citations, encadrés,
  séparateurs, images légendées et créditées, vidéos YouTube), enregistrement automatique, détection des
  modifications concurrentes, versions avec restauration, aperçu fidèle, duplication, suppression.
- Organisation : rubrique, format, format récurrent (10 modules avec leur règle), auteur, contributeurs,
  assignation, échéance, priorité, mise à la une, sujets, articles associés (manuels + automatiques).
- Workflow : idée, assigné, en rédaction, à relire, à corriger, validé, programmé, publié, à actualiser, archivé.
  Publication immédiate ou programmée (heure de Paris, sans tâche planifiée), dépublication, contrôles bloquants
  avant publication (titre, texte, rubrique, partenaire si sponsorisé, source si mercato).
- Mercato : 6 niveaux de confirmation, source obligatoire, historique horodaté visible des lecteurs.
- Corrections publiques datées, contenus sponsorisés signalés partout.
- Médiathèque : import glisser-déposer, optimisation WebP 480/960/1600 px, suppression des métadonnées GPS,
  contrôle format/poids/dimensions, légende, crédit, droits, dossier, mots-clés, recherche, recadrage par point
  d'intérêt (16:9, 3:2, 4:5, 1:1, 9:16), protection contre la suppression d'un média utilisé.
- Tableau de bord, liste filtrable, Kanban (glisser-déposer), calendrier éditorial, notes internes et demandes
  de correction, retards, contenus à actualiser, activité de la rédaction.
- Rubriques/sous-rubriques et sujets, file de modération des contributions clubs (transformable en brouillon),
  audience, chiffre du jour, sondages, export CSV de la newsletter.

## Ce qui reste à brancher (non simulé dans l'interface)

- **Envoi de la newsletter et des alertes** : les inscriptions et thématiques sont collectées ; l'envoi se
  branchera sur Brevo ou Resend (clé API + modèle).
- **E-mails d'invitation / mot de passe oublié** : aujourd'hui l'administrateur copie le lien et l'envoie.
- **Résultats et classements amateurs** : aucune donnée n'est inventée. À brancher sur une source autorisée
  (convention FFF/ligue) ou saisie validée par la rédaction.
- **Fonctions d'IA** (titres, résumés, tags, transcription) : architecture prévue, non activée. À activer
  seulement avec coûts, limites et validation humaine définis.
- **Intégration de publications X/Instagram/TikTok** : seuls les liens sont pris en charge pour l'instant.
- Statistiques avancées (visiteurs uniques, temps d'engagement) : brancher Plausible ou Matomo.
- Sauvegardes : Supabase fait des sauvegardes quotidiennes sur les offres payantes ; sur l'offre gratuite,
  exporter régulièrement (`pg_dump`).

## Développement

```bash
npm install
npm run dev           # http://localhost:3000, base embarquée dans .data/
npx tsc --noEmit      # types
node tests/e2e.mjs    # parcours complets (serveur lancé, base vide)
npm run db:generate   # après modification de src/db/schema.ts
```
