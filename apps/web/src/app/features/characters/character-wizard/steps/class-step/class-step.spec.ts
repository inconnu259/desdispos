import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { ClassStep } from './class-step';
import { TONE_MAP } from '../../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const CLASSES: ContentEntryDto[] = [
  {
    key: 'chasseur',
    data: {
      label: 'Chasseur',
      description:
        'Les chasseurs abattent leurs proies grâce à leurs connaissances et à leur technique.',
      occupations: ['Barbare', 'Chasseur de monstres', 'Pisteur', 'Trappeur'],
      actions: ['Capturer', 'Chasser', 'Écorcher', 'Pêcher', 'Piéger', 'Pister', 'Traquer'],
      talents: [
        {
          name: 'Chasse',
          effect: {
            description: 'Nourrit le groupe selon le résultat du test',
            conditions: 'Avant le test de campement. Une fois par jour.',
          },
          description:
            'Les chasseurs se sont fait une spécialité de ramener des animaux sauvages pour nourrir leurs compagnons.',
        },
        {
          name: 'Transformation',
          effect: {
            description: 'Transforme une dépouille',
            conditions: "Avoir accès à la dépouille d'un monstre.",
          },
          description: 'Les chasseurs savent utiliser les dépouilles des monstres.',
        },
        {
          name: 'Traque',
          effect: {
            description: 'Découvre un monstre',
            conditions: "Avoir découvert les traces d'un monstre.",
          },
          description: "Les chasseurs savent remonter les traces d'un type de monstre particulier.",
        },
      ],
      requiresSpecialty: false,
    },
  },
  {
    key: 'artisan',
    data: {
      label: 'Artisan',
      description:
        'Ces spécialistes savent créer tout ce qui est joli, efficace ou simplement pratique.',
      talents: [
        {
          name: 'Création',
          effect: {
            description: 'Fabrique un objet',
            conditions: "Durée: encombrement de l'objet en jours. Coût: moitié de son prix.",
          },
          description: 'Les artisans gagnent leur vie en créant des objets de tout type.',
        },
      ],
      requiresSpecialty: true,
      specialtyLabel: "Type d'objet de spécialité",
    },
  },
];

const LANDSCAPES: ContentEntryDto[] = [
  { key: 'foret', data: { label: 'Forêt' } },
  { key: 'montagne', data: { label: 'Montagne' } },
];

