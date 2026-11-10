import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { TypeStep } from './type-step';

const TYPES: ContentEntryDto[] = [
  {
    key: 'attaque',
    data: {
      label: 'Attaque',
      description: 'Le personnage est très résistant et excelle en combat.',
      advantages: [{ name: 'Endurance', effect: '+4 PV' }],
    },
  },
  {
    key: 'magie',
    data: {
      label: 'Magie',
      description: "Le personnage peut à tout moment réaliser l'impossible.",
      advantages: [{ name: 'Volonté', effect: '+4 PE' }],
    },
  },
  {
    key: 'technique',
    data: {
      label: 'Technique',
      description: "Le personnage est capable d'analyser rapidement une situation.",
      advantages: [
        { name: 'Vitesse', effect: "+1 à l'initiative" },
        { name: 'Bagages', effect: "+3 à la limite d'encombrement" },
      ],
    },
  },
];

describe('TypeStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("sélection d'un type → émet typeIdChange et affiche les avantages", async () => {
    TestBed.configureTestingModule({ imports: [TypeStep] });
    const fixture = TestBed.createComponent(TypeStep);
    fixture.componentRef.setInput('types', TYPES);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.typeIdChange.subscribe((k) => emitted.push(k));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(emitted).toEqual(['attaque']);

    fixture.componentRef.setInput('typeId', 'attaque');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Endurance');
    expect(fixture.nativeElement.textContent).toContain(
      'Le personnage est très résistant et excelle en combat.',
    );
  });

  it('sélection Technique → affiche les avantages corrigés (Vitesse/Bagages)', async () => {
    TestBed.configureTestingModule({ imports: [TypeStep] });
    const fixture = TestBed.createComponent(TypeStep);
    fixture.componentRef.setInput('types', TYPES);
    fixture.componentRef.setInput('typeId', 'technique');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Vitesse');
    expect(fixture.nativeElement.textContent).toContain('Bagages');
  });

  it("aucun avantage de type n'affiche de description propre (AC5 — jamais de texte inventé)", async () => {
    TestBed.configureTestingModule({ imports: [TypeStep] });
    const fixture = TestBed.createComponent(TypeStep);
    fixture.componentRef.setInput('types', TYPES);
    fixture.componentRef.setInput('typeId', 'attaque');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.type-step__advantage-description')).toBeNull();
  });

  // ── Story 31.3 — aide contextuelle sur les termes de règle (FR-19) ──────────────────────────

  describe('aide contextuelle', () => {
    function mount(types: ContentEntryDto[], typeId: string) {
      TestBed.configureTestingModule({ imports: [TypeStep] });
      const fixture = TestBed.createComponent(TypeStep);
      fixture.componentRef.setInput('types', types);
      fixture.componentRef.setInput('typeId', typeId);
      fixture.detectChanges();
      return fixture;
    }

    const named = (fixture: { nativeElement: HTMLElement }, name: string) =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('.type-step__detail-trigger'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.trim() === name);

    it('AC1 — activer un avantage ouvre son effet dans la surface', () => {
      const fixture = mount(TYPES, 'technique');
      named(fixture, 'Vitesse')!.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.detail-surface-panel')!;
      expect(panel.querySelector('.detail-surface-title')!.textContent).toContain('Vitesse');
      expect(panel.querySelector('.detail-surface-body')!.textContent).toContain(
        "+1 à l'initiative",
      );
    });

    it('la description du TYPE reste en ligne : elle sert à choisir', () => {
      const fixture = mount(TYPES, 'technique');
      expect(fixture.nativeElement.textContent).toContain(
        "Le personnage est capable d'analyser rapidement une situation.",
      );
    });

    it('AC3 — un avantage sans effet ne rend AUCUN déclencheur', () => {
      const muet: ContentEntryDto[] = [
        {
          key: 'muet',
          data: {
            label: 'Muet',
            description: 'Type de test.',
            advantages: [{ name: 'Vide', effect: '  ' }],
          },
        },
      ];
      const fixture = mount(muet, 'muet');

      expect(named(fixture, 'Vide')).toBeUndefined();
      expect(fixture.nativeElement.textContent).toContain('Vide');
    });

    it('AC5 — activer un second avantage remplace le contenu, sans empiler', () => {
      const fixture = mount(TYPES, 'technique');
      named(fixture, 'Vitesse')!.click();
      fixture.detectChanges();
      named(fixture, 'Bagages')!.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.detail-surface-panel').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.detail-surface-title')!.textContent).toContain(
        'Bagages',
      );
    });
  });
});

// ── Story 31.4 — sous-titre de carte et description complète par la surface (AC7, AC8) ─────────

describe('TypeStep — contrat UI 31.4', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount(typeId?: string) {
    TestBed.configureTestingModule({ imports: [TypeStep] });
    const fixture = TestBed.createComponent(TypeStep);
    fixture.componentRef.setInput('types', TYPES);
    if (typeId) fixture.componentRef.setInput('typeId', typeId);
    fixture.detectChanges();
    return fixture;
  }

  it('AC7 — la carte porte la première phrase de la description du type', () => {
    const fixture = mount();
    const details = Array.from(
      fixture.nativeElement.querySelectorAll('.choice-card__detail'),
    ) as HTMLElement[];
    expect(details.map((d) => d.textContent)).toContain(
      'Le personnage est très résistant et excelle en combat.',
    );
  });

  it('AC8 (révisé, décision utilisateur 2026-09-20) — la description est affichée directement, sans bouton « Voir le détail »', () => {
    const fixture = mount('magie');
    expect(fixture.nativeElement.querySelector('.type-step__detail-cta')).toBeNull();
    expect(fixture.nativeElement.querySelector('.type-step__description').textContent).toContain(
      "réaliser l'impossible",
    );
  });
});

describe('TypeStep — carte déployée (piste B, 31.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount(typeId?: string) {
    TestBed.configureTestingModule({ imports: [TypeStep] });
    const fixture = TestBed.createComponent(TypeStep);
    fixture.componentRef.setInput('types', TYPES);
    if (typeId) fixture.componentRef.setInput('typeId', typeId);
    fixture.detectChanges();
    return fixture;
  }

  it('le type choisi est déployé en place (description + avantages), les autres restent des cartes', () => {
    const fixture = mount('technique');
    const expanded = fixture.nativeElement.querySelector('.type-step__expanded');
    expect(expanded).not.toBeNull();
    expect(expanded.textContent).toContain('Vitesse');
    expect(expanded.textContent).toContain('Bagages');
    expect(fixture.nativeElement.querySelectorAll('[role="radio"]').length).toBe(TYPES.length);
  });

  it('re-toucher le type choisi le désélectionne (émet undefined) ; un autre type émet sa clé', () => {
    const fixture = mount('technique');
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.typeIdChange.subscribe((k) => emitted.push(k));
    const radios = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ) as HTMLButtonElement[];
    radios.find((r) => r.getAttribute('aria-checked') === 'true')!.click();
    radios.find((r) => r.getAttribute('aria-checked') === 'false')!.click();
    expect(emitted[0]).toBeUndefined();
    expect(emitted[1]).toBeDefined();
  });

  it('un avantage ouvre la surface de détail ; aucun contrôle n’est imbriqué dans un bouton radio', () => {
    const fixture = mount('technique');
    for (const radio of Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ) as HTMLElement[]) {
      expect(radio.querySelector('button, input, select, a')).toBeNull();
    }
    fixture.nativeElement.querySelector('.type-step__detail-trigger').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-surface-panel')).not.toBeNull();
  });
});
