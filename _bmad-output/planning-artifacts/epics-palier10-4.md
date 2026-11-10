---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/EXPERIENCE.md'
---

# jdr-master - Epic Breakdown — Palier 10.4 : Sondage et Destinée dans le calendrier

## Overview

This document provides the complete epic and story breakdown for jdr-master, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Palier 10.4 : le calendrier devient l'endroit où l'on fabrique et où l'on suit un sondage, en JDR comme en mode soirée, et un rendez-vous peut durer plusieurs créneaux. Numérotation des épics : à partir de **44** (le Palier 10 s'arrête à l'épic 43). Vocabulaire du document : **atelier** = calendrier de partie ou du groupe (on y compose), **vitrine** = calendrier personnel (on y suit et conclut). Références : `docs/checklist.md` (temps réel), `docs/security.md`. Règles valables pour **toutes** les stories : chaque écran validé modifié est signalé ⚠️ avec ce qui change (NFR8, UX EXPERIENCE §10) ; commentaires et messages d'erreur en français, aucune installation de dépendance sans accord, tout via Docker (NFR9) ; CI verte à chaque story (NFR7).

## Requirements Inventory

### Functional Requirements

FR1 : Le MJ sélectionne une fenêtre de l'automate : elle est mise en évidence dans le calendrier, le reste estompé, la grille se place sur sa période ; une seule à la fois ; la carte sélectionnée propose « Ajouter au vote » et « Masquer ».
FR2 : « Ajouter au vote » passe toujours par le composer (ajouts cumulés, une seule validation, un seul avertissement) ; le composer vise la destinée active si c'est un sondage de cette partie que le MJ peut modifier, sinon le MJ choisit une séance à dater ou une séance à sondage ouvert (composer prérempli) ; le composer prend la durée du rendez-vous, une fenêtre d'une autre durée n'est pas ajoutée (message) ; une fenêtre quitte la liste dès qu'elle est dans le composer ou candidate d'un sondage ouvert de la partie, et y revient si on l'en retire et qu'elle est toujours libre.
FR3 : Le MJ masque une fenêtre ; rien ne change pour les joueurs ni pour les dispos ; le masquage survit au rechargement, à une nouvelle connexion et suit le MJ sur ses appareils ; il peut afficher les masquées et en démasquer une.
FR4 : Sur ordinateur, la colonne de droite se range en dock au bord droit (› / ‹), libellé et compteur dans le dock ; sur téléphone, la liste se replie verticalement ; Du / Au / Scruter visibles seulement liste dépliée ; état retenu dans ce navigateur ; même repli pour la colonne de droite des trois calendriers ; entrer en Destinée la rouvre.
FR5 : Bouton écrit « Proposer des dates » (« Modifier les dates » quand la destinée active est un sondage de l'organisateur) dans les trois calendriers ; il ouvre la liste des rendez-vous à dater, groupés par partie (restreinte à la partie à l'atelier ; choix sauté s'il n'y en a qu'un) ; caché s'il n'y a rien à dater ; le composer n'existe qu'à l'atelier : depuis la vitrine, choisir un rendez-vous ouvre son atelier composer armé, et on y reste après validation ; en mode soirée, seule une soirée isolée sans date peut être à dater ; l'aller-retour de création d'une conjonction (40.5b) est conservé ; le serveur reste juge.
FR6 : Sélection des créneaux candidats avec le geste des dispos (jours d'abord, puis moment) ; sélections cumulatives sans touche de modification ; tap court = ajouter ou retirer un créneau ; deux créneaux minimum ; journée entière refusée en soirée et, en JDR, permise seulement pour une durée d'un créneau ; le composer affiche aussi la fin du vote et la durée ; valider crée ou modifie, annuler ne change rien.
FR7 : La puce ✦ ouvre la liste des destinées : sondages ouverts visibles par l'utilisateur, groupés par partie, avec nom, fin du vote (ou « terminé ») et état (« à faire », « répondu », « organisateur », « vous ne votez pas ») ; dans la vitrine, toutes les parties actives quel que soit le mois, à l'atelier, la seule partie ; choisir une ligne active la Destinée ; puce absente sans sondage ouvert ; les votes de groupe et de soirée isolée apparaissent aussi sur la grille personnelle.
FR8 : Plateau de la destinée : créneaux candidats chronologiques avec leurs oui, clic = recentrer, comptes en direct, consultable après la fin du vote ; remplace la colonne habituelle ; tiroir du bas sur mobile (replié / déplié) ; à l'atelier, noms des absents pour l'organisateur seulement, nombre pour les autres ; dans la vitrine, nombre d'absents et lien « voir qui » (organisateur), jamais de noms ; Destinée suspendue pendant le composer ou la sélection d'une fenêtre, rétablie à la validation.
FR9 : Les flèches ‹ n/N › parcourent les créneaux candidats du vote actif (rang du créneau courant, calendrier déplacé, créneau marqué au plateau) ; changer de vote passe par la liste.
FR10 : L'organisateur modifie depuis la Destinée (composer prérempli : créneaux, durée, fin du vote ; Destinée maintenue) ou crée un nouveau sondage (chemin de FR-5 ; le nouveau devient la destinée active) ; depuis la vitrine, ces actions ouvrent l'atelier ; invisibles pour qui n'est pas organisateur.
FR11 : « Fixer la date… » au plateau, avant comme après la fin du vote ; confirmation : créneaux candidats avec comptes et plage, meilleur créneau en tête et présélectionné, rien de présélectionné sans aucun oui ; effet identique aux chemins existants (JDR : sceller ; soirée : 40.6, e-mail « date fixée ») ; « Prolonger le vote » en soirée (40.7) ; en JDR, pas de « Prolonger » : on repousse la fin du vote en modifiant le sondage ; chemins existants conservés.
FR12 : Si la destinée active devient un sondage clos (date fixée, annulé, supprimé), le mode se ferme avec un message, sans remplacement automatique ; à l'atelier, le message dit pourquoi ; dans la vitrine, il est neutre (« Ce vote n'est plus ouvert ») ; la fin du vote ne ferme pas la Destinée.
FR13 : Les adresses des trois calendriers acceptent un paramètre désignant un sondage (Destinée active dessus) ; un lien peut aussi ouvrir la liste des destinées restreinte à une partie ; toute entrée en Destinée affiche la vue Mois (Semaine en mode soirée) et se place sur le premier créneau à venir, ou sur le meilleur après la fin du vote ; tiroir replié sur mobile ; lien partageable, survit au rechargement ; sondage clos ou inexistant : calendrier normal + message ; pas d'accès : refus habituel.
FR14 : Tous les liens de vote arrivent en Destinée sur le bon sondage : « Voter dans le calendrier » d'un événement et de l'e-mail de relance ; « vote en attente » de la page d'une partie (liste restreinte si plusieurs) ; « Lancer le vote » de la fiche de scénario ouvre le composer pour la séance (l'ancien panneau 8.7 disparaît) ; un lien vers un rendez-vous plus à dater ni modifiable : calendrier normal + message ; vote de la fiche de scénario inchangé (10.8) ; pas de nouvel e-mail.
FR15 : Filtre par partie dans « Affichage » du calendrier personnel (parties actives, JDR et soirée, cases cochées par défaut) ; agit sur la grille et l'Agenda, pas sur les dispos, la liste ✦, la puce, le plateau, le rail ni les indisponibilités ; entrer en Destinée sur une partie décochée la recoche ; non enregistré ; visible dans la pastille de résumé.
FR16 : « Destinée » ne désigne plus que le mode : fenêtres de l'automate renommées (Éphémérides / Clairières disponibles / Créneaux calculés par l'automate) ; nouveaux libellés dans les trois thèmes, sans mot du JDR ni « partie » en mode soirée.
FR17 : Formulaire de création : chaque option de mode affiche une ligne en clair (« Jeu de rôle » / « Soirée entre amis ») et chaque nature une ligne d'explication, identiques dans les trois thèmes.
FR18 : Le composer affiche la fin du vote, préremplie avec la plus tôt de ces dates : dans 14 jours, ou la veille du premier créneau ; jamais avant aujourd'hui ; suit les créneaux tant qu'on n'y touche pas ; modifiable, date passée refusée ; une date après le premier créneau est permise ; en soirée, la changer réarme la relance ; en JDR, pas de relance ; l'échéance JDR, jusqu'ici silencieuse, devient visible et modifiable.
FR19 : Le composer affiche et permet de changer la durée du rendez-vous (créneaux enchaînés, 1 par défaut, la changer change celle du rendez-vous), exprimée en clair ; chaque créneau sélectionné est un départ, la sélection montre la plage entière ; une seule durée par vote ; plages d'un même vote pouvant se chevaucher, créneaux identiques impossibles ; changer la durée d'un vote qui a des réponses les efface après avertissement ; journée entière exclue au-delà d'un créneau ; 15 jours au plus.
FR20 : Une plage s'affiche sur tous les jours qu'elle couvre (Mois, Semaine, Agenda, rail, plateau, tiroir), sans estompe sur ses jours en Destinée ; un créneau couvert par plusieurs plages du même vote le montre et y répondre précise la plage ; une date fixée longue s'affiche en plage partout (fiche de scénario et liste du vote, fenêtre de l'événement, liste des parties, confirmation « Fixer la date… ») ; e-mails « date fixée », relance et rappels donnent la plage ; rappel la veille du départ.
FR21 : Une date fixée longue rend ses participants indisponibles sur chacun de ses créneaux (y compris du soir au lendemain matin) ; pour un créneau candidat long, la disponibilité affichée est la plus défavorable de la plage ; un chevauchement avec un autre rendez-vous se voit, jamais refusé ; un rendez-vous n'est « passé » qu'une fois sa fin passée.
FR22 : Pendant le composer, la liste de l'automate ne propose que des fenêtres de la durée du rendez-vous, classées comme aujourd'hui sur toute la plage ; hors composer, des fenêtres d'un créneau ; une fenêtre ne s'ajoute qu'à un sondage de même durée.
FR23 : La fenêtre de création d'un événement (soirée) et l'ajout d'une séance (JDR) proposent une durée (1 créneau par défaut), daté d'emblée ou à dater ; l'organisateur la corrige à tout moment (composer avant la date, fenêtre de l'événement ou éditeur de séance après), la plage s'étend ou se réduit pour tous ; modifier un autre champ ne change jamais la durée.

