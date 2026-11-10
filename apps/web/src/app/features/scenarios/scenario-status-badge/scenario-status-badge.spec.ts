import { TestBed } from '@angular/core/testing';
import type { ScenarioStatus } from '@master-jdr/shared';
import { ScenarioStatusBadge } from './scenario-status-badge';

async function createComponent(status: ScenarioStatus) {
  await TestBed.configureTestingModule({ imports: [ScenarioStatusBadge] }).compileComponents();
  const fixture = TestBed.createComponent(ScenarioStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return fixture;
}

function badge(fixture: { nativeElement: HTMLElement }): HTMLElement {
  return fixture.nativeElement.querySelector('.status-badge') as HTMLElement;
}

// Story 32.3 — le badge est désormais la `StatusBadge` partagée : libellés thématisés, quatre
// teintes `--jdr-status-*`. Les anciennes classes `status-brouillon`/`status-courant`… ont disparu
// avec la feuille de style locale.
describe('ScenarioStatusBadge (réaligné, Story 32.3)', () => {
  it('BROUILLON → « Brouillon », variante de FORME (contour tireté), aucune classe de teinte', async () => {
    const el = badge(await createComponent('BROUILLON'));
    expect(el.textContent?.trim()).toBe('Brouillon');
    expect(el.classList).toContain('status-badge--draft');
    // Un brouillon n'est pas une cinquième teinte : aucune des quatre ne doit apparaître.
    for (const tone of ['todo', 'live', 'soon', 'done']) {
      expect(el.classList.contains(`status-badge--${tone}`), tone).toBe(false);
    }
  });

  it('A_VENIR → « À venir », teinte soon', async () => {
    const el = badge(await createComponent('A_VENIR'));
    expect(el.textContent?.trim()).toBe('À venir');
    expect(el.classList).toContain('status-badge--soon');
  });

  it('COURANT → « Courant » (jamais « En cours », réservé au vote), teinte live', async () => {
    const el = badge(await createComponent('COURANT'));
    expect(el.textContent?.trim()).toBe('Courant');
    expect(el.textContent?.trim()).not.toBe('En cours');
    expect(el.classList).toContain('status-badge--live');
  });

  it('PASSE → « Passé », teinte done', async () => {
    const el = badge(await createComponent('PASSE'));
    expect(el.textContent?.trim()).toBe('Passé');
    expect(el.classList).toContain('status-badge--done');
  });
});
