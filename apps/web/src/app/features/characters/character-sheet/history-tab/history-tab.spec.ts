import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { CharacterSnapshotDto, GameSystemContentDto } from '@master-jdr/shared';
import { HistoryTab } from './history-tab';
import { CharacterService } from '../../../../core/characters/character.service';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeSnapshot(overrides: Partial<CharacterSnapshotDto> = {}): CharacterSnapshotDto {
  return {
    id: 's1',
    characterId: 'char1',
    sheetData: {},
    derived: { PV: 16, PE: 12, Condition: 14, Initiative: 10, Encombrement: 11 },
    level: 2,
    trigger: 'LEVEL_UP',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function createComponent(
  getHistory: () => Promise<CharacterSnapshotDto[]>,
  content: GameSystemContentDto | null = null,
) {
  await TestBed.configureTestingModule({
    imports: [HistoryTab],
    providers: [{ provide: CharacterService, useValue: { getHistory: vi.fn(getHistory) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(HistoryTab);
  fixture.componentRef.setInput('characterId', 'char1');
  fixture.componentRef.setInput('content', content);
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  return fixture;
}

describe('HistoryTab', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('liste vide → empty state', async () => {
    const fixture = await createComponent(() => Promise.resolve([]));
    expect(fixture.nativeElement.querySelector('.history-tab__empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.history-tab__list')).toBeNull();
  });

  it('liste non vide → date/déclencheur/note affichés, dans l’ordre reçu du backend', async () => {
    const snapshots = [
      makeSnapshot({ id: 's2', level: 3, note: 'MJ a corrigé une erreur', trigger: 'MJ_EDIT' }),
      makeSnapshot({ id: 's1', level: 2 }),
    ];
    const fixture = await createComponent(() => Promise.resolve(snapshots));

    const entries = fixture.nativeElement.querySelectorAll('.history-tab__entry');
    expect(entries.length).toBe(2);
    expect(entries[0].textContent).toContain(GRIMOIRE_TONE['evolution.mj_edit_trace']);
    expect(entries[0].textContent).toContain('MJ a corrigé une erreur');
    expect(entries[1].textContent).toContain('Niveau 2');
  });

  it('instantané LEVEL_UP → affiche le choix de capacité fait à cette montée (fusion Historique/choix)', async () => {
    const snapshot = makeSnapshot({
      level: 3,
      sheetData: {
        levelUps: [
          {
            level: 2,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
          },
          {
            level: 3,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'landscape', params: { key: 'foret' } }],
          },
        ],
      },
    });
    const content: GameSystemContentDto = {
      landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
    };
    const fixture = await createComponent(() => Promise.resolve([snapshot]), content);

    const entry = fixture.nativeElement.querySelector('.history-tab__entry');
    expect(entry.textContent).toContain('Paysage/climat favori : Forêt');
  });

  it('instantané MJ_EDIT → aucun choix de capacité affiché (pas de crash)', async () => {
    const snapshot = makeSnapshot({ trigger: 'MJ_EDIT', level: 1 });
    const fixture = await createComponent(() => Promise.resolve([snapshot]));

    expect(fixture.nativeElement.querySelector('.history-tab__choice')).toBeNull();
  });
});
