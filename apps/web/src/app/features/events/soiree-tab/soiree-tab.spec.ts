import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { EventCardDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { ConjonctionDraftService } from '../conjonction-draft.service';
import { EventsApiService } from '../events-api.service';
import { SoireeTab } from './soiree-tab';

const TONE = TONE_MAP['grimoire-emeraude'];

const card = (id: string, title: string): EventCardDto => ({
  id,
  title,
  hostId: 'host',
  hostDisplayName: 'Léa',
  seance: {
    endDate: null,
    endSlot: null,
    durationSlots: 1,
    id: `s-${id}`,
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
});

@Component({
  imports: [SoireeTab],
  template: `<app-soiree-tab [partieId]="partieId()" />`,
})
class Host {
  partieId = signal('p1');
}

describe('SoireeTab — détail en ligne de l’unique événement (Story 41.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount(list: ReturnType<typeof vi.fn>) {
    const changed = signal(0);
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideNoopAnimations(),
        { provide: EventsApiService, useValue: { list } },
        { provide: PartiesService, useValue: { changed, members: vi.fn() } },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'host' }) } },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };
    fixture.detectChanges();
    await settle();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, changed, settle };
  }

  it('lit la liste de la partie et rend le premier (et seul) événement en ligne', async () => {
    const list = vi.fn().mockResolvedValue([card('e1', 'Soirée jeux')]);
    const { el } = await mount(list);
    expect(list).toHaveBeenCalledWith('p1');
    expect(el.querySelector('.ed--inline .ed__title')?.textContent?.trim()).toBe('Soirée jeux');
  });

  it('une liste vide ne rend rien et n’écrit aucune erreur', async () => {
    const { el } = await mount(vi.fn().mockResolvedValue([]));
    expect(el.querySelector('app-event-dialog')).toBeNull();
    expect(el.querySelector('.soiree__error')).toBeNull();
  });

  it('un échec au premier chargement écrit l’erreur et ne rend aucun détail', async () => {
    const { el } = await mount(vi.fn().mockRejectedValue(new Error('réseau')));
    expect(el.querySelector('.soiree__error')?.textContent).toContain(
      TONE['partie.ralliement_event_list_error'],
    );
    expect(el.querySelector('app-event-dialog')).toBeNull();
  });

  it('un signal temps réel relit la liste', async () => {
    const list = vi.fn().mockResolvedValue([card('e1', 'Avant')]);
    const { el, changed, settle } = await mount(list);
    list.mockResolvedValue([card('e1', 'Après')]);
    changed.update((v) => v + 1);
    await settle();
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Après');
  });

  it('une réponse périmée n’écrase pas une réponse plus récente', async () => {
    let resolveSlow!: (value: EventCardDto[]) => void;
    const slow = new Promise<EventCardDto[]>((resolve) => (resolveSlow = resolve));
    const list = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockResolvedValue([card('e2', 'Récent')]);
    const { el, changed, settle } = await mount(list);
    changed.update((v) => v + 1);
    await settle();
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Récent');

    resolveSlow([card('e1', 'Périmé')]);
    await settle();
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Récent');
  });

  it('relit quand la partie affichée change', async () => {
    const list = vi.fn().mockResolvedValue([card('e1', 'Une')]);
    const { fixture, settle } = await mount(list);
    fixture.componentInstance.partieId.set('p2');
    await settle();
    expect(list).toHaveBeenLastCalledWith('p2');
  });
});

// ─── Poser la rencontre dès la création de la soirée (Story 41.2) ──────────────────────────

