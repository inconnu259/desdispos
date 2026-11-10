import { Component, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { AnnouncementDto } from '@desdispos/shared';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

@Component({
  selector: 'app-annonce-card',
  standalone: true,
  imports: [DatePipe, IdentityLabel],
  templateUrl: './annonce-card.html',
  styleUrl: './annonce-card.scss',
})
export class AnnonceCard {
  protected readonly theme = inject(ThemeToneService);

  readonly announcement = input.required<AnnouncementDto>();
  // Story 9.2 : composant purement présentationnel — c'est l'appelant qui détermine le libellé de
  // portée (règles différentes selon le contexte : kind de la Partie pour une annonce campagne-wide,
  // libellé générique pour une annonce scopée à un scénario) et le passe déjà résolu ici.
  readonly scopeLabel = input.required<string>();
  // Story 29.13 (révision du 2026-08-13, retour utilisateur) : le marquage « vue » se déclenche
  // désormais sur un clic explicite, plus au simple affichage à l'écran (qui refermait la
  // notification avant que l'utilisateur n'ait eu le temps de la voir). Toujours purement
  // présentationnel : l'appelant fournit l'état `unseen` et réagit à `opened`, aucun service injecté ici.
  readonly unseen = input<boolean>(false);
  readonly opened = output<void>();

  protected onActivate(): void {
    if (this.unseen()) this.opened.emit();
  }
}
