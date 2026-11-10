-- Story 37.3 — extraction de l'événement de base (AD-3) : chaque `Scenario` existant reçoit un
-- `Event` du MÊME identifiant, qui porte désormais `partieId`, `title`, `description` et
-- `createdAt` ; le scénario devient son extension JDR 1:1 (clé primaire = `Event.id`).
-- `Seance.scenarioId` devient `eventId` (mêmes valeurs). Écrite à la main : Prisma génèrerait des
-- DROP + ADD qui perdraient les données. `ScenarioDocument`, `ScenarioParticipant`,
-- `Announcement` et `CharacterNote` continuent de pointer `Scenario.id` — valeurs inchangées.

-- 1. Table de l'événement de base.
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- 2. Un événement par scénario, même identifiant ; le propriétaire est celui de la partie.
INSERT INTO "Event" ("id", "partieId", "title", "description", "ownerId", "createdAt")
SELECT s."id", s."partieId", s."title", s."description", p."ownerId", s."createdAt"
FROM "Scenario" s
JOIN "Partie" p ON p."id" = s."partieId";

CREATE INDEX "Event_partieId_idx" ON "Event"("partieId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Les séances se rattachent à l'événement : renommage (données conservées) puis nouvelle FK.
ALTER TABLE "Seance" DROP CONSTRAINT "Seance_scenarioId_fkey";

ALTER TABLE "Seance" RENAME COLUMN "scenarioId" TO "eventId";

ALTER TABLE "Seance" ADD CONSTRAINT "Seance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Le scénario devient l'extension de l'événement : colonnes déplacées retirées, ancien index
--    et ancienne FK vers la partie supprimés, clé primaire rattachée à `Event.id`.
ALTER TABLE "Scenario" DROP CONSTRAINT "Scenario_partieId_fkey";

DROP INDEX "Scenario_partieId_status_idx";

ALTER TABLE "Scenario" DROP COLUMN "partieId",
DROP COLUMN "title",
DROP COLUMN "description",
DROP COLUMN "createdAt";

CREATE INDEX "Scenario_status_idx" ON "Scenario"("status");

ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
