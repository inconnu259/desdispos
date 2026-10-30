import { Injectable, inject } from '@angular/core';
import { API_BASE } from '../api-base';
import { PartiesService } from '../parties/parties.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { CharacterService } from '../characters/character.service';
import { HommeDragonService } from '../homme-dragon/homme-dragon.service';
import { InvitationsService } from '../invitations/invitations.service';
import { DatableSeancesService } from '../poll/datable-seances.service';
import { OpenPollsService } from '../poll/open-polls.service';
import { MyPartiesService } from '../my-parties/my-parties.service';
import { AvailabilityService } from '../availability/availability.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { CharacterRolesService } from '../character-roles/character-roles.service';
import { PartySignalsService } from '../parties/party-signals.service';
import { BoardGamesService } from '../board-games/board-games.service';

export function partieTopic(partieId: string): string {
  return `partie:${partieId}`;
}

export function userTopic(userId: string): string {
  return `user:${userId}`;
}

export interface TopicHandler {
  readonly prefix: string;
  // Bug fix (production, tempête de requêtes) : le topic déclencheur (ex. 'partie:xyz') est
  // désormais transmis — un handler qui n'a besoin que de savoir "quelque chose a changé" peut
  // toujours l'ignorer (fonction à arité inférieure, valide en TypeScript), mais un handler comme
  // OpenPollsService peut désormais scoper son rafraîchissement à la seule Partie concernée au
  // lieu de refetch toutes les Parties du joueur à chaque événement.
  notifyChanged(topic: string): void;
}

/** Pure, testable isolément — pas de couplage à Angular/EventSource. */
export function matchingHandlers(handlers: readonly TopicHandler[], topic: string): TopicHandler[] {
  return handlers.filter((h) => topic.startsWith(h.prefix));
}

