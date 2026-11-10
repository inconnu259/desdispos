import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import type { GameSystemContentDto, GameSystemSchemaDto } from '@master-jdr/shared';
import { CharacterWizard } from './character-wizard';
import { CharacterService } from '../../../core/characters/character.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

const SCHEMA: GameSystemSchemaDto = {
  sheetSchema: {},
  creationSteps: [
    { key: 'classId', label: 'Classe' },
    { key: 'typeId', label: 'Type' },
    { key: 'magic', label: 'Magie' },
    { key: 'attributes', label: 'Attributs' },
    { key: 'weaponId', label: 'Arme favorite' },
    { key: 'fetiqueObject', label: 'Objet fétiche' },
    { key: 'equipment', label: 'Équipement' },
    { key: 'narrative', label: 'Narratif' },
    { key: 'portrait', label: 'Portrait' },
  ],
};

const CONTENT: GameSystemContentDto = {
  class: [
    {
      key: 'chasseur',
      data: {
        label: 'Chasseur',
        talents: [{ name: 'Pistage', effect: { description: '...', conditions: '-' } }],
      },
    },
    {
      key: 'artisan',
      data: {
        label: 'Artisan',
        talents: [{ name: 'Création', effect: { description: '...', conditions: '-' } }],
        requiresSpecialty: true,
      },
    },
    {
      key: 'fermier',
      data: {
        label: 'Fermier',
        talents: [
          {
            id: 'metier-d-appoint',
            name: "Métier d'appoint",
            effect: { description: '...', conditions: '-' },
            attributes: [],
          },
        ],
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
      key: 'meteomancien',
      data: {
        label: 'Météomancien',
        talents: [
          {
            id: 'climatophile',
            name: 'Climatophile',
            effect: { description: '...', conditions: '-' },
            attributes: [],
          },
        ],
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
  ],
  type: [
    {
      key: 'attaque',
      data: { label: 'Attaque', advantages: [{ name: 'Endurance', effect: '+4 PV' }] },
    },
    {
      key: 'magie',
      data: { label: 'Magie', advantages: [{ name: 'Volonté', effect: '+4 PE' }] },
    },
  ],
  attributePattern: [
    { key: 'equilibre', data: { label: 'Équilibré', values: [6, 6, 6, 6] } },
    { key: 'polyvalent', data: { label: 'Polyvalent', values: [8, 4, 6, 6] } },
    { key: 'specialiste', data: { label: 'Spécialiste', values: [4, 4, 8, 8] } },
  ],
  landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
  season: [
    { key: 'printemps', data: { label: 'Printemps' } },
    { key: 'ete', data: { label: 'Été' } },
  ],
  spell: [
    {
      key: 'benediction-main-rouge',
      data: {
        name: 'Bénédiction de la main rouge',
        magicType: 'rituelle',
        tier: 'debutant',
        peCost: 4,
        description: '...',
      },
    },
    {
      key: 'cloche-alarme',
      data: {
        name: "Cloche d'alarme",
        magicType: 'rituelle',
        tier: 'debutant',
        peCost: 4,
        description: '...',
      },
    },
  ],
  weaponCategory: [
    { key: 'arc', data: { label: 'Arc', touchFormula: 'AGI+INT-2', damageFormula: 'AGI' } },
  ],
  weaponItem: [{ key: 'arc-de-chasse', data: { label: 'Arc de chasse', categoryId: 'arc' } }],
  equipmentItem: [
    { key: 'rations', data: { label: 'Rations', priceGold: 10, nature: 'individual', weight: 1 } },
    {
      key: 'monture-grande',
      data: { label: 'Monture (grande)', priceGold: 3800, nature: 'animal' },
    },
  ],
  equipmentPackage: [
    {
      key: 'necessaire-voyage',
      data: {
        label: 'Nécessaire de voyage',
        priceGold: 150,
        items: [{ itemKey: 'rations', quantity: 2 }],
      },
    },
  ],
  wizardStepIntro: [
    { key: 'classId', data: { text: 'La première chose à faire est de choisir sa classe.' } },
    {
      key: 'typeId',
      data: { text: 'Les voyageurs sont confrontés à des difficultés très diverses.' },
    },
    { key: 'attributes', data: { text: 'On détermine les quatre attributs des personnages.' } },
    {
      key: 'weaponId',
      data: { text: "Choisissez la famille d'armes favorite du voyageur." },
    },
    { key: 'fetiqueObject', data: { text: 'Votre voyageur possède un objet fétiche.' } },
    {
      key: 'equipment',
      data: { text: 'Vous pouvez partir en pique-nique pour simplifier la création.' },
    },
    { key: 'narrative', data: { text: 'Prenez le temps de décider des détails suivants.' } },
  ],
};

function makeCharacterService() {
  return {
    getGameSystemSchema: vi.fn().mockResolvedValue(SCHEMA),
    getGameSystemContent: vi.fn().mockResolvedValue(CONTENT),
    create: vi.fn(),
    updatePortrait: vi.fn(),
  };
}

function makeThemeService() {
  return {
    tone: () => ({
      'character.create_cta': 'Créer un voyageur',
      'character.step_portrait_intro': 'Ajoute un portrait si tu le souhaites.',
      'character.recap_button': 'Récap',
      'character.recap_title': 'Récapitulatif',
      'character.recap_cart_title': 'Panier',
      'character.recap_remove': 'Retirer',
      'character.recap_total': 'Total',
      'character.recap_empty_hint':
        'Les statistiques dérivées apparaîtront une fois les attributs assignés.',
      'common.precedent': 'Précédent',
      'common.suivant': 'Suivant',
      'common.annuler': 'Annuler',
      'common.enregistrer': 'Enregistrer',
      'common.ajouter': 'Ajouter',
      'common.passer_cette_etape': 'Passer cette étape',
      'common.choisir': '-- Choisir --',
      'common.une_erreur_inattendue_est_survenue_reessayez':
        'Une erreur inattendue est survenue. Réessayez.',
      'characters_wizard.loading': "Chargement de l'assistant…",
      'characters_wizard.step_prev_aria': 'Étape précédente',
      'characters_wizard.step_next_aria': 'Étape suivante',
      'characters_wizard.step_progress': 'Étape {index}/{total} · {label}',
      'characters_wizard.submitting': 'Création…',
      'characters_wizard.summary_aria': 'Récapitulatif du voyageur',
      'characters_wizard.summary_default_title': 'Voyageur',
      'characters_wizard.load_error_no_module':
        "Ce système de jeu n'a pas encore d'assistant de création.",
      'characters_wizard.load_error':
        "Impossible de charger l'assistant de création. Vérifiez votre connexion et réessayez.",
      'characters_wizard.portrait_upload_warning':
        "Personnage créé, mais le portrait n'a pas pu être enregistré. Réessayez depuis la fiche.",
      'characters_wizard.already_has_character': 'Vous avez déjà un personnage sur cette partie',
      'characters_wizard.invalid_data': 'Données invalides. Vérifiez votre saisie.',
      'characters_wizard.attributes_profile_aria': "Profil d'attributs",
      'characters_wizard.attributes_banner_profile': 'Profil',
      'characters_wizard.attributes_banner_one': '— {n} valeur sur {total} placée',
      'characters_wizard.attributes_banner_many': '— {n} valeurs sur {total} placées',
      'characters_wizard.attributes_chip_remaining': '{value}, encore {n} à placer',
      'characters_wizard.equipment_mode_aria': "Choisir un mode d'équipement",
      'characters_wizard.equipment_mode_kit': 'Nécessaire pré-fait',
      'characters_wizard.equipment_mode_shopping': 'Achat libre',
      'characters_wizard.equipment_filter_aria': 'Filtre du catalogue',
      'characters_wizard.weapon_category_aria': "Choisir une catégorie d'arme",
      'characters_wizard.weapon_item_aria': 'Choisir son arme précise',
      'characters_wizard.weapon_custom_card': 'Créer une arme libre',
      'portrait.cropper_choose_image': 'Choisir une image',
      'portrait.cropper_area_aria':
        'Zone de recadrage du portrait. Flèches pour déplacer, plus/moins pour zoomer.',
      'portrait.cropper_zoom': 'Zoom',
      'portrait.panel_alt': 'Portrait complet de {name}',
      'portrait.panel_caption': 'Portrait complet',
      'portrait.avatar_aria': 'Portrait de {name}',
      'portrait.avatar_aria_empty': 'Portrait de {name} (aucune image)',
    }),
  };
}

function makePartiesService(partieId: string) {
  return {
    get: vi.fn().mockResolvedValue({ id: partieId, gameSystemId: 'ryuutama' }),
  };
}

async function createComponent(partieId = 'p1', gameSystemIdParam: string | null = null) {
  const characterSvc = makeCharacterService();
  const partiesSvc = makePartiesService(partieId);
  const router = { navigate: vi.fn() };
  const snack = { open: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [CharacterWizard],
    providers: [
      provideAnimationsAsync(),
      { provide: CharacterService, useValue: characterSvc },
      { provide: PartiesService, useValue: partiesSvc },
      { provide: ThemeToneService, useValue: makeThemeService() },
      { provide: MatSnackBar, useValue: snack },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: { get: () => partieId },
            queryParamMap: { get: () => gameSystemIdParam },
          },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CharacterWizard);
  fixture.detectChanges();
  // ngOnInit enchaîne maintenant un await (partiesSvc.get()) avant le Promise.all() —
  // whenStable() ne garantit pas toujours le drainage complet de la chaîne de microtasks en
  // environnement zoneless (même pattern que le test "erreur au chargement" plus bas).
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, characterSvc, partiesSvc, router, snack };
}

describe('CharacterWizard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("charge le schéma ET le contenu du système de jeu au démarrage, affiche l'étape Classe", async () => {
    const { fixture, characterSvc } = await createComponent();
    expect(characterSvc.getGameSystemSchema).toHaveBeenCalledWith('ryuutama');
    expect(characterSvc.getGameSystemContent).toHaveBeenCalledWith('ryuutama');
    const comp = fixture.componentInstance as any;
    expect(comp.currentStepKey()).toBe('classId');
    expect(comp.canGoNext()).toBe(false);
  });

  it("affiche le texte d'introduction de l'étape Classe avant toute sélection (AC1)", async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.textContent).toContain(
      'La première chose à faire est de choisir sa classe.',
    );
  });

  it("le texte d'introduction change avec l'étape courante (classId → typeId, AC1/AC2)", async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    comp.goNext();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Les voyageurs sont confrontés à des difficultés très diverses.',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'La première chose à faire est de choisir sa classe.',
    );
  });

  it("chacune des 7 étapes seedées (content['wizardStepIntro']) affiche son propre texte d'intro (AC1)", async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    const expectedByIndex = [
      'La première chose à faire est de choisir sa classe.',
      'Les voyageurs sont confrontés à des difficultés très diverses.',
      'On détermine les quatre attributs des personnages.',
      "Choisissez la famille d'armes favorite du voyageur.",
      'Votre voyageur possède un objet fétiche.',
      'Vous pouvez partir en pique-nique pour simplifier la création.',
      'Prenez le temps de décider des détails suivants.',
    ];

    for (const [index, expectedText] of expectedByIndex.entries()) {
      comp.currentStepKeyTracked.set(comp.steps()[index].key);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(expectedText);
    }
  });

  it("affiche le texte d'intro thémé de l'étape Portrait (seule clé sans source livre, AC5)", async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.currentStepKeyTracked.set(comp.steps()[7].key); // portrait
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ajoute un portrait si tu le souhaites.');
  });

  it('gameSystemId fourni en query param (navigation depuis partie-detail) → ne re-fetch pas la partie', async () => {
    const { characterSvc, partiesSvc } = await createComponent('p1', 'ryuutama');
    expect(partiesSvc.get).not.toHaveBeenCalled();
    expect(characterSvc.getGameSystemSchema).toHaveBeenCalledWith('ryuutama');
  });

  it('gameSystemId absent du query param (navigation directe/rechargement) → repli sur partiesSvc.get()', async () => {
    const { partiesSvc } = await createComponent('p1', null);
    expect(partiesSvc.get).toHaveBeenCalledWith('p1');
  });

  it('dérive ses 8 étapes depuis creationSteps() du schéma, sans coder les clés en dur (AC1) — inclut Portrait (Story 4.5)', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    expect(comp.steps().map((s: { key: string }) => s.key)).toEqual([
      'classId',
      'typeId',
      'attributes',
      'weaponId',
      'fetiqueObject',
      'equipment',
      'narrative',
      'portrait',
    ]);
  });

  it('Story 24.1 : attributePatterns() expose les 3 profils seedés, pas seulement le premier', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    expect(comp.attributePatterns().map((p: { key: string }) => p.key)).toEqual([
      'equilibre',
      'polyvalent',
      'specialiste',
    ]);
  });

  it('erreur au chargement (schéma ou contenu) → message affiché, pas de plantage silencieux', async () => {
    const characterSvc = {
      getGameSystemSchema: vi.fn().mockRejectedValue(new Error('network down')),
      getGameSystemContent: vi.fn().mockResolvedValue(CONTENT),
      create: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [CharacterWizard],
      providers: [
        provideAnimationsAsync(),
        { provide: CharacterService, useValue: characterSvc },
        { provide: PartiesService, useValue: makePartiesService('p1') },
        { provide: ThemeToneService, useValue: makeThemeService() },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'p1' }, queryParamMap: { get: () => null } },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CharacterWizard);
    fixture.detectChanges();
    // ngOnInit enchaîne un Promise.all() qui rejette — whenStable() ne garantit pas toujours le
    // drainage complet de la chaîne de microtasks en environnement zoneless (même pattern que
    // partie-detail.spec.ts).
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.loadError());
  });

  it('classe Artisan sans spécialité → canGoNext=false ; avec spécialité → true', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'artisan' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);

    comp.updateSheetData({ specialtyTypeId: 'Amulette' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(true);
  });

  it('Story 25.2 : étape Arme favorite complète avec seulement customWeapon renseigné (arme libre)', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.currentStepKeyTracked.set(comp.steps()[3].key); // weaponId
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);

    comp.onCustomWeaponChange({ name: 'Fléau maison', categoryId: 'arc' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(true);
    expect(comp.sheetData().weaponId).toBeUndefined();
  });

  it('Story 25.2 : onWeaponIdChange efface customWeapon, onCustomWeaponChange efface weaponId (exclusivité mutuelle)', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.onCustomWeaponChange({ name: 'Fléau maison', categoryId: 'arc' });
    fixture.detectChanges();
    expect(comp.sheetData().customWeapon).toEqual({ name: 'Fléau maison', categoryId: 'arc' });

    comp.onWeaponIdChange('arc-de-chasse');
    fixture.detectChanges();
    expect(comp.sheetData().weaponId).toBe('arc-de-chasse');
    expect(comp.sheetData().customWeapon).toBeUndefined();

    comp.onCustomWeaponChange({ name: 'Fléau maison', categoryId: 'arc' });
    fixture.detectChanges();
    expect(comp.sheetData().customWeapon).toEqual({ name: 'Fléau maison', categoryId: 'arc' });
    expect(comp.sheetData().weaponId).toBeUndefined();
  });

  it('Story 26.1 : étape Équipement — canGoNext() false tant que startingEquipment est vide, true sous le budget, false au-delà de 1000 Po', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.currentStepKeyTracked.set(comp.steps()[5].key); // equipment
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);

    comp.onStartingEquipmentChange([{ key: 'rations', quantity: 2 }]); // 20 Po
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(true);

    comp.onStartingEquipmentChange([{ key: 'monture-grande', quantity: 1 }]); // 3800 Po
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);
  });

  it('Story 26.1 : onStartingEquipmentChange met à jour sheetData().startingEquipment', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.onStartingEquipmentChange([{ key: 'rations', quantity: 2 }]);
    fixture.detectChanges();

    expect(comp.sheetData().startingEquipment).toEqual([{ key: 'rations', quantity: 2 }]);
  });

  it('changer de classe après Artisan efface la spécialité obsolète', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'artisan' });
    comp.updateSheetData({ specialtyTypeId: 'Amulette' });
    fixture.detectChanges();
    expect(comp.sheetData().specialtyTypeId).toBe('Amulette');

    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    expect(comp.sheetData().specialtyTypeId).toBeUndefined();
  });

  it('Story 23.8 : classe Fermier sans classChoices → canGoNext=false ; renseigné → true', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'fermier' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);

    comp.onClassChoiceChange({ key: 'fermier-metier-appoint', value: 'guerisseur:soins' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(true);
  });

  it('Story 23.8 : classe Météomancien (landscape-capability) sans classCapabilities → canGoNext=false ; renseigné → true', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'meteomancien' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(false);

    comp.onClassCapabilityChange({ key: 'meteomancien-climatophile', landscapeKey: 'foret' });
    fixture.detectChanges();
    expect(comp.canGoNext()).toBe(true);
    expect(comp.sheetData().classCapabilities).toEqual([
      { type: 'landscape', params: { key: 'foret' } },
    ]);
  });

  it('Story 23.8 : changer de classe efface classChoices/classCapabilities obsolètes', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'fermier' });
    comp.onClassChoiceChange({ key: 'fermier-metier-appoint', value: 'guerisseur:soins' });
    fixture.detectChanges();
    expect(comp.sheetData().classChoices).toEqual({ 'fermier-metier-appoint': 'guerisseur:soins' });

    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    expect(comp.sheetData().classChoices).toBeUndefined();
  });

  it('Story 23.8 : changer de classe efface classCapabilities si la nouvelle classe n’a pas de choix landscape-capability', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.updateSheetData({ classId: 'meteomancien' });
    comp.onClassCapabilityChange({ key: 'meteomancien-climatophile', landscapeKey: 'foret' });
    fixture.detectChanges();
    expect(comp.sheetData().classCapabilities).toBeTruthy();

    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    expect(comp.sheetData().classCapabilities).toBeUndefined();
  });

  describe('Story 23.9 : étape Magie conditionnelle', () => {
    it("typeId !== 'magie' → l'étape magic est absente de steps()", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.updateSheetData({ typeId: 'attaque' });
      fixture.detectChanges();

      expect(comp.steps().map((s: { key: string }) => s.key)).not.toContain('magic');
    });

    it("typeId === 'magie' → l'étape magic apparaît juste après typeId", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.updateSheetData({ typeId: 'magie' });
      fixture.detectChanges();

      const keys = comp.steps().map((s: { key: string }) => s.key);
      expect(keys).toContain('magic');
      expect(keys.indexOf('magic')).toBe(keys.indexOf('typeId') + 1);
    });

    it("canGoNext() bloque tant que magicSeason/knownRitualSpells ne sont pas complets, pour typeId === 'magie'", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.updateSheetData({ typeId: 'magie' });
      comp.currentStepKeyTracked.set('magic');
      fixture.detectChanges();
      expect(comp.canGoNext()).toBe(false);

      comp.updateSheetData({ magicSeason: 'printemps' });
      fixture.detectChanges();
      expect(comp.canGoNext()).toBe(false); // sorts manquants

      comp.updateSheetData({
        knownRitualSpells: ['benediction-main-rouge', 'cloche-alarme'],
      });
      fixture.detectChanges();
      expect(comp.canGoNext()).toBe(true);
    });

    it("changer de type vers autre chose que 'magie' efface magicSeason/knownRitualSpells", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.updateSheetData({
        typeId: 'magie',
        magicSeason: 'printemps',
        knownRitualSpells: ['benediction-main-rouge', 'cloche-alarme'],
      });
      fixture.detectChanges();
      expect(comp.sheetData().magicSeason).toBe('printemps');

      comp.updateSheetData({ typeId: 'attaque' });
      fixture.detectChanges();
      expect(comp.sheetData().magicSeason).toBeUndefined();
      expect(comp.sheetData().knownRitualSpells).toBeUndefined();
    });

    it("piège de navigation : dépasse l'étape magic puis revient changer typeId → la navigation reste cohérente (pas d'étape fantôme)", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      // Progresse jusqu'à l'étape magic en tant que magicien.
      comp.updateSheetData({ classId: 'chasseur' });
      comp.goNext(); // classId -> typeId
      comp.updateSheetData({ typeId: 'magie' });
      fixture.detectChanges();
      comp.goNext(); // typeId -> magic
      expect(comp.currentStepKey()).toBe('magic');

      comp.updateSheetData({
        magicSeason: 'printemps',
        knownRitualSpells: ['benediction-main-rouge', 'cloche-alarme'],
      });
      fixture.detectChanges();
      comp.goNext(); // magic -> attributes
      expect(comp.currentStepKey()).toBe('attributes');

      // Revient en arrière jusqu'à typeId et change de type — l'étape magic disparaît de steps().
      comp.goPrev(); // attributes -> magic (encore visible un court instant)
      comp.goPrev(); // magic -> typeId
      expect(comp.currentStepKey()).toBe('typeId');
      comp.updateSheetData({ typeId: 'attaque' });
      fixture.detectChanges();

      // La navigation doit rester sur typeId (pas une étape fantôme ni un index décalé).
      expect(comp.currentStepKey()).toBe('typeId');
      comp.goNext(); // typeId -> attributes directement (magic n'existe plus)
      expect(comp.currentStepKey()).toBe('attributes');
    });
  });

  it('derived() reste null tant que les attributs ne sont pas assignés, puis se calcule en direct', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    expect(comp.derived()).toBeNull();

    comp.onAttributesChange({ AGI: 4, ESP: 6, INT: 6, VIG: 8 });
    fixture.detectChanges();

    expect(comp.derived()).toEqual({
      PV: 16,
      PE: 12,
      Condition: 14,
      Initiative: 10,
      Encombrement: 11,
    });
  });

  it('goNext() ne franchit pas une étape si canGoNext=false', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;

    comp.goNext(); // classId vide → bloqué
    expect(comp.currentStepIndex()).toBe(0);

    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    comp.goNext();
    expect(comp.currentStepIndex()).toBe(1);
  });

  it('soumission réussie → POST puis redirection vers la fiche du personnage créé', async () => {
    const { fixture, characterSvc, router } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    characterSvc.create.mockResolvedValue({ id: 'char1' });

    await comp.onSubmit();

    expect(characterSvc.create).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ gameSystemId: 'ryuutama' }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'characters', 'char1']);
  });

  it('soumission 400 sur "attributes" → retour à l\'étape fautive avec les erreurs contextualisées', async () => {
    const { fixture, characterSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    comp.currentStepKeyTracked.set(comp.steps()[3].key); // simulate being on a later step

    characterSvc.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: [{ field: 'attributes', message: 'Pattern invalide' }] },
      }),
    );

    await comp.onSubmit();

    expect(comp.currentStepIndex()).toBe(2); // attributes → step index 2
    expect(comp.stepErrors()['attributes']).toEqual(['Pattern invalide']);
  });

  it('soumission 400 sur "specialtyTypeId" → retour à l\'étape Classe ET affiche le message (bug corrigé)', async () => {
    const { fixture, characterSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    comp.currentStepKeyTracked.set(comp.steps()[3].key);

    characterSvc.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: {
          message: [
            { field: 'specialtyTypeId', message: 'Spécialité obligatoire pour la classe Artisan' },
          ],
        },
      }),
    );

    await comp.onSubmit();

    expect(comp.currentStepIndex()).toBe(0); // classId → step index 0
    // Le message doit être accessible sous la clé de l'étape ('classId'), pas 'specialtyTypeId'.
    expect(comp.stepErrors()['classId']).toEqual(['Spécialité obligatoire pour la classe Artisan']);
  });

  it('soumission 400 générique (tableau de strings, pas de {field,message}) → notification sans plantage', async () => {
    const { fixture, characterSvc, snack } = await createComponent('p1');
    const comp = fixture.componentInstance as any;

    characterSvc.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: ['gameSystemId should not be empty'] },
      }),
    );

    await comp.onSubmit();

    expect(snack.open).toHaveBeenCalled();
  });

  it('soumission 409 → notification et redirection vers /parties/:id', async () => {
    const { fixture, characterSvc, router, snack } = await createComponent('p1');
    const comp = fixture.componentInstance as any;

    characterSvc.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'Vous avez déjà un personnage sur cette partie' },
      }),
    );

    await comp.onSubmit();

    expect(snack.open).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1']);
  });

  it('soumission 500 → notification générique, pas de rejet de promesse non géré', async () => {
    const { fixture, characterSvc, snack } = await createComponent('p1');
    const comp = fixture.componentInstance as any;

    characterSvc.create.mockRejectedValue(
      new HttpErrorResponse({ status: 500, error: { message: 'Internal error' } }),
    );

    await expect(comp.onSubmit()).resolves.not.toThrow();
    expect(snack.open).toHaveBeenCalled();
  });

  it('onPortraitSkip() finalise directement (Passer cette étape = créer sans portrait, AC1)', async () => {
    const { fixture, characterSvc, router } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    characterSvc.create.mockResolvedValue({ id: 'char1' });

    await comp.onPortraitSkip();

    expect(characterSvc.create).toHaveBeenCalled();
    expect(characterSvc.updatePortrait).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'characters', 'char1']);
  });

  it('onPortraitSaved() puis onSubmit() → uploade le portrait après la création réussie (AC2)', async () => {
    const { fixture, characterSvc, router } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    characterSvc.create.mockResolvedValue({ id: 'char1' });
    characterSvc.updatePortrait.mockResolvedValue({ id: 'char1', portraitUrl: '/x.jpg' });
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const cropData = { scale: 1.2, offsetX: 0, offsetY: 0 };

    comp.onPortraitSaved({ file, cropData });
    await comp.onSubmit();

    expect(characterSvc.updatePortrait).toHaveBeenCalledWith('char1', file, cropData);
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'characters', 'char1']);
  });

  it("échec de l'upload du portrait après création réussie → n'empêche pas la redirection, avertit via snackbar", async () => {
    const { fixture, characterSvc, router, snack } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    characterSvc.create.mockResolvedValue({ id: 'char1' });
    characterSvc.updatePortrait.mockRejectedValue(new Error('network down'));
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });

    comp.onPortraitSaved({ file, cropData: { scale: 1, offsetX: 0, offsetY: 0 } });
    await comp.onSubmit();

    expect(snack.open).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'characters', 'char1']);
  });

  it("sans fichier sélectionné (pendingPortraitFile null) → onSubmit() ne tente pas d'upload", async () => {
    const { fixture, characterSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    characterSvc.create.mockResolvedValue({ id: 'char1' });

    await comp.onSubmit();

    expect(characterSvc.updatePortrait).not.toHaveBeenCalled();
  });

  it('les boutons de navigation sont désactivés pendant submitting()', async () => {
    const { fixture } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    comp.updateSheetData({ classId: 'chasseur' });
    comp.submitting.set(true);
    fixture.detectChanges();

    expect(comp.goNext()).toBeUndefined();
    const before = comp.currentStepIndex();
    comp.goNext();
    expect(comp.currentStepIndex()).toBe(before);
  });
});

