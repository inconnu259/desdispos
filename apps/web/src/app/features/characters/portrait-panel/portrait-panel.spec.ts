import { TestBed } from '@angular/core/testing';
import { PortraitPanel } from './portrait-panel';
import { API_BASE } from '../../../core/api-base';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('PortraitPanel', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(portraitUrl: string | null, name = 'Fenn', characterId = 'char1') {
    TestBed.configureTestingModule({ imports: [PortraitPanel] });
    const fixture = TestBed.createComponent(PortraitPanel);
    fixture.componentRef.setInput('portraitUrl', portraitUrl);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('characterId', characterId);
    fixture.detectChanges();
    return fixture;
  }

  it("n'affiche rien si aucun portrait n'existe (pas de placeholder vide)", () => {
    const fixture = setup(null);
    expect(fixture.nativeElement.querySelector('.portrait-panel')).toBeNull();
  });

  it('affiche la carte avec l\'image complète (route protégée /characters/:id/portrait) et la légende "Portrait complet"', () => {
    const fixture = setup('/uploads/portraits/x.jpg', 'Fenn', 'char1');
    const panel = fixture.nativeElement.querySelector('.portrait-panel');
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.portrait-panel__img');
    expect(panel).not.toBeNull();
    expect(img.src).toBe(`${API_BASE}/characters/char1/portrait`);
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['portrait.panel_caption']);
  });

  it('alt text mentionne le nom du personnage', () => {
    const fixture = setup('/uploads/portraits/x.jpg', 'Fenn');
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.portrait-panel__img');
    expect(img.alt).toBe(fillTone(GRIMOIRE_TONE['portrait.panel_alt'], { name: 'Fenn' }));
  });
});
