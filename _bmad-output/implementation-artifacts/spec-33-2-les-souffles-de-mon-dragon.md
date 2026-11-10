---
title: 'Les souffles de mon dragon'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/docs/dragons.md']
baseline_commit: '9a3d68c67a38237a9d9629c7dacedc2e36a51245'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aucun souffle n'existe dans l'application. Les 6 entrées de `eveil-powers.json` sont des **éveils** (et le restent) : la Q-13, qui les prenait pour les souffles communs, reposait sur une confusion, levée le 2026-09-25 par la transcription des règles (`docs/dragons.md`). Le MJ ne peut donc pas consulter en séance les souffles dont son dragon dispose.

**Approach:** Créer un catalogue `souffle` (`souffles.json`) portant les **21 souffles réels** du livre — 9 communs répartis en trois familles (temps, destin, PNJ) et 3 par race — dont les mécaniques viennent de `docs/dragons.md`, textes reformulés (NFR4 révisée le 2026-09-25), sans aucune mécanique inventée. La fiche gagne une section « Souffles » en lecture seule : les communs et ceux de la race du dragon ; à partir du niveau 3 (souffles multicolores), ceux des trois autres races en plus, dans un bloc replié. Chaque souffle montre son coût et sa description via la surface de détail.

## Boundaries & Constraints

**Always:**
- Contenu = reformulation fidèle de `docs/dragons.md` : libellés conservés, textes d'effet réécrits dans une formulation propre au projet, chaque chiffre, condition et moment d'usage conservé à l'identique (décision utilisateur du 2026-09-25, NFR4 révisée). Aucun souffle ni aucune mécanique inventés.
- Forme d'une entrée : `{ key, label, description, ps, race?, famille?, reservable? }`. `race` (`DRAGON_VERT`/`DRAGON_BLEU`/`DRAGON_ROUGE`/`DRAGON_NOIR`) est absent sur les communs ; `famille` (`temps`/`destin`/`pnj`) n'existe que sur les communs. `ps` vaut 1, sauf 2 pour les souffles du temps, qui portent aussi `reservable: false` (règle : ils ne peuvent pas être mis en réserve).
- Coût affiché : « 1 PS » ou « 2 PS » ; les souffles non réservables portent en plus la mention « non réservable ». Les communs sont groupés par famille, avec pour chacune son libellé et sa consigne d'usage du livre (ex. destin : « à utiliser juste avant ou après un jet de dés »).
- Visibilité selon `hommeDragon().derived.level` : en dessous de 3, communs + race du dragon ; à 3 et au-delà, en plus un bloc replié (`<details>`) « Souffles des autres races », groupé par race.
- Description consultable via `DetailSurface`/`createDetailSurfaceHost()`/`detailContent()` déjà injectés (patron Story 33.1). Libellé : repli sur la clé brute si le catalogue est incomplet.
- Enregistrement par une entrée `CONTENT_TYPES` (`game-system.service.ts`), sans endpoint dédié ni garde runtime sur la complétude du catalogue.

