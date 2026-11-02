import { TestBed } from '@angular/core/testing';
import type { PartieMemberDto } from '@master-jdr/shared';
import { RosterRail } from './roster-rail';
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

describe('RosterRail', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(
    hasFreeSlot = true,
    currentUserId = 'mj1',
    roleLabelFor: (c: unknown) => string | null = () => null,
    // Revue de code (bmad-review, 2026-09-21) : `true` par défaut pour préserver le comportement
    // historique de ces tests (écrits avant que le slot de création ne soit gardé par
    // `canCreateCharacter()` côté parent) — les tests dédiés à ce gate passent `false` eux-mêmes.
    canCreateCharacter = true,
  ) {
    TestBed.configureTestingModule({ imports: [RosterRail] });
    const fixture = TestBed.createComponent(RosterRail);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.componentRef.setInput('ownerId', 'mj1');
    fixture.componentRef.setInput('currentUserId', currentUserId);
    fixture.componentRef.setInput('canCreateCharacter', canCreateCharacter);
    fixture.componentRef.setInput('hasFreeSlot', hasFreeSlot);
    fixture.componentRef.setInput('classLabelFor', () => 'Ménestrel');
    fixture.componentRef.setInput('roleLabelFor', roleLabelFor);
    fixture.detectChanges();
    return fixture;
  }

  it('personnage sans classe : aria-label sans parenthèses, gabarit parties.roster_aria_character', () => {
    const fixture = setup();
    fixture.componentRef.setInput('classLabelFor', () => '');
    fixture.detectChanges();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    const label = playerItem.getAttribute('aria-label');
    expect(label).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_character'], {
        name: 'Alice au pays',
        character: 'Fenn',
      }),
    );
    expect(label).not.toContain('(');
  });

  it('est replié par défaut (pas la classe --expanded)', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement.querySelector('.roster-rail');
    expect(el.classList.contains('roster-rail--expanded')).toBe(false);
  });

  it('se déplie au clic sur le bouton toggle', () => {
    const fixture = setup();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.roster-rail__toggle');
    toggle.click();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('.roster-rail');
    expect(el.classList.contains('roster-rail--expanded')).toBe(true);
  });

  it("le badge MJ porte à la fois l'anneau de couleur (classe CSS) et un texte, jamais la couleur seule", () => {
    const fixture = setup();
    const mjItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="mj1"]');
    expect(mjItem.classList.contains('roster-rail__item--mj')).toBe(true);
    expect(mjItem.querySelector('.roster-rail__mj-badge')?.textContent?.trim()).toBe('MJ');
  });

  it("un joueur (non MJ) n'a pas le badge MJ", () => {
    const fixture = setup();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.classList.contains('roster-rail__item--mj')).toBe(false);
    expect(playerItem.querySelector('.roster-rail__mj-badge')).toBeNull();
  });

  it('slot "+ Inviter" visible si hasFreeSlot=true', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.roster-rail__invite-slot')).not.toBeNull();
  });

  it('slot "+ Inviter" absent si hasFreeSlot=false', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('.roster-rail__invite-slot')).toBeNull();
  });

  it("aria-label complet dès l'état replié (nom + rôle), pas seulement une icône", () => {
    const fixture = setup();
    const mjItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="mj1"]');
    expect(mjItem.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_mj'], { name: 'Sylas' }),
    );

    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.getAttribute('aria-label')).toBe('Alice au pays — Fenn (Ménestrel)');
  });

  it('un membre sans personnage encore créé a un aria-label explicite plutôt que vide', () => {
    const fixture = setup();
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_no_character'], { name: 'Alice au pays' }),
    );
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

  it('clic sur le slot "+ Inviter" émet openInvitations', () => {
    const fixture = setup(true);
    let emitted = false;
    fixture.componentInstance.openInvitations.subscribe(() => (emitted = true));
    const slot: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.roster-rail__invite-slot',
    );
    slot.click();
    expect(emitted).toBe(true);
  });

  it('le slot "+ Inviter" a un aria-label thématisé (non vide)', () => {
    const fixture = setup(true);
    const slot: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.roster-rail__invite-slot',
    );
    expect(slot.getAttribute('aria-label')).toBe('Convier un compagnon');
  });

  it('le bouton toggle a un aria-label thématisé, jamais codé en dur', () => {
    const fixture = setup();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.roster-rail__toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Déplier la troupe');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toBe('Replier la troupe');
  });

  it('la flèche du bouton toggle est une icône décorative : « precedent » déplié, « suivant » replié', () => {
    const fixture = setup();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.roster-rail__toggle');
    const icon = () => toggle.querySelector('app-icon');
    expect(icon()?.getAttribute('data-icon')).toBe('suivant');
    expect(icon()?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('');
    toggle.click();
    fixture.detectChanges();
    expect(icon()?.getAttribute('data-icon')).toBe('precedent');
  });

  it('un item du roster a une zone de tap de 36px (desktop), pas 44px (mobile)', () => {
    const fixture = setup();
    const item: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    const minHeight = parseFloat(getComputedStyle(item).minHeight || '0');
    expect(minHeight).toBe(36);
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
    expect(playerItem.querySelector('.roster-rail__levelup-badge')).not.toBeNull();
    expect(playerItem.getAttribute('aria-label')).toContain(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_levelup'], { label: '' }).replace(/^.*— /, ''),
    );
  });

  it('personnage sans niveau en attente → pas de badge de montée de niveau', () => {
    const fixture = setup();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.querySelector('.roster-rail__levelup-badge')).toBeNull();
  });

  it('personnage avec un rôle assigné et sans montée de niveau en attente → badge de rôle visible, title = libellé exact (Story 27.3)', () => {
    const fixture = setup(true, 'mj1', () => 'Cartographe');
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    const badge = playerItem.querySelector('.roster-rail__role-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toBe('Cartographe');
  });

  it('personnage avec un rôle assigné ET une montée de niveau en attente → badge de rôle absent, seul le badge de montée de niveau visible (Story 27.3, AC2)', () => {
    const fixture = setup(true, 'mj1', () => 'Cartographe');
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
    expect(playerItem.querySelector('.roster-rail__levelup-badge')).not.toBeNull();
    expect(playerItem.querySelector('.roster-rail__role-badge')).toBeNull();
  });

  it('personnage sans rôle assigné → aucun badge de rôle (Story 27.3)', () => {
    const fixture = setup();
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.querySelector('.roster-rail__role-badge')).toBeNull();
  });

  it('aria-label inclut le rôle assigné quand présent et pas de montée de niveau en attente (Story 27.3)', () => {
    const fixture = setup(true, 'mj1', () => 'Cartographe');
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(playerItem.getAttribute('aria-label')).toBe(
      `Alice au pays — Fenn (Ménestrel) — ${fillTone(GRIMOIRE_TONE['parties.roster_aria_role'], { label: '', role: 'Cartographe' }).replace(/^ — /, '')}`,
    );
  });

  it('joueur sans personnage sur sa propre ligne → clic émet createCharacter (pas selectCharacter)', () => {
    const fixture = setup(true, 'u1');
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();
    let createEmitted = false;
    let selectEmitted: unknown;
    fixture.componentInstance.createCharacter.subscribe(() => (createEmitted = true));
    fixture.componentInstance.selectCharacter.subscribe((v: unknown) => (selectEmitted = v));

    const ownItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(ownItem.getAttribute('tabindex')).toBe('0');
    ownItem.click();

    expect(createEmitted).toBe(true);
    expect(selectEmitted).toBeUndefined();
  });

  it("joueur sans personnage sur sa propre ligne mais canCreateCharacter=false (chargement en cours ou système sans module/partie clôturée) → slot non actionnable, aria-label générique, clic n'émet rien (bmad-review, 2026-09-21)", () => {
    const fixture = setup(true, 'u1', () => null, false);
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();
    let createEmitted = false;
    fixture.componentInstance.createCharacter.subscribe(() => (createEmitted = true));

    const ownItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(ownItem.getAttribute('tabindex')).toBe('-1');
    expect(ownItem.classList.contains('roster-rail__item--create')).toBe(false);
    expect(ownItem.querySelector('.roster-rail__create-badge')).toBeNull();
    expect(ownItem.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_no_character'], { name: 'Alice au pays' }),
    );
    ownItem.click();

    expect(createEmitted).toBe(false);
  });

  it("un membre SANS personnage qui n'est pas l'utilisateur courant reste non cliquable (tabindex -1), aucun événement émis", () => {
    const fixture = setup(true, 'mj1');
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();
    let createEmitted = false;
    fixture.componentInstance.createCharacter.subscribe(() => (createEmitted = true));

    const otherItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    expect(otherItem.getAttribute('tabindex')).toBe('-1');
    otherItem.click();

    expect(createEmitted).toBe(false);
  });

  it('la touche Espace active un membre au clavier comme Entrée', () => {
    const fixture = setup();
    let emitted: { characterId: string } | undefined;
    fixture.componentInstance.selectCharacter.subscribe(
      (v: { characterId: string }) => (emitted = v),
    );
    const playerItem: HTMLElement = fixture.nativeElement.querySelector('[data-user-id="u1"]');
    playerItem.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(emitted).toEqual({ characterId: 'c1' });
  });
});
