-- Story 42.1 — instant d'annulation d'un événement de ralliement (AD-9). Colonne nulle par défaut :
-- aucun événement existant n'est annulé (additif, rien à rejouer).
ALTER TABLE "Event" ADD COLUMN "cancelledAt" TIMESTAMP(3);
