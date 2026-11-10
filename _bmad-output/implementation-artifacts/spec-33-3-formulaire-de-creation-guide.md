---
title: 'Formulaire de création guidé de l''Homme Dragon'
type: 'feature'
created: '2026-09-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '6abe1d2e04c855acd7ed987b9676fd3edd8e0217'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le formulaire de création (`homme-dragon-sheet.html`) est une liste brute de champs natifs sans aide. Les textes d'aide sont rédigés (`homme-dragon-races.json`, `homme-dragon-creation-intros.json`) mais non enregistrés dans `CONTENT_TYPES`, et rien ne permet de nommer l'artefact alors que la fiche sait déjà afficher `artefact.nom` / `artefact.inscription`.

**Approach:** Remplacer ce formulaire par un parcours guidé de 5 étapes — Race, Artefact, Identité, Vie de l'Homme Dragon, Avatar — porté par un composant autonome `HommeDragonCreationWizard` (réutilisable par la 33.5). Tous ses textes viennent des deux catalogues enregistrés. Le payload reste celui de l'ancien parcours, plus `artefact.nom` et `artefact.inscription` s'ils sont saisis.

## Boundaries & Constraints

**Always:**
- Étapes : 1 Race (4 `ChoiceCard` teintées, DESIGN.md §2/§7) ; 2 Artefact (`ChoiceCard` de la race, sans teinte, + nom + inscription facultative) ; 3 Identité (nom requis, apparence, caractère) ; 4 Vie (vocation, demeure, mondes protégés, pré-rempli du titre de la partie) ; 5 Avatar. Suivant reste bloqué sans race (1), sans artefact **ou sans nom d'artefact** (2), sans nom du dragon (3). Précédent conserve les saisies ; changer de race réinitialise artefact, nom et inscription de l'artefact.
- Décision 2026-09-29 (nom de l'artefact) : **obligatoire** à la création, tant que l'application n'a ni édition de fiche ni avertissement « fiche incomplète » ; le rendre facultatif viendra avec ce principe, plus tard. L'inscription reste facultative.
- Décision 2026-09-29 (avatar) : l'étape Avatar est un **champ texte libre** (description de la forme d'avatar). Une image pourra s'y ajouter plus tard ; le texte restera dans tous les cas.
- Décision 2026-09-29 (préférences de race) : la carte montre la description ; un déclencheur « En savoir plus » **hors** de la carte-radio ouvre `DetailSurface` (description, préférences, puis artefacts et souffles propres à la race, pour aider à choisir — ajout du 2026-09-29). Jamais de puces sur la carte.
- Décision 2026-09-29 (intros) : texte d'intro d'étape tronqué à 3 lignes au-delà d'un seuil de longueur, bouton « Lire la suite » / « Réduire » (`aria-expanded`), **sur mobile seulement** : sur desktop (≥ 1024 px) les intros ne sont jamais tronquées (ajustement du 2026-09-29). Sur desktop aussi, les descriptions d'artefact s'affichent en entier sur la carte, sans « En savoir plus » (conservé sur mobile). Le texte de l'étape Artefact garde sa règle « changeable entre deux séances, jamais en cours de jeu ».
- Aide de chaque champ = texte du catalogue sous le label ; champs Material `appearance="outline"` (DESIGN.md §7). Deux entrées d'intro sont ajoutées au JSON pour les nouveaux champs : `artefactNom`, `artefactInscription`.
- Longueurs max = celles de l'API (nom 120 ; nom et inscription d'artefact 200 ; autres 5000). Champs vides envoyés `undefined`, comme aujourd'hui.
- Radiogroup + `RadioGroupNavDirective`, cibles 44 px, teinte de race toujours doublée du nom et d'une étiquette, contraste vérifié dans les 3 thèmes.

