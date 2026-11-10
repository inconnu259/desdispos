import { TestBed } from '@angular/core/testing';
import type { CharacterDto } from '@master-jdr/shared';
import { LevelUpBanner } from './level-up-banner';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeCharacter(overrides: Partial<CharacterDto> = {}): CharacterDto {
  return {
    id: 'char1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    sheetData: {},
    derived: { PV: 16, PE: 12, Condition: 14, Initiative: 10, Encombrement: 11 },
    portraitUrl: null,
    portraitCropData: null,
    pdfPortraitCropData: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ownerPseudo: 'alice',
    ownerDisplayName: 'Alice au pays',
    ownerIsMj: false,
    viewerIsMj: false,
    xp: 0,
    level: 1,
    journalAutoAssociate: false,
    ...overrides,
  };
}

describe('LevelUpBanner', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('aucun niveau en attente → bannière absente', async () => {
    TestBed.configureTestingModule({ imports: [LevelUpBanner] });
    const fixture = TestBed.createComponent(LevelUpBanner);
    fixture.componentRef.setInput('character', makeCharacter({ xp: 0 }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.level-up-banner')).toBeNull();
  });

  it('niveau en attente → bannière visible avec aria-live="polite" et texte du niveau', async () => {
    TestBed.configureTestingModule({ imports: [LevelUpBanner] });
    const fixture = TestBed.createComponent(LevelUpBanner);
    fixture.componentRef.setInput('character', makeCharacter({ xp: 150 }));
    fixture.detectChanges();
    await fixture.whenStable();

    // La région live est le conteneur persistant (présent même sans niveau en attente) — c'est lui
    // qui porte aria-live, pour que l'apparition de la bannière soit annoncée.
    const live = fixture.nativeElement.querySelector('.level-up-banner-live');
    expect(live.getAttribute('aria-live')).toBe('polite');
    const banner = fixture.nativeElement.querySelector('.level-up-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain(
      GRIMOIRE_TONE['evolution.levelup_banner'].replace('[N]', '2'),
    );
  });

  it('clic sur le CTA émet levelUp', async () => {
    TestBed.configureTestingModule({ imports: [LevelUpBanner] });
    const fixture = TestBed.createComponent(LevelUpBanner);
    fixture.componentRef.setInput('character', makeCharacter({ xp: 150 }));
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    fixture.componentInstance.levelUp.subscribe(() => (emitted = true));
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();

    expect(emitted).toBe(true);
  });

  it('respecte le nombre de levelUps déjà appliqués (sheetData.levelUps.length)', async () => {
    TestBed.configureTestingModule({ imports: [LevelUpBanner] });
    const fixture = TestBed.createComponent(LevelUpBanner);
    fixture.componentRef.setInput(
      'character',
      makeCharacter({
        xp: 150,
        sheetData: {
          levelUps: [{ level: 2, pvAllocated: 2, peAllocated: 1, capabilities: [] }],
        },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.level-up-banner')).toBeNull();
  });
});
