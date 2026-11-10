-- Story 40.4 — statut d'une inscription (`RESERVED` | `CONFIRMED`). Écrite à la main : le défaut
-- `CONFIRMED` remplit les lignes existantes (toutes les inscriptions actuelles sont confirmées, y
-- compris celles du JDR, qui ne connaît pas la réservation).
CREATE TYPE "InscriptionStatus" AS ENUM ('RESERVED', 'CONFIRMED');

ALTER TABLE "Inscription" ADD COLUMN "status" "InscriptionStatus" NOT NULL DEFAULT 'CONFIRMED';
