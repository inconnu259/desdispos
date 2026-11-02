import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import type { ContentEntryDto, HommeDragonRace } from '@master-jdr/shared';
import { ReservePicker } from './reserve-picker';
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
  entry('futur', 'Futur', { famille: 'temps', ps: 2, reservable: false }),
  entry('chance', 'Chance', { famille: 'destin' }),
  entry('malchance', 'Malchance', { famille: 'destin' }),
  entry('fuite', 'Fuite', { famille: 'pnj' }),
  entry('courage', 'Courage', { race: 'DRAGON_ROUGE' }),
  entry('defi', 'Défi', { race: 'DRAGON_ROUGE' }),
  entry('nostalgie', 'Nostalgie', { race: 'DRAGON_VERT' }),
  entry('route', 'Route', { race: 'DRAGON_VERT' }),
  entry('amour', 'Amour', { race: 'DRAGON_BLEU' }),
  entry('massacre', 'Massacre', { race: 'DRAGON_NOIR' }),
];
const RITUELS: ContentEntryDto[] = [
  entry('rituel-du-tabou', 'Rituel du tabou'),
  entry('fete-des-poings', 'Fête des poings'),
];

interface Opts {
  slot?: number;
  reserve?: (string | null)[];
  level?: number;
  race?: HommeDragonRace;
}

