---
title: "Réconciliation PRD 10.4 ↔ spine d'architecture 10.4"
created: 2026-10-20
sources:
  - prds/prd-jdr-master-2026-10-19-p10-4/prd.md (+ .memlog.md, addendum.md)
  - architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md (+ .memlog.md)
---

# Réconciliation PRD 10.4 ↔ spine 10.4

## Verdict

Les grandes décisions de la spine ont été reportées dans le PRD le 2026-10-20 : option C (atelier / vitrine), plateau sans noms dans le calendrier personnel, message de fin neutre, repli dans le navigateur, « à dater » = sans sondage lié, soirée isolée seule à dater, échéance (FR-18), plages longues et durée déclarée à la création (FR-19 à FR-23), `?pollList` (FR-14), plafond d'une semaine. Il reste pourtant des **comportements visibles** que la spine fixe et que le PRD contredit ou passe sous silence : le point d'entrée et la vue forcée de la Destinée, le « meilleur créneau », la portée du filtre par partie, la priorité composer > fenêtre > Destinée. La spine a aussi un **AD-8 resté sur l'ancien modèle** (durée portée par le sondage), qui contredit FR-19 et AD-10 amendé.

Synthèse : 2 écarts high, 9 medium, 14 low. Les corrections portent surtout sur le PRD (16 écarts), puis sur la spine (7) ; 2 écarts touchent les deux documents.

| # | Écart (court) | Gravité | À corriger |
| --- | --- | --- | --- |
| 1 | Entrée en Destinée : créneau d'entrée et vue forcée | high | PRD |
| 2 | AD-8 périmé : durée du composer ≠ durée déclarée du rendez-vous | high | spine (+ PRD) |
| 3 | « Meilleur créneau » non défini | medium | PRD |
| 4 | Portée du filtre par partie | medium | PRD |
| 5 | Priorité composer > fenêtre > Destinée | medium | PRD |
| 6 | FR-5 : « sondage ouvert » au lieu de « sondage lié » | medium | PRD |
| 7 | Votes de groupe désormais sur la grille du calendrier personnel | medium | PRD |
| 8 | Retrait du panneau de création (Story 8.7) | medium | PRD |
| 9 | Prolongation de fait en JDR via l'échéance du composer | medium | les deux |
| 10 | Fenêtres agrégées des joueurs touchées par l'exclusion d'AD-7 | medium | spine (+ PRD) |
| 11 | Plateau nominatif dans le calendrier du groupe | medium | PRD |
| 12 | Repli : toutes les colonnes de droite, réouverture à l'entrée en Destinée | low | PRD |
| 13 | « Partie active » : partie masquée, scénario clôturé | low | PRD |
| 14 | `?seanceId` non valide, `?pollList` adressable | low | PRD |
| 15 | Chevauchement non interdit | low | PRD |
| 16 | Durée changée au composer = durée du rendez-vous | low | PRD |
| 17 | Rappel de séance « veille du départ » sans AD | low | spine |
| 18 | FR-18 « seul changement du vote JDR » | low | PRD |
| 19 | Carte des capacités, `scope`, question ouverte 2 périmés | low | spine |
| 20 | Statut des hypothèses FR-19 / FR-23 | low | PRD |
| 21 | Glossaire : route du calendrier du groupe | low | PRD |
| 22 | « rencontre isolée » dans la spine | low | spine |
| 23 | État « vous ne votez pas » absent des conventions | low | spine |
| 24 | Addendum : piste de stockage périmée | low | PRD (addendum) |
| 25 | `PL-1` employé comme identifiant d'exigence | low | spine |

---

## 1. Décisions de la spine absentes du PRD ou contredites par lui

