# Extrait des sources — UX delta Palier 10.4

*Digest pour le designer. Chemins relatifs à la racine du dépôt. P9 = `ux-designs/ux-jdr-master-2026-08-04/`, P10 = `ux-designs/ux-jdr-master-2026-10-08/`. Le code fait foi sur l'état réel quand il diverge des planches.*

## 1. Disposition réelle du calendrier (code, 2026-10-20)

- **Trois routes, un seul composant `CalendarView`** : `/parties/:id/calendar` (mode `mj`), `/parties/:id/guild-calendar` (mode `personal` : joueur de JDR **et** groupe), `/profile/calendar` (perso). Source : `apps/web/src/app/app.routes.ts:128-165`.
- **Ordre dans `.calendar-main`** : messages d'erreur, puis la ligne `.calendar-controls` (« ☰ Affichage », pastille de résumé, `app-destiny-control`, bouton d'armement de la composition, boutons « Composer les créneaux : {title} » du groupe, ressort, bascule Mois / Semaine / Agenda), puis la grille, puis `app-compose-bar`, puis le **rail de détail**, puis la légende. Source : `features/calendar/calendar-view/calendar-view.html:23-292`.
- **Colonne de droite selon le contexte** (`calendar-view.html:295-449`) :
  - MJ : `.mj-results-panel`, qui contient la section vote (un bloc par vote ouvert : libellé, `app-poll-missing`, « Brûler le parchemin de vote ») ou « Aucun conseil de date en cours. », puis le formulaire **Du / Au / Scruter**, puis `app-available-slots` (titre « Fenêtres de la destinée », une `app-creneau-card` par fenêtre, aucune action). La section vote ne s'affiche que si la couche `votes-en-cours` est allumée, `available-slots` que si `disponibilite-groupe` l'est ; les deux sont masquées en vue Agenda.
  - Joueur de JDR : `.guild-slots-panel`, avec Du / Au / Scruter et les fenêtres en version agrégée, sans panneau de vote (retiré par la 36.7).
  - Groupe : `.guild-slots-panel.group-polls`, titre « Votes de dates en cours » et une ligne par sondage (titre et état).
  - **Calendrier personnel : aucune colonne de droite.** Le plateau y serait une surface entièrement nouvelle.
- **Mise en page responsive** (`calendar-view.scss:275-339`) :
  - **≥ 768 px** : flex en deux colonnes. Le panneau MJ fait `flex 0 0 40%` (280 px au minimum), le panneau joueur ou groupe 340 px (260 px au minimum). Les deux sont **sticky** (`top 16px`), avec `max-height: 100vh-48px` et un défilement interne.
  - **< 768 px** : **aucun tiroir ni feuille**. La colonne s'empile **sous** la grille, le rail et la légende, avec `margin-top: 24px`, et défile avec la page. **Le tiroir du bas supposé par le PRD (FR-8, `[ASSUMPTION]`) n'existe pas** : ce serait un nouveau patron pour cette colonne.
- **Seul précédent de feuille du bas dans le calendrier** : le panneau « Affichage », qui est un menu ancré (overlay CDK) sur desktop et une `display-surface--sheet` avec fond assombri sur mobile. Sa bascule suit `DESKTOP_QUERY = (min-width: 1024px)` (`calendar-view.ts:267, 387`), un **seuil différent** des 768 px de la mise en page. Le `ConstraintPanel` et la `DetailSurface` suivent le même patron : feuille sur mobile, panneau latéral sur desktop (P9 `DESIGN.md` §5, §7.8).

## 2. Patrons P9 à respecter (calendrier)

