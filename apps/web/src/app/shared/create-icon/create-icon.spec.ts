import { TestBed } from '@angular/core/testing';
import { CreateIcon, D20_CUT_ENDS, PENCIL_POINTS } from './create-icon';

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({ imports: [CreateIcon] }).compileComponents();
  const fixture = TestBed.createComponent(CreateIcon);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

// Story 38.1 — l'icône est autonome : la découpe du d20 autour du crayon est faite par la
// géométrie, jamais par un masque (donc aucune collision d'identifiant entre instances).
describe('CreateIcon', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('est décorative : aria-hidden et non focalisable', async () => {
    const svg = (await render()).querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('ne contient ni élément mask ou clipPath, ni aucun attribut id', async () => {
    const el = await render();
    expect(el.querySelector('mask')).toBeNull();
    expect(el.querySelector('clipPath')).toBeNull();
    expect(el.querySelector('[id]')).toBeNull();
    expect(el.querySelector('[mask], [clip-path]')).toBeNull();
  });

  it('est monochrome en currentColor, sans couleur codée en dur', async () => {
    const el = await render();
    expect(el.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
    for (const node of Array.from(el.querySelectorAll('svg, svg *'))) {
      for (const attr of ['stroke', 'fill']) {
        const value = node.getAttribute(attr);
        if (value !== null) expect(['currentColor', 'none']).toContain(value);
      }
    }
  });

  it('dessine le crayon (corps + trait de la pointe)', async () => {
    const el = await render();
    const ds = Array.from(el.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(ds).toContain('M19.5 28.5 L20.42 24.47 L26.94 17.94 L30.06 21.06 L23.53 27.58 Z');
    expect(ds).toContain('M24.96 19.92 L28.08 23.04');
  });

  it('chaque extrémité coupée du d20 est dans le tracé et à au moins 2,3 du crayon', async () => {
    const el = await render();
    const ds = Array.from(el.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    for (const [x, y] of D20_CUT_ENDS) {
      expect(ds.some((d) => d.includes(`${x} ${y}`))).toBe(true);
      expect(distanceToPolygon([x, y], PENCIL_POINTS)).toBeGreaterThanOrEqual(2.3 - 0.05);
    }
  });
});

/** Distance minimale d'un point au contour d'un polygone fermé. */
function distanceToPolygon(
  p: readonly [number, number],
  poly: readonly (readonly [number, number])[],
): number {
  return Math.min(
    ...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
      );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }),
  );
}
