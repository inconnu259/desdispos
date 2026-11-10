import { Component, inject } from '@angular/core';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

/** Rappel des règles de calcul d'XP — non interactif, jamais un CTA (cf. DESIGN.md RulesReminder). */
@Component({
  selector: 'app-rules-reminder',
  standalone: true,
  templateUrl: './rules-reminder.html',
  styleUrl: './rules-reminder.scss',
})
export class RulesReminder {
  protected readonly theme = inject(ThemeToneService);
}
