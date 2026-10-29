import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { AuthUser, BoardGameDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { formatBoardGameCount, formatBoardGameMeasures } from '../board-game-measures';
import { BoardGamesPage } from './board-games-page';

function game(name: string, nameKey: string, overrides: Partial<BoardGameDto> = {}): BoardGameDto {
  return {
    id: `id-${nameKey}`,
    name,
    nameKey,
    minPlayers: null,
    maxPlayers: null,
    durationMin: null,
    createdAt: '2026-10-29T10:00:00.000Z',
    ...overrides,
  };
}

const TONE = TONE_MAP['grimoire-emeraude'];

describe('formatBoardGameMeasures (Story 48.1)', () => {
  const m = (minPlayers: number | null, maxPlayers: number | null, durationMin: number | null) =>
    formatBoardGameMeasures({ minPlayers, maxPlayers, durationMin }, TONE);

  it('« {min}–{max} joueurs · {d} min »', () => {
    expect(m(2, 4, 40)).toBe('2–4 joueurs · 40 min');
  });

  it('min = max : « {n} joueur(s) »', () => {
    expect(m(2, 2, null)).toBe('2 joueurs');
    expect(m(1, 1, null)).toBe('1 joueur');
  });

  it('min seul : « {min}+ joueurs » ; max seul : « jusqu’à {max} joueurs »', () => {
    expect(m(3, null, null)).toBe('3+ joueurs');
    expect(m(null, 6, 30)).toBe("jusqu'à 6 joueurs · 30 min");
  });

  it('durée seule, puis rien du tout', () => {
    expect(m(null, null, 15)).toBe('15 min');
    expect(m(null, null, null)).toBe('');
  });

  it('décompte : « {n} jeu » (n ≤ 1), « {n} jeux »', () => {
    expect(formatBoardGameCount(0, TONE)).toBe('0 jeu');
    expect(formatBoardGameCount(1, TONE)).toBe('1 jeu');
    expect(formatBoardGameCount(2, TONE)).toBe('2 jeux');
  });
});

describe('BoardGamesPage (Story 48.1)', () => {
  let fixture: ComponentFixture<BoardGamesPage>;
  let el: HTMLElement;
  let svc: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
    notifyChanged: () => void;
  };
  let realtime: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let nav: ContextualNavService;
  let activeTheme: ReturnType<typeof signal<Theme>>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(initial: BoardGameDto[] | Error = []): Promise<void> {
    const changed = signal(0);
    svc = {
      list:
        initial instanceof Error
          ? vi.fn().mockRejectedValueOnce(initial)
          : vi.fn().mockResolvedValue(initial),
      create: vi.fn(),
      changed,
      notifyChanged: () => changed.update((v) => v + 1),
    };
    realtime = { connect: vi.fn(), disconnect: vi.fn() };
    activeTheme = signal<Theme>('grimoire-emeraude');
    const tone = () => TONE_MAP[activeTheme()];
    await TestBed.configureTestingModule({
      imports: [BoardGamesPage],
      providers: [
        provideRouter([]),
        { provide: BoardGamesService, useValue: svc },
        { provide: RealtimeService, useValue: realtime },
        {
          provide: AuthService,
          useValue: { currentUser: signal<Partial<AuthUser> | null>({ id: 'u1' }) },
        },
        { provide: ThemeToneService, useValue: { tone, activeTheme } },
      ],
    }).compileComponents();
    nav = TestBed.inject(ContextualNavService);
    fixture = TestBed.createComponent(BoardGamesPage);
    el = fixture.nativeElement as HTMLElement;
    await settle();
  }

  const input = (name: string) => el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const button = () => el.querySelector<HTMLButtonElement>('.quick-add__submit')!;
  const names = () =>
    Array.from(el.querySelectorAll('.board-games-list__name')).map((n) => n.textContent?.trim());

  function type(name: string, value: string): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** `Entrée` dans un champ : l'envoi implicite du navigateur déclenche `submit` sur le formulaire. */
  async function pressEnter(): Promise<void> {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  it('bandeau : titre du thème et sous-titre de visibilité, qui suivent un changement de thème', async () => {
    await setup();

    expect(nav.title()).toBe('Mon cabinet de reliques');
    expect(nav.subtitle()).toBe(TONE['board_games.visibility']);

    activeTheme.set('foret-ancienne');
    await settle();
    expect(nav.title()).toBe('Mon coffre aux trésors');
  });

  it('vide : la saisie seule, sans liste ni texte d’incitation', async () => {
    await setup([]);

    expect(el.querySelector('.quick-add')).not.toBeNull();
    expect(el.querySelector('.board-games-list')).toBeNull();
    const outside = Array.from(el.querySelector('.board-games-page')!.children).filter(
      (c) => !c.classList.contains('quick-add'),
    );
    expect(outside).toHaveLength(0);
    expect(el.querySelector('.quick-add__hint')?.textContent?.trim()).toBe(
      'Seul le nom est obligatoire.',
    );
  });

  it('liste : une ligne par jeu, dans l’ordre servi, avec ses mesures', async () => {
    await setup([
      game('Azul', 'azul', { minPlayers: 2, maxPlayers: 4, durationMin: 40 }),
      game('Skull', 'skull'),
    ]);

    expect(names()).toEqual(['Azul', 'Skull']);
    const rows = el.querySelectorAll('.board-games-list__row');
    expect(rows[0].querySelector('.board-games-list__measures')?.textContent?.trim()).toBe(
      '2–4 joueurs · 40 min',
    );
    expect(rows[1].querySelector('.board-games-list__measures')).toBeNull();
  });

  it('nom vide ou blanc : bouton inactif, rien n’est envoyé', async () => {
    await setup();

    expect(button().disabled).toBe(true);
    type('name', '   ');
    expect(button().disabled).toBe(true);
    await pressEnter();
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('`Entrée` ajoute : le jeu prend sa place alphabétique, les champs se vident, le focus revient au nom', async () => {
    await setup([game('Azul', 'azul'), game('zèbre', 'zebre')]);
    svc.create.mockResolvedValue(
      game('éclipse', 'eclipse', { minPlayers: 2, maxPlayers: 4, durationMin: 60 }),
    );

    type('name', ' éclipse ');
    type('minPlayers', '2');
    type('maxPlayers', '4');
    type('durationMin', '60');
    input('durationMin').focus();
    await pressEnter();

    expect(svc.create).toHaveBeenCalledWith({
      name: 'éclipse',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 60,
    });
    expect(names()).toEqual(['Azul', 'éclipse', 'zèbre']);
    for (const name of ['name', 'minPlayers', 'maxPlayers', 'durationMin']) {
      expect(input(name).value, name).toBe('');
    }
    expect(document.activeElement).toBe(input('name'));
  });

  it('nom seul : les nombres partent à `null`', async () => {
    await setup();
    svc.create.mockResolvedValue(game('Skull', 'skull'));

    type('name', 'Skull');
    await pressEnter();

    expect(svc.create).toHaveBeenCalledWith({
      name: 'Skull',
      minPlayers: null,
      maxPlayers: null,
      durationMin: null,
    });
  });

  it('max < min : message sous le champ relié par `aria-describedby`, envoi bloqué', async () => {
    await setup();

    type('name', 'Azul');
    type('minPlayers', '3');
    type('maxPlayers', '2');

    const message = el.querySelector('#quick-add-max-below-min');
    expect(message?.textContent?.trim()).toBe(TONE['board_games.max_below_min']);
    expect(input('maxPlayers').getAttribute('aria-describedby')).toBe('quick-add-max-below-min');
    expect(input('maxPlayers').getAttribute('aria-invalid')).toBe('true');
    expect(button().disabled).toBe(true);
    await pressEnter();
    expect(svc.create).not.toHaveBeenCalled();

    type('maxPlayers', '3');
    expect(el.querySelector('#quick-add-max-below-min')).toBeNull();
    expect(input('maxPlayers').getAttribute('aria-describedby')).toBeNull();
    expect(button().disabled).toBe(false);
  });

  it('doublon (409) : message du thème sous la saisie, champs conservés', async () => {
    await setup([game('Azul', 'azul')]);
    svc.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'Ce jeu est déjà dans votre Ludothèque' },
      }),
    );

    type('name', '  ÀZUL ');
    type('minPlayers', '2');
    await pressEnter();

    expect(el.querySelector('.quick-add [role="alert"]')?.textContent?.trim()).toBe(
      'Ce jeu est déjà dans votre cabinet.',
    );
    expect(input('name').value).toBe('  ÀZUL ');
    expect(input('minPlayers').value).toBe('2');
    expect(names()).toEqual(['Azul']);

    // Toucher un champ retire le refus précédent.
    type('name', 'Azul 2');
    expect(el.querySelector('.quick-add [role="alert"]')).toBeNull();
  });

  it('première lecture ratée puis ajout réussi : toute la liste est relue, plus seulement le nouveau jeu', async () => {
    await setup(new Error('panne'));
    expect(el.querySelector('.board-games-page__message')?.textContent?.trim()).toBe(
      TONE['board_games.error_fallback'],
    );
    svc.create.mockResolvedValue(game('Skull', 'skull'));
    svc.list.mockResolvedValue([game('Azul', 'azul'), game('Skull', 'skull')]);

    type('name', 'Skull');
    await pressEnter();

    expect(svc.list).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(['Azul', 'Skull']);
    expect(el.querySelector('.board-games-page__message')).toBeNull();
  });

  it('autre refus : le message du serveur (premier de la validation), sinon le repli neutre', async () => {
    await setup();
    svc.create.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: { message: ['Le nombre minimum de joueurs doit être un entier'] },
      }),
    );
    type('name', 'Azul');
    await pressEnter();
    expect(el.querySelector('.quick-add [role="alert"]')?.textContent?.trim()).toBe(
      'Le nombre minimum de joueurs doit être un entier',
    );

    svc.create.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await pressEnter();
    expect(el.querySelector('.quick-add [role="alert"]')?.textContent?.trim()).toBe(
      TONE['board_games.error_fallback'],
    );
    expect(input('name').value).toBe('Azul');
  });

  it('temps réel : ouvre `user:{moi}` et le referme à la destruction', async () => {
    await setup();

    expect(realtime.connect).toHaveBeenCalledWith('user:u1');
    fixture.destroy();
    expect(realtime.disconnect).toHaveBeenCalledWith('user:u1');
  });

  it('temps réel : relit la liste sur `changed` (le premier passage est sauté)', async () => {
    await setup([game('Azul', 'azul')]);
    expect(svc.list).toHaveBeenCalledTimes(1);

    svc.list.mockResolvedValue([game('Azul', 'azul'), game('Skull', 'skull')]);
    svc.notifyChanged();
    await settle();

    expect(svc.list).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(['Azul', 'Skull']);
  });

  it('une lecture dépassée par une plus récente n’écrase pas la liste', async () => {
    await setup([]);
    let resolveOld!: (games: BoardGameDto[]) => void;
    svc.list.mockReturnValueOnce(new Promise<BoardGameDto[]>((r) => (resolveOld = r)));
    svc.notifyChanged();
    await settle();

    svc.list.mockResolvedValueOnce([game('Skull', 'skull')]);
    svc.notifyChanged();
    await settle();
    expect(names()).toEqual(['Skull']);

    resolveOld([game('Ancien', 'ancien')]);
    await settle();
    expect(names()).toEqual(['Skull']);
  });
});
