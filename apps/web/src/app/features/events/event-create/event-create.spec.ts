import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { EventCardDto, PartieMemberDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { EventsApiService } from '../events-api.service';
import { EventCreate } from './event-create';

const TONE = TONE_MAP['grimoire-emeraude'];

@Component({
  imports: [EventCreate],
  template: `<app-event-create
    partieId="g1"
    (created)="created.set($event)"
    (closed)="closedCount = closedCount + 1"
  />`,
})
class Host {
  created = signal<EventCardDto | null>(null);
  closedCount = 0;
}

/** Clé de jour locale décalée de `days` jours (borne `min` du champ de date). */
function dayKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CARD: EventCardDto = {
  id: 'e1',
  title: 'Catane',
  hostId: 'u1',
  hostDisplayName: 'Léa',
  seance: null,
  participants: [],
  myInscription: null,
  cancelled: false,
  can: { propose: false, edit: false, choose: false, extend: false },
  poll: null,
};

const member = (userId: string, displayName: string): PartieMemberDto => ({
  userId,
  pseudo: displayName.toLowerCase(),
  displayName,
  role: 'MEMBER',
  joinedAt: '2026-01-01T00:00:00.000Z',
});
/** L'hôte (u1) figure parmi les membres du groupe : il ne doit jamais être proposé. */
const MEMBERS = [member('u1', 'Léa'), member('u2', 'Zoé'), member('u3', 'Sam'), member('u4', 'Max')];

describe('EventCreate — fenêtre de création d’une conjonction (Story 40.1)', () => {
  let api: { create: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let parties: { members: ReturnType<typeof vi.fn> };

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
  });

  async function mount(members: PartieMemberDto[] | Error = MEMBERS) {
    api = { create: vi.fn().mockResolvedValue(CARD), list: vi.fn() };
    parties = {
      members:
        members instanceof Error
          ? vi.fn().mockRejectedValue(members)
          : vi.fn().mockResolvedValue(members),
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideNoopAnimations(),
        { provide: EventsApiService, useValue: api },
        { provide: PartiesService, useValue: parties },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
        {
          provide: BreakpointObserver,
          useValue: { isMatched: () => true, observe: () => of({ matches: true, breakpoints: {} }) },
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
    const type = async (sel: string, value: string) => {
      const input = q<HTMLInputElement | HTMLTextAreaElement>(sel)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    const click = async (sel: string) => {
      q<HTMLElement>(sel)!.click();
      await settle();
    };
    const toggle = async (group: string, label: string) => {
      const buttons = Array.from(
        document.body.querySelectorAll<HTMLButtonElement>(`${group} button`),
      );
      buttons.find((b) => (b.textContent ?? '').trim() === label)!.click();
      await settle();
    };
    return { fixture, q, type, click, toggle, settle };
  }

  it('ordre du contrat : nom → date (fixée | sondage) → jour + créneau → lieu → heure → infos → participation ; fenêtre LARGE', async () => {
    const { q } = await mount();
    const panel = q('.detail-surface-panel')!;
    expect(panel.classList).toContain('detail-surface-panel--wide');
    expect(panel.getAttribute('aria-label')).toBe(TONE['partie.ralliement_event_create_title']);

    const order = ['.ec__name', '.ec__date-mode', '.ec__day', '.ec__slot', '.ec__place', '.ec__time', '.ec__note', '.ec__participation'];
    const nodes = order.map((sel) => q(sel)!);
    for (let i = 1; i < nodes.length; i++) {
      expect(
        nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        order[i],
      ).toBeTruthy();
    }
    expect(q<HTMLInputElement>('.ec__time')!.type).toBe('time');
    expect(q<HTMLInputElement>('.ec__day')!.type).toBe('date');
    const poll = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ec__date-mode button')).find(
      (b) => (b.textContent ?? '').trim() === TONE['partie.ralliement_event_date_poll'],
    )!;
    // Story 40.5 : le sondage de dates est offert à la création.
    expect(poll.disabled).toBe(false);
    // Le créneau ne propose jamais « Journée ».
    const slots = Array.from(document.body.querySelectorAll('.ec__slot button')).map((b) =>
      (b.textContent ?? '').trim(),
    );
    expect(slots).toEqual(['Matin', 'Après-midi', 'Soir']);
  });

  it('« Créer » reste désactivé tant que le nom et le jour manquent', async () => {
    const { q, type } = await mount();
    const submit = () => q<HTMLButtonElement>('.ec__submit')!;
    expect(submit().disabled).toBe(true);
    await type('.ec__name', '   ');
    await type('.ec__day', dayKey(2));
    expect(submit().disabled).toBe(true);
    await type('.ec__name', 'Catane');
    expect(submit().disabled).toBe(false);
  });

  it('envoie une conjonction à date fixée, « tous les membres » par défaut, champs vides → null ; émet la carte créée', async () => {
    const { fixture, q, type, click, toggle } = await mount();
    await type('.ec__name', '  Catane et galettes ');
    await type('.ec__day', dayKey(3));
    await toggle('.ec__slot', 'Matin');
    await type('.ec__place', '  ');
    await type('.ec__time', '20:30');
    await click('.ec__submit');

    expect(api.create).toHaveBeenCalledWith('g1', {
      title: 'Catane et galettes',
      date: dayKey(3),
      slot: 'MORNING',
      lieu: null,
      heureRdv: '20:30',
      notePratique: null,
      capacity: null,
      durationSlots: 1,
    });
    expect(fixture.componentInstance.created()).toEqual(CARD);
    expect(q('.ec__error')).toBeNull();
  });

  it('places limitées : compteur à 4 par défaut, jamais sous 2, sans plafond ; rappel de la place de l’hôte', async () => {
    const { q, type, click, toggle } = await mount();
    await type('.ec__name', 'Huit');
    await type('.ec__day', dayKey(1));
    expect(q('.ec__places')).toBeNull();
    await toggle('.ec__participation', TONE['partie.ralliement_event_participation_limited']);

    const count = () => q<HTMLInputElement>('.ec__places-count')!.value;
    expect(count()).toBe('4');
    expect(q('.ec__places-hint')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_places_hint'],
    );
    for (let i = 0; i < 5; i++) await click('.ec__step--less');
    expect(count()).toBe('2');
    expect(q<HTMLButtonElement>('.ec__step--less')!.disabled).toBe(true);
    for (let i = 0; i < 6; i++) await click('.ec__step--more');
    expect(count()).toBe('8');
    await click('.ec__submit');
    expect(api.create.mock.calls[0][1]).toEqual(expect.objectContaining({ capacity: 8 }));
  });

  it.each(['1', '0', '2.5', 'abc', ''])(
    'saisie invalide « %s » dans le compteur : le champ réaffiche la valeur retenue, qui sera envoyée',
    async (saisie) => {
      const { q, type, click, toggle, settle } = await mount();
      await type('.ec__name', 'Compteur');
      await type('.ec__day', dayKey(1));
      await toggle('.ec__participation', TONE['partie.ralliement_event_participation_limited']);
      await click('.ec__step--more');
      const input = q<HTMLInputElement>('.ec__places-count')!;
      input.value = saisie;
      input.dispatchEvent(new Event('change'));
      await settle();

      expect(q<HTMLInputElement>('.ec__places-count')!.value).toBe('5');
      await click('.ec__submit');
      expect(api.create.mock.calls[0][1]).toEqual(expect.objectContaining({ capacity: 5 }));
    },
  );

  it('refus du serveur : message français affiché DANS la fenêtre, rien n’est émis ; garde de double envoi', async () => {
    const { fixture, q, type, click } = await mount();
    let resolve!: (v: unknown) => void;
    api.create.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await type('.ec__name', 'Catane');
    await type('.ec__day', dayKey(2));
    await click('.ec__submit');
    // En vol : le bouton est désactivé, un second clic n'envoie rien.
    expect(q<HTMLButtonElement>('.ec__submit')!.disabled).toBe(true);
    await click('.ec__submit');
    expect(api.create).toHaveBeenCalledTimes(1);
    resolve(CARD);
    await Promise.resolve();

    api.create.mockRejectedValueOnce({ error: { message: 'La date ne peut pas être passée' } });
    await type('.ec__name', 'Autre');
    await click('.ec__submit');
    expect(q('.ec__error')?.textContent?.trim()).toBe('La date ne peut pas être passée');

    api.create.mockRejectedValueOnce({ status: 0 });
    await click('.ec__submit');
    expect(q('.ec__error')?.textContent?.trim()).toBe(
      TONE['partie.ralliement_event_create_error'],
    );
    expect(fixture.componentInstance.created()).toEqual(CARD);
  });

  describe('réserver une place à des membres (Story 40.4)', () => {
    const chips = () =>
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ec__chip'));
    const chipOf = (name: string) =>
      chips().find((b) => (b.textContent ?? '').includes(name))!;
    const limited = TONE['partie.ralliement_event_participation_limited'];

    it('le sélecteur n’apparaît qu’avec des places limitées ; l’hôte n’est jamais proposé ; aide « rendue aux autres si déclinée »', async () => {
      const { q, toggle } = await mount();
      expect(parties.members).toHaveBeenCalledWith('g1');
      expect(q('.ec__reserve')).toBeNull();

      await toggle('.ec__participation', limited);

      expect(q('.ec__reserve')).not.toBeNull();
      expect(q('.ec__reserve .ec__label')?.textContent?.trim()).toBe(
        TONE['partie.ralliement_event_reserve_label'],
      );
      expect(chips().map((b) => (b.textContent ?? '').trim())).toEqual(['Zoé', 'Sam', 'Max']);
      expect(q('.ec__reserve-hint')?.textContent?.trim()).toBe(
        TONE['partie.ralliement_event_reserve_hint'],
      );
      // Chaque pastille dit son action en toutes lettres, avec le nom.
      expect(chipOf('Zoé').getAttribute('aria-label')).toBe('Réserver une place à Zoé');
    });

    it('cocher des membres les envoie dans reservedUserIds ; l’état coché est écrit (coche + aria-pressed)', async () => {
      const { q, type, click, toggle } = await mount();
      await type('.ec__name', 'Réservée');
      await type('.ec__day', dayKey(2));
      await toggle('.ec__participation', limited);

      await click('.ec__chip');
      expect(chipOf('Zoé').getAttribute('aria-pressed')).toBe('true');
      expect(chipOf('Zoé').querySelector('app-icon')?.getAttribute('data-icon')).toBe('valider');
      expect(chipOf('Zoé').textContent).not.toContain('✓');
      expect(chipOf('Sam').querySelector('app-icon')).toBeNull();
      expect(chipOf('Sam').getAttribute('aria-pressed')).toBe('false');
      chipOf('Max').click();
      await click('.ec__submit');

      expect(api.create.mock.calls[0][1]).toEqual(
        expect.objectContaining({ capacity: 4, reservedUserIds: ['u2', 'u4'] }),
      );
      expect(q('.ec__error')).toBeNull();
    });

    it('au plus « places − 1 » : au plafond les autres pastilles sont désactivées, le compteur ne passe pas sous réservées + 1', async () => {
      const { q, click, toggle, settle } = await mount();
      const press = async (name: string) => {
        chipOf(name).click();
        await settle();
      };
      await toggle('.ec__participation', limited);
      for (let i = 0; i < 2; i++) await click('.ec__step--less');
      expect(q<HTMLInputElement>('.ec__places-count')!.value).toBe('2');

      // Deux places : l'hôte + une seule réservée possible, la seconde pastille est désactivée.
      await press('Zoé');
      expect(chipOf('Sam').disabled).toBe(true);
      expect(q<HTMLButtonElement>('.ec__step--less')!.disabled).toBe(true);

      await click('.ec__step--more');
      await press('Sam');
      // Deux places réservées + l'hôte : le compteur ne descend pas sous 3, le reste est désactivé.
      expect(q<HTMLButtonElement>('.ec__step--less')!.disabled).toBe(true);
      expect(q<HTMLInputElement>('.ec__places-count')!.value).toBe('3');
      expect(chipOf('Max').disabled).toBe(true);

      // Décocher libère le plafond : le compteur peut redescendre.
      await press('Sam');
      expect(q<HTMLButtonElement>('.ec__step--less')!.disabled).toBe(false);
      await click('.ec__step--less');
      expect(q<HTMLInputElement>('.ec__places-count')!.value).toBe('2');
      expect(chipOf('Max').disabled).toBe(true);
    });

    it('repasser à « Tous les membres » abandonne la sélection : rien n’est envoyé', async () => {
      const { q, type, click, toggle } = await mount();
      await type('.ec__name', 'Ouverte');
      await type('.ec__day', dayKey(2));
      await toggle('.ec__participation', limited);
      await click('.ec__chip');
      await toggle('.ec__participation', TONE['partie.ralliement_event_participation_all']);
      expect(q('.ec__reserve')).toBeNull();
      await click('.ec__submit');

      expect(api.create.mock.calls[0][1]).not.toHaveProperty('reservedUserIds');
      expect(api.create.mock.calls[0][1]).toEqual(expect.objectContaining({ capacity: null }));
    });

    it('sans autre membre : « Aucun autre membre… » est écrit, aucune pastille', async () => {
      const { q, toggle } = await mount([member('u1', 'Léa')]);
      await toggle('.ec__participation', limited);

      expect(chips()).toHaveLength(0);
      expect(q('.ec__reserve-none')?.textContent?.trim()).toBe(
        TONE['partie.ralliement_event_reserve_none'],
      );
    });

    it('la liste des membres introuvable n’empêche pas de créer : sélecteur vide, création normale', async () => {
      const { q, type, click, toggle } = await mount(new Error('réseau'));
      await type('.ec__name', 'Sans liste');
      await type('.ec__day', dayKey(2));
      await toggle('.ec__participation', limited);

      expect(chips()).toHaveLength(0);
      expect(q('.ec__reserve-none')).not.toBeNull();
      await click('.ec__submit');
      expect(api.create).toHaveBeenCalledTimes(1);
      expect(api.create.mock.calls[0][1]).not.toHaveProperty('reservedUserIds');
    });
  });

  it('« Renoncer » ferme sans rien envoyer', async () => {
    const { fixture, click } = await mount();
    await click('.ec__cancel');
    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(api.create).not.toHaveBeenCalled();
  });

  // ─── Sondage de dates (Story 40.5) ───────────────────────────────────────────────────────────
  describe('mode « Sondage de dates » (Story 40.5)', () => {
    const POLL_LABEL = TONE['partie.ralliement_event_date_poll'];

    /** Passe en mode sondage et place les créneaux (jour + créneau + « Ajouter »). */
    async function addSlots(
      h: Awaited<ReturnType<typeof mount>>,
      entries: [number, string][],
    ) {
      for (const [days, slot] of entries) {
        await h.type('.ec__poll-day', dayKey(days));
        await h.toggle('.ec__poll-slot', slot);
        await h.click('.ec__poll-add-btn');
      }
    }

    it('la bascule offre les deux modes ; le mode sondage montre la liste des créneaux et l’échéance, plus le jour fixe', async () => {
      const h = await mount();
      expect(h.q('.ec__day')).not.toBeNull();
      expect(h.q('.ec__poll')).toBeNull();

      await h.toggle('.ec__date-mode', POLL_LABEL);

      expect(h.q('.ec__day')).toBeNull();
      expect(h.q('.ec__poll-day')).not.toBeNull();
      expect(h.q('.ec__poll-deadline')).not.toBeNull();
      expect(h.q('.ec__poll-add-btn')!.textContent?.trim()).toBe(
        TONE['partie.ralliement_event_poll_add_btn'],
      );
      // Aucun créneau : l’aide « au moins deux » est écrite, pas de résumé.
      expect(h.q('.ec__poll-min')!.textContent?.trim()).toBe(
        TONE['partie.ralliement_event_poll_min_hint'],
      );
      expect(h.q('.ec__poll-summary')).toBeNull();
    });

    it('« Ajouter » refuse un jour vide ou un doublon ; le résumé écrit le nombre et la plage ; une pastille se retire', async () => {
      const h = await mount();
      await h.toggle('.ec__date-mode', POLL_LABEL);
      expect(h.q<HTMLButtonElement>('.ec__poll-add-btn')!.disabled).toBe(true);

      await addSlots(h, [
        [9, 'Soir'],
        [3, 'Matin'],
      ]);
      // Même jour et même créneau que le dernier ajout : refusé (le bouton se désactive).
      await h.type('.ec__poll-day', dayKey(3));
      await h.toggle('.ec__poll-slot', 'Matin');
      expect(h.q<HTMLButtonElement>('.ec__poll-add-btn')!.disabled).toBe(true);

      // Triés par jour, résumé « 2 créneaux · … → … ».
      const chips = Array.from(document.body.querySelectorAll('.ec__chip-label')).map((c) =>
        c.textContent?.trim(),
      );
      expect(chips).toHaveLength(2);
      expect(chips[0]).toContain('matin');
      expect(chips[1]).toContain('soir');
      expect(h.q('.ec__poll-summary')!.textContent).toContain('2 créneaux');
      expect(h.q('.ec__poll-summary')!.textContent).toContain('→');
      expect(h.q('.ec__poll-min')).toBeNull();

      await h.click('.ec__chip-remove');
      expect(document.body.querySelectorAll('.ec__chip-label')).toHaveLength(1);
      expect(h.q('.ec__poll-summary')!.textContent).toContain('1 créneau');
      expect(h.q('.ec__poll-min')).not.toBeNull();
    });

    it('« Créer » reste désactivé sans nom, sans deux créneaux ou sans échéance', async () => {
      const h = await mount();
      const submit = () => h.q<HTMLButtonElement>('.ec__submit')!;
      await h.type('.ec__name', 'Catane');
      await h.toggle('.ec__date-mode', POLL_LABEL);
      await addSlots(h, [[4, 'Soir']]);
      await h.type('.ec__poll-deadline', dayKey(2));
      expect(submit().disabled).toBe(true); // un seul créneau
      await addSlots(h, [[5, 'Soir']]);
      expect(submit().disabled).toBe(false);
      await h.type('.ec__poll-deadline', '');
      expect(submit().disabled).toBe(true); // plus d’échéance
    });

    it('envoie les créneaux et l’échéance, sans jour ni créneau fixe ; émet la carte créée', async () => {
      const h = await mount();
      await h.type('.ec__name', ' Sondage plateaux ');
      await h.toggle('.ec__date-mode', POLL_LABEL);
      await addSlots(h, [
        [8, 'Soir'],
        [6, 'Matin'],
        [9, 'Après-midi'],
      ]);
      await h.type('.ec__poll-deadline', dayKey(4));
      await h.click('.ec__submit');

      expect(api.create).toHaveBeenCalledWith('g1', {
        title: 'Sondage plateaux',
        pollOptions: [
          { date: dayKey(6), slot: 'MORNING' },
          { date: dayKey(8), slot: 'EVENING' },
          { date: dayKey(9), slot: 'AFTERNOON' },
        ],
        pollDeadline: dayKey(4),
        lieu: null,
        heureRdv: null,
        notePratique: null,
        capacity: null,
        durationSlots: 1,
      });
      const sent = api.create.mock.calls[0][1] as Record<string, unknown>;
      expect('date' in sent).toBe(false);
      expect('slot' in sent).toBe(false);
      expect(h.fixture.componentInstance.created()).toEqual(CARD);
    });

    it('repasser en date fixée n’envoie plus de sondage', async () => {
      const h = await mount();
      await h.type('.ec__name', 'Catane');
      await h.toggle('.ec__date-mode', POLL_LABEL);
      await addSlots(h, [
        [4, 'Soir'],
        [5, 'Soir'],
      ]);
      await h.toggle('.ec__date-mode', TONE['partie.ralliement_event_date_fixed']);
      await h.type('.ec__day', dayKey(3));
      await h.click('.ec__submit');

      const sent = api.create.mock.calls[0][1] as Record<string, unknown>;
      expect(sent['date']).toBe(dayKey(3));
      expect('pollOptions' in sent).toBe(false);
      expect('pollDeadline' in sent).toBe(false);
    });
  });
});