describe('SoireeTab — fenêtre de conjonction et actions de l’hôte (Story 41.2)', () => {
  const PLAIN: EventCardDto = card('e1', 'Marathon Pandémie');

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
    history.replaceState(null, '');
  });

  async function mount(
    list: ReturnType<typeof vi.fn>,
    extra: { update?: ReturnType<typeof vi.fn> } = {},
  ) {
    const changed = signal(0);
    const api = { list, update: extra.update ?? vi.fn().mockResolvedValue(PLAIN) };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: { changed, members: vi.fn().mockResolvedValue([]) } },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'host' }) } },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
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
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };
    fixture.detectChanges();
    await settle();
    const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel);
    return { fixture, settle, q, api };
  }

  it('sans marqueur de création, aucune fenêtre ne s’ouvre', async () => {
    const { q } = await mount(vi.fn().mockResolvedValue([PLAIN]));
    expect(q('app-event-create')).toBeNull();
  });

  it('juste après la création de la soirée : la fenêtre s’ouvre une fois, pré-remplie du nom, et consomme le marqueur', async () => {
    history.replaceState({ soireeCreation: true }, '');
    const { q } = await mount(vi.fn().mockResolvedValue([PLAIN]));

    expect(q('app-event-create')).not.toBeNull();
    expect(q<HTMLInputElement>('.ec__name')!.value).toBe('Marathon Pandémie');
    // Participation en lecture seule : ni bascule, ni places, ni réservations.
    expect(q('.ec__participation-readonly')).not.toBeNull();
    expect(q('.ec__participation')).toBeNull();
    expect(q('.ec__reserve')).toBeNull();
    // Le marqueur est consommé : un rechargement ne rouvre pas la fenêtre.
    expect((history.state as Record<string, unknown>)['soireeCreation']).toBe(false);
  });

  it('valider complète l’événement existant (modification, jamais une création), puis referme et relit', async () => {
    history.replaceState({ soireeCreation: true }, '');
    const day = new Date();
    day.setDate(day.getDate() + 3);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const completed = card('e1', 'Marathon Pandémie');
    completed.seance!.date = key;
    completed.seance!.slot = 'EVENING';
    const update = vi.fn().mockResolvedValue(completed);
    const list = vi.fn().mockResolvedValue([PLAIN]);
    const { q, settle } = await mount(list, { update });

    const day$ = q<HTMLInputElement>('.ec__day')!;
    day$.value = key;
    day$.dispatchEvent(new Event('input'));
    await settle();
    q<HTMLButtonElement>('.ec__submit')!.click();
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'p1',
      'e1',
      expect.objectContaining({
        title: 'Marathon Pandémie',
        date: key,
        slot: 'EVENING',
        capacity: null,
      }),
    );
    expect(q('app-event-create')).toBeNull();
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('« Renoncer » referme la fenêtre sans rien écrire ; l’événement reste « Date à fixer » et « Modifier » la rouvre', async () => {
    history.replaceState({ soireeCreation: true }, '');
    const { q, settle, api } = await mount(vi.fn().mockResolvedValue([PLAIN]));

    q<HTMLButtonElement>('.ec__cancel')!.click();
    await settle();
    expect(q('app-event-create')).toBeNull();
    expect(api.update).not.toHaveBeenCalled();
    expect(q('.ed__big--date')?.textContent?.trim()).toBe(TONE['partie.ralliement_event_no_date']);

    q<HTMLButtonElement>('.ed__edit')!.click();
    await settle();
    expect(q('app-event-create')).not.toBeNull();
  });

  it('retour du calendrier du groupe : la fenêtre se rouvre avec le brouillon (créneaux compris)', async () => {
    const drafts = new ConjonctionDraftService();
    drafts.beginCompose({
      partieId: 'p1',
      title: 'Marathon Pandémie',
      pollOptions: [{ date: '2099-12-20', slot: 'EVENING' }],
      pollDeadline: '2099-12-10',
      lieu: 'Chez Léa',
      heureRdv: '',
      notePratique: '',
      participation: 'all',
      places: 4,
      reserved: [],
    });
    drafts.finishCompose('p1', [
      { date: '2099-12-20', slot: 'EVENING' },
      { date: '2099-12-21', slot: 'MORNING' },
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: ConjonctionDraftService, useValue: drafts }],
    });
    const { q } = await mount(vi.fn().mockResolvedValue([PLAIN]));

    expect(q('app-event-create')).not.toBeNull();
    expect(q<HTMLInputElement>('.ec__place')!.value).toBe('Chez Léa');
    expect(document.body.querySelectorAll('.ec__chip--slot').length).toBe(2);
  });
});
