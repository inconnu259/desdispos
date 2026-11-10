import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Theme } from '@master-jdr/shared';
import { PartyCountdown } from './party-countdown';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';

async function render(theme: Theme, progress: number) {
  await TestBed.configureTestingModule({
    imports: [PartyCountdown],
    providers: [
      {
        provide: ThemeToneService,
        useValue: { tone: signal(TONE_MAP[theme]), activeTheme: signal<Theme>(theme) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PartyCountdown);
  fixture.componentRef.setInput('progress', progress);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('PartyCountdown — un motif par thème (Story 29.11, AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('foret-ancienne → la liane', async () => {
    const fixture = await render('foret-ancienne', 0.5);
    expect(fixture.nativeElement.querySelector('.countdown__vine')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.countdown__orbit')).toBeNull();
    expect(fixture.nativeElement.querySelector('.countdown__press-row')).toBeNull();
  });

  it('atelier-cuivre → le manomètre et la conduite', async () => {
    const fixture = await render('atelier-cuivre', 0.5);
    expect(fixture.nativeElement.querySelector('.countdown__press-row')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.countdown__vine')).toBeNull();
  });

  it('grimoire-emeraude → la comète et son étoile', async () => {
    const fixture = await render('grimoire-emeraude', 0.5);
    expect(fixture.nativeElement.querySelector('.countdown__orbit')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.countdown__star')).not.toBeNull();
  });
});

describe('PartyCountdown — la progression est une position, pas une animation (AC4, AC6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('la tige est posée par un scaleX, jamais par une largeur (AC6)', async () => {
    const fixture = await render('foret-ancienne', 1);
    const stem = fixture.nativeElement.querySelector('.countdown__stem') as HTMLElement;
    expect(stem.style.transform).toContain('scaleX(');
    expect(stem.style.width).toBe('');
  });

  it('la conduite est posée par un scaleX, jamais par une largeur (AC6)', async () => {
    const fixture = await render('atelier-cuivre', 1);
    const fill = fixture.nativeElement.querySelector('.countdown__pipe-fill') as HTMLElement;
    expect(fill.style.transform).toContain('scaleX(');
    expect(fill.style.width).toBe('');
  });

  it('deux progressions différentes → deux positions différentes', async () => {
    const low = await render('foret-ancienne', 0.1);
    const lowTransform = (low.nativeElement.querySelector('.countdown__stem') as HTMLElement).style
      .transform;
    TestBed.resetTestingModule();

    const high = await render('foret-ancienne', 0.9);
    const highTransform = (high.nativeElement.querySelector('.countdown__stem') as HTMLElement)
      .style.transform;

    expect(highTransform).not.toBe(lowTransform);
  });

  it("l'angle de l'aiguille suit la progression", async () => {
    const early = await render('atelier-cuivre', 0);
    const earlyAngle = (
      early.nativeElement.querySelector('.countdown__needle-pivot') as HTMLElement
    ).style.transform;
    TestBed.resetTestingModule();

    const late = await render('atelier-cuivre', 1);
    const lateAngle = (late.nativeElement.querySelector('.countdown__needle-pivot') as HTMLElement)
      .style.transform;

    expect(earlyAngle).toContain('rotate(-72');
    expect(lateAngle).toContain('rotate(66');
  });

  it('grimoire : la QUEUE est la barre, et la tête suit son extrémité (retour utilisateur)', async () => {
    const fixture = await render('grimoire-emeraude', 0.5);
    const tail = fixture.nativeElement.querySelector('.countdown__tail') as HTMLElement;
    const head = fixture.nativeElement.querySelector('.countdown__head') as HTMLElement;

    // La queue s'étire depuis le bord gauche — elle ne traverse pas le cadre.
    expect(tail.style.transform).toContain('scaleX(');
    expect(tail.style.width).toBe('');

    // La tête est posée au bout de la queue : les deux lisent la même valeur, elles ne peuvent
    // pas se désaccorder.
    const scale = Number(tail.style.transform.match(/scaleX\(([\d.]+)\)/)![1]);
    expect(head.style.left).toBe(`${scale * 100}%`);
  });

  it('les deux barres portent un flux interne — sans lui, une barre qui avance d’un septième par jour paraît figée', async () => {
    const foret = await render('foret-ancienne', 0.5);
    expect(foret.nativeElement.querySelector('.countdown__stem-flow')).not.toBeNull();
    TestBed.resetTestingModule();

    const emeraude = await render('grimoire-emeraude', 0.5);
    expect(emeraude.nativeElement.querySelector('.countdown__tail-flow')).not.toBeNull();
  });

  it('foret : le bourgeon suit l’extrémité de la tige', async () => {
    const fixture = await render('foret-ancienne', 0.5);
    const stem = fixture.nativeElement.querySelector('.countdown__stem') as HTMLElement;
    const bud = fixture.nativeElement.querySelector('.countdown__bud') as HTMLElement;
    const scale = Number(stem.style.transform.match(/scaleX\(([\d.]+)\)/)![1]);
    expect(bud.style.left).toBe(`${scale * 100}%`);
  });

  it('l’allumage de la feuille et son balancement vivent sur deux éléments distincts', async () => {
    // Deux `transform` sur le même élément s'écraseraient : le parent porte l'échelle d'allumage,
    // l'enfant porte le balancement.
    const fixture = await render('foret-ancienne', 1);
    const leaf = fixture.nativeElement.querySelector('.countdown__leaf');
    expect(leaf.querySelector('.countdown__leaf-blade')).not.toBeNull();
  });

  it('une progression hors plage est bornée défensivement', async () => {
    const fixture = await render('foret-ancienne', 4);
    const stem = fixture.nativeElement.querySelector('.countdown__stem') as HTMLElement;
    // 0,06 + 1 × 0,94 = 1 — jamais un scaleX de 4.
    expect(stem.style.transform).toBe('scaleX(1)');
  });
});

describe('PartyCountdown — allumage des feuilles par la tige (retour utilisateur)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('à mi-parcours, seules les feuilles atteintes sont allumées', async () => {
    const fixture = await render('foret-ancienne', 0.5);
    const leaves = Array.from(
      fixture.nativeElement.querySelectorAll('.countdown__leaf'),
    ) as HTMLElement[];

    // Positions : 0,16 · 0,32 · 0,48 · 0,64 · 0,78 → les trois premières sont dépassées.
    const lit = leaves.map((leaf) => leaf.classList.contains('countdown__leaf--lit'));
    expect(lit).toEqual([true, true, true, false, false]);
  });

  it('à zéro, aucune feuille ; au terme, toutes', async () => {
    const none = await render('foret-ancienne', 0);
    expect(none.nativeElement.querySelectorAll('.countdown__leaf--lit').length).toBe(0);
    TestBed.resetTestingModule();

    const all = await render('foret-ancienne', 1);
    expect(all.nativeElement.querySelectorAll('.countdown__leaf--lit').length).toBe(5);
  });

  it('les feuilles sont toutes rendues, allumées ou non — rien n’apparaît ni ne disparaît du DOM', async () => {
    const none = await render('foret-ancienne', 0);
    expect(none.nativeElement.querySelectorAll('.countdown__leaf').length).toBe(5);
  });
});

