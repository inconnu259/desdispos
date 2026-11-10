import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTabGroup } from '@angular/material/tabs';
import { By } from '@angular/platform-browser';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import type { AuthUser, CharacterDto, GameSystemContentDto } from '@master-jdr/shared';
import { CharacterSheet } from './character-sheet';
import { CharacterService } from '../../../core/characters/character.service';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const CONTENT: GameSystemContentDto = {
  class: [
    {
      key: 'menestrel',
      data: {
        label: 'Ménestrel',
        talents: [{ name: 'Légendes', effect: { description: '...', conditions: '-' } }],
      },
    },
  ],
  type: [
    {
      key: 'technique',
      data: { label: 'Technique', advantages: [{ name: 'Précision', effect: '+2' }] },
    },
  ],
  attributePattern: [{ key: 'polyvalent', data: { label: 'Polyvalent', values: [8, 4, 6, 6] } }],
  weaponCategory: [
    { key: 'lance', data: { label: 'Lance', touchFormula: 'VIG+AGI', damageFormula: 'VIG+1' } },
  ],
  weaponItem: [{ key: 'lance', data: { label: 'Lance', categoryId: 'lance' } }],
  landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
};

const CHARACTER: CharacterDto = makeCharacterDto({
  sheetData: {
    classId: 'menestrel',
    typeId: 'technique',
    weaponId: 'lance',
    attributes: { VIG: 8, AGI: 4, INT: 6, ESP: 6 },
    equipment: {
      individual: [{ id: 'item-1', name: 'Nécessaire de voyage', weight: 0, addedBy: 'player' }],
      contenants: [],
      animaux: [],
    },
    fetiqueObject: 'une plume de corbeau',
    narrative: { name: 'Fenn', homeTown: 'Aubval', motivation: 'Voir la mer' },
  },
});

function makeCharacterService(overrides: Partial<ReturnType<typeof defaultSvc>> = {}) {
  return { ...defaultSvc(), ...overrides };
}

/** Story 31.1 — même patron que `calendar-view.spec.ts` : jsdom n'implémente pas `matchMedia`,
 *  `BreakpointObserver` doit donc être mocké. Défaut **ordinateur**, sinon chaque test du menu
 *  basculerait sur la feuille mobile sans le vouloir. */
function makeBreakpointObserver(desktop: boolean) {
  return {
    isMatched: () => desktop,
    observe: () => of({ matches: desktop, breakpoints: {} }),
  };
}

function defaultSvc() {
  return {
    get: vi.fn().mockResolvedValue(CHARACTER),
    getGameSystemContent: vi.fn().mockResolvedValue(CONTENT),
    exportPdf: vi.fn().mockResolvedValue(new Blob(['%PDF-1.6'], { type: 'application/pdf' })),
    exportEquipmentPdf: vi
      .fn()
      .mockResolvedValue(new Blob(['%PDF-1.6'], { type: 'application/pdf' })),
    exportNotesPdf: vi.fn().mockResolvedValue(new Blob(['%PDF-1.6'], { type: 'application/pdf' })),
    updatePortrait: vi.fn(),
    patchPdfPortraitCrop: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([]),
    levelUp: vi.fn(),
    addInventoryItem: vi.fn(),
    updateInventoryItem: vi.fn(),
    removeInventoryItem: vi.fn(),
    getNotes: vi.fn().mockResolvedValue([]),
    addNote: vi.fn(),
    toggleNoteShare: vi.fn(),
    setSheetField: vi.fn(),
    setXp: vi.fn(),
    updateNarrativeField: vi.fn(),
    // Story 20.1 (Task 3) : CharacterSheet réagit désormais à ce signal (effect() du constructeur).
    changed: signal(0),
  };
}

async function createComponent(
  characterSvc = makeCharacterService(),
  characterId: string | null = 'char1',
  dialogResult: unknown = null,
  currentUserId: string | null = 'u1',
  partieId = 'p1',
  desktop = true,
) {
  const dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(dialogResult) }) };
  const auth = {
    currentUser: signal<AuthUser | null>(
      currentUserId ? ({ id: currentUserId } as AuthUser) : null,
    ),
  };
  // Story 20.1 (Task 3) : CharacterSheet ouvre désormais sa propre connexion RealtimeService —
  // mock direct, jsdom n'implémente pas EventSource.
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [CharacterSheet],
    providers: [
      provideNoopAnimations(),
      // Requis par RouterLink (lien « Retour à la partie ») — pas de navigation réelle testée ici,
      // même patron que scenario-detail.spec.ts.
      provideRouter([]),
      { provide: CharacterService, useValue: characterSvc },
      { provide: MatDialog, useValue: dialog },
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: { get: (key: string) => (key === 'id' ? partieId : characterId) } },
        },
      },
      { provide: RealtimeService, useValue: realtimeSvc },
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CharacterSheet);
  fixture.detectChanges();
  // ngOnInit enchaîne un Promise.all() (personnage + contenu) — whenStable() ne garantit pas
  // toujours le drainage complet de la chaîne de microtasks en environnement zoneless.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, characterSvc, dialog, auth, realtimeSvc };
}

/**
 * Story 29.5 : sélectionne un onglet de la sous-navigation locale (0=Fiche, 1=Équipement,
 * 2=Journal, 3=Historique si présent) — le contenu d'un `mat-tab` n'est rendu dans le DOM qu'une
 * fois activé (comportement natif de `mat-tab-group`, même contrainte que `partie-detail.spec.ts`).
 */
