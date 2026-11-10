import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import type { RankedPollSlot } from '../event-card.util';
import { DateFixDialog, type DateFixData } from './date-fix-dialog';

const TONE = TONE_MAP['grimoire-emeraude'];

const TODAY = '2026-10-20';

const SLOTS: RankedPollSlot[] = [
  {
    id: 'o2',
    date: '2026-10-25',
    slot: 'MORNING',
    label: 'dim. 25 oct. · matin',
    yes: 4,
    maybe: 0,
    no: 1,
    past: false,
  },
  {
    id: 'o1',
    date: '2026-10-24',
    slot: 'EVENING',
    label: 'sam. 24 oct. · soir',
    yes: 2,
    maybe: 1,
    no: 0,
    past: false,
  },
  {
    id: 'o3',
    date: '2026-10-31',
    slot: 'EVENING',
    label: 'sam. 31 oct. · soir',
    yes: 0,
    maybe: 0,
    no: 0,
    past: false,
  },
];

/** Le créneau est passé : sa date est avant `TODAY`, comme le drapeau `past` que `rankedPollSlots` pose. */
const asPast = (slot: RankedPollSlot): RankedPollSlot => ({
  ...slot,
  date: '2026-10-01',
  past: true,
});

describe('DateFixDialog — confirmation « Votre accord » (Story 40.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount(
    confirm: DateFixData['confirm'] = vi.fn().mockResolvedValue(undefined),
    slots: RankedPollSlot[] = SLOTS,
  ) {
    const ref = { close: vi.fn(), disableClose: false };
    const close = ref.close;
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: ref },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Soirée plateaux',
            slots,
            todayKey: TODAY,
            confirm,
          } satisfies DateFixData,
        },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DateFixDialog);
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };
    fixture.detectChanges();
    await settle();
    const el = fixture.nativeElement as HTMLElement;
    const text = (sel: string) => el.querySelector(sel)?.textContent?.trim();
    return { fixture, settle, el, text, close, confirm, ref };
  }

  it('titre « Votre accord », phrase d’introduction, avertissement de sceau et deux boutons « Renoncer » · « Fixer la date »', async () => {
    const { el, text } = await mount();

    expect(text('h2')).toBe('Votre accord');
    expect(text('.dfd__heading')).toBe(
      'Fixer la date — « Soirée plateaux » : les créneaux, du plus au moins plébiscité',
    );
    expect(text('.dfd__warning')).toBe(
      'La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles.',
    );
    expect(text('.dfd__cancel')).toBe('Renoncer');
    expect(text('.dfd__confirm')).toBe('Fixer la date');
    expect(el.querySelector('.dfd__error')).toBeNull();
  });

  it('les créneaux sont des boutons radio dans l’ordre reçu, avec « n oui · n peut-être · n non », le meilleur présélectionné', async () => {
    const { el } = await mount();

    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((r) => r.checked)).toEqual([true, false, false]);
    expect(el.querySelector('[role="radiogroup"]')).not.toBeNull();
    const rows = Array.from(el.querySelectorAll('.dfd__slot')).map((r) => [
      r.querySelector('.dfd__label')?.textContent?.trim(),
      r.querySelector('.dfd__counts')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['dim. 25 oct. · matin', '4 oui · 0 peut-être · 1 non'],
      ['sam. 24 oct. · soir', '2 oui · 1 peut-être · 0 non'],
      ['sam. 31 oct. · soir', '0 oui · 0 peut-être · 0 non'],
    ]);
  });

  it('choisir un autre créneau puis « Fixer la date » : le serveur reçoit CE créneau, la fenêtre se ferme en rendant true', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const { el, settle, close } = await mount(confirm);

    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    radios[1].click();
    radios[1].dispatchEvent(new Event('change'));
    await settle();
    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('o1');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('le créneau le mieux placé est envoyé par défaut', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const { el, settle } = await mount(confirm);

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();

    expect(confirm).toHaveBeenCalledWith('o2');
  });

  it('Story 44.3 — personne n’a dit oui : rien n’est présélectionné, « Fixer la date » est désactivé', async () => {
    const confirm = vi.fn();
    const slots = SLOTS.map((s) => ({ ...s, yes: 0, maybe: 0, no: 0 }));
    const { el, settle } = await mount(confirm, slots);

    expect(
      Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]')).some(
        (r) => r.checked,
      ),
    ).toBe(false);
    const button = el.querySelector('.dfd__confirm') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    await settle();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('« Renoncer » ferme sans rien écrire', async () => {
    const confirm = vi.fn();
    const { el, settle, close } = await mount(confirm);

    (el.querySelector('.dfd__cancel') as HTMLButtonElement).click();
    await settle();

    expect(close).toHaveBeenCalledWith(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('gardé contre le double clic : un seul envoi tant que le premier est en cours', async () => {
    let release!: () => void;
    const confirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { el, settle, close } = await mount(confirm);
    const button = el.querySelector('.dfd__confirm') as HTMLButtonElement;

    button.click();
    await settle();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    await settle();
    expect(confirm).toHaveBeenCalledTimes(1);

    release();
    await settle();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('refus du serveur : son message français reste affiché, la fenêtre reste ouverte et se rejoue', async () => {
    const confirm = vi
      .fn()
      .mockRejectedValueOnce({ error: { message: 'La date de cette conjonction est déjà fixée' } })
      .mockResolvedValueOnce(undefined);
    const { el, settle, close, text } = await mount(confirm);

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();

    expect(text('.dfd__error')).toBe('La date de cette conjonction est déjà fixée');
    expect(close).not.toHaveBeenCalled();
    expect((el.querySelector('.dfd__confirm') as HTMLButtonElement).disabled).toBe(false);

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();
    expect(close).toHaveBeenCalledWith(true);
    expect(el.querySelector('.dfd__error')).toBeNull();
  });

  it('échec sans texte (réseau) : libellé de repli du thème', async () => {
    const { el, settle, text } = await mount(vi.fn().mockRejectedValue(new Error('réseau')));

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();

    expect(text('.dfd__error')).toBe(TONE['partie.ralliement_event_fix_date_error']);
  });

  it('Échap et clic sur le voile sont bloqués pendant l’écriture (disableClose), rétablis après un refus', async () => {
    let fail!: (e: unknown) => void;
    const confirm = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const { el, settle, ref } = await mount(confirm);
    expect(ref.disableClose).toBe(false);

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();
    expect(ref.disableClose).toBe(true);

    fail({ error: { message: 'refus' } });
    await settle();
    expect(ref.disableClose).toBe(false);
  });

  it('créneau passé : désactivé, la raison est écrite, le meilleur créneau NON passé est présélectionné et envoyé', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const slots = [asPast(SLOTS[0]), SLOTS[1], SLOTS[2]];
    const { el, settle, text } = await mount(confirm, slots);

    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((r) => [r.disabled, r.checked])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(el.querySelectorAll('.dfd__past')).toHaveLength(1);
    expect(text('.dfd__past')).toBe(TONE['partie.ralliement_event_fix_past']);

    (el.querySelector('.dfd__confirm') as HTMLButtonElement).click();
    await settle();
    expect(confirm).toHaveBeenCalledWith('o1');
  });

  it('tous les créneaux passés : rien n’est sélectionné, « Fixer la date » est désactivé et n’envoie rien', async () => {
    const confirm = vi.fn();
    const slots = SLOTS.map(asPast);
    const { el, settle } = await mount(confirm, slots);

    const button = el.querySelector('.dfd__confirm') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]')).some(
        (r) => r.checked,
      ),
    ).toBe(false);
    button.click();
    await settle();
    expect(confirm).not.toHaveBeenCalled();
  });
});
