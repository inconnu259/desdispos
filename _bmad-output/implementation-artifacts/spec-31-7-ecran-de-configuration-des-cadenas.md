---
title: 'Écran de configuration des cadenas (Story 31.7)'
type: 'feature'
created: '2026-09-22'
baseline_commit: 9a9004804c2f0cd041ee8c373c1236237a9e5a3c
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le MJ peut déjà verrouiller des champs de fiche anti-spoil (Story 31.6, mécanisme complet côté serveur), mais uniquement via un appel HTTP direct — aucun écran ne lui permet de choisir quoi masquer, ni de voir ce qui est déjà verrouillé.

**Approach:** Un nouvel écran MJ-only, atteignable depuis la page de la Partie, affiche les clés verrouillables déclarées par le schéma du système de jeu sous forme de cases à cocher, lit la configuration actuelle (nouvel endpoint de lecture) et l'enregistre en un seul appel déclaratif complet vers l'endpoint d'écriture déjà en place (`PUT /parties/:id/visibility-locks`, Story 31.6).

## Boundaries & Constraints

**Always:**
- Les éléments proposés à la coche viennent uniquement de `GameSystemSchemaDto.sheetSchema` (`lockable`/`lockableFields`) — aucune liste de clés écrite en dur dans l'écran (AC1).
- Lecture et écriture passent par le même garde MJ-only que `setVisibilityLocks()` (`PartiesService.getOwned()`) ; un non-MJ atteignant l'URL directement se voit refuser l'accès (AC3), jamais un écran vide ou une erreur muette.
- La configuration lue par cet écran n'est jamais incluse dans une réponse consommée par un joueur (AC4 — déjà garanti par 31.6, aucune projection joueur n'expose `PartieVisibilityLock`).
- L'enregistrement remplace l'état complet des chemins verrouillés en un seul appel PUT (même patron déclaratif que `PollService.setOptions()`, Story 36.10) — jamais un delta.

