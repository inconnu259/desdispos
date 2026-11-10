import { bestOption, hasAnswered } from '@desdispos/shared';
import type { PartieMemberDto, SessionPollDto } from '@desdispos/shared';
import {
  getMissingVoters,
  getMissingVotersForOption,
  getRespondedCount,
  hasUnansweredOptions,
  pollAnswerCounts,
  pollRankableOptions,
} from './poll.util';

const members: PartieMemberDto[] = [
  {
    role: 'MEMBER',
    userId: 'u1',
    pseudo: 'Alice',
    displayName: 'Alice au pays',
    email: 'alice@test.com',
    joinedAt: '',
  },
  {
    role: 'MEMBER',
    userId: 'u2',
    pseudo: 'Bob',
    displayName: 'Bobby',
    email: 'bob@test.com',
    joinedAt: '',
  },
];

function makePoll(options: SessionPollDto['options']): SessionPollDto {
  return {
    id: 'poll1',
    partieId: 'p1',
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    // Story 36.6 — effectif de la troupe (MJ + membres).
    membersCount: 4,
    durationSlots: 1,
    options,
  };
}

describe('poll.util', () => {
  it('getMissingVoters : aucun manquant si tous ont voté sur toutes les options', () => {
    const poll = makePoll([
      {
        id: 'opt1',
        date: '2026-08-01T00:00:00.000Z',
        slot: 'MORNING',
        votes: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'NO' },
        ],
      },
    ]);
    expect(getMissingVoters(poll, members)).toEqual([]);
  });

  it("getMissingVoters : tous manquants si personne n'a voté", () => {
    const poll = makePoll([
      { id: 'opt1', date: '2026-08-01T00:00:00.000Z', slot: 'MORNING', votes: [] },
    ]);
    expect(getMissingVoters(poll, members)).toEqual(members);
  });

  it('getMissingVoters : réponse partielle (1/2 options) → toujours manquant', () => {
    const poll = makePoll([
      {
        id: 'opt1',
        date: '2026-08-01T00:00:00.000Z',
        slot: 'MORNING',
        votes: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'NO' },
        ],
      },
      {
        id: 'opt2',
        date: '2026-08-08T00:00:00.000Z',
        slot: 'AFTERNOON',
        votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' }],
      },
    ]);
    expect(getMissingVoters(poll, members)).toEqual([members[1]]);
  });

  it('getMissingVoters : liste de membres vide → tableau vide', () => {
    const poll = makePoll([
      { id: 'opt1', date: '2026-08-01T00:00:00.000Z', slot: 'MORNING', votes: [] },
    ]);
    expect(getMissingVoters(poll, [])).toEqual([]);
  });

  it('getMissingVoters : poll sans options → aucun manquant', () => {
    const poll = makePoll([]);
    expect(getMissingVoters(poll, members)).toEqual([]);
  });

  it('getRespondedCount : reflète le nombre de membres ayant répondu', () => {
    const poll = makePoll([
      {
        id: 'opt1',
        date: '2026-08-01T00:00:00.000Z',
        slot: 'MORNING',
        votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' }],
      },
    ]);
    expect(getRespondedCount(poll, members)).toBe(1);
  });

  it('getMissingVotersForOption : ne considère que les votes de CETTE option (granularité par date)', () => {
    const opt1 = {
      id: 'opt1',
      date: '2026-08-01T00:00:00.000Z',
      slot: 'MORNING' as const,
      votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' as const }],
    };
    // Alice a voté sur opt1 → absente des manquants ; Bob n'a pas voté sur opt1 → présent
    expect(getMissingVotersForOption(opt1, members)).toEqual([members[1]]);
  });

  it('getMissingVotersForOption : aucun manquant si tous ont voté sur cette option précise', () => {
    const opt1 = {
      id: 'opt1',
      date: '2026-08-01T00:00:00.000Z',
      slot: 'MORNING' as const,
      votes: [
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' as const },
        { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'NO' as const },
      ],
    };
    expect(getMissingVotersForOption(opt1, members)).toEqual([]);
  });

  it('getMissingVotersForOption : un membre ayant voté sur une AUTRE option mais pas celle-ci reste manquant ici', () => {
    // Bob a voté sur opt2 mais pas opt1 : pour opt1 spécifiquement, il doit être listé comme manquant
    const opt1 = {
      id: 'opt1',
      date: '2026-08-01T00:00:00.000Z',
      slot: 'MORNING' as const,
      votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' as const }],
    };
    expect(getMissingVotersForOption(opt1, members).map((m) => m.userId)).toEqual(['u2']);
  });

  it("hasUnansweredOptions : true si l'utilisateur n'a pas voté sur au moins une option", () => {
    const poll = makePoll([
      {
        id: 'opt1',
        date: '2026-08-01T00:00:00.000Z',
        slot: 'MORNING',
        votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' }],
      },
      { id: 'opt2', date: '2026-08-08T00:00:00.000Z', slot: 'AFTERNOON', votes: [] },
    ]);
    expect(hasUnansweredOptions(poll, 'u1')).toBe(true);
  });

  it("hasUnansweredOptions : false si l'utilisateur a voté sur toutes les options", () => {
    const poll = makePoll([
      {
        id: 'opt1',
        date: '2026-08-01T00:00:00.000Z',
        slot: 'MORNING',
        votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' }],
      },
      {
        id: 'opt2',
        date: '2026-08-08T00:00:00.000Z',
        slot: 'AFTERNOON',
        votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'NO' }],
      },
    ]);
    expect(hasUnansweredOptions(poll, 'u1')).toBe(false);
  });

  it("hasUnansweredOptions : false si le poll n'a aucune option (rien à répondre)", () => {
    const poll = makePoll([]);
    expect(hasUnansweredOptions(poll, 'u1')).toBe(false);
  });
});

