import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { EventCardDto, PartieMemberDto } from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { EventsApiService } from '../events-api.service';
import { EventDialog } from './event-dialog';

const TONE = TONE_MAP['grimoire-emeraude'];
const TODAY = '2026-10-17';
const HOST = 'host';
const ME = 'me';
const OTHER = 'other';
const NO_GAMES = { games: [], brings: [], participantsCount: 1, envies: [] };

const member = (userId: string, displayName: string): PartieMemberDto => ({
  userId,
  pseudo: displayName.toLowerCase(),
  displayName,
  role: 'MEMBER',
  joinedAt: '2026-01-01T00:00:00.000Z',
});

/** Ce que le serveur sert à `userId` (Story 44.1) : l'hôte a les droits d'organisateur, un autre membre aucun. */
function servedTo(card: EventCardDto, userId: string | null): EventCardDto {
  // Une carte qui porte déjà des droits les garde (cas où le serveur retire un droit à l'hôte).
  if (Object.values(card.can).some(Boolean)) return card;
  const host = userId !== null && card.hostId === userId;
  return { ...card, can: { propose: host, edit: host, choose: host, extend: host } };
}

/** Une conjonction à sondage : 3 créneaux, échéance le 20 octobre, votants éligibles donnés. */
function pollCard(over: Partial<EventCardDto['poll'] & object> = {}, host = HOST): EventCardDto {
  return {
    id: 'e1',
    title: 'Sondage plateaux',
    hostId: host,
    hostDisplayName: 'Léa',
    seance: {
      endDate: null,
      endSlot: null,
      durationSlots: 1,
      id: 's1',
      date: null,
      slot: null,
      lieu: null,
      heureRdv: null,
      notePratique: null,
      capacity: null,
      placesTaken: 1,
    },
    participants: [
      { userId: HOST, displayName: 'Léa', isHost: true, isAdmin: false, status: 'CONFIRMED' },
    ],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: {
      id: 'p1',
      expiresAt: '2026-10-20T23:59:59.999Z',
      status: 'OPEN',
      eligibleVoterIds: [HOST, ME, OTHER],
      durationSlots: 1,
      options: [
        { id: 'o1', date: '2026-10-24', slot: 'EVENING', availableCount: 2 },
        { id: 'o2', date: '2026-10-25', slot: 'MORNING', availableCount: 1 },
        { id: 'o3', date: '2026-10-31', slot: 'EVENING', availableCount: 0 },
      ],
      votes: [],
      ...over,
    },
  };
}

@Component({
  imports: [EventDialog],
  template: `<app-event-dialog
    partieId="g1"
    [card]="card()"
    todayKey="2026-10-17"
    [currentUserId]="userId()"
    (calendarRequested)="calendarRequests = calendarRequests + 1"
    (refreshRequested)="refreshRequests = refreshRequests + 1"
  />`,
})
class Host {
  card = signal<EventCardDto>(pollCard());
  userId = signal<string | null>(ME);
  calendarRequests = 0;
  refreshRequests = 0;
}

