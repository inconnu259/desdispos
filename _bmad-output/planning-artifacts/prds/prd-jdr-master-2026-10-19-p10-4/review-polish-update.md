# Revue éditoriale (structure + prose) — mise à jour du 2026-10-20 du PRD 10.4

- **Cible :** `prd.md` (7 555 mots), limitée aux passages ajoutés ou modifiés le 2026-10-20 (§0 « après l'architecture », §1, UJ-2, UJ-3, UJ-5, UJ-6, Glossaire, FR modifiées, §4.6, §4.7, §4.9, §4.10, §5, §6.1, SM-4, §8, §9).
- **Lentilles :** `structure`, puis `prose` (qui s'appuie sur la première).
- **Lecture du document :** ce PRD sert au PM et aux workflows suivants (UX, epics/stories) à savoir précisément ce que le Palier 10.4 change et comment le vérifier.
- **Modèle de structure retenu :** Référence (schéma constant par FR : énoncé, « Réalise UJ-n », conséquences testables), avec un en-tête Pyramide pour §0–§1.
- **Lecteur :** humains (réglage par défaut). Guide de style : Microsoft Writing Style Guide, adapté au français du document.
- Le fond n'est jamais contesté ; aucune proposition ne réintroduit de technique. Le vocabulaire du Glossaire et les identifiants (FR-n, UJ-n, SM-n, PL-1) sont conservés.

Choix de style à préserver : le présent de l'indicatif pour les exigences ; « le composer » employé comme nom ; « touche » dans les parcours sur mobile et « clique » ailleurs ; la majuscule de « Destinée » pour le mode ; les incises en italique qui datent les décisions.

---

## Lentille structure (11 propositions)

### S1. Glossaire (§3) — ordre des entrées · MOVE

- **Texte actuel :** dans l'ordre actuel, « Calendrier personnel » vient après « Atelier » et « Journée JDR », alors qu'« Atelier » le cite (« par opposition au calendrier personnel ») ; « Meilleur créneau » et « Journée JDR » sont placés entre « Atelier » et « Calendrier personnel », loin de « Créneau candidat », « Durée du rendez-vous » et « Plage ».
- **Texte proposé :** regrouper sans rien réécrire :
  1. créneaux : « Créneau candidat », « Durée du rendez-vous », « Plage », « Journée JDR », « Meilleur créneau » ;
  2. calendriers : « Calendrier personnel », « Calendrier de partie », « Calendrier du groupe », « Atelier ».
- **Raison :** chaque terme est alors défini avant d'être cité, et les nouveaux termes sur la durée sont lus ensemble. Effet sur le nombre de mots : 0.

### S2. §1 Vision — paragraphe sur les plages · MOVE

- **Texte actuel :** « Et un rendez-vous ne tient pas toujours dans une soirée. […] un rendez-vous qui dure plusieurs créneaux. », placé avant « Le Palier 10 a livré le vote de conjonction […] ».
- **Texte proposé :** déplacer ce paragraphe à la fin de §1, après « Le Palier 10 a livré […] avant que la bande d'amis ne s'en serve pour de bon. »
- **Raison :** le paragraphe « Le Palier 10 a livré » clôt le récit du sondage (gêne → solution). Le paragraphe sur les plages ouvre un second sujet et le coupe en deux. Effet sur le nombre de mots : 0.

### S3. §0, « Mise à jour du 2026-10-20, après l'architecture » — liste des passages touchés · QUESTION

- **Texte actuel :** « (UJ-2, FR-5, FR-8, FR-10, FR-12) »
- **Texte proposé :** soit compléter la liste avec les autres passages modifiés le même jour (UJ-3, UJ-5, UJ-6, FR-2, FR-6, FR-7, FR-11, FR-13, FR-14, FR-15, §4.6, §4.7, §5), soit ajouter à la fin du paragraphe « ; détail des passages touchés dans `.memlog.md` ».
- **Raison :** le paragraphe se présente comme un résumé des changements, mais il en oublie plusieurs : vue d'entrée en Destinée (FR-13), votes de groupe sur la grille du calendrier personnel (FR-7), retrait du panneau Story 8.7 (FR-14), éléments non filtrés (FR-15). Un lecteur qui s'y fie manque ces changements. Effet : environ +20 mots, ou +8 avec le renvoi.

### S4. §4.6 — deux puces qui couvrent FR-20 · MERGE

- **Texte actuel :**
  - « - Grille, Agenda, rail, plateau, tiroir, fiche de scénario, fenêtre de l'événement : une plage s'affiche sur tous ses jours (FR-20). »
  - « - Confirmation « Fixer la date… » et liste du vote de la fiche de scénario : une option longue y apparaît avec sa plage. »
- **Texte proposé :** « - Grille, Agenda, rail, plateau, tiroir, fenêtre de l'événement : une plage s'affiche sur tous ses jours ; fiche de scénario (y compris la liste du vote) et confirmation « Fixer la date… » : un créneau de plusieurs créneaux y apparaît avec sa plage (FR-20). »
- **Raison :** les deux puces décrivent le même écart (FR-20), et la fiche de scénario apparaît dans l'une comme dans l'autre. Les fusionner donne une seule source à l'UX. Effet : environ −6 mots.

### S5. §4.6 — deux puces sur les e-mails · MERGE

- **Texte actuel :**
  - « - E-mail de relance du vote : destination du lien. »
  - « - E-mails « date fixée », relance du vote et rappels de séance : la date devient une plage quand elle en est une. »
- **Texte proposé :** « - E-mails « date fixée », relance du vote et rappels de séance : la date devient une plage quand elle en est une ; dans la relance du vote, le lien change aussi de destination (FR-14). »
- **Raison :** la relance du vote est listée deux fois, à six puces d'écart. Effet : environ −4 mots.

### S6. §4.6 — écarts absents de la liste · QUESTION

- **Texte actuel :** aucune puce §4.6 pour l'extension du repli aux autres calendriers (FR-4 : « Le même repli vaut pour la colonne de droite des trois calendriers ; entrer en Destinée la rouvre. ») ni pour la vue imposée à l'entrée en Destinée (FR-13 : « affiche la vue Mois (Semaine en mode soirée), même si l'Agenda est la vue habituelle »).
- **Texte proposé :**
  - nouvelle puce : « - Colonne de droite des calendriers personnel et du groupe : repliable en dock, comme celle du MJ (FR-4). »
  - puce Destinée complétée : « - Mode Destinée (Story 36.9) : liste des destinées, plateau, sens des flèches ‹ n/N ›, fixation de la date, vue et créneau d'entrée (FR-13). »
- **Raison :** §0 annonce que « Chaque modification est listée en §4.6 ». Ces deux changements touchent des écrans validés et n'y figurent pas. La règle d'avertissement ⚠️ de la planche UX repose sur cette liste. Effet : environ +18 mots.

### S7. §4.6 et §4.7 placées entre FR-16 et FR-17 · QUESTION (MOVE)

- **Texte actuel :** l'ordre est « ### 4.5 Vocabulaire » → « ### 4.6 Écrans validés modifiés ⚠️ » → « ### 4.7 Exigences transverses » → « ### 4.8 Formulaire de création » → « ### 4.9 Échéance du vote » → « ### 4.10 Plages longues (PL-1) ».
- **Texte proposé :** placer §4.6 et §4.7 après §4.10, puisqu'elles récapitulent toutes les fonctions, y compris FR-17 à FR-23. Cela demande de renuméroter (4.8→4.6, 4.9→4.7, 4.10→4.8, 4.6→4.9, 4.7→4.10) et de mettre à jour les renvois « §4.6 » (§0, §4.7), « §4.9 » (§0) et « §4.10 » (§0, Glossaire, FR-11). Si la stabilité des numéros prime (renvois depuis l'UX et l'architecture), garder l'ordre actuel.
- **Raison :** les deux synthèses arrivent avant trois des cinq blocs qu'elles résument. Le lecteur les lit sans connaître FR-18 à FR-23, qu'elles citent pourtant. Effet : 0 mot. Contrepartie : les renvois externes changent.

### S8. FR-11 — deux puces sur la prolongation, séparées · MOVE + MERGE

- **Texte actuel :**
  - « - En JDR, il n'y a pas de bouton « Prolonger » : le MJ repousse l'échéance en modifiant le sondage (FR-18), y compris après l'échéance. » (2e puce)
  - « - Là où le chemin existant le permet (mode soirée, Story 40.7), l'organisateur peut aussi prolonger le vote depuis le plateau. » (4e puce)
- **Texte proposé (une seule puce, à la place de la 4e) :** « - Prolonger le vote : en mode soirée, l'organisateur le peut depuis le plateau, comme le permet le chemin existant (Story 40.7) ; en JDR, il n'y a pas de bouton « Prolonger » : le MJ repousse l'échéance en modifiant le sondage (FR-18), y compris après l'échéance. »
- **Raison :** la règle sur la prolongation est coupée en deux par la puce « Confirmer », et sa version JDR précède la règle générale qu'elle nuance. Effet : environ −4 mots.

### S9. §4.9 et §4.10 — étiquette de schéma absente · CONDENSE (schéma)

- **Texte actuel :** dans §4.1 à §4.4, la description est suivie de « **Functional Requirements :** » ; dans §4.9 et §4.10 (comme dans §4.8), l'étiquette manque entre la description et « #### FR-18 » / « #### FR-19 ».
- **Texte proposé :** ajouter « **Functional Requirements :** » après la description de §4.9 et de §4.10 (et, par cohérence, de §4.8).
- **Raison :** un document de référence repose sur un schéma constant, et les nouvelles sections s'en écartent. Effet : +4 mots.

### S10. FR-10 et FR-12 — ligne « Réalise UJ-n » absente · QUESTION

- **Texte actuel :** « L'organisateur du sondage peut, depuis la Destinée, modifier les créneaux candidats de la destinée active ou créer un nouveau sondage. » et « La Destinée se termine proprement quand son sondage devient clos. » : aucune des deux ne se termine par « Réalise UJ-n. ».
- **Texte proposé :** si un parcours s'en rapproche, ajouter « Réalise UJ-5. » à FR-10 (l'edge case d'UJ-5 modifie la durée d'un sondage existant) et « Réalise UJ-3. » à FR-12 (l'edge case d'UJ-3 porte sur un vote clos). Sinon, ajouter « Aucun parcours dédié. »
- **Raison :** toutes les autres FR modifiées ce jour indiquent leur parcours. L'absence ici se lit comme un oubli plutôt que comme un choix. Effet : +3 mots.

### S11. §8 — phrase sur les questions déjà tranchées · CUT (avec contrepartie)

- **Texte actuel :** « *Le stockage du masquage et de l'état replié a été tranché en architecture le 2026-10-20 : masquage sur le serveur (FR-3), repli dans le navigateur (FR-4).* »
- **Texte proposé :** supprimer la phrase.
- **Raison :** FR-3 et FR-4 portent déjà ces décisions, datées. Dans « Open Questions », une décision prise allonge la section sans ouvrir de question. Contrepartie : on perd la trace, visible dans le PRD, d'une question fermée (elle reste dans `.memlog.md`). Effet : −30 mots.

*PRESERVE :* la 2e puce de FR-22 (« Une fenêtre ne s'ajoute qu'à un sondage de même durée (FR-2). ») reprend une règle de FR-2. C'est un renvoi utile à qui lit FR-22 seul : à garder.

---

## Lentille prose (24 propositions)

### P1. §0 et §1 — « calendrier de la partie » (terme ambigu)

- **§0, texte actuel :** « mais un sondage se compose dans le calendrier de la partie, vers lequel il aiguille »
- **§0, texte proposé :** « mais un sondage se compose dans le calendrier de sa partie ou de son groupe (l'atelier, §3), vers lequel le calendrier personnel aiguille »
- **§1, texte actuel :** « et sélectionne des jours comme il déclare ses dispos, dans le calendrier de la partie. »
- **§1, texte proposé :** « puis, dans le calendrier de sa partie ou de son groupe, sélectionne des jours comme il déclare ses dispos. »
- **Raison :** dans ce PRD, « calendrier de partie » est un terme du Glossaire réservé au JDR. Or le composer existe aussi dans le calendrier du groupe (FR-5), ce que l'expression laisse de côté. En §0, « il » peut renvoyer au sondage comme au calendrier personnel. En §1, le complément de lieu placé en fin de phrase semble se rattacher aux dispos.

### P2. §0 et §4.10 (titre) — « PL-1 » non expliqué

- **Texte actuel :** « (PL-1, FR-19 à FR-23, §4.10) » et « ### 4.10 Plages longues (PL-1) »
- **Texte proposé :** « (lot PL-1, FR-19 à FR-23, §4.10) » et « ### 4.10 Plages longues (lot PL-1) »
- **Raison :** l'identifiant n'est défini nulle part dans le PRD. `addendum.md` en fait un nom de lot. Un seul mot suffit à le dire, et l'identifiant reste inchangé.

### P3. §1 — succession d'incises

- **Texte actuel :** « un week-end entre amis, du vendredi soir au dimanche après-midi, pour jouer, est l'une des raisons d'être du projet. »
- **Texte proposé :** « un week-end de jeu entre amis, du vendredi soir au dimanche après-midi, est l'une des raisons d'être du projet. »
- **Raison :** avec trois incises de suite, on retrouve mal le verbe. « De jeu » garde le sens de « pour jouer ».

### P4. UJ-2 — tournure elliptique

- **Texte actuel :** « choisit « soir », puis un samedi, « après-midi » ; »
- **Texte proposé :** « choisit « soir », puis sélectionne un samedi et choisit « après-midi » ; »
- **Raison :** l'ellipse cache le geste (sélectionner d'abord, puis choisir le moment, FR-6), que ce parcours sert justement à montrer.

### P5. UJ-2 — nom du calendrier ouvert

- **Texte actuel :** « Le calendrier de sa soirée s'ouvre, composer déjà prêt pour ce rendez-vous. »
- **Texte proposé :** Consider : « Le calendrier de sa soirée (calendrier du groupe) s'ouvre, composer déjà prêt pour ce rendez-vous. » ?
- **Raison :** FR-5 parle de « l'atelier (calendrier de sa partie ou de son groupe) ». Nommer le terme du Glossaire relie le parcours à l'exigence.

### P6. UJ-5 — antécédent de « qui »

- **Texte actuel :** « le week-end apparaît dans le calendrier de chacun, qui est désormais occupé du vendredi soir au dimanche après-midi ; »
- **Texte proposé :** « le week-end apparaît dans le calendrier de chacun, et chacun est désormais occupé du vendredi soir au dimanche après-midi ; »
- **Raison :** « qui » peut renvoyer au calendrier comme à « chacun ». C'est la personne qui est occupée (FR-21).

### P7. UJ-5 — départ de la plage non dit

- **Texte actuel :** « il touche trois vendredis de novembre. »
- **Texte proposé :** Consider : « il touche trois vendredis soir de novembre. » ?
- **Raison :** d'après FR-19, chaque créneau sélectionné est le départ, quel que soit son moment. Préciser « soir » rend le parcours cohérent avec la durée annoncée.

### P8. UJ-5 — « le deuxième » sans nom

- **Texte actuel :** « Incon fixe le deuxième : »
- **Texte proposé :** « Incon fixe le deuxième week-end : »
- **Raison :** le dernier nom masculin avant ce mot est « un soir ». Le référent n'est donc pas évident.

### P9. Glossaire, « Rendez-vous à dater » — terme et forme

- **Texte actuel :** « Un vote fermé sans date ne rend pas la séance à nouveau datable (contournement existant : remettre la séance sans date). »
- **Texte proposé :** « Un vote fermé sans date ne rend pas le rendez-vous à nouveau à dater (contournement existant, en JDR : remettre la séance sans date). »
- **Raison :** l'entrée définit « rendez-vous » mais passe à « séance » (mot propre au JDR), et elle emploie « datable » au lieu du terme défini, « à dater ». Consider pour « en JDR » : à retirer si le contournement vaut aussi en mode soirée.

### P10. Glossaire, « Créneau candidat » — antécédent de « il »

- **Texte actuel :** « Si le rendez-vous dure plusieurs créneaux, il couvre une plage qui commence à ce départ. »
- **Texte proposé :** « Si le rendez-vous dure plusieurs créneaux, le créneau candidat couvre une plage qui commence à ce départ. »
- **Raison :** « il » renvoie d'abord au rendez-vous, alors que c'est le créneau candidat qui couvre la plage.

### P11. Glossaire, « Journée JDR » — « expression des parcours »

- **Texte actuel :** « expression des parcours pour un rendez-vous de JDR « après-midi + soir » (deux créneaux) ; »
- **Texte proposé :** « expression employée dans les parcours (UJ-6) pour un rendez-vous de JDR « après-midi + soir » (deux créneaux) ; »
- **Raison :** « expression des parcours » est elliptique. Le renvoi indique où le terme est employé.

### P12. FR-2 — « versée »

- **Texte actuel :** « elle n'est pas versée : le composer s'ouvre sans elle, la liste de l'automate se recalcule à la bonne durée, et un message le dit. »
- **Texte proposé :** « elle n'est pas ajoutée : le composer s'ouvre sans elle, la liste de l'automate se recalcule à la bonne durée, et un message l'explique. »
- **Raison :** l'action s'appelle « Ajouter au vote », et « versée » n'apparaît nulle part ailleurs. « Le dit » n'a pas d'antécédent clair.

### P13. FR-4 — pronom « la »

- **Texte actuel :** « entrer en Destinée la rouvre. »
- **Texte proposé :** « entrer en Destinée rouvre la colonne. »
- **Raison :** le nom féminin le plus proche est « la colonne de droite des trois calendriers ». « La » se lit pourtant aussi comme « la liste » (titre de FR-4).

### P14. FR-8 — « les autres »

- **Texte actuel :** « les autres en voient le nombre. »
- **Texte proposé :** « les autres participants en voient le nombre. »
- **Raison :** « les autres » peut désigner ceux qui n'ont pas répondu, qui viennent d'être cités.

### P15. FR-11 — phrase de confirmation surchargée

- **Texte actuel :** « la confirmation liste les créneaux candidats (avec leur plage, §4.10), le meilleur créneau (§3) en tête et présélectionné, avec leurs comptes ; sans meilleur créneau, rien n'est présélectionné. »
- **Texte proposé :** « la confirmation liste les créneaux candidats avec leurs comptes (et leur plage, §4.10), le meilleur créneau (§3) en tête et présélectionné ; sans meilleur créneau, rien n'est présélectionné. »
- **Raison :** « avec leurs comptes », séparé de « créneaux candidats » par deux incises, semble se rapporter au seul meilleur créneau.

### P16. §4.6, §6.1 — « Créer un sondage » lu comme un libellé

- **§4.6, texte actuel :** « - Calendriers personnel, de partie et du groupe : bouton « Créer un sondage » et liste des rendez-vous à dater. »
- **§4.6, texte proposé :** « - Calendriers personnel, de partie et du groupe : bouton « Proposer des dates » (action « Créer un sondage », FR-5) et liste des rendez-vous à dater. »
- **§6.1, texte actuel :** « Bouton « Créer un sondage » dans les trois calendriers »
- **§6.1, texte proposé :** « Bouton « Proposer des dates » (action « Créer un sondage ») dans les trois calendriers »
- **Raison :** depuis l'UX, le libellé d'interface est « Proposer des dates » (FR-5). §4.6 sert de liste des écarts pour la planche UX, et ce passage risque d'y faire inscrire l'ancien libellé.

### P17. §4.6 et FR-20 — « option longue », « date fixée longue »

- **§4.6, texte actuel :** « une option longue y apparaît avec sa plage. » (passage fusionné en S4 : appliquer la correction au texte fusionné)
- **FR-20, texte actuel :** « Une date fixée longue s'affiche en plage partout où une date fixée s'affiche »
- **FR-20, texte proposé :** « Une date fixée de plusieurs créneaux s'affiche en plage partout où une date fixée s'affiche »
- **Raison :** « option » et « longue » ne figurent pas au Glossaire. L'énoncé de FR-20 et FR-21 dit « de plusieurs créneaux ».

### P18. §4.9 — accord du pronom

- **Texte actuel :** « Une échéance raisonnable est proposée : s'il lui convient, il valide sans y toucher. »
- **Texte proposé :** « Une échéance raisonnable est proposée : si elle lui convient, il valide sans y toucher. »
- **Raison :** le sujet est « échéance », un nom féminin. Erreur d'accord.

### P19. FR-18 — « la plus proche »

- **Texte actuel :** « préremplie avec la plus proche de ces deux dates : dans 14 jours, ou la veille du premier créneau candidat ; »
- **Texte proposé :** « préremplie avec la plus tôt de ces deux dates : dans 14 jours, ou la veille du premier créneau candidat ; »
- **Raison :** on peut se demander « proche » de quoi. « La plus tôt » ne laisse pas de doute sur la date retenue.

### P20. FR-18 — « relance du vote de la veille »

- **Texte actuel :** « En mode soirée, la changer réarme la relance du vote de la veille, comme « Prolonger » ; »
- **Texte proposé :** « En mode soirée, la changer réarme la relance envoyée la veille de l'échéance, comme le fait « Prolonger » ; »
- **Raison :** on lit « le vote de la veille » au lieu de « la relance envoyée la veille ».

### P21. §4.10 — « ne doit pas avoir à le dire »

- **Texte actuel :** « L'organisateur le sait dès la création, mais ne doit pas avoir à le dire : la durée est facultative. »
- **Texte proposé :** « L'organisateur le sait dès la création, mais n'est pas obligé de la déclarer : la durée est facultative. »
- **Raison :** les deux « le » renvoient à des choses différentes, et « ne doit pas avoir à » se lit comme une interdiction. FR-23 emploie « sans y être obligé ».

### P22. FR-19 — répétition « changer… change »

- **Texte actuel :** « la changer change la durée du rendez-vous. »
- **Texte proposé :** Consider : « la modifier ici modifie celle du rendez-vous lui-même. » ?
- **Raison :** la répétition gêne la lecture. La règle à faire ressortir est qu'il n'y a qu'une seule valeur, propre au rendez-vous.

### P23. FR-22 et FR-23 — tournures temporelles vagues

- **FR-22, texte actuel :** « classées comme aujourd'hui sur toute la plage ; »
- **FR-22, texte proposé :** Consider : « classées selon les critères actuels, appliqués à toute la plage ; » ?
- **FR-23, texte actuel :** « après la date fixée, dans la fenêtre de l'événement ou l'éditeur de séance, »
- **FR-23, texte proposé :** « une fois la date fixée, dans la fenêtre de l'événement ou l'éditeur de séance, »
- **Raison :** « comme aujourd'hui » se lit comme le jour courant. « Après la date fixée » peut se comprendre comme « une fois la date passée ».

### P24. §7 SM-4 — une UJ ne valide pas une FR

- **Texte actuel :** « FR-22 est validé par UJ-6. »
- **Texte proposé :** « FR-22 n'a pas de métrique propre : UJ-6 en est le parcours de vérification. »
- **Raison :** dans ce PRD, c'est une métrique qui « valide » une FR. Telle quelle, la phrase met un parcours à la place d'une métrique.

---

## Synthèse

- **Propositions :** 11 en structure (dont 4 QUESTION), 24 en prose, plus 1 PRESERVE.
- **Effet si tout est accepté :** environ −44 mots retirés (S4, S5, S8, S11) contre environ +45 à +55 ajoutés (S3, S6, S9, S10, P2, P16). La longueur reste donc à peu près la même, ±0,1 % de 7 555 mots. Ces propositions portent sur la clarté, pas sur la longueur, et aucune longueur cible n'était fixée.
- **Contreparties :** S7 (déplacer §4.6 et §4.7) modifie des numéros de section cités ailleurs. S11 retire du PRD la trace d'une question fermée.
