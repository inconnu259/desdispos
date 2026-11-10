-- Revue de sécurité 2026-11 : les adresses e-mail sont désormais stockées et comparées en minuscules
-- (inscription, connexion, mot de passe oublié). Les comptes existants sont alignés.
-- Échoue volontairement (contrainte d'unicité) si deux comptes ne diffèrent que par la casse : à
-- départager à la main avant de rejouer la migration, aucun choix automatique n'est sûr.
UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
UPDATE "InviteLink" SET "targetEmail" = lower(trim("targetEmail"))
  WHERE "targetEmail" IS NOT NULL AND "targetEmail" <> lower(trim("targetEmail"));
