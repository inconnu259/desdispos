# Deferred Work

Registre des items de dette technique/UX identifiés en cours de développement (revue de code, dev-story, vérification visuelle) mais non traités immédiatement.

**Ce fichier ne contient QUE des items encore actifs** — jamais résolus, jamais explicitement refusés. Dès qu'un item reçoit une décision définitive (corrigé, constaté obsolète, ou accepté comme dette assumée), il est retiré d'ici et archivé dans `deferred-work-archive.md` avec le raisonnement de la décision. Ce fichier reste donc une vraie liste de travail — s'il contient des items, ce sont des items à traiter ; s'il est vide, il n'y a rien en attente.

**Format d'un item** : une puce, avec un tag de priorité en tête — `[P:HAUTE]` (bug/trou fonctionnel réel), `[P:MOYENNE]` (écart UX/architecture réel mais non bloquant), `[P:BASSE]` (nit, cosmétique, gap de test isolé) — suivi du texte et, entre crochets en fin de ligne, le(s) fichier(s) concerné(s).

**Historique** : `deferred-work-archive.md` — 518 items triés le 2026-08-25 (96 résolus, 420 acceptés/non actifs). Deux décisions produit tranchées ce jour-là : sections manquantes de l'Agenda (comportement confirmé définitif) et unification du libellé « Soirée »/« Soir » (uniformisé vers « Soir »).

---

## Deferred from: code review of 31-2-surface-de-detail-adaptative (2026-08-25)