async function setup(opts: Opts = {}) {
  await TestBed.configureTestingModule({
    imports: [ReservePicker],
    providers: [
      {
        provide: ThemeToneService,
        useValue: {
          tone: () => ({
            'common.annuler': 'Annuler',
            'common.aucune_description_disponible': 'Aucune description disponible.',
            'common.detail': 'Détail',
            'shared.detail_close_window': 'Fermer la fenêtre',
            'shared.detail_close_sheet': 'Fermer la feuille',
            'hd.reserve_pick_for_slot': "Choisir un souffle pour l'emplacement {n}",
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
  const fixture = TestBed.createComponent(ReservePicker);
  fixture.componentRef.setInput('slot', opts.slot ?? 3);
  fixture.componentRef.setInput('reserve', opts.reserve ?? [null, null, null]);
  fixture.componentRef.setInput('level', opts.level ?? 4);
  fixture.componentRef.setInput('race', opts.race ?? 'DRAGON_ROUGE');
  fixture.componentRef.setInput('souffleCatalog', SOUFFLES);
  fixture.componentRef.setInput('ritualCatalog', RITUELS);
  const chosen: string[] = [];
  let closed = 0;
  fixture.componentInstance.chosen.subscribe((k) => chosen.push(k));
  fixture.componentInstance.closed.subscribe(() => closed++);
  fixture.detectChanges();
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return { fixture, chosen, closedCount: () => closed };
}

describe('ReservePicker (Story 33.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // La fenêtre de choix est déplacée sous <body> (`portal`) : on lit tout le document, la section
  // et la fenêtre. `resetTestingModule()` retire les deux entre les tests.
  const el = (_f: ComponentFixture<unknown>) => document.body;
  const q = (f: ComponentFixture<unknown>, css: string) => el(f).querySelector<HTMLElement>(css);
  const qa = (f: ComponentFixture<unknown>, css: string) =>
    Array.from(el(f).querySelectorAll<HTMLElement>(css));
  const row = (f: ComponentFixture<unknown>, label: string) =>
    qa(f, '.rp__row').find((r) => r.querySelector('.rp__name')?.textContent?.trim() === label)!;
  const cat = (f: ComponentFixture<unknown>, title: string) =>
    qa(f, '.rp__cat-btn').find(
      (b) => b.querySelector('.rp__cat-name')?.textContent?.trim() === title,
    )!;
  const text = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
  const primary = (f: ComponentFixture<unknown>) => q(f, '.rp__btn--primary')!;

  describe('coquille', () => {
    it("dialogue nommé « Choisir un souffle pour l'emplacement N », décrit par le compteur", async () => {
      const { fixture } = await setup({ reserve: ['courage', 'chance', null] });
      const dialog = q(fixture, '[role="dialog"]')!;

      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-label')).toBe("Choisir un souffle pour l'emplacement 3");
      expect(q(fixture, '.rp__title')!.tagName).toBe('H2');
      const counter = document.getElementById(dialog.getAttribute('aria-describedby')!)!;
      expect(text(counter)).toBe('2 / 3 emplacements');
    });

    it('compteur « k / N emplacements », singulier à un emplacement', async () => {
      const { fixture } = await setup({ slot: 1, level: 2, reserve: [null] });
      expect(text(q(fixture, '.rp__count')!)).toBe('0 / 1 emplacement');
    });

    it('bouton de fermeture « Fermer la feuille » (mobile) et les deux boutons du pied', async () => {
      const { fixture } = await setup();
      expect(q(fixture, '.detail-surface-close')!.getAttribute('aria-label')).toBe(
        'Fermer la feuille',
      );
      expect(qa(fixture, '.detail-surface-footer .rp__btn').map(text)).toEqual([
        'Annuler',
        "Mettre dans l'emplacement 3",
      ]);
    });

    it("« Annuler » et Échap émettent closed, rien n'est placé", async () => {
      const { fixture, chosen, closedCount } = await setup();

      q(fixture, '.rp__btn:not(.rp__btn--primary)')!.click();
      q(fixture, '.detail-surface-panel')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );

      expect(closedCount()).toBe(2);
      expect(chosen).toEqual([]);
    });
  });

  describe('catégories repliables', () => {
    it('niveau 4 : temps et rituels repliés avec leur raison écrite, le reste déplié', async () => {
      const { fixture } = await setup({ level: 4, reserve: ['courage', 'chance', null] });

      const temps = cat(fixture, 'Souffles du temps');
      expect(temps.getAttribute('aria-expanded')).toBe('false');
      expect(text(temps)).toContain('Non réservable : souffle du temps');
      const rituels = cat(fixture, 'Rituels');
      expect(rituels.getAttribute('aria-expanded')).toBe('false');
      expect(text(rituels)).toContain('Admis dès le niveau 5');
      for (const title of ['Destin', 'PNJ', 'Souffles du Dragon Rouge', 'Autres races']) {
        expect(cat(fixture, title).getAttribute('aria-expanded')).toBe('true');
      }
      expect(text(cat(fixture, 'Autres races'))).toContain('0 / 1 souffle autorisé');
    });

    it('chevron : toujours deplier, pivoté de −90° (classe) quand la catégorie est repliée', async () => {
      const { fixture } = await setup({ level: 4, reserve: ['courage', 'chance', null] });
      const chevron = (title: string) => cat(fixture, title).querySelector('app-icon') as HTMLElement;

      // Ouvert : pas de rotation.
      expect(chevron('Destin').getAttribute('data-icon')).toBe('deplier');
      expect(chevron('Destin').classList.contains('rp__chevron--closed')).toBe(false);
      // Replié d'office : même pictogramme, pivoté.
      expect(chevron('Rituels').getAttribute('data-icon')).toBe('deplier');
      expect(chevron('Rituels').classList.contains('rp__chevron--closed')).toBe(true);
      // Un clic le déplie : la rotation disparaît.
      cat(fixture, 'Rituels').click();
      fixture.detectChanges();
      expect(chevron('Rituels').classList.contains('rp__chevron--closed')).toBe(false);
      expect(text(cat(fixture, 'Destin'))).not.toMatch(/[▾▸]/);
    });

    it('chaque en-tête (h3 > button) porte aria-expanded et aria-controls vers un panneau existant', async () => {
      const { fixture } = await setup();
      for (const b of qa(fixture, '.rp__cat-btn')) {
        expect(b.parentElement!.tagName).toBe('H3');
        const panel = document.getElementById(b.getAttribute('aria-controls')!)!;
        expect(panel).not.toBeNull();
        expect(panel.hidden).toBe(b.getAttribute('aria-expanded') === 'false');
      }
    });

    it("le nombre de souffles fait partie du nom accessible de l'en-tête", async () => {
      const { fixture } = await setup();
      expect(text(cat(fixture, 'Destin'))).toContain('2 souffles');
    });

    it("un clic déplie / replie, même une catégorie repliée d'office ; tous les souffles restent listés", async () => {
      const { fixture } = await setup();
      const temps = cat(fixture, 'Souffles du temps');

      expect(row(fixture, 'Passé')).toBeTruthy();
      temps.click();
      fixture.detectChanges();
      expect(temps.getAttribute('aria-expanded')).toBe('true');
      expect(document.getElementById(temps.getAttribute('aria-controls')!)!.hidden).toBe(false);
      temps.click();
      fixture.detectChanges();
      expect(temps.getAttribute('aria-expanded')).toBe('false');
    });

    it('niveau 2 : autres races repliées, raison « Autres races : à partir du niveau 3 » ; pas de rituel placeable', async () => {
      const { fixture } = await setup({ slot: 1, level: 2, reserve: [null] });

      const autres = cat(fixture, 'Autres races');
      expect(autres.getAttribute('aria-expanded')).toBe('false');
      expect(text(autres)).toContain('Autres races : à partir du niveau 3');
      expect(text(q(fixture, '.rp__rule')!)).toContain(
        "les souffles d'une autre race s'ouvrent au niveau 3",
      );
      expect(row(fixture, 'Nostalgie').getAttribute('aria-disabled')).toBe('true');
    });

    it("quota d'autre race atteint : catégorie repliée « Un seul souffle d'une autre race », souffle placé « Déjà dans l'emplacement 2 »", async () => {
      const { fixture } = await setup({ level: 4, reserve: ['courage', 'nostalgie', null] });

      const autres = cat(fixture, 'Autres races');
      expect(autres.getAttribute('aria-expanded')).toBe('false');
      expect(text(autres)).toContain("Un seul souffle d'une autre race");
      expect(text(row(fixture, 'Nostalgie'))).toContain("Déjà dans l'emplacement 2");
      expect(text(row(fixture, 'Route'))).toContain("Un seul souffle d'une autre race");
      expect(text(row(fixture, 'Amour'))).toContain("Un seul souffle d'une autre race");
      expect(text(q(fixture, '.rp__rule')!)).toContain("Nostalgie (Dragon Vert) l'occupe déjà");
    });

    it('niveau 5 : les rituels sont dépliés et placeables', async () => {
      const { fixture } = await setup({ level: 5, reserve: [null, null, null, null], slot: 4 });

      expect(cat(fixture, 'Rituels').getAttribute('aria-expanded')).toBe('true');
      expect(row(fixture, 'Rituel du tabou').getAttribute('aria-disabled')).toBeNull();
    });

    it('intertitres de groupe : role="group" nommé, h4 par race dans « Autres races »', async () => {
      const { fixture } = await setup();
      const groups = qa(fixture, '[role="group"][aria-labelledby]').filter((g) =>
        g.querySelector(':scope > .rp__group'),
      );

      expect(groups.map((g) => text(g.querySelector('.rp__group')!))).toEqual([
        'Souffles communs',
        'Votre race',
        'Autres races et rituels',
      ]);
      expect(qa(fixture, '.rp__sub').map(text)).toEqual([
        'Dragon Vert',
        'Dragon Bleu',
        'Dragon Noir',
      ]);
      for (const ul of qa(fixture, 'ul.rp__list')) expect(ul.getAttribute('role')).toBe('list');
    });
  });

  describe('lignes de souffle', () => {
    it('sont des <button> natifs ; Entrée/Espace = consulter (aria-pressed), pas placer', async () => {
      const { fixture, chosen } = await setup();
      const chance = row(fixture, 'Chance');

      expect(chance.tagName).toBe('BUTTON');
      expect(chance.getAttribute('aria-pressed')).toBe('false');
      chance.click();
      fixture.detectChanges();

      expect(chance.getAttribute('aria-pressed')).toBe('true');
      expect(row(fixture, 'Malchance').getAttribute('aria-pressed')).toBe('false');
      expect(chosen).toEqual([]);
      expect(text(q(fixture, '.rp__dhead')!)).toContain('Chance');
      expect(text(q(fixture, '.rp__ddesc')!)).toContain('Description de Chance.');
    });

    it('nom accessible = nom + coût + repère ; description liée par aria-describedby', async () => {
      const { fixture } = await setup({ reserve: ['courage', 'chance', null] });
      const chance = row(fixture, 'Chance');
      const name = chance
        .getAttribute('aria-labelledby')!
        .split(' ')
        .map((id) => text(document.getElementById(id)!))
        .join(' ');

      expect(name).toBe("Chance 1 PS Déjà dans l'emplacement 2");
      expect(text(document.getElementById(chance.getAttribute('aria-describedby')!)!)).toBe(
        'Description de Chance.',
      );
    });

    it('même souffle commun ou de la race : repère non bloquant, toujours placeable', async () => {
      const { fixture, chosen } = await setup({ reserve: ['courage', 'chance', null] });

      for (const label of ['Chance', 'Courage']) {
        const r = row(fixture, label);
        expect(r.getAttribute('aria-disabled')).toBeNull();
        expect(text(r)).toContain("Déjà dans l'emplacement");
      }
      row(fixture, 'Courage').click();
      fixture.detectChanges();
      expect(text(q(fixture, '.rp__note')!)).toContain(
        "Déjà dans l'emplacement 1 : un même souffle peut occuper plusieurs emplacements.",
      );
      primary(fixture).click();
      expect(chosen).toEqual(['courage']);
    });

    it('souffle du temps : grisé (aria-disabled, jamais disabled), raison écrite, focalisable et consultable', async () => {
      const { fixture } = await setup();
      cat(fixture, 'Souffles du temps').click();
      fixture.detectChanges();
      const passe = row(fixture, 'Passé');

      expect(passe.getAttribute('aria-disabled')).toBe('true');
      expect(passe.hasAttribute('disabled')).toBe(false);
      expect(text(passe)).toContain('Non réservable : souffle du temps');
      expect(text(passe)).toContain('2 PS');
      passe.focus();
      expect(document.activeElement).toBe(passe);
      passe.click();
      fixture.detectChanges();
      expect(passe.getAttribute('aria-pressed')).toBe('true');
      expect(text(q(fixture, '.rp__ddesc')!)).toContain('Description de Passé.');
    });

    it('chaque ligne grisée porte une raison écrite (jamais de grisage sans raison)', async () => {
      const { fixture } = await setup({ level: 3, reserve: ['courage', 'nostalgie'], slot: 3 });
      for (const r of qa(fixture, '.rp__row[aria-disabled="true"]')) {
        expect(r.querySelector('.rp__reason')).not.toBeNull();
        expect(text(r.querySelector('.rp__reason')!).length).toBeGreaterThan(3);
      }
    });

    it('tous les souffles du catalogue restent listés (aucun masqué)', async () => {
      const { fixture } = await setup({ level: 2, slot: 1, reserve: [null] });
      expect(qa(fixture, '.rp__row')).toHaveLength(SOUFFLES.length + RITUELS.length);
    });
  });

  describe('zone de détail et validation', () => {
    it("sans souffle consulté : « Mettre dans l'emplacement N » visible mais aria-disabled, ne place rien", async () => {
      const { fixture, chosen } = await setup();

      expect(primary(fixture).getAttribute('aria-disabled')).toBe('true');
      primary(fixture).click();
      expect(chosen).toEqual([]);
    });

    it('souffle placeable consulté : le bouton principal est actif et émet la clé', async () => {
      const { fixture, chosen } = await setup();

      row(fixture, 'Défi').click();
      fixture.detectChanges();

      expect(primary(fixture).getAttribute('aria-disabled')).toBeNull();
      expect(text(primary(fixture))).toBe("Mettre dans l'emplacement 3");
      primary(fixture).click();
      expect(chosen).toEqual(['defi']);
    });

    it('ligne grisée consultée : bouton principal aria-disabled, raison liée par aria-describedby, aucun effet', async () => {
      const { fixture, chosen } = await setup();
      cat(fixture, 'Souffles du temps').click();
      fixture.detectChanges();

      row(fixture, 'Futur').click();
      fixture.detectChanges();

      expect(primary(fixture).getAttribute('aria-disabled')).toBe('true');
      const why = document.getElementById(primary(fixture).getAttribute('aria-describedby')!)!;
      expect(text(why)).toContain('Non réservable : souffle du temps');
      primary(fixture).click();
      expect(chosen).toEqual([]);
    });

    it('autre race au niveau 3 sans quota atteint : placeable ; rituel au niveau 4 : non', async () => {
      const { fixture, chosen } = await setup({ level: 3, slot: 2, reserve: ['courage', null] });
      row(fixture, 'Amour').click();
      fixture.detectChanges();
      primary(fixture).click();
      expect(chosen).toEqual(['amour']);

      TestBed.resetTestingModule();
      const second = await setup({ level: 4 });
      row(second.fixture, 'Rituel du tabou').click();
      second.fixture.detectChanges();
      expect(primary(second.fixture).getAttribute('aria-disabled')).toBe('true');
    });

    it("changer le souffle d'une autre race sur son propre emplacement reste possible", async () => {
      const { fixture, chosen } = await setup({
        level: 4,
        slot: 2,
        reserve: ['courage', 'nostalgie', null],
      });

      row(fixture, 'Amour').click();
      fixture.detectChanges();

      expect(primary(fixture).getAttribute('aria-disabled')).toBeNull();
      primary(fixture).click();
      expect(chosen).toEqual(['amour']);
    });

    it('mise à jour reçue : le placement devient invalide -> bouton inactif avec raison, annoncé par la zone de statut', async () => {
      const { fixture } = await setup({ level: 4, reserve: [null, null, null] });
      row(fixture, 'Nostalgie').click();
      fixture.detectChanges();
      expect(primary(fixture).getAttribute('aria-disabled')).toBeNull();

      // Un autre appareil place un autre souffle d'une autre race dans l'emplacement 1.
      fixture.componentRef.setInput('reserve', ['amour', null, null]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(primary(fixture).getAttribute('aria-disabled')).toBe('true');
      expect(text(q(fixture, '[role="status"]')!)).toContain("Un seul souffle d'une autre race");
      // La ligne consultée est restée la même (nœuds non recréés, le focus ne saute pas).
      expect(row(fixture, 'Nostalgie').getAttribute('aria-pressed')).toBe('true');
    });

    it('un changement de réserve ne recrée pas les lignes ni ne replie une catégorie ouverte', async () => {
      const { fixture } = await setup({ level: 4, reserve: [null, null, null] });
      const before = row(fixture, 'Chance');
      const destin = cat(fixture, 'Destin');

      fixture.componentRef.setInput('reserve', ['chance', 'chance', 'chance']);
      fixture.detectChanges();

      expect(row(fixture, 'Chance')).toBe(before);
      expect(destin.getAttribute('aria-expanded')).toBe('true');
    });

    it("emplacement disparu (niveau recalculé) : bouton inactif, « Cet emplacement n'existe plus. »", async () => {
      const { fixture } = await setup({ level: 4, slot: 3 });
      row(fixture, 'Chance').click();
      fixture.detectChanges();

      fixture.componentRef.setInput('level', 2);
      fixture.detectChanges();

      expect(primary(fixture).getAttribute('aria-disabled')).toBe('true');
      expect(text(q(fixture, '.rp__detail .rp__reason')!)).toContain(
        "Cet emplacement n'existe plus.",
      );
    });
  });
});
