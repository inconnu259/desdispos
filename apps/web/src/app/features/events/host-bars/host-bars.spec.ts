import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { HostCountDto, HostCountsDto } from '@master-jdr/shared';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { EventsApiService } from '../events-api.service';
import { HOST_BAR_MAX_PX, HostBars, hostBarWidth } from './host-bars';

const member = (
  userId: string,
  displayName: string,
  count: number,
  pseudo = userId,
): HostCountDto => ({
  userId,
  pseudo,
  displayName,
  count,
});

describe('hostBarWidth (Story 50.2)', () => {
  it('le plus grand compte fait 120 px, les autres au prorata, jamais nul pour un compte positif', () => {
    expect(hostBarWidth(4, 4)).toBe(HOST_BAR_MAX_PX);
    expect(hostBarWidth(2, 4)).toBe(60);
    expect(hostBarWidth(1, 4)).toBe(30);
    expect(hostBarWidth(1, 1000)).toBe(1);
  });

  it('un compte nul, ou aucun maximum : pas de barre', () => {
    expect(hostBarWidth(0, 4)).toBe(0);
    expect(hostBarWidth(3, 0)).toBe(0);
  });
});

describe('HostBars (Story 50.2)', () => {
  let fixture: ComponentFixture<HostBars>;
  let api: { hostCounts: ReturnType<typeof vi.fn> };
  let partiesChanged: ReturnType<typeof signal<number>>;
  let activeTheme: ReturnType<typeof signal<Theme>>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => (el().textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows = () =>
    Array.from(el().querySelectorAll('.hb__row')).map((r) => ({
      name: r.querySelector('.hb__name')?.textContent?.trim(),
      count: r.querySelector('.hb__count')?.textContent?.trim(),
      width: (r.querySelector('.hb__bar') as HTMLElement).style.width,
    }));

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
    result: HostCountsDto | Error | HttpErrorResponse = { members: [] },
  ): Promise<void> {
    api = {
      hostCounts:
        result instanceof Error || result instanceof HttpErrorResponse
          ? vi.fn().mockRejectedValue(result)
          : vi.fn().mockResolvedValue(result),
    };
    partiesChanged = signal(0);
    activeTheme = signal<Theme>('grimoire-emeraude');
    await TestBed.configureTestingModule({
      imports: [HostBars],
      providers: [
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: { changed: partiesChanged } },
        {
          provide: ThemeToneService,
          useValue: { tone: () => TONE_MAP[activeTheme()], activeTheme },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostBars);
    fixture.componentRef.setInput('partieId', 'p1');
    await settle();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('liste les membres qui ont reçu, du plus au moins, avec leur compte écrit et une barre proportionnelle', async () => {
    await setup({
      members: [member('u1', 'Léa', 4), member('u2', 'Tom', 1), member('u3', 'Zoé', 0)],
    });

    expect(api.hostCounts).toHaveBeenCalledWith('p1');
    expect(rows()).toEqual([
      { name: 'Léa', count: '4 fois', width: '100%' },
      { name: 'Tom', count: '1 fois', width: '25%' },
    ]);
    expect(el().querySelector('.hb__track')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('puis « Jamais : {noms} » pour ceux qui n’ont jamais reçu', async () => {
    await setup({
      members: [member('u1', 'Léa', 2), member('u2', 'Tom', 0), member('u3', 'Zoé', 0)],
    });

    expect(el().querySelector('.hb__never')?.textContent?.trim()).toBe('Jamais : Tom, Zoé');
  });

  it('personne n’a reçu : « Jamais » seul, aucune barre', async () => {
    await setup({ members: [member('u1', 'Léa', 0), member('u2', 'Tom', 0)] });

    expect(el().querySelector('.hb__list')).toBeNull();
    expect(el().querySelector('.hb__never')?.textContent?.trim()).toBe('Jamais : Léa, Tom');
  });

  it('tout le monde a reçu : aucune ligne « Jamais »', async () => {
    await setup({ members: [member('u1', 'Léa', 2), member('u2', 'Tom', 1)] });

    expect(el().querySelector('.hb__never')).toBeNull();
  });

  it('deux homonymes sont départagés par leur pseudo', async () => {
    await setup({
      members: [member('u1', 'Zoé', 2, 'zoe'), member('u2', 'Zoé', 0, 'zoe2')],
    });

    expect(rows()[0].name).toBe('Zoé (zoe)');
    expect(el().querySelector('.hb__never')?.textContent?.trim()).toBe('Jamais : Zoé (zoe2)');
  });

  it.each([
    ['grimoire-emeraude', 'Qui ouvre sa porte'],
    ['foret-ancienne', 'Qui accueille le cercle'],
    ['atelier-cuivre', "Qui accueille l'équipage"],
  ] as const)('%s : le titre de la section est de la voix du thème', async (theme, title) => {
    await setup({ members: [member('u1', 'Léa', 1)] });
    activeTheme.set(theme);
    await settle();

    expect(el().querySelector('.hb__title')?.textContent?.trim()).toBe(title);
  });

  it('section repliable, ouverte au départ, au clavier : un `<details>` avec son résumé', async () => {
    await setup({ members: [member('u1', 'Léa', 1)] });

    const details = el().querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(details.querySelector('summary')?.querySelector('h3')).not.toBeNull();
  });

  it('se relit sur le signal temps réel : une conjonction annulée met le compte à jour', async () => {
    await setup({ members: [member('u1', 'Léa', 2)] });
    expect(rows()[0].count).toBe('2 fois');

    api.hostCounts.mockResolvedValue({ members: [member('u1', 'Léa', 1)] });
    partiesChanged.update((v) => v + 1);
    await settle();

    expect(api.hostCounts).toHaveBeenCalledTimes(2);
    expect(rows()[0].count).toBe('1 fois');
  });

  it('une lecture dépassée par une plus récente est ignorée', async () => {
    await setup({ members: [member('u1', 'Léa', 2)] });
    let resolveOld: (v: HostCountsDto) => void = () => undefined;
    api.hostCounts.mockReturnValueOnce(
      new Promise<HostCountsDto>((resolve) => {
        resolveOld = resolve;
      }),
    );
    partiesChanged.update((v) => v + 1);
    await settle();
    api.hostCounts.mockResolvedValueOnce({ members: [member('u1', 'Léa', 5)] });
    partiesChanged.update((v) => v + 1);
    await settle();
    expect(rows()[0].count).toBe('5 fois');

    resolveOld({ members: [member('u1', 'Léa', 2)] });
    await settle();

    expect(rows()[0].count).toBe('5 fois');
  });

  it('changement de groupe : les hôtes du précédent ne survivent pas à la lecture du suivant', async () => {
    await setup({ members: [member('u1', 'Léa', 2)] });
    let resolveNext: (v: HostCountsDto) => void = () => undefined;
    api.hostCounts.mockReturnValueOnce(
      new Promise<HostCountsDto>((resolve) => {
        resolveNext = resolve;
      }),
    );

    fixture.componentRef.setInput('partieId', 'p2');
    await settle();

    expect(api.hostCounts).toHaveBeenLastCalledWith('p2');
    expect(el().querySelector('details')).toBeNull();

    resolveNext({ members: [member('u9', 'Zoé', 1)] });
    await settle();

    expect(rows().map((r) => r.name)).toEqual(['Zoé']);
  });

  it('première lecture en échec : le repli neutre ; une panne ensuite garde la liste lue', async () => {
    await setup(new HttpErrorResponse({ status: 500 }));
    expect(text()).toContain("La requête n'a pas abouti.");
    expect(el().querySelector('details')).toBeNull();

    TestBed.resetTestingModule();
    await setup({ members: [member('u1', 'Léa', 2)] });
    api.hostCounts.mockRejectedValue(new HttpErrorResponse({ status: 500 }));
    partiesChanged.update((v) => v + 1);
    await settle();

    expect(rows()[0].count).toBe('2 fois');
  });
});
