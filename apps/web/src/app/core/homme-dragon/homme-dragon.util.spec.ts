import { THEMES, TONE_MAP } from '../theme/tones';
import { hommeDragonAventuresLabel, hommeDragonName } from './homme-dragon.util';

describe('hommeDragonName (Story 33.5)', () => {
  it('rend le nom normalisé', () => {
    expect(hommeDragonName('  Skarn ')).toBe('Skarn');
  });

  it.each([undefined, null, '', '   '])('repli lisible pour %j', (nom) => {
    expect(hommeDragonName(nom)).toBe('Homme Dragon sans nom');
  });
});

describe('hommeDragonAventuresLabel (Story 33.8)', () => {
  const sansAventure = TONE_MAP['grimoire-emeraude']['core.homme_dragon_sans_aventure'];

  it('joint les noms des aventures dans l’ordre reçu', () => {
    expect(
      hommeDragonAventuresLabel(
        [{ nom: 'Les Vents du Nord' }, { nom: "L'Archipel" }],
        sansAventure,
      ),
    ).toBe("Les Vents du Nord · L'Archipel");
  });

  it('une seule aventure → son nom', () => {
    expect(hommeDragonAventuresLabel([{ nom: 'Les Vents du Nord' }], sansAventure)).toBe(
      'Les Vents du Nord',
    );
  });

  it.each([[[]], [undefined], [null]])('sans aventure (%j) → le texte du thème', (aventures) => {
    expect(hommeDragonAventuresLabel(aventures, sansAventure)).toBe(sansAventure);
  });

  // Story 35.3 — le libellé « sans aventure » est celui du thème passé, jamais un repli du thème de
  // référence : chaque thème a le sien.
  for (const theme of THEMES) {
    it(`${theme} : sans aventure → le texte de ce thème`, () => {
      const tone = TONE_MAP[theme];
      expect(hommeDragonAventuresLabel([], tone['core.homme_dragon_sans_aventure'])).toBe(
        tone['core.homme_dragon_sans_aventure'],
      );
    });
  }

  it('le texte « sans aventure » diffère d’un thème à l’autre', () => {
    const labels = THEMES.map((theme) => TONE_MAP[theme]['core.homme_dragon_sans_aventure']);
    expect(new Set(labels).size).toBe(THEMES.length);
  });
});
