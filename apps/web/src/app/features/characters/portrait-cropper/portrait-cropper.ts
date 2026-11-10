import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RYUUTAMA_PDF_PORTRAIT_ASPECT_RATIO } from '@master-jdr/shared';
import { CharacterService } from '../../../core/characters/character.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

export interface PortraitCropData {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PortraitCropResult {
  file: File;
  cropData: PortraitCropData;
}

/** Passé via `MatDialog.open(PortraitCropper, { data })` pour permettre l'ajustement du recadrage d'un portrait déjà existant (AC4), sans que l'utilisateur ait à re-choisir un fichier depuis son appareil. */
export interface PortraitCropperData {
  characterId: string;
  /** Recadrage déjà enregistré à reprendre (Story 4.7, mode `rect`) plutôt que de repartir de zéro. */
  initialCropData?: PortraitCropData | null;
  /**
   * Surcharge `shape` quand le composant est ouvert via `MatDialog` (les `input()` ne sont pas
   * bindables sur un composant instancié par `MatDialog.open()` — seul `MAT_DIALOG_DATA` l'est).
   * Ignoré en usage direct dans un template (assistant de création), où `[shape]` suffit.
   */
  shape?: 'circle' | 'rect';
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.1;
const MOVE_STEP = 5;
const DRAG_SENSITIVITY = 0.5;
/** Mêmes bornes que `PortraitCropDataDto` côté serveur — au-delà, l'image sort entièrement du cadre circulaire. */
const MIN_OFFSET = -100;
const MAX_OFFSET = 100;

function clampOffset(value: number): number {
  return Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, value));
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

@Component({
  selector: 'app-portrait-cropper',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './portrait-cropper.html',
  styleUrl: './portrait-cropper.scss',
})
export class PortraitCropper implements OnInit, OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<PortraitCropper, PortraitCropResult | null>>(
    MatDialogRef,
    { optional: true },
  );
  private readonly dialogData = inject<PortraitCropperData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);

  /** Affiche "Passer cette étape" (contexte assistant) plutôt que "Annuler" (contexte fiche/dialogue). */
  readonly showSkip = input(false);

  /**
   * `circle` = avatar web (défaut, comportement inchangé) ; `rect` = cadre de l'export PDF
   * (Story 4.7), au ratio réel du template (`RYUUTAMA_PDF_PORTRAIT_ASPECT_RATIO`).
   */
  readonly shape = input<'circle' | 'rect'>('circle');

  /** `dialogData.shape` prime sur l'`input()` (cf. `PortraitCropperData.shape`). */
  protected readonly effectiveShape = computed(() => this.dialogData?.shape ?? this.shape());

  protected readonly aspectRatio = RYUUTAMA_PDF_PORTRAIT_ASPECT_RATIO;

  readonly skip = output<void>();
  readonly saved = output<PortraitCropResult>();

  protected readonly file = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly scale = signal(1);
  protected readonly offsetX = signal(0);
  protected readonly offsetY = signal(0);
  protected readonly loadingExisting = signal(false);

  protected readonly transform = computed(
    () => `translate(${this.offsetX()}%, ${this.offsetY()}%) scale(${this.scale()})`,
  );

  private dragging = false;
  private dragStart = { x: 0, y: 0 };

  async ngOnInit(): Promise<void> {
    const characterId = this.dialogData?.characterId;
    if (!characterId) return;
    this.loadingExisting.set(true);
    try {
      const blob = await this.characterSvc.getPortraitBlob(characterId);
      this.file.set(new File([blob], 'portrait-existant', { type: blob.type }));
      this.previewUrl.set(URL.createObjectURL(blob));
      const initial = this.dialogData?.initialCropData;
      // Clampé aux bornes valides plutôt qu'appliqué tel quel : une donnée legacy/corrompue
      // (NaN, hors bornes) ne doit jamais casser le slider ni produire un recadrage invalide.
      if (initial && Number.isFinite(initial.scale)) {
        this.scale.set(clampScale(initial.scale));
      }
      if (initial && Number.isFinite(initial.offsetX)) {
        this.offsetX.set(clampOffset(initial.offsetX));
      }
      if (initial && Number.isFinite(initial.offsetY)) {
        this.offsetY.set(clampOffset(initial.offsetY));
      }
    } catch {
      // Pas de portrait existant (personnage sans portrait) ou erreur réseau : l'utilisateur
      // repart simplement d'une sélection de fichier classique, aucun message d'erreur nécessaire.
    } finally {
      this.loadingExisting.set(false);
    }
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (!selected) return;
    this.revokePreview();
    this.file.set(selected);
    this.scale.set(1);
    this.offsetX.set(0);
    this.offsetY.set(0);
    this.previewUrl.set(URL.createObjectURL(selected));
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        this.offsetX.update((v) => clampOffset(v - MOVE_STEP));
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.offsetX.update((v) => clampOffset(v + MOVE_STEP));
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.offsetY.update((v) => clampOffset(v - MOVE_STEP));
        event.preventDefault();
        break;
      case 'ArrowDown':
        this.offsetY.update((v) => clampOffset(v + MOVE_STEP));
        event.preventDefault();
        break;
      case '+':
      case 'PageUp':
        this.scale.update((v) => Math.min(MAX_SCALE, v + ZOOM_STEP));
        event.preventDefault();
        break;
      case '-':
      case 'PageDown':
        this.scale.update((v) => Math.max(MIN_SCALE, v - ZOOM_STEP));
        event.preventDefault();
        break;
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    // Capture le pointeur : les événements suivants (move/up) continuent d'arriver ici même si
    // le curseur sort du petit cercle de prévisualisation pendant un pan un peu long — sans ça,
    // `pointerleave` coupait le pan en route et le navigateur reprenait la main pour démarrer
    // son propre drag-and-drop natif sur l'image.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.offsetX.update((v) => clampOffset(v + dx * DRAG_SENSITIVITY));
    this.offsetY.update((v) => clampOffset(v + dy * DRAG_SENSITIVITY));
  }

  protected onPointerUp(event: PointerEvent): void {
    this.dragging = false;
    if (
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  protected onZoomChange(value: number): void {
    if (Number.isNaN(value)) return;
    this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)));
  }

  protected skipStep(): void {
    this.skip.emit();
  }

  protected save(): void {
    const file = this.file();
    if (!file) return;
    const result: PortraitCropResult = {
      file,
      cropData: { scale: this.scale(), offsetX: this.offsetX(), offsetY: this.offsetY() },
    };
    this.saved.emit(result);
    this.dialogRef?.close(result);
  }

  protected cancel(): void {
    this.dialogRef?.close(null);
  }

  private revokePreview(): void {
    const current = this.previewUrl();
    if (current) URL.revokeObjectURL(current);
  }
}
