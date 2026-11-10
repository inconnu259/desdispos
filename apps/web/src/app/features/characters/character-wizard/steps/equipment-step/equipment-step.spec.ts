import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { EquipmentStep } from './equipment-step';
import { fillTone } from '../../../../../core/theme/tone-format';
import { TONE_MAP } from '../../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const EQUIPMENT_ITEMS: ContentEntryDto[] = [
  { key: 'rations', data: { label: 'Rations', priceGold: 10, nature: 'individual', weight: 1 } },
  {
    key: 'grand-sac-a-dos',
    data: { label: 'Grand sac à dos', priceGold: 40, nature: 'contenant', weight: 3 },
  },
  { key: 'outre', data: { label: 'Outre', priceGold: 30, nature: 'contenant', weight: 1 } },
  { key: 'couverts', data: { label: 'Couverts', priceGold: 10, nature: 'individual', weight: 1 } },
  {
    key: 'sac-de-couchage',
    data: { label: 'Sac de couchage', priceGold: 50, nature: 'individual', weight: 1 },
  },
  {
    key: 'monture-grande',
    data: { label: 'Monture (grande)', priceGold: 3800, nature: 'animal' },
  },
];

const EQUIPMENT_PACKAGES: ContentEntryDto[] = [
  {
    key: 'necessaire-voyage',
    data: {
      label: 'Nécessaire de voyage',
      priceGold: 150,
      items: [
        { itemKey: 'grand-sac-a-dos', quantity: 1 },
        { itemKey: 'sac-de-couchage', quantity: 1 },
        { itemKey: 'couverts', quantity: 1 },
        { itemKey: 'outre', quantity: 1 },
        { itemKey: 'rations', quantity: 2 },
      ],
    },
  },
];

