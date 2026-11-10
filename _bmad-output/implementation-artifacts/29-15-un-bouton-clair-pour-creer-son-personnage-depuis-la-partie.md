---
title: '29.15 — Un bouton clair pour créer son personnage depuis la partie'
type: 'feature'
created: '2026-09-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
context: []
baseline_commit: 3a08daf7d816c903623e5fcbb974772099c07816
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem :** Sur l'écran de détail d'une partie, deux entrées de création coexistent sans cohérence : le slot d'initiale du roster desktop (aucun libellé visible) et l'onglet « Ma fiche », réservé au mobile, dont le bouton s'affiche même quand la création n'est pas réellement possible (système sans module, partie clôturée). Le signal `PERSONNAGE_A_CREER` de la page principale des parties a le même angle mort sur le module. Un joueur peut donc arriver sur un écran qui ne le guide pas, ou au contraire être invité à un geste impossible.

**Approche :** Unifier desktop et mobile — l'onglet « Ma fiche » se rend désormais pour tout joueur non-MJ, plus seulement sur mobile, et devient l'onglet sur lequel on atterrit automatiquement dès qu'il reste à créer son personnage sur cette partie (même prédicat que le bouton lui-même) ; sinon l'onglet par défaut reste « Détails ». Le flag « système avec module », créé dans `packages/shared`, devient la source unique lue par ce prédicat, par le tooltip du slot roster et par le signal `PERSONNAGE_A_CREER`.

⚠️ **Divergence UX à signaler :** le contrat du 2026-09-21 (`ux-designs/ux-jdr-master-2026-09-21/mockups/contrat-ui-entree-creation.html`) décrivait un bloc d'invitation (« CharacterCallout ») dans l'onglet Détails. Cette story s'en écarte sur décision explicite de l'utilisateur (2026-09-21) : l'atterrissage automatique sur « Ma fiche » le remplace, sur desktop comme sur mobile — aucun bloc callout n'est construit. À répercuter dans les artefacts UX (`bmad-ux`/`bmad-correct-course`) après cette story.

## Boundaries & Constraints

**Always :**
- Le prédicat `canCreateCharacter` (pas MJ · aucun personnage sur cette partie · système avec module · partie non terminée) est écrit une seule fois côté web et réutilisé tel quel par : la visibilité du bouton, le calcul de l'onglet par défaut, le tooltip du slot roster ; il sera réutilisé tel quel par la story 29.16.
- L'indicateur « système avec module » vit dans `packages/shared`, lu sans appel réseau côté web ; côté API, `party-signals.service.ts` lit la même source pour ne jamais émettre `PERSONNAGE_A_CREER` sur un système sans module.
- L'onglet « Ma fiche » se rend pour tout joueur non-MJ, desktop compris — condition alignée sur `!isMj()` seul.
- L'onglet par défaut est « Ma fiche » quand `canCreateCharacter()` est vrai, sinon « Détails » — identique desktop et mobile. Le MJ reste toujours sur « Détails » par défaut (inchangé).
- Une bascule manuelle d'onglet (`manualTabIndex` existant) reste prioritaire sur ce calcul pour la visite en cours.
- Réutiliser telle quelle la route de création existante (`/parties/:id/characters/new?gameSystemId=...`).
- Le MJ ne voit jamais ce bouton ni cet onglet ; son entrée reste hors périmètre (Homme Dragon, story 33.5).
- Tout nouveau libellé passe par `TONE_MAP` × 3 thèmes.

