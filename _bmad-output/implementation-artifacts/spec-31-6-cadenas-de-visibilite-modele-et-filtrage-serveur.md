---
title: 'Cadenas de visibilité — modèle et filtrage serveur (Story 31.6)'
type: 'feature'
created: '2026-09-22'
baseline_commit: 9f007b2c3e99c549558626dff9d84dea0e0e625b
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un joueur qui consulte la fiche d'un compagnon de partie (autorisé depuis la Story 6.5) voit aujourd'hui l'intégralité de ses données ; rien ne permet au MJ de déclarer un champ comme anti-spoil ni de le retirer réellement de la réponse serveur (un masquage au seul affichage se contourne par les outils du navigateur).

**Approach:** Le schéma du système de jeu déclare, par une propriété dédiée, quelles clés de fiche sont verrouillables (et leurs sous-champs pour les clés objet). Une nouvelle table Prisma par Partie stocke les clés effectivement verrouillées. Le point unique de sérialisation de la fiche (`toDto()`, déjà pur/synchrone) reçoit ce masque en paramètre et retire les clés verrouillées — et tout ce qui en dérive — de la réponse dès que le lecteur n'est ni le propriétaire ni le MJ ; la liste de ce qui a été retiré est renvoyée à part.

## Boundaries & Constraints

**Always:**
- Le masque est calculé par l'appelant de `toDto()` et lui est passé en paramètre — jamais résolu par un accès base à l'intérieur (fonction pure/synchrone préservée).
- Le propriétaire de la fiche et le MJ de la partie voient toujours la fiche entière (mask vide).
- Aucune configuration en base (partie neuve) ⇔ rien n'est verrouillé.
- `derived` (PV/PE/Condition/Initiative/Encombrement) dépend uniquement de `attributes`/`levelUps` (`compute-derived.ts`) : verrouiller l'une des deux retire `derived` en entier, jamais une entrée isolée.
- Nouvelle table relationnelle (une ligne = une clé verrouillée par Partie), jamais un JSON fourre-tout (convention AD-1/AD-16, cf. `UserCalendarLayer`).
- Les 3 exports PDF d'un compagnon respectent le même masque (ils passent par `findOne()` → `toDto()`).

