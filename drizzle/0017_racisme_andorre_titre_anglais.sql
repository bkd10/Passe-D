-- Demandé par Tom le 27/10/2026 : citation traduite aussi en anglais (masquée par des astérisques, usage de la presse anglophone).
UPDATE "articles" SET
  "en_title" = '“Dirty f***ing n*****”: a Carroi player reports racist abuse in Andorra',
  "en_body_html" = replace("en_body_html", 'allegedly hurled a vile racial slur at him in Spanish.', 'allegedly called him a “dirty f***ing n*****” (words spoken in Spanish, translated by Passe D).')
WHERE "slug" = 'racisme-en-andorre-eric-fallou-denonce-des-insultes-racistes';
