import { TestBed } from '@angular/core/testing';
import { RendezvousPicker } from './rendezvous-picker';
import type { RendezvousRow } from './rendezvous.utils';
import { TONE_MAP } from '../../../core/theme/tones';

// Story 45.1 — le choix du rendez-vous : rendu pur, groupé par NOM de partie, une ligne = un choix.

const TONE = TONE_MAP['grimoire-emeraude'];

const row = (seanceId: string, partieName: string, over: Partial<RendezvousRow> = {}) =>
  ({
    seanceId,
    partieId: `p-${partieName}`,
    partieName,
    family: 'jdr',
    nature: 'seance',
    title: `Titre ${seanceId}`,
    ...over,
  }) as RendezvousRow;

describe('RendezvousPicker (Story 45.1)', () => {
  function create(rows: RendezvousRow[]) {
    const fixture = TestBed.createComponent(RendezvousPicker);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture;
  }

  it('groupe les lignes sous le nom de leur partie et écrit la nature en toutes lettres', () => {
    const fixture = create([
      row('s1', 'La Tour'),
      row('s2', 'Apéro', { nature: 'soiree', family: 'ralliement' }),
      row('s3', 'La Tour'),
    ]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rendezvous-picker__title')?.textContent?.trim()).toBe(
      TONE['calendar.rendezvous_picker_title'],
    );
    const groups = [...el.querySelectorAll('.rendezvous-picker__group')].map((g) => ({
      name: g.querySelector('h3')!.textContent!.trim(),
      rows: [...g.querySelectorAll('.rendezvous-picker__row')].map((r) => [
        r.querySelector('.rendezvous-picker__name')!.textContent!.trim(),
        r.querySelector('.rendezvous-picker__meta')!.textContent!.trim(),
      ]),
    }));
    expect(groups).toEqual([
      {
        name: 'La Tour',
        rows: [
          ['Titre s1', 'séance sans date'],
          ['Titre s3', 'séance sans date'],
        ],
      },
      { name: 'Apéro', rows: [['Titre s2', 'soirée sans date']] },
    ]);
  });

  it('choisir une ligne émet CE rendez-vous', () => {
    const fixture = create([row('s1', 'La Tour'), row('s2', 'La Tour')]);
    const chosen: RendezvousRow[] = [];
    fixture.componentInstance.chosen.subscribe((r) => chosen.push(r));
    (
      fixture.nativeElement.querySelectorAll('.rendezvous-picker__row')[1] as HTMLButtonElement
    ).click();
    expect(chosen.map((r) => r.seanceId)).toEqual(['s2']);
  });
});