**Never :**
- Ne pas retirer le slot d'initiale du roster desktop — entrée secondaire conservée. *Amendé le 2026-09-21 (revue de code, voir Review Triage Log) :* le clic/la navigation du slot sont désormais gardés par `canCreateCharacter()`, comme le bouton et l'onglet — un slot vide sur un système sans module ou une partie clôturée reste visible (initiale du membre) mais n'ouvre plus l'assistant de création. Le libellé accessible reste réutilisé tel quel dans tous les cas.
- Ne pas construire la section de la story 29.16 ni le filtrage du formulaire/API de la story 29.17.
- Ne pas modifier la garde 404 de l'assistant de création (`character-wizard.ts`).
- Aucune migration Prisma.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Joueur sans personnage, système avec module, partie ouverte | `canCreateCharacter()===true` | Onglet par défaut = « Ma fiche », bouton visible immédiatement, desktop et mobile | N/A |
| Joueur ayant déjà un personnage sur cette partie | `myCharacters().length>0` | Onglet par défaut = « Détails » ; « Ma fiche » liste le(s) personnage(s) si on y va | N/A |
| Système sans module | `module===false` | Onglet par défaut = « Détails » ; bouton absent de « Ma fiche » | N/A |
| Partie terminée | `status==='TERMINEE'` | Onglet par défaut = « Détails » ; bouton absent | N/A |
| MJ ouvre sa propre partie | onglet « Ma fiche » non rendu | Défaut = « Détails » (inchangé) | N/A |
| Bascule manuelle vers un autre onglet pendant la visite | `manualTabIndex` défini | Prioritaire sur le calcul par défaut | N/A |
| Page principale, partie sur système sans module | calcul API | `PERSONNAGE_A_CREER` jamais émis pour cette partie | N/A |
| Slot roster desktop (`isSelf && !character`), `canCreateCharacter()===true` | inchangé | Reste cliquable, navigue vers la création, aria-label/tooltip thématisé `roster.create_slot_label` | N/A |
| Slot roster desktop (`isSelf && !character`), `canCreateCharacter()===false` (pas de module ou partie clôturée) | amendé 2026-09-21 | Slot visible (initiale) mais n'ouvre plus l'assistant — plus de cul-de-sac | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts:99-106` -- `GAME_SYSTEMS`, ajouter `module: boolean` par entrée + une fonction `gameSystemHasModule(id: string): boolean` co-localisée (source unique, lue par web et API, tolère un id inconnu → `false`).
- `apps/api/src/game-systems/supported-game-systems.ts` -- `SUPPORTED_GAME_SYSTEMS = [RYUUTAMA_ID]`, à refléter dans les valeurs de `module` (seul `ryuutama` à `true` aujourd'hui).
- `apps/api/src/parties/party-signals.service.ts:108-133` -- `computeSignals()`, branche `role === 'player'` ; garder `PERSONNAGE_A_CREER` derrière `gameSystemHasModule(partie.gameSystemId)` en plus de l'absence de personnage (`partie.gameSystemId` déjà disponible sur `PartieDto`, ligne 231 du même fichier shared).
- `apps/api/src/parties/party-signals.service.spec.ts` -- ajouter un cas : partie sans module, aucun personnage → pas de `PERSONNAGE_A_CREER`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts:182` (`isMj`), `:184-188` (`myCharacters`) -- réutiliser tel quel dans le nouveau prédicat.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- nouveau computed `canCreateCharacter`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts:260` -- `defaultTabIndex`, remplacer `!isDesktop()` par `canCreateCharacter()`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts:270` -- `tabSetKey`, simplifier en `` `${this.isMj()}` `` (le jeu d'onglets ne dépend plus de l'appareil).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:230` -- condition de l'onglet « Ma fiche », `@if (!isMj() && !isDesktop())` → `@if (!isMj())`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:233-242` -- garder le bouton par `canCreateCharacter()` au lieu de `myCharacters().length===0` seul -- corrige un défaut réel (module/clôture ignorés aujourd'hui).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:234` -- texte vide codé en dur → nouvelle clé de thème.
- `apps/web/src/app/features/parties/roster-rail/roster-rail.ts:52-55`, `roster-row.util.ts:84-99,94` -- slot d'initiale ; faire venir `row.ariaLabel` de `roster.create_slot_label`, aucune restructuration.
- `apps/web/src/app/core/theme/tones.ts` -- `roster.create_slot_label` + clé du texte vide, ×3 thèmes ; `character.create_cta` déjà présent (lignes ~204/591/973), réutilisé tel quel.
- Non touchés : `character-wizard.ts` (garde 404), bloc Homme Dragon (`partie-detail.html:334-338`), grammaire interne du roster au-delà du libellé, bascule « troupe » mobile (`partie-detail.html:58`, sans rapport).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- ajouter `module: boolean` sur `GAME_SYSTEMS` (`ryuutama: true`, autres `false`) + `gameSystemHasModule(id)`
- [x] `apps/api/src/parties/party-signals.service.ts` -- garder `PERSONNAGE_A_CREER` par `gameSystemHasModule(partie.gameSystemId)`
- [x] `apps/api/src/parties/party-signals.service.spec.ts` -- cas système sans module → signal absent
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- computed `canCreateCharacter`
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- `defaultTabIndex` piloté par `canCreateCharacter()` au lieu de `!isDesktop()`
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- `tabSetKey` simplifié en `${isMj()}`
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- onglet « Ma fiche » rendu pour tout non-MJ (retrait de `!isDesktop()`)
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- bouton gardé par `canCreateCharacter()`, texte vide thématisé
- [x] `apps/web/src/app/features/parties/roster-row.util.ts` -- aria-label depuis `roster.create_slot_label`
- [x] `apps/web/src/app/core/theme/tones.ts` -- nouvelles clés ×3 thèmes
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- couvrir `defaultTabIndex` (desktop et mobile, besoin ou non de créer), rendu de « Ma fiche » sur desktop, gating corrigé, libellé du roster

**Acceptance Criteria:**
- Given un joueur desktop sans personnage sur un système avec module et une partie ouverte, when il ouvre le détail de la partie, then il atterrit directement sur l'onglet « Ma fiche » avec le bouton visible, sans action supplémentaire
- Given le même joueur mais sur mobile, when il ouvre le détail, then l'atterrissage est identique aux deux gabarits
- Given le bouton rendu, when il est inspecté, then c'est un vrai lien atteignable au clavier (`<a mat-flat-button>`) — la cible d'au moins 44×44 px vient des dimensions par défaut de `mat-flat-button` (non mesurée par un test dédié, JSDOM ne mesure pas de boîte réelle ; à surveiller si la densité Material change un jour, cf. `deferred-work.md`)
- Given une bascule manuelle d'onglet pendant la visite, when le calcul par défaut se réévalue, then il n'écrase pas le choix manuel de l'utilisateur

## Implementation Notes

- 2026-09-21 — Passe de correctifs post-revue **bmad-review** (Adversarial/Edge-Case Hunter/Verification Gap, sur le seul commit `332cb0c`) : cinq correctifs supplémentaires appliqués. (1) `roster-row.util.ts`/`roster-rail.ts`/`roster-strip.ts` : `buildRosterRows()` gagne un paramètre `createEligible` et chaque `RosterRow` porte désormais `canCreate` — le slot d'initiale n'est actionnable (tabindex, classe `--create`, badge « + », libellé de création, clic) que si `canCreate` est vrai, plus seulement `isSelf && !character` ; pendant le chargement de `characters()` **et** sur un système sans module/partie clôturée, le slot redevient un simple avatar inerte avec le même aria-label générique que les autres membres sans personnage (« aucun personnage créé »), au lieu de promettre une action que le clic n'exécutait pas. (2) `roster-strip.ts` : `buildRosterRows()` reçoit `undefined` (pas `this.mjId()`) comme `currentUserId` — `RosterStrip` est MJ-only et n'a aucune notion d'utilisateur courant distincte du MJ ; passer `mjId()` deux fois rendait `isSelf` vrai à tort pour la ligne du MJ (sans conséquence aujourd'hui, sa branche `isMj` court-circuite avant `canCreate`, mais latent pour un futur slot joueur). (3) `partie-detail.ts` : effet `tabSettled` ajouté — l'atterrissage automatique sur « Ma fiche » se fige la première fois que `charactersLoaded()` devient vrai après chaque remise à zéro de `manualTabIndex` (changement de rôle MJ/joueur), au lieu de suivre `canCreateCharacter()` en continu ; sans ce gel, un joueur déjà en train de lire « Détails » pouvait être basculé sans le vouloir, y compris bien après l'atterrissage initial (ex. personnage créé ailleurs et rechargé par le signal temps réel `characterSvc.changed()`). (4) `partie-detail.html` : la section `.my-sheet-tab` affiche un `<mat-progress-spinner>` tant que `!charactersLoaded()`, avant de choisir entre le message vide et la liste des personnages — l'ancien rendu montrait le message « aucun personnage » (sans bouton) pendant tout le chargement, indiscernable de l'état « on ne peut jamais créer ici ». (5) AC3 reformulé (cf. Acceptance Criteria) : la revendication « au moins 44×44 px » n'était vérifiée par aucun test (JSDOM ne mesure pas de boîte réelle) ; documentée comme héritée des dimensions par défaut de `mat-flat-button` plutôt que testée. Item roster-strip du Review Triage Log du 2026-09-21 (verdict `low`, non appliqué dans la passe précédente) traité par (2) ci-dessus. Post-patch : nouveaux tests dans `roster-rail.spec.ts` et `partie-detail.spec.ts` (slot inéligible/en chargement, échec réseau de `listByPartie()`, spinner de `.my-sheet-tab`, non-bascule après stabilisation).

