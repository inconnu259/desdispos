import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { CALENDAR_LAYER_KEYS, type CalendarLayerKey } from '@master-jdr/shared';
import { AppIcon } from '../../core/icons/app-icon';
import { AuthService } from '../../core/auth/auth.service';
import { AccountService } from '../../core/account/account.service';
import { BoardGamesService } from '../../core/board-games/board-games.service';
import { formatBoardGameCount } from '../board-games/board-game-measures';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { DeleteAccountDialog } from './delete-account-dialog/delete-account-dialog';
import { ThemeSelector } from './theme-selector/theme-selector';
import { FieldEditPencil } from '../characters/character-sheet/field-edit-pencil/field-edit-pencil';
import { PasswordReveal } from '../../shared/password-reveal/password-reveal';
import { PasswordToggle } from '../../shared/password-reveal/password-toggle';

const DISPLAY_NAME_MAX_LENGTH = 60;

/**
 * Story 36.14, AC7 — les quatre INTENTIONS de l'écran de compte, et les clés que chacune écrit.
 *
 * « La préférence de calendrier cesse d'être une liste de couches techniques et pose la question
 * utile : qu'est-ce que je veux voir en arrivant sur un calendrier ? » [Source: prd.md:354]
 *
 * 🚨 Deux clés pour la première intention, une pour les autres — et `inscriptions-ouvertes` n'y
 * figure PAS : elle n'a plus d'interrupteur nulle part, mais la clé reste stockée et valide
 * (`@IsIn(CALENDAR_LAYER_KEYS)` côté serveur). « La clé reste, l'interrupteur part », sans
 * migration [Source: prd.md:305, addendum.md:83, annotation 35 du contrat].
 *
 * ⚠️ L'asymétrie avec le panneau « Affichage », qui sépare disponible et indisponible, est
 * VOULUE : « pour répondre à un vote on garde les indisponibilités visibles tout en éteignant les
 * disponibilités, qui ne sont que du bruit à ce moment-là » [Source: EXPERIENCE.md:221]. Le compte
 * règle une intention d'arrivée, l'écran règle un geste de lecture.
 */
export type CalendarIntentId = 'disponibilites' | 'seances' | 'votes' | 'groupe';

interface CalendarIntent {
  id: CalendarIntentId;
  keys: readonly CalendarLayerKey[];
}

const CALENDAR_INTENTS: readonly CalendarIntent[] = [
  { id: 'disponibilites', keys: ['mes-disponibilites', 'mes-indisponibilites'] },
  { id: 'seances', keys: ['mes-seances'] },
  { id: 'votes', keys: ['votes-en-cours'] },
  { id: 'groupe', keys: ['disponibilite-groupe'] },
];

