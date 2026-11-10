-- AD-23 (story 33.8) — un Homme Dragon pour plusieurs aventures : le lien passe de
-- HommeDragon.partieId à Partie.hommeDragonId. Migration écrite à la main (aucune production,
-- aucune cérémonie expand/contract). Ordre : colonne + FK + index, garde de doublons, rattrapage,
-- contrôle des orphelins, PUIS SEULEMENT suppression de l'ancien lien.

-- AlterTable
ALTER TABLE "Partie" ADD COLUMN "hommeDragonId" TEXT;

-- CreateIndex
CREATE INDEX "Partie_hommeDragonId_idx" ON "Partie"("hommeDragonId");

-- AddForeignKey
ALTER TABLE "Partie" ADD CONSTRAINT "Partie_hommeDragonId_fkey" FOREIGN KEY ("hommeDragonId") REFERENCES "HommeDragon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garde de doublons : plusieurs Hommes Dragons pour une même partie → échec explicite, jamais un
-- choix arbitraire (une partie ne peut porter qu'un seul lien).
DO $$
DECLARE
  doublons TEXT;
BEGIN
  SELECT string_agg("partieId" || ' (' || n || ' fiches)', ', ')
    INTO doublons
    FROM (
      SELECT "partieId", count(*) AS n
        FROM "HommeDragon"
       GROUP BY "partieId"
      HAVING count(*) > 1
    ) d;
  IF doublons IS NOT NULL THEN
    RAISE EXCEPTION 'Migration AD-23 impossible : plusieurs Hommes Dragons pour une même partie — %. Supprimer les doublons à la main puis relancer.', doublons;
  END IF;
END $$;

-- Rattrapage : chaque fiche est liée à sa partie, à condition que son propriétaire en soit le MJ.
UPDATE "Partie"
   SET "hommeDragonId" = h."id"
  FROM "HommeDragon" h
 WHERE h."partieId" = "Partie"."id"
   AND h."userId" = "Partie"."mjId";

-- Contrôle des orphelins : une fiche qui n'a pas pu être liée (propriétaire ≠ MJ de la partie)
-- ferait perdre son lien en silence → échec explicite.
DO $$
DECLARE
  orphelins TEXT;
BEGIN
  SELECT string_agg(h."id", ', ')
    INTO orphelins
    FROM "HommeDragon" h
   WHERE NOT EXISTS (SELECT 1 FROM "Partie" p WHERE p."hommeDragonId" = h."id");
  IF orphelins IS NOT NULL THEN
    RAISE EXCEPTION 'Migration AD-23 impossible : Hommes Dragons restés sans lien (propriétaire différent du MJ de la partie ?) — %.', orphelins;
  END IF;
END $$;

-- Ancien lien, supprimé seulement une fois le nouveau posé et contrôlé.
-- DropForeignKey
ALTER TABLE "HommeDragon" DROP CONSTRAINT "HommeDragon_partieId_fkey";

-- DropIndex
DROP INDEX "HommeDragon_partieId_idx";

-- DropIndex
DROP INDEX "HommeDragon_userId_partieId_gameSystemId_key";

-- AlterTable
ALTER TABLE "HommeDragon" DROP COLUMN "partieId";