- 2026-09-21 — Passe de correctifs post-revue (4 findings) : slot roster gardé par `canCreateCharacter()` (`createCharacter()` retourne tôt), `charactersLoaded` signal ajouté pour éliminer le flicker vers « Ma fiche », test de parité `SUPPORTED_GAME_SYSTEMS` ↔ `GAME_SYSTEMS[].module` ajouté (`apps/api/src/game-systems/supported-game-systems.spec.ts`), commentaire périmé de `partie-detail.ts:460-461` corrigé. Revérifié en entier après coup (pas seulement les tests ciblés du sous-agent) : web 2380/2382, API 1346/1348 — les 4 échecs restants sont les mêmes fixtures de date figées (`2026-09-01`) déjà identifiées avant cette story, sans rapport.

- `RosterRail`/`RosterStrip` : `buildRosterRows()` gagne un nouveau paramètre `createSlotLabel:
  string` (avant `currentUserId`, même position que les autres libellés injectés) — les deux sites
  d'appel passent `theme.tone()['roster.create_slot_label']`. Le slot d'initiale gagne aussi un
  `[title]="row.ariaLabel"` (tooltip natif au survol) en plus de l'`aria-label` déjà en place —
  seule extension au-delà de « aucune restructuration » du Code Map, jugée nécessaire pour livrer
  le signal *visible* que le problème de la story pointait (le slot n'avait « aucun libellé
  visible »).
