# Revue — réconciliation de la spine 10.4 avec ses entrées

- **Spine relue :** `ARCHITECTURE-SPINE.md` (2026-10-20 08:19), journal `.memlog.md` (08:16).
- **Entrées confrontées :** PRD 10.4 `prd.md` (FR-1..FR-17, §3 Glossaire, §4.7), `addendum.md`, UX 2026-10-20 `EXPERIENCE.md` et `DESIGN.md`.
- **Vérifications ponctuelles dans le code (lecture seule) :** `apps/api/src/availability/availability.service.ts` (couche `votes-en-cours`), `apps/web/src/app/app.routes.ts`, `apps/web/src/app/features/events/event-card.util.ts` (`pollBestSlot`), `date-fix-dialog.ts`, `calendar-view.ts`.
- **Hors champ :** ce qui est purement visuel (tokens, rayons, tailles, ombres, libellés exacts) quand deux builders ne peuvent pas diverger sur un comportement.

## Verdict

La spine couvre bien l'ossature (lectures du calendrier personnel, prédicat partagé, `canOrganize` servi, armement par `?seanceId`, `?poll`, masquage, plages longues). Les écarts délibérés du memlog sont reportés dans le Deferred. En revanche, plusieurs règles comportementales n'ont pas atterri. La plus grave : le DTO de `/me/open-polls` perd « ma réponse » par option, que porte aujourd'hui `votes-en-cours`. Restent aussi sans règle la cohabitation des modes (Destinée, composer, sélection de fenêtre), une fin de Destinée impossible à détecter dans le calendrier personnel tel que la spine le décrit, la vue forcée au lien direct, la définition unique du « meilleur » créneau et le contrat d'URL des liens de vote.

## Couverture

