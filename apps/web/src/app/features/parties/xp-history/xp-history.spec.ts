import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { XpDistributionDto } from '@desdispos/shared';
import { XpHistory } from './xp-history';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';

function makeToneService() {
  return { tone: signal(TONE_MAP['grimoire-emeraude']) };
}

async function createFixture(distributions: XpDistributionDto[]) {
  await TestBed.configureTestingModule({
    imports: [XpHistory],
    providers: [{ provide: ThemeToneService, useValue: makeToneService() }],
  }).compileComponents();

  const fixture = TestBed.createComponent(XpHistory);
  fixture.componentRef.setInput('distributions', distributions);
  fixture.componentRef.setInput('characters', [
    makeCharacterDto({ id: 'c1', sheetData: { narrative: { name: 'Fenn' } } }),
  ]);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('XpHistory', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('liste vide → empty state', async () => {
    const { el } = await createFixture([]);
    expect(el.querySelector('.xp-history__empty')).toBeTruthy();
    expect(el.querySelector('.xp-history__list')).toBeNull();
  });

  it('liste non vide → date/montant total/répartition par joueur affichés', async () => {
    const { el } = await createFixture([
      {
        id: 'd1',
        partieId: 'p1',
        note: 'Bien joué',
        createdAt: '2026-07-01T00:00:00.000Z',
        entries: [
          {
            characterId: 'c1',
            amount: 250,
            isBonus: false,
            ownerPseudo: 'alice',
            ownerDisplayName: 'Alice au pays',
          },
          {
            characterId: 'c1',
            amount: 50,
            isBonus: true,
            ownerPseudo: 'alice',
            ownerDisplayName: 'Alice au pays',
          },
        ],
      },
    ]);

    expect(el.textContent).toContain('300 XP');
    expect(el.textContent).toContain('Fenn');
    expect(el.textContent).toContain('Bien joué');
  });
});