- `character.no_character_yet` (nouvelle clé) remplace le texte codé en dur de l'état vide de
  « Ma fiche » ; le bouton de création est désormais dans un `@if (canCreateCharacter())` imbriqué
  sous `@if (myCharacters().length === 0)`, pour distinguer « pas encore de personnage mais on peut
  en créer un » de « pas de personnage et on ne peut pas (système sans module / partie clôturée) ».
- Effet de bord découvert en vérifiant : `MatTabGroup` ne rend le corps que de l'onglet
  actif/adjacent. Comme un joueur sans personnage sur un système avec module atterrit maintenant
  sur « Ma fiche » (au lieu de « Détails ») même sur desktop, 5 tests pré-existants de
  `partie-detail.spec.ts` (« Fiches de référence », Story 12.1) qui inspectaient du contenu de
  l'onglet « Détails » sans y naviguer explicitement ont été corrigés pour cliquer d'abord sur cet
  onglet. Comportement inchangé pour ces fiches elles-mêmes — seule la story 29.15 déplace le point
  d'atterrissage par défaut.
- Tests pré-existants ajustés pour rester représentatifs du nouveau comportement (gameSystemId
  `'ryuutama'` explicite là où le test dépendait d'un atterrissage par défaut sur « Ma fiche », ou
  assertions/commentaires mis à jour) : voir `partie-detail.spec.ts` — describe « roster (Story
  6.1) », « arrivée depuis le bandeau du Shell », « pseudo en complément ». Le test de
  redimensionnement qui vérifiait la réinitialisation de la sélection manuelle d'onglet a été
  retourné : puisque « Ma fiche » se rend désormais aussi sur desktop, `tabSetKey` (simplifié en
  `${isMj()}`) ne change plus au redimensionnement, donc la sélection manuelle **survit**
  désormais — ce test démontre directement l'AC4 (bascule manuelle prioritaire sur le calcul par
  défaut).

## Spec Change Log

- 2026-09-21 — Reconception après revue avec l'utilisateur : abandon du bloc « CharacterCallout » dans l'onglet Détails (contrat UX 2026-09-21) au profit d'un atterrissage automatique sur l'onglet « Ma fiche », désormais rendu aussi sur desktop. Ajout au périmètre : correction du signal `PERSONNAGE_A_CREER` (`party-signals.service.ts`) pour respecter le flag `module`, jusque-là un angle mort identique côté page principale.
- 2026-09-21 — Revue de code (Blind Hunter / Edge Case Hunter / Verification Gap, 1 passe) : finding `intent_gap` sur le slot roster (cul-de-sac sur système sans module, `Boundaries`/I-O Matrix gelés verrouillaient explicitement le comportement inverse). Décision utilisateur : le slot est désormais gardé par `canCreateCharacter()` comme le reste — `Boundaries → Never` et l'I/O Matrix amendés ci-dessus. **KEEP** : tout le reste du diff (prédicat unifié, atterrissage sur « Ma fiche », signal API, clés de thème, tests) était déjà vérifié correct et n'est pas rejoué — écart délibéré et autorisé par l'utilisateur à la procédure stricte (qui aurait tout redérivé depuis le spec) : les 4 findings retenus (ce slot + 3 `patch`) sont appliqués directement en correctif ciblé plutôt que par une nouvelle passe complète de step-03.

