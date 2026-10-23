/**
 * Articles de lancement, créés une seule fois à l'installation, au statut « Prêt » (non publiés).
 * Ils parlent du média lui-même : aucun fait, résultat ou citation inventé. À relire avant publication.
 */
export const LAUNCH_ARTICLES = [
  {
    category: "actualites",
    title: "Bienvenue sur Quotidien Sportif",
    slug: "bienvenue-sur-quotidien-sportif",
    dek: "Le football professionnel, le football amateur, les talents de demain et ceux qui font vivre le jeu en coulisses. Voici ce que vous trouverez ici, et ce à quoi nous nous engageons.",
    bodyHtml: `<p>Quotidien Sportif est un média consacré au football, à tous ses étages. Le très haut niveau bien sûr, mais aussi les terrains de district, les centres de formation, les tribunes et les métiers qu'on ne voit jamais à la télévision.</p>
<h2>Ce que nous couvrons</h2>
<ul><li><p><strong>Actualités</strong> : l'essentiel du jour, vérifié et remis en perspective.</p></li><li><p><strong>Talents</strong> : des portraits et des profils à suivre, de la formation au monde pro.</p></li><li><p><strong>Football amateur</strong> : les clubs, les résultats, les histoires locales, souvent racontées avec les clubs eux-mêmes.</p></li><li><p><strong>Mercato</strong> : les transferts, avec pour chaque information son niveau de confirmation.</p></li><li><p><strong>Métiers du football</strong> : scouts, analystes, intendants, arbitres, jardiniers de pelouse.</p></li><li><p><strong>Innovations, vidéos et culture football</strong> : la data, les méthodes, les supporters, l'histoire.</p></li></ul>
<h2>Nos engagements</h2>
<ul><li><p>Nous ne publions pas de résultat, de chiffre, de citation ou de transfert que nous n'avons pas pu sourcer.</p></li><li><p>Chaque information mercato affiche son statut : rumeur, intérêt rapporté, négociations, accord annoncé, transfert confirmé ou démenti.</p></li><li><p>Quand nous nous trompons, nous corrigeons, et la correction est visible en bas de l'article.</p></li><li><p>Les contenus sponsorisés sont toujours signalés comme tels.</p></li><li><p>Nous faisons particulièrement attention aux informations qui concernent des joueurs mineurs.</p></li></ul>
<h2>Faites-en partie</h2>
<p>Vous êtes dirigeant, éducateur ou joueur d'un club amateur ? Envoyez-nous vos résultats et vos histoires depuis la page <a href="/contribuer">Contribuer</a>. Et pour ne rien manquer, inscrivez-vous à la newsletter en bas de page.</p>
<p>Bonne lecture, et bienvenue.</p>`,
  },
  {
    category: "football-amateur",
    title: "Clubs amateurs : envoyez-nous vos résultats et vos histoires",
    slug: "clubs-amateurs-envoyez-nous-vos-resultats",
    dek: "Un résultat, un exploit, un bénévole qui mérite d'être connu ? Le formulaire Contribuer est fait pour vous. Voici comment il fonctionne.",
    bodyHtml: `<p>Le football amateur se raconte mieux avec ceux qui le vivent chaque week-end. C'est pourquoi Quotidien Sportif ouvre une porte directe aux clubs.</p>
<h2>Comment ça marche</h2>
<ol><li><p>Rendez-vous sur la page <a href="/contribuer">Contribuer</a>.</p></li><li><p>Choisissez le type d'envoi : un résultat, une histoire, un portrait ou une annonce.</p></li><li><p>Indiquez votre club et un moyen de vous recontacter, puis décrivez ce qui s'est passé. Vous pouvez joindre une photo dont vous détenez les droits.</p></li></ol>
<h2>Ce qui se passe ensuite</h2>
<p>Chaque envoi est lu par la rédaction avant toute publication. Nous pouvons vous recontacter pour vérifier un détail ou compléter l'histoire. Rien n'est publié automatiquement.</p>
<p>Pour les joueuses et joueurs mineurs, nous demandons l'accord des responsables légaux avant de publier un nom ou une photo.</p>
<p>À vous de jouer.</p>`,
  },
  {
    category: "mercato",
    title: "Mercato : comment lire nos statuts",
    slug: "mercato-comment-lire-nos-statuts",
    dek: "Rumeur, intérêt, négociations, accord, transfert confirmé : sur Quotidien Sportif, chaque information mercato affiche clairement où elle en est.",
    bodyHtml: `<p>Le mercato est la période où circulent le plus d'informations, et le plus d'informations fausses. Pour que vous sachiez toujours à quoi vous en tenir, chaque article mercato porte une étiquette qui indique son niveau de confirmation.</p>
<h2>Les six statuts</h2>
<ul><li><p><strong>Rumeur</strong> : information non vérifiée, relayée avec prudence.</p></li><li><p><strong>Intérêt rapporté</strong> : un intérêt est rapporté par une ou plusieurs sources.</p></li><li><p><strong>Négociations rapportées</strong> : des discussions sont rapportées entre les parties.</p></li><li><p><strong>Accord annoncé</strong> : un accord est annoncé, mais pas encore officialisé.</p></li><li><p><strong>Transfert confirmé</strong> : officialisé par au moins un des clubs.</p></li><li><p><strong>Démenti / corrigé</strong> : l'information a été démentie ou corrigée.</p></li></ul>
<h2>Toujours une source</h2>
<p>Chaque information mercato cite sa source. Quand le statut évolue, l'historique reste visible dans l'article, avec la date de chaque changement. Vous pouvez ainsi suivre un dossier du premier bruit jusqu'à l'officialisation, ou jusqu'au démenti.</p>`,
  },
];