describe('EventDialog — sondage de dates (Story 40.5)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body
      .querySelectorAll('app-detail-surface, app-library-sheet')
      .forEach((n) => n.remove());
  });

  async function mount(
    card: EventCardDto,
    userId: string | null = ME,
    extra: { api?: object; dialog?: object; boardGames?: object } = {},
  ) {
    // Story 49.1 : l'onglet des jeux sur place (monté sous « Conjonction ») lit `boardGames` et suit `changed`.
    const api = { boardGames: vi.fn().mockResolvedValue(NO_GAMES), ...extra.api };
    const parties = {
      members: vi
        .fn()
        .mockResolvedValue([member(HOST, 'Léa'), member(ME, 'Moi'), member(OTHER, 'Zoé')]),
      changed: signal(0),
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideNoopAnimations(),
        // Story 49.1 : le lien discret de l'onglet des jeux (`routerLink`) demande un routeur.
        provideRouter([]),
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: parties },
        ...(extra.dialog ? [{ provide: MatDialog, useValue: extra.dialog }] : []),
        ...(extra.boardGames ? [{ provide: BoardGamesService, useValue: extra.boardGames }] : []),
        {
          provide: ThemeToneService,
          useValue: { tone: signal(TONE), activeTheme: signal('grimoire-emeraude') },
        },
        {
          provide: BreakpointObserver,
          useValue: {
            isMatched: () => true,
            observe: () => of({ matches: true, breakpoints: {} }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.card.set(servedTo(card, userId));
    fixture.componentInstance.userId.set(userId);
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };
    fixture.detectChanges();
    await settle();
    const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel);
    const text = (sel: string) => q(sel)?.textContent?.trim();
    return { fixture, settle, q, text, parties };
  }

  describe('⚠️ Story 48.3 — le nom d’un participant ouvre sa Ludothèque', () => {
    const withParticipants = (): EventCardDto => ({
      ...pollCard(),
      participants: [
        { userId: HOST, displayName: 'Léa', isHost: true, isAdmin: false, status: 'CONFIRMED' },
        { userId: ME, displayName: 'Moi', isHost: false, isAdmin: false, status: 'CONFIRMED' },
        { userId: OTHER, displayName: 'Zoé', isHost: false, isAdmin: true, status: 'CONFIRMED' },
        { userId: 'tiers', displayName: 'Ana', isHost: false, isAdmin: false, status: 'RESERVED' },
      ],
    });
    const boardGames = () => ({
      listOf: vi.fn().mockResolvedValue({
        owner: { userId: HOST, pseudo: 'lea', displayName: 'Léa' },
        games: [
          {
            id: 'g1',
            name: 'Azul',
            nameKey: 'azul',
            minPlayers: 2,
            maxPlayers: 4,
            durationMin: 40,
            createdAt: '2026-10-29T10:00:00.000Z',
          },
        ],
      }),
      changed: signal(0),
    });

    it('un autre participant : bouton « Voir le cabinet de {nom} » ; sa pastille et une place réservée ne le sont pas', async () => {
      const { q } = await mount(withParticipants(), ME, { boardGames: boardGames() });

      const labels = Array.from(
        document.body.querySelectorAll<HTMLButtonElement>('app-participant-chip button.pc--button'),
      ).map((b) => b.getAttribute('aria-label'));
      expect(labels).toEqual(['Voir le cabinet de Léa', 'Voir le cabinet de Zoé']);
      // Sa propre pastille et la place réservée restent du texte.
      const chips = Array.from(document.body.querySelectorAll('app-participant-chip'));
      expect(chips).toHaveLength(4);
      expect(chips[1].querySelector('button')).toBeNull();
      expect(chips[3].querySelector('button')).toBeNull();
      expect(q('app-library-sheet')).toBeNull();
    });

    it('le toucher ouvre la feuille de cette personne ; Échap la ferme SANS fermer la fenêtre, focus rendu au nom', async () => {
      const bg = boardGames();
      const { fixture, settle, q } = await mount(withParticipants(), ME, { boardGames: bg });
      const trigger = document.body.querySelector<HTMLButtonElement>(
        'app-participant-chip button.pc--button',
      ) as HTMLButtonElement;

      trigger.click();
      await settle();

      expect(bg.listOf).toHaveBeenCalledWith(HOST);
      expect(q('app-library-sheet .library-sheet')?.textContent).toContain('Azul');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(q('app-library-sheet')).toBeNull();
      // La fenêtre d'hôte est toujours là et n'a rien reçu.
      expect(q('app-detail-surface')).not.toBeNull();
      expect(fixture.componentInstance.refreshRequests).toBe(0);
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('membre éligible qui n’a pas voté : cadre « à faire », « Vote à faire », « Vos réponses : 0 créneau sur 3 », « Voter dans le calendrier » mais ni « Fixer » ni « Prolonger »', async () => {
    const { fixture, q, text } = await mount(pollCard());

    expect(q('.ed__poll')?.classList).toContain('ed__poll--todo');
    expect(text('.ed__poll-text')).toBe(
      'Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le mar. 20 oct.',
    );
    expect(text('.ed__poll-answers')).toBe('Vos réponses : 0 créneau sur 3');
    expect(q('.ed__poll-best')).toBeNull();
    expect(q('.ed__poll-waiting')).toBeNull();
    // Le badge dit « Vote en cours » ; la ligne de date « Date à voter · jusqu’au … ».
    expect(text('.ed__badge')).toBe('Vote en cours');
    expect(text('.ed__big--date')).toBe('Date à voter · jusqu’au mar. 20 oct.');
    // Ni « Fixer la date » ni « Prolonger » (Stories 40.6 et 40.7) ; « Voter dans le calendrier » (Story
    // 40.5b) est écrit, focalisable, et demande à l'onglet d'ouvrir le calendrier du groupe.
    const buttons = Array.from(document.body.querySelectorAll('.detail-surface-panel button')).map(
      (b) => b.textContent?.trim() ?? '',
    );
    expect(buttons.join('|')).not.toMatch(/Fixer|Prolonger/);
    expect(buttons).toContain(TONE['partie.ralliement_event_vote_in_calendar_btn']);
    expect(buttons).not.toContain(TONE['partie.ralliement_event_compose_in_calendar_btn']);
    q<HTMLButtonElement>('.ed__poll-vote')!.click();
    expect(fixture.componentInstance.calendarRequests).toBe(1);
  });

  it('Story 40.5b : un membre qui a déjà répondu garde « Voter dans le calendrier » (modifier ses réponses) et il ouvre le calendrier', async () => {
    const { fixture, q, text } = await mount(
      pollCard({ votes: [{ optionId: 'o1', userId: ME, answer: 'YES' }] }),
    );
    expect(q('.ed__poll')?.classList).not.toContain('ed__poll--todo');
    expect(text('.ed__poll-vote')).toBe(TONE['partie.ralliement_event_vote_in_calendar_btn']);
    q<HTMLButtonElement>('.ed__poll-vote')!.click();
    expect(fixture.componentInstance.calendarRequests).toBe(1);
  });

  it('Story 40.5b : l’hôte d’un sondage ouvert voit « Composer les créneaux » (pas « Voter dans le calendrier »), qui ouvre le calendrier', async () => {
    const { fixture, q, text } = await mount(pollCard(), HOST);
    expect(text('.ed__poll-compose')).toBe(TONE['partie.ralliement_event_compose_in_calendar_btn']);
    expect(q('.ed__poll-vote')).toBeNull();
    q<HTMLButtonElement>('.ed__poll-compose')!.click();
    expect(fixture.componentInstance.calendarRequests).toBe(1);
  });

  it('Story 40.5b : un membre non éligible, ou un vote terminé, n’a aucun lien vers le calendrier', async () => {
    const notEligible = await mount(pollCard({ eligibleVoterIds: [HOST, OTHER] }));
    expect(notEligible.q('.ed__poll-calendar')).toBeNull();
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

    // Échéance dépassée (16 octobre, aujourd'hui le 17) : « Le vote est terminé. », plus de bouton de vote.
    const ended = await mount(pollCard({ expiresAt: '2026-10-16T23:59:59.999Z' }));
    expect(ended.text('.ed__poll-text')).toBe('Le vote est terminé.');
    expect(ended.q('.ed__poll-calendar')).toBeNull();
  });

  it('membre qui a répondu : plus de cadre « à faire », ses réponses et le meilleur créneau sont écrits ; suit les réponses en direct', async () => {
    const card = pollCard({
      votes: [
        { optionId: 'o1', userId: ME, answer: 'YES' },
        { optionId: 'o2', userId: ME, answer: 'NO' },
        { optionId: 'o1', userId: HOST, answer: 'YES' },
      ],
    });
    const { fixture, settle, q, text } = await mount(card);

    expect(q('.ed__poll')?.classList).not.toContain('ed__poll--todo');
    expect(text('.ed__poll-text')).toBe(
      'Vos réponses sont enregistrées. Le vote se termine le mar. 20 oct.',
    );
    expect(text('.ed__poll-answers')).toBe('Vos réponses : 2 créneaux sur 3');
    expect(text('.ed__poll-best')).toBe(
      'Meilleur créneau pour l’instant : sam. 24 oct. · soir — 2 oui',
    );
    expect(text('.ed__badge')).toBe('Vote en cours');

    // Une réponse arrive en direct (liste vivante) : le meilleur créneau change sans rechargement.
    fixture.componentInstance.card.set(
      pollCard({
        votes: [
          { optionId: 'o1', userId: ME, answer: 'YES' },
          { optionId: 'o1', userId: HOST, answer: 'YES' },
          { optionId: 'o2', userId: ME, answer: 'YES' },
          { optionId: 'o2', userId: HOST, answer: 'YES' },
          { optionId: 'o2', userId: OTHER, answer: 'YES' },
        ],
      }),
    );
    await settle();
    expect(text('.ed__poll-best')).toBe(
      'Meilleur créneau pour l’instant : dim. 25 oct. · matin — 3 oui',
    );
  });

  it('hôte : cadre accent, « Vous êtes l’hôte… dans 3 jours — 3 créneaux proposés », réponses x sur N, meilleur créneau et qui n’a pas répondu', async () => {
    const card = pollCard({
      votes: [
        { optionId: 'o1', userId: HOST, answer: 'YES' },
        { optionId: 'o1', userId: ME, answer: 'YES' },
      ],
    });
    const { q, text } = await mount(card, HOST);

    expect(q('.ed__poll')?.classList).toContain('ed__poll--host');
    expect(text('.ed__poll-text')).toBe(
      'Vous êtes l’hôte. Le vote se termine dans 3 jours — 3 créneaux proposés.',
    );
    expect(text('.ed__poll-answers')).toBe('Réponses : 2 sur 3');
    expect(text('.ed__poll-best')).toContain('2 oui');
    // Les noms viennent des membres du groupe (« Tous les membres » : Zoé n’est pas dans les participants).
    expect(text('.ed__poll-waiting')).toBe('N’ont pas encore répondu : Zoé');
  });

  it('hôte : le panneau se met à jour quand le dernier répond (plus de ligne « n’ont pas encore répondu »)', async () => {
    const { fixture, settle, q } = await mount(pollCard(), HOST);
    expect(q('.ed__poll-waiting')?.textContent).toContain('Léa, Moi, Zoé');

    fixture.componentInstance.card.set(
      pollCard({
        votes: [
          { optionId: 'o1', userId: HOST, answer: 'YES' },
          { optionId: 'o1', userId: ME, answer: 'MAYBE' },
          { optionId: 'o1', userId: OTHER, answer: 'NO' },
        ],
      }),
    );
    await settle();
    expect(q('.ed__poll-waiting')).toBeNull();
    expect(q('.ed__poll-answers')?.textContent?.trim()).toBe('Réponses : 3 sur 3');
  });

  it('membre non éligible (places limitées, pas inscrit) : l’information est écrite, badge cyan', async () => {
    const card = pollCard({ eligibleVoterIds: [HOST] });
    const { q, text } = await mount(card);

    expect(text('.ed__poll-text')).toBe(TONE['partie.ralliement_event_poll_not_eligible']);
    expect(q('.ed__poll')?.classList).not.toContain('ed__poll--todo');
    expect(q('.ed__poll-answers')).toBeNull();
    expect(q('.ed__badge .status-badge--live')).not.toBeNull();
  });

  it('badge « Vote en cours » : orange pour qui doit voter, cyan sinon', async () => {
    const todo = await mount(pollCard());
    expect(todo.q('.ed__badge .status-badge--todo')).not.toBeNull();
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

    const done = await mount(pollCard({ votes: [{ optionId: 'o1', userId: ME, answer: 'YES' }] }));
    expect(done.q('.ed__badge .status-badge--live')).not.toBeNull();
    expect(done.q('.ed__badge .status-badge--todo')).toBeNull();
  });

  it('vote terminé (échéance dépassée) : « Le vote est terminé. » à la place de « Vote à faire »', async () => {
    const { text, q } = await mount(pollCard({ expiresAt: '2026-10-16T23:59:59.999Z' }));
    expect(text('.ed__poll-text')).toBe(TONE['partie.ralliement_event_poll_ended']);
    expect(q('.ed__poll')?.classList).not.toContain('ed__poll--todo');
    // Plus de « Vote en cours » : le badge retombe sur « À venir ».
    expect(text('.ed__badge')).not.toBe('Vote en cours');
  });

  it('la fiche liste chaque créneau candidat avec le nombre d’inscrits libres', async () => {
    const { q } = await mount(pollCard());
    const rows = Array.from(document.body.querySelectorAll('.ed__slot')).map((r) => [
      r.querySelector('.ed__slot-label')?.textContent?.trim(),
      r.querySelector('.ed__slot-available')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['sam. 24 oct. · soir', '2 inscrits disponibles'],
      ['dim. 25 oct. · matin', '1 inscrit disponible'],
      ['sam. 31 oct. · soir', '0 inscrit disponible'],
    ]);
    expect(q('.ed__slots h3')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_poll_slots_heading'],
    );
  });

  it('une conjonction à date fixée n’a ni panneau de sondage ni liste de créneaux', async () => {
    const dated: EventCardDto = {
      ...pollCard(),
      poll: null,
      seance: { ...pollCard().seance!, date: '2026-10-24', slot: 'EVENING' },
    };
    const { q } = await mount(dated);
    expect(q('.ed__poll')).toBeNull();
    expect(q('.ed__slots')).toBeNull();
    expect(TODAY).toBe('2026-10-17');
  });

  it('l’hôte lit les membres du groupe une seule fois (noms des absents) ; un simple membre n’en lit aucun', async () => {
    const host = await mount(pollCard(), HOST);
    expect(host.parties.members).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

    const guest = await mount(pollCard(), ME);
    expect(guest.parties.members).not.toHaveBeenCalled();
  });

  describe('⚠️ Story 49.1 — onglets « Conjonction » et jeux sur place', () => {
    const games = [
      {
        id: 'g1',
        name: 'Azul',
        nameKey: 'azul',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 40,
        createdAt: '2026-10-29T10:00:00.000Z',
      },
      {
        id: 'g2',
        name: 'Skull',
        nameKey: 'skull',
        minPlayers: null,
        maxPlayers: null,
        durationMin: null,
        createdAt: '2026-10-29T10:00:00.000Z',
      },
    ];
    const withGames = () => ({
      boardGames: vi
        .fn()
        .mockResolvedValue({ games, brings: [], participantsCount: 3, envies: [] }),
    });
    const tabs = () => Array.from(document.body.querySelectorAll<HTMLElement>('.ed__tab'));
    const panel = (name: 'main' | 'games') =>
      document.body.querySelector<HTMLElement>(`[role="tabpanel"][id$="-panel-${name}"]`)!;

    it('conjonction ouverte : un bandeau à deux onglets, « Conjonction » par défaut, puis « Reliques · 2 »', async () => {
      const api = withGames();
      const { q } = await mount(pollCard(), ME, { api });

      expect(q('[role="tablist"]')).not.toBeNull();
      expect(tabs().map((t) => t.textContent!.trim())).toEqual([
        TONE['partie.ralliement_soiree_tab'],
        `${TONE['event_games.tab']} · 2`,
      ]);
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs()[1].getAttribute('aria-selected')).toBe('false');
      expect(api.boardGames).toHaveBeenCalledWith('e1');
      // Tous les blocs existants vivent sous « Conjonction » ; les jeux sont montés mais masqués.
      expect(panel('main').hidden).toBe(false);
      expect(panel('main').querySelector('.ed__situation')).not.toBeNull();
      expect(panel('main').querySelector('.ed__participants')).not.toBeNull();
      expect(panel('games').hidden).toBe(true);
      expect(panel('games').querySelector('app-event-games-tab')).not.toBeNull();
    });

    it('le bandeau relie chaque onglet à son panneau (rôles tablist/tab/tabpanel)', async () => {
      await mount(pollCard(), ME, { api: withGames() });

      for (const [i, name] of (['main', 'games'] as const).entries()) {
        expect(tabs()[i].getAttribute('role')).toBe('tab');
        expect(tabs()[i].getAttribute('aria-controls')).toBe(panel(name).id);
        expect(panel(name).getAttribute('aria-labelledby')).toBe(tabs()[i].id);
      }
    });

    it('toucher l’onglet des jeux l’affiche : les jeux de l’hôte, « Chez Léa », la pastille de N', async () => {
      const { settle } = await mount(pollCard(), ME, { api: withGames() });

      tabs()[1].click();
      await settle();

      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      expect(panel('games').hidden).toBe(false);
      expect(panel('main').hidden).toBe(true);
      const text = panel('games').textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('2 jeux sur place · 1 jouable à 3');
      expect(text).toContain('Chez Léa');
      expect(text).toContain('jouable à 3');
    });

    it('au clavier : flèche droite / gauche, Fin / Début changent d’onglet et déplacent le focus', async () => {
      const { settle } = await mount(pollCard(), ME, { api: withGames() });
      tabs()[0].focus();

      tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settle();
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabs()[1]);
      expect(tabs()[1].tabIndex).toBe(0);
      expect(tabs()[0].tabIndex).toBe(-1);

      tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await settle();
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

      tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await settle();
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

      tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await settle();
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('l’hôte sans jeu : la ligne du thème et le lien vers « mon cabinet »', async () => {
      const { settle } = await mount(pollCard(), HOST, {
        api: {
          boardGames: vi
            .fn()
            .mockResolvedValue({ games: [], brings: [], participantsCount: 1, envies: [] }),
        },
      });
      tabs()[1].click();
      await settle();

      const text = panel('games').textContent!.replace(/\s+/g, ' ');
      expect(text).toContain(TONE['event_games.empty']);
      expect(panel('games').querySelector('.egt__link')?.textContent?.trim()).toBe(
        TONE['event_games.fill_link'],
      );
    });

    it('conjonction passée : ni bandeau ni onglet des jeux — la fenêtre est celle d’avant, sans aucune lecture des jeux', async () => {
      const api = withGames();
      const past = {
        ...pollCard(),
        poll: null,
        seance: { ...pollCard().seance!, date: '2026-10-10', slot: 'EVENING' as const },
      };
      const { q } = await mount(past, ME, { api });

      expect(q('[role="tablist"]')).toBeNull();
      expect(q('app-event-games-tab')).toBeNull();
      expect(q('[role="tabpanel"]')).toBeNull();
      expect(q('.ed__situation')).not.toBeNull();
      expect(api.boardGames).not.toHaveBeenCalled();
    });

    it('conjonction annulée : ni bandeau ni onglet des jeux', async () => {
      const api = withGames();
      const { q } = await mount({ ...pollCard(), cancelled: true, poll: null }, ME, { api });

      expect(q('[role="tablist"]')).toBeNull();
      expect(q('app-event-games-tab')).toBeNull();
      expect(api.boardGames).not.toHaveBeenCalled();
    });

    it('rendu en ligne (rencontre isolée) : ni bandeau ni onglet des jeux, même ouverte, datée et non figée — l’onglet est celui de la page', async () => {
      const api = { boardGames: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [InlineHost],
        providers: [
          provideNoopAnimations(),
          provideRouter([]),
          { provide: EventsApiService, useValue: api },
          {
            provide: PartiesService,
            useValue: { members: vi.fn().mockResolvedValue([]), changed: signal(0) },
          },
          {
            provide: ThemeToneService,
            useValue: { tone: signal(TONE), activeTheme: signal('grimoire-emeraude') },
          },
        ],
      }).compileComponents();
      const inline = TestBed.createComponent(InlineHost);
      inline.componentInstance.card.set({
        ...pollCard(),
        poll: null,
        seance: { ...pollCard().seance!, date: '2026-10-25', slot: 'EVENING' },
      });
      inline.detectChanges();
      await inline.whenStable();
      inline.detectChanges();

      const root = inline.nativeElement as HTMLElement;
      expect(root.querySelector('article.ed--inline')).not.toBeNull();
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(root.querySelector('app-event-games-tab')).toBeNull();
      expect(api.boardGames).not.toHaveBeenCalled();
    });

    it('fenêtre figée : ni bandeau ni onglet des jeux', async () => {
      await TestBed.configureTestingModule({
        imports: [FrozenWindowHost],
        providers: [
          provideNoopAnimations(),
          provideRouter([]),
          { provide: EventsApiService, useValue: { boardGames: vi.fn() } },
          { provide: PartiesService, useValue: { members: vi.fn().mockResolvedValue([]) } },
          {
            provide: ThemeToneService,
            useValue: { tone: signal(TONE), activeTheme: signal('grimoire-emeraude') },
          },
        ],
      }).compileComponents();
      const frozen = TestBed.createComponent(FrozenWindowHost);
      frozen.detectChanges();
      await frozen.whenStable();
      frozen.detectChanges();

      expect(document.body.querySelector('[role="tablist"]')).toBeNull();
      expect(document.body.querySelector('app-event-games-tab')).toBeNull();
    });

    it('une conjonction qui passe en modification n’affiche que son formulaire, sans bandeau d’onglets', async () => {
      const { q, settle } = await mount(pollCard(), HOST, { api: withGames() });
      expect(q('[role="tablist"]')).not.toBeNull();

      q<HTMLButtonElement>('.ed__edit')!.click();
      await settle();

      expect(q('[role="tablist"]')).toBeNull();
      expect(q('app-event-form')).not.toBeNull();
    });
  });

  // Story 40.6 — « Fixer la date… » : bouton du panneau de l'hôte, confirmation « Votre accord ».
  describe('fixer la date (Story 40.6)', () => {
    const openDialog = (fixed: boolean) =>
      vi.fn().mockReturnValue({ afterClosed: () => of(fixed) });

    it('l’hôte voit « Fixer la date… » actif ; un membre n’en voit pas', async () => {
      const host = await mount(pollCard(), HOST);
      const button = host.q<HTMLButtonElement>('.ed__poll-fix');
      expect(button?.textContent?.trim()).toBe('Fixer la date…');
      expect(button?.disabled).toBe(false);
      TestBed.resetTestingModule();
      document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

      const member = await mount(pollCard(), ME);
      expect(member.q('.ed__poll-fix')).toBeNull();
    });

    it('le vote terminé (échéance dépassée) ne bloque pas l’hôte : le bouton reste actif', async () => {
      const { q } = await mount(pollCard({ expiresAt: '2026-10-16T23:59:59.999Z' }), HOST);
      expect(q<HTMLButtonElement>('.ed__poll-fix')?.disabled).toBe(false);
    });

    it('ouvre la confirmation avec les créneaux du plus au moins plébiscité ; au succès, demande la relecture de la liste', async () => {
      const open = openDialog(true);
      const choose = vi.fn().mockResolvedValue(undefined);
      const { fixture, q } = await mount(
        pollCard({
          votes: [
            { optionId: 'o2', userId: HOST, answer: 'YES' },
            { optionId: 'o2', userId: ME, answer: 'YES' },
            { optionId: 'o1', userId: ME, answer: 'MAYBE' },
          ],
        }),
        HOST,
        { api: { choose }, dialog: { open } },
      );

      q<HTMLButtonElement>('.ed__poll-fix')!.click();

      expect(open).toHaveBeenCalledTimes(1);
      const data = open.mock.calls[0][1].data;
      expect(data.title).toBe('Sondage plateaux');
      expect(data.slots.map((s: { id: string }) => s.id)).toEqual(['o2', 'o1', 'o3']);
      // La confirmation écrit la date sur la route partagée, avec le sondage de la carte.
      await data.confirm('o2');
      expect(choose).toHaveBeenCalledWith('g1', 'p1', 'o2');
      expect(fixture.componentInstance.refreshRequests).toBe(1);
    });

    it('« Renoncer » (fermeture sans valider) ne demande aucune relecture', async () => {
      const open = openDialog(false);
      const { fixture, q } = await mount(pollCard(), HOST, { dialog: { open } });
      q<HTMLButtonElement>('.ed__poll-fix')!.click();
      expect(open).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.refreshRequests).toBe(0);
    });

    it('la carte vivante datée remplace le panneau : plus de sondage ni de « Fixer la date… », la date en grand', async () => {
      const { fixture, settle, q, text } = await mount(pollCard(), HOST);
      expect(q('.ed__poll-fix')).not.toBeNull();

      fixture.componentInstance.card.set({
        ...pollCard(),
        poll: null,
        seance: { ...pollCard().seance!, date: '2026-10-25', slot: 'MORNING', lieu: 'Chez Léa' },
      });
      await settle();

      expect(q('.ed__poll')).toBeNull();
      expect(q('.ed__poll-fix')).toBeNull();
      expect(text('.ed__big--date')).toBe('Dim. 25 oct. · matin');
      expect(text('.ed__big--place')).toBe('Chez Léa');
      expect(q('.ed__slots')).toBeNull();
    });
  });

  // Story 40.7 — « Prolonger le vote » : bouton du panneau de l'hôte, confirmation « Votre accord ».
  describe('prolonger le vote (Story 40.7)', () => {
    const openDialog = (extended: boolean) =>
      vi.fn().mockReturnValue({ afterClosed: () => of(extended) });

    it('l’hôte voit « Prolonger le vote » actif ; un membre n’en voit pas', async () => {
      const host = await mount(pollCard(), HOST);
      const button = host.q<HTMLButtonElement>('.ed__poll-extend');
      expect(button?.textContent?.trim()).toBe('Prolonger le vote');
      expect(button?.disabled).toBe(false);
      TestBed.resetTestingModule();
      document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

      const member = await mount(pollCard(), ME);
      expect(member.q('.ed__poll-extend')).toBeNull();
    });

    it('« Prolonger » suit le droit servi (`can.extend`), pas l’identité de l’hôte', async () => {
      const noExtend = {
        ...pollCard(),
        can: { propose: true, edit: true, choose: true, extend: false },
      };
      const { q } = await mount(noExtend, HOST);
      // Le panneau de l'hôte reste affiché, mais le bouton est inactif : le serveur ne donne pas le droit.
      expect(q<HTMLButtonElement>('.ed__poll-extend')?.disabled).toBe(true);
    });

    it('le vote terminé (échéance dépassée) ne bloque pas l’hôte : le bouton reste actif', async () => {
      const { q } = await mount(pollCard({ expiresAt: '2026-10-16T23:59:59.999Z' }), HOST);
      expect(q<HTMLButtonElement>('.ed__poll-extend')?.disabled).toBe(false);
    });

    it('ouvre la confirmation avec le nom, l’échéance actuelle et le jour minimal ; au succès, demande la relecture de la liste', async () => {
      const open = openDialog(true);
      const extend = vi.fn().mockResolvedValue(undefined);
      const { fixture, q } = await mount(pollCard(), HOST, { api: { extend }, dialog: { open } });

      q<HTMLButtonElement>('.ed__poll-extend')!.click();

      expect(open).toHaveBeenCalledTimes(1);
      const data = open.mock.calls[0][1].data;
      expect(data.title).toBe('Sondage plateaux');
      expect(data.deadlineKey).toBe('2026-10-20');
      // Le lendemain de l'échéance actuelle (jamais avant aujourd'hui).
      expect(data.minKey).toBe('2026-10-21');
      // La confirmation écrit la nouvelle échéance avec le sondage de la carte.
      await data.confirm('2026-11-02');
      expect(extend).toHaveBeenCalledWith('g1', 'p1', '2026-11-02');
      expect(fixture.componentInstance.refreshRequests).toBe(1);
    });

    it('« Renoncer » (fermeture sans valider) ne demande aucune relecture', async () => {
      const open = openDialog(false);
      const { fixture, q } = await mount(pollCard(), HOST, { dialog: { open } });
      q<HTMLButtonElement>('.ed__poll-extend')!.click();
      expect(open).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.refreshRequests).toBe(0);
    });

    it('la carte vivante prolongée met l’échéance à jour dans le panneau ; datée, le bouton disparaît avec le panneau', async () => {
      const { fixture, settle, q } = await mount(pollCard(), HOST);
      expect(q('.ed__poll-extend')).not.toBeNull();

      fixture.componentInstance.card.set({
        ...pollCard(),
        poll: null,
        seance: { ...pollCard().seance!, date: '2026-10-25', slot: 'MORNING' },
      });
      await settle();

      expect(q('.ed__poll-extend')).toBeNull();
    });
  });
});