**Never:**
- Ne pas toucher `eveil-powers.json`, le choix de pouvoir d'éveil au level-up (`chooseEveilPower()`, `pendingEveilLevels`, `eveilPowersForCurrentLevel()`) ni les sections « Pouvoir d'éveil à choisir » / « Pouvoirs d'éveil ».
- Pas de réserve, de décompte ni de consommation (ni modèle, ni DTO, ni Prisma) : la réserve fait l'objet d'une story dédiée (décision du 2026-09-25).
- Ne pas modifier le calcul du niveau (écart séances/scénarios consigné à part) ni `DetailSurface`, `detail-surface-host.ts`, `character.util.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dragon niveau 1-2 | race `DRAGON_VERT`, niveau 2 | 9 communs groupés par famille + Nostalgie, Route, Voyage ; aucun souffle d'une autre race, pas de bloc « autres races » | N/A |
| Dragon niveau ≥ 3 | race `DRAGON_ROUGE`, niveau 3 | communs + Défi, Courage, Renaissance ; bloc replié avec les souffles vert, bleu et noir, groupés par race | N/A |
| Souffle du temps | Passé / Futur | « 2 PS » et mention « non réservable » | N/A |
| Autre souffle | ex. Chance | « 1 PS », sans mention | N/A |
| Race sans souffle au catalogue | 0 entrée pour cette race | communs seuls, aucune erreur | N/A |
| Souffle sans `description` | champ absent | libellé en texte simple, pas de déclencheur | N/A |

</frozen-after-approval>

## Code Map

- `docs/dragons.md` -- source unique du contenu : sections « Dragon vert/rouge/bleu/noir → Souffles » et « Souffles → Souffles communs » (trois familles et leurs consignes).
- `apps/api/game-systems/ryuutama/data/souffles.json` -- existe déjà mais porte 8 souffles **inventés** : le remplacer intégralement. Fichier nouveau et suivi par git (non ignoré), à ajouter au commit.
- `apps/api/game-systems/ryuutama/data/eveil-powers.json` -- éveils, ne pas modifier.
- `apps/api/src/game-systems/game-system.service.ts` -- l'entrée `{ key: 'souffle', label: 'Souffle (Homme Dragon)', file: 'souffles.json' }` est déjà ajoutée à `CONTENT_TYPES` ; rien d'autre.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` -- un premier jet (`souffleCatalog`, `availableSouffles`, `souffleLabel/Cost/Detail`) existe mais fusionne à tort `eveilPowerCatalog` : `availableSouffles` ne doit lire que `souffleCatalog`. Structurer en communs par famille / race du dragon / autres races (si niveau ≥ 3). `RACE_LABELS` (L27) sert aux libellés de race ; ajouter à côté une constante des trois familles (libellé + consigne), même patron.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` -- section `homme-dragon-sheet__souffles` déjà amorcée après « Pouvoirs d'éveil » : la réorganiser (groupes, bloc `<details>`, mention « non réservable »). Coût en `stat-pill` comme aujourd'hui.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts` -- `describe('Souffles (Story 33.2)')` existe avec une fixture `souffle` inventée : la réaligner sur la nouvelle forme et couvrir chaque ligne de la matrice. Le test « le choix au level-up reste inchangé » est à garder. `makeDto()` accepte `derived` pour fixer le niveau.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/game-systems/ryuutama/data/souffles.json` -- Remplacer par les 21 souffles transcrits de `docs/dragons.md` sous la forme décrite -- AC1.
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` -- Ne plus fusionner les éveils ; exposer communs par famille, souffles de la race, autres races selon le niveau ; coût et mention non réservable -- AC2/AC3.
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` -- Groupes par famille, bloc replié « Souffles des autres races » à partir du niveau 3 -- AC2/AC3.
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts` -- Réaligner la fixture, un test par ligne de la matrice -- matrice I/O.

**Acceptance Criteria:**
- Given le catalogue seedé, when on le compare à `docs/dragons.md`, then il contient exactement les 9 communs et les 12 souffles de race, avec leurs mécaniques.
- Given un Homme Dragon, when sa fiche est ouverte, then la section Souffles suit la matrice de visibilité selon sa race et son niveau.
- Given un souffle affiché, when on l'active, then sa description s'ouvre dans la surface de détail, sans quitter la fiche.
- Given le choix de pouvoir d'éveil au level-up, when la story est livrée, then aucun souffle n'y est proposé.

## Implementation Notes

