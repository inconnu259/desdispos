import { TestBed } from '@angular/core/testing';
import { RulesReminder } from './rules-reminder';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('RulesReminder', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('rendu statique, aucune interaction/output', async () => {
    TestBed.configureTestingModule({ imports: [RulesReminder] });
    const fixture = TestBed.createComponent(RulesReminder);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['parties.xp_rules_title']);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