describe('EquipmentStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', EQUIPMENT_ITEMS);
    fixture.componentRef.setInput('equipmentPackages', EQUIPMENT_PACKAGES);
    fixture.detectChanges();
    return fixture;
  }

  it('mode nécessaire pré-fait : affiche le nécessaire résolu (noms réels du catalogue, pas de FIXED_EQUIPMENT)', async () => {
    const fixture = setup();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nécessaire de voyage');
    expect(text).toContain('Grand sac à dos');
    expect(text).toContain('Sac de couchage');
    expect(text).toContain('Couverts');
    expect(text).toContain('Outre');
    expect(text).toContain('Rations');
  });

  it('cliquer sur "Nécessaire pré-fait" émet la sélection agrégée des 2 nécessaires', async () => {
    const fixture = setup();
    await fixture.whenStable();

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.equipment-step__mode-button',
    );
    buttons[1].click(); // Achat libre d'abord (le mode par défaut est déjà 'kit', sans quoi le clic est un no-op)
    fixture.detectChanges();

    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.selectionChange.subscribe((s: { key: string; quantity: number }[]) =>
      emitted.push(s),
    );

    buttons[0].click(); // Nécessaire pré-fait
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(
      expect.arrayContaining([
        { key: 'grand-sac-a-dos', quantity: 1 },
        { key: 'sac-de-couchage', quantity: 1 },
        { key: 'couverts', quantity: 1 },
        { key: 'outre', quantity: 1 },
        { key: 'rations', quantity: 2 },
      ]),
    );
    expect(emitted[0]).toHaveLength(5);
  });

  it('mode achat libre : ajouter un objet incrémente la quantité et le total', async () => {
    const fixture = setup();
    await fixture.whenStable();

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.equipment-step__mode-button',
    );
    buttons[1].click(); // Achat libre
    fixture.detectChanges();

    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.selectionChange.subscribe((s: { key: string; quantity: number }[]) =>
      emitted.push(s),
    );

    const addButtons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.equipment-step__catalog-item button',
    );
    addButtons[0].click(); // Rations
    fixture.detectChanges();
    // Composant contrôlé (pas d'état interne) : simule le parent qui refléterait l'émission dans
    // l'input `selection`, sinon le 2e clic repartirait de l'input d'origine ([]).
    fixture.componentRef.setInput('selection', emitted.at(-1));
    fixture.detectChanges();
    // Piste 31.4 : « Ajouter » est devenu un compteur − ×n + — le « + » rajoute un exemplaire.
    const plus: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.equipment-step__step-btn[aria-label^="Ajouter un exemplaire"]',
    );
    plus.click(); // Rations encore
    fixture.detectChanges();

    expect(emitted).toEqual([[{ key: 'rations', quantity: 1 }], [{ key: 'rations', quantity: 2 }]]);
  });

  it('retirer un objet du panier décrémente la quantité (0 → disparaît de la sélection)', async () => {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', EQUIPMENT_ITEMS);
    fixture.componentRef.setInput('equipmentPackages', EQUIPMENT_PACKAGES);
    fixture.componentRef.setInput('selection', [{ key: 'rations', quantity: 1 }]);
    fixture.detectChanges();
    await fixture.whenStable();

    // Resynchronisation : sélection non-kit → mode achat libre affiché automatiquement. Le panier
    // n'est plus dans l'étape (Story 31.4 : colonne de droite / feuille « Récap »).
    expect(fixture.nativeElement.querySelector('.equipment-step__cart')).toBeNull();
    expect(fixture.nativeElement.querySelector('.equipment-step__qty').textContent).toContain('×1');

    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.selectionChange.subscribe((s: { key: string; quantity: number }[]) =>
      emitted.push(s),
    );

    const removeButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.equipment-step__step-btn[aria-label^="Retirer un exemplaire"]',
    );
    removeButton.click();
    fixture.detectChanges();

    expect(emitted).toEqual([[]]);
  });

  it('le budget affiché reflète le total et signale un dépassement au-delà de 1000 Po', async () => {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', EQUIPMENT_ITEMS);
    fixture.componentRef.setInput('equipmentPackages', EQUIPMENT_PACKAGES);
    fixture.componentRef.setInput('selection', [{ key: 'monture-grande', quantity: 1 }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const budget = fixture.nativeElement.querySelector('.equipment-step__budget');
    expect(budget.textContent).toContain('3800');
    expect(budget.classList.contains('equipment-step__budget--over')).toBe(true);
  });

  it('basculer de mode réinitialise la sélection (kit → achat libre)', async () => {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', EQUIPMENT_ITEMS);
    fixture.componentRef.setInput('equipmentPackages', EQUIPMENT_PACKAGES);
    fixture.componentRef.setInput('selection', [
      { key: 'grand-sac-a-dos', quantity: 1 },
      { key: 'sac-de-couchage', quantity: 1 },
      { key: 'couverts', quantity: 1 },
      { key: 'outre', quantity: 1 },
      { key: 'rations', quantity: 2 },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.selectionChange.subscribe((s: { key: string; quantity: number }[]) =>
      emitted.push(s),
    );

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.equipment-step__mode-button',
    );
    buttons[1].click(); // Achat libre
    fixture.detectChanges();

    expect(emitted).toEqual([[]]);
  });
});

// ── Story 31.4 — EquipmentCatalog + BudgetGauge (AC12) ─────────────────────────────────────────

describe('EquipmentStep — contrat UI 31.4', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ITEMS: ContentEntryDto[] = [
    {
      key: 'alcools',
      data: {
        label: 'Alcools',
        priceGold: 10,
        nature: 'individual',
        effect: 'Provoquent l’état Surexcité.',
      },
    },
    { key: 'epee-de-bois', data: { label: 'Épée de bois', priceGold: 5, nature: 'individual' } },
    {
      key: 'outre',
      data: { label: 'Outre', priceGold: 30, nature: 'contenant', effect: 'Contient de l’eau.' },
    },
    {
      key: 'monture',
      data: { label: 'Monture', priceGold: 900, nature: 'animal', effect: 'Se monte.' },
    },
  ];
  const PACKAGES: ContentEntryDto[] = [
    {
      key: 'necessaire',
      data: {
        label: 'Nécessaire',
        priceGold: 40,
        items: [
          { itemKey: 'alcools', quantity: 1 },
          { itemKey: 'epee-de-bois', quantity: 1 },
        ],
      },
    },
  ];

  function mount(selection: { key: string; quantity: number }[] = [], shopping = false) {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', ITEMS);
    fixture.componentRef.setInput('equipmentPackages', PACKAGES);
    fixture.componentRef.setInput('selection', selection);
    fixture.detectChanges();
    if (shopping) {
      const buttons = root(fixture).querySelectorAll<HTMLButtonElement>(
        '.equipment-step__mode-button',
      );
      buttons[1].click();
      fixture.detectChanges();
    }
    return fixture;
  }
  const root = (f: { nativeElement: HTMLElement }): HTMLElement => f.nativeElement;
  const shoppingTriggers = (f: { nativeElement: HTMLElement }) =>
    Array.from(
      root(f).querySelectorAll<HTMLButtonElement>(
        '.equipment-step__catalog .equipment-step__detail-trigger',
      ),
    );
  const type = (fixture: { detectChanges(): void; nativeElement: HTMLElement }, text: string) => {
    const input = root(fixture).querySelector<HTMLInputElement>('.equipment-step__search')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('AC12 — achat libre : objets regroupés par nature (Objets · Contenants · Animaux)', () => {
    const fixture = mount([], true);
    const titles = Array.from(
      root(fixture).querySelectorAll('.equipment-step__group-toggle b'),
    ).map((t) => t.textContent?.trim());
    expect(titles).toEqual(['Objets', 'Contenants', 'Animaux']);
  });

  it('AC12 — le nom d’un objet à effet est un déclencheur ; un objet sans effet reste un simple nom', () => {
    const fixture = mount([], true);
    const names = shoppingTriggers(fixture).map((b) => b.textContent?.trim());
    expect(names).toEqual(['Alcools', 'Outre', 'Monture']);
    expect(names).not.toContain('Épée de bois');
    expect(root(fixture).textContent).toContain('Épée de bois'); // le nom reste affiché
  });

  it('AC12 — activer le nom d’un objet ouvre son effet dans la surface de détail (tableau « Effet »)', () => {
    const fixture = mount([], true);
    shoppingTriggers(fixture)[0].click();
    fixture.detectChanges();

    const panel = root(fixture).querySelector('.detail-surface-panel')!;
    expect(panel.querySelector('.detail-surface-title')!.textContent).toContain('Alcools');
    const rows = panel.querySelector('.detail-surface-rows')!;
    expect(rows.querySelector('th')!.textContent).toContain('Effet');
    expect(rows.querySelector('td')!.textContent).toContain('Surexcité');
  });

  it('AC12 — mode pré-fait : même règle (déclencheur seulement pour un objet à effet)', () => {
    const fixture = mount();
    const triggers = Array.from(
      root(fixture).querySelectorAll('.equipment-step__kit .equipment-step__detail-trigger'),
    ).map((b) => b.textContent?.trim());
    expect(triggers).toEqual(['Alcools']);
    expect(root(fixture).querySelector('.equipment-step__kit')!.textContent).toContain(
      'Épée de bois',
    );
  });

  it('AC12 — la recherche filtre à la frappe, sans casse ni accents, et masque les groupes vides', () => {
    const fixture = mount([], true);
    type(fixture, 'EPEE');

    const items = Array.from(root(fixture).querySelectorAll('.equipment-step__catalog-item')).map(
      (i) => i.textContent,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('Épée de bois');
    const titles = Array.from(
      root(fixture).querySelectorAll('.equipment-step__group-toggle b'),
    ).map((t) => t.textContent?.trim());
    expect(titles).toEqual(['Objets']); // Contenants et Animaux disparaissent
  });

  it('AC12 — sans résultat : le message s’affiche ; vider le champ rétablit tous les groupes', () => {
    const fixture = mount([], true);
    type(fixture, 'zzz');
    expect(root(fixture).querySelector('.equipment-step__no-result')!.textContent).toContain(
      'Aucun objet',
    );
    expect(root(fixture).querySelectorAll('.equipment-step__catalog-item')).toHaveLength(0);

    type(fixture, '');
    expect(root(fixture).querySelector('.equipment-step__no-result')).toBeNull();
    expect(root(fixture).querySelectorAll('.equipment-step__catalog-item')).toHaveLength(4);
  });

  it('AC12 — changer de mode vide la recherche', () => {
    const fixture = mount([], true);
    type(fixture, 'outre');

    const modes = root(fixture).querySelectorAll<HTMLButtonElement>('.equipment-step__mode-button');
    modes[0].click(); // pré-fait
    fixture.detectChanges();
    modes[1].click(); // achat libre
    fixture.detectChanges();
    expect(root(fixture).querySelector<HTMLInputElement>('.equipment-step__search')!.value).toBe(
      '',
    );
  });

  it('AC12 — budget : texte toujours visible + jauge proportionnelle', () => {
    const fixture = mount([{ key: 'alcools', quantity: 5 }], true); // 50 Po
    expect(root(fixture).querySelector('.equipment-step__budget')!.textContent).toContain(
      fillTone(GRIMOIRE_TONE['character.equipment_budget'], { spent: 50, total: 1000 }),
    );
    expect(
      root(fixture).querySelector<HTMLElement>('.equipment-step__gauge-fill')!.style.width,
    ).toBe('5%');
  });

  it('AC12 — dépassement : jauge pleine en erreur ET libellé « dépassement de N Po »', () => {
    const fixture = mount([{ key: 'monture', quantity: 2 }], true); // 1800 Po
    expect(root(fixture).querySelector('.equipment-step__gauge')!.classList).toContain(
      'equipment-step__gauge--over',
    );
    expect(root(fixture).querySelector('.equipment-step__budget')!.textContent).toContain(
      fillTone(GRIMOIRE_TONE['character.equipment_over_budget'], { n: 800 }).replace(/^— /, ''),
    );
    expect(
      root(fixture).querySelector<HTMLElement>('.equipment-step__gauge-fill')!.style.width,
    ).toBe('100%');
  });
});

// ── Revue de code 31.4 : un objet de nature inattendue ne disparaît pas du catalogue ────────────

describe('EquipmentStep — nature inattendue (revue 31.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('un objet dont la nature est inconnue rejoint le groupe « Objets » au lieu de disparaître', () => {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', [
      { key: 'mystere', data: { label: 'Objet mystère', priceGold: 5, nature: 'inconnue' } },
      { key: 'monture', data: { label: 'Monture', priceGold: 900, nature: 'animal' } },
    ]);
    fixture.componentRef.setInput('equipmentPackages', []);
    fixture.detectChanges();
    const modes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.equipment-step__mode-button',
    );
    modes[1].click();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('Objet mystère');
    const groups = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.equipment-step__catalog-group'),
    );
    const objets = groups.find((g) => g.textContent?.includes('Objets'));
    expect(objets?.textContent).toContain('Objet mystère');
    expect(objets?.textContent).not.toContain('Monture');
  });
});

