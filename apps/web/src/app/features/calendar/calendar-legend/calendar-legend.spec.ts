import { TestBed } from '@angular/core/testing';
import { CalendarLegend } from './calendar-legend';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

async function createLegend(overrides: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({ imports: [CalendarLegend] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarLegend);
  for (const [name, value] of Object.entries(overrides)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture;
}

describe('CalendarLegend', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('se rend sans aucun input — aucun input requis', async () => {
    const fixture = await createLegend();
    expect(fixture.nativeElement.querySelector('.legend')).toBeTruthy();
  });

  it('AC6 — deux groupes, aux intitulés du contrat', async () => {
    const fixture = await createLegend();
    const titles = [...fixture.nativeElement.querySelectorAll('.legend__group-title')].map(
      (e: any) => e.textContent.trim(),
    );
    expect(titles).toEqual([
      GRIMOIRE_TONE['calendar.legend.group_obvious'],
      GRIMOIRE_TONE['calendar.legend.group_needs'],
    ]);
  });

  it('AC6 — le groupe « évident » ne porte que disponible et indisponible', async () => {
    const fixture = await createLegend();
    const first = fixture.nativeElement.querySelectorAll('.legend__group')[0];
    const labels = [...first.querySelectorAll('.legend__label')].map((e: any) =>
      e.textContent.trim(),
    );
    expect(labels).toEqual(['Je suis disponible', 'Je suis indisponible']);
  });

  /**
   * 🚨 AC13 — le cœur de la légende. Chaque pastille porte la CLASSE RÉELLE de la bande, dont les
   * traitements viennent du partial partagé `_band-ranks.scss` : aucune teinte, aucune opacité,
   * aucune trame n'est réécrite ici. Ce test verrouille l'emploi des vrais `data-winner` — si
   * quelqu'un redessinait les pastilles « à l'identique » en dur, il tomberait.
   */
  it('AC13 — les pastilles emploient les vrais data-winner de la bande', async () => {
    const fixture = await createLegend();
    const winners = [...fixture.nativeElement.querySelectorAll('.legend__swatch[data-winner]')].map(
      (e: any) => e.getAttribute('data-winner'),
    );
    expect(winners).toEqual(['available', 'unavailable', 'seance', 'vote', 'none']);
  });

  /**
   * 🚨 DÉFAUT RÉEL TROUVÉ À L'ŒIL, invisible aux 2182 tests. `PollTrack` émet TOUJOURS son
   * compteur et ma réponse ; sans la classe d'hôte, ils débordaient de la pastille de 34 px et
   * passaient SOUS le libellé de l'entrée. C'est le piège de la story 36.6, au même endroit, deux
   * stories plus tard : la densité d'une surface se règle depuis `poll-track.scss`, jamais depuis
   * le SCSS de l'appelant, que l'encapsulation de vue rend inopérant.
   */
  it('la piste porte la classe d’hôte `in-legend` — sans elle, le compteur déborde', async () => {
    const fixture = await createLegend();
    expect(
      fixture.nativeElement.querySelector('app-poll-track').classList.contains('in-legend'),
    ).toBe(true);
  });

  it('AC13 — la participation et le groupe emploient les vrais composants, pas un dessin', async () => {
    const fixture = await createLegend({ partieContext: true });
    expect(fixture.nativeElement.querySelector('app-poll-track')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-group-gauge')).toBeTruthy();
  });

  /**
   * AC14 — la couche « disponibilité du groupe » n'existe pas hors d'une partie
   * [Source: contrat-ui-calendrier.html:277-278]. Une légende qui la décrirait quand même
   * expliquerait quelque chose que l'écran ne peut pas montrer — exactement le défaut de
   * conception que `DESIGN.md:390` interdit.
   */
  it('AC14 — hors contexte de partie, aucune entrée « disponibilité du groupe »', async () => {
    const fixture = await createLegend({ partieContext: false });
    const labels = [...fixture.nativeElement.querySelectorAll('.legend__label')].map((e: any) =>
      e.textContent.trim(),
    );
    expect(labels).not.toContain('Disponibilité du groupe');
    expect(fixture.nativeElement.querySelector('app-group-gauge')).toBeNull();
  });

  it('AC14 — en contexte de partie, l’entrée est présente', async () => {
    const fixture = await createLegend({ partieContext: true });
    const labels = [...fixture.nativeElement.querySelectorAll('.legend__label')].map((e: any) =>
      e.textContent.trim(),
    );
    expect(labels).toContain('Disponibilité du groupe');
  });

  it('les libellés du second groupe suivent le contrat', async () => {
    const fixture = await createLegend({ partieContext: true });
    const second = fixture.nativeElement.querySelectorAll('.legend__group')[1];
    const labels = [...second.querySelectorAll('.legend__label')].map((e: any) =>
      e.textContent.trim(),
    );
    expect(labels).toEqual([
      GRIMOIRE_TONE['calendar.legend.entry.seance'],
      'Créneau proposé au vote',
      'Participation : la piste = la troupe',
      'Disponibilité du groupe',
      'Personne ne s’est prononcé',
    ]);
  });

  /**
   * Les pastilles doublent le libellé à l'œil ; elles ne doivent pas le doubler à l'oreille.
   * Même règle que `PollTrack` et `GroupGauge`, dont les nœuds visibles sont `aria-hidden`.
   */
  it('les pastilles sont muettes pour un lecteur d’écran — le libellé porte seul le sens', async () => {
    const fixture = await createLegend();
    const swatches = fixture.nativeElement.querySelectorAll('.legend__swatch');
    expect(swatches.length).toBeGreaterThan(0);
    for (const swatch of swatches) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