const CLASSES_WITH_CHOICES: ContentEntryDto[] = [
  ...CLASSES,
  {
    key: 'guerisseur',
    data: {
      label: 'Guérisseur',
      description: 'Respectés de tous, les guérisseurs soignent les maladies.',
      talents: [
        {
          id: 'soins',
          name: 'Soins',
          effect: { description: 'Soigne des PV', conditions: '-' },
          attributes: ['INT', 'ESP'],
          description: 'Les guérisseurs utilisent des plantes et de l’eau.',
        },
        {
          id: 'dressage',
          name: 'Dressage',
          effect: { description: 'Deux animaux supplémentaires', conditions: '-' },
          attributes: [],
          description: 'Sans test.',
        },
      ],
      requiresSpecialty: false,
    },
  },
  {
    key: 'fermier',
    data: {
      label: 'Fermier',
      description: 'Vivant en accord avec la nature.',
      talents: [
        {
          id: 'metier-d-appoint',
          name: "Métier d'appoint",
          effect: { description: 'Talent emprunté', conditions: 'Selon talent' },
          attributes: [],
          description: 'Emprunte un talent.',
        },
      ],
      requiresSpecialty: false,
      requiredChoices: [
        {
          key: 'fermier-metier-appoint',
          talentId: 'metier-d-appoint',
          kind: 'eligible-talent',
          label: "Talent emprunté (Métier d'appoint)",
        },
      ],
    },
  },
  {
    key: 'ermite',
    data: {
      label: 'Ermite',
      description: 'Ces hommes étranges vivent à l’écart des cités.',
      talents: [
        {
          id: 'metamorphose',
          name: 'Métamorphose',
          effect: { description: 'Se transforme', conditions: '-' },
          attributes: [],
          description: 'Choisit un paysage.',
        },
      ],
      requiresSpecialty: false,
      requiredChoices: [
        {
          key: 'ermite-metamorphose',
          talentId: 'metamorphose',
          kind: 'landscape-flavor',
          label: 'Type de paysage (Métamorphose)',
        },
      ],
    },
  },
  {
    key: 'dresseur',
    data: {
      label: 'Dresseur',
      description: 'Les dresseurs apprivoisent les monstres.',
      talents: [
        {
          id: 'autorite',
          name: 'Autorité',
          effect: { description: 'Contrôle un monstre', conditions: '-' },
          attributes: [],
          description: 'Choisit un type de créature.',
        },
      ],
      requiresSpecialty: false,
      requiredChoices: [
        {
          key: 'dresseur-autorite',
          talentId: 'autorite',
          kind: 'closed-list',
          label: 'Type de créature (Autorité)',
          options: [
            { value: 'animaux', label: 'Animaux' },
            { value: 'demons', label: 'Démons' },
          ],
        },
      ],
    },
  },
  {
    key: 'meteomancien',
    data: {
      label: 'Météomancien',
      description: 'Les météomanciens prédisent la météo.',
      talents: [
        {
          id: 'climatophile',
          name: 'Climatophile',
          effect: { description: '+2 aux tests de climat favori', conditions: '-' },
          attributes: [],
          description: 'Un climat favori supplémentaire.',
        },
      ],
      requiresSpecialty: false,
      requiredChoices: [
        {
          key: 'meteomancien-climatophile',
          talentId: 'climatophile',
          kind: 'landscape-capability',
          label: 'Climat favori supplémentaire (Climatophile)',
        },
      ],
    },
  },
];

