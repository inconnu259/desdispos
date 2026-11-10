import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import type { ScenarioDto } from '@master-jdr/shared';
import { AnnouncementFormComponent } from './announcement-form';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';

function makeScenario(overrides: Partial<ScenarioDto> = {}): ScenarioDto {
  return {
    id: 's1',
    partieId: 'p1',
    title: 'Chapitre 1',
    description: null,
    status: 'COURANT',
    dureeHeures: null,
    dureeSeances: null,
    resumeFin: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    closedAt: null,
    seances: [],
    ...overrides,
  };
}

function makeScenariosService(scenarios: ScenarioDto[]) {
  return {
    listAll: vi.fn().mockResolvedValue(scenarios),
    changed: signal<{ partieId: string } | null>(null),
  };
}

function makeAnnouncementsService() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'ann1',
      partieId: 'p1',
      scenarioId: null,
      text: 'Une annonce',
      createdAt: '2026-07-15T00:00:00.000Z',
    }),
  };
}

function makeThemeService() {
  return {
    tone: () => ({
      'announcement.scope_campaign_label': 'Toute la campagne',
      'announcement.publish_cta': 'Publier',
      'announcement.text_placeholder': 'Écrire une annonce...',
      'announcement.published_notice': 'Annonce publiée.',
      'common.impossible_de_charger_les_scenarios_reessayez':
        'Impossible de charger les scénarios. Réessayez.',
      'announcement.publish_error': 'Impossible de publier l’annonce. Réessayez.',
    }),
  };
}

async function createComponent(
  scenarios: ScenarioDto[] = [],
  announcementsSvc = makeAnnouncementsService(),
  scenariosSvc = makeScenariosService(scenarios),
) {
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [AnnouncementFormComponent],
    providers: [
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: AnnouncementsService, useValue: announcementsSvc },
      { provide: ThemeToneService, useValue: makeThemeService() },
      { provide: RealtimeService, useValue: realtimeSvc },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AnnouncementFormComponent);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, announcementsSvc, realtimeSvc };
}