**Never:**
- Aucun changement API, DTO, `packages/shared` ni `game-rules` (`artefact.nom`/`inscription` sont déjà acceptés).
- Pas d'image d'avatar, pas de téléversement, aucun changement de modèle pour l'avatar.
- Pas d'édition d'artefact après création (bouton « Modifier » de la fiche inchangé), pas de rattrapage Material hors de ce parcours, pas de wizard générique extrait du wizard personnage.
- Ne pas forker `ChoiceCard` ni `DetailSurface` : ajouts optionnels et additifs seulement. Aucune garde runtime sur la complétude des catalogues.
- Pas de câblage SSE : le parcours n'affiche aucune donnée de Partie (hors pré-remplissage du titre).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Parcours complet | race + artefact nommé + nom saisis | `create()` avec `artefact: {key, nom, inscription}`, autres champs comme l'ancien parcours | N/A |
| Race changée | artefact et nom d'artefact déjà saisis | artefact, nom et inscription remis à vide | N/A |
| Étape non valide | 1 sans race / 2 sans artefact ou sans nom d'artefact / 3 sans nom | Suivant désactivé | N/A |
| Race sans artefact au catalogue | 0 entrée | étape 2 sans carte, Suivant bloqué | message d'absence |
| Textes absents | catalogue vide ou fetch en échec | parcours complet, sans aide, libellés constants | pas d'erreur bloquante |
| Description de race absente | champ vide | pas de « En savoir plus » | N/A |
| Échec de création | API 409 / erreur réseau | message d'erreur, saisies conservées, réessai possible | `createError` |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.{ts,html,spec.ts}` -- le `<form>` de création (html L7-81) et ses signaux (ts L109-130, `onRaceChange`, `onSubmit`) sont à remplacer par `<app-homme-dragon-creation-wizard>` ; l'état `null` et `justCreated` restent ici. Tests de création (spec L200-293) à déplacer vers le spec du wizard.
- `apps/web/src/app/features/characters/character-wizard/` -- modèle de pattern, rien d'extractible : bandeau `Étape i/n · label` + piste de progression (html L6-33, scss `__head`, `__progress-*`), barre Précédent/Suivant (`__nav-bottom`), `canGoNext` par étape (ts L271), `steps/narrative-step` pour les champs texte.
- `.../choice-card/choice-card.{ts,html,scss}` -- API : `option`, `selected`, `align`, `expanded`, `selectedOption`. Aucune prise pour la teinte : ajouter des entrées optionnelles (ex. `tint`, `badge`) sans changer le rendu par défaut ; tokens de race dans le SCSS du wizard, transmis en variables CSS.
- `apps/web/src/app/shared/detail-surface/detail-surface-host.ts` -- `createDetailSurfaceHost()`, `openContent({title, body, rows})` ; `rows` porte les préférences. Le déclencheur est un bouton frère de la carte (la carte est un `button role=radio`).
- `apps/api/src/game-systems/game-system.service.ts` (L53-110) -- `CONTENT_TYPES` ; ajouter `hommeDragonRace` et `hommeDragonCreationIntro`. Le loader ne valide que `key` non vide.
- `apps/api/game-systems/ryuutama/data/homme-dragon-races.json`, `homme-dragon-creation-intros.json` -- catalogues (`key,label,description,preferences[]` ; `key,label,text`). Étendre le second avec les deux clés d'artefact.
- `apps/api/src/game-systems/souffles-data.spec.ts` -- patron du test de contrat sur un JSON réel.
- `apps/api/src/homme-dragon/dto/create-homme-dragon.dto.ts` -- limites de longueur ; lecture seule.
- `apps/web/src/app/core/theme/tones.ts` -- clés `homme-dragon.{race_label,artefact_label,create_cta}` réutilisées ; ne pas ajouter de clé (3 thèmes à tenir à jour).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/game-systems/game-system.service.ts` -- enregistrer `hommeDragonRace` et `hommeDragonCreationIntro` -- AC1
- [x] `apps/api/game-systems/ryuutama/data/homme-dragon-creation-intros.json` -- ajouter `artefactNom` et `artefactInscription` (aide en français, formulation propre au projet) -- AC3
- [x] `apps/api/src/game-systems/homme-dragon-creation-data.spec.ts` -- test de contrat des deux JSON (4 races complètes, clés d'intro attendues, aucune valeur vide) -- AC1
- [x] `.../choice-card/choice-card.{ts,html,scss,spec.ts}` -- entrées optionnelles pour la teinte et l'étiquette ; test de non-régression du rendu par défaut -- AC2
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-creation-wizard/` -- composant, gabarit, styles et spec : 5 étapes, validations, « En savoir plus », « Lire la suite », payload -- AC2, AC3, AC4, matrice I/O
- [x] `.../homme-dragon-sheet.{ts,html,spec.ts}` -- brancher le wizard, retirer l'ancien formulaire, migrer les tests de création -- AC4

