import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { ExtendVoteDialog, type ExtendVoteData } from './extend-vote-dialog';

const TONE = TONE_MAP['grimoire-emeraude'];

describe('ExtendVoteDialog — confirmation « Votre accord » (Story 40.7)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount(
    confirm: ExtendVoteData['confirm'] = vi.fn().mockResolvedValue(undefined),
    over: Partial<ExtendVoteData> = {},
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
            deadlineKey: '2026-10-25',
            minKey: '2026-10-26',
            confirm,
            ...over,
          } satisfies ExtendVoteData,
        },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ExtendVoteDialog);
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
    const input = el.querySelector('input[type="date"]') as HTMLInputElement;
    const button = el.querySelector('.evd__confirm') as HTMLButtonElement;
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    return { fixture, settle, el, text, close, confirm, ref, input, button, type };
  }

  it('titre « Votre accord », phrase de fin du vote, champ « Nouvelle échéance », texte de relance, « Renoncer » · « Prolonger »', async () => {
    const { el, text, input } = await mount();

    expect(text('h2')).toBe('Votre accord');
    expect(text('.evd__heading')).toBe('« Soirée plateaux » — le vote se termine le dim. 25 oct.');
    expect(text('.evd__label')).toBe('Nouvelle échéance');
    expect(input.type).toBe('date');
    expect(input.getAttribute('min')).toBe('2026-10-26');
    expect(text('.evd__warning')).toBe(
      'Les personnes qui n’ont pas encore voté seront relancées la veille de la nouvelle échéance.',
    );
    expect(text('.evd__cancel')).toBe('Renoncer');
    expect(text('.evd__confirm')).toBe('Prolonger');
    expect(el.querySelector('.evd__error')).toBeNull();
  });

  it('« Prolonger » reste désactivé tant qu’aucun jour valide n’est saisi (vide, avant le minimum)', async () => {
    const confirm = vi.fn();
    const { button, type, settle } = await mount(confirm);
    expect(button.disabled).toBe(true);

    await type('2026-10-25');
    expect(button.disabled).toBe(true);
    button.click();
    await settle();
    expect(confirm).not.toHaveBeenCalled();

    await type('2026-10-26');
    expect(button.disabled).toBe(false);
  });

  it('un jour valide : le serveur reçoit CE jour, la fenêtre se ferme en rendant true', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const { button, type, settle, close } = await mount(confirm);

    await type('2026-11-02');
    button.click();
    await settle();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('2026-11-02');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('« Renoncer » ferme sans rien écrire', async () => {
    const confirm = vi.fn();
    const { el, settle, close, type } = await mount(confirm);
    await type('2026-11-02');

    (el.querySelector('.evd__cancel') as HTMLButtonElement).click();
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
    const { button, type, settle, close, el } = await mount(confirm);
    await type('2026-11-02');

    button.click();
    await settle();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((el.querySelector('.evd__cancel') as HTMLButtonElement).disabled).toBe(true);
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
    const { button, type, settle, close, text, el } = await mount(confirm);
    await type('2026-11-02');

    button.click();
    await settle();

    expect(text('.evd__error')).toBe('La date de cette conjonction est déjà fixée');
    expect(close).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);

    button.click();
    await settle();
    expect(close).toHaveBeenCalledWith(true);
    expect(el.querySelector('.evd__error')).toBeNull();
  });

  it('échec sans texte (réseau) : libellé de repli du thème', async () => {
    const { button, type, settle, text } = await mount(
      vi.fn().mockRejectedValue(new Error('réseau')),
    );
    await type('2026-11-02');

    button.click();
    await settle();

    expect(text('.evd__error')).toBe(TONE['partie.ralliement_event_extend_error']);
  });

  it('Échap et clic sur le voile sont bloqués pendant l’écriture (disableClose), rétablis après un refus', async () => {
    let fail!: (e: unknown) => void;
    const confirm = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const { button, type, settle, ref } = await mount(confirm);
    await type('2026-11-02');
    expect(ref.disableClose).toBe(false);

    button.click();
    await settle();
    expect(ref.disableClose).toBe(true);

    fail({ error: { message: 'refus' } });
    await settle();
    expect(ref.disableClose).toBe(false);
  });
});
