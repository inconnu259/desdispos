import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import type { AvailableSlotDto, DaySlot, SlotStatus } from '@master-jdr/shared';
import type { IconName } from '../../../core/icons/icon-registry.generated';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ambiguousUserIds } from '../../../shared/identity/identity-ambiguity.util';
import { candidateSpanShort } from '../span-label';

const SLOT_LABELS: Record<string, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
};

// Les trois états se distinguent par la FORME du dessin, pas par la couleur d'un emoji.
const STATUS_ICONS: Record<SlotStatus, IconName> = {
  AVAILABLE: 'dispo-oui',
  UNKNOWN: 'dispo-partiel',
  UNAVAILABLE: 'dispo-non',
};

@Component({
  selector: 'app-creneau-card',
  standalone: true,
  imports: [IdentityLabel, NgTemplateOutlet, AppIcon],
  templateUrl: './creneau-card.html',
  styleUrl: './creneau-card.scss',
})
export class CreneauCard {
  readonly slot = input.required<AvailableSlotDto>();
  /** Story 46.2 — la carte peut être sélectionnée (la vue nominative du MJ seulement). */
  readonly selectable = input(false);
  readonly selected = input(false);
  /** Touché (ou entrée au clavier sur l'en-tête) : sélectionner, ou désélectionner si c'est déjà la carte choisie. */
  readonly selectToggled = output<void>();
  /** Story 46.3 — « Ajouter au vote » : la fenêtre part vers le composer. */
  readonly addRequested = output<void>();
  /** Story 46.3 — il y a un composer à armer (ou déjà armé) : sinon le bouton reste écrit mais désactivé, jamais muet. */
  readonly canAdd = input(true);
  /** Story 46.4 — « Masquer » sur la fenêtre sélectionnée. */
  readonly hideRequested = output<void>();
  /** Story 46.4 — la carte est celle d'une fenêtre MASQUÉE : 55 % d'opacité, non sélectionnable, « Démasquer ». */
  readonly hiddenWindow = input(false);
  readonly showRequested = output<void>();

  protected onAdd(): void {
    if (this.canAdd()) this.addRequested.emit();
  }
  protected readonly theme = inject(ThemeToneService);

  /** Story 47.6 — une fenêtre de plusieurs créneaux s'écrit sur UNE ligne « début → fin » (`span-label`), jamais en
   *  deux lignes jour/créneau ; un créneau seul garde son écriture. */
  protected readonly rangeLabel = computed(() =>
    candidateSpanShort({ date: this.slot().date, slot: this.slot().slot }, this.slot().durationSlots),
  );

  protected readonly allAvailable = computed(() =>
    this.slot().members.every((m) => m.status === 'AVAILABLE'),
  );

  protected readonly unknownMembers = computed(() =>
    this.slot().members.filter((m) => m.status === 'UNKNOWN'),
  );

  /** AC3 : distingue les membres homonymes par leur pseudo. */
  protected readonly ambiguousMembers = computed(() => ambiguousUserIds(this.slot().members));

  /** Un seul chemin pour le tap sur la carte et l'activation du bouton d'en-tête. */
  protected toggleSelection(event: Event): void {
    if (!this.selectable()) return;
    event.stopPropagation();
    this.selectToggled.emit();
  }

  protected isAmbiguous(userId: string): boolean {
    return this.ambiguousMembers().has(userId);
  }

  protected slotLabel(slot: DaySlot): string {
    return SLOT_LABELS[slot] ?? slot;
  }

  protected statusIcon(status: SlotStatus): IconName {
    return STATUS_ICONS[status];
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z');
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(d);
  }

  protected missingAlert(displayName: string): string {
    return this.theme.tone()['alert.missing_player'].replace('{name}', displayName);
  }
}
