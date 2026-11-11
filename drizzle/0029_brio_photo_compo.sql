-- Demandé par Tom le 11/11/2026 : photo du vestiaire en couverture + image de la compo dans l'article Brio Youth Academy (fichiers dans public/medias/).
INSERT INTO "media" ("url", "storage_key", "kind", "mime", "filename", "size", "width", "height", "alt", "caption", "credit", "folder")
SELECT '/medias/brio-u17-mifa-photo.jpg', 'public/medias/brio-u17-mifa-photo.jpg', 'image', 'image/jpeg', 'brio-u17-mifa-photo.jpg', 280945, 1170, 1560, 'Les U17 de la Brio Youth Academy dans le vestiaire après la victoire contre la MIFA', 'Les U17 de la Brio Youth Academy après le match', 'Brio Youth Academy', 'brio-youth-academy'
WHERE NOT EXISTS (SELECT 1 FROM "media" WHERE "url" = '/medias/brio-u17-mifa-photo.jpg');
--> statement-breakpoint
UPDATE "articles" SET
  "cover_id" = (SELECT "id" FROM "media" WHERE "url" = '/medias/brio-u17-mifa-photo.jpg' ORDER BY "id" LIMIT 1),
  "body_html" = replace("body_html", '<h2>La Brio Youth Academy, c''est quoi ?</h2>', '<figure><img src="/medias/brio-u17-mifa-compo.jpg" alt="Composition de départ des U17 de la Brio Youth Academy en 4-2-1-3" width="1178" height="1268" loading="lazy" /><figcaption>La composition de départ des U17 de la Brio Youth Academy.</figcaption></figure><h2>La Brio Youth Academy, c''est quoi ?</h2>'),
  "en_body_html" = replace("en_body_html", '<h2>What is Brio Youth Academy?</h2>', '<figure><img src="/medias/brio-u17-mifa-compo.jpg" alt="Brio Youth Academy U17 starting line-up in a 4-2-1-3" width="1178" height="1268" loading="lazy" /><figcaption>Brio Youth Academy U17 starting line-up.</figcaption></figure><h2>What is Brio Youth Academy?</h2>'),
  "updated_content_at" = now()
WHERE "slug" = 'u17-match-de-prestige-et-victoire-de-la-brio-youth-academy-face-a-la-mifa-du-fc-metz';
