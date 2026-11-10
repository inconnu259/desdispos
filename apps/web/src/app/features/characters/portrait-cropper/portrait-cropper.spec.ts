import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { PortraitCropper, type PortraitCropperData } from './portrait-cropper';
import { CharacterService } from '../../../core/characters/character.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeCharacterService(overrides: Partial<CharacterService> = {}) {
  return {
    getPortraitBlob: vi.fn().mockRejectedValue(new Error('404')),
    ...overrides,
  };
}

function makeFile(name = 'portrait.jpg', type = 'image/jpeg'): File {
  return new File(['fake-bytes'], name, { type });
}

function selectFile(fixture: ReturnType<typeof TestBed.createComponent>, file: File) {
  const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

/** jsdom ne fournit pas toujours le constructeur `PointerEvent` — on construit un `Event` générique
 * et on y assigne les propriétés attendues (clientX/clientY/pointerId), suffisant pour le code testé. */
function pointerEvent(
  type: string,
  props: Partial<{ clientX: number; clientY: number; pointerId: number }> = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  return Object.assign(event, props);
}

function stubPointerCapture(el: HTMLElement) {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  const hasPointerCapture = vi.fn(() => true);
  Object.defineProperty(el, 'setPointerCapture', { value: setPointerCapture, configurable: true });
  Object.defineProperty(el, 'releasePointerCapture', {
    value: releasePointerCapture,
    configurable: true,
  });
  Object.defineProperty(el, 'hasPointerCapture', { value: hasPointerCapture, configurable: true });
  return { setPointerCapture, releasePointerCapture, hasPointerCapture };
}

describe('PortraitCropper', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  function setup(
    showSkip = false,
    dialogRef: Partial<MatDialogRef<PortraitCropper>> | null = null,
    characterSvc = makeCharacterService(),
    dialogData: PortraitCropperData | null = null,
  ) {
    TestBed.configureTestingModule({
      imports: [PortraitCropper],
      providers: [
        { provide: CharacterService, useValue: characterSvc },
        ...(dialogRef ? [{ provide: MatDialogRef, useValue: dialogRef }] : []),
        ...(dialogData ? [{ provide: MAT_DIALOG_DATA, useValue: dialogData }] : []),
      ],
    });
    const fixture = TestBed.createComponent(PortraitCropper);
    fixture.componentRef.setInput('showSkip', showSkip);
    fixture.detectChanges();
    return fixture;
  }

  it("bouton Enregistrer désactivé tant qu'aucun fichier n'est sélectionné", () => {
    const fixture = setup();
    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    expect(saveBtn.disabled).toBe(true);
  });

  it("sélection de fichier active le bouton Enregistrer et affiche l'aperçu", () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    expect(saveBtn.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.portrait-cropper__preview')).not.toBeNull();
  });

  it('flèches clavier déplacent le crop (offsetX/offsetY), +/- zoome (scale)', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;

    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    preview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    preview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    preview.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    fixture.detectChanges();

    expect(comp.offsetX()).toBeGreaterThan(0);
    expect(comp.offsetY()).toBeGreaterThan(0);
    expect(comp.scale()).toBeGreaterThan(1);
  });

  it('pointerdown capture le pointeur (empêche le drag-and-drop natif du navigateur sur un pan long)', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    const { setPointerCapture } = stubPointerCapture(preview);

    preview.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));

    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('pan par pointeur (pointerdown puis pointermove) déplace le crop', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    stubPointerCapture(preview);

    preview.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));
    preview.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 10 }));
    fixture.detectChanges();

    expect(comp.offsetX()).toBeGreaterThan(0);
    expect(comp.offsetY()).toBeGreaterThan(0);
  });

  it('un pan long qui sortirait du cadre circulaire (pointerleave) ne coupe plus le déplacement, grâce à la capture de pointeur', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    stubPointerCapture(preview);

    preview.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));
    // Simule le curseur sortant du petit cercle de prévisualisation (220px) pendant un pan un peu
    // long : avec la capture de pointeur, le navigateur ne le traite plus comme une sortie de zone.
    preview.dispatchEvent(new Event('pointerleave'));
    preview.dispatchEvent(pointerEvent('pointermove', { clientX: 150, clientY: 150 }));
    fixture.detectChanges();

    expect(comp.offsetX()).toBeGreaterThan(0);
    expect(comp.offsetY()).toBeGreaterThan(0);
  });

  it('pointerup relâche la capture de pointeur', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    const { releasePointerCapture } = stubPointerCapture(preview);

    preview.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));
    preview.dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }));

    expect(releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('le zoom ne dépasse jamais [1, 3]', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;

    comp.onZoomChange(10);
    expect(comp.scale()).toBe(3);
    comp.onZoomChange(-5);
    expect(comp.scale()).toBe(1);
  });

  it('onZoomChange(NaN) (valeur de slider invalide) → scale inchangé plutôt que NaN', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;

    comp.onZoomChange(2);
    comp.onZoomChange(NaN);

    expect(comp.scale()).toBe(2);
  });

  it('déplacement clavier au-delà de 100% est borné (image jamais totalement hors du cadre)', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const comp = fixture.componentInstance as any;
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');

    for (let i = 0; i < 30; i++) {
      preview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }

    expect(comp.offsetX()).toBe(100);
  });

  it("personnage avec un portrait existant (données de dialogue) → précharge l'image pour permettre un réajustement sans re-sélection de fichier (AC4)", async () => {
    const blob = new Blob(['existing-bytes'], { type: 'image/jpeg' });
    const characterSvc = makeCharacterService({
      getPortraitBlob: vi.fn().mockResolvedValue(blob),
    });
    const fixture = setup(false, null, characterSvc, { characterId: 'char1' });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.getPortraitBlob).toHaveBeenCalledWith('char1');
    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    expect(saveBtn.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.portrait-cropper__preview')).not.toBeNull();
  });

  it('personnage sans portrait existant (404) → ne bloque pas, retombe sur la sélection de fichier classique', async () => {
    const characterSvc = makeCharacterService({
      getPortraitBlob: vi.fn().mockRejectedValue(new Error('404')),
    });
    const fixture = setup(false, null, characterSvc, { characterId: 'char1' });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    expect(saveBtn.disabled).toBe(true);
  });

  it('save() émet {file, cropData} avec les valeurs courantes', () => {
    const fixture = setup();
    const file = makeFile();
    selectFile(fixture, file);
    const comp = fixture.componentInstance;
    const savedSpy = vi.fn();
    comp.saved.subscribe(savedSpy);

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    saveBtn.click();

    expect(savedSpy).toHaveBeenCalledWith({
      file,
      cropData: { scale: 1, offsetX: 0, offsetY: 0 },
    });
  });

  it('contexte assistant (showSkip=true) : bouton "Passer cette étape" émet skip()', () => {
    const fixture = setup(true);
    const comp = fixture.componentInstance;
    const skipSpy = vi.fn();
    comp.skip.subscribe(skipSpy);

    const skipBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button:not([color="primary"])',
    );
    expect(skipBtn.textContent?.trim()).toBe(GRIMOIRE_TONE['common.passer_cette_etape']);
    skipBtn.click();
    expect(skipSpy).toHaveBeenCalled();
  });

  it('contexte dialogue (showSkip=false, MatDialogRef présent) : Annuler ferme le dialogue avec null, Enregistrer avec le résultat', () => {
    const close = vi.fn();
    const fixture = setup(false, { close });
    const file = makeFile();
    selectFile(fixture, file);

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button[color="primary"]',
    );
    saveBtn.click();
    expect(close).toHaveBeenCalledWith({ file, cropData: { scale: 1, offsetX: 0, offsetY: 0 } });
  });

  it('Annuler ferme le dialogue avec null', () => {
    const close = vi.fn();
    const fixture = setup(false, { close });

    const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.portrait-cropper__actions button:not([color="primary"])',
    );
    expect(cancelBtn.textContent?.trim()).toBe(GRIMOIRE_TONE['common.annuler']);
    cancelBtn.click();
    expect(close).toHaveBeenCalledWith(null);
  });

  it('shape par défaut (circle) → pas de classe --rect (comportement avatar web inchangé)', () => {
    const fixture = setup();
    selectFile(fixture, makeFile());
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    expect(preview.classList.contains('portrait-cropper__preview--rect')).toBe(false);
  });

  it("shape='rect' → classe --rect appliquée (masque du cadre PDF, Story 4.7)", () => {
    const fixture = setup();
    fixture.componentRef.setInput('shape', 'rect');
    fixture.detectChanges();
    selectFile(fixture, makeFile());
    const preview: HTMLElement = fixture.nativeElement.querySelector('.portrait-cropper__preview');
    expect(preview.classList.contains('portrait-cropper__preview--rect')).toBe(true);
  });

  it('initialCropData (dialogData) → précharge scale/offsetX/offsetY au lieu de repartir de zéro', async () => {
    const blob = new Blob(['existing-bytes'], { type: 'image/jpeg' });
    const characterSvc = makeCharacterService({
      getPortraitBlob: vi.fn().mockResolvedValue(blob),
    });
    const fixture = setup(false, null, characterSvc, {
      characterId: 'char1',
      initialCropData: { scale: 2, offsetX: 15, offsetY: -30 },
    });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.scale()).toBe(2);
    expect(comp.offsetX()).toBe(15);
    expect(comp.offsetY()).toBe(-30);
  });

  it("initialCropData hors bornes (donnée legacy/corrompue) → clampé aux bornes valides plutôt qu'appliqué tel quel", async () => {
    const blob = new Blob(['existing-bytes'], { type: 'image/jpeg' });
    const characterSvc = makeCharacterService({
      getPortraitBlob: vi.fn().mockResolvedValue(blob),
    });
    const fixture = setup(false, null, characterSvc, {
      characterId: 'char1',
      initialCropData: { scale: 50, offsetX: 500, offsetY: -500 },
    });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.scale()).toBe(3);
    expect(comp.offsetX()).toBe(100);
    expect(comp.offsetY()).toBe(-100);
  });

  it('initialCropData avec scale NaN → ignoré, scale reste à sa valeur par défaut (1)', async () => {
    const blob = new Blob(['existing-bytes'], { type: 'image/jpeg' });
    const characterSvc = makeCharacterService({
      getPortraitBlob: vi.fn().mockResolvedValue(blob),
    });
    const fixture = setup(false, null, characterSvc, {
      characterId: 'char1',
      initialCropData: { scale: NaN, offsetX: 0, offsetY: 0 },
    });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.scale()).toBe(1);
  });
});
