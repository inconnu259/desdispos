import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { ConfirmDialog, type ConfirmData } from './confirm-dialog';

// Story 39.4 (UX-DR11) : variante rouge pour une action irréversible. « Renoncer » reste inchangé ;
// le rouge s'accompagne d'un pictogramme ET du mot du bouton — jamais la couleur seule.

describe('ConfirmDialog — variante irréversible (Story 39.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(data: ConfirmData): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: ThemeToneService,
          useValue: {
            tone: signal(TONE_MAP['grimoire-emeraude']),
            activeTheme: signal('grimoire-emeraude'),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('mat-dialog-actions button'));

  it('par défaut : bouton de confirmation ordinaire, sans pictogramme ni classe rouge', async () => {
    const el = await render({ message: 'Retirer ?', confirmLabel: 'Retirer' });
    const [renoncer, confirmer] = buttons(el);
    expect(confirmer.classList.contains('confirm-destructive')).toBe(false);
    expect(confirmer.querySelector('app-icon')).toBeNull();
    expect(confirmer.textContent).toContain('Retirer');
    expect(renoncer.classList.contains('confirm-destructive')).toBe(false);
  });

  it('destructive : le bouton de confirmation est rouge, avec un pictogramme et son mot', async () => {
    const el = await render({
      message: 'Supprimer le groupe ?',
      confirmLabel: 'Quitter et supprimer',
      destructive: true,
    });
    const [renoncer, confirmer] = buttons(el);
    expect(confirmer.classList.contains('confirm-destructive')).toBe(true);
    expect(confirmer.querySelector('app-icon')?.getAttribute('data-icon')).toBe('avertissement');
    expect(confirmer.textContent).toContain('Quitter et supprimer');
    // « Renoncer » est inchangé : ni rouge, ni pictogramme.
    expect(renoncer.classList.contains('confirm-destructive')).toBe(false);
    expect(renoncer.querySelector('app-icon')).toBeNull();
    expect(renoncer.textContent).toContain(TONE_MAP['grimoire-emeraude']['common.annuler']);
  });

  it('sans libellé, le bouton garde « Supprimer » du thème', async () => {
    const el = await render({ message: 'Brûler ?', destructive: true });
    expect(buttons(el)[1].textContent).toContain(TONE_MAP['grimoire-emeraude']['common.supprimer']);
  });
});
