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

describe('ConfirmDialog — champ warning (story 51.5)', () => {
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

  it('avec warning : l’avertissement suit le message, précédé d’un pictogramme décoratif', async () => {
    const el = await render({ message: 'Confirmer cette date ?', warning: 'Personne n’a voté.' });
    const content = el.querySelector('mat-dialog-content')!;
    const warning = content.querySelector('.confirm-warning')!;
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('Personne n’a voté.');
    const icon = warning.querySelector('app-icon')!;
    expect(icon.getAttribute('data-icon')).toBe('avertissement');
    // Décorative : l'avertissement est écrit juste à côté.
    expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('svg')!.getAttribute('aria-label')).toBeNull();
    // La question reste avant l'avertissement.
    expect(content.textContent!.indexOf('Confirmer cette date ?')).toBeLessThan(
      content.textContent!.indexOf('Personne n’a voté.'),
    );
  });

  it('sans warning : ni bloc d’avertissement, ni pictogramme dans le contenu', async () => {
    const el = await render({ message: 'Confirmer cette date ?' });
    const content = el.querySelector('mat-dialog-content')!;
    expect(content.querySelector('.confirm-warning')).toBeNull();
    expect(content.querySelector('app-icon')).toBeNull();
    expect(content.textContent!.trim()).toBe('Confirmer cette date ?');
  });
});
