import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { CharacterDto } from '@master-jdr/shared';
import { CharacterService } from '../../../../core/characters/character.service';
import { isFieldHidden } from '../../../../core/characters/character.util';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { EncumbranceBar } from './encumbrance-bar';
import { InventoryItemRow, type InventoryItemView } from './inventory-item-row';

@Component({
  selector: 'app-inventory-tab',
  standalone: true,
  imports: [MatButtonModule, EncumbranceBar, InventoryItemRow],
  templateUrl: './inventory-tab.html',
  styleUrl: './inventory-tab.scss',
})
export class InventoryTab {
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);

  readonly character = input.required<CharacterDto>();
  readonly isOwner = input.required<boolean>();
  readonly viewerIsMj = input(false);
  readonly characterUpdated = output<CharacterDto>();

  /** Correctif de revue (session bmad-build, 2026-09-22) : `equipment` retiré par un cadenas de
   *  visibilité (Story 31.6/31.7) ne doit jamais être confondu avec un inventaire réellement vide —
   *  sinon un coéquipier verrait « La besace est vide » alors que le MJ a simplement masqué son
   *  contenu. Délègue à `isFieldHidden()` (`character.util.ts`), partagée avec `CharacterSheet`. */
  protected readonly equipmentHidden = computed(() => isFieldHidden(this.character(), 'equipment'));

  /** `equipment.*` n'est pas exposé par `CharacterDto` (type `SheetData` générique côté
   *  `packages/shared`) — même stratégie de cast que `capability-label.util.ts` pour `levelUps`. */
  protected readonly individual = computed<InventoryItemView[]>(
    () =>
      ((this.character().sheetData as any)?.equipment?.individual as
        InventoryItemView[] | undefined) ?? [],
  );

  protected readonly contenants = computed<InventoryItemView[]>(
    () =>
      ((this.character().sheetData as any)?.equipment?.contenants as
        InventoryItemView[] | undefined) ?? [],
  );

  protected readonly animaux = computed<InventoryItemView[]>(
    () =>
      ((this.character().sheetData as any)?.equipment?.animaux as
        InventoryItemView[] | undefined) ?? [],
  );

  /** Poids total = objets + contenants — les animaux n'ont jamais de poids (FR8). */
  protected readonly totalWeight = computed(
    () =>
      this.individual().reduce((sum, item) => sum + (item.weight ?? 0), 0) +
      this.contenants().reduce((sum, item) => sum + (item.weight ?? 0), 0),
  );

  // ─── Objets (individual) ───────────────────────────────────────────────

  protected readonly newItemName = signal('');
  protected readonly newItemWeight = signal<number | undefined>(undefined);
  protected readonly newItemPrice = signal<string | undefined>(undefined);
  protected readonly newItemEffect = signal<string | undefined>(undefined);

  protected readonly editingId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editWeight = signal<number | undefined>(undefined);
  protected readonly editPrice = signal<string | undefined>(undefined);
  protected readonly editEffect = signal<string | undefined>(undefined);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submitAdd(): Promise<void> {
    const name = this.newItemName().trim();
    if (!name || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const weight = this.newItemWeight();
      const updated = await this.characterSvc.addInventoryItem(this.character().id, {
        name,
        ...(weight !== undefined && weight !== null ? { weight } : {}),
        ...(this.newItemPrice() ? { price: this.newItemPrice() } : {}),
        ...(this.newItemEffect() ? { effect: this.newItemEffect() } : {}),
      });
      this.characterUpdated.emit(updated);
      this.newItemName.set('');
      this.newItemWeight.set(undefined);
      this.newItemPrice.set(undefined);
      this.newItemEffect.set(undefined);
    } catch {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  protected startEdit(item: InventoryItemView): void {
    this.editingId.set(item.id);
    this.editName.set(item.name);
    this.editWeight.set(item.weight);
    this.editPrice.set(item.price);
    this.editEffect.set(item.effect);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  /**
   * Normalise le contenu brut d'un `<input type="number">` : une valeur vide donne
   * `valueAsNumber = NaN`, jamais capturé par `?? 0` (revue de code — vider le champ pour
   * remettre le poids à 0 était silencieusement ignoré, l'ancien poids était conservé).
   */
  protected onEditWeightInput(value: number): void {
    this.editWeight.set(Number.isNaN(value) ? 0 : value);
  }

  protected async submitEdit(itemId: string): Promise<void> {
    const name = this.editName().trim();
    if (!name || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const updated = await this.characterSvc.updateInventoryItem(this.character().id, itemId, {
        name,
        weight: this.editWeight() ?? 0,
        price: this.editPrice(),
        effect: this.editEffect(),
      });
      this.characterUpdated.emit(updated);
      this.editingId.set(null);
    } catch {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Édition MJ d'une ligne existante (Story 6.6, AD-6) — via `sheet-field`, pas `updateInventoryItem` (propriétaire seul).
   *  Envoie `id: itemId` pour que le serveur revérifie que l'objet à cet index est toujours celui visé
   *  (revue de code — un index calculé côté client peut être obsolète si le tableau a changé entretemps). */
  protected async submitMjEdit(itemId: string): Promise<void> {
    const name = this.editName().trim();
    if (!name || this.submitting()) return;
    const index = this.individual().findIndex((i) => i.id === itemId);
    if (index === -1) {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
      this.editingId.set(null);
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.individual.${index}`,
        {
          name,
          weight: this.editWeight() ?? 0,
          price: this.editPrice(),
          effect: this.editEffect(),
          id: itemId,
        },
      );
      this.characterUpdated.emit(result.character);
      this.editingId.set(null);
    } catch {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Ajout MJ d'un nouvel objet (Story 6.6, UJ Sylas — objet narratif reçu hors-jeu). */
  protected async submitMjAdd(): Promise<void> {
    const name = this.newItemName().trim();
    if (!name || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.individual.${this.individual().length}`,
        {
          name,
          weight: this.newItemWeight() ?? 0,
          price: this.newItemPrice(),
          effect: this.newItemEffect(),
        },
      );
      this.characterUpdated.emit(result.character);
      this.newItemName.set('');
      this.newItemWeight.set(undefined);
      this.newItemPrice.set(undefined);
      this.newItemEffect.set(undefined);
    } catch {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async removeItem(itemId: string): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const updated = await this.characterSvc.removeInventoryItem(this.character().id, itemId);
      this.characterUpdated.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  // ─── Contenants ─────────────────────────────────────────────────────────
  // État volontairement indépendant de celui des objets (individual) et des animaux — ne jamais
  // partager un signal `pending`/erreur/édition entre sections indépendantes (piège déjà rencontré
  // 2 fois dans ce projet, Stories 12.2 et 13.1).

  protected readonly newContenantName = signal('');
  protected readonly newContenantWeight = signal<number | undefined>(undefined);
  protected readonly newContenantPrice = signal<string | undefined>(undefined);
  protected readonly newContenantEffect = signal<string | undefined>(undefined);

  protected readonly editingContenantId = signal<string | null>(null);
  protected readonly editContenantName = signal('');
  protected readonly editContenantWeight = signal<number | undefined>(undefined);
  protected readonly editContenantPrice = signal<string | undefined>(undefined);
  protected readonly editContenantEffect = signal<string | undefined>(undefined);

  protected readonly contenantSubmitting = signal(false);
  protected readonly contenantError = signal<string | null>(null);

  /**
   * `valueAsNumber || undefined` (patron `individual`, où le poids est facultatif) traiterait à
   * tort `0` comme absent — un poids de contenant à `0` est une valeur légitime (AC3, poids
   * obligatoire mais peut valoir zéro). Seul `NaN` (champ vidé) doit devenir `undefined`.
   */
  protected onNewContenantWeightInput(value: number): void {
    this.newContenantWeight.set(Number.isNaN(value) ? undefined : value);
  }

  /**
   * Contrairement à `onEditWeightInput` (individual, poids facultatif → NaN devient 0), le poids
   * du contenant est obligatoire (AC3) — un champ vidé doit rester détectable comme "non renseigné"
   * pour que les gardes de `submitEditContenant`/`submitMjEditContenant` puissent bloquer l'envoi.
   */
  protected onEditContenantWeightInput(value: number): void {
    this.editContenantWeight.set(Number.isNaN(value) ? undefined : value);
  }

  protected async submitAddContenant(): Promise<void> {
    const name = this.newContenantName().trim();
    const weight = this.newContenantWeight();
    if (!name || weight === undefined || this.contenantSubmitting()) return;
    this.contenantSubmitting.set(true);
    this.contenantError.set(null);
    try {
      const updated = await this.characterSvc.addContenant(this.character().id, {
        name,
        weight,
        ...(this.newContenantPrice() ? { price: this.newContenantPrice() } : {}),
        ...(this.newContenantEffect() ? { effect: this.newContenantEffect() } : {}),
      });
      this.characterUpdated.emit(updated);
      this.newContenantName.set('');
      this.newContenantWeight.set(undefined);
      this.newContenantPrice.set(undefined);
      this.newContenantEffect.set(undefined);
    } catch {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.contenantSubmitting.set(false);
    }
  }

  protected startEditContenant(item: InventoryItemView): void {
    this.editingContenantId.set(item.id);
    this.editContenantName.set(item.name);
    this.editContenantWeight.set(item.weight);
    this.editContenantPrice.set(item.price);
    this.editContenantEffect.set(item.effect);
  }

  protected cancelEditContenant(): void {
    this.editingContenantId.set(null);
  }

  protected async submitEditContenant(itemId: string): Promise<void> {
    const name = this.editContenantName().trim();
    const weight = this.editContenantWeight();
    if (!name || weight === undefined || this.contenantSubmitting()) return;
    this.contenantSubmitting.set(true);
    this.contenantError.set(null);
    try {
      const updated = await this.characterSvc.updateContenant(this.character().id, itemId, {
        name,
        weight,
        price: this.editContenantPrice(),
        effect: this.editContenantEffect(),
      });
      this.characterUpdated.emit(updated);
      this.editingContenantId.set(null);
    } catch {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.contenantSubmitting.set(false);
    }
  }

  protected async submitMjEditContenant(itemId: string): Promise<void> {
    const name = this.editContenantName().trim();
    const weight = this.editContenantWeight();
    if (!name || weight === undefined || this.contenantSubmitting()) return;
    const index = this.contenants().findIndex((i) => i.id === itemId);
    if (index === -1) {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
      this.editingContenantId.set(null);
      return;
    }
    this.contenantSubmitting.set(true);
    this.contenantError.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.contenants.${index}`,
        {
          name,
          weight,
          price: this.editContenantPrice(),
          effect: this.editContenantEffect(),
          id: itemId,
        },
      );
      this.characterUpdated.emit(result.character);
      this.editingContenantId.set(null);
    } catch {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.contenantSubmitting.set(false);
    }
  }

  protected async submitMjAddContenant(): Promise<void> {
    const name = this.newContenantName().trim();
    const weight = this.newContenantWeight();
    if (!name || weight === undefined || this.contenantSubmitting()) return;
    this.contenantSubmitting.set(true);
    this.contenantError.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.contenants.${this.contenants().length}`,
        {
          name,
          weight,
          price: this.newContenantPrice(),
          effect: this.newContenantEffect(),
        },
      );
      this.characterUpdated.emit(result.character);
      this.newContenantName.set('');
      this.newContenantWeight.set(undefined);
      this.newContenantPrice.set(undefined);
      this.newContenantEffect.set(undefined);
    } catch {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.contenantSubmitting.set(false);
    }
  }

  protected async removeContenant(itemId: string): Promise<void> {
    if (this.contenantSubmitting()) return;
    this.contenantSubmitting.set(true);
    this.contenantError.set(null);
    try {
      const updated = await this.characterSvc.removeContenant(this.character().id, itemId);
      this.characterUpdated.emit(updated);
    } catch {
      this.contenantError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.contenantSubmitting.set(false);
    }
  }

  // ─── Animaux ────────────────────────────────────────────────────────────
  // Jamais de signal/paramètre lié au poids — un animal n'a jamais de poids (FR8).

  protected readonly newAnimalName = signal('');
  protected readonly newAnimalPrice = signal<string | undefined>(undefined);
  protected readonly newAnimalEffect = signal<string | undefined>(undefined);

  protected readonly editingAnimalId = signal<string | null>(null);
  protected readonly editAnimalName = signal('');
  protected readonly editAnimalPrice = signal<string | undefined>(undefined);
  protected readonly editAnimalEffect = signal<string | undefined>(undefined);

  protected readonly animalSubmitting = signal(false);
  protected readonly animalError = signal<string | null>(null);

  protected async submitAddAnimal(): Promise<void> {
    const name = this.newAnimalName().trim();
    if (!name || this.animalSubmitting()) return;
    this.animalSubmitting.set(true);
    this.animalError.set(null);
    try {
      const updated = await this.characterSvc.addAnimal(this.character().id, {
        name,
        ...(this.newAnimalPrice() ? { price: this.newAnimalPrice() } : {}),
        ...(this.newAnimalEffect() ? { effect: this.newAnimalEffect() } : {}),
      });
      this.characterUpdated.emit(updated);
      this.newAnimalName.set('');
      this.newAnimalPrice.set(undefined);
      this.newAnimalEffect.set(undefined);
    } catch {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.animalSubmitting.set(false);
    }
  }

  protected startEditAnimal(item: InventoryItemView): void {
    this.editingAnimalId.set(item.id);
    this.editAnimalName.set(item.name);
    this.editAnimalPrice.set(item.price);
    this.editAnimalEffect.set(item.effect);
  }

  protected cancelEditAnimal(): void {
    this.editingAnimalId.set(null);
  }

  protected async submitEditAnimal(itemId: string): Promise<void> {
    const name = this.editAnimalName().trim();
    if (!name || this.animalSubmitting()) return;
    this.animalSubmitting.set(true);
    this.animalError.set(null);
    try {
      const updated = await this.characterSvc.updateAnimal(this.character().id, itemId, {
        name,
        price: this.editAnimalPrice(),
        effect: this.editAnimalEffect(),
      });
      this.characterUpdated.emit(updated);
      this.editingAnimalId.set(null);
    } catch {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.animalSubmitting.set(false);
    }
  }

  protected async submitMjEditAnimal(itemId: string): Promise<void> {
    const name = this.editAnimalName().trim();
    if (!name || this.animalSubmitting()) return;
    const index = this.animaux().findIndex((i) => i.id === itemId);
    if (index === -1) {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
      this.editingAnimalId.set(null);
      return;
    }
    this.animalSubmitting.set(true);
    this.animalError.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.animaux.${index}`,
        {
          name,
          price: this.editAnimalPrice(),
          effect: this.editAnimalEffect(),
          id: itemId,
        },
      );
      this.characterUpdated.emit(result.character);
      this.editingAnimalId.set(null);
    } catch {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.animalSubmitting.set(false);
    }
  }

  protected async submitMjAddAnimal(): Promise<void> {
    const name = this.newAnimalName().trim();
    if (!name || this.animalSubmitting()) return;
    this.animalSubmitting.set(true);
    this.animalError.set(null);
    try {
      const result = await this.characterSvc.setSheetField(
        this.character().id,
        `equipment.animaux.${this.animaux().length}`,
        {
          name,
          price: this.newAnimalPrice(),
          effect: this.newAnimalEffect(),
        },
      );
      this.characterUpdated.emit(result.character);
      this.newAnimalName.set('');
      this.newAnimalPrice.set(undefined);
      this.newAnimalEffect.set(undefined);
    } catch {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.animalSubmitting.set(false);
    }
  }

  protected async removeAnimal(itemId: string): Promise<void> {
    if (this.animalSubmitting()) return;
    this.animalSubmitting.set(true);
    this.animalError.set(null);
    try {
      const updated = await this.characterSvc.removeAnimal(this.character().id, itemId);
      this.characterUpdated.emit(updated);
    } catch {
      this.animalError.set(this.theme.tone()['evolution.inventory_error']);
    } finally {
      this.animalSubmitting.set(false);
    }
  }
}
