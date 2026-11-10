import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { GroupBoardGameDto, GroupBoardGamesDto } from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { GroupGamesTab } from './group-games-tab';

const LEA = { userId: 'u1', pseudo: 'lea', displayName: 'Léa' };
const ZOE = { userId: 'u2', pseudo: 'zoe', displayName: 'Zoé' };
const TOM = { userId: 'u3', pseudo: 'tom', displayName: 'Tom' };

function game(
  name: string,
  nameKey: string,
  owners: GroupBoardGameDto['owners'],
  overrides: Partial<GroupBoardGameDto> = {},
): GroupBoardGameDto {
  return {
    nameKey,
    name,
    minPlayers: null,
    maxPlayers: null,
    durationMin: null,
    owners,
    ...overrides,
  };
}

const AZUL = game('Azul', 'azul', [LEA, ZOE], { minPlayers: 2, maxPlayers: 4, durationMin: 40 });
const SKULL = game('Skull', 'skull', [TOM], { minPlayers: 3, maxPlayers: 10 });
const CARTES = game('Cartes', 'cartes', [ZOE]);

describe('GroupGamesTab (Story 50.1)', () => {
  let fixture: ComponentFixture<GroupGamesTab>;
  let svc: {
    listOfGroup: ReturnType<typeof vi.fn>;
    listOf: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let activeTheme: ReturnType<typeof signal<Theme>>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => (el().textContent ?? '').replace(/\s+/g, ' ').trim();
  const rowNames = (): string[] =>
    Array.from(el().querySelectorAll('.ggt__name')).map((n) => n.textContent?.trim() ?? '');
  const chip = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.ggt__chip')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;

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
    result: GroupBoardGamesDto | Error | HttpErrorResponse = { games: [AZUL, CARTES, SKULL] },
    currentUserId: string | null = null,
  ): Promise<void> {
    const changed = signal(0);
    svc = {
      listOfGroup:
        result instanceof Error || result instanceof HttpErrorResponse
          ? vi.fn().mockRejectedValue(result)
          : vi.fn().mockResolvedValue(result),
      listOf: vi.fn().mockResolvedValue({ owner: ZOE, games: [] }),
      changed,
    };
    activeTheme = signal<Theme>('grimoire-emeraude');
    await TestBed.configureTestingModule({
      imports: [GroupGamesTab],
      providers: [
        { provide: BoardGamesService, useValue: svc },
        {
          provide: ThemeToneService,
          useValue: { tone: () => TONE_MAP[activeTheme()], activeTheme },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GroupGamesTab);
    fixture.componentRef.setInput('partieId', 'p1');
    fixture.componentRef.setInput('currentUserId', currentUserId);
    await settle();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-library-sheet').forEach((n) => n.remove());
  });

  it('lit les jeux du groupe, une ligne par jeu avec ses mesures et ses propriétaires', async () => {
    await setup();

    expect(svc.listOfGroup).toHaveBeenCalledWith('p1');
    expect(rowNames()).toEqual(['Azul', 'Cartes', 'Skull']);
    const rows = Array.from(el().querySelectorAll('.ggt__row')).map((r) => ({
      name: r.querySelector('.ggt__name')?.textContent?.trim(),
      measures: r.querySelector('.ggt__measures')?.textContent?.trim() ?? null,
      owners: Array.from(r.querySelectorAll('.ggt__owner')).map((o) => o.textContent?.trim()),
      prefix: r.querySelector('.ggt__owners')?.firstChild?.textContent?.trim(),
    }));
    expect(rows[0]).toEqual({
      name: 'Azul',
      measures: '2–4 joueurs · 40 min',
      owners: ['Léa', 'Zoé'],
      prefix: 'chez',
    });
    expect(rows[1]).toEqual({ name: 'Cartes', measures: null, owners: ['Zoé'], prefix: 'chez' });
    // Lecture seule : ni champ d'écriture (hors recherche), ni autre action que les noms et les puces.
    expect(el().querySelectorAll('input:not([type="search"]), textarea, select').length).toBe(0);
  });

  it('pied « {n} jeux chez {m} membres », accordé, d’après ce qui est listé', async () => {
    await setup();

    expect(el().querySelector('.ggt__footer')?.textContent?.trim()).toBe('3 jeux chez 3 membres');
    expect(el().querySelector('.ggt__footer')?.getAttribute('aria-live')).toBe('polite');
  });

  it('pied au singulier : « 1 jeu chez 1 membre »', async () => {
    await setup({ games: [SKULL] });

    expect(el().querySelector('.ggt__footer')?.textContent?.trim()).toBe('1 jeu chez 1 membre');
  });

  it('la personne connectée figure en « moi », sans bouton ; les autres noms sont des boutons', async () => {
    await setup({ games: [AZUL] }, 'u1');

    expect(el().querySelector('.ggt__me')?.textContent?.trim()).toBe('moi');
    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('.ggt__owner'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Zoé']);
    expect(buttons[0].getAttribute('aria-label')).toBe('Voir le cabinet de Zoé');
  });

  it('aucun jeu ne correspond : la ligne dédiée seule, sans pied « 0 jeu chez 0 membre »', async () => {
    await setup();

    chip('8+').click();
    await settle();
    const input = el().querySelector<HTMLInputElement>('.ggt__search') as HTMLInputElement;
    input.value = 'introuvable';
    input.dispatchEvent(new Event('input'));
    await settle();

    expect(text()).toContain('Aucun jeu ne correspond.');
    expect(el().querySelector('.ggt__footer')).toBeNull();
  });

  it('changement de groupe : les jeux, la recherche et la puce du précédent ne survivent pas', async () => {
    await setup();
    chip('4').click();
    await settle();
    expect(rowNames()).toEqual(['Azul', 'Skull']);

    let resolveNext: (v: GroupBoardGamesDto) => void = () => undefined;
    svc.listOfGroup.mockReturnValueOnce(
      new Promise<GroupBoardGamesDto>((resolve) => {
        resolveNext = resolve;
      }),
    );
    fixture.componentRef.setInput('partieId', 'p2');
    await settle();

    expect(rowNames()).toEqual([]);
    expect(el().querySelector('.ggt__chip')).toBeNull();

    resolveNext({ games: [AZUL, SKULL] });
    await settle();

    expect(rowNames()).toEqual(['Azul', 'Skull']);
    expect(chip('4').getAttribute('aria-pressed')).toBe('false');
  });

  it('accès perdu pendant que la feuille d’un co-membre est ouverte : la feuille se ferme', async () => {
    await setup({ games: [AZUL] }, 'u1');
    document.body.appendChild(el());
    (el().querySelector('.ggt__owner') as HTMLButtonElement).click();
    await settle();
    expect(document.body.querySelector('.library-sheet')).not.toBeNull();

    svc.listOfGroup.mockRejectedValue(new HttpErrorResponse({ status: 403 }));
    svc.changed.update((v) => v + 1);
    await settle();

    expect(document.body.querySelector('.library-sheet')).toBeNull();
  });

  it('deux homonymes sont départagés par leur pseudo', async () => {
    const other = { userId: 'u9', pseudo: 'zoe2', displayName: 'Zoé' };
    await setup({ games: [AZUL, game('Cartes', 'cartes', [other])] });

    const labels = Array.from(el().querySelectorAll('.ggt__owner')).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toContain('Zoé (zoe)');
    expect(labels).toContain('Zoé (zoe2)');
  });

  it('recherche : casse et accents ignorés, le pied suit', async () => {
    await setup();
    const input = el().querySelector<HTMLInputElement>('.ggt__search') as HTMLInputElement;

    input.value = 'SKU';
    input.dispatchEvent(new Event('input'));
    await settle();

    expect(rowNames()).toEqual(['Skull']);
    expect(el().querySelector('.ggt__footer')?.textContent?.trim()).toBe('1 jeu chez 1 membre');
  });

  it('puces : une seule active, re-toucher l’éteint, `aria-pressed` dit l’état', async () => {
    await setup();
    expect(
      Array.from(el().querySelectorAll('.ggt__chip')).map((b) => b.textContent?.trim()),
    ).toEqual(['2', '4', '6', '8+']);

    chip('4').click();
    await settle();
    expect(chip('4').getAttribute('aria-pressed')).toBe('true');
    // Story 51.7 : seule la puce active porte l'icône « effacer ».
    expect(chip('4').querySelector('app-icon[data-icon="effacer"]')).not.toBeNull();
    for (const other of ['2', '6', '8+']) expect(chip(other).querySelector('app-icon')).toBeNull();
    expect(rowNames()).toEqual(['Azul', 'Skull']);

    chip('8+').click();
    await settle();
    expect(chip('4').getAttribute('aria-pressed')).toBe('false');
    expect(chip('8+').getAttribute('aria-pressed')).toBe('true');
    expect(rowNames()).toEqual(['Skull']);

    chip('8+').click();
    await settle();
    expect(chip('8+').getAttribute('aria-pressed')).toBe('false');
    expect(rowNames()).toEqual(['Azul', 'Cartes', 'Skull']);
  });

  it('un jeu sans nombre de joueurs n’est retenu par aucune puce', async () => {
    await setup({ games: [CARTES] });

    for (const label of ['2', '4', '6', '8+']) {
      chip(label).click();
      await settle();
      expect(rowNames(), label).toEqual([]);
      expect(text()).toContain('Aucun jeu ne correspond.');
    }
  });

  it('nom accessible d’une puce : « Jouable à {n} »', async () => {
    await setup();

    expect(chip('4').getAttribute('aria-label')).toBe('Jouable à 4');
    expect(chip('8+').getAttribute('aria-label')).toBe('Jouable à 8+');
  });

  it.each([
    ['grimoire-emeraude', "Personne n'a encore rempli son cabinet."],
    ['foret-ancienne', "Personne n'a encore rempli son coffre."],
    ['atelier-cuivre', "Personne n'a encore garni son râtelier."],
  ] as const)('%s : groupe sans jeu → la ligne du thème seule', async (theme, empty) => {
    await setup({ games: [] });
    activeTheme.set(theme);
    await settle();

    expect(text()).toBe(empty);
    expect(el().querySelector('.ggt__search')).toBeNull();
  });

  it('se relit sur le signal temps réel : un membre parti disparaît sans recharger', async () => {
    await setup({ games: [AZUL, SKULL] });
    expect(rowNames()).toEqual(['Azul', 'Skull']);

    svc.listOfGroup.mockResolvedValue({ games: [AZUL] });
    svc.changed.update((v) => v + 1);
    await settle();

    expect(svc.listOfGroup).toHaveBeenCalledTimes(2);
    expect(rowNames()).toEqual(['Azul']);
  });

  it('une lecture dépassée par une plus récente est ignorée', async () => {
    await setup({ games: [AZUL] });
    let resolveOld: (v: GroupBoardGamesDto) => void = () => undefined;
    svc.listOfGroup.mockReturnValueOnce(
      new Promise<GroupBoardGamesDto>((resolve) => {
        resolveOld = resolve;
      }),
    );
    svc.changed.update((v) => v + 1);
    await settle();
    svc.listOfGroup.mockResolvedValueOnce({ games: [SKULL] });
    svc.changed.update((v) => v + 1);
    await settle();
    expect(rowNames()).toEqual(['Skull']);

    resolveOld({ games: [AZUL] });
    await settle();

    expect(rowNames()).toEqual(['Skull']);
  });

  it.each([403, 404])('accès perdu (%s) : le repli neutre, plus aucun jeu', async (status) => {
    await setup({ games: [AZUL] });

    svc.listOfGroup.mockRejectedValue(new HttpErrorResponse({ status }));
    svc.changed.update((v) => v + 1);
    await settle();

    expect(rowNames()).toEqual([]);
    expect(text()).toContain("La requête n'a pas abouti.");
  });

  it('une autre panne garde la liste déjà lue ; à la première lecture, le repli neutre', async () => {
    await setup({ games: [AZUL] });
    svc.listOfGroup.mockRejectedValue(new HttpErrorResponse({ status: 500 }));
    svc.changed.update((v) => v + 1);
    await settle();
    expect(rowNames()).toEqual(['Azul']);

    TestBed.resetTestingModule();
    await setup(new HttpErrorResponse({ status: 500 }));
    expect(text()).toContain("La requête n'a pas abouti.");
  });

  it('toucher un propriétaire ouvre sa feuille de Ludothèque ; fermer rend le focus au nom touché', async () => {
    await setup({ games: [AZUL] }, 'u1');
    const owner = el().querySelector<HTMLButtonElement>('.ggt__owner') as HTMLButtonElement;
    document.body.appendChild(el());

    owner.click();
    await settle();

    expect(svc.listOf).toHaveBeenCalledWith('u2');
    const sheet = document.body.querySelector('.library-sheet');
    expect(sheet?.getAttribute('aria-label')).toContain('Zoé');

    document.body.querySelector<HTMLButtonElement>('.library-sheet__close')?.click();
    await settle();

    expect(document.body.querySelector('.library-sheet')).toBeNull();
    expect(document.activeElement).toBe(owner);
  });
});
