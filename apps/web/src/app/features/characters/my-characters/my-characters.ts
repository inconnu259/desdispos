import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  CharacterSort,
  ListViewMode,
  MyCharacterDto,
  MyHommeDragonDto,
} from '@master-jdr/shared';
import { CHARACTER_SORTS } from '@master-jdr/shared';
import { CharacterService } from '../../../core/characters/character.service';
import {
  filterMyItems,
  mergeMyItems,
  sortMyItems,
  type MyListItem,
} from '../../../core/characters/my-characters-items';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { hommeDragonAventuresLabel } from '../../../core/homme-dragon/homme-dragon.util';
import { RACE_LABELS } from '../../homme-dragon/homme-dragon-races';
import { CharacterSummaryCard } from '../character-summary-card/character-summary-card';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountService } from '../../../core/account/account.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { PartySignalsService } from '../../../core/parties/party-signals.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import {
  ListControlBar,
  type ListControlBarSortOption,
} from '../../../shared/list-control-bar/list-control-bar';
import {
  CharacterCreationEntries,
  type CharacterCreationEntry,
} from './character-creation-entries/character-creation-entries';

@Component({
  selector: 'app-my-characters',
  imports: [CharacterSummaryCard, ListControlBar, CharacterCreationEntries],
  templateUrl: './my-characters.html',
  styleUrl: './my-characters.scss',
})
export class MyCharacters implements OnInit {
  private readonly characters = inject(CharacterService);
  private readonly hommeDragonSvc = inject(HommeDragonService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeToneService);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly partySignals = inject(PartySignalsService);
  private readonly myParties = inject(MyPartiesService);

  protected readonly allCharacters = signal<MyCharacterDto[]>([]);
  /** Hommes Dragons du MJ (Story 33.5) — lecture agrégée `GET /me/homme-dragons`, fusionnée ici
   *  avec les personnages. Vide pour un simple joueur : le serveur ne sert jamais le dragon d'un
   *  MJ à un autre membre. */
  protected readonly allHommesDragons = signal<MyHommeDragonDto[]>([]);
  /** `true` si la lecture des Hommes Dragons a échoué : les personnages restent affichés, seul un
   *  message discret le signale (jamais une page vide). */
  protected readonly hommesDragonsError = signal(false);
  protected readonly all = computed<MyListItem[]>(() =>
    mergeMyItems(this.allCharacters(), this.allHommesDragons()),
  );
  protected readonly raceLabels = RACE_LABELS;
  /** Noms des aventures d'un Homme Dragon, joints pour la carte (« Les Vents du Nord · L'Archipel »)
   *  ou « Sans aventure » (Story 33.8). */
  protected readonly aventuresLabel = (
    aventures: Parameters<typeof hommeDragonAventuresLabel>[0],
  ): string =>
    hommeDragonAventuresLabel(aventures, this.theme.tone()['core.homme_dragon_sans_aventure']);
  protected readonly query = signal('');

  protected readonly sortOptions = CHARACTER_SORTS;
  /** Critère de tri effectif (Story 29.9, AC1/AC4) — même patron que `Dashboard.partiesSort`. */
  protected readonly charactersSort = computed<CharacterSort>(
    () => this.auth.currentUser()?.charactersSort ?? 'partie',
  );
  /** Mode d'affichage effectif (Story 29.9, AC1/AC3) — même patron que `Dashboard.partiesViewMode`. */
  protected readonly charactersViewMode = computed<ListViewMode>(
    () => this.auth.currentUser()?.charactersViewMode ?? 'medium',
  );
  protected readonly sortOptionsForBar = computed<ListControlBarSortOption[]>(() =>
    this.sortOptions.map((sort) => ({ value: sort, label: this.sortLabel(sort) })),
  );
  /** Aucun réglage transitoire sur cet écran une fois `ListControlBar` en place — la recherche est
   *  une saisie de consultation, pas un réglage (AC6). `partiesSort`/`viewMode` équivalents pour
   *  les personnages se persistent immédiatement à chaque changement (même raisonnement que
   *  `Dashboard`) : la pastille de résumé n'est donc jamais affichée sur cette liste. */
  protected readonly hasDeviatedFromDefault = false;
  protected readonly gridDensityClass = computed(() => `list--${this.charactersViewMode()}`);

  // AC4 : filtrage en direct sur le nom affiché — même convention d'identité que l'épic 28
  // (`itemName()` s'appuie sur characterName() / hommeDragonName(), pas de réimplémentation locale
  // des replis « Personnage sans nom » / « Homme Dragon sans nom »).
  private readonly searchFiltered = computed(() => filterMyItems(this.all(), this.query()));
  /** Tri (Task 4) appliqué après le filtrage par recherche existant, ne le remplace pas. Au tri
   *  « Niveau », les Hommes Dragons passent après tous les personnages (Story 33.5). */
  protected readonly filtered = computed(() =>
    sortMyItems(this.searchFiltered(), this.charactersSort()),
  );

