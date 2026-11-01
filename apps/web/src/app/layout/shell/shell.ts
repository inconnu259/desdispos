import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatBadgeModule } from '@angular/material/badge';
import { AppIcon } from '../../core/icons/app-icon';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { OpenPollsService } from '../../core/poll/open-polls.service';
import { UnseenAnnouncementsService } from '../../core/announcements/unseen-announcements.service';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { fillTone } from '../../core/theme/tone-format';
import { BrandLogo } from '../../shared/brand/brand-logo';
import { CreateIcon } from '../../shared/create-icon/create-icon';

@Component({
  selector: 'app-shell',
  imports: [
    AppIcon,
    BrandLogo,
    CreateIcon,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatBadgeModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly openPollsSvc = inject(OpenPollsService);
  private readonly unseenAnnouncementsSvc = inject(UnseenAnnouncementsService);
  // Injecter pour déclencher l'initialisation du thème (apply CSS class + localStorage) dès le Shell.
  protected readonly theme = inject(ThemeToneService);
  protected readonly contextualNav = inject(ContextualNavService);

  // Story 38.1 : libellé de thème du bouton de création (texte visible sur la barre, `aria-label` partout).
  protected readonly createLabel = computed(() => this.theme.tone()['nav.create_game']);

  protected readonly openPollsCount = this.openPollsSvc.count;
  protected readonly unseenAnnouncementsCount = this.unseenAnnouncementsSvc.count;

  // Story 29.13 : un seul badge sur la destination Parties (au lieu d'une 5e destination ou d'un
  // second élément d'UI dédié) — les deux notifications mènent au même endroit (le tableau de bord,
  // d'où l'on rejoint la Partie concernée), donc un compteur combiné avec description accessible
  // distincte reste lisible sans dupliquer le patron visuel.
  protected readonly homeBadgeCount = computed(
    () => this.openPollsCount() + this.unseenAnnouncementsCount(),
  );

  protected readonly homeBadgeDescription = computed(() => {
    const parts: string[] = [];
    const polls = this.openPollsCount();
    const announcements = this.unseenAnnouncementsCount();
    const tone = this.theme.tone();
    if (polls > 0) parts.push(fillTone(tone['shell.badge_polls_aria'], { n: polls }));
    if (announcements > 0) {
      parts.push(fillTone(tone['shell.badge_announcements_aria'], { n: announcements }));
    }
    return parts.join(', ');
  });

  // Story 29.13 (révision du 2026-08-13, retour utilisateur) : bandeau « push » distinct du badge —
  // le badge seul se referme trop vite pour être remarqué. Une annonce à la fois (la plus récente ;
  // `getUnseenAnnouncements()` trie déjà par `createdAt desc`, AD-3), tant qu'un nom de Partie n'est
  // pas résolu depuis `MyPartiesService` (chargement en parallèle, pas de garantie d'ordre) le bandeau
  // reste masqué plutôt que d'afficher un nom vide.
  protected readonly banner = computed(() => {
    const announcement = this.unseenAnnouncementsSvc.unseenAnnouncements()[0];
    if (!announcement) return null;
    const partieName = this.myPartiesSvc
      .allParties()
      .find((p) => p.id === announcement.partieId)?.name;
    if (!partieName) return null;
    return { announcement, partieName };
  });

  /** Libellé accessible du bouton de fermeture du bandeau (nom de la Partie dans le gabarit). */
  protected bannerCloseLabel(partieName: string): string {
    return fillTone(this.theme.tone()['shell.banner_close_aria'], { partie: partieName });
  }

  /** Fermer le bandeau = j'ai vu l'info, décision utilisateur explicite (2026-08-13) : équivaut à
   *  ouvrir l'annonce (même état persisté que le clic sur AnnonceCard), ne réapparaît jamais. */
  protected dismissBanner(announcementId: string): void {
    void this.unseenAnnouncementsSvc.markRead(announcementId);
  }

  // Charge les parties (alimente la liste unifiée du dashboard, Story 29.1).
  ngOnInit(): void {
    void this.myPartiesSvc.refreshAll();
  }
}