- [P:BASSE] Cible tactile de `.sheet__detail-trigger` limitée au texte du nom (pas de `min-height`/padding dédiés) — risque de régression de taille de cible tactile mobile (WCAG 2.5.5), non couvert par un AC de la story (AC7 exige un élément interactif réel visuellement identique à l'ancien `<strong>`, pas une taille de cible minimale). [apps/web/src/app/features/characters/character-sheet/character-sheet.scss:99-114]
- [P:BASSE] Seuil `1024px` dupliqué en dur dans une constante TS et deux `@media` SCSS, aucune source unique nommée — pattern déjà établi ailleurs dans le projet (`CalendarView.DESKTOP_QUERY`), pas introduit par cette story mais jamais centralisé. [apps/web/src/app/shared/detail-surface/detail-surface.ts:36, detail-surface.scss:8,20]

## Deferred from: code review of 31-3-aide-contextuelle-sur-les-termes-de-jeu (2026-08-29)

- [P:BASSE] Garde AC3 (« pas de texte au catalogue ⇒ pas de déclencheur ») non appliquée aux déclencheurs FR-20 préexistants (talents/avantages/sorts de la fiche) — comportement hérité tel quel de la 31.2, non touché par le diff de la 31.3, hors périmètre de son AC3 (qui ne vise que les nouveaux termes FR-19). En pratique inoffensif : ces catalogues (`class`, `type`, `spell`) exigent un texte non vide au seed. [apps/web/src/app/features/characters/character-sheet/character-sheet.html:227,240,299]
- [P:BASSE] Aucune sémantique ARIA de divulgation (`aria-haspopup`/`aria-expanded`) sur les déclencheurs de terme — pattern hérité tel quel de `.sheet__detail-trigger` (31.2), reproduit à l'identique par la 31.3 sur les nouveaux emplacements (`class-step`, `type-step`) ; pas une régression introduite par cette story, mais jamais corrigé depuis. [apps/web/src/app/shared/detail-surface/detail-surface.html]

## Deferred from: code review of 31-4-refonte-du-parcours-de-creation-de-personnage (2026-09-20)

- [P:BASSE] La surface de détail modale (desktop) ne verrouille pas le défilement de la page derrière le voile — conséquence du passage en modal (31.4) ; la feuille mobile se comporte pareil depuis la 31.2.
- [P:BASSE] L'option de classe est structurée (tableau + récit) dans l'assistant mais en `body` simple sur la fiche (`ClassChoiceDisplay` ne porte que l'effet résolu du talent parent) — à unifier si la fiche reçoit le talent parent complet.

## Deferred from: bmad-review (Adversarial/Edge-Case Hunter/Verification Gap) of 29-15-un-bouton-clair-pour-creer-son-personnage-depuis-la-partie (2026-09-21)

- [P:MOYENNE] Aucune garde côté route pour `/parties/:id/characters/new` — la 29.15 gate uniquement les points d'entrée UI (bouton, slot roster, atterrissage d'onglet) ; une URL directe/en favori vers l'assistant de création reste ouverte sur un système sans module ou une partie clôturée, même après cette story. Gelé explicitement hors périmètre par la story elle-même (`Boundaries & Constraints → Never : « Ne pas modifier la garde 404 de character-wizard.ts »`) — la garde côté route est prévue par la validation serveur de la story 29.17, pas avant. [apps/web/src/app/features/characters/character-wizard/character-wizard.ts]
- [P:BASSE] `packages/shared/src/index.ts` (`GAME_SYSTEMS[].module`) et `apps/api/src/game-systems/supported-game-systems.ts` (`SUPPORTED_GAME_SYSTEMS`) restent deux listes maintenues indépendamment, protégées seulement par un test de parité (`supported-game-systems.spec.ts`) ajouté lors de la revue interne du 2026-09-21 — pas par une dérivation structurelle qui rendrait la divergence impossible. Amélioration naturelle pour la story 29.17, qui touche déjà ce terrain côté serveur.
- [P:BASSE] `character.no_character_yet` (onglet « Ma fiche ») affiche le même message générique que la raison soit « système sans module », « partie clôturée » ou « pas encore créé » — le bouton disparaît sans que le joueur sache pourquoi dans les deux premiers cas. Corriger exigerait 2 clés thématisées supplémentaires ×3 thèmes et une logique de branchement ; déjà noté comme rejet `low` dans le Review Triage Log de la story lors de sa revue interne, reconduit ici pour rester tracé explicitement plutôt que noyé dans un paragraphe de log. [apps/web/src/app/features/parties/partie-detail/partie-detail.html:234, apps/web/src/app/core/theme/tones.ts]

## Deferred from: bmad-code-review (Adversarial/Edge-Case Hunter/Simplification/Reuse/Efficiency/Altitude/Conventions) of 29-17-seuls-les-systemes-jouables-sont-proposes-a-la-creation-dune-partie (2026-09-22)

- [P:MOYENNE] `PartiesService.getOwned()` lit la partie hors transaction ; toute méthode qui l'utilise (`update()`, `convertKind()`, `removeMember()`, etc.) évalue ensuite ses règles métier contre cet instantané figé avant d'écrire séparément — une vraie fenêtre TOCTOU (deux appels concurrents sur la même partie peuvent s'entrelacer). Pas introduit par la story 29.17 : `convertKind()` (Story 29.14), donnée en exemple du « bon » patron transactionnel dans les commentaires de ce même fichier, a exactement la même faille (ses règles évaluent `partie.kind`/`partie.closedAt` lus AVANT la transaction, seuls les comptages dérivés sont relus dedans). 29.17 étend la garde `gameSystemId` au même instantané non-transactionnel plutôt que de la corriger, décision assumée en revue : corriger une seule méthode (`update()`) en dupliquant la logique d'ownership de `getOwned()` créerait une incohérence avec les autres appelants qui garderaient la faille ; la corriger correctement exige de revoir `getOwned()` et tous ses appelants ensemble — hors périmètre de cette story et de sa revue. **Nouvelle occurrence confirmée par la revue de la story 31.6 (2026-09-22)** : `PartiesService.setVisibilityLocks()` lit via `getOwned()` puis écrit dans une transaction séparée — si la Partie est supprimée entre les deux, `createMany` viole la contrainte de clé étrangère (`PartieVisibilityLock_partieId_fkey`) et lève une 500 non gérée au lieu d'une 404 propre. Même faille architecturale, pas un défaut introduit par 31.6. [apps/api/src/parties/parties.service.ts:273-278 (`getOwned`), :355-391 (`update`), :404-490 (`convertKind`), :1108-1140 (`setVisibilityLocks`, Story 31.6)]

## Deferred from: code review of spec-31-6-cadenas-de-visibilite-modele-et-filtrage-serveur (2026-09-22)

- [P:BASSE] `SetVisibilityLocksDto.LOCKABLE_FIELD_KEYS` est une liste Ryuutama codée en dur, dupliquée du littéral `sheetSchema` de `GameSystemService.getSchema()` — contournement assumé d'un cycle de modules (`PartiesModule` ↔ `GameSystemModule`), documenté en commentaire. Contredit l'objectif d'architecture de l'épic 31 (« l'unité de verrouillage est déclarée par le schéma… un futur système de jeu hérite du mécanisme sans retouche de l'écran »). Sans conséquence tant qu'un seul système de jeu (Ryuutama) existe dans ce projet ; corriger exigerait de sortir le schéma verrouillable dans un provider partagé (ou un `forwardRef()`), une restructuration de modules hors périmètre de la story 31.6. [apps/api/src/parties/dto/set-visibility-locks.dto.ts, apps/api/src/game-systems/game-system.service.ts:222-267]
- [P:BASSE] Deux appels `PUT /parties/:id/visibility-locks` concurrents sur la même Partie (double clic, deux onglets) peuvent, sous l'isolation `READ COMMITTED` par défaut de Prisma, atteindre `createMany` avec la même ligne cible avant que l'un des deux ait committé — violation de la contrainte unique (500) plutôt qu'un remplacement déclaratif propre. Le patron dont `setVisibilityLocks()` s'inspire explicitement (`PollService.setOptions()`, Story 36.10) a la même absence de verrou contre l'écriture concurrente — dette systémique du projet sur ce type d'endpoint déclaratif « remplace tout », pas une négligence propre à la story 31.6. [apps/api/src/parties/parties.service.ts (`setVisibilityLocks`), apps/api/src/poll/poll.service.ts (`setOptions`)]

## Deferred from: code review (8 angles, effort high) of the crash-fix/masked-indicator commits (2026-09-22)

- [P:MOYENNE] Seuls 2 des 10 clés verrouillables (`attributes`, `equipment`) portent une indication « Masqué par le MJ » côté écran — `classId`, `specialtyTypeId`, `typeId`, `weaponId`, `customWeapon`, `fetiqueObject`, `startingEquipment`, `narrative` restent silencieusement absents quand verrouillés, indiscernables d'un champ simplement non renseigné. Portée volontairement limitée à Attributs/Équipement pour ce correctif (les deux seuls signalés par l'utilisateur en testant la story 31.7). [apps/web/src/app/features/characters/character-sheet/character-sheet.html, apps/api/src/game-systems/game-system.service.ts:256-292]
- [P:BASSE] `PartieDetail.classLabel()` (roster/cartes de compagnons) renvoie une chaîne vide quand `classId` est verrouillé, sans distinction avec « pas de classe choisie » — même défaut de fond que celui corrigé pour Attributs/Équipement, sur un point d'entrée non audité par ce correctif. [apps/web/src/app/features/parties/partie-detail/partie-detail.ts:340-344]
- [P:BASSE] `equipment-pdf.service.ts` affiche `0` pour `limite_enc` quand `derived` est masqué, alors que `ryuutama-pdf.service.ts` omet purement les champs concernés pour le même état — déjà noté dans les Implementation Notes du spec 31.6 comme « à harmoniser si besoin lors de la 31.7 », jamais repris depuis. [apps/api/src/characters/equipment-pdf.service.ts:37, packages/game-rules/src/ryuutama/ryuutama-pdf.service.ts]

## Deferred from: bmad-build review of 32-2-reorganisation-de-la-vue-de-partie (2026-09-22)

- [P:BASSE] Le bandeau transitoire `notice()` n'est déclenché que par les 3 actions de l'onglet
  Invitations (inviter, inviter par e-mail, copier un lien) mais s'affiche dans l'onglet Détails — un
  onglet différent de celui où l'action a lieu, donc rarement visible au moment où il compte (défaut
  préexistant, non introduit par la 32.2, qui n'a fait que déplacer sa position à l'intérieur de
  l'onglet Détails, de la zone Action vers la zone Consultation). Corriger le fond exigerait de revoir
  où ce bandeau vit (mécanisme partagé/toast plutôt qu'un `<p>` local à un onglet précis) — hors
  périmètre de cette story. [apps/web/src/app/features/parties/partie-detail/partie-detail.html:109-111, apps/web/src/app/features/parties/partie-detail/partie-detail.ts:663,685,698,739]

## Deferred from: bmad-build review of spec-31-7-ecran-de-configuration-des-cadenas (2026-09-22)

- [P:MOYENNE] Nouvelle occurrence confirmée par la revue de la story 31.7 : `SetVisibilityLocksDto.LOCKABLE_FIELD_KEYS`/`LOCKABLE_SUB_FIELDS` (déjà signalé `P:BASSE` ci-dessus lors de la revue de la 31.6) restent une liste Ryuutama figée, dupliquée manuellement du littéral `sheetSchema`. La 31.7 en fait le premier consommateur réel qui dérive ses cases à cocher *uniquement* de `sheetSchema` (AC1) — toute future clé `lockable` ajoutée au schéma sans mise à jour correspondante de cette liste ferait apparaître une case dans l'écran MJ dont l'enregistrement échouerait côté serveur (validation DTO), sans message clair pour expliquer pourquoi. Vérifié sans conséquence aujourd'hui (les 10 clés des deux côtés sont identiques), mais le risque n'est plus seulement architectural depuis cette story : il est maintenant atteignable par un MJ via l'écran. [apps/api/src/parties/dto/set-visibility-locks.dto.ts, apps/api/src/game-systems/game-system.service.ts:249-296, apps/web/src/app/features/parties/visibility-locks/visibility-locks.ts]

## Deferred from: bmad-build planning of spec-32-3-etats-de-scenario-et-de-seance (2026-09-23)

- [P:MOYENNE] La bande d'état verticale (`StateRail`, 4 px sur le bord gauche d'une carte), prescrite
  par la conception comme « équivalent exact » du badge d'état (`DESIGN.md:205-207`), est exclue du
  périmètre de la story 32.3 — décision utilisateur du 2026-09-23. Motif : la story 32.2 vient de
  poser des liserés de zone de 3 px (Action/Consultation/Référence) qui classent la *nature* du
  contenu et non un statut ; superposer une bande d'état sur les mêmes cartes créerait deux liserés
  concurrents à arbitrer visuellement. À reprendre avec la story 32.4, qui refait les cartes de la
  chronologie. [apps/web/src/app/shared/status-badge/ (à créer par 32.3), apps/web/src/app/features/parties/partie-detail/partie-detail.scss]

## Deferred from: bmad-build implementation of spec-32-3-etats-de-scenario-et-de-seance (2026-09-23)

- [P:MOYENNE] `docker compose exec web pnpm exec tsc --noEmit` **ne vérifie rien** : `apps/web/tsconfig.json`
  porte `"files": []` + `references`, donc sans `-b` la commande sort 0 sans compiler une ligne. Elle
  est pourtant citée comme preuve de typage front dans plusieurs specs du dépôt (32.2 et antérieures).
  La vraie vérification de types du front est `pnpm build` (compilateur Angular). À trancher : soit
  corriger la commande (`tsc -b`), soit remplacer toutes ses occurrences dans les specs par `pnpm build`.
  Constaté pendant l'implémentation de la 32.3 — aucune story n'est en cause, le trou est ancien.
  [apps/web/tsconfig.json]
- [P:MOYENNE] Deux tests API échouent sur des **dates figées désormais échues**, même famille que les
  deux échecs web connus de `calendar-view.spec.ts` : `party-signals.service.spec.ts:242`
  (`nextSessionDate: '2026-09-01'`, attendu passé) et `parties.service.spec.ts:1527`
  (`getAvailableSlots` sur `2026-09-20`, attend `UNAVAILABLE`, obtient `UNKNOWN`). Vérifié : aucun des
  deux chemins ne passe par `toSeanceDto()`, ils échouaient donc déjà avant la story 32.3. Le remède
  de fond est le même pour les quatre : figer l'horloge (`jest.useFakeTimers`/`vi.setSystemTime`) au
  lieu de dater les fixtures en dur. **La CI est rouge tant que ce n'est pas fait.**
  [apps/api/src/parties/party-signals.service.spec.ts:242, apps/api/src/parties/parties.service.spec.ts:1527, apps/web/src/app/features/calendar/calendar-view/calendar-view.spec.ts:1933,2077]

## Deferred from: bmad-build review of spec-32-3-etats-de-scenario-et-de-seance (2026-09-23)

- [P:MOYENNE] `loadRetrospectiveNotes()` calcule la fenêtre rétrospective d'un scénario clôturé avec
  `s.poll?.chosenDate ?? s.inscription?.dateValidee` et ignore donc une séance datée par héritage
  (`Seance.dateValidee` seul, campagne linéaire) : ses notes de personnage sortent de la fenêtre et
  n'apparaissent pas dans la rétrospective. Défaut ANTÉRIEUR à la story 32.3, qui ne l'aggrave pas —
  mais le correctif est devenu trivial depuis qu'elle expose la date effective (`?? s.dateValidee`).
  [apps/api/src/scenarios/scenarios.service.ts:1165-1166]
- [P:MOYENNE] `CalendarView.allCalendarEntries()` résout la date d'une séance par
  `poll?.chosenDate ?? inscription?.dateValidee` et écarte l'entrée quand les deux manquent : une
  séance datée par héritage n'apparaît ni dans le calendrier ni dans l'Agenda. Même racine que
  l'entrée ci-dessus, même antériorité ; la story 32.3 n'a câblé aucun badge sur ces surfaces.
  [apps/web/src/app/features/calendar/calendar-view/calendar-view.ts:481,511]
- [P:BASSE] `todayKey` est figé à la construction dans `SeanceList` et `PartieDetail` (patron repris
  de `CalendarView`) : un écran laissé ouvert au-delà de minuit continue d'afficher « demain soir » le
  jour même et ne bascule jamais en « À débriefer ». S'y ajoute la dette UTC/local connue du projet —
  `todayKey` est dérivé en heure locale alors que les clés de date viennent d'ISO UTC. Aucun des deux
  n'est introduit par la story 32.3, qui applique le patron existant ; les corriger suppose de traiter
  le changement de jour pour TOUS les écrans qui gèlent l'horloge.
  [apps/web/src/app/features/scenarios/seance-list/seance-list.ts, apps/web/src/app/features/parties/partie-detail/partie-detail.ts, apps/web/src/app/features/calendar/calendar-view/calendar-view.ts]
- [P:BASSE] La vue Agenda garde sa propre copie des quatre teintes de statut
  (`calendar-agenda-view.scss:180-235`) au lieu de rendre `<app-status-badge>` : la story 32.3 a
  mutualisé les fonctions pures (`core/status/status-badge.model.ts`) mais pas le rendu. Deux feuilles
  à tenir d'accord quand la palette bouge. Migration à faire quand l'Agenda sera retouché.
  [apps/web/src/app/features/calendar/calendar-agenda-view/calendar-agenda-view.scss, apps/web/src/app/shared/status-badge/status-badge.scss]
- [P:MOYENNE] La bande d'état (`StateRail`, 4 px) reste non livrée. La story 32.3 l'avait explicitement
  renvoyée « à la story 32.4, quand les cartes seront refaites » ; la 32.4 a refondu la chronologie
  avec une **pastille de nœud** (ancrage sur la ligne) et n'a introduit aucune bande — la story 32.2
  interdit par ailleurs d'ajouter un liseré concurrent de ses trois liserés de zone. Aucun composant
  `StateRail` n'existe donc nulle part dans `apps/web`. À trancher explicitement : soit la pastille
  de nœud + le badge suffisent et la bande est abandonnée, soit elle reste à concevoir pour les
  cartes de partie (où la maquette `signaletique-etats.html` §3 la montre).
  [_bmad-output/implementation-artifacts/spec-32-3-etats-de-scenario-et-de-seance.md:31, _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/mockups/signaletique-etats.html]
- [P:MOYENNE] La cascade de résolution de la date effective d'une séance
  (`poll.chosenDate ?? dateValidee ?? inscription.dateValidee`) existe maintenant en quatre copies :
  `SeanceList.resolvedDate()`, `status-derivation.dateKeyOf()`, `ScenarioTimeline.seanceIso()` (story
  32.4) — et deux variantes de `CalendarView` qui oublient encore la racine ajoutée en 32.3. Tant
  qu'elle n'est pas extraite dans un helper partagé, « une seule cascade pour toute l'app » ne tient
  que par copier-coller, et la divergence de `CalendarView` en est la preuve.
  [apps/web/src/app/features/scenarios/seance-list/seance-list.ts:181, apps/web/src/app/core/status/status-derivation.ts:109, apps/web/src/app/features/scenarios/scenario-timeline/scenario-timeline.ts:56, apps/web/src/app/features/calendar/calendar-view/calendar-view.ts:481,511]
- [P:BASSE] Les séances sont numérotées et affichées dans leur ordre de **création**
  (`orderBy: { createdAt: 'asc' }` côté serveur, `$index + 1` côté gabarit), jamais dans l'ordre de
  leurs dates : une séance créée après coup mais datée plus tôt s'affiche « Séance 2 · 12 juin » sous
  « Séance 1 · 3 juil. ». La story 32.4 a corrigé l'ordre au niveau du **nœud** et laissé celui des
  lignes de séance intact, volontairement — trier ici seulement ferait diverger la chronologie de
  `SeanceList`, qui numérote de la même façon. À décider une fois pour toutes, sur les deux surfaces
  ensemble : où la numérotation des séances est-elle définie ?
  [apps/api/src/scenarios/scenarios.service.ts:1091, apps/web/src/app/features/scenarios/seance-list/seance-list.html:8, apps/web/src/app/features/scenarios/scenario-timeline/scenario-timeline.html]
- [P:BASSE] La story 32.4 ajoute du petit texte (plage de dates d'un nœud à 0,75 rem, libellé de
  séance à 0,8125 rem) sur `--jdr-text-muted`, jeton dont le dépôt a déjà consigné qu'il plafonne à
  ~4,4:1 en Medieval Steampunk. Le correctif est une affaire de **palette** et reste attribué à
  l'epic 35 ; noté ici parce que la surface exposée à ce plafond grandit.
  [apps/web/src/app/features/scenarios/scenario-timeline/scenario-timeline.scss, apps/web/src/styles.scss]

## Deferred from: bmad-review (Blind Hunter) of 33-1-fiche-homme-dragon-refondue (2026-09-23)

- [P:BASSE] La commande de vérification suggérée par le gabarit de spec (`pnpm vitest run <fichier>`) échoue dans ce dépôt — `apps/web` teste via le builder Angular `ng test`, pas un `vitest.config.ts` autonome (confirmé sur la story 33.1 : `pnpm vitest run` plante sur `window is not defined`). Rien dans l'outillage BMAD (gabarit de spec, `docs/checklist.md`) ne documente la bonne commande (`docker compose exec web pnpm exec ng test web --watch=false --include "<fichier>"`), donc chaque nouvelle story redécouvre le même échec. Pas un défaut du code de cette story — un correctif de doc/gabarit BMAD, hors périmètre d'un `bmad-build`.
  [_bmad/scripts/render_skill.py, docs/checklist.md]

## Deferred from: bmad-build de 33-2-les-souffles-de-mon-dragon — écarts aux règles de l'Homme Dragon (2026-09-25)

Source des règles : `docs/dragons.md` (transcription du livre fournie par l'utilisateur le 2026-09-25). À traiter via `bmad-correct-course` sur l'épic 33 — la Q-13 (2026-08-05) reposait sur une confusion souffles/éveils.

- [P:BASSE] Éveils : la famille (Déplacement / Combat) est désormais portée par `eveil-powers.json` (champ `famille`, 2026-09-25) mais n'est affichée nulle part. [apps/api/game-systems/ryuutama/data/eveil-powers.json]
- source_spec: `_bmad-output/implementation-artifacts/spec-33-2-les-souffles-de-mon-dragon.md`
  summary: Le seed Ryuutama fait des upserts sans jamais supprimer : une entrée retirée ou renommée d'un JSON reste en base et continue de s'afficher.
  evidence: `seedRyuutama()` (`apps/api/src/game-systems/game-system.service.ts`) n'a aucun `deleteMany` ; comportement préexistant, rendu visible par la refonte de `souffles.json`.
- source_spec: `_bmad-output/implementation-artifacts/spec-33-2-les-souffles-de-mon-dragon.md`
  summary: Le README du seed (`apps/api/game-systems/ryuutama/README.md`) ne liste que 5 des 20+ fichiers de `data/`, dont pas `souffles.json`, alors que l'erreur de bootstrap renvoie vers lui.
  evidence: liste figée depuis le palier 2 ; chaque nouveau content-type (dont `souffle`) l'a laissée de côté.
- source_spec: `_bmad-output/implementation-artifacts/spec-33-2-les-souffles-de-mon-dragon.md`
  summary: Dans chaque famille de souffles, l'ordre affiché suit l'ordre renvoyé par la base, pas celui du livre (ex. « Aide aux PNJ » commence par Retrouvailles et Fuite).
  evidence: constaté au contrôle visuel du 2026-09-26 ; `ContentEntry` ne porte aucune position et `getContent()` ne trie pas selon le fichier JSON.

## Deferred from: bmad-build de 33-4-export-pdf-au-niveau-des-fiches-joueur (2026-09-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-33-4-export-pdf-au-niveau-des-fiches-joueur.md`
  summary: La règle de disponibilité des souffles (communs par famille, race, autres races dès le niveau 3) et les consignes de famille sont désormais dupliquées entre `packages/game-rules/src/ryuutama/homme-dragon-souffles.ts` (`availableSouffles()`, export PDF) et `homme-dragon-sheet.ts` (fiche web).
  evidence: la spec 33.4 interdit de toucher la fiche web ; à faire converger en faisant consommer `availableSouffles()` par `homme-dragon-sheet.ts` (dont les libellés de race dupliquent aussi `RACE_LABELS`).
- source_spec: `_bmad-output/implementation-artifacts/spec-33-4-export-pdf-au-niveau-des-fiches-joueur.md`
  summary: Les pages de souffles ajoutées reprennent l'ordre du catalogue renvoyé par la base, pas celui du livre (même écart déjà consigné pour la fiche web).
  evidence: `getContent()` ne trie pas selon le fichier JSON ; voir l'entrée de la story 33.2.
- source_spec: `_bmad-output/implementation-artifacts/spec-33-5-mes-hommes-dragons-dans-personnages.md`
  summary: La liste « Personnages » ne recharge pas les Hommes Dragons sur changement temps réel (seule la ligne de création suit le canal `user:{id}`).
  evidence: `MyCharacters` ne lit `GET /me/homme-dragons` qu'à `ngOnInit`, le bloc figé de la 33.5 excluant tout câblage temps réel neuf. Un dragon créé depuis un autre appareil fait disparaître la ligne « Créer un Homme Dragon » sans faire apparaître la carte avant rechargement ; à évaluer selon `docs/checklist.md` (effet sur `HommeDragonService.changed()` ou rechargement sur le signal `HOMME_DRAGON_A_CREER`).
- source_spec: `_bmad-output/implementation-artifacts/spec-33-7-capacites-de-niveau.md`
  summary: L'export PDF de l'Homme Dragon (33.4) n'imprime ni l'artefact cadeau ni les souffles rituels ; seul `sheetData.artefact` est imprimé.
  evidence: `homme-dragon-pdf-field-map.ts` n'a aucun champ pour le cadeau et le gabarit PDF ne prévoit pas d'emplacement ; la spec 33.7 l'exclut, mais un MJ de niveau 4+ peut s'attendre à le retrouver sur l'export (décision produit + éventuel champ de gabarit à trancher).
- source_spec: `_bmad-output/implementation-artifacts/spec-33-6-reserve-de-souffles.md`
  summary: `HommeDragonService.update()` (PATCH) lit puis réécrit tout `sheetData` sans verrou de ligne, alors que `setReserveSlot()`, `chooseEveilPower()` et `chooseArtefactCadeau()` écrivent sous `SELECT … FOR UPDATE`.
  evidence: un PATCH lu avant et écrit après un geste de réserve efface ce geste (mise à jour perdue) ; défaut préexistant, rendu plus atteignable par l'écriture de la réserve à chaque clic ; correction = faire passer `update()` par la même transaction verrouillée.
- source_spec: `_bmad-output/implementation-artifacts/spec-33-8-un-homme-dragon-pour-plusieurs-aventures.md`
  summary: Aucun test sur Postgres réel pour la migration `20261004120000_homme_dragon_multi_aventures` (rattrapage, garde de doublons, contrôle des orphelins) ni pour les verrous `FOR NO KEY UPDATE`, l'`updateMany` conditionnel et la course create/link.
  evidence: la CI ne migre qu'une base vide et les seuls specs d'intégration existants sont `email` et `notifications` ; la migration supprime `HommeDragon.partieId`, donc une erreur de rattrapage perdrait le lien en silence. Vérifié à la main par l'implémentation sur une base jetable ; sans conséquence tant qu'il n'y a aucune production (avant le Palier 11).
- source_spec: `_bmad-output/implementation-artifacts/spec-33-8-un-homme-dragon-pour-plusieurs-aventures.md`
  summary: « Ajouter une aventure » (fiche d'un Homme Dragon) ne propose jamais une partie `TERMINEE`, car la liste est lue dans le signal `HOMME_DRAGON_A_CREER`.
  evidence: le signal exclut les parties terminées depuis la story 29.7 ; un MJ qui retire une partie clôturée de son Homme Dragon ne peut la lui rattacher que depuis le panneau d'aventure de cette partie. Une liste dédiée (ou un champ explicite) lèverait la limite.
- source_spec: `_bmad-output/implementation-artifacts/spec-33-8-un-homme-dragon-pour-plusieurs-aventures.md`
  summary: L'historique de la fiche Homme Dragon affiche les participants par pseudo brut (`participants.join(', ')`) au lieu de la convention joueur / personnage (AD-2, `IdentityLabel`).
  evidence: `HommeDragonDto.historique[].participants` est un tableau de pseudos depuis la story 10.2 ; les voyageurs de la section « Aventures » passent déjà par `IdentityLabel`, d'où l'incohérence visible sur une même fiche.
- source_spec: `_bmad-output/implementation-artifacts/spec-34-1-messages-derreur-veridiques-a-la-connexion.md`
  summary: Épingler par un test côté API le contrat de `POST /auth/login` dont dépend la classification des messages de connexion (corps du `401` par défaut = `Unauthorized`, `401` de réinitialisation à message propre, `429` au sixième essai).
  evidence: la page de connexion distingue « identifiants invalides » et « compte à réinitialiser » d'après le corps du `401` ; `local.strategy.spec.ts` ne vérifie que la classe de l'exception et la phrase de réinitialisation, et aucun e2e ne couvre la route de connexion ni la limite de tentatives. Un changement de message ou un filtre d'exceptions côté API ferait afficher la mauvaise cause sans test rouge. Une constante ou un code stable dans `packages/shared` rendrait le couplage explicite.
- source_spec: `_bmad-output/implementation-artifacts/spec-34-2-champ-de-mot-de-passe-revelable-lien-mort-retire.md`
  summary: Les trois champs de mot de passe de l'écran de compte (mot de passe actuel pour le changement d'e-mail, mot de passe actuel et nouveau mot de passe) n'ont aucun attribut `autocomplete`, contrairement à la connexion, l'inscription et la réinitialisation.
  evidence: `account.html` ; sans `current-password` / `new-password`, un gestionnaire de mots de passe peut remplir le mauvais champ. Préexistant : la story 34.2 n'y ajoute que la bascule de révélation et doit conserver `autocomplete` tel quel.
- source_spec: `_bmad-output/implementation-artifacts/spec-34-3-mise-en-forme-des-ecrans-dauthentification.md`
  summary: Sur « rejoindre », si `AuthService.loadSession()` rejette, la page reste indéfiniment sur « Chargement… » (aucun titre, aucune action, aucune sortie).
  evidence: `join.ts` `ngOnInit` appelle `await this.auth.loadSession()` hors du `try` qui ne protège que `preview()` ; préexistant (inchangé depuis `2985446`), exposé par la 34.3 puisque le conteneur `role="status"` annonce désormais ce chargement.
- source_spec: `_bmad-output/implementation-artifacts/spec-34-3-mise-en-forme-des-ecrans-dauthentification.md`
  summary: Le bouton « Rejoindre » de « rejoindre » n'a aucun état d'envoi : un double clic envoie deux demandes de `join()`.
  evidence: `join.html` / `join.ts` `join()` sans signal `loading` ni `disabled` ; préexistant, les autres formulaires d'authentification désactivent leur bouton pendant l'envoi.
- source_spec: `_bmad-output/implementation-artifacts/spec-distinguer-creation-personnage-et-homme-dragon.md`
  summary: DESIGN.md §7.3 (ligne « À forger ») ne décrit que la ligne neutre ; documenter la variante Homme Dragon (bordure et pastille `accent-2`, `NatureMarker` sous le libellé).
  evidence: la ligne d'Homme Dragon est désormais teintée et marquée dans `character-creation-entries` ; le document de conception, source de vérité visuelle, n'en dit rien.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-1-decoupe-des-themes-et-renommage.md`
  summary: La garde de parité des clés de thème (erreur de type) n'est exécutée ni par la CI ni par Vitest : seul `pnpm build` du web la voit, et la CI ne construit pas le front.
  evidence: `.github/workflows/ci.yml` ne lance que types et build de l'API plus les tests ; une clé retirée à `atelier-cuivre` fait échouer `pnpm build` (TS2741) mais passerait la CI. Préexistant (même constat pour tout le typage du front), exposé par la 35.1 qui en fait la garantie centrale.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-2-classement-des-textes-non-thematises.md`
  summary: Sortir du front les textes propres à Ryuutama encore codés en dur (noms de races, « Saison d'affinité », « Pouvoirs d'éveil », libellés de fiche, barème XP…) vers un fichier lié au système de jeu, hors thème.
  evidence: décision du 2026-10-05 — ces textes ne relèvent pas du thème et doivent vivre avec le système de jeu ; l'inventaire de la 35.2 en relève plusieurs centaines dans `features/characters`, `homme-dragon`, `scenarios`, `parties`. Une partie du contenu (classes, types, introductions d'étape) est déjà seedée côté API (`GameSystemContentDto`). Emplacement à trancher à la planification : module front par système, `packages/game-rules`, ou catalogue seedé.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-2-classement-des-textes-non-thematises.md`
  summary: Rendre le paramètre `tone` obligatoire dans les fonctions pures de libellés du calendrier et des hommes-dragons (`answerLabel`, `participationAriaLabel`, `groupAriaLabel`, `memberStatusWord`, `buildWeek`, `hommeDragonAventuresLabel`) et le tester avec un dictionnaire différent du thème de référence.
  evidence: elles reçoivent un `tone` optionnel dont le défaut est `TONE_MAP['grimoire-emeraude']` ; un appelant qui l'oublie reste silencieusement sur le thème de référence, sans erreur, alors que les textes sont aujourd'hui identiques dans les trois thèmes. Devient faux dès que la 35.3 réécrit les voix. Les specs des utilitaires n'appellent jamais avec un `tone` explicite.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-2-classement-des-textes-non-thematises.md`
  summary: Typer les clés de ton (accesseur `ToneKey`) ou tester que toutes les clés référencées dans le code existent au registre, y compris les tables de clés dynamiques (`toneTitle`, `STATUS_LABEL_KEYS`, `ANSWER_WORD_KEYS`, `KIND_LABEL_KEYS`, sélections `_one`/`_many`).
  evidence: `TONE_MAP` est typé `Record<Theme, Record<string, string>>` (choix de la 35.1) : une faute de frappe dans une clé compile et rend `undefined`. Aujourd'hui aucune des ~531 clés littérales n'est absente (vérifié par script), mais rien ne le garantit pour la suite.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-2-classement-des-textes-non-thematises.md`
  summary: Sortir du code les accords et l'ordre des mots des phrases de la boîte de conflit du calendrier (`kindLabel` + `s` en dur, « Tu déclares <b>…</b> … », mots d'état `calendar.week_status_*` réutilisés comme mots visibles) ainsi que les concaténations de `roster-row.util.ts`.
  evidence: le comportement a été conservé à l'identique, mais le singulier/pluriel et l'ordre des mots sont figés dans le code : une voix réécrite en 35.3 (« libres » au lieu de « disponibles ») donnerait une phrase fausse, et reformuler les mots d'état d'accessibilité changerait la phrase visible de la boîte.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-2-classement-des-textes-non-thematises.md`
  summary: Ajouter une assertion de rendu pour les textes paramétrés de la 35.2 restés sans test : `invité par {pseudo}` (dashboard), `Montant suggéré : {amount} XP` et `{xp} XP actuel` (panneau d'XP), avertissement d'heure illisible `{raw}` (séances), « et 1 autre » (agenda, `rest === 1`), `bannerCloseLabel` (shell).
  evidence: un `_one`/`_many` inversé ou un trou oublié ne ferait échouer aucun test existant ; risque surtout cosmétique.
- source_spec: `_bmad-output/implementation-artifacts/spec-35-3-revue-editoriale-des-trois-themes.md`
  summary: Rétablir une garde de compilation pour les libellés de type de partie : `partieKindLabelKey()` construit `partie.kind_${kind}` sans que l'ajout d'un `PartieKind` exige sa clé de ton.
  evidence: l'ancienne table `Record<PartieKind, string>` échouait à la compilation pour un type sans clé ; la clé construite ne rend qu'au runtime l'énumération brute (repli `?? kind` de `dashboard.ts` et `partie-detail.ts`). Aucun type n'est ajouté aujourd'hui ; la parité `partie.kind_*` est testée sur une liste en dur de trois types.

- source_spec: `_bmad-output/implementation-artifacts/spec-37-1-figer-le-comportement-actuel-du-jdr-par-des-tests-de-caracterisation.md`
  summary: Extract a shared `configureApp(app)` from `apps/api/src/main.ts` and use it in `apps/api/test/characterization/harness.ts` so the e2e harness cannot drift from the real middleware chain.
  evidence: The harness copies main.ts by hand and already differs (no cookie maxAge, no enableCors); story 37.1 forbids touching `src/`.
- source_spec: `_bmad-output/implementation-artifacts/spec-37-1-figer-le-comportement-actuel-du-jdr-par-des-tests-de-caracterisation.md`
  summary: Isolate reminder tests from the dev database (dedicated test DB or restore of stamped rows) so `sendDueReminders()` no longer marks the developer's own due parties as reminded.
  evidence: Both `characterization/reminders.e2e-spec.ts` and `notifications.integration.spec.ts` run the global reminder query against the shared dev DB; best handled after 37.9 moves `reminderSentAt` onto Seance.

- source_spec: `_bmad-output/implementation-artifacts/spec-37-2-remplacer-mjid-par-ownerid-le-proprietaire-de-la-partie.md`
  summary: Decide the account-deletion fate of `InviteLink.createdBy`, `Invitation.inviter` and `XpDistribution.mj`, still `onDelete: Cascade`, so deleting an owner does not silently wipe a surviving partie's links, invitations and XP history.
  evidence: AD-5 forbids a database cascade on an owner and routes account deletion through AD-11; story 37.2 only switched `Partie.ownerId` to SetNull.
- source_spec: `_bmad-output/implementation-artifacts/spec-37-2-remplacer-mjid-par-ownerid-le-proprietaire-de-la-partie.md`
  summary: Add an index on `Partie.ownerId` (no index existed on `mjId` either).
  evidence: listForUser, availability, party-signals and account announcements all filter on it.
- source_spec: `_bmad-output/implementation-artifacts/spec-37-2-remplacer-mjid-par-ownerid-le-proprietaire-de-la-partie.md`
  summary: Make the web read `PartieDto.role === 'mj'` instead of comparing `ownerId` with the current user (partie-detail.ts, homme-dragon-creation-page.ts).
  evidence: Shared doc says role is computed server-side and never derived client-side (AD-15); owner and MJ diverge with ralliement (epic 38).

- source_spec: `_bmad-output/implementation-artifacts/spec-37-2-remplacer-mjid-par-ownerid-le-proprietaire-de-la-partie.md`
  summary: Make date-dependent tests clock-independent (api `party-signals.service.spec.ts` L261 `2026-09-01`, `parties.service.spec.ts` L1521-1563 `2026-09-20`, web `calendar-view.spec.ts` rail tests) — they now fail because those dates are in the past.
  evidence: Failures reproduce independently of story 37.2 (dates untouched by its diff); the API ones pass with the clock faked to 2026-08-15.

- source_spec: `_bmad-output/implementation-artifacts/spec-37-3-extraire-levenement-de-base-le-scenario-devenant-son-extension-jdr.md`
  summary: Add a repeatable migration-on-data check (seed at parent commit, `migrate deploy`, compare per-partie Scenario/Seance counts, ids, titles, createdAt) for the porte's data-moving migrations before the Palier 11 deploy.
  evidence: CI applies migrations to an empty DB; 37.2/37.3 backfills were only verified by hand on the dev DB (md5 before/after).

- source_spec: `_bmad-output/implementation-artifacts/spec-37-5-declarer-les-systemes-et-leurs-capacites-dans-un-registre-unique.md`
  summary: Gate character creation on the partie's own system (`hasCapability(partie.gameSystemId, 'characters')` and `dto.gameSystemId === partie.gameSystemId`), not on the payload's `gameSystemId`.
  evidence: `CharacterService.create` checks `dto.gameSystemId` (pre-existing); a Ryuutama character can be posted into a partie on another system. Natural home: 37.7 capability guards.
- source_spec: `_bmad-output/implementation-artifacts/spec-37-5-declarer-les-systemes-et-leurs-capacites-dans-un-registre-unique.md`
  summary: Before epic 38 opens `ralliement`, enforce `kindsOf(gameSystemId)` at partie creation/conversion and make the web partie form follow family rules (no cross-family system choice, no kind conversion outside `jdr`).
  evidence: Registry declares ralliement kinds ONE_SHOT/CAMPAGNE_EPISODIQUE but nothing enforces them; server refuses what the form would offer.

- source_spec: `_bmad-output/implementation-artifacts/spec-37-6-faire-decider-les-droits-sur-une-partie-et-ses-evenements-par-un-service-unique.md`
  summary: Enforce scenario anti-spoil server-side — members can list BROUILLON scenarios (`findAllForPartie`), read their documents, and `participate()` in a BROUILLON/PASSE scenario through the API; today hiding is front-end only.
  evidence: Found during 37.6 investigation (scenarios.service.ts `findAllForPartie` ~L253, `participate` ~L515, `listDocuments`); out of the porte's constant-behaviour scope. Security-relevant (spoilers leak to players via direct API calls). RESOLVED 2026-10-11 by spec-anti-spoil-serveur-des-scenarios.md.

- source_spec: `_bmad-output/implementation-artifacts/spec-37-7-brancher-les-capacites-jdr-sur-le-service-de-permission-et-interdire-les-lectures-directes.md`
  summary: Make the no-direct-owner-read sweep line-granular (pin allowed owner-read lines/counts per exception file, or move projections/writes behind helpers) instead of whole-file exceptions.
  evidence: A new owner-based right check added inside an excepted file (parties.service.ts, character.service.ts, availability.service.ts) passes the sweep silently.
- source_spec: `_bmad-output/implementation-artifacts/spec-37-7-brancher-les-capacites-jdr-sur-le-service-de-permission-et-interdire-les-lectures-directes.md`
  summary: Add capability guards for the scenario features (`scenarioLifecycle`, `linearCampaign`) in the permission layer, and decide the Draconis demo partie's scenario.
  evidence: Story 37.7 limited its capability table to characters/xp/hommeDragon/groupRoles/announcements writes; scenarios and linear-campaign rules still check kind/status locally.

- source_spec: `_bmad-output/implementation-artifacts/spec-38-1-creer-depuis-un-bouton-den-tete-pour-tout-utilisateur.md`
  summary: Visually check the header create button (pill, icon-only mobile button, icon legibility) in the Forêt Ancienne and Atelier Cuivré themes, and on a real phone (label thresholds 399/422/437 px).
  evidence: The browser session runs on the Grimoire Émeraude account theme; the theme is persisted on the account, so the other two themes were only covered by unit tests on labels.

- source_spec: `_bmad-output/implementation-artifacts/spec-38-2-choisir-quete-ou-ralliement-a-la-creation.md`
  summary: Reconcile the code that assumes the owner is NOT a `Membership` row, now that a ralliement creator is both owner and `ADMIN` member: `common/participant-count.util.ts` (`+1` for the owner, used by availability votes and the poll/scenarios counts), `invitations/invite-links.service.ts` `consumeLink` (409 « déjà le MJ » — a ralliement admin would instead hit the unique-membership conflict), and `EventsService.ownEventsOf` (role test for episodic campaigns).
  evidence: Story 38.2 inserts the creator as `ADMIN` member of a ralliement (AD-5 keeps `ownerId`). All three places are JDR-only today (a ralliement refuses their actions by policy, and the role-split lists exclude ralliements), so nothing breaks yet; epic 39 (invitations, admin management, leave) must handle them when ralliement groups gain members and votes.

- source_spec: `_bmad-output/implementation-artifacts/spec-38-2-choisir-quete-ou-ralliement-a-la-creation.md`
  summary: Decide the "at least one admin" invariant of a ralliement: when the sole ADMIN's account is deleted (Membership cascades, `Partie.ownerId` set null) nobody can edit, delete or manage the partie; design promotion of a remaining member or a deletion path with the account-deletion flow (AD-11).
  evidence: `RALLIEMENT_POLICY` gives PARTIE_DELETE/PARTIE_MEMBER_REMOVE to nobody and role derivation reads `Membership.role` only; reviewers 38.2.
- source_spec: `_bmad-output/implementation-artifacts/spec-38-2-choisir-quete-ou-ralliement-a-la-creation.md`
  summary: Cover the admin cover upload/removal on a ralliement end to end (e2e PUT/DELETE `/parties/:id/cover`, member refused) when the cover story lands.
  evidence: Only the policy cells `PARTIE_COVER_UPDATE/READ` are pinned for ralliement today.

- source_spec: `_bmad-output/implementation-artifacts/spec-38-3-changer-la-couverture-depuis-la-banniere.md`
  summary: By hand in a visible browser window: Tab to the « Changer » chip in the partie form and confirm the focus ring, in the three themes and on a bright cover image; also confirm the chip words (Changer/Échanger/Substituer, Retirer/Ôter/Démonter).
  evidence: The automated Chrome session ran in a background tab (viewport 0, screenshots timing out) and its Tab key press did not reach the chip; only DOM metrics were checked.

- source_spec: `_bmad-output/implementation-artifacts/spec-38-5-reconnaitre-ses-ralliements-dans-la-liste.md`
  summary: By hand in the browser (a user with a quest AND a ralliement): check the home list tiles in the three view modes and three themes — chip, R1/L1 badge placement (−6/−6 in medium and compact, inset in large), JDR tiles unchanged inside the new wrappers, filters Genre / Rang / Grouper par type, and a ralliement created in another tab appearing without reload.
  evidence: The dev user has no parties and the agent creates no data in the dev DB; only unit/DOM tests were run.

- source_spec: none
  summary: Epic 39 story 39.2 — give every e-mail a common `layout.hbs` template with a solid green button and the « Dés Dispos » footer (see epics-palier10.md).
  evidence: Split from the « epic 39 » build request; only 39.1 was kept for this run (multi-goal check).
- source_spec: none
  summary: Epic 39 story 39.3 — invite someone into a group by pseudo, e-mail or link, with admin-only server refusal and the neutral-vocabulary e-mail (needs 39.1 and 39.2).
  evidence: Split from the « epic 39 » build request; only 39.1 was kept for this run (multi-goal check).
- source_spec: none
  summary: Epic 39 story 39.4 — name admins and leave the admin office, with the red confirmation variant and the `FOR UPDATE` lock on the partie (needs 39.3).
  evidence: Split from the « epic 39 » build request; only 39.1 was kept for this run (multi-goal check).
- source_spec: none
  summary: Epic 39 story 39.5 — leave a group or remove a member through the single `PartiesService.leave(partieId, userId, cause)` procedure (needs 39.4).
  evidence: Split from the « epic 39 » build request; only 39.1 was kept for this run (multi-goal check).

- source_spec: `_bmad-output/implementation-artifacts/spec-39-1-ouvrir-un-groupe-sur-ses-conjonctions.md`
  summary: By hand in the browser (a group as admin and as member): check the Conjonctions tab (words Conjonctions/Haltes/Réunions, spacing, empty lines, no SCSS was added) and the admin footer Clore/Rouvrir/Brûler in the three themes.
  evidence: No live check was run; only unit/DOM/e2e tests.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-1-ouvrir-un-groupe-sur-ses-conjonctions.md`
  summary: Decide whether a one-shot ralliement (ONE_SHOT) should keep PARTIE_CLOSE/REOPEN/DELETE for its host before epic 41 reworks that page.
  evidence: `RALLIEMENT_POLICY` grants the three cells to the admin for the whole family; only the web footer is gated to groups, so the host can close or burn a one-shot through the API.

- source_spec: `_bmad-output/implementation-artifacts/spec-39-2-donner-un-gabarit-commun-a-tous-les-e-mails.md`
  summary: Look at the nine e-mails in Mailpit (and a real client if possible): the button now sits after the body, so « Ce lien expire dans 24h » precedes it and the rollback e-mail ends a sentence with « : » before another paragraph — decide whether to reword or add a slot for text after the button.
  evidence: The frozen intent puts the button in the layout and keeps the words; reordering was not done. No rendering was checked in a mail client.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-2-donner-un-gabarit-commun-a-tous-les-e-mails.md`
  summary: Rename the sender display name « jdr-master » in `MAIL_FROM` (`.env`, `.env.dev`, production config) to « Dés Dispos » if the brand change should reach the From header.
  evidence: Only the footer was in scope; the From name still reads « jdr-master ».

- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: Show the pending invitations of a group to its admin (list + revoke), as the JDR « Missives » tab does; the server already grants INVITATION_READ/REVOKE.
  evidence: The shared invite tools cover search, e-mail, links and removal only; the pending list stays in the JDR-only branch.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: Make the register and not-found screens reached from a group invite link free of JDR wording (« grimoire », `auth.register_invite_only`…).
  evidence: Only the join page and the received-invitation card were made group-aware.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: Fix `InviteLinksService.findOrCreateForEmail` returning an already consumed single-use link when a removed member is re-invited by e-mail (dead link in the e-mail), for JDR and groups.
  evidence: Reviewer trace: the lookup does not filter on `usesCount < maxUses`; removal makes the case reachable.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: In `/security-review`, cover e-mail invitations (no throttle/quota, free group name in the subject, anyone can create a group) and the two exceptions added to `no-direct-owner-read.spec.ts`.
  evidence: Same exposure exists for JDR; the group flow widens it and CLAUDE.md asks for the review after a feature.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: In story 39.4 expose the member role on `PartieMemberDto` so « Retirer » is hidden for admins and the 409 special case can go.
  evidence: The group Missives show « Retirer » on another admin, which the server always refuses.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-3-inviter-quelquun-dans-un-groupe.md`
  summary: By hand: invite a second account to a group by pseudo, e-mail (Mailpit) and link; check the e-mail, the join page and the invitee's list in the three themes.
  evidence: No live check was run; only unit/DOM/e2e tests.

- source_spec: `_bmad-output/implementation-artifacts/spec-39-4-nommer-des-admins-et-quitter-loffice.md`
  summary: Wire `conjonctionCount` of `PartieDetail` (hard-coded 0) to the group's real conjonctions in epic 40, so the red last-admin confirmation states the true number it deletes.
  evidence: Three reviewers flagged that the destructive warning would understate the cascade once events exist; epics-palier10.md story 40.1 now carries the criterion.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-4-nommer-des-admins-et-quitter-loffice.md`
  summary: Decide the « Nommer admin » confirmation copy: the UX text lists « ajouter et retirer des membres et nommer d'autres administrateurs » but an admin can also close, edit and burn the group, and only the person can step down (no demotion).
  evidence: Policy `RALLIEMENT_POLICY` gives PARTIE_UPDATE/CLOSE/DELETE to every admin; the wording is the validated UX contract, so changing it is the user's call.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-4-nommer-des-admins-et-quitter-loffice.md`
  summary: Accessibility pass on the group Missives rows: repeated « Nommer admin » / « Retirer » buttons have no accessible name tied to their member, and the red confirm button hard-codes `#fff` over `--color-unavailable` (contrast unchecked in the three themes).
  evidence: Reviewer findings; the accessibility review of the UX is still « non lancée » and contrast of `status-unavailable` is listed as a to-check in the UX notes.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-4-nommer-des-admins-et-quitter-loffice.md`
  summary: By hand in the browser (two accounts in a group): appoint an admin, step down from the Missives row and from the footer, last-admin red dialog, « Brûler » red, in the three themes; check the footer placement of « Quitter l'office » (between Clore and Brûler, to confirm).
  evidence: No live check was run; only unit/DOM/e2e tests. UX note 7 leaves the footer placement open.

- source_spec: `_bmad-output/implementation-artifacts/spec-39-5-quitter-un-groupe-ou-en-retirer-un-membre.md`
  summary: Revoke or re-check multi-use invite links on removal: a removed member who still holds an active `maxUses: null` link can rejoin alone, which contradicts « un administrateur devra vous inviter à nouveau ».
  evidence: `leave()` only deletes the membership; `InviteLinksService` accepts any valid link (pre-existing since 39.3 removal). Worth a `/security-review` look.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-5-quitter-un-groupe-ou-en-retirer-un-membre.md`
  summary: Give `PartieDetail` a « no longer has access » path: after leaving or being removed, the page's `partie:` SSE reload gets 403 (unhandled rejections), and a member removed while viewing the group stays on a dead page.
  evidence: The `parties.changed()` effect calls `void this.refreshPartie(); void this.loadMembers();` with no 403 handling; the removed-member case predates 39.5.
- source_spec: `_bmad-output/implementation-artifacts/spec-39-5-quitter-un-groupe-ou-en-retirer-un-membre.md`
  summary: By hand in the browser (two accounts in a group): a member leaves from the footer (non-red confirmation, back home, group gone from their list, others' member list updated); an admin removes the creator after the creator stepped down.
  evidence: No live check was run; only unit/DOM/e2e tests.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-1-proposer-une-conjonction-a-date-fixee.md`
  summary: A closed group (closedAt set, TERMINEE) still accepts new conjonctions; no write guard on closed parties exists app-wide.
  evidence: Unverified medium — settle by deciding whether a closed party (JDR or ralliement) refuses new events/scenarios, then guard in PermissionService or the services.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-2-consulter-et-modifier-une-conjonction-dans-sa-fenetre.md`
  summary: `updateHosted` (Event row lock) and `inscrire` (Seance row lock) do not serialize, so a capacity cut can race a sign-up and end below the headcount.
  evidence: Unreachable in ralliement until 40.3 opens `SEANCE_INSCRIBE`; 40.3 must take the Event lock (epic decision) in sign-up, reservation and capacity writes, Partie lock first.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-2-consulter-et-modifier-une-conjonction-dans-sa-fenetre.md`
  summary: The edit form silently rewrites a `FULL_DAY` slot to EVENING and cannot save a conjonction without a date.
  evidence: Unreachable now (40.1 writes only the three slots); reachable once 40.5 poll `chooseDate` writes a slot or clears the date — decide then how edit treats poll-driven dates.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-2-consulter-et-modifier-une-conjonction-dans-sa-fenetre.md`
  summary: A PATCH on an event deleted since the dialog opened answers « Scénario introuvable », a JDR word, in the group dialog.
  evidence: Message comes from `PermissionService.resolveTarget` (historic); events cannot be deleted before epic 42 cancellation — map it to « Conjonction introuvable » there.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-3-sinscrire-a-une-conjonction-et-sen-desinscrire.md`
  summary: The one-shot ralliement (rencontre isolée) day-before reminder still uses the JDR `session-reminder` wording (« séance de … demain », « Voir la partie »).
  evidence: Pre-existing; 40.3 only switches groups to `conjonction-reminder`. Epic 41 (isolated evening) must send the neutral e-mail #5 to accepted guests.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-4-reserver-une-place-a-des-membres.md`
  summary: `events/session-date.ts` duplicates the date formatter and slot labels of `NotificationsService`; make the reminder use the shared helper.
  evidence: Two copies of « date (créneau) » can diverge between mail #3 and the day-before reminder; the reminder was left untouched to keep the JDR e-mail unchanged.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-5-proposer-une-conjonction-par-sondage-de-dates.md`
  summary: Story 40.5b — make the group calendar usable for a ralliement: composer that returns the chosen slots without saving (for an event not yet created), voting on a group poll in `/parties/:id/guild-calendar`, access from the group page, aggregated availabilities for groups, and the « Voter dans le calendrier » button of the dialog.
  evidence: The 40.5 investigation found the composer is MJ-only (`mode` from the route, no composer on `/guild-calendar`), no link leads to a calendar from a group page, and `PARTIE_AVAILABILITY_READ`/`SCENARIO_READ`/`POLL_*` are `NOBODY` for ralliement; 40.5 ships the server side and an in-window slot list instead.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-5-proposer-une-conjonction-par-sondage-de-dates.md`
  summary: `events/slot-availability.ts` (`isFreeOn`) re-implements the availability rules of `AvailabilityService`; extract one shared pure function and add a parity test.
  evidence: The `availableCount` of a poll slot and the calendar can drift if a recurrence rule changes; nothing ties the two copies.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-5-proposer-une-conjonction-par-sondage-de-dates.md`
  summary: A group poll whose deadline has passed still shows « Date à voter · jusqu'au … » on the card and has no end state or action.
  evidence: Stories 40.6 (set the date) and 40.7 (extend the vote) must give an ended poll its label and exits.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-5b-calendrier-du-groupe-pour-un-sondage.md`
  summary: No `calendar-view` spec checks that the legend of a group page omits the « disponibilité du groupe » entry (`[partieContext]="!!partieId() && !isGroup()"`).
  evidence: Reverting the binding leaves all specs green; the legend would describe a layer a group page never offers.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-6-fixer-la-date-dune-conjonction.md`
  summary: A group poll whose host account is gone (`Event.ownerId` null) can never be dated: `POLL_CHOOSE` is refused to everyone, so it stays « Date à voter » forever.
  evidence: Permission spec asserts the refusal when `ownerId` is null; decide with epic 42 whether an admin may fix the date (or cancel) when the host disappeared.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-6-fixer-la-date-dune-conjonction.md`
  summary: `ConjonctionsTab` has no spec; the `(refreshRequested)="refresh()"` wiring after fixing the date is untested.
  evidence: Deleting the binding fails no test; only the live signal then refreshes the host's dialog.
- source_spec: `_bmad-output/implementation-artifacts/spec-40-7-prolonger-le-vote-et-relancer-la-veille.md`
  summary: The vote reminder (#6) is sent by the first hourly pass of the eve (about 01:00–02:00 French time) and right after a poll is created or extended when its deadline is within 48 h; consider a daytime send hour or a minimum age.
  evidence: Window `expiresAt − 48 h ≤ now < expiresAt − 24 h` on an end-of-day UTC deadline, as specified; a product choice, not a defect of the spec as written.

- source_spec: `_bmad-output/implementation-artifacts/spec-41-1-afficher-une-soiree-isolee-sur-une-seule-page.md`
  summary: Decide where the description of an isolated evening is shown now that its page has no "Détails" tab.
  evidence: The creation form still asks for a description (`partie.ralliement_no_description` exists), but the inline event detail only carries the event sheet; the text is now reachable only through the admin's "Modifier" form. A short line under the title of the inline detail, or in the sheet, would settle it.

- source_spec: `_bmad-output/implementation-artifacts/spec-41-3-inviter-a-une-soiree-accepter-ou-decliner.md`
  summary: Fix the e-mail links built from `WEB_ORIGIN` when it holds a comma-separated list of origins.
  evidence: In the dev setup `WEB_ORIGIN` is "http://localhost:4200,http://192.168.1.22:4200" and every mail builds its link as `${WEB_ORIGIN}/…`, so the href contains both origins; pick the first origin or a dedicated single-origin variable.

- source_spec: `_bmad-output/implementation-artifacts/spec-42-1-annuler-une-conjonction-de-groupe.md`
  summary: Raise the label contrast of the existing destructive `ConfirmDialog` button (white on `--color-unavailable`).
  evidence: `confirm-dialog.ts` sets `--mat-button-filled-label-text-color: #fff` on #e74c3c, which measures 3.8:1 (below the 4.5:1 text threshold of NFR4); the new cancel dialog of 42.1 uses the theme background colour instead (4.9 to 5.1:1). Pre-existing, outside the cancel story.

- source_spec: `_bmad-output/implementation-artifacts/spec-43-2-effacer-mon-compte.md`
  summary: Unlink the personal files (character portraits, party covers) of an erased account, and of any cascade-deleted party.
  evidence: Account erasure follows the existing deletion rule, which unlinks nothing (party delete leaves covers and portraits on disk), so an erased account's uploaded images stay orphaned on disk.

- source_spec: `_bmad-output/implementation-artifacts/45-1-voir-les-rendez-vous-qui-attendent-une-date.md`
  summary: Story 45.5 must finish the evening half of « Proposer des dates » that Story 45.1 serves on the API but hides on the web.
  evidence: The API (`GET /me/datable-seances`, `isDatableSeance`) already returns isolated evenings without a date, but the composer target that arms them only arrives with 45.5, so the web masks them through the single seam `SOIREE_ROWS_ARMABLE` / `armableRendezvous` in `features/calendar/rendezvous-picker/rendezvous.utils.ts`. 45.5 must: add the evening composer target (PATCH `/parties/:id/events/:eventId`, fields re-read from the event card), flip `SOIREE_ROWS_ARMABLE` to true (then delete the seam and its two spec cases in `rendezvous.utils.spec.ts` and `calendar-view.spec.ts`), make `pickRendezvous` in `calendar-view.ts` arm that target for `row.nature === 'soiree'` (atelier) and let the `?seanceId` arrival arm it (vitrine), and check the group calendar's `groupRendezvous` rows end to end (« soirée sans date » label already exists in the three themes).

- source_spec: `_bmad-output/implementation-artifacts/46-3-ajouter-une-fenetre-au-vote.md`
  summary: Rendre date-indépendant le test unitaire « AD-9 end-to-end » de `parties.service.spec.ts` (séance fixée au 2026-09-20).
  evidence: Il échoue depuis que cette date est passée (l'indisponibilité dérivée expire un jour après la séance, `computeSlotStatus` écarte les déclarations expirées) ; rien à voir avec 46.3, constaté en lançant toute la suite API.

- source_spec: `_bmad-output/implementation-artifacts/spec-47-1-donner-une-duree-a-un-rendez-vous.md`
  summary: Choisir une option `FULL_DAY` d'un vote dont la séance dure plus d'un créneau échoue en 400 dans `chooseDate` ; refuser ou masquer ces options à l'écriture du vote (47.4, composer et `setOptionsInTx`).
  evidence: Les options de vote JDR acceptent `FULL_DAY` (create-poll.dto) et une séance peut passer à plusieurs créneaux avant que son vote existe ; `seanceSpanEnd` refuse alors la fin dans la transaction de clôture (relecteurs Blind Hunter, Edge Case Hunter, Verification Gap, story 47.1).
- source_spec: `_bmad-output/implementation-artifacts/spec-47-1-donner-une-duree-a-un-rendez-vous.md`
  summary: Les gardes « passé » d'`updateHosted` et `cancelHosted` lisent `startDate` seule : un rendez-vous long déjà commencé est refusé en édition et annulation ; à passer à « fin avant aujourd'hui » (47.2).
  evidence: `currentDay < todayKeyUtc()` dans `updateHosted` et son pendant d'annulation ; le PRD demande « passée = fin avant aujourd'hui partout » (relecteur Blind Hunter, story 47.1).

- source_spec: `_bmad-output/implementation-artifacts/spec-47-2-etre-occupe-sur-toute-la-plage-dun-rendez-vous.md`
  summary: L'Agenda (sections « à venir / passé »), la carte d'événement et le compte à rebours du tableau de bord rangent encore une plage commencée par son début ; à passer à « fin avant aujourd'hui » avec l'affichage des plages (47.3).
  evidence: Seuls `seanceState`, le badge du tableau de bord et le widget « Prochaine séance » lisent la fin ; la règle serveur « passée = fin avant aujourd'hui » est appliquée partout (relecteurs Blind Hunter et Edge Case Hunter, story 47.2).
- source_spec: `_bmad-output/implementation-artifacts/spec-47-2-etre-occupe-sur-toute-la-plage-dun-rendez-vous.md`
  summary: Le gabarit `conjonction-relance.hbs` avec `durationLabel` n'est pas rendu par un test (l'intégration Mailpit s'ignore sans Mailpit) ; ajouter un cas de rendu avec et sans durée.
  evidence: Seule la donnée passée à `sendMail` est vérifiée ; renommer la variable du gabarit ne ferait échouer aucun test (relecteur Verification Gap, story 47.2).

- source_spec: `_bmad-output/implementation-artifacts/spec-47-3-voir-une-plage-sur-tous-ses-jours.md`
  summary: Le badge d'imminence de la carte d'événement, la distance en jours de l'Agenda et le compte à rebours du tableau de bord comptent encore depuis le jour de début d'une plage commencée ; à passer à la fin quand ce libellé gênera (avec l'affichage des votes en plage, 47.5).
  evidence: Les règles « passée » (carte, Agenda, état de séance, serveur) lisent la fin ; seuls ces libellés d'échéance restent sur le début (relecteur Blind Hunter, story 47.3).

## Deferred from: code review of epic 37 (Palier 10, revue a posteriori du 2026-10-29)

- [P:MOYENNE] `resetSeanceDate` efface la plage, supprime le sondage puis recalcule la prochaine séance en trois écritures hors transaction et sans le verrou de partie que prend `chooseDate` : un choix de date concurrent peut laisser une séance datée sans `pollId`, et un échec de suppression un `SessionPoll` orphelin. [apps/api/src/events/events.service.ts:1297]
- [P:MOYENNE] `remindSeance` pose `reminderSentAt` même quand l'envoi à un destinataire a échoué (résultat seulement journalisé) : ce destinataire ne reçoit jamais le rappel de la veille. [apps/api/src/notifications/notifications.service.ts:157]
- [P:BASSE] Rappel de la veille envoyé destinataire par destinataire avant la marque, sans trace par personne : une interruption au milieu de la boucle renvoie le rappel en double au passage suivant. [apps/api/src/notifications/notifications.service.ts:183]
- [P:BASSE] `recomputeNextSession` charge toutes les séances de la partie (passées comprises) et trie en mémoire sous le verrou `FOR UPDATE` ; un `findFirst` filtré sur la fin de plage, trié par `startDate`, suffirait. [apps/api/src/events/events.service.ts:2244]

## Deferred from: code review of epic 40 (Palier 10, revue a posteriori du 2026-10-29)

- [P:MOYENNE] La relance de vote (veille de l'échéance) part aussi pour une soirée isolée close : fermer une partie ne ferme pas son sondage, et la requête ne filtre ni `partie.closedAt` ni l'état ouvert ; les invités reçoivent « votez » puis chaque vote est refusé par `assertIsolatedOpen`. [apps/api/src/notifications/notifications.service.ts:200]
- [P:BASSE] `extend` n'appelle pas `assertIsolatedOpen` : l'hôte prolonge le vote d'une soirée close, ce qui réarme la relance pour un vote impossible. [apps/api/src/poll/poll.service.ts:561]
- [P:BASSE] `assertCanVote` lit l'éligibilité hors du verrou où le vote est écrit (`lockConjonction` ne revérifie que date et annulation) : un vote en vol pendant une désinscription peut compter un non-votant. [apps/api/src/events/events.service.ts:1994]
- [P:BASSE] `inscrireConjonction` ne revérifie pas l'appartenance sous verrou (droit calculé avant, seul le verrou de l'événement est pris) : un retrait concurrent par un admin peut laisser une inscription à un ex-membre. [apps/api/src/events/events.service.ts:1575]

## Deferred from: code review of epics 42-43 (Palier 10, revue a posteriori du 2026-10-29)

- [P:BASSE] `cancelUpcomingHostedInTx` renvoie la liste des conjonctions lue AVANT les verrous alors que `updateMany` ne réannule que celles encore ouvertes : une conjonction annulée au même moment par un admin reçoit un second e-mail d'annulation, attribué au départ de l'hôte. Renvoyer les identifiants relus sous verrou. [apps/api/src/events/events.service.ts:1084]

## Deferred from: code review of epics 44-47 (Palier 10.4, revue a posteriori du 2026-10-29)

- [P:BASSE] `bestOption` et `destinyEntryOption` (`RankableOption` sans fin de plage) écartent une option dès que son jour de départ est passé, alors qu'un rendez-vous n'est passé qu'à la fin de sa plage : un week-end consulté le samedi perd son meilleur créneau dans la Destinée et la confirmation « Fixer la date ». [packages/shared/src/index.ts:1174]
- [P:BASSE] À archiver (constat du 2026-10-29) : deux items plus haut semblent déjà corrigés — les gardes « passé » d'`updateHosted`/`cancelHosted` lisent désormais `isSeancePast(start, end)` (events.service.ts:907, 1035), et `assertFullDayAlone` refuse `FULL_DAY` au-delà d'un créneau à l'écriture du vote (poll.service.ts:196, 646). À vérifier puis déplacer dans `deferred-work-archive.md`.

## Deferred from: security + code review of epics 38, 39, 41 (Palier 10, revue a posteriori du 2026-10-29)

- [P:BASSE] `accept` crée l'adhésion hors du verrou de la partie (P10-AD-7) : course possible avec la suppression du groupe par son dernier admin (500 ou adhésion non comptée). [apps/api/src/invitations/invitations.service.ts:155]
- [P:BASSE] Rejoindre par un lien laisse en PENDING l'invitation nominative de la même personne pour la même partie (invitation fantôme sur l'accueil et dans la liste de l'hôte). [apps/api/src/invitations/invite-links.service.ts:112]

- source_spec: `_bmad-output/implementation-artifacts/spec-48-1-ajouter-mes-jeux-et-les-retrouver.md`
  summary: Protected web routes (e.g. `profile/board-games`, `profile/calendar`) have no route-level test that navigating the real route table renders the page.
  evidence: Only `href` assertions exist (`account.spec.ts`, `shell.spec.ts:105`); `app.config.spec.ts` navigates public routes only, so a path typo or wrong lazy import would fall through to `'**'` unnoticed.

- source_spec: `_bmad-output/implementation-artifacts/spec-50-1-trouver-qui-possede-un-jeu-dans-le-groupe.md`
  summary: Measure the four group tabs (Conjonctions/Haltes/Réunions + Reliques/Trésors/Joyaux + Détails + Missives) at 360 px in each theme, and 20 members × 300 games on a phone.
  evidence: Acceptance criterion « measured and noted » could not be checked without a browser; `partie-detail.scss` is untouched, so the Material tab header may scroll. Unverified, would be medium if it overflows.

- source_spec: `_bmad-output/implementation-artifacts/spec-51-4-icones-membres-invitations-et-gouvernance.md`
  summary: Check the 14px `role-admin` badge on the participant-chip avatar in the three themes (legibility, size, corner placement).
  evidence: The old inline shield had a surface-coloured outline that `role-admin` (stroke only) does not; unverifiable in jsdom. Unverified, would be medium if the badge blends into the avatar. Story 51.8's recette covers `role-admin` at 14px; if unreadable, report it to the user (no redraw without agreement).

- source_spec: `_bmad-output/implementation-artifacts/spec-51-8-retirer-la-police-material-icons.md`
  summary: Decide whether the level-up badge `▲` of `character-summary-card.html` should become an icon from the set (no meaning icon exists for it today).
  evidence: A literal `▲` (U+25B2) remains in a template; it is outside the AC's character list (which has `▴`), so the strict guard does not flag it. Low: cosmetic and font-dependent.
