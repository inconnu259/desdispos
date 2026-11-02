import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import {
  CharacterCreationEntries,
  type CharacterCreationEntry,
} from './character-creation-entries';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../../core/theme/tones';
import { fillTone } from '../../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeEntry(overrides: Partial<CharacterCreationEntry> = {}): CharacterCreationEntry {
  return {
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    partieName: 'La Forêt Noire',
    ...overrides,
  };
}

async function createFixture(entries: CharacterCreationEntry[]) {
  await TestBed.configureTestingModule({
    imports: [CharacterCreationEntries],
    providers: [
      provideRouter([]),
      { provide: ThemeToneService, useValue: { tone: signal(TONE_MAP['grimoire-emeraude']) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CharacterCreationEntries);
  fixture.componentRef.setInput('entries', entries);
  fixture.detectChanges();
  return { fixture };
}

describe('CharacterCreationEntries (Story 29.16)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('chaque ligne se termine par le pictogramme ouvrir, décoratif, sans caractère ›', async () => {
    const { fixture } = await createFixture([makeEntry({ partieId: 'p1' }), makeEntry({ partieId: 'p2' })]);

    const chevrons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.character-creation-entries__chevron'),
    ) as HTMLElement[];
    expect(chevrons.length).toBe(2);
    for (const chevron of chevrons) {
      expect(chevron.getAttribute('aria-hidden')).toBe('true');
      expect(chevron.querySelector('app-icon')?.getAttribute('data-icon')).toBe('ouvrir');
      expect(chevron.textContent?.trim()).toBe('');
    }
  });

  it('aucune entrée → rien n’est rendu, ni titre ni cadre', async () => {
    const { fixture } = await createFixture([]);

    expect(fixture.nativeElement.querySelector('.character-creation-entries')).toBeNull();
  });

  it('une ligne par entrée, libellé complet (verbe + partie), vrai lien avec le bon gameSystemId', async () => {
    const { fixture } = await createFixture([
      makeEntry({ partieId: 'p1', partieName: 'La Forêt Noire' }),
    ]);

    const rows: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll(
      '.character-creation-entries__row',
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tagName).toBe('A');
    expect(rows[0].textContent).toContain('Créer un voyageur pour La Forêt Noire');
    expect(rows[0].getAttribute('href')).toContain('/parties/p1/characters/new');
    expect(rows[0].getAttribute('href')).toContain('gameSystemId=ryuutama');
  });

  it('ligne d’Homme Dragon : libellé « Créer un Homme Dragon pour … », vrai lien vers la route de la fiche', async () => {
    const { fixture } = await createFixture([
      makeEntry({ kind: 'hommeDragon', partieId: 'p9', partieName: 'Le Convoi du Nord' }),
    ]);

    const rows: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll(
      '.character-creation-entries__row',
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tagName).toBe('A');
    expect(rows[0].textContent).toContain('Créer un Homme Dragon pour Le Convoi du Nord');
    expect(rows[0].getAttribute('href')).toBe('/parties/p9/homme-dragon');
  });

  it('ligne d’Homme Dragon : modificateur de teinte et marqueur de nature décoratif (aria-hidden)', async () => {
    const { fixture } = await createFixture([makeEntry({ kind: 'hommeDragon', partieId: 'p9' })]);

    const row: HTMLElement = fixture.nativeElement.querySelector(
      '.character-creation-entries__row',
    );
    expect(row.classList).toContain('character-creation-entries__row--dragon');
    const nature: HTMLElement = row.querySelector('.character-creation-entries__nature')!;
    expect(nature.getAttribute('aria-hidden')).toBe('true');
    expect(nature.querySelector('app-nature-marker')?.textContent).toContain('Homme Dragon');
  });

  it('ligne de personnage joueur : ni modificateur de teinte ni marqueur de nature', async () => {
    const { fixture } = await createFixture([makeEntry()]);

    const row: HTMLElement = fixture.nativeElement.querySelector(
      '.character-creation-entries__row',
    );
    expect(row.classList).not.toContain('character-creation-entries__row--dragon');
    expect(row.querySelector('app-nature-marker')).toBeNull();
  });

  it('une ligne de personnage et une ligne d’Homme Dragon sur la même partie coexistent', async () => {
    const { fixture } = await createFixture([
      makeEntry({ partieId: 'p1' }),
      makeEntry({ kind: 'hommeDragon', partieId: 'p1' }),
    ]);

    expect(fixture.nativeElement.querySelectorAll('.character-creation-entries__row').length).toBe(
      2,
    );
  });

  it('plusieurs entrées : chacune sa propre ligne, dans l’ordre reçu', async () => {
    const { fixture } = await createFixture([
      makeEntry({ partieId: 'p1', partieName: 'La Forêt Noire' }),
      makeEntry({ partieId: 'p2', partieName: 'Le Donjon Oublié' }),
    ]);

    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '.character-creation-entries__row',
    );
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('La Forêt Noire');
    expect(rows[1].textContent).toContain('Le Donjon Oublié');
  });

  it('3 entrées ou moins → aucun bouton de divulgation', async () => {
    const { fixture } = await createFixture([
      makeEntry({ partieId: 'p1' }),
      makeEntry({ partieId: 'p2' }),
      makeEntry({ partieId: 'p3' }),
    ]);

    expect(fixture.nativeElement.querySelector('.character-creation-entries__toggle')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.character-creation-entries__row').length).toBe(
      3,
    );
  });

  it('>3 entrées : 3 visibles + « Voir les N autres », qui bascule vers « Voir moins » puis revient', async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ partieId: `p${i}`, partieName: `Partie ${i}` }),
    );
    const { fixture } = await createFixture(entries);

    let rows = fixture.nativeElement.querySelectorAll('.character-creation-entries__row');
    expect(rows.length).toBe(3);
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.character-creation-entries__toggle',
    );
    expect(toggle.textContent?.trim()).toBe(
      fillTone(GRIMOIRE_TONE['my_characters.create_more'], { n: 2 }),
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    rows = fixture.nativeElement.querySelectorAll('.character-creation-entries__row');
    expect(rows.length).toBe(5);
    expect(toggle.textContent?.trim()).toBe('Voir moins');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    fixture.detectChanges();

    rows = fixture.nativeElement.querySelectorAll('.character-creation-entries__row');
    expect(rows.length).toBe(3);
    expect(toggle.textContent?.trim()).toBe(
      fillTone(GRIMOIRE_TONE['my_characters.create_more'], { n: 2 }),
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('exactement 4 entrées (1 masquée) → libellé singulier « Voir l’autre », pas « Voir les 1 autres »', async () => {
    const entries = Array.from({ length: 4 }, (_, i) =>
      makeEntry({ partieId: `p${i}`, partieName: `Partie ${i}` }),
    );
    const { fixture } = await createFixture(entries);

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.character-creation-entries__toggle',
    );
    expect(toggle.textContent?.trim()).toBe(GRIMOIRE_TONE['my_characters.create_more_one']);
  });
});
