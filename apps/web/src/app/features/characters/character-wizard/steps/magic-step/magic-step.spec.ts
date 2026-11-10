import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { MagicStep } from './magic-step';

const SEASONS: ContentEntryDto[] = [
  { key: 'printemps', data: { label: 'Printemps' } },
  { key: 'ete', data: { label: 'Été' } },
  { key: 'automne', data: { label: 'Automne' } },
  { key: 'hiver', data: { label: 'Hiver' } },
];

const SPELLS: ContentEntryDto[] = [
  {
    key: 'benediction-main-rouge',
    data: {
      name: 'Bénédiction de la main rouge',
      magicType: 'rituelle',
      tier: 'debutant',
      peCost: 4,
      description: 'La main d’arme de la cible devient rouge.',
    },
  },
  {
    key: 'cloche-alarme',
    data: {
      name: "Cloche d'alarme",
      magicType: 'rituelle',
      tier: 'debutant',
      peCost: 4,
      description: 'Prévient en cas d’intrusion.',
    },
  },
  {
    key: 'eclatante-purete-cristal',
    data: {
      name: 'Éclatante pureté du cristal',
      magicType: 'rituelle',
      tier: 'debutant',
      peCost: 2,
      description: 'Purifie un objet.',
    },
  },
  // Sort de saison débutant : ne doit JAMAIS apparaître dans la liste des sorts rituels.
  {
    key: 'floraison-spontanee',
    data: {
      name: 'Floraison spontanée',
      magicType: 'saison',
      season: 'printemps',
      tier: 'debutant',
      peCost: 2,
      description: 'Fait fleurir un lieu.',
    },
  },
  // Sort rituel avancé : ne doit JAMAIS apparaître (uniquement le palier débutant).
  {
    key: 'ailes-de-libellule',
    data: {
      name: 'Ailes de libellule',
      magicType: 'rituelle',
      tier: 'avance',
      peCost: 4,
      description: 'Fait voler la cible.',
    },
  },
];

describe('MagicStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ne propose que les sorts rituels du palier débutant (exclut saison et paliers avancés)', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Bénédiction de la main rouge');
    expect(text).toContain("Cloche d'alarme");
    expect(text).toContain('Éclatante pureté du cristal');
    expect(text).not.toContain('Floraison spontanée');
    expect(text).not.toContain('Ailes de libellule');
  });

  it('sélection de la saison → émet magicSeasonChange', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.magicSeasonChange.subscribe((k: string) => emitted.push(k));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.magic-step__seasons button',
    );
    buttons[1].click();
    expect(emitted).toEqual(['ete']);
  });

  it('coche un sort → émet knownRitualSpellsChange avec le tableau mis à jour', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.componentRef.setInput('knownRitualSpells', ['benediction-main-rouge']);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[][] = [];
    fixture.componentInstance.knownRitualSpellsChange.subscribe((v: string[]) => emitted.push(v));

    const checkboxes: HTMLInputElement[] =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[1].click(); // cloche-alarme

    expect(emitted).toEqual([['benediction-main-rouge', 'cloche-alarme']]);
  });

  it('décoche un sort déjà sélectionné → le retire du tableau émis', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.componentRef.setInput('knownRitualSpells', ['benediction-main-rouge', 'cloche-alarme']);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[][] = [];
    fixture.componentInstance.knownRitualSpellsChange.subscribe((v: string[]) => emitted.push(v));

    const checkboxes: HTMLInputElement[] =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click(); // décoche benediction-main-rouge

    expect(emitted).toEqual([['cloche-alarme']]);
  });

  it('2 sorts déjà sélectionnés → les cases non cochées restantes sont désactivées', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.componentRef.setInput('knownRitualSpells', ['benediction-main-rouge', 'cloche-alarme']);
    fixture.detectChanges();
    await fixture.whenStable();

    const checkboxes: HTMLInputElement[] =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0].disabled).toBe(false); // déjà cochée, jamais désactivée
    expect(checkboxes[1].disabled).toBe(false); // déjà cochée, jamais désactivée
    expect(checkboxes[2].disabled).toBe(true); // non cochée, 2 déjà sélectionnés
  });

  it('compteur affiché "X/2" reflète le nombre de sorts déjà sélectionnés', async () => {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.componentRef.setInput('knownRitualSpells', ['benediction-main-rouge']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('1/2');
  });
});

// ── Revue de code 31.4 (décision utilisateur) : la description d'un sort passe par la surface ───

describe('MagicStep — description des sorts derrière la surface de détail', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount() {
    TestBed.configureTestingModule({ imports: [MagicStep] });
    const fixture = TestBed.createComponent(MagicStep);
    fixture.componentRef.setInput('seasons', SEASONS);
    fixture.componentRef.setInput('spells', SPELLS);
    fixture.detectChanges();
    return fixture;
  }

  it('la ligne d’un sort ne porte plus sa description en ligne, seulement son coût en PE', () => {
    const fixture = mount();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('4 PE');
    expect(text).not.toContain('Prévient en cas d’intrusion.');
  });

  it('le bouton ⓘ (voisin du label, jamais dedans) ouvre la description du sort', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.magic-step__detail-trigger'),
    ).find((b) => b.getAttribute('aria-label') === "Cloche d'alarme")!;
    expect(trigger.closest('label')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    expect(el.querySelector('.detail-surface-panel .detail-surface-body')!.textContent).toContain(
      'Prévient en cas d’intrusion.',
    );
  });

  it('cocher un sort n’ouvre pas la surface (le ⓘ est un contrôle distinct)', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLInputElement>('.magic-step__spell input')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.detail-surface-panel')).toBeNull();
  });
});