async function selectTab(fixture: ComponentFixture<CharacterSheet>, index: number): Promise<void> {
  (
    fixture.componentInstance as unknown as { onTabIndexChange: (i: number) => void }
  ).onTabIndexChange(index);
  fixture.detectChanges();
  // mat-tab-group met à jour son en-tête immédiatement mais attache le contenu du mat-tab-body
  // nouvellement actif sur un cycle de détection ultérieur (portail CDK) — un seul
  // detectChanges()/whenStable() ne suffit pas toujours en environnement zoneless.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Story 31.1 — ouvre le menu « ⋮ » de la fiche (clic sur le déclencheur) et laisse le temps à
 * l'overlay CDK de s'attacher (portail asynchrone, même contrainte que `selectTab` ci-dessus).
 */
async function openSheetMenu(fixture: ComponentFixture<CharacterSheet>): Promise<void> {
  const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__menu-trigger');
  trigger.click();
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
}

/** Boutons d'action DANS le menu ouvert — le portail CDK attache la surface ancrée à
 *  `document.body`, hors de `fixture.nativeElement` ; la feuille mobile, elle, reste dans le
 *  template du composant. `document.querySelectorAll` couvre les deux cas sans distinction. */
function sheetMenuButtons(): NodeListOf<HTMLButtonElement> {
  return document.querySelectorAll('.actions-menu__item');
}

describe('CharacterSheet', () => {
  // Story 31.1 — patcher les deux méthodes statiques sur la VRAIE classe `URL`, plutôt que la
  // remplacer entièrement (`vi.stubGlobal('URL', { ...URL })` perdait le constructeur : le CDK
  // Overlay du nouveau menu en a besoin en interne, et `new URL(...)` levait `TypeError: URL is
  // not a constructor` dès qu'un test ouvrait le menu).
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('charge le personnage et le contenu, affiche les sections avec labels résolus (pas les clés brutes)', async () => {
    const { fixture, characterSvc } = await createComponent();

    expect(characterSvc.get).toHaveBeenCalledWith('char1');
    expect(characterSvc.getGameSystemContent).toHaveBeenCalledWith('ryuutama');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fenn');
    expect(text).toContain('Ménestrel');
    expect(text).toContain('Technique');
    expect(text).toContain('Lance');
    expect(text).toContain('PV 16');
    expect(text).not.toContain('menestrel');
    expect(text).not.toContain('technique');
  });

  it('affiche un lien « Retour à la partie » vers /parties/:partieId (spec fiches-personnages-partie-et-retour)', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'u1', 'p1');

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a[mat-button]');
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain(GRIMOIRE_TONE['character.back_to_partie_cta']);
    // RouterLink résout `href` depuis `c.partieId` — CHARACTER n'en porte pas dans sa fixture
    // littérale, mais `makeCharacterDto()` (base de CHARACTER) le fixe à 'p1' par défaut.
    expect(link!.getAttribute('href')).toBe('/parties/p1');
  });

  it('Story 25.2 : personnage avec customWeapon (arme libre) affiche le nom libre + formules de la catégorie référencée', async () => {
    const character = makeCharacterDto({
      sheetData: {
        classId: 'menestrel',
        typeId: 'technique',
        weaponId: undefined,
        customWeapon: { name: 'Fléau maison', categoryId: 'lance' },
        attributes: { VIG: 8, AGI: 4, INT: 6, ESP: 6 },
      },
    });
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(character) });
    const { fixture } = await createComponent(characterSvc);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fléau maison');
    expect(text).toContain('VIG+AGI');
    expect(text).toContain('VIG+1');
  });

  it('composant détruit avant la résolution de get() → pas d’erreur (résolution tardive sans garde)', async () => {
    // Angular ne lève aucune erreur/avertissement quand un signal est mis à jour sur un composant
    // déjà détruit (ce n'est ni un ChangeDetectorRef ni un effect() actif) — pas de garde
    // `destroyed` nécessaire ici, juste la garantie que la résolution tardive ne plante pas.
    let resolveGet!: (c: CharacterDto) => void;
    const characterSvc = makeCharacterService({
      get: vi.fn(() => new Promise<CharacterDto>((resolve) => (resolveGet = resolve))),
    });
    const dialog = { open: vi.fn() };
    const auth = { currentUser: signal<AuthUser | null>({ id: 'u1' } as AuthUser) };
    await TestBed.configureTestingModule({
      imports: [CharacterSheet],
      providers: [
        { provide: CharacterService, useValue: characterSvc },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'p1' : 'char1') } },
          },
        },
        { provide: RealtimeService, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CharacterSheet);
    fixture.detectChanges();

    fixture.destroy();
    expect(() => resolveGet(CHARACTER)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('fellow player (lecture seule) → affiche les notes narratives renseignées uniquement', async () => {
    const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Aubval');
    expect(text).toContain('Voir la mer');
    expect(text).not.toContain('Sexe');
  });

  it('propriétaire → affiche même les champs narratifs vides (Story 6.7 AC2, pour pouvoir les renseigner)', async () => {
    const { fixture } = await createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Aubval');
    expect(text).toContain('Voir la mer');
    expect(text).toContain('Sexe');
  });

  it("403 → message d'erreur explicite affiché, pas de plantage", async () => {
    const characterSvc = makeCharacterService({
      get: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })),
    });
    const { fixture } = await createComponent(characterSvc);

    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBe(GRIMOIRE_TONE['characters_sheet.access_denied']);
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['characters_sheet.access_denied'],
    );
  });

  it('échec de chargement (403) → lien « Retour à la partie » affiché malgré tout, pas seulement dans la branche succès (spec fiches-personnages-partie-et-retour)', async () => {
    const characterSvc = makeCharacterService({
      get: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })),
    });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'u1', 'p1');

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a[mat-button]');
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain(GRIMOIRE_TONE['character.back_to_partie_cta']);
    expect(link!.getAttribute('href')).toBe('/parties/p1');
    expect(link!.querySelector('app-icon')?.getAttribute('data-icon')).toBe('retour');
  });

  it('erreur réseau générique → message affiché, pas de plantage', async () => {
    const characterSvc = makeCharacterService({
      get: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { fixture } = await createComponent(characterSvc);

    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.loadError());
  });

  it("characterId absent du paramMap → message d'erreur affiché, pas de plantage ni chargement infini", async () => {
    const characterSvc = makeCharacterService();
    const { fixture } = await createComponent(characterSvc, null);

    expect(characterSvc.get).not.toHaveBeenCalled();
    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBe(GRIMOIRE_TONE['characters_sheet.not_found']);
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['characters_sheet.not_found'],
    );
  });

  it('échec du chargement du contenu de jeu (getGameSystemContent) → la fiche du personnage reste affichée', async () => {
    const characterSvc = makeCharacterService({
      getGameSystemContent: vi.fn().mockRejectedValue(new Error('content down')),
    });
    const { fixture } = await createComponent(characterSvc);

    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBeNull();
    expect(comp.character()).toEqual(CHARACTER);
    expect(fixture.nativeElement.textContent).toContain('Fenn');
  });

  it('affiche la spécialité (specialtyTypeId) pour la classe Artisan quand renseignée', async () => {
    const artisan: CharacterDto = {
      ...CHARACTER,
      sheetData: { ...CHARACTER.sheetData, classId: 'artisan', specialtyTypeId: 'Forgeron' },
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(artisan) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.textContent).toContain('Forgeron');
  });

  // Story 31.1 — les cinq actions ont quitté la vue principale pour le menu « ⋮ » : chaque test
  // ouvre désormais le menu avant d'interroger ses boutons. Le comportement testé (quel service
  // est appelé, avec quels arguments, quelle erreur s'affiche) ne change pas — voir AC3.

  it("AC1 — aucune action d'export visible tant que le menu est fermé (ordinateur)", async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.querySelector('.sheet__export-actions')).toBeNull();
    expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);
  });

  // Revue de code 31.1 — l'AC1 nomme littéralement « sur téléphone », mais aucun test de ce
  // fichier ne passait jamais `desktop=false` avant ce patch : toute la branche feuille mobile
  // (`character-sheet.html`, bloc `@else if (sheetMenuOpen())`) tournait sans filet.
  it("AC1 — aucune action d'export visible tant que le menu est fermé (téléphone)", async () => {
    await createComponent(makeCharacterService(), 'char1', null, 'u1', 'p1', false);
    expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);
  });

  it('clic sur "Exporter en PDF (éditable)" → appelle exportPdf(id, "editable"), déclenche un téléchargement, et referme le menu (AC3, AC4)', async () => {
    const { fixture, characterSvc } = await createComponent();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    await openSheetMenu(fixture);
    sheetMenuButtons()[0].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.exportPdf).toHaveBeenCalledWith('char1', 'editable');
    expect(clickSpy).toHaveBeenCalled();
    expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);
    clickSpy.mockRestore();
  });

  it('clic sur "Exporter en PDF (2 pages)" → appelle exportPdf(id, "2pages")', async () => {
    const { fixture, characterSvc } = await createComponent();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    await openSheetMenu(fixture);
    sheetMenuButtons()[1].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.exportPdf).toHaveBeenCalledWith('char1', '2pages');
  });

  it('clic sur "Exporter l\'équipement en PDF" → appelle exportEquipmentPdf(id) et déclenche un téléchargement', async () => {
    const { fixture, characterSvc } = await createComponent();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    await openSheetMenu(fixture);
    sheetMenuButtons()[2].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.exportEquipmentPdf).toHaveBeenCalledWith('char1');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("échec de l'export équipement → message d'erreur affiché, pas de plantage", async () => {
    const characterSvc = makeCharacterService({
      exportEquipmentPdf: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { fixture } = await createComponent(characterSvc);

    await openSheetMenu(fixture);
    sheetMenuButtons()[2].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.exportEquipmentError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.exportEquipmentError());
  });

  it('clic sur "Exporter les notes en PDF" → appelle exportNotesPdf(id) et déclenche un téléchargement', async () => {
    const { fixture, characterSvc } = await createComponent();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    await openSheetMenu(fixture);
    sheetMenuButtons()[3].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.exportNotesPdf).toHaveBeenCalledWith('char1');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("échec de l'export notes → message d'erreur affiché, pas de plantage", async () => {
    const characterSvc = makeCharacterService({
      exportNotesPdf: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { fixture } = await createComponent(characterSvc);

    await openSheetMenu(fixture);
    sheetMenuButtons()[3].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.exportNotesError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.exportNotesError());
  });

  // ⚠️ CETTE STORY CHANGE LA VÉRITÉ DE CE TEST — pas supprimé, réécrit. Avant la 31.1, les quatre
  // boutons restaient VISIBLES ET DÉSACTIVÉS pendant un export en cours (ils vivaient en
  // permanence dans l'en-tête). Depuis la 31.1 (AC4), le menu se referme AUSSITÔT le clic, avant
  // même que l'export ne résolve — il n'y a donc plus de bouton à désactiver : la garde devient
  // « le menu est fermé », pas « les boutons sont disabled ».
  it("un clic sur une action ferme le menu immédiatement, avant même que l'export ne résolve (AC4)", async () => {
    let resolveExport: (blob: Blob) => void;
    const pending = new Promise<Blob>((resolve) => {
      resolveExport = resolve;
    });
    const characterSvc = makeCharacterService({
      exportNotesPdf: vi.fn().mockReturnValue(pending),
    });
    const { fixture } = await createComponent(characterSvc);

    await openSheetMenu(fixture);
    expect(sheetMenuButtons().length).toBe(4);
    sheetMenuButtons()[3].click();
    fixture.detectChanges();

    expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);

    resolveExport!(new Blob(['%PDF-1.6'], { type: 'application/pdf' }));
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  });

  it("échec de l'export → message d'erreur affiché, pas de plantage", async () => {
    const characterSvc = makeCharacterService({
      exportPdf: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { fixture } = await createComponent(characterSvc);

    await openSheetMenu(fixture);
    sheetMenuButtons()[0].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.exportError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.exportError());
  });

  it('propriétaire consultant sa propre fiche → aucun badge/pseudo affiché', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'u1');
    expect(fixture.nativeElement.querySelector('.sheet__owner-badge')).toBeNull();
  });

  it('MJ (non-propriétaire) consultant la fiche d’un joueur → nom affiché du propriétaire, via IdentityLabel (AC2)', async () => {
    // viewerIsMj résolu côté API (Story 6.5 revue de code) — explicite ici car ce test simule
    // un VRAI MJ, distinct d'un simple fellow player non-MJ (cf. test dédié plus bas).
    const asMj = { ...CHARACTER, viewerIsMj: true };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asMj) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
    const badge = fixture.nativeElement.querySelector('.sheet__owner-badge');
    // Revue de code 28.2 : le badge affichait `ownerPseudo` en texte brut, hors IdentityLabel —
    // la carte résumé du même personnage montrait déjà le nom affiché (AC4).
    expect(badge?.querySelector('app-identity-label')).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('Alice au pays');
    // Un seul nom affiché → l'icône silhouette est obligatoire (AC3).
    expect(badge?.querySelector('svg')).not.toBeNull();
  });

  it("fellow player (ni propriétaire, ni MJ) consultant la fiche d'un coéquipier → aucun badge affiché (corrige l'ancienne heuristique 'tout non-propriétaire = MJ', revue de code Story 6.5)", async () => {
    const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');
    expect(fixture.nativeElement.querySelector('.sheet__owner-badge')).toBeNull();
  });

  it('MJ consultant la fiche de son propre personnage → aucun badge affiché (isOwner prime sur viewerIsMj)', async () => {
    const mjOwnCharacter: CharacterDto = {
      ...CHARACTER,
      userId: 'mj1',
      ownerIsMj: true,
      ownerPseudo: 'le-mj',
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(mjOwnCharacter) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj1');
    // Le MJ est propriétaire de son propre personnage → isOwner()=true → viewerIsMj()=false → aucun badge.
    expect(fixture.nativeElement.querySelector('.sheet__owner-badge')).toBeNull();
  });

  it('sans portrait → aucun PortraitPanel affiché', async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.querySelector('.portrait-panel')).toBeNull();
  });

  it('avec portrait → PortraitPanel affiché', async () => {
    const withPortrait: CharacterDto = {
      ...CHARACTER,
      portraitUrl: '/uploads/portraits/x.jpg',
      portraitCropData: { scale: 1, offsetX: 0, offsetY: 0 },
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withPortrait) });
    const { fixture } = await createComponent(characterSvc);
    expect(fixture.nativeElement.querySelector('.portrait-panel')).not.toBeNull();
  });

  it('clic sur "Modifier le portrait" → ouvre le dialogue PortraitCropper', async () => {
    const { fixture, dialog } = await createComponent();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__portrait-edit-cta');
    btn.click();
    expect(dialog.open).toHaveBeenCalled();
  });

  it('MJ consultant la fiche d\'un personnage qui n\'est pas le sien → CTA "Modifier le portrait" absent (lecture seule, FR39)', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'mj-stranger');
    expect(fixture.nativeElement.querySelector('.sheet__portrait-edit-cta')).toBeNull();
  });

  it("editPortrait() ne fait rien si appelé alors qu'on n'est pas le propriétaire (défense en profondeur)", async () => {
    const { fixture, dialog } = await createComponent(
      makeCharacterService(),
      'char1',
      null,
      'mj-stranger',
    );
    const comp = fixture.componentInstance as any;
    comp.editPortrait();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('double-clic rapide sur "Modifier le portrait" (dialogue encore ouvert) → un seul dialogue ouvert', async () => {
    const afterClosedSubject = new Subject<unknown>();
    const dialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() }),
    };
    await TestBed.configureTestingModule({
      imports: [CharacterSheet],
      providers: [
        { provide: CharacterService, useValue: makeCharacterService() },
        { provide: MatDialog, useValue: dialog },
        {
          provide: AuthService,
          useValue: { currentUser: signal<AuthUser | null>({ id: 'u1' } as AuthUser) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'p1' : 'char1') } },
          },
        },
        { provide: RealtimeService, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CharacterSheet);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__portrait-edit-cta');
    btn.click();
    btn.click();

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('dialogue résolu avec un résultat → appelle updatePortrait puis rafraîchit le personnage affiché', async () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const cropData = { scale: 1.2, offsetX: 0, offsetY: 0 };
    const updated = {
      ...CHARACTER,
      portraitUrl: '/uploads/portraits/new.jpg',
      portraitCropData: cropData,
    };
    const characterSvc = makeCharacterService({
      updatePortrait: vi.fn().mockResolvedValue(updated),
    });
    const { fixture } = await createComponent(characterSvc, 'char1', { file, cropData });

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__portrait-edit-cta');
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.updatePortrait).toHaveBeenCalledWith('char1', file, cropData);
    const comp = fixture.componentInstance as any;
    expect(comp.character().portraitUrl).toBe('/uploads/portraits/new.jpg');
  });

  it('dialogue annulé (résultat null) → aucun appel à updatePortrait', async () => {
    const characterSvc = makeCharacterService();
    const { fixture } = await createComponent(characterSvc, 'char1', null);

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__portrait-edit-cta');
    btn.click();
    await Promise.resolve();

    expect(characterSvc.updatePortrait).not.toHaveBeenCalled();
  });

  it("échec de la mise à jour du portrait → message d'erreur affiché, pas de plantage", async () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const cropData = { scale: 1, offsetX: 0, offsetY: 0 };
    const characterSvc = makeCharacterService({
      updatePortrait: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { fixture } = await createComponent(characterSvc, 'char1', { file, cropData });

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__portrait-edit-cta');
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.portraitError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.portraitError());
  });

  // Story 31.1 — le CTA de recadrage PDF est désormais la 5e action DANS le menu, jamais rendu
  // seul dans l'en-tête : ouvrir le menu avant de vérifier sa présence/absence (AC6).

  it('menu — "Ajuster le cadrage PDF" absent si le personnage n\'a pas de portrait (AC6)', async () => {
    const { fixture } = await createComponent();
    await openSheetMenu(fixture);
    expect(sheetMenuButtons().length).toBe(4);
  });

  it('propriétaire + portrait existant → le menu porte les 5 actions, et cliquer "Ajuster le cadrage PDF" ouvre le dialogue en mode rect (AC2, AC6)', async () => {
    const withPortrait = { ...CHARACTER, portraitUrl: '/uploads/portraits/x.jpg' };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withPortrait) });
    const { fixture, dialog } = await createComponent(characterSvc);

    await openSheetMenu(fixture);
    const buttons = sheetMenuButtons();
    expect(buttons.length).toBe(5);
    buttons[4].click();

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ characterId: 'char1', shape: 'rect' }),
      }),
    );
  });

  it('MJ (non-propriétaire) → "Ajuster le cadrage PDF" absent du menu (lecture seule, FR39, AC6)', async () => {
    const withPortrait = { ...CHARACTER, portraitUrl: '/uploads/portraits/x.jpg' };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withPortrait) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
    await openSheetMenu(fixture);
    expect(sheetMenuButtons().length).toBe(4);
  });

  it('dialogue résolu → appelle patchPdfPortraitCrop puis rafraîchit le personnage affiché', async () => {
    const withPortrait = { ...CHARACTER, portraitUrl: '/uploads/portraits/x.jpg' };
    const cropData = { scale: 1.3, offsetX: 5, offsetY: -5 };
    const updated = { ...withPortrait, pdfPortraitCropData: cropData };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withPortrait),
      patchPdfPortraitCrop: vi.fn().mockResolvedValue(updated),
    });
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const { fixture } = await createComponent(characterSvc, 'char1', { file, cropData });

    await openSheetMenu(fixture);
    sheetMenuButtons()[4].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.patchPdfPortraitCrop).toHaveBeenCalledWith('char1', cropData);
    const comp = fixture.componentInstance as any;
    expect(comp.character().pdfPortraitCropData).toEqual(cropData);
  });

  it("échec de patchPdfPortraitCrop → message d'erreur affiché, pas de plantage", async () => {
    const withPortrait = { ...CHARACTER, portraitUrl: '/uploads/portraits/x.jpg' };
    const cropData = { scale: 1, offsetX: 0, offsetY: 0 };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withPortrait),
      patchPdfPortraitCrop: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const { fixture } = await createComponent(characterSvc, 'char1', { file, cropData });

    await openSheetMenu(fixture);
    sheetMenuButtons()[4].click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(comp.portraitError()).toBeTruthy();
  });

  // ── Story 31.1 — le menu « ⋮ » lui-même (déclencheur, clavier, contenu exact) ──────────────

  it('AC5 — le bouton "Modifier le portrait" (avatar) n\'est jamais dans le menu', async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.querySelector('.sheet__portrait-edit-cta')).not.toBeNull();

    await openSheetMenu(fixture);
    const menuText = Array.from(sheetMenuButtons())
      .map((b) => b.textContent)
      .join(' ');
    expect(menuText).not.toContain(
      (fixture.componentInstance as any).theme.tone()['character.portrait_edit_cta'],
    );
  });

  it('51.6 — le lien de retour porte le pictogramme retour et le déclencheur du menu le pictogramme menu-actions', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'u1', 'p1');
    const el = fixture.nativeElement as HTMLElement;

    const link = el.querySelector('a[mat-button]') as HTMLAnchorElement;
    expect(link.querySelector('app-icon')?.getAttribute('data-icon')).toBe('retour');
    // Icône à côté du texte : décorative.
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    const trigger = el.querySelector('.sheet__menu-trigger') as HTMLButtonElement;
    expect(trigger.querySelector('app-icon')?.getAttribute('data-icon')).toBe('menu-actions');
    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.getAttribute('aria-label')).toBeTruthy();
  });

  it('AC7 — le déclencheur porte un nom accessible et aria-haspopup', async () => {
    const { fixture } = await createComponent();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__menu-trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-label')).toBeTruthy();
  });

  it('AC7 — Échap ferme le menu et rend le focus au déclencheur', async () => {
    const { fixture } = await createComponent();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.sheet__menu-trigger');
    const focusSpy = vi.spyOn(trigger, 'focus');

    await openSheetMenu(fixture);
    expect(sheetMenuButtons().length).toBeGreaterThan(0);

    const comp = fixture.componentInstance as any;
    comp.onSheetMenuKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(comp.sheetMenuOpen()).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
  });

  it('AC8 — aucun mat-menu dans le DOM', async () => {
    const { fixture } = await createComponent();
    await openSheetMenu(fixture);
    expect(document.querySelector('mat-menu')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-menu')).toBeNull();
  });

  // ── Revue de code 31.1 — la branche feuille mobile (`@else if (sheetMenuOpen())`), jamais
  // exercée avant ce patch : tous les tests du menu tournaient avec `desktop=true` par défaut. ──

  describe('menu sur téléphone (feuille du bas)', () => {
    it('ouvre une feuille role="dialog" aria-modal avec les 4 actions', async () => {
      const { fixture } = await createComponent(
        makeCharacterService(),
        'char1',
        null,
        'u1',
        'p1',
        false,
      );
      await openSheetMenu(fixture);

      const sheet = document.querySelector('.sheet-menu-surface--sheet');
      expect(sheet).not.toBeNull();
      expect(sheet!.getAttribute('role')).toBe('dialog');
      expect(sheet!.getAttribute('aria-modal')).toBe('true');
      expect(sheetMenuButtons().length).toBe(4);
    });

    it('clic sur le voile referme la feuille', async () => {
      const { fixture } = await createComponent(
        makeCharacterService(),
        'char1',
        null,
        'u1',
        'p1',
        false,
      );
      await openSheetMenu(fixture);
      expect(sheetMenuButtons().length).toBe(4);

      const backdrop: HTMLElement = document.querySelector('.sheet-menu-backdrop')!;
      backdrop.click();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);
    });

    it('Échap ferme la feuille et rend le focus au déclencheur', async () => {
      const { fixture } = await createComponent(
        makeCharacterService(),
        'char1',
        null,
        'u1',
        'p1',
        false,
      );
      const trigger: HTMLButtonElement =
        fixture.nativeElement.querySelector('.sheet__menu-trigger');
      const focusSpy = vi.spyOn(trigger, 'focus');

      await openSheetMenu(fixture);
      expect(sheetMenuButtons().length).toBe(4);

      const comp = fixture.componentInstance as any;
      comp.onSheetMenuKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(comp.sheetMenuOpen()).toBe(false);
      expect(focusSpy).toHaveBeenCalled();
    });

    it('clic sur une action ferme la feuille et appelle le service (AC3, AC4)', async () => {
      const { fixture, characterSvc } = await createComponent(
        makeCharacterService(),
        'char1',
        null,
        'u1',
        'p1',
        false,
      );
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

      await openSheetMenu(fixture);
      sheetMenuButtons()[0].click();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(characterSvc.exportPdf).toHaveBeenCalledWith('char1', 'editable');
      expect(document.querySelectorAll('.actions-menu__item').length).toBe(0);
    });
  });

  // ── Story 31.2 — surface de détail adaptative (FR-20) ──────────────────────────────────────

  describe('surface de détail (talents/avantages)', () => {
    function detailTriggerNamed(fixture: ComponentFixture<CharacterSheet>, name: string) {
      const triggers: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.sheet__detail-trigger'),
      );
      return triggers.find((b) => b.textContent?.trim() === name)!;
    }

    it('AC1 — activer un talent ouvre la surface avec son nom et sa description', async () => {
      const { fixture } = await createComponent();
      expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();

      detailTriggerNamed(fixture, 'Légendes').click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.detail-surface-panel');
      expect(panel).not.toBeNull();
      expect(panel.querySelector('.detail-surface-title').textContent).toContain('Légendes');
      // Story 31.4 — un talent s'ouvre en tableau mécanique (Effet, …) puis récit (AC9).
      expect(panel.querySelector('.detail-surface-rows').textContent).toContain('...');
    });

    it('AC1 — activer un avantage ouvre la surface (champ `effect`, pas `effect.description`)', async () => {
      const { fixture } = await createComponent();

      detailTriggerNamed(fixture, 'Précision').click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.detail-surface-panel');
      expect(panel.querySelector('.detail-surface-title').textContent).toContain('Précision');
      expect(panel.querySelector('.detail-surface-body').textContent).toContain('+2');
    });

    // ⚠️ Story 31.4 (AC10) : la surface est désormais modale sur desktop aussi — son voile recouvre
    // les déclencheurs, un utilisateur ne peut plus activer un second terme sans fermer le premier.
    // Ce test ne vérifie donc plus un geste réel mais l'invariant qui reste : jamais deux panneaux.
    it('AC10 (31.4) — un seul terme ouvert à la fois : jamais deux panneaux empilés', async () => {
      const { fixture } = await createComponent();

      detailTriggerNamed(fixture, 'Légendes').click();
      fixture.detectChanges();
      expect(document.querySelectorAll('.detail-surface-panel').length).toBe(1);

      detailTriggerNamed(fixture, 'Précision').click();
      fixture.detectChanges();

      const panels = fixture.nativeElement.querySelectorAll('.detail-surface-panel');
      expect(panels.length).toBe(1);
      expect(panels[0].querySelector('.detail-surface-title').textContent).toContain('Précision');
    });

    it('fermer puis rouvrir sur un autre élément fonctionne', async () => {
      const { fixture } = await createComponent();

      detailTriggerNamed(fixture, 'Légendes').click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();

      detailTriggerNamed(fixture, 'Précision').click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('.detail-surface-panel .detail-surface-title')
          .textContent,
      ).toContain('Précision');
    });

    it('AC6 — le focus revient au déclencheur d’origine à la fermeture', async () => {
      const { fixture } = await createComponent();
      const trigger = detailTriggerNamed(fixture, 'Légendes');
      const focusSpy = vi.spyOn(trigger, 'focus');

      trigger.click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('AC7 — les déclencheurs sont de vrais boutons, accessibles au clavier (Tab)', async () => {
      const { fixture } = await createComponent();
      const trigger = detailTriggerNamed(fixture, 'Légendes');
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('type')).toBe('button');
      expect(trigger.tabIndex).not.toBe(-1);
    });
  });

  it('niveau affiché dynamique (c.level) au lieu de "Niveau 1" figé', async () => {
    const character = { ...CHARACTER, xp: 3000, level: 6 };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(character) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.querySelector('.sheet__meta').textContent).toContain('Niveau 6');
  });

  it('propriétaire avec niveau en attente → LevelUpBanner visible', async () => {
    const character = { ...CHARACTER, xp: 150 };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(character) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'u1');

    expect(fixture.nativeElement.querySelector('.level-up-banner')).not.toBeNull();
  });

  it('propriétaire sans niveau en attente → LevelUpBanner absent', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'u1');
    expect(fixture.nativeElement.querySelector('.level-up-banner')).toBeNull();
  });

  it('MJ (non-propriétaire) → LevelUpBanner jamais affiché, même avec niveau en attente', async () => {
    const character = { ...CHARACTER, xp: 150 };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(character) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');

    expect(fixture.nativeElement.querySelector('.level-up-banner')).toBeNull();
  });

  it('Story 28.3 (AC4) : LevelUpBanner est positionné juste sous le nom du personnage (sheet__header-info), pas après le bloc d’en-tête complet', async () => {
    const character = { ...CHARACTER, xp: 150 };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(character) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'u1');

    expect(
      fixture.nativeElement.querySelector('.sheet__header-info .level-up-banner-live'),
    ).not.toBeNull();
  });

  it('propriétaire → section Historique visible', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'u1');
    // Story 29.5 : Historique est désormais un onglet de la sous-navigation locale (index 3,
    // hasHistoryTab() vrai pour le propriétaire) — son contenu n'est rendu qu'une fois sélectionné.
    await selectTab(fixture, 3);
    expect(fixture.nativeElement.querySelector('.sheet__history')).not.toBeNull();
  });

  it('MJ (non-propriétaire) → section Historique visible également (AC4)', async () => {
    const asMj = { ...CHARACTER, viewerIsMj: true };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asMj) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
    await selectTab(fixture, 3);
    expect(fixture.nativeElement.querySelector('.sheet__history')).not.toBeNull();
  });

  it("fellow player (ni propriétaire, ni MJ) → section Historique ABSENTE (corrige la fuite d'accès identifiée en revue de code Story 6.5 : un fellow player pouvait auparavant la voir, sans jamais accéder aux données réelles derrière — getHistory reste MJ-seul côté serveur)", async () => {
    const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');
    expect(fixture.nativeElement.querySelector('.sheet__history')).toBeNull();
  });

  it('aucune capacité sans section dédiée → section "Autres capacités" absente', async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.textContent).not.toContain('Autres capacités');
  });

  it('capacité sans section dédiée (protection d\'un dragon) → section "Autres capacités" affichée, visible aussi pour le MJ', async () => {
    const withDragonProtection = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 9,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'dragon-protection', params: { key: 'ete' } }],
          },
        ],
      },
    };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withDragonProtection),
    });
    const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Autres capacités');
    expect(text).toContain("Protection d'un dragon");
    expect(text).not.toContain('Niveau 9 — ');
  });

  it('capacité structurelle (attribut/paysage/immunité/classe/type) → jamais dans "Autres capacités"', async () => {
    const withStructural = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 2,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
          },
        ],
      },
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withStructural) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.textContent).not.toContain('Autres capacités');
  });

  it('classe secondaire (capacité class) → sous-bloc "Classe secondaire" dans Vocation, avec ses talents', async () => {
    const withSecondaryClass = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 5,
            pvAllocated: 0,
            peAllocated: 3,
            capabilities: [{ type: 'class', params: { key: 'marchand' } }],
          },
        ],
      },
    };
    const contentWithMarchand: GameSystemContentDto = {
      ...CONTENT,
      class: [
        ...(CONTENT['class'] ?? []),
        {
          key: 'marchand',
          data: {
            label: 'Marchand',
            talents: [
              { name: 'Négociation', effect: { description: 'Baisse un prix', conditions: '-' } },
            ],
          },
        },
      ],
    };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withSecondaryClass),
      getGameSystemContent: vi.fn().mockResolvedValue(contentWithMarchand),
    });
    const { fixture } = await createComponent(characterSvc);

    // Story 31.3 — le nom de la classe secondaire est désormais porté par son propre déclencheur
    // quand le catalogue lui donne une description ; le titre est donc lu en espaces normalisés
    // (le navigateur les replie, `textContent` non).
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Classe secondaire : Marchand');
    expect(text).toContain('Négociation');

    // Story 31.2 — le texte descriptif n'est plus inline, il s'ouvre dans la surface de détail
    // au clic sur le nom du talent (AC1).
    const triggers: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.sheet__detail-trigger'),
    );
    const negociationBtn = triggers.find((b) => b.textContent?.trim() === 'Négociation');
    negociationBtn!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.detail-surface-rows').textContent).toContain(
      'Baisse un prix',
    );
  });

  it('type secondaire (capacité type) → sous-bloc "Type secondaire" dans Voie, avec ses avantages', async () => {
    const withSecondaryType = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 6,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'type', params: { key: 'magie' } }],
          },
        ],
      },
    };
    const contentWithMagie: GameSystemContentDto = {
      ...CONTENT,
      type: [
        ...(CONTENT['type'] ?? []),
        {
          key: 'magie',
          data: { label: 'Magie', advantages: [{ name: 'Incantation', effect: '+2' }] },
        },
      ],
    };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withSecondaryType),
      getGameSystemContent: vi.fn().mockResolvedValue(contentWithMagie),
    });
    const { fixture } = await createComponent(characterSvc);

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Type secondaire : Magie');
    expect(text).toContain('Incantation');
  });

  it('paysage obtenu → nouvelle section Paysage/Climat favori affichée avec "+2 aux tests appropriés"', async () => {
    const withLandscape = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 3,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'landscape', params: { key: 'foret' } }],
          },
        ],
      },
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withLandscape) });
    const { fixture } = await createComponent(characterSvc);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Paysage/Climat favori');
    expect(text).toContain('Forêt');
    expect(text).toContain('+2 aux tests appropriés');
  });

  it('aucun paysage obtenu → section Paysage/Climat favori absente', async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.textContent).not.toContain('Paysage/Climat favori');
  });

  it('immunité obtenue → nouvelle section Immunités affichée', async () => {
    const withImmunity = {
      ...CHARACTER,
      sheetData: {
        ...CHARACTER.sheetData,
        levelUps: [
          {
            level: 4,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'immunity', params: { key: 'blesse' } }],
          },
        ],
      },
    };
    const contentWithImmunity: GameSystemContentDto = {
      ...CONTENT,
      immunityState: [{ key: 'blesse', data: { label: 'Blessé' } }],
    };
    const characterSvc = makeCharacterService({
      get: vi.fn().mockResolvedValue(withImmunity),
      getGameSystemContent: vi.fn().mockResolvedValue(contentWithImmunity),
    });
    const { fixture } = await createComponent(characterSvc);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Immunités');
    expect(text).toContain('Blessé');
  });

  it('aucune immunité obtenue → section Immunités absente', async () => {
    const { fixture } = await createComponent();
    expect(fixture.nativeElement.textContent).not.toContain('Immunités');
  });

  it('XP affiché comme stat-pill dans Statistiques dérivées', async () => {
    const withXp = { ...CHARACTER, xp: 250 };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(withXp) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.textContent).toContain('XP 250');
  });

  it('derived absent (fiche d’un compagnon dont les attributs sont verrouillés, Story 31.6) : message de statistiques masquées, aucune erreur', async () => {
    const masked = {
      ...CHARACTER,
      derived: undefined as never,
      hiddenFields: ['attributes', 'derived'],
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(masked) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.derived_hidden']);
    expect(fixture.nativeElement.textContent).not.toContain('PV undefined');
  });

  it('attributes verrouillés en bloc (correctif, hiddenFields) : « Masqué par le MJ » à la place de la grille, jamais une grille vide silencieuse', async () => {
    const masked = {
      ...CHARACTER,
      derived: undefined as never,
      hiddenFields: ['attributes', 'derived'],
    };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(masked) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.querySelector('.sheet__attr-grid')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sheet__masked-note')?.textContent).toContain(
      GRIMOIRE_TONE['evolution.hidden_marker'],
    );
  });

  it('un seul sous-champ verrouillé (attributes.AGI, correctif) : la grille reste affichée, seule la case AGI porte « Masqué par le MJ »', async () => {
    const masked = { ...CHARACTER, hiddenFields: ['attributes.AGI'] };
    const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(masked) });
    const { fixture } = await createComponent(characterSvc);

    expect(fixture.nativeElement.querySelector('.sheet__attr-grid')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('VIG');
    expect(fixture.nativeElement.textContent).toContain('8'); // VIG toujours visible
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.hidden_marker']);
  });

  it('section Inventaire visible pour le propriétaire', async () => {
    const { fixture } = await createComponent();
    // Story 29.5 : Équipement est désormais l'onglet d'index 1 de la sous-navigation locale.
    await selectTab(fixture, 1);
    expect(fixture.nativeElement.querySelector('app-inventory-tab')).not.toBeNull();
  });

  it('section Inventaire visible pour le MJ (lecture) — équipement individuel non dupliqué dans la carte Équipement (Story 14.2)', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'mj-stranger');
    await selectTab(fixture, 1);
    expect(fixture.nativeElement.querySelector('app-inventory-tab')).not.toBeNull();
    // "Nécessaire de voyage" (individual) ne doit jamais apparaître dans la carte "Équipement" —
    // seul l'objet fétiche y reste, la liste group/individual a été retirée (Story 14.2, AC5).
    const equipmentCard = Array.from(fixture.nativeElement.querySelectorAll('.sheet__card')).find(
      (card: any) => card.textContent.includes('Équipement'),
    ) as HTMLElement;
    expect(equipmentCard.textContent).not.toContain('Nécessaire de voyage');
    expect(equipmentCard.textContent).toContain('une plume de corbeau');
  });

  it('section Notes visible pour le propriétaire, isOwner=true transmis', async () => {
    const { fixture } = await createComponent();
    // Story 29.5 : Journal est désormais l'onglet d'index 2 de la sous-navigation locale.
    await selectTab(fixture, 2);
    const notesEl = fixture.nativeElement.querySelector('app-notes-journal');
    expect(notesEl).not.toBeNull();
  });

  it('section Notes visible pour le MJ (lecture)', async () => {
    const { fixture } = await createComponent(makeCharacterService(), 'char1', null, 'mj-stranger');
    await selectTab(fixture, 2);
    expect(fixture.nativeElement.querySelector('app-notes-journal')).not.toBeNull();
  });

  it('section Notes visible pour un participant tiers (ni propriétaire ni MJ) — Story 6.5 AC4', async () => {
    const { fixture } = await createComponent(
      makeCharacterService(),
      'char1',
      null,
      'joueur-tiers',
    );
    await selectTab(fixture, 2);
    expect(fixture.nativeElement.querySelector('app-notes-journal')).not.toBeNull();
  });

  describe('édition MJ (FieldEditPencil, Story 6.6)', () => {
    it('viewerIsMj:true → pencils attributs (×4) + XP + arme + 6 champs narratifs visibles sur l’onglet Fiche', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asMj) });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');

      // Story 29.5 : les pencils MJ sont désormais répartis sur 2 onglets — 4 attributs + XP +
      // arme + 6 narratifs = 12 sur l'onglet Fiche (index 0, actif par défaut), l'objet fétiche
      // (1 pencil) est sur l'onglet Équipement (index 1) — vérifié séparément ci-dessous.
      const pencilsOnFiche = fixture.nativeElement.querySelectorAll('.field-edit-pencil__button');
      expect(pencilsOnFiche.length).toBe(12);
    });

    it('viewerIsMj:true → pencil objet fétiche visible sur l’onglet Équipement', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asMj) });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');

      await selectTab(fixture, 1);
      const pencilsOnEquipment = fixture.nativeElement.querySelectorAll(
        '.field-edit-pencil__button',
      );
      expect(pencilsOnEquipment.length).toBe(1);
    });

    it('propriétaire (isOwner:true) → seuls les 6 pencils narratifs visibles (pas attributs/fétiche/XP/arme, MJ-only)', async () => {
      const { fixture } = await createComponent();
      expect(fixture.nativeElement.querySelectorAll('.field-edit-pencil__button').length).toBe(6);
    });

    it('fellow player (ni propriétaire, ni MJ) → aucun pencil MJ visible', async () => {
      const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
      const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');
      expect(fixture.nativeElement.querySelectorAll('.field-edit-pencil__button').length).toBe(0);
    });

    it('submitFieldEdit() appelle setSheetField avec le bon path, met à jour character() avec result.character', async () => {
      const updated = {
        ...CHARACTER,
        viewerIsMj: true,
        sheetData: { ...CHARACTER.sheetData, fetiqueObject: 'un galet gravé' },
      };
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setSheetField: vi.fn().mockResolvedValue({ character: updated, warnings: [] }),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitFieldEdit('fetiqueObject', 'un galet gravé');
      fixture.detectChanges();

      expect(characterSvc.setSheetField).toHaveBeenCalledWith(
        'char1',
        'fetiqueObject',
        'un galet gravé',
      );
      expect(comp.character()).toEqual(updated);
    });

    it('submitFieldEdit() affiche les warnings non bloquants renvoyés par le serveur', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setSheetField: vi.fn().mockResolvedValue({
          character: asMj,
          warnings: ['Classe hors catalogue seedé'],
        }),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitFieldEdit('classId', 'classe-maison');
      fixture.detectChanges();

      expect(comp.fieldEditWarning()).toContain('Classe hors catalogue seedé');
    });

    it('submitFieldEdit() erreur réseau → fieldEditError() affiché', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setSheetField: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitFieldEdit('fetiqueObject', 'x');
      fixture.detectChanges();

      expect(comp.fieldEditError()).not.toBeNull();
    });

    it('submitXpEdit() appelle setXp, met à jour character()', async () => {
      const updated = { ...CHARACTER, viewerIsMj: true, xp: 500 };
      const asMj = { ...CHARACTER, viewerIsMj: true, xp: 10 };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setXp: vi.fn().mockResolvedValue(updated),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitXpEdit(500);
      fixture.detectChanges();

      expect(characterSvc.setXp).toHaveBeenCalledWith('char1', 500);
      expect(comp.character().xp).toBe(500);
    });

    it('submitXpEdit() erreur réseau → fieldEditError() affiché', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setXp: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitXpEdit(500);
      fixture.detectChanges();

      expect(comp.fieldEditError()).not.toBeNull();
    });
  });

  describe('champs narratifs et arme éditables (Story 6.7)', () => {
    it('MJ (viewerIsMj:true) → pencils narratifs appellent setSheetField avec le path narrative.<champ>', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setSheetField: vi.fn().mockResolvedValue({ character: asMj, warnings: [] }),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitFieldEdit('narrative.motivation', 'Nouvelle motivation');

      expect(characterSvc.setSheetField).toHaveBeenCalledWith(
        'char1',
        'narrative.motivation',
        'Nouvelle motivation',
      );
    });

    it('MJ → pencil arme appelle setSheetField avec le path weaponId', async () => {
      const asMj = { ...CHARACTER, viewerIsMj: true };
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(asMj),
        setSheetField: vi.fn().mockResolvedValue({ character: asMj, warnings: [] }),
      });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'mj-stranger');
      const comp = fixture.componentInstance as any;

      await comp.submitFieldEdit('weaponId', 'dague');

      expect(characterSvc.setSheetField).toHaveBeenCalledWith('char1', 'weaponId', 'dague');
    });

    it('propriétaire (isOwner:true, viewerIsMj:false) → pas de pencil arme (MJ-only, AC1)', async () => {
      const { fixture } = await createComponent();
      // Le pencil arme a l'aria-label "Modifier l'arme de prédilection" — absent pour le propriétaire.
      expect(
        fixture.nativeElement.querySelector(
          'button[aria-label="Modifier l\'arme de prédilection"]',
        ),
      ).toBeNull();
    });

    it('submitNarrativeFieldEdit() appelle characterSvc.updateNarrativeField (pas setSheetField), met à jour character()', async () => {
      const updated = {
        ...CHARACTER,
        sheetData: {
          ...CHARACTER.sheetData,
          narrative: { name: 'Fenn', homeTown: 'Aubval', motivation: 'Nouvelle motivation' },
        },
      };
      const characterSvc = makeCharacterService({
        updateNarrativeField: vi.fn().mockResolvedValue(updated),
      });
      const { fixture } = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      await comp.submitNarrativeFieldEdit('motivation', 'Nouvelle motivation');
      fixture.detectChanges();

      expect(characterSvc.updateNarrativeField).toHaveBeenCalledWith(
        'char1',
        'motivation',
        'Nouvelle motivation',
      );
      expect(characterSvc.setSheetField).not.toHaveBeenCalled();
      expect(comp.character()).toEqual(updated);
    });

    it('submitNarrativeFieldEdit() erreur réseau → fieldEditError() affiché', async () => {
      const characterSvc = makeCharacterService({
        updateNarrativeField: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const { fixture } = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      await comp.submitNarrativeFieldEdit('motivation', 'x');
      fixture.detectChanges();

      expect(comp.fieldEditError()).not.toBeNull();
    });

    it('ni propriétaire ni MJ → aucun pencil narratif/arme visible (AC3)', async () => {
      const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
      const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');

      expect(fixture.nativeElement.querySelectorAll('.field-edit-pencil__button').length).toBe(0);
    });
  });

  describe('Câblage temps réel (Story 20.1)', () => {
    it('connect() est appelé avec partieTopic(partieId) au montage (AC1)', async () => {
      const { realtimeSvc } = await createComponent();
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('disconnect() est appelé à la destruction du composant', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.destroy();
      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('une notification CharacterService.changed() recharge la fiche affichée (AC1)', async () => {
      const characterSvc = makeCharacterService();
      const { fixture } = await createComponent(characterSvc);
      characterSvc.get.mockResolvedValue({ ...CHARACTER, xp: 999 });

      characterSvc.changed.update((v) => v + 1);
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      const comp = fixture.componentInstance as any;
      expect(comp.character().xp).toBe(999);
    });

    it('garde firstRun : un changed() déjà non-nul au montage ne déclenche PAS de refetch redondant', async () => {
      // CharacterService est providedIn:'root' — son signal _changed peut déjà porter une valeur
      // non-nulle AVANT le montage (mutation locale antérieure dans la même session). Sans le
      // garde firstRun, ce cas déclencherait un refetch en plus de celui déjà fait par ngOnInit().
      // Contrairement à Story 19.2 (ScenarioEditor/ScenarioReadDialog rendent SeanceList, qui
      // contamine le comptage), CharacterSheet ne rend aucun enfant réagissant lui aussi à
      // CharacterService.changed — un compte exact de 1 est donc fiable ici.
      const characterSvc = makeCharacterService({ changed: signal(1) });
      const { fixture } = await createComponent(characterSvc);
      void fixture;

      expect(characterSvc.get.mock.calls.length).toBe(1);
    });

    it('un changed() survenant avant la résolution du fetch initial ne plante pas (garde if (!c) return)', async () => {
      let resolveGet!: (c: CharacterDto) => void;
      const characterSvc = makeCharacterService({
        get: vi.fn(() => new Promise<CharacterDto>((resolve) => (resolveGet = resolve))),
      });
      const dialog = { open: vi.fn() };
      const auth = { currentUser: signal<AuthUser | null>({ id: 'u1' } as AuthUser) };
      const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [CharacterSheet],
        providers: [
          { provide: CharacterService, useValue: characterSvc },
          { provide: MatDialog, useValue: dialog },
          { provide: AuthService, useValue: auth },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'p1' : 'char1') } },
            },
          },
          { provide: RealtimeService, useValue: realtimeSvc },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(CharacterSheet);
      fixture.detectChanges();
      // firstRun est consommé au premier flush de l'effect() — le fetch initial (get()) est
      // toujours en attente (resolveGet non appelé) à ce stade.
      await Promise.resolve();
      fixture.detectChanges();

      // Un événement temps réel survient PENDANT que this.character() est encore null — refreshCharacter()
      // doit no-op silencieusement (garde if (!c) return), pas planter.
      expect(() => characterSvc.changed.update((v) => v + 1)).not.toThrow();
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();

      resolveGet(CHARACTER);
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      const comp = fixture.componentInstance as any;
      expect(comp.character()).toEqual(CHARACTER);
    });
  });

  describe('Story 23.8 : cas particuliers de création par classe', () => {
    const CONTENT_23_8: GameSystemContentDto = {
      class: [
        {
          key: 'guerisseur',
          data: {
            label: 'Guérisseur',
            talents: [
              {
                id: 'soins',
                name: 'Soins',
                effect: { description: 'Soigne des PV', conditions: '-' },
              },
            ],
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
                effect: { description: "Talent emprunté d'une autre classe", conditions: '-' },
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
          key: 'ermite',
          data: {
            label: 'Ermite',
            talents: [
              {
                id: 'metamorphose',
                name: 'Métamorphose',
                effect: { description: 'Se transforme en animal', conditions: '-' },
              },
            ],
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
            talents: [
              {
                id: 'autorite',
                name: 'Autorité',
                effect: { description: 'Contrôle un monstre', conditions: '-' },
              },
            ],
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
            talents: [
              {
                id: 'climatophile',
                name: 'Climatophile',
                effect: { description: '+2 aux tests de climat favori', conditions: '-' },
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
      type: CONTENT['type'],
      attributePattern: CONTENT['attributePattern'],
      weaponCategory: CONTENT['weaponCategory'],
      weaponItem: CONTENT['weaponItem'],
      landscape: [
        { key: 'foret', data: { label: 'Forêt' } },
        { key: 'montagne', data: { label: 'Montagne' } },
      ],
    };

    function baseSheetData(classId: string, extra: Record<string, unknown> = {}) {
      return {
        classId,
        typeId: 'technique',
        weaponId: 'lance',
        attributes: { VIG: 8, AGI: 4, INT: 6, ESP: 6 },
        ...extra,
      };
    }

    it("Fermier + talent emprunté (Métier d'appoint) → nom du talent, effet, malus -1, classe d'origine", async () => {
      const character = makeCharacterDto({
        sheetData: baseSheetData('fermier', {
          classChoices: { 'fermier-metier-appoint': 'guerisseur:soins' },
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain("Talent emprunté (Métier d'appoint)");
      expect(text).toContain('Soins');
      expect(text).toContain('Guérisseur');
      expect(text).toContain('-1');
    });

    it('Ermite + Métamorphose → affiche le paysage choisi (résolu depuis le catalogue landscape)', async () => {
      const character = makeCharacterDto({
        sheetData: baseSheetData('ermite', {
          classChoices: { 'ermite-metamorphose': 'foret' },
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).toContain('Forêt');
    });

    it('Dresseur + Autorité → affiche le type de créature choisi (résolu depuis requiredChoices[].options)', async () => {
      const character = makeCharacterDto({
        sheetData: baseSheetData('dresseur', {
          classChoices: { 'dresseur-autorite': 'demons' },
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).toContain('Démons');
    });

    it('Météomancien + Climatophile (classCapabilities) → apparaît dans la section Paysage/climat favori existante', async () => {
      const character = makeCharacterDto({
        sheetData: baseSheetData('meteomancien', {
          classCapabilities: [{ type: 'landscape', params: { key: 'montagne' } }],
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).toContain('Montagne');
    });

    it('Aucun requiredChoices renseigné (classChoices absent) → aucune section de choix affichée, pas de crash', async () => {
      const character = makeCharacterDto({ sheetData: baseSheetData('fermier') });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).not.toContain("Métier d'appoint) Soins");
    });

    it('revue de code (2026-07-26) : classChoices malformé (talent introuvable) → aucun affichage trompeur (pas de malus avec nom vide)', async () => {
      const character = makeCharacterDto({
        sheetData: baseSheetData('fermier', {
          classChoices: { 'fermier-metier-appoint': 'guerisseur:talent-inexistant' },
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_8),
      });
      const { fixture } = await createComponent(characterSvc);

      const comp = fixture.componentInstance as any;
      expect(comp.classChoiceDisplays()).toEqual([]);
      expect(fixture.nativeElement.textContent).not.toContain('malus');
    });
  });

  describe('Story 23.9 : choix de magie à la création (type Magie)', () => {
    const CONTENT_23_9: GameSystemContentDto = {
      class: CONTENT['class'],
      type: [
        {
          key: 'magie',
          data: { label: 'Magie', advantages: [{ name: 'Volonté', effect: '+4 PE' }] },
        },
      ],
      attributePattern: CONTENT['attributePattern'],
      weaponCategory: CONTENT['weaponCategory'],
      weaponItem: CONTENT['weaponItem'],
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
            description: 'La main devient rouge et plus forte.',
          },
        },
        {
          key: 'cloche-alarme',
          data: {
            name: "Cloche d'alarme",
            magicType: 'rituelle',
            tier: 'debutant',
            peCost: 4,
            description: "Prévient en cas d'intrusion.",
          },
        },
      ],
    };

    function magieSheetData(extra: Record<string, unknown> = {}) {
      return {
        classId: 'menestrel',
        typeId: 'magie',
        weaponId: 'lance',
        attributes: { VIG: 8, AGI: 4, INT: 6, ESP: 6 },
        ...extra,
      };
    }

    it('typeId "magie" + magicSeason/knownRitualSpells renseignés → affiche la saison et les 2 sorts (labels résolus)', async () => {
      const character = makeCharacterDto({
        sheetData: magieSheetData({
          magicSeason: 'printemps',
          knownRitualSpells: ['benediction-main-rouge', 'cloche-alarme'],
        }),
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_9),
      });
      const { fixture } = await createComponent(characterSvc);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Printemps');
      expect(text).toContain('Bénédiction de la main rouge');
      expect(text).toContain("Cloche d'alarme");
    });

    it('typeId différent de "magie" → aucune section Magie affichée', async () => {
      const character = makeCharacterDto({
        sheetData: {
          classId: 'menestrel',
          typeId: 'attaque',
          weaponId: 'lance',
          attributes: { VIG: 8, AGI: 4, INT: 6, ESP: 6 },
        },
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_9),
      });
      const { fixture } = await createComponent(characterSvc);

      const comp = fixture.componentInstance as any;
      expect(comp.magicData()).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Sorts de magie rituelle connus');
    });

    it('typeId "magie" mais magicSeason absent (personnage créé avant cette story) → pas d’affichage trompeur, pas de crash', async () => {
      const character = makeCharacterDto({ sheetData: magieSheetData() });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_23_9),
      });
      const { fixture } = await createComponent(characterSvc);

      const comp = fixture.componentInstance as any;
      expect(comp.magicData()).toBeNull();
    });
  });

  describe('Story 24.1 : attributePatternLabel générique sur 3 profils (Équilibré/Polyvalent/Spécialiste)', () => {
    const CONTENT_24_1: GameSystemContentDto = {
      ...CONTENT,
      attributePattern: [
        { key: 'equilibre', data: { label: 'Équilibré', values: [6, 6, 6, 6] } },
        { key: 'polyvalent', data: { label: 'Polyvalent', values: [8, 4, 6, 6] } },
        { key: 'specialiste', data: { label: 'Spécialiste', values: [4, 4, 8, 8] } },
      ],
    };

    it('résout "Spécialiste" (pas seulement "Polyvalent") pour des attributs [4,4,8,8]', async () => {
      const character = makeCharacterDto({
        sheetData: {
          ...CHARACTER.sheetData,
          attributes: { AGI: 4, ESP: 4, INT: 8, VIG: 8 },
        },
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_24_1),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).toContain('patron Spécialiste');
    });

    it('résout "Équilibré" pour des attributs [6,6,6,6]', async () => {
      const character = makeCharacterDto({
        sheetData: {
          ...CHARACTER.sheetData,
          attributes: { AGI: 6, ESP: 6, INT: 6, VIG: 6 },
        },
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_24_1),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).toContain('patron Équilibré');
    });

    it('correctif de revue : un seul sous-champ verrouillé (attributes.ESP) supprime le suffixe « patron », jamais un rapprochement erroné', async () => {
      const character = makeCharacterDto({
        sheetData: {
          ...CHARACTER.sheetData,
          attributes: { AGI: 4, ESP: 4, INT: 8, VIG: 8 },
        },
        hiddenFields: ['attributes.ESP'],
      });
      const characterSvc = makeCharacterService({
        get: vi.fn().mockResolvedValue(character),
        getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_24_1),
      });
      const { fixture } = await createComponent(characterSvc);

      expect(fixture.nativeElement.textContent).not.toContain('patron Spécialiste');
      expect(fixture.nativeElement.textContent).not.toContain('patron ');
    });
  });

  describe('CharacterSheet — sous-navigation locale (Story 29.5)', () => {
    it('propriétaire → 4 onglets (Fiche, Équipement, Journal, Historique)', async () => {
      const { fixture } = await createComponent();
      const labels = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"] .mdc-tab__text-label'),
      ).map((el: any) => el.textContent.trim());
      expect(labels).toEqual([
        'Fiche',
        GRIMOIRE_TONE['evolution.inventory_section_title'],
        'Journal de notes',
        'Historique',
      ]);
    });

    it("fellow player (ni propriétaire, ni MJ) → 3 onglets, l'onglet Historique est absent du DOM (pas seulement vide)", async () => {
      const asFellowPlayer = { ...CHARACTER, viewerIsMj: false };
      const characterSvc = makeCharacterService({ get: vi.fn().mockResolvedValue(asFellowPlayer) });
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'joueur-tiers');

      const labels = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"] .mdc-tab__text-label'),
      ).map((el: any) => el.textContent.trim());
      expect(labels).toEqual([
        'Fiche',
        GRIMOIRE_TONE['evolution.inventory_section_title'],
        'Journal de notes',
      ]);
      expect(fixture.nativeElement.textContent).not.toContain('Historique');
    });

    it("changer d'onglet ne recharge pas la fiche ni ne perd le contexte courant (characterId, partieId)", async () => {
      const characterSvc = makeCharacterService();
      const { fixture } = await createComponent(characterSvc, 'char1', null, 'u1', 'p1');
      const component = fixture.componentInstance as unknown as {
        character: () => { id: string } | null;
      };
      const characterBefore = component.character();
      const getCallsBefore = (characterSvc.get as ReturnType<typeof vi.fn>).mock.calls.length;

      await selectTab(fixture, 1);
      await selectTab(fixture, 2);

      expect(component.character()).toBe(characterBefore); // même référence, pas un rechargement
      expect((characterSvc.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(getCallsBefore);
    });

    it("l'onglet actif est distingué autrement que par la seule couleur (soulignement Material natif, même principe qu'AC3 de la Story 29.3)", async () => {
      const { fixture } = await createComponent();
      await selectTab(fixture, 1);

      const activeTab = fixture.nativeElement.querySelector('[role="tab"][aria-selected="true"]');
      expect(activeTab).not.toBeNull();
      expect(activeTab.querySelector('.mdc-tab-indicator')).not.toBeNull();
    });

    // Retouche UX de PartieDetail (2026-09-23) : même correctif dynamicHeight que partie-detail.html
    // -- non-régression sur ce 2ᵉ (et dernier) consommateur de mat-tab-group de l'app.
    it("mat-tab-group porte dynamicHeight -- la molette défile toute la page plutôt qu'un scroll interne à l'onglet actif", async () => {
      const { fixture } = await createComponent();

      const tabGroup = fixture.debugElement.query(By.directive(MatTabGroup))?.componentInstance as
        MatTabGroup | undefined;
      expect(tabGroup).toBeTruthy();
      expect(tabGroup!.dynamicHeight).toBe(true);
    });
  });

  // ── Story 31.3 — aide contextuelle sur les termes de règle (FR-19) ──────────────────────────

  describe('aide contextuelle sur les termes de règle', () => {
    /** Même contenu que `CONTENT`, mais les termes portent le texte explicatif du catalogue. */
    const CONTENT_WITH_HELP: GameSystemContentDto = {
      ...CONTENT,
      class: [
        {
          key: 'menestrel',
          data: {
            label: 'Ménestrel',
            description: 'Le ménestrel voyage de village en village et connaît mille histoires.',
            talents: [{ name: 'Légendes', effect: { description: '...', conditions: '-' } }],
          },
        },
      ],
      type: [
        {
          key: 'technique',
          data: {
            label: 'Technique',
            description: 'Le technique résout les difficultés par la précision du geste.',
            advantages: [{ name: 'Précision', effect: '+2' }],
          },
        },
      ],
      weaponCategory: [
        {
          key: 'lance',
          data: {
            label: 'Lance',
            description: 'Arme d’hast tenue à deux mains, allonge supérieure.',
            touchFormula: 'VIG+AGI',
            damageFormula: 'VIG+1',
          },
        },
      ],
    };

    function withHelp() {
      return createComponent(
        makeCharacterService({
          getGameSystemContent: vi.fn().mockResolvedValue(CONTENT_WITH_HELP),
        }),
      );
    }

    function triggerNamed(fixture: ComponentFixture<CharacterSheet>, name: string) {
      const triggers: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.sheet__detail-trigger'),
      );
      return triggers.find((b) => b.textContent?.trim() === name);
    }

    function panelText(fixture: ComponentFixture<CharacterSheet>) {
      const panel = fixture.nativeElement.querySelector('.detail-surface-panel');
      return {
        title: panel?.querySelector('.detail-surface-title')?.textContent ?? '',
        body: panel?.querySelector('.detail-surface-body')?.textContent ?? '',
      };
    }

    it('AC1 — activer la classe ouvre sa description de catalogue dans la surface', async () => {
      const { fixture } = await withHelp();
      triggerNamed(fixture, 'Ménestrel')!.click();
      fixture.detectChanges();

      expect(panelText(fixture).title).toContain('Ménestrel');
      expect(panelText(fixture).body).toContain('de village en village');
    });

    it('AC1 — activer le type/voie ouvre sa description de catalogue', async () => {
      const { fixture } = await withHelp();
      triggerNamed(fixture, 'Technique')!.click();
      fixture.detectChanges();

      expect(panelText(fixture).title).toContain('Technique');
      expect(panelText(fixture).body).toContain('précision du geste');
    });

    it('AC1 — activer la catégorie d’arme ouvre sa description (absente de ResolvedWeapon)', async () => {
      const { fixture } = await withHelp();
      triggerNamed(fixture, 'Lance')!.click();
      fixture.detectChanges();

      expect(panelText(fixture).title).toContain('Lance');
      expect(panelText(fixture).body).toContain('Arme d’hast');
    });

    it('[Review][Patch] le nom d’arme se rend sans espace parasite autour des parenthèses', async () => {
      // Régression : un @if/@else scindant littéralement "(" et ")" autour du bloc de contrôle
      // rendait " Lance ( Lance ) " au lieu de "Lance (Lance)". La parenthèse doit rester à
      // l'intérieur de chaque branche — ce test verrouille l'absence d'espace À L'INTÉRIEUR des
      // parenthèses (le seul qui ne se referme pas par la fusion d'espaces du navigateur).
      const { fixture } = await withHelp();
      const text = fixture.nativeElement.querySelector('.sheet__weapon-name')!
        .textContent as string;
      expect(text).not.toContain('( ');
      expect(text).not.toContain(' )');
      expect(text.replace(/\s+/g, ' ').trim()).toContain('Lance (Lance)');
    });

    it('AC2 — le texte vient du catalogue : sans entrée de contenu, aucun texte n’apparaît', async () => {
      // Le service de thème du harnais ne porte AUCUN texte de règle (P8-AD-9) : si l’aide
      // s’affichait malgré un catalogue muet, c’est qu’elle aurait été écrite en dur quelque part.
      const { fixture } = await createComponent();
      expect(triggerNamed(fixture, 'Ménestrel')).toBeUndefined();
      expect(fixture.nativeElement.textContent).not.toContain('de village en village');
    });

    it('AC3 — un terme sans texte au catalogue ne rend AUCUN déclencheur', async () => {
      const { fixture } = await createComponent();

      expect(triggerNamed(fixture, 'Ménestrel')).toBeUndefined();
      expect(triggerNamed(fixture, 'Technique')).toBeUndefined();
      expect(triggerNamed(fixture, 'Lance')).toBeUndefined();
      // ...et le libellé reste bien affiché, seul le geste disparaît.
      const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
      expect(text).toContain('Vocation — Ménestrel');
      expect(text).toContain('Voie — Technique');
    });

    it('AC3 — la spécialité (texte libre du joueur) n’est jamais un déclencheur', async () => {
      const artisan: GameSystemContentDto = {
        ...CONTENT_WITH_HELP,
        class: [
          {
            key: 'artisan',
            data: {
              label: 'Artisan',
              description: 'L’artisan façonne et répare.',
              requiresSpecialty: true,
              specialtyLabel: 'Type d’objet de spécialité',
              talents: [],
            },
          },
        ],
      };
      const character = {
        ...CHARACTER,
        sheetData: { ...CHARACTER.sheetData, classId: 'artisan', specialtyTypeId: 'poterie' },
      };
      const { fixture } = await createComponent(
        makeCharacterService({
          get: vi.fn().mockResolvedValue(character),
          getGameSystemContent: vi.fn().mockResolvedValue(artisan),
        }),
      );

      expect(fixture.nativeElement.textContent).toContain('poterie');
      expect(triggerNamed(fixture, 'poterie')).toBeUndefined();
    });

    it('AC4 — les déclencheurs de termes sont de vrais boutons, atteignables au clavier', async () => {
      const { fixture } = await withHelp();
      const trigger = triggerNamed(fixture, 'Ménestrel')!;

      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('type')).toBe('button');
      expect(trigger.tabIndex).not.toBe(-1);
    });

    it('AC5 — activer un second terme remplace le contenu, sans empiler de panneau', async () => {
      const { fixture } = await withHelp();
      triggerNamed(fixture, 'Ménestrel')!.click();
      fixture.detectChanges();
      triggerNamed(fixture, 'Technique')!.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.detail-surface-panel').length).toBe(1);
      expect(panelText(fixture).title).toContain('Technique');
    });

    it('AC6 — fermer rend le focus au déclencheur du terme', async () => {
      const { fixture } = await withHelp();
      const trigger = triggerNamed(fixture, 'Ménestrel')!;
      trigger.focus();
      trigger.click();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
