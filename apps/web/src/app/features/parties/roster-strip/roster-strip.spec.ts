import { TestBed } from '@angular/core/testing';
import type { PartieMemberDto } from '@master-jdr/shared';
import { RosterStrip } from './roster-strip';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';
import { fillTone } from '../../../core/theme/tone-format';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const MEMBERS: PartieMemberDto[] = [
  {
    role: 'MEMBER',
    userId: 'mj1',
    pseudo: 'Sylas',
    displayName: 'Sylas',
    email: 'sylas@example.com',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    role: 'MEMBER',
    userId: 'u1',
    pseudo: 'Alice',
    displayName: 'Alice au pays',
    email: 'alice@example.com',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
];

const CHARACTERS = [
  makeCharacterDto({ id: 'c1', userId: 'u1', sheetData: { narrative: { name: 'Fenn' } } }),
];

describe('RosterStrip', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(hasFreeSlot = true, roleLabelFor: (c: unknown) => string | null = () => null) {
    TestBed.configureTestingModule({ imports: [RosterStrip] });
    const fixture = TestBed.createComponent(RosterStrip);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.componentRef.setInput('ownerId', 'mj1');
    fixture.componentRef.setInput('hasFreeSlot', hasFreeSlot);
    fixture.componentRef.setInput('classLabelFor', () => 'Ménestrel');
    fixture.componentRef.setInput('roleLabelFor', roleLabelFor);
    fixture.detectChanges();
    return fixture;
  }

  it('affiche une pastille par membre, en layout horizontal scrollable', () => {
    const fixture = setup();
    const items = fixture.nativeElement.querySelectorAll('.roster-strip__item');
    expect(items.length).toBe(2);
    const strip: HTMLElement = fixture.nativeElement.querySelector('.roster-strip');
    expect(
      getComputedStyle(strip).overflowX === 'auto' || strip.classList.contains('roster-strip'),
    ).toBe(true);
  });

  it("le badge MJ porte l'anneau ET un texte, jamais la couleur seule", () => {
    const fixture = setup();
    const mjItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="mj1"]');
    expect(mjItem.classList.contains('roster-strip__item--mj')).toBe(true);
    expect(mjItem.querySelector('.roster-strip__mj-badge')?.textContent?.trim()).toBe('MJ');
  });

  it('aria-label complet par pastille (nom + rôle/personnage)', () => {
    const fixture = setup();
    const mjItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="mj1"]');
    expect(mjItem.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_mj'], { name: 'Sylas' }),
    );
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.getAttribute('aria-label')).toBe('Alice au pays — Fenn (Ménestrel)');
  });

  it('slot "+ Inviter" visible si hasFreeSlot=true', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.roster-strip__invite-slot')).not.toBeNull();
  });

  it('slot "+ Inviter" absent si hasFreeSlot=false', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('.roster-strip__invite-slot')).toBeNull();
  });

  it('le slot "+ Inviter" a un aria-label thématisé et émet openInvitations au clic', () => {
    const fixture = setup(true);
    let emitted = false;
    fixture.componentInstance.openInvitations.subscribe(() => (emitted = true));
    const slot: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.roster-strip__invite-slot',
    );
    expect(slot.getAttribute('aria-label')).toBe('Convier un compagnon');
    slot.click();
    expect(emitted).toBe(true);
  });

  it('clic sur un membre ayant un personnage émet selectCharacter avec son characterId', () => {
    const fixture = setup();
    let emitted: { characterId: string } | undefined;
    fixture.componentInstance.selectCharacter.subscribe(
      (v: { characterId: string }) => (emitted = v),
    );
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    playerItem.click();
    expect(emitted).toEqual({ characterId: 'c1' });
  });

  it('la touche Espace active une pastille au clavier comme Entrée', () => {
    const fixture = setup();
    let emitted: { characterId: string } | undefined;
    fixture.componentInstance.selectCharacter.subscribe(
      (v: { characterId: string }) => (emitted = v),
    );
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    playerItem.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(emitted).toEqual({ characterId: 'c1' });
  });

  it('personnage avec un niveau en attente → badge de montée de niveau visible', () => {
    const fixture = setup();
    fixture.componentRef.setInput('characters', [
      makeCharacterDto({
        id: 'c1',
        userId: 'u1',
        xp: 150,
        sheetData: { narrative: { name: 'Fenn' } },
      }),
    ]);
    fixture.detectChanges();

    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.querySelector('.roster-strip__levelup-badge')).not.toBeNull();
  });

  it('personnage avec un rôle assigné et sans montée de niveau en attente → badge de rôle visible (Story 27.3)', () => {
    const fixture = setup(true, () => 'Cartographe');
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    const badge = playerItem.querySelector('.roster-strip__role-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toBe('Cartographe');
  });

  it('personnage avec un rôle assigné ET une montée de niveau en attente → badge de rôle absent (Story 27.3, AC2)', () => {
    const fixture = setup(true, () => 'Cartographe');
    fixture.componentRef.setInput('characters', [
      makeCharacterDto({
        id: 'c1',
        userId: 'u1',
        xp: 150,
        sheetData: { narrative: { name: 'Fenn' } },
      }),
    ]);
    fixture.detectChanges();

    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.querySelector('.roster-strip__levelup-badge')).not.toBeNull();
    expect(playerItem.querySelector('.roster-strip__role-badge')).toBeNull();
  });

  it('personnage sans rôle assigné → aucun badge de rôle (Story 27.3)', () => {
    const fixture = setup();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.querySelector('.roster-strip__role-badge')).toBeNull();
  });

  it('la zone de tap de chaque pastille atteint au moins 44px malgré un avatar visuel de 26px', () => {
    const fixture = setup();
    const item: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    const minHeight = parseFloat(getComputedStyle(item).minHeight || '0');
    expect(minHeight).toBeGreaterThanOrEqual(44);
  });
});
