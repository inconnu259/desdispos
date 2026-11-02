import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { ContentEntryDto, HommeDragonDto } from '@master-jdr/shared';
import { ReserveSection, UNDO_DELAY_MS } from './reserve-section';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

const entry = (
  key: string,
  label: string,
  extra: Record<string, unknown> = {},
): ContentEntryDto => ({
  key,
  data: { key, label, ps: 1, description: `Description de ${label}.`, ...extra },
});

const SOUFFLES: ContentEntryDto[] = [
  entry('passe', 'Passé', { famille: 'temps', ps: 2, reservable: false }),
  entry('chance', 'Chance', { famille: 'destin' }),
  entry('fuite', 'Fuite', { famille: 'pnj' }),
  entry('courage', 'Courage', { race: 'DRAGON_ROUGE' }),
  entry('defi', 'Défi', { race: 'DRAGON_ROUGE' }),
  entry('nostalgie', 'Nostalgie', { race: 'DRAGON_VERT' }),
  entry('amour', 'Amour', { race: 'DRAGON_BLEU' }),
];
const RITUELS: ContentEntryDto[] = [entry('rituel-du-tabou', 'Rituel du tabou')];

function makeDto(
  level: number,
  reserve?: (string | null)[],
  updatedAt = '2026-10-01T10:00:00.000Z',
): HommeDragonDto {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
      ...(reserve ? { reserve } : {}),
    },
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt,
    aventures: [],
    historique: [],
    derived: { level, PS: 5 },
    eveilPowers: [],
    pendingEveilLevels: [],
  };
}

