import { Component, computed, inject, input, output } from '@angular/core';
import type { DaySlot, SlotStatus } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import {
  type DayDetail,
  type DaySlotDetail,
  type RailSlot,
  type RailTarget,
  dateKeyToUtcMidnight,
  dateKeyToLocalMidnight,
  composeSeanceInfo,
} from '../day-detail.utils';
import { SPAN_CONTINUED } from '../span-label';
import { GroupGauge } from '../group-gauge/group-gauge';
import {
  type GroupAvailability,
  type GroupMember,
  groupAriaLabel,
  memberStatusGlyph,
  memberStatusWord,
} from '../group-availability.utils';
import { PollTrack } from '../poll-track/poll-track';
import { participationAriaLabel, type VoteOptionActivatedEvent } from '../poll-track.utils';

/** Clés de ton des trois états d'un créneau, résolues par `statusLabel()`. */
const STATUS_LABEL_KEYS: Record<SlotStatus, string> = {
  AVAILABLE: 'common.disponible',
  UNAVAILABLE: 'common.indisponible',
  UNKNOWN: 'calendar.rail_status_unknown',
};

const SLOT_NAMES: Record<RailSlot, string> = {
  MORNING: 'matin',
  AFTERNOON: 'après-midi',
  EVENING: 'soir',
};

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * Story 36.1 — le rail de détail.
 *
 * Bande PERMANENTE sous la grille, en vue Mois comme en vue Semaine, à toutes les largeurs.
 * Aucun geste ne l'ouvre ni ne la ferme : « le rail suit, il ne se commande pas »
 * (EXPERIENCE.md §6 bis, principe 2). Composant de RENDU PUR — il ne connaît ni le `Router`, ni
 * les routes, ni aucun service de données : `CalendarView` lui passe un `DayDetail` déjà projeté
 * et porte la navigation.
 */
@Component({
  selector: 'app-calendar-detail-rail',
  standalone: true,
  imports: [PollTrack, GroupGauge, AppIcon],
  templateUrl: './calendar-detail-rail.html',
  styleUrl: './calendar-detail-rail.scss',
})
export class CalendarDetailRail {
  protected readonly theme = inject(ThemeToneService);

  readonly detail = input<DayDetail | null>(null);
  /** Créneau effectivement touché, quand le geste en désignait un. `FULL_DAY` (tap sur le corps
   *  d'une case de la vue Mois) ne nomme aucun créneau en particulier. */
  readonly touchedSlot = input<DaySlot | null>(null);
  readonly loading = input(false);

  /** AC11 — nommé d'après la DESTINATION : on ouvre le scénario qui porte la séance, jamais une
   *  « fenêtre de séance », qui n'existe pas dans l'application. */
  readonly scenarioActivated = output<RailTarget>();

  /** Story 36.7, AC7 — **le chemin CLAVIER vers le sélecteur de réponse.**
   *
   *  Les bandes des grilles ne sont pas focalisables, par décision explicite : un `tabindex` par
   *  bande produirait 126 arrêts de tabulation sur une grille de six semaines
   *  (`EXPERIENCE.md` §6 bis). Sans cette ligne activable, répondre à un vote serait donc
   *  inatteignable au clavier. Le rail porte au plus trois lignes : il est le bon endroit, et il
   *  le fait déjà pour une séance (AC11 de la 36.1). */
  readonly voteOptionActivated = output<VoteOptionActivatedEvent>();