| Exigence | Couverte par | État |
| --- | --- | --- |
| FR-1 sélection d'une fenêtre | AD-8 (signal éphémère) | OK ; l'estompe concurrente avec la Destinée n'est pas réglée (T2) |
| FR-2 ajout au vote | AD-5, AD-8 | Partiel : liste du choix du rendez-vous (T6), durée de la fenêtre (T7), colonne pendant la Destinée (T2) |
| FR-3 masquage | AD-7 | OK ; temps réel multi-appareil (T9), validation (T13) |
| FR-4 repli | AD-9 + ⚠️ Deferred | OK (écart consigné) |
| FR-5 Proposer des dates | AD-3, AD-4, AD-5 + ⚠️ UJ-2 | OK ; ligne de nature du choix du rendez-vous (T11) |
| FR-6 geste de sélection | existant + AD-10 (FULL_DAY) | OK |
| FR-7 liste ✦ | AD-1, AD-2, AD-6 | Partiel : « ma réponse » absente (T1), filtre (T10) |
| FR-8 plateau | AD-2, AD-6, AD-12 | Partiel : « meilleur » (T5), créneau courant (T12) |
| FR-9 flèches | AD-6 | Partiel : créneau courant indexé (T12) |
| FR-10 créer / modifier depuis la Destinée | AD-5 | Partiel : retour après validation, cycle de vie de `?seanceId` (T8) |
| FR-11 fixer / prolonger | AD-13 | OK ; présélection du meilleur (T5) |
| FR-12 fin de la Destinée | AD-6 | **Non applicable tel quel en calendrier personnel (T3)** |
| FR-13 lien direct | AD-6 | Partiel : vue forcée et position d'entrée (T4), message (T3) |
| FR-14 liens de vote | AD-5, AD-6, carte des capacités | Partiel : aucun contrat lien → route → paramètre (T6b) |
| FR-15 filtre par partie | AD-9 | Partiel : effet sur la liste ✦ et la couche votes (T10) |
| FR-16, FR-17 vocabulaire | Conventions | OK |
| §4.7 JDR non régressé | AD-6 (PollStatusPanel), AD-13, tests de caractérisation | OK |
| §4.7 Confidentialité | AD-2, AD-6, AD-7, P9-AD-9 | OK |
| §4.7 Temps réel | AD-12 | Partiel (T9) |
| §4.7 Mobile | — | Partiel : vue Agenda par défaut sur mobile incompatible avec la Destinée (T4) |
| §4.7 Accessibilité | contrat UX §7, 36.9 hérité | OK (composants isolés), sauf l'annonce du créneau courant (T12) |
| Addendum : Destinée = mode | Invariants hérités (Story 36.9), Conventions | OK |
| Addendum : estompe non filtrée | AD-9 | OK ; « activer la Destinée allume `votes-en-cours` » non repris (T10) |
| Addendum : PollStatusPanel à trois endroits | AD-6 (dernière phrase) | OK |
| Addendum : groupe 40.5b (FULL_DAY refusé, PATCH complet, pas d'automate) | AD-5, AD-10, Prevents de FR-3 | OK |
| Addendum : aller-retour de création 40.5b | AD-5 | OK ; durée dans le brouillon (T7) |
| Addendum : sondage toujours lié à un rendez-vous | AD-3 | OK |
| Addendum : fixer la date par les chemins existants | AD-13 | OK |
| UX : puce ✦ absente sans vote | Story 36.9 héritée, `destinyPolls()` | OK ; interaction avec le filtre (T10) |
| UX : vue forcée Mois / Semaine au lien direct | — | **Absent (T4)** |
| UX : FULL_DAY refusé en soirée | AD-10 | OK |

## Trous

### T1 — `/me/open-polls` ne porte pas « ma réponse » par option — **high**

- **Source :** spine AD-1 et AD-2 (DTO) ; EXPERIENCE §2.5 (« Un votant… répond sur la grille, avec le sélecteur de réponse existant »), §5.1 ; code `availability.service.ts:971` (`options[].myAnswer` de `votes-en-cours`, testé par la Story 36.6, spec l. 2078-2132).
- **Manque :** AD-1 retire `votes-en-cours` de `/me/calendar` et en fait l'unique source des votes du calendrier personnel, sans autre lecture possible. Or le DTO d'AD-2 ne liste par option que `yes / maybe / no`, et `me` = `{ eligible, answered, canOrganize }`. La réponse du lecteur option par option disparaît. Le sélecteur de réponse de la grille personnelle ne peut plus montrer « Oui » / « Retirer ma réponse », et l'état de la grille régresse hors périmètre (§4.7). Un builder qui suit AD-2 à la lettre supprimera un champ testé.
- **Correctif :** ajouter `options[].myAnswer` (réponse du seul lecteur, ce qui ne viole pas l'anonymat) au DTO d'AD-2, et le mentionner dans la caractérisation de la ligne Tests.

### T2 — Cohabitation des modes non réglée (Destinée × composer × sélection de fenêtre) — **high**

- **Source :** PRD FR-2 (« Le composer vise la destinée active si c'est un sondage de cette partie »), FR-10 ; DESIGN §7.1 (le plateau « Remplace… le contenu de la colonne MJ (bloc qui manque, Du / Au, fenêtres de l'automate) ») ; EXPERIENCE §6 (« Pendant une sélection, l'estompe de la fenêtre remplace celle de la Destinée » `[ASSUMPTION]`), §8 UJ-1 (« Valider ouvre le vote, la Destinée s'active dessus »).
- **Manque :** les entrées se contredisent et la spine ne tranche pas. Quand la Destinée est active, le plateau cache la liste de l'automate, donc la première branche de FR-2 (ajouter une fenêtre à la destinée active) est inatteignable. Aucune règle ne dit non plus ce qu'affiche la colonne pendant le composer (plateau ou automate), si armer le composer quitte la Destinée, ni quelle estompe l'emporte (fenêtre sélectionnée ou Destinée ; AD-8 et AD-11 décrivent chacune la leur). Ces surfaces seront construites dans des stories différentes (liste de l'automate, plateau, composer) : chacune choisira sa priorité.
- **Correctif :** ajouter un AD « priorité des modes » : un tableau état → contenu de la colonne → source de l'estompe. Il doit dire au minimum : composer actif ⇒ colonne de l'automate (MJ), Destinée suspendue mais `?poll` conservé ; sélection de fenêtre ⇒ son estompe prime ; validation ⇒ Destinée sur le sondage créé ou modifié.

### T3 — Fin de la Destinée et message impossibles à établir en calendrier personnel — **high**