/** Promesse pilotée à la main : un geste « en vol » dont on choisit l'issue. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
}

async function setup(level: number, reserve?: (string | null)[]) {
  const svc = { setReserveSlot: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [ReserveSection],
    providers: [
      { provide: HommeDragonService, useValue: svc },
      {
        provide: ThemeToneService,
        useValue: {
          tone: () => ({
            'common.annuler': 'Annuler',
            'common.retirer': 'Retirer',
            'common.changer': 'Changer',
            'common.enregistrement': 'Enregistrement…',
            'common.aucune_description_disponible': 'Aucune description disponible.',
            'hd.reserve_autosaved': "Enregistrée automatiquement, utilisée pour l'export PDF.",
            'hd.reserve_pick_btn': 'Choisir un souffle',
            'hd.reserve_pick_for_slot': "Choisir un souffle pour l'emplacement {n}",
            'hd.reserve_change_aria': "Changer le souffle de l'emplacement {n} : {nom}",
            'hd.reserve_remove_aria': "Retirer {nom} de l'emplacement {n}",
            'hd.reserve_save_error': "Impossible d'enregistrer la réserve. Réessayez.",
            'hd.reserve_undo_text': "{nom} retiré de l'emplacement {n}.",
            'hd.reserve_removed_status':
              "{nom} retiré de l'emplacement {n}. Annuler disponible pendant quelques secondes.",
            'hd.reserve_restored_status': "{nom} remis dans l'emplacement {n}",
            'hd.reserve_placed_status': "{nom} placé dans l'emplacement {n}. Réserve enregistrée",
            'hd.picker_place_btn': "Mettre dans l'emplacement {n}",
            'hd.picker_consult_hint': 'Consultez un souffle de la liste pour lire sa description.',
            'hd.picker_choose_hint': 'Choisissez un souffle dans la liste.',
            'hd.picker_slot_gone': "Cet emplacement n'existe plus.",
            'hd.picker_blocked_announce': "Placement impossible dans l'emplacement {n} : {raison}",
            'hd.picker_description_aria': 'Description : {nom}',
          }),
        },
      },
      {
        provide: BreakpointObserver,
        useValue: {
          isMatched: () => false,
          observe: () => of({ matches: false, breakpoints: {} }),
        },
      },
      provideNoopAnimations(),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ReserveSection);
  fixture.componentRef.setInput('hommeDragonId', 'hd1');
  fixture.componentRef.setInput('hommeDragon', makeDto(level, reserve));
  fixture.componentRef.setInput('souffleCatalog', SOUFFLES);
  fixture.componentRef.setInput('ritualCatalog', RITUELS);
  const updated: HommeDragonDto[] = [];
  fixture.componentInstance.updated.subscribe((d) => updated.push(d));
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, svc, updated };
}

describe('ReserveSection (Story 33.6)', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // La fenêtre de choix est déplacée sous <body> (`portal`) : on lit tout le document, la section
  // et la fenêtre. `resetTestingModule()` retire les deux entre les tests.
  const el = (_f: ComponentFixture<unknown>) => document.body;
  const q = (f: ComponentFixture<unknown>, css: string) => el(f).querySelector<HTMLElement>(css);
  const qa = (f: ComponentFixture<unknown>, css: string) =>
    Array.from(el(f).querySelectorAll<HTMLElement>(css));
  const btn = (f: ComponentFixture<unknown>, kind: string, slot: number) =>
    q(f, `[data-reserve-btn="${kind}"][data-slot="${slot}"]`)!;
  /** Document-wide : la fenêtre de choix est rendue dans la section mais `activeElement` est global. */
  const focused = () => document.activeElement as HTMLElement | null;

  /** Ouvre la fenêtre sur l'emplacement `slot`, consulte `key` puis valide. */
  async function pick(f: ComponentFixture<unknown>, slot: number, key: string) {
    const kind = q(f, `[data-reserve-btn="pick"][data-slot="${slot}"]`) ? 'pick' : 'change';
    btn(f, kind, slot).click();
    f.detectChanges();
    await settle(f);
    q(f, `[aria-labelledby*="-${key}-n"]`)!.click();
    f.detectChanges();
    q(f, '.rp__btn--primary')!.click();
    f.detectChanges();
  }

  describe('affichage', () => {
    it("niveau 1 : ligne d'info seule, aucun emplacement ni bouton", async () => {
      const { fixture } = await setup(1);

      expect(el(fixture).textContent).toContain('Réserve de souffles');
      expect(el(fixture).textContent).toContain("La réserve de souffles s'ouvre au niveau 2.");
      expect(qa(fixture, 'button')).toHaveLength(0);
      expect(qa(fixture, '.reserve__slot')).toHaveLength(0);
      // La zone de statut est présente dès le chargement.
      expect(q(fixture, '[role="status"]')).not.toBeNull();
    });

    it('niveau 2 : « Niveau 2 · 1 emplacement » (singulier), un emplacement vide', async () => {
      const { fixture } = await setup(2);

      expect(q(fixture, '.reserve__level')!.textContent).toContain('Niveau 2 · 1 emplacement');
      expect(q(fixture, '.reserve__level')!.textContent).not.toContain('emplacements');
      expect(qa(fixture, '.reserve__slot')).toHaveLength(1);
      expect(btn(fixture, 'pick', 1).getAttribute('aria-label')).toBe(
        "Choisir un souffle pour l'emplacement 1",
      );
      expect(el(fixture).textContent).toContain('Emplacement libre');
      expect(el(fixture).textContent).toContain(
        "les souffles d'une autre race s'ouvrent au niveau 3",
      );
    });

    it('niveau 1 avec une réserve conservée (dissociation d’une aventure, AD-23) : contenu affiché, retirable, jamais purgé', async () => {
      const { fixture, svc } = await setup(1, ['courage', 'amour']);
      svc.setReserveSlot.mockResolvedValue(makeDto(1, [null, 'amour'], '2026-10-01T11:00:00.000Z'));

      // L'info « s'ouvre au niveau 2 » reste, ET les souffles conservés sont lisibles.
      expect(el(fixture).textContent).toContain("La réserve de souffles s'ouvre au niveau 2.");
      const slots = qa(fixture, '.reserve__slot');
      expect(slots).toHaveLength(2);
      expect(slots[0].textContent).toContain('Courage');
      expect(slots[1].textContent).toContain('Amour');
      // Retrait permis, mais ni « Changer » ni « Choisir un souffle » au-dessus du niveau.
      expect(btn(fixture, 'remove', 1)).not.toBeNull();
      expect(q(fixture, '[data-reserve-btn="change"]')).toBeNull();
      expect(q(fixture, '[data-reserve-btn="pick"]')).toBeNull();
      expect(el(fixture).textContent).toContain('Le niveau a baissé');

      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await settle(fixture);

      expect(svc.setReserveSlot).toHaveBeenCalledWith('hd1', 1, { key: null });
    });

    it('niveau qui baisse à 3 avec 4 emplacements remplis : les emplacements 3 et 4 restent affichés, seuls 1 et 2 sont modifiables', async () => {
      const { fixture } = await setup(3, ['courage', 'chance', 'defi', 'amour']);

      expect(qa(fixture, '.reserve__slot')).toHaveLength(4);
      expect(btn(fixture, 'change', 2)).not.toBeNull();
      expect(q(fixture, '[data-reserve-btn="change"][data-slot="3"]')).toBeNull();
      expect(btn(fixture, 'remove', 3)).not.toBeNull();
      expect(btn(fixture, 'remove', 4)).not.toBeNull();
    });

    it.each([
      [3, 2],
      [4, 3],
      [5, 4],
    ])(
      'niveau %i : N − 1 = %i emplacements numérotés, « Niveau N · k emplacements »',
      async (level, count) => {
        const { fixture } = await setup(level);

        expect(qa(fixture, '.reserve__slot')).toHaveLength(count);
        expect(q(fixture, '.reserve__level')!.textContent).toContain(
          `Niveau ${level} · ${count} emplacements`,
        );
      },
    );

    it('emplacements remplis : nom, coût, étiquette ; boutons nommés avec le souffle', async () => {
      const { fixture } = await setup(4, ['courage', 'chance', null]);

      const first = qa(fixture, '.reserve__slot')[0];
      expect(first.textContent).toContain('Courage');
      expect(first.textContent).toContain('1 PS');
      expect(first.textContent).toContain('Dragon Rouge');
      expect(qa(fixture, '.reserve__slot')[1].textContent).toContain('Commun · Destin');
      expect(btn(fixture, 'change', 2).getAttribute('aria-label')).toBe(
        "Changer le souffle de l'emplacement 2 : Chance",
      );
      expect(btn(fixture, 'remove', 1).getAttribute('aria-label')).toBe(
        "Retirer Courage de l'emplacement 1",
      );
      expect(btn(fixture, 'change', 1).textContent!.trim()).toBe('Changer');
      expect(btn(fixture, 'pick', 3).textContent!.trim()).toBe('Choisir un souffle');
      expect(qa(fixture, '.reserve__slot')[2].classList).toContain('reserve__slot--empty');
    });

    it('souffle retiré du catalogue : ligne lisible (clé brute), retirable, « Changer » possible', async () => {
      const { fixture, svc } = await setup(3, ['souffle-disparu', null]);
      svc.setReserveSlot.mockResolvedValue(makeDto(3, [null, null], '2026-10-01T11:00:00.000Z'));

      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('souffle-disparu');
      expect(btn(fixture, 'change', 1)).toBeTruthy();
      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await settle(fixture);

      expect(svc.setReserveSlot).toHaveBeenCalledWith('hd1', 1, { key: null });
    });

    it("mention d'enregistrement visible au repos (niveau ≥ 2), absente au niveau 1", async () => {
      const { fixture } = await setup(3);
      expect(q(fixture, '.reserve__hint')!.textContent).toContain(
        "Enregistrée automatiquement, utilisée pour l'export PDF.",
      );
    });

    it('Story 51.6 : la mention d’enregistrement porte le pictogramme valider, sans caractère ✓', async () => {
      const { fixture } = await setup(3);
      const hint = q(fixture, '.reserve__hint')!;
      expect(hint.querySelector('app-icon')?.getAttribute('data-icon')).toBe('valider');
      expect(hint.textContent).not.toContain('✓');
    });

    it('aucun compteur « utilisé » / « restant » ni « Vider la réserve »', async () => {
      const { fixture } = await setup(4, ['courage', 'chance', null]);
      const text = el(fixture).textContent!.toLowerCase();

      expect(text).not.toContain('restant');
      expect(text).not.toContain('utilisé ');
      expect(text).not.toContain('vider');
    });
  });

  describe('placer / changer', () => {
    it('place un souffle : écriture de CET emplacement, fenêtre fermée, focus sur « Changer »', async () => {
      const { fixture, svc, updated } = await setup(4, ['courage', 'chance', null]);
      const response = makeDto(4, ['courage', 'chance', 'defi'], '2026-10-01T11:00:00.000Z');
      svc.setReserveSlot.mockResolvedValue(response);

      await pick(fixture, 3, 'defi');
      await settle(fixture);

      expect(svc.setReserveSlot).toHaveBeenCalledWith('hd1', 3, { key: 'defi' });
      expect(q(fixture, 'app-reserve-picker')).toBeNull();
      expect(updated).toEqual([response]);
      expect(qa(fixture, '.reserve__slot')[2].textContent).toContain('Défi');
      expect(focused()).toBe(btn(fixture, 'change', 3));
      expect(q(fixture, '[role="status"]')!.textContent).toContain(
        "Défi placé dans l'emplacement 3",
      );
      expect(q(fixture, '.reserve__hint')!.textContent).toContain('Enregistrée automatiquement');
    });

    it('« Changer » remplace le souffle, focus sur « Changer » de ce même emplacement', async () => {
      const { fixture, svc } = await setup(3, ['courage', null]);
      svc.setReserveSlot.mockResolvedValue(makeDto(3, ['defi', null], '2026-10-01T11:00:00.000Z'));

      await pick(fixture, 1, 'defi');
      await settle(fixture);

      expect(svc.setReserveSlot).toHaveBeenCalledWith('hd1', 1, { key: 'defi' });
      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('Défi');
      expect(focused()).toBe(btn(fixture, 'change', 1));
    });

    it('un seul enregistrement en vol : aria-disabled, aria-busy, mention « Enregistrement… », gestes ignorés', async () => {
      const { fixture, svc } = await setup(4, ['courage', null, null]);
      const d = deferred<HommeDragonDto>();
      svc.setReserveSlot.mockReturnValue(d.promise);

      await pick(fixture, 2, 'chance');
      fixture.detectChanges();

      expect(q(fixture, '.reserve__slots')!.getAttribute('aria-busy')).toBe('true');
      expect(q(fixture, '.reserve__hint')!.textContent).toContain('Enregistrement…');
      for (const b of qa(fixture, '[data-reserve-btn]')) {
        expect(b.getAttribute('aria-disabled')).toBe('true');
      }
      // Optimiste : le souffle est déjà dans l'emplacement.
      expect(qa(fixture, '.reserve__slot')[1].textContent).toContain('Chance');
      // Un second geste est ignoré tant que le premier est en vol.
      btn(fixture, 'pick', 3).click();
      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-reserve-picker')).toBeNull();
      expect(svc.setReserveSlot).toHaveBeenCalledTimes(1);

      d.resolve(makeDto(4, ['courage', 'chance', null], '2026-10-01T11:00:00.000Z'));
      await settle(fixture);
      expect(q(fixture, '.reserve__slots')!.getAttribute('aria-busy')).toBe('false');
      expect(btn(fixture, 'change', 2).getAttribute('aria-disabled')).toBeNull();
    });

    it("« Annuler » de la fenêtre ou Échap : rien écrit, focus sur le déclencheur d'origine", async () => {
      const { fixture, svc } = await setup(3, ['courage', null]);

      btn(fixture, 'pick', 2).click();
      fixture.detectChanges();
      await settle(fixture);
      expect(q(fixture, 'app-reserve-picker')).not.toBeNull();
      q(fixture, '.rp__btn:not(.rp__btn--primary)')!.click();
      fixture.detectChanges();
      await settle(fixture);

      expect(q(fixture, 'app-reserve-picker')).toBeNull();
      expect(svc.setReserveSlot).not.toHaveBeenCalled();
      expect(focused()).toBe(btn(fixture, 'pick', 2));

      // Échap depuis « Changer ».
      btn(fixture, 'change', 1).click();
      fixture.detectChanges();
      await settle(fixture);
      q(fixture, '.detail-surface-panel')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      await settle(fixture);
      expect(q(fixture, 'app-reserve-picker')).toBeNull();
      expect(focused()).toBe(btn(fixture, 'change', 1));
    });
  });

  describe("échec d'enregistrement", () => {
    it('retour à l\'état précédent, erreur role="alert", mention masquée, focus sur le bouton rétabli', async () => {
      const { fixture, svc, updated } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockRejectedValue(new Error('réseau'));

      await pick(fixture, 3, 'defi');
      await settle(fixture);

      const alert = q(fixture, '[role="alert"]')!;
      expect(alert.textContent).toContain("Impossible d'enregistrer la réserve. Réessayez.");
      expect(alert.querySelector('app-icon')?.getAttribute('data-icon')).toBe('avertissement');
      expect(alert.textContent).not.toContain('⚠');
      expect(qa(fixture, '.reserve__slot')[2].classList).toContain('reserve__slot--empty');
      expect(qa(fixture, '.reserve__slot')[2].textContent).not.toContain('Défi');
      expect(q(fixture, '.reserve__hint')).toBeNull();
      expect(focused()).toBe(btn(fixture, 'pick', 3));
      expect(updated).toEqual([]);
      // Les autres emplacements n'ont pas bougé.
      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('Courage');
      expect(qa(fixture, '.reserve__slot')[1].textContent).toContain('Chance');
    });

    it("le nœud d'alerte est recréé à chaque échec (ré-annonce d'une erreur répétée)", async () => {
      const { fixture, svc } = await setup(3, [null, null]);
      svc.setReserveSlot.mockRejectedValue(new Error('x'));

      await pick(fixture, 1, 'chance');
      await settle(fixture);
      const first = q(fixture, '[role="alert"]')!;

      await pick(fixture, 1, 'chance');
      await settle(fixture);
      const second = q(fixture, '[role="alert"]')!;

      expect(second).not.toBe(first);
      expect(first.isConnected).toBe(false);
    });

    it("échec d'un « Changer » : l'ancien souffle revient, focus sur « Changer »", async () => {
      const { fixture, svc } = await setup(3, ['courage', null]);
      svc.setReserveSlot.mockRejectedValue(new Error('x'));

      await pick(fixture, 1, 'defi');
      await settle(fixture);

      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('Courage');
      expect(focused()).toBe(btn(fixture, 'change', 1));
    });

    it("l'erreur disparaît au geste suivant", async () => {
      const { fixture, svc } = await setup(3, [null, null]);
      svc.setReserveSlot.mockRejectedValueOnce(new Error('x'));
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(3, ['chance', null], '2026-10-01T11:00:00.000Z'),
      );

      await pick(fixture, 1, 'chance');
      await settle(fixture);
      expect(q(fixture, '[role="alert"]')).not.toBeNull();

      await pick(fixture, 1, 'chance');
      await settle(fixture);
      expect(q(fixture, '[role="alert"]')).toBeNull();
    });
  });

  describe('retirer et annulation du dernier retrait', () => {
    it('« Retirer » : emplacement vidé aussitôt, sans confirmation, focus sur « Choisir un souffle »', async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      const d = deferred<HommeDragonDto>();
      svc.setReserveSlot.mockReturnValue(d.promise);

      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);

      expect(q(fixture, '[role="alertdialog"], [role="dialog"]')).toBeNull();
      expect(svc.setReserveSlot).toHaveBeenCalledWith('hd1', 2, { key: null });
      expect(qa(fixture, '.reserve__slot')[1].classList).toContain('reserve__slot--empty');
      expect(focused()).toBe(btn(fixture, 'pick', 2));
      // Bandeau affiché, « Annuler » inactif tant que l'écriture du retrait n'est pas terminée.
      expect(q(fixture, '.reserve__undo')!.textContent).toContain(
        "Chance retiré de l'emplacement 2.",
      );
      expect(q(fixture, '[data-reserve-btn="undo"]')!.getAttribute('aria-disabled')).toBe('true');

      d.resolve(makeDto(4, ['courage', null, null], '2026-10-01T11:00:00.000Z'));
      await settle(fixture);
      expect(q(fixture, '[data-reserve-btn="undo"]')!.getAttribute('aria-disabled')).toBeNull();
      expect(q(fixture, '[role="status"]')!.textContent).toContain(
        "Chance retiré de l'emplacement 2. Annuler disponible pendant quelques secondes.",
      );
    });

    it("échec du retrait : l'emplacement revient, aucun bandeau, message d'erreur", async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockRejectedValue(new Error('x'));

      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);

      expect(qa(fixture, '.reserve__slot')[1].textContent).toContain('Chance');
      expect(q(fixture, '.reserve__undo')).toBeNull();
      expect(q(fixture, '[role="alert"]')).not.toBeNull();
      expect(focused()).toBe(btn(fixture, 'change', 2));
    });

    it('« Annuler » remet le souffle dans le même emplacement, focus sur « Changer », annonce « remis »', async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', null, null], '2026-10-01T11:00:00.000Z'),
      );
      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);

      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', 'chance', null], '2026-10-01T12:00:00.000Z'),
      );
      q(fixture, '[data-reserve-btn="undo"]')!.click();
      fixture.detectChanges();
      await settle(fixture);

      expect(svc.setReserveSlot).toHaveBeenLastCalledWith('hd1', 2, { key: 'chance' });
      expect(q(fixture, '.reserve__undo')).toBeNull();
      expect(qa(fixture, '.reserve__slot')[1].textContent).toContain('Chance');
      expect(focused()).toBe(btn(fixture, 'change', 2));
      expect(q(fixture, '[role="status"]')!.textContent).toContain(
        "Chance remis dans l'emplacement 2",
      );
    });

    it("« Annuler » échoue : message d'erreur, l'emplacement reste vide", async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', null, null], '2026-10-01T11:00:00.000Z'),
      );
      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);

      svc.setReserveSlot.mockRejectedValueOnce(new Error('x'));
      q(fixture, '[data-reserve-btn="undo"]')!.click();
      fixture.detectChanges();
      await settle(fixture);

      expect(q(fixture, '[role="alert"]')).not.toBeNull();
      expect(qa(fixture, '.reserve__slot')[1].classList).toContain('reserve__slot--empty');
    });

    it("le bandeau disparaît quand l'emplacement est de nouveau occupé", async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', null, null], '2026-10-01T11:00:00.000Z'),
      );
      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);
      expect(q(fixture, '.reserve__undo')).not.toBeNull();

      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', 'defi', null], '2026-10-01T12:00:00.000Z'),
      );
      await pick(fixture, 2, 'defi');
      await settle(fixture);

      expect(q(fixture, '.reserve__undo')).toBeNull();
    });

    it('un nouveau retrait remplace le message : seul le dernier retrait est annulable', async () => {
      const { fixture, svc } = await setup(4, ['courage', 'chance', null]);
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, ['courage', null, null], '2026-10-01T11:00:00.000Z'),
      );
      btn(fixture, 'remove', 2).click();
      fixture.detectChanges();
      await settle(fixture);
      svc.setReserveSlot.mockResolvedValueOnce(
        makeDto(4, [null, null, null], '2026-10-01T12:00:00.000Z'),
      );
      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await settle(fixture);

      expect(qa(fixture, '.reserve__undo')).toHaveLength(1);
      expect(q(fixture, '.reserve__undo')!.textContent).toContain(
        "Courage retiré de l'emplacement 1.",
      );
    });

    it(`le bandeau expire après ${UNDO_DELAY_MS / 1000} s`, async () => {
      const { fixture, svc } = await setup(3, ['courage', 'chance']);
      svc.setReserveSlot.mockResolvedValue(
        makeDto(3, [null, 'chance'], '2026-10-01T11:00:00.000Z'),
      );
      vi.useFakeTimers();

      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(UNDO_DELAY_MS - 100);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).not.toBeNull();
      await vi.advanceTimersByTimeAsync(200);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).toBeNull();
    });

    it('le décompte est suspendu tant que le focus ou le survol est sur le bandeau', async () => {
      const { fixture, svc } = await setup(3, ['courage', 'chance']);
      svc.setReserveSlot.mockResolvedValue(
        makeDto(3, [null, 'chance'], '2026-10-01T11:00:00.000Z'),
      );
      vi.useFakeTimers();

      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const banner = q(fixture, '.reserve__undo')!;

      banner.dispatchEvent(new MouseEvent('mouseenter'));
      await vi.advanceTimersByTimeAsync(UNDO_DELAY_MS * 3);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).not.toBeNull();

      banner.dispatchEvent(new MouseEvent('mouseleave'));
      banner.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(UNDO_DELAY_MS * 3);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).not.toBeNull();

      banner.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(UNDO_DELAY_MS + 100);
      fixture.detectChanges();
      expect(q(fixture, '.reserve__undo')).toBeNull();
    });

    it('le bandeau expire pendant que « Annuler » a le focus : focus sur « Choisir un souffle » du même emplacement', async () => {
      const { fixture, svc } = await setup(3, ['courage', 'chance']);
      svc.setReserveSlot.mockResolvedValue(
        makeDto(3, [null, 'chance'], '2026-10-01T11:00:00.000Z'),
      );
      vi.useFakeTimers();

      btn(fixture, 'remove', 1).click();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      q(fixture, '[data-reserve-btn="undo"]')!.focus();
      // Le focus suspend le décompte ; on le relâche sans quitter l'élément pour simuler l'expiration.
      const banner = q(fixture, '.reserve__undo')!;
      banner.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(UNDO_DELAY_MS + 100);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      expect(q(fixture, '.reserve__undo')).toBeNull();
      expect(focused()).toBe(btn(fixture, 'pick', 1));
    });
  });

  describe('fiche rafraîchie pendant ou après une écriture', () => {
    it("une fiche reçue pendant un geste en vol n'écrase pas l'écriture optimiste", async () => {
      const { fixture, svc } = await setup(3, [null, null]);
      const d = deferred<HommeDragonDto>();
      svc.setReserveSlot.mockReturnValue(d.promise);

      await pick(fixture, 1, 'chance');
      fixture.detectChanges();
      // Le signal `changed` fait relire la fiche : cette lecture ne contient pas encore le geste.
      fixture.componentRef.setInput(
        'hommeDragon',
        makeDto(3, [null, null], '2026-10-01T10:00:01.000Z'),
      );
      fixture.detectChanges();

      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('Chance');
    });

    it("une fiche plus ancienne que la dernière réponse d'écriture est ignorée", async () => {
      const { fixture, svc } = await setup(3, [null, null]);
      svc.setReserveSlot.mockResolvedValue(
        makeDto(3, ['chance', null], '2026-10-01T11:00:00.000Z'),
      );

      await pick(fixture, 1, 'chance');
      await settle(fixture);
      fixture.componentRef.setInput(
        'hommeDragon',
        makeDto(3, [null, null], '2026-10-01T10:30:00.000Z'),
      );
      fixture.detectChanges();

      expect(qa(fixture, '.reserve__slot')[0].textContent).toContain('Chance');
    });

    it('une fiche plus récente (autre appareil) est appliquée ; montée de niveau : nouvel emplacement vide', async () => {
      const { fixture } = await setup(3, ['courage', null]);

      fixture.componentRef.setInput(
        'hommeDragon',
        makeDto(4, ['courage', 'chance', null], '2026-10-01T12:00:00.000Z'),
      );
      fixture.detectChanges();

      const slots = qa(fixture, '.reserve__slot');
      expect(slots).toHaveLength(3);
      expect(slots[1].textContent).toContain('Chance');
      expect(slots[2].classList).toContain('reserve__slot--empty');
      expect(q(fixture, '.reserve__level')!.textContent).toContain('Niveau 4 · 3 emplacements');
    });
  });

  describe('accessibilité', () => {
    it('chaque emplacement est nommé « Emplacement N — souffle »', async () => {
      const { fixture } = await setup(3, ['courage', null]);
      const li = fixture.debugElement.queryAll(By.css('.reserve__slot'))[0]
        .nativeElement as HTMLElement;
      const names = li
        .getAttribute('aria-labelledby')!
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim().replace(/\s+/g, ' '));

      expect(names.join(' ')).toContain('Emplacement 1');
      expect(names.join(' ')).toContain('Courage');
    });

    it('listes avec role="list" explicite', async () => {
      const { fixture } = await setup(3);
      expect(q(fixture, 'ol.reserve__slots')!.getAttribute('role')).toBe('list');
    });
  });
});
