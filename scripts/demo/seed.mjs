// Contenu fictif de démonstration pour les captures (ne pas lancer sur la vraie base).
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const H = { Origin: BASE, "Content-Type": "application/json" };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.goto(`${BASE}/admin/setup`);
await p.fill("#token", "test-token");
await p.fill("#name", "Tom Diallo");
await p.fill("#email", "tom@example.com");
await p.fill("#password", "motdepasse123");
await p.click("button:has-text('Créer le compte')");
await p.waitForURL(/bienvenue/);
for (const [name, email] of [["Inès Martin", "ines@example.com"], ["Karim Benali", "karim@example.com"]]) {
  await p.goto(`${BASE}/admin/equipe`);
  await p.fill("#in-name", name); await p.fill("#in-email", email);
  await p.click("button:has-text('Créer le lien')");
  await p.waitForSelector(".alert.ok input");
}
const media = [];
for (let i = 0; i < 10; i++) {
  const r = await p.request.post(`${BASE}/api/admin/media`, { headers: { Origin: BASE }, multipart: { file: { name: `terrain-${i}.jpg`, mimeType: "image/jpeg", buffer: (await import("node:fs")).readFileSync(`/tmp/claude-0/demo/img${i}.jpg`) }, credit: "QS / démo", alt: "Terrain de football", caption: "Visuel de démonstration" } });
  media.push((await r.json()).item.id);
}
const users = await p.evaluate(async () => 0);
void users;
const A = [
  ["Talents", "portrait", "talent-a-suivre", "Le gardien de 17 ans qui fait douter les attaquants de Régional 1", "Trois penaltys arrêtés en Gambardella, des réflexes rares et une lecture du jeu d'ancien. Portrait d'un talent que personne n'a encore vu passer.", 0, true],
  ["Mercato", "breve", "mercato-decrypte", "Un milieu de National 2 suivi par trois clubs de Ligue 2", "Les premiers contacts sont rapportés, rien n'est signé. Ce que l'on sait, et ce que l'on ne sait pas.", 4, false, "interet", "Source proche du club, confirmée par un second interlocuteur"],
  ["Métiers du football", "reportage", "derriere-le-match", "Intendant : 40 maillots lavés avant l'aube, chaque samedi", "Il arrive le premier, repart le dernier, et connaît la pointure de chaque joueur. Une journée avec l'homme que personne ne voit.", 6, false],
  ["Football amateur", "reportage", "foot-d-a-cote", "À Bondy, le club qui a remplacé ses buts rouillés grâce à une cagnotte de quartier", "1 200 donateurs, 14 000 euros et un samedi de travaux : comment un club de district a réparé son terrain lui-même.", 1, false],
  ["Innovations", "analyse", "idee-qui-change-le-jeu", "Ces clubs amateurs qui filment leurs matchs avec un téléphone et une IA", "Pour moins de 10 euros par mois, des éducateurs analysent leurs matchs comme des pros. Ce que ça change vraiment, et ses limites.", 5, false],
  ["Vidéos", "video", "minute-terrain", "Une minute avec une arbitre de Régional 2", "Elle arbitre depuis 9 ans. Elle raconte la pression, les insultes et ce qui la fait revenir chaque dimanche.", 7, false],
  ["Culture football", "dossier", "football-invisible", "Le club ouvrier qui jouait en sabots", "Avant la guerre, une équipe de cheminots a failli atteindre les quarts de la Coupe de France. Histoire d'une épopée oubliée.", 3, false],
  ["Football amateur", "portrait", "", "Cette éducatrice qui a monté une section U13 féminine en un été", "Partie de zéro joueuse en juin, elle en compte 28 en octobre.", 8, false],
  ["Talents", "analyse", "radar-scouting", "Le radar du scouting : cinq profils de U19 à suivre cette saison", "Latéraux offensifs, un numéro 6 gaucher, un buteur tardif : notre sélection, chiffres sourcés.", 9, false],
  ["Mercato", "analyse", "mercato-decrypte", "Prêt ou transfert sec ? Ce que révèle la stratégie des clubs de National", "Les prêts ont progressé cette saison. Décryptage d'un marché sous contrainte.", 2, false, "negociations", "Deux sources concordantes"],
  ["Métiers du football", "entretien", "derriere-le-match", "Analyste vidéo en Ligue 2 : « On regarde 40 heures de match par semaine »", "Il découpe chaque adversaire en clips de 8 secondes. Entretien avec un métier devenu indispensable.", 1, false],
  ["Actualités", "breve", "", "Coupe de France : le tirage du 7e tour réserve trois chocs régionaux", "Le tour des amateurs, avec des déplacements de plus de 300 kilomètres.", 0, false],
];
const cats = Object.fromEntries((await p.evaluate(() => [])).map(() => []));
void cats;
const body = (dek) => `<p>${dek} Ce texte est un contenu fictif de démonstration, destiné à montrer la mise en page d'un article sur Passe D.</p><p>Le samedi matin, le terrain synthétique est encore humide quand les premiers joueurs arrivent. Les éducateurs installent les plots, les parents restent derrière la main courante, et le café du club-house fume déjà.</p><h2>Ce qui le distingue</h2><p>Un placement, une lecture du jeu, une manière de communiquer avec ses partenaires : les observateurs parlent d'une maturité rare à cet âge.</p><blockquote><p>« Il voit les choses une seconde avant les autres. »</p></blockquote><p>La suite dira si ce talent confirme. Passe D le suivra tout au long de la saison.</p><aside class="callout"><p>Méthode : informations recueillies auprès de deux éducateurs et du club. Les statistiques citées proviennent des feuilles de match officielles.</p></aside>`;
let n = 0;
for (const [cat, format, mod, title, dek, img, featured, ms, msrc] of A) {
  await p.goto(`${BASE}/admin/articles/nouveau`);
  await p.fill("#title", title);
  await p.selectOption("#categoryId", { label: cat });
  await p.selectOption("#format", format);
  if (mod) await p.selectOption("#module", mod);
  await p.click("button:has-text('Créer et ouvrir')");
  await p.waitForURL(/\/admin\/articles\/\d+$/);
  const id = Number(p.url().split("/").pop());
  const data = { dek, bodyHtml: body(dek), coverId: media[img], featured, tagNames: [cat === "Talents" ? "Gardiens" : "Bondy", "Saison 2026-2027"] };
  if (format === "video") data.videoUrl = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
  if (ms) Object.assign(data, { mercatoStatus: ms, mercatoSource: msrc });
  let r = await p.request.patch(`${BASE}/api/admin/articles/${id}`, { headers: H, data });
  if (!r.ok()) console.log(await r.text());
  r = await p.request.post(`${BASE}/api/admin/articles/${id}/status`, { headers: H, data: { to: "published" } });
  if (!r.ok()) console.log(await r.text());
  n++;
  await new Promise((res) => setTimeout(res, 300));
}
// quelques sujets en cours pour le back-office
for (const [t, st] of [["Les arbitres de district manquent : enquête", "writing"], ["Portrait d'un groundsman de Ligue 1", "review"], ["Le futsal peut-il sauver les petits clubs ?", "idea"], ["Mercato d'hiver : les budgets de National", "changes"]]) {
  await p.goto(`${BASE}/admin/articles/nouveau`);
  await p.fill("#title", t);
  await p.click("button:has-text('Créer et ouvrir')");
  await p.waitForURL(/\/admin\/articles\/\d+$/);
  const id = Number(p.url().split("/").pop());
  await p.request.patch(`${BASE}/api/admin/articles/${id}`, { headers: H, data: { deadline: new Date(Date.now() + (n++ % 5 - 1) * 86400_000).toISOString(), priority: n % 3 === 0 ? 1 : 2 } });
  if (st !== "writing") await p.request.post(`${BASE}/api/admin/articles/${id}/status`, { headers: H, data: { to: st } });
}
await p.goto(`${BASE}/admin/reglages`);
await p.fill("#v", "28");
await p.fill("#l", "joueuses dans la nouvelle section U13 d'un club de district, partie de zéro en juin (chiffre de démonstration).");
await p.fill("#s", "Club, octobre 2026");
await p.click("form:has(#v) button");
await p.waitForTimeout(800);
await p.fill("#q", "La VAR doit-elle arriver en National 3 ?");
await p.click("button:has-text('Lancer le sondage')");
await p.waitForTimeout(800);
for (let i = 0; i < 30; i++) await p.request.post(`${BASE}/api/view`, { headers: { ...H, "X-Forwarded-For": `10.0.0.${i}` }, data: { id: 1 + (i % 12), ref: i % 2 ? "https://www.google.com/" : "" } });
console.log("seed ok", n);
await b.close();
