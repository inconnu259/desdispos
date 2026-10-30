import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { BoardGameDto, EventBoardGamesDto, EventCardDto } from '@master-jdr/shared';
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

const served = (games: BoardGameDto[], participantsCount: number): EventBoardGamesDto => ({
  games,
  participantsCount,
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

describe('EventGamesTab (Story 49.1)', () => {
  let changed: ReturnType<typeof signal<number>>;
  let api: { boardGames: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
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
  ): Promise<void> {
    activeTheme = signal(theme);
    changed = signal(0);
    api = {
      boardGames:
        result instanceof Error
          ? vi.fn().mockRejectedValue(result)
          : vi.fn().mockResolvedValue(result),
      list: vi.fn().mockResolvedValue([card()]),
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: { changed } },
        { provide: ThemeToneService, useValue: { tone: () => TONE_MAP[activeTheme()] } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  }

  beforeEach(() => localStorage.removeItem(LS_KEY));
  afterEach(() => {
    localStorage.removeItem(LS_KEY);
    TestBed.resetTestingModule();
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
      expect(chip().getAttribute('aria-pressed')).toBe('false');
      expect(rowNames()).toHaveLength(3);

      chip().click();
      await settle();
      expect(chip().getAttribute('aria-pressed')).toBe('true');
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
});
