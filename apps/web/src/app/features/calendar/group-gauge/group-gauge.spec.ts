import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GroupGauge } from './group-gauge';
import type { GroupAvailability, GroupMember } from '../group-availability.utils';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function member(id: string, status: GroupMember['status']): GroupMember {
  return { userId: id, pseudo: id, displayName: id.toUpperCase(), status };
}

function group(partial: Partial<GroupAvailability> = {}): GroupAvailability {
  return {
    available: 0,
    unavailable: 0,
    unknown: 0,
    total: 4,
    members: null,
    ...partial,
  };
}

describe('GroupGauge (Story 36.8)', () => {
  let fixture: ComponentFixture<GroupGauge>;

  async function render(value: GroupAvailability): Promise<HTMLElement> {
    fixture.componentRef.setInput('group', value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GroupGauge] }).compileComponents();
    fixture = TestBed.createComponent(GroupGauge);
  });

  describe('la jauge (AC3)', () => {
    it('rend une jauge remplie à proportion des disponibles, sans aucune identité', async () => {
      const el = await render(group({ available: 1, unknown: 3 }));

      const fill = el.querySelector<HTMLElement>('.gg-gauge .fill')!;
      expect(fill.style.height).toBe('25%');
      expect(el.querySelector('.members')).toBeNull();
      // AC3 : « aucune identité n'est exposée ». Rien de nominatif n'atteint le DOM.
      expect(el.textContent).not.toContain('ALICE');
    });

    it('rend une jauge PLEINE quand tout le groupe est disponible', async () => {
      const el = await render(group({ available: 4 }));
      expect(el.querySelector<HTMLElement>('.gg-gauge .fill')!.style.height).toBe('100%');
    });
  });

  describe('les deux vides (AC6)', () => {
    it('« personne ne s’est prononcé » ⇒ jauge VIDE, aucun remplissage rendu', async () => {
      const el = await render(group({ unknown: 4 }));

      const gauge = el.querySelector('.gg-gauge')!;
      expect(gauge.querySelector('.fill')).toBeNull();
      expect(gauge.classList.contains('gg-gauge--blocked')).toBe(false);
    });

    it('« tout le monde est bloqué » ⇒ jauge PLEINE et marquée, jamais confondue avec la vide', async () => {
      const el = await render(group({ unavailable: 4 }));

      const gauge = el.querySelector('.gg-gauge')!;
      expect(gauge.classList.contains('gg-gauge--blocked')).toBe(true);
      expect(gauge.querySelector<HTMLElement>('.fill')!.style.height).toBe('100%');
    });

    it('les distingue DANS LE DOM, pas seulement par une couleur calculée', async () => {
      const vide = (await render(group({ unknown: 4 }))).querySelector('.gg-gauge')!.outerHTML;
      const bloque = (await render(group({ unavailable: 4 }))).querySelector(
        '.gg-gauge',
      )!.outerHTML;
      expect(vide).not.toBe(bloque);
    });
  });

  describe('les pastilles (AC4/AC5)', () => {
    it('rend une pastille par membre, DANS L’ORDRE REÇU, la couleur portant le statut', async () => {
      const el = await render(
        group({
          available: 1,
          unavailable: 1,
          unknown: 2,
          members: [
            member('alice', 'AVAILABLE'),
            member('bob', 'UNAVAILABLE'),
            member('carol', 'UNKNOWN'),
            member('dave', 'UNKNOWN'),
          ],
        }),
      );

      const pastilles = [...el.querySelectorAll('.members .p')];
      expect(pastilles).toHaveLength(4);
      expect(pastilles.map((p) => p.className)).toEqual([
        'p p--yes',
        'p p--no',
        'p p--unknown',
        'p p--unknown',
      ]);
      expect(el.querySelector('.gg-gauge')).toBeNull();
    });

    it('l’ordre rendu SUIT l’ordre reçu — rien n’est retrié ici (la position identifie la personne)', async () => {
      const inverse = await render(
        group({
          available: 1,
          unavailable: 1,
          unknown: 2,
          members: [
            member('dave', 'UNKNOWN'),
            member('carol', 'UNKNOWN'),
            member('bob', 'UNAVAILABLE'),
            member('alice', 'AVAILABLE'),
          ],
        }),
      );

      expect([...inverse.querySelectorAll('.members .p')].map((p) => p.className)).toEqual([
        'p p--unknown',
        'p p--unknown',
        'p p--no',
        'p p--yes',
      ]);
    });

    it('six membres tiennent en pastilles', async () => {
      const six = Array.from({ length: 6 }, (_, i) => member(`u${i}`, 'AVAILABLE'));
      const el = await render(group({ available: 6, total: 6, members: six }));

      expect(el.querySelectorAll('.members .p')).toHaveLength(6);
      expect(el.querySelector('.gg-gauge')).toBeNull();
    });

    it('AU-DELÀ de six, retombe sur la jauge (AC5)', async () => {
      const seven = Array.from({ length: 7 }, (_, i) => member(`u${i}`, 'AVAILABLE'));
      const el = await render(group({ available: 7, total: 7, members: seven }));

      expect(el.querySelector('.members')).toBeNull();
      expect(el.querySelector('.gg-gauge')).not.toBeNull();
    });
  });

  describe('accessibilité (AC15)', () => {
    it('l’hôte porte role="img" et un nom accessible complet', async () => {
      await render(group({ available: 2, unavailable: 1, unknown: 1 }));
      const host = fixture.nativeElement as HTMLElement;

      expect(host.getAttribute('role')).toBe('img');
      expect(host.getAttribute('aria-label')).toContain('2 sur 4 disponibles');
      expect(host.getAttribute('aria-label')).toContain('1 indisponible');
    });

    it('dit les deux vides EN TOUTES LETTRES — jamais la couleur seule (P-1)', async () => {
      await render(group({ unknown: 4 }));
      expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toContain(
        GRIMOIRE_TONE['calendar.util_group_nobody'],
      );

      await render(group({ unavailable: 4 }));
      expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toContain(
        GRIMOIRE_TONE['calendar.util_group_all_blocked'],
      );
    });

    it('les nœuds visibles sont aria-hidden : ils doublent la forme à l’œil, pas à l’oreille', async () => {
      const el = await render(
        group({ available: 1, total: 2, members: [member('a', 'AVAILABLE')] }),
      );

      expect(el.querySelector('.members')!.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelector('.cnt')!.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('émet TOUJOURS le compteur — aucune logique de largeur en TypeScript', async () => {
    const el = await render(group({ available: 2 }));
    expect(el.querySelector('.cnt')!.textContent!.trim()).toBe('2 / 4');
  });

  it('ne produit jamais de NaN dans un attribut style, même sur une charge utile incomplète', async () => {
    const el = await render(
      group({ available: undefined as unknown as number, total: undefined as unknown as number }),
    );
    expect(el.querySelector('.fill')).toBeNull();
    expect(el.innerHTML).not.toContain('NaN');
  });
});