// Story 54.2 — l'adaptateur unique vers `bestOption` et les comptes alignés sur la Destinée.
describe('poll.util — pollRankableOptions / pollAnswerCounts (Story 54.2)', () => {
  const vote = (userId: string, answer: 'YES' | 'NO' | 'MAYBE') => ({
    userId,
    pseudo: userId,
    displayName: userId,
    answer,
  });
  const option = (
    id: string,
    date: string,
    slot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY',
    votes: ReturnType<typeof vote>[],
  ) => ({ id, date, slot, votes });

  it('pollRankableOptions : une entrée par option, dans l’ordre servi, date ramenée au jour, comptes par réponse', () => {
    const poll = makePoll([
      option('b', '2026-11-08T00:00:00.000Z', 'EVENING', [vote('u1', 'YES'), vote('u2', 'NO')]),
      option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [
        vote('u1', 'MAYBE'),
        vote('u2', 'YES'),
        vote('u3', 'YES'),
      ]),
    ]);
    expect(pollRankableOptions(poll)).toEqual([
      { optionId: 'b', date: '2026-11-08', slot: 'EVENING', yes: 1, maybe: 0, no: 1 },
      { optionId: 'a', date: '2026-11-07', slot: 'MORNING', yes: 2, maybe: 1, no: 0 },
    ]);
  });

  it('bestOption sur sa sortie : le plus de « oui », puis de « peut-être », puis le plus tôt', () => {
    const poll = makePoll([
      option('b', '2026-11-08T00:00:00.000Z', 'EVENING', [vote('u1', 'YES')]),
      option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [vote('u1', 'YES'), vote('u2', 'MAYBE')]),
    ]);
    expect(bestOption(pollRankableOptions(poll), '2026-11-01')?.optionId).toBe('a');
  });

  it('bestOption : aucun « oui » → null ; créneaux passés exclus', () => {
    const noYes = makePoll([
      option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [vote('u1', 'NO')]),
    ]);
    expect(bestOption(pollRankableOptions(noYes), '2026-11-01')).toBeNull();
    const past = makePoll([
      option('a', '2026-10-01T00:00:00.000Z', 'MORNING', [vote('u1', 'YES')]),
    ]);
    expect(bestOption(pollRankableOptions(past), '2026-11-01')).toBeNull();
  });

  it('pollAnswerCounts : le MJ ayant répondu est compté, une réponse partielle ne l’est pas', () => {
    const poll = makePoll([
      option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [vote('mj', 'YES'), vote('u1', 'YES')]),
      option('b', '2026-11-08T00:00:00.000Z', 'MORNING', [vote('mj', 'NO')]),
    ]);
    expect(pollAnswerCounts(poll)).toEqual({ eligible: 4, answered: 1, missing: 3 });
  });

  it('pollAnswerCounts : aucun vote → tous manquent', () => {
    const poll = makePoll([option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [])]);
    expect(pollAnswerCounts(poll)).toEqual({ eligible: 4, answered: 0, missing: 4 });
  });

  it('pollAnswerCounts : `missing` n’est jamais négatif', () => {
    const poll = {
      ...makePoll([
        option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [vote('u1', 'YES'), vote('u2', 'YES')]),
      ]),
      membersCount: 1,
    };
    expect(pollAnswerCounts(poll)).toEqual({ eligible: 1, answered: 2, missing: 0 });
  });

  it('pollAnswerCounts : mêmes valeurs qu’une entrée de la Destinée construite sur le même sondage', () => {
    const poll = makePoll([
      option('a', '2026-11-07T00:00:00.000Z', 'MORNING', [vote('u1', 'YES'), vote('u2', 'NO')]),
      option('b', '2026-11-08T00:00:00.000Z', 'MORNING', [vote('u1', 'MAYBE')]),
    ]);
    // Le serveur (`my-open-polls.service.ts`) : éligibles = membersCount, répondu = a répondu à TOUTES les options.
    const optionIds = poll.options.map((o) => o.id);
    const answeredByServerRule = ['u1', 'u2'].filter((id) =>
      hasAnswered(
        'jdr',
        optionIds,
        poll.options.filter((o) => o.votes.some((v) => v.userId === id)).map((o) => o.id),
      ),
    ).length;
    const counts = pollAnswerCounts(poll);
    expect(counts.eligible).toBe(poll.membersCount);
    expect(counts.answered).toBe(answeredByServerRule);
  });
});
