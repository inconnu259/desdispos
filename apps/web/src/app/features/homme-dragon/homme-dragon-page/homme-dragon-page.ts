import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService, userTopic } from '../../../core/realtime/realtime.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { HommeDragonSheet } from '../homme-dragon-sheet/homme-dragon-sheet';

/**
 * Page de la fiche Homme Dragon (Story 33.5, AD-23 / Story 33.8) — route `homme-dragons/:id`,
 * atteinte depuis « Personnages » (carte d'un Homme Dragon), depuis l'onglet d'une aventure ou
 * après la création. Héberge `HommeDragonSheet`, qui lit la fiche par son `id` : un Homme Dragon
 * absent ou étranger répond `404`, affiché comme « introuvable » — aucune garde de route côté
 * front, le serveur est l'autorité (propriétaire seul).
 *
 * Temps réel (AD-23) : la page ouvre `user:{id}` ELLE-MÊME et le ferme à sa destruction — aucun
 * canal `partie:`, quel que soit le nombre d'aventures. Le niveau et l'historique suivent ainsi
 * un scénario clos sans rechargement (émission existante de `ScenariosService`) ; les écritures
 * de fiche n'émettent rien, le client se met à jour avec la réponse.
 */
@Component({
  selector: 'app-homme-dragon-page',
  imports: [RouterLink, HommeDragonSheet],
  templateUrl: './homme-dragon-page.html',
  styleUrl: './homme-dragon-page.scss',
})
export class HommeDragonPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeToneService);

  protected readonly hommeDragonId = signal('');
  /** Arrivée depuis le parcours de création (état de navigation) : bandeau « fiche créée ». */
  protected readonly justCreated = signal(
    this.router.currentNavigation()?.extras.state?.['justCreated'] === true,
  );

  ngOnInit(): void {
    this.contextualNav.set({ title: 'Homme Dragon' });
    this.hommeDragonId.set(this.route.snapshot.paramMap.get('id') ?? '');
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.realtime.connect(userTopic(userId));
      this.destroyRef.onDestroy(() => this.realtime.disconnect(userTopic(userId)));
    }
  }
}
