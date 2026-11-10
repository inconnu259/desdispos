-- Story 40.7 — instant d'envoi de la relance de vote de la veille de l'échéance (e-mail #6). Colonne
-- nulle par défaut : aucun sondage existant n'a encore été relancé (additif, rien à rejouer).
ALTER TABLE "SessionPoll" ADD COLUMN "relanceSentAt" TIMESTAMP(3);
