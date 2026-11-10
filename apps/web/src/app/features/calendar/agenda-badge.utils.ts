import type { DaySlot } from '@master-jdr/shared';
import type { AgendaEntry } from './calendar-agenda-view/calendar-agenda-view';
import { respondedCount, type VoteParticipation } from './poll-track.utils';
// Story 32.3 — teintes, paliers et libellés humains vivent désormais dans `core/status`, partagés
// avec la StatusBadge des scénarios et des séances. Réimportés ici SANS changer une virgule : la
// vue Agenda garde le même comportement, elle n'est plus seulement propriétaire de ces règles.
import {
  addDaysToKey,
  daysBetweenKeys,
  imminenceIntensity,
  imminenceLabel,
  type BadgeIntensity,
  type BadgeTone,
} from '../../core/status/status-badge.model';

// Réexports : les sites d'appel existants (et `agenda-badge.utils.spec.ts`) continuent d'importer
// depuis ce module, sans modification.
export {
  addDaysToKey,
  daysBetweenKeys,
  imminenceIntensity,
  imminenceLabel,
  type BadgeIntensity,
  type BadgeTone,
};

/**
 * Story 36.11 — le modèle de la vue Agenda refondue.
 *
 * Fonctions pures, testées sans TestBed (patron `poll-track.utils.ts` / `selection.utils.ts`).
 * Elles ne connaissent ni Angular, ni HTTP, ni routes : elles projettent des entrées DÉJÀ
 * dérivées par `CalendarView` vers la section et le badge qui leur reviennent.
 *
 * 🚨 **L'Agenda n'a pas d'axe temporel.** Le Mois et la Semaine portent déjà le temps ; le porter
 * une troisième fois n'aurait produit qu'un doublon. Ce qui organise cette vue, c'est **ce qu'on
 * attend du lecteur** — d'où `sectionIdFor()`, qui n'est pas un tri mais un changement de critère.
 * [Source: EXPERIENCE.md §4.4 bis]
 */

/** Les trois sections du contrat, dans leur ordre d'affichage. */
export type AgendaSectionId = 'awaiting' | 'scheduled' | 'past';

/** Ce que dit le badge d'une ligne. `kind` désigne une clé de ton (résolue par le composant, qui
 *  seul connaît le thème actif) ; `text` n'est renseigné que pour l'imminence, qui est un
 *  **décompte calculé** et non un libellé de registre. */
export interface AgendaBadge {
  kind: 'answer-poll' | 'poll-open' | 'signup' | 'signed-up' | 'imminence' | 'debrief' | 'to-seal';
  tone: BadgeTone;
  intensity?: BadgeIntensity;
  text?: string;
}

/** Libellés de créneau. Dupliqués depuis `calendar-view.ts` plutôt que déplacés : les remonter
 *  dans un module commun toucherait quatre surfaces livrées pour un gain nul dans cette story. */
export const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

/**
 * La section d'une entrée, ou `null` si elle n'en a aucune.
 *
 * ⚠️ **Trois types n'ont volontairement aucune section** : `mes-disponibilites`,
 * `mes-indisponibilites`, `disponibilite-groupe`. L'Agenda est « ce qu'on attend de moi », et ma
 * propre déclaration n'attend rien de moi — elle est déjà lisible dans les deux grilles et dans
 * le rail. C'est un retrait **d'affichage** : ces entrées restent dans `allCalendarEntries()`,
 * dont dépendent le rail, le Mois et la Semaine.
 *
 * 🚨 **`compteRenduManquant` n'est renseigné qu'en contexte de partie** (`SeanceDto.compteRendu`
 * n'a pas d'équivalent sur `MyCalendarSeanceEntry`). En calendrier personnel, une séance passée
 * ne peut donc pas atteindre « C'est passé » — et de toute façon la plage de `GET /me/calendar`
 * part d'aujourd'hui, donc aucune n'y arrive. La section est alors vide, donc **absente**.
 */
