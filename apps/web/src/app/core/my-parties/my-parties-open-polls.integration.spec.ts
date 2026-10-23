import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { PartieDto } from '@master-jdr/shared';
import { MyPartiesService } from './my-parties.service';
import { OpenPollsService } from '../poll/open-polls.service';
import { PartiesService } from '../parties/parties.service';
import { PollService } from '../poll/poll.service';

// Intégration du VRAI MyPartiesService avec le VRAI OpenPollsService (seuls les services de niveau
// HTTP sont simulés) : un refresh de la liste unique (Story 38.5) ne doit pas relancer la lecture de
// `GET /me/open-polls` tant que l'ENSEMBLE de mes parties ne change pas (classe de bug « tempête de
// requêtes », cf. open-polls.service.ts). Story 44.2 : une seule lecture, plus un fan-out par partie.

@Component({ selector: 'app-test-host', template: '', standalone: true })
class TestHost {
  readonly myParties = inject(MyPartiesService);
  readonly openPolls = inject(OpenPollsService);
}

function makeParty(id: string, role: PartieDto['role'], isFavorite = false): PartieDto {
  return {
    id,
    name: `Party ${id}`,
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj-1',
    createdAt: '',
    nextSessionDate: null,
    nextSessionSlot: null,
    role,
    status: 'EN_COURS',
    isFavorite,
    coverImageVersion: null,
  } as PartieDto;
}

async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

describe('MyPartiesService × OpenPollsService (Story 38.5, 44.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(initial: PartieDto[]) {
    let current = initial;
    const list = vi.fn(() => Promise.resolve(current));
    const getMyOpenPolls = vi.fn().mockResolvedValue([]);
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: PartiesService, useValue: { list } },
        { provide: PollService, useValue: { getMyOpenPolls } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    await fixture.componentInstance.myParties.refreshAll();
    await settle(fixture);
    return {
      fixture,
      myParties: fixture.componentInstance.myParties,
      getMyOpenPolls,
      next: async (parties: PartieDto[]) => {
        current = parties;
        await fixture.componentInstance.myParties.refreshAll();
        await settle(fixture);
      },
    };
  }

  it("un refresh où seul le favori d'une partie change ne relance aucune lecture des votes", async () => {
    const { getMyOpenPolls, next } = await setup([
      makeParty('mj1', 'mj'),
      makeParty('pl1', 'player'),
    ]);
    expect(getMyOpenPolls).toHaveBeenCalledTimes(1); // UNE lecture pour toutes mes parties
    getMyOpenPolls.mockClear();

    await next([makeParty('mj1', 'mj', true), makeParty('pl1', 'player')]);

    expect(getMyOpenPolls).not.toHaveBeenCalled();
  });

  it("un changement de l'ensemble de mes parties relance UNE lecture", async () => {
    const { getMyOpenPolls, next } = await setup([
      makeParty('mj1', 'mj'),
      makeParty('pl1', 'player'),
    ]);
    getMyOpenPolls.mockClear();

    await next([makeParty('mj1', 'mj'), makeParty('pl1', 'player'), makeParty('pl2', 'player')]);

    expect(getMyOpenPolls).toHaveBeenCalledTimes(1);
  });

  it('allParties() est en lecture seule : aucun .set() possible hors refreshAll()', async () => {
    const { myParties } = await setup([]);
    expect((myParties.allParties as unknown as { set?: unknown }).set).toBeUndefined();
  });
});
