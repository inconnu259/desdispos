import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type {
  BoardGameDto,
  EventBoardGamesDto,
  EventBringDto,
  EventCardDto,
  EventEnvyDto,
} from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { EventsApiService } from '../events-api.service';
import { EventGamesTab } from './event-games-tab';
import { GamesSectionStateService } from './games-section-state.service';

const LS_KEY = 'master-jdr.event-games.collapsed-sections';
const HOST = 'host';
const ME = 'me';

function game(
  name: string,
  min: number | null,
  max: number | null,
  durationMin: number | null = null,
) {
  const dto: BoardGameDto = {
    id: `id-${name}`,
    name,
    nameKey: name.toLowerCase(),
    minPlayers: min,
    maxPlayers: max,
    durationMin,
    createdAt: '2026-10-29T10:00:00.000Z',
  };
  return dto;
}

function card(over: Partial<EventCardDto> = {}): EventCardDto {
  return {
    id: 'e1',
    title: 'Soirée plateaux',
    hostId: HOST,
    hostDisplayName: 'Léa',
    seance: null,
    participants: [],
    myInscription: null,
    poll: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    ...over,
  };
}

const served = (
  games: BoardGameDto[],
  participantsCount: number,
  brings: EventBringDto[] = [],
  envies: EventEnvyDto[] = [],
): EventBoardGamesDto => ({
  games,
  brings,
  participantsCount,
  envies,
});

@Component({
  imports: [EventGamesTab],
  template: `<app-event-games-tab
    partieId="p1"
    [card]="card()"
    [currentUserId]="userId()"
    [contributor]="contributor()"
    (countChange)="counts.push($event)"
  />`,
})
class Host {
  card = signal<EventCardDto | null>(card());
  userId = signal<string | null>(ME);
  contributor = signal<boolean | null>(null);
  counts: number[] = [];
}

