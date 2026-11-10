import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { DetailSurface } from './detail-surface';
import { TONE_MAP } from '../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `<app-detail-surface
    [title]="title"
    [body]="body"
    [rows]="rows"
    [narrative]="narrative"
    [openToken]="token()"
    (closed)="closedCount = closedCount + 1"
  />`,
})
class HostComponent {
  title = 'Frappe précise';
  body = "Ce talent octroie +2 aux tests d'attaque au corps à corps.";
  rows: { label: string; value: string }[] = [];
  narrative = '';
  token = signal(1);
  closedCount = 0;
}

/** Même patron que `character-sheet.spec.ts`/`calendar-view.spec.ts` : `isMatched()` synchrone +
 *  un `observe()` qui n'émet qu'une fois. */
function makeBreakpointObserver(desktop: boolean) {
  return {
    isMatched: () => desktop,
    observe: () => of({ matches: desktop, breakpoints: {} }),
  };
}

/** `desktop` par défaut à `false` (mobile) — c'est aussi ce que jsdom renvoie nativement pour
 *  toute media query (`matches: false`), donc c'est la valeur qui aurait été utilisée même sans
 *  mock explicite ; le fournir rend l'intention lisible et permet le cas `desktop: true`. */
async function createHost(
  desktop = false,
  setup?: (host: HostComponent) => void,
): Promise<{ fixture: ComponentFixture<HostComponent> }> {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideNoopAnimations(),
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  setup?.(fixture.componentInstance);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return { fixture };
}

describe('DetailSurface (Story 31.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC1 — affiche le titre et le corps fournis', async () => {
    const { fixture } = await createHost();
    const panel = fixture.nativeElement.querySelector('.detail-surface-panel');
    expect(panel.querySelector('.detail-surface-title').textContent).toContain('Frappe précise');
    expect(panel.querySelector('.detail-surface-body').textContent).toContain(
      "octroie +2 aux tests d'attaque",
    );
  });

  // ⚠️ Story 31.4 (AC10) — INVERSION assumée d'une décision de la revue de la 31.2 : la surface
  // desktop était non modale (panneau latéral, `aria-modal` absent, voile masqué). Elle est
  // désormais une fenêtre centrée MODALE sur toutes les tailles.
  for (const desktop of [false, true]) {
    it(`AC10 (31.4) — role="dialog" et aria-modal="true" ${desktop ? 'en desktop (fenêtre centrée)' : 'en mobile (feuille)'}`, async () => {
      const { fixture } = await createHost(desktop);
      const panel: HTMLElement = fixture.nativeElement.querySelector('.detail-surface-panel');
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');
      expect(fixture.nativeElement.querySelector('.detail-surface-backdrop')).not.toBeNull();
    });
  }

  describe('corps structuré (Story 31.4, AC9)', () => {
    const structured = (h: HostComponent) => {
      h.body = '';
      h.rows = [
        { label: 'Attributs', value: 'VIG · AGI' },
        { label: 'Effet', value: 'Fabrique un objet' },
      ];
      h.narrative = 'Les artisans gagnent leur vie en créant des objets.';
    };

    it('AC9 — affiche un tableau libellé/valeur, une ligne par donnée', async () => {
      const { fixture } = await createHost(false, structured);
      const rows = fixture.nativeElement.querySelectorAll('.detail-surface-rows tr');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('th').textContent).toContain('Attributs');
      expect(rows[0].querySelector('td').textContent).toContain('VIG · AGI');
      expect(fixture.nativeElement.querySelector('.detail-surface-body')).toBeNull();
    });

    it('AC9 — MOBILE : le récit est replié par défaut, la divulgation le déplie et le replie', async () => {
      const { fixture } = await createHost(false, structured);
      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector<HTMLButtonElement>('.detail-surface-disclosure')!;
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.textContent).toContain('Lire le récit');
      expect(el.querySelector('.detail-surface-narrative')).toBeNull();

      btn.click();
      fixture.detectChanges();
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(btn.textContent).toContain(GRIMOIRE_TONE['detail.narrative_hide']);
      expect(el.querySelector('.detail-surface-narrative')?.textContent).toContain('Les artisans');

      btn.click();
      fixture.detectChanges();
      expect(el.querySelector('.detail-surface-narrative')).toBeNull();
    });

    it('story 51.7 : divulgation = icône « déplier » (tournée −90° repliée), bouton de fermeture = « fermer »', async () => {
      const { fixture } = await createHost(false, structured);
      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector<HTMLButtonElement>('.detail-surface-disclosure')!;
      const icon = () => btn.querySelector('app-icon')!;

      expect(icon().getAttribute('data-icon')).toBe('deplier');
      expect(icon().classList.contains('detail-surface-disclosure__icon--closed')).toBe(true);
      expect(btn.textContent).not.toMatch(/[▾▸]/);
      btn.click();
      fixture.detectChanges();
      expect(icon().getAttribute('data-icon')).toBe('deplier');
      expect(icon().classList.contains('detail-surface-disclosure__icon--closed')).toBe(false);

      const close = el.querySelector('.detail-surface-close')!;
      expect(close.querySelector('app-icon')?.getAttribute('data-icon')).toBe('fermer');
      expect(close.textContent).not.toContain('✕');
      expect(close.getAttribute('aria-label')).toBeTruthy();
    });

    it('AC9 — DESKTOP : le récit est déployé, sans divulgation', async () => {
      const { fixture } = await createHost(true, structured);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.detail-surface-disclosure')).toBeNull();
      expect(el.querySelector('.detail-surface-narrative')?.textContent).toContain('Les artisans');
    });

    it('AC9 — sans tableau, le récit est le seul contenu : affiché directement, même en mobile', async () => {
      const { fixture } = await createHost(false, (h) => {
        h.body = '';
        h.rows = [];
        h.narrative = 'Un récit seul.';
      });
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.detail-surface-disclosure')).toBeNull();
      expect(el.querySelector('.detail-surface-narrative')?.textContent).toContain(
        'Un récit seul.',
      );
    });

    it('AC9 — le récit est replié à CHAQUE ouverture (jeton), jamais hérité du terme précédent', async () => {
      const { fixture } = await createHost(false, structured);
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('.detail-surface-disclosure')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.detail-surface-narrative')).not.toBeNull();

      fixture.componentInstance.token.set(2);
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
      expect(el.querySelector('.detail-surface-narrative')).toBeNull();
    });

    it('un terme sans donnée structurée garde le corps de texte simple', async () => {
      const { fixture } = await createHost();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.detail-surface-rows')).toBeNull();
      expect(el.querySelector('.detail-surface-body')?.textContent).toContain('octroie +2');
    });
  });

  // Le piège de focus (`cdkTrapFocus`, désormais inconditionnel — 31.4) relève du CDK `A11yModule`,
  // non simulable de façon fiable en jsdom (même famille de limite que la capture de focus
  // ci-dessous) : vérifié par la vérification visuelle réelle (Task 9 de la story 31.4).

  // 🚨 Trouvé à la vérification visuelle (Task 4) : `cdkTrapFocusAutoCapture` ne capture le focus
  // qu'au MONTAGE — un remplacement de contenu en place (AC4, la surface reste montée) ne
  // redéplaçait jamais le focus, et Échap ne fonctionnait plus après un tel remplacement (aucun
  // bubbling vers le panneau, resté hors focus). Corrigé par un focus explicite piloté par un
  // `effect()` sur `title()`/`body()` — testable en jsdom, contrairement à la capture CDK
  // (`InteractivityChecker` échoue sur des dimensions nulles), car `.focus()` direct fonctionne.
  it('AC6 — le focus entre dans la surface à l’ouverture (mécanisme explicite, testable en jsdom)', async () => {
    const { fixture } = await createHost();
    const closeBtn = fixture.nativeElement.querySelector('.detail-surface-close');
    expect(document.activeElement).toBe(closeBtn);
  });

  // AC4/AC6 — remplacer le contenu pendant que la surface est déjà ouverte doit redemander le
  // focus dans le panneau (sans quoi Échap ne fonctionne plus après un tel remplacement, cf.
  // commentaire sur `focusOnContentChange` dans `detail-surface.ts`). **Vérifié manuellement,
  // Task 4** : ouvrir un talent, en activer un second sans fermer, Échap referme bien et rend le
  // focus au second déclencheur. Non couvert par un test unitaire dédié — l'`effect()` ne s'est
  // pas révélé fiablement re-déclenchable dans ce harnais de test zoneless (le spy sur `.focus()`
  // ne capture aucun second appel malgré plusieurs cycles de détection), sans qu'aucune régression
  // ne soit observable dans le navigateur réel. Même famille de limitation que la capture initiale
  // ci-dessus.

  it('émet closed au clic sur le voile', async () => {
    const { fixture } = await createHost();
    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.detail-surface-backdrop');
    backdrop.click();
    fixture.detectChanges();
    expect((fixture.componentInstance as HostComponent).closedCount).toBe(1);
  });

  it('émet closed au clic sur le bouton Fermer', async () => {
    const { fixture } = await createHost();
    const closeBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.detail-surface-close');
    closeBtn.click();
    fixture.detectChanges();
    expect((fixture.componentInstance as HostComponent).closedCount).toBe(1);
  });

  it('AC6 — Échap émet closed', async () => {
    const { fixture } = await createHost();
    const panel: HTMLElement = fixture.nativeElement.querySelector('.detail-surface-panel');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect((fixture.componentInstance as HostComponent).closedCount).toBe(1);
  });

  it('une touche autre que Échap ne déclenche pas closed', async () => {
    const { fixture } = await createHost();
    const panel: HTMLElement = fixture.nativeElement.querySelector('.detail-surface-panel');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect((fixture.componentInstance as HostComponent).closedCount).toBe(0);
  });
});

// ── Story 31.4 : contenu projeté (feuille « Récap » du wizard) ──────────────────────────────────

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `<app-detail-surface title="Récapitulatif" [custom]="true"
    ><p class="projected">Contenu projeté</p></app-detail-surface
  >`,
})
class ProjectedHost {}

describe('DetailSurface — contenu projeté (Story 31.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le contenu projeté, sans corps de texte ni repli « Aucune description disponible »', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectedHost],
      providers: [
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(false) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectedHost);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.projected')?.textContent).toContain('Contenu projeté');
    expect(el.querySelector('.detail-surface-body')).toBeNull();
    expect(el.textContent).not.toContain('Aucune description disponible');
  });
});

// ── Story 33.6 : extension rétro-compatible (en-tête / pied personnalisés, largeur, fermeture) ──

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `<app-detail-surface
    title="Choisir un souffle pour l'emplacement 3"
    [custom]="true"
    [hasHeader]="true"
    [hasFooter]="true"
    [desktopWidth]="620"
    describedBy="compteur"
    [openToken]="1"
    (closed)="closedCount = closedCount + 1"
    ><div detail-header class="h">
      <h2 id="t">Titre projeté</h2>
      <span id="compteur">2 / 3</span>
    </div>
    <p class="body-projected">Corps projeté</p>
    <div detail-footer class="f"><button type="button" class="f-btn">Valider</button></div>
  </app-detail-surface>`,
})
class SlotsHost {
  closedCount = 0;
}

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `<app-detail-surface title="Portail" [portal]="true" body="Corps" [openToken]="1" />`,
})
class PortalHost {}

describe('DetailSurface — extension rétro-compatible (Story 33.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mount<T>(component: new () => T, desktop: boolean) {
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }

  it('sans slot : rendu inchangé (titre par défaut, pas de pied, pas de classe « split »)', async () => {
    const { fixture } = await createHost();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.detail-surface-title')).not.toBeNull();
    expect(el.querySelector('.detail-surface-header')).toBeNull();
    expect(el.querySelector('.detail-surface-footer')).toBeNull();
    expect(el.querySelector('.detail-surface-panel--split')).toBeNull();
    const panel = el.querySelector('.detail-surface-panel') as HTMLElement;
    expect(panel.getAttribute('aria-describedby')).toBeNull();
    expect(panel.style.getPropertyValue('--detail-surface-width')).toBe('');
  });

  it('bouton de fermeture : « Fermer la feuille » en mobile, « Fermer la fenêtre » en desktop', async () => {
    const mobile = (await createHost(false)).fixture.nativeElement as HTMLElement;
    expect(mobile.querySelector('.detail-surface-close')?.getAttribute('aria-label')).toBe(
      GRIMOIRE_TONE['shared.detail_close_sheet'],
    );
    TestBed.resetTestingModule();
    const desktop = (await createHost(true)).fixture.nativeElement as HTMLElement;
    expect(desktop.querySelector('.detail-surface-close')?.getAttribute('aria-label')).toBe(
      GRIMOIRE_TONE['shared.detail_close_window'],
    );
  });

  it('en-tête et pied projetés : titre par défaut remplacé, corps dans la zone défilante, pied épinglé', async () => {
    const el = await mount(SlotsHost, false);

    expect(el.querySelector('.detail-surface-title')).toBeNull();
    expect(el.querySelector('.detail-surface-header #t')?.textContent).toBe('Titre projeté');
    expect(el.querySelector('.detail-surface-content .body-projected')).not.toBeNull();
    expect(el.querySelector('.detail-surface-footer .f-btn')?.textContent).toBe('Valider');
    // Le pied est HORS de la zone qui défile.
    expect(el.querySelector('.detail-surface-content .f-btn')).toBeNull();
    expect(el.querySelector('.detail-surface-panel--split')).not.toBeNull();
    // Contenu projeté : ni corps de texte ni repli « Aucune description disponible ».
    expect(el.textContent).not.toContain('Aucune description disponible');
  });

  it('nom et description du dialogue : titre en aria-label, compteur en aria-describedby', async () => {
    const el = await mount(SlotsHost, true);
    const panel = el.querySelector('.detail-surface-panel') as HTMLElement;

    expect(panel.getAttribute('aria-label')).toBe("Choisir un souffle pour l'emplacement 3");
    expect(panel.getAttribute('aria-describedby')).toBe('compteur');
    expect(el.querySelector('#compteur')?.textContent).toBe('2 / 3');
  });

  it('largeur par usage : exposée en variable CSS --detail-surface-width', async () => {
    const el = await mount(SlotsHost, true);
    const panel = el.querySelector('.detail-surface-panel') as HTMLElement;

    expect(panel.style.getPropertyValue('--detail-surface-width')).toBe('620px');
  });

  it('Échap et le bouton de fermeture émettent closed avec en-tête et pied personnalisés', async () => {
    await TestBed.configureTestingModule({
      imports: [SlotsHost],
      providers: [
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(false) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SlotsHost);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const panel = el.querySelector('.detail-surface-panel') as HTMLElement;

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (el.querySelector('.detail-surface-close') as HTMLButtonElement).click();

    expect(fixture.componentInstance.closedCount).toBe(2);
  });

  it("portal : l'hôte passe sous <body> après le premier rendu, le focus revient à la fenêtre, et il est retiré à la destruction", async () => {
    await TestBed.configureTestingModule({
      imports: [PortalHost],
      providers: [
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(false) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PortalHost);
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    const host = document.body.querySelector('app-detail-surface') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.parentElement).toBe(document.body);
    expect(fixture.nativeElement.querySelector('app-detail-surface')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.detail-surface-close'));

    fixture.destroy();
    expect(document.body.querySelector('app-detail-surface')).toBeNull();
  });

  it("sans portal (défaut) : l'hôte reste à sa place dans le DOM", async () => {
    const { fixture } = await createHost();
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-detail-surface');

    expect(host).not.toBeNull();
    expect(host!.parentElement).not.toBe(document.body);
  });
});

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `<app-detail-surface
    title="Nouvelle fenêtre large"
    [custom]="true"
    [hasHeader]="true"
    [hasFooter]="true"
    [wide]="true"
    [desktopWidth]="620"
  >
    <h2 detail-header>Titre large</h2>
    <p class="body-wide">Corps</p>
    <div detail-footer><button type="button">Valider</button></div>
  </app-detail-surface>`,
})
class WideHost {}

// ⚠️ Story 40.1 — variante large rétro-compatible : seule la fenêtre d'une conjonction l'active.
describe('DetailSurface — variante large (Story 40.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mountWide(desktop: boolean): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [WideHost],
      providers: [
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WideHost);
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }

  it('wide : classe de variante posée, la largeur par usage est ignorée (aucune variable CSS)', async () => {
    const el = await mountWide(true);
    const panel = el.querySelector('.detail-surface-panel') as HTMLElement;

    expect(panel.classList).toContain('detail-surface-panel--wide');
    expect(panel.classList).toContain('detail-surface-panel--split');
    expect(panel.style.getPropertyValue('--detail-surface-width')).toBe('');
    // Toujours un dialogue modal, corps dans la zone défilante.
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelector('.detail-surface-content .body-wide')).not.toBeNull();
  });

  it('défaut inchangé : sans wide, aucune classe de variante (les autres surfaces gardent leurs dimensions)', async () => {
    const { fixture } = await createHost(true);
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.detail-surface-panel');

    expect(panel?.classList).not.toContain('detail-surface-panel--wide');
  });
});