### NonFunctional Requirements

NFR1 : JDR non régressé hors périmètre — seuls les écrans listés (PRD §4.6) changent, et seulement comme il y est dit ; scellement, inscriptions et contenu de la fiche de scénario inchangés sauf l'affichage en plage (FR-20) et l'échéance visible (FR-18).
NFR2 : Confidentialité — aucune nouvelle dispo d'un autre membre exposée en mode soirée ; fenêtres de l'automate réservées au MJ (les joueurs gardent leur vue agrégée inchangée) ; aucune identité de votant dans le calendrier personnel.
NFR3 : Temps réel — comptes du plateau, liste des destinées, liste des rendez-vous à dater, liste de l'automate, bouton « Proposer des dates » et plages suivent les changements des autres en direct (canaux existants, `docs/checklist.md`).
NFR4 : Mobile — chaque fonction utilisable au doigt ; aucune trouvable seulement par appui long ; cibles de 44 px.
NFR5 : Accessibilité — actions écrites et atteignables au clavier ; l'estompe et les flèches de continuité ne portent jamais seules une information ; annonces `aria-live` du créneau courant et de la durée ; focus piégé et rendu par les fenêtres modales.
NFR6 : Sécurité — chaque droit vérifié côté serveur avec un test de refus (`docs/security.md`) ; aucune lecture d'une partie dont on n'est pas membre ; entrées bornées (durée, échéance, clé de masquage).
NFR7 : Régression et CI — la CI existante (types, build API, tests unitaires + e2e) reste verte à chaque story ; caractérisation avant tout changement de contrat (`/me/calendar`, options de vote).
NFR8 : Contrat UI — toute modification d'un écran validé est signalée ⚠️ dans la story (UX EXPERIENCE §10, 17 écarts).
NFR9 : Langue et conventions du dépôt — commentaires et messages d'erreur en français ; aucune installation de dépendance sans accord ; tout via Docker.

### Additional Requirements

*(Architecture — spine du 2026-10-20, AD-1 à AD-17, amendée le même jour ; brownfield, aucun starter template, aucune dépendance nouvelle.)*

- **AR1 — Lectures de la vitrine (AD-1, amende P9-AD-18)** : le calendrier personnel lit exactement `GET /me/calendar` (borné par période), `GET /me/open-polls`, `GET /me/datable-seances` ; la clé `votes-en-cours` quitte `MeCalendarDto` (caractérisation 30.5 mise à jour) mais reste une clé de couche ; `allCalendarEntries()` contient tous les sondages ouverts, la période ne filtre que le rendu ; `OpenPollsService` (web) réalimenté par `/me/open-polls`, plus d'appel par partie.
- **AR2 — `GET /me/open-polls` (AD-2)** : servi par `poll/` ; sondages OPEN des parties actives, toutes familles, hors masquées ; par sondage : `pollId`, `partieId`, nom, `family`, `kind`, `seanceId`, titre, `expiresAt`, `durationSlots`, options (`optionId`, `date`, `slot`, `yes`, `maybe`, `no`, `myAnswer`), `eligibleCount`, `answeredCount`, `me`, `can` ; aucun `userId` de votant ; `pollVoters()` unique (JDR : MJ + membres ; ralliement : `eligibleVoters`) et `hasAnswered()` unique gardant la règle de chaque famille ; `eligibleCount` remplace `membersCount`.
- **AR3 — Rendez-vous à dater (AD-3)** : rendez-vous = `Seance` ; à dater = sans date, `pollId` vide, événement non annulé, partie active, `can.propose` ; composable = à dater ou sondage ouvert avec `can.edit` ; prédicats `isDatableSeance()` / `isComposableSeance()` dans `@master-jdr/shared` ; `GET /me/datable-seances` servi par `events/` ; exclusion « scénario clôturé » fournie par `scenarios/` via `DatableSeanceFilter` (jeton dans `events/ports/`, lié dans `PortsModule`).
- **AR4 — Droits d'organisateur (AD-4)** : objet `can = { propose, edit, choose, extend }` par `PermissionService.canMany(userId, action, targets)` sur cibles `{seanceId}` / `{eventId}`, jamais `{partieId}` seule ; table JDR (`SEANCE_POLL_CREATE`, `POLL_OPTIONS_SET`, `POLL_CHOOSE`, `POLL_EXTEND` refusé) / ralliement (`EVENT_UPDATE`, `POLL_CHOOSE`, `POLL_EXTEND` sur `{eventId}`) ; portent `can` : `OpenPoll`, `DatableSeance`, `EventCardDto`, DTO de séance de l'atelier JDR ; `canCompose` (`hostId === me`) remplacé ; test `canMany` ⇔ écriture non refusée.
- **AR5 — Composer à l'atelier (AD-5)** : armement unique par `?seanceId` (JDR et groupe) ; composer initialisé à `Seance.durationSlots` ; prérempli si sondage ouvert et `can.edit` ; sinon message sans rien révéler ; panneau `app-poll-creation` (8.7) retiré ; `?seanceId` retiré à la validation et à l'annulation, la validation pose `?poll` ; écritures JDR (`POST /scenarios/seances/:id/poll`, `PUT …/options`), soirée isolée (`PATCH /parties/:id/events/:eventId`, 41.2, champs relus), groupe (40.5b) ; brouillon de conjonction avec `durationSlots` dans les deux sens ; avertissement de perte calculé par une fonction pure selon le critère du serveur.
- **AR6 — Destinée (AD-6)** : état `destinyPollId` ; créneau courant = `optionId` ; `?poll` et `?pollList` lus à l'init et réécrits par `Location.replaceState` (sans navigation, qui vide le bandeau contextuel) ; entrée : vue Mois (Semaine en ralliement), tiroir replié, `destinyEntryOption(poll, today)` ; fin : atelier = raison lue dans la charge utile, vitrine = absence après rechargement réussi, message neutre (heuristique `lastDestinyDates` retirée) ; plateau nominatif à l'atelier pour l'organisateur, anonyme dans la vitrine ; `PollStatusPanel` de la fiche non touché.
- **AR7 — Fenêtres et masquage (AD-7)** : `SlotWindowHidden(userId, partieId, date @db.Date, startSlot, durationSlots)` unique (index nommé court), écrivain `parties/`, Cascade ; `available-slots` : calcul à `span` → exclusion des fenêtres déjà proposées → masquées à part (`hidden`) → plafond 20 ; exclusion et masquage dans la vue nominative du MJ seulement ; chaque fenêtre porte `durationSlots` ; `PUT/DELETE parties/:id/available-slots/hidden`, action `SLOT_WINDOW_HIDE` (OWNER_ONLY JDR, NOBODY ralliement), corps validé.
- **AR8 — Fenêtres côté écran (AD-8)** : une fonction pure pour les fenêtres affichées (moins les cellules du composer) ; `?span` = valeur courante du champ durée du composer, 1 hors composer ; fenêtre d'une autre durée non versée, message.
- **AR9 — Filtre et repli (AD-9)** : filtre par partie non persisté, en aval d'`allCalendarEntries()` ; estompe, rail, indisponibilités, liste ✦, puce, plateau non filtrés ; entrer en Destinée recoche et allume `votes-en-cours` ; repli en `localStorage` (try/catch), une clé, ouvert par défaut, rouvert à l'entrée en Destinée.
- **AR10 — Durée du rendez-vous (AD-10, amendé)** : `Seance.durationSlots Int @default(1)`, écrivain `events/` seul (test de source) ; `PollOption` = départ, sans durée propre ; options d'un même sondage pouvant se chevaucher, unicité = départ ; `spanEnd()` et `spanSlots()` uniques dans `@master-jdr/shared` ; FULL_DAY seulement à 1 ; entrées : durée absente = inchangée en modification, 1 à la création ; ordre transactionnel verrou partie → événement → `setDurationInTx` → `setOptionsInTx(…, { purge: changed })` ; purge = options et votes recréés, `relanceSentAt` remis à vide ; création JDR atomique (lève la non-atomicité 8.7) ; `RendezVousDurationPort` (`setDurationInTx`, `durationsOf`) déclaré dans `poll/ports/` ; `durationSlots` requis dans tous les DTO de sortie ; composer : FULL_DAY refusé au-delà de 1 ; plafond 15 jours (45 créneaux).
- **AR11 — Choisir, chercher, afficher (AD-11)** : `SeanceDatePort.chooseDate` (signature inchangée) écrit la plage complète ; fixation sous le verrou d'AR10, relecture dans la transaction, option disparue → 404 ; `available-slots?span=N` garde le classement actuel au pire statut sur `spanSlots` ; une option = une entrée d'agenda avec départ et fin ; créneau couvert par plusieurs options rendu une fois avec le nombre, vote explicite par option ; disponibilité d'une option longue = agrégat le plus défavorable (une fonction de `features/calendar/`) ; `bestOption(options, today)` unique dans `@master-jdr/shared`.
- **AR12 — Temps réel (AD-12)** : vitrine recharge `/me/open-polls` et `/me/datable-seances` sur `user:{id}` ; atelier sur `partie:{id}` (dont `available-slots`) et, pour le MJ, `available-slots` sur `user:{id}` ; toute écriture touchant un sondage ouvert, une date de séance ou l'ensemble « à dater » émet `partie:{id}` et appelle `notifyPartieSignalsChanged` après validation ; masquage → `user:{id}` du MJ seulement.
- **AR13 — Fixer et prolonger (AD-13)** : routes et dialogues existants (`PATCH …/choose`, `PATCH …/extend`), alimentés par le plateau ; `partieId` de l'entrée (vitrine) ou de la route (atelier) ; boutons selon `can.choose` / `can.extend`.
- **AR14 — Plage datée lue entière (AD-14, étend P10-AD-15)** : DTO de séance datée (`MyCalendarSeanceEntry`, `EventCardSeanceDto`, `SeanceDto`) avec `start/end` lus de la `Seance` ; `OccupiedSpan` en plage dépliée par `spanSlots` ; filtres de période par chevauchement ; « passée » = fin avant aujourd'hui partout ; `end = spanEnd(start, durationSlots)` maintenu par une fonction d'`events/` ; durée corrigeable après la date (fin recalculée, `reminderSentAt` remis à vide si le départ n'est pas passé, `nextSessionDate` recalculée, pas d'e-mail) ; rappel sur le départ ; e-mails « date fixée » et relance en plage ; liste des parties en plage.
- **AR15 — Contexte des sondages et statut (AD-15, déplace P10-AD-18)** : `OpenPollContextPort.contextOf(userId, pollIds)` dans `poll/ports/`, implémenté en lot par `events/` ; `partieStatus()` pur dans `@master-jdr/shared`, `progress` fourni en lot par `events/` ; seule définition de « partie active ».
- **AR16 — Priorité des modes (AD-16)** : composer > fenêtre sélectionnée > Destinée ; armer le composer suspend la Destinée (`?poll` conservé) ; valider la réactive sur le sondage créé ou modifié ; annuler rend l'état précédent.
- **AR17 — Échéance (AD-17)** : champ dans le composer, deux familles ; `defaultPollDeadline(options, today)` unique (remplace `DEFAULT_POLL_TTL_MS`), aussi appliqué par le serveur en l'absence d'échéance ; écritures JDR et soirée portent `expiresAt` ; échéance passée refusée, pas de borne haute ; en soirée, la modifier remet `relanceSentAt` à vide ; en JDR, la repousser est la prolongation.
- **AR18 — Conventions** : noms imposés (`seanceId`, `durationSlots`, `spanEnd`, `spanSlots`, `bestOption`, `defaultPollDeadline`, `partieStatus`, `canMany`, `can`, `atelierUrl`, `SlotWindowHidden`, `SLOT_WINDOW_HIDE`, `OpenPollContextPort`, `RendezVousDurationPort`, `DatableSeanceFilter`) ; synonymes interdits (`rendezVousId`, `canOrganize`, `hostId` pour un droit, `destinyId` en URL) ; adresses construites par `atelierUrl({ partieId, family, role }, params)` (web et e-mails ; JDR MJ → `/calendar`, joueur et ralliement → `/guild-calendar`) ; liens de vote : événement et relance → `?poll`, page de partie → `?poll` ou `?pollList`, « Lancer le vote » → `?seanceId` ; une migration par story qui introduit sa colonne ou sa table (`pnpm exec prisma` dans le conteneur) ; aucune production avant le Palier 11.

