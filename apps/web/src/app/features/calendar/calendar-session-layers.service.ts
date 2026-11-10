import { Injectable, effect, inject } from '@angular/core';
import type { CalendarLayerKey } from '@desdispos/shared';
import { AuthService } from '../../core/auth/auth.service';

/**
 * L'identité du calendrier dont on mémorise les couches.
 *
 * Story 36.14, AC10 — « l'ouverture d'un **autre** calendrier » repart du défaut de compte. C'est
 * cette clé qui le garantit : deux calendriers ne partagent jamais une entrée. Même patron de
 * nommage que la seule autre clé scopée du projet, `homonymy-dismissed:${partieId}:${userId}`.
 *
 * 🚨 Revue de code 36.14 — `/parties/:id/calendar` (mode `mj`) et `/parties/:id/guild-calendar`
 * (mode `personal`) montent le MÊME `CalendarView` avec le MÊME `:id` : sans le mode, les deux
 * routes partageaient une entrée, et les bascules de l'une fuitaient dans l'autre. Le suffixe
 * `:guild` distingue le second cas ; le premier garde son nom historique (`partie:${id}`) pour ne
 * pas invalider une mémoire déjà écrite pendant cette session.
 */
export function calendarSessionKey(
  partieId: string | null,
  mode: 'personal' | 'mj' = 'mj',
): string {
  if (!partieId) return 'personal';
  return mode === 'mj' ? `partie:${partieId}` : `partie:${partieId}:guild`;
}

/**
 * Mémoire de session des couches actives du calendrier (Story 36.14, AC9 à AC11).
 *
 * 🚨 **AUCUN STOCKAGE WEB — et c'est le cœur de la story, pas un détail d'implémentation.**
 *
 * Le réflexe est `sessionStorage` : le nom correspond, la portée semble correspondre. Il est
 * faux. `sessionStorage` **survit à un rechargement** (F5) dans le même onglet, alors que l'AC10
 * exige qu'un rechargement reparte du défaut de compte. Le défaut serait invisible à toute la
 * suite de tests — jsdom ne recharge rien.
 *
 * Une `Map` en mémoire, portée par un service racine, satisfait les quatre branches de l'AC10
 * sans une ligne de code dédiée :
 *
 * | Branche                        | Ce qui la satisfait                                    |
 * | ------------------------------ | ------------------------------------------------------ |
 * | Même calendrier, même session  | La `Map` vit aussi longtemps que l'application          |
 * | Rechargement                   | Le service est reconstruit vide — **gratuit**          |
 * | Déconnexion                    | L'effet ci-dessous, sur `currentUser`                   |
 * | Autre calendrier               | Autre clé ⇒ `read()` rend `null` ⇒ défaut de compte     |
 *
 * Et « la mémoire n'exige aucun mécanisme de détection de retour dans l'application » (AC11)
 * devient trivialement vrai : il n'y a rien à détecter.
 *
 * C'est aussi la seule forme compatible avec **AD-13**, qui fait de `localStorage` un cache
 * d'amorçage **réservé au thème** [Source: ARCHITECTURE-SPINE.md:152].
 */
@Injectable({ providedIn: 'root' })
export class CalendarSessionLayersService {
  private readonly auth = inject(AuthService);

  private readonly byCalendar = new Map<string, CalendarLayerKey[]>();

  constructor() {
    // AC10 — la déconnexion repart du défaut de compte.
    //
    // 🚨 Branché sur `currentUser` et non sur `AuthService.logout()` : d'une part un service de
    // `features/` injecté dans un service de `core/` inverserait la direction des dépendances ;
    // d'autre part `currentUser` retombe à `null` sur TOUTE perte de session (déconnexion
    // explicite, mais aussi session expirée côté serveur), et les couches d'un compte ne doivent
    // pas survivre à celui qui les a réglées.
    effect(() => {
      if (this.auth.currentUser() === null) this.byCalendar.clear();
    });
  }

  /** Les couches mémorisées pour ce calendrier, ou `null` s'il n'a pas encore été visité. */
  read(key: string): CalendarLayerKey[] | null {
    const stored = this.byCalendar.get(key);
    // Copie défensive : l'appelant pose ce tableau dans un signal, et une mutation en place
    // court-circuiterait la détection de changement tout en corrompant la mémoire.
    return stored ? [...stored] : null;
  }

  write(key: string, layers: readonly CalendarLayerKey[]): void {
    this.byCalendar.set(key, [...layers]);
  }
}