describe('PartyCountdown — décoratif (Story 29.11, AC5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('aria-hidden, aucun texte, aucun rôle, aucun libellé', async () => {
    for (const theme of ['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as const) {
      const fixture = await render(theme, 0.6);
      const root = fixture.nativeElement.querySelector('.countdown');
      expect(root.getAttribute('aria-hidden')).toBe('true');
      expect(root.getAttribute('role')).toBeNull();
      expect(root.getAttribute('aria-label')).toBeNull();
      expect(root.textContent.trim()).toBe('');
      TestBed.resetTestingModule();
    }
  });

  it('la zone rouge est signalée par une classe, au-delà du seuil seulement', async () => {
    const calm = await render('atelier-cuivre', 0.3);
    expect(calm.nativeElement.querySelector('.countdown__gauge--red')).toBeNull();
    TestBed.resetTestingModule();

    const urgent = await render('atelier-cuivre', 0.9);
    expect(urgent.nativeElement.querySelector('.countdown__gauge--red')).not.toBeNull();
  });

  it("l'approche est signalée dans les trois thèmes, pas seulement au manomètre", async () => {
    // Le pendant de la zone rouge : bourgeon et cercle-objectif en Forêt, étoile en Émeraude.
    const foret = await render('foret-ancienne', 0.9);
    expect(foret.nativeElement.querySelector('.countdown__bud--near')).not.toBeNull();
    expect(foret.nativeElement.querySelector('.countdown__goal--near')).not.toBeNull();
    TestBed.resetTestingModule();

    const emeraude = await render('grimoire-emeraude', 0.9);
    expect(emeraude.nativeElement.querySelector('.countdown__star--near')).not.toBeNull();
    TestBed.resetTestingModule();

    const calm = await render('foret-ancienne', 0.2);
    expect(calm.nativeElement.querySelector('.countdown__bud--near')).toBeNull();
  });
});
