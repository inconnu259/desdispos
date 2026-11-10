import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { LIST_VIEW_MODES, type ListViewMode } from '@master-jdr/shared';
import { AppIcon } from '../../core/icons/app-icon';
import type { IconName } from '../../core/icons/icon-registry.generated';
import { ThemeToneService } from '../../core/theme/theme-tone.service';

export interface ListControlBarSortOption {
  value: string;
  label: string;
}

/** Seuil de défilement minimal (Story 29.9, AC5) — un tremblement de quelques pixels ne doit
 *  jamais masquer/révéler la barre, décision d'implémentation (aucune AC ne fixe le seuil). */
const SCROLL_THRESHOLD = 48;

/** Barre de contrôles partagée, purement présentationnelle (Story 29.9) — parties et personnages
 *  (`Dashboard`/`MyCharacters`) restent seuls propriétaires de la mémorisation des préférences
 *  (`AccountService.updatePreferences()`) ; ce composant ne persiste rien lui-même. */
@Component({
  selector: 'app-list-control-bar',
  standalone: true,
  imports: [FormsModule, MatButtonModule, AppIcon],
  templateUrl: './list-control-bar.html',
  styleUrl: './list-control-bar.scss',
})
export class ListControlBar {
  protected readonly theme = inject(ThemeToneService);
  private readonly breakpointObserver = inject(BreakpointObserver);

  private static readonly DESKTOP_QUERY = '(min-width: 1024px)';

  readonly viewMode = input.required<ListViewMode>();
  readonly viewModeOptions = input<readonly ListViewMode[]>(LIST_VIEW_MODES);
  readonly sortOptions = input.required<readonly ListControlBarSortOption[]>();
  readonly sortValue = input.required<string>();
  /** `null` = pas de recherche pour cette liste. */
  readonly searchQuery = input<string | null>(null);
  readonly searchLabel = input<string>('');
  readonly hasDeviatedFromDefault = input<boolean>(false);

  readonly viewModeChange = output<ListViewMode>();
  readonly sortChange = output<string>();
  readonly searchQueryChange = output<string>();
  readonly resetRequested = output<void>();

  /** Repli par défaut derrière une icône (patron Story 29.8, migré ici tel quel). */
  protected readonly expanded = signal(false);

  /** `isMatched` est synchrone — évite un flash d'un rendu desktop sur un premier chargement mobile
   *  (même patron que `partie-detail.ts`). */
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(ListControlBar.DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(ListControlBar.DESKTOP_QUERY) },
  );

  /** Masquage au défilement (AC5) — direction dérivée d'un delta cumulé depuis le dernier point de
   *  décision, ignoré tant qu'il reste sous `SCROLL_THRESHOLD` (évite tout clignotement). */
  protected readonly hiddenByScroll = signal(false);
  private lastScrollY = window.scrollY;

  @HostListener('window:scroll')
  protected onScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    if (Math.abs(delta) < SCROLL_THRESHOLD) return;
    this.hiddenByScroll.set(delta > 0 && y > SCROLL_THRESHOLD);
    this.lastScrollY = y;
  }

  protected modeIcon(mode: ListViewMode): IconName {
    if (mode === 'large') return 'vue-large';
    if (mode === 'medium') return 'vue-moyenne';
    return 'vue-compacte';
  }

  protected modeAriaLabel(mode: ListViewMode): string {
    return this.theme.tone()[`list_control_bar.view_mode_${mode}_aria`] ?? mode;
  }
}
