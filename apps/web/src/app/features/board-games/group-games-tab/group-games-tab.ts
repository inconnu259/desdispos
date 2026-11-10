import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { GroupBoardGameDto, UserLibraryOwnerDto } from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { formatBoardGameCount, formatBoardGameMeasures } from '../board-game-measures';
import { LibrarySheet } from '../library-sheet/library-sheet';
import {
  GROUP_FIT_CHOICES,
  countGroupOwners,
  filterGroupGames,
  type GroupFitChoice,
} from './group-games-filter';

/** Un propriétaire tel que la ligne le montre : son nom, ou « moi » quand c'est la personne connectée. */
interface OwnerView {
  userId: string;
  label: string;
  isMe: boolean;
}

interface RowView {
  nameKey: string;
  name: string;
  measures: string;
  owners: OwnerView[];
}

/**
 * ⚠️ L'onglet des jeux du groupe (Story 50.1, EXPERIENCE.md §2.5) — « Reliques / Trésors / Joyaux », 4ᵉ onglet
 * d'un groupe de ralliement : les jeux de ses membres actuels, une ligne par nom (regroupement fait par l'API sur
 * `nameKey`), avec leurs propriétaires. Lecture seule : « Chercher un jeu… », puces « Jouable à : 2 · 4 · 6 · 8+ »
 * (une seule active, re-toucher l'éteint ; un jeu sans nombre de joueurs n'est retenu par aucune), pied « {n} jeux
 * chez {m} membres » (ce qui est listé). Toucher un propriétaire ouvre sa `LibrarySheet` (Story 48.3) ; la
 * personne connectée figure en « moi », sans bouton.
 *
 * Temps réel : la liste se relit sur `BoardGamesService.changed` (la page est déjà abonnée à `partie:{id}`, que
 * déclenchent un départ, un retrait, une arrivée et toute écriture de Ludothèque d'un membre). Une lecture
 * dépassée par une plus récente est ignorée. Perdre l'accès (retiré du groupe) vide l'onglet sur le repli neutre.
 */
@Component({
  selector: 'app-group-games-tab',
  imports: [AppIcon, LibrarySheet],
  templateUrl: './group-games-tab.html',
  styleUrl: './group-games-tab.scss',
})
export class GroupGamesTab {
  private readonly boardGames = inject(BoardGamesService);
  protected readonly theme = inject(ThemeToneService);

  readonly partieId = input.required<string>();
  /** La personne connectée : son nom devient « moi » et n'ouvre pas de feuille. */
  readonly currentUserId = input<string | null>(null);

