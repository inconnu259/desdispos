-- Story 49.5 — une Envie de jouer à un jeu, par nom, pour une soirée (épic 49). Table nouvelle, additive ; une
-- seule migration. Au plus une Envie par personne, par nom et par soirée ; les lignes disparaissent en cascade
-- avec l'événement ou la personne.
CREATE TABLE "EventGameEnvy" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventGameEnvy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventGameEnvy_eventId_userId_nameKey_key" ON "EventGameEnvy"("eventId", "userId", "nameKey");

CREATE INDEX "EventGameEnvy_userId_idx" ON "EventGameEnvy"("userId");

ALTER TABLE "EventGameEnvy" ADD CONSTRAINT "EventGameEnvy_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventGameEnvy" ADD CONSTRAINT "EventGameEnvy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