**Acceptance Criteria:**
- Given le seed, when il s'exécute, then les content-types `hommeDragonRace` et `hommeDragonCreationIntro` contiennent les 4 races et toutes les intros.
- Given l'étape Race, when elle s'affiche, then chaque carte montre nom, étiquette et description du catalogue, et « En savoir plus » ouvre description et préférences sans sélectionner la carte.
- Given une intro longue, when l'étape s'affiche, then elle est tronquée avec « Lire la suite », et le bouton la déploie.
- Given un parcours complet, when je valide, then la fiche créée équivaut à celle de l'ancien parcours, avec en plus le nom et l'inscription de l'artefact s'ils sont saisis.

## Implementation Notes

- Implémentation (2026-09-29) : catalogues enregistrés (`hommeDragonRace`, `hommeDragonCreationIntro`) + deux aides d'artefact, test de contrat API, `ChoiceCard` (entrées `tint` et `badge`), `HommeDragonCreationWizard` (5 étapes), fiche rebranchée. `RACES`/`RACE_LABELS` déplacés dans `homme-dragon-races.ts` (évite un import circulaire fiche ↔ wizard).
- Écarts assumés : (1) le texte de l'étiquette de race utilise `--h-text` (rouge et noir éclaircis, `--h` mesuré à 2,0–4,5:1 sur les surfaces des 3 thèmes) ; le liséré garde `--h` — DESIGN.md §7 à répercuter par `bmad-ux`. (2) « En savoir plus » aussi sur les artefacts (leur description est coupée à 2 lignes sur la carte). (3) Barre Précédent/Suivant `sticky` et non fixe, car le parcours est embarqué dans l'onglet de la Partie.
- Retours du 2026-09-29 appliqués : contenu projeté (`custom`) dans la surface de détail de race ; `isDesktop` via `BreakpointObserver` ; `ChoiceCard.fullDetail`. Web 93/93, build propre.
- Vérification : web 77/77 (choice-card, radio nav, wizard 18, fiche 41) ; API `src/game-systems` 56/56 ; `pnpm build` web sans erreur ; API complète 1410/1412, les 2 échecs préexistants connus. Non faits : re-seed de l'API, contrôle visuel 375 px / 1024 px / 3 thèmes.

## Spec Change Log

- 2026-09-29 (2) — retours de l'utilisateur après livraison. Modifié (bloc figé) : (a) le « En savoir plus » d'une race montre aussi ses artefacts et ses souffles, catalogue `souffle` chargé par le parcours ; (b) desktop seulement : descriptions d'artefact complètes sur la carte (sans coupe ni « En savoir plus »), intros non tronquées, donc plus de « Lire la suite » à l'étape Avatar. Mobile inchangé. État évité : un bouton qui n'économise aucune ligne et un choix de race pris sans voir ses artefacts ni ses souffles. KEEP : seuil desktop unique 1024 px, `ChoiceCard` non forké (entrée additive `fullDetail`).

## Review Triage Log

Revue du 2026-09-29 (Blind Hunter, Edge Case Hunter, Verification Gap ; diff limité à `apps/`).

