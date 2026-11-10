---
title: Réconciliation du spine Palier 10 avec ses entrées (PRD, UX, journal)
spine: ../ARCHITECTURE-SPINE.md (updated 2026-10-09)
inputs:
  - prds/prd-jdr-master-2026-10-08/prd.md + addendum.md
  - ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md + DESIGN.md (+ mockups/emails-mode-soiree.md)
  - architecture-jdr-master-2026-10-08/.memlog.md
date: 2026-10-09
---

# Réconciliation du spine avec ses entrées

**Bilan.** Le spine reprend fidèlement les grandes décisions du journal (registre, Event/Scenario à id partagé, `ownerId`, `PermissionService`, rôles, réservations, annulation, masquage, suppression de compte, rappels par séance, porte). Les manques portent surtout sur : les **règles de cycle de vie** (retrait de membre, hôte disparu, statut d'un ralliement terminé, éligibilité au vote, règles « tant que pas passé »), la **projection selon le lecteur** (places réservées et non-répondants visibles de l'hôte seul), la **diffusion temps réel sur `user:{id}`**, et plusieurs **contradictions restées dans le PRD** (système vs mode, exceptions de FR-13, migration FR-14, préférences de notification inexistantes).

Gravité : **B** = bloquant pour découper les épics ; **I** = important (une story l'inventerait autrement) ; **M** = mineur.
Chaque écart : *Source* · *Écart* · *Conséquence* · *Correction proposée* (cible : **spine** ou **source**).

Quelques faits de code ont été vérifiés pour qualifier les écarts (cités avec leur fichier).

---

## 1. PRD (`prd.md` + `addendum.md`)

### P-1 — Contradiction : « un ralliement n'a pas de système » vs registre des systèmes — **I**
- **Source :** `prd.md` FR-1 (conséquence 2 : « une soirée ou un groupe n'a pas de système »), FR-3 (« ni scénario, ni personnage, ni système »), §3 Glossaire (« Mode », « Système de JDR … indépendant du mode ») ; `addendum.md` §2 (« un champ `mode` … distinct du `gameSystemId` (nullable hors JDR) ») et §5 (« le mode et le système sont deux axes distincts »).
- **Écart :** le spine (AD-2) fait de `ralliement` une **entrée du registre** (`gameSystemId = 'ralliement'`), dérive le mode de `family`, et interdit toute colonne de mode. Le journal (direction du 2026-10-09) révise explicitement la décision « deux axes ». Le PRD n'a pas été mis à jour ; il est même incohérent avec lui-même (FR-15 parle déjà de « chaque système (Ryuutama, ralliement…) »).
- **Conséquence :** un développeur ou le découpage en épics qui lit le PRD/l'addendum ajoutera une colonne `mode` ou rendra `gameSystemId` nullable — exactement ce qu'AD-2 veut empêcher.
- **Correction :** *source* — réécrire FR-1 c.2 et FR-3 en « aucun **système de JDR** n'est proposé » ; amender le glossaire ; marquer addendum §2 (champ `mode`, `gameSystemId` nullable, table de rôles séparée, `mjId` conservé) et §5 comme **remplacés par AD-2 / AD-5 / AD-7**. *Spine* — une phrase dans AD-2 : « le "pas de système" du PRD signifie "pas de système de JDR à l'écran" ; techniquement `gameSystemId = 'ralliement'`, non nul ».

### P-2 — Contradiction : exceptions de FR-13 « le JDR ne change pas » incomplètes — **B**
- **Source :** `prd.md` FR-13 (liste **fermée** de sept exceptions ; « la suite de tests existante passe sans modification de ses attentes ») ; §5 Non-Goals ; SM-2.
- **Écart :** le spine change le JDR sur des points absents de la liste :
  1. **Rappels par séance** (AD-12) : `Seance.reminderSentAt` remplace `Partie.reminderSentAt` pour toutes les familles. Le journal (Décision 10) dit en toutes lettres « EXCEPTION de plus à "le JDR ne change pas" → **à reporter dans FR-13 du PRD** » : non fait, et le spine ne la nomme pas comme exception.
  2. **Annulation** (AD-9) : `Event.cancelledAt` et `PartieStatus.ANNULEE` ne sont pas restreints à la famille `ralliement` ; la politique `jdr` (« le propriétaire seul organise ») laisserait un MJ annuler un one-shot — fonctionnalité JDR nouvelle, hors liste. Le PRD (FR-16) ne vise que soirée isolée et événement de groupe.
  3. **Contrat d'API** : `PartieDto.role` / `PartySignalsDto.role` élargis (AD-6), `mjId` renommé dans les DTO éventuels — sans effet visible, mais non annoncé.
- **Conséquence :** AD-16 pose comme condition de passage « attentes des tests existants inchangées », or les tests de `NotificationsService` qui vérifient `Partie.reminderSentAt` (cf. `apps/api/src/notifications/notifications.service.ts` l.47-77) **devront** changer. La porte est infranchissable telle qu'écrite, ou sera franchie en trichant.
- **Correction :** *source* — ajouter à FR-13 l'exception (8) « rappel de la veille porté par la séance (comportement visible identique) ». *Spine* — AD-16 : distinguer « attentes de **comportement** inchangées » de « fixtures / noms de champs mis à jour (`ownerId`, `reminderSentAt` sur la séance) » ; AD-9 : « l'annulation n'est offerte qu'à la famille `ralliement` dans ce palier » (ou ajouter l'exception au PRD).

### P-3 — Retrait d'un membre / quitter le groupe : aucune règle dans le spine — **B**
- **Source :** `prd.md` FR-6 (inscriptions et votes retirés des événements **à venir**, passés conservés ; places occupées ou réservées libérées ; événements à venir dont il est l'hôte **annulés** + e-mail ; quitter de soi-même) ; `mockups/emails-mode-soiree.md` e-mail 7 (« ou hôte retiré ») ; EXPERIENCE §2.4 (« Quitter le groupe », « Retirer »).
- **Écart :** le spine ne traite le départ d'un utilisateur que par la suppression de compte (AD-11). Rien sur `removeMember` / départ volontaire. Vérifié : `PartiesService.removeMember` ne supprime aujourd'hui que le `Membership` (l.348) — inscriptions et votes restent. L'action « quitter la partie » n'est pas dans l'union `PermissionAction`.
- **Conséquence :** un membre retiré garde sa place (capacité faussée), son vote compte encore, ses événements restent sans hôte actif ; chaque story inventera sa propre purge.
- **Correction :** *spine* — nouvel AD (ou extension d'AD-7/AD-9) : « Fin d'appartenance (retrait, départ, suppression de compte) = **une procédure** d'`EventsService`, en transaction : suppression des `Inscription` et `PollVote` sur les séances **non passées**, annulation (`cancelledAt`) des événements non passés dont il est l'hôte, e-mails #7 et `emit` après transaction ». Ajouter `leave` à l'union.

### P-4 — Hôte disparu : événement sans propriétaire — **I**
- **Source :** `prd.md` FR-6 (événements à venir de l'hôte annulés), FR-7 (« le groupe survit sans changement autre que la perte d'un admin »), FR-8 (un événement a exactement un hôte).
- **Écart :** AD-5 / AD-11 mettent `Event.ownerId` à `SetNull` et ne traitent que les groupes où le compte supprimé est **admin**. Un simple membre-hôte qui supprime son compte laisse des événements à venir **sans hôte** : personne ne peut plus modifier, lancer/prolonger le vote, fixer la date ni réserver (politique « propriétaire de l'événement pour l'événement »), seul un admin peut annuler. Le PRD est lui-même ambigu (FR-7 « sans changement » vs FR-6 « annulés »).
- **Conséquence :** événements zombies ; matrice de permission avec une cellule « hôte = null » non spécifiée.
- **Correction :** *spine* — AD-11 appelle la procédure de P-3 pour **chaque** partie de ralliement du compte (admin ou non) : événements non passés dont il est hôte annulés ; événements passés gardent `ownerId = null` (lecture seule). *Source* — aligner FR-7 sur FR-6.

### P-5 — Statut dérivé d'un ralliement (terminé / en cours) non défini — **B**
- **Source :** `prd.md` FR-2 (« une soirée isolée passée est marquée terminée et n'accepte plus de modification »), FR-17 (masquage réservé aux parties terminées ou annulées), FR-16.
- **Écart :** aujourd'hui `status = closedAt ? 'TERMINEE' : hasScenario ? 'EN_COURS' : 'A_VENIR'` (`apps/api/src/parties/parties.service.ts` l.121). Un ralliement n'a **pas** de `Scenario` : il serait toujours `A_VENIR`, et une rencontre isolée ne deviendrait jamais `TERMINEE` sans « Clore » manuel — donc jamais masquable (AD-10). AD-9 n'ajoute que `ANNULEE`.
- **Conséquence :** FR-2 et FR-17 inapplicables au ralliement ; la Phase des filtres et les signaux (`PARTIE_TERMINEE`) faux.
- **Correction :** *spine* — étendre AD-9 (ou P9-AD-8) : dérivation par famille/kind. Isolée : `ANNULEE` si son événement est annulé, sinon `TERMINEE` si `closedAt` **ou** si la fin de sa plage datée est passée, sinon `A_VENIR`/`EN_COURS` selon qu'une date est fixée ; groupe : `TERMINEE` par `closedAt` seul (cf. UX §11.7). Une seule fonction pure dans `@master-jdr/shared`.

### P-6 — Éligibilité au vote : règle absente, et utilisée à trois endroits — **B**
- **Source :** `prd.md` FR-11 (participation « tous » → tous les membres votent ; places limitées → seuls les inscrits ; inscription avant l'échéance → peut voter ; après échéance ou date fixée → plus de vote ; isolée → les invités), FR-2 (`[ASSUMPTION]` invité nominatif ne vote qu'après avoir accepté), FR-10 (nombre d'inscrits disponibles par créneau), FR-12 (relance « aux seuls ayants droit qui n'ont pas encore voté »).
- **Écart :** l'union d'AD-6 contient « lancer / prolonger / clore un vote » mais **pas « voter »** ; aucune règle d'éligibilité n'est posée. Or le même ensemble « ayants droit » sert à : refuser un vote, la relance d'AD-12, la case « N'ont pas encore répondu » de l'hôte (UX), et le décompte de FR-10.
- **Conséquence :** trois ou quatre calculs divergents de « qui peut voter » — précisément ce que P1-AD-3 / AD-6 interdisent.
- **Correction :** *spine* — AD-6 : ajouter l'action `vote` et une **fonction unique** `eligibleVoters(seanceId)` (dans `PermissionService` ou `EventsService`, appelée par le vote, la relance, le résumé). Statuer sur l'`[ASSUMPTION]` de FR-2 et sur `RESERVED` (une place réservée non acceptée vote-t-elle ?).

### P-7 — Représentation de la participation « tous / places limitées » et place de l'hôte — **I**
- **Source :** `prd.md` FR-9 ; EXPERIENCE §2.6 bis (stepper : « l'hôte en occupe une » ; réservations choisies dès la création).
- **Écart :** le spine ne dit pas comment la participation est stockée (la capacité `inscriptionMin/Max` existe, « réservée à l'épisodique »), ni que l'hôte a une `Inscription` `CONFIRMED` créée avec l'événement, ni que les réservations saisies à la création naissent dans la même transaction sous le verrou.
- **Conséquence :** une story ajoutera une colonne `participation` (doublon dérivable) ; l'hôte comptera ou non dans la capacité selon l'écran.
- **Correction :** *spine* — AD-8 : « `inscriptionMax = null` ⇔ participation "tous" ; aucune colonne » ; « créer un événement à places limitées = inscription `CONFIRMED` de l'hôte + `RESERVED` des invités, en une transaction, sous le verrou ; refus si réservations > N − 1 ».

### P-8 — Contradiction PRD / UX sur le cycle du sondage, que le spine ne tranche pas — **I**
- **Source :** `prd.md` FR-11 et UJ-2 (« l'hôte propose, les intéressés s'inscrivent, **puis** l'hôte lance le vote avec une échéance ») vs `prd.md` FR-8 c.6 et EXPERIENCE §2.6 bis (créneaux et « Le vote se termine le » choisis **dans le formulaire de création**, via le mode « composer » du calendrier).
- **Écart :** le spine (AD-4, AD-14) ne définit ni l'état « date par sondage, vote pas encore lancé », ni ce que « lancer le vote » crée, ni comment un `SessionPoll` composé dans le calendrier du groupe (`/parties/:id/guild-calendar`) se rattache à la `Seance` de l'événement (`Seance.pollId`). `SessionPoll` reste rattaché à la partie (`partieId`, `scenarioRef`).
- **Conséquence :** deux flux incompatibles (sondage créé avec l'événement vs plus tard) ; un sondage orphelin si la fenêtre est refermée.
- **Correction :** *source* — trancher entre PRD FR-11 et UX §2.6 bis. *Spine* — AD-4/AD-14 : « événement "date à voter" = séance sans `dateValidee` ; `lancer le vote` = création du `SessionPoll` lié à la séance par la route de séance existante ; `scenarioRef` = id de l'événement (valide puisque `Event.id = Scenario.id`) ».

### P-9 — Règles temporelles et d'état côté serveur manquantes — **I**
- **Source :** `prd.md` FR-8 c.3 et FR-16 (modifier / annuler « tant qu'il n'est pas passé »), FR-2 c.2 (isolée passée : plus de modification), FR-10 c.3 et FR-11 (date jamais rouverte ; inscriptions tardives possibles), FR-11 c.5 (« le vote a **toujours** une échéance », prolongeable tant que la date n'est pas fixée — capacité **nouvelle**), FR-16 c.1 (annulée : « sans plus aucune action possible »).
- **Écart :** AD-9 ne refuse sur un événement annulé que « inscription, réservation et vote » ; aucune règle « passé ⇒ lecture seule » ; aucune contrainte `expiresAt` obligatoire (le champ est nullable dans `SessionPoll`) ; la prolongation n'a ni route ni précondition (AD-12 ne parle que de remettre `relanceSentAt` à vide).
- **Conséquence :** un hôte pourra modifier un événement passé, prolonger un vote après fixation, ou créer un vote sans échéance que la relance ignorera.
- **Correction :** *spine* — AD-9 : « événement annulé **ou passé** : toute mutation refusée (sauf masquage) ; refus porté par `PermissionService` » ; AD-12 : « `expiresAt` obligatoire pour un vote de ralliement ; `prolonger` = route de séance, refusée si date fixée ou nouvelle échéance ≤ l'actuelle ; réouverture de date interdite ».

### P-10 — Politique choisie par la famille seule ; la rencontre isolée a ses propres règles — **I**
- **Source :** `prd.md` FR-13, note sous la matrice (« Soirée isolée : l'hôte (= créateur) est seul à agir ; les invités répondent, votent et se désinscrivent ») ; FR-2 (« inscription libre » hors périmètre) ; journal Décision 3 (« membres / **invités acceptés** participants »).
- **Écart :** AD-6 choisit la politique par `family` uniquement (« membres pour proposer et s'inscrire »). Appliquée à une isolée, un invité pourrait proposer un second événement (violant AD-3 « exactement un »), et l'hôte pourrait nommer d'autres admins.
- **Conséquence :** matrice de refus incomplète ; invariant d'AD-3 non protégé.
- **Correction :** *spine* — AD-6 : politique = f(`family`, `kind`) ; ralliement `ONE_SHOT` : seul l'hôte (admin unique) organise, pas de « proposer », pas de « nommer admin » ; la matrice de tests devient actions × rôles × familles × **kind**.

### P-11 — Invité en attente : voir la page avant d'avoir accepté — **I**
- **Source :** `prd.md` FR-2 c.4 (« Accepter / Décliner » **en tête de page** tant qu'il n'a pas répondu) ; EXPERIENCE §2.5, §6 ; e-mail #2 « Accepter ou décliner ».
- **Écart :** AD-8 dit « accepter crée le `Membership` » ; avant, l'invité n'est pas membre. Rien dans AD-6 ne lui accorde « voir » la page, et l'union des rôles (`mj|player|admin|member`) n'a pas d'état « invité en attente ».
- **Conséquence :** soit la page renvoie 403/404 à l'invité (UX impossible), soit une story ouvre la lecture hors du service de permission.
- **Correction :** *spine* — AD-6 : « le porteur d'une `Invitation` `PENDING` obtient `voir` (lecture restreinte : en-tête, date, lieu, hôte) et `répondre à l'invitation` ; rôle renvoyé `null` + indicateur d'invitation ». Ou, *source* : l'UX ramène l'acceptation dans la liste d'accueil.

### P-12 — Création d'une rencontre isolée : quand naît son unique événement ? — **I**
- **Source :** `prd.md` FR-2 c.5 (« après la création, la fenêtre de création de sa conjonction s'ouvre immédiatement ») ; EXPERIENCE §2.6 bis (a) ; journal (« ONE_SHOT crée AUTOMATIQUEMENT 1 Scenario + 1 Seance »).
- **Écart :** AD-3 pose « isolée = exactement un événement » sans dire si l'événement est créé avec la partie (comme le one-shot JDR) ou par la fenêtre (état transitoire à zéro événement ; que se passe-t-il sur « Renoncer » ?).
- **Conséquence :** invariant violé dès la création, ou partie orpheline sans événement.
- **Correction :** *spine* — AD-3 : « pour un ralliement `ONE_SHOT`, `Event` + `Seance` sont créés **avec** la partie (titre = nom) ; la fenêtre ouverte ensuite est une première **modification** ».

### P-13 — E-mails : déclencheurs et destinataires non fixés ; préférences inexistantes — **I**
- **Source :** `prd.md` FR-12 (sept e-mails ; « les préférences de notification existantes de l'utilisateur sont respectées ») ; `mockups/emails-mode-soiree.md` (destinataires par e-mail : #4 « inscrits / invités qui n'ont pas décliné », #5 « inscrits / invités acceptés », #7 « inscrits / invités ») ; FR-16 c.3.
- **Écart :**
  1. AD-12 dit que le rappel part « à ses inscrits / membres » : ambigu. Aujourd'hui le rappel part au **MJ + tous les `Membership`** (`notifications.service.ts` l.61). Si le rappel par séance part aux seuls inscrits d'une séance épisodique, les destinataires JDR changent (cf. P-2).
  2. Aucun AD ne fixe le déclencheur et les destinataires de #2, #3, #4, #7 (ni l'envoi **après** transaction, comme `emit`).
  3. Le modèle `User` ne contient **aucune préférence de notification** (vérifié dans `schema.prisma`) : la conséquence de FR-12 vise quelque chose qui n'existe pas.
- **Conséquence :** destinataires inventés story par story ; régression JDR possible sur le rappel ; critère d'acceptation FR-12 invérifiable.
- **Correction :** *spine* — AD-12 : table « e-mail × déclencheur × destinataires × famille/kind », avec JDR = comportement actuel (propriétaire + tous les membres) ; « e-mails envoyés après la transaction ». *Source* — FR-12 : retirer la phrase sur les préférences, ou ouvrir une FR si on en veut.

### P-14 — FR-14 « migration vers les modes » contredit AD-2 et AD-16 — **M**
- **Source :** `prd.md` FR-14 (« attribue le mode JDR à toutes les parties » ; « aucune donnée … modifiée en dehors du mode » ; `[ASSUMPTION]` réversible tant qu'aucune soirée n'existe).
- **Écart :** avec AD-2 il n'y a **rien à attribuer** (le mode se dérive du système) ; AD-16 modifie bien des données (renommage `mjId`, création d'`Event`, déplacement de `reminderSentAt`) ; la réversibilité n'est pas traitée (migration unique, pas d'expand/contract).
- **Correction :** *source* — réécrire FR-14 (« la migration crée les événements, renomme le propriétaire, déplace la trace de rappel ; aucune donnée perdue ; comportement JDR constant »). *Spine* — AD-16 : une phrase sur la réversibilité (pas de migration descendante ; sans production, retour par restauration de base de dev).

### P-15 — FR-10 et §1 : la règle « sondage *ou* inscriptions » n'est plus vraie en JDR — **M**
- **Source :** `prd.md` §1 Vision (« le mode JDR ajoute … sondage *ou* inscriptions ») et FR-10 c.1 ; `addendum.md` §1 (corrigé le 2026-10-09 : coexistence déjà levée pour `CAMPAGNE_EPISODIQUE`, Story 8.8).
- **Écart :** le PRD affirme encore une règle que le code et l'addendum démentent ; le spine ne restate pas la règle par kind.
- **Correction :** *source* — corriger §1 et FR-10 (« en JDR, coexistence réservée à l'épisodique, comme aujourd'hui »). *Spine* — une ligne dans AD-3 ou AD-8 : coexistence sondage + inscriptions autorisée pour ralliement (les deux kinds) et JDR épisodique.

### P-16 — Suppression de compte : limitation de débit du mot de passe — **M**
- **Source :** `prd.md` FR-7 (mot de passe requis), NFR Sécurité (cf. `docs/security.md`, throttler).
- **Écart :** AD-11 confie la vérification à `AuthService` mais ne dit pas que `DELETE /me` porte la même limitation que les autres routes à mot de passe (`account.controller.ts` : `@Throttle` 5/min l.56 et l.67).
- **Correction :** *spine* — AD-11 : « `DELETE /me` throttlé comme les routes à mot de passe existantes ».

### P-17 — Rencontres isolées oubliées dans l'aperçu de suppression — **M**
- **Source :** `prd.md` FR-7 c.1 (groupes dont il est seul admin ; parties de JDR) ; EXPERIENCE §5.4 n° 1.
- **Écart :** AD-7 fait du créateur d'**un ralliement** (isolée comprise) un `ADMIN` ; AD-11 et `GET /me/deletion-impact` ne parlent que de « groupes ». Une rencontre isolée avec ses invités disparaîtra sans être listée.
- **Correction :** *spine* — AD-11 : « parties de ralliement (groupe **ou** rencontre isolée) dont on est seul admin ». *Source* — FR-7 et confirmation n° 1 : ajouter la ligne.

### P-18 — Temps réel : la liste d'accueil n'écoute que `user:{id}` — **I**
- **Source :** `prd.md` NFR Temps réel ; FR-16 (annulée visible dans la liste), FR-5 (suppression du groupe), FR-17 ; P9-AD-14 hérité (liste = `user:{id}` seul).
- **Écart :** la convention du spine n'émet `user:{id}` que pour la réservation et l'invitation. Or annulation, date fixée (`PROCHAINE_SEANCE_CONNUE`), vote lancé (`VOTE_EN_COURS_SANS_REPONSE`), nomination / départ d'admin (rôle), retrait de membre, suppression du groupe et masquage (autres onglets) changent la tuile de chaque participant. Le code existant émet déjà `userTopic` par participant sur les changements de statut (`parties.service.ts` l.781, l.805).
- **Conséquence :** tuiles et signaux périmés jusqu'au rechargement.
- **Correction :** *spine* — Conventions / Temps réel : « toute mutation qui change un signal, un statut ou un rôle émet `user:{id}` pour **chaque** participant concerné (lecture en lot), en plus de `partie:{id}` ; masquage → `user:{id}` de l'auteur ».

---

## 2. UX (`EXPERIENCE.md` + `DESIGN.md`)

### U-1 — Contradiction : résumé du vote « calculé côté serveur » vs P9-AD-20 — **I**
- **Source :** EXPERIENCE §4 (`SituationPanel + VoteSummary` : « résumé calculé côté serveur et mis à jour en temps réel ») ; DESIGN §7.7 (« Meilleur créneau », « N'ont pas encore répondu : noms ») ; journal Décision 11 (« Ma situation calculée côté écran … (AD-20) »).
- **Écart :** le spine hérite P9-AD-20 (états dépendants du lecteur résolus côté client) et ne dit rien du résumé du vote. Le résumé hôte exige la liste des non-répondants (donc l'éligibilité, P-6) et ne doit **pas** être livré aux autres membres.
- **Conséquence :** soit les votes nominatifs de tous partent au client de chaque membre, soit le calcul est fait en double.
- **Correction :** *spine* — trancher : « Ma situation » côté client (P9-AD-20) ; **résumé du vote** (réponses x/N, meilleur créneau, non-répondants) calculé **côté serveur** dans le DTO de détail, la liste des non-répondants projetée pour l'hôte seul. *Source* — préciser EXPERIENCE §4 en conséquence.

### U-2 — Confidentialité : places réservées non acceptées visibles de l'hôte seul — **I**
- **Source :** EXPERIENCE §5.3 (« seul l'hôte voit une place réservée non acceptée … les autres la voient comme inscrite dès qu'elle est acceptée ») ; DESIGN §7.7 (`ParticipantChip` ghost, hôte seul).
- **Écart :** AD-8 fait de la réservation une ligne `Inscription` `RESERVED` mais ne dit pas que la projection (P9-AD-15) **retire** ces lignes pour tout lecteur autre que l'hôte et la personne réservée, tout en les comptant dans « places libres ».
- **Conséquence :** filtrage fait côté client (fuite de données dans le JSON) ou oublié.
- **Correction :** *spine* — AD-8 : « projection selon le lecteur : `RESERVED` visibles de l'hôte et de la personne visée seulement ; les autres reçoivent le compte de places, pas les noms ».

### U-3 — Union `PermissionAction` incomplète face aux écrans — **I**
- **Source :** EXPERIENCE §2.4 (pied : « Retranscrire », « Clore », « Brûler » = supprimer le groupe, « Quitter l'office », « Quitter le groupe » ; Missives : « Retirer », « Nommer admin »), §5.4 n° 2-7, §6 (répondre à une invitation / réservation) ; `prd.md` matrice FR-13 (« Supprimer le groupe »).
- **Écart :** AD-6 liste « au moins » une série d'actions, sans `supprimer la partie`, `clore`, `quitter la partie`, `retirer un membre` (distinct d'« ajouter »), `répondre à une invitation / réservation` (réservé à la personne visée), `voter`. Or AD-6 exige un test de refus **par cellule** : la matrice doit être fermée.
- **Correction :** *spine* — fermer l'union dans AD-6 (ou renvoyer à la liste exhaustive dans `@master-jdr/shared`) en y ajoutant ces actions ; statuer sur « Clore » pour un groupe (UX §11.7).

### U-4 — « Sceller des secrets » : une capacité de couche 3 logée dans `parties/` — **M**
- **Source :** EXPERIENCE §2.4 (« "Sceller des secrets" n'existe pas pour un groupe ») ; code : `PartieVisibilityLock`, écrit par `PartiesService.setVisibilityLocks` (schéma l.100-115, verrous de champs de fiche de personnage).
- **Écart :** le tableau des couches d'AD-1 range `parties/` en couche 2 et ne cite pas les verrous de visibilité parmi les capacités de couche 3 ; aucune garde par capacité n'est prévue pour eux.
- **Correction :** *spine* — AD-1 : ajouter les verrous de visibilité aux capacités de couche 3 (capacité `characters`), garde via `PermissionService`.

### U-5 — État dérivé d'une conjonction : pas d'union partagée — **I**
- **Source :** EXPERIENCE §5.1 (vote en cours répondu / non répondu, inscriptions ouvertes, à venir, imminent, complet, passée, annulée), §2.4 (sections « À venir » / « Passées »), §5.2 (« Ma situation ») ; DESIGN §7.4.
- **Écart :** le spine ne définit pas d'état dérivé de l'`Event` (seul le statut anti-spoil du `Scenario` existe, et seulement en JDR) ni le contenu de `GET /parties/:id/events` (inscription et présence de vote **du lecteur**, nécessaires à la carte).
- **Conséquence :** la carte, la fenêtre, les signaux (AD-13) et la phase « passé » de P-9 dériveront chacun l'état à leur façon — le défaut qu'AD-13 veut éviter pour les signaux.
- **Correction :** *spine* — une union fermée dérivée (`EventPhase` ou équivalent) et sa fonction pure dans `@master-jdr/shared`, utilisée par l'API (refus « passé ») et le web ; préciser que le DTO de liste porte l'inscription et le « a voté » du lecteur (P9-AD-20).

### U-6 — Lien profond vers une conjonction depuis les e-mails — **I**
- **Source :** EXPERIENCE §3.5 (boutons « Répondre », « Voir la rencontre », « Voir ») ; §2.6 (la conjonction s'ouvre en fenêtre sur la liste) ; §6 (Échap / retour referment la fenêtre).
- **Écart :** AD-14 décrit la fenêtre comme un composant de `features/events/` mais aucune **adresse web** stable d'un événement (ex. `/parties/:id/events/:eventId` ouvrant la fenêtre). Les gabarits d'e-mail (AD-12) en ont besoin, et le « geste précédent » de la fenêtre suppose une entrée d'historique.
- **Correction :** *spine* — AD-14 : route web d'un événement qui ouvre la fenêtre par-dessus l'onglet (et la page en ligne pour une isolée) ; les e-mails pointent dessus.

### U-7 — Badge d'admin : le rôle doit figurer dans la projection des membres — **M**
- **Source :** EXPERIENCE §2.4 (badge sur l'avatar du rail et dans Missives), §11.5 ; DESIGN §7.11 (`RosterRail` réutilisé).
- **Écart :** AD-7 ajoute `Membership.role` ; rien ne dit que le DTO des membres (rail, Missives) l'expose (P9-AD-15 : projection explicite).
- **Correction :** *spine* — AD-7 : « `role` projeté dans le DTO de membre ».

### U-8 — Incohérences internes de l'UX à corriger à la source — **M**
- **Source :** EXPERIENCE §2.6 (« mode "Destinée" : **Palier 10.6** ») vs §11 et PRD FR-11 (**10.4**) ; EXPERIENCE §5.4 et §11.8 gardent `[ASSUMPTION : mot de passe requis]` alors que le PRD FR-7 et AD-11 l'ont décidé.
- **Correction :** *source* — EXPERIENCE §2.6 : 10.4 ; lever l'`[ASSUMPTION]` du mot de passe.

*Vérifié sans écart :* vote dans le calendrier, jamais dans la fenêtre (EXPERIENCE §2.6, DESIGN §7.7 = PRD FR-11 = spine AD-14) ; bouton de création global (P9-AD-11) ; masquage pour soi seul et non proposé hors terminé/annulé (AD-10) ; e-mails neutres et gabarit commun (AD-12). Les exigences d'accessibilité (EXPERIENCE §7, DESIGN §8) n'ont pas de conséquence serveur.

---

## 3. Journal des décisions (`.memlog.md`)

### J-1 — Décision 10 : exception « le JDR ne change pas » non reportée — **B**
- **Source :** `.memlog.md` l.37 (« EXCEPTION de plus … → à reporter dans FR-13 du PRD »).
- **Écart :** ni le PRD ni le spine ne la portent ; AD-16 promet au contraire des attentes de tests inchangées. Voir P-2.
- **Correction :** comme P-2.

### J-2 — Décision 2 : ensemble de capacités sous-spécifié — **I**
- **Source :** `.memlog.md` l.27 (« des CAPACITÉS (personnages…) ») et l.18 question 6 (garde par capacité en un seul endroit).
- **Écart :** AD-2 ne nomme que `characters` ; or AD-1 et AD-13 gardent par capacité les scénarios, l'XP, l'Homme Dragon, les annonces, les rôles de groupe et cinq codes de signaux. Avec `characters` seul : Draconis (`jdr`, sans module) perdrait ses scénarios ; `HOMME_DRAGON_A_CREER` (propre à Ryuutama) ne serait pas distingué.
- **Correction :** *spine* — AD-2 : énumérer l'union `SystemCapability` (au moins `scenarios`, `characters`, `hommeDragon`, `xp`…) et la table système → capacités ; AD-13 : table code de signal → capacité requise.

### J-3 — `getOwned` / `getViewable` : remplacés, pas doublés — **M**
- **Source :** `.memlog.md` l.9 (le point unique de permission doit s'appuyer sur ou remplacer `PartiesService.getOwned/getViewable`, « jamais créer un second »).
- **Écart :** P1-AD-3 « évolue en AD-6 », mais AD-6 ne dit pas ce que deviennent ces deux méthodes ; le test « aucune lecture d'`ownerId` hors service » ne les attrape pas si elles délèguent mal.
- **Correction :** *spine* — AD-6 : « `getOwned` / `getViewable` supprimées ou réduites à un appel de `PermissionService` ; aucune autre vérification d'appartenance ».

### J-4 — Décision 3 : « invités acceptés » et kind — **I**
- **Source :** `.memlog.md` l.28.
- **Écart :** repris sans les invités acceptés ni la distinction isolée / groupe. Voir P-10, P-11.

### J-5 — Décision 6 : le verrou change de propriétaire — **M**
- **Source :** `.memlog.md` l.32 (« sous le verrou existant (scenarios.service ~l.818) »).
- **Écart :** AD-8 dit « verrou existant de l'inscription » ; après l'extraction d'AD-3, l'inscription passe à `EventsService`. Rien ne dit que le verrou suit, ni que réservation, acceptation et création à places limitées (P-7) le prennent aussi.
- **Correction :** *spine* — AD-8 : « le verrou de capacité vit dans `EventsService` ; inscription, réservation, acceptation et création à places limitées le prennent ».

### J-6 — Décision 11 : hôte lu dans l'événement, et hôte nul — **M**
- **Source :** `.memlog.md` l.40 (« l'hôte d'une conjonction = propriétaire de l'événement, lu dans l'événement »).
- **Écart :** le spine ne précise pas la projection de l'hôte dans le DTO d'événement (`pseudo` + `displayName`, P9-AD-2) ni son cas nul (P-4).
- **Correction :** *spine* — AD-5 ou AD-14 : « DTO d'événement : `host { pseudo, displayName } | null` ».

### J-7 — Décision 15 : la plage continue n'a pas de colonnes — **B**
- **Source :** `.memlog.md` l.24 (Décision M2 : séance = plage début → fin en créneaux) et l.44 (migration).
- **Écart :** AD-4 décrit une séance par un début (date + créneau) et une fin (date + créneau), mais le schéma actuel de `Seance` n'a que `dateValidee DateTime?` — **aucun créneau** (le créneau est sur `SessionPoll.chosenSlot` et `Partie.nextSessionSlot`). Ni AD-16 ni le Structural Seed ne listent les colonnes à ajouter ni leur remplissage.
- **Conséquence :** l'épic porte ne peut pas écrire la migration ; AD-15 (`nextSessionSlot` = plus proche plage) n'a pas de source de créneau par séance.
- **Correction :** *spine* — AD-4 / AD-16 / Seed : nommer les champs (p. ex. `startDate`, `startSlot`, `endDate`, `endSlot`, ou `dateValidee` + `slot` + fin) et la règle de remplissage (depuis `dateValidee` + `chosenSlot` du sondage lié, ou `nextSessionSlot`).

### J-8 — Décision « plus de cascade sur le propriétaire » : cascades restantes — **M**
- **Source :** `.memlog.md` l.30 ; vérifié dans `schema.prisma`.
- **Écart :** AD-16 ne renomme que `Partie.mjId`. Restent : `XpDistribution.mjId` (`onDelete: Cascade`, et le nom `mjId` est **interdit** par les conventions du spine) ; `Invitation.inviterId` et `InviteLink.createdById` en `Cascade` (supprimer le compte d'un co-admin efface silencieusement les invitations et liens qu'il a émis pour le groupe).
- **Correction :** *spine* — AD-16 : statuer sur `XpDistribution.mjId` (renommer en auteur, ou exception explicite à la convention) ; AD-11 : dire si les invitations / liens d'un admin supprimé survivent (`SetNull`) ou disparaissent (choix assumé).

### J-9 — Décision 13 : onglets « via le registre » — **M**
- **Source :** `.memlog.md` l.42 (onglets par famille + type « lus dans le registre »).
- **Écart :** le registre d'AD-2 ne porte que `family`, `capabilities`, `openForCreation` ; AD-14 dit « onglets déduits de `family` + `kind` via le registre » sans champ correspondant.
- **Correction :** *spine* — AD-14 : « onglets calculés côté web à partir de `family`, `capabilities` et `kind` ; aucun champ d'onglets dans le registre ».

*Décisions du journal reprises correctement :* 4 (`ownerId`), 5 (`Membership.role`), 7 (annulation, hors restriction de famille — P-2), 8 (masquage), 9 (suppression de compte, hors P-4/P-17), 12 (signaux), 14 (interface étroite du calendrier), 16 (ordre de la porte), choix iii-b (Event + Scenario à id partagé), dates séparées (1 à N par la politique).

---

## 4. Synthèse des corrections

| Cible | Écarts |
| --- | --- |
| **Spine — nouvel AD ou extension majeure** | P-3/P-4 (fin d'appartenance et hôte disparu), P-5 (statut dérivé d'un ralliement), P-6 (éligibilité au vote, fonction unique), J-7 (colonnes de la plage) |
| **Spine — précisions d'AD existants** | AD-2 (P-1, J-2), AD-3 (P-12, P-15), AD-4/AD-14 (P-8, U-6, J-9), AD-6 (P-10, P-11, U-3, J-3), AD-7 (U-7), AD-8 (P-7, U-2, J-5), AD-9 (P-2, P-9), AD-11 (P-16, P-17, J-8), AD-12 (P-9, P-13), AD-16 (P-2, P-14, J-8), Conventions temps réel (P-18), état d'événement (U-5), résumé du vote (U-1), U-4, J-6 |
| **PRD** | FR-1/FR-3/glossaire (P-1), FR-13 (P-2, J-1), FR-7 (P-4, P-17), FR-11 vs FR-8 (P-8), FR-12 préférences (P-13), FR-14 (P-14), §1 + FR-10 (P-15) |
| **Addendum** | §2 et §5 marqués remplacés (P-1) |
| **UX** | §4 résumé (U-1), §2.6 palier 10.4 et `[ASSUMPTION]` mot de passe (U-8), §2.6 bis vs FR-11 (P-8), confirmation n° 1 (P-17) |
