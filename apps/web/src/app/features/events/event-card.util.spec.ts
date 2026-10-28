import type { EventCardDto } from '@master-jdr/shared';
import { TONE_MAP } from '../../core/theme/tones';
import {
  answeredSlotCount,
  canCancelEvent,
  canExtendVote,
  canFixDate,
  canManageReservations,
  canRespondToReservation,
  canSignUp,
  canUnsubscribe,
  eventBadge,
  eventDateLabel,
  eventSituation,
  eventSituationTextKey,
  extendMinKey,
  frUnit,
  initialsOf,
  isCancelled,
  isFull,
  isFullForViewer,
  isHostOf,
  isParticipantOf,
  isPendingParticipant,
  participationLine,
  isImminentEvent,
  isPastEvent,
  hasPendingPoll,
  isPollEnded,
  isPollOpen,
  needsVote,
  nextDayKey,
  pollBestSlot,
  pollCountsLabel,
  pollPanel,
  pollRangeLabel,
  pollSlotLabel,
  pollSlotRows,
  pollSummaryLabel,
  rankedEntrySlots,
  rankedPollSlots,
  respondentIds,
  shortDayLabel,
  splitEvents,
} from './event-card.util';

const TONE = TONE_MAP['grimoire-emeraude'];
const TODAY = '2026-10-17';

// Story 44.1 : par défaut, aucun droit d'organisateur (le lecteur n'est pas l'hôte) ; un test donne `can` à la carte.
const NO_CAN = { propose: false, edit: false, choose: false, extend: false };
const HOST_CAN = { propose: true, edit: true, choose: true, extend: true };
const withCan = (c: EventCardDto, can = HOST_CAN): EventCardDto => ({ ...c, can });

const card = (id: string, date: string | null, over: Partial<EventCardDto> = {}): EventCardDto => ({
  id,
  title: id,
  hostId: 'hote',
  hostDisplayName: 'Léa',
  seance: {
    endDate: null,
    endSlot: date ? 'EVENING' : null,
    durationSlots: 1,
    id: `s-${id}`,
    date,
    slot: date ? 'EVENING' : null,
    lieu: null,
    heureRdv: null,
    notePratique: null,
    capacity: null,
    placesTaken: 1,
  },
  participants: [],
  myInscription: null,
  cancelled: false,
  poll: null,
  can: NO_CAN,
  ...over,
});

