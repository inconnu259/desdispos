import { hasAnswered } from '@master-jdr/shared';
import type {
  PartieMemberDto,
  PollOptionDto,
  RankableOption,
  SessionPollDto,
} from '@master-jdr/shared';

/** Les options sur lesquelles `userId` a voté. */
function votedOptionIds(poll: SessionPollDto, userId: string): string[] {
  return poll.options.filter((opt) => opt.votes.some((v) => v.userId === userId)).map((o) => o.id);
}

/** Membres n'ayant pas répondu à TOUTES les options du poll (a répondu = a voté sur chaque option). */
export function getMissingVoters(
  poll: SessionPollDto,
  members: PartieMemberDto[],
): PartieMemberDto[] {
  // Story 44.2 : « a répondu » est la règle partagée `hasAnswered` (JDR : une réponse à CHAQUE option).
  const optionIds = poll.options.map((o) => o.id);
  return members.filter((m) => !hasAnswered('jdr', optionIds, votedOptionIds(poll, m.userId)));
}

export function getRespondedCount(poll: SessionPollDto, members: PartieMemberDto[]): number {
  return members.length - getMissingVoters(poll, members).length;
}

/** Membres n'ayant pas voté sur CETTE option précise (granularité par date, pas globale). */
export function getMissingVotersForOption(
  opt: PollOptionDto,
  members: PartieMemberDto[],
): PartieMemberDto[] {
  return members.filter((m) => !opt.votes.some((v) => v.userId === m.userId));
}

/**
 * true si l'utilisateur donné n'a pas encore voté sur au moins une option du poll.
 * Un poll sans option (normalement impossible — CreatePollDto impose 2 à 40 options)
 * est traité comme "répondu" (rien à répondre) plutôt que de faire planter le badge.
 */
export function hasUnansweredOptions(poll: SessionPollDto, userId: string): boolean {
  return !hasAnswered(
    'jdr',
    poll.options.map((o) => o.id),
    votedOptionIds(poll, userId),
  );
}

/**
 * Story 54.2 — une option de vote telle que `bestOption` / `rankedEntrySlots` la lisent : le `RankableOption`
 * de `@master-jdr/shared` plus l'identifiant de l'option et le nombre de « non ».
 */
export type PollRankableOption = RankableOption & { optionId: string; no: number };

/**
 * LE SEUL adaptateur `SessionPollDto` → options classables (Story 54.2, revue A-10). Une entrée par option,
 * dans l'ordre servi ; la date est ramenée au jour `YYYY-MM-DD` ; les comptes sont ceux de `option.votes`.
 * Le meilleur créneau s'obtient par `bestOption(pollRankableOptions(poll), todayKey)`, sans autre classement.
 */
export function pollRankableOptions(poll: SessionPollDto): PollRankableOption[] {
  return poll.options.map((o) => ({
    optionId: o.id,
    date: o.date.substring(0, 10),
    slot: o.slot,
    yes: o.votes.filter((v) => v.answer === 'YES').length,
    maybe: o.votes.filter((v) => v.answer === 'MAYBE').length,
    no: o.votes.filter((v) => v.answer === 'NO').length,
  }));
}

/**
 * Story 54.2 — les comptes d'un vote, alignés sur la Destinée (`OpenPollEntry.eligibleCount` /
 * `answeredCount`) : `eligible` = l'effectif de la troupe (le MJ et ses membres, `membersCount`) ;
 * `answered` = les votants distincts qui ont répondu à CHAQUE option (`hasAnswered('jdr', …)`, une
 * réponse partielle ne compte pas) ; `missing` = le reste, jamais négatif.
 */
export function pollAnswerCounts(poll: SessionPollDto): {
  eligible: number;
  answered: number;
  missing: number;
} {
  const optionIds = poll.options.map((o) => o.id);
  const voterIds = new Set(poll.options.flatMap((o) => o.votes.map((v) => v.userId)));
  let answered = 0;
  for (const userId of voterIds) {
    if (hasAnswered('jdr', optionIds, votedOptionIds(poll, userId))) answered++;
  }
  const eligible = poll.membersCount;
  return { eligible, answered, missing: Math.max(0, eligible - answered) };
}
