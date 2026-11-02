import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { CharacterNoteDto } from '@master-jdr/shared';
import { NotesJournal } from './notes-journal';
import { CharacterService } from '../../../../core/characters/character.service';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeNote(overrides: Partial<CharacterNoteDto> = {}): CharacterNoteDto {
  return {
    id: 'note-1',
    characterId: 'char1',
    text: 'Une note',
    shared: false,
    scenarioId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function createComponent(characterSvc: Partial<CharacterService>, isOwner = true) {
  await TestBed.configureTestingModule({
    imports: [NotesJournal],
    providers: [{ provide: CharacterService, useValue: characterSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(NotesJournal);
  fixture.componentRef.setInput('characterId', 'char1');
  fixture.componentRef.setInput('isOwner', isOwner);
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  return fixture;
}

describe('NotesJournal', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('liste vide + isOwner:true → empty state ET CTA d’ajout visibles', async () => {
    const fixture = await createComponent({ getNotes: vi.fn().mockResolvedValue([]) }, true);

    expect(fixture.nativeElement.querySelector('.notes-journal__empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.notes-journal__add-form')).not.toBeNull();
  });

  it('liste vide + isOwner:false → empty state sans CTA', async () => {
    const fixture = await createComponent({ getNotes: vi.fn().mockResolvedValue([]) }, false);

    expect(fixture.nativeElement.querySelector('.notes-journal__empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.notes-journal__add-form')).toBeNull();
  });

  it('liste non vide → date/texte affichés, ordre respecté (confiance backend)', async () => {
    const notes = [
      makeNote({ id: 'n2', text: 'Deuxième note', createdAt: '2026-01-02T00:00:00.000Z' }),
      makeNote({ id: 'n1', text: 'Première note', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const fixture = await createComponent({ getNotes: vi.fn().mockResolvedValue(notes) });

    const entries = fixture.nativeElement.querySelectorAll('.notes-journal__entry');
    expect(entries.length).toBe(2);
    expect(entries[0].textContent).toContain('Deuxième note');
    expect(entries[1].textContent).toContain('Première note');
  });

  it('toggle de partage absent si isOwner:false', async () => {
    const fixture = await createComponent(
      { getNotes: vi.fn().mockResolvedValue([makeNote()]) },
      false,
    );

    expect(fixture.nativeElement.querySelector('.notes-journal__share-toggle')).toBeNull();
  });

  it('toggle de partage visible et cliquable si isOwner:true, appelle toggleNoteShare avec !note.shared', async () => {
    const characterSvc = {
      getNotes: vi.fn().mockResolvedValue([makeNote({ shared: false })]),
      toggleNoteShare: vi.fn().mockResolvedValue(makeNote({ shared: true })),
    };
    const fixture = await createComponent(characterSvc, true);

    const toggle = fixture.nativeElement.querySelector(
      '.notes-journal__share-toggle',
    ) as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    toggle.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(characterSvc.toggleNoteShare).toHaveBeenCalledWith('char1', 'note-1', true);
  });

  it('ajout appelle addNote avec le texte trimé, préfixe la nouvelle entrée en tête de liste', async () => {
    const newNote = makeNote({ id: 'n2', text: 'Nouvelle note' });
    const characterSvc = {
      getNotes: vi.fn().mockResolvedValue([makeNote({ id: 'n1', text: 'Ancienne note' })]),
      addNote: vi.fn().mockResolvedValue(newNote),
    };
    const fixture = await createComponent(characterSvc, true);
    const comp = fixture.componentInstance as any;

    comp.newText.set('  Nouvelle note  ');
    await comp.submitAdd();
    fixture.detectChanges();

    expect(characterSvc.addNote).toHaveBeenCalledWith('char1', { text: 'Nouvelle note' });
    const entries = fixture.nativeElement.querySelectorAll('.notes-journal__entry');
    expect(entries[0].textContent).toContain('Nouvelle note');
  });

  it('erreur réseau (ajout) affiche le message inline', async () => {
    const characterSvc = {
      getNotes: vi.fn().mockResolvedValue([]),
      addNote: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const fixture = await createComponent(characterSvc, true);
    const comp = fixture.componentInstance as any;

    comp.newText.set('Texte');
    await comp.submitAdd();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.notes_error']);
  });

  it('erreur réseau (toggle) affiche le message inline', async () => {
    const characterSvc = {
      getNotes: vi.fn().mockResolvedValue([makeNote()]),
      toggleNoteShare: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const fixture = await createComponent(characterSvc, true);
    const comp = fixture.componentInstance as any;

    await comp.toggleShare(makeNote());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.notes_error']);
  });

  it('une note ajoutée avec succès après un échec de chargement initial redevient visible (corrige loadError non réinitialisé, revue de code Story 6.5)', async () => {
    const newNote = makeNote({ id: 'n1', text: 'Nouvelle note' });
    const characterSvc = {
      getNotes: vi.fn().mockRejectedValue(new Error('boom')),
      addNote: vi.fn().mockResolvedValue(newNote),
    };
    const fixture = await createComponent(characterSvc, true);
    expect(fixture.nativeElement.querySelector('.notes-journal__error')).not.toBeNull();

    const comp = fixture.componentInstance as any;
    comp.newText.set('Nouvelle note');
    await comp.submitAdd();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notes-journal__error')).toBeNull();
    const entries = fixture.nativeElement.querySelectorAll('.notes-journal__entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Nouvelle note');
  });

  it('propriétaire : le bouton de partage porte cadenas-ouvert (partagée) / cadenas-ferme (privée), deux noms différents', async () => {
    const notes = [makeNote({ id: 'n1', shared: true }), makeNote({ id: 'n2', shared: false })];
    const fixture = await createComponent({ getNotes: vi.fn().mockResolvedValue(notes) }, true);

    const toggles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.notes-journal__share-toggle'),
    ) as HTMLButtonElement[];
    const names = toggles.map((t) => t.querySelector('app-icon')?.getAttribute('data-icon'));
    expect(names).toEqual(['cadenas-ouvert', 'cadenas-ferme']);
    expect(names[0]).not.toBe(names[1]);
    // Le nom du bouton reste son aria-label d'état ; l'icône, à côté du texte, est décorative.
    expect(toggles[0].getAttribute('aria-label')).toBe(GRIMOIRE_TONE['evolution.note_shared_label']);
    expect(toggles[1].getAttribute('aria-label')).toBe(GRIMOIRE_TONE['evolution.note_private_label']);
    expect(toggles[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(toggles[0].textContent).not.toContain('🔓');
  });

  it('lecteur : l’icône seule porte le nom de l’état, pas son conteneur', async () => {
    const notes = [makeNote({ id: 'n1', shared: true }), makeNote({ id: 'n2', shared: false })];
    const fixture = await createComponent({ getNotes: vi.fn().mockResolvedValue(notes) }, false);

    const indicators = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.notes-journal__share-indicator'),
    ) as HTMLElement[];
    expect(indicators.map((i) => i.querySelector('app-icon')?.getAttribute('data-icon'))).toEqual([
      'cadenas-ouvert',
      'cadenas-ferme',
    ]);
    expect(indicators.map((i) => i.querySelector('svg')?.getAttribute('aria-label'))).toEqual([
      GRIMOIRE_TONE['evolution.note_shared_label'],
      GRIMOIRE_TONE['evolution.note_private_label'],
    ]);
    expect(indicators[0].hasAttribute('aria-label')).toBe(false);
  });
});
