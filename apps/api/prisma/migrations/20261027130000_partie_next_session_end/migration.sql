-- Story 47.2 : fin de la prochaine séance (plage de plusieurs créneaux), écrite avec nextSessionDate/Slot par events/. Additive, nullable.
ALTER TABLE "Partie" ADD COLUMN "nextSessionEndDate" TIMESTAMP(3),
ADD COLUMN "nextSessionEndSlot" "DaySlot";
