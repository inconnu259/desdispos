# Validation — epics-palier10-6-8.md (Épics 51 à 54, 22 stories)

Date : 2026-11-01 · Validation en lecture seule · Référence : `architecture/architecture-jdr-master-2026-11-01-p10-6-8/ARCHITECTURE-SPINE.md`, plus un contrôle ponctuel du code de `apps/web` et de `packages/shared` pour vérifier les affirmations des stories.

## Verdict

Document solide et très traçable : chaque FR, NFR, AD et UX-DR est cité, la base de données est conforme, il n'y a ni modèle de démarrage ni texte de remplissage, et l'ordre 51 → 52 → 53 → 54 est respecté. **Aucun point bloquant.** **10 points à corriger** avant le développement, dont 4 de fond : la priorité de `seanceSituation` quand une séance à inscriptions a un vote ouvert, `roleIconName` qui ne peut pas rendre `role-hote`, des emoji ⚠ dans les fichiers de ton qu'aucune story ne traite, et une contradiction dans les tests de la 54.3.

| Sévérité | Nombre |
| --- | --- |
| Bloquant | 0 |
| À corriger | 10 |
| Remarque | 18 |

---

## 1. Couverture des FR (FR1 à FR14)

| FR | Stories (AC) | Couverture |
| --- | --- | --- |
| FR1 | 52.1, 52.2 | Complète (bouton, bandeau, « Terminer », exclusivité, sortie de page, clavier) |
| FR2 | 52.2 | Complète (tap, journée entière, glissement, double-clic, rail, « Autre… ») |
| FR3 | 52.1, 52.2 | Complète |
| FR4 | 52.3, 52.4 | Complète (règle serveur, bandeau unique, récurrences, direct) |
| FR5 | 52.3, 52.5 | Complète |
| FR6 | 51.1 à 51.7 | **Partielle** — voir C-2 (`role-hote` impossible à obtenir) et C-3 (`vote` et `jeux` placés nulle part) |
| FR7 | 51.1 à 51.7 | Complète (un seul `telecharger` en 51.3) |
| FR8 | 51.1 à 51.4, 51.6, 51.7 | Complète (flag, person, shield, chevron_right, check, écu admin 14 px) |
| FR9 | 51.4 à 51.8 | **Partielle** — voir C-4 (3 clés de ton gardent ⚠ ou ⚠️) |
| FR10 | 53.1, 53.2, 53.3 | **Partielle** — voir C-6 (séance à inscriptions avec vote ouvert : jamais « Vote à faire ») |
| FR11 | 54.1, 54.3 | Complète |
| FR12 | 54.1, 54.2, 54.3 | Complète (voir C-8 pour une contradiction de tests) |
| FR13 | 53.4 | Complète |
| FR14 | 53.5, 53.6 | Complète (vérification de la 38.3 en 53.5) |

## 2. NFR et AD

- NFR1 à NFR8 : tous repris, dans les introductions d'épic (NFR1, NFR3, NFR5, NFR6, NFR8 dans les quatre épics) et dans les stories (NFR2 : 53.2, 53.4, intro 54 ; NFR4 : 52.4, 53.1, 53.3, 53.6, 54.x ; NFR7 : 51.1, 51.8).
- AD-1 à AD-8 : tous repris (AD-1 : 51.1, 51.7, 52.1, 53.6 · AD-2 : 51.1 · AD-3 : 51.1 et intro 51 · AD-4 : toutes les stories 51.x · AD-5 : 52.3 à 52.5 · AD-6 : 53.1 à 54.3 · AD-7 : 52.1, 52.2, 52.4, intro 54 · AD-8 : 53.4 à 53.6).
- Deux écarts de contenu : NFR2 est dépassé par la 53.2 sans mise à jour de l'inventaire (C-7), et AD-1 est contourné par une icône SVG en ligne qui reste dans `partie-form` (C-5).

## 3. UX-DR1 à UX-DR118

Les 118 sont tous cités au moins une fois dans une story ou une introduction d'épic (les plages « UX-DR64 à UX-DR70 » et « UX-DR77 à UX-DR81 » sont développées). Seul UX-DR106 (textes dans les trois thèmes) n'est cité que dans les introductions des épics 52, 53 et 54. C'est suffisant pour une règle transverse.

## 4. Base de données

Conforme. La seule modification de schéma, `User.availabilityReminder Boolean @default(true)` avec sa migration additive, est créée en **52.3**, la première story qui en a besoin. Aucune story antérieure ne touche `schema.prisma`. La 53.5 ne change qu'un DTO (`PartieDto.can`), pas le schéma.

