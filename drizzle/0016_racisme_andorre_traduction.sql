-- Demandé par Tom le 27/10/2026 : l'insulte a été prononcée en espagnol (mots exacts inconnus) ; la citation française est une traduction, signalée comme telle.
UPDATE "articles" SET
  "body_html" = replace("body_html", 'l''aurait traité de « sale nègre de merde ».', 'l''aurait traité de « sale nègre de merde » (des propos tenus en espagnol, traduits par la rédaction).'),
  "en_title" = 'A Carroi player reports racist abuse in Andorra',
  "en_body_html" = replace("en_body_html", 'allegedly called him a “sale nègre de merde”, a vile racial slur.', 'allegedly hurled a vile racial slur at him in Spanish.'),
  "updated_content_at" = now()
WHERE "slug" = 'racisme-en-andorre-eric-fallou-denonce-des-insultes-racistes';