describe('ClassStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("sélection d'une classe → émet classIdChange et affiche les talents immédiatement", async () => {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', CLASSES);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.classIdChange.subscribe((k) => emitted.push(k));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(emitted).toEqual(['chasseur']);

    fixture.componentRef.setInput('classId', 'chasseur');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Chasse');
    expect(fixture.nativeElement.textContent).toContain('Transformation');
    expect(fixture.nativeElement.textContent).toContain('Traque');
    // Décision de l'utilisateur (2026-09-20) : le détail de la classe est affiché DIRECTEMENT (le
    // bouton « Voir le détail de… » a été retiré) ; la carte en porte aussi la première phrase (AC7).
    expect(fixture.nativeElement.querySelector('.class-step__description')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Les chasseurs abattent leurs proies grâce à leurs connaissances et à leur technique.',
    );

    // Story 31.3 — le texte de chaque TALENT a quitté la ligne : il s'ouvre dans la surface de
    // détail au clic sur son nom (AC1), effet mécanique et texte d'ambiance réunis.
    const talentTrigger = (name: string) =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('.class-step__detail-trigger'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.trim() === name)!;

    talentTrigger('Chasse').click();
    fixture.detectChanges();
    // Story 31.4 (AC9) : tableau mécanique + récit. Sur mobile (défaut de jsdom) le récit est
    // replié derrière une divulgation : on la déplie pour lire le panneau entier.
    const body = () => {
      const panel = fixture.nativeElement.querySelector('.detail-surface-panel') as HTMLElement;
      const disclosure = panel.querySelector<HTMLButtonElement>('.detail-surface-disclosure');
      if (disclosure?.getAttribute('aria-expanded') === 'false') {
        disclosure.click();
        fixture.detectChanges();
      }
      return panel.textContent as string;
    };
    expect(body()).toContain('Nourrit le groupe selon le résultat du test');
    expect(body()).toContain(
      'Les chasseurs se sont fait une spécialité de ramener des animaux sauvages pour nourrir leurs compagnons.',
    );

    talentTrigger('Transformation').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.detail-surface-panel').length).toBe(1);
    expect(body()).toContain('Transforme une dépouille');
    expect(body()).toContain('Les chasseurs savent utiliser les dépouilles des monstres.');

    talentTrigger('Traque').click();
    fixture.detectChanges();
    expect(body()).toContain('Découvre un monstre');
    expect(body()).toContain(
      "Les chasseurs savent remonter les traces d'un type de monstre particulier.",
    );
  });

  it('la divulgation de référence affiche déplier replié, puis replier ouvert', async () => {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', CLASSES);
    fixture.componentRef.setInput('classId', 'chasseur');
    fixture.detectChanges();
    await fixture.whenStable();

    const disclosure = () =>
      fixture.nativeElement.querySelector('.choice-detail__disclosure') as HTMLButtonElement;
    const icon = () => disclosure().querySelector('app-icon')?.getAttribute('data-icon');
    expect(icon()).toBe('deplier');
    disclosure().click();
    fixture.detectChanges();
    expect(icon()).toBe('replier');
    expect(disclosure().textContent).not.toMatch(/[▴▾]/);
    disclosure().click();
    fixture.detectChanges();
    expect(icon()).toBe('deplier');
  });

  it("sélection d'une classe → affiche les occupations et actions en texte de référence pur", async () => {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', CLASSES);
    fixture.componentRef.setInput('classId', 'chasseur');
    fixture.detectChanges();
    await fixture.whenStable();

    // Piste B (31.4) : occupations et actions sont REPLIÉES par défaut, à un geste.
    expect(fixture.nativeElement.querySelector('.class-step__occupations')).toBeNull();
    fixture.nativeElement.querySelector('.choice-detail__disclosure').click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Barbare');
    expect(text).toContain('Chasseur de monstres');
    expect(text).toContain('Pisteur');
    expect(text).toContain('Trappeur');
    expect(text).toContain('Capturer');
    expect(text).toContain('Chasser');
    expect(text).toContain('Écorcher');
    expect(text).toContain('Pêcher');
    expect(text).toContain('Piéger');
    expect(text).toContain('Pister');
    expect(text).toContain('Traquer');

    // Texte de référence pur : aucun élément interactif (bouton/input/role="radio") sur ces listes.
    const occupationsList = fixture.nativeElement.querySelector('.class-step__occupations');
    const actionsList = fixture.nativeElement.querySelector('.class-step__actions');
    expect(occupationsList.querySelector('button, input, [role="radio"]')).toBeNull();
    expect(actionsList.querySelector('button, input, [role="radio"]')).toBeNull();
  });

  it('classe Artisan → affiche le sous-choix obligatoire de spécialité', async () => {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', CLASSES);
    fixture.componentRef.setInput('classId', 'artisan');
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#specialtyTypeId');
    expect(input).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      'Ces spécialistes savent créer tout ce qui est joli, efficace ou simplement pratique.',
    );
  });

  it('classe non-Artisan → pas de sous-choix de spécialité', async () => {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', CLASSES);
    fixture.componentRef.setInput('classId', 'chasseur');
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('#specialtyTypeId');
    expect(input).toBeNull();
  });

  describe('Story 23.8 : choix requis à la création', () => {
    it('Fermier (eligible-talent) → propose uniquement les talents avec attributs non vides, hors classe courante', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', CLASSES_WITH_CHOICES);
      fixture.componentRef.setInput('classId', 'fermier');
      fixture.detectChanges();
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('#fermier-metier-appoint');
      expect(select).toBeTruthy();
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o: HTMLOptionElement) => o.value,
      );
      expect(optionValues).toContain('guerisseur:soins');
      expect(optionValues).not.toContain('guerisseur:dressage');
      expect(optionValues.some((v) => v.startsWith('fermier:'))).toBe(false);
    });

    it('Fermier (eligible-talent) → sélection émet classChoiceChange avec la clé composite classe:talentId', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', CLASSES_WITH_CHOICES);
      fixture.componentRef.setInput('classId', 'fermier');
      fixture.detectChanges();
      await fixture.whenStable();

      const emitted: { key: string; value: string }[] = [];
      fixture.componentInstance.classChoiceChange.subscribe((p: { key: string; value: string }) =>
        emitted.push(p),
      );
      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('#fermier-metier-appoint');
      select.value = 'guerisseur:soins';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(emitted).toEqual([{ key: 'fermier-metier-appoint', value: 'guerisseur:soins' }]);
    });

    it('Ermite (landscape-flavor) → menu peuplé depuis le catalogue landscape', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', CLASSES_WITH_CHOICES);
      fixture.componentRef.setInput('classId', 'ermite');
      fixture.componentRef.setInput('landscapes', LANDSCAPES);
      fixture.detectChanges();
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#ermite-metamorphose');
      const labels = Array.from(select.querySelectorAll('option')).map((o: HTMLOptionElement) =>
        o.textContent?.trim(),
      );
      expect(labels).toContain('Forêt');
      expect(labels).toContain('Montagne');
    });

    it('Dresseur (closed-list) → menu peuplé depuis requiredChoices[].options', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', CLASSES_WITH_CHOICES);
      fixture.componentRef.setInput('classId', 'dresseur');
      fixture.detectChanges();
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#dresseur-autorite');
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o: HTMLOptionElement) => o.value,
      );
      expect(optionValues).toContain('animaux');
      expect(optionValues).toContain('demons');
    });

    it('Météomancien (landscape-capability) → émet classCapabilityChange (pas classChoiceChange)', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', CLASSES_WITH_CHOICES);
      fixture.componentRef.setInput('classId', 'meteomancien');
      fixture.componentRef.setInput('landscapes', LANDSCAPES);
      fixture.detectChanges();
      await fixture.whenStable();

      const capabilityEmitted: { key: string; landscapeKey: string }[] = [];
      const choiceEmitted: { key: string; value: string }[] = [];
      fixture.componentInstance.classCapabilityChange.subscribe(
        (p: { key: string; landscapeKey: string }) => capabilityEmitted.push(p),
      );
      fixture.componentInstance.classChoiceChange.subscribe((p: { key: string; value: string }) =>
        choiceEmitted.push(p),
      );

      const select: HTMLSelectElement = fixture.nativeElement.querySelector(
        '#meteomancien-climatophile',
      );
      select.value = 'foret';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(capabilityEmitted).toEqual([
        { key: 'meteomancien-climatophile', landscapeKey: 'foret' },
      ]);
      expect(choiceEmitted).toEqual([]);
    });

    it('revue de code (2026-07-26) : kind imprévu (contenu malformé) → aucune option, pas de crash de rendu', async () => {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      const malformedClasses: ContentEntryDto[] = [
        ...CLASSES_WITH_CHOICES,
        {
          key: 'classe-malformee',
          data: {
            label: 'Classe malformée',
            talents: [],
            requiredChoices: [
              { key: 'choix-inconnu', talentId: 'x', kind: 'kind-inconnu', label: 'Choix inconnu' },
            ],
          },
        },
      ];
      fixture.componentRef.setInput('classes', malformedClasses);
      fixture.componentRef.setInput('classId', 'classe-malformee');

      expect(() => fixture.detectChanges()).not.toThrow();
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#choix-inconnu');
      expect(select).toBeTruthy();
      expect(select.querySelectorAll('option')).toHaveLength(1); // seulement "-- Choisir --"
    });
  });

  // ── Story 31.3 — aide contextuelle sur les termes de règle (FR-19) ──────────────────────────

  describe('aide contextuelle', () => {
    function mount(classes: ContentEntryDto[], classId: string) {
      TestBed.configureTestingModule({ imports: [ClassStep] });
      const fixture = TestBed.createComponent(ClassStep);
      fixture.componentRef.setInput('classes', classes);
      fixture.componentRef.setInput('classId', classId);
      fixture.detectChanges();
      return fixture;
    }

    const triggers = (fixture: { nativeElement: HTMLElement }) =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.class-step__detail-trigger'),
      ) as HTMLButtonElement[];

    const named = (fixture: { nativeElement: HTMLElement }, name: string) =>
      triggers(fixture).find((b) => b.textContent?.trim() === name);

    it('AC1 — une option de classe ouvre le texte de son talent parent (résolu par talentId)', () => {
      const fixture = mount(CLASSES_WITH_CHOICES, 'fermier');

      const trigger = named(fixture, "Talent emprunté (Métier d'appoint)")!;
      expect(trigger).toBeDefined();
      trigger.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.detail-surface-panel')!;
      expect(panel.querySelector('.detail-surface-title')!.textContent).toContain(
        'Talent emprunté',
      );
      // Effet mécanique dans le tableau ; récit (« Emprunte un talent. ») replié sur mobile.
      expect(panel.querySelector('.detail-surface-rows')!.textContent).toContain('Talent emprunté');
      (panel as HTMLElement)
        .querySelector<HTMLButtonElement>('.detail-surface-disclosure')!
        .click();
      fixture.detectChanges();
      expect(panel.querySelector('.detail-surface-narrative')!.textContent).toContain(
        'Emprunte un talent.',
      );
    });

    it("[Review][Patch] le déclencheur d'une option de classe n'est pas imbriqué dans un <label for>", () => {
      // Un <button> imbriqué dans <label [for]="choice.key"> est un anti-pattern HTML (renvoi de
      // clic natif vers le <select> associé imprévisible selon le navigateur) — le déclencheur
      // vit désormais dans un <span id>, associé au <select> par aria-labelledby.
      const fixture = mount(CLASSES_WITH_CHOICES, 'fermier');
      const trigger = named(fixture, "Talent emprunté (Métier d'appoint)")!;

      expect(trigger.closest('label')).toBeNull();

      const select = fixture.nativeElement.querySelector(
        '#fermier-metier-appoint',
      ) as HTMLSelectElement;
      expect(select.getAttribute('aria-labelledby')).toBe('fermier-metier-appoint-label');
    });

    it('AC2 — le texte affiché vient du catalogue fourni en entrée, jamais du registre de thèmes', () => {
      // Aucun ThemeToneService n'est fourni au harnais : si un texte de règle en venait, le test
      // ne pourrait pas passer avec ce seul contenu injecté.
      const fixture = mount(CLASSES, 'chasseur');
      named(fixture, 'Chasse')!.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.detail-surface-rows')!.textContent).toContain(
        'Nourrit le groupe selon le résultat du test',
      );
    });

    it('AC3 — un talent sans aucun texte ne rend AUCUN déclencheur', () => {
      const muet: ContentEntryDto[] = [
        {
          key: 'muet',
          data: {
            label: 'Muet',
            description: 'Classe de test.',
            occupations: [],
            actions: [],
            talents: [
              {
                name: 'Sans texte',
                effect: { description: '   ', conditions: '-' },
                description: '',
              },
            ],
          },
        },
      ];
      const fixture = mount(muet, 'muet');

      expect(named(fixture, 'Sans texte')).toBeUndefined();
      // ...mais le nom du talent reste affiché : seul le geste disparaît.
      expect(fixture.nativeElement.textContent).toContain('Sans texte');
    });

    it('AC5 — activer un second terme remplace le contenu, sans empiler de panneau', () => {
      const fixture = mount(CLASSES, 'chasseur');
      named(fixture, 'Chasse')!.click();
      fixture.detectChanges();
      named(fixture, 'Traque')!.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.detail-surface-panel').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.detail-surface-title')!.textContent).toContain(
        'Traque',
      );
    });

    it('AC6 — fermer rend le focus au déclencheur', () => {
      const fixture = mount(CLASSES, 'chasseur');
      const trigger = named(fixture, 'Chasse')!;
      trigger.focus();
      trigger.click();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('AC4 — aucun déclencheur d’aide n’est posé DANS une carte-radio (nav clavier intacte)', () => {
      const fixture = mount(CLASSES, 'chasseur');
      // Piste B (31.4) : le détail est un groupe VOISIN du radio dans le radiogroup — jamais un
      // enfant du bouton radio (un `<button role="radio">` ne doit contenir aucun autre contrôle).
      const radios = Array.from(
        fixture.nativeElement.querySelectorAll('[role="radio"]'),
      ) as HTMLElement[];
      for (const radio of radios) {
        expect(radio.querySelector('button, input, select, a')).toBeNull();
      }
      expect(triggers(fixture).length).toBeGreaterThan(0);
    });
  });
});

