import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { ScenarioDto } from '@master-jdr/shared';
import { ScenarioForm } from './scenario-form';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
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

async function createComponent(partieId = 'p1') {
  const scenariosSvc = { create: vi.fn().mockResolvedValue(SCENARIO) };
  const router = { navigate: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ScenarioForm],
    providers: [
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => partieId } } } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScenarioForm);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, scenariosSvc, router };
}

describe('ScenarioForm', () => {
  it('soumission sans titre → formulaire invalide, create() jamais appelé', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    await comp.submit();
    expect(scenariosSvc.create).not.toHaveBeenCalled();
  });

  it('soumission avec titre seul → create() appelé puis navigation vers le scénario créé', async () => {
    const { fixture, scenariosSvc, router } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    comp.form.patchValue({ title: 'Le Marché aux Ombres' });
    await comp.submit();
    expect(scenariosSvc.create).toHaveBeenCalledWith('p1', {
      title: 'Le Marché aux Ombres',
      description: undefined,
      dureeHeures: undefined,
      dureeSeances: undefined,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 's1'], {
      state: { scenario: SCENARIO },
    });
  });

  it('en cas d’échec de create() (erreur sans message API) → message générique affiché, pas de navigation', async () => {
    const { fixture, scenariosSvc, router } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    scenariosSvc.create.mockRejectedValueOnce(new Error('fail'));
    comp.form.patchValue({ title: 'Titre' });
    await comp.submit();
    expect(comp.error()).toBe(GRIMOIRE_TONE['scenarios.form_save_error']);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('en cas d’échec de create() avec message API (ex. Partie ONE_SHOT) → le vrai message est affiché', async () => {
    const { fixture, scenariosSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    scenariosSvc.create.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Une Partie de type ONE_SHOT ne peut pas avoir plusieurs scénarios.' },
      }),
    );
    comp.form.patchValue({ title: 'Titre' });
    await comp.submit();
    expect(comp.error()).toBe('Une Partie de type ONE_SHOT ne peut pas avoir plusieurs scénarios.');
  });
});
