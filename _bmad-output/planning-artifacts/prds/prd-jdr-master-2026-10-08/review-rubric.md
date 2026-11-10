# PRD Quality Review — Palier 10 : Soirées entre amis

*Revue faite en ligne par l'agent principal (pas de sous-agent), enjeux « perso ». Les findings ci-dessous ont été corrigés dans `prd.md` avant clôture.*

## Overall verdict
PRD solide pour un projet perso : une thèse claire (le mode soirée est la base, le JDR en est une spécialisation, précédé d'un refactor à comportement constant), des décisions du forge reprises sans être rouvertes, des FR testables. Le risque principal est connu et assumé : la suppression du dernier admin détruit un groupe entier.

## Decision-readiness — strong
Les décisions sont énoncées comme telles (admins multiples, dernier admin = suppression du groupe, pas de liste d'attente). Les arbitrages sont nommés dans l'addendum §4 (refactor contre ajout parallèle, Doodle).
- **low** Rôles qui se cumulent (§4.5, matrice) — la matrice mélangeait des colonnes de rôles qui se chevauchent. *Fix appliqué :* phrase d'explication au-dessus du tableau.

## Substance over theater — strong
Pas de persona ornementale (3 UJ, chacun pilote des FR). Pas de NFR boilerplate : les NFR citent `RealtimeService`, `docs/security.md`, 4–20 membres.

## Strategic coherence — strong
Un fil unique : les FR 1–12 servent la soirée, FR-13/14 en sont la porte. SM-1 valide l'usage réel, SM-2 le non-régression, avec deux contre-métriques.

## Done-ness clarity — adequate → corrigé
- **medium** FR-10 « dispos exploitées comme base du sondage » (§4.3) — non testable. *Fix appliqué :* chaque créneau affiche combien d'inscrits sont disponibles.
- **medium** FR-9 : le sens d'« inscription » en participation « tous » était indéfini. *Fix appliqué :* s'inscrire = confirmer sa venue, sans limite.
- **medium** Annulation/modification d'un événement présente seulement dans la matrice, sans FR. *Fix appliqué :* conséquence dans FR-8.
- **medium** Soirée isolée : qui vote n'était pas dit (FR-11). *Fix appliqué.*

## Scope honesty — strong
Non-Goals explicites (9), 5 hypothèses indexées, aucune question bloquante. Le NOTE FOR PM sur FR-7 nomme le vrai risque.

## Downstream usability — adequate → corrigé
- **medium** « Partie » est utilisé (FR-13) sans être défini. *Fix appliqué :* entrée au Glossaire.
- Le PRD n'écrit pas l'interface : `bmad-ux` est à lancer pour les écrans (création avec choix du mode, fenêtre de suppression, états « complet »).

## Shape fit — strong
Brownfield : les références au code (`mjId`, AD-4, `RealtimeService`) ont été vérifiées dans le dépôt le 2026-10-08.

## Mechanical notes
- FR-1 à FR-15 contigus ; UJ-1 à UJ-3 nommés ; SM-1 à SM-3, SM-C1/C2.
- Index des hypothèses : toutes les balises `[ASSUMPTION]` du texte y figurent (FR-3, FR-6 ×2, FR-8, FR-9, FR-14).
- Addendum : « treize fichiers » aligné sur le « 13 services » de la Vision.
- Langue du document : français (convention du dépôt), alors que `document_output_language` vaut English.
