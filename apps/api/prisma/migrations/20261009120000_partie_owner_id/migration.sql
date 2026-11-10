-- Story 37.2 — `Partie.mjId` devient `ownerId`, le propriétaire générique de la partie (AD-5).
-- Écrite à la main : un RENAME conserve les données (Prisma génèrerait un DROP + ADD, qui les
-- perdrait). La colonne devient nullable et sa clé étrangère passe en ON DELETE SET NULL : la
-- suppression du compte propriétaire laisse désormais la partie en place, sans propriétaire.

-- Clé étrangère d'origine (ON DELETE CASCADE), retirée avant le renommage.
ALTER TABLE "Partie" DROP CONSTRAINT "Partie_mjId_fkey";

-- Renommage de la colonne : chaque partie garde son ancien `mjId` comme `ownerId`.
ALTER TABLE "Partie" RENAME COLUMN "mjId" TO "ownerId";

-- Propriétaire facultatif.
ALTER TABLE "Partie" ALTER COLUMN "ownerId" DROP NOT NULL;

-- Clé étrangère recréée sous son nouveau nom, en SET NULL.
ALTER TABLE "Partie" ADD CONSTRAINT "Partie_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
