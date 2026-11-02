import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import type {
  AuthUser,
  MyCharacterDto,
  MyHommeDragonDto,
  PartieDto,
  PartySignalsDto,
} from '@master-jdr/shared';
import { MyCharacters } from './my-characters';
import { CharacterService } from '../../../core/characters/character.service';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountService } from '../../../core/account/account.service';
import { PartySignalsService } from '../../../core/parties/party-signals.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';

function makeMyCharacter(overrides: Partial<MyCharacterDto> = {}): MyCharacterDto {
  return {
    ...makeCharacterDto({ sheetData: { narrative: { name: overrides.id ?? 'Fenn' } } }),
    partieId: 'p1',
    partieName: 'La Forêt Noire',
    classLabel: null,
    typeLabel: null,
    groupRoleLabel: null,
    ...overrides,
  };
}

function makeDragon(overrides: Partial<MyHommeDragonDto> = {}): MyHommeDragonDto {
  return {
    id: 'hd1',
    aventures: [{ partieId: 'p9', nom: 'Le Convoi du Nord' }],
    gameSystemId: 'ryuutama',
    nom: 'Skarn',
    race: 'DRAGON_VERT',
    createdAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'p1',
    name: 'La Forêt Noire',
    kind: 'ONE_SHOT',
    gameSystemId: 'ryuutama',
    description: null,
    ownerId: 'mj1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'player',
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: null,
    ...overrides,
  };
}

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'u1@test.fr',
    pseudo: 'u1',
    displayName: 'U1',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [],
    ...overrides,
  };
}

function makeAccountService() {
  return { updatePreferences: vi.fn().mockResolvedValue(undefined) };
}

