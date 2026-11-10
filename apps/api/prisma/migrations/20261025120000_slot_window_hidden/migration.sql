-- Story 46.4 — « Masquer » une fenêtre de l'automate : masquage par MJ et par partie, clé naturelle de la
-- fenêtre servie (jour, créneau de départ, durée en créneaux). Table nouvelle, additive ; supprimée en cascade avec
-- l'utilisateur ou la partie. Seul `parties/` l'écrit.
-- CreateTable
CREATE TABLE "SlotWindowHidden" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startSlot" "DaySlot" NOT NULL,
    "durationSlots" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotWindowHidden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotWindowHidden_partieId_idx" ON "SlotWindowHidden"("partieId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotWindowHidden_key" ON "SlotWindowHidden"("userId", "partieId", "date", "startSlot", "durationSlots");

-- AddForeignKey
ALTER TABLE "SlotWindowHidden" ADD CONSTRAINT "SlotWindowHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotWindowHidden" ADD CONSTRAINT "SlotWindowHidden_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