**Never:**
- Aucun écran MJ (Story 31.7, hors périmètre) — cette story inclut un point d'entrée serveur MJ-only (service + endpoint PUT déclaratif, sans écran), décidé par l'utilisateur (2026-09-22) pour que 31.7 s'appuie sur un mécanisme déjà fonctionnel.
- Aucune modification de `apps/web/**` : `character-sheet.ts` accède déjà à `sheetData`/`derived` via des `computed` tolérants à l'absence (vérifié) — une clé retirée du DTO ne casse aucun rendu existant.
- Périmètre resserré (décidé par l'utilisateur, 2026-09-22) : verrouillable = uniquement les 10 clés déjà déclarées dans `sheetSchema`. `classChoices`, `classCapabilities`, `magicSeason`, `knownRitualSpells`, `levelUps` restent hors périmètre — lacune préexistante du schéma, non traitée ici.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partie neuve, aucune config | mask vide | `sheetData`/`derived` complets, `hiddenFields: []` | N/A |
| Clé simple verrouillée (`classId`) | mask = {classId} | `classId` absent, `hiddenFields: ['classId']`, reste inchangé | N/A |
| Sous-champ verrouillé (`attributes.AGI`) | mask = {attributes.AGI} | `derived` absent en entier, `attributes.AGI` absent, autres sous-champs `attributes` présents | N/A |
| Lecteur = propriétaire ou MJ | mask quelconque | Aucune clé retirée, `hiddenFields: []` | N/A |
| Export PDF de la fiche d'un compagnon, clés verrouillées | mask non vide | Champs verrouillés absents du PDF | `equipment-pdf.service.ts:37` (`derived.Encombrement`) rendu défensif face à `derived` absent |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- ajouter `model PartieVisibilityLock` (relation `Partie`, `fieldKey`, `subField?`, `@@unique([partieId, fieldKey, subField])`) ; convention AD-1/AD-16 (une ligne = un élément actif), cf. `UserCalendarLayer` (L103-116)
- `apps/api/prisma/migrations/` -- nouvelle migration `<timestamp>_partie_visibility_locks`
- `apps/api/src/game-systems/game-system.service.ts:222-267` -- littéral `sheetSchema` : ajouter `lockable: true` par clé et `lockableFields: string[]` pour les clés objet (miroir de `fields`, déjà utilisé sur `attributes`)
- `apps/api/src/characters/character.service.ts:1541-1574` (`toDto`) -- nouveau paramètre `lockedPaths: ReadonlySet<string>` (chemins pointés, ex. `"attributes.AGI"`) ; retire les clés verrouillées de `sheetData`, vide `derived` si `attributes`/`levelUps` verrouillé, calcule `hiddenFields`
- `apps/api/src/characters/character.service.ts` (`findOne`/`findMine`/`findByPartie`) -- calculent `lockedPaths` (vide si `ownerIsMj`/`viewerIsMj`) avant d'appeler `toDto`
- `apps/api/src/parties/parties.service.ts:279-285` (`getOwned`) -- réutilisé tel quel pour garder l'écriture MJ-only
- `apps/api/src/parties/parties.service.ts` + contrôleur -- nouvelle méthode/endpoint MJ-only, PUT déclaratif
- `apps/api/src/characters/equipment-pdf.service.ts:37` -- `character.derived.Encombrement` non défensif face à `derived` désormais potentiellement absent
- `packages/shared/src/index.ts:846` (`CharacterDto`) -- ajouter `hiddenFields: string[]` ; `sheetData`/`derived` restent typés pleins (contrat DTO existant), absence gérée au runtime et signalée par `hiddenFields`
- `packages/game-rules/src/ryuutama/compute-derived.ts` -- référence de la règle « `derived` dépend uniquement de `attributes`/`levelUps` », à revoir si cette fonction change

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` + migration -- créer `PartieVisibilityLock` -- socle de stockage (AD-1/AD-16)
- [x] `apps/api/src/game-systems/game-system.service.ts` -- déclarer `lockable`/`lockableFields` dans `sheetSchema` -- source de vérité des clés verrouillables
- [x] `apps/api/src/characters/character.service.ts` -- `toDto()` accepte et applique `lockedPaths`, calcule `hiddenFields`, vide `derived` si dépendance verrouillée -- point unique de filtrage
- [x] `apps/api/src/characters/character.service.ts` -- appelants de `toDto` calculent le masque selon owner/MJ -- rien pour le propriétaire/MJ
- [x] `apps/api/src/parties/*` -- endpoint MJ-only d'écriture déclarative -- persistance, réutilise `getOwned()`
- [x] `apps/api/src/characters/equipment-pdf.service.ts` -- accès défensif à `derived.Encombrement` -- éviter un crash PDF
- [x] `packages/shared/src/index.ts` -- `CharacterDto.hiddenFields` -- contrat DTO
- [x] Tests unitaires par AC + I/O Matrix (`character.service.spec.ts`, `equipment-pdf.service.spec.ts`, tests de l'endpoint MJ-only)

**Acceptance Criteria:**
- Given une partie neuve, when aucune configuration n'a été posée, then rien n'est verrouillé et tout reste visible
- Given le schéma de fiche, when il déclare ce qui est verrouillable, then il le fait par une propriété dédiée distincte de celle qui décrit déjà les composantes d'une clé, et une clé objet peut déclarer ses sous-champs
- Given un champ verrouillé, when un autre joueur consulte la fiche, then la clé est absente de la réponse (jamais vide ou nulle) et la liste de ce qui a été retiré est renvoyée
- Given une valeur calculée dérivant d'un champ verrouillé, when la fiche est sérialisée, then elle est retirée par le même passage
- Given un joueur qui exporte le PDF de la fiche d'un compagnon, when le fichier est produit, then les champs verrouillés n'y figurent pas
- Given le propriétaire de la fiche ou le MJ, when ils consultent la fiche, then ils la voient entière
- Given le point de sérialisation de la fiche, when le filtrage est implémenté, then il est appliqué à cet unique endroit, masque passé par l'appelant

### Review Findings

*Revue `/bmad-code-review` du 2026-09-22 sur le commit `33c46f5` (4 angles : Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor — `review_mode: full`).*

- [x] [Review][Patch] **`subField` non validé contre les `lockableFields` réellement déclarées par clé** — `SetVisibilityLocksDto`/`applyVisibilityMask()` valident `fieldKey` contre les 10 clés `lockable` (correctif de la revue précédente) mais valident `subField` seulement par forme (alphanumérique), jamais contre la liste `lockableFields` propre à chaque `fieldKey` (seul `attributes` en déclare une : `AGI/ESP/INT/VIG` ; `customWeapon`/`equipment`/`narrative` sont `lockable` mais sans `lockableFields`). Un MJ peut donc verrouiller `{fieldKey:'narrative', subField:'name'}` ou `{fieldKey:'equipment', subField:'individual'}` ou `{fieldKey:'customWeapon', subField:'name'}` : accepté par le DTO, et `applyVisibilityMask()` retire réellement cette propriété (elle existe dans `RyuutamaSheetData`) — y compris le **nom du personnage** (`narrative.name`), sans qu'aucune règle de schéma ne l'ait sanctionné. Confirmé par 4 angles indépendamment (dont la lecture des tests existants : aucun n'exerce un `subField` hors `attributes`). Effet de bord lié : `locksDerivedDependency()` matche par préfixe de chaîne (`attributes.`) sans vérifier qu'un retrait a réellement eu lieu — verrouiller `{fieldKey:'attributes', subField:'foo'}` (inexistant) laisse `sheetData.attributes` intact mais vide quand même `derived` et l'ajoute à `hiddenFields`, contredisant le commentaire du DTO (« reste inerte en lecture »). [`apps/api/src/parties/dto/set-visibility-locks.dto.ts`, `apps/api/src/characters/character.service.ts` (`applyVisibilityMask`, `locksDerivedDependency`)]
- [x] [Review][Patch] **`findByPartie()`/`findMine()` : l'invariant « le lecteur est toujours propriétaire ou MJ, donc aucun masque à calculer » n'est vérifié que par lecture de code, jamais par un test dédié** — aucun test n'insère de lignes `PartieVisibilityLock` puis n'appelle `findByPartie()`/`findMine()` pour confirmer qu'elles renvoient bien la fiche complète malgré des verrous configurés sur la Partie. Invariant confirmé correct à la lecture (`where: { partieId, userId }` pour un non-MJ), mais sans filet de test si la logique dérive plus tard (chemin que la future Story 31.5 va justement étendre). **(Blind Hunter)** [`apps/api/src/characters/character.service.ts` (`findByPartie`, `findMine`)]
- [x] [Review][Defer] `SetVisibilityLocksDto.LOCKABLE_FIELD_KEYS` est une liste Ryuutama codée en dur, dupliquée du littéral `sheetSchema` (contournement assumé d'un cycle de modules `PartiesModule`↔`GameSystemModule`) — contredit l'objectif d'architecture de l'épic (« un futur système de jeu hérite du mécanisme sans retouche »). Réel mais sans conséquence tant qu'un seul système de jeu existe ; la correction (sortir le schéma verrouillable dans un provider partagé, ou `forwardRef()`) est une restructuration de modules, pas une correction directe. — deferred: architecture à revoir si/quand un 2ᵉ système de jeu arrive
- [x] [Review][Defer] Deux appels `PUT /parties/:id/visibility-locks` concurrents sur la même Partie (double clic, double onglet) peuvent, sous `READ COMMITTED`, atteindre l'étape `createMany` avec la même ligne cible avant que l'un des deux ait committé — violation de la contrainte unique (500) plutôt qu'un remplacement propre. Motif déjà présent, sans verrou, dans le patron dont cette méthode s'inspire (`PollService.setOptions()`) — dette systémique du projet, pas une négligence propre à cette story. — deferred: aucune méthode déclarative de ce type (poll options, cadenas de visibilité) ne verrouille contre l'écriture concurrente dans ce projet
- [x] [Review][Defer] `setVisibilityLocks()` lit la Partie via `getOwned()` puis écrit dans une transaction séparée : si la Partie est supprimée entre les deux, `createMany` viole la contrainte de clé étrangère et lève une 500 non gérée au lieu d'une 404 propre. Même fenêtre TOCTOU que celle déjà consignée dans `deferred-work.md` pour `PartiesService.update()`/`convertKind()` (revue de la story 29.17) — nouvelle occurrence du même défaut architectural déjà assumé comme dette, pas un défaut introduit ici. — deferred: même entrée que le TOCTOU `getOwned()` déjà differé (29.17)

**Rejetés :**
- `weaponId`/`customWeapon` sont deux clés `lockable` indépendantes alors qu'elles sont des alternatives mutuellement exclusives pour « l'arme choisie » (`resolveWeapon()`) — verrouiller l'une n'affecte pas l'autre. Réel, mais c'est une granularité de schéma héritée de la story (10 clés déjà déclarées, reprises telles quelles), pas un bug introduit ; corriger exigerait une refonte du schéma, pas une correction directe.
- `narrative` ne peut être verrouillée qu'en bloc (pas de `lockableFields`), mélangeant identité (nom) et éléments de spoil (motivation, ville natale) — décision déjà assumée du spec (« `lockableFields` mirroir `fields` uniquement là où `fields` existe déjà ») ; observation produit valable pour 31.7, pas un défaut de cette story.
- `setVisibilityLocks()` émet toujours l'événement temps réel, même si la configuration soumise est identique à l'existante — cohérent avec le reste du fichier (`close`/`reopen` etc. n'ont pas ce garde-fou non plus), pas une déviation.
- Aucune validation en base (contrainte `CHECK`) au-delà du DTO HTTP pour un futur appelant interne hypothétique qui contournerait le pipe de validation Nest — aucun chemin réel n'existe aujourd'hui pour ça.
- Les exports PDF n'indiquent pas visuellement qu'un champ a été masqué (vs vide) — l'AC5 exige seulement l'absence du champ, pas une indication visuelle ; hors périmètre.
- `derivedLocked` pourrait signaler un retrait qui n'a pas structurellement eu lieu sur une fiche corrompue où `attributes` serait totalement absent — `attributes` est un champ requis de `RyuutamaSheetData`, ce scénario exige une donnée déjà invalide, non atteignable par un flux valide de cette story.
- Verrouiller à la fois une clé entière et l'un de ses sous-champs dans la même requête produit un `hiddenFields` dépendant de l'ordre — déjà identifié et rejeté à l'identique lors de la revue `bmad-build` précédente (masquage toujours correct, seule la liste `hiddenFields` est cosmétiquement incomplète).
- `DERIVED_PDF_FIELDS` ne couvrirait que 3 des 5 clés de `derived` (PV/PE/Initiative, pas Condition/Encombrement) — faux : le gabarit PDF Ryuutama documente lui-même (`pdf-field-map.ts:89-90`) n'avoir *aucun* champ correspondant à `Condition`/`Encombrement`, rien à omettre.

## Implementation Notes

- **Trouvé au-delà du Code Map** : `ryuutama-pdf.service.ts` → `mapToPdfFields()` (`packages/game-rules`) lit aussi `derived.PV/PE/Initiative` sans garde — un export PDF de fiche éditable/deux-pages aurait crashé (500) dès que `attributes`/`levelUps` est verrouillé. Corrigé par un stub neutre passé à `mapToPdfFields()` + retrait a posteriori des 3 champs AcroForm qui en dépendent (`DERIVED_PDF_FIELDS`), plutôt que d'exporter des zéros trompeurs.
- **`CharacterDto.hiddenFields` rendu optionnel** (`hiddenFields?: string[]`) plutôt que le `string[]` littéral du Code Map : le rendre requis aurait cassé la compilation de `apps/web/src/app/core/characters/character-dto.fixture.ts` (littéral sans ce champ), hors périmètre `apps/web/**` de cette story. L'API le peuple systématiquement au runtime (tableau vide compris) ; seul le type source est assoupli.
- **Incohérence mineure signalée pour 31.7** : `equipment-pdf.service.ts` affiche `0` pour `limite_enc` quand `derived` est verrouillé (accès défensif `?? 0`), alors que `ryuutama-pdf.service.ts` omet purement les champs concernés — deux traitements différents d'un même cas (`derived` absent), à harmoniser si besoin lors de la 31.7.
- Vérification indépendante (session `bmad-build`, hors subagent) : `docker compose exec api pnpm test` → 1368/1370 (2 échecs préexistants sans rapport, dérive de date) ; `pnpm run typecheck` propre ; `prisma migrate status` → à jour, aucun drift ; `git diff --stat` confirme qu'aucun fichier `apps/web/**` n'a été touché.

## Spec Change Log

## Review Triage Log

*Revue du 2026-09-22 (`bmad-build`, step-04) — 3 couches : Blind Hunter (8 requis, 8 rendus), Edge Case Hunter, Verification Gap. Diff : `9f007b2c..HEAD` (working tree).*

- **medium** — `PartiesService.setVisibilityLocks()` n'émet aucun `this.realtimeEvents.emit(partieTopic(partieId))`, contrairement à toutes les mutations sœurs du même fichier (`close`, `reopen`, etc.) et à la convention `docs/checklist.md`/CLAUDE.md (câblage SSE à évaluer sur toute donnée scopée à une Partie). Vérifié : aucun appel `realtimeEvents` dans la méthode, aucun test ne l'asserte. Un joueur avec la fiche d'un compagnon ouverte ne se rafraîchit pas quand le MJ change les verrous. **(Blind Hunter + Verification Gap, même défaut)** → **patch**
- **high** — `ryuutama-pdf.service.ts` : `attributes.AGI/ESP/INT/VIG` sont des champs PDF `dropdown` remplis par `String(attributes.AGI)` (`pdf-field-map.ts:199-216`). Si `attributes.AGI` est verrouillé individuellement, la clé est absente de `sheetData.attributes` mais l'objet `attributes` lui-même reste présent (pas de repli par défaut) : `String(undefined)` = `"undefined"`, une valeur hors des options du dropdown — `pdf-lib` lève au `.select()`. Confirmé : c'est exactement le scénario testé par la matrice I/O (« sous-champ verrouillé attributes.AGI ») combiné à l'export PDF (AC5) ; aucun test actuel ne couvre cette combinaison précise (les tests ajoutés testent `derived` absent, pas un sous-champ `attributes` individuellement verrouillé exporté en PDF). **(Edge Case Hunter)** → **patch**
- **medium** — `SetVisibilityLocksDto`/`setVisibilityLocks()` ne valident `fieldKey` que par forme (alphanumérique), jamais contre les 10 clés déclarées `lockable` — violation directe du "Never" gelé de ce spec (« périmètre resserré... uniquement les 10 clés déjà déclarées »). Vérifié concrètement : verrouiller `levelUps` (hors périmètre) est accepté par l'API, retire réellement `sheetData.levelUps` (clé réelle, pas inerte), et fait tomber silencieusement `CharacterDto.level` à `1` sans l'ajouter à `hiddenFields` — une valeur calculée dérivée d'un champ verrouillé qui n'est PAS signalée comme telle (AC violée). Le commentaire du DTO affirmant qu'un chemin hors schéma reste « sans effet, jamais une fuite » est donc erroné pour ce cas précis. **(Edge Case Hunter + Blind Hunter, même défaut)** → **patch**
- **low** — `equipment-pdf.service.ts` affiche `0` pour `limite_enc` quand `derived` est verrouillé, alors que `ryuutama-pdf.service.ts` omet purement les champs concernés pour le même état — incohérence entre les deux exports pour un même personnage. Déjà noté en Implementation Notes ; correction directe (même patron d'omission), pas une nouvelle surface. **(Blind Hunter)** → **patch**
- **low** — `VisibilityLockPathInput.fieldKey`/`subField` n'ont pas de `@MaxLength`, contrairement à la convention des autres DTO du projet (`create-partie.dto.ts` etc.) — un MJ peut persister jusqu'à 50 chaînes alphanumériques de longueur arbitraire. Impact limité (MJ sur ses propres données), correction directe (`@MaxLength`, patron déjà établi). **(Edge Case Hunter)** → **patch**
- **low, rejeté** — `@@unique([partieId, fieldKey, subField])` : Postgres traite deux `NULL` comme distincts, donc deux requêtes concurrentes pourraient créer deux lignes dupliquées pour un même verrou de clé entière (`subField=NULL`). Vérifié réel (confirmé sur `migration.sql`, index simple), mais sans conséquence fonctionnelle : `resolveLockedPaths()` reconstruit un `Set` à la lecture, les doublons s'y annulent silencieusement. Peu rencontré en usage normal (require une vraie course concurrente sur le même MJ/partie) et la correction propre (index partiel SQL) dépasse une correction directe. **(Blind Hunter + Edge Case Hunter, même défaut)** → rejeté
- **low, rejeté** — Aucun endpoint `GET` pour lire les verrous configurés d'une Partie. Réel, mais aucun consommateur actuel (aucun écran dans cette story) ; 31.7 construira naturellement sa propre lecture avec son écran. Ajouter une lecture maintenant serait une nouvelle surface publique sans consommateur, pas une correction directe. **(Blind Hunter)** → rejeté
- **false** — « Aucun test e2e pour le nouvel endpoint, alors que la CI en exige. » Vérifié faux : le projet ne compte que 2 fichiers e2e au total (`app.e2e-spec.ts`, `security-headers.e2e-spec.ts`), tous deux génériques — aucun endpoint comparable existant (ex. `PUT /parties/:id/poll/:pollId/options`, Story 36.10) n'a de test e2e dédié. Pas un manquement propre à cette story. **(Blind Hunter)** → rejeté
- **low, rejeté** — Verrouiller à la fois une clé entière (`attributes`) et l'un de ses sous-champs (`attributes.AGI`) dans la même requête produit un `hiddenFields` dont le contenu dépend de l'ordre d'itération (`attributes.AGI` peut ne pas apparaître si `attributes` est traité en premier). Vérifié réel, mais sans faille de masquage : la donnée reste correctement retirée dans tous les cas, seule la liste `hiddenFields` est incomplète de façon cosmétique. Peu probable via une future UI à cases à cocher (les deux niveaux ne se combinent naturellement pas), correction exigeant une validation nouvelle. **(Blind Hunter)** → rejeté
- **false** — « Le diff ne correspond pas à `git status` : `migration_lock.toml` modifié mais aucun hunk. » Vérifié faux : `git diff` sur ce fichier est vide (aucune différence de contenu réelle), le seul signal est un avertissement de normalisation de fin de ligne (CRLF/LF) affiché par Git, pas un changement omis. **(Blind Hunter)** → rejeté
- **low, rejeté** — `resolveLockedPaths()` ajoute une requête par appel à `findOne()` pour un fellow player, sans cache ni lot. Réel en théorie, mais aucun chemin actuel n'appelle `findOne()` en boucle (`findByPartie`/`findMine` ne le font jamais, confirmé par lecture du code) — un souci hypothétique pour la future 31.5, pas un défaut de cette story. **(Blind Hunter)** → rejeté

## Design Notes

- **Forme du masque** : `ReadonlySet<string>` de chemins pointés (`"classId"`, `"attributes.AGI"`) plutôt qu'un type dédié par système de jeu — simple, composable, suffisant pour un retrait de clé.
- **Endpoint d'écriture** : PUT déclaratif qui remplace l'ensemble complet des clés verrouillées à chaque appel, comme `PUT /parties/:id/poll/:pollId/options` (Story 29.10) — jamais un jeu d'endpoints add/remove.
- **`derived`** : pas de carte de dépendance persistée ; la règle « `attributes`/`levelUps` verrouillé ⇒ `derived` absent » est dérivée de `compute-derived.ts` (seule fonction qui produit `derived`, lit exactement ces deux clés) — à revoir si cette fonction gagne une nouvelle dépendance.

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- expected: suite verte, nouveaux tests inclus
- `docker compose exec api pnpm exec tsc --noEmit` (ou `pnpm build`) -- expected: aucune erreur de type
- Migration Prisma appliquée en local (`docker compose exec api pnpm prisma migrate dev`, ou commande projet équivalente) -- expected: migration créée et appliquée sans drift