  protected readonly dayLabel = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const formatted = DAY_FORMAT.format(dateKeyToUtcMidnight(d.date));
    const slot = this.touchedSlot();
    return slot && slot !== 'FULL_DAY' ? `${formatted} — ${SLOT_NAMES[slot] ?? ''}` : formatted;
  });

  protected isTouched(slot: DaySlotDetail): boolean {
    return this.touchedSlot() === slot.slot;
  }

  protected statusLabel(status: SlotStatus): string {
    return this.theme.tone()[STATUS_LABEL_KEYS[status]];
  }

  /** Story 36.5 — la composition passe par le point unique de `day-detail.utils` (AC10). Le rail
   *  demande le niveau COMPLET : c'est la surface la plus riche de l'écran, et depuis la story
   *  36.2 c'est la seule qui porte l'information en largeur téléphone (AC11). */
  protected seanceInfo(slot: DaySlotDetail): string {
    return composeSeanceInfo(slot, 'full');
  }

  /**
   * Story 47.3 — la ligne de plage d'un créneau couvert par un rendez-vous de plusieurs créneaux : « (suite) »
   * sur les jours qui suivent le premier, puis la plage « ven. 6 nov. soir → dim. 8 nov. après-midi ». `''` pour
   * un créneau seul (la ligne n'est alors pas rendue). Le rail est la surface où la plage se lit jour par jour.
   */
  protected spanLine(slot: DaySlotDetail): string {
    const span = slot.span;
    if (!span || !slot.seanceLabel) return '';
    return span.isFirstDay ? span.shortRange : `${SPAN_CONTINUED} · ${span.shortRange}`;
  }

  /** Nom accessible de la ligne activable : il annonce le SCÉNARIO, pas la séance — la promesse
   *  faite au lecteur d'écran doit correspondre à l'endroit où il atterrit. `aria-label` écrasant
   *  tout contenu visuel, les informations pratiques doivent y être repliées (AC13). */
  protected openLabel(slot: DaySlotDetail): string {
    const info = this.seanceInfo(slot);
    const tone = this.theme.tone();
    // Story 47.3 : la plage entière fait partie de ce que la ligne annonce.
    const label = slot.span
      ? `${slot.seanceLabel ?? ''}, ${slot.span.range}`
      : (slot.seanceLabel ?? '');
    return info
      ? fillTone(tone['common.ouvrir_le_scenario_label_info'], { label, info })
      : fillTone(tone['common.ouvrir_le_scenario_label'], { label });
  }

  protected onActivate(slot: DaySlotDetail): void {
    if (slot.seanceTarget) this.scenarioActivated.emit(slot.seanceTarget);
  }

  /** Nom accessible de la ligne de vote : il annonce l'ACTION, pas seulement l'objet — la
   *  promesse faite au lecteur d'écran doit correspondre à ce qui va s'ouvrir (même règle que
   *  `openLabel()` pour le scénario).
   *
   *  Revue de code 36.7 : `[attr.aria-label]` sur le bouton écrase le contenu, y compris le
   *  `role="img"`/`aria-label` propre à `<app-poll-track>` qu'il enveloppe désormais — sans ce
   *  repli le détail de la participation (compte, ma réponse) deviendrait inatteignable au
   *  clavier/lecteur d'écran, régression symétrique de celle qu'`openLabel()` évite déjà pour les
   *  informations pratiques d'une séance. */
  protected voteLabel(slot: DaySlotDetail): string {
    const tone = this.theme.tone();
    const detail = slot.pollVote ? participationAriaLabel(slot.pollVote, tone) : null;
    const label = slot.label.toLowerCase();
    return detail
      ? fillTone(tone['common.repondre_au_vote_label_detail'], { label, detail })
      : fillTone(tone['common.repondre_au_vote_label'], { label });
  }

  /**
   * Story 36.8, AC7 — les membres à NOMMER dans le rail, ou `null` pour retomber sur la jauge.
   *
   * 🚨 **Volontairement distinct de `showsMemberPastilles()`**, qui gouverne les grilles. Là-bas,
   * le seuil de six existe parce qu'une bande de 115 px ne tient pas davantage de pastilles ; ici,
   * le rail est la **lecture longue** — il nomme la troupe quelle que soit sa taille, et c'est
   * même le repli explicite prévu au-delà de six (« on retombe sur la jauge **et le rail donne
   * les noms** », `iteration-groupe-participation-filtres.html:266`).
   *
   * ⚠️ La seule condition reste la **présence de la donnée** : le serveur ne sert d'identités
   * qu'au MJ (garde `isMj` de `getHeatmap`). Un joueur reçoit donc `null` ici, et voit la jauge et
   * son compteur — conformément à l'AC3 (« aucune identité n'est exposée ») et à la table des
   * rôles d'`EXPERIENCE.md:102`. Jamais de test sur un mode de route.
   */
  protected groupMembers(group: GroupAvailability): GroupMember[] | null {
    const members = group.members;
    return members !== null && members.length > 0 ? members : null;
  }

  /** Le nom accessible de la lecture longue. Le conteneur porte `role="img"` et ce libellé, ses
   *  enfants sont `aria-hidden` : sinon chaque nom serait annoncé deux fois. */
  protected groupLabel(group: GroupAvailability): string {
    return groupAriaLabel(group, this.theme.tone());
  }

  /** Le statut d'un membre en toutes lettres — jamais la couleur seule (P-1). Point unique du
   *  vocabulaire, partagé avec le nom accessible : les deux ne peuvent pas diverger. */
  protected statusWord(member: GroupMember): string {
    return memberStatusWord(member, this.theme.tone());
  }

  /** La version courte, pour la largeur où le mot entier céderait (revue de code du 36.8) : sous
   *  500 px, le rail affichait le nom sans AUCUN statut, ni mot ni couleur. Le nom est désormais
   *  colorisé par statut et ce glyphe le double — jamais la couleur seule (P-1), même sous le
   *  seuil téléphone. */
  protected statusGlyph(member: GroupMember): string {
    return memberStatusGlyph(member);
  }

  /** Story 36.7 — la ligne de vote signale son option ; c'est `CalendarView` qui ouvre le
   *  sélecteur. Le rail reste un composant de RENDU PUR : il n'appelle rien.
   *
   *  La date est reconstruite à minuit LOCAL, comme celle qu'émettent les grilles : le rail ne
   *  connaît son jour que sous forme de clé `YYYY-MM-DD`, et minuit UTC serait relu comme la
   *  veille dans tout fuseau négatif. */
  protected onVoteActivate(slot: DaySlotDetail, event: Event): void {
    const detail = this.detail();
    const vote = slot.pollVote;
    if (!detail || !vote || !(event.currentTarget instanceof HTMLElement)) return;
    this.voteOptionActivated.emit({
      vote,
      // Story 47.5 — toutes les plages du vote qui couvrent ce créneau : une ligne chacune dans le sélecteur.
      lines: slot.pollVotes,
      date: dateKeyToLocalMidnight(detail.date),
      slot: slot.slot,
      anchor: event.currentTarget,
    });
  }
}
