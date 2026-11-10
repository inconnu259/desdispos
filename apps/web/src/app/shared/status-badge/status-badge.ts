import { Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import type { StatusBadgeState } from '../../core/status/status-derivation';

/**
 * Story 32.3 — le badge d'état des surfaces de **scénario et de séance**.
 *
 * Il ne décide de RIEN : `status-derivation.ts` lui remet un état déjà arbitré, il le rend. Ce
 * partage des rôles est ce qui permet de tester chaque ligne de la matrice d'E/S sans TestBed.
 *
 * ⚠️ **Ce qui est réellement mutualisé, et ce qui ne l'est pas encore.** La vue Agenda partage les
 * *fonctions pures* de `core/status/status-badge.model.ts` (teintes, paliers d'imminence, libellés
 * humains), mais garde sa **propre copie des règles CSS** (`calendar-agenda-view.scss`, classes
 * `.agenda-badge--*`) : elle n'a pas été migrée sur ce composant. Les deux feuilles portent donc
 * les mêmes tokens et les mêmes opacités, volontairement à l'identique — un changement de palette
 * se répercute encore à DEUX endroits. Les réunir demanderait de toucher une surface livrée, hors
 * périmètre de cette story.
 *
 * 🚨 **Le badge porte TOUJOURS un libellé** (P-1) : la teinte double le mot, elle ne le remplace
 * jamais. Un lecteur qui ne distingue pas les quatre teintes lit exactement la même information.
 */
@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  private readonly theme = inject(ThemeToneService);

  readonly state = input.required<StatusBadgeState>();

  /** `text` (décompte calculé : « demain soir ») l'emporte sur le libellé de registre — c'est le
   *  seul cas où un badge ne lit pas `theme.tone()`, parce qu'il n'y a rien à thématiser dans un
   *  décompte. */
  protected readonly label = computed(() => {
    const s = this.state();
    return s.text ?? this.theme.tone()[s.labelKey];
  });

  /**
   * 🚨 **Un brouillon ne reçoit AUCUNE classe de teinte** : la spec en fait un traitement de
   * forme (contour tireté, fond transparent, texte atténué), pas une cinquième couleur. Ne pas
   * émettre la classe de teinte est plus sûr que la surcharger ensuite en CSS — aucune règle
   * future ne pourra la faire réapparaître par ordre de déclaration.
   */
  protected readonly cssClass = computed(() => {
    const s = this.state();
    if (s.draft) return 'status-badge--draft';
    const intensity = s.intensity ? ` status-badge--${s.intensity}` : '';
    return `status-badge--${s.tone}${intensity}`;
  });
}
