---
title: "Revue du spine P10.6-10.8 — rapprochement, adversariale, vérification du code"
target: ../ARCHITECTURE-SPINE.md
date: 2026-11-01
inputs:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/DESIGN.md
  - ../brownfield-scan.md
  - ../.memlog.md
mode: lecture seule (aucun code modifié, aucune commande d'état git, aucune installation)
---

# Revue du spine — Paliers 10.6 à 10.8

## Verdict

Le spine tient sur l'essentiel (icônes en données structurées, rappel serveur unique, `seanceSituation` unique, onglets
par clé), mais **six points peuvent faire diverger deux stories écrites chacune « à la lettre »** : il interdit le seul
moyen qu'aurait le tableau de bord d'ouvrir le calendrier en mode déclaration, il s'appuie sur un `can` de partie qui
n'existe pas, il nomme `mode` un signal dont le nom est déjà pris dans `calendar-view`, il ne voit qu'un seul index
d'onglet codé en dur alors qu'il y en a trois, il retire `answer_poll` sans voir que le joueur d'une quête unique perd
alors tout appel au vote sur la page de sa partie, et il laisse passer un « Annuler » de couverture que l'API rend
impossible.

| Gravité | Nombre |
| --- | --- |
| Haute | 6 |
| Moyenne | 15 |
| Basse | 12 |

Les vérifications du §C qui recoupent un constat des §A/§B n'y sont pas recomptées.

---

## A. Rapprochement — ce que le PRD et l'UX disent et que le spine ne fixe pas

### A-1 · HAUTE · Le rappel ne peut pas ouvrir le calendrier « en mode déclaration » sans enfreindre AD-7

- **Où** : AD-7 (« Le mode n'est ni persisté ni mis dans l'URL, sauf l'ouverture directe en Destinée ») ; PRD FR-4 (« le
  toucher ouvre son calendrier en mode déclaration ») ; EXPERIENCE §3.5 et flux UJ-1, étape 2.
- **Divergence** : le tableau de bord et le calendrier sont deux routes. Sans URL, il reste un service de passage de
  relais (comme `drafts.takeComposeRequest`, `calendar-view.ts:3443`) ou un `state` de navigation. La story du rappel
  et celle du mode déclaration choisiront chacune le leur, et l'une des deux enfreindra AD-7 au passage.
- **Correctif** : ajouter une exception à AD-7, du même type que la Destinée : `?declarer=1` lu **une fois** à
  l'initialisation de `calendar-view` puis retiré (`replaceUrl`). Il allume `declaration`, et sur une vue Agenda il
  repasse d'abord en Mois (EXPERIENCE §3.1). C'est le seul point d'entrée externe du mode, et le bandeau du tableau de
  bord le construit avec le même helper de route que le calendrier personnel.

### A-2 · HAUTE · « Annuler » après « Changer / Retirer » la couverture est impossible avec l'API actuelle

- **Où** : EXPERIENCE §4.3 (snackbars « Enluminure changée / retirée » avec « Annuler ») ; AD-8 ; spine §Design Paradigm
  (« côté serveur, il ne touche que les dispos et les préférences »).
- **Constat dans le code** : `setCoverImage` supprime les trois dérivées de l'ancienne image dès qu'il a écrit la
  nouvelle (`apps/api/src/parties/parties.service.ts:1375-1377`), et `removeCoverImage` les supprime aussitôt
  (`:1406-1408`). Le client n'a jamais l'original : `GET /cover` sert des dérivées WebP recadrées.
- **Divergence** : une story renvoie une dérivée `large` pour « annuler » (perte de qualité, recadrage appliqué deux
  fois), une autre retire « Annuler », une troisième touche au serveur alors que le spine l'interdit.
- **Correctif (à trancher dans AD-8)** : (a) pas d'« Annuler » pour la couverture, ce qui amende EXPERIENCE §4.3 ; ou
  (b) pour « Retirer », valider en différé : l'appel `DELETE` ne part qu'à la fermeture de la snackbar sans « Annuler »,
  et pour « Changer », pas d'« Annuler » ; ou (c) une dérogation serveur qui garde l'ancien `stem` jusqu'à N minutes,
  avec `POST /parties/:id/cover/restore` gardé par `PARTIE_COVER_UPDATE`. Recommandé : (b), sans changement serveur.

### A-3 · MOYENNE · Aucune convention pour une snackbar « Annuler »

- **Où** : EXPERIENCE §3.5 (« Ne plus me le rappeler » + « Annuler ») et §4.3.
- **Constat** : aucune snackbar à action dans l'application ; toutes appellent `snack.open(msg, undefined, { duration })`
  (par exemple `calendar-view.ts:3640-3675`, `constraint-panel.ts:226`).
- **Divergence** : durée, clé de ton du bouton, sens de l'annulation (écriture compensatoire ou différée), état
  intermédiaire du bandeau (masqué tout de suite ou au retour du serveur).
