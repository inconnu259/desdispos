import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { AuthUser, BoardGameDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { EventsApiService } from '../../events/events-api.service';
import { formatBoardGameCount, formatBoardGameMeasures } from '../board-game-measures';
import { BOARD_GAME_UNDO_DELAY_MS, BoardGamesPage } from './board-games-page';

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
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
    notifyChanged: () => void;
  };
  let realtime: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let eventsApi: { broughtCount: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
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
      update: vi.fn(),
      remove: vi.fn(),
      changed,
      notifyChanged: () => changed.update((v) => v + 1),
    };
    realtime = { connect: vi.fn(), disconnect: vi.fn() };
    // Story 49.2 : aucun apport par défaut — le retrait reste immédiat, sans fenêtre.
    eventsApi = { broughtCount: vi.fn().mockResolvedValue({ count: 0 }) };
    dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) };
    activeTheme = signal<Theme>('grimoire-emeraude');
    const tone = () => TONE_MAP[activeTheme()];
    await TestBed.configureTestingModule({
      imports: [BoardGamesPage],
      providers: [
        provideRouter([]),
        { provide: BoardGamesService, useValue: svc },
        { provide: RealtimeService, useValue: realtime },
        { provide: EventsApiService, useValue: eventsApi },
        { provide: MatDialog, useValue: dialog },
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
    // Seule la ligne d'état du retrait (Story 48.2) l'accompagne : vide et masquée au repos.
    const outside = Array.from(el.querySelector('.board-games-page')!.children).filter(
      (c) => !c.classList.contains('quick-add'),
    );
    expect(outside.map((c) => c.className)).toEqual([
      'board-games-page__status board-games-page__status--idle',
    ]);
    expect(outside[0].textContent?.trim()).toBe('');
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

  // ─── Story 48.2 : corriger ou retirer un jeu ───────────────────────────────

  describe('corriger ou retirer un jeu (Story 48.2)', () => {
    const AZUL = game('Azul', 'azul', { minPlayers: 2, maxPlayers: 4, durationMin: 40 });
    const SKULL = game('Skull', 'skull');

    const editRow = () => el.querySelector<HTMLElement>('.board-games-list__row--editing');
    const editInput = (name: string) =>
      editRow()!.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    const editButton = (gameName: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="Modifier ${gameName}"]`);
    const buttonByText = (root: Element, text: string) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === text,
      );
    const status = () => el.querySelector<HTMLElement>('.board-games-page__status')!;
    const undoButton = () => status().querySelector<HTMLButtonElement>('button');

    function typeEdit(name: string, value: string): void {
      const field = editInput(name);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    async function openEdit(gameName: string): Promise<void> {
      editButton(gameName)!.click();
      await settle();
    }

    async function saveWithEnter(): Promise<void> {
      editRow()!
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    }

    async function clickRemove(): Promise<void> {
      buttonByText(editRow()!, 'Retirer de mon cabinet')!.click();
      await settle();
    }

    it('✎ par ligne : bouton nommé « Modifier {nom} » ; il ouvre la même saisie, préremplie, avec « Enregistrer », « Renoncer » et le retrait du thème', async () => {
      await setup([AZUL, SKULL]);

      expect(editButton('Azul')?.getAttribute('type')).toBe('button');
      expect(editButton('Azul')?.querySelector('app-icon[data-icon="modifier"]')).not.toBeNull();
      expect(editButton('Skull')).not.toBeNull();
      await openEdit('Azul');

      const row = editRow()!;
      expect(row).not.toBeNull();
      expect(editInput('name').value).toBe('Azul');
      expect(editInput('minPlayers').value).toBe('2');
      expect(editInput('maxPlayers').value).toBe('4');
      expect(editInput('durationMin').value).toBe('40');
      expect(buttonByText(row, 'Enregistrer')?.type).toBe('submit');
      expect(buttonByText(row, 'Renoncer')).toBeDefined();
      expect(buttonByText(row, 'Retirer de mon cabinet')).toBeDefined();
      // Le ✎ de la ligne en correction laisse la place à la saisie, le focus va au nom.
      expect(editButton('Azul')).toBeNull();
      expect(document.activeElement).toBe(editInput('name'));
      expect(names()).toEqual(['Skull']);
    });

    it('retrait du thème : coffre (forêt), râtelier (atelier) ; abandon du thème', async () => {
      await setup([AZUL]);
      activeTheme.set('foret-ancienne');
      await openEdit('Azul');
      expect(buttonByText(editRow()!, 'Retirer de mon coffre')).toBeDefined();
      expect(buttonByText(editRow()!, 'Abandonner')).toBeDefined();

      activeTheme.set('atelier-cuivre');
      await settle();
      expect(buttonByText(editRow()!, 'Retirer de mon râtelier')).toBeDefined();
      expect(buttonByText(editRow()!, 'Annuler')).toBeDefined();
    });

    it('une seule ligne en correction à la fois', async () => {
      await setup([AZUL, SKULL]);
      await openEdit('Azul');
      await openEdit('Skull');

      expect(el.querySelectorAll('.board-games-list__row--editing')).toHaveLength(1);
      expect(editInput('name').value).toBe('Skull');
      expect(names()).toEqual(['Azul']);
    });

    it('`Entrée` enregistre : corps de la correction, liste retriée, saisie fermée, focus rendu au ✎', async () => {
      await setup([AZUL, SKULL]);
      svc.update.mockResolvedValue(
        game('Zoo', 'zoo', { id: AZUL.id, minPlayers: 2, maxPlayers: 4, durationMin: null }),
      );
      await openEdit('Azul');

      typeEdit('name', ' Zoo ');
      typeEdit('durationMin', '');
      await saveWithEnter();

      expect(svc.update).toHaveBeenCalledWith(AZUL.id, {
        name: 'Zoo',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: null,
      });
      expect(editRow()).toBeNull();
      expect(names()).toEqual(['Skull', 'Zoo']);
      expect(document.activeElement).toBe(editButton('Zoo'));
    });

    it('max < min : message sous le champ de la correction (`aria-describedby`), enregistrement bloqué', async () => {
      await setup([AZUL]);
      await openEdit('Azul');

      typeEdit('minPlayers', '5');

      const message = editRow()!.querySelector('#board-game-edit-max-below-min');
      expect(message?.textContent?.trim()).toBe(TONE['board_games.max_below_min']);
      expect(editInput('maxPlayers').getAttribute('aria-describedby')).toBe(
        'board-game-edit-max-below-min',
      );
      expect(buttonByText(editRow()!, 'Enregistrer')!.disabled).toBe(true);
      await saveWithEnter();
      expect(svc.update).not.toHaveBeenCalled();
      // L'ajout en tête garde ses propres identifiants.
      expect(el.querySelector('#quick-add-max-below-min')).toBeNull();
    });

    it('doublon (409) : message du thème sous la correction, champs conservés', async () => {
      await setup([AZUL, SKULL]);
      svc.update.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
      await openEdit('Skull');

      typeEdit('name', 'azul');
      await saveWithEnter();

      expect(editRow()!.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        'Ce jeu est déjà dans votre cabinet.',
      );
      expect(editInput('name').value).toBe('azul');
      // L'erreur ne déborde pas sur la saisie d'ajout.
      expect(el.querySelector('.quick-add--add [role="alert"]')).toBeNull();
    });

    it('autre refus (400) : le message du serveur sous la correction', async () => {
      await setup([AZUL]);
      svc.update.mockRejectedValue(
        new HttpErrorResponse({
          status: 400,
          error: {
            message: 'Le nombre maximum de joueurs doit être supérieur ou égal au nombre minimum',
          },
        }),
      );
      await openEdit('Azul');
      await saveWithEnter();

      expect(editRow()!.querySelector('[role="alert"]')?.textContent?.trim()).toMatch(
        /maximum de joueurs/,
      );
    });

    it('« Renoncer » ou `Échap` : ferme sans enregistrer, focus rendu au ✎', async () => {
      await setup([AZUL]);
      await openEdit('Azul');
      typeEdit('name', 'Autre chose');

      buttonByText(editRow()!, 'Renoncer')!.click();
      await settle();
      expect(editRow()).toBeNull();
      expect(svc.update).not.toHaveBeenCalled();
      expect(names()).toEqual(['Azul']);
      expect(document.activeElement).toBe(editButton('Azul'));

      await openEdit('Azul');
      editInput('name').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();
      expect(editRow()).toBeNull();
      expect(svc.update).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(editButton('Azul'));
    });

    it('correction en 404 (retiré ailleurs) : la liste est relue et la saisie se ferme', async () => {
      await setup([AZUL, SKULL]);
      svc.update.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
      svc.list.mockResolvedValue([SKULL]);
      await openEdit('Azul');
      await saveWithEnter();

      expect(svc.list).toHaveBeenCalledTimes(2);
      expect(editRow()).toBeNull();
      expect(names()).toEqual(['Skull']);
    });

    it('relecture sur `changed` pendant une correction : les valeurs saisies restent', async () => {
      await setup([AZUL, SKULL]);
      await openEdit('Azul');
      typeEdit('name', 'Azul en cours');
      typeEdit('durationMin', '55');

      svc.list.mockResolvedValue([
        { ...AZUL, durationMin: 30 },
        SKULL,
        game('Bohnanza', 'bohnanza'),
      ]);
      svc.notifyChanged();
      await settle();

      expect(names()).toEqual(['Skull', 'Bohnanza']);
      expect(editInput('name').value).toBe('Azul en cours');
      expect(editInput('durationMin').value).toBe('55');
    });

    it('relecture sur `changed` : le jeu corrigé a disparu → la saisie se ferme', async () => {
      await setup([AZUL, SKULL]);
      await openEdit('Azul');

      svc.list.mockResolvedValue([SKULL]);
      svc.notifyChanged();
      await settle();

      expect(editRow()).toBeNull();
      expect(names()).toEqual(['Skull']);
      expect(document.activeElement).toBe(input('name'));
    });

    it('« Retirer » : DELETE aussitôt, la ligne disparaît, « Jeu retiré · Annuler » poli entre la saisie et la liste, focus sur « Annuler »', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockResolvedValue(undefined);
      await openEdit('Azul');

      await clickRemove();

      expect(svc.remove).toHaveBeenCalledWith(AZUL.id);
      expect(names()).toEqual(['Skull']);
      expect(editRow()).toBeNull();
      expect(status().getAttribute('aria-live')).toBe('polite');
      expect(status().getAttribute('role')).toBe('status');
      expect(status().classList).not.toContain('board-games-page__status--idle');
      // L'espacement autour de « · » vient de la mise en page (gap), pas du texte.
      expect(status().textContent?.trim()).toMatch(/^Jeu retiré\s*·\s*Annuler$/);
      expect(undoButton()?.getAttribute('type')).toBe('button');
      expect(document.activeElement).toBe(undoButton());
      // Dans le flux : juste après la saisie, avant la liste.
      expect(status().previousElementSibling?.classList).toContain('quick-add');
      expect(status().nextElementSibling?.classList).toContain('board-games-list');
    });

    it('« Annuler » recrée le jeu avec le même nom, les mêmes joueurs et la même durée', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockResolvedValue(undefined);
      svc.create.mockResolvedValue({ ...AZUL, id: 'g-nouveau' });
      await openEdit('Azul');
      await clickRemove();

      undoButton()!.click();
      await settle();

      expect(svc.create).toHaveBeenCalledWith({
        name: 'Azul',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 40,
      });
      expect(names()).toEqual(['Azul', 'Skull']);
      expect(status().textContent?.trim()).toBe('');
      // Le message s'achève avec le focus dedans : il revient au champ du nom.
      expect(document.activeElement).toBe(input('name'));
    });

    it('« Annuler » refusé (409) : le message du thème dans la ligne d’état', async () => {
      await setup([AZUL]);
      svc.remove.mockResolvedValue(undefined);
      svc.create.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
      await openEdit('Azul');
      await clickRemove();

      // Le refus relance le minuteur : le message s'efface à son tour au bout de 8 s.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        undoButton()!.click();
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
          fixture.detectChanges();
        }

        expect(status().textContent?.trim()).toBe('Ce jeu est déjà dans votre cabinet.');
        expect(undoButton()).toBeNull();
        expect(document.activeElement).toBe(input('name'));

        vi.advanceTimersByTime(BOARD_GAME_UNDO_DELAY_MS);
        fixture.detectChanges();
        expect(status().textContent?.trim()).toBe('');
        expect(status().classList).toContain('board-games-page__status--idle');
      } finally {
        vi.useRealTimers();
      }
    });

    it('le message s’efface au bout de 8 s ; le focus qui y était revient au champ du nom', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockResolvedValue(undefined);
      await openEdit('Azul');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        buttonByText(editRow()!, 'Retirer de mon cabinet')!.click();
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
          fixture.detectChanges();
        }
        expect(status().textContent).toContain('Jeu retiré');
        undoButton()!.focus();

        vi.advanceTimersByTime(BOARD_GAME_UNDO_DELAY_MS - 1);
        fixture.detectChanges();
        expect(status().textContent).toContain('Jeu retiré');

        vi.advanceTimersByTime(1);
        fixture.detectChanges();
        expect(status().textContent?.trim()).toBe('');
        expect(status().classList).toContain('board-games-page__status--idle');
        expect(document.activeElement).toBe(input('name'));
      } finally {
        vi.useRealTimers();
      }
    });

    it('« Annuler » aboutit alors qu’un retrait plus récent a remplacé le message : le jeu recréé s’affiche, le nouveau message reste', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockResolvedValue(undefined);
      let resolveCreate!: (g: BoardGameDto) => void;
      svc.create.mockReturnValue(new Promise<BoardGameDto>((r) => (resolveCreate = r)));
      await openEdit('Azul');
      await clickRemove();

      // « Annuler » part, puis un autre jeu est retiré avant la réponse.
      undoButton()!.click();
      await settle();
      await openEdit('Skull');
      await clickRemove();
      expect(names()).toEqual([]);

      resolveCreate({ ...AZUL, id: 'g-nouveau' });
      await settle();

      expect(names()).toEqual(['Azul']);
      // Le message du retrait de Skull est intact : « Annuler » y est toujours proposé.
      expect(status().textContent).toContain('Jeu retiré');
      expect(undoButton()).not.toBeNull();
    });

    it('envoi en vol : ouvrir une autre ligne ou « Renoncer » ne change rien', async () => {
      await setup([AZUL, SKULL]);
      let resolveUpdate!: (g: BoardGameDto) => void;
      svc.update.mockReturnValue(new Promise<BoardGameDto>((r) => (resolveUpdate = r)));
      await openEdit('Azul');
      typeEdit('name', 'Azul 2');
      await saveWithEnter();
      expect(svc.update).toHaveBeenCalledTimes(1);

      // Autre ✎ : la saisie de Azul reste ouverte, avec ce qui a été saisi.
      editButton('Skull')!.click();
      await settle();
      expect(el.querySelectorAll('.board-games-list__row--editing')).toHaveLength(1);
      expect(editInput('name').value).toBe('Azul 2');
      expect(names()).toEqual(['Skull']);

      // « Renoncer » et `Échap` ne ferment pas : l'écriture aboutirait quand même.
      buttonByText(editRow()!, 'Renoncer')!.click();
      await settle();
      expect(editRow()).not.toBeNull();
      editInput('name').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();
      expect(editRow()).not.toBeNull();

      resolveUpdate(game('Azul 2', 'azul 2', { id: AZUL.id }));
      await settle();
      expect(editRow()).toBeNull();
      expect(names()).toEqual(['Azul 2', 'Skull']);
    });

    it('retrait refusé (500) : la ligne reste, la saisie reste ouverte, erreur sous la saisie, aucun « Jeu retiré »', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockRejectedValue(
        new HttpErrorResponse({ status: 500, error: { message: 'Panne du serveur' } }),
      );
      await openEdit('Azul');
      await clickRemove();

      expect(editRow()).not.toBeNull();
      expect(editInput('name').value).toBe('Azul');
      expect(editRow()!.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        'Panne du serveur',
      );
      expect(names()).toEqual(['Skull']);
      expect(status().textContent?.trim()).toBe('');
      expect(status().textContent).not.toContain('Jeu retiré');
      expect(status().classList).toContain('board-games-page__status--idle');
      // Le bouton est de nouveau disponible.
      expect(buttonByText(editRow()!, 'Retirer de mon cabinet')!.disabled).toBe(false);
    });

    it('retrait en 404 (déjà retiré ailleurs) : la liste est relue, la saisie se ferme, aucun « Jeu retiré »', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
      svc.list.mockResolvedValue([SKULL]);
      await openEdit('Azul');
      await clickRemove();

      expect(svc.list).toHaveBeenCalledTimes(2);
      expect(editRow()).toBeNull();
      expect(names()).toEqual(['Skull']);
      expect(status().textContent?.trim()).toBe('');
    });

    describe('jeu apporté à des soirées à venir (Story 49.2)', () => {
      it('aucun apport : le compte est lu au clic, aucune fenêtre, le retrait part aussitôt', async () => {
        await setup([AZUL, SKULL]);
        svc.remove.mockResolvedValue(undefined);
        await openEdit('Azul');

        await clickRemove();

        expect(eventsApi.broughtCount).toHaveBeenCalledWith(AZUL.id);
        expect(dialog.open).not.toHaveBeenCalled();
        expect(svc.remove).toHaveBeenCalledWith(AZUL.id);
        expect(names()).toEqual(['Skull']);
      });

      it('le compte n’est pas lu au chargement de la liste, seulement au clic « Retirer »', async () => {
        await setup([AZUL, SKULL]);
        await openEdit('Azul');

        expect(eventsApi.broughtCount).not.toHaveBeenCalled();
      });

      it('2 soirées : la confirmation le dit AVANT le retrait ; confirmée, le jeu est retiré', async () => {
        await setup([AZUL, SKULL]);
        eventsApi.broughtCount.mockResolvedValue({ count: 2 });
        svc.remove.mockResolvedValue(undefined);
        await openEdit('Azul');

        await clickRemove();

        expect(dialog.open).toHaveBeenCalledTimes(1);
        const data = dialog.open.mock.calls[0][1].data as { message: string; confirmLabel: string };
        expect(data.message).toBe('Ce jeu est apporté à 2 soirées à venir : il en sera retiré.');
        expect(data.confirmLabel).toBe('Retirer de mon cabinet');
        expect(
          (dialog.open.mock.calls[0][1].data as { destructive?: true }).destructive,
        ).toBeUndefined();
        expect(svc.remove).toHaveBeenCalledWith(AZUL.id);
        expect(names()).toEqual(['Skull']);
        expect(status().textContent).toContain('Jeu retiré');
      });

      it('1 soirée : « à 1 soirée à venir » (singulier)', async () => {
        await setup([AZUL]);
        eventsApi.broughtCount.mockResolvedValue({ count: 1 });
        svc.remove.mockResolvedValue(undefined);
        await openEdit('Azul');

        await clickRemove();

        expect((dialog.open.mock.calls[0][1].data as { message: string }).message).toBe(
          'Ce jeu est apporté à 1 soirée à venir : il en sera retiré.',
        );
      });

      it('« Renoncer » dans la fenêtre : rien n’est retiré, la saisie reste ouverte, le bouton est de nouveau disponible', async () => {
        await setup([AZUL, SKULL]);
        eventsApi.broughtCount.mockResolvedValue({ count: 3 });
        dialog.open.mockReturnValue({ afterClosed: () => of(false) });
        await openEdit('Azul');

        await clickRemove();

        expect(svc.remove).not.toHaveBeenCalled();
        expect(names()).toEqual(['Skull']);
        expect(editRow()).not.toBeNull();
        expect(status().textContent?.trim()).toBe('');
        expect(buttonByText(editRow()!, 'Retirer de mon cabinet')!.disabled).toBe(false);
      });

      it('un compte en échec : l’erreur du thème sous la saisie, rien n’est retiré, aucune fenêtre', async () => {
        await setup([AZUL, SKULL]);
        eventsApi.broughtCount.mockRejectedValue(new HttpErrorResponse({ status: 500 }));
        await openEdit('Azul');

        await clickRemove();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(svc.remove).not.toHaveBeenCalled();
        expect(editRow()).not.toBeNull();
        expect(editRow()!.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
          TONE['board_games.error_fallback'],
        );
        expect(buttonByText(editRow()!, 'Retirer de mon cabinet')!.disabled).toBe(false);
      });

      it('jeu déjà retiré ailleurs (compte en 404) : la liste est relue, la saisie se ferme, aucune fenêtre', async () => {
        await setup([AZUL, SKULL]);
        eventsApi.broughtCount.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
        svc.list.mockResolvedValue([SKULL]);
        await openEdit('Azul');

        await clickRemove();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(svc.remove).not.toHaveBeenCalled();
        expect(svc.list).toHaveBeenCalledTimes(2);
        expect(editRow()).toBeNull();
        expect(names()).toEqual(['Skull']);
      });
    });

    it('un nouveau retrait remplace le message en attente', async () => {
      await setup([AZUL, SKULL]);
      svc.remove.mockResolvedValue(undefined);
      svc.create.mockResolvedValue({ ...SKULL, id: 'g-nouveau' });
      await openEdit('Azul');
      await clickRemove();
      await openEdit('Skull');
      await clickRemove();

      expect(names()).toEqual([]);
      expect(status().querySelectorAll('button')).toHaveLength(1);
      undoButton()!.click();
      await settle();
      expect(svc.create).toHaveBeenCalledTimes(1);
      expect(svc.create).toHaveBeenCalledWith({
        name: 'Skull',
        minPlayers: null,
        maxPlayers: null,
        durationMin: null,
      });
    });
  });
});
