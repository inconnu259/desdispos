import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { BoardGameDto, UserLibraryDto } from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { LIBRARY_SHEET_SWIPE_CLOSE_PX, LibrarySheet } from './library-sheet';

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

const library = (games: BoardGameDto[]): UserLibraryDto => ({
  owner: { userId: 'u2', pseudo: 'zoe', displayName: 'Zoé' },
  games,
});

@Component({
  imports: [LibrarySheet],
  template: `<button #opener class="opener" type="button">Zoé</button>
    @if (open()) {
      <app-library-sheet
        [userId]="userId()"
        name="Zoé"
        [returnFocus]="opener"
        (closed)="onClosed()"
      />
    }`,
})
class Host {
  open = signal(true);
  userId = signal('u2');
  closedCount = 0;
  opener!: HTMLElement;
  onClosed(): void {
    this.closedCount++;
    this.open.set(false);
  }
}

describe('LibrarySheet (Story 48.3)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let svc: {
    listOf: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let activeTheme: ReturnType<typeof signal<Theme>>;

  const sheet = (): HTMLElement | null => document.body.querySelector('.library-sheet');
  /** Le texte de la feuille, sans le bouton « Fermer » (testé à part). */
  const text = (): string => {
    const clone = sheet()?.cloneNode(true) as HTMLElement | undefined;
    clone?.querySelector('.library-sheet__close')?.remove();
    return clone?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  };

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
    result: UserLibraryDto | Error | HttpErrorResponse = library([]),
  ): Promise<void> {
    const changed = signal(0);
    svc = {
      listOf:
        result instanceof Error || result instanceof HttpErrorResponse
          ? vi.fn().mockRejectedValue(result)
          : vi.fn().mockResolvedValue(result),
      changed,
    };
    activeTheme = signal<Theme>('grimoire-emeraude');
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: BoardGamesService, useValue: svc },
        {
          provide: ThemeToneService,
          useValue: { tone: () => TONE_MAP[activeTheme()], activeTheme },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    await settle();
    host.opener = (fixture.nativeElement as HTMLElement).querySelector('.opener') as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-library-sheet, app-host').forEach((n) => n.remove());
  });

  it('lit la Ludothèque de la personne et montre titre, ligne de prêt et jeux en lecture seule', async () => {
    await setup(
      library([
        game('Azul', 'azul', { minPlayers: 2, maxPlayers: 4, durationMin: 40 }),
        game('Skull', 'skull'),
      ]),
    );

    expect(svc.listOf).toHaveBeenCalledWith('u2');
    expect(text()).toContain('Cabinet de Zoé · 2');
    expect(text()).toContain('Pour emprunter un jeu, demandez-le à Zoé.');
    const rows = Array.from(document.body.querySelectorAll('.library-sheet__row')).map((r) =>
      Array.from(r.children).map((c) => c.textContent?.trim()),
    );
    expect(rows).toEqual([['Azul', '2–4 joueurs · 40 min'], ['Skull']]);
    // Aucune action d'écriture : pas de champ, et le bouton « Fermer » est le seul bouton.
    expect(sheet()?.querySelectorAll('input, textarea, select').length).toBe(0);
    const buttons = Array.from(sheet()?.querySelectorAll('button') ?? []);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Fermer']);
  });

  it.each([
    ['grimoire-emeraude', 'Cabinet de Zoé · 1', 'Pour emprunter un jeu, demandez-le à Zoé.'],
    ['foret-ancienne', 'Coffre de Zoé · 1', 'Pour emprunter un jeu, demande-le à Zoé.'],
    ['atelier-cuivre', 'Râtelier de Zoé · 1', 'Pour un prêt, adressez-vous à Zoé.'],
  ] as const)('%s : titre et ligne de prêt de la voix du thème', async (theme, title, loan) => {
    await setup(library([game('Azul', 'azul')]));
    activeTheme.set(theme);
    await settle();

    expect(text()).toContain(title);
    expect(text()).toContain(loan);
  });

  it.each([
    ['grimoire-emeraude', 'Le cabinet de Zoé est vide.'],
    ['foret-ancienne', 'Le coffre de Zoé est vide.'],
    ['atelier-cuivre', 'Le râtelier de Zoé est vide.'],
  ] as const)('%s : Ludothèque vide → la ligne du thème seule', async (theme, empty) => {
    await setup(library([]));
    activeTheme.set(theme);
    await settle();

    expect(text()).toBe(empty);
    expect(sheet()?.querySelector('h2')).toBeNull();
    expect(sheet()?.querySelector('.library-sheet__loan')).toBeNull();
  });

  it('nom accessible du dialogue : le titre une fois lu ; modal, focus piégé', async () => {
    await setup(library([game('Azul', 'azul')]));

    const panel = sheet() as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-label')).toBe('Cabinet de Zoé · 1');
    // `cdkTrapFocus` pose ses ancres de piège autour de la surface.
    expect(document.body.querySelectorAll('.cdk-focus-trap-anchor').length).toBeGreaterThan(0);
  });

  it('le tiroir est déplacé sous <body> (au-dessus de toute fenêtre d’hôte)', async () => {
    await setup(library([game('Azul', 'azul')]));

    expect(document.body.querySelector('app-library-sheet')?.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(sheet());
  });

  it('404 → le repli neutre, sans liste ni titre', async () => {
    await setup(new HttpErrorResponse({ status: 404 }));

    // Le nom accessible du dialogue est le repli, jamais l'invite d'un bouton.
    expect(sheet()?.getAttribute('aria-label')).toBe(
      TONE_MAP['grimoire-emeraude']['board_games.error_fallback'],
    );

    expect(text()).toBe(TONE_MAP['grimoire-emeraude']['board_games.error_fallback']);
    expect(sheet()?.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('se relit sur BoardGamesService.changed : un jeu ajouté apparaît sans fermer', async () => {
    await setup(library([game('Azul', 'azul')]));
    svc.listOf.mockResolvedValue(library([game('Azul', 'azul'), game('Skull', 'skull')]));

    svc.changed.update((v) => v + 1);
    await settle();

    expect(svc.listOf).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Cabinet de Zoé · 2');
    expect(text()).toContain('Skull');
    expect(host.closedCount).toBe(0);
  });

  it('une lecture dépassée par une plus récente est ignorée', async () => {
    await setup(library([game('Azul', 'azul')]));
    let resolveSlow!: (value: UserLibraryDto) => void;
    svc.listOf.mockReturnValueOnce(
      new Promise<UserLibraryDto>((resolve) => {
        resolveSlow = resolve;
      }),
    );
    svc.listOf.mockResolvedValueOnce(library([game('Skull', 'skull')]));

    svc.changed.update((v) => v + 1); // lecture lente
    await settle();
    svc.changed.update((v) => v + 1); // lecture rapide, plus récente
    await settle();
    resolveSlow(library([game('Vieux', 'vieux')]));
    await settle();

    expect(text()).toContain('Skull');
    expect(text()).not.toContain('Vieux');
  });

  it('une relecture ratée (hors 404) garde la liste déjà lue', async () => {
    await setup(library([game('Azul', 'azul')]));
    svc.listOf.mockRejectedValue(new HttpErrorResponse({ status: 500 }));

    svc.changed.update((v) => v + 1);
    await settle();

    expect(text()).toContain('Azul');
    expect(sheet()?.querySelector('[role="alert"]')).toBeNull();
  });

  it('un droit perdu pendant l’ouverture (404 à la relecture) remplace la liste par le repli', async () => {
    await setup(library([game('Azul', 'azul')]));
    svc.listOf.mockRejectedValue(new HttpErrorResponse({ status: 404 }));

    svc.changed.update((v) => v + 1);
    await settle();

    expect(text()).toBe(TONE_MAP['grimoire-emeraude']['board_games.error_fallback']);
  });

  describe('fermeture', () => {
    it('Échap ferme la feuille et ne parvient pas à la fenêtre d’hôte', async () => {
      await setup(library([game('Azul', 'azul')]));
      const reachedBody = vi.fn();
      document.body.addEventListener('keydown', reachedBody);
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
      } finally {
        document.body.removeEventListener('keydown', reachedBody);
      }

      expect(host.closedCount).toBe(1);
      expect(reachedBody).not.toHaveBeenCalled();
      expect(sheet()).toBeNull();
    });

    it('un Échap venu d’un élément de la feuille est arrêté lui aussi', async () => {
      await setup(library([game('Azul', 'azul')]));
      const reachedBody = vi.fn();
      document.body.addEventListener('keydown', reachedBody);
      try {
        (sheet() as HTMLElement).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        await settle();
      } finally {
        document.body.removeEventListener('keydown', reachedBody);
      }

      expect(host.closedCount).toBe(1);
      expect(reachedBody).not.toHaveBeenCalled();
    });

    it('le bouton « Fermer » (visible, 44 px, focalisable) ferme comme le voile et rend le focus au nom touché', async () => {
      await setup(library([game('Azul', 'azul')]));
      const close = document.body.querySelector('.library-sheet__close') as HTMLButtonElement;
      expect(close.textContent?.trim()).toBe('Fermer');
      expect(close.disabled).toBe(false);
      expect(close.tabIndex).toBeGreaterThanOrEqual(0);

      close.click();
      await settle();

      expect(host.closedCount).toBe(1);
      expect(sheet()).toBeNull();
      expect(document.activeElement).toBe(host.opener);
    });

    it('un pointeur posé sur « Fermer » n’arme pas le glissement (le clic lui parvient)', async () => {
      await setup(library([game('Azul', 'azul')]));
      const close = document.body.querySelector('.library-sheet__close') as HTMLButtonElement;

      close.dispatchEvent(
        new PointerEvent('pointerdown', { clientY: 100, pointerId: 1, bubbles: true }),
      );
      close.dispatchEvent(
        new PointerEvent('pointermove', { clientY: 400, pointerId: 1, bubbles: true }),
      );
      fixture.detectChanges();

      expect(sheet()?.style.transform).toBe('');
    });

    it('un clic sur le voile ferme', async () => {
      await setup(library([game('Azul', 'azul')]));

      (document.body.querySelector('.library-sheet-backdrop') as HTMLElement).click();
      await settle();

      expect(host.closedCount).toBe(1);
    });

    it('le focus est rendu à l’élément touché', async () => {
      await setup(library([game('Azul', 'azul')]));
      expect(document.activeElement).not.toBe(host.opener);

      host.open.set(false);
      await settle();

      expect(document.activeElement).toBe(host.opener);
    });

    it('une autre touche ne ferme rien', async () => {
      await setup(library([game('Azul', 'azul')]));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await settle();

      expect(host.closedCount).toBe(0);
    });
  });

  describe('glissement vers le bas sur la poignée ou le titre', () => {
    const pointer = (type: string, clientY: number, pointerId = 1): PointerEvent =>
      new PointerEvent(type, { clientY, pointerId, pointerType: 'touch', bubbles: true });

    async function swipe(distance: number): Promise<void> {
      const head = document.body.querySelector('.library-sheet__head') as HTMLElement;
      head.dispatchEvent(pointer('pointerdown', 100));
      head.dispatchEvent(pointer('pointermove', 100 + distance));
      fixture.detectChanges();
      head.dispatchEvent(pointer('pointerup', 100 + distance));
      await settle();
    }

    it('assez loin : ferme', async () => {
      await setup(library([game('Azul', 'azul')]));

      await swipe(LIBRARY_SHEET_SWIPE_CLOSE_PX + 10);

      expect(host.closedCount).toBe(1);
    });

    it('trop court : ne ferme pas et la feuille revient en place', async () => {
      await setup(library([game('Azul', 'azul')]));

      await swipe(LIBRARY_SHEET_SWIPE_CLOSE_PX - 20);

      expect(host.closedCount).toBe(0);
      expect(sheet()?.style.transform).toBe('');
    });

    it('vers le haut : ne ferme jamais', async () => {
      await setup(library([game('Azul', 'azul')]));

      await swipe(-200);

      expect(host.closedCount).toBe(0);
    });

    it('la feuille suit le doigt pendant le glissement', async () => {
      await setup(library([game('Azul', 'azul')]));
      const head = document.body.querySelector('.library-sheet__head') as HTMLElement;

      head.dispatchEvent(pointer('pointerdown', 100));
      head.dispatchEvent(pointer('pointermove', 130));
      fixture.detectChanges();

      expect(sheet()?.style.transform).toBe('translateY(30px)');
    });

    it('pointercancel annule le glissement', async () => {
      await setup(library([game('Azul', 'azul')]));
      const head = document.body.querySelector('.library-sheet__head') as HTMLElement;

      head.dispatchEvent(pointer('pointerdown', 100));
      head.dispatchEvent(pointer('pointermove', 300));
      head.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
      await settle();

      expect(host.closedCount).toBe(0);
      expect(sheet()?.style.transform).toBe('');
    });
  });
});