- **Correctif** : ajouter une ligne « Annuler » aux conventions. L'annulation est une **écriture compensatoire**
  (`PATCH /me/preferences { availabilityReminder: true }`), sauf dans le cas fixé en A-2. Une clé de ton unique
  `common.annuler`, une durée commune (par exemple 6 s), un masquage optimiste, et la règle de `reminderDue` reste seule
  juge au rechargement.

### A-4 · MOYENNE · « Échap vide puis éteint » : la sélection n'appartient pas à `calendar-view`

- **Où** : AD-7 (« allumer un mode éteint l'autre et vide la sélection en cours ») ; EXPERIENCE §3.3, clavier.
- **Constat** : la sélection vit dans **chaque** vue enfant (`calendar-month-view.ts:504` et
  `calendar-week-view.ts:518`, `selectedCells`), qui a aussi son propre `onEscape()` (`:1084` et `:1059`). Le parent a
  déjà quatre gestionnaires `Escape` qui coupent la propagation (`calendar-view.ts:569, 1350, 2389, 3903`).
- **Divergence** : la story Mois fera « Échap vide, puis émet une sortie » ; la story Semaine fera éteindre le mode
  par le parent via un `@ViewChild`. L'ordre avec les panneaux ouverts n'est fixé nulle part.
- **Correctif** : préciser AD-7 en trois points. `mode` descend dans les vues en `input`. Les vues émettent
  `exitDeclarationRequested` sur un Échap à sélection vide. Le parent vide la sélection par un `input` jeton
  (`selectionResetToken`), jamais par `@ViewChild`. Ordre d'Échap : overlay ouvert, puis sélection non vide, puis
  mode déclaration.

### A-5 · MOYENNE · Le raccourci (appui long) en mode lecture n'a pas de valeur de `mode`

- **Où** : AD-7 (« les vues lisent `mode` pour savoir si un tap sélectionne (`declaration`) ou lit (`lecture`) ») ; PRD
  FR-3 (raccourci inchangé, mode modification de la Story 36.3, AC15 à AC17).
- **Divergence** : en lecture, une fois qu'un appui long a ouvert une sélection, un tap ajoute ou retire un créneau
  (AC17) jusqu'à vider la sélection. Une story lira « lecture → tap = lire » et cassera AC17 ; une autre basculera
  `mode` en `declaration` sur appui long, ce qui rend la barre collante et laisse le mode allumé, contre FR-3.
- **Correctif** : AD-7 dit que le raccourci laisse `mode = 'lecture'` ; dans ce mode, un tap sélectionne **tant que la
  sélection n'est pas vide** (AC17 inchangé), la barre n'est pas collante, et vider la sélection revient à la lecture
  pure.

### A-6 · MOYENNE · Clés de ton : pas de règle de réemploi, de nommage ni de retrait

- **Où** : conventions, « Libellés » ; EXPERIENCE §1, §4.1 (« libellés alignés sur la carte d'événement »), §5.3.
- **Constat** : les pastilles de soirée utilisent `partie.ralliement_event_chip_*` (`event-card.util.ts:273-282`), sans
  « J'ai voté » ni « Je mène ». `status.seance_answer_poll` existe dans les trois fichiers de ton
  (`grimoire-emeraude.ts:822`, `foret-ancienne.ts:814`, `atelier-cuivre.ts:817`) et figure dans les tests
  (`theme-tone.service.spec.ts:440, 470, 790`). `calendar.agenda.badge_answer_poll` est une clé distincte.
- **Divergence** : la story des pastilles réemploie les clés `ralliement_*` (de soirée) ou en crée ; la story
  `seanceState` laisse des clés mortes ou casse les tests de ton.
- **Correctif** : préfixes réservés (`seance.situation.*`, `availability.reminder.*`, `calendar.declare.*`). La story
  qui retire `answer_poll` retire aussi `status.seance_answer_poll` des trois fichiers et de leurs tests, et garde
  `calendar.agenda.badge_answer_poll` (hors périmètre, voir B-14).

### A-7 · MOYENNE · « J'y étais » n'est pas dérivable de `SeanceDto` et `SessionPollDto`

- **Où** : AD-6 (« séance à vote → tout joueur de la partie à la date de la séance » ; « aucun changement d'API »).
- **Constat** : ni `SeanceDto` (`packages/shared/src/index.ts:717-756`) ni `SessionPollDto` (`:1537-1561`) ne portent
  l'historique d'appartenance. Une séance datée sans vote ni inscription (héritage `validerDate()`, documenté dans
  `SeanceDto.dateValidee`) n'est couverte par aucune des deux branches.
- **Divergence** : la carte prendra « joueur actuel » ; la fiche prendra la date d'entrée lue dans la liste des
  membres, si elle la porte.
- **Correctif** : AD-6 tranche : « joueur **actuel** de la partie » (approximation assumée, aucune date d'entrée), et
  « séance datée sans vote ni inscription » suit la règle de la séance à vote.

### A-8 · MOYENNE · « La prochaine séance » d'un chapitre n'est pas définie

- **Où** : PRD FR-10 (« la carte d'un chapitre porte celle de sa prochaine séance ») ; AD-6 (cas `null` : « chapitre
  sans séance à venir »).
- **Divergence** : la première séance non passée dans l'ordre de création, la plus proche par date (et une séance non
  datée ?), ou celle qui attend une action ? La carte de chapitre et la Chronologie peuvent montrer deux pastilles
  différentes pour le même chapitre.
- **Correctif** : une fonction pure `nextSeanceOf(seances, todayKey)` dans `core/status/`, à côté de
  `seanceSituation`. Règle : la première séance, dans l'ordre de la liste servie, dont la fin n'est pas passée. Le spine
  précise aussi le cas du MJ (EXPERIENCE §4.1 : « le MJ garde Je mène dans tous les cas »), qui contredit le cas `null`
  « chapitre sans séance à venir » (voir A-14).

### A-9 · MOYENNE · Vote en résumé : les noms et les dénominateurs ne viennent pas de la charge utile annoncée

- **Où** : AD-6 (« tout se dérive de `SeanceDto` et `SessionPollDto` ») ; EXPERIENCE §5.3 (« Réponses : x sur N
  joueurs » ; « N'ont pas encore répondu : Lou, Sam »).
- **Constat** : les noms des absents exigent `PartieMemberDto[]` (`apps/web/src/app/core/poll/poll.util.ts:9-17`,
  `getMissingVoters(poll, members)`). En JDR, les votants éligibles sont « le MJ et ses membres »
  (`SessionPollDto.membersCount`, `shared/src/index.ts:1550` ; `OpenPollEntry.eligibleCount`, `:1467`). Le plateau de la
  Destinée compte avec les valeurs **serveur** `eligibleCount` et `answeredCount` (`calendar-view.ts:1600-1629`).
- **Divergence** : la fiche affichera « 2 n'ont pas répondu » et la Destinée « 3 » pour le même sondage, selon qu'on
  compte le MJ ou non, et selon la règle « a répondu » prise (au moins une option, ou toutes).
- **Correctif** : dans AD-6, « a répondu » = `hasAnswered('jdr', …)` (via `hasUnansweredOptions`), seule règle à la
  fois pour `vote_a_faire` / `j_ai_vote`, pour le compte et pour les noms. Dénominateur = `membersCount` (MJ compris),
  identique à la Destinée. Noms = `getMissingVoters(poll, members)`, avec la liste des membres déjà chargée par la page
  de la partie et le MJ compris. Corriger aussi la phrase « tout se dérive de… » en ajoutant « et de la liste des
  membres ».

### A-10 · MOYENNE · « Fixer la date… » : quelle fenêtre, et quel adaptateur vers `bestOption`

- **Où** : AD-6 ; EXPERIENCE §5.3 (« ouvre la confirmation de la Destinée »).
- **Constat** : il existe deux confirmations. `SealConfirmDialog` en mode créneaux (JDR, ouvert par
  `calendar-view.ts:4022`) et `DateFixDialog` (soirée, `features/events/date-fix-dialog`). `bestOption` attend des
  `RankableOption { date, slot, yes, maybe }` (`shared/src/index.ts:1128-1189`), alors que `SessionPollDto.options`
  porte des `votes[]`. Le seul adaptateur existant, `rankedPollSlots`, est dans `features/events/event-card.util.ts:658`
  et prend un `EventCardDto`.
- **Divergence** : la fiche ouvrira `DateFixDialog` ou écrira son propre comptage oui / peut-être, ce qui donne une
  seconde définition de fait du classement.
- **Correctif** : AD-6 nomme `SealConfirmDialog` en mode créneaux et un adaptateur unique
  `pollRankableOptions(poll: SessionPollDto)` dans `core/poll/`. La fiche et l'encadré passent par lui avant
  `bestOption`.

### A-11 · MOYENNE · Icônes de rôle : la correspondance rôle → icône n'est fixée nulle part

- **Où** : AD-3, AD-4 ; DESIGN, tableau des familles (`role-mj`, `role-joueur`, `role-admin`, `role-hote`) ; PRD FR-8.
- **Constat** : `PartieRole = 'mj' | 'player' | 'admin' | 'member'` (`shared/src/index.ts:274`). « Hôte » n'est pas un
  rôle de partie, puisque le créateur d'une soirée est inséré `ADMIN`. Aucune icône `role-membre`. Aujourd'hui,
  `dashboard.ts:188-189` envoie `mj` et `admin` vers `shield`.
- **Divergence** : le tableau de bord, la puce de participant (badge de 14 px) et la liste des membres associeront
  chacun `admin` ou `member` à des icônes différentes (`role-admin` ou `role-hote` pour l'hôte d'une soirée,
  `role-joueur` ou rien pour un membre).
- **Correctif** : une seule fonction `roleIconName(role, family, kind): IconName | null` dans `core/icons/`, citée par
  AD-4, avec sa table écrite dans le spine.

### A-12 · BASSE · Accessibilité du mode déclaration et du bandeau, absente du spine

- **Où** : EXPERIENCE §8 (`aria-pressed`, bandeau en région `status` lue à l'allumage, « Ne plus me le rappeler » avec
  un nom explicite).
- **Correctif** : une ligne dans les conventions. C'est une règle d'écran qu'une seule story possède, d'où la gravité
  basse.

### A-13 · BASSE · « Sous le bandeau de la Destinée » : ce bandeau n'existe pas sur le tableau de bord

- **Où** : EXPERIENCE §3.5.
- **Constat** : `destinyNotice` n'existe que dans `calendar-view.ts:1786` ; le tableau de bord n'a aucun bandeau de ce
  genre (aucune occurrence de `destin|notice` dans `dashboard.html`).
- **Correctif** : noter que le rappel est le premier bandeau du tableau de bord ; s'il en vient un autre plus tard,
  l'ordre sera Destinée puis rappel.

### A-14 · BASSE · MJ : « Je mène dans tous les cas » contredit le cas `null` « chapitre sans séance à venir »

- **Où** : AD-6 ; EXPERIENCE §4.1.
- **Correctif** : AD-6 donne l'ordre de priorité : le cas `null` « chapitre sans séance à venir » vaut pour **tous**
  les rôles, et « Je mène » ne s'applique qu'à une séance existante.

### A-15 · BASSE · Plage du meilleur créneau sur plusieurs créneaux

- **Où** : PRD FR-12 ; EXPERIENCE §5.3 (« du vendredi soir au dimanche après-midi »).
- **Constat** : le formatage de plage est écrit en ligne dans `partie-detail.ts:780-799` ; aucun helper partagé.
- **Correctif** : extraire `formatSlotRange(start, durationSlots)` dans `core/`, réemployé par la fiche et la page.

### A-16 · BASSE · FR-9 (plus d'emoji ni de caractère-icône) n'est gardé par aucun test

- **Où** : AD-4 (le test final ne vise que `<mat-icon` et `Material+Icons`).
- **Constat** : `STATUS_ICONS` (✅ ⚠️ ❌) dans `creneau-card.ts:15-19`, via `statusIcon()`, qui manque à la liste des
  fonctions d'AD-4 ; ⚔ 🌿 ⚙ dans les fichiers de ton (`grimoire-emeraude.ts:756`, `foret-ancienne.ts:748`,
  `atelier-cuivre.ts:751`).
- **Correctif** : étendre le test final aux gabarits et aux fichiers de ton, avec la liste de caractères de FR-9, et
  ajouter `statusIcon` à la liste d'AD-4.

### A-17 · BASSE · « Pas d'icône de repli » contre « renvoient un `IconName` »

- **Où** : AD-4 ; EXPERIENCE §6 (le repli sur `flag` disparaît sans être remplacé).
- **Constat** : `tintIcon()` se replie sur `'flag'` (`dashboard.ts:470-472`).
- **Correctif** : AD-4 : ces fonctions renvoient `IconName | null`, et `null` donne du texte seul.

---

## B. Revue adversariale — paires de stories conformes mais incompatibles

### B-1 · HAUTE · Retrait de `answer_poll` (AD-6) contre le widget « Prochaine séance » : le joueur d'une quête unique perd tout appel au vote

- **Paire** : la story « `seanceState` impersonnel » (AD-6) et la story « Onglets » (FR-13, la quête unique ouvre
  Détails côté joueur).
- **Constat** : `seanceState` a trois consommateurs, `seance-list.ts:214`, `scenario-timeline.ts:392` et
  **`partie-detail.ts:826-848`** (`nextSessionBadge`, rendu dans Détails, `partie-detail.html:117`). Le commentaire de
  ce widget dit que retenir « le vote qui attend MA réponse » est son but. Le joueur d'une quête unique n'a ni
  Chapitres ni Chronologie (`partie-detail.html:588` et `:598-599` : onglet Scénario réservé au MJ, Chronologie exclue
  pour `ONE_SHOT`) ; FR-10 ne pose la pastille que sur ces deux onglets.
- **Effet** : les deux stories respectent AD-6 à la lettre, et le joueur d'une quête unique n'a plus aucun « Vote à
  faire » sur la page de sa partie : le badge dit « Vote ouvert » et aucune pastille ne le remplace. Le signal du
  tableau de bord reste.
- **Correctif** : ajouter le widget « Prochaine séance » aux consommateurs de `seanceSituation` dans AD-6 et la carte
  des capacités, avec une pastille à côté du badge. `seanceSituation` doit alors accepter la forme structurelle
  `SeanceStateSource`, comme `seanceState`, et pas un `SeanceDto`.

### B-2 · HAUTE · Visibilité de la couverture : AD-8 lit un `can` de partie qui n'existe pas

- **Paire** : la story `editable-banner` (FR-14) et une story qui touche aux rôles ou à `PartieDto`.
- **Constat** : `PartieDto` (`shared/src/index.ts:576-611`) n'a pas de `can` ; `OrganizerCan` n'existe que sur les
  séances, les événements et les sondages (`:755`, `:1000`, `:1487`). La politique réelle est `mj` en JDR et `admin` en
  ralliement (`permission.service.ts:173` et `:288`). `partie-detail` décide aujourd'hui par `role` (`:271-293`).
- **Divergence** : la story A ajoute `PartieDto.can.coverUpdate` (changement d'API, contre « le serveur ne touche que
  dispos et préférences ») ; la story B écrit `role === 'mj' || role === 'admin'` côté client, une seconde définition
  du droit contre P10-AD-6.
- **Correctif** : AD-8 tranche. Soit un drapeau calculé serveur par `canMany` (`PartieDto.can: { coverUpdate }`),
  dérogation serveur assumée et listée ; soit un helper d'affichage unique `canEditCover(partie)` dans
  `core/parties/`, documenté comme reflet de `JDR_POLICY` et `RALLIEMENT_POLICY`, le serveur restant seul juge (403).
  Recommandé : le drapeau serveur, plus sûr si la politique change.

### B-3 · HAUTE · Onglets par clé : trois index codés en dur, et l'état mémorise un index

- **Paire** : la story « Onglets par clé et réordonnancement » (FR-13) et la story « bandeau d'annonce du Shell »
  (Story 29.13, existante), ou toute story qui ajoute ou retire un onglet.
- **Constat** : en plus de `MJ_INVITATIONS_TAB_INDEX = 1` (`partie-detail.ts:90`, seule constante citée par le scan),
  il y a `manualTabIndex.set(0)` pour l'annonce, qui force Détails (`:734`), et
  `defaultTabIndex = canCreateCharacter() ? 1 : 0` (`:487`). L'état `manualTabIndex` est un **nombre** (`:489-492`) :
  un onglet qui apparaît plus tard (Homme Dragon, rôle MJ ou joueur, personnages chargés) décale ce qu'il désigne.
- **Divergence** : une story fidèle à AD-8 qui remplace la seule constante citée laisse le lien vers une annonce
  ouvrir Chapitres ou Chronologie, et `scrollToAnnouncement` ne trouve rien.
- **Correctif** : AD-8 précise que l'état est une **clé** (`selectedTabKey: TabKey | null`) et que l'index n'est
  calculé qu'à la liaison avec `mat-tab-group`. Il liste les trois sites ci-dessus, et l'union `TabKey` couvre aussi les
  onglets de ralliement (voir B-15).

### B-4 · HAUTE · AD-7 nomme `mode` un signal déjà pris, et ne dit rien des écrivains existants

- **Paire** : la story « mode déclaration » (FR-1, FR-2) et toute story du Composer ou de la Destinée (P10.4 et
  P10.5, existantes).
- **Constat** : `calendar-view` a déjà `readonly mode = input<'personal' | 'mj'>('personal')` (`calendar-view.ts:340`,
  lu en `:643` et `:3412`). Le Composer et la Destinée ont leurs propres écrivains : `composing` (`:1989`),
  `destinyPollId` (`:1189`), `destinyListOpen` (`:1296`).
- **Divergence** : une story renomme l'`input` existant (gabarits et routes qui le lient) ; une autre crée
  `calendarMode`. Un `declaring` booléen ajouté « à côté » respecte la lettre (un signal pour la déclaration) mais pas
  l'esprit (« seul écrivain des bascules »), puisque `composing` et `destinyPollId` restent écrits ailleurs.
- **Correctif** : renommer la notion dans AD-7 en `interaction: 'lecture' | 'declaration' | 'composer' | 'destinee'`.
  Toute bascule passe par une seule méthode `setInteraction()`, qui vide la sélection et ferme l'outil sortant.
  `composing` devient `computed(() => interaction() === 'composer')`, et `destinyPollId` n'est écrit que par cette
  méthode. Le travail sur le code des P10.4 et P10.5 est à chiffrer dans la story.

### B-5 · MOYENNE · Ordre de la migration des icônes face aux écrans des 10.6 et 10.8

- **Paire** : une story 10.6 (bouton « Déclarer mes dispos », icône `declarer-dispos`) livrée avant le premier
  composant 10.7, et la dernière story 10.7 (AD-4, retrait de la police).
- **Divergence** : la 10.6 n'a pas d'équivalent Material à `declarer-dispos` ; elle mettra un `<mat-icon>` approchant ou
  rien. Une story 10.8 menée pendant la migration remet un `<mat-icon>` dans une zone déjà migrée, puisque le test
  anti-`<mat-icon>` n'arrive qu'en fin de 10.7.
- **Correctif** : AD-4 fixe aussi la **première** étape. La story « `app-icon`, générateur et registre » précède toute
  story qui ajoute une icône, quel que soit le palier. Dès qu'elle est livrée, aucun nouveau `<mat-icon>` n'entre (test
  qui compte les `<mat-icon` et dont le plafond ne peut que baisser), et le test final est posé à zéro.

### B-6 · MOYENNE · Temps réel du rappel : le spine décrit l'émission, pas la réception

- **Paire** : la story « rappel sur le tableau de bord » (FR-4) et la story « sourdine sur la page Compte » (FR-5), avec
  une mise en sourdine faite depuis un autre appareil.
- **Constat** : le tableau de bord écoute `user:{id}` (`dashboard.ts:582`), mais un service n'est rafraîchi que s'il
  figure dans la table `RealtimeService.handlers` (`realtime.service.ts:86-123`). La page Compte n'ouvre aucun canal (pas
  de `realtime.connect` dans `features/account/`) et lit `AuthUser`. L'acceptation d'une invitation met le client à jour
  sans SSE (`realtime.service.ts:77-78`, `Dashboard.accept()`), si bien que rejoindre sa première partie active ne relit
  pas le rappel.
- **Réponse à la question posée** : un changement de préférence depuis un autre appareil rafraîchit le bandeau
  **seulement si** la story inscrit le service du rappel au préfixe `user:`. La case de la page Compte reste périmée
  jusqu'au rechargement.
- **Correctif** : AD-5 ajoute qu'un `AvailabilityReminderService` (web) est inscrit au préfixe `user:` dans
  `RealtimeService` et relu aussi après `accept()` et `join`. Le bandeau n'affiche que `{ show }` et ne relit jamais
  `AuthUser.availabilityReminder`, qui ne sert qu'à la case du Compte. La page Compte relit `GET /auth/me` à son
  ouverture.

### B-7 · MOYENNE · Émettre `user:{id}` à chaque déclaration réveille tous les gestionnaires `user:`

- **Paire** : la story « émission du rappel » (AD-5) et la story « mode déclaration », où l'on valide en rafale.
- **Constat** : neuf gestionnaires sont au préfixe `user:` (`realtime.service.ts:95-118`). Le calendrier personnel y
  est connecté (`calendar-view.ts:3455`) et relit `GET /me/calendar` sur ce signal (`:115`, `scenarios`), alors que
  `onBatchDeclareRequested` relit déjà les déclarations (`:3632`). Le calendrier MJ s'y connecte aussi (`:3414`).
- **Effet** : chaque validation déclenche une double relecture du calendrier plus les relectures d'invitations,
  sondages ouverts, parties, signaux, Ludothèque, etc. Une autre story pourra « optimiser » en émettant seulement sur la
  préférence, et le rappel ne disparaîtra plus en direct.
- **Correctif** : AD-5 assume le coût et le borne : une seule émission `user:{id}` par **requête** (lot compris), après
  le commit. Le calendrier personnel ignore le signal qu'il a lui-même provoqué (garde de concurrence existante) ou
  l'accepte comme idempotent. Le dire, pour qu'aucune story ne le retire.

### B-8 · MOYENNE · `reminderDue` : d'où `availability/` tient-il « partie active » ?

- **Paire** : la story « rappel serveur » (AD-5) et les règles de couches (P10-AD-1).
- **Constat** : `availability/` est en couche 1 et n'importe que `PermissionsModule` (`availability.module.ts`) ; ses
  lectures d'autres domaines passent par les ports globaux (`ports.module.ts`). L'avancement d'une partie est calculé
  dans `events/` (`progressByPartieIds`, `datable-seances.service.ts:70`), puis
  `partieStatus` / `isPartieActive` (`shared/src/index.ts:402-410`).
- **Divergence** : importer `EventsService` ou `PartiesService` brise les couches ; recalculer l'avancement dans
  `availability/` crée une seconde définition ; ajouter un port est la seule voie propre, et le spine ne la nomme pas.
- **Correctif** : AD-5 nomme un port, `activePartieIdsOf(userId)` sur `OwnEventsPort` (ou un `ActivePartiesPort`),
  implémenté par `EventsService` avec `partieStatus` et `isPartieActive`. Il précise aussi le périmètre « membre » :
  propriétaire ou `Membership`, comme `affectedPartieIds` (`availability.service.ts:~95-102`), sans les invitations en
  attente.

### B-9 · MOYENNE · Pastille « Ma situation » : deux composants et deux tons

- **Paire** : la story « pastilles JDR » (FR-10) et la story « carte d'événement : Vote à faire en `status-todo` »
  (EXPERIENCE §4.1, amendement).
- **Constat** : la pastille de soirée est du balisage en ligne dans `event-card.html:26-31` (classe `event-card__chip`,
  modificateur `--dotted`), alimenté par `eventSituation()` (`event-card.util.ts:284`). Aucun composant partagé.
- **Divergence** : la story JDR écrit sa propre pastille dans `features/scenarios`, ou importe celle de
  `features/events` (d'une fonctionnalité à l'autre) ; les deux réglages de ton divergent.
- **Correctif** : un composant `shared/situation-pill` (`labelKey`, `tone: je-mene | vote-a-faire | …`) aux tons de
  DESIGN `situation-pill`, utilisé par la carte d'événement et par les séances. La story qui le crée est aussi celle qui
  aligne la carte d'événement.

### B-10 · MOYENNE · « Logique d'envoi partagée avec `partie-form` » sans unité nommée

- **Paire** : la story `editable-banner` (FR-14) et la vérification de la Story 38.3 sur `partie-form` (FR-14,
  deuxième conséquence).
- **Constat** : `MAX_COVER_SIZE` (`partie-form.ts:85`), la garde `coverSaving` (`:131`, `:368`, `:400`) et le
  verrouillage `coverLocked` (`:145`) vivent dans le composant.
- **Divergence** : une story extrait ce code dans un utilitaire, l'autre ne touche pas `partie-form` (« à vérifier »),
  et il reste deux copies.
- **Correctif** : AD-8 nomme l'unité, `core/parties/cover-upload.ts` (`MAX_COVER_SIZE`, `validateCoverFile`, une
  garde contre le double envoi exposée en signal). La story `editable-banner` y fait aussi passer `partie-form`.

### B-11 · BASSE · Couverture et temps réel : vérifié, rien à ajouter

- **Question posée** : le changement de couverture est-il émis sur `partie:{id}` ? **Oui** : `setCoverImage` et
  `removeCoverImage` appellent `emitPartieAndMembersSafe` (`parties.service.ts:1383` et `:1410`), qui émet
  `partie:{id}` puis `user:{membre}` (`:1456-1460`). Le gestionnaire `partie:` relit `PartiesService`
  (`realtime.service.ts:87`).
- **Correctif** : préciser dans AD-8 que `editable-banner` reçoit la partie de `partie-detail` en `input`, sans copie
  locale de `coverImageVersion`, pour suivre le rafraîchissement.

### B-12 · BASSE · Registre d'icônes : les attributs de la racine `<svg>`

- **Paire** : la story « générateur » (AD-2) et la story « `app-icon` » (AD-1).
- **Constat** : les 127 SVG portent tous `fill="none" stroke="currentColor" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden focusable` sur la racine, avec des commentaires. Les balises internes se limitent
  à `path`, `circle` et `rect`, et le seul attribut rare est `fill-rule` (deux fois).
- **Divergence** : le générateur stocke les attributs de la racine par icône, ou le gabarit les fixe ; une icône future
  à racine différente casse l'une des deux versions sans bruit.
- **Correctif** : AD-1 : les attributs de la racine sont fixés par le gabarit d'`app-icon`. Le générateur refuse une
  racine qui en porte d'autres et retire commentaires, `aria-hidden` et `focusable`.

### B-13 · BASSE · Le badge « Réponds au vote » de l'Agenda reste

- **Constat** : `calendar-agenda-view.ts:172` (`'answer-poll'`, clé `calendar.agenda.badge_answer_poll`) n'est pas
  dérivé de `seanceState`. Le « Don't » de DESIGN (« le badge d'état ne porte pas l'appel à l'action ») pourrait pousser
  une story à le retirer.
