import type { User, UserCalendarLayer } from '@prisma/client';
import type {
  AuthUser,
  CalendarLayerKey,
  CharacterSort,
  ListViewMode,
  PartieSort,
  Theme,
} from '@master-jdr/shared';
import { DEFAULT_CALENDAR_LAYER_KEYS } from '@master-jdr/shared';

/** Construit la forme `AuthUser` renvoyée au front — strip `passwordHash` et résout
 *  `defaultCalendarLayers` (Story 30.4, AD-16) : `calendarLayersSetAt === null` → jamais réglé,
 *  le jeu par défaut s'applique ; sinon → exactement ce qui a été enregistré (peut être vide).
 *
 *  Point d'assemblage UNIQUE (Story 30.4, encadré n°2) : les six endroits qui construisaient
 *  jusqu'ici `const { passwordHash, ...safe } = user; return safe;` doivent tous passer par ce
 *  helper — sinon un champ obligatoire d'`AuthUser` peut manquer silencieusement à l'exécution
 *  malgré le typage (`GET /auth/me` est le point le plus facile à oublier, cf. story). */
// `passwordHash` optionnel en entrée : `AuthService.validateUser()` le retire déjà avant
// d'atteindre `LocalStrategy` (le hash ne doit jamais transiter au-delà de la vérification du mot
// de passe), les autres appelants (register(), account.service.ts, session.serializer.ts) passent
// l'enregistrement Prisma complet — les deux formes doivent être acceptées.
export type UserForAuth = Omit<User, 'passwordHash'> &
  Partial<Pick<User, 'passwordHash'>> & { calendarLayers: UserCalendarLayer[] };

export function toAuthUser(user: UserForAuth): AuthUser {
  // Énumération explicite plutôt qu'un `...rest` : `User` porte des colonnes internes qui ne font
  // PAS partie du contrat `AuthUser` (`passwordHash`, mais aussi `mustResetPassword` et
  // `calendarLayersSetAt`) — un spread les aurait laissées fuiter silencieusement dans la réponse
  // JSON malgré le typage `: AuthUser` (les vérifications TS d'excès de propriétés ne s'appliquent
  // pas à un spread). Revue de code : bug pré-existant au destructuring manuel remplacé par cette
  // story, corrigé ici puisque c'est désormais le point de passage unique.
  return {
    id: user.id,
    email: user.email,
    pseudo: user.pseudo,
    displayName: user.displayName,
    role: user.role,
    // Pré-existant à cette story : `Prisma.User.createdAt`/`theme` sont typés `Date`/`string`
    // génériques côté Prisma, jamais vérifiés contre la forme `AuthUser` tant qu'aucun point de
    // construction n'annotait son retour `: AuthUser` — désormais explicite ici. `theme` est déjà
    // validé à l'écriture (`@IsIn(THEMES)`, `UpdateThemeDto`), le cast est sûr.
    createdAt: user.createdAt.toISOString(),
    theme: user.theme as Theme | null,
    hideFinishedParties: user.hideFinishedParties,
    availabilityReminder: user.availabilityReminder,
    partiesSort: user.partiesSort as PartieSort,
    partiesViewMode: user.partiesViewMode as ListViewMode,
    charactersViewMode: user.charactersViewMode as ListViewMode,
    charactersSort: user.charactersSort as CharacterSort,
    // Revue de code : clone plutôt que renvoyer la référence partagée du module — sans ça, tout
    // appelant futur qui muterait `authUser.defaultCalendarLayers` corromprait la constante pour
    // tous les comptes « jamais réglés » du process.
    defaultCalendarLayers:
      user.calendarLayersSetAt === null
        ? [...DEFAULT_CALENDAR_LAYER_KEYS]
        : user.calendarLayers.map((l) => l.layerKey as CalendarLayerKey),
  };
}
