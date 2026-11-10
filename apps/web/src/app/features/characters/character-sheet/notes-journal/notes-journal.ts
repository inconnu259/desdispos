import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import type { CharacterNoteDto } from '@master-jdr/shared';
import { AppIcon } from '../../../../core/icons/app-icon';
import { CharacterService } from '../../../../core/characters/character.service';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';

@Component({
  selector: 'app-notes-journal',
  standalone: true,
  imports: [DatePipe, MatButtonModule, AppIcon],
  templateUrl: './notes-journal.html',
  styleUrl: './notes-journal.scss',
})
export class NotesJournal {
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);

  readonly characterId = input.required<string>();
  readonly isOwner = input.required<boolean>();

  protected readonly notes = signal<CharacterNoteDto[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly newText = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.characterId();
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.loadError.set(null);
    try {
      this.notes.set(await this.characterSvc.getNotes(id));
    } catch {
      this.loadError.set(this.theme.tone()['characters_sheet.notes_load_error']);
    }
  }

  protected async submitAdd(): Promise<void> {
    const text = this.newText().trim();
    if (!text || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const note = await this.characterSvc.addNote(this.characterId(), { text });
      this.notes.update((list) => [note, ...list]);
      this.newText.set('');
      // Un ajout réussi prouve que le journal est de nouveau accessible — sans ce reset, un
      // loadError posé par un échec de chargement initial masquerait la liste (et la note tout
      // juste ajoutée) derrière le message d'erreur jusqu'au prochain rechargement complet
      // (revue de code Story 6.5).
      this.loadError.set(null);
    } catch {
      this.submitError.set(this.theme.tone()['evolution.notes_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async toggleShare(note: CharacterNoteDto): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const updated = await this.characterSvc.toggleNoteShare(
        this.characterId(),
        note.id,
        !note.shared,
      );
      this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
    } catch {
      this.submitError.set(this.theme.tone()['evolution.notes_error']);
    } finally {
      this.submitting.set(false);
    }
  }
}
