# Réconciliation — mise à jour UX 10.4 (après architecture) ↔ PRD final ↔ spine AD-1 à AD-17

Date : 2026-10-20. Entrées : `EXPERIENCE.md`, `DESIGN.md`, `.memlog.md`, `mockups/options-plages-longues.html` (1A, 2A retenues) ; PRD `prd-jdr-master-2026-10-19-p10-4/prd.md` (FR-1 à FR-23) ; spine `architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md`.

**Verdict :** l'essentiel de la mise à jour est reporté (atelier / vitrine, plateau anonyme, échéance, durée 1A, bandes 2A, dock), mais il reste quatre trous de comportement (cible de « Ajouter au vote », « Créer » depuis la Destinée, plages qui se chevauchent, message de fin d'UJ-4) et plusieurs libellés sans voix.

**Compte :** 4 high · 9 medium · 13 low (26 écarts).

Chaque écart : source · ce qui manque ou diverge · gravité · correctif (texte proposé).

---

## High

### H1 — UJ-4 se termine sur le message de l'atelier, dans la vitrine
- **Source :** PRD FR-12 ; spine AD-6 (« dans la vitrine … message neutre unique ») ; EXPERIENCE §8 n° 4.
- **Écart :** le flux UJ-4 se déroule dans le calendrier personnel et finit sur « Ce vote est clos », alors que la vitrine n'a qu'un message neutre (§3.1 et §5.1 le disent bien ; le flux les contredit).
- **Correctif :** EXPERIENCE §8 n° 4, remplacer la fin du climax par : « … confirmation, la date apparaît sur la grille, le mode se ferme sur « Ce vote n'est plus ouvert. » ».