function makePartySignalsService(signalsMap: Map<string, PartySignalsDto> = new Map()) {
  return {
    signals: signal(signalsMap),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMyPartiesService(parties: PartieDto[] = []) {
  return { allParties: signal(parties) };
}

async function createFixture(
  list: MyCharacterDto[] = [],
  authUserOverrides: Partial<AuthUser> = {},
  accountSvc = makeAccountService(),
  options: {
    partySignalsSvc?: ReturnType<typeof makePartySignalsService>;
    parties?: PartieDto[];
    hommesDragons?: MyHommeDragonDto[];
    hommesDragonsRejects?: boolean;
  } = {},
) {
  const characterService = {
    listMine: vi.fn().mockResolvedValue(list),
  };
  const hommeDragonSvc = {
    listMine: options.hommesDragonsRejects
      ? vi.fn().mockRejectedValue(new Error('500'))
      : vi.fn().mockResolvedValue(options.hommesDragons ?? []),
  };
  const authSvc = { currentUser: signal(makeAuthUser(authUserOverrides)) };
  const partySignalsSvc = options.partySignalsSvc ?? makePartySignalsService();
  const myPartiesSvc = makeMyPartiesService(options.parties ?? []);
  await TestBed.configureTestingModule({
    imports: [MyCharacters],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: CharacterService, useValue: characterService },
      { provide: HommeDragonService, useValue: hommeDragonSvc },
      {
        provide: ThemeToneService,
        useValue: {
          tone: signal(TONE_MAP['grimoire-emeraude']),
          activeTheme: signal('grimoire-emeraude'),
        },
      },
      { provide: AuthService, useValue: authSvc },
      { provide: AccountService, useValue: accountSvc },
      { provide: PartySignalsService, useValue: partySignalsSvc },
      { provide: MyPartiesService, useValue: myPartiesSvc },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MyCharacters);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return {
    fixture,
    characterService,
    hommeDragonSvc,
    authSvc,
    accountSvc,
    partySignalsSvc,
    myPartiesSvc,
  };
}

describe('MyCharacters (Story 29.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('charge la liste au montage via listMine() (AC1)', async () => {
    const { characterService } = await createFixture([makeMyCharacter({ id: 'c1' })]);
    expect(characterService.listMine).toHaveBeenCalledTimes(1);
  });

  it('affiche tous les personnages, toutes parties confondues (AC1)', async () => {
    const { fixture } = await createFixture([
      makeMyCharacter({ id: 'c1', partieId: 'p1', partieName: 'La Forêt Noire' }),
      makeMyCharacter({ id: 'c2', partieId: 'p2', partieName: 'Le Donjon Oublié' }),
    ]);

    const cards = fixture.nativeElement.querySelectorAll('.character-summary-card');
    expect(cards.length).toBe(2);
  });

  it('liste vide → message vide, aucune carte (AC2 : jamais de mélange avec un autre type de liste)', async () => {
    const { fixture } = await createFixture([]);

    expect(fixture.nativeElement.querySelector('.character-summary-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
  });

  it('le nom du personnage (convention épic 28) et le nom de la Partie sont affichés (AC3)', async () => {
    const { fixture } = await createFixture([
      makeMyCharacter({
        id: 'c1',
        sheetData: { narrative: { name: 'Ombreflèche' } },
        partieName: 'La Forêt Noire',
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ombreflèche');
    expect(text).toContain('La Forêt Noire');
  });

  it('la recherche filtre la liste en direct, sans mélanger avec les personnages non correspondants (AC4)', async () => {
    const { fixture } = await createFixture([
      makeMyCharacter({ id: 'c1', sheetData: { narrative: { name: 'Ombreflèche' } } }),
      makeMyCharacter({ id: 'c2', sheetData: { narrative: { name: 'Fenn' } } }),
    ]);

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.list-control-bar__search input',
    );
    input.value = 'ombre';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ombreflèche');
    expect(text).not.toContain('Fenn');
  });

  it('recherche sans résultat → message dédié, distinct du message « aucun personnage »', async () => {
    const { fixture } = await createFixture([
      makeMyCharacter({ id: 'c1', sheetData: { narrative: { name: 'Ombreflèche' } } }),
    ]);

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.list-control-bar__search input',
    );
    input.value = 'zzz-introuvable';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.character-summary-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
  });

  it('clic sur une carte navigue vers /parties/:partieId/characters/:id', async () => {
    const { fixture } = await createFixture([makeMyCharacter({ id: 'c1', partieId: 'p1' })]);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.nativeElement.querySelector('.character-summary-card') as HTMLButtonElement).click();

    expect(navigateSpy).toHaveBeenCalledWith(['/parties', 'p1', 'characters', 'c1']);
  });
});

describe('MyCharacters — tri, mode d’affichage (Story 29.9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("changer le tri appelle AccountService.updatePreferences({ charactersSort }) et réordonne l'affichage", async () => {
    const { fixture, accountSvc } = await createFixture(
      [
        makeMyCharacter({ id: 'c1', sheetData: { narrative: { name: 'Zebre' } } }),
        makeMyCharacter({ id: 'c2', sheetData: { narrative: { name: 'Abbaye' } } }),
      ],
      { charactersSort: 'partie' },
    );

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '.list-control-bar__fields select',
    );
    select.value = 'nom';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({ charactersSort: 'nom' });
    const names = Array.from(
      fixture.nativeElement.querySelectorAll('.character-summary-card__name'),
    ).map((el: any) => el.textContent?.trim());
    expect(names).toEqual(['Abbaye Niv. 1', 'Zebre Niv. 1']);
  });

  it("bascule de mode d'affichage appelle AccountService.updatePreferences({ charactersViewMode }) et change la classe CSS de la liste", async () => {
    const { fixture, accountSvc } = await createFixture([makeMyCharacter({ id: 'c1' })]);

    const modeButtons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.list-control-bar__mode');
    modeButtons[0].click(); // 'large'
    fixture.detectChanges();
    await fixture.whenStable();

    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({ charactersViewMode: 'large' });
    expect(fixture.nativeElement.querySelector('.list--large')).not.toBeNull();
  });

  it('aucune pastille de résumé jamais affichée (AC6 — aucun réglage transitoire sur cet écran)', async () => {
    const { fixture } = await createFixture([makeMyCharacter({ id: 'c1' })]);

    expect(fixture.nativeElement.querySelector('.list-control-bar__reset')).toBeNull();
  });
});