@Component({
  imports: [EventDialog],
  template: `<app-event-dialog
    partieId="g1"
    [frozen]="true"
    [card]="card"
    todayKey="2026-10-17"
    [currentUserId]="'host'"
  />`,
})
class FrozenWindowHost {
  card: EventCardDto = pollCard();
}

@Component({
  imports: [EventDialog],
  template: `<app-event-dialog
    partieId="g1"
    [inline]="true"
    [frozen]="true"
    [card]="card"
    todayKey="2026-10-17"
    [currentUserId]="'host'"
  />`,
})
class FrozenHost {
  card: EventCardDto = {
    id: 'e1',
    title: 'Marathon Pandémie',
    hostId: 'host',
    hostDisplayName: 'Léa',
    seance: {
      endDate: null,
      endSlot: null,
      durationSlots: 1,
      id: 's1',
      date: null,
      slot: null,
      lieu: null,
      heureRdv: null,
      notePratique: null,
      capacity: null,
      placesTaken: 1,
    },
    participants: [],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
  };
}

@Component({
  imports: [EventDialog],
  template: `<app-event-dialog
    partieId="g1"
    [inline]="true"
    [card]="card()"
    todayKey="2026-10-17"
    [currentUserId]="userId()"
  />`,
})
class InlineHost {
  card = signal<EventCardDto>(pollCard());
  userId = signal<string | null>(HOST);
}