function urlForTopic(topic: string): string {
  if (topic.startsWith('partie:')) {
    return `${API_BASE}/parties/${topic.slice('partie:'.length)}/events`;
  }
  if (topic.startsWith('user:')) {
    return `${API_BASE}/users/me/events`;
  }
  throw new Error(`Topic non reconnu : ${topic}`);
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly parties = inject(PartiesService);
  private readonly scenarios = inject(ScenariosService);
  private readonly characters = inject(CharacterService);
  private readonly hommeDragon = inject(HommeDragonService);
  private readonly invitations = inject(InvitationsService);
  private readonly openPolls = inject(OpenPollsService);
  private readonly datableSeances = inject(DatableSeancesService);
  private readonly myParties = inject(MyPartiesService);
  private readonly availability = inject(AvailabilityService);
  private readonly announcements = inject(AnnouncementsService);
  private readonly characterRoles = inject(CharacterRolesService);
  private readonly partySignals = inject(PartySignalsService);
  private readonly boardGames = inject(BoardGamesService);

  // Table de correspondance topic-prefix -> services à notifier (AD-3), câblée ici, dans
  // RealtimeService lui-même (jamais par le composant appelant connect()/disconnect()) —
  // première entrée réelle (Story 18.3), étendue Story 19.1 (deuxième entrée), Story 20.1
  // (troisième entrée), Story 20.2 (quatrième entrée), Story 21.1 (cinquième entrée, PREMIÈRE
  // au préfixe 'user:') puis Story 22.1 (sixième entrée, 'partie:', OpenPollsService).
  // Bug fix post-22.1 (production) : `ModeService` (renommé `MyPartiesService`, Story 29.1) était
  // câblé au préfixe générique 'partie:', se déclenchant sur absolument toute mutation (scénario,
  // personnage, poll...) — combiné à l'absence de garde de concurrence, un vote créé pouvait vider
  // silencieusement toute la liste de Parties du joueur. `MyPartiesService` ne représente que
  // l'appartenance (mjParties/playerParties), qui ne change jamais via une mutation partie-scopée
  // générique —
  // reculé sur le préfixe 'user:' (mêmes auto-actions déjà couvertes directement sans SSE,
  // cf. Dashboard.accept()/join.ts ; seul removeMember() émet désormais userTopic(removedUserId)).
  // `AvailabilityService` ajoutée au préfixe 'partie:' : une déclaration de dispo/indispo modifiée
  // par un joueur doit rafraîchir le calendrier de toute Partie où il est MJ/membre.
  // `AnnouncementsService` ajoutée au préfixe 'partie:' (bug fix production : une annonce publiée
  // par le MJ n'apparaissait jamais chez les autres utilisateurs déjà sur la page sans recharger).
  // `CharacterRolesService` ajoutée au préfixe 'partie:' (Story 27.3) : un rôle de groupe
  // assigné/retiré par le MJ n'apparaissait jamais chez les autres membres déjà sur la page sans
  // recharger.
  private readonly handlers: TopicHandler[] = [
    { prefix: 'partie:', notifyChanged: () => this.parties.notifyChanged() },
    { prefix: 'partie:', notifyChanged: () => this.scenarios.notifyRealtimeChanged() },
    { prefix: 'partie:', notifyChanged: () => this.characters.notifyChanged() },
    // AD-23 : la fiche d'un Homme Dragon n'écoute QUE `user:{id}` (aucun canal `partie:`, quel que
    // soit son nombre d'aventures) — le niveau suit un scénario clos par l'émission existante de
    // `ScenariosService` (`notifyPartieSignalsChanged`, `user:` au MJ et aux membres). Les écritures
    // de fiche n'émettent rien : le client qui écrit se met à jour avec la réponse. La page de la
    // fiche ouvre `userTopic` elle-même (`connect` / `disconnect` à sa destruction).
    { prefix: 'user:', notifyChanged: () => this.hommeDragon.notifyChanged() },
    { prefix: 'user:', notifyChanged: () => this.invitations.notifyChanged() },
    // Story 44.2 : mes sondages ouverts (toutes parties, toutes familles) sont UNE liste lue sur `user:{id}`,
    // que toute écriture de sondage ou de vote prévient (`notifyPartieSignalsChanged`) — plus de `partie:`.
    { prefix: 'user:', notifyChanged: () => this.openPolls.notifyChanged() },
    // Story 45.1 : mes rendez-vous à dater — même canal, même règle ; relus seulement une fois lus une première fois.
    { prefix: 'user:', notifyChanged: () => this.datableSeances.notifyChanged() },
    { prefix: 'user:', notifyChanged: () => this.myParties.notifyChanged() },
    { prefix: 'partie:', notifyChanged: () => this.availability.notifyChanged() },
    { prefix: 'partie:', notifyChanged: () => this.announcements.notifyChanged() },
    { prefix: 'partie:', notifyChanged: () => this.characterRoles.notifyChanged() },
    // `PartySignalsService` (Story 29.7, AD-3/AD-14) : préfixe 'user:' SEUL, jamais 'partie:' —
    // le canal 'user:{id}' est déjà ouvert pour l'utilisateur courant, aucune connexion
    // supplémentaire par Partie (même discipline que `myParties` ci-dessus).
    { prefix: 'user:', notifyChanged: () => this.partySignals.notifyChanged() },
    // Deferred-work (SSE, calendrier personnel) : RÉUTILISE `notifyRealtimeChanged()`, déjà câblée
    // ci-dessus sur 'partie:' — elle ignore déjà quel partieId a changé (REALTIME_WILDCARD), donc
    // convient telle quelle à un événement 'user:{id}' qui agrège plusieurs Parties. CalendarView
    // (contexte personnel) se connecte à user:{id} et recharge GET /me/calendar sur ce même signal
    // `ScenariosService.changed()` — pas de nouveau service, pas de nouvelle méthode.
    { prefix: 'user:', notifyChanged: () => this.scenarios.notifyRealtimeChanged() },
    // Story 48.1 : ma Ludothèque — toute écriture d'un jeu émet `user:{propriétaire}` ; la page la
    // relit sur ce signal (autres onglets de la même personne).
    { prefix: 'user:', notifyChanged: () => this.boardGames.notifyChanged() },
    // Story 48.3 : la feuille « Ludothèque d'une personne » se relit sur le `partie:{id}` que toute écriture
    // d'un jeu émet pour chaque partie de ralliement de son propriétaire — la page de la partie est déjà
    // connectée à ce canal, aucune connexion de plus.
    { prefix: 'partie:', notifyChanged: () => this.boardGames.notifyChanged() },
  ];

  // Une entrée par connexion active (pas par topic) — deux connect() sur le même topic ouvrent
  // deux EventSource indépendants, jamais partagés/dédupliqués (AD-6). disconnect() dépile la
  // plus récente (LIFO) : discipline naturelle pour un dialogue ouvert par-dessus une page déjà
  // connectée sur le même topic (Epic 19, ScenarioEditor/ScenarioReadDialog).
  private readonly connections = new Map<string, EventSource[]>();

  connect(topic: string): void {
    const es = new EventSource(urlForTopic(topic), { withCredentials: true });
    const onSignal = () => {
      // Chaque handler est isolé (Story 19.1, revue de code) : plusieurs services de domaine
      // partagent désormais le même préfixe — une exception dans l'un ne doit jamais empêcher
      // la notification des autres.
      for (const h of matchingHandlers(this.handlers, topic)) {
        try {
          h.notifyChanged(topic);
        } catch {
          // non-bloquant — un service de domaine en échec ne doit pas empêcher les autres
        }
      }
    };
    // 'open' : connexion initiale ET chaque reconnexion réussie (AC4, AD-8) — rattrapage.
    // 'message' : un par emit() serveur reçu pendant une connexion stable (AC4) — chemin
    // primaire de notification, pas seulement le rattrapage post-coupure.
    es.addEventListener('open', onSignal);
    es.addEventListener('message', onSignal);
    // Aucun listener 'error' : reconnexion native EventSource, silencieuse (AC3, AD-8).
    const list = this.connections.get(topic) ?? [];
    list.push(es);
    this.connections.set(topic, list);
  }

  disconnect(topic: string): void {
    const list = this.connections.get(topic);
    if (!list || list.length === 0) return;
    const es = list.pop()!;
    es.close();
    if (list.length > 0) this.connections.set(topic, list);
    else this.connections.delete(topic);
  }
}