// ── Système de jeu sans module (ex. Draconis) : message explicite, pas « vérifiez votre connexion » ──

describe('CharacterWizard — système sans module', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mountWith(opts: {
    schemaError: unknown;
    partiesGet?: ReturnType<typeof vi.fn>;
    gameSystemIdParam?: string | null;
  }) {
    const characterSvc = {
      getGameSystemSchema: vi.fn().mockRejectedValue(opts.schemaError),
      getGameSystemContent: vi.fn().mockRejectedValue(opts.schemaError),
      create: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [CharacterWizard],
      providers: [
        provideAnimationsAsync(),
        { provide: CharacterService, useValue: characterSvc },
        {
          provide: PartiesService,
          useValue: {
            get: opts.partiesGet ?? vi.fn().mockResolvedValue({ gameSystemId: 'draconis' }),
          },
        },
        { provide: ThemeToneService, useValue: makeThemeService() },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'p1' },
              queryParamMap: { get: () => opts.gameSystemIdParam ?? null },
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CharacterWizard);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('404 sur le schéma → message explicite « pas encore d’assistant de création »', async () => {
    const fixture = await mountWith({
      schemaError: new HttpErrorResponse({ status: 404, statusText: 'Not Found' }),
      gameSystemIdParam: 'draconis',
    });
    const message = (fixture.componentInstance as any).loadError() as string;
    expect(message).toContain("pas encore d'assistant de création");
    expect(message).not.toContain('connexion');
    expect(fixture.nativeElement.textContent).toContain(message);
  });

  it('autre erreur HTTP (500) → le message générique reste', async () => {
    const fixture = await mountWith({
      schemaError: new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
      gameSystemIdParam: 'ryuutama',
    });
    expect((fixture.componentInstance as any).loadError()).toContain('Vérifiez votre connexion');
  });

  it('404 de la PARTIE (pas du système) → message générique, pas « système sans module »', async () => {
    const fixture = await mountWith({
      schemaError: new Error('inutilisé'),
      partiesGet: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
      gameSystemIdParam: null,
    });
    const message = (fixture.componentInstance as any).loadError() as string;
    expect(message).not.toContain("pas encore d'assistant");
    expect(message).toContain('Impossible de charger');
  });
});