### H2 — « Ajouter au vote » : cible du composer et rendez-vous composables absents
- **Source :** PRD FR-2 (« vise la destinée active si … ; sinon … une séance qui a déjà un sondage ouvert (prérempli) ou une séance à dater ») ; spine AD-3 (`isComposableSeance`), AD-16 (« le composer vise le sondage de la destinée active s'il est composable »).
- **Écart :** EXPERIENCE §2.2 n° 3 et §2.3 ne décrivent que le choix parmi les rendez-vous **à dater**. Rien ne dit que, depuis une fenêtre de l'automate, le composer vise d'abord la destinée active, ni que le choix propose aussi les séances qui ont déjà un vote ouvert (composer prérempli). §3.3 n'a pas de ligne de nature pour ce cas.
- **Correctif :** ajouter à §2.2 n° 3 : « « Ajouter au vote » verse la fenêtre dans le vote de la destinée active si l'on peut le modifier ; sinon il ouvre le choix du rendez-vous, qui liste les séances sans date **et** celles dont le vote est ouvert (composer prérempli de ses dates) » ; et à §3.3 : « séance au vote ouvert » (JDR).

### H3 — FR-10 « Créer » depuis la Destinée : aucun chemin, et une hypothèse fausse
- **Source :** PRD FR-10 (« « Créer » suit le même chemin que FR-5 … le nouveau sondage devient la destinée active ») ; EXPERIENCE §5.2 ligne « Les deux ».
- **Écart :** quand une destinée de l'organisateur est active, le bouton devient « Modifier les dates » ; §5.2 suppose que « proposer reste possible depuis la liste des destinées », or cette liste ne contient que des sondages ouverts, pas de rendez-vous à dater. Le plateau (§2.5, DESIGN §7.1) n'offre pas non plus « Créer ». Il faut quitter la Destinée pour proposer.
- **Correctif :** §5.2 ligne « Les deux » et §2.5 « Actions de l'organisateur » : « « Modifier les dates » dans la ligne de contrôles ; sous les actions du plateau, un lien texte « Proposer des dates pour un autre rendez-vous » ouvre le choix du rendez-vous (FR-5) ; le nouveau vote devient la destinée active. »

### H4 — Plages qui se chevauchent : rendu et geste non définis
- **Source :** PRD FR-19 (chaque créneau sélectionné est un départ, « quel que soit son moment »), FR-20, FR-6 (« un tap court ajoute ou retire un seul créneau ») ; spine AD-11 (aucun refus de chevauchement) ; EXPERIENCE §2.5 (« un votant … répond sur la grille »), §2.9, §6.
- **Écart :** deux créneaux candidats d'un même vote peuvent couvrir les mêmes bandes (départs vendredi soir et samedi matin, durée 6). Ni l'apparence d'une bande couverte par deux plages, ni la réponse au tap (vote sur la grille, ou retrait dans le composer quand on touche une bande non-départ) ne sont décrites. Le vote sur la grille étant le seul chemin du votant, le geste devient ambigu.
- **Correctif :** ajouter à §2.9 : « Une bande couverte par plusieurs créneaux candidats porte « ×2 » ; la toucher ouvre le sélecteur de réponse avec une ligne par plage (« ven. 6 soir → dim. 8 après-midi »), le créneau courant en tête » ; et à §6 Composition : « toucher une bande d'une plage déjà désignée la retire entière ; pour proposer un départ qui chevauche une plage désignée, passer par la sélection de jours ».

---

## Medium

### M1 — Liste de l'automate inaccessible pendant la Destinée
- **Source :** PRD FR-1, FR-2 ; spine AD-16 (« Fenêtre sélectionnée » l'emporte sur « Destinée active ») ; DESIGN §7.1 (le plateau remplace toute la colonne MJ, fenêtres comprises) ; EXPERIENCE §6 (« pendant une sélection, l'estompe de la fenêtre remplace celle de la Destinée »).
- **Écart :** l'UX décrit une sélection de fenêtre pendant la Destinée, mais le plateau a remplacé la liste : aucun accès décrit.
- **Correctif :** DESIGN §7.1 et EXPERIENCE §2.5 : « Dans la colonne MJ, le plateau garde en pied l'en-tête replié « Éphémérides · N » ; le déplier et toucher une carte suspend la Destinée, la désélection la rétablit. »

### M2 — Sélection d'une fenêtre pendant le composer
- **Source :** spine AD-16 (composer actif : colonne = liste de l'automate, estompe « aucune ; liseré du composer ») ; EXPERIENCE §6, DESIGN §7.3 (« tous les autres jours prennent l'estompe »).
- **Écart :** UJ-1 ajoute des cartes composer ouvert, mais l'UX applique toujours l'estompe à la sélection ; la règle « composer d'abord » n'est pas traduite.
- **Correctif :** EXPERIENCE §6 « Fenêtre de l'automate » : « Composer ouvert, toucher une carte l'entoure, sans estomper les autres jours ; « Ajouter au vote » la verse directement dans le composer. »

### M3 — Confirmation « Fixer la date… » et meilleur créneau
- **Source :** PRD FR-11 (liste des candidats avec comptes et plage, meilleur en tête et présélectionné, rien sans meilleur), §3 « Meilleur créneau » (aucun tant que personne n'a dit oui) ; spine AD-11, AD-13, AD-6 (`destinyEntryOption`).
- **Écart :** EXPERIENCE §6 ne fait que nommer les fenêtres (`SealConfirmDialog`, `DateFixDialog`) ; le contenu de la confirmation n'est pas décrit. L'absence d'étiquette « meilleur » sans oui (§2.5) et le créneau d'entrée après l'échéance quand il n'y a pas de meilleur (§2.4) ne sont pas décrits non plus.
- **Correctif :** §6 : « « Fixer la date… » ouvre une confirmation qui liste les créneaux candidats (plage comprise) avec leurs oui, le meilleur en tête et présélectionné ; sans aucun oui, rien n'est présélectionné et l'étiquette « meilleur » n'apparaît nulle part ; après l'échéance sans meilleur, la Destinée s'ouvre sur le premier créneau candidat. »

### M4 — Messages écrits sans voix par thème
- **Source :** PRD FR-12 (raison à l'atelier : date fixée, annulé…), FR-13 (sondage clos ou inexistant), FR-14 (rendez-vous plus à dater), FR-18 (date passée refusée, « avec la raison écrite ») ; spine AD-6 (raisons : date fixée, annulé, générique) ; EXPERIENCE §3.1, §5.4.
- **Écart :** §3.1 n'a que « date fixée ». Il manque l'annulation, le cas générique, le lien vers un vote clos ou inexistant, le lien vers un rendez-vous plus à dater et le refus d'une fin de vote passée.
- **Correctif :** ajouter à §3.1 (Grimoire / Forêt / Atelier) : « Ce vote est clos : le rendez-vous est annulé. / idem / Ce scrutin est clos : le rendez-vous est annulé. » ; « Ce vote est clos. / Ce vote est clos. / Ce scrutin est clos. » ; « Ce vote n'existe pas ou n'est plus ouvert. / idem / Ce scrutin n'existe pas ou est clos. » ; « Ce rendez-vous n'est plus à dater. / idem / Ce rendez-vous n'est plus à planifier. » ; « La fin du vote ne peut pas être passée. / idem / La clôture du scrutin ne peut pas être passée. »

### M5 — Prolonger en JDR : modifier après l'échéance
- **Source :** PRD FR-11 (pas de « Prolonger » en JDR : le MJ repousse l'échéance en modifiant le sondage, y compris après l'échéance), FR-18 (en modification, l'échéance actuelle ; date passée refusée) ; spine AD-17.
- **Écart :** §5.1 « Actif, échéance passée » ne liste pour l'organisateur que « Fixer la date… » et « Prolonger (soirée) » : « Modifier les dates » manque. Rien ne dit ce que montre « Fin du vote » quand l'échéance actuelle est passée, ni comment le MJ comprend que modifier les dates prolonge le vote.
- **Correctif :** §5.1 : ajouter « Modifier les dates » ; §2.8 : « En modification après l'échéance, « Fin du vote » montre la date passée, marquée « passée », et Valider reste bloqué tant qu'elle n'est pas repoussée ; en JDR, le plateau échu dit « Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. » ».

### M6 — Durée corrigée hors du composer : avertissement et départ connu
- **Source :** PRD FR-23 (correction « avant la date, dans le composer ou la fenêtre de l'événement » ; durée à la création d'un rendez-vous « daté d'emblée »), FR-19 (perte des réponses après avertissement) ; spine AD-10.
- **Écart :** §2.10 ne cite que le composer avant la date, sans dire qu'en soirée, changer la durée dans la fenêtre d'un événement dont le vote a des réponses efface ces réponses. Il affirme aussi que « le départ n'est pas encore connu », ce qui est faux pour un rendez-vous daté d'emblée.
- **Correctif :** §2.10 : « Dans la fenêtre de l'événement, changer la durée d'un vote qui a des réponses ouvre le même avertissement (« Changer la durée efface les {n} réponses déjà données. ») ; si la date est déjà saisie, le compteur écrit la plage en clair (« sam. 14 après-midi → sam. 14 soir »), sinon la traduction en jours. »

### M7 — Plage coupée par une fin de semaine ou de mois
- **Source :** PRD FR-20 (le départ et la fin se voient dans chaque vue) ; spine AD-14 (« une séance du 31 au 1ᵉʳ absente du mois suivant ») ; EXPERIENCE §2.9, DESIGN §7.8 (nom « sur la première bande seulement »).
- **Écart :** une plage qui passe du dimanche au lundi change de ligne, et une plage qui commence le mois précédent n'a pas sa première bande à l'écran : le nom disparaît, et le raccord entre deux lignes n'est pas décrit.
- **Correctif :** DESIGN §7.8 : « Le nom s'écrit sur la première bande **visible** de chaque ligne de semaine et de chaque mois, précédé de « ← » si la plage a commencé avant ; le raccord sort par le bord droit du dimanche et entre par le bord gauche du lundi. »

### M8 — Choix du rendez-vous : trois descriptions incompatibles
- **Source :** PRD FR-5 (depuis la vitrine, choisir **ouvre l'atelier**) ; spine AD-5 ; EXPERIENCE §4 `RendezvousPicker` (« toucher la ligne arme le composer »), §9 et DESIGN §4 (menu ancré ≥ 1024 px), DESIGN yaml `rendezvous-picker.desktop` (fenêtre « Votre accord » en boutons radio).
- **Écart :** dans la vitrine, la ligne n'arme pas de composer ; et sur ordinateur, on a à la fois un menu ancré (toucher = choisir) et une fenêtre à boutons radio (choisir puis confirmer).
- **Correctif :** EXPERIENCE §4 : « Toucher la ligne arme le composer (atelier) ou ouvre l'atelier du rendez-vous, composer armé (vitrine) » ; aligner DESIGN yaml et §7.5 sur §9 : « ≥ 1024 px : menu ancré, une ligne = un choix, sans bouton de confirmation ».

### M9 — DESIGN §7.1 montre les noms des absents à tous, à l'atelier
- **Source :** PRD FR-8 (noms à l'organisateur seulement, nombre pour les autres) ; spine AD-6 ; EXPERIENCE §2.5 (correct).
- **Écart :** DESIGN §7.1 « Déplié / colonne » place la ligne « N'ont pas … » (noms) sans la restreindre à l'organisateur ; seul le cas de la vitrine est corrigé.
- **Correctif :** DESIGN §7.1 : « ligne « N'ont pas … » (noms) pour l'organisateur seulement ; « {n} n'ont pas encore répondu » pour les autres participants, et partout dans la vitrine. »

---

## Low

### L1 — Vue d'entrée « Semaine pour un groupe »
- **Source :** PRD FR-13 (« Semaine en mode soirée ») ; spine AD-6 (famille `ralliement`) ; EXPERIENCE §6 « Lien direct », §9.
- **Écart :** « pour un groupe » oublie la soirée isolée, et une Destinée de soirée ouverte depuis la vitrine.
- **Correctif :** §6 et §9 : remplacer « Semaine pour un groupe » par « Semaine pour un vote du mode soirée (groupe ou soirée isolée), y compris dans le calendrier personnel ».

### L2 — Filtre par partie : rail et couche des votes
- **Source :** spine AD-9 (rail non filtré ; « entrer en Destinée sur une partie décochée la recoche et allume la couche `votes-en-cours` ») ; EXPERIENCE §2.6.
- **Écart :** §2.6 ne dit pas que le rail échappe au filtre, ni qu'entrer en Destinée rallume « Votes en cours » si on l'avait éteint.
- **Correctif :** §2.6 : « … ni le rail de détail ; entrer en Destinée sur une partie décochée la recoche et rallume « Votes en cours » dans « Ce que je vois ». »

### L3 — Fenêtres : déplacement de la grille, sortie et retour dans la liste
- **Source :** PRD FR-1 (« le calendrier se déplace sur la période de la fenêtre »), FR-2 (une fenêtre quitte la liste si elle est créneau candidat de **n'importe quel** vote ouvert de la partie ; retirée d'un vote, elle revient) ; spine AD-7.
- **Écart :** §2.2, §5.3 et DESIGN §7.3 ne parlent que du composer, et n'évoquent pas le déplacement de la grille.
- **Correctif :** §5.3 : « Sélectionnée : la grille se place sur sa période. Une fenêtre déjà proposée dans un vote ouvert de la partie n'est pas listée ; retirée de ce vote, elle revient si elle est toujours libre. »

### L4 — Libellés nouveaux absents de §3.1 et de `NEUTRAL_KEYS`
- **Source :** PRD FR-16 (nouveaux libellés dans les trois thèmes) ; spine Conventions « Vocabulaire » ; EXPERIENCE §2.6, §4, §7.
- **Écart :** n'ont ni voix ni raison neutre : « Seulement », « Affichage filtré · {k} sur {n} », « Ranger la colonne » / « Rouvrir la colonne », « Raccourcir » / « Allonger », « Destinée : {nom} » (région), annonce « Créneau {n} sur {N}, … », « Échéance passée », « plus de vote possible », « {x} réponses sur {N} », libellé du dock d'une colonne joueur ou groupe.
- **Correctif :** §3.1 : ajouter ces lignes, par exemple filtre « Seulement ces rendez-vous / Seulement ceux-ci / Restreindre à », et ranger les libellés d'accessibilité et de mesure dans `NEUTRAL_KEYS`, raison « libellé d'accessibilité, volontairement hors thème ».

### L5 — Grimoire tutoie dans le plafond
- **Source :** EXPERIENCE §3.1 (Grimoire vouvoie : « Tous vos votes », « Vous ne votez pas ») ; ligne « Plafond ».
- **Écart :** Grimoire : « au-delà, crée deux rendez-vous » (tutoiement).
- **Correctif :** Grimoire : « 15 jours au plus : au-delà, créez deux rendez-vous. »

### L6 — Deux mots pour l'échéance
- **Source :** PRD FR-16 (« un mot, un sens », par analogie) ; EXPERIENCE §2.4, §2.5 (« Échéance {date} ») contre §2.8 (« Fin du vote »).
- **Écart :** dans un même thème, la liste et le plateau disent « Échéance », le composer « Fin du vote ».
- **Correctif :** §2.4, §2.5, DESIGN §7.1-7.2 : « Fin du vote {date} · N créneaux » ; après : « Vote terminé le {date} · plus de vote possible » (Atelier : « Clôture du scrutin {date} »).

### L7 — Nature du rendez-vous en mode soirée
- **Source :** PRD FR-5, §3 (seule une soirée isolée peut être à dater ; « conjonction » = libellé d'un événement de groupe) ; EXPERIENCE §3.3 ; DESIGN §7.5.
- **Écart :** §3.3 hésite entre « {conjonction | halte | réunion} sans date » et « soirée sans date » ; DESIGN §7.5 n'écrit que « soirée sans date » ; et « conjonction » désigne aussi l'événement de groupe.
- **Correctif :** §3.3 et DESIGN §7.5 : « Mode soirée : seule une soirée isolée peut figurer, ligne « soirée sans date » dans les trois thèmes ».

### L8 — Tiroir replié et annonce vocale sans plage
- **Source :** PRD FR-20 (tiroir et plateau montrent départ et fin) ; EXPERIENCE §2.5 (« n / N · {date} {moment} »), §7 (« Créneau 2 sur 5, samedi 18 octobre, soir, 4 oui ») ; DESIGN §7.1.
- **Écart :** les gabarits ne prévoient pas de plage.
- **Correctif :** §2.5 et §7 : « n / N · {départ} → {fin} · x oui » et « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui ».

### L9 — Occupé sur toute la plage, « passé » à la fin
- **Source :** PRD FR-21 ; spine AD-14.
- **Écart :** l'UX ne décrit pas l'indisponibilité d'une plage dans les autres calendriers, ni qu'une plage en cours reste à venir jusqu'à sa fin.
- **Correctif :** §2.9 : « Dans les autres calendriers, chaque créneau de la plage prend le marquage d'indisponibilité existant ; une plage commencée reste « à venir » (prochaine séance, liste des parties) jusqu'à sa fin. »

### L10 — Passages périmés
- **Source :** EXPERIENCE intro (« PRD FR-6, §8 Q1 »), §8 (« UJ-1 à UJ-4 »), §10 (pas d'écart pour le dock des colonnes personnelle et du groupe, PRD §4.6), §11 n° 5 (liste de FR du PRD) ; DESIGN intro (« quatre surfaces neuves … trois retouches »).
- **Écart :** les renvois et les décomptes datent d'avant la mise à jour.
- **Correctif :** « UJ-1 à UJ-6 » ; §10 ajouter « 17 | Colonne de droite des calendriers personnel et du groupe | rangeable en dock (›/‹) | FR-4 » ; §11 n° 5 : « PRD mis à jour le 2026-10-20 : FR-2, FR-4, FR-5, FR-7, FR-8, FR-10 à FR-15, FR-18 à FR-23 » ; retirer « §8 Q1 ».

### L11 — Temps réel des listes et du bouton
- **Source :** PRD §4.7 (liste des destinées, des rendez-vous à dater, de l'automate, plages en direct) ; spine AD-12.
- **Écart :** l'UX ne mentionne le direct que pour les comptes du plateau (§5.1).
- **Correctif :** §5 : « La liste des destinées, le choix du rendez-vous, la liste de l'automate, le bouton « Proposer des dates » et les plages suivent en direct les changements des autres ; un rendez-vous daté ailleurs pendant le composer : à la validation, le message « Ce rendez-vous n'est plus à dater. », composer fermé. »

### L12 — Annuler le composer arrivé de la vitrine
- **Source :** PRD FR-5 ; spine AD-5 (`?seanceId` retiré à l'annulation).
- **Écart :** §2.3 décrit l'après-validation depuis la vitrine, pas l'annulation.
- **Correctif :** §2.3 : « Annuler : on reste à l'atelier, calendrier normal (Destinée rétablie si elle était active) ; la flèche ← ramène au calendrier personnel. »

### L13 — Rendez-vous non datable après un vote clos sans date
- **Source :** PRD §3 « Rendez-vous à dater » ; spine Open Questions n° 2, Deferred.
- **Écart :** l'UX ne dit pas qu'une séance dont le vote a été clos sans date n'apparaît plus dans « Proposer des dates » ; l'organisateur peut chercher en vain.
- **Correctif :** §2.3 n° 1 : « Une séance dont le vote a été fermé sans date n'y figure pas ; la remettre sans date depuis sa fiche la rend de nouveau proposable. »
