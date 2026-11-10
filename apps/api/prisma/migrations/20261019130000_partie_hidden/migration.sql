-- Story 42.5 — « Retirer de ma liste » : masquage définitif, par utilisateur, d'une partie terminée ou
-- annulée (AD-10). Table nouvelle, additive ; supprimée en cascade avec l'utilisateur ou la partie.
CREATE TABLE "PartieHidden" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartieHidden_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartieHidden_userId_partieId_key" ON "PartieHidden"("userId", "partieId");

CREATE INDEX "PartieHidden_partieId_idx" ON "PartieHidden"("partieId");

ALTER TABLE "PartieHidden" ADD CONSTRAINT "PartieHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartieHidden" ADD CONSTRAINT "PartieHidden_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
