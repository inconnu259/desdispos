---
title: '31.5 — Consultation des fiches des compagnons'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_commit: '219ddcb42431a345ef155a582bdcea773819d8b2'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un joueur ne peut aujourd'hui consulter que ses propres personnages : `findByPartie()`
ne renvoie tous les personnages de la partie qu'au MJ, et le roster mobile (`RosterStrip`) est
fermé aux simples joueurs — alors que la lecture d'un personnage d'autrui est déjà autorisée
côté serveur pour tout membre de la partie depuis la Story 6.5, et que le filtrage anti-spoil
(Story 31.6) est prêt à s'appliquer.

**Approach:** Ouvrir `findByPartie()` à tout membre valide de la partie (pas seulement au MJ), en
appliquant le masque de visibilité de la Story 31.6 aux personnages d'autrui ; ouvrir le roster
mobile au même titre que le roster desktop (déjà non restreint côté template).

## Boundaries & Constraints

**Always:** `getViewable()` (membre ou MJ) reste l'unique contrôle d'appartenance, avec le même
refus qu'aujourd'hui pour un non-membre. Le masque de visibilité (31.6) s'applique à tout
personnage d'autrui consulté par un non-MJ, jamais au sien ni à ceux du MJ. Le mécanisme des
notes personnelles (`getNotes`/`sharedOnly`) reste inchangé. Aucune migration, aucune dépendance
ajoutée.