export function sectionIdFor(entry: AgendaEntry, todayKey: string): AgendaSectionId | null {
  if (
    entry.type === 'votes-en-cours' ||
    entry.type === 'inscriptions-ouvertes' ||
    // Story 36.12 — une séance à laquelle il manque un vote attend une action du MJ, donc elle
    // relève de la même section que les votes eux-mêmes. Sans date : elle se range en fin de
    // section, comme une inscription ouverte.
    entry.type === 'seances-sans-date'
  )
    return 'awaiting';
  if (entry.type !== 'mes-seances' || !entry.date) return null;
  // Story 47.3 : une plage n'est « passée » qu'une fois sa FIN passée — commencée, elle reste à venir.
  if ((entry.endDate ?? entry.date) >= todayKey) return 'scheduled';
  return entry.compteRenduManquant ? 'past' : null;
}

/**
 * Le badge d'une ligne — **jamais la couleur seule** (P-1) : la teinte double un libellé, elle ne
 * le remplace pas.
 *
 * AC4 : le libellé d'un vote dépend **du lecteur**. Sans ma réponse il appelle une action
 * (`todo`) ; une fois répondu il informe (`live`). *Deux teintes imposent deux libellés*
 * [Source: EXPERIENCE.md §5]. Le vote **reste rendu** dans les deux cas : c'est le seul chemin
 * pour changer sa réponse depuis l'Agenda.
 */
export function badgeFor(entry: AgendaEntry, todayKey: string): AgendaBadge | null {
  switch (sectionIdFor(entry, todayKey)) {
    case 'awaiting':
      // Story 36.12 — cette ligne porte une ACTION (« Lancer un vote »), pas un libellé d'état.
      // Lui coller en plus un badge dirait deux fois la même chose, dont une en trop.
      if (entry.type === 'seances-sans-date') return null;
      if (entry.type === 'inscriptions-ouvertes') {
        return entry.jeSuisInscrit
          ? { kind: 'signed-up', tone: 'live' }
          : { kind: 'signup', tone: 'todo' };
      }
      // Story 36.12 — sans agrégats (API dégradée, entrée `ungrouped`), aucun bouton de réponse
      // n'est rendu : un badge qui appellerait une action indisponible serait pire qu'aucun badge.
      if (!entry.vote) return null;
      return entry.vote.myAnswer
        ? { kind: 'poll-open', tone: 'live' }
        : { kind: 'answer-poll', tone: 'todo' };
    case 'scheduled':
      return {
        kind: 'imminence',
        tone: 'soon',
        intensity: imminenceIntensity(entry.date, todayKey),
        text: imminenceLabel(entry.date, entry.slot, todayKey),
      };
    case 'past':
      return { kind: 'debrief', tone: 'done' };
    default:
      return null;
  }
}

// ─── Story 36.12 — le vote redevient l'unité de la ligne ────────────────────
//
// 🚨 **Pourquoi ce regroupement existe.** Depuis la 36.6, `allCalendarEntries()` produit UNE
// ENTRÉE PAR OPTION de vote. C'est indispensable à la GRILLE — sans cela, un vote proposant
// vendredi et samedi ne marquerait que le vendredi — mais c'est faux pour une LISTE : la planche
// contractuelle montre une seule ligne par vote, aux deux rôles (planche 3 côté joueur, planche 5
// côté MJ). L'écart se mesurait à l'œil : « Ça t'attend » portait 21 lignes sur le seul jeu de
// développement, toutes des options d'un même vote.
//
// 🚨 **Le regroupement vit ici, à l'affichage, et JAMAIS dans `allCalendarEntries()`.** Le Mois,
// la Semaine et le rail dépendent de l'éclatement. Le défaire casserait trois surfaces livrées.
// C'est le patron déjà appliqué par la 36.8 (filtre `disponibilite-groupe`) et la 36.11 (retrait
// des trois couches de disponibilité) : on regroupe à l'affichage, jamais à la source.