describe('AnnouncementFormComponent', () => {
  it('AC4 : le sélecteur ne propose que les scénarios COURANT/PASSE, jamais BROUILLON/A_VENIR', async () => {
    const { fixture } = await createComponent([
      makeScenario({ id: 's-brouillon', title: 'Brouillon', status: 'BROUILLON' }),
      makeScenario({ id: 's-avenir', title: 'À venir', status: 'A_VENIR' }),
      makeScenario({ id: 's-courant', title: 'Courant', status: 'COURANT' }),
      makeScenario({ id: 's-passe', title: 'Passé', status: 'PASSE' }),
    ]);

    const optionTexts = fixture.debugElement
      .queryAll(By.css('option'))
      .map((el) => (el.nativeElement as HTMLOptionElement).textContent?.trim());

    expect(optionTexts).not.toContain('Brouillon');
    expect(optionTexts).not.toContain('À venir');
    expect(optionTexts).toContain('Courant');
    expect(optionTexts).toContain('Passé');
  });

  it('AC5 : bouton désactivé si texte vide ou uniquement des espaces, activé sinon', async () => {
    const { fixture } = await createComponent();
    const component = fixture.componentInstance;

    expect(component['isValid']()).toBe(false);

    component['text'].set('   ');
    expect(component['isValid']()).toBe(false);

    component['text'].set('Une vraie annonce');
    expect(component['isValid']()).toBe(true);
  });

  it('AC1 : soumission sans scénario sélectionné appelle create() avec scenarioId undefined', async () => {
    const announcementsSvc = makeAnnouncementsService();
    const { fixture } = await createComponent([], announcementsSvc);
    const component = fixture.componentInstance;

    component['text'].set('Une annonce');
    await component['onSubmit']();

    expect(announcementsSvc.create).toHaveBeenCalledWith('p1', {
      text: 'Une annonce',
      scenarioId: undefined,
    });
  });

  it('AC2 : soumission avec un scénario sélectionné inclut son id', async () => {
    const announcementsSvc = makeAnnouncementsService();
    const { fixture } = await createComponent(
      [makeScenario({ id: 's1', status: 'COURANT' })],
      announcementsSvc,
    );
    const component = fixture.componentInstance;

    component['text'].set('Une annonce scopée');
    component['selectedScenarioId'].set('s1');
    await component['onSubmit']();

    expect(announcementsSvc.create).toHaveBeenCalledWith('p1', {
      text: 'Une annonce scopée',
      scenarioId: 's1',
    });
  });

  it('(published) émis avec le DTO retourné, formulaire réinitialisé après succès', async () => {
    const announcementsSvc = makeAnnouncementsService();
    const { fixture } = await createComponent([], announcementsSvc);
    const component = fixture.componentInstance;
    const emitted: unknown[] = [];
    component.published.subscribe((dto) => emitted.push(dto));

    component['text'].set('Une annonce');
    component['selectedScenarioId'].set('s1');
    await component['onSubmit']();

    expect(emitted).toHaveLength(1);
    expect((emitted[0] as { id: string }).id).toBe('ann1');
    expect(component['text']()).toBe('');
    expect(component['selectedScenarioId']()).toBeNull();
  });

  it('revue de code : échec de listAll() au chargement → error() renseigné, aucune exception non gérée', async () => {
    const scenariosSvc = {
      listAll: vi.fn().mockRejectedValue(new Error('network')),
      changed: signal<{ partieId: string } | null>(null),
    };
    await TestBed.configureTestingModule({
      imports: [AnnouncementFormComponent],
      providers: [
        { provide: ScenariosService, useValue: scenariosSvc },
        { provide: AnnouncementsService, useValue: makeAnnouncementsService() },
        { provide: ThemeToneService, useValue: makeThemeService() },
        { provide: RealtimeService, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AnnouncementFormComponent);
    fixture.componentRef.setInput('partieId', 'p1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['error']()).toBeTruthy();
  });

  it('revue de code : échec de create() → error() renseigné, texte/sélection conservés (pas de reset)', async () => {
    const announcementsSvc = { create: vi.fn().mockRejectedValue(new Error('400')) };
    const { fixture } = await createComponent([], announcementsSvc);
    const component = fixture.componentInstance;

    component['text'].set('Une annonce');
    component['selectedScenarioId'].set('s1');
    await component['onSubmit']();

    expect(component['error']()).toBeTruthy();
    expect(component['text']()).toBe('Une annonce');
    expect(component['selectedScenarioId']()).toBe('s1');
    expect(component['publishing']()).toBe(false);
  });

  describe('câblage temps réel (Story 21.3, AC1)', () => {
    it('connect() est appelé avec partieTopic(partieId) au montage', async () => {
      const { realtimeSvc } = await createComponent();
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('disconnect() est appelé à la destruction du composant', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.destroy();
      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('revue de code : un rechargement réussi via changed() efface une erreur de chargement précédente', async () => {
      const scenariosSvc = {
        listAll: vi.fn().mockRejectedValueOnce(new Error('network')),
        changed: signal<{ partieId: string } | null>(null),
      };
      const { fixture } = await createComponent(
        [],
        makeAnnouncementsService(),
        scenariosSvc as any,
      );
      const comp = fixture.componentInstance as any;
      expect(comp.error()).toBeTruthy();

      scenariosSvc.listAll.mockResolvedValue([makeScenario({ status: 'COURANT' })]);
      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.error()).toBeNull();
    });

    it('revue de code : un rechargement via changed() désélectionne un scénario devenu inéligible', async () => {
      const scenariosSvc = makeScenariosService([makeScenario({ id: 's1', status: 'COURANT' })]);
      const { fixture } = await createComponent(
        [makeScenario({ id: 's1', status: 'COURANT' })],
        makeAnnouncementsService(),
        scenariosSvc,
      );
      const comp = fixture.componentInstance as any;
      comp.selectedScenarioId.set('s1');

      // Le scénario sélectionné a été repassé en BROUILLON par un autre MJ.
      scenariosSvc.listAll.mockResolvedValue([makeScenario({ id: 's1', status: 'BROUILLON' })]);
      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.selectedScenarioId()).toBeNull();
    });

    it('changed() pour cette Partie recharge les scénarios et met à jour le sélecteur', async () => {
      const scenariosSvc = makeScenariosService([]);
      const { fixture } = await createComponent([], makeAnnouncementsService(), scenariosSvc);

      const nowCourant = makeScenario({
        id: 's-nouveau',
        title: 'Nouveau chapitre',
        status: 'COURANT',
      });
      scenariosSvc.listAll.mockResolvedValue([nowCourant]);

      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(scenariosSvc.listAll).toHaveBeenCalledTimes(2);
      const optionTexts = fixture.debugElement
        .queryAll(By.css('option'))
        .map((el) => (el.nativeElement as HTMLOptionElement).textContent?.trim());
      expect(optionTexts).toContain('Nouveau chapitre');
    });

    it('changed() pour une autre Partie ne déclenche AUCUN rechargement', async () => {
      const scenariosSvc = makeScenariosService([]);
      const { fixture } = await createComponent([], makeAnnouncementsService(), scenariosSvc);

      scenariosSvc.changed.set({ partieId: 'autre-partie' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(scenariosSvc.listAll).toHaveBeenCalledTimes(1);
    });

    it('garde firstRun : un changed() déjà non-nul pour cette Partie au montage ne déclenche PAS de refetch redondant', async () => {
      const scenariosSvc = makeScenariosService([]);
      scenariosSvc.changed.set({ partieId: 'p1' });
      await createComponent([], makeAnnouncementsService(), scenariosSvc);

      expect(scenariosSvc.listAll).toHaveBeenCalledTimes(1);
    });
  });
});