describe('event-card.util (Story 40.1)', () => {
  it('passée = jour AVANT aujourd’hui ; aujourd’hui et sans date restent à venir', () => {
    expect(isPastEvent(card('hier', '2026-10-16'), TODAY)).toBe(true);
    expect(isPastEvent(card('auj', TODAY), TODAY)).toBe(false);
    expect(isPastEvent(card('sans', null), TODAY)).toBe(false);
  });

  it('badge : « Passé » (done), « À venir » au-delà d’une semaine ou sans date', () => {
    expect(eventBadge(card('hier', '2026-10-16'), TODAY, TONE)).toEqual({
      tone: 'done',
      labelKey: 'status.scenario_passe',
      draft: false,
    });
    for (const c of [card('loin', '2026-11-30'), card('sans', null)]) {
      expect(eventBadge(c, TODAY, TONE)).toEqual({
        tone: 'soon',
        labelKey: 'status.scenario_a_venir',
        draft: false,
      });
    }
  });

  it('badge : « Dans n jours » dans la semaine (near), PLEIN au palier imminent (aujourd’hui / demain)', () => {
    expect(eventBadge(card('d3', '2026-10-20'), TODAY, TONE)).toEqual(
      expect.objectContaining({ tone: 'soon', intensity: 'near', text: 'Dans 3 jours' }),
    );
    expect(eventBadge(card('d1', '2026-10-18'), TODAY, TONE)).toEqual(
      expect.objectContaining({ intensity: 'imminent', text: 'Demain' }),
    );
    expect(eventBadge(card('d0', TODAY), TODAY, TONE)).toEqual(
      expect.objectContaining({ intensity: 'imminent', text: 'Aujourd’hui' }),
    );
    expect(isImminentEvent(card('d1', '2026-10-18'), TODAY)).toBe(true);
    expect(isImminentEvent(card('d3', '2026-10-20'), TODAY)).toBe(false);
    expect(isImminentEvent(card('hier', '2026-10-16'), TODAY)).toBe(false);
  });

  it('date en gras : « Sam. 10 oct. · soir » ; sans date : « Date à fixer »', () => {
    expect(eventDateLabel(card('a', '2026-10-10'), TONE)).toBe('Sam. 10 oct. · soir');
    expect(
      eventDateLabel(
        card('b', '2026-10-25', {
          seance: { ...card('b', '2026-10-25').seance!, slot: 'AFTERNOON' },
        }),
        TONE,
      ),
    ).toBe('Dim. 25 oct. · après-midi');
    expect(eventDateLabel(card('c', null), TONE)).toBe(TONE['partie.ralliement_event_no_date']);
  });

  it('situation : l’hôte participe (« J’y étais » une fois passée), les autres ne sont pas inscrits (pointillés)', () => {
    expect(eventSituation(card('f', '2026-10-20'), 'hote', TODAY)).toEqual({
      labelKey: 'partie.ralliement_event_chip_participating',
      dotted: false,
    });
    expect(eventSituation(card('p', '2026-10-01'), 'hote', TODAY)).toEqual({
      labelKey: 'partie.ralliement_event_chip_was_there',
      dotted: false,
    });
    expect(eventSituation(card('f', '2026-10-20'), 'autre', TODAY)).toEqual({
      labelKey: 'partie.ralliement_event_chip_not_registered',
      dotted: true,
    });
    expect(eventSituation(card('f', '2026-10-20'), null, TODAY).dotted).toBe(true);
  });

  it('sections : à venir par date croissante (sans date en dernier), passées de la plus récente à la plus ancienne', () => {
    const { upcoming, past } = splitEvents(
      [
        card('sans', null),
        card('loin', '2026-12-01'),
        card('vieux', '2026-09-01'),
        card('auj', TODAY),
        card('recent', '2026-10-15'),
      ],
      TODAY,
    );
    expect(upcoming.map((c) => c.id)).toEqual(['auj', 'loin', 'sans']);
    expect(past.map((c) => c.id)).toEqual(['recent', 'vieux']);
  });

  it('même jour : tri par créneau (matin < après-midi < soir) ; passées dans l’ordre inverse de la clé complète', () => {
    const at = (id: string, date: string, slot: 'MORNING' | 'AFTERNOON' | 'EVENING') =>
      card(id, date, { seance: { ...card(id, date).seance!, slot } });
    const { upcoming, past } = splitEvents(
      [
        at('f-soir', '2026-10-20', 'EVENING'),
        at('f-matin', '2026-10-20', 'MORNING'),
        at('f-aprem', '2026-10-20', 'AFTERNOON'),
        at('p-matin', '2026-10-10', 'MORNING'),
        at('p-soir', '2026-10-10', 'EVENING'),
      ],
      TODAY,
    );
    expect(upcoming.map((c) => c.id)).toEqual(['f-matin', 'f-aprem', 'f-soir']);
    expect(past.map((c) => c.id)).toEqual(['p-soir', 'p-matin']);
  });

  describe('Story 40.2', () => {
    const withPeople = (capacity: number | null, n: number) =>
      card('x', '2026-10-20', {
        seance: { ...card('x', '2026-10-20').seance!, capacity, placesTaken: n },
        participants: Array.from({ length: n }, (_, k) => ({
          userId: k === 0 ? 'hote' : `u${k}`,
          displayName: `P${k}`,
          isHost: k === 0,
          isAdmin: false,
          status: 'CONFIRMED' as const,
        })),
      });

    it('hôte et participants : « participe », les autres non', () => {
      const c = withPeople(8, 3);
      expect(isHostOf(c, 'hote')).toBe(true);
      expect(isHostOf(c, 'u1')).toBe(false);
      expect(isParticipantOf(c, 'u1')).toBe(true);
      expect(isParticipantOf(c, 'étranger')).toBe(false);
      expect(isParticipantOf(c, null)).toBe(false);
      expect(eventSituation(c, 'u1', TODAY)).toEqual({
        labelKey: 'partie.ralliement_event_chip_participating',
        dotted: false,
      });
    });

    it('texte du panneau de situation : hôte / inscrit / non inscrit, au présent ou à l’imparfait', () => {
      const futur = withPeople(8, 2);
      const passe = card('p', '2026-10-01', { participants: futur.participants });
      expect(eventSituationTextKey(futur, 'hote', TODAY)).toBe(
        'partie.ralliement_event_situation_host',
      );
      expect(eventSituationTextKey(futur, 'u1', TODAY)).toBe(
        'partie.ralliement_event_situation_registered',
      );
      expect(eventSituationTextKey(futur, 'x', TODAY)).toBe(
        'partie.ralliement_event_situation_none',
      );
      expect(eventSituationTextKey(passe, 'hote', TODAY)).toBe(
        'partie.ralliement_event_situation_host_past',
      );
      expect(eventSituationTextKey(passe, 'u1', TODAY)).toBe(
        'partie.ralliement_event_situation_registered_past',
      );
      expect(eventSituationTextKey(passe, 'x', TODAY)).toBe(
        'partie.ralliement_event_situation_none_past',
      );
    });

    it('soirée isolée (Story 41.4) : la pastille d’un membre est « Je participe », puis « J’y étais » une fois passée', () => {
      const futur = withPeople(8, 2);
      const passe = card('p', '2026-10-01', { participants: futur.participants });
      expect(eventSituation(futur, 'x', TODAY).labelKey).toBe(
        'partie.ralliement_event_chip_not_registered',
      );
      expect(eventSituation(futur, 'x', TODAY, true)).toEqual({
        labelKey: 'partie.ralliement_event_chip_participating',
        dotted: false,
      });
      expect(eventSituation(passe, 'x', TODAY, true).labelKey).toBe(
        'partie.ralliement_event_chip_was_there',
      );
    });

    it('soirée isolée (Story 41.1) : tout membre non hôte « participe », sans ligne d’inscription', () => {
      const futur = withPeople(8, 2);
      const passe = card('p', '2026-10-01', { participants: futur.participants });
      expect(eventSituationTextKey(futur, 'x', TODAY, true)).toBe(
        'partie.ralliement_event_situation_registered',
      );
      expect(eventSituationTextKey(passe, 'x', TODAY, true)).toBe(
        'partie.ralliement_event_situation_registered_past',
      );
      // L'hôte reste l'hôte.
      expect(eventSituationTextKey(futur, 'hote', TODAY, true)).toBe(
        'partie.ralliement_event_situation_host',
      );
    });

    it('participation : « 8 places · 5 inscrits · 3 libres » (l’hôte compte), accords du français, « Tous les membres »', () => {
      expect(participationLine(withPeople(8, 5), TONE)).toBe('8 places · 5 inscrits · 3 libres');
      expect(participationLine(withPeople(2, 1), TONE)).toBe('2 places · 1 inscrit · 1 libre');
      expect(participationLine(withPeople(3, 3), TONE)).toBe('3 places · 3 inscrits · 0 libre');
      expect(participationLine(withPeople(null, 4), TONE)).toBe('Tous les membres');
      expect(frUnit('place|places', 0)).toBe('0 place');
      expect(frUnit('place|places', 2)).toBe('2 places');
    });

    it('initiales : une ou deux lettres, majuscules', () => {
      expect(initialsOf('Hélène Hôte')).toBe('HH');
      expect(initialsOf('  léa ')).toBe('L');
      expect(initialsOf('Jean de la Fontaine')).toBe('JF');
      expect(initialsOf('')).toBe('?');
    });
  });

  describe('Story 40.3 — inscription, « Complet »', () => {
    const people = (capacity: number | null, ids: string[], date = '2026-10-20') =>
      card('x', date, {
        seance: { ...card('x', date).seance!, capacity, placesTaken: ids.length },
        participants: ids.map((id) => ({
          userId: id,
          displayName: id,
          isHost: id === 'hote',
          isAdmin: false,
          status: 'CONFIRMED' as const,
        })),
      });
    // Capacité 3 : l'hôte et deux inscrits la remplissent.
    const full = people(3, ['hote', 'u1', 'u2']);

    it('complet = places limitées toutes prises (l’hôte compte) ; « Tous les membres » ne l’est jamais', () => {
      expect(isFull(full)).toBe(true);
      expect(isFull(people(3, ['hote', 'u1']))).toBe(false);
      expect(isFull(people(null, ['hote', 'u1', 'u2', 'u3']))).toBe(false);
      expect(isFull(card('sans', null, { seance: null }))).toBe(false);
    });

    it('« Complet » ne s’applique qu’à un membre NON inscrit, sur une conjonction à venir', () => {
      expect(isFullForViewer(full, 'autre', TODAY)).toBe(true);
      expect(isFullForViewer(full, 'u1', TODAY)).toBe(false);
      expect(isFullForViewer(full, 'hote', TODAY)).toBe(false);
      expect(isFullForViewer(people(3, ['hote', 'u1', 'u2'], '2026-10-01'), 'autre', TODAY)).toBe(
        false,
      );
    });

    it('badge : « Complet » en gris (teinte done, libellé écrit) pour le non-inscrit ; badge normal pour l’inscrit et l’hôte', () => {
      expect(eventBadge(full, TODAY, TONE, 'autre')).toEqual({
        tone: 'done',
        labelKey: 'status.scenario_passe',
        draft: false,
        text: 'Complet',
      });
      for (const viewer of ['u1', 'hote']) {
        expect(eventBadge(full, TODAY, TONE, viewer)).toEqual(
          expect.objectContaining({ tone: 'soon', text: 'Dans 3 jours' }),
        );
      }
      // Pas complet : badge normal pour tout le monde. Passée : « Passé », pas « Complet ».
      expect(eventBadge(people(3, ['hote']), TODAY, TONE, 'autre').text).toBe('Dans 3 jours');
      expect(
        eventBadge(people(3, ['hote', 'u1', 'u2'], '2026-10-01'), TODAY, TONE, 'autre').labelKey,
      ).toBe('status.scenario_passe');
      expect(
        eventBadge(people(3, ['hote', 'u1', 'u2'], '2026-10-01'), TODAY, TONE, 'autre').text,
      ).toBeUndefined();
    });

    it('s’inscrire : membre non inscrit, conjonction à venir et pas complète — ni l’hôte, ni un inscrit, ni sans identité', () => {
      const open = people(3, ['hote', 'u1']);
      expect(canSignUp(open, 'autre', TODAY)).toBe(true);
      expect(canSignUp(open, 'u1', TODAY)).toBe(false);
      expect(canSignUp(open, 'hote', TODAY)).toBe(false);
      expect(canSignUp(open, null, TODAY)).toBe(false);
      expect(canSignUp(full, 'autre', TODAY)).toBe(false);
      expect(canSignUp(people(null, ['hote'], '2026-10-01'), 'autre', TODAY)).toBe(false);
      expect(canSignUp(people(null, ['hote'], TODAY), 'autre', TODAY)).toBe(true);
    });

    it('sans séance : ni « S’inscrire » ni « Me désinscrire » (le clic ne ferait rien)', () => {
      const noSeance = card('n', null, {
        seance: null,
        participants: [
          { userId: 'u1', displayName: 'u1', isHost: false, isAdmin: false, status: 'CONFIRMED' },
        ],
      });
      expect(canSignUp(noSeance, 'autre', TODAY)).toBe(false);
      expect(canUnsubscribe(noSeance, 'u1', TODAY)).toBe(false);
    });

    it('se désinscrire : un inscrit non hôte, tant que la conjonction n’est pas passée', () => {
      const open = people(3, ['hote', 'u1']);
      expect(canUnsubscribe(open, 'u1', TODAY)).toBe(true);
      expect(canUnsubscribe(open, 'hote', TODAY)).toBe(false);
      expect(canUnsubscribe(open, 'autre', TODAY)).toBe(false);
      expect(canUnsubscribe(people(3, ['hote', 'u1'], '2026-10-01'), 'u1', TODAY)).toBe(false);
      expect(canUnsubscribe(full, 'u1', TODAY)).toBe(true);
    });
  });

  describe('Story 40.4 — places réservées', () => {
    /** Conjonction à 4 places : l'hôte, un inscrit, et une place réservée à `resa`. Vue d'un membre
     *  quelconque : la place réservée n'est pas dans la liste, mais « placesTaken » la compte. */
    const held = (over: Partial<EventCardDto> = {}, date = '2026-10-20') =>
      card('x', date, {
        seance: { ...card('x', date).seance!, capacity: 4, placesTaken: 3 },
        participants: [
          { userId: 'hote', displayName: 'Léa', isHost: true, isAdmin: false, status: 'CONFIRMED' },
          { userId: 'u1', displayName: 'Zoé', isHost: false, isAdmin: false, status: 'CONFIRMED' },
        ],
        ...over,
      });
    /** Même conjonction vue de l'hôte : la réservation en attente figure parmi les participants. */
    const heldForHost = () =>
      held({
        participants: [
          ...held().participants,
          { userId: 'resa', displayName: 'Sam', isHost: false, isAdmin: false, status: 'RESERVED' },
        ],
      });

    it('« Complet » vient de placesTaken : une place tenue (réservée) compte, sans être listée', () => {
      const almost = held({ seance: { ...held().seance!, capacity: 3 } });
      expect(isFull(almost)).toBe(true);
      expect(isFull(held())).toBe(false);
      // Un membre sans ligne ne peut plus s'inscrire et lit « Complet ».
      expect(canSignUp(almost, 'autre', TODAY)).toBe(false);
      expect(isFullForViewer(almost, 'autre', TODAY)).toBe(true);
    });

    it('la personne qui tient la place réservée n’est pas « inscrite » : elle ne s’inscrit pas et la conjonction n’est pas « complète » pour elle', () => {
      const mine = held({
        seance: { ...held().seance!, capacity: 3 },
        myInscription: 'RESERVED',
      });
      expect(isParticipantOf(mine, 'resa')).toBe(false);
      expect(canSignUp(mine, 'resa', TODAY)).toBe(false);
      expect(isFullForViewer(mine, 'resa', TODAY)).toBe(false);
      expect(canUnsubscribe(mine, 'resa', TODAY)).toBe(false);
    });

    it('une ligne RESERVED de la liste (vue de l’hôte) n’est pas une participation', () => {
      expect(isParticipantOf(heldForHost(), 'resa')).toBe(false);
      expect(isParticipantOf(heldForHost(), 'u1')).toBe(true);
      expect(isParticipantOf(heldForHost(), 'hote')).toBe(true);
    });

    it('participation : « inscrits » = hôte + confirmés ; « libres » = capacité − places prises (réservées comprises)', () => {
      // 4 places · 2 inscrits · 1 libre (la 3e place est tenue, la 4e libre) — vue de n'importe qui.
      expect(participationLine(held(), TONE)).toBe('4 places · 2 inscrits · 1 libre');
      expect(participationLine(heldForHost(), TONE)).toBe('4 places · 2 inscrits · 1 libre');
    });

    it('puce de situation : « Place réservée » (pleine) pour qui tient une place ; « Pas inscrit·e » (pointillée) une fois la conjonction passée', () => {
      const mine = held({ myInscription: 'RESERVED' });
      expect(eventSituation(mine, 'resa', TODAY)).toEqual({
        labelKey: 'partie.ralliement_event_chip_reserved',
        dotted: false,
      });
      const past = held({ myInscription: 'RESERVED' }, '2026-10-01');
      expect(eventSituation(past, 'resa', TODAY)).toEqual({
        labelKey: 'partie.ralliement_event_chip_not_registered',
        dotted: true,
      });
    });

    it('texte du panneau : « réservée » (au présent), « réservée_past » à l’imparfait', () => {
      expect(eventSituationTextKey(held({ myInscription: 'RESERVED' }), 'resa', TODAY)).toBe(
        'partie.ralliement_event_situation_reserved',
      );
      expect(
        eventSituationTextKey(held({ myInscription: 'RESERVED' }, '2026-10-01'), 'resa', TODAY),
      ).toBe('partie.ralliement_event_situation_reserved_past');
    });

    it('répondre à la réservation : seulement avec une place réservée, avant le jour passé', () => {
      expect(canRespondToReservation(held({ myInscription: 'RESERVED' }), TODAY)).toBe(true);
      expect(canRespondToReservation(held({ myInscription: 'CONFIRMED' }), TODAY)).toBe(false);
      expect(canRespondToReservation(held(), TODAY)).toBe(false);
      expect(
        canRespondToReservation(held({ myInscription: 'RESERVED' }, '2026-10-01'), TODAY),
      ).toBe(false);
      expect(
        canRespondToReservation(held({ myInscription: 'RESERVED', seance: null }), TODAY),
      ).toBe(false);
    });

    it('gérer les réservations : l’hôte, places limitées, pas passée', () => {
      expect(canManageReservations(held(), 'hote', TODAY)).toBe(true);
      expect(canManageReservations(held(), 'u1', TODAY)).toBe(false);
      expect(canManageReservations(held(), null, TODAY)).toBe(false);
      expect(canManageReservations(held({}, '2026-10-01'), 'hote', TODAY)).toBe(false);
      const open = held({ seance: { ...held().seance!, capacity: null } });
      expect(canManageReservations(open, 'hote', TODAY)).toBe(false);
      expect(canManageReservations(held({ seance: null }), 'hote', TODAY)).toBe(false);
    });

    it('une place en attente se reconnaît à son statut', () => {
      const [, , pending] = heldForHost().participants;
      expect(isPendingParticipant(pending)).toBe(true);
      expect(isPendingParticipant(heldForHost().participants[1])).toBe(false);
    });
  });

  // ─── Sondage de dates (Story 40.5) ─────────────────────────────────────────────────────────────
  describe('sondage de dates (Story 40.5)', () => {
    const HOST = 'hote';
    const pollCard = (
      pollOver: Partial<NonNullable<EventCardDto['poll']>> = {},
      over: Partial<EventCardDto> = {},
    ): EventCardDto =>
      card('p', null, {
        poll: {
          id: 'poll-1',
          expiresAt: '2026-10-20T23:59:59.999Z',
          status: 'OPEN',
          eligibleVoterIds: [HOST, 'a', 'b'],
          durationSlots: 1,
          options: [
            { id: 'o1', date: '2026-10-24', slot: 'EVENING', availableCount: 2 },
            { id: 'o2', date: '2026-10-25', slot: 'MORNING', availableCount: 1 },
          ],
          votes: [],
          ...pollOver,
        },
        ...over,
      });
    const name = (id: string) => ({ hote: 'Léa', a: 'Zoé', b: 'Sam' })[id] ?? id;

    it('libellés : jour court, plage (mois écrit une fois), créneau', () => {
      expect(shortDayLabel('2026-10-25')).toBe('dim. 25 oct.');
      expect(shortDayLabel('2026-10-25', false)).toBe('dim. 25');
      expect(pollRangeLabel(['2026-10-25', '2026-10-17'])).toBe('sam. 17 → dim. 25 oct.');
      expect(pollRangeLabel(['2026-10-30', '2026-11-02'])).toBe('ven. 30 oct. → lun. 2 nov.');
      expect(pollRangeLabel(['2026-10-17'])).toBe('sam. 17 oct.');
      expect(pollRangeLabel([])).toBe('');
      expect(pollSlotLabel({ date: '2026-10-24', slot: 'EVENING' })).toBe('sam. 24 oct. · soir');
      expect(
        pollSummaryLabel(
          [{ date: '2026-10-17' }, { date: '2026-10-25' }, { date: '2026-10-20' }],
          TONE,
        ),
      ).toBe('3 créneaux · sam. 17 → dim. 25 oct.');
    });

    it('ouvert jusqu’au jour d’échéance compris ; terminé le lendemain ; une date posée clôt le sondage', () => {
      expect(isPollOpen(pollCard(), '2026-10-20')).toBe(true);
      expect(isPollOpen(pollCard(), '2026-10-21')).toBe(false);
      expect(isPollEnded(pollCard(), '2026-10-21')).toBe(true);
      expect(isPollEnded(pollCard(), '2026-10-20')).toBe(false);
      expect(isPollOpen(pollCard({ status: 'CLOSED' }), TODAY)).toBe(false);
      expect(isPollOpen(card('d', '2026-10-24'), TODAY)).toBe(false);
      expect(hasPendingPoll(card('d', '2026-10-24'))).toBe(false);
    });

    it('vote à faire : éligible qui n’a répondu à aucun créneau ; plus après une réponse, ni hors éligibles', () => {
      expect(needsVote(pollCard(), 'a', TODAY)).toBe(true);
      expect(needsVote(pollCard(), HOST, TODAY)).toBe(true);
      expect(needsVote(pollCard(), 'inconnu', TODAY)).toBe(false);
      expect(needsVote(pollCard(), null, TODAY)).toBe(false);
      const answered = pollCard({ votes: [{ optionId: 'o1', userId: 'a', answer: 'NO' }] });
      expect(needsVote(answered, 'a', TODAY)).toBe(false);
      expect(answeredSlotCount(answered, 'a')).toBe(1);
      expect(needsVote(pollCard(), 'a', '2026-10-21')).toBe(false);
      // Une réponse d’une personne qui n’est plus éligible ne compte pas.
      const gone = pollCard({ votes: [{ optionId: 'o1', userId: 'parti', answer: 'YES' }] });
      expect(respondentIds(gone)).toEqual([]);
      expect(pollBestSlot(gone)).toBeNull();
    });

    it('badge : « Vote en cours » orange pour qui doit voter, cyan sinon ; plus de badge de vote une fois terminé', () => {
      const todo = eventBadge(pollCard(), TODAY, TONE, 'a');
      expect(todo).toMatchObject({ tone: 'todo', text: 'Vote en cours' });
      const voted = pollCard({ votes: [{ optionId: 'o1', userId: 'a', answer: 'YES' }] });
      expect(eventBadge(voted, TODAY, TONE, 'a')).toMatchObject({
        tone: 'live',
        text: 'Vote en cours',
      });
      expect(eventBadge(pollCard({ eligibleVoterIds: [HOST] }), TODAY, TONE, 'a')).toMatchObject({
        tone: 'live',
      });
      expect(eventBadge(pollCard(), '2026-10-21', TONE, 'a').text).toBeUndefined();
    });

    it('ligne de date « Date à voter · jusqu’au … » ; puce « Vote à faire » qui l’emporte sur la situation', () => {
      expect(eventDateLabel(pollCard(), TONE)).toBe('Date à voter · jusqu’au mar. 20 oct.');
      expect(eventSituation(pollCard(), 'a', TODAY)).toEqual({
        labelKey: 'partie.ralliement_event_chip_vote_todo',
        dotted: false,
      });
      const voted = pollCard({ votes: [{ optionId: 'o1', userId: HOST, answer: 'YES' }] });
      expect(eventSituation(voted, HOST, TODAY).labelKey).toBe(
        'partie.ralliement_event_chip_participating',
      );
    });

    it('tri : une conjonction à sondage (sans date) vient après les conjonctions datées', () => {
      const { upcoming } = splitEvents([pollCard(), card('x', '2026-12-01')], TODAY);
      expect(upcoming.map((c) => c.id)).toEqual(['x', 'p']);
    });

    it('meilleur créneau : le plus de « oui » parmi les éligibles, à égalité le plus de « peut-être » puis le plus proche', () => {
      const votes = [
        { optionId: 'o1', userId: 'a', answer: 'YES' as const },
        { optionId: 'o2', userId: 'a', answer: 'YES' as const },
        { optionId: 'o2', userId: 'b', answer: 'MAYBE' as const },
      ];
      expect(pollBestSlot(pollCard({ votes }))?.option.id).toBe('o2');
      expect(pollBestSlot(pollCard({ votes }))?.yes).toBe(1);
      expect(pollBestSlot(pollCard({ votes: [votes[0]] }))?.option.id).toBe('o1');
      expect(
        pollBestSlot(pollCard({ votes: [{ optionId: 'o1', userId: 'a', answer: 'NO' }] })),
      ).toBeNull();
    });

    it('panneau membre : « à faire » avec la date de fin, puis ses réponses ; « terminé » après l’échéance', () => {
      const todo = pollPanel(pollCard(), 'a', TODAY, TONE, name)!;
      expect(todo).toMatchObject({
        kind: 'member-todo',
        text: 'Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le mar. 20 oct.',
        answersLine: 'Vos réponses : 0 créneau sur 2',
        bestLine: null,
        waitingLine: null,
      });
      const voted = pollCard({
        votes: [
          { optionId: 'o1', userId: 'a', answer: 'YES' },
          { optionId: 'o2', userId: 'a', answer: 'MAYBE' },
        ],
      });
      expect(pollPanel(voted, 'a', TODAY, TONE, name)).toMatchObject({
        kind: 'member-done',
        answersLine: 'Vos réponses : 2 créneaux sur 2',
        bestLine: 'Meilleur créneau pour l’instant : sam. 24 oct. · soir — 1 oui',
      });
      expect(pollPanel(pollCard(), 'a', '2026-10-21', TONE, name)).toMatchObject({
        kind: 'member-done',
        ended: true,
        text: 'Le vote est terminé.',
      });
    });

    it('panneau hôte : jours restants, réponses x sur N, qui n’a pas répondu — recalculé depuis les votes', () => {
      const none = pollPanel(pollCard(), HOST, TODAY, TONE, name)!;
      expect(none).toMatchObject({
        kind: 'host',
        text: 'Vous êtes l’hôte. Le vote se termine dans 3 jours — 2 créneaux proposés.',
        answersLine: 'Réponses : 0 sur 3',
        waitingLine: 'N’ont pas encore répondu : Léa, Zoé, Sam',
      });
      const some = pollCard({
        votes: [
          { optionId: 'o1', userId: HOST, answer: 'YES' },
          { optionId: 'o1', userId: 'a', answer: 'YES' },
        ],
      });
      expect(pollPanel(some, HOST, TODAY, TONE, name)).toMatchObject({
        answersLine: 'Réponses : 2 sur 3',
        waitingLine: 'N’ont pas encore répondu : Sam',
      });
      const all = pollCard({
        votes: ['hote', 'a', 'b'].map((userId) => ({
          optionId: 'o1',
          userId,
          answer: 'YES' as const,
        })),
      });
      expect(pollPanel(all, HOST, TODAY, TONE, name)).toMatchObject({
        answersLine: 'Réponses : 3 sur 3',
        waitingLine: null,
      });
      // Demain / aujourd’hui.
      expect(pollPanel(pollCard(), HOST, '2026-10-19', TONE, name)!.text).toContain('demain');
      expect(pollPanel(pollCard(), HOST, '2026-10-20', TONE, name)!.text).toContain('aujourd’hui');
    });

    it('mois sans point (mars, mai, juin, août) : seul le point final d’une abréviation est retiré, jamais une lettre', () => {
      const march = pollCard({ expiresAt: '2026-03-20T23:59:59.999Z' });
      expect(pollPanel(march, 'a', '2026-03-10', TONE, name)!.text).toBe(
        'Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le ven. 20 mars.',
      );
      const august = pollCard({ expiresAt: '2026-08-20T23:59:59.999Z' });
      expect(pollPanel(august, 'a', '2026-08-10', TONE, name)!.text).toContain('jeu. 20 août.');
    });

    it('panneau d’un lecteur non éligible ; aucun panneau pour une conjonction datée', () => {
      expect(pollPanel(pollCard({ eligibleVoterIds: [HOST] }), 'a', TODAY, TONE, name)?.kind).toBe(
        'not-eligible',
      );
      expect(pollPanel(card('d', '2026-10-24'), 'a', TODAY, TONE, name)).toBeNull();
    });

    it('lignes de créneau : libellé et nombre d’inscrits disponibles, accordé', () => {
      expect(pollSlotRows(pollCard(), TONE)).toEqual([
        { id: 'o1', label: 'sam. 24 oct. · soir', available: '2 inscrits disponibles' },
        { id: 'o2', label: 'dim. 25 oct. · matin', available: '1 inscrit disponible' },
      ]);
    });

    it('plage (Story 47.5) : « meilleur créneau » du panneau et lignes de créneau de la fiche s’écrivent de début à fin', () => {
      const long = pollCard({
        durationSlots: 6,
        votes: [
          { optionId: 'o1', userId: 'a', answer: 'YES' },
          { optionId: 'o2', userId: 'a', answer: 'MAYBE' },
        ],
      });
      const panel = pollPanel(long, 'a', TODAY, TONE, name)!;
      expect(panel.bestLine).toBe(
        'Meilleur créneau pour l’instant : sam. 24 oct. soir → lun. 26 oct. après-midi — 1 oui',
      );
      expect(pollSlotRows(long, TONE).map((r) => r.label)).toEqual([
        'sam. 24 oct. soir → lun. 26 oct. après-midi',
        'dim. 25 oct. matin → lun. 26 oct. soir',
      ]);
      // Un créneau seul : le texte d’avant.
      expect(pollPanel(pollCard({ votes: long.poll!.votes }), 'a', TODAY, TONE, name)!.bestLine).not.toContain('→');
    });
  });

  describe('fixer la date (Story 40.6)', () => {
    const HOST = 'hote';
    const slots = [
      { id: 'o1', date: '2026-10-24', slot: 'EVENING' as const, availableCount: 0 },
      { id: 'o2', date: '2026-10-25', slot: 'MORNING' as const, availableCount: 0 },
      { id: 'o3', date: '2026-10-25', slot: 'EVENING' as const, availableCount: 0 },
      { id: 'o4', date: '2026-10-31', slot: 'EVENING' as const, availableCount: 0 },
    ];
    const answer = (optionId: string, userId: string, a: 'YES' | 'MAYBE' | 'NO') => ({
      optionId,
      userId,
      answer: a,
    });
    const pollCard = (
      votes: { optionId: string; userId: string; answer: 'YES' | 'MAYBE' | 'NO' }[],
      over: Partial<NonNullable<EventCardDto['poll']>> = {},
    ): EventCardDto =>
      card('p', null, {
        poll: {
          id: 'poll-1',
          expiresAt: '2026-10-20T23:59:59.999Z',
          status: 'OPEN',
          eligibleVoterIds: [HOST, 'a', 'b', 'c'],
          durationSlots: 1,
          options: slots,
          votes,
          ...over,
        },
      });

    it('créneaux du plus au moins plébiscité : oui décroissant, puis peut-être décroissant, puis non croissant, puis date', () => {
      const ranked = rankedPollSlots(
        pollCard([
          // o2 : 2 oui · 0 peut-être · 1 non
          answer('o2', HOST, 'YES'),
          answer('o2', 'a', 'YES'),
          answer('o2', 'b', 'NO'),
          // o3 : 2 oui · 1 peut-être · 0 non — devant o2 (plus de peut-être)
          answer('o3', HOST, 'YES'),
          answer('o3', 'a', 'YES'),
          answer('o3', 'b', 'MAYBE'),
          // o4 : 1 oui
          answer('o4', 'c', 'YES'),
          // o1 : aucune réponse
        ]),
        TODAY,
      );
      expect(ranked.map((r) => [r.id, r.yes, r.maybe, r.no])).toEqual([
        ['o3', 2, 1, 0],
        ['o2', 2, 0, 1],
        ['o4', 1, 0, 0],
        ['o1', 0, 0, 0],
      ]);
      expect(ranked[0].label).toBe('dim. 25 oct. · soir');
      // Story 44.3 : `bestOption` classe sur le jour et le moment du créneau.
      expect(ranked[0]).toMatchObject({ date: '2026-10-25', slot: 'EVENING' });
    });

    it('plage (Story 47.5) : chaque candidat s’écrit de son début à sa fin, un créneau seul est inchangé', () => {
      const long = rankedPollSlots(pollCard([], { durationSlots: 6 }), TODAY);
      expect(long.map((r) => r.label)).toEqual([
        'sam. 24 oct. soir → lun. 26 oct. après-midi',
        'dim. 25 oct. matin → lun. 26 oct. soir',
        'dim. 25 oct. soir → mar. 27 oct. après-midi',
        'sam. 31 oct. soir → lun. 2 nov. après-midi',
      ]);
      expect(rankedPollSlots(pollCard([]), TODAY)[0].label).toBe('sam. 24 oct. · soir');
      expect(pollSlotLabel({ date: '2026-10-24', slot: 'EVENING' }, 6)).toBe(
        'sam. 24 oct. soir → lun. 26 oct. après-midi',
      );
      expect(pollSlotLabel({ date: '2026-10-24', slot: 'EVENING' }, 1)).toBe('sam. 24 oct. · soir');
      expect(
        rankedEntrySlots(
          [{ optionId: 'x', date: '2026-10-24', slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null }],
          TODAY,
          6,
        )[0].label,
      ).toBe('sam. 24 oct. soir → lun. 26 oct. après-midi');
    });

    it('à égalité parfaite : le plus proche d’abord, le matin avant le soir d’un même jour ; sans réponse, ordre chronologique', () => {
      expect(rankedPollSlots(pollCard([]), TODAY).map((r) => r.id)).toEqual([
        'o1',
        'o2',
        'o3',
        'o4',
      ]);
      // Moins de « non » l’emporte sur la date.
      const fewerNo = rankedPollSlots(
        pollCard([answer('o4', HOST, 'YES'), answer('o1', HOST, 'YES'), answer('o1', 'a', 'NO')]),
        TODAY,
      );
      expect(fewerNo.map((r) => r.id).slice(0, 2)).toEqual(['o4', 'o1']);
    });

    it('seules les réponses des votants éligibles comptent (comme le meilleur créneau du panneau)', () => {
      const ranked = rankedPollSlots(
        pollCard([
          answer('o4', 'parti', 'YES'),
          answer('o4', 'autre', 'YES'),
          answer('o1', 'a', 'YES'),
        ]),
        TODAY,
      );
      expect(ranked[0]).toMatchObject({ id: 'o1', yes: 1 });
      expect(ranked.find((r) => r.id === 'o4')).toMatchObject({ yes: 0 });
      expect(rankedPollSlots(card('d', '2026-10-24'), TODAY)).toEqual([]);
    });

    it('un créneau dont le jour est avant aujourd’hui est marqué passé (aujourd’hui ne l’est pas), sans changer l’ordre', () => {
      const ranked = rankedPollSlots(pollCard([answer('o1', HOST, 'YES')]), '2026-10-25');
      expect(ranked.map((r) => [r.id, r.past])).toEqual([
        ['o1', true],
        ['o2', false],
        ['o3', false],
        ['o4', false],
      ]);
    });

    it('décompte écrit : « n oui · n peut-être · n non »', () => {
      expect(
        pollCountsLabel(
          { id: 'x', date: '2026-10-25', slot: 'EVENING', label: 'x', yes: 4, maybe: 0, no: 1, past: false },
          TONE,
        ),
      ).toBe('4 oui · 0 peut-être · 1 non');
    });

    it('« Fixer la date… » : seulement avec le droit `can.choose` du serveur, sondage ouvert (même échéance dépassée) avec au moins un créneau, séance sans date', () => {
      expect(canFixDate(withCan(pollCard([])))).toBe(true);
      // L'échéance dépassée ne bloque pas l'hôte (le sondage reste ouvert côté serveur).
      expect(canFixDate(withCan(pollCard([], { expiresAt: '2026-10-01T23:59:59.999Z' })))).toBe(
        true,
      );
      // Un administrateur qui n'est pas l'hôte, ou tout autre membre : le serveur ne lui donne pas le droit.
      expect(canFixDate(withCan(pollCard([]), NO_CAN))).toBe(false);
      expect(canFixDate(pollCard([]))).toBe(false);
      expect(canFixDate(withCan(pollCard([], { status: 'CLOSED' })))).toBe(false);
      expect(canFixDate(withCan(pollCard([], { options: [] })))).toBe(false);
      expect(canFixDate(withCan(card('d', '2026-10-24')))).toBe(false);
    });
  });

  // Story 40.7 — prolonger le vote : droit côté écran (le serveur reste juge) et jour minimal proposable.
  describe('prolonger le vote (Story 40.7)', () => {
    const HOST = 'hote';
    const pollCard = (
      pollOver: Partial<NonNullable<EventCardDto['poll']>> = {},
      over: Partial<EventCardDto> = {},
    ): EventCardDto =>
      card('p', null, {
        poll: {
          id: 'poll-1',
          expiresAt: '2026-10-24T23:59:59.999Z',
          status: 'OPEN',
          eligibleVoterIds: [HOST, 'a'],
          durationSlots: 1,
          options: [{ id: 'o1', date: '2026-10-28', slot: 'EVENING', availableCount: 1 }],
          votes: [],
          ...pollOver,
        },
        ...over,
      });

    it('« Prolonger le vote » : seulement avec le droit `can.extend` du serveur, sondage ouvert sans date — l’échéance dépassée ne le bloque pas', () => {
      expect(canExtendVote(withCan(pollCard()))).toBe(true);
      expect(canExtendVote(withCan(pollCard({ expiresAt: '2026-10-01T23:59:59.999Z' })))).toBe(
        true,
      );
      expect(canExtendVote(withCan(pollCard(), NO_CAN))).toBe(false);
      expect(canExtendVote(pollCard())).toBe(false);
      expect(canExtendVote(withCan(pollCard({ status: 'CLOSED' })))).toBe(false);
      expect(canExtendVote(withCan(card('d', '2026-10-24')))).toBe(false);
    });

    it('nextDayKey : le lendemain, passages de mois et d’année compris', () => {
      expect(nextDayKey('2026-10-25')).toBe('2026-10-26');
      expect(nextDayKey('2026-10-31')).toBe('2026-11-01');
      expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
    });

    it('extendMinKey : le lendemain de l’échéance actuelle, jamais avant aujourd’hui', () => {
      // Échéance le 2026-10-24 (pollCard) : au plus tôt le 25.
      expect(extendMinKey(pollCard(), TODAY)).toBe('2026-10-25');
      // Échéance dépassée depuis longtemps : le jour d'aujourd'hui (le serveur refuse un jour passé).
      expect(extendMinKey(pollCard({ expiresAt: '2026-10-01T23:59:59.999Z' }), TODAY)).toBe(TODAY);
      // Échéance aujourd'hui : demain.
      expect(extendMinKey(pollCard({ expiresAt: '2026-10-17T23:59:59.999Z' }), TODAY)).toBe(
        '2026-10-18',
      );
    });
  });

  // Story 42.1 — une conjonction annulée : badge écrit, plus aucune action, annulable avant sa date.
  describe('conjonction annulée (Story 42.1)', () => {
    const cancelled = (date: string | null = '2026-10-24') => card('c', date, { cancelled: true });

    it('isCancelled lit le drapeau du serveur', () => {
      expect(isCancelled(card('a', '2026-10-24'))).toBe(false);
      expect(isCancelled(cancelled())).toBe(true);
    });

    it('le badge dit « Annulée », teinte annulée, et l’emporte sur « Passé » et sur tout autre état', () => {
      for (const date of ['2026-10-24', '2026-10-01', null, TODAY]) {
        const badge = eventBadge(cancelled(date), TODAY, TONE, 'moi');
        expect(badge.tone, String(date)).toBe('cancelled');
        expect(badge.text, String(date)).toBe('Annulée');
        expect(badge.draft).toBe(false);
      }
    });

    it('aucune action sur une conjonction annulée : s’inscrire, se désinscrire, répondre, réserver', () => {
      const base = { myInscription: 'RESERVED' as const };
      const c = card('c', '2026-10-24', { ...base, cancelled: true });
      expect(canSignUp(cancelled(), 'membre', TODAY)).toBe(false);
      expect(canSignUp(card('a', '2026-10-24'), 'membre', TODAY)).toBe(true);
      expect(canRespondToReservation(c, TODAY)).toBe(false);
      expect(canManageReservations(cancelled(), 'hote', TODAY)).toBe(false);
      const joined = card('j', '2026-10-24', {
        cancelled: true,
        participants: [
          { userId: 'x', displayName: 'X', isHost: false, isAdmin: false, status: 'CONFIRMED' },
        ],
      });
      expect(canUnsubscribe(joined, 'x', TODAY)).toBe(false);
      expect(canUnsubscribe({ ...joined, cancelled: false }, 'x', TODAY)).toBe(true);
    });

    it('« Complet » n’est jamais écrit pour une conjonction annulée', () => {
      const full = card('f', '2026-10-24', {
        cancelled: true,
        seance: { ...card('f', '2026-10-24').seance!, capacity: 3, placesTaken: 3 },
      });
      expect(isFullForViewer(full, 'autre', TODAY)).toBe(false);
    });

    it('canCancelEvent : l’hôte ou un administrateur, avant la date, ni passée ni déjà annulée', () => {
      const upcoming = card('a', '2026-10-24');
      expect(canCancelEvent(upcoming, 'hote', false, TODAY)).toBe(true);
      expect(canCancelEvent(upcoming, 'autre', true, TODAY)).toBe(true);
      expect(canCancelEvent(upcoming, 'autre', false, TODAY)).toBe(false);
      expect(canCancelEvent(upcoming, null, false, TODAY)).toBe(false);
      // Sans date (sondage / date à fixer) : annulable ; aujourd’hui : annulable ; passée : non.
      expect(canCancelEvent(card('n', null), 'hote', false, TODAY)).toBe(true);
      expect(canCancelEvent(card('t', TODAY), 'hote', false, TODAY)).toBe(true);
      expect(canCancelEvent(card('p', '2026-10-01'), 'hote', true, TODAY)).toBe(false);
      expect(canCancelEvent(cancelled(), 'hote', true, TODAY)).toBe(false);
    });
  });
});

