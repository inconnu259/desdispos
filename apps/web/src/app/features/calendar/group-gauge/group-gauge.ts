import { Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import {
  type GroupAvailability,
  type GroupMember,
  groupAriaLabel,
  groupCounterLabel,
  groupFillRatio,
  groupIsAllBlocked,
  showsMemberPastilles,
} from '../group-availability.utils';

/**
 * Story 36.8 — la disponibilité du groupe, sur un canal séparé (FR-53, `DESIGN.md` §7.9 bis).
 *
 * **Un seul composant pour les quatre surfaces** — case du Mois, cellule de Semaine, rail de
 * détail, Agenda — et **une seule forme par donnée** : jauge agrégée, ou une pastille par membre
 * quand le serveur a servi les identités (MJ, troupe de six au plus). Deux implémentations
 * produiraient deux lectures du même groupe selon l'écran, exactement ce que la doctrine du
 * projet combat (AD-12, AD-19, `PollTrack`).
 *
 * 🚨 **Ce canal ne concourt PAS avec le fond de la bande.** Le fond dit *ma* situation, ce
 * composant dit celle du groupe. Il est donc rendu **sous une séance comme sous un vote** — c'est
 * l'AC2, et c'est toute la raison d'être de la story : au dernier rang de la préséance, la couche
 * devenait invisible dès qu'on avait déclaré quoi que ce soit (`EXPERIENCE.md:253`).
 *
 * 🚨 **Aucune logique de largeur ici.** Le composant émet TOUJOURS sa forme et son compteur ;
 * c'est le CSS qui décide de ce qui se voit, via les `@container` déjà en place (`month-grid`,
 * `week-grid`). Aucun `@if` de largeur, aucun `ResizeObserver` — même contrainte structurelle que
 * les stories 36.2, 36.6 et 36.13.
 *
 * 🚨 **Et ces règles vivent DANS `group-gauge.scss`, jamais chez la surface appelante** :
 * l'encapsulation de vue d'Angular empêche un style du parent d'atteindre `.cnt`, qui appartient
 * à CE composant. C'est le défaut réel trouvé à l'œil pendant la 36.6. La surface pose une
 * **classe d'hôte** (`in-month`, `in-week`, `in-rail`), ce composant en tire les règles.
 *
 * 🚨 **`pointer-events: none`** sur l'hôte (cf. `.scss`) : posé dans une bande ou une cellule, ce
 * composant ne doit jamais capter le pointeur, sous peine de casser la sélection par glissement —
 * une régression qu'AUCUN test ne verrait (le hit-test est stubbé en jsdom).
 *
 * **Accessibilité (AC15).** La jauge code par la **proportion**, les pastilles par la
 * **position** : sans texte, ni l'une ni l'autre n'existe pour un lecteur d'écran. L'hôte porte
 * donc `role="img"` et un `aria-label` COMPLET — c'est aussi la seule façon de distinguer les
 * deux vides autrement que par la couleur (P-1). Les nœuds visibles sont `aria-hidden` : ils
 * doublent la forme à l'œil, ils ne doivent pas la doubler à l'oreille.
 */
@Component({
  selector: 'app-group-gauge',
  standalone: true,
  imports: [],
  templateUrl: './group-gauge.html',
  styleUrl: './group-gauge.scss',
  host: {
    role: 'img',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class GroupGauge {
  readonly group = input.required<GroupAvailability>();

  /** Ton du thème actif, passé aux formateurs de libellés (`group-availability.utils`). */
  private readonly theme = inject(ThemeToneService);

  /** Les membres à rendre en pastilles, ou `null` quand la surface doit rendre la jauge.
   *  **L'ordre est celui reçu du serveur, jamais retrié ici** : c'est lui qui fait que la position
   *  identifie la personne (AC4). Un tri local ferait bouger quelqu'un d'une surface à l'autre. */
  protected readonly pastilles = computed<GroupMember[] | null>(() => {
    const group = this.group();
    return showsMemberPastilles(group) ? group.members : null;
  });

  /** Hauteur remplie de la jauge, en pourcentage — bornée et jamais `NaN` (la valeur finit dans
   *  un attribut `style`). */
  protected readonly fill = computed(() => groupFillRatio(this.group()));

  /** Story 36.8, AC6 — l'un des DEUX VIDES. Jauge **pleine en rouge** quand tout le monde est
   *  bloqué, à ne pas confondre avec la jauge **vide** (personne de disponible et personne ne
   *  s'est prononcé), qui a exactement la même hauteur remplie : zéro. Sans ce drapeau, les deux
   *  états seraient indistinguables — c'est précisément ce que l'AC6 interdit. */
  protected readonly allBlocked = computed(() => groupIsAllBlocked(this.group()));

  /** « 2 / 4 » — toujours calculé, toujours émis ; le CSS décide où il se voit. */
  protected readonly counter = computed(() => groupCounterLabel(this.group()));

  protected readonly ariaLabel = computed(() => groupAriaLabel(this.group(), this.theme.tone()));

  /** La classe de statut d'une pastille. La couleur dit le statut, la POSITION dit la personne
   *  (AC4) — et le nom accessible de l'hôte dit les deux en toutes lettres (P-1). */
  protected pastilleClass(member: GroupMember): string {
    switch (member.status) {
      case 'AVAILABLE':
        return 'p p--yes';
      case 'UNAVAILABLE':
        return 'p p--no';
      default:
        return 'p p--unknown';
    }
  }

  /** Le pourcentage finit dans un attribut `style` : formaté ici, à un seul endroit, et arrondi
   *  à 2 décimales — un effectif non diviseur (3/7) produirait sinon des décimales flottantes
   *  arbitrairement longues (revue de code du 36.6). */
  protected pct(value: number): string {
    return `${Math.round(value * 100) / 100}%`;
  }
}
