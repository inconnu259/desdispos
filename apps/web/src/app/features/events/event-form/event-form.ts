import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
  CreateEventDto,
  EventCardDto,
  EventPollOptionInput,
  EventSlot,
  PartieMemberDto,
} from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { SLOT_LABELS } from '../../calendar/agenda-badge.utils';
import { toDateKey } from '../../calendar/day-detail.utils';
import type { ConjonctionDraft } from '../conjonction-draft.service';
import { DurationStepper } from '../../../shared/duration-stepper/duration-stepper';
import { pollSlotLabel, pollSummaryLabel } from '../event-card.util';

/** Nombre de places proposé par défaut quand on passe à « Places limitées » (hôte compris). */
export const DEFAULT_PLACES = 4;
/** Minimum de places limitées : l'hôte en occupe une, il en faut au moins une autre. */
export const MIN_PLACES = 2;

/** Au moins deux créneaux pour un sondage (le serveur le vérifie aussi). */
export const MIN_POLL_SLOTS = 2;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RANK: Record<EventSlot, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2 };

/** Créneaux triés par jour puis créneau (matin < après-midi < soir). */
function sortSlots(list: EventPollOptionInput[]): EventPollOptionInput[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? SLOT_RANK[a.slot] - SLOT_RANK[b.slot] : a.date < b.date ? -1 : 1,
  );
}

let nextUid = 0;

/**
 * Champs d'une conjonction, partagés par la fenêtre de création (Story 40.1) et le mode édition de la
 * fenêtre de détail (Story 40.2) : nom* → bascule « Date fixée | Sondage de dates » → jour (champ de
 * date natif) + créneau, OU (Story 40.5) la liste des créneaux candidats (jour + créneau + « Ajouter »,
 * pastilles retirables, résumé « 3 créneaux · ven. 17 → sam. 25 oct. ») et « Le vote se termine le »
 * → lieu → heure (`type="time"`, une étiquette « HH:MM ») → infos pratiques → participation
 * « Tous les membres | Places limitées » avec un compteur −/+.
 *
 * Story 40.4 : à la CRÉATION et places limitées seulement, « Réserver une place à des membres » — une
 * pastille par membre (l'hôte exclu), cochée = place réservée d'emblée. Au plus `places − 1` (l'hôte
 * occupe une place) : le compteur ne descend pas sous `réservées + 1`. En modification, le sélecteur
 * n'apparaît pas (la fenêtre de détail gère les réservations).
 *
 * Story 40.5 : à la modification le mode ne change pas (la bascule est figée sur celui de la
 * conjonction) ; la liste des créneaux et l'échéance se corrigent. Les créneaux sont choisis ici, dans
 * la fenêtre — le calendrier du groupe est l'objet de la Story 40.5b.
 *
 * Story 40.5b : à la création en mode sondage, « Choisir les créneaux dans le calendrier » demande au
 * parent (`composeRequested`) d'ouvrir le calendrier du groupe ; `draft` restaure, au retour, ce que la
 * fenêtre contenait (lu une seule fois, comme `prefill`) et `snapshot()` en donne l'instantané. La
 * liste des créneaux de la fenêtre reste : les deux chemins alimentent les mêmes créneaux.
 *
 * Rendu des champs seulement : le parent tient le pied (boutons, double envoi, refus du serveur) et
 * lit `dto()` / `valid()` par `viewChild`. `prefill` pré-remplit le formulaire d'une conjonction
 * existante (lu une seule fois à l'initialisation). Le serveur reste juge de toutes les règles.
 */