  /** `null` tant que la première lecture n'a pas abouti. */
  protected readonly games = signal<GroupBoardGameDto[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly query = signal('');
  protected readonly fit = signal<GroupFitChoice | null>(null);
  protected readonly fitChoices = GROUP_FIT_CHOICES;

  protected readonly library = signal<{
    userId: string;
    name: string;
    trigger: HTMLElement;
  } | null>(null);

  /** Numéro de la dernière lecture : une réponse plus ancienne n'écrase rien. */
  private sequence = 0;
  /** Le groupe de la dernière lecture : un autre groupe repart d'un onglet vierge. */
  private loadedPartieId: string | null = null;

  /** Noms affichés portés par plusieurs personnes : départagés par le pseudo, comme « Missives ». */
  private readonly ambiguousNames = computed(() => {
    const idsByName = new Map<string, Set<string>>();
    for (const game of this.games() ?? []) {
      for (const owner of game.owners) {
        const ids = idsByName.get(owner.displayName) ?? new Set<string>();
        ids.add(owner.userId);
        idsByName.set(owner.displayName, ids);
      }
    }
    return new Set([...idsByName].filter(([, ids]) => ids.size > 1).map(([name]) => name));
  });

  private readonly filtered = computed(() =>
    filterGroupGames(this.games() ?? [], this.query(), this.fit()),
  );

  protected readonly rows = computed<RowView[]>(() => {
    const tone = this.theme.tone();
    const me = this.currentUserId();
    return this.filtered().map((game) => ({
      nameKey: game.nameKey,
      name: game.name,
      measures: formatBoardGameMeasures(game, tone),
      owners: game.owners.map((owner) => this.ownerView(owner, me, tone)),
    }));
  });

  protected readonly isEmpty = computed(() => this.games()?.length === 0);

  /** « {n} jeux chez {m} membres » — d'après ce qui est listé, accordé. */
  protected readonly footer = computed(() => {
    const tone = this.theme.tone();
    const listed = this.filtered();
    const members = countGroupOwners(listed);
    return fillTone(tone['board_games.group_footer'], {
      games: formatBoardGameCount(listed.length, tone),
      members: fillTone(
        tone[
          members <= 1
            ? 'board_games.group_footer_members_one'
            : 'board_games.group_footer_members_many'
        ],
        { m: members },
      ),
    });
  });

  protected readonly noMatch = computed(
    () => !this.isEmpty() && this.games() !== null && this.rows().length === 0,
  );

  constructor() {
    // Première lecture, puis relecture sur chaque `changed` (temps réel) ou changement de groupe.
    effect(() => {
      const partieId = this.partieId();
      this.boardGames.changed();
      untracked(() => void this.load(partieId));
    });
  }

  private ownerView(
    owner: UserLibraryOwnerDto,
    me: string | null,
    tone: Record<string, string>,
  ): OwnerView {
    if (owner.userId === me) {
      return { userId: owner.userId, label: tone['board_games.group_owner_me'], isMe: true };
    }
    const label = this.ambiguousNames().has(owner.displayName)
      ? `${owner.displayName} (${owner.pseudo})`
      : owner.displayName;
    return { userId: owner.userId, label, isMe: false };
  }

  private async load(partieId: string): Promise<void> {
    const seq = ++this.sequence;
    if (this.loadedPartieId !== null && this.loadedPartieId !== partieId) {
      // Un autre groupe : ni ses jeux, ni la recherche, ni une feuille ouverte ne survivent au changement.
      this.games.set(null);
      this.failed.set(false);
      this.query.set('');
      this.fit.set(null);
      this.library.set(null);
    }
    this.loadedPartieId = partieId;
    try {
      const result = await this.boardGames.listOfGroup(partieId);
      if (seq !== this.sequence) return;
      this.games.set(result.games);
      this.failed.set(false);
    } catch (err) {
      if (seq !== this.sequence) return;
      // Accès perdu (retiré du groupe, groupe supprimé) : plus rien à montrer. Toute autre panne garde la liste
      // déjà lue.
      if (err instanceof HttpErrorResponse && (err.status === 403 || err.status === 404)) {
        this.games.set(null);
        this.failed.set(true);
        // La feuille d'un ancien co-membre ne reste pas ouverte sur un groupe qu'on a quitté.
        this.library.set(null);
      } else if (this.games() === null) {
        this.failed.set(true);
      }
    }
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Toucher la puce active l'éteint ; toucher une autre la remplace. */
  protected toggleFit(choice: GroupFitChoice): void {
    this.fit.update((current) => (current === choice ? null : choice));
  }

  protected chipLabel(choice: GroupFitChoice): string {
    return choice === 8 ? '8+' : String(choice);
  }

  protected chipAria(choice: GroupFitChoice): string {
    return fillTone(this.theme.tone()['board_games.group_fit_chip_aria'], {
      n: this.chipLabel(choice),
    });
  }

  protected openAria(owner: OwnerView): string {
    return fillTone(this.theme.tone()['board_games.open_aria'], { nom: owner.label });
  }

  protected openLibrary(owner: OwnerView, event: Event): void {
    this.library.set({
      userId: owner.userId,
      name: owner.label,
      trigger: event.currentTarget as HTMLElement,
    });
  }

  protected closeLibrary(): void {
    this.library.set(null);
  }
}
