-- Story 37.4 — la date d'une séance devient une plage continue, seule source (AD-4). Jusqu'ici
-- elle vivait soit sur le vote choisi (`SessionPoll.chosenDate/chosenSlot`), soit dans
-- `Seance.dateValidee` (sans créneau). Écrite à la main pour préserver les données : ajout des
-- colonnes, remplissage depuis le vote choisi, sinon depuis `dateValidee` (créneau vide),
-- `end = start`, puis suppression de `dateValidee`.

-- 1. Colonnes de la plage.
ALTER TABLE "Seance" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "startSlot" "DaySlot",
ADD COLUMN "endDate" TIMESTAMP(3),
ADD COLUMN "endSlot" "DaySlot";

-- 2. Date issue d'un vote choisi : prioritaire, comme la lecture `poll.chosenDate ?? dateValidee`.
UPDATE "Seance" s
SET "startDate" = p."chosenDate",
    "startSlot" = p."chosenSlot",
    "endDate"   = p."chosenDate",
    "endSlot"   = p."chosenSlot"
FROM "SessionPoll" p
WHERE p."id" = s."pollId"
  AND p."chosenDate" IS NOT NULL;

-- 3. Sinon, date posée directement (`dateValidee`), sans créneau.
UPDATE "Seance"
SET "startDate" = "dateValidee",
    "endDate"   = "dateValidee"
WHERE "startDate" IS NULL
  AND "dateValidee" IS NOT NULL;

-- 4. L'ancienne colonne disparaît : la plage est la seule source.
ALTER TABLE "Seance" DROP COLUMN "dateValidee";
