import { Component, signal } from '@angular/core';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { Theme } from '@master-jdr/shared';
import { ThemeToneService } from '../theme/theme-tone.service';
import { AppIcon } from './app-icon';
import { COMMON_ICONS, THEMED_ICONS, type IconName } from './icon-registry.generated';

@Component({
  imports: [AppIcon],
  template: `<app-icon [name]="name()" [label]="label()" />`,
})
class HostComponent {
  readonly name = signal<IconName>('nav-parties');
  readonly label = signal<string | undefined>(undefined);
}

function setup(theme: Theme = 'grimoire-emeraude') {
  const activeTheme = signal<Theme>(theme);
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: ThemeToneService, useValue: { activeTheme } }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    activeTheme,
    host: () => el.querySelector('app-icon') as HTMLElement,
    svg: () => el.querySelector('app-icon svg') as SVGSVGElement,
    paths: () =>
      Array.from(el.querySelectorAll('app-icon svg path')).map((p) => p.getAttribute('d')),
  };
}

describe('AppIcon', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pose data-icon sur l’hôte et rend un svg inline en trait currentColor, bouts arrondis', () => {
    const { host, svg } = setup();
    expect(host().getAttribute('data-icon')).toBe('nav-parties');
    expect(svg().getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg().getAttribute('fill')).toBe('none');
    expect(svg().getAttribute('stroke')).toBe('currentColor');
    expect(svg().getAttribute('stroke-linecap')).toBe('round');
    expect(svg().getAttribute('stroke-linejoin')).toBe('round');
  });

  it('rend les éléments du registre avec leurs attributs (y compris fill et stroke propres)', () => {
    const { svg } = setup();
    const expected = THEMED_ICONS['nav-parties']['grimoire-emeraude'].elements;
    const rendered = Array.from(svg().children);
    expect(rendered).toHaveLength(expected.length);
    expected.forEach((el, i) => {
      expect(rendered[i].tagName.toLowerCase()).toBe(el.tag);
      for (const [name, value] of Object.entries(el.attrs)) {
        expect(rendered[i].getAttribute(name)).toBe(value);
      }
    });
    // Les éléments sont de vrais éléments SVG (espace de noms), pas du HTML inconnu.
    expect(rendered[0].namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('rend aussi les balises autres que path (cercles, rectangles) des utilitaires', () => {
    const { fixture, svg } = setup();
    const withShape = Object.entries(COMMON_ICONS)
      .filter(([, d]) => d.elements.some((e) => e.tag === 'circle' || e.tag === 'rect'))
      .map(([name]) => name as IconName);
    expect(withShape.length).toBeGreaterThan(0);
    fixture.componentInstance.name.set(withShape[0]);
    fixture.detectChanges();
    expect(svg().querySelector('circle, rect')).not.toBeNull();
  });

  it('sans label : décorative (aria-hidden, focusable false, ni role ni aria-label)', () => {
    const { svg } = setup();
    expect(svg().getAttribute('aria-hidden')).toBe('true');
    expect(svg().getAttribute('focusable')).toBe('false');
    expect(svg().getAttribute('role')).toBeNull();
    expect(svg().getAttribute('aria-label')).toBeNull();
  });

  it('avec label : image nommée (role img + aria-label), sans aria-hidden', () => {
    const { fixture, svg } = setup();
    fixture.componentInstance.label.set('Mes aventures');
    fixture.detectChanges();
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Mes aventures');
    expect(svg().hasAttribute('aria-hidden')).toBe(false);
  });

  it('icône de sens : le dessin suit le thème actif, dans la même instance', () => {
    const { fixture, activeTheme, host, paths } = setup('grimoire-emeraude');
    const instance = host();
    const grimoire = paths();

    activeTheme.set('foret-ancienne');
    fixture.detectChanges();

    expect(host()).toBe(instance);
    expect(paths()).not.toEqual(grimoire);
    expect(paths()).toEqual(
      THEMED_ICONS['nav-parties']['foret-ancienne'].elements
        .filter((e) => e.tag === 'path')
        .map((e) => e.attrs['d']),
    );
  });

  it('utilitaire : le même dessin dans les trois thèmes', () => {
    const { fixture, activeTheme, host, paths } = setup('grimoire-emeraude');
    fixture.componentInstance.name.set('fermer');
    fixture.detectChanges();
    const reference = paths();
    expect(reference.length).toBeGreaterThan(0);
    const instance = host();

    for (const theme of ['foret-ancienne', 'atelier-cuivre'] as const) {
      activeTheme.set(theme);
      fixture.detectChanges();
      expect(paths()).toEqual(reference);
      expect(host()).toBe(instance);
    }
  });

  it('un changement de nom redessine et met à jour data-icon', () => {
    const { fixture, host, paths } = setup();
    const before = paths();
    fixture.componentInstance.name.set('nav-compte');
    fixture.detectChanges();
    expect(host().getAttribute('data-icon')).toBe('nav-compte');
    expect(paths()).not.toEqual(before);
  });

  it('ne produit aucun balisage injecté : pas de script ni d’attribut d’événement', () => {
    const { svg } = setup();
    expect(svg().querySelector('script, style, foreignObject')).toBeNull();
    for (const node of [svg(), ...Array.from(svg().querySelectorAll('*'))]) {
      for (const attr of Array.from(node.attributes)) {
        expect(attr.name.startsWith('on')).toBe(false);
      }
    }
  });

  it('nom inconnu : console.error, rien n’est rendu, sans lever ni dessin de repli', () => {
    const { fixture, host } = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fixture.componentInstance.name.set('inconnu' as IconName);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(host().querySelector('svg')).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('inconnu'));
    error.mockRestore();
  });
});