- Premier passage (2026-09-23) : implémentation sur l'hypothèse de la Q-13 (éveils = souffles communs) et un `souffles.json` inventé faute de source. Tous deux invalidés le 2026-09-25 ; voir le Spec Change Log.
- Second passage (2026-09-25) : 21 souffles transcrits (vérifiés mot pour mot contre `docs/dragons.md`), fusion avec les éveils retirée, groupes par famille / race / autres races à partir du niveau 3. Ajout hors Code Map : styles dans `homme-dragon-sheet.scss`.
- Hors périmètre de la story, à la demande explicite de l'utilisateur (2026-09-25, « faire dès maintenant les autres JSON ») : ajout d'un champ `famille` (`deplacement`/`combat`) à `eveil-powers.json` (additif, aucun consommateur encore), coquille corrigée dans `homme-dragon-artefacts.json`, et quatre nouveaux fichiers de contenu **non enregistrés** dans `CONTENT_TYPES` (inertes au seed) : `homme-dragon-races.json`, `homme-dragon-creation-intros.json`, `homme-dragon-level-capacities.json`, `souffles-rituels.json`. La revue ne doit pas les traiter comme une violation du « Never » : ils relèvent des stories 33.3 et suivantes.
- Vérification (2026-09-25, Docker relancé) : web `homme-dragon-sheet.spec.ts` 46/46 ; API 1394/1396, les 2 échecs sont les préexistants connus (`party-signals.service.spec.ts`, `parties.service.spec.ts`, dates figées). Les 6 lignes de la matrice ont chacune un test qui a tourné et passé.
- Base de dev contrôlée (2026-09-25) : le content-type `souffle` contient exactement les 21 clés réelles, aucun souffle inventé — pas de nettoyage nécessaire. Le seed reste en upsert sans suppression (comportement préexistant).
- Revue (2026-09-25) : la reformulation couvre tout le contenu Homme Dragon, donc aussi les descriptions des 6 éveils et des 12 artefacts (pas seulement le champ `famille` et la coquille annoncés plus haut). Correctifs de revue : test de contrat sur `souffles.json`, chiffres de PS dans `augmentation-du-souffle`, trois formulations resserrées (Anneau, Rituel de l'improvisation, Rituel du sommeil), phrase de `docs/backlog.md`.

## Spec Change Log

- 2026-09-25 — renégociation humaine de l'intention figée. Déclencheur : l'utilisateur a fourni les règles (`docs/dragons.md`), qui montrent que `eveil-powers.json` contient des éveils et que les 21 souffles réels étaient absents. Modifié : catalogue = 21 souffles transcrits (plus aucune fusion avec les éveils), coût 1 PS / 2 PS avec `reservable`, communs groupés par famille, souffles des autres races visibles à partir du niveau 3 (décision utilisateur), réserve renvoyée à une story dédiée (décision utilisateur). État évité : un catalogue inventé livré comme règle officielle et des éveils affichés comme souffles. KEEP : l'entrée `CONTENT_TYPES`, l'usage de `DetailSurface`, le test de non-régression du choix au level-up.

- 2026-09-25 (2) — renégociation humaine : les textes ne sont plus transcrits mot pour mot mais reformulés, mécaniques conservées (droit d'auteur ; JSON désormais versionnés, NFR4 révisée). Modifié : la règle « transcription fidèle » du bloc figé et l'AC1 (« textes » → « mécaniques »). KEEP : libellés, familles, coûts, `reservable`.

## Review Triage Log

Revue du 2026-09-25 (diff limité à `apps/`, `packages/`, `docs/` ; artefacts de planification exclus).

- **[verification-gap] Aucun test ne vérifie le vrai `souffles.json` contre la forme lue par la fiche** — `medium` (pré-vérifié) : une coquille (`"PNJ"`, espace dans une race, `reservable` retiré) masquerait des souffles sans qu'aucun test échoue → `patch` (spec Jest API sur le fichier réel).
- **[blind-hunter] Idem : AC1 contrôlé seulement à la main** — même cause que le précédent, regroupé → `patch`.
- **[blind-hunter] `docs/dragons.md` reste une transcription quasi littérale, versionnée** — `high` au regard de l'objectif utilisateur (textes reformulés pour versionner) ; hors code de la story, décision humaine (reformuler ou sortir du dépôt) → remonté à l'utilisateur.
- **[blind-hunter] `docs/dragons.md` sans en-tête sur sa nature** — même cause que le précédent, regroupé.
- **[blind-hunter] `docs/backlog.md` : « contenu propriétaire hors repo » juste sous la ligne modifiée** — `low`, correction directe → `patch` (appliqué). Les mentions dans `epics-p1-p3-ryuutama.md` et `epics-palier8.md` sont historiques ; renvoyées à `bmad-correct-course`.
- **[blind-hunter] `augmentation-du-souffle` perd les valeurs 5 PS / 10 PS** — `low`, correction directe → `patch` (appliqué).
- **[blind-hunter] Reformulations qui déplacent le sens : Anneau (« guide », « maîtres et disciples »), improvisation (obligation affaiblie), sommeil (« à la table » ajouté)** — `low`, corrections directes → `patch` (appliqué).
- **[blind-hunter] Rituel de la guigne : « l'objet » interprété comme la peau de banane** — `false` : l'utilisateur a confirmé que l'objet est la peau de banane (2026-09-25).
- **[blind-hunter] / [verification-gap] Réécriture des 6 éveils et 12 artefacts non tracée par la spec** — le fix serait d'éditer la spec du build → rejeté par la règle de tri ; la réécriture découle de la décision utilisateur de reformuler tout le contenu Homme Dragon (Implementation Notes complétées).
- **[blind-hunter] README du seed : `souffles.json` absent de la liste (5 fichiers listés sur 20+)** — `low`, préexistant (la liste était déjà incomplète) → `defer`.
- **[edge-case-hunter] Idem, le README pointé par l'erreur de bootstrap ne cite pas `souffles.json`** — même cause, regroupé → `defer`.
- **[blind-hunter] Libellés/consignes des familles codés en dur (`SOUFFLE_FAMILLE_INFO`) et `RACE_LABELS` en doublon de `homme-dragon-races.json`** — `low` : composant propre à Ryuutama, même patron que `RACE_LABELS` préexistant, choix acté par la spec ; `homme-dragon-races.json` n'est consommé par rien avant la 33.3 ; le fix (nouveau catalogue) dépasse une correction directe → rejeté.
- **[blind-hunter] Règle « un seul souffle d'une autre race en réserve » non affichée** — `low`, la réserve est exclue de l'intention (story dédiée) → rejeté, rattaché à l'item réserve de `deferred-work.md`.
- **[blind-hunter] Souffles du temps : « 2 PS / non réservable » dit deux fois (consigne + ligne)** — `low`, redondance voulue par la spec (consigne du livre + mention par souffle), inoffensive → rejeté.
- **[blind-hunter] Souffles inventés possiblement présents dans d'autres bases** — `false` : le premier `souffles.json` n'a jamais été commité ni poussé, seule la base de dev a pu le recevoir, et elle ne contient que les 21 clés réelles (contrôle SQL du 2026-09-25).
- **[edge-case-hunter] Seed en upsert sans suppression : une clé retirée reste en base** — `medium`, comportement préexistant du seed, non introduit par la story → `defer`.
- **[edge-case-hunter] AC1 « exactement » vrai seulement sur base neuve** — `false` pour cette livraison : base de dev contrôlée ; le cas général relève du report précédent.
- **[edge-case-hunter] Race inconnue au catalogue → souffle masqué sans avertissement** — `low`, n'arrive qu'avec une donnée fautive, désormais couverte par le test de contrat ; une garde ajouterait une branche → rejeté.
- **[edge-case-hunter] Libellé fait d'espaces → ligne vide** — `low`, impossible avec le test de contrat (libellé non vide) → rejeté.
- **[edge-case-hunter] Rituels non affichés au niveau 5** — hors intention (story dédiée à la réserve et aux capacités de niveau) → rejeté.
- **[edge-case-hunter] Pas de validation `famille`/`race` au seed** — l'intention exclut une garde runtime ; la vérification passe par le test de contrat → rejeté.
- **[verification-gap] `souffles.json` non suivi : un commit qui l'oublie casse le démarrage** — `low`, pas un défaut du code ; rappel à faire au moment du commit → rejeté (noté dans la présentation).

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts"` -- expected: tous les tests passent.
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`party-signals.service.spec.ts`, `parties.service.spec.ts`, dates figées).

**Manual checks (if no CLI):**
- Redémarrer l'API (re-seed), ouvrir la fiche d'un Homme Dragon niveau 1-2 puis ≥ 3 et vérifier la matrice.
