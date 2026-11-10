import { fillTone } from './tone-format';

describe('fillTone — remplissage des trous d’un gabarit de ton (Story 35.2)', () => {
  it('remplace chaque trou par sa valeur, nombres compris', () => {
    expect(fillTone('{n} sur {total} ont répondu', { n: 2, total: 5 })).toBe('2 sur 5 ont répondu');
  });

  it('remplace toutes les occurrences d’un même trou', () => {
    expect(fillTone('{x} puis {x}', { x: 'a' })).toBe('a puis a');
  });

  it('laisse intact un trou sans valeur', () => {
    expect(fillTone('Bonjour {name}', {})).toBe('Bonjour {name}');
  });

  it('insère la valeur telle quelle, sans interpréter les motifs de remplacement', () => {
    expect(fillTone('Bonjour {name}', { name: "$& l'$'" })).toBe("Bonjour $& l'$'");
  });

  it('ignore une clé héritée du prototype', () => {
    expect(fillTone('{constructor}', {})).toBe('{constructor}');
  });
});
