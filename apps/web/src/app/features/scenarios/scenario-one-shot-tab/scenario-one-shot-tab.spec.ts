import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { ScenarioDto } from '@master-jdr/shared';
import { ScenarioOneShotTab } from './scenario-one-shot-tab';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const SCENARIO: ScenarioDto = {
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

function makeScenariosService(drafts: ScenarioDto[] = [SCENARIO], all: ScenarioDto[] = []) {
  return {
    listDrafts: vi.fn().mockResolvedValue(drafts),
    listAll: vi.fn().mockResolvedValue(all),
    open: vi.fn().mockResolvedValue({ ...SCENARIO, status: 'A_VENIR' }),
    listDocuments: vi.fn().mockResolvedValue([]),
    changed: signal<{ partieId: string } | null>(null),
  };
}

async function createComponent(
  drafts: ScenarioDto[] = [SCENARIO],
  all: ScenarioDto[] = [],
  scenariosSvc = makeScenariosService(drafts, all),
) {
  // Story 19.2 (Task 1) : ScenarioEditor (rendu transitivement) ouvre désormais sa propre
  // connexion RealtimeService — mock direct, jsdom n'implémente pas EventSource.
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ScenarioOneShotTab],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: RealtimeService, useValue: realtimeSvc },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScenarioOneShotTab);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, realtimeSvc };
}

describe('ScenarioOneShotTab', () => {
  it('charge le scénario unique via listDrafts() et affiche l’éditeur, avec le bouton Ouvrir', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    expect(scenariosSvc.listDrafts).toHaveBeenCalledWith('p1');
    expect(fixture.nativeElement.querySelector('app-scenario-editor')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.ouvrir_aux_joueurs']);
  });

  it('sans scénario en BROUILLON (déjà ouvert) → retombe sur listAll() et affiche l’éditeur', async () => {
    const opened = { ...SCENARIO, status: 'PASSE' as const };
    const { fixture, scenariosSvc } = await createComponent([], [opened]);
    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
    const comp = fixture.componentInstance as any;
    expect(comp.notFound()).toBe(false);
    expect(comp.scenario()?.status).toBe('PASSE');
    expect(fixture.nativeElement.querySelector('app-scenario-editor')).toBeTruthy();
  });

  it('aucun scénario du tout (listDrafts et listAll vides) → message "aucun scénario trouvé"', async () => {
    const { fixture } = await createComponent([], []);
    const comp = fixture.componentInstance as any;
    expect(comp.notFound()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['scenarios.one_shot_not_found'],
    );
  });

  it('clic sur Ouvrir aux joueurs appelle open() et met à jour le statut affiché (bouton disparaît)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    await comp.openToPlayers();
    expect(scenariosSvc.open).toHaveBeenCalledWith('s1');
    expect(comp.scenario().status).toBe('A_VENIR');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Ouvrir aux joueurs');
  });

  it('échec de open() → message d’erreur affiché', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.open.mockRejectedValue(new Error('fail'));
    await comp.openToPlayers();
    expect(comp.openError()).toBeTruthy();
  });

  describe('câblage temps réel (Story 21.2, AC2)', () => {
    it('connect() est appelé avec partieTopic(partieId) au montage', async () => {
      const { realtimeSvc } = await createComponent();
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('connect() est appelé même sans scénario trouvé (cas notFound)', async () => {
      const { realtimeSvc } = await createComponent([], []);
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('disconnect() est appelé à la destruction du composant', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.destroy();
      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('revue de code : disconnect() vise le partieId capturé à la connexion, pas sa valeur au moment de la destruction', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.componentRef.setInput('partieId', 'p2');
      fixture.detectChanges();

      fixture.destroy();

      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeSvc.disconnect).not.toHaveBeenCalledWith(partieTopic('p2'));
    });

    it('revue de code : un rechargement réussi via changed() efface une erreur de chargement précédente', async () => {
      const scenariosSvc = makeScenariosService([SCENARIO], []);
      scenariosSvc.listDrafts.mockRejectedValueOnce(new Error('network'));
      const { fixture } = await createComponent([SCENARIO], [], scenariosSvc);
      const comp = fixture.componentInstance as any;
      expect(comp.loadError()).toBeTruthy();

      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.loadError()).toBeNull();
      expect(comp.scenario()?.id).toBe(SCENARIO.id);
    });

    it('changed() pour cette Partie recharge le scénario — le bouton « Ouvrir aux joueurs » disparaît si publié ailleurs', async () => {
      const scenariosSvc = makeScenariosService([SCENARIO], []);
      const { fixture } = await createComponent([SCENARIO], [], scenariosSvc);
      const comp = fixture.componentInstance as any;
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.ouvrir_aux_joueurs'],
      );

      // Le scénario a été publié par un co-MJ ailleurs : il ne remonte plus dans listDrafts().
      const opened = { ...SCENARIO, status: 'A_VENIR' as const };
      scenariosSvc.listDrafts.mockResolvedValue([]);
      scenariosSvc.listAll.mockResolvedValue([opened]);

      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
      fixture.detectChanges();

      expect(comp.scenario()?.status).toBe('A_VENIR');
      expect(fixture.nativeElement.textContent).not.toContain('Ouvrir aux joueurs');
    });

    it('changed() pour une autre Partie ne déclenche AUCUN rechargement', async () => {
      const scenariosSvc = makeScenariosService([SCENARIO], []);
      const { fixture } = await createComponent([SCENARIO], [], scenariosSvc);

      scenariosSvc.changed.set({ partieId: 'autre-partie' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(scenariosSvc.listDrafts).toHaveBeenCalledTimes(1);
    });

    it('garde firstRun : un changed() déjà non-nul pour cette Partie au montage ne déclenche PAS de refetch redondant', async () => {
      const scenariosSvc = makeScenariosService([SCENARIO], []);
      scenariosSvc.changed.set({ partieId: 'p1' });
      await createComponent([SCENARIO], [], scenariosSvc);

      expect(scenariosSvc.listDrafts).toHaveBeenCalledTimes(1);
    });
  });
});