**Never:**
- Aucune modification du modèle de données, de `toDto()` ni de `applyVisibilityMask()` (31.6, déjà fonctionnels) — cette story consomme le mécanisme, ne le change pas.
- Aucun écran de lecture pour les joueurs — cet écran est un outil MJ, pas une vue de transparence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partie neuve, aucun verrou | MJ ouvre l'écran | Toutes les cases décochées, tout reste visible | N/A |
| Verrous déjà posés | MJ ouvre l'écran | Cases correspondantes précochées, reflétant `GET :id/visibility-locks` | N/A |
| MJ décoche tout puis enregistre | Save | Tous les verrous retirés (`PUT` avec `paths: []`) | N/A |
| Joueur ouvre l'URL directement | GET sans être MJ | Accès refusé, formulaire non rendu | 403/404 backend → message d'erreur, aucune fuite de la configuration |
| Clé objet à sous-champs (`attributes`) | MJ coche un sous-champ seul | La clé entière reste décochée ; seul le chemin `attributes.AGI` est envoyé | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.controller.ts:111-118` -- ajouter `@Get(':id/visibility-locks')` symétrique au `@Put` existant, MJ-only
- `apps/api/src/parties/parties.service.ts:1081-1113` (`setVisibilityLocks`) -- ajouter `getVisibilityLocks(partieId, userId)` : `getOwned()` puis `prisma.partieVisibilityLock.findMany({ where: { partieId } })`, même forme `{fieldKey, subField}[]`
- `apps/api/src/game-systems/game-system.service.ts:249-265` (`sheetSchema`) -- ajouter `label` par clé et `lockableFieldLabels` (mirroir de `lockableFields`, seul `attributes` en a) ; réutiliser les libellés déjà établis ailleurs (creationSteps, `character-sheet.html:161-217`) : classId="Classe", typeId="Type", attributes="Attributs", weaponId="Arme favorite", fetiqueObject="Objet fétiche", equipment="Équipement", narrative="Narratif" ; nouveaux : specialtyTypeId="Spécialité", customWeapon="Arme personnalisée", startingEquipment="Équipement de départ" ; `lockableFieldLabels.attributes` = {AGI:'AGI',ESP:'ESP',INT:'INT',VIG:'VIG'} (mêmes abréviations que la fiche, jamais de libellé français inventé)
- `packages/shared/src/index.ts:1110` (`GameSystemSchemaDto`) -- typer `sheetSchema` (actuellement `unknown`) en `Record<string, { type: string; optional?: boolean; fields?: string[]; lockable?: boolean; lockableFields?: string[]; label: string; lockableFieldLabels?: Record<string,string> }>` ; ajouter `VisibilityLockPathDto { fieldKey: string; subField: string | null }` (miroir du retour existant de `setVisibilityLocks`, jamais réimporté depuis `apps/api`)
- `apps/web/src/app/core/parties/parties.service.ts` -- ajouter `getVisibilityLocks(id)` (GET) et `setVisibilityLocks(id, paths)` (PUT), même style que `inviteLinks()`/`createInviteLink()` déjà dans ce fichier
- `apps/web/src/app/core/characters/character.service.ts:44-48` (`getGameSystemSchema`) -- réutilisé tel quel, aucune modification
- `apps/web/src/app/features/parties/visibility-locks/visibility-locks.ts/.html/.scss` (nouveau) -- écran MJ-only : charge schéma + verrous actuels, rend une case par clé `lockable` (et par sous-champ pour `attributes`), enregistre via un seul PUT déclaratif ; patron le plus proche : `apps/web/src/app/features/poll/poll-creation/poll-creation.ts` (petit composant autonome, formulaire déclaratif, ~200 lignes, sans câblage temps réel propre)
- `apps/web/src/app/app.routes.ts:81` -- ajouter `{ path: 'parties/:id/visibility', loadComponent: ... }` juste après `parties/:id/edit`, même patron lazy
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- ajouter un bouton MJ-only "Confidentialité" (visible seulement si `isMj()`, même garde que les autres actions MJ de cet écran) à côté du bouton "Modifier" existant, navigant vers `/parties/:id/visibility`
- Pas de nouvelle émission temps réel : `setVisibilityLocks()` émet déjà `partieTopic` (31.6) et `character-sheet.ts:640` y est déjà abonné (`characterSvc.changed()`) — cet écran n'a pas besoin de son propre câblage SSE (MJ seul éditeur, pas de vue concurrente à rafraîchir sur cet écran lui-même)

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/parties/parties.controller.ts` -- `GET :id/visibility-locks` -- lecture MJ-only symétrique au PUT
- [x] `apps/api/src/parties/parties.service.ts` -- `getVisibilityLocks()` -- réutilise `getOwned()`, lit `PartieVisibilityLock`
- [x] `apps/api/src/game-systems/game-system.service.ts` -- `label`/`lockableFieldLabels` sur `sheetSchema` -- écran schema-driven, aucune liste en dur
- [x] `packages/shared/src/index.ts` -- typer `sheetSchema`, ajouter `VisibilityLockPathDto` -- contrat partagé
- [x] `apps/web/src/app/core/parties/parties.service.ts` -- `getVisibilityLocks`/`setVisibilityLocks` -- appels HTTP frontend
- [x] `apps/web/src/app/features/parties/visibility-locks/*` (nouveau) -- écran de configuration -- cœur de la story
- [x] `apps/web/src/app/app.routes.ts` -- route `parties/:id/visibility` -- point d'entrée URL
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html`/`.ts` -- bouton MJ-only "Confidentialité" -- point d'entrée navigable
- [x] Tests unitaires par AC + I/O Matrix (`parties.service.spec.ts`, `parties.controller.spec.ts`, `game-system.service.spec.ts`, `visibility-locks.spec.ts`)

**Acceptance Criteria:**
- Given je suis MJ d'une partie, when j'ouvre l'écran de configuration de visibilité, then il présente une fiche type dont les éléments verrouillables sont ceux déclarés par le schéma du système de jeu, and aucune liste n'est écrite en dur dans l'écran
- Given je verrouille des éléments et j'enregistre, when la configuration est sauvegardée, then elle s'applique à tous les personnages de la partie
- Given un joueur de la partie, when il tente d'ouvrir cet écran, then l'accès est refusé
- Given la configuration d'une partie, when un joueur reçoit les données de cette partie, then la configuration elle-même ne lui est jamais transmise

## Implementation Notes

- Bouton MJ-only "Confidentialité" (`partie-detail.html`, garde `@if (isMj())` déjà présente) ; libellé thématique ajouté aux 3 thèmes (`tones.ts` : "Sceller des secrets" / "Voiler des secrets" / "Verrouiller les plans") avec test de parité (`theme-tone.service.spec.ts`). Aucun changement de `.ts` requis pour ce bouton — la garde MJ existante suffisait.
- `VisibilityLocks.ngOnInit()` charge `partiesSvc.get(id)` et `partiesSvc.getVisibilityLocks(id)` en parallèle (`Promise.all`) : c'est `getVisibilityLocks()` (MJ-only via `getOwned()`) qui porte seule la garde d'accès (AC3) — `get()` (visible à tout membre) n'est jamais utilisé pour statuer sur l'accès. Le schéma (`getGameSystemSchema`) n'est chargé qu'après ce `Promise.all`, jamais en cas de rejet.
- Vérification indépendante (session `bmad-build`, step-03) : `docker compose exec api pnpm test` (fichiers ciblés) → 14/14 (`parties.controller.spec.ts`), 169/170 (`parties.service.spec.ts` + `game-system.service.spec.ts`, 1 échec préexistant sans rapport — dérive de date sur le test AD-9 `getAvailableSlots`) ; `docker compose exec api pnpm exec tsc --noEmit` propre ; `docker compose exec web pnpm exec tsc --noEmit` propre ; `visibility-locks.spec.ts` 6/6, `theme-tone.service.spec.ts` 51/51.
- Revue (step-04) : 7 correctifs appliqués par le sous-agent d'implémentation (accès conflaté avec d'autres échecs → séparé via `Promise.allSettled`, spinner bloqué si `:id` absent → erreur affichée, cases brutes → `mat-checkbox`, boutons/cases non désactivés pendant `saving()`, commentaire trompeur sur les libellés, 2 tests manquants ajoutés côté API HTTP et côté branches non couvertes du composant). Un résidu du correctif de commentaire (`specialtyTypeId` présenté comme sans équivalent affiché ailleurs, alors que "Spécialité" existe déjà dans `wizard-summary.ts`/`class-step.html`) corrigé directement en session, hors sous-agent (édition de commentaire seule, aucun impact fonctionnel).
- Vérification post-patch (suite complète, pas seulement les fichiers touchés) : `docker compose exec api pnpm exec tsc --noEmit` propre ; `docker compose exec web pnpm exec tsc --noEmit` propre ; `docker compose exec api pnpm test` → 1385/1387 (2 échecs préexistants sans rapport, dérive de date : `parties.service.spec.ts` AD-9, `party-signals.service.spec.ts`) ; suite web complète → 2432/2434 (2 échecs préexistants sans rapport, dérive de date : `calendar-view.spec.ts`, dates codées en dur `2026-09-01`). Aucune régression introduite par cette story ni par ses correctifs.
- Test manuel utilisateur (2026-09-22, compte Alice / partie « Chroniques de la Guilde ») : découverte de 2 régressions réelles sur la fiche/roster quand des cadenas sont réellement posés — `character-summary-card.html`/`character-sheet.html`/`inventory-tab.html` lisaient `derived.PV` etc. sans garde alors que 31.6 rend `derived` possiblement absent, provoquant un plantage qui cassait le roster de `PartieDetail` pour tous les joueurs. Corrigé en session (commit `8c47dd9`), puis complété par des indicateurs « Masqué par le MJ » pour les sections Attributs/Équipement qui disparaissaient sinon silencieusement (commit `f70b47d`).
- `/code-review` (8 angles, effort high) sur ces 2 correctifs : 4 défauts réels confirmés et corrigés (commit `768630c`) — barre d'encombrement trompeuse si `equipment` seul verrouillé, `attributePatternLabel()` non robuste à un sous-champ verrouillé, `isHidden()`/`equipmentHidden()` factorisés dans `isFieldHidden()` (`character.util.ts`), commentaires en anglais reformulés en français. 3 constats supplémentaires (7/10 clés verrouillables sans indicateur, `classLabel()` du roster, incohérence des exports PDF) consignés dans `deferred-work.md` — réels mais hors périmètre de ce correctif.

## Spec Change Log

## Review Triage Log

*Revue du 2026-09-22 (`bmad-build`, step-04) — 3 couches en parallèle : Blind Hunter, Edge Case Hunter, Verification Gap. Diff : `9a900480..HEAD` (working tree).*

- **medium** — `VisibilityLocks.ngOnInit()` (`visibility-locks.ts:85-106`) place `partiesSvc.get(id)`, `partiesSvc.getVisibilityLocks(id)` (`Promise.all`) et `characterSvc.getGameSystemSchema(...)` dans le même `try/catch`, qui met `accessDenied` à `true` sur n'importe quel échec. Or le commentaire du composant affirme explicitement que seul `getVisibilityLocks()` doit statuer sur l'accès (AC3) — jamais `get()`. Vérifié réel : une Partie sur un système de jeu sans schéma implémenté (`GameSystemService.getSchema()` lève `NotFoundException` pour tout id ≠ `ryuutama`, cf. `game-system.service.ts:236-238` ; `game-system.service.spec.ts` référence `'conte-de-minuit'` comme système existant en base sans schéma codé) ferait afficher « Accès refusé » à un MJ légitime, au lieu d'un message décrivant le vrai problème. Même défaut relevé indépendamment par les 3 couches (Verification Gap "Other findings", Edge Case Hunter, Blind Hunter). **(carried across 3 layers, même défaut)** → **patch**
- **medium** — `apps/web/src/app/core/parties/parties.service.ts:218-239` (`getVisibilityLocks`/`setVisibilityLocks`) : aucun test `HttpTestingController` n'asserte méthode/URL/corps/`withCredentials`, contrairement à chaque autre méthode HTTP de ce même fichier (`list`, `create`, `remove`, `close`, `reopen`). Comportement actuellement correct (vérifié : URL et corps `{ paths }` conformes au contrôleur backend), mais une régression future (typo d'URL, oubli de `withCredentials`, mauvaise forme de corps) passerait inaperçue : `visibility-locks.spec.ts` mocke entièrement `PartiesService`, jamais le vrai `HttpClient`. **(Verification Gap, pré-vérifié)** → **patch**
- **low** — `VisibilityLocks.ngOnInit()` : `if (!id) return;` ne repositionne jamais `loading` à `false` ni ne signale d'erreur — l'écran reste bloqué en spinner indéfiniment si l'URL est atteinte sans `:id`. Peu probable en usage normal (le routeur garantit le paramètre pour cette route), mais le correctif est trivial (une ligne) et cohérent avec le patron déjà utilisé par `CharacterSheet.ngOnInit()` (`loadError.set('Fiche introuvable.')` plutôt qu'un retour muet). **(Edge Case Hunter)** → **patch**
- **low** — Commentaire de `game-system.service.ts:249-251` : affirme que les nouveaux `label` « réutilisent les libellés déjà établis ailleurs... aucun nouveau libellé inventé », alors que `customWeapon: 'Arme personnalisée'` et `startingEquipment: 'Équipement de départ'` sont bel et bien de nouveaux libellés (absents du code avant ce diff, et explicitement qualifiés de "nouveaux" par le Code Map de ce spec lui-même). Contradiction réelle entre le commentaire et le code qu'il documente — correctif direct (reformuler la phrase). **(Blind Hunter)** → **patch**
- **low** — `visibility-locks.html` utilise des `<input type="checkbox">` bruts, alors que le reste de l'app (`account.html`, `xp-distribution-panel.html`) utilise `MatCheckboxModule`/`mat-checkbox` — divergence visuelle/comportementale (pas de ripple, pas de theming Material) sur un nouvel écran. Correctif direct (remplacement d'élément, même liaison `[checked]`/`(change)`). **(Blind Hunter)** → **patch**
- **low** — `visibility-locks.spec.ts` ne couvre jamais l'échec de `save()` (`partiesSvc.setVisibilityLocks` qui rejette) ni la branche `@empty` du template (système de jeu sans aucune clé `lockable`) — deux branches réelles du composant, aucun test. Le message générique de `save()` en cas d'échec est cohérent avec la convention déjà en place ailleurs dans l'app (ex. `inviteEmailError` de `PartieDetail`), donc pas un défaut en soi — seule l'absence de test est retenue. **(Blind Hunter)** → **patch**
- **low** — `visibility-locks.html` : le bouton « Annuler » et les cases à cocher restent actifs pendant `saving()` (seul « Enregistrer » est `[disabled]`) — un MJ peut cliquer Annuler ou re-cocher pendant l'enregistrement en cours, sans effet ni retour visuel sur l'action ignorée. Correctif direct (étendre `[disabled]="saving()"` à ces éléments). **(Blind Hunter)** → **patch**
- **medium, defer** — `apps/api/src/parties/dto/set-visibility-locks.dto.ts` (`LOCKABLE_FIELD_KEYS`/`LOCKABLE_SUB_FIELDS`) reste une liste figée, dupliquée manuellement du littéral `sheetSchema` (contournement assumé d'un cycle de modules, déjà signalé et différé lors de la revue de la Story 31.6). Cette story rend l'écran réellement schema-driven (AC1) : elle devient donc le premier consommateur réel qui rendrait une case pour toute future clé `lockable` ajoutée au schéma sans mise à jour correspondante de cette liste, avec un échec serveur silencieux/peu clair à l'enregistrement. Vérifié réel mais **pré-existant** (aucune des deux listes n'est modifiée par ce diff ; les 10 clés déjà déclarées sont identiques des deux côtés aujourd'hui — aucun échec actuel). Même dette déjà consignée par la revue de 31.6. **(Blind Hunter)** → **defer**

## Design Notes

- Pas de garde de route Angular dédiée (aucun `canActivate` MJ-only n'existe ailleurs dans ce routeur, cf. `parties/:id/edit`) : l'accès MJ-only est garanti par le backend (`getOwned()` sur GET et PUT). Un non-MJ atteignant l'URL reçoit une erreur du GET initial et l'écran affiche un message — il ne rend jamais le formulaire.

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- expected: suite verte, nouveaux tests inclus
- `docker compose exec api pnpm exec tsc --noEmit` -- expected: aucune erreur de type
- `docker compose exec web pnpm test` -- expected: suite verte
- `docker compose exec web pnpm exec tsc --noEmit` -- expected: aucune erreur de type