// ── Story 31.4 : récapitulatif du voyageur (colonne de droite / feuille « Récap ») ──────────────

describe('CharacterWizard — récapitulatif et désélection (Story 31.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('le récapitulatif est rendu dans la colonne de droite et se remplit avec la classe choisie', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    comp.updateSheetData({ classId: 'chasseur' });
    fixture.detectChanges();
    const aside = fixture.nativeElement.querySelector('.wizard__summary') as HTMLElement;
    expect(aside.querySelector('app-wizard-summary')).not.toBeNull();
    expect(aside.textContent).toContain('Classe');
  });

  it('le bouton « Récap » ouvre la feuille (même récapitulatif) et Fermer ramène le focus au bouton', async () => {
    const { fixture } = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('.wizard__recap-btn')!;
    expect(el.querySelector('.detail-surface-panel')).toBeNull();

    btn.click();
    fixture.detectChanges();
    const panel = el.querySelector('.detail-surface-panel')!;
    expect(panel.querySelector('app-wizard-summary')).not.toBeNull();
    expect(panel.textContent).not.toContain('Aucune description disponible');

    (panel.querySelector('.detail-surface-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(el.querySelector('.detail-surface-panel')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('la pastille du bouton « Récap » compte les exemplaires d’équipement choisis', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.wizard__recap-badge')).toBeNull();
    comp.onStartingEquipmentChange([
      { key: 'corde', quantity: 2 },
      { key: 'rations', quantity: 4 },
    ]);
    fixture.detectChanges();
    expect(el.querySelector('.wizard__recap-badge')!.textContent).toContain('6');
  });

  it('désélectionner la classe (classId undefined) efface spécialité et choix obligatoires, et re-bloque « Suivant »', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    comp.updateSheetData({ classId: 'artisan' });
    comp.updateSheetData({ specialtyTypeId: 'Cordonnerie' });
    comp.onClassChoiceChange({ key: 'x', value: 'y' });
    expect(comp.canGoNext()).toBe(true);

    comp.updateSheetData({ classId: undefined });
    expect(comp.sheetData().classId).toBeUndefined();
    expect(comp.sheetData().specialtyTypeId).toBeUndefined();
    expect(comp.sheetData().classChoices).toBeUndefined();
    expect(comp.canGoNext()).toBe(false);
  });

  it('la navigation porte les pictogrammes precedent / suivant, en haut (boutons nommés) et en bas (avant / après le libellé)', async () => {
    const { fixture } = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    const top = Array.from(el.querySelectorAll('.wizard__nav-btn')) as HTMLButtonElement[];
    expect(top.map((b) => b.querySelector('app-icon')?.getAttribute('data-icon'))).toEqual([
      'precedent',
      'suivant',
    ]);
    // Icône seule : le nom du bouton reste son aria-label, l'icône est décorative.
    expect(top.every((b) => b.hasAttribute('aria-label'))).toBe(true);
    expect(top[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(top.map((b) => b.textContent?.trim())).toEqual(['', '']);

    const bottom = el.querySelector('.wizard__nav-bottom') as HTMLElement;
    const prev = bottom.querySelectorAll('button')[0] as HTMLButtonElement;
    const next = bottom.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(prev.querySelector('app-icon')?.getAttribute('data-icon')).toBe('precedent');
    expect(next.querySelector('app-icon')?.getAttribute('data-icon')).toBe('suivant');
    // Ordre : l'icône précède le libellé de « précédent », le suit pour « suivant ».
    const prevLabel = prev.textContent!.trim();
    const nextLabel = next.textContent!.trim();
    expect(prev.innerHTML.indexOf('<app-icon')).toBeLessThan(prev.innerHTML.indexOf(prevLabel));
    expect(next.innerHTML.indexOf('<app-icon')).toBeGreaterThan(next.innerHTML.indexOf(nextLabel));
    expect(bottom.textContent).not.toMatch(/[❮❯]/);
    // Étape 1 : « précédent » reste désactivé comme avant.
    expect(prev.disabled).toBe(true);
  });
});
