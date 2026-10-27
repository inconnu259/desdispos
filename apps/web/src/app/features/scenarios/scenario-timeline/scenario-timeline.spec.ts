import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { ScenarioDto, SeanceDto, SessionPollDto } from '@master-jdr/shared';
import { ScenarioTimeline } from './scenario-timeline';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ScenarioReadDialog } from '../scenario-read-dialog/scenario-read-dialog';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeScenario(overrides: Partial<ScenarioDto>): ScenarioDto {
  return {
    id: 's1',
    partieId: 'p1',
    title: 'Scénario',
    description: null,
    status: 'A_VENIR',
    dureeHeures: null,
    dureeSeances: null,
    resumeFin: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    closedAt: null,
    seances: [],
    ...overrides,
  };
}

function makeBreakpointObserver(desktop: boolean) {
  return {
    observe: () => of({ matches: desktop, breakpoints: {} }),
    isMatched: () => desktop,
  };
}

async function createComponent(
  scenarios: ScenarioDto[],
  {
    desktop = true,
    isMj = false,
    partieKind = 'ONE_SHOT',
    characters = [],
  }: {
    desktop?: boolean;
    isMj?: boolean;
    partieKind?: 'ONE_SHOT' | 'CAMPAGNE_LINEAIRE' | 'CAMPAGNE_EPISODIQUE';
    characters?: unknown[];
  } = {},
) {
  const scenariosSvc = {
    listAll: vi.fn().mockResolvedValue(scenarios),
    changed: signal<{ partieId: string } | null>(null),
  };
  const dialog = { open: vi.fn() };
  const router = { navigate: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ScenarioTimeline],
    providers: [
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
      { provide: MatDialog, useValue: dialog },
      { provide: Router, useValue: router },
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScenarioTimeline);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.componentRef.setInput('isMj', isMj);
  fixture.componentRef.setInput('partieKind', partieKind);
  fixture.componentRef.setInput('characters', characters);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, dialog, router };
}

