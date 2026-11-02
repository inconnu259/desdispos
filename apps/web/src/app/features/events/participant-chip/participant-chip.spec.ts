import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EventParticipantDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { ParticipantChip } from './participant-chip';

const person = (over: Partial<EventParticipantDto> = {}): EventParticipantDto => ({
  userId: 'u2',
  displayName: 'Zoé',
  isHost: false,
  isAdmin: false,
  status: 'CONFIRMED',
  ...over,
});

describe('ParticipantChip — nom ouvrant une Ludothèque (Story 48.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount(
    participant: EventParticipantDto,
    inputs: { self?: boolean; libraryEnabled?: boolean } = {},
    theme: keyof typeof TONE_MAP = 'grimoire-emeraude',
  ) {
    TestBed.configureTestingModule({
      imports: [ParticipantChip],
      providers: [
        {
          provide: ThemeToneService,
          useValue: { tone: signal(TONE_MAP[theme]), activeTheme: signal(theme) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ParticipantChip);
    fixture.componentRef.setInput('participant', participant);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('par défaut (écran qui n’active rien) : une pastille inerte, comme avant', () => {
    const { el } = mount(person());

    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('.pc')?.textContent).toContain('Zoé');
  });

  it('activée : un bouton de nom accessible « Voir le cabinet de Zoé » qui émet le bouton touché', () => {
    const { fixture, el } = mount(person(), { libraryEnabled: true });
    const emitted: HTMLElement[] = [];
    fixture.componentInstance.libraryRequested.subscribe((t) => emitted.push(t));

    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Voir le cabinet de Zoé');
    expect(button.textContent).toContain('Zoé');
    button.click();

    expect(emitted).toEqual([button]);
  });

  it.each([
    ['foret-ancienne', 'Voir le coffre de Zoé'],
    ['atelier-cuivre', 'Voir le râtelier de Zoé'],
  ] as const)('%s : %s', (theme, expected) => {
    const { el } = mount(person(), { libraryEnabled: true }, theme);

    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(expected);
  });

  it('la pastille de la personne connectée reste inerte, avec son « (vous) »', () => {
    const { el } = mount(person(), { libraryEnabled: true, self: true });

    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('.pc--self')).not.toBeNull();
  });

  it('une place seulement réservée reste inerte', () => {
    const { el } = mount(person({ status: 'RESERVED' }), { libraryEnabled: true });

    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('.pc--pending')).not.toBeNull();
  });

  it('un administrateur garde son écu et son mot « Admin » dans le bouton', () => {
    const { el } = mount(person({ isAdmin: true }), { libraryEnabled: true });

    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.querySelector('app-icon.pc__shield')?.getAttribute('data-icon')).toBe(
      'role-admin',
    );
    expect(button.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_admin_badge'],
    );
  });
});