## 5. Modèle de démarrage

Conforme. Le projet est brownfield, « Pas de modèle de démarrage » est écrit, et aucune story ne prétend en installer un. La 51.1 crée un script Node sans dépendance (`package.json` inchangé) : ce n'est pas un modèle de démarrage.

## 6. Qualité des stories

- Les 22 stories ont des AC en Given/When/Then testables, et chacune cite au moins un FR.
- Aucun `TODO`, aucun `{{`, aucun `TBD`. Les `{date}`, `{x}`, `{n}` sont des variables de libellés, voulues.
- Les stories trop grosses et le texte encore à arrêter sont détaillés en C-9, C-10 et dans les remarques.

## 7. Dépendances vers l'avant

- **Dans chaque épic**, les stories ne s'appuient que sur des stories antérieures. Ordres vérifiés :
  - 51 : 51.1 socle, puis 51.2 à 51.7, puis 51.8 ;
  - 52 : 52.1, 52.2, 52.3, puis 52.4 (qui utilise 52.3 et `setInteraction` de 52.1), puis 52.5 ;
  - 53 : 53.1, 53.2 (pastille), 53.3, 53.4 (sa recette « Je mène » vient de la 53.3, antérieure), 53.5, 53.6 ;
  - 54 : 54.1, 54.2, 54.3.
- **Entre les épics**, l'ordre est respecté : la 52.1 utilise `declarer-dispos` de la 51.1 ; la 53.6 utilise `app-icon` et `confirm-dialog` (51.3) ; l'épic 54 utilise `?poll=` et `setInteraction` (52.1) ainsi que `seanceSituation` et la ligne posée par la 53.3.
- Mentions « jusqu'à la Story N » :
  - intro 51, « jusqu'à la story 51.8 » : cohabitation `<mat-icon>` / `app-icon`, temporaire et voulue (AD-4). Conforme.
  - 54.1, « restant en place jusqu'à la Story 54.3 » : la liste `app-poll-status` du MJ reste en place, temporaire et explicite. Conforme.
  - 52.1, « ne changent pas dans cette story » (raccourcis, `Échap`) : l'ordre d'`Échap` arrive en 52.2. Temporaire. Conforme.
  - 53.3, « l'épic 54 placera au-dessus l'encadré » : simple information, pas une dépendance.
- État temporaire non dit : voir R-1 (53.1 → 53.3).

## 8. Fichiers modifiés par plusieurs stories

| Fichier | Stories | Diagnostic |
| --- | --- | --- |
| `partie-detail.html` / `.ts` / `.spec.ts` | 51.3, 51.4, 53.1, 53.2 (test), 53.4, 53.6 | **Vrai point chaud.** Six stories, dont 51.3 et 51.4 sur le même gabarit (41 `<mat-icon>` à se partager). Les découpages sont propres, mais les stories doivent passer l'une après l'autre, jamais en parallèle. Le fichier de test dépasse 7 000 lignes |
| `seance-list.html` / `.ts` / `.spec.ts` | 53.1, 53.3, 54.1, 54.2, 54.3 | Accumulation voulue (des couches successives). La 54.1 « déplace » la ligne posée en 53.3 : petit aller-retour à éviter (R-3) |
| `calendar-view.ts` / `.html` / `.spec.ts` | 51.5, 52.1, 52.2, 52.4, 54.3 (élargissement d'un type, test) | 51.5 ne change que des icônes et 54.3 qu'une signature, sans effet sur l'écran : chevauchement incident. 52.1 → 52.2 → 52.4 est une chaîne voulue |
| `calendar-month-view` / `calendar-week-view` | 51.5, 52.1, 52.2 | Incident (icônes puis comportement) |
| `dashboard.html` / `.ts` / `.spec.ts` | 51.2, 52.4, 52.5 | Incident (zones différentes du gabarit) |
| `account.html` / `.ts` / `.spec.ts` | 51.7, 52.5 | Incident |
| `poll-status/`, `poll-response/` | modifiés en 51.5, **supprimés** en 54.2 / 54.3 | Travail perdu, imposé par l'ordre (51.8 exige zéro caractère-icône avant l'épic 54) — R-2 |
| `scenario-read-dialog` | 51.6, 54.1, 54.2 | Incident |
| `scenario-timeline` | 53.1, 53.3 | Voulu |
| `event-card` / `event-card.util` / `event-dialog` | 53.2 seulement | Aucun problème |
| `participant-chip` | 51.4 seulement | Aucun problème |
| Fichiers de ton (×3) et `theme-tone.service.spec.ts` | presque toutes les stories (ajouts), avec des retraits en 53.1, 53.2, 54.2 et 54.3 | Incident (ajouts de clés) mais **risque de conflit de fusion** : à traiter en séquence |
| `packages/shared/src/index.ts` | 52.3, 53.5 | Incident |
| `confirm-dialog` | modifié en 51.3, utilisé en 53.6 et 54.3 | Incident |