- **Correctif** : AD-6 le déclare hors périmètre, l'Agenda n'étant pas la page d'une partie.

### B-14 · BASSE · Urgence et tableau de bord : retirer `answer_poll` ne les touche pas

- **Question posée** : réponse **non**. Le tri « urgence » ne lit que `PartySignalsDto`
  (`core/parties/party-sort.ts`, imports de `party-signal-priority`), et le tableau de bord n'importe de
  `status-derivation` que le type `StatusBadgeState` (`dashboard.ts:16`). Le signal serveur `VOTE_EN_COURS_SANS_REPONSE`
  est calculé à part (`party-signals.service.ts`).
- **Correctif** : aucun ; l'écrire dans AD-6 pour épargner la vérification aux stories.

### B-15 · BASSE · Clés d'onglet : la liste d'AD-8 oublie les onglets de ralliement

- **Constat** : groupe et soirée ont leurs onglets (`partie-detail.html:56-93`, `484`, `569` : conjonctions, jeux,
  soirée, membres ou invités).
- **Correctif** : l'union `TabKey` est fermée et complète (deux modes), sans quoi la conversion par clé laisse les
  ralliements à l'index.

### B-16 · BASSE · Bornes de la fenêtre de 28 jours

- **Constat** : `declarationOverlapsRange` travaille en millisecondes UTC (`availability.service.ts:801-823`).
- **Correctif** : AD-5 : `fromMs` = début du jour UTC courant, `toMs` = fin du jour UTC + 27 jours, bornes incluses.
  Le test « borne des 28 jours » vise les deux bords.

