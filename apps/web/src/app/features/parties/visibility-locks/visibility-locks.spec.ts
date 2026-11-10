import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { GameSystemSchemaDto, PartieDto, VisibilityLockPathDto } from '@desdispos/shared';
import { VisibilityLocks } from './visibility-locks';
import { PartiesService } from '../../../core/parties/parties.service';
import { CharacterService } from '../../../core/characters/character.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const PARTIE: PartieDto = {
  id: 'p1',
  name: 'La Guilde des Ombres',
  kind: 'CAMPAGNE_EPISODIQUE',
  gameSystemId: 'ryuutama',
  description: null,
  ownerId: 'mj1',
  ownerPseudo: 'mj-pseudo',
  ownerDisplayName: 'MJ Nom',
  createdAt: '2026-07-01T00:00:00.000Z',
  nextSessionDate: null,
  nextSessionSlot: null,
  role: 'mj',
  status: 'A_VENIR',
  isFavorite: false,
  coverImageVersion: null,
  can: { coverUpdate: true },
};

// Schéma minimal représentatif de `GameSystemService.getSchema()` (Story 31.6/31.7) — reprend
// deux clés seulement (une simple, une avec sous-champs) : le test porte sur la dérivation
// schema-driven de l'écran, pas sur l'exhaustivité des 10 clés réelles (couverte côté API).
const SCHEMA: GameSystemSchemaDto = {
  sheetSchema: {
    classId: { type: 'string', lockable: true, label: 'Classe' },
    typeId: { type: 'string', lockable: true, label: 'Type' },
    attributes: {
      type: 'object',
      fields: ['AGI', 'ESP', 'INT', 'VIG'],
      lockable: true,
      lockableFields: ['AGI', 'ESP', 'INT', 'VIG'],
      label: 'Attributs',
      lockableFieldLabels: { AGI: 'AGI', ESP: 'ESP', INT: 'INT', VIG: 'VIG' },
    },
    // Clé non-lockable : ne doit jamais apparaître à l'écran (AC1).
    magicSeason: { type: 'string', label: 'Saison de magie' },
  },
  creationSteps: [],
};

async function createComponent(
  options: {
    locks?: VisibilityLockPathDto[];
    locksRejects?: boolean;
    setVisibilityLocksRejects?: boolean;
    schema?: GameSystemSchemaDto;
  } = {},
) {
  const partiesSvc = {
    get: vi.fn().mockResolvedValue(PARTIE),
    getVisibilityLocks: options.locksRejects
      ? vi.fn().mockRejectedValue(new Error('403'))
      : vi.fn().mockResolvedValue(options.locks ?? []),
    setVisibilityLocks: options.setVisibilityLocksRejects
      ? vi.fn().mockRejectedValue(new Error('500'))
      : vi.fn().mockResolvedValue([]),
  };
  const characterSvc = {
    getGameSystemSchema: vi.fn().mockResolvedValue(options.schema ?? SCHEMA),
  };

  await TestBed.configureTestingModule({
    imports: [VisibilityLocks],
    providers: [
      provideAnimationsAsync(),
      provideRouter([]),
      { provide: PartiesService, useValue: partiesSvc },
      { provide: CharacterService, useValue: characterSvc },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'p1' } } } },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(VisibilityLocks);
  // `ngOnInit()` chaîne un `Promise.all()` PUIS un second `await` (chargement du schéma après
  // celui des verrous) — une chaîne plus profonde que le simple `await` de PartieForm, d'où une
  // boucle de stabilisation plutôt qu'un nombre fixe de cycles (fragile face à un futur `await`
  // supplémentaire dans `ngOnInit()`).
  for (let i = 0; i < 6; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  fixture.detectChanges();
  return { fixture, partiesSvc, characterSvc, router };
}

function checkboxes(fixture: { nativeElement: HTMLElement }): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('input[type="checkbox"]'),
  ) as HTMLInputElement[];
}