/** Un vote ouvert, tel que l'Agenda le rend : une ligne, et ses options dessous. */
export interface AgendaVoteGroup {
  pollId: string;
  /** La partie qui porte le vote — en calendrier personnel ce n'est PAS celle de la route. */
  partieId: string;
  /** Titre du scénario (contexte de partie) ou nom de la partie (contexte personnel), repris de
   *  la première option : toutes les options d'un vote portent le même. */
  label: string;
  /** Les options, **triées par faveur** (`favourOrder`). La première est le favori (AC4). */
  options: AgendaEntry[];
  /** La plus proche des dates proposées — clé de tri de la ligne, jamais un en-tête (AC18). */
  nearestDate: string;
  /** Effectif de la troupe, servi par le serveur. `0` = inconnu (API en retard). */
  membersCount: number;
  /** Combien de personnes ont répondu **au vote**, c'est-à-dire à TOUTES ses options. */
  respondedCount: number;
  /** Q-25 — ses options se déplient d'office (`isPollMature`). */
  mature: boolean;
  /** J'ai répondu à toutes les options : le badge informe au lieu d'appeler (AC15). */
  answeredAll: boolean;
}

export interface GroupedVotes {
  groups: AgendaVoteGroup[];
  /** Les entrées `votes-en-cours` qu'on n'a pas pu grouper — elles restent rendues telles quelles.
   *
   *  🚨 Ce cas n'est pas théorique : pendant un déploiement, un client neuf peut interroger une API
   *  qui ne sert pas encore les agrégats, et `calendar-view.ts` laisse alors `vote` à `undefined`
   *  plutôt que d'inventer une piste vide. Sans `pollId`, aucun regroupement n'est possible — on
   *  préfère une ligne dégradée à une ligne perdue. */
  ungrouped: AgendaEntry[];
}

/**
 * Combien de personnes ont répondu **au vote**.
 *
 * 🚨 **Le MINIMUM sur les options, jamais la somme ni le maximum.** « Avoir répondu au vote » veut
 * dire « avoir répondu à chacune de ses options » — c'est la définition que `getMissingVoters()`
 * applique déjà sur la fiche de scénario, et la seule qu'on puisse dériver d'agrégats anonymes.
 * La somme afficherait « 3 sur 4 ont répondu » là où une seule personne a voté trois fois.
 */
