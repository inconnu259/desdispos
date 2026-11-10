/**
 * Fixtures partagées entre specs.
 *
 * Réservé aux tests (exclu de `tsconfig.build.json`, jamais importé par du code de production),
 * comme `jest-typed.ts` à côté.
 *
 * Raison d'être : `AuthUser` porte 13 champs obligatoires et grossit à chaque story de
 * préférences (thème, tris, modes d'affichage, couches de calendrier…). Recopier ce littéral
 * dans chaque spec garantit qu'ils divergeront, et que l'ajout d'un champ au contrat cassera
 * autant de fichiers qu'il y a de copies. Un point de passage unique règle les deux.
 */
import type { AuthUser } from '@master-jdr/shared';

/**
 * Utilisateur authentifié complet, conforme au contrat `AuthUser`.
 *
 * `Object.assign` plutôt qu'un spread : `{ ...base, ...Partial<AuthUser> }` rend chaque champ
 * surchargeable optionnel aux yeux de TypeScript, et le résultat n'est alors plus assignable à
 * `AuthUser`. `Object.assign` est typé `T & Partial<T>`, donc assignable, sans aucun cast.
 */
export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  const base: AuthUser = {
    id: 'u1',
    email: 'u1@test.fr',
    pseudo: 'U1',
    displayName: 'U1',
    role: 'USER',
    createdAt: '2026-07-01T00:00:00.000Z',
    theme: null,
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    // Liste explicite plutôt qu'un spread de `DEFAULT_CALENDAR_LAYER_KEYS` : plusieurs specs
    // font `jest.mock('@master-jdr/shared')` en n'exposant qu'une partie des exports, et un
    // import de VALEUR runtime y devient alors `undefined` (« not iterable »). Le garde-fou
    // reste en place sans cet import : ces chaînes sont contextuellement typées par
    // `AuthUser['defaultCalendarLayers']`, donc renommer une clé du contrat casse la
    // compilation de ce fichier.
    defaultCalendarLayers: [
      'mes-indisponibilites',
      'mes-disponibilites',
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
      'disponibilite-groupe',
    ],
  };
  return Object.assign(base, overrides);
}
