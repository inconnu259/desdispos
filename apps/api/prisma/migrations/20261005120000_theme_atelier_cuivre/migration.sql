-- Story 35.1 — le thème `medieval-steampunk` devient `atelier-cuivre` (affiché « Atelier Cuivré »).
-- Migration de DONNÉES écrite à la main : `User.theme` est une String? (pas un enum Prisma), le
-- schéma ne change pas. Sans ce rattrapage, un compte ayant choisi l'ancien thème le perdrait
-- silencieusement. Idempotente : relancée, elle ne touche plus aucune ligne. `NULL` (jamais choisi)
-- reste intact.
UPDATE "User" SET "theme" = 'atelier-cuivre' WHERE "theme" = 'medieval-steampunk';
