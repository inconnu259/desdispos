import { Component, computed, inject, input } from '@angular/core';
import { API_BASE } from '../../../core/api-base';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';

export interface PortraitCropData {
  scale: number;
  offsetX: number;
  offsetY: number;
}

@Component({
  selector: 'app-character-avatar',
  standalone: true,
  templateUrl: './character-avatar.html',
  styleUrl: './character-avatar.scss',
})
export class CharacterAvatar {
  readonly name = input.required<string>();
  readonly size = input<26 | 38 | 44 | 64>(44);
  /** ID du personnage — requis dès qu'un `portraitUrl` est fourni (sert à construire l'URL protégée). */
  readonly characterId = input<string>('');
  /** Simple indicateur de présence d'un portrait (valeur elle-même non utilisée pour l'URL, cf. `characterId`). */
  readonly portraitUrl = input<string | null>(null);
  readonly cropData = input<PortraitCropData | null>(null);

  private readonly theme = inject(ThemeToneService);

  private static readonly FONT_SIZE_BY_SIZE: Record<26 | 38 | 44 | 64, number> = {
    26: 10,
    38: 14,
    44: 16,
    64: 24,
  };

  protected readonly fontSize = computed(() => CharacterAvatar.FONT_SIZE_BY_SIZE[this.size()]);

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  protected readonly absolutePortraitUrl = computed(() => {
    if (!this.portraitUrl()) return null;
    // Route protégée (AuthenticatedGuard) — jamais le chemin de fichier statique brut, cf. Story 4.5 review.
    return `${API_BASE}/characters/${this.characterId()}/portrait`;
  });

  protected readonly transform = computed(() => {
    const c = this.cropData() ?? { scale: 1, offsetX: 0, offsetY: 0 };
    return `translate(${c.offsetX}%, ${c.offsetY}%) scale(${c.scale})`;
  });

  protected readonly ariaLabel = computed(() =>
    fillTone(
      this.theme.tone()[this.portraitUrl() ? 'portrait.avatar_aria' : 'portrait.avatar_aria_empty'],
      { name: this.name() },
    ),
  );
}