// ── Story 31.4 — sous-titre de carte et description complète par la surface (AC7, AC8) ─────────

describe('ClassStep — contrat UI 31.4', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount(classes: ContentEntryDto[], classId?: string) {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', classes);
    if (classId) fixture.componentRef.setInput('classId', classId);
    fixture.detectChanges();
    return fixture;
  }

  it('AC7 — chaque carte porte la première phrase de la description de sa classe en sous-titre', () => {
    const fixture = mount(CLASSES);
    const details = Array.from(
      fixture.nativeElement.querySelectorAll('.choice-card__detail'),
    ) as HTMLElement[];
    expect(details.map((d) => d.textContent)).toContain(
      'Les chasseurs abattent leurs proies grâce à leurs connaissances et à leur technique.',
    );
  });

  it('AC7 — une classe sans description ⇒ carte compacte, aucun sous-titre', () => {
    const sansTexte: ContentEntryDto[] = [
      {
        key: 'muet',
        data: { label: 'Muet', occupations: [], actions: [], talents: [] },
      },
    ];
    const fixture = mount(sansTexte);
    expect(fixture.nativeElement.querySelector('.choice-card__detail')).toBeNull();
  });

  // ⚠️ Décision de l'utilisateur, 2026-09-20 (revue de code) : le déclencheur « Voir le détail de… »
  // ne sert à rien — le détail est affiché DIRECTEMENT. (Inverse l'AC8 initial ; la mise en page du
  // bloc de détail fait l'objet d'une refonte séparée.)
  it('AC8 (révisé) — la description de la classe sélectionnée est affichée directement, sans bouton intermédiaire', () => {
    const fixture = mount(CLASSES, 'chasseur');
    expect(fixture.nativeElement.querySelector('.class-step__detail-cta')).toBeNull();
    expect(fixture.nativeElement.querySelector('.class-step__description').textContent).toContain(
      'Les chasseurs abattent leurs proies',
    );
  });

  it('AC8 (révisé) — pas de classe sélectionnée ⇒ aucun bloc de détail', () => {
    const fixture = mount(CLASSES);
    expect(fixture.nativeElement.querySelector('.class-step__description')).toBeNull();
  });

  it('AC7 — sélectionner une carte reste un choix radio simple (aucun bouton imbriqué)', () => {
    const fixture = mount(CLASSES);
    const cards = fixture.nativeElement.querySelectorAll('[role="radiogroup"] button');
    for (const card of Array.from(cards) as HTMLElement[]) {
      expect(card.querySelector('button')).toBeNull();
    }
  });
});

