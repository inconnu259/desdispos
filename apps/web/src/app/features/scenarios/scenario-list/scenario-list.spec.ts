import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { ScenarioDto, SeanceDto } from '@master-jdr/shared';
import { ScenarioList } from './scenario-list';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';

const BASE: ScenarioDto = {
  id: 's1',
  partieId: 'p1',
  title: 'Le Marché aux Ombres',
  description: null,
  status: 'BROUILLON',
  dureeHeures: null,
  dureeSeances: null,
  resumeFin: null,
  createdAt: '2026-07-12T00:00:00.000Z',
  closedAt: null,
  seances: [],
};

const DRAFT_1: ScenarioDto = BASE;
const DRAFT_2: ScenarioDto = { ...BASE, id: 's2', title: 'Les Ombres du Passé' };
const A_VENIR: ScenarioDto = {
  ...BASE,
  id: 's3',
  title: 'La Route des Lanternes',
  status: 'A_VENIR',
};
const COURANT: ScenarioDto = { ...BASE, id: 's4', title: 'Le Pont de Verre', status: 'COURANT' };
const PASSE_1: ScenarioDto = { ...BASE, id: 's5', title: 'La Vallée Blanche', status: 'PASSE' };
const PASSE_2: ScenarioDto = { ...BASE, id: 's6', title: 'Les Cendres', status: 'PASSE' };

// Ordre servi par l'API : création croissante, tous statuts mélangés.
const ALL = [DRAFT_1, PASSE_1, COURANT, A_VENIR, PASSE_2, DRAFT_2];

function makeScenariosService(scenarios: ScenarioDto[]) {
  return {
    listAll: vi.fn().mockResolvedValue(scenarios),
    open: vi.fn().mockResolvedValue({ ...DRAFT_1, status: 'A_VENIR' }),
    changed: signal<{ partieId: string } | null>(null),
  };
}

async function createComponent(
  scenarios: ScenarioDto[] = ALL,
  {
    withInput = true,
    routeParam = null as string | null,
    scenariosSvc = makeScenariosService(scenarios),
  } = {},
) {
  const router = { navigate: vi.fn() };
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ScenarioList],
    providers: [
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => routeParam } } } },
      { provide: RealtimeService, useValue: realtimeSvc },
      { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScenarioList);
  if (withInput) fixture.componentRef.setInput('partieId', 'p1');
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, router, realtimeSvc };
}