function pollRespondedCount(options: AgendaEntry[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const option of options) {
    // Revue de code (36.12) — garde défensive, pas du code mort : `groupVoteEntries()` ne place
    // ici que des options dont `.vote` est déjà défini, mais le type `AgendaEntry.vote` reste
    // optionnel (le module ne peut pas l'exprimer sans dupliquer `AgendaEntry` en une variante
    // « avec vote garanti »). Mieux vaut ignorer l'entrée que planter si l'invariant se rompt.
    if (!option.vote) continue;
    min = Math.min(min, respondedCount(option.vote));
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Q-25, **tranchée le 2026-08-23** : un vote est mûr si **tout le monde a répondu**, ou si **une
 * option réunit la majorité absolue** de l'effectif.
 *
 * 🚨 **Le troisième critère proposé par le PRD — « l'échéance approche » — est volontairement
 * absent, et ce n'est pas un oubli** : `SessionPoll.expiresAt` est nullable et n'est écrit NULLE
 * PART (l'unique création, `poll.service.ts`, ne le renseigne pas), et il n'existe même pas sur
 * `MyCalendarPollEntry`. Il vaut `null` sur tous les votes ; le critère serait toujours faux.
 * Le poser demanderait une story serveur.
 *
 * 🚨 **Un effectif nul ou non numérique n'est JAMAIS mûr.** Sans cette garde, `0 >= 0` déclarerait
 * mûr tout vote dont l'API n'a pas encore servi `membersCount`, et l'écran déplierait tout.
 */
function isPollMature(options: AgendaEntry[], membersCount: number, responded: number): boolean {
  if (!Number.isFinite(membersCount) || membersCount <= 0) return false;
  // A — tout le monde a répondu à toutes les options.
  if (responded >= membersCount) return true;
  // B — une option réunit la majorité ABSOLUE. Strictement plus de la moitié : sur quatre membres,
  // deux « oui » sont une moitié, pas une majorité.
  return options.some((o) => (o.vote?.yes ?? 0) * 2 > membersCount);
}

/**
 * L'ordre par faveur (AC1, AC4) : les « oui » d'abord, les « peut-être » ensuite, la date en
 * départage.
 *
 * Le départage par date n'est pas cosmétique : deux options également plébiscitées doivent se
 * présenter dans un ordre **stable** d'un rendu à l'autre, sinon la ligne du favori changerait à
 * chaque rechargement temps réel — et le MJ scellerait la mauvaise.
 */
function favourOrder(a: AgendaEntry, b: AgendaEntry): number {
  return (
    (b.vote?.yes ?? 0) - (a.vote?.yes ?? 0) ||
    (b.vote?.maybe ?? 0) - (a.vote?.maybe ?? 0) ||
    a.date.localeCompare(b.date) ||
    a.key.localeCompare(b.key)
  );
}

/**
 * Regroupe les entrées `votes-en-cours` par sondage — **une ligne d'agenda = un vote** (AC7).
 *
 * Les groupes sortent dans leur ordre de première rencontre ; c'est l'appelant qui les range
 * ensuite dans sa section. Les entrées d'un autre type ne sont pas examinées : elles n'entrent
 * ni dans `groups` ni dans `ungrouped`.
 */
export function groupVoteEntries(entries: AgendaEntry[]): GroupedVotes {
  const byPoll = new Map<string, AgendaEntry[]>();
  const ungrouped: AgendaEntry[] = [];

  for (const entry of entries) {
    if (entry.type !== 'votes-en-cours') continue;
    if (!entry.vote) {
      ungrouped.push(entry);
      continue;
    }
    const bucket = byPoll.get(entry.vote.pollId);
    if (bucket) bucket.push(entry);
    else byPoll.set(entry.vote.pollId, [entry]);
  }

  const groups: AgendaVoteGroup[] = [];
  for (const [pollId, options] of byPoll) {
    const sorted = [...options].sort(favourOrder);
    const first = sorted[0].vote as VoteParticipation;
    // Revue de code (36.12) — `total` DEVRAIT être identique sur toutes les options d'un même
    // `pollId` (c'est le même vote côté serveur), mais rien ne le garantissait avant ce correctif :
    // une seule option divergente (API dégradée partielle) aurait fait dériver `isPollMature()` /
    // `pollRespondedCount()` selon l'ordre de tri plutôt que selon une valeur canonique. Le MAXIMUM
    // est le choix le plus sûr : sous-estimer l'effectif rendrait un vote « mûr » à tort.
    const membersCount = Math.max(
      0,
      ...sorted.map((o) => (Number.isFinite(o.vote?.total) ? (o.vote?.total ?? 0) : 0)),
    );
    const responded = pollRespondedCount(sorted);
    // La plus PROCHE des dates, pas celle de la première option : le tri de la section est
    // chronologique, et une option lointaine ne doit pas repousser un vote qui se joue bientôt.
    const dates = options.map((o) => o.date).filter((d) => d);
    dates.sort();
    groups.push({
      pollId,
      partieId: first.partieId,
      label: sorted[0].label,
      options: sorted,
      nearestDate: dates[0] ?? '',
      membersCount,
      respondedCount: responded,
      mature: isPollMature(sorted, membersCount, responded),
      answeredAll: sorted.every((o) => o.vote?.myAnswer != null),
    });
  }

  return { groups, ungrouped };
}

/**
 * Le badge d'une ligne de vote — il dépend **du lecteur ET de la maturité** (AC15).
 *
 * « À sceller » n'apparaît que là où le scellement est possible : `canSeal` porte les DEUX
 * conditions (être MJ **et** être dans le calendrier d'une partie), décidées par `CalendarView`.
 * Un badge qui appellerait une action indisponible serait pire qu'aucun badge.
 *
 * Partout ailleurs, les libellés de la 36.11 continuent de s'appliquer sans changement — avec une
 * seule précision : « avoir répondu » à un vote groupé, c'est avoir répondu à **toutes** ses
 * options, la définition de `getMissingVoters()`. Une réponse sur deux laisse le vote en attente.
 */
export function pollGroupBadge(group: AgendaVoteGroup, canSeal: boolean): AgendaBadge {
  if (canSeal && group.mature) return { kind: 'to-seal', tone: 'todo' };
  return group.answeredAll
    ? { kind: 'poll-open', tone: 'live' }
    : { kind: 'answer-poll', tone: 'todo' };
}