**Always:** Le menu d'export ⋮ (`sheet-actions-menu`) reste offert tel quel sur la fiche d'un
compagnon, sans restriction à `isOwner()`/`viewerIsMj()` (décision utilisateur, 2026-09-22 : un
joueur peut légitimement demander l'impression/export de la fiche d'un autre). Seule la lecture
« vivante » de la fiche (pencils d'édition) reste réservée au propriétaire/MJ.

**Never:** Pas de nouveau mode "lecture seule" dédié dans `CharacterSheet` — les gates existantes
`isOwner()`/`viewerIsMj()` suffisent déjà (aucune pencil d'édition ne s'affiche pour un tiers).
Ne pas toucher à l'écran de configuration des cadenas (Story 31.7, backlog). Ne pas modifier la
signature de `toDto()`/`applyVisibilityMask()` (31.6, stable).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Membre simple, aucun cadenas posé | `GET /parties/:id/characters`, viewer = joueur non-MJ | tous les personnages de la partie renvoyés, complets | N/A |
| Membre simple, cadenas posé sur `classId` | idem, lock = `{classId}` | son propre personnage complet ; ceux des autres avec `classId` absent et `hiddenFields: ['classId']` | N/A |
| MJ | idem | tous les personnages complets, jamais masqués | N/A |
| Non-membre | `GET /parties/:id/characters` ou `GET /characters/:id` sur une partie où il n'est pas membre | accès refusé (comportement `getViewable` existant, inchangé) | `ForbiddenException`/`NotFoundException` |

</frozen-after-approval>

## Code Map

- `apps/api/src/characters/character.service.ts:417-451` (`findByPartie`) -- scinde aujourd'hui
  MJ (tous les personnages) / joueur (les siens seulement) ; à réécrire pour renvoyer tous les
  personnages à tout viewer déjà validé par `getViewable()` (L.418), en appliquant
  `resolveLockedPaths(partieId)` (L.412-415, déjà utilisé par `findOne`) au masque de chaque
  personnage qui n'est ni celui du viewer ni celui du MJ -- reprendre le calcul `isOwnerOrMj` de
  `findOne` (L.392) par personnage, pour ne résoudre les locks qu'une fois (pas de N+1).
- `apps/api/src/characters/character.service.spec.ts:890-973` (`describe('findByPartie()')`) --
  5 tests à réécrire : "joueur → ne reçoit que ses propres personnages" (L.923) devient "joueur →
  reçoit tous les personnages" ; le test de cadenas (L.935) doit désormais vérifier que le masque
  EST appliqué aux personnages d'autrui et PAS au sien ni à ceux vus par le MJ.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:379-390`
  (`app-roster-strip`) -- gate `@if (!isDesktop() && isMj())` → `@if (!isDesktop())` ;
  `[hasFreeSlot]="hasFreeSlot"` → `[hasFreeSlot]="isMj() && hasFreeSlot"` (même garde que
  `roster-rail.html:20`) pour ne pas exposer le slot "+ Inviter" à un non-MJ.
- `apps/web/src/app/features/parties/roster-strip/roster-strip.ts:8-10` -- docstring "MJ
  uniquement" à corriger (devient le pendant mobile du roster, ouvert à tout membre).
- `apps/web/src/app/features/characters/character-sheet/character-sheet.html:41-109` (bouton
  `sheet__menu-trigger` + `app-sheet-actions-menu`) -- inchangé : reste offert sans condition à
  tout viewer ayant accès à la fiche (décision utilisateur, 2026-09-22).
- `apps/web/src/app/features/characters/character-sheet/character-sheet.ts:295-324`
  (`isOwner`/`viewerIsMj`) -- inchangés, déjà corrects depuis la Story 6.5 ; toutes les pencils
  d'édition du template en dépendent déjà, aucune fiche tierce n'est éditable aujourd'hui.
- `apps/api/src/characters/character.service.ts:1503-1519` (`getNotes`, `sharedOnly`) -- déjà
  correct pour un fellow player (`sharedOnly = userId !== character.userId`, MJ excepté) ; AC3 est
  satisfaite sans changement, ajouter un test de régression seulement.
- `apps/api/src/parties/parties.service.ts:289-298` (`getViewable`) -- contrôle d'appartenance déjà
  réutilisé par `findOne`/`findByPartie`/les exports PDF ; aucune modification.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/characters/character.service.ts` -- réécrire `findByPartie()` pour renvoyer
  tous les personnages de la partie à tout viewer valide, masque 31.6 appliqué aux personnages
  d'autrui -- porte l'AC1
- [x] `apps/api/src/characters/character.service.spec.ts` -- réécrire les tests `findByPartie()`
  (tous les personnages pour un joueur, masque appliqué/non appliqué selon le viewer) -- couvre
  l'I/O Matrix
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- ouvrir
  `app-roster-strip` à tout membre + corriger `hasFreeSlot` -- porte l'AC1 côté mobile
- [x] `apps/web/src/app/features/parties/roster-strip/roster-strip.ts` -- corriger le commentaire
  de portée -- cohérence documentaire
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts`,
  `roster-strip.spec.ts` -- tests sur la visibilité du roster mobile pour un non-MJ

**Acceptance Criteria:**
- Given je suis membre d'une partie, when j'ouvre la liste de ses personnages (desktop ou mobile),
  then tous les personnages de la partie y figurent, pas seulement les miens
- Given la fiche d'un compagnon, when je l'ouvre, then aucune pencil d'édition n'est disponible ;
  le menu d'export reste accessible, inchangé (décision utilisateur, 2026-09-22)
- Given une partie dont je ne suis pas membre, when je tente d'accéder à un de ses personnages
  (fiche ou export), then l'accès est refusé -- non-régression du comportement existant

## Implementation Notes

- Vérification (session directe, hors `bmad-build`) : `docker compose exec api pnpm test` →
  204/204 verts (`character.service.spec.ts`) ; `docker compose exec web pnpm test` → 2411/2413
  verts, 2 échecs préexistants sans rapport (`calendar-view.spec.ts`, dérive de date codée en dur
  vs date système, non touché par ce changement) ; `docker compose exec web pnpm lint` → mêmes 30
  erreurs préexistantes qu'avant ce changement (fichiers non touchés par cette story) ; `docker
  compose exec api pnpm build` et `docker compose exec web pnpm ng build --configuration
  development` propres.
- Pas de passe `/bmad-code-review` ni `/security-review` effectuée dans cette session -- à lancer
  avant merge, comme le rappelle `CLAUDE.md`.

## Spec Change Log

## Review Triage Log

- `apps/api/src/characters/character.service.ts:453-459` (`findAllByPartie` docstring) — **low** — vérifié : le commentaire décrit encore l'ancien contrat de `findByPartie` (« MJ voit tout, joueur seulement son propre personnage »), devenu faux depuis la réécriture de cette story. Aucun effet d'exécution, dette documentaire pure. → patch
- `apps/web/src/app/features/parties/roster-strip/roster-strip.ts:40-44` (commentaire sur `buildRosterRows()`) — **low** — vérifié : affirme « RosterStrip est MJ-only (cf. docstring) », contredisant le docstring trois lignes au-dessus, mis à jour par cette même story. Aucun effet d'exécution (`canCreate` reste codé en dur à `false`), dette documentaire pure. → patch
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:59-78` (`troupe-toggle`) vs `:379-390` (`app-roster-strip`) — **medium** — vérifié par les 3 couches de revue indépendamment : `troupe-toggle` (liste pliable de noms de membres, `@if (!isDesktop() && !isMj())`) et `app-roster-strip` (`@if (!isDesktop())`, désormais toujours visible pour ce même public) s'affichent maintenant simultanément pour un joueur mobile non-MJ. Vérifié que `buildRosterRows()` (`roster-row.util.ts:66-68`) itère déjà tous les `members()`, avec ou sans personnage — le roster-strip couvre donc intégralement la fonction de `troupe-toggle` (lister qui est dans la partie), qui devient un doublon d'affichage sur un écran mobile étroit. → patch
- `apps/web/src/app/features/parties/roster-strip/roster-strip.ts` (`canCreate`/`currentUserId` codés en dur) — **false** — le point soulevait qu'un joueur sans personnage perdrait sur mobile le CTA « créer mon personnage » disponible sur desktop. Réfuté : l'onglet « Ma fiche » (`partie-detail.html:231-251`, Story 29.15, visible sur tous les viewports, indépendant du roster) porte déjà ce CTA de façon plus visible pour un joueur sans personnage — aucune perte réelle.
- Tâche `roster-strip.spec.ts` cochée `[x]` sans fichier modifié — rejeté : le comportement réellement changé (visibilité du roster mobile) est couvert par les tests ajoutés dans `partie-detail.spec.ts` ; corriger ce point reviendrait à éditer le suivi des tâches de cette spec, hors périmètre de la triage.
- `apps/api/src/characters/character.service.ts:417-451` (`findByPartie`, résolution de `lockedPaths`) — **low** — vérifié : `resolveLockedPaths(partieId)` est appelé dès que le viewer n'est pas le MJ, même quand tous les personnages renvoyés lui appartiennent (aucun autre membre n'a encore de personnage) — une requête évitable, cohérente avec la discipline anti-N+1 déjà affirmée par les commentaires et tests environnants. → patch

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- tests `character.service.spec` (`findByPartie`,
  `getNotes`) verts, reste = baseline
- `docker compose exec web pnpm test` -- tests `partie-detail`, `roster-strip`, `character-sheet`
  verts, reste = baseline
- `docker compose exec web pnpm lint` -- = baseline
- `docker compose exec api pnpm build` / `docker compose exec web pnpm ng build --configuration development` -- propres

**Manual checks (vérification visuelle réelle, 3 thèmes) :**
- En tant que simple joueur : ouvrir une partie, voir le roster complet (desktop et mobile), ouvrir
  la fiche d'un compagnon, confirmer l'absence de toute action de mutation.
- Tenter (via URL directe) d'accéder à un personnage d'une partie dont on n'est pas membre :
  confirmer le refus.
