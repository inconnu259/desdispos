import { TestBed } from '@angular/core/testing';
import { DestinyList, type DestinyListItem } from './destiny-list';

const ITEM: DestinyListItem = {
  pollId: 'p1',
  partieName: 'Les Cendres',
  title: 'Chapitre 4',
  expiresAt: null,
  ended: false,
  optionCount: 2,
  state: 'todo',
};

describe('DestinyList — pictogramme (story 51.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('la destinée active est précédée du pictogramme destinee, décoratif', () => {
    TestBed.configureTestingModule({ imports: [DestinyList] });
    const fixture = TestBed.createComponent(DestinyList);
    fixture.componentRef.setInput('items', [ITEM]);
    fixture.componentRef.setInput('activePollId', 'p1');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const icon = el.querySelector('.destiny-list__name app-icon')!;
    expect(icon.getAttribute('data-icon')).toBe('destinee');
    expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.destiny-list__name')!.textContent).toContain('Chapitre 4');
    expect(el.querySelector('.destiny-list__name')!.textContent).not.toContain('✦');
  });
});
