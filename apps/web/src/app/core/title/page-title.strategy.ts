import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/** Marque constante, aussi titre de repli (celui d'`index.html`). */
export const APP_TITLE = 'Dés Dispos';

/**
 * Titre d'onglet par écran : « Dés Dispos – <page> » quand la route porte une propriété `title`,
 * sinon « Dés Dispos » (repli, y compris dans la zone connectée). Le titre d'un écran titré est
 * annoncé au lecteur d'écran à chaque changement d'écran (WCAG 2.4.2, 4.1.3) ; le repli ne l'est
 * pas, pour ne pas faire répéter « Dés Dispos » à chaque navigation de la zone connectée.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly announcer = inject(LiveAnnouncer);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    const full = page ? `${APP_TITLE} – ${page}` : APP_TITLE;
    this.title.setTitle(full);
    if (page) void this.announcer.announce(full);
  }
}