// Aucune spec ne différenciait grand de moyen pour les personnages (EXPERIENCE.md:107 impose
// seulement de transposer la grammaire de la liste des parties) : le mode grand est celui qui
// porte les stats dérivées, décision prise avec l'utilisateur.
describe('MyCharacters — ce qui distingue les 3 modes (Story 29.9, AC1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('mode grand → les stats dérivées sont affichées', async () => {
    const { fixture } = await createFixture([makeMyCharacter({ id: 'c1' })], {
      charactersViewMode: 'large',
    });

    expect(fixture.nativeElement.querySelector('.stat-pill')).not.toBeNull();
  });

  it('modes moyen et liste → aucune stat dérivée', async () => {
    for (const mode of ['medium', 'compact'] as const) {
      const { fixture } = await createFixture([makeMyCharacter({ id: 'c1' })], {
        charactersViewMode: mode,
      });
      expect(fixture.nativeElement.querySelector('.stat-pill')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('mode liste → classe et partie conservées en une sous-ligne (retour utilisateur)', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'c1', classLabel: 'Marchand', partieName: 'La Forêt Noire' })],
      { charactersViewMode: 'compact' },
    );

    const sub = fixture.nativeElement.querySelector('.character-summary-card__compact-sub');
    expect(sub.textContent.trim()).toBe('Marchand · La Forêt Noire');
  });
});

describe('MyCharacters — bandeau contextuel (Story 29.4)', () => {
  it("ngOnInit() renseigne ContextualNavService avec le titre de l'écran", async () => {
    await createFixture([]);

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe(TONE_MAP['grimoire-emeraude']['my_characters.title']);
  });
});