// ── Story 31.4 — piste B : la carte choisie se déploie en place ─────────────────────────────────

describe('ClassStep — carte déployée (piste B)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount(classes: ContentEntryDto[], classId?: string) {
    TestBed.configureTestingModule({ imports: [ClassStep] });
    const fixture = TestBed.createComponent(ClassStep);
    fixture.componentRef.setInput('classes', classes);
    fixture.componentRef.setInput('landscapes', LANDSCAPES);
    if (classId) fixture.componentRef.setInput('classId', classId);
    fixture.detectChanges();
    return fixture;
  }
  const root = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('la classe choisie est déployée EN PLACE : détail dans la grille, plus de bloc séparé dessous', () => {
    const fixture = mount(CLASSES, 'chasseur');
    const grid = root(fixture).querySelector('.class-step__grid')!;
    const expanded = grid.querySelector('.class-step__expanded')!;
    expect(expanded).not.toBeNull();
    expect(expanded.querySelector('app-choice-detail')).not.toBeNull();
    expect(expanded.textContent).toContain('Les chasseurs abattent leurs proies');
    // les autres classes restent de simples cartes
    expect(grid.querySelectorAll('.class-step__expanded').length).toBe(1);
    expect(grid.querySelectorAll('[role="radio"]').length).toBe(CLASSES.length);
  });

  it('aucune classe choisie ⇒ aucune carte déployée', () => {
    const fixture = mount(CLASSES);
    expect(root(fixture).querySelector('.class-step__expanded')).toBeNull();
  });

  it('re-toucher la classe déjà choisie la DÉSÉLECTIONNE (émet undefined)', () => {
    const fixture = mount(CLASSES, 'chasseur');
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.classIdChange.subscribe((k) => emitted.push(k));
    const selected = root(fixture).querySelector<HTMLButtonElement>(
      '.class-step__expanded [role="radio"]',
    )!;
    expect(selected.getAttribute('aria-checked')).toBe('true');
    selected.click();
    expect(emitted).toEqual([undefined]);
  });

  it('toucher une AUTRE classe la sélectionne (émet sa clé)', () => {
    const fixture = mount(CLASSES, 'chasseur');
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.classIdChange.subscribe((k) => emitted.push(k));
    const other = Array.from(
      root(fixture).querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ).find((b) => b.getAttribute('aria-checked') === 'false')!;
    other.click();
    expect(emitted).toEqual(['artisan']);
  });

  it('un choix OBLIGATOIRE (métier d’appoint) est visible d’emblée, occupations et actions repliées', () => {
    const fixture = mount(CLASSES_WITH_CHOICES, 'fermier');
    const must = root(fixture).querySelector('.class-step__required-choice')!;
    expect(must).not.toBeNull();
    expect(must.textContent).toContain(GRIMOIRE_TONE['character.choice_required_flag']);
    expect(root(fixture).querySelector('#fermier-metier-appoint')).not.toBeNull();
    expect(root(fixture).querySelector('.class-step__occupations')).toBeNull();
    // le choix n'est PAS dans la zone repliable
    const disclosure = root(fixture).querySelector('.choice-detail__disclosure')!;
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  });

  it('la spécialité obligatoire de l’Artisan est visible d’emblée', () => {
    const fixture = mount(CLASSES, 'artisan');
    const must = root(fixture).querySelector('.class-step__specialty')!;
    expect(must.textContent).toContain(GRIMOIRE_TONE['character.choice_required_flag']);
    expect(root(fixture).querySelector('#specialtyTypeId')).not.toBeNull();
  });

  it('la divulgation déplie occupations et actions, et se replie de nouveau à un autre choix de classe', () => {
    const fixture = mount(CLASSES, 'chasseur');
    const btn = () => root(fixture).querySelector<HTMLButtonElement>('.choice-detail__disclosure')!;
    btn().click();
    fixture.detectChanges();
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    expect(root(fixture).querySelector('.class-step__occupations')).not.toBeNull();

    fixture.componentRef.setInput('classId', 'artisan');
    fixture.detectChanges();
    expect(btn().getAttribute('aria-expanded')).toBe('false');
  });
});
