-- Story 38.2 — rôle d'un membre de partie (`ADMIN` | `MEMBER`). Écrite à la main : le défaut
-- `MEMBER` remplit les lignes existantes (tous les membres actuels sont des joueurs de JDR).
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'MEMBER');

ALTER TABLE "Membership" ADD COLUMN "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER';