- **[verification-gap] `CONTENT_TYPES` : l'enregistrement des deux nouveaux content-types n'est vérifié par aucun test** (+ [blind-hunter] même cause) — `medium` : une entrée supprimée ou mal orthographiée laisse tous les tests verts et le wizard perd silencieusement toute son aide (`?? []`) → `patch` (test de `seedRyuutama()`).
- **[verification-gap] Clés `help(...)` du gabarit presque jamais assertées** — `low`, coquille silencieuse par conception → `patch` (test piloté par table).
- **[edge-case-hunter] `createError` reste affiché sur les autres étapes après un échec puis Précédent/Suivant** — `low`, correction directe → `patch`.
- **[edge-case-hunter] / [blind-hunter] Échec du fetch des catalogues → étape Artefact bloquée sur « Aucun artefact… »** — `low` : la fiche mère (`HommeDragonSheet`) n'affiche le parcours qu'après un premier fetch réussi du même contenu, un échec du second est transitoire et improbable ; le correctif ajoute un état et une branche → rejeté.
- **[blind-hunter] Catalogue chargé deux fois (fiche + parcours)** — `low` : choix de la spec (Design Notes, parcours autonome pour la 33.5) → rejeté.
- **[blind-hunter] `RaceData.label` et `label` des intros non lus, libellés d'étape codés en dur** — `low`, cosmétique, la spec demande les champs `label` au catalogue → rejeté.
- **[blind-hunter] Changer de race efface la saisie de l'artefact** — bloc figé de la spec (« changer de race réinitialise artefact, nom et inscription ») → rejeté.
- **[blind-hunter] Accessibilité : focus non géré au changement d'étape, boutons « En savoir plus » dans le radiogroup, barre de progression sans rôle, transition sans `prefers-reduced-motion`, `id` statique** — `low`, même patron que le wizard personnage, aucun préjudice démontré → rejeté.
- **[blind-hunter] Liséré du Dragon Noir à 2,0-2,2:1 (< 3:1)** — décision de design actée (5 itérations, DESIGN.md §2/§7) ; le texte est traité par `--h-text` → rejeté.
- **[blind-hunter] `|| undefined` mort sur `artefact.nom`, plafonds de longueur dupliqués sans compteur** — `low`, inoffensif → rejeté.
- **[blind-hunter] Champs devenus des `textarea`, pas de `<form>` (Entrée sans effet), pas d'annulation ni de brouillon** — hors spec, comportement voulu par le maquettage (champs multi-lignes) → rejeté.
- **[blind-hunter] Tests `ChoiceCard` sans teinte + sélection/déploiement, sans navigation clavier** — `low` → rejeté.
- **[blind-hunter] « Ce nom est requis » alors que l'API le laisse facultatif** — décision utilisateur, contrainte du formulaire seule (Design Notes) → rejeté.
- **[edge-case-hunter] Description de race vide mais préférences non vides** — `false` : le test de contrat impose les deux non vides sur le vrai fichier.
- **[edge-case-hunter] `partieName` non suivi après `ngOnInit`** — `low`, comportement de l'ancien formulaire conservé → rejeté.
- **[edge-case-hunter] Surface de détail ouverte à un changement d'étape / à la destruction** — `false` : la surface est un dialogue modal avec fond bloquant, Suivant et Créer ne sont pas atteignables tant qu'elle est ouverte.
- **[edge-case-hunter] `onRaceChange` avec une clé hors `RACES`** — `false` : seules les cartes issues de `RACES` émettent.
- **[edge-case-hunter] Étiquette sélectionnée sous le contraste minimal** — `false` : elle hérite de `on-primary-container` (5,8 à 7,6:1 mesuré à la 31.4), le commentaire du SCSS parle des teintes, pas de cette couleur.
- **[edge-case-hunter] `FormsModule` importé mais inutile dans la fiche** — `false` : `[ngModel]` reste utilisé (choix d'artefact et de pouvoir d'éveil).
- **[blind-hunter] Imports `RACES` / `RACE_LABELS` possiblement inutilisés dans la fiche** — `false` : `RACES` sert aux souffles des autres races (ts L313), `RACE_LABELS` à `raceLabel`.
- **[blind-hunter] 409 : message générique, réessai vain** — `low`, message identique à l'ancien parcours (préexistant), le correctif ajoute une branche → rejeté.

## Design Notes

- Le wizard est un composant à part car la 33.5 crée aussi depuis « Personnages » ; il charge lui-même les catalogues (`getGameSystemContent`, mis en cache côté API).
- Libellés de race : les constantes `RACE_LABELS` de la fiche (casse « Dragon Vert ») ; le catalogue fournit description et préférences.
- Le nom d'artefact obligatoire est une contrainte du **formulaire seulement** : l'API le laisse facultatif, ce qui rendra l'assouplissement futur trivial. Les tests de création existants doivent désormais le fournir.
- Seuil de « Lire la suite » : une constante en nombre de caractères, sans mesure du DOM.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/**/*.spec.ts" --include "src/app/features/characters/character-wizard/choice-card/*.spec.ts"` -- expected: tous les tests passent.
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front).
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`party-signals.service.spec.ts`, `parties.service.spec.ts`).

**Manual checks (if no CLI):**
- Redémarrer l'API (re-seed), créer un Homme Dragon à 375 px puis ≥ 1024 px, dans les 3 thèmes : teintes, « En savoir plus », « Lire la suite », retour arrière.