## Review Triage Log

- **[intent_gap]** Le slot d'initiale du roster desktop (`createCharacter()`, `partie-detail.ts:308-312`) navigue toujours sans condition vers `/parties/:id/characters/new`, sans jamais vérifier `gameSystemHasModule`/clôture — confirmé par le test préexistant non modifié `partie-detail.spec.ts:565-577`, qui utilise `gameSystemId: 'draconis'` (sans module) et vérifie explicitement que le clic navigue quand même. C'est un cul-de-sac réel pour 3 des 4 systèmes de jeu actuels. Root cause dans le bloc gelé : `Boundaries → Never` (« ne pas restructurer, gagne seulement un libellé accessible ») et la ligne de la matrice I/O (« Reste cliquable ») verrouillent explicitement ce comportement. Verdict : `high` — contredit directement l'AC3 d'epics.md et le but même de la story pour la majorité des systèmes.
- **[patch]** `defaultTabIndex`/`canCreateCharacter` dépendent de `characters()`, initialisé à `[]` et rempli seulement en fin de `ngOnInit()` (après `loadMembers()`, `loadActivePolls()`, `announcements`) alors que `partie()` (et donc le rendu du `mat-tab-group`) est déjà posé bien avant (`partie-detail.ts:555` vs `:563`). Un joueur ayant déjà un personnage atterrit donc brièvement sur « Ma fiche » avec le CTA visible, puis bascule silencieusement vers « Détails » une fois `characters()` chargé, sans aucune interaction de sa part. Vérifié par trace de code ; aucun test n'exerce la fenêtre entre les deux `set()`. Verdict : `high` — régression UX réelle, directement contraire au but de la story pour le cas le plus courant (joueur déjà pourvu d'un personnage).
- **[patch]** `packages/shared/src/index.ts` (`GAME_SYSTEMS[].module`) et `apps/api/src/game-systems/supported-game-systems.ts` (`SUPPORTED_GAME_SYSTEMS`) sont deux listes maintenues indépendamment sans aucun test de parité — confirmé, aucune référence croisée trouvée dans la base. Un futur système ajouté à l'une sans l'autre désynchronise silencieusement le gating web/signal de la vraie garde serveur. Verdict : `medium`.
- **[patch]** Commentaire périmé `partie-detail.ts:460-461` — dit encore que `tabSetKey()` "remet `manualTabIndex` à `null` à chaque changement MJ/desktop", alors que ce diff a simplifié `tabSetKey` à `` `${isMj()}` `` (ne dépend plus du device). Confirmé par lecture directe. Verdict : `low`, cosmétique.
- **[patch]** `roster-strip.ts` passe `this.mjId()` à la fois comme `mjId` et `currentUserId` à `buildRosterRows()` : dans `roster-row.util.ts`, la branche `isMj` (ligne 66) court-circuite systématiquement avant la branche `!character` qui consomme `createSlotLabel` (ligne 87-98) — le nouvel argument est donc mort dans cet appel (confirmé par lecture). Aucun effet utilisateur (RosterStrip est MJ-only, jamais de slot joueur), mais un futur ajout d'un slot joueur mobile s'appuierait à tort dessus. Verdict : `low`.
- **[reject/false]** Edge-case-hunter : statut `A_VENIR` non testé explicitement pour `canCreateCharacter`. Vérifié : la garde ne compare qu'à `'TERMINEE'`, donc `A_VENIR` est correctement autorisé par construction — comportement voulu, aucun mauvais résultat démontré, juste absence d'une ligne de test dédiée.
- **[reject/low]** Blind hunter : `character.no_character_yet` ne distingue pas un système sans module / une partie clôturée (temporaire vs permanent). Le texte n'est pas faux, seulement peu informatif ; corriger exigerait 6 nouvelles clés thématisées (2 cas × 3 thèmes) et une logique de branchement supplémentaire — non trivial, et l'AC de la story n'exige qu'une absence de bouton, pas un message différencié.
- **[reject/false]** Blind hunter : `sprint-status.yaml` encore `in-progress` malgré un diff qui semble complet. Pas un défaut de code — c'est l'état normal avant l'étape de présentation (step-05) qui clôt le statut.

