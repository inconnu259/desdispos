-- Story 37.9 — le rappel de la veille devient par séance (AD-12). Jusqu'ici `Partie.reminderSentAt`
-- était indexé sur `Partie.nextSessionDate` : une campagne à plusieurs séances datées ne rappelait
-- que la première. Écrite à la main pour qu'aucun rappel ne soit renvoyé après le déploiement :
-- ajout de la colonne sur la séance, report de l'horodatage des parties déjà rappelées sur les
-- séances dont la plage commence à `nextSessionDate`/`nextSessionSlot`, puis suppression de
-- l'ancienne colonne.
--
-- Limites assumées du report (deux effets à connaître) :
--   (i) seule(s) la/les séance(s) qui commence(nt) à `nextSessionDate`/`nextSessionSlot` héritent de
--       l'ancien horodatage ; une autre séance de la même partie dans la fenêtre de 24 h — y compris
--       le même jour sur un autre créneau — recevra son premier rappel au premier passage après le
--       déploiement ;
--  (ii) une partie dont `nextSessionDate` ne correspond plus à aucune séance perd son état
--       « déjà rappelée ».

-- 1. Colonne du rappel sur la séance.
ALTER TABLE "Seance" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- 2. Report : toute séance dont le début est celui de la prochaine séance d'une partie déjà
--    rappelée porte l'horodatage (comparaison du créneau sans tenir compte de NULL).
UPDATE "Seance" s
SET "reminderSentAt" = p."reminderSentAt"
FROM "Event" e
JOIN "Partie" p ON p."id" = e."partieId"
WHERE e."id" = s."eventId"
  AND p."reminderSentAt" IS NOT NULL
  AND s."startDate" = p."nextSessionDate"
  AND s."startSlot" IS NOT DISTINCT FROM p."nextSessionSlot";

-- 3. L'ancienne colonne disparaît : la séance est la seule source.
ALTER TABLE "Partie" DROP COLUMN "reminderSentAt";
