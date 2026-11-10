import { TestBed } from '@angular/core/testing';
import { StatusBadge } from './status-badge';
import type { StatusBadgeState } from '../../core/status/status-derivation';

async function createComponent(state: StatusBadgeState) {
  await TestBed.configureTestingModule({ imports: [StatusBadge] }).compileComponents();
  const fixture = TestBed.createComponent(StatusBadge);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('.status-badge') as HTMLElement;
}

// Story 32.3 — le RENDU du badge partagé. Les specs de surface (`seance-list`, `partie-detail`)
// travaillent toutes à ±10 jours pour rester insensibles au fuseau du runner : le palier imminent
// et le libellé humain n'y sont donc jamais rendus. C'est ici, et seulement ici, qu'ils le sont.
describe('StatusBadge — rendu', () => {
  const PROGRAMMEE: StatusBadgeState = {
    tone: 'soon',
    labelKey: 'status.seance_programmee',
    draft: false,
  };

  it('libellé de registre résolu par le thème, teinte seule quand aucune intensité', async () => {
    const el = await createComponent(PROGRAMMEE);
    expect(el.textContent?.trim()).toBe('Programmée');
    expect(el.classList).toContain('status-badge--soon');
  });

  it('intensité « proche » → classe de densité EN PLUS de la teinte, jamais à la place', async () => {
    const el = await createComponent({ ...PROGRAMMEE, intensity: 'near' });
    expect(el.classList).toContain('status-badge--soon');
    expect(el.classList).toContain('status-badge--near');
  });

  // 🚨 Au dernier palier, `text` REMPLACE le libellé de registre : c'est le contrat explicite
  // (« ce soir », jamais « J-1 »). Sans cette branche, une séance du soir afficherait
  // « Programmée » — un mot juste, mais qui perd toute l'urgence que le palier existe pour porter.
  it('palier imminent → libellé HUMAIN à la place du registre, teinte inchangée', async () => {
    const el = await createComponent({ ...PROGRAMMEE, intensity: 'imminent', text: 'ce soir' });
    expect(el.textContent?.trim()).toBe('ce soir');
    expect(el.textContent?.trim()).not.toBe('Programmée');
    expect(el.classList).toContain('status-badge--soon');
    expect(el.classList).toContain('status-badge--imminent');
  });

  // Un brouillon est un traitement de FORME : aucune des quatre teintes ne doit sortir, même si
  // l'état en porte une pour rester total au typage.
  it('brouillon → variante de forme seule, aucune classe de teinte', async () => {
    const el = await createComponent({
      tone: 'todo',
      labelKey: 'status.scenario_brouillon',
      draft: true,
    });
    expect(el.textContent?.trim()).toBe('Brouillon');
    expect(el.classList).toContain('status-badge--draft');
    for (const tone of ['todo', 'live', 'soon', 'done']) {
      expect(el.classList.contains(`status-badge--${tone}`), tone).toBe(false);
    }
  });

  // Story 42.1 : l'« annulé » est un mot écrit AVANT d'être une couleur — le badge porte son texte et sa teinte.
  it('teinte annulée → classe dédiée, mot écrit (jamais la couleur seule)', async () => {
    const el = await createComponent({
      tone: 'cancelled',
      labelKey: 'status.scenario_passe',
      draft: false,
      text: 'Annulée',
    });
    expect(el.textContent?.trim()).toBe('Annulée');
    expect(el.classList).toContain('status-badge--cancelled');
  });
});