## Design Notes

Deux décisions notables. **(1)** Le flag `module` n'existait nulle part comme source partagée (seul `SUPPORTED_GAME_SYSTEMS` côté API). Il est créé ici en miroir exact de cette liste et devient la source unique consommée par le web (bouton, onglet par défaut, tooltip roster) et par l'API (`party-signals.service.ts`) — sans porter la validation serveur de la création de partie, propre à la story 29.17. **(2)** L'atterrissage automatique remplace le bloc d'invitation prévu par le contrat UX : plutôt que d'ajouter un élément visuel supplémentaire dans Détails, l'utilisateur arrive directement là où le geste est possible — cohérent avec le principe déjà appliqué au mobile aujourd'hui (onglet « Ma fiche » déjà sélectionné par défaut pour un joueur mobile), maintenant étendu au desktop et rendu conditionnel au besoin réel plutôt qu'à l'appareil.

## Verification

**Commands:**
- `docker compose exec api pnpm test -- party-signals` -- expected: nouveaux cas verts, suite existante inchangée
- `docker compose exec web pnpm vitest run` -- expected: tous les tests passent, y compris les nouveaux cas de `partie-detail.spec.ts`
- `docker compose exec web pnpm exec tsc --noEmit -p apps/web` -- expected: propre

**Résultats (2026-09-21) :**
- `docker compose exec api pnpm test` (suite complète, `jest`, le script réel du package plutôt que
  le `vitest run` littéral du texte ci-dessus qui n'est pas l'outillage de ce projet -- voir note) :
  1342/1344 verts. Les 2 cas nouveaux de `party-signals.service.spec.ts` passent. 2 échecs
  **préexistants, sans rapport avec cette story** : `PROCHAINE_SEANCE_CONNUE` et
  `getAvailableSlots — AD-9 end-to-end` comparent à des dates calendaires codées en dur
  (`2026-09-01`) désormais dans le passé par rapport à l'horloge système (2026-09-21) -- non
  touchés par cette story, non corrigés (hors périmètre).
- `docker compose exec web pnpm test` (`ng test --watch=false`, le script réel du package --
  `pnpm vitest run` brut échoue en cascade sur ~300 tests sans rapport, `window is not defined` /
  `Component ... is not resolved`, faute de la résolution de ressources qu'`ng test` effectue ;
  voir note) : 2377/2379 verts, y compris tous les nouveaux cas et les clés de thème. Seul échec
  restant, **préexistant et sans rapport** : `calendar-view.spec.ts` (même classe de bug que
  ci-dessus, date `2026-09-01` codée en dur).
- `docker compose exec api pnpm typecheck` (`tsc --noEmit -p tsconfig.check.json`, script réel du
  package) : propre.
- Web : pas de script `typecheck` déclaré dans `apps/web/package.json` (ce dépôt ne fait pas
  tourner le build front en CI, cf. `CLAUDE.md`). La commande littérale de cette section
  (`tsc --noEmit -p apps/web`) échoue même hors de toute modification de cette story : mauvais
  chemin une fois dans le conteneur (cwd déjà `apps/web`), et une fois corrigé, une erreur
  `rootDir` préexistante sur les imports inter-packages (`@master-jdr/game-rules`) qu'un `tsc` brut
  ne résout pas comme le fait `ng build`/`ng test`. Je n'ai pas contourné -- signalé ici. La
  compilation TypeScript réelle des fichiers modifiés est cependant validée : `ng test` (ci-dessus)
  compile et type-checke tous les fichiers touchés sans erreur avant de les exécuter.

**Manual checks (if no CLI):**
- Vérification visuelle sur les trois thèmes : compte joueur sans personnage sur une partie Ryuutama ouverte, atterrissage sur « Ma fiche » vérifié en redimensionnant la fenêtre (desktop ↔ mobile) ; sur une partie fermée et sur un système sans module, atterrissage sur « Détails » et bouton absent dans les deux cas.