  protected sortLabel(sort: CharacterSort): string {
    return this.theme.tone()[`my_characters.sort_${sort}`] ?? sort;
  }

  /** Section « À forger » (Story 29.16, 33.5) — croise les signaux serveur `PERSONNAGE_A_CREER` et
   *  `HOMME_DRAGON_A_CREER` (`PartySignalsService.signals`, seule source de vérité de
   *  l'éligibilité, jamais recalculée ici) avec `MyPartiesService.allParties()` pour retrouver nom
   *  et `gameSystemId`, absents du DTO de signal. Ordre = ordre par défaut de `allParties()`, en
   *  une seule pile. Depuis AD-23, le signal `HOMME_DRAGON_A_CREER` est calculé côté serveur
   *  (partie du MJ, Ryuutama, sans Homme Dragon lié) : aucun filtre de système ici. */
  protected readonly creationEntries = computed<CharacterCreationEntry[]>(() => {
    const signals = this.partySignals.signals();
    return this.myParties.allParties().flatMap((p): CharacterCreationEntry[] => {
      const partieSignals = signals.get(p.id)?.signals ?? [];
      const base = { partieId: p.id, gameSystemId: p.gameSystemId, partieName: p.name };
      const entries: CharacterCreationEntry[] = [];
      if (partieSignals.includes('PERSONNAGE_A_CREER')) {
        entries.push({ ...base, kind: 'character' });
      }
      if (partieSignals.includes('HOMME_DRAGON_A_CREER')) {
        entries.push({ ...base, kind: 'hommeDragon' });
      }
      return entries;
    });
  });

  /** Passe à `true` une fois le `refresh()` de `ngOnInit` résolu (succès ou échec) — évite que
   *  `emptyMessageKey` clignote de `my_characters.empty` vers `empty_with_entries` si
   *  `characterSvc.listMine()` résout avant les signaux (deux appels réseau non coordonnés).
   *  Même principe que l'« absence de squelette » déjà posé pour la section elle-même : pas d'état
   *  transitoire trompeur pendant le chargement initial. */
  protected readonly creationDataLoaded = signal(false);

  protected readonly emptyMessageKey = computed<string>(() =>
    this.creationDataLoaded() && this.creationEntries().length > 0
      ? 'my_characters.empty_with_entries'
      : 'my_characters.empty',
  );

  async ngOnInit(): Promise<void> {
    this.contextualNav.set({ title: this.theme.tone()['my_characters.title'] });
    // Rafraîchit les signaux à l'activation de la route (Story 29.16) : minimum temps réel exigé
    // par l'AC « retour du wizard après création » — `notifyChanged()` (SSE `user:{id}`) ne suffit
    // pas seul, l'utilisateur peut revenir avant tout événement temps réel.
    void this.partySignals.refresh().finally(() => this.creationDataLoaded.set(true));
    // Deux lectures indépendantes, en parallèle (une seule requête chacune, jamais une par partie) :
    // l'échec de l'une ne prive jamais l'écran de l'autre.
    const [characters, hommesDragons] = await Promise.allSettled([
      this.characters.listMine(),
      this.hommeDragonSvc.listMine(),
    ]);
    this.allCharacters.set(characters.status === 'fulfilled' ? characters.value : []);
    if (hommesDragons.status === 'fulfilled') {
      this.allHommesDragons.set(hommesDragons.value);
    } else {
      this.allHommesDragons.set([]);
      this.hommesDragonsError.set(true);
    }
  }

  /** Personnage → sa fiche ; Homme Dragon → sa fiche par son id, `/homme-dragons/:id` — y compris
   *  sans aucune aventure (AD-23, Story 33.8). */
  open(item: MyListItem): void {
    if (item.kind === 'hommeDragon') {
      void this.router.navigate(['/homme-dragons', item.hommeDragon.id]);
      return;
    }
    const c = item.character;
    void this.router.navigate(['/parties', c.partieId, 'characters', c.id]);
  }

  /** Tri (Story 29.9, AC3) — même patron fire-and-forget + rollback que `Dashboard.onSortChange()`. */
  protected onSortChange(sort: CharacterSort): void {
    const previous = this.auth.currentUser();
    if (previous) this.auth.currentUser.set({ ...previous, charactersSort: sort });
    this.account.updatePreferences({ charactersSort: sort }).catch(() => {
      if (previous) this.auth.currentUser.set(previous);
    });
  }

  /** Mode d'affichage (Story 29.9, AC1/AC3) — même patron fire-and-forget + rollback. */
  protected onViewModeChange(mode: ListViewMode): void {
    const previous = this.auth.currentUser();
    if (previous) this.auth.currentUser.set({ ...previous, charactersViewMode: mode });
    this.account.updatePreferences({ charactersViewMode: mode }).catch(() => {
      if (previous) this.auth.currentUser.set(previous);
    });
  }
}