describe('EventDialog — rendu en ligne d’une soirée isolée (Story 41.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Soirée non datée (état à la création), ou datée demain soir, avec ses deux participants. */
  function soireeCard(over: Partial<EventCardDto> = {}): EventCardDto {
    return {
      id: 'e1',
      title: 'Marathon Pandémie',
      hostId: HOST,
      hostDisplayName: 'Léa',
      seance: {
        endDate: null,
        endSlot: null,
        durationSlots: 1,
        id: 's1',
        date: null,
        slot: null,
        lieu: null,
        heureRdv: null,
        notePratique: null,
        capacity: null,
        placesTaken: 1,
      },
      participants: [
        { userId: HOST, displayName: 'Léa', isHost: true, isAdmin: true, status: 'CONFIRMED' },
        { userId: ME, displayName: 'Moi', isHost: false, isAdmin: false, status: 'CONFIRMED' },
      ],
      myInscription: null,
      cancelled: false,
      can: { propose: false, edit: false, choose: false, extend: false },
      poll: null,
      ...over,
    };
  }

  async function mount(card: EventCardDto, userId: string | null) {
    await TestBed.configureTestingModule({
      imports: [InlineHost],
      providers: [
        provideNoopAnimations(),
        { provide: EventsApiService, useValue: {} },
        { provide: PartiesService, useValue: { members: vi.fn().mockResolvedValue([]) } },
        {
          provide: ThemeToneService,
          useValue: { tone: signal(TONE), activeTheme: signal('grimoire-emeraude') },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(InlineHost);
    fixture.componentInstance.card.set(card);
    fixture.componentInstance.userId.set(userId);
    fixture.detectChanges();
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, q: <T extends Element>(sel: string) => el.querySelector<T>(sel) };
  }

  it('rend titre, badge, situation et fiche dans la page, sans surface de fenêtre', async () => {
    const { el, q } = await mount(soireeCard(), HOST);
    expect(q('article.ed--inline')).not.toBeNull();
    expect(el.querySelector('app-detail-surface')).toBeNull();
    expect(document.body.querySelector('app-detail-surface')).toBeNull();
    expect(q('.ed__title')?.textContent?.trim()).toBe('Marathon Pandémie');
    expect(q('.ed__badge')).not.toBeNull();
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_situation_host'],
    );
    expect(q('.ed__big--date')?.textContent?.trim()).toBe(TONE['partie.ralliement_event_no_date']);
    expect(q('.ed__row--host')?.textContent).toContain('Léa');
  });

  it('la participation dit « Sur invitation · pas de limite », même avec une capacité sur la carte', async () => {
    const card = soireeCard();
    card.seance!.capacity = 4;
    const { q } = await mount(card, ME);
    expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_soiree_participation'],
    );
  });

  it('un invité sans ligne d’inscription « participe » : la soirée est sur invitation', async () => {
    const { q } = await mount(soireeCard({ participants: [] }), ME);
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_situation_registered'],
    );
  });

  it('ni participants, ni inscription, ni réservation, ni « Refermer » — même pour l’hôte ; un invité n’a aucun pied', async () => {
    for (const userId of [HOST, ME]) {
      const { q } = await mount(soireeCard(), userId);
      for (const sel of [
        '.ed__participants',
        'app-participant-chip',
        '.ed__signup',
        '.ed__full',
        '.ed__respond',
        '.ed__unsubscribe',
        '.ed__reserve',
        '.ed__close',
      ]) {
        expect(q(sel), `${userId} ${sel}`).toBeNull();
      }
      // Story 41.2 : seul l'hôte a un pied (« Modifier »), les autres aucun.
      expect(q('.ed__edit') !== null, userId).toBe(userId === HOST);
      expect(q('.ed__footer') !== null, userId).toBe(userId === HOST);
      TestBed.resetTestingModule();
    }
  });

  it('soirée terminée (Story 41.4) : plus de « Modifier », même pour l’hôte d’une soirée à venir close', async () => {
    const { q, fixture } = await mount(soireeCard(), HOST);
    expect(q('.ed__edit')).not.toBeNull();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [FrozenHost],
      providers: [
        provideNoopAnimations(),
        { provide: EventsApiService, useValue: {} },
        { provide: PartiesService, useValue: { members: vi.fn().mockResolvedValue([]) } },
        {
          provide: ThemeToneService,
          useValue: { tone: signal(TONE), activeTheme: signal('grimoire-emeraude') },
        },
      ],
    }).compileComponents();
    const frozen = TestBed.createComponent(FrozenHost);
    frozen.detectChanges();
    await frozen.whenStable();
    frozen.detectChanges();
    expect((frozen.nativeElement as HTMLElement).querySelector('.ed__edit')).toBeNull();
    expect((frozen.nativeElement as HTMLElement).querySelector('.ed__footer')).toBeNull();
    expect(fixture).toBeTruthy();
  });

  it('« Modifier » sur une soirée qui attend sa date demande la fenêtre de création (Story 41.2) ; datée, il édite en ligne', async () => {
    const { fixture, q } = await mount(soireeCard(), HOST);
    const dialog = fixture.debugElement.children[0].componentInstance as {
      completeRequested: { subscribe: (fn: () => void) => void };
    };
    let requests = 0;
    dialog.completeRequested.subscribe(() => requests++);
    q<HTMLButtonElement>('.ed__edit')!.click();
    expect(requests).toBe(1);
    expect(q('app-event-form')).toBeNull();

    TestBed.resetTestingModule();
    const dated = soireeCard();
    dated.seance!.date = '2099-12-20';
    dated.seance!.slot = 'EVENING';
    const second = await mount(dated, HOST);
    second.q<HTMLButtonElement>('.ed__edit')!.click();
    second.fixture.detectChanges();
    expect(second.q('app-event-form')).not.toBeNull();
    // Soirée : participation en lecture seule dans le formulaire d'édition.
    expect(second.q('.ec__participation-readonly')).not.toBeNull();
    expect(second.q('.ec__participation')).toBeNull();
  });

  it('une soirée passée est « Passé », avec la situation au passé', async () => {
    const card = soireeCard();
    card.seance!.date = '2026-10-10';
    card.seance!.slot = 'EVENING';
    const { q } = await mount(card, ME);
    expect(q('.ed__badge')?.textContent?.trim()).toBe('Passé');
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_situation_registered_past'],
    );
  });
});