Aucun problème d'accumulation qui demande de redécouper les épics. Il faut seulement exécuter les stories en séquence (déjà l'usage du dépôt).

## 9. Cohérence des noms

Tous les noms du spine sont utilisés tels quels :
- icônes : `app-icon`, `IconName`, `roleIconName` ;
- calendrier : `interaction`, `setInteraction()` ;
- situation : `seanceSituation`, `nextSeanceOf`, `situation-pill` ;
- page d'une partie : `selectedTabKey`, `editable-banner`, `cover-upload`, `can.coverUpdate` ;
- rappel des dispos : `reminderDue`, `availabilityReminder`, `AVAILABILITY_REMINDER_DAYS`, `ActivePartiesPort`, `AvailabilityReminderService`.

Les chemins concordent avec le « Structural Seed ». Les contradictions entre stories sont listées ci-dessous (C-1, C-8, et R-6 à R-9).

---

## Constats

### Bloquants

Aucun.

### À corriger

- **C-1 — Story 51.1, nombres d'icônes contradictoires.** La même story copie « 131 SVG (… `communes/` à 41) » puis demande une « union `IconName` (67 noms … 30 de sens, 37 utilitaires) » et des tests « 30 noms de sens par thème, 37 utilitaires ».
  - Le dossier `communes/` compte bien 41 SVG, et `icones-retenues.json` en annonce aussi 41. Il faut donc **71 noms et 41 utilitaires**.
  - Avec 37, le test échouerait, ou `matin`, `apres-midi`, `soir` et `menu-actions` (utilisées en 51.5, 51.6 et 51.7) seraient absentes du registre.
- **C-2 — Story 51.1, `roleIconName(role)` ne peut pas rendre `role-hote`.** La story annonce « hôte d'une soirée → `role-hote` », mais le seul paramètre est le rôle.
  - `PartieRole` vaut `'mj' | 'player' | 'admin' | 'member'`, et l'hôte d'une soirée a le rôle `admin` (53.5 : « son créateur, inscrit `ADMIN` » ; `roleLabel` du tableau de bord le distingue par `partie.kind === 'ONE_SHOT'`).
  - Conséquence en 51.2 : sur le tableau de bord, l'hôte d'une soirée afficherait `role-admin`.
  - Correction : préciser la signature, par exemple `roleIconName(role, kind)` ou la partie entière, et ajouter un test « hôte ≠ admin ».
- **C-3 — FR6, icônes de sens jamais placées à l'écran.** `vote` et `jeux` (« jeux de société ») font partie du registre mais aucune story ne les pose sur un écran. L'utilitaire `ajouter` non plus (aucun `add` n'existe aujourd'hui).
  - L'UX se contredit : UX-DR47 donne en exemple « icône `vote` du bouton « Lancer le vote » », alors que UX-DR54 garde « + Lancer le vote » en texte.
  - Correction : décider où ces icônes s'affichent, ou écrire explicitement qu'elles n'existent qu'au registre pour ce palier.
- **C-4 — FR9 et Story 51.8, trois clés de ton gardent ⚠ ou ⚠️, et aucune story ne les traite.** Il s'agit de `event_games.already_at` (« ⚠ déjà chez {nom} »), `scenarios.seances_heure_malformed` (« ⚠️ Valeur consignée non reconnue… ») et `pollui.status_choose_no_vote_warning` (« ⚠️ Aucun compagnon… »), dans les trois thèmes.
  - L'AC de 51.8 (« aucun … `⚠️` employé comme icône » dans les fichiers de ton) échouerait.
  - Correction : rattacher chaque clé à la story de sa zone (51.7 pour les jeux, 51.6 pour les scénarios, 51.5 pour les sondages).
- **C-5 — AD-1, une icône SVG en ligne reste dans `partie-form.html`.** La pastille de couverture du formulaire (`cover-chip__icon`) garde son SVG en ligne, et aucune story 51.x ne la migre.
  - Or la 53.6 donne aux pastilles de la bannière `<app-icon name="modifier">` « avec l'aspect de celles du formulaire ». On aurait donc deux dessins pour la même pastille, et une icône hors de `app-icon`.
  - Correction : migrer cette icône en 51.7 ou en 53.5, qui touche déjà `partie-form`.