### UX Design Requirements

- **UX-DR1 — Colonne MJ (⚠️)** : en-tête « {libellé du thème} · N » ; ≥ 768 px : flèche › range toute la colonne en `side-dock` 44 px (‹ pour rouvrir, libellé et compteur verticaux) ; < 768 px : chevron qui replie la liste ; Du / Au / Scruter sous l'en-tête, colonne ouverte seulement ; pied « Afficher les N masquées ».
- **UX-DR2 — Fenêtre de l'automate** : états au repos · sélectionnée (contour `{colors.accent-1}` 2 px, actions « Ajouter au vote » plein et « Masquer » texte, autres jours estompés .28 sauf composer ouvert) · dans le composer (sortie de la liste, liseré tireté) · masquée (55 % d'opacité, « Démasquer ») ; en composer, cartes montrées en plage.
- **UX-DR3 — `SideDock`** : toute colonne de droite (MJ, joueur, groupe, plateau) se range et se rouvre ; dock 44 px, coins 12 px à gauche, sticky ; boutons nommés « Ranger la colonne » / « Rouvrir la colonne », `aria-expanded`, focus rendu à ‹.
- **UX-DR4 — Bouton « Proposer des dates » (⚠️)** : `mat-stroked-button` écrit dans `.calendar-controls`, remplace « Inscrire des dates » et « Composer les créneaux : {titre} » ; devient « Modifier les dates » ; absent sans rien à proposer ni modifier ; dans la vitrine, même apparence, mène à l'atelier.
- **UX-DR5 — `RendezvousPicker`** : liste groupée par nom de partie, ligne = nom + nature (« séance sans date », « séance au vote ouvert », « soirée sans date ») ; tiroir modal sous 1024 px, menu ancré au-delà, une ligne = un choix ; sauté s'il n'y a qu'un rendez-vous ; focus piégé, Échap.
- **UX-DR6 — Barre du composer (⚠️ `app-compose-bar`)** : « Pour : … », compte, raison de blocage, ligne **Durée** (`duration-stepper` « − n créneaux + », texte en clair : plage au départ choisi, sinon « soit N jours » dès 3 créneaux), ligne **Fin du vote** (`deadline-field` « Fin du vote : {date} ✎ » + ligne expliquant le défaut ; après la fin, date marquée « passée », Valider bloqué), Valider, Annuler ; `ComposeConfirmDialog` réduit à l'avertissement de perte (toutes les réponses si la durée change).
- **UX-DR7 — `DurationStepper`** : pilule à trois segments, contour `{colors.outline}`, ± `{colors.accent-1}` grisés aux bornes (1, plafond), cibles 44 px, « Raccourcir » / « Allonger » ; même composant dans le composer, la fenêtre d'un événement et l'éditeur de séance (plage en clair si la date est saisie, sinon « soit N jours ») ; annonce `aria-live` de la valeur et de la plage.
- **UX-DR8 — Composition** : geste des dispos (36.3) ; tap court = une bande ; appui maintenu / glissement = plusieurs jours, puis moment dans la barre de sélection (Journée seulement en JDR et à durée 1) ; chaque sélection s'ajoute ; chaque créneau désigné est un départ, aperçu (état preview existant) sur toute la plage, au survol aussi ; toucher un départ retire la plage, toucher une autre bande pose un nouveau départ ; clavier inchangé.
- **UX-DR9 — `SpanBands`** : bandes couvertes au marquage de leur nature (vote : fond `{colors.status-todo}` 16 % + liseré 3 px ; séance : traitement existant) ; `connector` triangle 5 px entre jours, y compris dimanche → lundi ; nom sur la première bande visible de chaque ligne de semaine (« ← » si commencée avant) ; « ×{n} » 9 px en coin si plusieurs plages du même vote ; Agenda en une ligne « départ → fin » ; rail : chaque jour couvert, « (suite) » hors du premier ; nom accessible complet sur chaque bande.
- **UX-DR10 — Puce ✦ et `DestinyList` (⚠️)** : la puce ouvre la liste (tiroir modal sous 1024 px, menu ancré au-delà), absente sans sondage ouvert ; en-têtes = nom de la partie ; `destiny-line` (nom, « Fin du vote … · N créneaux » ou « Vote terminé », `state-tag`) ; ligne « Quitter la Destinée » en tête quand une destinée est active.
- **UX-DR11 — Plateau `DestinyBoard` / `DestinySheet` (⚠️)** : colonne ≥ 768 px (sticky, défilement interne ; dans la vitrine, colonne 340 px qui n'existe qu'en Destinée) ; tiroir du bas < 768 px, non modal, replié ≈ 120 px (« n / N · {départ} → {fin} · x oui · fin du vote … », pastille, « Voir les N dates », « Fixer la date… » organisateur) et déplié ; titre, sous-titre (« Fin du vote … · x réponses sur N »), `candidate-slot-row` (oui, barre, « meilleur », courant entouré, plage écrite) ; absents nommés pour l'organisateur à l'atelier, nombre sinon, lien « voir qui » dans la vitrine ; actions « Modifier les dates », « Fixer la date… », « Prolonger le vote » (soirée), phrase « Pour rouvrir le vote… » (JDR terminé), lien « Proposer des dates pour un autre rendez-vous » ; colonne MJ : en-tête replié « Éphémérides · N » en pied.
- **UX-DR12 — États de la Destinée** : table EXPERIENCE §5.1 (aucun sondage, ouverts sans actif, actif avant / après la fin du vote, clos, créneau courant disparu → créneau d'entrée, composer armé → suspendu) ; messages écrits une fois, paramètre retiré de l'adresse.
- **UX-DR13 — Filtre par partie** : section « Seulement… » dans « Affichage » (vitrine), cases par nom de partie cochées par défaut, pastille « Affichage filtré · k sur n ».
- **UX-DR14 — Libellés par thème** : table EXPERIENCE §3.1 (automate, proposition / modification, choix du rendez-vous, filtre, liste des destinées, plateau, composer durée et échéance, messages de clôture et de lien) et §3.2 (pastilles d'état) ; `NEUTRAL_KEYS` pour la durée, les unités, « soit … », « (suite) », « ×{n} » et les libellés d'accessibilité ; aucun mot du JDR ni « partie » en mode soirée.
- **UX-DR15 — Formulaire de création (⚠️ `mode-switch`)** : options sur deux lignes (nom du thème 14 px / 500, ligne en clair 12 px `{colors.text-muted}`), hauteur 56 px ; ligne d'explication sous chaque nature (textes EXPERIENCE §2.7), aussi à l'édition de la partie.
- **UX-DR16 — Accessibilité** : région nommée « Destinée : {nom} » pour le tiroir, `aria-expanded`, pas de piège de focus ; listes modales qui piègent et rendent le focus ; annonce « Créneau 2 sur 5, … » (avec plage) ; estompe sans perte de pointeur ni d'accessibilité, jour focalisé net ; `prefers-reduced-motion` ; cibles 44 px.
- **UX-DR17 — Responsive** : < 768 px tiroir du bas, listes en tiroir modal, vue Agenda par défaut sauf lien direct ou Destinée (Mois, Semaine en soirée) ; 768-1023 px colonne, tiroir modal ; ≥ 1024 px colonne, menu ancré.

### FR Coverage Map

FR1 : Epic 46 — sélectionner une fenêtre de l'automate
FR2 : Epic 46 — ajouter une fenêtre au vote par le composer
FR3 : Epic 46 — masquer une fenêtre
FR4 : Epic 46 — colonnes de droite rangeables en dock, liste repliable
FR5 : Epic 45 — « Proposer des dates », rendez-vous à dater, composer à l'atelier
FR6 : Epic 45 — sélection des créneaux au geste des dispos, sélections cumulatives (la durée s'y ajoute en Epic 47)
FR7 : Epic 44 — liste des destinées, toutes parties, votes de groupe sur la grille personnelle
FR8 : Epic 44 — plateau de la destinée, colonne et tiroir
FR9 : Epic 44 — flèches sur les créneaux du vote actif
FR10 : Epic 45 — créer et modifier depuis la Destinée
FR11 : Epic 44 — fixer la date et prolonger depuis le plateau
FR12 : Epic 44 — fin propre de la Destinée
FR13 : Epic 44 — ouvrir le calendrier en Destinée sur un sondage (`?poll`, `?pollList`)
FR14 : Epic 44 (liens de vote vers la Destinée) · Epic 45 (« Lancer le vote » → composer, retrait du panneau 8.7)
FR15 : Epic 44 — filtre par partie du calendrier personnel
FR16 : Epic 46 — renommer les fenêtres de l'automate ; libellés nouveaux portés par chaque épic
FR17 : Epic 45 — mode et nature expliqués dans le formulaire de création
FR18 : Epic 45 — fin du vote proposée et modifiable dans le composer
FR19 : Epic 47 — durée du rendez-vous dans le composer, chevauchement
FR20 : Epic 47 — une plage s'affiche sur tous ses jours
FR21 : Epic 47 — occupé sur toute la plage, « passé » à la fin
FR22 : Epic 47 — l'automate cherche des fenêtres de la bonne durée
FR23 : Epic 47 — durée déclarée à la création et corrigée ensuite

## Epic List

### Epic 44 : Suivre et conclure un vote, où que l'on soit
Joueurs, membres et organisateurs retrouvent chaque vote ouvert de toutes leurs parties dans la liste ✦, y arrivent directement par un lien, le parcourent créneau par créneau sur un plateau (colonne ou tiroir), y répondent et, pour l'organisateur, fixent la date ou prolongent le vote sans passer par la fiche de scénario ni la fenêtre de l'événement. Pose les lectures communes du palier : `/me/open-polls`, statut de partie unique, objet `can`, `atelierUrl`.
**FRs covered:** FR7, FR8, FR9, FR11, FR12, FR13, FR14 (liens de vote), FR15

### Epic 45 : Proposer des dates en quelques gestes
L'organisateur (MJ ou hôte) voit, dans n'importe quel calendrier, quels rendez-vous attendent une date, les propose avec le geste des dispos dans le calendrier de la partie, voit et règle la fin du vote, et crée ou modifie un sondage depuis la Destinée ; « Lancer le vote » mène au même composer ; le formulaire de création explique mode et nature. Pose `/me/datable-seances`, l'armement par `?seanceId` et l'échéance par défaut unique.
**FRs covered:** FR5, FR6, FR10, FR14 (« Lancer le vote »), FR17, FR18

### Epic 46 : Les éphémérides au service du vote
Le MJ transforme en quelques gestes les fenêtres calculées par l'automate en créneaux candidats : il en sélectionne une, l'ajoute au vote ou la masque (masquage suivi sur ses appareils) ; la liste se replie, toute colonne de droite se range en dock ; le mot « destinée » ne désigne plus que le mode.
**FRs covered:** FR1, FR2, FR3, FR4, FR16

### Epic 47 : Des rendez-vous sur plusieurs créneaux
Une journée JDR ou un week-end jeux se propose, se vote, se fixe et s'affiche comme une plage : durée déclarée à la création et réglée au compteur dans le composer, aperçu de la plage, bandes reliées partout, indisponibilité sur toute la plage, automate à la bonne durée, durée corrigeable à tout moment. Touche le cœur des dates (lecteurs de plage, e-mails, « passé »), d'où son rang en dernier.
**FRs covered:** FR19, FR20, FR21, FR22, FR23

## Epic 44 : Suivre et conclure un vote, où que l'on soit

Joueurs, membres et organisateurs retrouvent chaque vote ouvert de toutes leurs parties dans la liste ✦, y arrivent directement par un lien, le parcourent créneau par créneau sur un plateau (colonne ou tiroir), y répondent et, pour l'organisateur, fixent la date ou prolongent le vote sans passer par la fiche de scénario ni la fenêtre de l'événement. Pose les lectures communes du palier (`/me/open-polls`, statut de partie unique, objet `can`, `atelierUrl`).

### Story 44.1 : Ne montrer que les actions d'organisateur permises

As a membre ou organisateur d'une partie,
I want ne voir « Modifier les dates », « Fixer la date… » ou « Prolonger le vote » que si j'ai vraiment le droit de le faire,
So that aucun bouton ne me mène à un refus.

**Acceptance Criteria:**

**Given** le Palier 10 livré (épics 37 à 43)
**When** `PermissionService` gagne `canMany(userId, action, targets)`
**Then** la méthode applique toutes les règles d'`assert` (cellule, `HOST_ONLY_WHEN_EVENT_TARGETED`, capacité) sur des cibles `{ seanceId }` ou `{ eventId }`, jamais `{ partieId }` seule, en un nombre fixe de requêtes quel que soit le nombre de cibles (AR4)
**And** l'objet `can = { propose, edit, choose, extend }` suit la table : JDR `SEANCE_POLL_CREATE` / `POLL_OPTIONS_SET` / `POLL_CHOOSE` / `POLL_EXTEND` (refusé) ; ralliement `EVENT_UPDATE {eventId}` / `EVENT_UPDATE {eventId}` / `POLL_CHOOSE {eventId}` / `POLL_EXTEND {eventId}` ; la correspondance vit dans `permissions/` seulement
**And** `EventCardDto` et le DTO de séance de l'atelier JDR portent `can` ; le calendrier du groupe remplace `canCompose` (`hostId === me`) par `can`, sans changement visible pour l'hôte ; un admin non hôte ne voit plus d'action qu'il ne peut pas faire
**And** un test vérifie, pour chaque famille et chaque action, que `canMany(...) === true` ⇔ l'écriture correspondante ne renvoie pas 403 ; le test de non-lecture de `ownerId` reste vert (NFR6)
**And** aucun écran JDR ne change (NFR1).

### Story 44.2 : Voir sur mon calendrier personnel les votes de toutes mes parties

As a joueur, membre ou organisateur,
I want que mon calendrier personnel montre tous mes votes ouverts, ceux de mes groupes et soirées compris, quel que soit le mois affiché,
So that je n'en oublie aucun.

**Acceptance Criteria:**

**Given** la story 44.1 livrée
**When** le calendrier personnel se charge
**Then** il lit `GET /me/open-polls`, servi par `poll/` : sondages `OPEN` des parties actives du lecteur, toutes familles, échéance passée ou non, hors parties masquées, avec `pollId`, `partieId`, nom de la partie, `family`, `kind`, `seanceId`, titre, `expiresAt`, `durationSlots` (1 tant que l'épic 47 n'est pas livré), options (`optionId`, `date`, `slot`, `yes`, `maybe`, `no`, `myAnswer`), `eligibleCount`, `answeredCount`, `me = { eligible, answered }` et `can` (AR1, AR2)
**And** aucun `userId` de votant ne figure dans la réponse ; un test de refus prouve qu'aucun sondage d'une partie dont je ne suis pas membre n'y apparaît, ni un sondage de brouillon caché par l'anti-spoil (NFR2, NFR6)
**And** les données de couche 2 arrivent par `OpenPollContextPort.contextOf(userId, pollIds)`, déclaré dans `poll/ports/`, implémenté en lot par `events/` et lié dans `PortsModule` ; `layer-imports.spec.ts` reste vert (AR15)
**And** « partie active » est calculée par **une** fonction pure `partieStatus()` de `@master-jdr/shared`, alimentée par un `progress` qu'`events/` fournit en lot ; `PartieDto` l'utilise aussi, sans changement visible (AR15)
**And** les ayants droit viennent d'**une** fonction `pollVoters()` (JDR : MJ + membres ; ralliement : `eligibleVoters`) et « a répondu » d'**une** fonction pure `hasAnswered()` qui garde la règle de chaque famille ; `getMissingVoters`, `respondentIds` et les signaux de liste l'utilisent ; `eligibleCount` remplace `membersCount` (AR2)
**And** ⚠️ la clé `votes-en-cours` quitte `MeCalendarDto` (caractérisation de la Story 30.5 mise à jour d'abord, NFR7) et reste une clé de couche ; la grille personnelle tire ses votes de `/me/open-polls`, les votes de groupe et de soirée isolée compris, et ne filtre que leur rendu sur la période affichée (AR1, FR7)
**And** je vote depuis la grille personnelle sur un vote de groupe comme sur un vote de JDR, avec le sélecteur de réponse existant, et ma réponse s'y affiche (`myAnswer`)
**And** `OpenPollsService` (web) est réalimenté par `/me/open-polls`, sans plus aucun appel par partie ; ses consommateurs actuels (compteurs, badges) ne changent pas de comportement
**And** le calendrier personnel recharge `/me/open-polls` sur `user:{id}` ; un test vérifie que toute écriture de sondage ou de vote appelle `notifyPartieSignalsChanged` (AR12, NFR3).

### Story 44.3 : Choisir la destinée active dans une liste

As a joueur, membre ou organisateur,
I want ouvrir depuis la puce ✦ la liste de mes votes ouverts et en choisir un,
So that je regarde le vote qui m'intéresse, même s'il tombe dans trois mois.

**Acceptance Criteria:**

**Given** la story 44.2 livrée
**When** je touche la puce ✦
**Then** ⚠️ elle ouvre la liste des destinées au lieu de basculer le mode : tiroir modal sous 1024 px, menu ancré au-delà ; Échap ou le fond assombri ferment sans rien changer ; focus piégé puis rendu à la puce (UX-DR10, UX-DR16)
**And** la liste groupe par **nom** de partie les sondages ouverts (toutes mes parties actives dans la vitrine, la seule partie à l'atelier) ; chaque ligne donne le nom du vote, « Fin du vote {date} · N créneaux » ou « Vote terminé · N créneaux », et une pastille « À faire », « Répondu », « Organisateur » ou « Vous ne votez pas », dans les trois thèmes (FR7, UX-DR14)
**And** une destinée active s'affiche en tête, avec « Quitter la Destinée » ; sans sondage ouvert, la puce reste absente (Story 36.9, AC10)
**And** choisir une ligne active la Destinée (`destinyPollId`, jamais un rang), force la vue Mois (Semaine si le vote est du mode soirée), même depuis l'Agenda, et se place sur `destinyEntryOption(poll, today)` : premier créneau à venir avant la fin du vote, `bestOption` ensuite (AR6, AR11)
**And** `bestOption(options, today)` est **une** fonction pure de `@master-jdr/shared` (plus de oui, puis plus de peut-être, puis le plus tôt ; options passées exclues ; aucune sans oui) ; `DateFixDialog` l'utilise pour sa présélection, sans autre changement
**And** l'estompe de la Destinée et la couche « votes en cours » suivent les règles de la Story 36.9 ; aucun mot du JDR ni « partie » dans ce que voit le mode soirée (FR16).

### Story 44.4 : Suivre un vote sur le plateau de la destinée

As a joueur, membre ou organisateur sur ordinateur,
I want voir dans la colonne de droite les créneaux du vote actif avec leurs oui, et les parcourir avec ‹ ›,
So that je sais où en est le vote sans chercher dans la grille.

**Acceptance Criteria:**

**Given** la story 44.3 livrée
**When** la Destinée est active à 768 px ou plus
**Then** ⚠️ le plateau (`DestinyBoard`) remplace le contenu de la colonne de droite (colonne sticky, défilement interne) ; dans la vitrine, une colonne de 340 px apparaît avec la Destinée et disparaît avec elle (FR8, UX-DR11)
**And** il montre le titre, « Fin du vote {date} · x réponses sur N » (« Vote terminé le {date} · plus de vote possible » ensuite) et les créneaux candidats dans l'ordre chronologique (`candidate-slot-row` : oui, barre, « meilleur » sur `bestOption`, courant entouré)
**And** toucher un créneau le rend courant et place la grille dessus ; ⚠️ ‹ n/N › parcourent les **créneaux** du vote actif et non plus les votes ; le créneau courant est un `optionId`, n/N se dérive de l'ordre chronologique ; s'il disparaît d'un vote toujours présent, la Destinée se replace sur `destinyEntryOption` (FR9, AR6)
**And** qui n'a pas répondu : à l'atelier, « N'ont pas … : {noms} » pour l'organisateur seulement, « {n} n'ont pas encore répondu » pour les autres ; dans la vitrine, jamais de noms, le nombre et, pour l'organisateur, le lien « voir qui », qui mène pour l'instant à la page de la partie (FR8, NFR2)
**And** un votant répond sur la grille avec le sélecteur existant ; les comptes se mettent à jour en direct quand un autre vote (NFR3)
**And** changer de créneau courant annonce, en `aria-live` poli, « Créneau 2 sur 5, samedi 18 octobre, soir, 4 oui » ; l'estompe ne retire ni pointeur ni accessibilité (NFR5)
**And** le plateau ne modifie ni ne remplace les deux `PollStatusPanel` de la fiche de scénario (AR6).

### Story 44.5 : Suivre un vote dans le tiroir de la destinée, sur téléphone

As a joueur ou membre sur téléphone,
I want un tiroir en bas de l'écran qui résume le créneau courant et se déplie sur tous les créneaux,
So that je vote sans perdre la grille de vue.

**Acceptance Criteria:**

**Given** la story 44.4 livrée
**When** la Destinée est active sous 768 px
**Then** ⚠️ le plateau devient un tiroir du bas non modal (`DestinySheet`) : replié (≈ 120 px) avec le nom du vote, « n / N · {date} {moment} · x oui · fin du vote … », la pastille d'état et « Voir les N dates » ; déplié, le plateau complet de la story 44.4 (UX-DR11, planche `mockups/proposition-tiroir-destinee-mobile.html`)
**And** on bascule par la poignée ou par « Voir les N dates » (`aria-expanded`) ; aucune action n'est accessible par le seul glissement ; replié, le tiroir ne masque jamais toute la grille ; il se ferme avec la Destinée
**And** le tiroir est une région nommée « Destinée : {nom} » qui ne piège pas le focus ; `prefers-reduced-motion` : changement de hauteur sans animation ; cibles de 44 px (NFR4, NFR5)
**And** le reste de la colonne de droite reste empilé sous la grille, comme aujourd'hui (UX-DR17).

### Story 44.6 : Fixer la date ou prolonger le vote depuis le plateau

As an organisateur d'un vote,
I want fixer la date ou prolonger le vote depuis le plateau, avant comme après la fin du vote,
So that je conclus sans passer par la fiche de scénario ni la fenêtre de l'événement.

**Acceptance Criteria:**

**Given** la story 44.5 livrée
**When** l'organisateur (`can.choose`) touche « Fixer la date… » dans le plateau ou le tiroir
**Then** la confirmation existante s'ouvre (`SealConfirmDialog` en JDR, `DateFixDialog` en mode soirée), listant les créneaux candidats avec leurs oui, `bestOption` en tête et présélectionné, rien de présélectionné sans aucun oui (FR11, AR13)
**And** confirmer appelle `PATCH /parties/:id/poll/:pollId/choose` avec l'effet exact du chemin existant (JDR : séance scellée, vote fermé ; soirée : Story 40.6, e-mail « date fixée ») ; le `partieId` vient de l'entrée du vote (vitrine) ou de la route (atelier) ; aucune nouvelle route
**And** en mode soirée, « Prolonger le vote » (`can.extend`) ouvre `ExtendVoteDialog` (Story 40.7) ; en JDR, le bouton n'existe pas
**And** quand le vote actif devient clos (date fixée ici ou ailleurs, annulé, supprimé), la Destinée se ferme sans qu'aucun autre vote ne prenne sa place : à l'atelier, le message dit la raison lue dans la charge utile (« Ce vote est clos : sa date est fixée. », « … le rendez-vous est annulé. », « Ce vote est clos. ») ; ⚠️ dans la vitrine, l'absence du vote de `/me/open-polls` après un rechargement réussi ferme le mode sur « Ce vote n'est plus ouvert. » ; l'heuristique `lastDestinyDates` est retirée (FR12, AR6)
**And** dans le tiroir replié (story 44.5), « Fixer la date… » s'ajoute à côté de « Voir les N dates » pour l'organisateur
**And** la fin du vote qui passe ne ferme pas la Destinée ; le plateau l'indique et garde « Fixer la date… » ; les états du mode suivent la table EXPERIENCE §5.1 (UX-DR12)
**And** les chemins existants (fiche de scénario, fenêtre de l'événement) restent en place et inchangés (NFR1).

### Story 44.7 : Arriver en Destinée par un lien

As a joueur ou membre qui reçoit « Voter dans le calendrier »,
I want arriver directement sur le bon vote,
So that je réponds sans chercher.

**Acceptance Criteria:**

**Given** la story 44.6 livrée
**When** une adresse de calendrier porte `?poll=<pollId>`
**Then** la Destinée s'ouvre sur ce vote, en vue Mois (Semaine en mode soirée), sur `destinyEntryOption`, tiroir replié sur mobile ; `?pollList` ouvre la liste des destinées restreinte à la partie (FR13, AR6)
**And** `?poll` et `?pollList` sont lus à l'initialisation puis réécrits par `Location.replaceState`, sans navigation du routeur (qui viderait le bandeau contextuel), à chaque entrée, changement ou sortie de la Destinée ; le lien survit au rechargement
**And** vote clos ou inexistant : calendrier normal, « Ce vote n'existe pas ou n'est plus ouvert. » une fois, paramètre retiré ; partie inaccessible : refus habituel de la page, sans rien dire du vote
**And** les adresses sont construites par **une** fonction pure `atelierUrl({ partieId, family, role }, params)` de `@master-jdr/shared` (JDR MJ → `/parties/:id/calendar`, joueur de JDR et ralliement → `/parties/:id/guild-calendar`), utilisée par le web et par les gabarits d'e-mail (AR18) ; le lien « voir qui » du plateau de la vitrine l'utilise désormais
**And** ⚠️ les liens de vote existants arrivent en Destinée : « Voter dans le calendrier » d'une conjonction et de l'e-mail de relance (Story 40.7) → `?poll` ; « vote en attente » de la page d'une partie, côté joueur → `?poll` s'il y a un seul vote ouvert, sinon `?pollList` ; leur libellé ne change pas (FR14)
**And** UJ-3 se déroule de bout en bout : depuis une conjonction, Marc arrive en Semaine, Destinée active, tiroir replié sur le premier créneau à venir.

### Story 44.8 : Filtrer mon calendrier personnel par partie

As a utilisateur qui a plusieurs parties et groupes,
I want restreindre mon calendrier personnel à une ou quelques parties,
So that je m'y retrouve.

**Acceptance Criteria:**

**Given** la story 44.7 livrée
**When** j'ouvre « Affichage » dans mon calendrier personnel
**Then** ⚠️ une section « Seulement ces rendez-vous » (libellé par thème) liste mes parties actives, JDR et soirée, par leur nom, en cases cochées par défaut (FR15, UX-DR13)
**And** décocher une partie retire ses séances, votes et inscriptions de la grille et de l'Agenda ; mes dispos restent ; la pastille de résumé l'annonce (« Affichage filtré · 2 sur 3 »)
**And** le filtre s'applique en aval d'`allCalendarEntries()` : estompe, rail, indisponibilités, liste ✦, puce et plateau restent complets ; entrer en Destinée sur une partie décochée la recoche et rallume « Votes en cours » (AR9)
**And** le filtre n'entre ni dans `activeLayers` ni dans `CALENDAR_LAYER_KEYS` ; il est perdu au rechargement de la page.

## Epic 45 : Proposer des dates en quelques gestes

L'organisateur (MJ ou hôte) voit, dans n'importe quel calendrier, quels rendez-vous attendent une date, les propose avec le geste des dispos dans le calendrier de la partie, voit et règle la fin du vote, et crée ou modifie un sondage depuis la Destinée ; « Lancer le vote » mène au même composer ; le formulaire de création explique mode et nature. Pose `/me/datable-seances`, l'armement par `?seanceId` et l'échéance par défaut unique.

### Story 45.1 : Voir les rendez-vous qui attendent une date

As an organisateur (MJ ou hôte),
I want un bouton « Proposer des dates » qui me liste, où que je sois, mes rendez-vous encore sans date,
So that je sache tout de suite lequel dater.

**Acceptance Criteria:**

**Given** l'épic 44 livré
**When** un calendrier s'affiche pour un organisateur
**Then** ⚠️ un bouton écrit « Proposer des dates » (`mat-stroked-button`, libellés par thème) apparaît dans `.calendar-controls` des trois calendriers, à la place de « Inscrire des dates » (MJ) et des boutons « Composer les créneaux : {titre} » (hôte) ; il est absent quand il n'y a rien à dater (FR5, UX-DR4)
**And** « à dater » = `Seance` sans date, `pollId` vide, événement non annulé, partie active (`partieStatus`), `can.propose` ; le prédicat pur `isDatableSeance({ hasDate, hasPoll, cancelled, frozen, canOrganize })` de `@master-jdr/shared` sert les trois calendriers (AR3)
**And** la vitrine lit `GET /me/datable-seances`, servi par `events/` (par séance : `seanceId`, `partieId`, nom de la partie, `family`, `kind`, titre, `can`) ; l'exclusion « scénario clôturé » est fournie par `scenarios/` via le jeton `DatableSeanceFilter`, déclaré dans `events/ports/` et lié dans `PortsModule` ; test de refus : aucune séance d'une partie dont je ne suis pas organisateur (AR3, NFR6)
**And** à l'atelier, la liste se dérive de la charge utile déjà chargée, avec le même prédicat ; elle est restreinte à la partie
**And** le bouton ouvre le choix du rendez-vous (`RendezvousPicker`) : groupé par nom de partie, une ligne = nom + nature (« séance sans date », « soirée sans date ») ; tiroir modal sous 1024 px, menu ancré au-delà ; focus piégé, Échap ; choix sauté s'il n'y a qu'un rendez-vous (UX-DR5)
**And** en mode soirée, seule une soirée isolée sans date peut figurer ; une séance dont le vote a été fermé sans date n'y figure pas
**And** à l'atelier, choisir un rendez-vous arme le composer existant pour lui ; la vitrine recharge `/me/datable-seances` sur `user:{id}` et le bouton disparaît quand le dernier rendez-vous est daté ailleurs (AR12, NFR3).

### Story 45.2 : Arriver dans le calendrier de la partie avec le composer prêt

As an organisateur qui part de son calendrier personnel ou d'une fiche de scénario,
I want arriver dans le calendrier de la partie avec le composer déjà armé pour mon rendez-vous,
So that je n'aie plus qu'à choisir les jours.

**Acceptance Criteria:**

**Given** la story 45.1 livrée
**When** l'organisateur choisit un rendez-vous dans la vitrine, ou touche « Lancer le vote » sur la fiche de scénario
**Then** ⚠️ la page de l'atelier s'ouvre par `atelierUrl(…, { seanceId })` et `?seanceId` arme le composer pour ce rendez-vous, en JDR comme pour un groupe ; la vitrine n'arme jamais de composer (FR5, AR5)
**And** si la séance n'est ni à dater ni porteuse d'un vote ouvert modifiable, ou si je n'ai pas `can.propose` / `can.edit` : calendrier normal, « Ce rendez-vous n'est plus à dater. », sans rien révéler de la séance ; l'armement ne dépend jamais du mode de la route
**And** ⚠️ le panneau `app-poll-creation` / `pollPanelOpen` (Story 8.7) est retiré ; « Lancer le vote » arme le composer, choix du rendez-vous sauté (FR14)
**And** ⚠️ le rendez-vous se choisit avant le composer ; `ComposeConfirmDialog` ne garde que l'avertissement de perte de réponses (UX-DR6)
**And** `?seanceId` est retiré de l'adresse à la validation comme à l'annulation ; la validation pose `?poll=<pollId>` (renvoyé par l'écriture) et active la Destinée sur ce vote ; on reste à l'atelier, la flèche ← ramène au calendrier personnel
**And** armer le composer **suspend** la Destinée (plateau et estompe masqués, `?poll` conservé) ; valider la réactive sur le vote créé ou modifié, annuler rend l'état précédent (AR16)
**And** l'aller-retour depuis la fenêtre « Nouvelle conjonction » (40.5b) reste inchangé.

### Story 45.3 : Choisir les jours du vote comme ses dispos

As an organisateur qui compose un vote,
I want sélectionner plusieurs jours d'un geste puis choisir le moment, et cumuler mes sélections,
So that « tous les vendredis soir de novembre » se pose en quelques secondes.

**Acceptance Criteria:**

**Given** la story 45.2 livrée
**When** le composer est armé
**Then** ⚠️ le geste des dispos (Story 36.3) s'ajoute au tap : un tap court ajoute ou retire **une** bande (inchangé, 36.10) ; un appui maintenu (450 ms) ou un glissement sélectionne **plusieurs jours**, puis la barre de sélection en version composition fait choisir le moment (Journée en JDR seulement · Matin · Après-m. · Soir) et « Ajouter au vote » (FR6, UX-DR8)
**And** chaque sélection **s'ajoute** aux créneaux déjà désignés, sans touche de modification, au doigt comme à la souris ; « Retirer » et « Annuler » dans la barre de sélection ; clavier inchangé (`1` `2` `3`, `Espace`, `Maj`+flèches, `Entrée`, `Échap`)
**And** la journée entière reste refusée en mode soirée, avec la raison écrite ; deux créneaux minimum, sans plafond ; Valider reste bloqué en dessous et dit pourquoi
**And** le geste fonctionne en vue Mois et en vue Semaine, sur ordinateur et sur téléphone ; les cibles font 44 px (NFR4).

### Story 45.4 : Voir et régler la fin du vote

As an organisateur qui compose un vote,
I want voir quand le vote se termine, avec une date proposée que je peux changer,
So that je ne sois jamais surpris par l'échéance.

**Acceptance Criteria:**

**Given** la story 45.3 livrée
**When** le composer est armé
**Then** ⚠️ la barre du composer gagne la ligne « Fin du vote : {date} ✎ » (`deadline-field`), préremplie par **une** fonction pure `defaultPollDeadline(options, today)` de `@master-jdr/shared` : la plus tôt entre « dans 14 jours » et « la veille du premier créneau », jamais avant aujourd'hui, en fin de journée ; une ligne explique le défaut (FR18, AR17, UX-DR6)
**And** tant que l'organisateur n'a pas touché la date, elle suit les créneaux ajoutés ou retirés ; le crayon ouvre le sélecteur de date existant ; une date passée est refusée (« La fin du vote ne peut pas être passée. ») ; une date après le premier créneau est permise
**And** les écritures portent `expiresAt` : `POST /scenarios/seances/:id/poll` et `PUT /parties/:id/poll/:pollId/options` (JDR) l'acceptent désormais, le chemin de groupe aussi ; le serveur refuse une date passée et, en son absence, applique la même fonction, qui remplace `DEFAULT_POLL_TTL_MS` (AR17, NFR6)
**And** en modification, le champ montre la fin actuelle ; après la fin du vote, elle est marquée « passée » et Valider reste bloqué tant qu'elle n'est pas repoussée ; en soirée, la modifier remet `relanceSentAt` à vide comme « Prolonger » ; en JDR, pas de relance, et repousser la fin du vote **est** la prolongation du MJ ; le plateau d'un vote JDR terminé le dit (« Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. »)
**And** ⚠️ en JDR, l'échéance, jusqu'ici fixée en silence à 14 jours, devient visible ; c'est le seul changement du vote JDR de cette story (NFR1).

### Story 45.5 : Proposer des dates pour une soirée encore sans date

As an hôte d'une soirée isolée créée sans date,
I want lui proposer des dates depuis le calendrier,
So that mes invités votent sans que je repasse par la fenêtre de la soirée.

**Acceptance Criteria:**

**Given** la story 45.4 livrée
**When** l'hôte choisit sa soirée sans date (« Proposer des dates », dans la vitrine ou le calendrier de la soirée)
**Then** le calendrier de la soirée s'ouvre composer armé pour elle (Semaine, règle 40.5b) ; c'est une cible de composition nouvelle, distincte de « vote ouvert » et de « nouvelle conjonction » (AR5)
**And** valider écrit le vote par `PATCH /parties/:id/events/:eventId` (Story 41.2, remplacement complet), les autres champs (titre, lieu, heure, note, capacité) étant **relus** depuis la carte de l'événement, avec la fin du vote du composer ; `can.propose` (`EVENT_UPDATE {eventId}`) est exigé, refus testé (AR4, NFR6)
**And** le vote s'ouvre aux invités acceptés ; la Destinée s'active dessus ; la soirée quitte la liste des rendez-vous à dater
**And** UJ-2 se déroule de bout en bout : Léa, depuis son calendrier personnel, choisit sa soirée, compose cinq vendredis soir et un samedi après-midi dans le calendrier de sa soirée, garde la fin du vote proposée et valide.

### Story 45.6 : Créer ou modifier un vote depuis la Destinée

As an organisateur qui suit son vote en Destinée,
I want modifier ses dates ou proposer des dates pour un autre rendez-vous sans quitter le mode,
So that je pilote mes votes d'un seul endroit.

**Acceptance Criteria:**

**Given** la story 45.5 livrée
**When** la destinée active est un vote dont je suis organisateur (`can.edit`)
**Then** ⚠️ le bouton de la ligne de contrôles devient « Modifier les dates », et le plateau propose aussi « Modifier les dates » : à l'atelier, il arme le composer prérempli (créneaux, fin du vote) ; dans la vitrine, il ouvre l'atelier par `atelierUrl(…, { seanceId, poll })` ; à la validation, la Destinée reste active sur ce vote (FR10, AR5)
**And** sous les actions du plateau, un lien texte « Proposer des dates pour un autre rendez-vous » ouvre le choix du rendez-vous (story 45.1) ; le nouveau vote devient la destinée active (FR10)
**And** ces actions n'apparaissent pas pour qui n'est pas organisateur ; leurs libellés existent dans les trois thèmes (UX-DR14).

### Story 45.7 : Comprendre ce qu'on crée

As a personne qui crée une partie,
I want lire en clair ce que désignent chaque mode et chaque nature,
So that je choisis sans connaître le vocabulaire du thème.

**Acceptance Criteria:**

**Given** le Palier 10 livré (indépendante des stories 45.1 à 45.6)
**When** j'ouvre le formulaire de création
**Then** ⚠️ chaque option de la bascule de mode s'affiche sur deux lignes : le nom du thème (14 px / 500) puis « Jeu de rôle » ou « Soirée entre amis » (12 px, `{colors.text-muted}`), hauteur 56 px (FR17, UX-DR15)
**And** chaque nature affiche sous elle sa ligne d'explication (textes EXPERIENCE §2.7) ; l'option choisie garde la sienne visible ; les mêmes lignes accompagnent la nature à l'édition de la partie
**And** ces lignes sont identiques dans les trois thèmes (`NEUTRAL_KEYS`, raison « explication en clair, volontairement hors thème ») ; celles du mode soirée n'emploient aucun mot du JDR (FR16).

## Epic 46 : Les éphémérides au service du vote

Le MJ transforme en quelques gestes les fenêtres calculées par l'automate en créneaux candidats : il en sélectionne une, l'ajoute au vote ou la masque (masquage suivi sur ses appareils) ; la liste se replie, toute colonne de droite se range en dock ; le mot « destinée » ne désigne plus que le mode.

### Story 46.1 : Ranger la colonne de droite et replier les éphémérides

As a MJ (et tout utilisateur qui a une colonne de droite),
I want ranger la colonne de droite sur le bord, et replier la liste de l'automate,
So that le calendrier reprend toute la place quand je n'en ai pas besoin.

**Acceptance Criteria:**

**Given** l'épic 45 livré
**When** la colonne de droite s'affiche à 768 px ou plus
**Then** ⚠️ une flèche › dans son en-tête la range en `side-dock` de 44 px collé au bord droit, et la grille reprend toute la largeur ; le dock porte une flèche ‹ pour la rouvrir et, en vertical, ce qu'il contient (« Éphémérides · 18 », « ✦ Chapitre 4 ») ; vaut pour la colonne MJ, la colonne joueur, celle du groupe et le plateau de la destinée (FR4, UX-DR1, UX-DR3)
**And** sous 768 px, l'en-tête de la liste de l'automate est un bouton pleine largeur avec chevron (`aria-expanded`) qui la replie verticalement, et n'affiche alors que « {libellé} · N »
**And** les champs Du / Au et « Scruter » ne se montrent que colonne ouverte ou liste dépliée
**And** l'état rangé / ouvert est retenu **dans ce navigateur** (`localStorage`, lecture et écriture sous `try/catch`, une seule clé pour toutes les colonnes, ouvert par défaut) ; aucune colonne en base ; entrer en Destinée rouvre la colonne (AR9)
**And** ⚠️ les fenêtres de l'automate (`section.slots`) sont renommées : « Éphémérides » (Grimoire, provisoire), « Clairières disponibles » (Forêt, inchangé), « Créneaux calculés par l'automate » (Atelier) ; « destinée » ne désigne plus que le mode (FR16, UX-DR14)
**And** les boutons s'appellent « Ranger la colonne » / « Rouvrir la colonne », portent `aria-expanded`, et ranger rend le focus à ‹ ; cibles de 44 px (NFR5).

### Story 46.2 : Mettre une fenêtre de l'automate en évidence

As a MJ,
I want toucher une fenêtre de l'automate pour la voir dans le calendrier, le reste estompé,
So that je juge d'un coup d'œil si ce créneau tombe bien.

**Acceptance Criteria:**

**Given** la story 46.1 livrée
**When** le MJ touche une carte de la liste de l'automate
**Then** ⚠️ la carte sélectionnée prend un contour `{colors.accent-1}` 2 px et deux actions écrites, « Ajouter au vote » (plein) et « Masquer » (texte) ; dans la grille, la bande de la fenêtre prend le même contour, tous les autres jours prennent l'estompe de la Destinée (.28), et la grille se place sur la période de la fenêtre (FR1, UX-DR2)
**And** une seule fenêtre est sélectionnée à la fois ; la retoucher, ou `Échap`, la désélectionne et rend l'affichage normal ; la sélection est un signal éphémère, jamais une couche
**And** la priorité des modes est unique : composer > fenêtre sélectionnée > Destinée ; pendant la Destinée, le plateau de la colonne MJ garde en pied l'en-tête replié « Éphémérides · N » : le déplier et toucher une carte suspend la Destinée, la désélection la rétablit ; composer ouvert, toucher une carte l'entoure **sans** estomper les autres jours (AR16)
**And** les joueurs gardent leur version agrégée de la liste, inchangée, sans sélection (NFR2)
**And** l'estompe ne retire ni pointeur ni accessibilité ; un jour focalisé reste net (NFR5).

### Story 46.3 : Ajouter une fenêtre au vote

As a MJ,
I want verser une fenêtre de l'automate dans un vote, puis d'autres, et valider une seule fois,
So that je construis mon sondage à partir de ce que l'automate a trouvé.

**Acceptance Criteria:**

**Given** la story 46.2 livrée
**When** le MJ touche « Ajouter au vote » sur une fenêtre sélectionnée
**Then** la fenêtre passe toujours par le composer : composer déjà ouvert, elle y entre directement ; sinon, si la destinée active est un vote de cette partie que le MJ peut modifier, le composer s'arme prérempli de ses créneaux plus cette fenêtre ; sinon, le choix du rendez-vous s'ouvre (FR2)
**And** ce choix liste les séances **composables** : à dater, ou porteuses d'un vote ouvert (« séance au vote ouvert », composer prérempli de ses créneaux) ; le prédicat pur `isComposableSeance()` de `@master-jdr/shared` le définit (AR3, UX-DR5)
**And** une fenêtre quitte la liste dès qu'elle est dans le composer (liseré tireté sur la grille) ; annuler le composer la rend à la liste ; **une** fonction pure de `features/calendar/` calcule les fenêtres affichées (servies moins cellules du composer) (AR8, UX-DR2)
**And** ⚠️ côté serveur, `GET /parties/:id/available-slots` exclut, **avant** le plafond de 20, les fenêtres qui coïncident (même départ, même durée) avec une option d'un vote ouvert de la partie, dans la vue nominative du MJ seulement ; retirée d'un vote, une fenêtre revient si l'automate la juge toujours libre ; la vue agrégée des joueurs est inchangée (AR7, NFR2)
**And** la validation crée le vote ou le modifie en une seule fois, avec l'avertissement habituel si des réponses sont perdues ; la Destinée s'active dessus (FR2)
**And** l'atelier recharge `available-slots` sur `partie:{id}` (AR12)
**And** UJ-1 se déroule de bout en bout : Incon déplie « Éphémérides · 18 », sélectionne une carte, « Ajouter au vote » (seule séance à dater : choix sauté), ajoute deux cartes et trois vendredis soir au geste des dispos, valide.

### Story 46.4 : Masquer une fenêtre de l'automate

As a MJ,
I want écarter une fenêtre qui ne me convient pas, et la retrouver sur tous mes appareils,
So that la liste ne me propose plus ce que j'ai déjà rejeté.

**Acceptance Criteria:**

**Given** la story 46.3 livrée
**When** la migration ajoute `SlotWindowHidden(userId, partieId, date @db.Date, startSlot, durationSlots)` — unique sur les cinq colonnes, index nommé court par `map:`, écrivain `parties/`, `onDelete: Cascade` sur l'utilisateur et la partie — et que le MJ touche « Masquer »
**Then** `PUT parties/:id/available-slots/hidden` enregistre la fenêtre par sa clé naturelle, recopiée de la fenêtre servie (chaque fenêtre porte `durationSlots`), jamais d'un paramètre de page ; `DELETE` la démasque (FR3, AR7)
**And** une nouvelle action `SLOT_WINDOW_HIDE` (`OWNER_ONLY` en JDR, `NOBODY` en ralliement) garde ces routes ; le corps est validé (`DaySlot`, date non passée, `durationSlots` ≥ 1 et ≤ plafond partagé ; 400 en français) ; tests de refus, dont un joueur (NFR6)
**And** `available-slots` renvoie, dans la vue nominative du MJ, les fenêtres visibles (plafonnées après exclusion des proposées et des masquées) et, à part, les masquées marquées `hidden` ; les lignes dont la date est passée sont ignorées à la lecture
**And** ⚠️ la fenêtre masquée disparaît de la liste ; un lien « Afficher les N masquées » en pied de liste les montre à 55 % d'opacité, chacune avec « Démasquer » (libellés par thème) ; rien ne change pour les joueurs ni pour les dispos (UX-DR1, UX-DR2)
**And** le masquage survit au rechargement et à une nouvelle connexion, et suit le MJ sur ses autres appareils : il émet `user:{id}` du MJ, et l'atelier du MJ recharge `available-slots` sur ce canal (AR12, NFR3).

## Epic 47 : Des rendez-vous sur plusieurs créneaux

Une journée JDR ou un week-end jeux se propose, se vote, se fixe et s'affiche comme une plage : durée déclarée à la création et réglée au compteur dans le composer, aperçu de la plage, bandes reliées partout, indisponibilité sur toute la plage, automate à la bonne durée, durée corrigeable à tout moment. Touche le cœur des dates (lecteurs de plage, e-mails, « passé »), d'où son rang en dernier.

### Story 47.1 : Donner une durée à un rendez-vous

As an organisateur,
I want indiquer, en créant un événement ou une séance, que le rendez-vous dure plusieurs créneaux, et corriger cette durée plus tard,
So that une soirée, une journée ou un week-end soit enregistré comme tel.

**Acceptance Criteria:**

**Given** l'épic 46 livré
**When** la migration ajoute `Seance.durationSlots Int @default(1)`
**Then** seul `events/` écrit `durationSlots`, `endDate` et `endSlot` (`scenarios/` passe la durée à `events.addSeance` et à la modification de séance) ; un test de source le garde, sur le patron de `layer-imports.spec.ts` (AR10)
**And** `spanEnd(date, slot, durationSlots)` et `spanSlots(date, slot, durationSlots)` sont **les** fonctions pures de `@master-jdr/shared` pour la fin et les créneaux couverts (créneaux enchaînés `MORNING → AFTERNOON → EVENING → MORNING` du lendemain ; `FULL_DAY` seulement à 1, déplié en trois créneaux) ; testées aux bords : soir → lendemain, fin de mois, `FULL_DAY` (AR10)
**And** ⚠️ la fenêtre de création et de modification d'un événement (mode soirée) et l'ajout / la modification d'une séance (JDR) portent un compteur **Durée** (`duration-stepper` « − n créneaux + », prérempli à 1 créneau, sans mention « facultatif »), qui écrit la plage en clair si la date est saisie (« sam. 14 après-midi → sam. 14 soir »), sinon « soit N jours » dès 3 créneaux ; boutons « Raccourcir » / « Allonger », grisés aux bornes ; plafond 15 jours (45 créneaux), message « 15 jours au plus : au-delà, créez deux rendez-vous. » (FR23, UX-DR7)
**And** dans tout DTO d'entrée, `durationSlots` absent vaut **inchangé** en modification (`PATCH` d'événement compris, malgré son remplacement complet) et 1 seulement à la création ; aucun service n'applique le défaut 1 à une séance existante ; test : un `PATCH` sans durée sur un rendez-vous de 3 créneaux le laisse à 3 (AR10)
**And** une séance datée vérifie toujours `end = spanEnd(start, durationSlots)`, maintenu par **une** fonction d'`events/` qu'appellent tous les écrivains de plage (`createInTx`, `updateHosted`, création d'un événement daté, modification de séance) ; modifier un autre champ (lieu, heure, note) ne change jamais la plage ; aucune écriture ne pose `end = start` par défaut (AR14)
**And** corriger la durée d'une séance datée (même depuis un vote) recalcule la fin, remet `reminderSentAt` à vide si le départ n'est pas passé, recalcule `nextSessionDate`, émet `partie:{id}` et `notifyPartieSignalsChanged`, sans e-mail (FR23, AR14)
**And** `durationSlots` est **requis** dans tous les DTO de sortie qui décrivent une séance (`SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry`, `DatableSeance`) ; la durée suit l'action de la route qui la porte, sans action de permission propre (AR4).

### Story 47.2 : Être occupé sur toute la plage d'un rendez-vous

As a participant d'un rendez-vous de plusieurs créneaux,
I want que mes autres calendriers, l'automate et les rappels tiennent compte de toute la plage,
So that personne ne me propose un créneau au milieu de mon week-end.

**Acceptance Criteria:**

**Given** la story 47.1 livrée
**When** un rendez-vous daté dure plusieurs créneaux
**Then** `OccupiedSpan` devient une plage, dépliée créneau par créneau par `events/` via `spanSlots` ; indisponibilités dérivées, carte de chaleur et automate en héritent (FR21, AR14)
**And** les DTO de séance datée (`MyCalendarSeanceEntry`, `EventCardSeanceDto`, `SeanceDto`) portent `startDate/startSlot/endDate/endSlot` lus de la `Seance`, jamais de `poll.chosenDate` ; tout filtre de période teste le **chevauchement** de la plage (une séance du 31 au 1ᵉʳ apparaît dans les deux mois)
**And** « passée » = fin avant aujourd'hui, partout : prochaine séance, refus d'édition, annulation, statut de partie ; une plage commencée reste « à venir » jusqu'à sa fin
**And** le rappel de séance part la veille du **départ** ; les e-mails « date fixée », relance et rappel donnent la plage (« du vendredi 6 novembre au soir au dimanche 8 après-midi ») ; la liste des parties affiche la plage (FR20)
**And** test : une séance de N créneaux rend ses participants indisponibles sur chacun des N, passage du soir au lendemain compris ; les attentes des tests existants sur des séances d'un créneau ne changent pas (NFR7)
**And** un chevauchement entre deux rendez-vous se voit dans les disponibilités, jamais refusé (FR21).

### Story 47.3 : Voir une plage sur tous ses jours

As a utilisateur,
I want voir un rendez-vous de plusieurs créneaux sur chacun des jours qu'il couvre,
So that je lis sa plage d'un coup d'œil, partout.

**Acceptance Criteria:**

**Given** la story 47.2 livrée
**When** une date fixée dure plusieurs créneaux
**Then** ⚠️ en vues Mois et Semaine, chaque bande couverte prend le marquage de sa nature (`SpanBands`) ; un `connector` (triangle 5 px) relie la dernière bande d'un jour à la première du lendemain, y compris dimanche → lundi ; le nom s'écrit sur la première bande visible de chaque ligne de semaine, précédé de « ← » si la plage a commencé avant ; le reste du jour garde ses bandes normales (FR20, UX-DR9, planche `mockups/options-plages-longues.html`, option 2A)
**And** ⚠️ l'Agenda montre **une** ligne « ven. 6 nov. soir → dim. 8 nov. après-midi » ; le rail montre la plage sur chaque jour couvert, « (suite) » hors du premier
**And** ⚠️ la fiche de scénario, la fenêtre de l'événement et la liste des parties écrivent la date fixée du départ à la fin
**And** chaque bande couverte porte un nom accessible complet (« Week-end jeux, du vendredi 6 soir au dimanche 8 après-midi ») ; les flèches de continuité ne portent jamais seules l'information (NFR5)
**And** aucune teinte nouvelle : marquages de bande existants (vote, séance) seulement.

### Story 47.4 : Proposer des plages dans le composer

As an organisateur,
I want régler la durée dans le composer et voir toute la plage dès que je touche un départ,
So that je propose un week-end d'un seul geste par date.

**Acceptance Criteria:**

**Given** la story 47.3 livrée
**When** le composer est armé
**Then** ⚠️ sa barre gagne la ligne **Durée** (`duration-stepper`), initialisée **toujours** à `Seance.durationSlots` de la cible, avec la plage en clair au départ du premier créneau sélectionné (« ven. soir → dim. après-midi ») ; la changer change la durée du rendez-vous (FR19, AR5, UX-DR6)
**And** chaque créneau désigné est un **départ** ; toucher ou survoler un départ allume l'état preview existant sur **toutes** les bandes de sa plage ; toucher le départ d'une plage désignée la retire ; toucher une autre bande, même couverte, y pose un nouveau départ (UX-DR8)
**And** une seule durée par vote ; les plages d'un même vote peuvent se chevaucher ; deux créneaux au même départ sont impossibles (unicité `date|slot`) (FR19, AR10)
**And** avec une durée > 1, « Journée » disparaît de la barre de sélection, une case journée déjà posée est retirée et un message l'explique ; en vue Mois, toucher une case entière bascule en Semaine
**And** l'écriture suit **un** ordre, dans une transaction : verrou de la partie puis de l'événement → `setDurationInTx` (par `RendezVousDurationPort`, déclaré dans `poll/ports/`, lié dans `PortsModule`, ajouté à `layer-imports.spec.ts`) → `setOptionsInTx(tx, pollId, { options, expiresAt, bounds }, { purge: changed })` ; `purge` vient **seulement** du retour de `setDurationInTx` ; si la durée a changé, options et votes sont recréés (sans `planOptions`) et `relanceSentAt` remis à vide (AR10)
**And** la création d'un vote JDR écrit durée, vote et `Seance.pollId` dans **une** transaction ; la non-atomicité acceptée à la Story 8.7 est levée pour cette route (AR10)
**And** l'avertissement de perte compte **toutes** les réponses si la durée diffère de celle du rendez-vous (« Changer la durée efface les {n} réponses déjà données. »), sinon celles des options retirées ; **une** fonction pure de `features/calendar/` le calcule pour le dialogue et pour la revérification avant l'écriture (AR5)
**And** `durationSlots` figure à la racine de `SessionPollDto`, `EventPollDto` et `OpenPoll` (lu par `RendezVousDurationPort.durationsOf` ; un vote sans séance vaut 1) ; le brouillon de conjonction (40.5b) porte la durée dans les deux sens ; une option produit **une** entrée d'agenda avec départ et fin (AR11)
**And** test : un `PUT …/options` sans durée sur un vote de 3 créneaux garde 3 et ne supprime aucune réponse ; deux validations concurrentes ne purgent qu'une fois.

### Story 47.5 : Voter et fixer une plage

As a participant ou organisateur d'un vote sur plusieurs créneaux,
I want voir chaque plage proposée, y répondre et fixer la meilleure,
So that le week-end choisi soit posé pour tout le monde.

**Acceptance Criteria:**

**Given** la story 47.4 livrée
**When** un vote ouvert a une durée de plus d'un créneau
**Then** ⚠️ ses créneaux candidats s'affichent en bandes reliées sur tous leurs jours (story 47.3), sans estompe sur ces jours en Destinée ; une bande couverte par plusieurs plages du même vote porte « ×{n} » ; la toucher pour voter ouvre le sélecteur de réponse avec **une ligne par plage**, le créneau courant en tête ; voter désigne toujours explicitement l'option (FR20, AR11, UX-DR9)
**And** ⚠️ le plateau, le tiroir, la liste du vote de la fiche de scénario et la confirmation « Fixer la date… » écrivent chaque créneau candidat du départ à la fin ; le tiroir replié dit « n / N · {départ} → {fin} · x oui · fin du vote … » ; l'annonce `aria-live` dit « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui » (FR20, UX-DR11, NFR5)
**And** la disponibilité affichée d'un créneau candidat long (jauge, plateau, conflit du composer) est la plus défavorable de sa plage, calculée par **une** fonction de `features/calendar/` (FR21, AR11)
**And** fixer la date d'une option longue écrit la **plage complète** de la séance via `SeanceDatePort.chooseDate` (signature inchangée : `events/` calcule la fin par `spanEnd`) ; la fixation, en JDR comme en soirée, prend le verrou de la story 47.4 et relit vote et option dans sa transaction ; une option disparue rend 404 (AR11)
**And** UJ-5 se déroule de bout en bout : Incon crée « Week-end jeux » à 6 créneaux, propose trois vendredis soir (l'aperçu montre chaque week-end), ses amis votent, il fixe le deuxième ; chacun est occupé du vendredi soir au dimanche après-midi, le rappel part le jeudi.

### Story 47.6 : Faire chercher à l'automate des fenêtres de la bonne durée

As a MJ qui prépare une journée JDR,
I want que l'automate ne me propose que des fenêtres où toute la troupe est libre sur toute la durée,
So that je ne propose que des plages réalistes.

**Acceptance Criteria:**

**Given** la story 47.5 livrée
**When** le composer est armé avec une durée de N créneaux
**Then** la colonne demande `GET /parties/:id/available-slots?span=N`, où N est la valeur **courante** du champ durée (1 hors composer) ; le serveur garde le classement actuel pour tout N, appliqué au statut le plus défavorable de chaque membre sur `spanSlots(...)` (FR22, AR8, AR11)
**And** ⚠️ chaque carte de la liste montre sa plage (« sam. après-midi → sam. soir ») ; chaque fenêtre servie porte son `durationSlots`
**And** une fenêtre ne s'ajoute qu'à un vote de même durée ; une fenêtre choisie avant le rendez-vous et d'une autre durée n'est pas ajoutée : le composer s'ouvre à la durée du rendez-vous, sans elle, la liste se recalcule et un message l'explique (« Cette fenêtre ne dure pas {n} créneaux : elle n'a pas été ajoutée. ») (FR2, FR22)
**And** l'exclusion des fenêtres déjà proposées et le masquage comparent départ **et** durée (AR7)
**And** UJ-6 se déroule de bout en bout : Incon passe la durée à « après-midi + soir », la liste des éphémérides se recalcule, il ajoute trois fenêtres montrées en plage et valide.