- **Barre de contrôles repliée** (P9 `EXPERIENCE.md` §4.2 bis) : elle tient sur une seule ligne au repos. La pastille de résumé (« Affichage filtré · 3 sur 4 · Rétablir ») n'apparaît que quand l'affichage s'écarte du défaut. **✦ Destinée reste hors du panneau** : c'est un mode, pas un filtre.
- **Le panneau « Affichage »** contient « Ce que je vois » (cases à cocher des couches), l'interrupteur de légende et « Rétablir mon grimoire par défaut ». Il y a 4 couches en calendrier personnel et 5 en partie. Planche : `mockups/contrat-ui-calendrier.html` §7. Les couches sont temporaires pendant la visite, avec une mémoire de session ; la valeur par défaut est une préférence du compte (§4.3, amendements du 2026-08-17).
- **Couches** (§4.3) : mes indisponibilités, mes disponibilités, mes séances confirmées, les votes en cours, la disponibilité du groupe (partie seulement). « Inscriptions ouvertes » est une section de l'Agenda.
- **Case** `{components.CalendarCell}` (P9 `DESIGN.md` §7.9) : trois bandes (matin, après-midi, soir). Un vote se marque par un fond `status-todo` à 16 % et un **liseré gauche de 3 px**, avec la piste de participation (`PollTrack`, 4 px, proportionnelle à **toute la troupe**) et le compteur « 3/4 ». `{components.GroupGauge}` se trouve en §7.9 bis.
- **Rail de détail** `{components.DetailRail}` (§7.10 bis ; `EXPERIENCE.md` §9) : bande **permanente sous la grille**, à toutes les largeurs. Il montre toujours les trois créneaux et **suit le dernier toucher** ; aucun geste ne le commande (principe 2, §6 bis). Il n'est **jamais estompé** (36.9).
- **Quatre principes d'arbitrage** (§6 bis) : (1) une bande qui porte un objet répond à son objet ; (2) le rail suit ; (3) **la Destinée ne réassigne aucun geste** ; (4) **un seul mode réassigne le tap : la composition**. Celle-ci est armée explicitement, porte une barre persistante, se quitte par Échap ou Annuler, et se signale pendant toute sa durée.
- **Gestes et clavier** (§6, §6 bis, tables 1 et 2) : un tap sélectionne. Le glissement s'arme par un **appui maintenu (450 ms)** sur mobile ; le glissement vertical fait défiler la page ; le balayage horizontal est **proscrit** ; double-clic et clic droit sont réservés. Clavier : `Tab` atteint la case, `1` `2` `3` choisissent le créneau, `Espace` la journée, `Maj`+flèches étendent la plage, `Entrée` valide ce que la barre affiche, `Échap` annule.
- **Sélecteur de réponse** au tap sur une option : Oui / Peut-être / Non / « Retirer ma réponse », ancré sur la bande (collision 4 ; planche §7).
- **Vues par défaut** : Agenda sur mobile, Mois sur desktop (§9). L'Agenda du MJ permet de **sceller** une option dépliée, avec `SealConfirmDialog` (36.12) ; une séance sans date y porte « Lancer un vote » (§4.4 bis).
- **Accessibilité** (§7) : 44 px comme valeur de conception par défaut, sans être un critère de recette. **Aucune information portée par la seule couleur.** `prefers-reduced-motion` coupe tout. Animer seulement `transform` et `opacity` (`DESIGN.md` §8).
- **Contrat** : une planche validée fait contrat, et toute modification se signale par ⚠️ (planche, l. 231). Les panneaux de la planche §4 sont dessinés **sous** la grille, côte à côte ; le code les place en colonne de droite à partir de 768 px.

## 3. Le geste de déclaration (Story 36.3)

