import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DaySlot } from '@master-jdr/shared';
import {
  DURATION_TEXT,
  durationDetail,
  durationSlotsLabel,
  overlapAriaLabel,
  overlapMarkLabel,
  worstAvailabilityLabel,
} from './duration-labels';
import { DurationStepper } from './duration-stepper';

@Component({
  imports: [DurationStepper],
  template: `<app-duration-stepper
    [(value)]="value"
    [start]="start()"
    [readonly]="locked()"
  />`,
})
class Host {
  value = signal(1);
  start = signal<{ date: string; slot: DaySlot } | null>(null);
  locked = signal(false);
}

describe('DurationStepper (Story 47.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const less = () => el.querySelector<HTMLButtonElement>('.ds__step--less')!;
    const more = () => el.querySelector<HTMLButtonElement>('.ds__step--more')!;
    const text = (sel: string) => el.querySelector(sel)?.textContent?.trim() ?? null;
    const click = (b: HTMLButtonElement) => {
      b.click();
      fixture.detectChanges();
    };
    return { fixture, host: fixture.componentInstance, el, less, more, text, click };
  }

  it('affiche « 1 créneau », « Raccourcir » grisé à la borne basse, cibles nommées', async () => {
    const { text, less, more } = await mount();

    expect(text('.ds__label')).toBe(DURATION_TEXT.label);
    expect(text('.ds__value')).toBe('1 créneau');
    expect(less().disabled).toBe(true);
    expect(more().disabled).toBe(false);
    expect(less().getAttribute('aria-label')).toBe('Raccourcir');
    expect(more().getAttribute('aria-label')).toBe('Allonger');
  });

  it('« Allonger » / « Raccourcir » changent la valeur liée', async () => {
    const { host, click, more, less, text } = await mount();

    click(more());
    click(more());
    expect(host.value()).toBe(3);
    expect(text('.ds__value')).toBe('3 créneaux');

    click(less());
    expect(host.value()).toBe(2);
  });

  it('sans départ : rien sous 3 créneaux, « soit N jours » dès 3', async () => {
    const { host, fixture, text } = await mount();

    host.value.set(2);
    fixture.detectChanges();
    expect(text('.ds__detail')).toBeNull();

    host.value.set(3);
    fixture.detectChanges();
    expect(text('.ds__detail')).toBe('soit 1 jour');

    host.value.set(6);
    fixture.detectChanges();
    expect(text('.ds__detail')).toBe('soit 2 jours');
  });

  it('avec un départ : la plage en clair, de l’après-midi au soir', async () => {
    const { host, fixture, text } = await mount();

    host.start.set({ date: '2026-11-14', slot: 'AFTERNOON' });
    host.value.set(2);
    fixture.detectChanges();

    expect(text('.ds__detail')).toBe('sam. 14 après-midi → sam. 14 soir');
  });

  it('un seul créneau : le départ seul, sans plage redondante', async () => {
    const { host, fixture, text } = await mount();

    host.start.set({ date: '2026-11-14', slot: 'AFTERNOON' });
    fixture.detectChanges();

    expect(text('.ds__detail')).toBe('sam. 14 après-midi');
  });

  it('la plage passe au lendemain : samedi soir sur 3 créneaux → dimanche après-midi', async () => {
    const { host, fixture, text } = await mount();

    host.start.set({ date: '2026-11-14', slot: 'EVENING' });
    host.value.set(3);
    fixture.detectChanges();

    expect(text('.ds__detail')).toBe('sam. 14 soir → dim. 15 après-midi');
  });

  it('annonce la valeur et la plage dans une région aria-live', async () => {
    const { host, fixture, el } = await mount();

    host.start.set({ date: '2026-11-14', slot: 'AFTERNOON' });
    host.value.set(2);
    fixture.detectChanges();

    const live = el.querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe('2 créneaux, sam. 14 après-midi → sam. 14 soir');
  });

  it('plafond de 15 jours (45 créneaux) : « Allonger » grisé et message écrit', async () => {
    const { host, fixture, more, text } = await mount();

    host.value.set(45);
    fixture.detectChanges();

    expect(more().disabled).toBe(true);
    expect(text('.ds__hint')).toBe('15 jours au plus : au-delà, créez deux rendez-vous.');
  });

  it('une journée entière ne dure qu’un créneau : « Allonger » grisé, aucune plage multiple', async () => {
    const { host, fixture, more, text } = await mount();

    host.start.set({ date: '2026-11-14', slot: 'FULL_DAY' });
    fixture.detectChanges();

    expect(more().disabled).toBe(true);
    expect(text('.ds__detail')).toBe('sam. 14 journée');
  });

  it('lecture seule : les deux boutons sont grisés et la raison est écrite', async () => {
    const { host, fixture, less, more, text, click } = await mount();
    host.value.set(3);
    host.locked.set(true);
    fixture.detectChanges();

    expect(less().disabled).toBe(true);
    expect(more().disabled).toBe(true);
    expect(text('.ds__hint')).toBe(DURATION_TEXT.pollPending);
    click(more());
    expect(host.value()).toBe(3);
  });
});

describe('libellés de durée (Story 47.1)', () => {
  it('singulier et pluriel', () => {
    expect(durationSlotsLabel(1)).toBe('1 créneau');
    expect(durationSlotsLabel(4)).toBe('4 créneaux');
  });

  it('journée entière au-delà d’un créneau : pas de plage, la longueur en jours', () => {
    expect(durationDetail(3, { date: '2026-11-14', slot: 'FULL_DAY' })).toBe('soit 1 jour');
  });
});

describe('mots de la plage votée (Story 47.5)', () => {
  it('la marque de recouvrement et son nom accessible', () => {
    expect(overlapMarkLabel(2)).toBe('×2');
    expect(overlapAriaLabel(3)).toBe('3 plages se superposent (×3)');
  });

  it('la pire disponibilité s’écrit au pluriel, au singulier, et à zéro', () => {
    expect(worstAvailabilityLabel(2)).toBe('2 dispos sur toute la plage');
    expect(worstAvailabilityLabel(1)).toBe('1 dispo sur toute la plage');
    expect(worstAvailabilityLabel(0)).toBe('0 dispo sur toute la plage');
  });

  it('l’annonce d’un créneau candidat en plage', () => {
    expect(
      DURATION_TEXT.announceSpan
        .replace('{n}', '2')
        .replace('{total}', '5')
        .replace('{range}', 'du vendredi 6 soir au dimanche 8 après-midi')
        .replace('{yes}', '4 oui'),
    ).toBe('Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui');
  });
});