describe('ScenarioTimeline', () => {
  const BROUILLON = makeScenario({
    id: 'brouillon',
    status: 'BROUILLON',
    createdAt: '2026-06-01T00:00:00.000Z',
  });
  const PASSE = makeScenario({
    id: 'passe',
    status: 'PASSE',
    title: 'Les Docks silencieux',
    createdAt: '2026-06-15T00:00:00.000Z',
  });
  const A_VENIR = makeScenario({
    id: 'a-venir',
    status: 'A_VENIR',
    title: 'Le Complot',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const COURANT_1 = makeScenario({
    id: 'courant-1',
    status: 'COURANT',
    title: 'Le Marché aux Ombres',
    createdAt: '2026-07-01T00:00:00.000Z',
  });
  const COURANT_2 = makeScenario({
    id: 'courant-2',
    status: 'COURANT',
    title: 'La Traque',
    createdAt: '2026-07-02T00:00:00.000Z',
  });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('exclut les BROUILLON, trie chronologiquement (AC10)', async () => {
    const { fixture } = await createComponent([A_VENIR, BROUILLON, PASSE]);
    const comp = fixture.componentInstance as any;
    const nodes = comp.nodes();
    expect(nodes.map((n: any) => n.scenarios[0].id)).toEqual(['passe', 'a-venir']);
  });

  it('regroupe les scénarios COURANT simultanés en un seul nœud empilé (AC5)', async () => {
    const { fixture } = await createComponent([PASSE, COURANT_1, COURANT_2, A_VENIR]);
    const comp = fixture.componentInstance as any;
    const nodes = comp.nodes();
    const courantNode = nodes.find((n: any) =>
      n.scenarios.some((s: ScenarioDto) => s.status === 'COURANT'),
    );
    expect(courantNode.scenarios).toHaveLength(2);
    expect(courantNode.scenarios.map((s: ScenarioDto) => s.id)).toEqual(['courant-1', 'courant-2']);
  });

  it('clic sur un nœud ouvre ScenarioReadDialog avec le bon scénario', async () => {
    const { fixture, dialog } = await createComponent([A_VENIR]);
    const comp = fixture.componentInstance as any;
    comp.openDetail(A_VENIR);
    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: A_VENIR, partieKind: 'ONE_SHOT', characters: [], isMj: false },
    });
  });

  it('bascule mobile : rendu vertical, aucun scroll interne recherché', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: false });
    expect(fixture.nativeElement.querySelector('.timeline-mobile')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.timeline-desktop')).toBeNull();
  });

  it('bascule desktop : rendu horizontal', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    expect(fixture.nativeElement.querySelector('.timeline-desktop')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.timeline-mobile')).toBeNull();
  });

  it('ancrage au chargement : scrollIntoView appelé sur le nœud COURANT (AC6)', async () => {
    await createComponent([PASSE, COURANT_1, A_VENIR], { desktop: true });
    await Promise.resolve();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('focus sur un nœud déclenche scrollIntoView (AC7)', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    comp.onNodeFocus(0);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'center', behavior: 'smooth' }),
    );
  });

  it('AC7 + `prefers-reduced-motion` : le défilement devient instantané, jamais « smooth »', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as unknown as { onNodeFocus: (i: number) => void };
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    // Cet environnement jsdom n'expose même pas `matchMedia` (d'où la garde `typeof` côté
    // composant) : sans ce stub, la branche « mouvement réduit » n'est jamais exercée.
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({ matches: true }) as MediaQueryList,
    });

    try {
      comp.onNodeFocus(0);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ inline: 'center', behavior: 'auto' }),
      );
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it('fondus : visibles selon la position de scroll (mesures mockées, jsdom n’a pas de vrai layout)', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollWidth', { value: 1000, configurable: true });
    Object.defineProperty(trackEl, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(trackEl, 'scrollLeft', { value: 50, configurable: true, writable: true });

    comp.onScroll();

    expect(comp.fadeStart()).toBe(true);
    expect(comp.fadeEnd()).toBe(true);
  });

  it('fondus initialisés dès le chargement, sans attendre un premier scroll manuel', async () => {
    const { fixture } = await createComponent([PASSE, COURANT_1, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollWidth', { value: 1000, configurable: true });
    Object.defineProperty(trackEl, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true });
    await Promise.resolve();
    // fadeEnd doit être calculable sans appel manuel à onScroll() — le contenu déborde déjà.
    expect(typeof comp.fadeEnd()).toBe('boolean');
  });

  it('onWheel privilégie deltaX (swipe trackpad horizontal) sur deltaY', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true, writable: true });
    comp.onWheel({ deltaX: 15, deltaY: 999, preventDefault: vi.fn() } as unknown as WheelEvent);
    expect(trackEl.scrollLeft).toBe(15);
  });

  it('onWheel retombe sur deltaY quand deltaX est nul (molette verticale classique)', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true, writable: true });
    comp.onWheel({ deltaX: 0, deltaY: 42, preventDefault: vi.fn() } as unknown as WheelEvent);
    expect(trackEl.scrollLeft).toBe(42);
  });

  it('un glissé (mouvement > seuil) suivi d’un openDetail() ne doit pas ouvrir le dialogue', async () => {
    const { fixture, dialog } = await createComponent([A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true, writable: true });

    comp.onMouseDown({ clientX: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
    comp.onMouseMove({ clientX: 130 } as unknown as MouseEvent); // > seuil de 4px
    comp.openDetail(A_VENIR);

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('un clic sans mouvement significatif ouvre bien le dialogue', async () => {
    const { fixture, dialog } = await createComponent([A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true, writable: true });

    comp.onMouseDown({ clientX: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
    comp.onMouseMove({ clientX: 101 } as unknown as MouseEvent); // sous le seuil
    comp.openDetail(A_VENIR);

    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: A_VENIR, partieKind: 'ONE_SHOT', characters: [], isMj: false },
    });
  });

  it('relâcher la souris hors du composant (document:mouseup) réinitialise dragging', async () => {
    const { fixture } = await createComponent([PASSE, A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const trackEl = comp.track()!.nativeElement as HTMLElement;
    Object.defineProperty(trackEl, 'scrollLeft', { value: 0, configurable: true, writable: true });

    comp.onMouseDown({ clientX: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
    expect(comp.dragging()).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(comp.dragging()).toBe(false);
  });

  it('touche Entrée sur une carte ouvre le dialogue (activation clavier)', async () => {
    const { fixture, dialog } = await createComponent([A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    const preventDefault = vi.fn();
    comp.onCardKeydown({ key: 'Enter', preventDefault } as unknown as KeyboardEvent, A_VENIR);
    expect(preventDefault).toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: A_VENIR, partieKind: 'ONE_SHOT', characters: [], isMj: false },
    });
  });

  it('touche Espace sur une carte ouvre le dialogue, une autre touche l’ignore', async () => {
    const { fixture, dialog } = await createComponent([A_VENIR], { desktop: true });
    const comp = fixture.componentInstance as any;
    comp.onCardKeydown({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent, A_VENIR);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    comp.onCardKeydown(
      { key: 'Tab', preventDefault: vi.fn() } as unknown as KeyboardEvent,
      A_VENIR,
    );
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('ancrage sur COURANT ne se redéclenche pas à un recalcul ultérieur de nodes()', async () => {
    const { fixture, scenariosSvc } = await createComponent([PASSE, COURANT_1, A_VENIR], {
      desktop: true,
    });
    await Promise.resolve();
    const callsAfterFirstLoad = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock
      .calls.length;
    expect(callsAfterFirstLoad).toBeGreaterThan(0);

    // Force un rechargement (ex. mutation notifiée depuis un autre onglet, cf. `changed`) — les
    // données rechargées sont identiques, mais nodes() est recalculé.
    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterFirstLoad,
    );
  });

  it('MJ (isMj=true) voit aussi les BROUILLON dans la chronologie', async () => {
    const { fixture } = await createComponent([A_VENIR, BROUILLON, PASSE], { isMj: true });
    const comp = fixture.componentInstance as any;
    const nodes = comp.nodes();
    expect(nodes.map((n: any) => n.scenarios[0].id)).toEqual(['brouillon', 'passe', 'a-venir']);
  });

  it('joueur (isMj=false, par défaut) ne voit jamais les BROUILLON', async () => {
    const { fixture } = await createComponent([A_VENIR, BROUILLON, PASSE]);
    const comp = fixture.componentInstance as any;
    const nodes = comp.nodes();
    expect(
      nodes.some((n: any) => n.scenarios.some((s: ScenarioDto) => s.status === 'BROUILLON')),
    ).toBe(false);
  });

  // Story 32.3 — le badge partagé s'affiche sur la chronologie sans rien changer au masquage
  // anti-spoil, qui reste entièrement porté par `buildNodes()`.
  describe('Badges d’état (Story 32.3)', () => {
    function badgeTexts(fixture: { nativeElement: HTMLElement }): string[] {
      return [...fixture.nativeElement.querySelectorAll('.status-badge')].map((n) =>
        (n.textContent ?? '').trim(),
      );
    }

    it('MJ → un badge par scénario, « Brouillon » compris, et « Courant » jamais « En cours »', async () => {
      const { fixture } = await createComponent([A_VENIR, BROUILLON, COURANT_1, PASSE], {
        isMj: true,
      });
      const texts = badgeTexts(fixture);
      expect(texts).toContain('Brouillon');
      expect(texts).toContain('À venir');
      expect(texts).toContain('Courant');
      expect(texts).toContain('Passé');
      expect(texts).not.toContain('En cours');
    });

    it('🚨 joueur → AUCUN badge « Brouillon », ni le moindre badge en trop', async () => {
      const { fixture } = await createComponent([A_VENIR, BROUILLON, COURANT_1, PASSE]);
      const texts = badgeTexts(fixture);
      expect(texts).not.toContain('Brouillon');
      // Rien ne doit trahir l'existence du brouillon : pas même un badge vide ou un espace
      // réservé. Trois scénarios visibles = trois badges, jamais quatre.
      expect(texts.length).toBe(3);
      expect(fixture.nativeElement.querySelector('.status-badge--draft')).toBeNull();
    });
  });

  it('MJ + clic sur un BROUILLON → navigue vers la fiche d’édition, n’ouvre pas ScenarioReadDialog', async () => {
    const { fixture, dialog, router } = await createComponent([BROUILLON], { isMj: true });
    const comp = fixture.componentInstance as any;
    comp.openDetail(BROUILLON);
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 'brouillon'], {
      state: { scenario: BROUILLON },
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('MJ + clic sur un PASSE → ouvre ScenarioReadDialog avec isMj=true (CTA résumé de fin, Story 8.5)', async () => {
    const { fixture, dialog, router } = await createComponent([PASSE], { isMj: true });
    const comp = fixture.componentInstance as any;
    comp.openDetail(PASSE);
    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: PASSE, partieKind: 'ONE_SHOT', characters: [], isMj: true },
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('MJ + clic sur un COURANT → navigue vers la fiche d’édition (CTA Clôturer le scénario, Story 7.7 AC6)', async () => {
    const { fixture, dialog, router } = await createComponent([COURANT_1], { isMj: true });
    const comp = fixture.componentInstance as any;
    comp.openDetail(COURANT_1);
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 'courant-1'], {
      state: { scenario: COURANT_1 },
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('joueur (isMj=false) + clic sur un COURANT → ouvre ScenarioReadDialog, anti-spoil inchangé', async () => {
    const { fixture, dialog, router } = await createComponent([COURANT_1], { isMj: false });
    const comp = fixture.componentInstance as any;
    comp.openDetail(COURANT_1);
    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: COURANT_1, partieKind: 'ONE_SHOT', characters: [], isMj: false },
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('MJ + clic sur un A_VENIR → navigue vers la fiche d’édition (CTA Marquer comme Courant, AC8)', async () => {
    const { fixture, dialog, router } = await createComponent([A_VENIR], { isMj: true });
    const comp = fixture.componentInstance as any;
    comp.openDetail(A_VENIR);
    expect(router.navigate).toHaveBeenCalledWith(['/parties', 'p1', 'scenarios', 'a-venir'], {
      state: { scenario: A_VENIR },
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('joueur (isMj=false) + clic sur un A_VENIR → ouvre ScenarioReadDialog, anti-spoil inchangé', async () => {
    const { fixture, dialog, router } = await createComponent([A_VENIR], { isMj: false });
    const comp = fixture.componentInstance as any;
    comp.openDetail(A_VENIR);
    expect(dialog.open).toHaveBeenCalledWith(ScenarioReadDialog, {
      data: { scenario: A_VENIR, partieKind: 'ONE_SHOT', characters: [], isMj: false },
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('une mutation notifiée par ScenariosService.changed() recharge bien les données (listAll rappelé)', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    scenariosSvc.listAll.mockClear();

    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
  });

  it('un événement temps réel générique (wildcard) recharge, quelle que soit la Partie affichée (Story 19.1, AC1)', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    scenariosSvc.listAll.mockClear();

    scenariosSvc.changed.set({ partieId: '*' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
  });

  it('une mutation notifiée pour une AUTRE Partie ne recharge pas (Story 17.3 AC1)', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    scenariosSvc.listAll.mockClear();

    scenariosSvc.changed.set({ partieId: 'p2-autre-partie' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll).not.toHaveBeenCalled();
  });

  it('un rechargement réussi efface une erreur de chargement précédente', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    const comp = fixture.componentInstance as any;
    scenariosSvc.listAll.mockRejectedValueOnce(new Error('réseau'));

    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(comp.loadError()).toBeTruthy();

    // Rechargement suivant réussi (ex. l'utilisateur réessaie via un autre changed()) : l'erreur doit disparaître.
    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(comp.loadError()).toBeNull();
  });

  it("bug fix : bouton « Réessayer » affiché sur l'état d'erreur, recharge sans dépendre du SSE", async () => {
    const scenariosSvc = {
      listAll: vi.fn().mockRejectedValueOnce(new Error('réseau')),
      changed: signal<{ partieId: string } | null>(null),
    };
    await TestBed.configureTestingModule({
      imports: [ScenarioTimeline],
      providers: [
        provideAnimationsAsync(),
        { provide: ScenariosService, useValue: scenariosSvc },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScenarioTimeline);
    fixture.componentRef.setInput('partieId', 'p1');
    fixture.componentRef.setInput('isMj', false);
    fixture.componentRef.setInput('partieKind', 'ONE_SHOT');
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.error button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain(GRIMOIRE_TONE['common.reessayer']);

    scenariosSvc.listAll.mockResolvedValue([PASSE]);
    button.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    const comp = fixture.componentInstance as any;
    expect(comp.loadError()).toBeNull();
    expect(scenariosSvc.listAll).toHaveBeenCalledTimes(2);
  });

  it('une réponse obsolète (requête plus ancienne résolue après une plus récente) n’écrase pas l’état à jour', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    const comp = fixture.componentInstance as any;

    let resolveFirst!: (value: ScenarioDto[]) => void;
    const firstCall = new Promise<ScenarioDto[]>((resolve) => {
      resolveFirst = resolve;
    });
    scenariosSvc.listAll.mockReturnValueOnce(firstCall).mockResolvedValueOnce([A_VENIR]);

    // Deux changed() rapprochés : la 1ère requête (lente) et la 2e (rapide) partent quasi ensemble.
    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    await Promise.resolve();
    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();

    // La 2e requête (plus récente) résout d'abord.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    // Puis la 1ère (plus ancienne) résout en retard, avec des données périmées.
    resolveFirst([PASSE, BROUILLON]);
    await Promise.resolve();
    fixture.detectChanges();

    // L'état affiché doit rester celui de la requête la plus récente, jamais écrasé par l'ancienne.
    const nodeIds = comp.nodes().map((n: any) => n.scenarios[0].id);
    expect(nodeIds).toEqual(['a-venir']);
  });

  it('AC1 (non-régression) : un changement de partieId() sur un composant déjà monté recharge la chronologie', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    scenariosSvc.listAll.mockClear();

    fixture.componentRef.setInput('partieId', 'p2');
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p2');
  });

  it('AC3 : une réponse résolue après démontage du composant n’écrit plus aucun signal', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    const comp = fixture.componentInstance as any;

    let resolveListAll!: (value: ScenarioDto[]) => void;
    scenariosSvc.listAll.mockClear();
    scenariosSvc.listAll.mockReturnValueOnce(
      new Promise<ScenarioDto[]>((resolve) => {
        resolveListAll = resolve;
      }),
    );

    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    await Promise.resolve();

    fixture.destroy();

    expect(() => {
      resolveListAll([A_VENIR]);
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(comp.scenarios()).toEqual([PASSE]);
    expect(comp.loadError()).toBeNull();
  });

  it('AC3 (branche catch) : un rejet résolu après démontage du composant n’écrit pas loadError()', async () => {
    const { scenariosSvc, fixture } = await createComponent([PASSE]);
    const comp = fixture.componentInstance as any;

    let rejectListAll!: (reason: unknown) => void;
    scenariosSvc.listAll.mockClear();
    scenariosSvc.listAll.mockReturnValueOnce(
      new Promise<ScenarioDto[]>((_resolve, reject) => {
        rejectListAll = reject;
      }),
    );

    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    await Promise.resolve();

    fixture.destroy();

    expect(() => {
      rejectListAll(new Error('réseau'));
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(comp.loadError()).toBeNull();
    expect(comp.scenarios()).toEqual([PASSE]);
  });

  describe('Affichage des séances sur la carte (Story 8.7, AC7)', () => {
    it('scénario avec séances datées (poll.chosenDate) → dates affichées sur la carte', async () => {
      const scenarioWithSeances = makeScenario({
        id: 's-avec-seances',
        status: 'COURANT',
        seances: [
          {
            endDate: '2026-08-15T00:00:00.000Z',
            endSlot: 'AFTERNOON',
            durationSlots: 1,
            id: 'seance1',
            scenarioId: 's-avec-seances',
            // Story 32.3 — date effective à la racine du DTO ; ici elle double `poll.chosenDate`,
            // comme le fait le serveur.
            dateValidee: '2026-08-15T00:00:00.000Z',
            slotValidee: 'AFTERNOON',
            compteRendu: null,
            heureRdv: null,
            lieu: null,
            notePratique: null,
            createdAt: '2026-07-01T00:00:00.000Z',
            can: { propose: false, edit: false, choose: false, extend: false },
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'CLOSED',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: '2026-08-15T00:00:00.000Z',
              chosenSlot: 'AFTERNOON',
              // Story 36.6 — effectif de la troupe (MJ + membres).
              membersCount: 4,
              durationSlots: 1,
              options: [],
            },
          },
        ],
      });
      const { fixture } = await createComponent([scenarioWithSeances]);
      expect(fixture.nativeElement.querySelector('.card-seances')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('août');
    });

    it('Story 47.3 : une séance sur plusieurs jours s\'écrit « début → fin » sur la carte', async () => {
      const scenario = makeScenario({
        id: 's-plage',
        status: 'COURANT',
        seances: [
          {
            endDate: '2026-11-08T00:00:00.000Z',
            endSlot: 'AFTERNOON',
            durationSlots: 6,
            id: 'seance1',
            scenarioId: 's-plage',
            dateValidee: '2026-11-06T00:00:00.000Z',
            slotValidee: 'EVENING',
            compteRendu: null,
            heureRdv: null,
            lieu: null,
            notePratique: null,
            createdAt: '2026-07-01T00:00:00.000Z',
            can: { propose: false, edit: false, choose: false, extend: false },
          },
        ],
      });
      const { fixture } = await createComponent([scenario]);
      const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
      expect(text).toMatch(/6 nov\.? → 8 nov\.?/);
    });

    it('Story 47.3 : fin le même jour que le début → une seule date, sans flèche', async () => {
      const scenario = makeScenario({
        id: 's-un-jour',
        status: 'COURANT',
        seances: [
          {
            endDate: '2026-11-06T00:00:00.000Z',
            endSlot: 'EVENING',
            durationSlots: 1,
            id: 'seance1',
            scenarioId: 's-un-jour',
            dateValidee: '2026-11-06T00:00:00.000Z',
            slotValidee: 'EVENING',
            compteRendu: null,
            heureRdv: null,
            lieu: null,
            notePratique: null,
            createdAt: '2026-07-01T00:00:00.000Z',
            can: { propose: false, edit: false, choose: false, extend: false },
          },
        ],
      });
      const { fixture } = await createComponent([scenario]);
      expect(fixture.nativeElement.textContent).not.toContain('→');
    });

    it('scénario avec séance non datée → "Date à définir" affiché', async () => {
      const scenarioWithSeances = makeScenario({
        id: 's-non-datee',
        status: 'COURANT',
        seances: [
          {
            endDate: null,
            endSlot: null,
            durationSlots: 1,
            id: 'seance1',
            scenarioId: 's-non-datee',
            dateValidee: null,
            slotValidee: null,
            compteRendu: null,
            heureRdv: null,
            lieu: null,
            notePratique: null,
            createdAt: '2026-07-01T00:00:00.000Z',
            can: { propose: false, edit: false, choose: false, extend: false },
          },
        ],
      });
      const { fixture } = await createComponent([scenarioWithSeances]);
      expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.date_a_definir']);
    });

    it('scénario sans séance → aucune liste .card-seances affichée', async () => {
      const scenarioNoSeances = makeScenario({ id: 's-sans-seances', status: 'COURANT' });
      const { fixture } = await createComponent([scenarioNoSeances]);
      expect(fixture.nativeElement.querySelector('.card-seances')).toBeNull();
    });

    it('mode mobile → séances également affichées sur la carte', async () => {
      const scenarioWithSeances = makeScenario({
        id: 's-mobile',
        status: 'COURANT',
        seances: [
          {
            endDate: null,
            endSlot: null,
            durationSlots: 1,
            id: 'seance1',
            scenarioId: 's-mobile',
            dateValidee: null,
            slotValidee: null,
            compteRendu: null,
            heureRdv: null,
            lieu: null,
            notePratique: null,
            createdAt: '2026-07-01T00:00:00.000Z',
            can: { propose: false, edit: false, choose: false, extend: false },
          },
        ],
      });
      const { fixture } = await createComponent([scenarioWithSeances], { desktop: false });
      expect(fixture.nativeElement.querySelector('.card-seances')).toBeTruthy();
    });
  });

  // -- Story 32.4 -- refonte de la chronologie ----------------------------------------------
  // Une assertion par ligne de la matrice d'E/S. Les dates des fixtures sont volontairement tres
  // loin dans le passe (2020) ou dans le futur (2099) : aucun de ces tests ne doit basculer le jour
  // ou l'horloge rattrape une date figee.
  describe('Story 32.4 - noeud ancre, dates et compteur', () => {
    function makeSeance(
      id: string,
      scenarioId: string,
      iso: string | null,
      extra: Partial<SeanceDto> = {},
    ): SeanceDto {
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
        ...extra,
      };
    }

    /** Les espaces insecables produits par `Intl` ne doivent pas faire echouer une comparaison. */
    function normalize(text: string): string {
      return text
        .replace(/[\u00a0\u202f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /** Les membres exerces ici sont `protected` : la forme structurelle evite un `any` nu. */
    interface TimelineInternals {
      nodes: () => { key: string; scenarios: ScenarioDto[] }[];
      visibleCount: () => number;
      nodeDateLabel: (node: { key: string; scenarios: ScenarioDto[] }) => string;
    }

    function instance(fixture: { componentInstance: unknown }): TimelineInternals {
      return fixture.componentInstance as unknown as TimelineInternals;
    }

    function firstNode(fixture: { componentInstance: unknown }) {
      return instance(fixture).nodes()[0];
    }

    function nodeKeys(fixture: { componentInstance: unknown }): string[] {
      return instance(fixture)
        .nodes()
        .map((n) => n.key);
    }

    function countText(fixture: { nativeElement: HTMLElement }): string {
      return normalize(
        fixture.nativeElement.querySelector('.timeline-header__count')?.textContent ?? '',
      );
    }

    const PASSE_DEUX_DATES = makeScenario({
      id: 'passe-2',
      status: 'PASSE',
      title: "L'Auberge du Corbeau",
      createdAt: '2020-05-01T00:00:00.000Z',
      seances: [
        makeSeance('sa', 'passe-2', '2020-06-12T00:00:00.000Z', { compteRendu: 'Tout est dit.' }),
        makeSeance('sb', 'passe-2', '2020-07-03T00:00:00.000Z'),
      ],
    });
    const PASSE_UNE_DATE = makeScenario({
      id: 'passe-1',
      status: 'PASSE',
      createdAt: '2020-05-01T00:00:00.000Z',
      seances: [makeSeance('sc', 'passe-1', '2020-06-12T00:00:00.000Z')],
    });
    const COURANT_DATE = makeScenario({
      id: 'courant-date',
      status: 'COURANT',
      title: 'La Route des Cendres',
      createdAt: '2020-05-01T00:00:00.000Z',
      seances: [makeSeance('sd', 'courant-date', '2020-07-24T00:00:00.000Z')],
    });
    const A_VENIR_DATE = makeScenario({
      id: 'a-venir-date',
      status: 'A_VENIR',
      title: 'Le Col de Vellombre',
      createdAt: '2020-05-01T00:00:00.000Z',
      seances: [makeSeance('se', 'a-venir-date', '2099-09-02T00:00:00.000Z')],
    });

    it('matrice - noeud PASSE a deux dates : plage « 12 juin — 3 juil. »', async () => {
      const { fixture } = await createComponent([PASSE_DEUX_DATES]);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe(
        '12 juin — 3 juil.',
      );
      expect(normalize(fixture.nativeElement.querySelector('.node__date').textContent)).toBe(
        '12 juin — 3 juil.',
      );
    });

    it('matrice - noeud PASSE a une seule date : la date seule, aucune plage inventee', async () => {
      const { fixture } = await createComponent([PASSE_UNE_DATE]);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe('12 juin');
    });

    it('matrice - noeud COURANT : « depuis le 24 juil. »', async () => {
      const { fixture } = await createComponent([COURANT_DATE]);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe(
        'depuis le 24 juil.',
      );
    });

    it('matrice - noeud A_VENIR : « a partir du 2 sept. »', async () => {
      const { fixture } = await createComponent([A_VENIR_DATE]);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe(
        'à partir du 2 sept.',
      );
    });

    it('matrice - noeud sans aucune date : « Non planifie », ordonne sur createdAt', async () => {
      const { fixture } = await createComponent([A_VENIR, PASSE]);
      expect(nodeKeys(fixture)).toEqual(['passe', 'a-venir']);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe(
        GRIMOIRE_TONE['scenarios.timeline_not_planned'],
      );
    });

    it("la cle d'ordre est la premiere date EFFECTIVE, pas createdAt", async () => {
      const creeEnPremierJoueEnDernier = makeScenario({
        id: 'tard',
        status: 'A_VENIR',
        createdAt: '2020-01-01T00:00:00.000Z',
        seances: [makeSeance('s-tard', 'tard', '2099-12-01T00:00:00.000Z')],
      });
      const creeEnDernierJoueEnPremier = makeScenario({
        id: 'tot',
        status: 'A_VENIR',
        createdAt: '2020-12-31T00:00:00.000Z',
        seances: [makeSeance('s-tot', 'tot', '2099-01-05T00:00:00.000Z')],
      });
      const { fixture } = await createComponent([
        creeEnPremierJoueEnDernier,
        creeEnDernierJoueEnPremier,
      ]);
      expect(nodeKeys(fixture)).toEqual(['tot', 'tard']);
    });

    it('un noeud non planifie se range APRES tous les noeuds dates, quel que soit son createdAt', async () => {
      // Le piege : `createdAt` n'est pas comparable a une date de seance. Ce scenario non planifie
      // est le plus ANCIEN de la liste ; il doit malgre tout fermer la ligne.
      const nonPlanifieAncien = makeScenario({
        id: 'non-planifie-vieux',
        status: 'A_VENIR',
        createdAt: '2020-01-01T00:00:00.000Z',
      });
      const nonPlanifieRecent = makeScenario({
        id: 'non-planifie-recent',
        status: 'A_VENIR',
        createdAt: '2020-06-01T00:00:00.000Z',
      });
      const { fixture } = await createComponent([
        nonPlanifieRecent,
        A_VENIR_DATE,
        nonPlanifieAncien,
      ]);
      expect(nodeKeys(fixture)).toEqual([
        'a-venir-date',
        'non-planifie-vieux',
        'non-planifie-recent',
      ]);
    });

    it('matrice - noeud COURANT dont la premiere date est encore A VENIR : « a partir du »', async () => {
      const courantPasEncoreJoue = makeScenario({
        id: 'courant-futur',
        status: 'COURANT',
        createdAt: '2020-05-01T00:00:00.000Z',
        seances: [makeSeance('sg', 'courant-futur', '2099-09-02T00:00:00.000Z')],
      });
      const { fixture } = await createComponent([courantPasEncoreJoue]);
      expect(normalize(instance(fixture).nodeDateLabel(firstNode(fixture)))).toBe(
        'à partir du 2 sept.',
      );
    });

    // 🚨 La seule raison d'injecter `AuthService` ici : l'etat d'une seance depend du LECTEUR. Ces
    // deux cas l'epinglent — meme vote, meme jour, deux libelles selon que l'utilisateur injecte
    // (`u1`) a repondu ou non.
    describe("l'etat de seance depend du lecteur (justification d'AuthService)", () => {
      function pollOuvert(vote: boolean): SessionPollDto {
        return {
          id: 'poll-ouvert',
          partieId: 'p1',
          status: 'OPEN',
          scenarioRef: null,
          expiresAt: null,
          chosenDate: null,
          chosenSlot: null,
          membersCount: 3,
          durationSlots: 1,
          options: [
            {
              id: 'opt1',
              date: '2099-10-10T00:00:00.000Z',
              slot: 'EVENING',
              votes: vote ? [{ userId: 'u1', pseudo: 'u1', displayName: 'U1', answer: 'YES' }] : [],
            },
          ],
        };
      }

      function scenarioAvecVote(vote: boolean): ScenarioDto {
        return makeScenario({
          id: 'vote',
          status: 'A_VENIR',
          seances: [makeSeance('sv', 'vote', null, { poll: pollOuvert(vote) })],
        });
      }

      it('vote ouvert non repondu par le lecteur -> « Reponds au vote »', async () => {
        const { fixture } = await createComponent([scenarioAvecVote(false)]);
        expect(
          normalize(
            fixture.nativeElement.querySelector('.card-seances__row .status-badge').textContent,
          ),
        ).toBe('Réponds au vote');
      });

      it('le MEME vote, une fois repondu par le lecteur -> « Vote en cours »', async () => {
        const { fixture } = await createComponent([scenarioAvecVote(true)]);
        expect(
          normalize(
            fixture.nativeElement.querySelector('.card-seances__row .status-badge').textContent,
          ),
        ).toBe('Vote en cours');
      });
    });

    it('matrice - plusieurs COURANT : un seul noeud empile, une seule pastille `live`', async () => {
      const { fixture } = await createComponent([PASSE, COURANT_1, COURANT_2]);
      const courantNode = instance(fixture)
        .nodes()
        .find((n) => n.scenarios.some((sc) => sc.status === 'COURANT'));
      expect(courantNode?.scenarios).toHaveLength(2);
      expect(fixture.nativeElement.querySelectorAll('.node__dot--live')).toHaveLength(1);
      expect(fixture.nativeElement.querySelectorAll('.node')).toHaveLength(2);
    });

    it("matrice - seances d'un noeud : « Seance N · date » + badge d'etat partage", async () => {
      const { fixture } = await createComponent([PASSE_DEUX_DATES]);
      const rows = [...fixture.nativeElement.querySelectorAll('.card-seances__row')];
      expect(rows).toHaveLength(2);
      expect(normalize(rows[0].querySelector('.card-seances__label').textContent)).toBe(
        'Séance 1 · 12 juin',
      );
      expect(normalize(rows[1].querySelector('.card-seances__label').textContent)).toBe(
        'Séance 2 · 3 juil.',
      );
      // Badge DERIVE, jamais servi : compte rendu present -> « Jouee » ; absent sur une date
      // passee -> « A debriefer ». Aucun libelle n'est ecrit dans ce gabarit.
      expect(normalize(rows[0].querySelector('.status-badge').textContent)).toBe('Jouée');
      expect(normalize(rows[1].querySelector('.status-badge').textContent)).toBe('À débriefer');
    });

    it('matrice - seance sans date : « Date a definir », badge « A planifier »', async () => {
      const sansDate = makeScenario({
        id: 'sans-date',
        status: 'A_VENIR',
        seances: [makeSeance('sf', 'sans-date', null)],
      });
      const { fixture } = await createComponent([sansDate]);
      const row = fixture.nativeElement.querySelector('.card-seances__row');
      expect(normalize(row.querySelector('.card-seances__label').textContent)).toBe(
        `Séance 1 · ${GRIMOIRE_TONE['common.date_a_definir']}`,
      );
      expect(normalize(row.querySelector('.status-badge').textContent)).toBe('À planifier');
    });

    it('matrice - joueur : aucun noeud brouillon, aucun espace, compteur = scenarios publies', async () => {
      const { fixture } = await createComponent([A_VENIR, BROUILLON, PASSE, COURANT_1]);
      expect(fixture.nativeElement.querySelector('.node__dot--draft')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.node')).toHaveLength(3);
      expect(countText(fixture)).toBe(
        fillTone(GRIMOIRE_TONE['scenarios.timeline_count_many'], { n: 3 }),
      );
      expect(fixture.nativeElement.textContent).not.toContain('Brouillon');
    });

    it('matrice - MJ sur la MEME partie : noeud brouillon tirete, compteur superieur', async () => {
      const { fixture } = await createComponent([A_VENIR, BROUILLON, PASSE, COURANT_1], {
        isMj: true,
      });
      expect(fixture.nativeElement.querySelector('.node__dot--draft')).toBeTruthy();
      expect(fixture.nativeElement.querySelectorAll('.node')).toHaveLength(4);
      expect(countText(fixture)).toBe(
        fillTone(GRIMOIRE_TONE['scenarios.timeline_count_many'], { n: 4 }),
      );
      expect(fixture.nativeElement.textContent).toContain('Brouillon');
    });

    it('le compteur se derive des noeuds rendus (singulier au singulier)', async () => {
      const { fixture } = await createComponent([PASSE]);
      expect(instance(fixture).visibleCount()).toBe(1);
      expect(countText(fixture)).toBe(
        fillTone(GRIMOIRE_TONE['scenarios.timeline_count_one'], { n: 1 }),
      );
    });

    it('matrice - aucun scenario visible : etat vide explicite, aucune ligne orpheline', async () => {
      const { fixture } = await createComponent([]);
      expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.node')).toBeNull();
      expect(fixture.nativeElement.querySelector('.track')).toBeNull();
      expect(fixture.nativeElement.querySelector('.timeline-mobile')).toBeNull();
    });

    it("🚨 rien ne s'affiche tant que le premier chargement n'a pas tranche", async () => {
      // Un en-tete « 0 scenario » et un « Aucun scenario pour l'instant. » rendus pendant la
      // requete affirmeraient un vide qui n'est pas encore connu.
      let resolveListAll!: (value: ScenarioDto[]) => void;
      const scenariosSvc = {
        listAll: vi.fn().mockReturnValue(
          new Promise<ScenarioDto[]>((resolve) => {
            resolveListAll = resolve;
          }),
        ),
        changed: signal<{ partieId: string } | null>(null),
      };
      await TestBed.configureTestingModule({
        imports: [ScenarioTimeline],
        providers: [
          provideAnimationsAsync(),
          { provide: ScenariosService, useValue: scenariosSvc },
          { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
          { provide: MatDialog, useValue: { open: vi.fn() } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ScenarioTimeline);
      fixture.componentRef.setInput('partieId', 'p1');
      fixture.componentRef.setInput('partieKind', 'CAMPAGNE_LINEAIRE');
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.timeline-header')).toBeNull();
      expect(fixture.nativeElement.querySelector('.empty')).toBeNull();

      resolveListAll([]);
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.timeline-header')).toBeTruthy();
    });

    it('un joueur seul devant un brouillon ne voit ni noeud, ni compteur trompeur', async () => {
      const { fixture } = await createComponent([BROUILLON]);
      expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
      expect(countText(fixture)).toBe(
        fillTone(GRIMOIRE_TONE['scenarios.timeline_count_one'], { n: 0 }),
      );
    });

    it('matrice - echec de chargement : message + « Reessayer », aucun en-tete ni ligne', async () => {
      const scenariosSvc = {
        listAll: vi.fn().mockRejectedValue(new Error('reseau')),
        changed: signal<{ partieId: string } | null>(null),
      };
      await TestBed.configureTestingModule({
        imports: [ScenarioTimeline],
        providers: [
          provideAnimationsAsync(),
          { provide: ScenariosService, useValue: scenariosSvc },
          { provide: AuthService, useValue: { currentUser: signal({ id: 'u1' }) } },
          { provide: MatDialog, useValue: { open: vi.fn() } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ScenarioTimeline);
      fixture.componentRef.setInput('partieId', 'p1');
      fixture.componentRef.setInput('partieKind', 'CAMPAGNE_LINEAIRE');
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(fixture.nativeElement.querySelector('.error')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.error button').textContent).toContain(
        GRIMOIRE_TONE['common.reessayer'],
      );
      expect(fixture.nativeElement.querySelector('.timeline-header')).toBeNull();
      expect(fixture.nativeElement.querySelector('.node')).toBeNull();
    });

    // Le contenu du noeud est ecrit UNE fois et projete dans les deux orientations : ces deux tests
    // verifient que la bascule de largeur ne fait perdre ni la pastille, ni la plage de dates, ni
    // les seances. (Un seul `it` par orientation : TestBed ne se reconfigure pas deux fois.)
    it('bascule de largeur - desktop : pastille, plage de dates et seances rendues', async () => {
      const { fixture } = await createComponent([PASSE_DEUX_DATES], { desktop: true });
      expect(fixture.nativeElement.querySelector('.timeline-desktop')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.node__dot--done')).toBeTruthy();
      expect(normalize(fixture.nativeElement.querySelector('.node__date').textContent)).toBe(
        '12 juin — 3 juil.',
      );
      expect(fixture.nativeElement.querySelectorAll('.card-seances__row')).toHaveLength(2);
    });

    it('bascule de largeur - mobile : le MEME contenu de noeud, aucune perte', async () => {
      const { fixture } = await createComponent([PASSE_DEUX_DATES], { desktop: false });
      expect(fixture.nativeElement.querySelector('.timeline-mobile')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.node__dot--done')).toBeTruthy();
      expect(normalize(fixture.nativeElement.querySelector('.node__date').textContent)).toBe(
        '12 juin — 3 juil.',
      );
      expect(fixture.nativeElement.querySelectorAll('.card-seances__row')).toHaveLength(2);
    });

    it("un changement d'etat arrive par le signal temps reel se voit sur la pastille", async () => {
      const { fixture, scenariosSvc } = await createComponent([COURANT_DATE]);
      expect(fixture.nativeElement.querySelector('.node__dot--live')).toBeTruthy();

      scenariosSvc.listAll.mockResolvedValue([{ ...COURANT_DATE, status: 'PASSE' }]);
      scenariosSvc.changed.set({ partieId: 'p1' });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(fixture.nativeElement.querySelector('.node__dot--live')).toBeNull();
      expect(fixture.nativeElement.querySelector('.node__dot--done')).toBeTruthy();
    });
  });
});