describe('VisibilityLocks', () => {
  it('AC1 — partie neuve, aucun verrou : les cases proposées viennent du schéma (classId, typeId, attributes + 4 sous-champs), aucune clé en dur, magicSeason (non lockable) absent, toutes décochées', async () => {
    const { fixture } = await createComponent({ locks: [] });
    const boxes = checkboxes(fixture);
    // 3 clés lockable (classId, typeId, attributes) + 4 sous-champs d'attributes = 7 cases.
    expect(boxes).toHaveLength(7);
    expect(boxes.every((b) => !b.checked)).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Saison de magie');
  });

  it('verrous déjà posés : les cases correspondantes sont précochées (reflète GET :id/visibility-locks)', async () => {
    const { fixture } = await createComponent({
      locks: [
        { fieldKey: 'classId', subField: null },
        { fieldKey: 'attributes', subField: 'AGI' },
      ],
    });
    const comp = fixture.componentInstance as any;
    expect(comp.isLocked('classId')).toBe(true);
    expect(comp.isLocked('typeId')).toBe(false);
    expect(comp.isLocked('attributes')).toBe(false);
    expect(comp.isLocked('attributes', 'AGI')).toBe(true);
    expect(comp.isLocked('attributes', 'ESP')).toBe(false);
  });

  it('clé objet à sous-champs : cocher un sous-champ seul laisse la clé entière décochée, et seul le chemin attributes.AGI est envoyé à l’enregistrement', async () => {
    const { fixture, partiesSvc } = await createComponent({ locks: [] });
    const comp = fixture.componentInstance as any;
    comp.toggle('attributes', 'AGI');
    fixture.detectChanges();
    expect(comp.isLocked('attributes')).toBe(false);
    expect(comp.isLocked('attributes', 'AGI')).toBe(true);

    await comp.save();
    expect(partiesSvc.setVisibilityLocks).toHaveBeenCalledWith('p1', [
      { fieldKey: 'attributes', subField: 'AGI' },
    ]);
  });

  it('MJ décoche tout puis enregistre : PUT envoyé avec paths: []', async () => {
    const { fixture, partiesSvc } = await createComponent({
      locks: [{ fieldKey: 'classId', subField: null }],
    });
    const comp = fixture.componentInstance as any;
    expect(comp.isLocked('classId')).toBe(true);
    comp.toggle('classId');
    fixture.detectChanges();
    expect(comp.isLocked('classId')).toBe(false);

    await comp.save();
    expect(partiesSvc.setVisibilityLocks).toHaveBeenCalledWith('p1', []);
  });

  it('AC3 — joueur ouvrant l’URL directement (GET rejeté) : accès refusé, formulaire jamais rendu', async () => {
    const { fixture } = await createComponent({ locksRejects: true });
    const comp = fixture.componentInstance as any;
    expect(comp.accessDenied()).toBe(true);
    expect(checkboxes(fixture)).toHaveLength(0);
    // Lien de retour (pas un bouton) — même patron que les liens "Retour"/`RouterLink` ailleurs
    // dans l'app (ex. `partie.edit_btn` dans partie-detail.html).
    expect(fixture.nativeElement.querySelector('a[href="/parties/p1"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Accès refusé');
  });

  it('enregistrement réussi : navigue vers /parties/:id (même patron que PartieForm)', async () => {
    const { fixture, router } = await createComponent({ locks: [] });
    const comp = fixture.componentInstance as any;
    await comp.save();
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1']);
  });

  it('échec de l’enregistrement (setVisibilityLocks rejeté) : message d’erreur affiché, aucune navigation', async () => {
    const { fixture, router } = await createComponent({
      locks: [],
      setVisibilityLocksRejects: true,
    });
    const comp = fixture.componentInstance as any;
    await comp.save();
    fixture.detectChanges();
    expect(comp.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(comp.error());
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('système de jeu sans aucune clé verrouillable : branche @empty affichée, aucune case', async () => {
    const { fixture } = await createComponent({
      locks: [],
      schema: {
        sheetSchema: { magicSeason: { type: 'string', label: 'Saison de magie' } },
        creationSteps: [],
      },
    });
    expect(checkboxes(fixture)).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['parties.locks_empty']);
  });
});
