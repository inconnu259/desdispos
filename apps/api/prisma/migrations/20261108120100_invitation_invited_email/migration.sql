-- Revue de sécurité 2026-11 : une invitation partie d'une adresse e-mail ne révèle plus à l'invitant
-- le pseudo du compte correspondant tant qu'elle n'est pas acceptée.
ALTER TABLE "Invitation" ADD COLUMN "invitedEmail" TEXT;