- **C-6 — Story 53.1, priorité de `seanceSituation` pour une séance à inscriptions avec un vote ouvert.** La règle donne « séance **à inscriptions** : inscrit → `je_participe` … non inscrit → `pas_inscrit` », et ne regarde le vote que pour les séances sans inscriptions.
  - Aujourd'hui, `seanceState` fait passer le vote ouvert avant tout (« Un vote ouvert prime sur le reste », `status-derivation.ts`). Une séance à inscriptions avec un vote (Story 8.8) affiche donc « Réponds au vote ».
  - Après 53.1, un joueur inscrit qui n'a pas voté ne verrait que « Je participe » sur la Chronologie, sans aucun appel au vote, alors que la 54.1 prévoit pour ce même cas l'encadré `voter`.
  - Correction : ajouter la branche « inscrit et `hasUnansweredOptions` → `vote_a_faire` », alignée sur la 54.1, et ses tests.
- **C-7 — Story 53.2, NFR2 dépassé sans trace dans l'inventaire.** La story change aussi « J'y étais » (vers `status-done`) et « Place réservée » (vers `status-todo`) sur la carte d'événement. La pastille commune passe aussi en 12px / 600 avec l'arrondi du badge, contre `0.75rem`, graisse normale et un arrondi de 6px aujourd'hui.
  - NFR2 et UX-DR76 ne permettent que « Vote à faire ». La story invoque un « alignement complet validé par l'utilisateur le 2026-11-01 ».
  - Correction : reporter cet amendement dans NFR2, UX-DR76 et UX-DR113/114 de l'inventaire.
- **C-8 — Story 54.3, contradiction dans les tests.** L'AC demande que « Clôturer le vote » soit « **précédé d'une confirmation** », et `seance-poll-summary.spec.ts` teste bien cette confirmation. Mais les tests de `seance-list.spec.ts` demandent « « Clôturer le vote » sans confirmation ajoutée ».
  - Par ailleurs, UX-DR101 parle de « sa confirmation actuelle » alors que `onClosePoll` (`seance-list.ts:297`) n'en a aucune. La story le dit, mais l'inventaire n'est pas corrigé.
- **C-9 — Story 54.3, texte de confirmation non arrêté.** On lit « texte dans les trois thèmes, du type « Clore le conseil sans fixer de date ? … » », sans clé et sans les libellés Forêt et Atelier.
  - Correction : écrire la clé (dans le préfixe `scenarios.seance_summary_*`) et les trois textes, comme pour les autres libellés.
- **C-10 — Story 52.1, trop grosse.** Elle fait deux choses dans une seule story :
  - une refonte sans changement visible : `composing` et `destinyPollId` deviennent `interaction`, dans `calendar-view` et les deux vues, en préservant les enchaînements Composer ⇄ Destinée (Story 45.2) ;
  - une nouveauté : le bouton, le bandeau, le liseré, l'exclusivité et le cas Agenda.

  Elle compte 15 AC et touche un fichier de plus de 3 000 lignes.
  - Correction proposée : 52.1a, refonte `interaction` à comportement identique (tests existants verts, seul le montage change), puis 52.1b, bouton et mode déclaration.

### Remarques

