import { Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import {
  type VoteParticipation,
  answerLabel,
  counterLabel,
  participationAriaLabel,
  trackSegments,
} from '../poll-track.utils';

/**
 * Story 36.6 — la piste de participation d'un vote.
 *
 * **Un seul composant pour les quatre surfaces** — case du Mois, cellule de Semaine, rail de
 * détail, Agenda. Deux implémentations produiraient deux lectures de la même participation selon
 * l'écran, exactement ce que la doctrine du projet combat (AD-12, AD-19, `composeSeanceInfo`).
 *
 * 🚨 **Aucune logique de largeur ici.** Le composant émet TOUJOURS la piste, le compteur et ma
 * réponse ; c'est le CSS qui décide de ce qui se voit, via les `@container` déjà en place
 * (`month-grid` à 712 px, `week-grid` à 500 px). Aucun `@if` de largeur, aucun `ResizeObserver` —
 * même contrainte structurelle que les stories 36.2 et 36.13.
 *
 * 🚨 **Et ces règles vivent DANS `poll-track.scss`, jamais chez la surface appelante** — défaut
 * réel trouvé à la vérification visuelle : l'encapsulation de vue d'Angular empêche un style du
 * parent d'atteindre `.cnt` et `.mine`, qui appartiennent à CE composant. La règle
 * `.band--no-counter .cnt { display: none }` écrite dans `calendar-month-view.scss` n'avait
 * simplement aucun effet, et le compteur s'affichait dans la case du Mois contre l'AC4. La
 * surface pose une **classe d'hôte** (`in-month`, `in-week`), ce composant en tire les règles.
 * Les `@container` fonctionnent d'ici : le conteneur est un ancêtre, la frontière de composant
 * ne l'interrompt pas.
 *
 * 🚨 **`pointer-events: none`** sur l'hôte (cf. `.scss`) : posée dans une cellule de Semaine, la
 * piste ne doit jamais capter le pointeur, sous peine de casser la sélection par glissement — une
 * régression qu'AUCUN test ne verrait (le hit-test est stubbé en jsdom).
 *
 * **Accessibilité (AC14).** La piste code par la **proportion** : sans texte, elle n'existe pas
 * pour un lecteur d'écran. Elle porte donc `role="img"` et un `aria-label` COMPLET — que le CSS
 * masque le compteur ou non. Les nœuds visibles `.cnt` et `.mine` sont `aria-hidden` : ils
 * doublent la piste à l'œil, ils ne doivent pas la doubler à l'oreille.
 */
@Component({
  selector: 'app-poll-track',
  standalone: true,
  imports: [],
  templateUrl: './poll-track.html',
  styleUrl: './poll-track.scss',
})
export class PollTrack {
  readonly vote = input.required<VoteParticipation>();

  /** Ton du thème actif, passé aux formateurs de libellés (`poll-track.utils`). */
  private readonly theme = inject(ThemeToneService);

  /** Largeurs des trois segments, en pourcentage de l'effectif TOTAL (jamais des répondants). */
  protected readonly segments = computed(() => trackSegments(this.vote()));

  /** « 3 / 4 » — toujours calculé, toujours émis (AC4). */
  protected readonly counter = computed(() => counterLabel(this.vote(), this.theme.tone()));

  /** Ma réponse en toutes lettres, ou `''` quand je n'ai pas répondu (AC5). Les DEUX
   *  formulations sont calculées ; c'est le CSS qui choisit selon la surface — aucune logique de
   *  largeur ici. */
  protected readonly mineFull = computed(() =>
    answerLabel(this.vote().myAnswer, 'full', this.theme.tone()),
  );
  protected readonly mineShort = computed(() =>
    answerLabel(this.vote().myAnswer, 'compact', this.theme.tone()),
  );

  protected readonly ariaLabel = computed(() =>
    participationAriaLabel(this.vote(), this.theme.tone()),
  );

  /** Les pourcentages finissent dans un attribut `style` : ils sont formatés ici, à un seul
   *  endroit, et `trackSegments()` garantit déjà qu'ils sont bornés et jamais `NaN`. Arrondis à
   *  2 décimales (revue de code du 36.6) : un effectif non diviseur (ex. 3/7) produisait sinon
   *  des décimales flottantes arbitrairement longues dans l'attribut `style`. */
  protected pct(value: number): string {
    return `${Math.round(value * 100) / 100}%`;
  }
}
