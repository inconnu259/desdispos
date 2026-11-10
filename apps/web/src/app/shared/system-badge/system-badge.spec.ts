import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SystemBadge, systemBadgeGlyph } from './system-badge';

@Component({
  imports: [SystemBadge],
  template: `<app-system-badge [systemId]="id" />`,
})
class Host {
  id = 'ryuutama';
}

async function render(systemId: string): Promise<HTMLElement> {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.id = systemId;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

// Story 38.5 — badge rond du système : R1 pour Ryuutama, L1 pour la famille ralliement, rien d'autre.
describe('SystemBadge', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('systemBadgeGlyph : R1 pour ryuutama, L1 pour ralliement, null pour Draconis et un système inconnu', () => {
    expect(systemBadgeGlyph('ryuutama')).toBe('R1');
    expect(systemBadgeGlyph('ralliement')).toBe('L1');
    expect(systemBadgeGlyph('draconis')).toBeNull();
    expect(systemBadgeGlyph('inconnu')).toBeNull();
  });

  it('Ryuutama : dessine R1 (carte pliée, trajet pointillé, dé)', async () => {
    const el = await render('ryuutama');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('path[stroke-dasharray]')).not.toBeNull();
    expect(el.querySelector('rect.die')).not.toBeNull();
  });

  it('ralliement : dessine L1 (flamme sur deux bûches), sans dé', async () => {
    const el = await render('ralliement');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('rect')).toBeNull();
    const ds = Array.from(el.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(ds).toContain('M6 28.5 L26 23.5 M6 23.5 L26 28.5');
  });

  it('Draconis : ne rend aucun dessin (la pastille texte suffit)', async () => {
    const el = await render('draconis');
    expect(el.querySelector('svg')).toBeNull();
    expect((el.querySelector('app-system-badge') as HTMLElement).hidden).toBe(true);
  });

  it('est décoratif : aria-hidden, non focalisable', async () => {
    for (const id of ['ryuutama', 'ralliement']) {
      TestBed.resetTestingModule();
      const svg = (await render(id)).querySelector('svg') as SVGElement;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
    }
  });

  it('ne contient ni mask, ni clipPath, ni aucun attribut id', async () => {
    for (const id of ['ryuutama', 'ralliement']) {
      TestBed.resetTestingModule();
      const el = await render(id);
      expect(el.querySelector('mask')).toBeNull();
      expect(el.querySelector('clipPath')).toBeNull();
      expect(el.querySelector('[id]')).toBeNull();
      expect(el.querySelector('[mask], [clip-path]')).toBeNull();
    }
  });

  it('trait en currentColor, aucune couleur codée en dur (le carré du dé suit --jdr-bg par CSS)', async () => {
    for (const id of ['ryuutama', 'ralliement']) {
      TestBed.resetTestingModule();
      const el = await render(id);
      expect(el.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
      // Aucune couleur codée en dur dans le balisage SVG : le fond du dé vient de la feuille de style.
      expect(el.querySelector('svg')?.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb/i);
      for (const node of Array.from(el.querySelectorAll('svg, svg *'))) {
        for (const attr of ['stroke', 'fill']) {
          const value = node.getAttribute(attr);
          if (value !== null) expect(['currentColor', 'none']).toContain(value);
        }
      }
    }
  });
});