- **R-1 — De 53.1 à 53.3, l'appel au vote disparaît pour un temps.** Dès la 53.1, le badge de la Chronologie et de la fiche ne dit plus « Réponds au vote », et la pastille n'arrive qu'en 53.3. La 53.3 le reconnaît (« que le badge ne porte plus depuis 53.1 »), pas la 53.1. À signaler comme état temporaire dans la 53.1, ou à déplacer : le changement de `seanceState` pour la Chronologie et la fiche peut passer en 53.3.
- **R-2 — Stories 51.5, 54.2 et 54.3, travail perdu.** La 51.5 retouche `poll-status` (`ANSWER_ICONS`) et `poll-response.html` (⚠), que la 54.2 et la 54.3 suppriment. C'est imposé par l'ordre 51 → 54. Il suffit d'indiquer en 51.5 que ces deux composants doivent être traités au plus court.
- **R-3 — Stories 53.3 et 54.1, ligne « Ma situation » déplacée.** La 54.1 écrit « la ligne posée par la Story 53.3 est déplacée là si elle était ailleurs ». Mieux vaut que la 53.3 la place directement à la position UX-DR90 (sous l'en-tête de la séance).
- **R-4 — Inventaire, UX-DR35 et UX-DR36.** UX-DR35 dit encore « `communes` à 37 », alors que le JSON en compte 41. UX-DR36 donne bien 41. À harmoniser (et voir C-1).
- **R-5 — Story 52.4 et UX-DR24.** La règle « si le bandeau de la Destinée est présent, le rappel vient dessous » ne s'applique pas au tableau de bord : `destinyNotice` n'existe que dans `calendar-view`. Le dire, pour qu'on ne cherche pas ce bandeau.
- **R-6 — Stories 54.2 et 54.3, « {n} joueurs ».** « Réponses : {x} sur {n} joueurs » prend `n` = `poll.membersCount`, qui compte le MJ (« le MJ et ses membres », 54.2). Le mot « joueurs » est donc inexact d'une unité.
- **R-7 — Story 54.3, mélange de préfixes.** L'encadré `fixer_la_date` réutilise `scenarios.seance_summary_ended`, clé du résumé, alors que l'intro 54 réserve `scenarios.seance_situation_*` à l'encadré. À trancher (clé partagée assumée ou clé dédiée).
- **R-8 — Stories 53.1 à 54.2, apostrophes.** On trouve « J’ai voté » / « J’y étais » (courbe) et « J'ai voté » (droite) dans UX-DR67/70 et l'intro. Les tests comparent du texte exact : fixer l'apostrophe des clés `situation.*`.
- **R-9 — Story 53.2, `situation.ma_situation`.** Cette clé est un libellé de ligne, pas une valeur de situation, rangé sous le préfixe `situation.<valeur>` de l'intro 53. Acceptable, mais à mentionner dans la convention.
- **R-10 — Story 53.4, `TabKey`.** `details` et `invitations` sont présentés « (JDR) », alors qu'un **groupe** a aussi un onglet Détails (`partie-detail.html:93`, branche `@else` de `isSoiree()`), sur lequel compte la 53.6. Comme l'union est unique, il n'y a pas d'erreur, mais l'annotation induit en erreur.
- **R-11 — Story 53.6, icône de « Retirer ».** « l'icône de la pastille est `modifier` » : celle de « Retirer » n'est pas précisée (`supprimer` ?).
- **R-12 — Story 51.4, « fin de `logout` ».** La story rattache cette mention à « Quitter le groupe ». Or les deux `logout` de `partie-detail.html` (lignes 527 et 700) sont « Quitter l'office », donc `quitter-office`. Seul `exit_to_app` devient `quitter-groupe`. À reformuler.
- **R-13 — NFR7 face à UX-DR52 et à la 51.8.** NFR7 demande la lisibilité « sur fond clair comme sombre », UX-DR52 dit « aucun fond clair à vérifier », et la recette de la 51.8 suit l'UX. NFR7 dit aussi « plus de dépendance à une police chargée depuis un service tiers », alors que la 51.8 garde Roboto depuis Google Fonts. Préciser que NFR7 ne vise que la police d'icônes.
- **R-14 — Story 51.6, `reserve-picker.html`.** Trois `⊘` (`aria-hidden`) y servent de marqueur d'indisponibilité. Ce caractère n'est pas dans la liste de FR9, mais c'est un caractère-icône. Décider : `dispo-non` ou texte.
- **R-15 — « When » sans action.** Plusieurs « When » ne décrivent pas une action d'utilisateur : « When la story démarre / est livrée » (51.1, 52.1, 52.3, 53.1, 53.4, 53.5) et « on prépare le retrait » (51.8). Admissible pour des stories techniques, mais les AC sont alors des listes de livrables plutôt que des comportements.
- **R-16 — Story 52.3, « aujourd'hui » côté serveur.** Le fuseau horaire qui fixe le jour de début de la fenêtre de 28 jours n'est pas précisé. Reprendre la convention existante (Europe/Paris ?) et prévoir un test à minuit.
- **R-17 — Story 52.5, clés sans nom.** Le message d'échec (« clé des trois fichiers de ton ») et l'action « Annuler » de la snackbar (« comme `board_games.undo_btn` ») n'ont pas de nom de clé.
- **R-18 — Stories volumineuses mais cohérentes.**
  - 51.1 : socle complet, avec la copie des SVG, le script, les tests `node --test`, le branchement CI, le composant, `roleIconName`, la migration du Shell et le test à cliquet.
  - 52.2.
  - 53.5 : API et web à la fois (drapeau serveur, e2e, `cover-upload`, `partie-form`, vérification de la 38.3).
  - 54.1.

  Aucune ne demande d'être découpée, mais ce sont les premières à surveiller si un agent de dev dérive.
