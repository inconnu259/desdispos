# Relevé du code existant (2026-11-01)

## Icônes et thèmes
- `ThemeToneService` (`apps/web/src/app/core/theme/theme-tone.service.ts:13`) : `activeTheme` signal, `tone` computed
  sur `TONE_MAP` ; `applyClass()` pose `theme-<id>` sur `body` ; `setTheme()` seul écrivain de `localStorage` ;
  synchro compte via `PATCH /me/theme` (`auth.service.ts:67-93`).
- Variables CSS par thème dans `apps/web/src/styles.scss` (`.theme-*`, l.76/141/201).
- Material : 80 `<mat-icon>` dans 15 fichiers, ~43 noms (36 statiques + 7 calculés : `roleIcon`, `tintIcon`,
  `modeIcon`, favori). `MatIconModule` dans 16 fichiers. Aucun `MatIconRegistry`, `svgIcon`, `DomSanitizer`.
  Police chargée par `index.html:19` (Google Fonts).
- SVG maison : composants inline `currentColor`, taille par variable CSS (`create-icon`, `brand-logo`,
  `system-badge` avec `@switch`, `nature-marker`, écu de `participant-chip`).
- Assets par thème : toujours du SVG inline choisi par `activeTheme()` (`auth-band`, `party-countdown`,
  `party-banner`) ; aucun fichier par thème.

## Signaux du tableau de bord
- Calcul serveur : `apps/api/src/parties/party-signals.service.ts` `getSignals(userId)` ; 12 codes
  `PartySignalCode` (shared l.615-628) ; `PartySignalsDto { role, status, signals }` par partie.
- `GET /me/party-signals` → `Record<partieId, PartySignalsDto>` ; web `core/parties/party-signals.service.ts`.
- Rafraîchi par `user:{id}` (`PartiesService.notifyPartieSignalsChanged()`, l.1503).

## Dispos
- Modèle unique `AvailabilityDeclaration` (`schema.prisma:366-380`), sans lien à une partie ; récurrences calculées
  en mémoire (`declarationOverlapsRange`, l.801) ; index `[userId, expiresAt]`.
- « Rien sur N jours » : `findMany({ userId, expiresAt > now })` + filtre mémoire existant — peu coûteux.
- Temps réel : `emitForUser()` émet `partie:{id}` pour chaque partie du déclarant, **rien sur `user:`**.

## Préférences
- Champs sur `User` (`theme`, `partiesSort`, `hideFinishedParties`, `partiesViewMode`…) ; couches en table
  `UserCalendarLayer`. `PATCH /me/preferences` (`UpdatePreferencesDto`, champs optionnels `@IsIn`) ; renvoyées dans
  `AuthUser`. Constantes partagées `X = [...] as const`.

## Temps réel
- `RealtimeEventsService` (topics sans contenu) ; SSE `GET /parties/:id/events` et `GET /users/me/events`.
- Web : handlers par préfixe ; `user:` → hommeDragon, invitations, openPolls, datableSeances, myParties,
  partySignals, scenarios, boardGames.

## Situation JDR
- `seanceState()` client pur (`core/status/status-derivation.ts:140`) ; `SeanceDto` porte `poll` et `inscription`
  (`inscrits[].userId`) ; `SessionPollDto` non filtré selon le rôle (joueurs voient qui a répondu).
- Soirée : `eventSituation()` client (`features/events/event-card.util.ts:284`).

## Onglets et couverture
- Une seule constante d'index : `MJ_INVITATIONS_TAB_INDEX = 1` (`partie-detail.ts:90`) ; `defaultTabIndex` l.487.
- Couverture : `PUT/DELETE /parties/:id/cover` (`party-cover.controller.ts`), permission `PARTIE_COVER_UPDATE` ;
  web `PartiesService.setCoverImage/removeCoverImage`, utilisés seulement par `partie-form`.
- **`PartyBanner` n'est pas affichée sur la page d'une partie** (seulement tableau de bord et formulaire) ; l'en-tête
  de la page est le bandeau texte du Shell (`ContextualNavService` : `title`, `subtitle`).