describe('MyCharacters — section de création « À forger » (Story 29.16)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ngOnInit() appelle partySignalsService.refresh() (rafraîchit les signaux à l’activation de la route)', async () => {
    const { partySignalsSvc } = await createFixture([]);

    expect(partySignalsSvc.refresh).toHaveBeenCalledTimes(1);
  });

  it('aucun signal PERSONNAGE_A_CREER → section absente (ni titre ni cadre)', async () => {
    const { fixture } = await createFixture(
      [],
      {},
      makeAccountService(),
      { parties: [makePartie({ id: 'p1' })] },
    );

    expect(fixture.nativeElement.querySelector('.character-creation-entries')).toBeNull();
  });

  it('un signal PERSONNAGE_A_CREER pour une partie → une ligne, croisée avec allParties() pour nom et gameSystemId', async () => {
    const signalsMap = new Map<string, PartySignalsDto>([
      ['p1', { role: 'player', status: 'EN_COURS', signals: ['PERSONNAGE_A_CREER'] }],
    ]);
    const { fixture } = await createFixture(
      [],
      {},
      makeAccountService(),
      {
        partySignalsSvc: makePartySignalsService(signalsMap),
        parties: [makePartie({ id: 'p1', name: 'Le Convoi du Nord', gameSystemId: 'ryuutama' })],
      },
    );

    const row: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.character-creation-entries__row',
    );
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Créer un voyageur pour Le Convoi du Nord');
    expect(row.getAttribute('href')).toContain('/parties/p1/characters/new');
    expect(row.getAttribute('href')).toContain('gameSystemId=ryuutama');
  });

  it('une partie sans signal PERSONNAGE_A_CREER (MJ, système sans module, terminée…) ne produit aucune ligne', async () => {
    const signalsMap = new Map<string, PartySignalsDto>([
      ['p1', { role: 'mj', status: 'EN_COURS', signals: ['AUCUN_MEMBRE_INVITE'] }],
    ]);
    const { fixture } = await createFixture(
      [],
      {},
      makeAccountService(),
      {
        partySignalsSvc: makePartySignalsService(signalsMap),
        parties: [makePartie({ id: 'p1' })],
      },
    );

    expect(fixture.nativeElement.querySelector('.character-creation-entries')).toBeNull();
  });

  it('section rendue + liste de personnages vide → message my_characters.empty_with_entries (pas my_characters.empty)', async () => {
    const signalsMap = new Map<string, PartySignalsDto>([
      ['p1', { role: 'player', status: 'EN_COURS', signals: ['PERSONNAGE_A_CREER'] }],
    ]);
    const { fixture } = await createFixture(
      [],
      {},
      makeAccountService(),
      {
        partySignalsSvc: makePartySignalsService(signalsMap),
        parties: [makePartie({ id: 'p1' })],
      },
    );

    const empty = fixture.nativeElement.querySelector('.empty');
    expect(empty.textContent.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['my_characters.empty_with_entries'],
    );
  });

  it('liste de personnages vide sans aucune ligne éligible → message my_characters.empty d’origine', async () => {
    const { fixture } = await createFixture([]);

    const empty = fixture.nativeElement.querySelector('.empty');
    expect(empty.textContent.trim()).toBe(TONE_MAP['grimoire-emeraude']['my_characters.empty']);
  });

  it('refresh() encore en vol : reste sur my_characters.empty (pas de clignotement) même si listMine() a déjà résolu et qu’une ligne serait éligible', async () => {
    let resolveRefresh!: () => void;
    const pendingRefresh = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    const signalsMap = new Map<string, PartySignalsDto>([
      ['p1', { role: 'player', status: 'EN_COURS', signals: ['PERSONNAGE_A_CREER'] }],
    ]);
    const partySignalsSvc = {
      signals: signal(signalsMap),
      refresh: vi.fn().mockReturnValue(pendingRefresh),
    };
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      partySignalsSvc,
      parties: [makePartie({ id: 'p1' })],
    });

    // listMine() (résolu par createFixture) est déjà arrivé, mais refresh() est toujours en vol.
    expect(fixture.nativeElement.querySelector('.empty').textContent.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['my_characters.empty'],
    );

    resolveRefresh();
    // Même patron que createFixture() ci-dessus : plusieurs tours de microtâches plutôt qu'un
    // nombre codé en dur, insensible à la profondeur exacte de la chaîne `.finally()`.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(fixture.nativeElement.querySelector('.empty').textContent.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['my_characters.empty_with_entries'],
    );
  });
});

