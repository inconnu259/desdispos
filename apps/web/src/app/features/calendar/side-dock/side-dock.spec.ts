import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SideDock } from './side-dock';

@Component({
  standalone: true,
  imports: [SideDock],
  template: `
    <app-side-dock
      [enabled]="enabled()"
      [docked]="docked()"
      [label]="'Éphémérides · 18'"
      (toggled)="docked.set(!docked()); toggles = toggles + 1"
    >
      <p class="contenu">Le contenu de la colonne</p>
    </app-side-dock>
  `,
})
class Host {
  readonly enabled = signal(true);
  readonly docked = signal(false);
  toggles = 0;
}

describe('SideDock (Story 46.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function create() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('ouvert : une barre avec › « Ranger la colonne » (aria-expanded) puis le contenu', () => {
    const { el } = create();
    const button = el.querySelector<HTMLButtonElement>('.side-dock__bar button')!;
    expect(button.getAttribute('aria-label')).toBe('Ranger la colonne');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent!.trim()).toBe('›');
    expect(el.querySelector('.contenu')).not.toBeNull();
    expect(el.querySelector('.side-dock')).toBeNull();
  });

  it('rangé : le dock porte ‹ « Rouvrir la colonne » et le libellé, sans le contenu', () => {
    const { fixture, el, host } = create();
    host.docked.set(true);
    fixture.detectChanges();

    const dock = el.querySelector('.side-dock')!;
    expect(dock.getAttribute('aria-label')).toBe('Éphémérides · 18');
    const button = dock.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Rouvrir la colonne');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent!.trim()).toBe('‹');
    expect(dock.querySelector('.side-dock__label')!.textContent!.trim()).toBe('Éphémérides · 18');
    expect(el.querySelector('.contenu')).toBeNull();
    expect(el.querySelector('app-side-dock')!.classList).toContain('side-dock--docked');
  });

  it('activer le bouton demande de basculer et rend le focus au bouton qui le remplace', async () => {
    const { fixture, el, host } = create();
    el.querySelector<HTMLButtonElement>('.side-dock__bar button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.toggles).toBe(1);
    expect(document.activeElement).toBe(el.querySelector('.side-dock button'));

    el.querySelector<HTMLButtonElement>('.side-dock button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.toggles).toBe(2);
    expect(document.activeElement).toBe(el.querySelector('.side-dock__bar button'));
  });

  it('désactivé (sous 768 px) : le contenu seul, ni barre ni dock, même « rangé »', () => {
    const { fixture, el, host } = create();
    host.enabled.set(false);
    host.docked.set(true);
    fixture.detectChanges();

    expect(el.querySelector('.contenu')).not.toBeNull();
    expect(el.querySelector('.side-dock__bar')).toBeNull();
    expect(el.querySelector('.side-dock')).toBeNull();
    expect(el.querySelector('app-side-dock')!.classList).not.toContain('side-dock--docked');
  });
});
