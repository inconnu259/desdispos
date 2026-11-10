import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { CancelEventDialog, type CancelEventData } from './cancel-event-dialog';

const TONE = TONE_MAP['grimoire-emeraude'];

describe('CancelEventDialog — confirmation « Votre accord » rouge (Story 42.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount(confirm: CancelEventData['confirm'] = vi.fn().mockResolvedValue(undefined)) {
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: ref },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { title: 'Soirée plateaux', confirm } satisfies CancelEventData,
        },
        { provide: ThemeToneService, useValue: { tone: signal(TONE) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CancelEventDialog);
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
    return { fixture, settle, el, text, close: ref.close, confirm, ref };
  }

  it('titre « Votre accord », question avec le nom, avertissement « définitive », « Renoncer » et un bouton rouge écrit en toutes lettres', async () => {
    const { el, text } = await mount();

    expect(text('h2')).toBe('Votre accord');
    expect(text('.ced__heading')).toBe('Annuler « Soirée plateaux » ?');
    expect(text('.ced__warning')).toBe(
      'Les inscrits seront prévenus par e-mail. Cette action est définitive.',
    );
    expect(text('.ced__cancel')).toBe('Renoncer');
    // Le mot accompagne la couleur et le pictogramme (jamais la couleur seule).
    expect(text('.ced__confirm')).toContain('Annuler la conjonction');
    const icon = el.querySelector('.ced__confirm app-icon');
    expect(icon?.getAttribute('data-icon')).toBe('avertissement');
    expect(icon?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.ced__confirm mat-icon')).toBeNull();
    expect(el.querySelector('.ced__error')).toBeNull();
  });

  it('« Annuler la conjonction » appelle le serveur une fois et ferme en rendant true', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const { el, settle, close } = await mount(confirm);

    (el.querySelector('.ced__confirm') as HTMLButtonElement).click();
    await settle();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('« Renoncer » ferme sans rien écrire', async () => {
    const confirm = vi.fn();
    const { el, settle, close } = await mount(confirm);

    (el.querySelector('.ced__cancel') as HTMLButtonElement).click();
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
    const button = el.querySelector('.ced__confirm') as HTMLButtonElement;

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
      .mockRejectedValueOnce({ error: { message: 'Cette conjonction est passée' } })
      .mockResolvedValueOnce(undefined);
    const { el, settle, close, text } = await mount(confirm);

    (el.querySelector('.ced__confirm') as HTMLButtonElement).click();
    await settle();

    expect(text('.ced__error')).toBe('Cette conjonction est passée');
    expect(close).not.toHaveBeenCalled();
    expect((el.querySelector('.ced__confirm') as HTMLButtonElement).disabled).toBe(false);

    (el.querySelector('.ced__confirm') as HTMLButtonElement).click();
    await settle();
    expect(close).toHaveBeenCalledWith(true);
    expect(el.querySelector('.ced__error')).toBeNull();
  });

  it('échec sans texte (réseau) : libellé de repli du thème', async () => {
    const { el, settle, text } = await mount(vi.fn().mockRejectedValue(new Error('réseau')));

    (el.querySelector('.ced__confirm') as HTMLButtonElement).click();
    await settle();

    expect(text('.ced__error')).toBe(TONE['partie.ralliement_event_cancel_event_error']);
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

    (el.querySelector('.ced__confirm') as HTMLButtonElement).click();
    await settle();
    expect(ref.disableClose).toBe(true);

    fail({ error: { message: 'refus' } });
    await settle();
    expect(ref.disableClose).toBe(false);
  });
});
