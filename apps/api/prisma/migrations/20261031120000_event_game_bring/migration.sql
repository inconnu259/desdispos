-- Story 49.2 — un jeu apporté à une soirée par un participant (épic 49). Table nouvelle, additive ; une seule
-- migration. Au plus un apport par jeu et par soirée ; les lignes disparaissent en cascade avec l'événement,
-- le jeu ou la personne.
CREATE TABLE "EventGameBring" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "boardGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventGameBring_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventGameBring_eventId_boardGameId_key" ON "EventGameBring"("eventId", "boardGameId");

CREATE INDEX "EventGameBring_boardGameId_idx" ON "EventGameBring"("boardGameId");

CREATE INDEX "EventGameBring_userId_idx" ON "EventGameBring"("userId");

ALTER TABLE "EventGameBring" ADD CONSTRAINT "EventGameBring_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventGameBring" ADD CONSTRAINT "EventGameBring_boardGameId_fkey" FOREIGN KEY ("boardGameId") REFERENCES "BoardGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventGameBring" ADD CONSTRAINT "EventGameBring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
