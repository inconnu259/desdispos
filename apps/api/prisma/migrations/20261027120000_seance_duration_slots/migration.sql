-- Story 47.1 : durée d'un rendez-vous, en créneaux enchaînés (1 par défaut : toute séance existante dure un créneau).
ALTER TABLE "Seance" ADD COLUMN "durationSlots" INTEGER NOT NULL DEFAULT 1;
