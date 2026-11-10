import { Component, computed, inject, input } from '@angular/core';
import type { PartieMemberDto, SessionPollDto } from '@desdispos/shared';
import { getMissingVoters } from '../../../core/poll/poll.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { IdentityLabel } from '../../../shared/identity/identity-label';

/**
 * Story 36.9, AC4 — le panneau « Vote en cours » du CALENDRIER, réduit à des personnes.
 *
 * `EXPERIENCE.md:374` : *« il se réduit à « qui manque » — la liste des votants sans réponse.
 * Motif : « qui n'a pas répondu » est une information de personnes ; elle n'a aucune case où se
 * poser. Tout le reste — dates, tendance, ma réponse — passe dans la grille. »*
 *
 * 🚨 **Pourquoi un composant à part plutôt qu'une variante de `PollStatusPanel`.** Ce dernier est
 * rendu à trois endroits : ici, et DEUX fois sur la fiche de scénario (`seance-list.html:117` et
 * `:201`), où sa liste d'options et son bouton « Sceller ce créneau » sont **le seul chemin de
 * scellement du projet**. Le vider aurait cassé ces deux surfaces. Un composant frère empêche par
 * construction qu'une évolution de la forme réduite fuie sur la fiche de scénario — exactement ce
 * que la story 36.7 a fait pour `app-poll-response`.
 *
 * Le composant ne porte **aucune action** : « Brûler le parchemin de vote » reste dans
 * `calendar-view.html`, à côté de lui, là où il était déjà.
 */
@Component({
  selector: 'app-poll-missing',
  standalone: true,
  imports: [IdentityLabel],
  templateUrl: './poll-missing.html',
  styleUrl: './poll-missing.scss',
})
export class PollMissingPanel {
  readonly poll = input.required<SessionPollDto>();
  readonly members = input<PartieMemberDto[]>([]);

  protected readonly theme = inject(ThemeToneService);

  /** « A répondu » = a voté sur TOUTES les options, la définition déjà posée par
   *  `getMissingVoters()`. Réutilisée telle quelle : une seconde définition de « manquant » sur
   *  le même écran divergerait de celle de la fiche de scénario. */
  protected readonly missing = computed(() => getMissingVoters(this.poll(), this.members()));

  protected readonly responded = computed(() => {
    const absent = new Set(this.missing().map((m) => m.userId));
    return this.members().filter((m) => !absent.has(m.userId));
  });

  /**
   * AC7 — le dénominateur vient du **serveur** (`membersCount`, l'effectif MJ compris depuis la
   * story 36.6), jamais de `members().length`.
   *
   * ⚠️ Dette connue et assumée (`deferred-work.md`, 36.6) : `GET /parties/:id/members` ne renvoie
   * pas le MJ, donc la liste nominative ci-dessous ne peut pas le nommer — alors qu'il peut
   * voter. Le compte, lui, reste juste : c'est précisément pourquoi il est affiché à côté d'une
   * liste qu'on sait incomplète. Refermer la dette suppose une liste de PARTICIPANTS côté
   * serveur, hors périmètre de cette story.
   */
  protected readonly summary = computed(() =>
    this.theme
      .tone()
      ['poll.status_summary'].replace('{responded}', String(this.responded().length))
      .replace('{total}', String(this.poll().membersCount)),
  );
}