### Écart 1 : entrée en Destinée (créneau d'entrée et vue forcée)
- **Source :** AD-6 (« Toute entrée … force la vue Mois (Semaine si la famille du sondage est `ralliement`), replie le tiroir mobile et se place sur `destinyEntryOption` : premier créneau à venir avant l'échéance, `bestOption` après ») ; spine memlog l. 37.
- **Divergence :** FR-7 et FR-13 disent « déplace / centre le calendrier sur son **premier créneau candidat** », et UJ-3 dit « centré sur le premier ». Le premier créneau peut être passé, et après l'échéance la spine se place sur le meilleur. UJ-4 dit d'ailleurs déjà « le plateau montre le meilleur créneau » : le PRD se contredit lui-même. Le passage forcé en Mois ou en Semaine (l'utilisateur quitte Agenda ou Semaine sans l'avoir demandé) et le tiroir replié à l'entrée ne figurent nulle part dans le PRD.
- **Gravité :** high. Un test écrit depuis FR-13 échouerait contre l'implémentation conforme à la spine.
- **Correctif :** réécrire FR-7 et FR-13 : « toute entrée en Destinée affiche la vue Mois (Semaine en mode soirée) et se place sur le premier créneau candidat à venir, ou sur le meilleur créneau une fois l'échéance passée ; sur mobile, le tiroir s'ouvre replié ».
- **À corriger :** PRD (FR-7, FR-13, UJ-3).

### Écart 3 : « meilleur créneau » non défini
- **Source :** AD-11 (`bestOption` : plus de oui, puis plus de peut-être, puis le plus tôt ; options passées exclues ; aucun s'il n'y a pas de oui), AD-13.
- **Manque :** FR-11 (« le meilleur en tête et présélectionné ») et UJ-4 emploient la notion sans la définir. Deux comportements visibles manquent : une option passée n'est jamais présélectionnée, et sans aucun oui rien n'est présélectionné.
- **Gravité :** medium.
- **Correctif :** ajouter au Glossaire « Meilleur créneau : créneau candidat à venir qui a le plus de oui, puis de peut-être, puis le plus tôt ; aucun s'il n'y a pas de oui », et dire dans FR-11 qu'il n'y a pas de présélection dans ce cas.
- **À corriger :** PRD (§3, FR-11).

### Écart 4 : portée du filtre par partie
- **Source :** AD-9 (filtre appliqué en aval ; « estompe, rail, indisponibilités, liste ✦, puce et plateau dérivent de la liste non filtrée » ; « Entrer en Destinée sur une partie décochée la recoche ») ; spine memlog l. 37.
- **Divergence :** FR-15 dit « Le filtre s'applique à toutes les natures affichées (séances, **votes**, …) ». Pour la spine, la liste ✦, la puce, le rail et les indisponibilités ignorent le filtre, et l'entrée en Destinée recoche la partie. Le PRD n'en dit rien.
- **Gravité :** medium.
- **Correctif :** préciser dans FR-15 que le filtre n'agit que sur les entrées de la grille, que la liste ✦, la puce, le plateau, le rail et les indisponibilités restent complets, et que l'entrée en Destinée sur une partie décochée la recoche.
- **À corriger :** PRD (FR-15).

### Écart 5 : priorité composer > fenêtre sélectionnée > Destinée
- **Source :** AD-16 (un seul état dominant ; armer le composer **suspend** la Destinée, et la colonne montre alors la liste de l'automate pour le MJ, sinon le contenu habituel ; la fenêtre sélectionnée l'emporte sur la Destinée ; annuler rend l'état précédent ; le composer vise la destinée active « s'il est composable »).
- **Divergence :** FR-8 dit que « le plateau remplace le contenu habituel de la colonne **tant que la Destinée est active** », ce qui est faux pendant le composer et pendant la sélection d'une fenêtre. FR-2 vise la destinée active « si c'est un sondage de cette partie », sans la condition « modifiable par l'utilisateur ». Le retour à l'état précédent après annulation n'est écrit nulle part.
- **Gravité :** medium.
- **Correctif :** ajouter à FR-8 ou FR-10 : « pendant le composer ou la sélection d'une fenêtre, la Destinée est suspendue (plateau et estompe masqués) ; valider la rétablit sur le sondage créé ou modifié, annuler rend l'état précédent ».
- **À corriger :** PRD (FR-2, FR-8, FR-10).

### Écart 6 : FR-5 parle encore de « sondage ouvert »
- **Source :** AD-3 (« **sans sondage lié** ») ; spine memlog l. 21 ; PRD §3 déjà corrigé ; PRD memlog l. 32.
- **Divergence :** FR-5, 3ᵉ puce : le bouton est caché quand « tous ses rendez-vous ont déjà une date **ou un sondage ouvert** ». Une séance dont le vote est clos sans date n'est pas à dater (§3, AD-3), mais FR-5 laisse alors le bouton visible.
- **Gravité :** medium.
- **Correctif :** remplacer par « ont déjà une date ou un sondage (ouvert, ou clos sans date) ».
- **À corriger :** PRD (FR-5).

### Écart 7 : les votes des groupes apparaissent désormais sur la grille du calendrier personnel
- **Source :** AD-1 et AD-2 (`/me/open-polls` toutes familles ; `allCalendarEntries()` contient tous les sondages ouverts) ; spine memlog l. 11 (aujourd'hui, `/me/calendar` exclut les sondages de ralliement, Story 40.5).
- **Manque :** les options des sondages de groupe et de soirée isolée vont apparaître sur la grille du calendrier personnel, ce qui revient sur un comportement validé de la Story 40.5. FR-7 ne couvre que la liste ✦, et §4.6 ne liste pas ce changement.
- **Gravité :** medium. C'est un écran validé modifié, à signaler ⚠️.
- **Correctif :** ajouter à §4.6 « Calendrier personnel : les votes de groupe et de soirée isolée s'affichent sur la grille (couche « votes en cours »), comme ceux du JDR ».
- **À corriger :** PRD (§4.6, FR-7).

### Écart 8 : retrait du panneau de création de la Story 8.7 et dialogue de confirmation allégé
- **Source :** AD-5 (« Le panneau `app-poll-creation` / `pollPanelOpen` (Story 8.7) est **retiré** » ; « `ComposeConfirmDialog` ne garde que l'avertissement de perte de réponses »).
- **Manque :** §4.6 ne liste ni la disparition de ce panneau, que `?seanceId` (« Lancer le vote ») ouvre aujourd'hui, ni la réduction du dialogue de confirmation du composer.
- **Gravité :** medium. Ce sont deux écrans validés modifiés.
- **Correctif :** ajouter à §4.6 « Ancien panneau de création d'un vote (Story 8.7) : retiré, remplacé par le composer ; confirmation du composer réduite à l'avertissement de perte de réponses ».
- **À corriger :** PRD (§4.6).

### Écart 12 : repli de la colonne (portée et réouverture)
- **Source :** AD-9 (« une clé pour toutes les colonnes de droite » ; « entrer en Destinée ouvre la colonne »).
- **Manque :** FR-4 ne parle que du MJ et de la liste de l'automate. La spine étend le dock à toutes les colonnes de droite, avec un seul état pour toutes, et rouvre la colonne à l'entrée en Destinée.
- **Gravité :** low.
- **Correctif :** ajouter à FR-4 « le même repli vaut pour la colonne de droite des trois calendriers, avec un seul état par navigateur ; entrer en Destinée la rouvre ».
- **À corriger :** PRD (FR-4).

### Écart 13 : définition de « partie active »
- **Source :** AD-15 (« statut ni `TERMINEE` ni `ANNULEE`, **partie non masquée** ») ; AD-3 (en JDR, « séance d'un scénario **non clôturé** »).
- **Manque :** le PRD (§3, toujours `[ASSUMPTION]`) ne dit pas qu'une partie masquée par l'utilisateur sort de la liste ✦ et de « à dater », ni que les séances d'un scénario clôturé ne sont pas à dater.
- **Gravité :** low.
- **Correctif :** compléter §3 (« partie active : … et non masquée par l'utilisateur ») et la définition de « rendez-vous à dater » (« en JDR, d'un scénario non clôturé ») ; lever l'`[ASSUMPTION]` si l'architecture l'a ratifiée.
- **À corriger :** PRD (§3, §9).

### Écart 14 : adresses `?seanceId` et `?pollList`
- **Source :** AD-5 (`?seanceId` sur une séance ni à dater ni modifiable : « calendrier normal et message écrit, sans rien révéler ») ; AD-6 (`?pollList` lu à l'initialisation, réécrit dans l'adresse).
- **Manque :** FR-14 (« Lancer le vote ») ne dit rien d'un lien devenu périmé, par exemple une séance datée entre-temps. FR-13 ne prévoit le lien partageable que pour un sondage, pas pour la liste restreinte.
- **Gravité :** low.
- **Correctif :** ajouter à FR-14 « rendez-vous qui n'est plus à dater ni modifiable : calendrier normal avec un message écrit », et à FR-13 que la liste restreinte s'ouvre aussi par un lien.
- **À corriger :** PRD (FR-13, FR-14).

### Écart 15 : le chevauchement de deux rendez-vous n'est pas interdit
- **Source :** AD-11 (« le serveur n'interdit pas le chevauchement »).
- **Manque :** FR-21 ne dit pas qu'on peut proposer ou fixer une plage qui chevauche un autre rendez-vous. La disponibilité défavorable n'est qu'un affichage.
- **Gravité :** low.
- **Correctif :** ajouter à FR-21 « un chevauchement est signalé par la disponibilité affichée, jamais refusé ».
- **À corriger :** PRD (FR-21).

### Écart 16 : changer la durée dans le composer change la durée du rendez-vous
- **Source :** AD-10 amendé (la durée appartient au rendez-vous, `Seance.durationSlots`, et elle est « modifiable dans le composer ») ; PRD memlog l. 37.
- **Manque :** FR-19 dit que le composer « permet de la changer », sans dire que la nouvelle durée devient celle du rendez-vous, et qu'elle se voit donc ensuite dans la fenêtre de l'événement ou l'éditeur de séance (FR-23).
- **Gravité :** low.
- **Correctif :** ajouter à FR-19 « la durée changée dans le composer devient la durée du rendez-vous ».
- **À corriger :** PRD (FR-19).

## 2. Exigences du PRD non gouvernées ou contredites par un AD

### Écart 2 : AD-8 est resté sur le modèle « durée du sondage »
- **Source :** AD-8 (« `?span` = durée de la cible du composer (**durée du sondage modifié, durée saisie pour un nouveau**) » ; « **choisir une fenêtre pour un nouveau sondage fixe la durée du composer** ») face à AD-10 amendé et FR-19 (« Le composer reprend la durée déclarée du rendez-vous (FR-23) »).
- **Divergence :** AD-8 n'a pas été repris lors de l'amendement d'AD-10. Prenons UJ-1 avec un rendez-vous dont la durée déclarée vaut 2 : hors composer, la liste est calculée à `?span=1`. Le MJ choisit une fenêtre d'un créneau puis le rendez-vous. Selon AD-8, la fenêtre impose une durée de 1, ce qui écrase la durée déclarée. Selon FR-19 et FR-22, le composer reprend 2 et la fenêtre est refusée. Aucun des deux documents ne tranche.
- **Gravité :** high. Deux stories (automate, composer) liraient deux règles opposées.
- **Correctif :** dans la spine, ramener la cible d'AD-8 à `Seance.durationSlots` et décider du cas d'une fenêtre d'une autre durée : soit elle est refusée avec un message, soit la liste passe à la durée du rendez-vous dès qu'il est choisi. Dans le PRD, reporter ce choix dans FR-22 et l'edge case d'UJ-1.
- **À corriger :** spine (AD-8), puis PRD (FR-22).

### Écart 9 : en JDR, l'échéance modifiable du composer revient à prolonger le vote
- **Source :** AD-17 (JDR : `PUT …/options` accepte `expiresAt` ; modifier l'échéance remet la relance à zéro « comme Prolonger ») ; AD-4 (JDR : `extend` = `POLL_EXTEND`, **refusé**) ; FR-11 (prolonger seulement « là où le chemin existant le permet (mode soirée) ») ; FR-18 (« la changer relance le rappel … comme Prolonger ») ; §3 (un sondage dont l'échéance est passée reste ouvert, donc modifiable).
- **Divergence :** le MJ ne peut pas « Prolonger » depuis le plateau, mais il peut repousser l'échéance par « Modifier », y compris après l'échéance, ce qui rouvre le vote. Aucun des deux documents ne dit si c'est voulu, ni si le composer reste accessible après l'échéance.
- **Gravité :** medium.
- **Correctif :** trancher, puis l'écrire dans les deux documents. Soit c'est voulu : FR-11 et FR-18 disent qu'en JDR on prolonge en modifiant l'échéance, et AD-4 le note. Soit ce n'est pas voulu : FR-18 et AD-17 interdisent de repousser l'échéance en JDR, ou de modifier un sondage après son échéance.
- **À corriger :** PRD (FR-10, FR-11, FR-18) et spine (AD-4, AD-17).

### Écart 10 : la vue agrégée des joueurs subit l'exclusion d'AD-7
- **Source :** AD-7 (ordre de calcul de `GET /parties/:id/available-slots` : **exclusion** des fenêtres déjà proposées, puis plafond ; « la vue agrégée des joueurs est inchangée » n'est dit que pour les masquées) ; spine memlog l. 32 (`available-slots` n'est pas réservé au MJ) ; code : `calendar-view.html` affiche `app-available-slots` côté joueur sous la couche `disponibilite-groupe` (Story 30.6).
- **Divergence :** le PRD (§3 « Fenêtre de l'automate … pour le MJ », §4.7 « JDR non régressé hors périmètre », FR-2 « quitte la liste de l'automate ») suppose que seul le MJ voit ces fenêtres. Or les joueurs voient une liste agrégée servie par la même route. Si l'exclusion s'applique à tous les lecteurs, leur liste perd les créneaux proposés au vote, et ce changement n'est listé nulle part.
- **Gravité :** medium.
- **Correctif :** dans AD-7, restreindre explicitement l'exclusion à la vue nominative du MJ, ou assumer le changement. Dans le PRD, corriger le Glossaire (les joueurs voient une version agrégée) et, si le changement est assumé, l'ajouter à §4.6.
- **À corriger :** spine (AD-7), puis PRD (§3, éventuellement §4.6).

### Écart 11 : plateau nominatif dans le calendrier du groupe
- **Source :** tableau des rôles de la spine et AD-6 (calendrier du groupe = atelier, « plateau nominatif »).
- **Manque :** FR-8 ne parle que du calendrier de la partie, qui nomme les absents, et du calendrier personnel, qui n'en donne que le nombre. Il ne dit rien du calendrier du groupe, où un membre verrait les noms des autres membres qui n'ont pas répondu. C'est une question de confidentialité en mode soirée qui doit figurer dans le PRD.
- **Gravité :** medium.
- **Correctif :** ajouter à FR-8 « dans le calendrier du groupe, le plateau nomme aussi ceux qui n'ont pas répondu (aucune dispo n'est exposée) », ou décider l'inverse et le reporter dans AD-6.
- **À corriger :** PRD (FR-8).

### Écart 17 : le rappel « la veille du départ » n'est gouverné par aucun AD
- **Source :** FR-20, dernière puce, et UJ-5 (« le rappel part le jeudi ») ; AD-14 ne cite que les gabarits « date fixée » et « relance ».
- **Manque :** aucun AD ne dit sur quelle date se cale le rappel de séance pour une plage longue. FR-20 cite aussi la « liste des parties » parmi les affichages de plage, que la liste des DTO d'AD-14 ne mentionne pas explicitement.
- **Gravité :** low.
- **Correctif :** ajouter à AD-14 « le rappel de séance se cale sur `startDate` / `startSlot` ; la liste des parties affiche la plage ».
- **À corriger :** spine (AD-14).

## 3. Vocabulaire et identifiants

### Écart 18 : FR-18 dit « seul changement du vote JDR »
- **Source :** FR-18, dernière puce ; FR-19, FR-22, FR-23 (durée en JDR) ; FR-11 (fixer depuis le plateau).
- **Divergence :** la durée et l'automate à `?span` changent aussi le vote JDR.
- **Gravité :** low.
- **Correctif :** remplacer par « l'échéance du JDR, jusqu'ici fixée en silence à 14 jours, devient visible et modifiable ».
- **À corriger :** PRD (FR-18).

### Écart 19 : carte des capacités, `scope` et question ouverte 2 périmés
- **Source :** spine, Capability → Architecture Map (FR-18 noyée dans « FR-5, FR-6 … échéance » ; FR-19 à FR-23 réduites à « PL-1 ») ; `scope` du frontmatter (échéance absente) ; Open Question 2 (écarts « à reporter », alors que le PRD les a reportés le 2026-10-20).
- **Gravité :** low.
- **Correctif :** ajouter une ligne FR-18 (AD-17) et une ligne par FR de plage longue (FR-19 et FR-23 → AD-10 ; FR-20 et FR-21 → AD-11, AD-14 ; FR-22 → AD-8, AD-11) ; ajouter l'échéance au `scope` ; marquer la question 2 comme reportée dans le PRD, avec EXPERIENCE.md encore à mettre à jour.
- **À corriger :** spine.

### Écart 20 : statut des hypothèses FR-19 et FR-23
- **Source :** PRD : FR-19 (plafond d'une semaine) et FR-23 (durée d'une séance de JDR à la création) sont `[ASSUMPTION]` ; spine AD-10 : les deux y sont des règles (« plafond constant … PRD FR-19 », « facultative à la création (… séance de JDR) »).
- **Gravité :** low.
- **Correctif :** faire confirmer les deux points par l'utilisateur et retirer l'`[ASSUMPTION]` dans le PRD (FR-19, FR-23, §9) ; à défaut, les marquer « à confirmer » dans AD-10.
- **À corriger :** PRD.

### Écart 21 : le Glossaire attache une route au calendrier du groupe
- **Source :** PRD §3 (« Calendrier du groupe … (`/parties/:id/guild-calendar`) » ; « Calendrier de partie … vu par le MJ ou un joueur ») ; tableau des rôles de la spine (le joueur de JDR utilise aussi `/guild-calendar`).
- **Divergence :** la route citée dans le Glossaire laisse croire que `guild-calendar` est propre au mode soirée. C'est aussi un détail technique qui n'a pas sa place dans le PRD.
- **Gravité :** low.
- **Correctif :** retirer la route du Glossaire et la laisser à la spine.
- **À corriger :** PRD (§3).

### Écart 22 : « rencontre isolée » dans la spine
- **Source :** AD-15, Prevents ; spine memlog.
- **Divergence :** le PRD dit « soirée isolée ». « Ralliement » reste acceptable comme identifiant de famille dans la spine.
- **Gravité :** low.
- **Correctif :** remplacer « rencontre isolée » par « soirée isolée » dans la spine.
- **À corriger :** spine.

### Écart 23 : l'état « vous ne votez pas » manque aux conventions
- **Source :** FR-7 (quatre états : « à faire », « répondu », « organisateur », « vous ne votez pas ») ; ligne « Dérivé vs persisté » des conventions de la spine (trois états seulement). Cet état se déduit de `me.eligible` (AD-2).
- **Gravité :** low.
- **Correctif :** ajouter « vous ne votez pas » (non ayant droit) à la liste des états dérivés de la spine.
- **À corriger :** spine.

### Écart 24 : l'addendum garde une piste déjà tranchée
- **Source :** `addendum.md`, Pistes techniques (« FR-3 / FR-4 : … décider entre stockage serveur … et local ») ; PRD §8 (tranché le 2026-10-20).
- **Gravité :** low.
- **Correctif :** marquer la piste « tranchée en architecture : masquage serveur, repli navigateur ».
- **À corriger :** PRD (addendum).

### Écart 25 : `PL-1` employé comme identifiant d'exigence
- **Source :** spine, `binds` et AD-8, AD-10, AD-11, AD-14 (`PL-1` cité à côté des FR) ; PRD §4.10 (`PL-1` n'est qu'un nom de section).
- **Divergence :** `PL-1` n'est pas une exigence testable. Les AD qui le citent lient en réalité FR-19 à FR-23. Le doublon est sans danger tant qu'on le présente comme un alias.
- **Gravité :** low.
- **Correctif :** dans les `Binds` des AD, remplacer `PL-1` par les FR concernées et garder `PL-1` uniquement comme nom de la fonctionnalité.
- **À corriger :** spine.
