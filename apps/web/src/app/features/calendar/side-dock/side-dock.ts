import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { IconName } from '../../../core/icons/icon-registry.generated';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

/**
 * Story 46.1 — le `side-dock` : toute colonne de droite des calendriers (MJ, joueur, groupe, plateau de la destinée)
 * peut se ranger sur le bord, puis se rouvrir.
 *
 * Le composant EST la colonne : l'hôte reçoit les classes de la colonne (largeur, sticky, défilement vivent dans
 * `calendar-view.scss`) et enveloppe son contenu. Colonne ouverte : une barre mince avec un chevron « suivant » (Ranger la colonne) au-dessus
 * du contenu. Colonne rangée : une bande de 44 px avec un chevron « précédent » (Rouvrir la colonne) et le libellé en vertical.
 * `enabled` faux (sous 768 px, où il n'y a pas de dock) : le contenu seul, sans barre.
 *
 * Rendu pur : l'état « rangé » est tenu par `ColumnDockService`, ici on ne fait que demander (`toggled`) et rendre le
 * focus au bouton qui prend la place de celui qu'on vient d'activer.
 */
@Component({
  selector: 'app-side-dock',
  standalone: true,
  imports: [NgTemplateOutlet, AppIcon],
  templateUrl: './side-dock.html',
  styleUrl: './side-dock.scss',
  host: { '[class.side-dock--docked]': 'enabled() && docked()' },
})
export class SideDock {
  /** Le dock existe-t-il ici (≥ 768 px) ? Sinon, le contenu est rendu tel quel. */
  readonly enabled = input(true);
  /** La colonne est-elle rangée ? */
  readonly docked = input(false);
  /** Ce que contient la colonne, lu en vertical dans le dock : « Éphémérides · 18 », « Chapitre 4 ». */
  readonly label = input('');
  /** Pictogramme placé devant le libellé vertical (décoratif : le libellé porte le nom), ex. « destinee » pour le plateau. */
  readonly icon = input<IconName>();

  readonly toggled = output<void>();

  protected readonly theme = inject(ThemeToneService);
  private readonly injector = inject(Injector);

  private readonly reopenButton = viewChild<ElementRef<HTMLButtonElement>>('reopenButton');
  private readonly dockButton = viewChild<ElementRef<HTMLButtonElement>>('dockButton');

  protected onToggle(): void {
    const docking = !this.docked();
    this.toggled.emit();
    // Le bouton activé disparaît avec son état : le focus passe à celui qui le remplace (précédent en rangeant, suivant en rouvrant).
    afterNextRender(
      () => (docking ? this.reopenButton() : this.dockButton())?.nativeElement.focus(),
      { injector: this.injector },
    );
  }
}
