// Vérifie la publication rapide de bout en bout et prend les captures.
import { chromium } from "playwright";
const BASE = "http://localhost:3000", OUT = "/tmp/claude-0/demo/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1750 }, colorScheme: "light", locale: "fr-FR", timezoneId: "Europe/Paris" });
const p = await ctx.newPage();
p.on("dialog", (d) => d.dismiss());
await p.goto(`${BASE}/admin/login`);
await p.fill("#email", "tom@example.com"); await p.fill("#password", "motdepasse123");
await p.click("button:has-text('Se connecter')"); await p.waitForURL(`${BASE}/admin`);
await p.goto(`${BASE}/admin/articles/publier`, { waitUntil: "networkidle" });
await p.screenshot({ path: `${OUT}/publier-vide.jpg`, type: "jpeg", quality: 75, fullPage: false });
await p.selectOption("#qp-cat", { label: "Football amateur" }).catch(async () => p.selectOption("#qp-cat", { index: 1 }));
await p.fill("#qp-title", "Le FC Montreuil remporte le derby après une fin de match folle");
await p.fill("#qp-dek", "Menés 1-0 à la 85e minute, les Montreuillois ont renversé la rencontre devant 400 spectateurs.");
await p.click("button.cover-pick");
await p.waitForSelector(".modal .media-item");
await p.locator(".modal .media-item").first().click();
await p.fill("#qp-video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"); await p.locator("#qp-title").click();
await p.locator(".qp-editor .ProseMirror").click();
await p.keyboard.type("Il y avait du monde au stade Robert-Barran ce dimanche. Le derby a tenu toutes ses promesses, avec un scénario que personne n'avait vu venir.");
await p.keyboard.press("Enter");
await p.keyboard.type("Texte de démonstration : les noms et le score sont fictifs.");
await p.selectOption("#qp-archive", "30");
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/publier-rempli.jpg`, type: "jpeg", quality: 75, fullPage: false });
await p.click("button:has-text('Publier maintenant')");
await p.waitForSelector(".qp-done", { timeout: 20000 });
await p.screenshot({ path: `${OUT}/publier-ok.jpg`, type: "jpeg", quality: 75 });
const href = await p.locator(".qp-done a:has-text('Voir sur le site')").getAttribute("href");
const slug = href.split("/articles/")[1];
const pub = await ctx.newPage();
const r = await pub.goto(`${BASE}/articles/${slug}`, { waitUntil: "networkidle" });
console.log("article", r.status(), await pub.locator("h1.headline").textContent(), "video:", await pub.locator(".video-embed iframe").count(), "author:", await pub.locator(".byline").first().textContent());
// Archivage automatique : date déjà passée → archivé tout de suite
const res = await p.evaluate(async () => {
  const cats = [...document.querySelectorAll("#qp-cat option")];
  return fetch("/api/admin/articles/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", categoryId: 1, title: "Test archivage automatique", bodyHtml: "<p>Un texte assez long pour être publié sans problème.</p>", archiveAt: new Date(Date.now() - 60000).toISOString() }) }).then((r) => r.json());
});
console.log("quick", JSON.stringify(res));
await new Promise((r) => setTimeout(r, 21000));
const home = await (await fetch(BASE + "/")).text();
const art = await fetch(`${BASE}/articles/${res.slug}`);
const html = await art.text();
console.log("archive: on home?", home.includes("Test archivage automatique"), "| url", art.status, "| notice", html.includes("archive-note"));
for (const id of [res.id, Number((await p.locator(".qp-done a:has-text('éditeur')").getAttribute("href").catch(() => "")).split("/").pop())]) {
  if (id) console.log("delete", id, await p.evaluate((i) => fetch(`/api/admin/articles/${i}`, { method: "DELETE" }).then((r) => r.status), id));
}
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, colorScheme: "light", locale: "fr-FR", storageState: await ctx.storageState() });
const mp = await m.newPage();
await mp.goto(`${BASE}/admin/articles/publier`, { waitUntil: "networkidle" });
await mp.screenshot({ path: `${OUT}/publier-mobile.jpg`, type: "jpeg", quality: 75 });
await b.close();
