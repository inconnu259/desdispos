import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountDeletionImpactDto } from '@master-jdr/shared';
import { AccountService } from '../../../core/account/account.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP, type Theme } from '../../../core/theme/tones';
import { DeleteAccountDialog } from './delete-account-dialog';

// Story 43.1 (UX-DR12, confirmation n° 1) : les deux listes, le champ du mot de passe, le bouton
// rouge ; les listes vides sont omises. Story 43.2 : le bouton rouge efface le compte.

describe('DeleteAccountDialog (Stories 43.1 et 43.2)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    account.deleteAccount.mockReset();
    ref.close.mockReset();
  });

  let current: ComponentFixture<DeleteAccountDialog>;
  const account = { deleteAccount: vi.fn() };
  const ref = { close: vi.fn() };

  async function render(
    impact: AccountDeletionImpactDto,
    theme: Theme = 'grimoire-emeraude',
  ): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [DeleteAccountDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { pseudo: 'alice', impact } },
        { provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } },
        { provide: AccountService, useValue: account },
        { provide: MatDialogRef, useValue: ref },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DeleteAccountDialog);
    current = fixture;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('mat-dialog-actions button'));

  it('titre « Votre accord », phrase d’intro avec le pseudo et mention d’irréversibilité', async () => {
    const el = await render({ groups: [], jdrParties: [] });

    expect(el.querySelector('h2')?.textContent).toContain('Votre accord');
    expect(el.textContent).toContain(
      'Effacer votre compte « alice » ? Seront supprimés avec lui :',
    );
    expect(el.textContent).toContain(
      'Cette action est irréversible. Pour confirmer, saisissez votre mot de passe.',
    );
  });

  it('liste les groupes avec leurs membres et leurs conjonctions, et les parties de JDR avec leurs joueurs', async () => {
    const el = await render({
      groups: [{ id: 'g1', name: 'La Bande du Jeudi', memberCount: 14, eventCount: 6 }],
      jdrParties: [{ id: 'q1', name: 'Ryuutama du mardi', playerCount: 3 }],
    });

    expect(el.querySelector('[data-testid="impact-groups"]')?.textContent).toContain(
      'La Bande du Jeudi — 14 membres · 6 conjonctions',
    );
    expect(el.querySelector('[data-testid="impact-jdr"]')?.textContent).toContain(
      'Ryuutama du mardi — 3 joueurs y perdent aussi leurs personnages',
    );
  });

  it('accorde au singulier : 1 membre, 1 conjonction, 1 joueur', async () => {
    const el = await render({
      groups: [{ id: 'g1', name: 'Soirée', memberCount: 1, eventCount: 1 }],
      jdrParties: [{ id: 'q1', name: 'Quête', playerCount: 1 }],
    });

    expect(el.textContent).toContain('Soirée — 1 membre · 1 conjonction');
    expect(el.textContent).toContain('Quête — 1 joueur y perd aussi son personnage');
  });

  it('une partie de JDR sans joueur ne promet pas de personnages perdus', async () => {
    const el = await render({
      groups: [],
      jdrParties: [{ id: 'q1', name: 'Quête vide', playerCount: 0 }],
    });

    const line = el.querySelector('[data-testid="impact-jdr"] li')?.textContent?.trim();
    expect(line).toBe('Quête vide');
  });

  it('les listes vides sont omises', async () => {
    const onlyGroups = await render({
      groups: [{ id: 'g1', name: 'Groupe', memberCount: 2, eventCount: 0 }],
      jdrParties: [],
    });
    expect(onlyGroups.querySelector('[data-testid="impact-groups"]')).not.toBeNull();
    expect(onlyGroups.querySelector('[data-testid="impact-jdr"]')).toBeNull();
    TestBed.resetTestingModule();

    const none = await render({ groups: [], jdrParties: [] });
    expect(none.querySelector('[data-testid="impact-groups"]')).toBeNull();
    expect(none.querySelector('[data-testid="impact-jdr"]')).toBeNull();
  });

  it('champ mot de passe, « Renoncer » et bouton rouge avec pictogramme et mot — désactivé tant que le champ est vide', async () => {
    const el = await render({ groups: [], jdrParties: [] });

    expect(el.querySelector('input[type="password"]')).not.toBeNull();
    const [renoncer, effacer] = buttons(el) as HTMLButtonElement[];
    expect(renoncer.textContent).toContain('Renoncer');
    expect(effacer.classList.contains('confirm-destructive')).toBe(true);
    expect(effacer.querySelector('app-icon')?.getAttribute('data-icon')).toBe('avertissement');
    expect(effacer.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(effacer.querySelector('mat-icon')).toBeNull();
    expect(effacer.textContent).toContain('Effacer mon compte');
    expect(effacer.disabled).toBe(true);
  });

  async function typeAndConfirm(el: HTMLElement, password: string): Promise<void> {
    const input = el.querySelector<HTMLInputElement>('input[type="password"]')!;
    input.value = password;
    input.dispatchEvent(new Event('input'));
    current.detectChanges();
    const effacer = buttons(el)[1] as HTMLButtonElement;
    expect(effacer.disabled).toBe(false);
    effacer.click();
    await current.whenStable();
    current.detectChanges();
  }

  it('mot de passe saisi, confirmation : DELETE envoyé avec le mot de passe, la fenêtre se ferme sur true', async () => {
    account.deleteAccount.mockResolvedValue({ ok: true });
    const el = await render({ groups: [], jdrParties: [] });

    await typeAndConfirm(el, 'secret-123');

    expect(account.deleteAccount).toHaveBeenCalledWith('secret-123');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it.each([
    [401, 'account.password_wrong_current'],
    [429, 'account.delete_throttled'],
    [500, 'account.delete_error'],
  ])('échec %i : la fenêtre reste ouverte avec un message écrit (%s)', async (status, key) => {
    account.deleteAccount.mockRejectedValue(
      new HttpErrorResponse({ status, statusText: 'x', error: null }),
    );
    const el = await render({ groups: [], jdrParties: [] });

    await typeAndConfirm(el, 'faux');

    expect(ref.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent).toContain(TONE_MAP['grimoire-emeraude'][key]);
  });

  it('« Renoncer » ferme sans rien envoyer', async () => {
    const el = await render({ groups: [], jdrParties: [] });

    (buttons(el)[0] as HTMLButtonElement).click();

    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it.each(['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as const)(
    '%s : les mêmes textes fixes',
    async (theme) => {
      const el = await render({ groups: [], jdrParties: [] }, theme);
      expect(el.textContent).toContain('Effacer votre compte « alice » ?');
    },
  );
});
