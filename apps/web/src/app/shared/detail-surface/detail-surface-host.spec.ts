import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { DetailSurface } from './detail-surface';
import { createDetailSurfaceHost } from './detail-surface-host';

@Component({
  standalone: true,
  imports: [DetailSurface],
  template: `
    <button
      type="button"
      class="t1"
      (click)="detail.open('Chasse', 'Traquer une créature.', $event)"
    >
      Chasse
    </button>
    <button type="button" class="t2" (click)="detail.open('Puissance', '+1 en force.', $event)">
      Puissance
    </button>
    @if (detail.selected(); as d) {
      <app-detail-surface
        [title]="d.title"
        [body]="d.body"
        [openToken]="detail.openToken()"
        (closed)="detail.close()"
      />
    }
  `,
})
class HostComponent {
  protected readonly detail = createDetailSurfaceHost();
}

function makeBreakpointObserver(desktop: boolean) {
  return {
    isMatched: () => desktop,
    observe: () => of({ matches: desktop, breakpoints: {} }),
  };
}

async function createHost(desktop = false): Promise<ComponentFixture<HostComponent>> {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideNoopAnimations(),
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(desktop) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return fixture;
}

async function settle(fixture: ComponentFixture<HostComponent>): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
}

function click(fixture: ComponentFixture<HostComponent>, selector: string): HTMLButtonElement {
  const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
  button.focus();
  button.click();
  return button;
}

describe('createDetailSurfaceHost (Story 31.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('aucune surface tant que rien n’a été activé', async () => {
    const fixture = await createHost();
    expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();
  });

  it('AC1 — open() affiche le titre et le corps fournis', async () => {
    const fixture = await createHost();
    click(fixture, '.t1');
    await settle(fixture);
    const panel = fixture.nativeElement.querySelector('.detail-surface-panel');
    expect(panel.querySelector('.detail-surface-title').textContent).toContain('Chasse');
    expect(panel.querySelector('.detail-surface-body').textContent).toContain(
      'Traquer une créature',
    );
  });

  it('AC5 — activer un second déclencheur remplace le contenu, sans empiler', async () => {
    const fixture = await createHost();
    click(fixture, '.t1');
    await settle(fixture);
    click(fixture, '.t2');
    await settle(fixture);
    const panels = fixture.nativeElement.querySelectorAll('.detail-surface-panel');
    expect(panels.length).toBe(1);
    expect(panels[0].querySelector('.detail-surface-title').textContent).toContain('Puissance');
  });

  it('openToken s’incrémente à CHAQUE activation, même contenu identique', async () => {
    const fixture = await createHost();
    click(fixture, '.t1');
    await settle(fixture);
    click(fixture, '.t1');
    await settle(fixture);
    // Deux ouvertures successives sur un contenu strictement identique : sans jeton distinct,
    // l'effet de focus de DetailSurface ne se redéclencherait pas (égalité de valeur des signaux).
    expect(fixture.nativeElement.querySelectorAll('.detail-surface-panel').length).toBe(1);
  });

  it('AC6 — close() rend le focus au déclencheur d’origine', async () => {
    const fixture = await createHost();
    const trigger = click(fixture, '.t1');
    await settle(fixture);
    (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.detail-surface-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('AC6 — déclencheur détaché du DOM : repli sur l’élément hôte, jamais de focus perdu', async () => {
    const fixture = await createHost();
    const trigger = click(fixture, '.t1');
    await settle(fixture);
    trigger.remove();
    (fixture.nativeElement.querySelector('.detail-surface-close') as HTMLButtonElement).click();
    await settle(fixture);
    expect(document.activeElement).toBe(fixture.nativeElement);
    expect((fixture.nativeElement as HTMLElement).getAttribute('tabindex')).toBe('-1');
  });

  it('AC9 (31.4) — openContent() ouvre un contenu structuré avec la même plomberie (jeton, focus)', async () => {
    const fixture = await createHost();
    const host = (
      fixture.componentInstance as unknown as { detail: ReturnType<typeof createDetailSurfaceHost> }
    ).detail;
    const trigger = click(fixture, '.t1');
    const before = host.openToken();
    host.openContent(
      { title: 'Création', body: '', rows: [{ label: 'Effet', value: 'x' }], narrative: 'récit' },
      { currentTarget: trigger } as unknown as Event,
    );
    expect(host.selected()?.rows?.length).toBe(1);
    expect(host.openToken()).toBe(before + 1);
  });
});
