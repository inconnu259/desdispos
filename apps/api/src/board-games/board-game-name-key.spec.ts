import { boardGameNameKey } from '@master-jdr/shared';

// Story 48.1 — la normalisation unique des noms de jeu vit dans @master-jdr/shared, qui n'a pas de
// lanceur de tests : elle est éprouvée ici, côté API, son premier consommateur.
describe('boardGameNameKey (Story 48.1)', () => {
  it('ignore la casse', () => {
    expect(boardGameNameKey('AZUL')).toBe('azul');
    expect(boardGameNameKey('Terraforming Mars')).toBe('terraforming mars');
  });

  it('retire les accents (décomposition NFD, diacritiques supprimés)', () => {
    expect(boardGameNameKey('Éclipse')).toBe('eclipse');
    expect(boardGameNameKey('zèbre')).toBe('zebre');
    expect(boardGameNameKey('ÀZUL')).toBe('azul');
    expect(boardGameNameKey('Çà et là')).toBe('ca et la');
    // Forme déjà décomposée (e + accent combinant) : même clé que la forme composée.
    expect(boardGameNameKey('E' + String.fromCharCode(0x0301) + 'clipse')).toBe('eclipse');
  });

  it('rogne les bords et réduit les espaces intérieurs à un seul', () => {
    expect(boardGameNameKey('  Azul ')).toBe('azul');
    expect(boardGameNameKey('The   Crew')).toBe('the crew');
    expect(boardGameNameKey('\tSkull \n King ')).toBe('skull king');
  });

  it('« Azul » et «  ÀZUL » ont la même clé (doublon refusé)', () => {
    expect(boardGameNameKey('  ÀZUL ')).toBe(boardGameNameKey('Azul'));
  });

  it('un accent combinant isolé en fin de nom ne laisse pas d’espace (accents retirés AVANT de rogner)', () => {
    expect(boardGameNameKey('Azul ' + String.fromCharCode(0x0301))).toBe('azul');
  });

  it('les marques d’une autre écriture sont gardées : deux noms japonais distincts restent distincts', () => {
    expect(boardGameNameKey('ガイスター')).not.toBe(boardGameNameKey('カイスター'));
  });

  it('les caractères de format invisibles disparaissent (espace sans chasse, trait d’union conditionnel, BOM)', () => {
    const zwsp = String.fromCharCode(0x200b);
    const shy = String.fromCharCode(0x00ad);
    const bom = String.fromCharCode(0xfeff);
    expect(boardGameNameKey(`Az${zwsp}ul`)).toBe('azul');
    expect(boardGameNameKey(`Ter${shy}raforming Mars`)).toBe('terraforming mars');
    expect(boardGameNameKey(`${bom}Skull${zwsp}`)).toBe('skull');
  });

  it('un nom vide ou blanc donne une clé vide', () => {
    expect(boardGameNameKey('')).toBe('');
    expect(boardGameNameKey('   ')).toBe('');
  });

  it("garde la ponctuation et les chiffres : seuls casse, accents et espaces s'effacent", () => {
    expect(boardGameNameKey('7 Wonders: Duel')).toBe('7 wonders: duel');
  });
});
