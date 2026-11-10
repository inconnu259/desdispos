import { firstSentence } from './card-subtitle';

describe('firstSentence (Story 31.4, AC7)', () => {
  it('AC7 — garde la première phrase seulement', () => {
    expect(
      firstSentence(
        'Ces spécialistes savent créer tout ce qui est joli. En voyage, ils réparent tout.',
      ),
    ).toBe('Ces spécialistes savent créer tout ce qui est joli.');
  });

  it('un texte sans point final est rendu tel quel', () => {
    expect(firstSentence('Une seule phrase sans point')).toBe('Une seule phrase sans point');
  });

  it("« etc. » suivi d'une minuscule ne coupe pas la phrase", () => {
    expect(firstSentence('Beaux, pratiques, etc. et surtout utiles. Fin.')).toBe(
      'Beaux, pratiques, etc. et surtout utiles.',
    );
  });

  it('les points de suspension finaux ne sont pas tronqués', () => {
    expect(firstSentence('Tout, sauf la vie en extérieur...')).toBe(
      'Tout, sauf la vie en extérieur...',
    );
  });

  it('AC7 — pas de texte ⇒ undefined (jamais un sous-titre vide)', () => {
    expect(firstSentence(undefined)).toBeUndefined();
    expect(firstSentence('   ')).toBeUndefined();
  });
});