describe('EventGamesTab (Stories 49.1, 49.2, 49.4 et 49.5)', () => {
  let changed: ReturnType<typeof signal<number>>;
  let api: {
    boardGames: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    bring: ReturnType<typeof vi.fn>;
    unbring: ReturnType<typeof vi.fn>;
    exclude: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    envy: ReturnType<typeof vi.fn>;
    unenvy: ReturnType<typeof vi.fn>;
  };
  let library: ReturnType<typeof vi.fn>;
  let activeTheme: ReturnType<typeof signal<Theme>>;
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const tone = () => TONE_MAP[activeTheme()];
  const text = (): string => (el().textContent ?? '').replace(/\s+/g, ' ').trim();
  const rowNames = (): string[] =>
    Array.from(el().querySelectorAll('app-game-row .gr__name')).map((n) => n.textContent!.trim());
  const pills = (): string[] =>
    Array.from(el().querySelectorAll('app-game-row .gr__fit')).map((n) => n.textContent!.trim());
  const chip = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('.gsum__chip')!;
  const header = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('.gs__header')!;
  const live = (): string => el().querySelector('[role="status"]')?.textContent?.trim() ?? '';

  async function settle(): Promise<void> {
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(
    result: EventBoardGamesDto | Error = served([], 1),
    theme: Theme = 'grimoire-emeraude',
    mine: BoardGameDto[] = [],
  ): Promise<void> {
    activeTheme = signal(theme);
    changed = signal(0);
    library = vi.fn().mockResolvedValue(mine);
    api = {
      boardGames:
        result instanceof Error
          ? vi.fn().mockRejectedValue(result)
          : vi.fn().mockResolvedValue(result),
      list: vi.fn().mockResolvedValue([card()]),
      bring: vi.fn().mockResolvedValue(undefined),
      unbring: vi.fn().mockResolvedValue(undefined),
      exclude: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      envy: vi.fn().mockResolvedValue(undefined),
      unenvy: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: { changed } },
        { provide: BoardGamesService, useValue: { list: library } },
        {
          provide: ThemeToneService,
          useValue: { tone: () => TONE_MAP[activeTheme()], activeTheme },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  }

  beforeEach(() => localStorage.removeItem(LS_KEY));
  afterEach(() => {
    localStorage.removeItem(LS_KEY);
    TestBed.resetTestingModule();
    // Story 49.4 : le menu ⋮ vit dans le conteneur d'overlays du CDK, hors de l'arbre de la fixture.
    document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  describe('contenu', () => {
    it('lit les jeux de la conjonction fournie ; résumé, section « Chez {hôte} », lignes dans l’ordre servi', async () => {
      await setup(
        served([game('Azul', 2, 4, 40), game('Codenames', 5, 8), game('Skull', null, null)], 4),
      );
      await settle();

      expect(api.boardGames).toHaveBeenCalledWith('e1');
      expect(api.list).not.toHaveBeenCalled();
      expect(text()).toContain('3 jeux sur place · 1 jouable à 4');
      expect(text()).toContain('Chez Léa');
      expect(rowNames()).toEqual(['Azul', 'Codenames', 'Skull']);
      expect(host.counts).toEqual([3]);
    });

    it('mesures du jeu (neutres) et pastille « jouable à N » seulement entre les bornes, bornes comprises', async () => {
      await setup(
        served([game('Azul', 2, 4, 40), game('Codenames', 5, 8), game('Skull', null, null)], 4),
      );
      await settle();

      expect(text()).toContain('2–4 joueurs · 40 min');
      expect(text()).toContain('5–8 joueurs');
      expect(pills()).toEqual(['jouable à 4']);
      // Un jeu sans nombre de joueurs n'a jamais de pastille.
      const skull = Array.from(el().querySelectorAll('app-game-row')).find((r) =>
        r.textContent!.includes('Skull'),
      )!;
      expect(skull.querySelector('.gr__fit')).toBeNull();
    });

    it('l’hôte lit « Chez moi », un autre membre « Chez {hôte} »', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      host.userId.set(HOST);
      await settle();
      expect(text()).toContain('Chez moi');
      expect(text()).not.toContain('Chez Léa');
    });

    it('un seul jeu : formes au singulier', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      await settle();
      expect(text()).toContain('1 jeu sur place · 1 jouable à 2');
    });

    it('le compte de la section dit « · 3 » puis, sous le filtre, « · 1 sur 3 » ; le nom accessible l’inclut', async () => {
      await setup(
        served([game('Azul', 2, 4), game('Codenames', 5, 8), game('Skull', null, null)], 4),
      );
      await settle();
      expect(header().textContent).toContain('· 3');
      expect(header().getAttribute('aria-label')).toBe('Chez Léa, 3 jeux');

      chip().click();
      await settle();
      expect(header().textContent).toContain('· 1 sur 3');
      expect(header().getAttribute('aria-label')).toBe('Chez Léa, 1 sur 3 jeux');
    });

    it('accords du résumé : « jouable » pour k = 1, « jouables » pour 0 ou plusieurs ; « jeu » pour n ≤ 1, aria « 1 sur 1 jeu »', async () => {
      await setup(served([game('Azul', 2, 4), game('Codenames', 5, 8)], 3));
      await settle();
      expect(text()).toContain('2 jeux sur place · 1 jouable à 3');

      TestBed.resetTestingModule();
      await setup(served([game('Codenames', 5, 8), game('Skull', null, null)], 3));
      await settle();
      expect(text()).toContain('2 jeux sur place · 0 jouables à 3');

      TestBed.resetTestingModule();
      await setup(served([game('Azul', 2, 4), game('Dixit', 3, 6)], 3));
      await settle();
      expect(text()).toContain('2 jeux sur place · 2 jouables à 3');

      TestBed.resetTestingModule();
      await setup(served([game('Azul', 2, 4)], 3));
      await settle();
      chip().click();
      await settle();
      expect(text()).toContain('1 jeu sur place · 1 jouable à 3');
      expect(header().getAttribute('aria-label')).toBe('Chez Léa, 1 sur 1 jeu');
    });
  });

  describe('filtre « Jouables à {N} »', () => {
    it('éteint au départ ; allumé, il ne garde que les jeux jouables (un jeu sans bornes en est exclu) ; re-touché, il s’éteint', async () => {
      await setup(
        served([game('Azul', 2, 4), game('Codenames', 5, 8), game('Skull', null, null)], 4),
      );
      await settle();
      expect(chip().textContent).toContain('Jouables à 4');
      expect(chip().querySelector('app-icon')).toBeNull();
      expect(chip().getAttribute('aria-pressed')).toBe('false');
      expect(rowNames()).toHaveLength(3);

      chip().click();
      await settle();
      expect(chip().getAttribute('aria-pressed')).toBe('true');
      expect(chip().querySelector('app-icon[data-icon="effacer"]')).not.toBeNull();
      expect(rowNames()).toEqual(['Azul']);

      chip().click();
      await settle();
      expect(chip().getAttribute('aria-pressed')).toBe('false');
      expect(rowNames()).toHaveLength(3);
    });

    it('sous le filtre, une section sans jeu jouable garde son en-tête', async () => {
      await setup(served([game('Codenames', 5, 8)], 2));
      await settle();
      chip().click();
      await settle();
      expect(rowNames()).toEqual([]);
      expect(header().textContent).toContain('· 0 sur 1');
    });
  });

  describe('section repliable', () => {
    it('dépliée au départ ; replier masque les lignes, garde le compte et retient l’état dans le navigateur', async () => {
      await setup(served([game('Azul', 2, 4), game('Skull', null, null)], 3));
      await settle();
      expect(header().getAttribute('aria-expanded')).toBe('true');

      header().click();
      await settle();

      expect(header().getAttribute('aria-expanded')).toBe('false');
      expect(header().textContent).toContain('· 2');
      expect(el().querySelector<HTMLElement>('.gs__body')!.hidden).toBe(true);
      expect(JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')).toEqual(['host']);
    });

    it('story 51.7 : le chevron est l’icône « déplier », tournée de −90° (classe) une fois la section repliée', async () => {
      await setup(served([game('Azul', 2, 4)], 3));
      await settle();
      const chevron = () => header().querySelector('app-icon')!;

      expect(chevron().getAttribute('data-icon')).toBe('deplier');
      expect(chevron().classList.contains('gs__chevron--closed')).toBe(false);
      expect(header().textContent).not.toMatch(/[▾▸]/);

      header().click();
      await settle();
      expect(chevron().getAttribute('data-icon')).toBe('deplier');
      expect(chevron().classList.contains('gs__chevron--closed')).toBe(true);
    });

    it('un état retenu est relu à l’ouverture suivante (rechargement de la page)', async () => {
      localStorage.setItem(LS_KEY, JSON.stringify(['host']));
      await setup(served([game('Azul', 2, 4)], 2));
      await settle();

      expect(header().getAttribute('aria-expanded')).toBe('false');
      expect(TestBed.inject(GamesSectionStateService).isCollapsed('host')).toBe(true);
    });
  });

  describe('aucun jeu sur place', () => {
    it.each(['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as Theme[])(
      'thème %s : la ligne du thème, sans section ni puce, et — pour l’hôte — le lien discret vers « mon cabinet »',
      async (theme) => {
        await setup(served([], 1), theme);
        host.userId.set(HOST);
        await settle();

        expect(text()).toContain(tone()['event_games.empty']);
        expect(text()).toContain('0 jeu sur place · 0 jouables à 1');
        expect(el().querySelector('.gs')).toBeNull();
        expect(el().querySelector('.gsum__chip')).toBeNull();
        const link = el().querySelector<HTMLAnchorElement>('.egt__link')!;
        expect(link.textContent!.trim()).toBe(tone()['event_games.fill_link']);
        expect(link.getAttribute('href')).toBe('/profile/board-games');
      },
    );

    it('un participant confirmé voit le lien ; un membre en lecture seule ou une place seulement réservée, jamais', async () => {
      await setup(served([], 2));
      host.card.set(card({ myInscription: 'CONFIRMED' }));
      await settle();
      expect(el().querySelector('.egt__link')).not.toBeNull();

      host.card.set(card({ id: 'e2', myInscription: null }));
      await settle();
      expect(text()).toContain(tone()['event_games.empty']);
      expect(el().querySelector('.egt__link')).toBeNull();

      host.card.set(card({ id: 'e3', myInscription: 'RESERVED' }));
      await settle();
      expect(el().querySelector('.egt__link')).toBeNull();
    });

    it('rencontre isolée (`contributor` vrai) : le lien est offert à toute personne de la soirée', async () => {
      await setup(served([], 3));
      host.contributor.set(true);
      await settle();
      expect(el().querySelector('.egt__link')).not.toBeNull();
    });
  });

  describe('sans carte fournie (rencontre isolée)', () => {
    it('lit l’unique événement de la partie, puis ses jeux, et remonte leur nombre', async () => {
      await setup(served([game('Azul', 2, 4), game('Skull', null, null)], 3));
      host.card.set(null);
      await settle();

      expect(api.list).toHaveBeenCalledWith('p1');
      expect(api.boardGames).toHaveBeenCalledWith('e1');
      expect(rowNames()).toEqual(['Azul', 'Skull']);
      expect(host.counts).toEqual([2]);
    });

    it('partie sans événement : rien n’est affiché, aucune lecture des jeux', async () => {
      await setup(served([], 1));
      host.card.set(null);
      api.list.mockResolvedValue([]);
      await settle();

      expect(api.boardGames).not.toHaveBeenCalled();
      expect(el().querySelector('.gsum')).toBeNull();
    });
  });

  describe('temps réel', () => {
    it('le premier passage n’est pas un rechargement ; un signal de la partie relit les jeux (jeu ajouté par l’hôte)', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      await settle();
      expect(api.boardGames).toHaveBeenCalledTimes(1);

      api.boardGames.mockResolvedValue(served([game('Azul', 2, 4), game('Dixit', 3, 6)], 2));
      changed.set(1);
      await settle();

      expect(api.boardGames).toHaveBeenCalledTimes(2);
      expect(rowNames()).toEqual(['Azul', 'Dixit']);
      expect(host.counts).toEqual([1, 2]);
    });

    it('une réponse périmée n’écrase pas une plus fraîche', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      await settle();
      let resolveOld!: (v: EventBoardGamesDto) => void;
      api.boardGames.mockImplementationOnce(
        () => new Promise<EventBoardGamesDto>((r) => (resolveOld = r)),
      );
      changed.set(1);
      await settle();
      api.boardGames.mockResolvedValueOnce(served([game('Dixit', 3, 6)], 2));
      changed.set(2);
      await settle();
      expect(rowNames()).toEqual(['Dixit']);

      resolveOld(served([game('Obsolète', 1, 2)], 2));
      await settle();

      expect(rowNames()).toEqual(['Dixit']);
    });

    it('un échec transitoire garde le dernier état connu', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      await settle();

      api.boardGames.mockRejectedValue(new Error('réseau'));
      changed.set(1);
      await settle();

      expect(rowNames()).toEqual(['Azul']);
    });

    it('un premier échec montre le repli neutre', async () => {
      await setup(new Error('réseau'));
      await settle();

      expect(text()).toContain(tone()['board_games.error_fallback']);
      expect(host.counts).toEqual([]);
    });
  });

  describe('annonce de N', () => {
    it('la région existe toujours, vide au premier chargement (aucune annonce)', async () => {
      await setup(served([game('Azul', 2, 4)], 4));
      await settle();

      const region = el().querySelector('[role="status"]')!;
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(live()).toBe('');
    });

    it('quand N change : « 7 participants : 4 jeux jouables à 7. » ; N inchangé : rien de neuf', async () => {
      const games = [
        game('A', 2, 8),
        game('B', 2, 8),
        game('C', 2, 8),
        game('D', 2, 8),
        game('E', 2, 3),
      ];
      await setup(served(games, 4));
      await settle();

      api.boardGames.mockResolvedValue(served(games, 7));
      changed.set(1);
      await settle();
      expect(live()).toBe('7 participants : 4 jeux jouables à 7.');

      // Même N : l'annonce précédente n'est pas rejouée par une autre.
      api.boardGames.mockResolvedValue(served([...games, game('F', 2, 9)], 7));
      changed.set(2);
      await settle();
      expect(live()).toBe('7 participants : 4 jeux jouables à 7.');
    });

    it('accords au singulier', async () => {
      await setup(served([game('A', 1, 2)], 3));
      await settle();

      api.boardGames.mockResolvedValue(served([game('A', 1, 2)], 1));
      changed.set(1);
      await settle();

      expect(live()).toBe('1 participant : 1 jeu jouable à 1.');
    });

    it('le résumé, les pastilles et la puce suivent N sans aucun bandeau', async () => {
      await setup(served([game('A', 2, 4), game('B', 5, 8)], 3));
      await settle();
      expect(pills()).toEqual(['jouable à 3']);

      api.boardGames.mockResolvedValue(served([game('A', 2, 4), game('B', 5, 8)], 6));
      changed.set(1);
      await settle();

      expect(text()).toContain('2 jeux sur place · 1 jouable à 6');
      expect(chip().textContent).toContain('Jouables à 6');
      expect(pills()).toEqual(['jouable à 6']);
      expect(el().querySelector('.banner, [role="alert"]')).toBeNull();
    });
  });

  // ─── Story 49.2 : ce que j'apporte, et les doublons ───────────────────────────────────────────────────────────

  describe('apports et « Dans mon … » (Story 49.2)', () => {
    const bring = (name: string, min: number | null, max: number | null, who = 'zoe') => {
      const dto: EventBringDto = {
        game: { ...game(name, min, max), id: `b-${name}-${who}` },
        bringer: { userId: `u-${who}`, pseudo: who, displayName: who.toUpperCase() },
      };
      return dto;
    };
    const mineGame = (name: string, min: number | null = 2, max: number | null = 4) => ({
      ...game(name, min, max),
      id: `mine-${name}`,
    });
    const myBring = (g: BoardGameDto): EventBringDto => ({
      game: g,
      bringer: { userId: ME, pseudo: 'moi', displayName: 'Moi-même' },
    });
    /** Un participant (inscrit CONFIRMED), autre que l'hôte. */
    const asParticipant = () => host.card.set(card({ myInscription: 'CONFIRMED' }));
    const sectionTitles = (): string[] =>
      Array.from(el().querySelectorAll('.gs__title')).map((n) => n.textContent!.trim());
    const sectionRows = (title: string): HTMLElement[] => {
      const section = Array.from(el().querySelectorAll('app-games-section')).find(
        (s) => s.querySelector('.gs__title')!.textContent!.trim() === title,
      );
      return section ? Array.from(section.querySelectorAll<HTMLElement>('app-game-row')) : [];
    };
    const rowText = (row: HTMLElement): string =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim();
    const rowName = (row: HTMLElement): string =>
      row.querySelector('.gr__name')!.textContent!.trim();
    const rowAction = (row: HTMLElement): HTMLButtonElement =>
      row.querySelector<HTMLButtonElement>('.gr__action')!;

    it('un participant voit, dans l’ordre : « Chez Léa », « Apportées », « Dans mon cabinet »', async () => {
      await setup(
        served([game('Azul', 2, 4)], 3, [bring('Skull', null, null), bring('Dixit', 3, 6, 'yan')]),
        'grimoire-emeraude',
        [mineGame('Codenames'), mineGame('Tzolk’in')],
      );
      asParticipant();
      await settle();

      expect(sectionTitles()).toEqual(['Chez Léa', 'Apportées', 'Dans mon cabinet']);
      expect(rowNames()).toEqual(['Azul', 'Skull', 'Dixit', 'Codenames', 'Tzolk’in']);
      expect(library).toHaveBeenCalledTimes(1);
      expect(rowText(sectionRows('Apportées')[0])).toContain('par ZOE');
      expect(rowText(sectionRows('Apportées')[1])).toContain('par YAN');
      // Les apports des autres n'ont pas d'action.
      expect(sectionRows('Apportées').every((r) => r.querySelector('.gr__action') === null)).toBe(
        true,
      );
      expect(sectionRows('Dans mon cabinet').map((r) => rowAction(r).textContent!.trim())).toEqual([
        "J'apporte",
        "J'apporte",
      ]);
    });

    it('le résumé et le compte de l’onglet comptent les apports (des lignes, pas des noms distincts)', async () => {
      await setup(
        served([game('Azul', 2, 4)], 3, [bring('azul', 2, 4), bring('Skull', null, null)]),
      );
      asParticipant();
      await settle();

      expect(text()).toContain('3 jeux sur place · 2 jouables à 3');
      expect(host.counts).toEqual([3]);
    });

    it('l’hôte : jamais « Dans mon … », sa Ludothèque n’est pas lue ; un membre en lecture seule non plus', async () => {
      await setup(
        served([game('Azul', 2, 4)], 2, [bring('Skull', null, null)]),
        'grimoire-emeraude',
        [mineGame('Codenames')],
      );
      host.userId.set(HOST);
      await settle();
      expect(sectionTitles()).toEqual(['Chez moi', 'Apportées']);
      expect(library).not.toHaveBeenCalled();

      host.userId.set(ME);
      host.card.set(card({ id: 'e2', myInscription: null }));
      await settle();
      expect(sectionTitles()).toEqual(['Chez Léa', 'Apportées']);
      expect(library).not.toHaveBeenCalled();
    });

    it('doublon : les deux lignes portent « ×2 » ; l’hôte « aussi apporté par ZOE », le porteur « par ZOE · aussi chez Léa »', async () => {
      await setup(served([game('Azul', 2, 4)], 3, [bring('azul', 2, 4)]));
      host.userId.set(null);
      await settle();

      const hostRow = sectionRows('Chez Léa')[0];
      const broughtRow = sectionRows('Apportées')[0];
      expect(hostRow.querySelector('.gr__dup')!.textContent!.trim()).toBe('×2');
      expect(broughtRow.querySelector('.gr__dup')!.textContent!.trim()).toBe('×2');
      expect(rowText(hostRow)).toContain('aussi apporté par ZOE');
      expect(rowText(broughtRow)).toContain('par ZOE');
      expect(rowText(broughtRow)).toContain('aussi chez Léa');
    });

    it('trois détenteurs : les autres sont liés « A, B et C » ; sans doublon, ni pastille ni ligne « aussi »', async () => {
      await setup(
        served([game('Azul', 2, 4), game('Skull', null, null)], 4, [
          bring('azul', 2, 4, 'zoe'),
          bring('Azul', 2, 4, 'yan'),
          bring('azul', 2, 4, 'kim'),
        ]),
      );
      host.userId.set(null);
      await settle();

      const hostRows = sectionRows('Chez Léa');
      expect(rowText(hostRows[0])).toContain('aussi apporté par ZOE, YAN et KIM');
      expect(hostRows[0].querySelector('.gr__dup')!.textContent!.trim()).toBe('×4');
      const kim = sectionRows('Apportées').find((r) => rowText(r).includes('par KIM'))!;
      expect(rowText(kim)).toContain('aussi chez Léa · aussi apporté par ZOE et YAN');
      // Un jeu sans homonyme n'a ni pastille ni ligne « aussi ».
      expect(hostRows[1].querySelector('.gr__dup')).toBeNull();
      expect(rowText(hostRows[1])).not.toContain('aussi');
    });

    it('le regroupement suit la clé REÇUE : même nameKey = doublon (écriture différente), nameKey différente = pas de doublon', async () => {
      const received = { ...game('AZUL', 2, 4), nameKey: 'azul', id: 'h1' };
      const other = { ...game('Azul 2', 2, 4), nameKey: 'azul 2', id: 'h2' };
      await setup(served([received, other], 3, [bring('azul', 2, 4)]));
      host.userId.set(null);
      await settle();

      const rows = sectionRows('Chez Léa');
      expect(rows[0].querySelector('.gr__dup')).not.toBeNull();
      expect(rows[1].querySelector('.gr__dup')).toBeNull();
    });

    it('« Dans mon … » : un jeu déjà sur place porte « ⚠ déjà chez … » à côté de « J’apporte » ; les porteurs sont nommés', async () => {
      await setup(
        served([game('Azul', 2, 4)], 3, [
          bring('Skull', null, null),
          bring('SKULL', null, null, 'yan'),
        ]),
        'grimoire-emeraude',
        [mineGame('Azul'), mineGame('Dixit'), mineGame('Skull')],
      );
      asParticipant();
      await settle();

      const [azul, dixit, skull] = sectionRows('Dans mon cabinet');
      expect(rowText(azul)).toContain('déjà chez Léa');
      expect(rowAction(azul).textContent!.trim()).toBe("J'apporte");
      expect(rowText(dixit)).not.toContain('déjà chez');
      expect(rowText(skull)).toContain('déjà chez ZOE et YAN');
      // Story 51.7 : le ⚠ du texte est devenu un pictogramme décoratif placé avant le texte.
      const warn = azul.querySelector('.gr__warn')!;
      expect(warn.firstElementChild?.getAttribute('data-icon')).toBe('avertissement');
      expect(warn.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(warn.textContent).not.toContain('⚠');
      // Pas de « ×N » dans cette section : le jeu n'est pas encore sur place.
      expect(azul.querySelector('.gr__dup')).toBeNull();
    });

    it('mon propre apport : « par moi · Je ne l’apporte plus » ; il ne figure plus dans « Dans mon cabinet »', async () => {
      const skull = mineGame('Skull', null, null);
      await setup(served([game('Azul', 2, 4)], 3, [myBring(skull)]), 'grimoire-emeraude', [
        skull,
        mineGame('Codenames'),
      ]);
      asParticipant();
      await settle();

      const row = sectionRows('Apportées')[0];
      expect(rowText(row)).toContain('par moi');
      expect(rowAction(row).textContent!.trim()).toBe("Je ne l'apporte plus");
      expect(sectionRows('Dans mon cabinet').map(rowName)).toEqual(['Codenames']);
    });

    it('un détenteur qui est moi se lit « moi » dans les lignes « aussi … »', async () => {
      const azul = mineGame('Azul', 2, 4);
      await setup(served([{ ...game('Azul', 2, 4), id: 'h1' }], 3, [myBring(azul)]));
      asParticipant();
      await settle();

      expect(rowText(sectionRows('Chez Léa')[0])).toContain('aussi apporté par moi');
      expect(rowText(sectionRows('Apportées')[0])).toContain('aussi chez Léa');
    });

    it('J’apporte : la ligne passe AUSSITÔT sous « Apportées » (« par moi »), l’écriture part, puis la liste est relue', async () => {
      const azul = mineGame('Azul');
      await setup(served([], 2), 'grimoire-emeraude', [azul, mineGame('Skull')]);
      asParticipant();
      await settle();
      let finish!: () => void;
      api.bring.mockImplementation(() => new Promise<void>((r) => (finish = r)));
      api.boardGames.mockResolvedValue(served([], 2, [myBring(azul)]));

      rowAction(sectionRows('Dans mon cabinet')[0]).click();
      await settle();

      expect(api.bring).toHaveBeenCalledWith('e1', azul.id);
      // L'écriture n'a pas répondu : la ligne a déjà changé de section.
      expect(rowText(sectionRows('Apportées')[0])).toContain('par moi');
      expect(sectionRows('Dans mon cabinet').map(rowName)).toEqual(['Skull']);
      expect(api.boardGames).toHaveBeenCalledTimes(1);

      finish();
      await settle();

      expect(api.boardGames).toHaveBeenCalledTimes(2);
      expect(sectionRows('Apportées')).toHaveLength(1);
      expect(host.counts).toEqual([0, 1]);
    });

    it('un second toucher pendant l’écriture est ignoré (garde par jeu) ; un autre jeu reste libre', async () => {
      const azul = mineGame('Azul');
      const skull = mineGame('Skull');
      await setup(served([], 2), 'grimoire-emeraude', [azul, skull]);
      asParticipant();
      await settle();
      const finishers: (() => void)[] = [];
      api.bring.mockImplementation(() => new Promise<void>((r) => finishers.push(r)));

      rowAction(sectionRows('Dans mon cabinet')[0]).click();
      await settle();
      expect(api.bring).toHaveBeenCalledTimes(1);
      // Le bouton de « Azul » (maintenant sous « Apportées ») est désactivé tant que l'écriture dure.
      expect(sectionRows('Apportées').every((r) => rowAction(r).disabled)).toBe(true);
      // Un autre jeu reste libre.
      rowAction(sectionRows('Dans mon cabinet')[0]).click();
      await settle();
      expect(api.bring).toHaveBeenCalledTimes(2);
      expect(api.bring).toHaveBeenLastCalledWith('e1', skull.id);

      finishers.forEach((f) => f());
      await settle();
    });

    it('Je ne l’apporte plus : DELETE, la ligne retourne aussitôt dans « Dans mon … »', async () => {
      const skull = mineGame('Skull', null, null);
      await setup(served([], 2, [myBring(skull)]), 'grimoire-emeraude', [skull]);
      asParticipant();
      await settle();
      let finish!: () => void;
      api.unbring.mockImplementation(() => new Promise<void>((r) => (finish = r)));
      api.boardGames.mockResolvedValue(served([], 2));

      rowAction(sectionRows('Apportées')[0]).click();
      await settle();

      expect(api.unbring).toHaveBeenCalledWith('e1', skull.id);
      expect(sectionRows('Apportées')).toHaveLength(0);
      expect(sectionRows('Dans mon cabinet')).toHaveLength(1);

      finish();
      await settle();
      expect(sectionTitles()).toEqual(['Dans mon cabinet']);
    });

    it.each([400, 403, 404])(
      'refus %s (soirée close, plus participant, jeu disparu) : rien de bloquant, aucune erreur affichée, la liste est relue',
      async (status) => {
        const azul = mineGame('Azul');
        await setup(served([], 2), 'grimoire-emeraude', [azul]);
        asParticipant();
        await settle();
        api.bring.mockRejectedValue(new HttpErrorResponse({ status }));
        // La relecture dit la vérité : le jeu n'est pas apporté.
        api.boardGames.mockResolvedValue(served([], 2));

        rowAction(sectionRows('Dans mon cabinet')[0]).click();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(sectionRows('Dans mon cabinet')).toHaveLength(1);
        expect(sectionRows('Apportées')).toHaveLength(0);
        expect(el().querySelector('[role="alert"], .egt__error')).toBeNull();
        // Le bouton est de nouveau disponible.
        expect(rowAction(sectionRows('Dans mon cabinet')[0]).disabled).toBe(false);
      },
    );

    it('Ludothèque vide : « Votre cabinet est vide. » et le lien, une seule fois, dans la section', async () => {
      await setup(served([], 2), 'grimoire-emeraude', []);
      asParticipant();
      await settle();

      expect(sectionTitles()).toEqual(['Dans mon cabinet']);
      expect(text()).toContain(tone()['event_games.empty']);
      expect(text()).toContain('Votre cabinet est vide.');
      expect(el().querySelectorAll('.egt__link')).toHaveLength(1);
      expect(el().querySelector('.gs .egt__link')).not.toBeNull();
    });

    it('site vide et Ludothèque pleine : la ligne « aucun jeu » (sans lien) puis « Dans mon cabinet » en dessous', async () => {
      await setup(served([], 2), 'grimoire-emeraude', [mineGame('Azul')]);
      asParticipant();
      await settle();

      expect(text()).toContain(tone()['event_games.empty']);
      expect(el().querySelector('.egt__link')).toBeNull();
      expect(sectionTitles()).toEqual(['Dans mon cabinet']);
      expect(rowNames()).toEqual(['Azul']);
      // Le site vide vient avant la section.
      const empty = el().querySelector('.egt__empty')!;
      const section = el().querySelector('app-games-section')!;
      expect(
        empty.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('le filtre « Jouables à N » et la pastille s’appliquent à chaque ligne : jeux de l’hôte, apports et « Dans mon … »', async () => {
      await setup(
        served([game('Azul', 2, 4), game('Codenames', 5, 8)], 4, [
          bring('Dixit', 3, 6),
          bring('Skull', null, null),
        ]),
        'grimoire-emeraude',
        [mineGame('Cascadia', 1, 4), mineGame('Everdell', 5, 6), mineGame('Libre', null, null)],
      );
      asParticipant();
      await settle();
      expect(pills()).toEqual(['jouable à 4', 'jouable à 4', 'jouable à 4']);

      chip().click();
      await settle();

      expect(rowNames()).toEqual(['Azul', 'Dixit', 'Cascadia']);
      const counts = Array.from(el().querySelectorAll('.gs__count')).map((n) =>
        n.textContent!.trim(),
      );
      expect(counts).toEqual(['· 1 sur 2', '· 1 sur 2', '· 1 sur 3']);
    });

    it('chaque section a sa propre clé retenue : replier « Apportées » ne replie ni « Chez … » ni « Dans mon … »', async () => {
      await setup(
        served([game('Azul', 2, 4)], 2, [bring('Skull', null, null)]),
        'grimoire-emeraude',
        [mineGame('Dixit')],
      );
      asParticipant();
      await settle();

      Array.from(el().querySelectorAll<HTMLButtonElement>('.gs__header'))[1].click();
      await settle();

      expect(JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')).toEqual(['brought']);
      const hidden = Array.from(el().querySelectorAll<HTMLElement>('.gs__body')).map(
        (b) => b.hidden,
      );
      expect(hidden).toEqual([false, true, false]);
    });

    it.each([
      ['grimoire-emeraude', 'Apportées', 'Dans mon cabinet', "J'apporte", "Je ne l'apporte plus"],
      [
        'foret-ancienne',
        'Apportés à la veillée',
        'Dans mon coffre',
        "Je l'apporte",
        "Je ne l'apporte plus",
      ],
      [
        'atelier-cuivre',
        'Acheminés',
        'Sur mon râtelier',
        "Je l'achemine",
        "Annuler l'acheminement",
      ],
    ] as [Theme, string, string, string, string][])(
      'thème %s : titres de section et actions à sa voix',
      async (theme, broughtTitle, mineTitle, bringLabel, unbringLabel) => {
        await setup(
          served([game('Azul', 2, 4)], 2, [myBring(mineGame('Skull', null, null))]),
          theme,
          [mineGame('Dixit')],
        );
        asParticipant();
        await settle();

        expect(sectionTitles().slice(1)).toEqual([broughtTitle, mineTitle]);
        expect(rowAction(sectionRows(mineTitle)[0]).textContent!.trim()).toBe(bringLabel);
        expect(rowAction(sectionRows(broughtTitle)[0]).textContent!.trim()).toBe(unbringLabel);
      },
    );

    it('l’action est un bouton nommé avec le jeu', async () => {
      await setup(served([], 2), 'grimoire-emeraude', [mineGame('Dixit')]);
      asParticipant();
      await settle();

      const action = rowAction(sectionRows('Dans mon cabinet')[0]);
      expect(action.getAttribute('aria-label')).toBe("J'apporte — Dixit");
      expect(action.getAttribute('type')).toBe('button');
    });

    it('temps réel : un signal de la partie relit les apports et ma Ludothèque (un jeu ajouté ailleurs apparaît)', async () => {
      await setup(served([], 2), 'grimoire-emeraude', [mineGame('Dixit')]);
      asParticipant();
      await settle();
      expect(library).toHaveBeenCalledTimes(1);

      library.mockResolvedValue([mineGame('Dixit'), mineGame('Azul')]);
      api.boardGames.mockResolvedValue(served([], 2, [bring('Skull', null, null)]));
      changed.set(1);
      await settle();

      expect(library).toHaveBeenCalledTimes(2);
      expect(rowNames()).toEqual(['Skull', 'Dixit', 'Azul']);
    });

    it('une Ludothèque illisible ne casse pas l’onglet : pas de section « Dans mon … », le reste reste', async () => {
      await setup(served([game('Azul', 2, 4)], 2));
      library.mockRejectedValue(new Error('réseau'));
      asParticipant();
      await settle();

      expect(sectionTitles()).toEqual(['Chez Léa']);
      expect(rowNames()).toEqual(['Azul']);
    });

    it('Ludothèque non vide mais tous les jeux déjà apportés : « Dans mon … » est absent (ni en-tête vide, ni message)', async () => {
      const skull = mineGame('Skull', null, null);
      await setup(served([game('Azul', 2, 4)], 2, [myBring(skull)]), 'grimoire-emeraude', [skull]);
      asParticipant();
      await settle();

      expect(sectionTitles()).toEqual(['Chez Léa', 'Apportées']);
      expect(text()).not.toContain('Dans mon cabinet');
      expect(text()).not.toContain('Votre cabinet est vide.');
    });

    it('J’apporte un jeu de même nom qu’un autre apport : la mise à jour locale départage par identifiant (comme l’API), sans réordonner à la relecture', async () => {
      const azul = mineGame('Azul'); // id « mine-Azul »
      const other = bring('Azul', 2, 4, 'yan'); // id « b-Azul-yan », même clé et même nom
      await setup(served([], 3, [other]), 'grimoire-emeraude', [azul]);
      asParticipant();
      await settle();
      let finish!: () => void;
      api.bring.mockImplementation(() => new Promise<void>((r) => (finish = r)));
      // L'API sert l'ordre clé, nom, identifiant.
      api.boardGames.mockResolvedValue(served([], 3, [other, myBring(azul)]));

      rowAction(sectionRows('Dans mon cabinet')[0]).click();
      await settle();
      const byLocal = sectionRows('Apportées').map((r) => rowText(r));
      expect(byLocal[0]).toContain('par YAN');
      expect(byLocal[1]).toContain('par moi');

      finish();
      await settle();
      const byServer = sectionRows('Apportées').map((r) => rowText(r));
      expect(byServer[0]).toContain('par YAN');
      expect(byServer[1]).toContain('par moi');
    });
  });

  // ─── Story 49.4 : écarter un jeu pour ce soir (hôte) ────────────────────────────────────────────────────────────

  describe('écarter un jeu pour ce soir (Story 49.4)', () => {
    const served494 = (
      games: BoardGameDto[],
      excludedGames?: BoardGameDto[],
      brings: EventBringDto[] = [],
    ): EventBoardGamesDto => ({
      ...served(games, 3, brings),
      ...(excludedGames === undefined ? {} : { excludedGames }),
    });
    const asHost = () => host.userId.set(HOST);
    const asGuest = () => host.card.set(card({ myInscription: 'CONFIRMED' }));
    const rowOf = (name: string): HTMLElement | undefined =>
      Array.from(el().querySelectorAll<HTMLElement>('app-game-row')).find(
        (r) => r.querySelector('.gr__name')!.textContent!.trim() === name,
      );
    const kebab = (name: string): HTMLButtonElement | null =>
      rowOf(name)?.querySelector<HTMLButtonElement>('.gr__menu') ?? null;
    const kebabs = (): HTMLButtonElement[] =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.gr__menu'));
    const menu = (): HTMLElement | null => document.querySelector<HTMLElement>('.egt-menu');
    const menuItem = (): HTMLButtonElement | null =>
      document.querySelector<HTMLButtonElement>('.egt-menu [role="menuitem"]');
    const sectionTitles = (): string[] =>
      Array.from(el().querySelectorAll('.gs__title')).map((n) => n.textContent!.trim());
    const unavailableRows = (): HTMLElement[] =>
      Array.from(el().querySelectorAll<HTMLElement>('app-unavailable-row'));
    const unavailableNames = (): string[] =>
      unavailableRows().map((r) => r.querySelector('.ur__name')!.textContent!.trim());
    const restoreButton = (name: string): HTMLButtonElement =>
      unavailableRows()
        .find((r) => r.querySelector('.ur__name')!.textContent!.trim() === name)!
        .querySelector<HTMLButtonElement>('.ur__action')!;
    const press = (key: string): void => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    };
    async function openMenuOf(name: string): Promise<void> {
      kebab(name)!.click();
      await settle();
    }
    const azul = game('Azul', 2, 4, 40);
    const brass = game('Brass', 2, 4);
    const codenames = game('Codenames', 5, 8);

    describe('le ⋮', () => {
      it('l’hôte : un ⋮ sur chaque jeu de « Chez moi », nommé « Actions pour {jeu} » ; rien sur les apports', async () => {
        const zoe: EventBringDto = {
          game: { ...game('Skull', null, null), id: 'b-skull' },
          bringer: { userId: 'u-zoe', pseudo: 'zoe', displayName: 'ZOE' },
        };
        await setup(served494([azul, brass], [], [zoe]));
        asHost();
        await settle();

        expect(kebabs()).toHaveLength(2);
        expect(kebab('Azul')!.getAttribute('aria-label')).toBe('Actions pour Azul');
        expect(kebab('Azul')!.getAttribute('aria-haspopup')).toBe('menu');
        expect(kebab('Azul')!.getAttribute('type')).toBe('button');
        expect(kebab('Skull')).toBeNull();
      });

      it('story 51.7 : le ⋮ est l’icône « menu-actions », nom accessible conservé', async () => {
        await setup(served494([azul], [], []));
        asHost();
        await settle();

        const button = kebab('Azul')!;
        expect(button.querySelector('app-icon')?.getAttribute('data-icon')).toBe('menu-actions');
        expect(button.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
        expect(button.textContent).not.toContain('⋮');
        expect(button.getAttribute('aria-label')).toBe('Actions pour Azul');
      });

      it('un participant, un membre en lecture seule : aucun ⋮, aucune section du bas', async () => {
        await setup(served494([azul, brass]));
        asGuest();
        await settle();
        expect(kebabs()).toHaveLength(0);

        host.card.set(card());
        await settle();
        expect(kebabs()).toHaveLength(0);
        expect(menu()).toBeNull();
      });

      it('le ⋮ ouvre un menu d’une entrée (role=menu / menuitem, nommé avec le jeu), le focus sur l’entrée', async () => {
        await setup(served494([azul, brass]));
        asHost();
        await settle();

        await openMenuOf('Azul');

        expect(menu()!.getAttribute('role')).toBe('menu');
        expect(menu()!.getAttribute('aria-label')).toBe('Menu des actions pour Azul');
        expect(document.querySelectorAll('.egt-menu [role="menuitem"]')).toHaveLength(1);
        expect(menuItem()!.textContent!.trim()).toBe('Sceller pour ce soir');
        expect(document.activeElement).toBe(menuItem());
        expect(kebab('Azul')!.getAttribute('aria-expanded')).toBe('true');
        expect(kebab('Brass')!.getAttribute('aria-expanded')).toBe('false');
      });

      it.each([
        ['grimoire-emeraude', 'Sceller pour ce soir'],
        ['foret-ancienne', 'Laisser au logis ce soir'],
        ['atelier-cuivre', 'Hors service ce soir'],
      ] as [Theme, string][])('thème %s : l’entrée du menu dit « %s »', async (theme, label) => {
        await setup(served494([azul]), theme);
        asHost();
        await settle();

        await openMenuOf('Azul');

        expect(menuItem()!.textContent!.trim()).toBe(label);
      });

      it('Échap referme le menu et rend le focus au ⋮ ; rien n’est écrit', async () => {
        await setup(served494([azul, brass]));
        asHost();
        await settle();
        await openMenuOf('Brass');

        press('Escape');
        await settle();

        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(kebab('Brass'));
        expect(api.exclude).not.toHaveBeenCalled();
      });

      it('le fond referme le menu et rend le focus au ⋮', async () => {
        await setup(served494([azul]));
        asHost();
        await settle();
        await openMenuOf('Azul');

        document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
        await settle();

        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(kebab('Azul'));
        expect(api.exclude).not.toHaveBeenCalled();
      });

      it('flèches, Début et Fin gardent le focus sur l’entrée (boucle d’une seule entrée) ; Tab referme', async () => {
        await setup(served494([azul]));
        asHost();
        await settle();
        await openMenuOf('Azul');

        for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
          press(key);
          expect(document.activeElement, key).toBe(menuItem());
        }
        press('Tab');
        await settle();

        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(kebab('Azul'));
      });
    });

    describe('écarter', () => {
      it('l’entrée retire le jeu de « Chez moi » AUSSITÔT (l’écriture n’a pas répondu) et le range dans la section du bas', async () => {
        await setup(served494([azul, brass]));
        asHost();
        await settle();
        let finish!: () => void;
        api.exclude.mockImplementation(() => new Promise<void>((r) => (finish = r)));
        api.boardGames.mockResolvedValue(served494([brass], [azul]));
        await openMenuOf('Azul');

        menuItem()!.click();
        await settle();

        expect(api.exclude).toHaveBeenCalledWith('e1', azul.id);
        expect(menu()).toBeNull();
        expect(rowNames()).toEqual(['Brass']);
        expect(sectionTitles()).toEqual(['Chez moi', 'Scellées ce soir']);
        expect(unavailableNames()).toEqual(['Azul']);
        expect(api.boardGames).toHaveBeenCalledTimes(1);

        finish();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(rowNames()).toEqual(['Brass']);
        expect(unavailableNames()).toEqual(['Azul']);
      });

      it('un second toucher pendant l’écriture est ignoré (garde par jeu)', async () => {
        await setup(served494([azul, brass]));
        asHost();
        await settle();
        const finishers: (() => void)[] = [];
        api.exclude.mockImplementation(() => new Promise<void>((r) => finishers.push(r)));
        await openMenuOf('Azul');
        menuItem()!.click();
        await settle();
        expect(restoreButton('Azul').disabled).toBe(true);

        restoreButton('Azul').click();
        await settle();

        expect(api.exclude).toHaveBeenCalledTimes(1);
        expect(api.restore).not.toHaveBeenCalled();
        finishers.forEach((f) => f());
        await settle();
      });

      it('refus ou jeu disparu : aucune erreur bloquante, la relecture dit l’état réel', async () => {
        await setup(served494([azul, brass]));
        asHost();
        await settle();
        api.exclude.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
        await openMenuOf('Azul');

        menuItem()!.click();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(rowNames()).toEqual(['Azul', 'Brass']);
        expect(sectionTitles()).toEqual(['Chez moi']);
        expect(el().querySelector('.egt__error')).toBeNull();
      });

      it('le focus va à la ligne suivante, à défaut à la précédente', async () => {
        await setup(served494([azul, brass, codenames]));
        asHost();
        await settle();
        api.boardGames.mockResolvedValue(served494([brass, codenames], [azul]));
        await openMenuOf('Azul');
        menuItem()!.click();
        await settle();
        expect(document.activeElement).toBe(kebab('Brass'));

        api.boardGames.mockResolvedValue(served494([brass], [azul, codenames]));
        await openMenuOf('Codenames');
        menuItem()!.click();
        await settle();
        expect(document.activeElement).toBe(kebab('Brass'));
      });

      it('tout est écarté : « Chez moi » laisse la ligne « aucun jeu », la section du bas reste, le focus va à son en-tête', async () => {
        await setup(served494([azul]));
        asHost();
        await settle();
        api.boardGames.mockResolvedValue(served494([], [azul]));
        await openMenuOf('Azul');

        menuItem()!.click();
        await settle();

        expect(text()).toContain(tone()['event_games.empty']);
        expect(sectionTitles()).toEqual(['Scellées ce soir']);
        expect(unavailableNames()).toEqual(['Azul']);
        expect(document.activeElement).toBe(
          el().querySelector('app-games-section[data-section="excluded"] .gs__header'),
        );
      });
    });

    describe('la section du bas', () => {
      it('hôte : titre themé, mention « visible par vous seul·e », une ligne par jeu, nom et mesures estompés', async () => {
        await setup(served494([brass], [azul, codenames]));
        asHost();
        await settle();

        expect(sectionTitles()).toEqual(['Chez moi', 'Scellées ce soir']);
        expect(el().querySelector('.gs__note')!.textContent!.trim()).toBe(
          'visible par vous seul·e',
        );
        expect(unavailableNames()).toEqual(['Azul', 'Codenames']);
        const first = unavailableRows()[0];
        expect(first.querySelector('.ur__info')!.textContent).toContain('2–4 joueurs · 40 min');
        // Le bouton « Remettre » n'est PAS dans la zone estompée à 45 %.
        expect(first.querySelector('.ur__info .ur__action')).toBeNull();
        expect(first.querySelector('.ur__action')).not.toBeNull();
        // Pas de ⋮ dans la section du bas.
        expect(el().querySelectorAll('app-unavailable-row .gr__menu')).toHaveLength(0);
      });

      it('absente quand rien n’est écarté (`excludedGames` vide ou clé absente)', async () => {
        await setup(served494([azul], []));
        asHost();
        await settle();
        expect(sectionTitles()).toEqual(['Chez moi']);

        api.boardGames.mockResolvedValue(served494([azul]));
        changed.set(1);
        await settle();
        expect(sectionTitles()).toEqual(['Chez moi']);
        expect(unavailableRows()).toHaveLength(0);
      });

      it('jamais montrée à un autre que l’hôte, même si la réponse portait la liste', async () => {
        await setup(served494([brass], [azul]));
        asGuest();
        await settle();

        // Un participant a, en plus, sa propre section « Dans mon … » (Ludothèque vide ici) : jamais celle du bas.
        expect(sectionTitles()).toEqual(['Chez Léa', 'Dans mon cabinet']);
        expect(unavailableRows()).toHaveLength(0);
        expect(text()).not.toContain('Scellées ce soir');
        expect(rowNames()).toEqual(['Brass']);
      });

      it('même quand « Chez moi » est vide : la ligne « aucun jeu » puis la section du bas', async () => {
        await setup(served494([], [azul]));
        asHost();
        await settle();

        expect(text()).toContain(tone()['event_games.empty']);
        expect(sectionTitles()).toEqual(['Scellées ce soir']);
        expect(unavailableNames()).toEqual(['Azul']);
        const empty = el().querySelector('.egt__empty')!;
        const section = el().querySelector('app-games-section')!;
        expect(
          empty.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      });

      it('le filtre « Jouables à N » ne touche pas la section du bas', async () => {
        await setup(served494([azul, codenames], [brass]));
        asHost();
        await settle();

        chip().click();
        await settle();

        expect(rowNames()).toEqual(['Azul']);
        expect(unavailableNames()).toEqual(['Brass']);
      });

      it('les jeux écartés ne comptent ni dans le résumé ni dans le compte de l’onglet', async () => {
        await setup(served494([azul], [brass, codenames]));
        asHost();
        await settle();

        expect(text()).toContain('1 jeu sur place · 1 jouable à 3');
        expect(host.counts).toEqual([1]);
      });

      it.each([
        ['grimoire-emeraude', 'Scellées ce soir', 'visible par vous seul·e', 'Lever le sceau'],
        ['foret-ancienne', 'Restés au logis', 'visible par toi seul·e', 'Ressortir'],
        ['atelier-cuivre', 'Hors service', 'visible par vous seul·e', 'Remettre en service'],
      ] as [Theme, string, string, string][])(
        'thème %s : titre « %s », mention « %s », bouton « %s » nommé avec le jeu',
        async (theme, title, note, label) => {
          await setup(served494([brass], [azul]), theme);
          asHost();
          await settle();

          expect(sectionTitles()).toEqual(['Chez moi', title]);
          expect(el().querySelector('.gs__note')!.textContent!.trim()).toBe(note);
          expect(restoreButton('Azul').textContent!.trim()).toBe(label);
          expect(restoreButton('Azul').getAttribute('aria-label')).toBe(`${label} — Azul`);
          expect(restoreButton('Azul').getAttribute('type')).toBe('button');
        },
      );

      it('la section a sa propre clé retenue : la replier ne replie pas « Chez moi »', async () => {
        await setup(served494([brass], [azul]));
        asHost();
        await settle();

        Array.from(el().querySelectorAll<HTMLButtonElement>('.gs__header'))[1].click();
        await settle();

        expect(JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')).toEqual(['excluded']);
        // La mention reste visible, même repliée.
        expect(el().querySelector('.gs__note')).not.toBeNull();
      });
    });

    describe('remettre', () => {
      it('le bouton remet le jeu dans « Chez moi » AUSSITÔT (l’écriture n’a pas répondu), pour tous après la relecture', async () => {
        await setup(served494([brass], [azul]));
        asHost();
        await settle();
        let finish!: () => void;
        api.restore.mockImplementation(() => new Promise<void>((r) => (finish = r)));
        api.boardGames.mockResolvedValue(served494([azul, brass], []));

        restoreButton('Azul').click();
        await settle();

        expect(api.restore).toHaveBeenCalledWith('e1', azul.id);
        expect(rowNames()).toEqual(['Azul', 'Brass']);
        expect(unavailableRows()).toHaveLength(0);
        expect(sectionTitles()).toEqual(['Chez moi']);
        expect(api.boardGames).toHaveBeenCalledTimes(1);

        finish();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(rowNames()).toEqual(['Azul', 'Brass']);
      });

      it('le focus va au bouton suivant de la section du bas, à défaut à l’en-tête de « Chez moi »', async () => {
        await setup(served494([], [azul, brass]));
        asHost();
        await settle();
        api.boardGames.mockResolvedValue(served494([azul], [brass]));
        restoreButton('Azul').click();
        await settle();
        expect(document.activeElement).toBe(restoreButton('Brass'));

        api.boardGames.mockResolvedValue(served494([azul, brass], []));
        restoreButton('Brass').click();
        await settle();
        expect(document.activeElement).toBe(
          el().querySelector('app-games-section[data-section="host"] .gs__header'),
        );
      });

      it('un refus échoue en silence et la liste est relue', async () => {
        await setup(served494([brass], [azul]));
        asHost();
        await settle();
        api.restore.mockRejectedValue(new HttpErrorResponse({ status: 400 }));

        restoreButton('Azul').click();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(unavailableNames()).toEqual(['Azul']);
        expect(el().querySelector('.egt__error')).toBeNull();
      });
    });

    it('temps réel : un signal de la partie relit les jeux écartés', async () => {
      await setup(served494([azul, brass], []));
      asHost();
      await settle();
      expect(unavailableRows()).toHaveLength(0);

      api.boardGames.mockResolvedValue(served494([brass], [azul]));
      changed.set(1);
      await settle();

      expect(rowNames()).toEqual(['Brass']);
      expect(unavailableNames()).toEqual(['Azul']);
    });
  });

  describe('signaler une Envie (Story 49.5)', () => {
    const azul = game('Azul', 2, 4, 40);
    const brass = game('Brass', 2, 4);
    const codenames = game('Codenames', 5, 8);
    const user = (id: string, displayName: string) => ({ userId: id, pseudo: id, displayName });
    const envyOf = (nameKey: string, ...users: [string, string][]): EventEnvyDto => ({
      nameKey,
      users: users.map(([id, name]) => user(id, name)),
    });
    const bringOf = (name: string, who = 'zoe'): EventBringDto => ({
      game: { ...game(name, 2, 4), id: `b-${name}-${who}` },
      bringer: { userId: `u-${who}`, pseudo: who, displayName: who.toUpperCase() },
    });
    /** Un participant (inscrit CONFIRMED), autre que l'hôte. */
    const asParticipant = () => host.card.set(card({ myInscription: 'CONFIRMED' }));
    const asHost = () => host.userId.set(HOST);
    const rowOf = (name: string): HTMLElement =>
      Array.from(el().querySelectorAll<HTMLElement>('app-game-row')).find(
        (r) => r.querySelector('.gr__name')!.textContent!.trim() === name,
      )!;
    const rowsOf = (name: string): HTMLElement[] =>
      Array.from(el().querySelectorAll<HTMLElement>('app-game-row')).filter(
        (r) => r.querySelector('.gr__name')!.textContent!.trim() === name,
      );
    const heart = (row: HTMLElement): HTMLButtonElement | null =>
      row.querySelector<HTMLButtonElement>('.et__heart');
    const count = (row: HTMLElement): HTMLButtonElement | null =>
      row.querySelector<HTMLButtonElement>('.et__count');
    const names = (): HTMLElement | null => document.querySelector<HTMLElement>('.egt-names');
    const sortChip = (): HTMLButtonElement =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.gsum__chip'))[1];
    const press = (key: string): void => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    };

    describe('le ♥ et le compte', () => {
      it('sans Envie : un ♥ seul sur les jeux de l’hôte et les apports, nommé avec le jeu, pas de compte', async () => {
        await setup(served([azul], 3, [bringOf('Skull')]));
        asParticipant();
        await settle();

        for (const name of ['Azul', 'Skull']) {
          const button = heart(rowOf(name))!;
          expect(button.getAttribute('type')).toBe('button');
          expect(button.getAttribute('aria-pressed')).toBe('false');
          expect(button.getAttribute('aria-label')).toBe(
            `Cette relique m'appelle — ${name}, 0 appel`,
          );
          expect(count(rowOf(name))).toBeNull();
        }
      });

      it('avec des Envies : « ♥ n » — ♥ pressé si j’en ai une, compte dans un second bouton, nom accessible au pluriel', async () => {
        await setup(
          served([azul, brass], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'], [ME, 'Moi-même'])]),
        );
        asParticipant();
        await settle();

        const row = rowOf('Azul');
        expect(heart(row)!.getAttribute('aria-pressed')).toBe('true');
        expect(heart(row)!.getAttribute('aria-label')).toBe(
          "Cette relique m'appelle — Azul, 2 appels",
        );
        expect(count(row)!.textContent!.trim()).toBe('2');
        expect(count(row)!.getAttribute('aria-haspopup')).toBe('dialog');
        expect(count(row)!.getAttribute('aria-label')).toBe('Voir les noms — Azul, 2 appels');
        expect(heart(rowOf('Brass'))!.getAttribute('aria-pressed')).toBe('false');
        expect(count(rowOf('Brass'))).toBeNull();
      });

      it('story 51.7 : le ♥ est l’icône « envie » (pastille active = mes Envies), le compte seul reste un texte', async () => {
        await setup(
          served([azul, brass], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'], [ME, 'Moi-même'])]),
        );
        asParticipant();
        await settle();

        const iconOf = (row: HTMLElement) => heart(row)!.querySelector('app-icon');
        expect(iconOf(rowOf('Azul'))?.getAttribute('data-icon')).toBe('envie');
        expect(iconOf(rowOf('Brass'))?.getAttribute('data-icon')).toBe('envie');
        expect(heart(rowOf('Azul'))!.textContent).not.toContain('♥');
        const pill = (row: HTMLElement) => heart(row)!.querySelector('.et__pill')!;
        expect(pill(rowOf('Azul')).classList.contains('et__pill--on')).toBe(true);
        expect(pill(rowOf('Brass')).classList.contains('et__pill--on')).toBe(false);
        expect(count(rowOf('Azul'))!.querySelector('app-icon')).toBeNull();
      });

      it('une seule Envie : l’unité reste au singulier', async () => {
        await setup(served([azul], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'])]));
        asParticipant();
        await settle();

        expect(heart(rowOf('Azul'))!.getAttribute('aria-label')).toBe(
          "Cette relique m'appelle — Azul, 1 appel",
        );
      });

      it.each([
        ['grimoire-emeraude', "Cette relique m'appelle", 'appels', 'Les plus appelées'],
        ['foret-ancienne', "J'ai envie d'y jouer", 'envies', 'Les plus attendus'],
        ['atelier-cuivre', 'Je veux l’essayer', 'demandes', 'Les plus demandés'],
      ] as [Theme, string, string, string][])(
        'thème %s : libellé du ♥, unité et puce de tri à sa voix',
        async (theme, label, unit, sort) => {
          await setup(
            served([azul], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'], ['u-yan', 'Yan'])]),
            theme,
          );
          asParticipant();
          await settle();

          const expected = `${label.replace('’', "'")} — Azul, 2 ${unit}`;
          expect(heart(rowOf('Azul'))!.getAttribute('aria-label')).toBe(expected);
          expect(sortChip().textContent).toContain(sort);
        },
      );

      it('le même nom sur deux lignes (jeu de l’hôte et apport) montre la même Envie, sur les deux', async () => {
        await setup(
          served(
            [azul],
            3,
            [bringOf('azul', 'yan')],
            [envyOf('azul', ['u-zoe', 'Zoé'], [ME, 'Moi'])],
          ),
        );
        asParticipant();
        await settle();

        const rows = rowsOf('Azul').concat(rowsOf('azul'));
        expect(rows).toHaveLength(2);
        for (const row of rows) {
          expect(heart(row)!.getAttribute('aria-pressed')).toBe('true');
          expect(count(row)!.textContent!.trim()).toBe('2');
        }
      });

      it('jamais sur « Dans mon … » ni sur les jeux écartés', async () => {
        await setup(
          {
            ...served([azul], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'])]),
            excludedGames: [brass],
          },
          'grimoire-emeraude',
          [{ ...game('Dixit', 2, 4), id: 'mine-Dixit' }],
        );
        asParticipant();
        await settle();
        expect(heart(rowOf('Dixit'))).toBeNull();
        expect(rowOf('Dixit').querySelector('app-envy-toggle')).toBeNull();

        TestBed.resetTestingModule();
        await setup({
          ...served([azul], 3, [], []),
          excludedGames: [brass],
        });
        asHost();
        await settle();
        expect(el().querySelectorAll('app-unavailable-row')).toHaveLength(1);
        expect(el().querySelector('app-unavailable-row app-envy-toggle')).toBeNull();
        expect(heart(rowOf('Azul'))).not.toBeNull();
      });

      it('lecture seule : le compte se voit et ouvre les noms, mais aucun ♥ ne bascule', async () => {
        await setup(served([azul, brass], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'])]));
        await settle();

        expect(heart(rowOf('Azul'))).toBeNull();
        expect(heart(rowOf('Brass'))).toBeNull();
        expect(count(rowOf('Azul'))!.textContent!.replace(/\s+/g, ' ').trim()).toBe('1');
        expect(count(rowOf('Azul'))!.querySelector('app-icon')?.getAttribute('data-icon')).toBe(
          'envie',
        );
        expect(count(rowOf('Brass'))).toBeNull();

        count(rowOf('Azul'))!.click();
        await settle();
        expect(names()).not.toBeNull();
        expect(api.envy).not.toHaveBeenCalled();
      });
    });

    describe('basculer', () => {
      it('le ♥ s’allume AUSSITÔT (l’écriture n’a pas répondu), appelle envy avec le nameKey reçu, puis la liste est relue', async () => {
        await setup(served([azul], 3));
        asParticipant();
        await settle();
        let finish!: () => void;
        api.envy.mockImplementation(() => new Promise<void>((r) => (finish = r)));
        api.boardGames.mockResolvedValue(served([azul], 3, [], [envyOf('azul', [ME, 'Moi'])]));

        heart(rowOf('Azul'))!.click();
        await settle();

        expect(api.envy).toHaveBeenCalledWith('e1', 'azul');
        expect(heart(rowOf('Azul'))!.getAttribute('aria-pressed')).toBe('true');
        expect(count(rowOf('Azul'))!.textContent!.trim()).toBe('1');
        expect(api.boardGames).toHaveBeenCalledTimes(1);

        finish();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(heart(rowOf('Azul'))!.getAttribute('aria-pressed')).toBe('true');
      });

      it('un second toucher retire mon Envie : unenvy, le ♥ s’éteint et le compte disparaît', async () => {
        await setup(served([azul], 3, [], [envyOf('azul', [ME, 'Moi'])]));
        asParticipant();
        await settle();
        api.boardGames.mockResolvedValue(served([azul], 3));

        heart(rowOf('Azul'))!.click();
        await settle();

        expect(api.unenvy).toHaveBeenCalledWith('e1', 'azul');
        expect(api.envy).not.toHaveBeenCalled();
        expect(heart(rowOf('Azul'))!.getAttribute('aria-pressed')).toBe('false');
        expect(count(rowOf('Azul'))).toBeNull();
      });

      it('garde « occupé » par NOM : pendant l’écriture, toucher le même nom sur l’autre ligne est ignoré', async () => {
        await setup(served([azul], 3, [bringOf('azul', 'yan')]));
        asParticipant();
        await settle();
        let finish!: () => void;
        api.envy.mockImplementation(() => new Promise<void>((r) => (finish = r)));

        heart(rowsOf('Azul')[0])!.click();
        await settle();
        heart(rowsOf('azul')[0])!.click();
        await settle();

        expect(api.envy).toHaveBeenCalledTimes(1);
        finish();
        await settle();
        // Une fois l'écriture finie, la garde est levée.
        heart(rowOf('Azul'))!.click();
        await settle();
        expect(api.unenvy.mock.calls.length + api.envy.mock.calls.length).toBe(2);
      });

      it('un refus (soirée close, nom parti) échoue en silence et la liste est relue', async () => {
        await setup(served([azul], 3));
        asParticipant();
        await settle();
        api.envy.mockRejectedValue(new HttpErrorResponse({ status: 400 }));

        heart(rowOf('Azul'))!.click();
        await settle();

        expect(api.boardGames).toHaveBeenCalledTimes(2);
        expect(heart(rowOf('Azul'))!.getAttribute('aria-pressed')).toBe('false');
        expect(el().querySelector('.egt__error')).toBeNull();
      });

      it('temps réel : un signal de la partie relit les Envies des autres', async () => {
        await setup(served([azul], 3));
        asParticipant();
        await settle();
        expect(count(rowOf('Azul'))).toBeNull();

        api.boardGames.mockResolvedValue(
          served([azul], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'], ['u-yan', 'Yan'])]),
        );
        changed.set(1);
        await settle();

        expect(count(rowOf('Azul'))!.textContent!.trim()).toBe('2');
      });
    });

    describe('la liste des noms', () => {
      const withEnvies = () =>
        served(
          [azul],
          3,
          [],
          [envyOf('azul', ['u-zoe', 'Zoé'], [ME, 'Moi-même'], ['u-yan', 'Yan'])],
        );

      it('le compte ouvre un dialogue nommé qui liste les noms affichés, « moi » pour moi, le focus dessus', async () => {
        await setup(withEnvies());
        asParticipant();
        await settle();

        count(rowOf('Azul'))!.click();
        await settle();

        expect(names()!.getAttribute('role')).toBe('dialog');
        expect(names()!.getAttribute('aria-label')).toBe('Noms pour Azul');
        expect(
          Array.from(names()!.querySelectorAll('li')).map((n) => n.textContent!.trim()),
        ).toEqual(['Zoé', 'moi', 'Yan']);
        expect(JSON.stringify(names()!.textContent)).not.toContain('@');
        expect(count(rowOf('Azul'))!.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(names());
      });

      it('Échap referme et rend le focus au compte', async () => {
        await setup(withEnvies());
        asParticipant();
        await settle();
        count(rowOf('Azul'))!.click();
        await settle();

        press('Escape');
        await settle();

        expect(names()).toBeNull();
        expect(document.activeElement).toBe(count(rowOf('Azul')));
        expect(count(rowOf('Azul'))!.getAttribute('aria-expanded')).toBe('false');
      });

      it('le fond referme et rend le focus au compte ; rien n’est écrit', async () => {
        await setup(withEnvies());
        asParticipant();
        await settle();
        count(rowOf('Azul'))!.click();
        await settle();

        document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
        await settle();

        expect(names()).toBeNull();
        expect(document.activeElement).toBe(count(rowOf('Azul')));
        expect(api.envy).not.toHaveBeenCalled();
        expect(api.unenvy).not.toHaveBeenCalled();
      });

      it('la liste suit la relecture, et se referme quand il n’y a plus d’Envie', async () => {
        await setup(withEnvies());
        asParticipant();
        await settle();
        count(rowOf('Azul'))!.click();
        await settle();

        api.boardGames.mockResolvedValue(served([azul], 3, [], [envyOf('azul', ['u-zoe', 'Zoé'])]));
        changed.set(1);
        await settle();
        expect(
          Array.from(names()!.querySelectorAll('li')).map((n) => n.textContent!.trim()),
        ).toEqual(['Zoé']);

        api.boardGames.mockResolvedValue(served([azul], 3));
        changed.set(2);
        await settle();
        expect(names()).toBeNull();
      });
    });

    describe('la liste des noms : fermeture pour de bon', () => {
      const zoe = envyOf('azul', ['u-zoe', 'Zoé']);

      it('la dernière Envie disparaît à la relecture : la liste se ferme, et une Envie ultérieure ne la rouvre pas', async () => {
        await setup(served([azul, brass], 3, [], [zoe]));
        asParticipant();
        await settle();
        count(rowOf('Azul'))!.click();
        await settle();
        expect(names()).not.toBeNull();

        api.boardGames.mockResolvedValue(served([azul, brass], 3));
        changed.set(1);
        await settle();
        expect(names()).toBeNull();

        api.boardGames.mockResolvedValue(served([azul, brass], 3, [], [zoe]));
        changed.set(2);
        await settle();

        expect(count(rowOf('Azul'))!.textContent!.trim()).toBe('1');
        expect(names()).toBeNull();
        expect(count(rowOf('Azul'))!.getAttribute('aria-expanded')).toBe('false');
      });

      it('la ligne qui porte le compte disparaît pendant que la liste est ouverte : elle se ferme, le focus va au ♥ du même nom s’il existe', async () => {
        await setup(served([azul, brass], 3, [bringOf('azul', 'yan')], [zoe]));
        asParticipant();
        await settle();
        count(rowsOf('Azul')[0])!.click();
        await settle();
        expect(names()).not.toBeNull();

        // Le jeu de l'hôte est écarté ; le même nom reste sur place par un apport.
        api.boardGames.mockResolvedValue(served([brass], 3, [bringOf('azul', 'yan')], [zoe]));
        changed.set(1);
        await settle();

        expect(names()).toBeNull();
        expect(document.activeElement).toBe(heart(rowsOf('azul')[0]));
      });

      it('plus aucune ligne de ce jeu : la liste se ferme et ne se rouvre pas quand le jeu revient', async () => {
        await setup(served([azul, brass], 3, [], [zoe]));
        asParticipant();
        await settle();
        count(rowOf('Azul'))!.click();
        await settle();

        api.boardGames.mockResolvedValue(served([brass], 3, [], [zoe]));
        changed.set(1);
        await settle();
        expect(names()).toBeNull();

        api.boardGames.mockResolvedValue(served([azul, brass], 3, [], [zoe]));
        changed.set(2);
        await settle();
        expect(names()).toBeNull();
      });
    });

    describe('la puce « Les plus appelées »', () => {
      const games = [azul, brass, codenames];
      const envies = [
        envyOf('brass', ['u-zoe', 'Zoé'], ['u-yan', 'Yan']),
        envyOf('codenames', ['u-zoe', 'Zoé']),
      ];

      it('absente sans jeu sur place', async () => {
        await setup(served([], 3));
        await settle();

        expect(el().querySelectorAll('.gsum__chip')).toHaveLength(0);
      });

      it('éteinte au départ (aria-pressed), allumée : chaque section par Envies décroissantes puis A→Z', async () => {
        await setup(
          served(
            games,
            3,
            [bringOf('Dixit'), bringOf('Skull')],
            [...envies, envyOf('skull', ['u-zoe', 'Zoé'], ['u-yan', 'Yan'], ['u-max', 'Max'])],
          ),
        );
        asParticipant();
        await settle();
        expect(sortChip().getAttribute('aria-pressed')).toBe('false');
        expect(rowNames()).toEqual(['Azul', 'Brass', 'Codenames', 'Dixit', 'Skull']);

        sortChip().click();
        await settle();

        expect(sortChip().getAttribute('aria-pressed')).toBe('true');
        expect(sortChip().querySelector('app-icon')?.getAttribute('data-icon')).toBe('effacer');
        // « Chez Léa » : Brass (2), Codenames (1), Azul (0) ; « Apportées » : Skull (3), Dixit (0).
        expect(rowNames()).toEqual(['Brass', 'Codenames', 'Azul', 'Skull', 'Dixit']);

        sortChip().click();
        await settle();
        expect(rowNames()).toEqual(['Azul', 'Brass', 'Codenames', 'Dixit', 'Skull']);
      });

      it('à nombre d’Envies égal : alphabétique', async () => {
        await setup(
          served(
            games,
            3,
            [],
            [envyOf('codenames', ['u-zoe', 'Zoé']), envyOf('brass', ['u-yan', 'Yan'])],
          ),
        );
        await settle();

        sortChip().click();
        await settle();

        expect(rowNames()).toEqual(['Brass', 'Codenames', 'Azul']);
      });

      it('cumulable avec « Jouables à N » ; les comptes « k sur n » ne suivent que le filtre', async () => {
        await setup(served(games, 4, [], envies));
        await settle();

        chip().click();
        await settle();
        const afterFit = Array.from(el().querySelectorAll('.gs__count')).map((n) =>
          n.textContent!.trim(),
        );
        expect(rowNames()).toEqual(['Azul', 'Brass']);
        expect(afterFit).toEqual(['· 2 sur 3']);

        sortChip().click();
        await settle();

        expect(rowNames()).toEqual(['Brass', 'Azul']);
        expect(
          Array.from(el().querySelectorAll('.gs__count')).map((n) => n.textContent!.trim()),
        ).toEqual(afterFit);
        expect(chip().getAttribute('aria-pressed')).toBe('true');
        expect(sortChip().getAttribute('aria-pressed')).toBe('true');
        expect(text()).toContain('3 jeux sur place · 2 jouables à 4');
      });

      it('« Dans mon … » garde son ordre alphabétique', async () => {
        await setup(served(games, 3, [], envies), 'grimoire-emeraude', [
          { ...game('Dixit', 2, 4), id: 'mine-Dixit' },
          { ...game('Everdell', 2, 4), id: 'mine-Everdell' },
        ]);
        asParticipant();
        await settle();

        sortChip().click();
        await settle();

        expect(rowNames()).toEqual(['Brass', 'Codenames', 'Azul', 'Dixit', 'Everdell']);
      });
    });
  });
});
