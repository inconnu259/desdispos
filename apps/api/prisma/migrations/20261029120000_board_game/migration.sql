-- Story 48.1 — la Ludothèque : un jeu par ligne, propre à une personne (épic 48, AD-1). Table nouvelle,
-- additive ; une seule migration. Deux jeux de même `nameKey` (nom normalisé) sont refusés dans une
-- même Ludothèque ; les lignes disparaissent en cascade avec leur propriétaire.
CREATE TABLE "BoardGame" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "durationMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardGame_ownerId_nameKey_key" ON "BoardGame"("ownerId", "nameKey");

ALTER TABLE "BoardGame" ADD CONSTRAINT "BoardGame_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