- La barre de sélection `SelectionBar` montre « N créneaux sélectionnés », le choix de **portée** (Journée · Matin · Après-m. · Soir), puis Disponible / Indisponible / « Autre… » / Annuler. **La portée se choisit après la sélection.** Source : `implementation-artifacts/36-3-*.md`, encadré 2.
- La portée initiale reflète l'origine : le créneau de la bande touchée, ou Journée (encadré 4c). Le glissement en vue Mois garde le créneau de son ancre (4a).
- La barre porte une **intention armée** (bouton plein ou contour, plus `aria-pressed`), et c'est elle que `Entrée` valide (encadré 3).
- **Implication pour FR-6 (le moment d'abord)** : la déclaration fait choisir la portée **après** la sélection. Choisir le moment **avant** inverse ce patron, et c'est un écart ⚠️ à signaler.

## 4. Destinée telle que livrée (Story 36.9)

- **Puce** `app-destiny-control` dans `.calendar-controls`, sœur du bouton Affichage, masquée en vue Agenda. Son libellé « ✦ Destinée » devient « ✦ Destinée · {nom du vote} » une fois active, avec `aria-pressed`. **Cliquer à nouveau quitte le mode.** Les chevrons `‹ n / N ›` n'apparaissent qu'avec au moins deux votes et **passent d'un vote à l'autre**. Sans vote ouvert, **rien n'est rendu** (AC10). Sources : `destiny-control.html` et `36-9-*.md`, AC2, AC5, AC10, AC11.
- **Estompe** : à l'échelle du **jour** (la case en Mois, la colonne en Semaine), à `opacity .28`. **Un écran qui estomperait tout n'estompe rien** (`destinyInView`). Jamais de `pointer-events:none` ni d'`aria-hidden`. Un jour sélectionné ou focalisé reste net (encadrés 3, 7, 8 ; AC8 ; notes de fin 1).
- Activer le mode **allume la couche `votes-en-cours`**, sans réciproque (AC6). L'état est un `pollId` et ne se persiste pas (encadré 2).
- Fin du mode : vote scellé ou supprimé en contexte de partie. En perso, sortir de la plage chargée **ne** ferme **pas** le mode (notes de fin 2).
- Le panneau MJ est réduit à « qui manque », sur `poll.membersCount` (AC4, AC7). La liste des créneaux et « Sceller ce créneau » ont **quitté le calendrier** : on scelle depuis la fiche de scénario ou depuis l'Agenda (encadré 4).

## 5. Composer (Story 36.10, Story 40.5b)

- **Armement** par un bouton écrit dans `.calendar-controls` (encadré 2), clé `calendar.view_compose_arm`. Il n'existe que pour le MJ, en calendrier de partie, et seulement s'il y a une cible : la destinée active ou une séance éligible (`canCompose()`). Il n'existe **pas** en calendrier personnel (AC10).
- La **barre de composition** `app-compose-bar` est persistante sous la grille. Elle porte `role="toolbar"`, la cible en gras (`targetLabel`), le compte en `aria-live`, la raison de blocage écrite (2 au minimum, 40 au maximum), Valider et Annuler. Elle peut passer sur deux lignes à 380 px (36.10, notes de fin).
- Le tap ajoute ou retire un créneau ; rien n'est écrit avant la validation. Le rail continue de suivre. Une bande composée a un **liseré orange tireté** et porte « — désigné pour le vote » dans son nom accessible (AC2, AC12, AC13, AC16). Composer un vote ouvert part de **toutes** ses options, y compris hors du mois affiché.
- **Le rendez-vous se choisit à la VALIDATION** (décision D-1), dans `ComposeConfirmDialog`, qui a deux faces exclusives : le choix de la séance (« Pour quelle séance du grimoire ? » / « Désigner une séance… ») ou l'avertissement de perte (« Retirer {slots} effacera {votes} déjà posées. »). Source : `36-10-*.md` l. 459, notes de fin.
- **Groupe (40.5b)** : l'hôte arme « Composer les créneaux : {title} » (un bouton par sondage). **Armer bascule en vue Semaine.** `FULL_DAY` est refusé, avec la raison écrite. L'aller-retour depuis la fenêtre de création « Choisir les créneaux dans le calendrier » passe par un brouillon (`ConjonctionDraftService`) : on revient à la fenêtre rouverte, avec le résumé « N créneaux · ven. 17 → sam. 25 oct. ». Le refus serveur s'affiche en `calendar-error--compose`. Source : `spec-40-5b-*.md`, Intent et notes d'implémentation.

## 6. Mode soirée (Palier 10)

- **Vocabulaire par thème** (P10 `EXPERIENCE.md` §3.1) :
  - Grimoire Émeraude : bascule **Ralliement** / Quête ; le type isolé s'appelle « La conjonction des Esprits », le type durable « La convergence des Sortilèges » ; une rencontre est une **conjonction**, le bouton dit « + Nouvelle conjonction » et le bouton de création « Lancer une quête ».
  - Forêt Ancienne : **Veillée** / Sentier ; « La halte au gué » (nom provisoire), « La grande transhumance » ; une rencontre est une **halte** ; le bouton de création dit « Ouvrir un sentier ».
  - Atelier Cuivré : **Rassemblement** / Mission ; « La réunion d'établi », « Le grand chantier » ; une rencontre est une **réunion** ; le bouton de création dit « Initier une mission ».
  - Les rôles (§3.4) restent des mots de travail : Admin / Membre, Hôte / Invité ; leurs variantes par thème ne sont pas arrêtées.
- **Mots du JDR interdits** hors JDR : MJ, campagne, scénario, séance, joueur, quête. Regex dans `apps/web/src/app/core/theme/non-jdr-words.fixture.ts`. Le mot « partie » est interdit en mode soirée pour les nouveaux libellés (PRD FR-16).
- **`NEUTRAL_KEYS`** (`core/theme/theme-tone.service.spec.ts:777`) : chaque clé doit avoir **une voix différente** dans les trois thèmes, sauf les clés listées comme volontairement identiques. Toute clé neuve identique dans les trois thèmes doit y être ajoutée, avec sa raison. Les voix : Grimoire (magie et bibliothèque, vouvoiement), Forêt (nature et druides, **tutoiement**), Atelier (engrenages et registres, vouvoiement) (spec, l. 767). Les trous `{nom}` doivent être identiques partout.
- **Résumé du vote** dans la fenêtre d'une conjonction (`{components.situation-panel}`, `{components.vote-summary}` ; P10 `DESIGN.md` §7.7, `EXPERIENCE.md` §3.3) :
  - membre : « Vote à faire… », « Vos réponses : x sur N », « Meilleur créneau pour l'instant : date — n oui », bouton « Voter dans le calendrier » ;
  - hôte (cadre `accent-1`) : « Réponses : x sur N inscrits », « N'ont pas encore répondu », « Fixer la date… », « Prolonger le vote », « Voir dans le calendrier → ».
- **Fixer la date…** (§5.4 n° 5, `DateFixDialog`, `features/events/date-fix-dialog/`) : une liste en boutons radio, du plus au moins plébiscité (« 4 oui · 0 peut-être · 0 non »), avec **le meilleur présélectionné**. Elle avertit que la date sera scellée, les inscrits prévenus par e-mail, et qu'on ne pourra plus la rouvrir. **Prolonger** se fait par `ExtendVoteDialog` (§5.4 n° 6). Le titre est « Votre accord » ; « Renoncer » annule partout. Le rouge (`{components.destructive-confirm}`) est réservé à l'irréversible.
- **Bouton de création** `{components.create-action}` (P10 `DESIGN.md` §7.1) : un d20 traversé d'un crayon, dans l'en-tête. Sur bureau, une pilule avec le libellé du thème ; sur mobile, l'icône seule (48 × 40, cible de 44 px) sous 440 px. Il ouvre `/parties/new`.
- **Patrons mobiles du P10** : la fenêtre d'une conjonction occupe toute la largeur utile, avec un défilement interne (`min(900px,96vw)`). Le P10 n'introduit **aucune feuille du bas**.

## 7. Clés de ton à renommer ou réutiliser (`apps/web/src/app/core/theme/tones/*.ts`)

| Clé | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| `section.slots` (titre des fenêtres de l'automate) | Fenêtres de la destinée | Clairières disponibles | Créneaux validés par l'automate |
| `common.rechercher` | Scruter | Fouiller | Scanner |
| `calendar.view_no_poll` | Aucun conseil de date en cours. | Aucun cercle de date en cours. | Aucun scrutin de date en cours. |
| `cta.destiny_mode` (NEUTRE) | Destinée | Destinée | Destinée |
| `calendar.destiny_prev_aria` et `next_aria` | Conseil précédent / suivant | … | … |
| `calendar.view_compose_arm` | Inscrire des dates | Marquer des dates | Ajouter des dates |
| `calendar.view_compose_target_poll` | Fenêtres du conseil : {label} | Clairières du cercle : {label} | Plages du scrutin : {label} |
| `calendar.compose_count_many` | {n} fenêtres désignées | {n} clairières désignées | {n} plages désignées |
| `calendar.compose_confirm_seance_label` | Pour quelle séance du grimoire ? | Pour quelle séance ? | Pour quelle séance d'atelier ? |
| `cta.cancel_poll` | Brûler le parchemin de vote | Disperser les feuilles du vote | Purger le registre de vote |
| `poll.missing_prefix` | N'ont pas consulté l'oracle : | N'ont pas parcouru la forêt : | N'ont pas alimenté le registre : |
| `partie.ralliement_calendar_compose_target_poll` | Créneaux de la conjonction : {title} | … de la halte | … de la réunion |
| `partie.ralliement_event_vote_in_calendar_btn` (NEUTRE) | Voter dans le calendrier | idem | idem |
| `common.du` / `common.au` / `calendar.display.trigger` | Du / Au / Affichage | idem | idem |

- ⚠️ **Collision de vocabulaire en Grimoire** : le composer y parle déjà de « **fenêtres** » (`compose_*`, `view_compose_*`) pour les créneaux d'un sondage. Renommer « Fenêtres de la destinée » doit éviter de déplacer le doublon vers « fenêtre ».
- Le mot « sondage » se dit **conseil** (Grimoire), **cercle** (Forêt) et **scrutin** (Atelier) en JDR, et « vote » en mode soirée.

## 8. Thèmes

- Les trois thèmes sont `grimoire-emeraude`, `foret-ancienne` et `atelier-cuivre` (« Atelier Cuivré », ex-`medieval-steampunk` ; P9 `DESIGN.md` §1). `ThemeToneService.applyClass()` pose la classe `theme-<slug>` sur `<body>`, le thème est mémorisé dans `localStorage` et il est aussi une préférence du compte (`User.theme`). Source : `core/theme/theme-tone.service.ts:40-56`.