---

## C. Vérification des faits de code dont dépend le spine

| Fait cité | Statut | Preuve | Remarque |
| --- | --- | --- | --- |
| `PartiesService.setCoverImage` / `removeCoverImage` | Exact | API `apps/api/src/parties/parties.service.ts:1319`, `:1396` ; web `apps/web/src/app/core/parties/parties.service.ts:118`, `:127` | Destructifs : l'ancienne image est supprimée (A-2). |
| `PARTIE_COVER_UPDATE` | Exact | `packages/shared/src/index.ts:300` ; `permission.service.ts:173` (JDR : `mj`), `:288` (ralliement : `admin`) | « Hôte » ne vaut que si l'hôte est `admin` (créateur d'une soirée). |
| « `can` de la partie (`PARTIE_COVER_UPDATE`) » (AD-8) | **Faux** | `PartieDto` sans `can` (`shared/src/index.ts:576-611`) | Voir B-2. |
| `bestOption` dans `packages/shared` | Exact, avec réserve | `shared/src/index.ts:1179` | Prend des `RankableOption` (comptes), pas `SessionPollDto` : adaptateur à nommer (A-10). |
| `declarationOverlapsRange` | Exact | `availability.service.ts:801` (privée) | Les indisponibilités synthétiques ne sont jamais persistées (`getSeanceDerivedUnavailability`, `~:705`) : une lecture Prisma les exclut d'office. Toutes les écritures d'`AvailabilityDeclaration` sont dans ce service ; `emitForUser` (`:109`) n'émet que `partie:` (le scan est exact). |
| `ThemeToneService.activeTheme()` | Exact | `apps/web/src/app/core/theme/theme-tone.service.ts:17` (`signal<Theme>`) | — |
| Entrées de `PartyBanner` | Exact | `shared/party-banner/party-banner.ts:65-74` : `partieId`, `partieName`, `mode` (`ListViewMode`), `coverImageVersion` | Aucune sortie : les pastilles doivent bien vivre dans l'enveloppe. Affichée seulement par `dashboard.html:191/252/273` et `partie-form.html:50` (le scan est exact). |
| `MJ_INVITATIONS_TAB_INDEX` | Exact mais **incomplet** | `partie-detail.ts:90` | Deux autres index en dur : `:487`, `:734` (B-3). |
| `AuthUser` | Exact | `shared/src/index.ts:53` ; mappeur unique `apps/api/src/users/to-auth-user.util.ts:27` | `availabilityReminder` reste à ajouter (attendu). |
| `PATCH /me/preferences` | Exact | `account.controller.ts:43` ; `UpdatePreferencesDto` (`@IsOptional` + `@IsBoolean` déjà employé) | N'émet rien aujourd'hui ; `RealtimeModule` est `@Global` (`realtime.module.ts:6`), donc `account/` peut émettre sans import. |
| `seanceState` et ses consommateurs | Exact, avec réserve | `core/status/status-derivation.ts:140` ; consommateurs `seance-list.ts:214`, `scenario-timeline.ts:392`, **`partie-detail.ts:835`** | Le troisième manque au spine (B-1). |
| Fonction de statut partagée (« partie active ») | Exact | `partieStatus`, `isPartieActive` (`shared/src/index.ts:402-410`) | L'avancement vient d'`events/` (B-8). |
| `calendar-view` sans signal `mode` | **Faux** | `calendar-view.ts:340`, `mode = input<'personal' \| 'mj'>` | Voir B-4. |
| 80 `<mat-icon>`, police à `index.html:19` | Exact | Décompte refait : 80 ; `apps/web/src/index.html:19` | Fonctions à nom d'icône : `roleIcon` (`dashboard.ts:188`), `tintIcon` (`:470`), `modeIcon` (`list-control-bar.ts:74`), plus `statusIcon` (`creneau-card.ts:82`) en emoji (A-16). |
| Jeu d'icônes (~130) | Exact | 30 × 3 thèmes + 37 communes = 127 ; noms identiques dans les trois thèmes ; aucun recouvrement avec les communes | Balises `path`, `circle`, `rect` seulement ; aucun attribut interdit (B-12). |
| Couverture émise sur `partie:{id}` | Exact | `parties.service.ts:1383`, `:1410` → `:1456-1460` | B-11. |
| Retrait d'`answer_poll` sans effet sur le tri « urgence » ni sur le tableau de bord | Exact | `party-sort.ts` (signaux serveur) ; `dashboard.ts:16` (type seul) | B-14. |
