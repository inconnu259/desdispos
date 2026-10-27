import type { PartieMemberDto, SessionPollDto } from '@master-jdr/shared';
import {
  getMissingVoters,
  getMissingVotersForOption,
  getRespondedCount,
  hasUnansweredOptions,
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