function sectionTitles(fixture: { nativeElement: HTMLElement }): string[] {
  return [...fixture.nativeElement.querySelectorAll('.scenario-section__title')].map((n) =>
    (n.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

function rowTitlesBySection(fixture: { nativeElement: HTMLElement }): string[][] {
  return [...fixture.nativeElement.querySelectorAll('.scenario-section')].map((section) =>
    [...section.querySelectorAll('.scenario-row__title')].map((n) => (n.textContent ?? '').trim()),
  );
}

describe('ScenarioList', () => {
  it('liste TOUS les scénarios de la Partie, pas seulement les brouillons', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
    const text = fixture.nativeElement.textContent as string;
    for (const s of ALL) expect(text).toContain(s.title);
  });

  // 🚨 L'ordre des sections est le propos de l'écran : ce qui se prépare, ce qui se joue, ce qui
  // vient, ce qui est derrière. Un tri par statut alphabétique ou par ordre d'arrivée de l'API
  // donnerait un résultat plausible mais dénué de sens.
  it('quatre sections, dans l’ordre Brouillon → Courant → À venir → Passé', async () => {
    const { fixture } = await createComponent();
    expect(sectionTitles(fixture)).toEqual(['Brouillon 2', 'Courant 1', 'À venir 1', 'Passé 2']);
  });

  it('chaque scénario est rangé dans la section de son état, avec son badge', async () => {
    const { fixture } = await createComponent();
    expect(rowTitlesBySection(fixture)).toEqual([
      ['Les Ombres du Passé', 'Le Marché aux Ombres'],
      ['Le Pont de Verre'],
      ['La Route des Lanternes'],
      ['Les Cendres', 'La Vallée Blanche'],
    ]);
    const badges = [...fixture.nativeElement.querySelectorAll('.status-badge')].map((n: Element) =>
      (n.textContent ?? '').trim(),
    );
    expect(badges).toEqual(['Brouillon', 'Brouillon', 'Courant', 'À venir', 'Passé', 'Passé']);
  });

  it('une section sans contenu ne s’affiche pas du tout', async () => {
    const { fixture } = await createComponent([COURANT]);
    expect(sectionTitles(fixture)).toEqual(['Courant 1']);
  });

  it('aucun scénario → un seul message, aucune section vide', async () => {
    const { fixture } = await createComponent([]);
    expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
    expect(sectionTitles(fixture)).toEqual([]);
  });

  // ⚠️ Le bouton n'existe que sur un brouillon : le proposer ailleurs appellerait une transition
  // que le serveur refuse.
  it('« Ouvrir aux joueurs » n’est proposé que sur les brouillons', async () => {
    const { fixture } = await createComponent();
    const rows = [...fixture.nativeElement.querySelectorAll('.scenario-row')];
    const withButton = rows.filter((r) => r.querySelector('button'));
    expect(withButton.length).toBe(2);
    for (const row of withButton) {
      expect(row.textContent).toContain('Brouillon');
    }
  });

  // 🚨 Le scénario publié MIGRE vers « À venir » — il ne disparaît pas. Le faire disparaître (ce
  // que faisait l'onglet du temps où il ne montrait que les brouillons) laisserait croire à une
  // suppression, alors que sa section d'arrivée est juste en dessous.
  it('publier un brouillon le fait migrer de « Brouillon » vers « À venir »', async () => {
    const { fixture, scenariosSvc, router } = await createComponent([DRAFT_1, COURANT]);
    const comp = fixture.componentInstance as any;
    const fakeEvent = { stopPropagation: vi.fn() } as unknown as Event;

    await comp.openToPlayers(DRAFT_1, fakeEvent);
    fixture.detectChanges();

    expect(scenariosSvc.open).toHaveBeenCalledWith('s1');
    expect(sectionTitles(fixture)).toEqual(['Courant 1', 'À venir 1']);
    expect(rowTitlesBySection(fixture)).toEqual([['Le Pont de Verre'], ['Le Marché aux Ombres']]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clic sur « + Nouveau scénario » → navigation vers scenarios/new', async () => {
    const { fixture, router } = await createComponent();
    const comp = fixture.componentInstance as any;
    comp.newScenario();
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 'new']);
  });

  it('clic sur une ligne (hors bouton) → navigation vers le détail avec le scénario en état', async () => {
    const { fixture, router } = await createComponent();
    const comp = fixture.componentInstance as any;
    comp.openScenario(PASSE_1);
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 's5'], {
      state: { scenario: PASSE_1 },
    });
  });

  it('sans [partieId] en entrée (route directe) → repli sur le paramètre de route `:id`', async () => {
    const { scenariosSvc } = await createComponent(ALL, { withInput: false, routeParam: 'p1' });
    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
  });

  it('ni [partieId] ni paramètre de route → message d’erreur, aucun appel API', async () => {
    const { fixture, scenariosSvc, realtimeSvc } = await createComponent([], { withInput: false });
    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBeTruthy();
    expect(scenariosSvc.listAll).not.toHaveBeenCalled();
    expect(realtimeSvc.connect).not.toHaveBeenCalled();
  });

  // Story 53.3 — « Ma situation » du MJ sur chaque ligne de chapitre : « Je mène » quand le chapitre
  // a une séance à venir (`nextSeanceOf`), aucune ligne sinon. L'onglet est MJ seul.
  describe('« Ma situation » sur les chapitres (Story 53.3)', () => {
    function seance(id: string, scenarioId: string, iso: string | null): SeanceDto {
      return {
        id,
        scenarioId,
        dateValidee: iso,
        slotValidee: null,
        compteRendu: null,
        heureRdv: null,
        lieu: null,
        notePratique: null,
        createdAt: '2020-01-01T00:00:00.000Z',
        durationSlots: 1,
        endDate: iso,
        endSlot: null,
        can: { propose: false, edit: false, choose: false, extend: false },
      };
    }

    const AVEC_PROCHAINE: ScenarioDto = {
      ...A_VENIR,
      seances: [
        seance('x1', 's3', '2020-06-12T00:00:00.000Z'),
        seance('x2', 's3', '2099-10-10T00:00:00.000Z'),
      ],
    };
    const SANS_PROCHAINE: ScenarioDto = {
      ...PASSE_1,
      seances: [seance('y1', 's5', '2020-06-12T00:00:00.000Z')],
    };
    const SANS_SEANCE: ScenarioDto = { ...DRAFT_1, seances: [] };

    function situationOf(fixture: { nativeElement: HTMLElement }, title: string) {
      const row = [...fixture.nativeElement.querySelectorAll('.scenario-row')].find((r) =>
        r.querySelector('.scenario-row__title')?.textContent?.includes(title),
      ) as HTMLElement;
      const line = row.querySelector('.situation-line');
      if (!line) return null;
      return {
        label: (line.querySelector('.situation-line__label')?.textContent ?? '').trim(),
        pill: (line.querySelector('.situation-pill')?.textContent ?? '').trim(),
      };
    }

    it('chapitre avec une séance à venir → « Ma situation » + « Je mène »', async () => {
      const { fixture } = await createComponent([AVEC_PROCHAINE]);
      expect(situationOf(fixture, 'La Route des Lanternes')).toEqual({
        label: 'Ma situation',
        pill: 'Je mène',
      });
    });

    it('chapitre sans séance à venir (toutes passées) ou sans séance → aucune ligne', async () => {
      const { fixture } = await createComponent([SANS_PROCHAINE, SANS_SEANCE]);
      expect(situationOf(fixture, 'La Vallée Blanche')).toBeNull();
      expect(situationOf(fixture, 'Le Marché aux Ombres')).toBeNull();
    });

    it('la ligne est du texte seul, jamais « Réponds au vote », et ne gêne pas « Ouvrir aux joueurs »', async () => {
      const brouillon: ScenarioDto = {
        ...DRAFT_1,
        seances: [seance('z1', 's1', '2099-10-10T00:00:00.000Z')],
      };
      const { fixture } = await createComponent([brouillon]);
      const row = fixture.nativeElement.querySelector('.scenario-row') as HTMLElement;
      const line = row.querySelector('.situation-line') as HTMLElement;
      expect(line.querySelector('button, a, input, [role="button"], [tabindex]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Réponds au vote');
      // Le seul bouton de la ligne reste « Ouvrir aux joueurs », hors de la ligne de situation.
      const buttons = [...row.querySelectorAll('button')];
      expect(buttons).toHaveLength(1);
      expect(line.contains(buttons[0])).toBe(false);
    });

    it('le clic sur la ligne de situation ouvre le chapitre (la ligne de chapitre reste cliquable)', async () => {
      const { fixture, router } = await createComponent([AVEC_PROCHAINE]);
      (fixture.nativeElement.querySelector('.situation-pill') as HTMLElement).click();
      expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 's3'], {
        state: { scenario: AVEC_PROCHAINE },
      });
    });
  });

  describe('câblage temps réel (Story 21.2, AC1)', () => {
    it('connect() est appelé avec partieTopic(partieId) au montage — cas [partieId] en entrée', async () => {
      const { realtimeSvc } = await createComponent();
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('connect() est appelé avec partieTopic(partieId) au montage — cas repli route :id', async () => {
      const { realtimeSvc } = await createComponent(ALL, { withInput: false, routeParam: 'p1' });
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('disconnect() est appelé à la destruction du composant', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.destroy();
      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('changed() pour la même Partie déclenche un rechargement', async () => {
      const scenariosSvc = makeScenariosService(ALL);
      const { fixture, scenariosSvc: svc } = await createComponent(ALL, { scenariosSvc });
      const comp = fixture.componentInstance as any;
      svc.listAll.mockResolvedValue([COURANT]);

      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(svc.listAll).toHaveBeenCalledTimes(2);
      expect(comp.scenarioList()).toEqual([COURANT]);
    });

    it('changed() pour une autre Partie ne déclenche AUCUN rechargement', async () => {
      const scenariosSvc = makeScenariosService(ALL);
      const { fixture } = await createComponent(ALL, { scenariosSvc });

      scenariosSvc.changed.set({ partieId: 'autre-partie' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(scenariosSvc.listAll).toHaveBeenCalledTimes(1);
    });

    it('garde firstRun : un changed() déjà non-nul pour cette Partie au montage ne déclenche PAS de refetch redondant', async () => {
      const scenariosSvc = makeScenariosService(ALL);
      scenariosSvc.changed.set({ partieId: 'p1' });
      await createComponent(ALL, { scenariosSvc });

      expect(scenariosSvc.listAll).toHaveBeenCalledTimes(1);
    });
  });
});
