// Parcours de bout en bout : node tests/e2e.mjs (serveur lancé sur BASE, base vide).
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const H = { Origin: BASE, "Content-Type": "application/json" };
const log = (...a) => console.log("✓", ...a);
const shots = process.env.SHOTS;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const admin = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await admin.newPage();
page.on("pageerror", (e) => console.error("ERREUR PAGE", e.message));

// 1. Installation
await page.goto(`${BASE}/admin`);
await page.waitForURL(/setup/);
if (await page.locator("#token").count()) await page.fill("#token", process.env.ADMIN_SETUP_TOKEN || "test-token");
await page.fill("#name", "Tom Rédac");
await page.fill("#email", "tom@example.com");
await page.fill("#password", "motdepasse123");
await page.click("button:has-text('Créer le compte')");
await page.waitForURL(/\/admin\?bienvenue/);
log("installation + compte admin");

// Une seconde installation est refusée
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/admin/setup`);
assert.match(p2.url(), /login/);
log("setup verrouillé après le premier compte");

// 2. Invitation d'une journaliste
await page.goto(`${BASE}/admin/equipe`);
await page.fill("#in-name", "Inès Journaliste");
await page.fill("#in-email", "ines@example.com");
await page.selectOption("#in-role", "journalist");
await page.click("button:has-text('Créer le lien')");
const link = await page.locator(".alert.ok input").inputValue();
assert.match(link, /\/admin\/invitation\//);
await p2.goto(link);
await p2.fill("#password", "journaliste42x");
await p2.fill("#confirm", "journaliste42x");
await p2.click("button:has-text('Activer')");
await p2.waitForURL(`${BASE}/admin`);
log("invitation acceptée par la journaliste");

// 3. La journaliste écrit un article
await p2.goto(`${BASE}/admin/articles/nouveau`);
await p2.fill("#title", "Le gardien de Bondy qui arrête tout");
await p2.click("button:has-text('Créer et ouvrir')");
await p2.waitForURL(/\/admin\/articles\/\d+$/);
const artId = Number(p2.url().split("/").pop());
await p2.fill(".ed-dek", "À 17 ans, il a stoppé trois penaltys en Gambardella. Portrait d'un talent qui ne se voit pas encore.");
await p2.click(".ProseMirror");
await p2.keyboard.type("Il est 15 heures sur le synthétique de Bondy quand Yanis enfile ses gants. ");
await p2.keyboard.type("Personne ne le connaît encore au-delà de la Seine-Saint-Denis. Ça pourrait changer vite.");
await p2.keyboard.press("Enter");
await p2.keyboard.type("Un réflexe hors norme");
await p2.click("button[title='Intertitre']");
await p2.waitForSelector(".save-state:has-text('Enregistré')", { timeout: 15000 });
log("article rédigé + enregistrement automatique");

// La journaliste ne peut pas publier ni se mettre à la une (contrôle serveur)
let r = await p2.request.post(`${BASE}/api/admin/articles/${artId}/status`, { headers: H, data: { to: "published" } });
assert.equal(r.status(), 403);
r = await p2.request.patch(`${BASE}/api/admin/articles/${artId}`, { headers: H, data: { featured: true } });
assert.equal(r.status(), 403);
r = await p2.request.post(`${BASE}/api/admin/articles/${artId}/status`, { headers: { "Content-Type": "application/json" }, data: { to: "review" } });
assert.equal(r.status(), 403, "requête sans Origin refusée");
log("permissions serveur : publication, une et CSRF refusés");

await p2.click("button:has-text('Envoyer en relecture') >> nth=0");
await p2.waitForSelector(".st-review");
log("envoyé en relecture");

// Plus modifiable par la journaliste pendant la relecture
r = await p2.request.patch(`${BASE}/api/admin/articles/${artId}`, { headers: H, data: { dek: "x" } });
assert.equal(r.status(), 403);
log("article verrouillé pour l'auteure pendant la relecture");

// 4. L'admin relit : demande de correction
await page.goto(`${BASE}/admin/articles/${artId}`);
await page.click("button:has-text('À corriger')");
await page.fill("#note", "Ajoute le score du match et le nom du club adverse.");
await page.click(".modal button:has-text('Confirmer')");
await page.waitForSelector(".ed-bar .st-changes");
log("corrections demandées");

r = await p2.request.patch(`${BASE}/api/admin/articles/${artId}`, { headers: H, data: { dek: "À 17 ans, il a stoppé trois penaltys face au Red Star (1-1, 4-3 tab). Portrait." } });
assert.equal(r.status(), 200);
await p2.request.post(`${BASE}/api/admin/articles/${artId}/status`, { headers: H, data: { to: "review" } });
log("corrigé et renvoyé en relecture");

// 5. Médias : import d'une image
const img = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 30, g: 120, b: 60 } } }).jpeg().toBuffer();
writeFileSync("/tmp/claude-0/test.jpg", img);
await page.goto(`${BASE}/admin/medias`);
await page.fill(".dropzone input.input", "Photo QS");
await page.setInputFiles(".dropzone input[type=file]", "/tmp/claude-0/test.jpg");
await page.waitForSelector(".media-item", { timeout: 20000 });
const media = await (await page.request.get(`${BASE}/api/admin/media`)).json();
assert.ok(media.items[0].variants.md, "versions générées");
assert.equal(media.items[0].credit, "Photo QS");
const mediaId = media.items[0].id;
r = await page.request.patch(`${BASE}/api/admin/media/${mediaId}`, { headers: H, data: { alt: "Un gardien plonge", caption: "Yanis à l'entraînement" } });
assert.equal(r.status(), 200);
r = await page.request.patch(`${BASE}/api/admin/media/${mediaId}`, { headers: H, data: { crop: { ratio: 1, fx: 0.5, fy: 0.5 } } });
const cropped = (await r.json()).item;
assert.equal(cropped.width, cropped.height);
log("image importée, optimisée, légendée, recadrée");

// 6. L'admin publie : rubrique, image, sujets, puis publication via l'interface
const cats = await page.request.get(`${BASE}/admin/rubriques`);
assert.equal(cats.status(), 200);
await page.goto(`${BASE}/admin/articles/${artId}`);
// essayer de publier sans rubrique : bloqué
await page.click(".ed-side button:has-text('Publier maintenant')");
await page.waitForSelector(".modal .alert.err:has-text('rubrique')");
await page.click(".modal button:has-text('Annuler')");
await page.selectOption("#cat", { label: "Talents" });
await page.selectOption("#mod", "talent-a-suivre");
await page.check("text=À la une de la page d'accueil");
await page.click(".cover-pick >> nth=0");
await page.click(".modal .media-item >> nth=0");
await page.fill(".tagbox input", "Bondy");
await page.keyboard.press("Enter");
await page.fill(".tagbox input", "Gardiens");
await page.keyboard.press("Enter");
await page.waitForSelector(".save-state:has-text('Enregistré')", { timeout: 15000 });
await page.click(".ed-side button:has-text('Publier maintenant')");
await page.click(".modal button:has-text('Confirmer')");
await page.waitForSelector(".ed-bar .st-published", { timeout: 15000 });
log("publié par l'admin");
if (shots) await page.screenshot({ path: `${shots}/editeur.png`, fullPage: false });

// 7. Public
const pub = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const pp = await pub.newPage();
await pp.goto(BASE);
await pp.waitForSelector(".hero-main h1:has-text('Le gardien de Bondy')");
log("à la une de l'accueil");
const slug = "le-gardien-de-bondy-qui-arrete-tout";
await pp.goto(`${BASE}/articles/${slug}`);
assert.ok(await pp.locator("h1:has-text('Le gardien de Bondy')").isVisible());
assert.ok(await pp.locator(".prose h2:has-text('Un réflexe hors norme')").isVisible());
const ld = (await pp.locator("script[type='application/ld+json']").allTextContents()).join("\n");
assert.match(ld, /NewsArticle/);
assert.ok(await pp.locator("link[rel=canonical]").count());
log("page article + données structurées + canonique");
if (shots) await pp.screenshot({ path: `${shots}/article.png` });
const sm = await (await pp.request.get(`${BASE}/sitemap.xml`)).text();
assert.ok(sm.includes(slug));
const rss = await (await pp.request.get(`${BASE}/rss.xml`)).text();
assert.ok(rss.includes(slug));
assert.equal((await pp.request.get(`${BASE}/talents`)).status(), 200);
assert.equal((await pp.request.get(`${BASE}/sujets/bondy`)).status(), 200);
assert.equal((await pp.request.get(`${BASE}/auteurs/ines-journaliste`)).status(), 200);
const search = await (await pp.request.get(`${BASE}/recherche?q=penaltys`)).text();
assert.ok(search.includes("Le gardien de Bondy"));
log("sitemap, RSS, rubrique, sujet, auteur, recherche");
for (const format of ["post", "story", "og"]) {
  const v = await pp.request.get(`${BASE}/articles/${slug}/visuel?format=${format}`);
  assert.equal(v.status(), 200);
  assert.equal(v.headers()["content-type"], "image/png");
}
assert.equal((await pp.request.get(`${BASE}/articles/article-inexistant/visuel`)).status(), 404);
assert.ok((await (await pp.request.get(`${BASE}/articles/${slug}`)).text()).includes(`/articles/${slug}/visuel?format=og`));
assert.ok((await (await pp.request.get(`${BASE}/rss.xml`)).text()).includes(`/articles/${slug}/visuel?format=post`));
const jpg = await pp.request.get(`${BASE}/articles/${slug}/visuel?format=post&type=jpg`);
assert.equal(jpg.headers()["content-type"], "image/jpeg");
assert.equal((await jpg.body()).subarray(0, 2).toString("hex"), "ffd8");
const reseaux = await (await pp.request.get(`${BASE}/reseaux.xml`)).text();
assert.ok(reseaux.includes(`/articles/${slug}/visuel?format=post&amp;type=jpg`) && reseaux.includes("lien en bio") && reseaux.includes("#PasseD"));
const news = await (await pp.request.get(`${BASE}/news-sitemap.xml`)).text();
assert.ok(news.includes(`/articles/${slug}</loc>`) && news.includes("<news:language>fr</news:language>"));
assert.ok((await (await pp.request.get(`${BASE}/robots.txt`)).text()).includes("news-sitemap.xml"));
const ldOrg = await (await pp.request.get(`${BASE}/articles/${slug}`)).text();
assert.ok(ldOrg.includes('"NewsMediaOrganization"') && ldOrg.includes("/logo.png"));
log("visuels réseaux sociaux (Instagram, story, aperçu de lien, JPEG) + flux RSS illustré + flux réseaux + Google (sitemap actualités, données structurées)");

// 7 bis. Version anglaise : réservée à qui peut modifier l'article, publiée à part sur /en
const enData = { title: "A 17-year-old keeper nobody knows yet", dek: "Three penalties saved in the Gambardella.", text: "## Reflexes\n\nIt is 3pm in Bondy & Yanis pulls on his gloves.\n\n- one\n- two\n\n[Read more](https://example.com)", published: true };
r = await p2.request.put(`${BASE}/api/admin/articles/${artId}/english`, { headers: H, data: enData });
assert.equal(r.status(), 403);
r = await page.request.put(`${BASE}/api/admin/articles/${artId}/english`, { headers: H, data: { ...enData, text: "" } });
assert.equal(r.status(), 400, "pas de publication sans texte");
r = await page.request.put(`${BASE}/api/admin/articles/${artId}/english`, { headers: H, data: enData });
assert.equal(r.status(), 200);
const enPage = await pp.request.get(`${BASE}/en/articles/${slug}`);
assert.equal(enPage.status(), 200);
const enHtml = await enPage.text();
assert.ok(enHtml.includes("A 17-year-old keeper nobody knows yet") && enHtml.includes('lang="en"') && enHtml.includes("Lire en français"));
assert.ok(enHtml.includes("<h2>Reflexes</h2>") && enHtml.includes("Bondy &amp; Yanis") && enHtml.includes('rel="noopener noreferrer"'));
const frHtml = await (await pp.request.get(`${BASE}/articles/${slug}`)).text();
assert.ok(frHtml.includes("Read in English") && /hreflang="en" href="[^"]*\/en\/articles\//i.test(frHtml));
const enHome = await (await pp.request.get(`${BASE}/en`)).text();
assert.ok(enHome.includes("A 17-year-old keeper nobody knows yet") && enHome.includes("Harry Kane crowned the best player in the world"));
assert.ok((await (await pp.request.get(`${BASE}/sitemap.xml`)).text()).includes(`/en/articles/${slug}`));
const enVisual = await pp.request.get(`${BASE}/articles/${slug}/visuel?format=post&lang=en`);
assert.equal(enVisual.status(), 200);
assert.equal(enVisual.headers()["content-type"], "image/png");
await page.goto(`${BASE}/admin/articles/${artId}`);
assert.equal(await page.inputValue("#en-title"), enData.title);
assert.ok((await page.inputValue("#en-text")).includes("## Reflexes") && (await page.inputValue("#en-text")).includes("[Read more](https://example.com)"));
r = await page.request.put(`${BASE}/api/admin/articles/${artId}/english`, { headers: H, data: { ...enData, published: false } });
assert.equal((await pp.request.get(`${BASE}/en/articles/${slug}`)).status(), 404);
assert.equal((await pp.request.get(`${BASE}/articles/${slug}/visuel?lang=en`)).status(), 404);
log("version anglaise : droits serveur, page /en, liens entre langues, hreflang, sitemap, dépublication");

// 8. Programmation d'un second article
const created = await page.request.post(`${BASE}/admin/articles/nouveau`).catch(() => null);
void created;
await page.goto(`${BASE}/admin/articles/nouveau`);
await page.fill("#title", "Le métier d'intendant raconté de l'intérieur");
await page.selectOption("#categoryId", { label: "Métiers du football" });
await page.click("button:has-text('Créer et ouvrir')");
await page.waitForURL(/\/admin\/articles\/\d+$/);
const art2 = Number(page.url().split("/").pop());
await page.request.patch(`${BASE}/api/admin/articles/${art2}`, { headers: H, data: { bodyHtml: "<p>Chaque samedi, Michel lave quarante maillots avant l'aube. Rencontre.</p>" } });
const when = new Date(Date.now() + 65_000).toISOString();
r = await page.request.post(`${BASE}/api/admin/articles/${art2}/status`, { headers: H, data: { to: "scheduled", scheduledAt: when } });
assert.equal(r.status(), 200);
assert.equal((await pp.request.get(`${BASE}/articles/le-metier-d-intendant-raconte-de-l-interieur`)).status(), 404);
log("programmé : invisible avant l'heure");
await new Promise((res) => setTimeout(res, 70_000));
assert.equal((await pp.request.get(`${BASE}/articles/le-metier-d-intendant-raconte-de-l-interieur`)).status(), 200);
log("publié automatiquement à l'heure programmée");

// 9. Correction publique, versions, archivage
r = await page.request.post(`${BASE}/api/admin/articles/${artId}/actions`, { headers: H, data: { action: "correction", body: "Le score était 1-1 et non 2-2." } });
assert.equal(r.status(), 200);
await pp.goto(`${BASE}/articles/${slug}`);
assert.ok(await pp.locator("text=Le score était 1-1").isVisible());
log("correction publique affichée");
r = await page.request.post(`${BASE}/api/admin/articles/${artId}/actions`, { headers: H, data: { action: "duplicate" } });
assert.equal(r.status(), 200);
r = await page.request.post(`${BASE}/api/admin/articles/${artId}/status`, { headers: H, data: { to: "archived" } });
assert.equal(r.status(), 200);
let archived = await pp.request.get(`${BASE}/articles/${slug}`);
assert.equal(archived.status(), 200);
assert.ok((await archived.text()).includes("archive-note"));
r = await page.request.post(`${BASE}/api/admin/articles/${artId}/status`, { headers: H, data: { to: "writing" } });
assert.equal(r.status(), 200);
assert.equal((await pp.request.get(`${BASE}/articles/${slug}`)).status(), 404);
log("duplication + archivage (lien lisible) + retrait du site (404)");

// 9 bis. Publication rapide en un envoi, archivage automatique, refus pour un journaliste
const qpPage = await page.request.get(`${BASE}/admin/articles/publier`);
assert.equal(qpPage.status(), 200);
const catId = Number((await qpPage.text()).match(/<option value="(\d+)">/)[1]);
r = await page.request.post(`${BASE}/api/admin/articles/quick`, { headers: H, data: { action: "publish", categoryId: catId, title: "Publication rapide de test", bodyHtml: "<p>Un texte de test suffisamment long pour être publié.</p>", archiveAt: new Date(Date.now() - 60_000).toISOString() } });
assert.equal(r.status(), 200);
const quick = await r.json();
assert.equal(quick.status, "archived");
assert.equal((await pp.request.get(`${BASE}/articles/${quick.slug}`)).status(), 200);
r = await p2.request.post(`${BASE}/api/admin/articles/quick`, { headers: H, data: { action: "publish", categoryId: catId, title: "Tentative", bodyHtml: "<p>Un texte de test suffisamment long pour être publié.</p>" } });
assert.equal(r.status(), 403);
r = await p2.request.post(`${BASE}/api/admin/articles/quick`, { headers: H, data: { action: "review", categoryId: null, title: "", bodyHtml: "" } });
assert.equal(r.status(), 422);
log("publication rapide, archivage automatique, droits respectés");

// 10. Kanban, calendrier, tableau de bord, audience, réglages se chargent
for (const p of ["/admin", "/admin/articles?vue=kanban", "/admin/articles?vue=calendrier", "/admin/audience", "/admin/reglages", "/admin/contributions", "/admin/rubriques", "/admin/profil", `/admin/apercu/${artId}`]) {
  const res = await page.goto(BASE + p);
  assert.equal(res.status(), 200, p);
}
// Les journalistes n'ont pas accès à l'audience ni aux réglages
await p2.goto(`${BASE}/admin/reglages`);
assert.equal(new URL(p2.url()).pathname, "/admin");
log("écrans du back-office OK, accès restreints respectés");

// 11. Contribution d'un club + newsletter
r = await pp.request.post(`${BASE}/api/contribute`, { headers: H, data: { kind: "resultat", clubName: "AS Bondy U17", contactName: "Karim, éducateur", contactEmail: "k@example.com", title: "Victoire 2-0 contre Montreuil", body: "Buts de Sami et Noah en seconde période.", consent: true } });
assert.equal(r.status(), 200);
r = await pp.request.post(`${BASE}/api/newsletter`, { headers: H, data: { email: "lecteur@example.com", topics: ["talents"] } });
assert.equal(r.status(), 200);
await page.goto(`${BASE}/admin/contributions`);
assert.ok(await page.locator("text=Victoire 2-0 contre Montreuil").isVisible());
log("contribution club modérable + inscription newsletter");

// Mobile
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mob.newPage();
await mp.goto(BASE);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert.ok(overflow <= 1, `débordement horizontal ${overflow}px`);
if (shots) await mp.screenshot({ path: `${shots}/mobile.png`, fullPage: true });
log("mobile sans débordement horizontal");
if (shots) {
  await pp.goto(BASE);
  await pp.screenshot({ path: `${shots}/accueil.png`, fullPage: true });
}

await browser.close();
console.log("\nTous les parcours sont passés.");