describe('MyCharacters — Hommes Dragons (Story 33.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Nom seul : le marqueur « Homme Dragon » des cartes de dragon est lu à part, il ne doit pas
  // se coller au nom.
  const firstWords = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll('.character-summary-card__name')).map(
      (el) =>
        el.querySelector('.identity-label__name')?.textContent?.trim() ??
        el.textContent?.trim().split(/\s+/)[0],
    );

  it('une seule lecture /me/homme-dragons, en parallèle de celle des personnages', async () => {
    const { hommeDragonSvc, characterService } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [makeDragon()],
    });

    expect(hommeDragonSvc.listMine).toHaveBeenCalledTimes(1);
    expect(characterService.listMine).toHaveBeenCalledTimes(1);
  });

  it('MJ avec 2 dragons : 2 cartes marquées « Homme Dragon », chacune avec sa partie', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [
        makeDragon({
          id: 'hd1',
          aventures: [{ partieId: 'p1', nom: 'Le Convoi du Nord' }],
          nom: 'Skarn',
        }),
        makeDragon({
          id: 'hd2',
          aventures: [{ partieId: 'p2', nom: 'Le Ballet des Braises' }],
          nom: 'Ignis',
        }),
      ],
    });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.character-summary-card').length).toBe(2);
    expect(el.querySelectorAll('.nature-marker').length).toBe(2);
    const text = el.textContent ?? '';
    expect(text).toContain('Le Convoi du Nord');
    expect(text).toContain('Le Ballet des Braises');
  });

  it('dragons et personnages dans la même liste, même grille', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'c1', partieName: 'Abbaye' })],
      {},
      makeAccountService(),
      { hommesDragons: [makeDragon({ aventures: [{ partieId: 'p2', nom: 'Zéphyr' }] })] },
    );

    const cards = fixture.nativeElement.querySelectorAll('.list > app-character-summary-card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.nature-marker').length).toBe(1);
  });

  it('un dragon seul suffit à ne pas afficher le message de liste vide', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [makeDragon()],
    });

    expect(fixture.nativeElement.querySelector('.empty')).toBeNull();
  });

  it('mode liste : marqueur en icône seule avec aria-label', async () => {
    const { fixture } = await createFixture(
      [],
      { charactersViewMode: 'compact' },
      makeAccountService(),
      { hommesDragons: [makeDragon()] },
    );
    const marker = fixture.nativeElement.querySelector('.nature-marker');

    expect(marker.getAttribute('aria-label')).toBe('Homme Dragon');
    expect(fixture.nativeElement.querySelector('.nature-marker__label')).toBeNull();
  });

  it('recherche sur le nom du dragon : retenu ; personnage non correspondant : écarté', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'Fenn' })],
      {},
      makeAccountService(),
      { hommesDragons: [makeDragon({ nom: 'Skarn' })] },
    );
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.list-control-bar__search input',
    );
    input.value = 'skar';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(firstWords(fixture)).toEqual(['Skarn']);
  });

  it('tri « Niveau » : les dragons passent après tous les personnages', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'Bas', level: 1 }), makeMyCharacter({ id: 'Haut', level: 9 })],
      { charactersSort: 'niveau' },
      makeAccountService(),
      { hommesDragons: [makeDragon({ nom: 'Skarn' })] },
    );

    expect(firstWords(fixture)).toEqual(['Haut', 'Bas', 'Skarn']);
  });

  it('tri « Nom » : les deux natures confondues', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'Zorn' })],
      { charactersSort: 'nom' },
      makeAccountService(),
      { hommesDragons: [makeDragon({ nom: 'Ambre' })] },
    );

    expect(firstWords(fixture)).toEqual(['Ambre', 'Zorn']);
  });

  it('clic sur un dragon navigue vers sa fiche /homme-dragons/:id (AD-23)', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [makeDragon({ id: 'hd7' })],
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.nativeElement.querySelector('.character-summary-card') as HTMLButtonElement).click();

    expect(navigateSpy).toHaveBeenCalledWith(['/homme-dragons', 'hd7']);
  });

  it('un Homme Dragon à deux aventures : UNE seule carte, les noms joints (Story 33.8)', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [
        makeDragon({
          aventures: [
            { partieId: 'p1', nom: 'Les Vents du Nord' },
            { partieId: 'p2', nom: "L'Archipel" },
          ],
        }),
      ],
    });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.character-summary-card').length).toBe(1);
    expect(el.querySelector('.character-summary-card__partie')?.textContent?.trim()).toBe(
      "Les Vents du Nord · L'Archipel",
    );
  });

  it('un Homme Dragon sans aventure : carte présente, « Sans aventure » lisible, la fiche s’ouvre (Story 33.8)', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [makeDragon({ id: 'hdSans', aventures: [] })],
    });
    const el: HTMLElement = fixture.nativeElement;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(el.querySelector('.character-summary-card__partie')?.textContent?.trim()).toBe(
      'Sans aventure',
    );
    (el.querySelector('.character-summary-card') as HTMLButtonElement).click();
    expect(navigateSpy).toHaveBeenCalledWith(['/homme-dragons', 'hdSans']);
  });

  it('race inconnue (ligne ancienne) : la carte s’affiche sans libellé de race ni erreur', async () => {
    const { fixture } = await createFixture([], {}, makeAccountService(), {
      hommesDragons: [makeDragon({ race: 'DRAGON_INCONNU' as never })],
    });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.character-summary-card').length).toBe(1);
    expect(el.querySelector('.character-summary-card__class')).toBeNull();
  });

  it('échec de la lecture des dragons : les personnages restent affichés, message discret, pas de page vide', async () => {
    const { fixture } = await createFixture(
      [makeMyCharacter({ id: 'c1' })],
      {},
      makeAccountService(),
      { hommesDragonsRejects: true },
    );
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.character-summary-card').length).toBe(1);
    expect(el.querySelector('.notice[role="status"]')).not.toBeNull();
  });

  it('aucun échec → aucun message d’erreur', async () => {
    const { fixture } = await createFixture([makeMyCharacter({ id: 'c1' })]);

    expect(fixture.nativeElement.querySelector('.notice')).toBeNull();
  });

  describe('lignes « Créer un Homme Dragon pour … »', () => {
    const signalsFor = (partieId: string, signals: PartySignalsDto['signals']) =>
      makePartySignalsService(new Map([[partieId, { role: 'mj', status: 'EN_COURS', signals }]]));

    it('partie Ryuutama dont je suis MJ avec le signal → ligne vers la route du dragon', async () => {
      const { fixture } = await createFixture([], {}, makeAccountService(), {
        partySignalsSvc: signalsFor('p1', ['HOMME_DRAGON_A_CREER']),
        parties: [makePartie({ id: 'p1', name: 'Le Convoi du Nord', role: 'mj' })],
      });

      const row: HTMLAnchorElement = fixture.nativeElement.querySelector(
        '.character-creation-entries__row',
      );
      expect(row.textContent).toContain('Créer un Homme Dragon pour Le Convoi du Nord');
      expect(row.getAttribute('href')).toBe('/parties/p1/homme-dragon');
    });

    it('le filtre Ryuutama est celui du serveur (AD-23) : le signal suffit, le front ne le recalcule plus', async () => {
      const { fixture } = await createFixture([], {}, makeAccountService(), {
        partySignalsSvc: signalsFor('p1', ['HOMME_DRAGON_A_CREER']),
        parties: [makePartie({ id: 'p1', gameSystemId: 'draconis', role: 'mj' })],
      });

      expect(
        fixture.nativeElement.querySelector('.character-creation-entries__row')?.textContent,
      ).toContain('Créer un Homme Dragon pour');
    });

    it('signal absent (dragon déjà créé, partie terminée) → aucune ligne', async () => {
      const { fixture } = await createFixture([], {}, makeAccountService(), {
        partySignalsSvc: signalsFor('p1', ['AUCUN_MEMBRE_INVITE']),
        parties: [makePartie({ id: 'p1', role: 'mj' })],
      });

      expect(fixture.nativeElement.querySelector('.character-creation-entries')).toBeNull();
    });

    it('aucun élément mais une ligne de création → message empty_with_entries', async () => {
      const { fixture } = await createFixture([], {}, makeAccountService(), {
        partySignalsSvc: signalsFor('p1', ['HOMME_DRAGON_A_CREER']),
        parties: [makePartie({ id: 'p1', role: 'mj' })],
      });

      expect(fixture.nativeElement.querySelector('.empty').textContent.trim()).toBe(
        TONE_MAP['grimoire-emeraude']['my_characters.empty_with_entries'],
      );
    });

    it('deux aventures Ryuutama sans dragon → deux lignes, une par aventure', async () => {
      const { fixture } = await createFixture([], {}, makeAccountService(), {
        partySignalsSvc: makePartySignalsService(
          new Map<string, PartySignalsDto>([
            ['p1', { role: 'mj', status: 'EN_COURS', signals: ['HOMME_DRAGON_A_CREER'] }],
            ['p2', { role: 'mj', status: 'EN_COURS', signals: ['HOMME_DRAGON_A_CREER'] }],
          ]),
        ),
        parties: [
          makePartie({ id: 'p1', role: 'mj' }),
          makePartie({ id: 'p2', name: 'Le Ballet des Braises', role: 'mj' }),
        ],
      });

      expect(fixture.nativeElement.querySelectorAll('.character-creation-entries__row').length).toBe(
        2,
      );
    });
  });
});
