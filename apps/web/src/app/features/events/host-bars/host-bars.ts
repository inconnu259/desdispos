import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import type { HostCountDto } from '@master-jdr/shared';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { EventsApiService } from '../events-api.service';

/** Largeur (px) de la barre du plus grand compte ; les autres sont au prorata (DESIGN.md §7.8). */
export const HOST_BAR_MAX_PX = 120;

/** Largeur de la barre d'un compte : proportionnelle au plus grand, arrondie au pixel, jamais nulle pour un
 *  compte positif. */
export function hostBarWidth(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.round((count / max) * HOST_BAR_MAX_PX));
}

interface HostRow {
  userId: string;
  label: string;
  count: number;
  width: number;
  /** Part (en %) de la piste de la barre : la même proportion à toute largeur d’écran. */
  percent: number;
}

/**
 * ⚠️ `HostBars` (Story 50.2, DESIGN.md §7.8) — « Qui reçoit », section repliable en tête de l'onglet « Détails »
 * d'un groupe de ralliement : une ligne par membre qui a reçu (nom, barre `accent-2` de 6 px, « {n} fois » à
 * droite), du plus au moins, puis « Jamais : {noms} » pour ceux qui n'ont jamais reçu. Aucun classement, aucune
 * médaille, aucune mise en avant : l'ordre de l'API est suivi tel quel. Chaque chiffre est écrit ; la barre est
 * décorative (`aria-hidden`). Ouverte au départ ; l'état replié n'est pas retenu.
 *
 * Temps réel : la section se relit sur `PartiesService.changed()` (annulation d'une conjonction, départ d'un
 * membre — déjà émis sur `partie:{id}`), sans nouveau handler. Une lecture dépassée par une plus récente est
 * ignorée ; un échec garde la liste déjà lue, ou montre le repli neutre à la première lecture.
 */
@Component({
  selector: 'app-host-bars',
  templateUrl: './host-bars.html',
  styleUrl: './host-bars.scss',
})
export class HostBars {
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  protected readonly theme = inject(ThemeToneService);

  readonly partieId = input.required<string>();

  /** `null` tant que la première lecture n'a pas abouti. */
  private readonly members = signal<HostCountDto[] | null>(null);
  protected readonly failed = signal(false);

  /** Numéro de la dernière lecture : une réponse plus ancienne n'écrase rien. */
  private sequence = 0;
  /** Le groupe de la dernière lecture : un autre groupe repart d’une section vierge. */
  private loadedPartieId: string | null = null;

  /** Noms affichés portés par plusieurs membres : départagés par le pseudo, comme « Missives ». */
  private readonly ambiguousNames = computed(() => {
    const idsByName = new Map<string, number>();
    for (const m of this.members() ?? []) {
      idsByName.set(m.displayName, (idsByName.get(m.displayName) ?? 0) + 1);
    }
    return new Set([...idsByName].filter(([, n]) => n > 1).map(([name]) => name));
  });

  private labelOf(member: HostCountDto): string {
    return this.ambiguousNames().has(member.displayName)
      ? `${member.displayName} (${member.pseudo})`
      : member.displayName;
  }

  protected readonly title = computed(() => this.theme.tone()['host_counts.title']);

  protected readonly hosts = computed<HostRow[]>(() => {
    const hosted = (this.members() ?? []).filter((m) => m.count > 0);
    const max = Math.max(0, ...hosted.map((m) => m.count));
    return hosted.map((m) => ({
      userId: m.userId,
      label: this.labelOf(m),
      count: m.count,
      width: hostBarWidth(m.count, max),
      percent: (hostBarWidth(m.count, max) / HOST_BAR_MAX_PX) * 100,
    }));
  });

  /** « Jamais : {noms} » — vide quand tout le monde a reçu. */
  protected readonly never = computed(() => {
    const names = (this.members() ?? [])
      .filter((m) => m.count === 0)
      .map((m) => this.labelOf(m))
      .join(', ');
    return names === '' ? null : fillTone(this.theme.tone()['host_counts.never'], { noms: names });
  });

  protected countLabel(count: number): string {
    return fillTone(this.theme.tone()['host_counts.times'], { n: count });
  }

  protected readonly loaded = computed(() => this.members() !== null);

  constructor() {
    // Première lecture, puis relecture sur chaque `changed` (temps réel) ou changement de groupe.
    effect(() => {
      const partieId = this.partieId();
      this.parties.changed();
      untracked(() => void this.load(partieId));
    });
  }

  private async load(partieId: string): Promise<void> {
    const seq = ++this.sequence;
    if (this.loadedPartieId !== null && this.loadedPartieId !== partieId) {
      // Un autre groupe : les hôtes du précédent ne survivent pas au changement.
      this.members.set(null);
      this.failed.set(false);
    }
    this.loadedPartieId = partieId;
    try {
      const result = await this.api.hostCounts(partieId);
      if (seq !== this.sequence) return;
      this.members.set(result.members);
      this.failed.set(false);
    } catch {
      if (seq !== this.sequence) return;
      // Toute panne garde la liste déjà lue ; à la première lecture, le repli neutre.
      if (this.members() === null) this.failed.set(true);
    }
  }
}