describe('isPastEvent — une plage commencée reste à venir (Story 47.3)', () => {
  const ranged = (date: string, endDate: string): EventCardDto => {
    const base = card('w', date);
    return { ...base, seance: { ...base.seance!, endDate, endSlot: 'AFTERNOON' } };
  };

  it('commencée hier et finissant demain : à venir ; finie hier : passée', () => {
    expect(isPastEvent(ranged('2026-10-16', '2026-10-18'), TODAY)).toBe(false);
    expect(isPastEvent(ranged('2026-10-14', '2026-10-16'), TODAY)).toBe(true);
    expect(isPastEvent(card('a', '2026-10-16'), TODAY)).toBe(true);
  });
});

describe('eventDateLabel — une plage (Story 47.3)', () => {
  it('une plage de plusieurs créneaux se lit du début à la fin ; un créneau seul garde son texte', () => {
    const base = card('w', '2026-11-06');
    const ranged: EventCardDto = {
      ...base,
      seance: { ...base.seance!, endDate: '2026-11-08', endSlot: 'AFTERNOON' },
    };
    expect(eventDateLabel(ranged, TONE)).toBe('Ven. 6 nov. soir → dim. 8 nov. après-midi');
    expect(eventDateLabel(base, TONE)).toBe('Ven. 6 nov. · soir');
  });
});
