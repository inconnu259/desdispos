import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { PartieDto } from '@desdispos/shared';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { THEMES, TONE_MAP, type Theme } from '../../../core/theme/tones';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { EditableBanner } from './editable-banner';

function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'party-1',
    name: 'Test Party',
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj-1',
    ownerPseudo: 'mj-pseudo',
    ownerDisplayName: 'MJ Nom',
    createdAt: new Date().toISOString(),
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'mj',
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: 'v1',
    can: { coverUpdate: true },
    ...overrides,
  };
}

const GRIMOIRE_ADD = TONE_MAP['grimoire-emeraude']['partie.cover_add'];
const validFile = () => new File(['bytes'], 'cover.jpg', { type: 'image/jpeg' });

interface Setup {
  fixture: ComponentFixture<EditableBanner>;
  el: HTMLElement;
  parties: { setCoverImage: ReturnType<typeof vi.fn>; removeCoverImage: ReturnType<typeof vi.fn> };
  snack: { open: ReturnType<typeof vi.fn> };
  dialog: { open: ReturnType<typeof vi.fn> };
  emitted: PartieDto[];
}

async function setup(
  partie: PartieDto,
  options: { theme?: Theme; confirm?: boolean } = {},
): Promise<Setup> {
  const theme = options.theme ?? 'grimoire-emeraude';
  const parties = {
    setCoverImage: vi.fn().mockResolvedValue({ ...partie, coverImageVersion: 'v2' }),
    removeCoverImage: vi.fn().mockResolvedValue({ ...partie, coverImageVersion: null }),
  };
  const snack = { open: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(options.confirm ?? true) })) };
  await TestBed.configureTestingModule({
    imports: [EditableBanner],
    providers: [
      { provide: PartiesService, useValue: parties },
      { provide: MatSnackBar, useValue: snack },
      { provide: MatDialog, useValue: dialog },
      {
        provide: ThemeToneService,
        useValue: { tone: signal(TONE_MAP[theme]), activeTheme: signal<Theme>(theme) },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(EditableBanner);
  fixture.componentRef.setInput('partie', partie);
  const emitted: PartieDto[] = [];
  fixture.componentInstance.partieChange.subscribe((p) => emitted.push(p));
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement, parties, snack, dialog, emitted };
}

/** Choisit un fichier sur le vrai champ du gabarit (teste le câblage `(change)`). */
function pick(el: HTMLElement, file: File): void {
  const input = el.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

const removeButton = (el: HTMLElement) =>
  el.querySelector('button.cover-chip') as HTMLButtonElement | null;
const chipTexts = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.cover-chip')).map((c) => c.textContent!.trim());

describe('EditableBanner (Story 53.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('droit de changer la couverture', () => {
    it('sans can.coverUpdate : la bannière s’affiche, aucune puce', async () => {
      const { el } = await setup(makePartie({ can: { coverUpdate: false } }));
      expect(el.querySelector('app-party-banner')).not.toBeNull();
      expect(el.querySelector('.cover-chips')).toBeNull();
      expect(el.querySelector('input[type="file"]')).toBeNull();
    });

    it('avec couverture : « Changer » et « Retirer »', async () => {
      const { el } = await setup(makePartie({ coverImageVersion: 'v1' }));
      expect(chipTexts(el)).toEqual(['Retirer', 'Changer']);
    });

    it('sans couverture : une seule puce d’ajout, pas de « Retirer »', async () => {
      const { el } = await setup(makePartie({ coverImageVersion: null }));
      expect(chipTexts(el)).toEqual([GRIMOIRE_ADD]);
      expect(removeButton(el)).toBeNull();
    });

    it('les puces sont sœurs de la bannière, jamais dedans (elle est aria-hidden)', async () => {
      const { el } = await setup(makePartie());
      const banner = el.querySelector('app-party-banner')!;
      expect(banner.querySelector('.cover-chip')).toBeNull();
      expect(banner.nextElementSibling?.classList.contains('cover-chips')).toBe(true);
    });

    it('la bannière lit la partie reçue, sans copie locale', async () => {
      const { fixture, el } = await setup(makePartie({ coverImageVersion: 'v1' }));
      expect(el.querySelector('img.party-banner')?.getAttribute('src')).toContain('v=v1');
      fixture.componentRef.setInput('partie', makePartie({ coverImageVersion: 'v7' }));
      fixture.detectChanges();
      expect(el.querySelector('img.party-banner')?.getAttribute('src')).toContain('v=v7');
    });
  });

  describe('accessibilité des puces', () => {
    it('« Changer » : champ fichier natif atteignable, pictogramme décoratif ; « Retirer » sans icône', async () => {
      const { el } = await setup(makePartie());
      const input = el.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).toBe('Changer — Changer l’enluminure');
      expect(input.hidden).toBe(false);
      expect(el.querySelector('label.cover-chip app-icon')?.getAttribute('data-icon')).toBe(
        'modifier',
      );
      expect(el.querySelector('label.cover-chip app-icon svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      expect(removeButton(el)!.getAttribute('aria-label')).toBe('Retirer — Retirer l’enluminure');
      expect(removeButton(el)!.querySelector('app-icon')).toBeNull();
    });

    it('sans couverture : la puce d’ajout porte la même icône et le même sélecteur', async () => {
      const { el } = await setup(makePartie({ coverImageVersion: null }));
      expect(el.querySelector('label.cover-chip app-icon')?.getAttribute('data-icon')).toBe(
        'modifier',
      );
      expect(el.querySelector('label.cover-chip input[type="file"]')).not.toBeNull();
    });
  });

  describe('« Changer »', () => {
    it('dépose l’image, rend la partie mise à jour puis avertit sans action', async () => {
      const { el, parties, snack, emitted } = await setup(makePartie());
      const file = validFile();
      pick(el, file);
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());

      expect(parties.setCoverImage).toHaveBeenCalledWith('party-1', file);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].coverImageVersion).toBe('v2');
      expect(snack.open).toHaveBeenCalledWith('Enluminure changée', undefined, {
        duration: expect.any(Number),
      });
    });

    it.each(THEMES.map((t) => [t] as const))(
      'avis « changée » dans la voix du thème %s, sans action',
      async (theme) => {
        const { el, snack } = await setup(makePartie(), { theme });
        pick(el, validFile());
        await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
        const [message, action] = snack.open.mock.calls[0];
        expect(message).toBe(TONE_MAP[theme]['partie.cover_changed']);
        expect(action).toBeUndefined();
      },
    );

    it('un fichier refusé (type) : avis de refus, aucun appel réseau', async () => {
      const { el, parties, snack, emitted } = await setup(makePartie());
      pick(el, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      expect(snack.open.mock.calls[0][0]).toBe(
        TONE_MAP['grimoire-emeraude']['partie.cover_reject_type'],
      );
      expect(parties.setCoverImage).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
    });

    it('un fichier refusé (taille > 5 Mo) : avis de refus, aucun appel réseau', async () => {
      const { el, parties, snack } = await setup(makePartie());
      const huge = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(huge, 'size', { value: 5 * 1024 * 1024 + 1 });
      pick(el, huge);
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      expect(snack.open.mock.calls[0][0]).toBe(
        TONE_MAP['grimoire-emeraude']['partie.cover_reject_size'],
      );
      expect(parties.setCoverImage).not.toHaveBeenCalled();
    });

    it('un échec d’envoi : avis d’erreur, la partie n’est pas rendue', async () => {
      const { el, parties, snack, emitted } = await setup(makePartie());
      parties.setCoverImage.mockRejectedValueOnce(new Error('boom'));
      pick(el, validFile());
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      expect(snack.open.mock.calls[0][0]).toBe(
        TONE_MAP['grimoire-emeraude']['partie.cover_upload_error'],
      );
      expect(snack.open.mock.calls[0][1]).toBeUndefined();
      expect(emitted).toHaveLength(0);
    });

    it('le champ fichier est remis à zéro après un choix (redéposer le même fichier redéclenche change)', async () => {
      const { el, snack } = await setup(makePartie());
      const input = el.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement;
      let value = 'C:\\fakepath\\cover.jpg';
      Object.defineProperty(input, 'value', {
        get: () => value,
        set: (v: string) => (value = v),
        configurable: true,
      });
      pick(el, validFile());
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      expect(input.value).toBe('');
    });

    it('un envoi déjà en cours (résultat null) : second choix sans partie rendue ni avis', async () => {
      const { el, parties, snack, emitted } = await setup(makePartie());
      let release!: () => void;
      parties.setCoverImage.mockImplementationOnce(
        () =>
          new Promise(
            (resolve) => (release = () => resolve(makePartie({ coverImageVersion: 'v2' }))),
          ),
      );
      pick(el, validFile());
      pick(el, validFile());
      await new Promise((r) => setTimeout(r));

      expect(parties.setCoverImage).toHaveBeenCalledTimes(1);
      expect(emitted).toHaveLength(0);
      expect(snack.open).not.toHaveBeenCalled();

      release();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalledTimes(1));
      expect(emitted).toHaveLength(1);
    });

    it('pendant un envoi : les puces sont désactivées et un double déclenchement n’envoie qu’une image', async () => {
      const { fixture, el, parties, snack } = await setup(makePartie());
      let release!: () => void;
      parties.setCoverImage.mockImplementationOnce(
        () =>
          new Promise(
            (resolve) => (release = () => resolve(makePartie({ coverImageVersion: 'v2' }))),
          ),
      );
      pick(el, validFile());
      pick(el, validFile());
      fixture.detectChanges();

      expect(parties.setCoverImage).toHaveBeenCalledTimes(1);
      expect(removeButton(el)!.disabled).toBe(true);
      expect(
        (el.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement).disabled,
      ).toBe(true);
      expect(el.querySelector('label.cover-chip')!.classList.contains('cover-chip--disabled')).toBe(
        true,
      );

      release();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalledTimes(1));
      fixture.detectChanges();
      expect(removeButton(el)!.disabled).toBe(false);
    });
  });

  describe('« Retirer »', () => {
    it('demande confirmation (destructive), retire, rend la partie et avertit', async () => {
      const { el, parties, snack, dialog, emitted } = await setup(makePartie());
      removeButton(el)!.click();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());

      const [component, config] = dialog.open.mock.calls[0] as unknown as [
        unknown,
        { data: { message: string; confirmLabel: string; destructive: boolean } },
      ];
      expect(component).toBe(ConfirmDialog);
      expect(config.data).toEqual({
        message: TONE_MAP['grimoire-emeraude']['partie.cover_remove_confirm'],
        confirmLabel: 'Retirer',
        destructive: true,
      });
      expect(parties.removeCoverImage).toHaveBeenCalledWith('party-1');
      expect(emitted).toHaveLength(1);
      expect(emitted[0].coverImageVersion).toBeNull();
      expect(snack.open).toHaveBeenCalledWith('Enluminure retirée', undefined, {
        duration: expect.any(Number),
      });
    });

    it.each(THEMES.map((t) => [t] as const))(
      'avis « retirée » dans la voix du thème %s',
      async (theme) => {
        const { el, snack } = await setup(makePartie(), { theme });
        removeButton(el)!.click();
        await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
        expect(snack.open.mock.calls[0][0]).toBe(TONE_MAP[theme]['partie.cover_removed']);
        expect(snack.open.mock.calls[0][1]).toBeUndefined();
      },
    );

    it('refuser la confirmation ne change rien', async () => {
      const { el, parties, snack, dialog, emitted } = await setup(makePartie(), { confirm: false });
      removeButton(el)!.click();
      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r));
      expect(parties.removeCoverImage).not.toHaveBeenCalled();
      expect(snack.open).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
    });

    it('après un retrait réussi, le focus passe au champ fichier restant', async () => {
      const { fixture, el, snack } = await setup(makePartie());
      removeButton(el)!.focus();
      removeButton(el)!.click();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      const input = el.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement;
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(document.activeElement).toBe(input);
      });
    });

    it('un retrait refusé ou en échec ne déplace pas le focus', async () => {
      const { fixture, el, parties, snack } = await setup(makePartie());
      parties.removeCoverImage.mockRejectedValueOnce(new Error('boom'));
      const button = removeButton(el)!;
      button.focus();
      button.click();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      fixture.detectChanges();
      expect(document.activeElement).toBe(button);
    });

    it('un échec de retrait : avis d’erreur, la partie n’est pas rendue', async () => {
      const { el, parties, snack, emitted } = await setup(makePartie());
      parties.removeCoverImage.mockRejectedValueOnce(new Error('boom'));
      removeButton(el)!.click();
      await vi.waitFor(() => expect(snack.open).toHaveBeenCalled());
      expect(snack.open.mock.calls[0][0]).toBe(
        TONE_MAP['grimoire-emeraude']['partie.cover_remove_error'],
      );
      expect(emitted).toHaveLength(0);
    });
  });
});