- **Source :** spine AD-6 (« sondage absent de la source **et** reconnu clos (date fixée, annulé, supprimé) ») ; PRD FR-12 (« un message qui dit pourquoi »), FR-13 (« clos ou inexistant : message écrit ») ; EXPERIENCE §3.1 (« Ce vote est clos : sa date est fixée. »), §5.4 (« message écrit, une fois »).
- **Manque :** `/me/open-polls` ne sert que les sondages `OPEN`, et AD-1 interdit toute autre lecture. Le calendrier personnel ne peut donc pas « reconnaître » un sondage clos, ni dire pourquoi (date fixée, annulé ou supprimé). Il ne peut pas non plus distinguer un sondage clos d'une partie devenue masquée, terminée ou quittée. Conséquences : le mode reste accroché à un sondage fantôme, ou l'écran affiche « sa date est fixée » pour un sondage annulé, inexistant ou inaccessible, ce qui est faux. L'atelier, qui dispose de la charge utile de la partie, affichera autre chose : les deux contextes divergent. Enfin, rien ne dit si un `?poll` invalide est retiré de l'adresse, alors que le message ne doit apparaître qu'une fois.
- **Correctif :** dans AD-6, définir la fin par contexte. Calendrier personnel : absence de la source ⇒ sortie avec un message neutre unique (« Ce vote n'est plus ouvert »), sauf si la séance apparaît datée dans `/me/calendar` (⇒ « date fixée »). Atelier : raison lue dans la charge utile. Dans les deux cas, `?poll` est retiré par `replaceUrl`. Si le message neutre est retenu, consigner l'écart ⚠️ au texte UX §3.1.

### T4 — Vue forcée Mois / Semaine et position d'entrée en Destinée — **medium**

- **Source :** EXPERIENCE §6 « Lien direct » (« vue Mois (Semaine pour un groupe), même si l'Agenda est la vue par défaut sur mobile ; Destinée active ; tiroir replié »), §2.4 (activation depuis l'Agenda ⇒ Mois / Semaine ; « premier créneau candidat (ou… le meilleur, après l'échéance) »), §9 ; PRD §4.7 Mobile ; code `calendar-view.ts:283` (Agenda par défaut sous le seuil ordinateur).
- **Manque :** AD-6 dit que `?poll` est lu à l'initialisation, mais pas que l'entrée en Destinée (par lien ou par la liste) impose la vue. Sur téléphone, cible de premier rang pour le vote, la page s'ouvre en Agenda, où la Destinée n'existe pas (36.9) : le parcours UJ-3 échoue. La règle « Semaine pour un groupe » dépend du contexte (route `guild-calendar` d'un ralliement, mais aussi d'un joueur de JDR : `app.routes.ts:130`). Elle doit être un critère de famille, pas de route. La position d'entrée (premier créneau, ou meilleur après l'échéance) n'est pas non plus fixée, alors qu'elle se calcule à trois endroits (lien, liste, après validation).
- **Correctif :** compléter AD-6. Toute entrée en Destinée force `month` (`week` si la famille du sondage est `ralliement`), replie le tiroir et se place sur l'option donnée par une seule fonction `destinyEntryOption(poll, today)`.

### T5 — « Meilleur créneau » : aucune définition unique — **medium**

- **Source :** PRD FR-11 (« le meilleur en tête et présélectionné ») ; EXPERIENCE §2.5 (« meilleur » sur le plus plébiscité), §2.4 et §8 UJ-4 (ouverture sur le meilleur après l'échéance) ; DESIGN §8 ; code : `pollBestSlot` (`event-card.util.ts:466` : le plus de oui, puis le plus de peut-être, `null` si aucun oui, calculé sur `eligibleVoterIds` et `votes[].userId`) ; `DateFixDialog` (« meilleur créneau NON passé présélectionné »).
- **Manque :** au moins quatre usages (étiquette du plateau, tiroir replié, présélection du dialogue, position d'entrée) et deux implémentations existantes aux règles différentes : options passées exclues ou non, départage. En calendrier personnel, ni identifiant de votant ni `eligibleVoterIds` n'arrive (AD-2) : `pollBestSlot` y est inutilisable, et un builder en réécrira un troisième.
- **Correctif :** une fonction pure `bestOption(options, today)` dans `@master-jdr/shared`, sur les comptes agrégés (oui, puis peut-être, puis la plus proche ; options passées exclues ou non, à trancher), utilisée par le plateau, les dialogues et T4.

### T6 — Choix du rendez-vous pour « Ajouter au vote » et contrat des liens de vote — **medium**

**T6a — Liste du choix du rendez-vous en FR-2.**
- **Source :** PRD FR-2 (« une séance qui a déjà un sondage ouvert (prérempli) **ou** une séance à dater ») ; EXPERIENCE §5.2 (« proposer reste possible depuis la liste des destinées ») ; spine AD-3 (`isDatableSeance` exclut `hasPoll`).
- **Manque :** le seul prédicat partagé exclut les séances qui ont un sondage. Or le choix du rendez-vous de FR-2 doit les proposer. Un `RendezvousPicker` construit pour FR-5 à partir d'`isDatableSeance` cassera FR-2.
- **Correctif :** déclarer à côté un second prédicat partagé `isComposableSeance` (à dater, **ou** sondage ouvert, avec `canOrganize`), utilisé par le choix du rendez-vous quand le composer part d'une fenêtre de l'automate.

**T6b — Contrat lien → route → paramètre.**
- **Source :** PRD FR-14 (fenêtre d'événement, e-mail de relance, page de partie côté joueur, fiche de scénario ; « plusieurs sondages ouverts : liste des destinées restreinte ») ; EXPERIENCE §6 « Liens existants redirigés » ; spine, schéma « LIENS → ATELIER » et « LIENS → PERSO », sans préciser lequel.
- **Manque :** aucun tableau ne dit quel lien mène à quelle route. Pourtant `/parties/:id/calendar` est en mode `mj` et un joueur de JDR passe par `guild-calendar`. L'e-mail, lui, construit une URL absolue côté serveur. Le cas « plusieurs sondages ⇒ ouvrir la liste ✦ de la partie » n'a aucun paramètre d'adresse. La page de partie, l'e-mail et la fenêtre d'événement seront écrits par des builders différents.
- **Correctif :** ajouter aux Conventions un tableau source → route (`guild-calendar` pour joueur et ralliement, `calendar` pour le MJ) → paramètre (`?poll`, `?seanceId`), plus un paramètre ou une règle pour « ouvrir la liste ✦ » (par exemple `?destiny=list`).

### T7 — Plages longues × automate × composer : la durée de la fenêtre doit suivre celle du sondage — **medium**

- **Source :** spine AD-8 (coïncidence sur la durée), AD-10 (une durée par sondage), AD-11 (`?span=N`) ; PRD FR-2 ; Deferred (« durée par défaut de la liste de l'automate » renvoyée à l'UX).
- **Manque :** le Deferred renvoie à l'UX la durée par défaut, mais l'invariant de cohérence relève de l'architecture et n'est écrit nulle part : une fenêtre ajoutée à un sondage doit avoir son `durationSlots`. Sans lui, « Ajouter au vote » peut verser une fenêtre d'un créneau dans un sondage de trois, ce que le serveur (AD-10) refusera, ou qu'il tronquera. Le brouillon de l'aller-retour 40.5b ne mentionne pas non plus la durée.
- **Correctif :** dans AD-10 ou AD-8, écrire : composer armé ⇒ liste de l'automate lue avec `span = durationSlots` du rendez-vous ou du sondage ciblé ; une fenêtre d'une autre durée ne peut pas être ajoutée ; le brouillon de conjonction porte `durationSlots`.

### T8 — Cycle de vie de `?seanceId` et retour après validation — **medium**

- **Source :** spine AD-5, AD-6 (seul `?poll` est réécrit) ; PRD FR-10 (« à la validation, la Destinée reste active sur ce sondage » ; « le nouveau sondage devient la destinée active ») ; EXPERIENCE §8 UJ-1 (climax).
- **Manque :** rien ne dit que `?seanceId` est retiré après validation ou annulation. Or un rechargement réarmerait le composer, cette fois prérempli puisque le sondage existe. « Modifier les dates » depuis le calendrier personnel ne porte pas `?poll` : arrivé à l'atelier, la Destinée n'est pas active, ce qui contredit FR-10. Après une création, le nouveau `pollId` doit être connu des deux chemins d'écriture, y compris le groupe, qui passe par un `PATCH` d'événement en remplacement complet, pour réécrire `?poll`. Le retour au calendrier personnel après la validation (rester à l'atelier ou revenir) n'est pas décidé non plus.
- **Correctif :** dans AD-5, écrire : `?seanceId` est consommé puis retiré (`replaceUrl`) à la validation ou à l'annulation ; « Modifier les dates » navigue avec `?seanceId` **et** `?poll` ; la validation pose `?poll=<pollId>` (renvoyé par les deux écritures) ; on reste à l'atelier.

### T9 — Temps réel : liste de l'automate et masquage multi-appareil — **medium**

- **Source :** PRD §4.7 (« la liste de l'automate suit les changements des autres en direct ») ; spine AD-7 (« émission `user:{id}` du MJ seulement »), AD-12 (atelier sur `partie:{id}`) ; code `availability.service.ts:117` (les écritures de dispos émettent `partieTopic`).
- **Manque :** AD-12 ne range pas `available-slots` (avec `?span` et le drapeau `hidden`) parmi les charges utiles que l'atelier recharge sur `partie:{id}`. Surtout, le masquage émet sur `user:{id}` alors que l'atelier n'écoute que `partie:{id}` : l'émission d'AD-7 n'a aucun destinataire à l'atelier, et le second appareil du MJ reste faux.
- **Correctif :** dans AD-12, écrire : l'atelier du MJ recharge `available-slots` sur `partie:{id}` (dispos, sondages) **et** sur `user:{id}` (masquage).

### T10 — Filtre par partie, couche « votes » et Destinée — **medium**

- **Source :** PRD FR-15 (« s'applique à toutes les natures affichées (séances, votes, …) ») ; EXPERIENCE §2.6 ; addendum (« activer la Destinée allume `votes-en-cours` ») ; spine AD-6 (`destinyPolls()` dérivé d'`allCalendarEntries()`), AD-9 (filtre en aval).
- **Manque :** l'estompe est bien protégée. Mais trois questions restent ouvertes. La liste ✦ et la puce (présence, compteur) respectent-elles le filtre ? Que devient une destinée active quand on décoche sa partie ? La règle héritée « activer la Destinée allume la couche votes » tient-elle encore, maintenant que la source de cette couche change (AD-1) ? Deux lectures sont possibles : un builder fait suivre le filtre à la liste, un autre non.
- **Correctif :** dans AD-9, écrire : le filtre ne s'applique ni à la liste ✦, ni à la puce, ni au plateau ; activer une destinée allume la couche votes **et** recoche sa partie si elle était décochée.

### T11 — Ligne de nature du choix du rendez-vous : DTO insuffisant — **low**

- **Source :** EXPERIENCE §3.3 (« séance sans date » ; « {conjonction | halte | réunion} sans date » ; « soirée sans date » pour une soirée isolée) ; DESIGN §7.5 ; spine AD-3 (réponse : `family` seulement, `'jdr' | 'ralliement'`).
- **Manque :** `family` ne distingue pas un événement de groupe d'une soirée isolée. Le front ne peut pas écrire la ligne de nature en calendrier personnel.
- **Correctif :** ajouter au DTO `DatableSeance` la forme du ralliement (groupe ou isolée), ou un champ de nature déjà projeté.

### T12 — Créneau courant indexé, non keyé — **low**

- **Source :** addendum (« état keyé par `pollId` (jamais par un index, à cause des rechargements SSE) ») ; spine AD-6 (flèches sur les options) ; EXPERIENCE §6 (toucher une bande de vote « rend ce créneau courant »), §7 (annonce `aria-live` « Créneau 2 sur 5 »).
- **Manque :** la règle « jamais par index » n'est reprise que pour le sondage. Le créneau courant (n/N), partagé par le plateau, le tiroir, les flèches et la grille, peut être stocké comme un rang : après une modification d'options reçue en temps réel, il bascule sur une autre date.
- **Correctif :** dans AD-6, ajouter « créneau courant = `optionId` ; n/N se dérive de l'ordre chronologique ».

### T13 — Masquage : aucune validation de la clé — **low**

- **Source :** spine AD-7 ; `docs/security.md` (validation).
- **Manque :** le `PUT` accepte n'importe quelle clé naturelle. Rien ne borne la date (passée ou lointaine) ni la durée (plafond d'AD-10), ni ne vérifie que la fenêtre existe : un MJ peut insérer des lignes sans limite.
- **Correctif :** valider l'énumération `DaySlot`, une date non passée et `durationSlots` ≤ plafond partagé, puis refuser par un 400 en français.

### T14 — Écarts ⚠️ non exhaustifs et trace du memlog — **low**

- **Source :** PRD §3 Glossaire (« Rendez-vous à dater… sans sondage **ouvert** ») et FR-5 (« ont déjà une date ou un sondage ouvert ») ; spine AD-3 (« sans sondage **lié** ») ; Deferred ⚠️ ; memlog l. 22 (`SlotWindowHidden(userId, partieId, date, slot)`, quatre colonnes) contre AD-7 (cinq colonnes).
- **Manque :** le resserrement « sans sondage lié » (un vote clos sans date ne rend pas la séance à dater) modifie la définition du Glossaire du PRD. Il figure dans le Deferred (« relancer… non couvert ») mais pas dans la liste des ⚠️ écarts à reporter dans le PRD. Le memlog n'a pas été amendé quand `durationSlots` est entré dans la clé du masquage (conséquence de PL-1).
- **Correctif :** ajouter l'écart « Rendez-vous à dater = sans sondage lié » à la puce ⚠️ du Deferred, et une ligne de memlog qui ratifie la clé à cinq colonnes.

### T15 — Plages longues dans les e-mails — **low**

- **Source :** spine AD-11 (« le reste… suit P10-AD-4 et P10-AD-15 sans changement ») ; PRD FR-11 (e-mail « date fixée »), FR-14 (e-mail de relance).
- **Manque :** les gabarits « date fixée » et « relance » affichent une date de départ. Avec `durationSlots > 1`, ils devraient afficher la plage, sans quoi deux builders (API et web) montreront des fins différentes.
- **Correctif :** ajouter les gabarits d'e-mail à la liste des consommateurs de `spanEnd` (AD-10), et à l'amendement PRD des plages longues.

## Règles « silencieuses » vérifiées et jugées couvertes

- **Ton et vocabulaire :** Conventions (trois thèmes, aucun mot du JDR ni « partie » en soirée, FR-17 dans `NEUTRAL_KEYS`) ; messages serveur en français (ligne Droits). Seul trou : T11.
- **Confidentialité :** anonymat du calendrier personnel (AD-2, AD-6, P9-AD-9, écart ⚠️ consigné) ; automate réservé au MJ (AD-7, Prevents) ; aucune dispo de groupe exposée.
- **Puce ✦ absente sans vote :** héritée de la Story 36.9, source `destinyPolls()`. Seule l'interaction avec le filtre reste ouverte (T10).
- **Estompe :** dérivée de la liste non filtrée (AD-9) et des jours couverts par `spanEnd` (AD-11). Seule la priorité avec la sélection de fenêtre reste ouverte (T2).
- **PollStatusPanel à trois endroits :** AD-6, dernière phrase. Recommandation non bloquante : préciser que `destiny-board` est un composant nouveau qui ne modifie pas les entrées de `PollStatusPanel`.
- **Aller-retour de création 40.5b :** AD-5 (conservé). Seule la durée dans le brouillon manque (T7).
- **FULL_DAY refusé en soirée :** AD-10 (et règle existante) ; la famille vient du rendez-vous résolu par `?seanceId`.
- **Partie active / soirée isolée passée :** AD-3 via P10-AD-18 (une rencontre isolée dont la plage est passée est `TERMINEE`).
- **Accessibilité et mobile hors T4 / T12 :** comportements internes à un composant, portés par EXPERIENCE §7 et §9 ; pas de risque de divergence entre builders.