// ── Story 31.4 (2026-09-20) : groupes repliables, compteur d'équipement, filtre « Ma sélection » ──

describe('EquipmentStep — repli, compteur et filtre', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ITEMS: ContentEntryDto[] = [
    {
      key: 'corde',
      data: { label: 'Corde', priceGold: 50, nature: 'individual', effect: 'Longue.' },
    },
    { key: 'savon', data: { label: 'Savon', priceGold: 5, nature: 'individual' } },
    { key: 'outre', data: { label: 'Outre', priceGold: 30, nature: 'contenant' } },
    { key: 'monture', data: { label: 'Monture', priceGold: 900, nature: 'animal' } },
  ];

  function mount(selection: { key: string; quantity: number }[] = []) {
    TestBed.configureTestingModule({ imports: [EquipmentStep] });
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.componentRef.setInput('equipmentItems', ITEMS);
    fixture.componentRef.setInput('equipmentPackages', []);
    fixture.componentRef.setInput('selection', selection);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.equipment-step__mode-button')[1]
      .click();
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
  const toggle = (f: { nativeElement: HTMLElement }, label: string) =>
    Array.from(el(f).querySelectorAll<HTMLButtonElement>('.equipment-step__group-toggle')).find(
      (b) => b.textContent?.includes(label),
    )!;

  it('chaque titre de groupe est un bouton (aria-expanded) portant le nombre d’objets', () => {
    const fixture = mount();
    const objets = toggle(fixture, 'Objets');
    expect(objets.getAttribute('aria-expanded')).toBe('true');
    expect(objets.textContent).toContain('· 2');
    expect(objets.getAttribute('aria-label')).toBe('Objets, 2 objets');
  });

  it('le chevron d’un groupe est toujours deplier ; replié, il est pivoté de −90° par une classe', () => {
    const fixture = mount();
    const chevron = () => toggle(fixture, 'Objets').querySelector('app-icon') as HTMLElement;
    expect(chevron().getAttribute('data-icon')).toBe('deplier');
    expect(chevron().classList.contains('equipment-step__chevron--closed')).toBe(false);
    toggle(fixture, 'Objets').click();
    fixture.detectChanges();
    expect(chevron().getAttribute('data-icon')).toBe('deplier');
    expect(chevron().classList.contains('equipment-step__chevron--closed')).toBe(true);
    expect(toggle(fixture, 'Objets').textContent).not.toMatch(/[▾▸]/);
  });

  it('replier un groupe masque ses objets, le redéployer les rend', () => {
    const fixture = mount();
    expect(el(fixture).textContent).toContain('Corde');
    toggle(fixture, 'Objets').click();
    fixture.detectChanges();
    expect(toggle(fixture, 'Objets').getAttribute('aria-expanded')).toBe('false');
    expect(el(fixture).textContent).not.toContain('Corde');
    expect(el(fixture).textContent).toContain('Outre'); // les autres groupes restent ouverts
    toggle(fixture, 'Objets').click();
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('Corde');
  });

  it('une recherche déplie TOUT : un résultat ne se cache jamais dans un groupe replié', () => {
    const fixture = mount();
    toggle(fixture, 'Contenants').click();
    fixture.detectChanges();
    expect(el(fixture).textContent).not.toContain('Outre');

    const input = el(fixture).querySelector<HTMLInputElement>('.equipment-step__search')!;
    input.value = 'outre';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('Outre');
    expect(toggle(fixture, 'Contenants').getAttribute('aria-expanded')).toBe('true');
  });

  it('un objet pris affiche un compteur − ×n + à la place d’« Ajouter »', () => {
    const fixture = mount([{ key: 'corde', quantity: 2 }]);
    const row = Array.from(el(fixture).querySelectorAll('.equipment-step__catalog-item')).find(
      (r) => r.textContent?.includes('Corde'),
    )!;
    expect(row.querySelector('.equipment-step__qty')!.textContent).toContain('×2');
    expect(row.querySelector('.equipment-step__add')).toBeNull();
    expect(row.classList).toContain('equipment-step__catalog-item--on');
    const savon = Array.from(el(fixture).querySelectorAll('.equipment-step__catalog-item')).find(
      (r) => r.textContent?.includes('Savon'),
    )!;
    expect(savon.querySelector('.equipment-step__add')).not.toBeNull();
  });

  it('le « − » à ×1 retire l’objet, le « + » en ajoute un', () => {
    const fixture = mount([{ key: 'corde', quantity: 1 }]);
    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.selectionChange.subscribe((s) => emitted.push(s));
    el(fixture)
      .querySelector<HTMLButtonElement>('.equipment-step__step-btn[aria-label^="Retirer"]')!
      .click();
    el(fixture)
      .querySelector<HTMLButtonElement>('.equipment-step__step-btn[aria-label^="Ajouter"]')!
      .click();
    expect(emitted).toEqual([[], [{ key: 'corde', quantity: 2 }]]);
  });

  it('le filtre « Ma sélection · n » ne montre que les objets pris, « Tout » rétablit le catalogue', () => {
    const fixture = mount([
      { key: 'corde', quantity: 2 },
      { key: 'outre', quantity: 1 },
    ]);
    const filters = el(fixture).querySelectorAll<HTMLButtonElement>('.equipment-step__filter');
    expect(filters[1].textContent).toContain('· 3');
    filters[1].click();
    fixture.detectChanges();
    expect(filters[1].getAttribute('aria-pressed')).toBe('true');
    const text = el(fixture).textContent as string;
    expect(text).toContain('Corde');
    expect(text).toContain('Outre');
    expect(text).not.toContain('Savon');
    expect(text).not.toContain('Monture');
    filters[0].click();
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('Savon');
  });
});
