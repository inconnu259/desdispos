-- Story 49.4 — un jeu de l'hôte écarté pour une soirée (épic 49). Table nouvelle, additive ; une seule
-- migration. Au plus une ligne par jeu et par soirée ; les lignes disparaissent en cascade avec l'événement
-- ou le jeu.
CREATE TABLE "EventGameExcluded" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "boardGameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventGameExcluded_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventGameExcluded_eventId_boardGameId_key" ON "EventGameExcluded"("eventId", "boardGameId");

CREATE INDEX "EventGameExcluded_boardGameId_idx" ON "EventGameExcluded"("boardGameId");

ALTER TABLE "EventGameExcluded" ADD CONSTRAINT "EventGameExcluded_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventGameExcluded" ADD CONSTRAINT "EventGameExcluded_boardGameId_fkey" FOREIGN KEY ("boardGameId") REFERENCES "BoardGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