@Component({
  selector: 'app-event-form',
  imports: [
    AppIcon,
    DurationStepper,
    FormsModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './event-form.html',
  styleUrl: './event-form.scss',
})
export class EventForm implements OnInit {
  protected readonly theme = inject(ThemeToneService);

  /** Conjonction à modifier (mode édition) ; absente à la création. */
  readonly prefill = input<EventCardDto | null>(null);
  /** Entrée dans un champ : le parent soumet (comme un bouton « Enregistrer »). */
  readonly submitted = output<void>();
  /** Story 40.5b : brouillon restauré au retour du calendrier (création seulement, lu une fois). */
  readonly draft = input<ConjonctionDraft | null>(null);
  /** Story 40.5b : la personne veut choisir ses créneaux dans le calendrier du groupe. */
  readonly composeRequested = output<void>();
  /** Story 40.4 : membres du groupe à qui l'hôte peut réserver une place (création seulement). */
  readonly members = input<PartieMemberDto[]>([]);
  /** Story 40.4 : l'hôte (la personne connectée), exclu du sélecteur — il occupe déjà une place. */
  readonly hostId = input<string | null>(null);
  /** Story 41.2 : soirée isolée — participation en lecture seule (« sur invitation · pas de limite »), ni
   *  places limitées ni réservations ; le dto n'envoie alors jamais de capacité. */
  readonly soiree = input(false);
  /** Story 41.2 : nom pré-rempli à la création (la soirée existe déjà, son nom est celui de la partie).
   *  Lu une fois ; un brouillon restauré prime. */
  readonly initialTitle = input('');

  protected readonly uid = `event-form-${++nextUid}`;
  protected readonly slots: readonly EventSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];
  protected readonly slotLabels = SLOT_LABELS;
  /** Jour courant (clé locale), borne basse du champ de date — le serveur tranche en dernier. */
  protected readonly todayKey = toDateKey(new Date());

  protected readonly title = signal('');
  /** Story 40.5 : mode de date. À la modification il suit la conjonction et ne change plus. */
  protected readonly mode = signal<'fixed' | 'poll'>('fixed');
  /** Créneaux candidats du sondage (triés par jour puis créneau) et leur champ de saisie. */
  protected readonly pollOptions = signal<EventPollOptionInput[]>([]);
  protected readonly pollDay = signal('');
  protected readonly pollSlot = signal<EventSlot>('EVENING');
  protected readonly pollDeadline = signal('');
  /** Échéance de la conjonction à la modification : inchangée, elle reste acceptée même passée (le
   *  serveur la tolère, pour corriger le lieu ou l'heure une fois le vote terminé). */
  private initialDeadline = '';
  /** Borne basse du champ d'échéance : aujourd'hui, ou l'échéance d'origine si elle est déjà passée. */
  protected readonly deadlineMin = computed(() =>
    this.initialDeadline && this.initialDeadline < this.todayKey
      ? this.initialDeadline
      : this.todayKey,
  );
  protected readonly day = signal('');
  protected readonly slot = signal<EventSlot>('EVENING');
  protected readonly lieu = signal('');
  protected readonly heureRdv = signal('');
  protected readonly notePratique = signal('');
  protected readonly participation = signal<'all' | 'limited'>('all');
  protected readonly places = signal(DEFAULT_PLACES);
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés (1 par défaut). */
  protected readonly durationSlots = signal(1);
  /** Durée de la conjonction à l'ouverture (modification) : tant que le compteur n'y touche pas, elle ne
   *  part pas, pour qu'une fiche périmée ne réécrase jamais une durée corrigée ailleurs. */
  private initialDuration: number | null = null;
  /** Story 40.4 : membres cochés (places réservées d'emblée). */
  protected readonly reserved = signal<string[]>([]);

  /** Le sélecteur de places réservées : à la création, places limitées. */
  protected readonly canReserve = computed(
    () => !this.soiree() && this.prefill() === null && this.participation() === 'limited',
  );
  protected readonly candidates = computed(() =>
    this.members().filter((m) => m.userId !== this.hostId()),
  );
  /** Plafond des places réservées : l'hôte occupe une place. */
  protected readonly maxReserved = computed(() => this.places() - 1);
  /** Plancher du compteur : jamais sous les places déjà réservées + l'hôte. */
  protected readonly minPlaces = computed(() => Math.max(MIN_PLACES, this.reserved().length + 1));

  /** À la modification, le mode est celui de la conjonction : la bascule n'offre plus l'autre. Story 41.2 :
   *  sauf pour une soirée qui attend encore sa date (ni date ni sondage), dont les deux modes restent ouverts. */
  protected readonly modeLocked = computed(() => {
    const card = this.prefill();
    if (card === null) return false;
    const awaitingDate = card.seance !== null && card.seance.date === null && card.poll === null;
    return !awaitingDate;
  });
  /** Story 47.1 : un rendez-vous au vote ouvert et sans date garde sa durée (elle se règle dans le composer
   *  de dates) : le compteur la montre sans la laisser changer. */
  protected readonly durationLocked = computed(() => {
    const card = this.prefill();
    return card !== null && card.poll !== null && card.seance?.date == null;
  });
  /** Départ de la plage, quand le mode « date fixée » a un jour valide : le compteur écrit alors la plage. */
  protected readonly durationStart = computed(() =>
    this.mode() === 'fixed' && DAY_KEY.test(this.day())
      ? { date: this.day(), slot: this.slot() }
      : null,
  );
  /** Résumé « 3 créneaux · ven. 17 → sam. 25 oct. », une fois au moins un créneau placé. */
  protected readonly pollSummary = computed(() =>
    this.pollOptions().length > 0 ? pollSummaryLabel(this.pollOptions(), this.theme.tone()) : null,
  );
  /** Le créneau en cours de saisie peut être ajouté : jour valide, pas passé, pas déjà proposé. */
  protected readonly canAddSlot = computed(
    () =>
      DAY_KEY.test(this.pollDay()) &&
      this.pollDay() >= this.todayKey &&
      !this.pollOptions().some((o) => o.date === this.pollDay() && o.slot === this.pollSlot()),
  );
  /** Au moins deux créneaux sont proposés (sinon l'aide l'écrit). */
  protected readonly enoughSlots = computed(() => this.pollOptions().length >= MIN_POLL_SLOTS);

  /** Nom non vide, puis : (date fixée) un jour au bon format pas avant aujourd'hui ; (sondage) au moins
   *  2 créneaux et une échéance au bon format pas avant aujourd'hui. Le serveur reste juge. */
  readonly valid = computed(
    () =>
      this.title().trim().length > 0 &&
      (this.mode() === 'poll'
        ? this.enoughSlots() &&
          DAY_KEY.test(this.pollDeadline()) &&
          (this.pollDeadline() >= this.todayKey || this.pollDeadline() === this.initialDeadline)
        : DAY_KEY.test(this.day()) && this.day() >= this.todayKey),
  );

  /** Payload prêt à envoyer (textes nettoyés, champ vide → `null`). */
  readonly dto = computed((): CreateEventDto => ({
    title: this.title().trim(),
    // Les deux modes sont exclusifs : un sondage n'envoie ni jour ni créneau, une date fixée aucun sondage.
    ...(this.mode() === 'poll'
      ? {
          pollOptions: this.pollOptions().map((o) => ({ date: o.date, slot: o.slot })),
          pollDeadline: this.pollDeadline(),
        }
      : { date: this.day(), slot: this.slot() }),
    lieu: this.lieu().trim() || null,
    heureRdv: this.heureRdv().trim() || null,
    notePratique: this.notePratique().trim() || null,
    capacity: !this.soiree() && this.participation() === 'limited' ? this.places() : null,
    // Création : toujours envoyée ; modification : seulement si le compteur a bougé (absente = inchangée).
    ...(this.initialDuration === null || this.durationSlots() !== this.initialDuration
      ? { durationSlots: this.durationSlots() }
      : {}),
    // Story 40.4 : places réservées d'emblée — créations à places limitées seulement.
    ...(this.canReserve() && this.reserved().length > 0
      ? { reservedUserIds: [...this.reserved()] }
      : {}),
  }));

  ngOnInit(): void {
    const draft = this.draft();
    if (this.prefill() === null && !draft) this.title.set(this.initialTitle());
    if (draft && this.prefill() === null) this.restore(draft);
    const card = this.prefill();
    if (!card) return;
    const seance = card.seance;
    this.title.set(card.title);
    if (card.poll) {
      this.mode.set('poll');
      this.pollOptions.set(
        sortSlots(card.poll.options.map((o) => ({ date: o.date, slot: o.slot as EventSlot }))),
      );
      this.initialDeadline = card.poll.expiresAt?.substring(0, 10) ?? '';
      this.pollDeadline.set(this.initialDeadline);
    }
    this.day.set(seance?.date ?? '');
    this.slot.set(seance?.slot && seance.slot !== 'FULL_DAY' ? seance.slot : 'EVENING');
    this.lieu.set(seance?.lieu ?? '');
    this.heureRdv.set(seance?.heureRdv ?? '');
    this.notePratique.set(seance?.notePratique ?? '');
    this.durationSlots.set(seance?.durationSlots ?? 1);
    this.initialDuration = seance?.durationSlots ?? null;
    if (seance?.capacity != null) {
      this.participation.set('limited');
      this.places.set(Math.max(MIN_PLACES, seance.capacity));
    }
  }

  /** Story 40.5b : remet dans les champs ce que la fenêtre contenait avant le détour par le calendrier. */
  private restore(draft: ConjonctionDraft): void {
    this.mode.set('poll');
    this.title.set(draft.title);
    this.pollOptions.set(sortSlots(draft.pollOptions));
    this.pollDeadline.set(draft.pollDeadline);
    this.lieu.set(draft.lieu);
    this.heureRdv.set(draft.heureRdv);
    this.notePratique.set(draft.notePratique);
    this.participation.set(draft.participation);
    this.places.set(Math.max(MIN_PLACES, draft.places));
    this.reserved.set(draft.participation === 'limited' ? [...draft.reserved] : []);
    // Story 47.4 : la durée revient du composer avec les créneaux.
    this.durationSlots.set(draft.durationSlots ?? 1);
  }

  /** Story 40.5b : instantané des champs, pour le brouillon qui fait l'aller-retour par le calendrier.
   *  Textes bruts (rien n'est nettoyé ni validé) : la fenêtre les retrouve à l'identique. */
  snapshot(partieId: string): ConjonctionDraft {
    return {
      partieId,
      title: this.title(),
      pollOptions: this.pollOptions().map((o) => ({ date: o.date, slot: o.slot })),
      pollDeadline: this.pollDeadline(),
      lieu: this.lieu(),
      heureRdv: this.heureRdv(),
      notePratique: this.notePratique(),
      participation: this.participation(),
      places: this.places(),
      reserved: [...this.reserved()],
      // Story 47.4 : la durée part avec le brouillon — le composer s'y initialise.
      durationSlots: this.durationSlots(),
    };
  }

  /** Story 40.5b : le chemin « calendrier » n'est offert qu'à la création (la fenêtre de détail a le
   *  sien : « Composer les créneaux »). */
  protected readonly canPickInCalendar = computed(() => this.prefill() === null);

  /** Story 40.5 : à la création seulement ; à la modification le mode de la conjonction est figé. */
  protected setMode(value: 'fixed' | 'poll'): void {
    if (!this.modeLocked()) this.mode.set(value);
  }

  /** Story 40.5 : place le créneau saisi dans la liste (triée), puis vide le jour pour le suivant. */
  protected addSlot(): void {
    if (!this.canAddSlot()) return;
    this.pollOptions.update((list) =>
      sortSlots([...list, { date: this.pollDay(), slot: this.pollSlot() }]),
    );
    this.pollDay.set('');
  }

  protected removeSlot(option: EventPollOptionInput): void {
    this.pollOptions.update((list) =>
      list.filter((o) => !(o.date === option.date && o.slot === option.slot)),
    );
  }

  protected slotLabel(option: EventPollOptionInput): string {
    return pollSlotLabel(option, this.durationSlots());
  }

  protected slotRemoveAria(option: EventPollOptionInput): string {
    return fillTone(this.theme.tone()['partie.ralliement_event_poll_slot_remove_aria'], {
      slot: pollSlotLabel(option, this.durationSlots()),
    });
  }

  protected setParticipation(value: 'all' | 'limited'): void {
    this.participation.set(value);
    // Sans limite, il n'y a rien à réserver : la sélection est abandonnée.
    if (value === 'all') this.reserved.set([]);
  }

  /** Story 40.4 : coche / décoche un membre. Une pastille de plus que le plafond est refusée. */
  protected toggleReserved(userId: string): void {
    const current = this.reserved();
    if (current.includes(userId)) {
      this.reserved.set(current.filter((id) => id !== userId));
    } else if (current.length < this.maxReserved()) {
      this.reserved.set([...current, userId]);
    }
  }

  protected isReserved(userId: string): boolean {
    return this.reserved().includes(userId);
  }

  /** Une pastille non cochée est désactivée quand le plafond est atteint. */
  protected chipDisabled(userId: string): boolean {
    return !this.isReserved(userId) && this.reserved().length >= this.maxReserved();
  }

  protected chipAria(member: PartieMemberDto): string {
    return fillTone(this.theme.tone()['partie.ralliement_event_reserve_chip_aria'], {
      name: member.displayName,
    });
  }

  protected decrement(): void {
    this.places.update((n) => Math.max(this.minPlaces(), n - 1));
  }

  protected increment(): void {
    this.places.update((n) => n + 1);
  }

  /** Saisie directe dans le compteur : entier ≥ 2, sans plafond. Une saisie invalide est ignorée ET
   *  le champ réaffiche la valeur retenue — jamais un nombre affiché autre que celui qui sera envoyé. */
  protected setPlaces(input: HTMLInputElement): void {
    const n = input.value.trim() === '' ? NaN : Number(input.value);
    if (Number.isInteger(n) && n >= this.minPlaces()) this.places.set(n);
    else input.value = String(this.places());
  }
}