@Component({
  selector: 'app-account',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    AppIcon,
    ThemeSelector,
    FieldEditPencil,
    PasswordReveal,
    PasswordToggle,
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly dialog = inject(MatDialog);
  private readonly boardGames = inject(BoardGamesService);

  protected readonly theme = inject(ThemeToneService);

  // Story 30.4 (AC1, AC4, Task 6) : jeu de couches actives par défaut, préférence de compte
  // (cross-appareil) — pas les bascules temporaires de la session, qui appartiennent à la Story
  // 30.6. Aucune bascule construite sur les écrans de calendrier eux-mêmes (encadré n°1 de la story).
  //
  // ⚠️ Story 36.14, AC7 — l'écran n'expose plus les six clés une à une : il pose QUATRE
  // INTENTIONS. `CALENDAR_LAYER_KEYS` reste la source de vérité du stockage, et
  // `onLayerToggle()` reste la primitive d'écriture (les tests de la 30.4 continuent de la
  // couvrir) ; les intentions sont une PRÉSENTATION posée par-dessus, jamais une nouvelle forme
  // de clé [Source: AD-1, AD-16 — aucune troisième forme de préférence].
  protected readonly calendarLayerKeys = CALENDAR_LAYER_KEYS;

  protected readonly calendarIntents = CALENDAR_INTENTS;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);

  // Page « sobre » (revue de code, demande utilisateur) : nom affiché et e-mail se lisent comme
  // le pseudo (lecture seule) avec un crayon d'édition à côté — le clic ouvre le champ inline. Le
  // mot de passe n'affiche aucun champ par défaut, juste un bouton qui révèle le formulaire.
  protected readonly editingPassword = signal(false);
  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSaved = signal(false);

  protected readonly editingEmail = signal(false);
  protected readonly emailForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newEmail: ['', [Validators.required, Validators.email]],
  });
  protected readonly emailSaving = signal(false);
  protected readonly emailError = signal<string | null>(null);
  protected readonly emailSaved = signal(false);

  // Story 43.1 — zone sensible : l'aperçu est relu à CHAQUE ouverture (on peut aller nommer un autre
  // administrateur puis revenir) ; en cas d'échec aucune fenêtre ne s'ouvre. L'effacement lui-même est
  // celui de la fenêtre (Story 43.2).
  protected readonly deleteLoading = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  // ⚠️ Story 48.1 — ligne « {titre du thème} · {n} jeu(x) › » vers la Ludothèque : le décompte est lu
  // une fois à l'ouverture de l'écran ; tant qu'il n'est pas connu (ou si la lecture échoue), seul le
  // titre s'affiche.
  protected readonly boardGamesCount = signal<number | null>(null);
  protected readonly boardGamesRowTitle = computed(() => {
    const tone = this.theme.tone();
    const n = this.boardGamesCount();
    const title = tone['board_games.title'];
    return n === null ? title : `${title} · ${formatBoardGameCount(n, tone)}`;
  });

  ngOnInit(): void {
    this.boardGames
      .list()
      .then((games) => this.boardGamesCount.set(games.length))
      .catch(() => {
        // non-bloquant — la ligne reste utilisable sans son décompte
      });
  }

  async openDeleteAccount(): Promise<void> {
    if (this.deleteLoading()) return;
    this.deleteLoading.set(true);
    this.deleteError.set(null);
    let closed: Promise<boolean | undefined>;
    try {
      const impact = await this.account.getDeletionImpact();
      const ref = this.dialog.open(DeleteAccountDialog, { data: { pseudo: this.pseudo, impact } });
      closed = firstValueFrom(ref.afterClosed());
    } catch {
      this.deleteError.set(this.theme.tone()['account.danger_load_error']);
      return;
    } finally {
      this.deleteLoading.set(false);
    }
    // Story 43.2 : la fenêtre ne se ferme sur `true` que si le compte est effacé. Plus de session : on
    // oublie l'utilisateur local et on arrive sur l'accueil public avec un message qui le confirme.
    if (await closed) {
      this.auth.currentUser.set(null);
      void this.router.navigate(['/login'], { queryParams: { compte: 'efface' } });
    }
  }

  constructor() {
    // Revue de code Story 29.4 : effect() plutôt qu'un appel statique en ngOnInit — cet écran
    // héberge le sélecteur de thème (ThemeSelector), un changement de thème sans navigation
    // doit mettre à jour le titre du bandeau comme le reste de la page (déjà lié à theme.tone()).
    effect(() => {
      this.contextualNav.set({ title: this.theme.tone()['account.title'] });
    });
  }

  protected get pseudo(): string {
    return this.auth.currentUser()?.pseudo ?? '';
  }

  protected get email(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  protected get displayName(): string {
    return this.auth.currentUser()?.displayName ?? '';
  }

  async onDisplayNameConfirm(value: string | number): Promise<void> {
    const displayName = String(value).trim();
    this.error.set(null);
    this.saved.set(false);
    // FieldEditPencil ne porte pas de validation propre (juste un garde NaN pour les nombres) —
    // les règles précédemment portées par le FormGroup (requis, non-vide, ≤60) sont revalidées ici.
    if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      this.error.set(this.theme.tone()['account.error']);
      return;
    }
    this.saving.set(true);
    try {
      const user = await this.account.updateDisplayName(displayName);
      this.auth.currentUser.set(user);
      this.saved.set(true);
    } catch {
      this.error.set(this.theme.tone()['account.error']);
    } finally {
      this.saving.set(false);
    }
  }

  protected isLayerActive(key: CalendarLayerKey): boolean {
    return this.auth.currentUser()?.defaultCalendarLayers?.includes(key) ?? false;
  }

  /**
   * Revue de code 36.14 — dernière valeur de `defaultCalendarLayers` CONFIRMÉE par le serveur,
   * partagée par `onLayerToggle()` et `onIntentToggle()`. Cible du rollback à la place de
   * `previous` : deux bascules rapprochées qui échouent TOUTES LES DEUX faisaient revenir
   * l'affichage sur la valeur optimiste de la première, elle-même jamais confirmée — un état que
   * ni le client ni le serveur n'avaient jamais réellement tenu. `previous` reste correct quand
   * une seule écriture est en vol ; `confirmedLayers` reste correct même quand plusieurs
   * s'enchaînent, en ne cédant du terrain qu'aux écritures qui ont vraiment réussi.
   */
  private confirmedLayers: CalendarLayerKey[] | null = null;

  /** Même patron optimiste-avec-rollback que `Dashboard.onHideFinishedChange()` (Story 30.4,
   *  Task 6) : mise à jour locale avant la requête, restauration en cas d'échec réseau.
   *  Revue de code : le rollback ne s'applique que si `next` est toujours la valeur affichée —
   *  sans cette garde, une bascule rapide sur une AUTRE couche avant que cette requête n'échoue
   *  écraserait silencieusement ce second changement, pourtant bien persisté côté serveur. */
  protected onLayerToggle(key: CalendarLayerKey, active: boolean): void {
    const previous = this.auth.currentUser();
    if (!previous) return;
    const current = previous.defaultCalendarLayers ?? [];
    this.confirmedLayers ??= current;
    const next = active ? [...current, key] : current.filter((k) => k !== key);
    this.auth.currentUser.set({ ...previous, defaultCalendarLayers: next });
    this.account
      .updatePreferences({ defaultCalendarLayers: next })
      .then(() => {
        this.confirmedLayers = next;
      })
      .catch(() => {
        const latest = this.auth.currentUser();
        if (latest?.defaultCalendarLayers === next) {
          this.auth.currentUser.set({
            ...latest,
            defaultCalendarLayers: this.confirmedLayers ?? current,
          });
        }
      });
  }

  private intentKeys(intent: CalendarIntentId): readonly CalendarLayerKey[] {
    return CALENDAR_INTENTS.find((i) => i.id === intent)!.keys;
  }

  /** Cochée seulement si TOUTES ses clés sont actives — voir `isIntentIndeterminate()` pour le cas
   *  mixte, qui ne doit surtout pas se lire « décochée ». */
  protected isIntentActive(intent: CalendarIntentId): boolean {
    return this.intentKeys(intent).every((k) => this.isLayerActive(k));
  }

  /**
   * 🚨 D-3 — l'état MIXTE existe pour de vrai. L'écran livré par la story 30.4 offrait
   * `mes-disponibilites` et `mes-indisponibilites` en deux cases distinctes : un compte peut donc
   * porter exactement l'une des deux aujourd'hui.
   *
   * Sans cet état, la case d'intention se lirait « décochée », et le premier clic — vécu comme
   * « j'allume » — passerait par `false` puis `true` ou, pire, effacerait la couche déjà active
   * sans que rien ne le signale. `indeterminate` dit la vérité, et un clic depuis là ARME les deux
   * clés : aucune couche ne disparaît sans un geste qui la vise.
   */
  protected isIntentIndeterminate(intent: CalendarIntentId): boolean {
    const keys = this.intentKeys(intent);
    const activeCount = keys.filter((k) => this.isLayerActive(k)).length;
    return activeCount > 0 && activeCount < keys.length;
  }

  /**
   * Écrit toutes les clés de l'intention **en un seul appel**.
   *
   * 🚨 Jamais deux `onLayerToggle()` successifs : chacun ouvre sa propre fenêtre de rollback sur
   * la même préférence, et le second écraserait la mise à jour optimiste du premier — le patron
   * de garde de la story 30.4 protège contre une bascule concurrente sur une AUTRE couche, pas
   * contre deux écritures qu'on aurait soi-même mises en concurrence.
   *
   * 🚨 AC16 — `next` se construit par différence sur le jeu COURANT : toute clé hors de cette
   * intention, `inscriptions-ouvertes` en tête, traverse intacte. Elle n'a plus d'interrupteur
   * mais reste un réglage valide, et aucun écran ne permettrait de la rétablir si on la perdait.
   */
  protected onIntentToggle(intent: CalendarIntentId, active: boolean): void {
    const previous = this.auth.currentUser();
    if (!previous) return;
    const keys = this.intentKeys(intent);
    const current = previous.defaultCalendarLayers ?? [];
    this.confirmedLayers ??= current;
    const withoutIntent = current.filter((k) => !keys.includes(k));
    const next = active ? [...withoutIntent, ...keys] : withoutIntent;

    this.auth.currentUser.set({ ...previous, defaultCalendarLayers: next });
    this.account
      .updatePreferences({ defaultCalendarLayers: next })
      .then(() => {
        this.confirmedLayers = next;
      })
      .catch(() => {
        const latest = this.auth.currentUser();
        if (latest?.defaultCalendarLayers === next) {
          this.auth.currentUser.set({
            ...latest,
            defaultCalendarLayers: this.confirmedLayers ?? current,
          });
        }
      });
  }

  protected startPasswordEdit(): void {
    this.editingPassword.set(true);
    this.passwordError.set(null);
    this.passwordSaved.set(false);
  }

  protected cancelPasswordEdit(): void {
    this.editingPassword.set(false);
    this.passwordForm.reset();
    this.passwordError.set(null);
  }

  async submitPassword(): Promise<void> {
    if (this.passwordForm.invalid) return;
    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordSaved.set(false);
    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      await this.account.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      this.passwordSaved.set(true);
      this.editingPassword.set(false);
    } catch (err) {
      this.passwordError.set(
        err instanceof HttpErrorResponse && err.status === 401
          ? this.theme.tone()['account.password_wrong_current']
          : this.theme.tone()['account.password_error'],
      );
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected startEmailEdit(): void {
    // Pré-rempli avec l'adresse courante (déjà visible juste avant le clic) plutôt que de laisser
    // un champ vide à ressaisir intégralement — l'utilisateur édite en place (revue de code).
    this.emailForm.patchValue({ newEmail: this.email });
    this.editingEmail.set(true);
    this.emailError.set(null);
    this.emailSaved.set(false);
  }

  protected cancelEmailEdit(): void {
    this.editingEmail.set(false);
    this.emailForm.reset();
    this.emailError.set(null);
  }

  /**
   * Ne met jamais à jour `this.auth.currentUser` (AC1/AC5, Story 28.6) : l'adresse du compte ne
   * change qu'une fois le lien de confirmation activé, jamais ici.
   */
  async submitEmailChange(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.emailSaving.set(true);
    this.emailError.set(null);
    this.emailSaved.set(false);
    try {
      const { currentPassword, newEmail } = this.emailForm.getRawValue();
      await this.account.requestEmailChange(currentPassword, newEmail);
      this.emailForm.reset();
      this.emailSaved.set(true);
      this.editingEmail.set(false);
    } catch (err) {
      this.emailError.set(
        this.emailErrorMessage(err instanceof HttpErrorResponse ? err.status : null),
      );
    } finally {
      this.emailSaving.set(false);
    }
  }

  // 401 (mot de passe incorrect) et 409 (adresse déjà prise) appellent chacun un message dédié —
  // retenter à l'identique après un 409 échouera toujours, un message générique serait trompeur
  // (revue de code).
  private emailErrorMessage(status: number | null): string {
    if (status === 401) return this.theme.tone()['account.email_change_wrong_current'];
    if (status === 409) return this.theme.tone()['account.email_change_taken'];
    return this.theme.tone()['account.email_change_error'];
  }

  // Déplacé depuis Shell (Story 29.3) : le menu utilisateur qui portait la déconnexion disparaît
  // au profit de la barre à 4 destinations, sans nouvel AC qui lui assigne un foyer — l'écran
  // Compte, atteignable en un geste depuis la barre, en est le foyer naturel.
  async logout(): Promise<void> {
    await this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
