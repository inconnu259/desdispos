# Revue éditoriale — mise à jour du 2026-10-20 (après l'architecture)

Skill `bmad-review`, lentilles `structure` puis `prose` (directive `doc_standards` de bmad-ux).
Périmètre : uniquement les passages ajoutés ou modifiés le 2026-10-20 après l'architecture, tels que listés par l'appelant.
Guide de style : Microsoft Writing Style Guide (réglage par défaut), appliqué au français. Lecteur : humains (réglage par défaut) ; ces documents sont aussi lus par les agents de dev, d'où quelques propositions de cohérence terminologique.

**Lecture de l'objet.** Ces deux documents existent pour donner au développeur (humain ou agent) du Palier 10.4 le comportement (`EXPERIENCE.md`) et l'apparence (`DESIGN.md`) exacts du sondage et de la Destinée dans le calendrier, en delta des Paliers 9 et 10.

**Modèle de structure retenu.** Reference/Database (accès direct par section, schéma constant par entrée), précédé d'un court en-tête d'orientation (delta, amendements, mise à jour). Les sections numérotées suivent le gabarit bmad-ux ; le modèle est respecté dans l'ensemble, les écarts relevés sont locaux.

**Contenu sacro-saint.** Aucune proposition ne change une décision. Quand deux passages se contredisent, la ligne est marquée `QUESTION` : c'est à l'auteur de choisir la bonne version.

**Choix stylistiques préservés.** Style télégraphique des tableaux et des listes (fragments nominaux, « · » comme séparateur) ; marques ⚠️ et `[ASSUMPTION]` ; traçabilité inline (« Décidé en architecture le … ») ; les trois voix de thème de §3.1 (Grimoire vouvoie, Forêt tutoie, Atelier technique à l'infinitif) ; vocabulaire maison (atelier, vitrine, destinée, Destinée, éphémérides, composer, plage, départ).

## Décompte

| Lentille | EXPERIENCE.md | DESIGN.md | Total |
| --- | --- | --- | --- |
| structure | 13 | 9 | 22 |
| prose | 21 | 7 | 28 |
| **Total** | **34** | **16** | **50** |

Les lignes sont classées par impact sur la compréhension, à l'intérieur de chaque lentille et de chaque fichier.

---

## Lentille structure

### EXPERIENCE.md

**S-E1 · MOVE** — §5, ordre des sous-sections
- Texte actuel : `### 5.5 En direct` (ligne 274) placé **avant** `### 5.4 États vides et erreurs` (ligne 278).
- Proposé : déplacer le bloc « 5.5 En direct » (titre + paragraphe) après la fin de §5.4.
- Raison : numérotation inversée ; un lecteur qui cherche §5.4 par la table des matières tombe sur §5.5. Impact : 0 mot.

**S-E2 · MOVE** — §3.1, ordre des lignes du tableau
- Texte actuel : les lignes « Vote clos, atelier : annulé » et « Vote clos, atelier : autre raison » (lignes 204-205) sont séparées de « Vote clos, atelier (raison connue) » et « ⚠️ Vote clos, vitrine (message neutre) » (lignes 190-191) par tout le bloc durée / échéance ; « Rouvrir un vote JDR (plateau) » et « Autre rendez-vous (plateau) » (210-211) sont loin de « Tiroir replié — déplier » (189) ; « Fin du vote passée (refus) » et « Vote terminé (liste, plateau) » (208-209) sont loin de « Composer — échéance » (197).
- Proposé : regrouper les lignes par surface, sans en changer le texte :
  1. automate (section.slots → Carte masquée) ;
  2. proposer / modifier / choix du rendez-vous / filtre par partie ;
  3. liste des destinées (titre, sous-titre, quitter) ;
  4. plateau (tiroir replié, absents nombre et lien, Rouvrir un vote JDR, Autre rendez-vous, Vote terminé, Suite d'une plage, ×{n}) ;
  5. composer durée et échéance (Durée, unité, Traduction en jours, échéance, Défaut, Fin du vote passée, Perte de réponses, Fenêtre d'une autre durée, Journée retirée, Plafond) ;
  6. messages de clôture et de lien (les quatre « Vote clos … », Lien vers un vote clos, Lien vers un rendez-vous qui n'est plus à dater).
- Raison : le tableau compte 1 125 mots ; les ajouts ont été mis en queue, ce qui disperse les variantes d'un même message (quatre « Vote clos » sur deux endroits) et oblige à tout parcourir pour relire une surface. Impact : 0 mot.

**S-E3 · CONDENSE (scinder)** — §2.5, puce « Actions de l'organisateur » (ligne 100)
- Texte actuel : `- **Actions de l'organisateur** : « Modifier les dates » (composer prérempli ; dans la vitrine, ouvre l'atelier) et « Fixer la date… », avant comme après l'échéance ; en mode soirée, « Prolonger le vote ». En JDR, pas de « Prolonger » : le MJ repousse la fin du vote en modifiant les dates ; une fois le vote terminé, le plateau le lui dit (« Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. »). Sous ces actions, un lien texte « Proposer des dates pour un autre rendez-vous » ouvre le choix du rendez-vous (FR-5, FR-10) ; le nouveau vote devient la destinée active.`
- Proposé :
  ```
  - **Actions de l'organisateur**, avant comme après l'échéance :
    - « Modifier les dates » (composer prérempli ; dans la vitrine, ouvre l'atelier) et « Fixer la date… » ;
    - en mode soirée, « Prolonger le vote ». En JDR, pas de « Prolonger » : le MJ repousse la fin du vote en modifiant les dates ; une fois le vote terminé, le plateau le lui dit (« Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. ») ;
    - sous ces actions, un lien texte « Proposer des dates pour un autre rendez-vous » ouvre le choix du rendez-vous (FR-5, FR-10) ; le nouveau vote devient la destinée active.
  ```
- Raison : une puce de ~110 mots porte trois règles distinctes ; la scinder les rend repérables sans rien retirer. Impact : ~0 mot.

**S-E4 · CONDENSE (scinder)** — §2.8, point 2 « Fin du vote » (ligne 135)
- Texte actuel : `2. **Fin du vote** : « Fin du vote : {date} ✎ », préremplie avec la plus tôt de ces dates : dans 14 jours, ou la veille du premier créneau ; jamais avant aujourd'hui. Une ligne explique le défaut (« Proposé : dans 14 jours » ou « Proposé : la veille du premier créneau »). Tant qu'on n'a pas touché la date, elle suit les créneaux ajoutés ou retirés. Le crayon ouvre le sélecteur de date existant ; une date passée est refusée avec sa raison. En modification après la fin du vote, le champ montre la date passée, marquée « passée », et Valider reste bloqué tant qu'elle n'est pas repoussée.`
- Proposé :
  ```
  2. **Fin du vote** : « Fin du vote : {date} ✎ ».
     - **Défaut** : la plus tôt de ces dates, dans 14 jours ou la veille du premier créneau ; jamais avant aujourd'hui. Une ligne explique le défaut (« Proposé : dans 14 jours » ou « Proposé : la veille du premier créneau »). Tant qu'on n'a pas touché la date, elle suit les créneaux ajoutés ou retirés.
     - **Saisie** : le crayon ouvre le sélecteur de date existant ; une date passée est refusée avec sa raison.
     - **Après la fin du vote** (modification) : le champ montre la date passée, marquée « passée », et Valider reste bloqué tant qu'elle n'est pas repoussée.
  ```
- Raison : le point 1 (Durée) est déjà découpé en sous-puces ; le point 2, aussi dense, ne l'est pas. Parallélisme et repérage du cas « après la fin du vote ». Impact : +3 mots.

**S-E5 · CONDENSE (scinder)** — §6, puce « Composition » (ligne 290)
- Texte actuel : `- **Composition (⚠️ geste des dispos)** : un tap court ajoute ou retire **une** bande (inchangé, 36.10) ; un appui maintenu (450 ms) ou un glissement sélectionne **plusieurs jours**, puis la barre de sélection fait choisir le moment et « Ajouter au vote ». Chaque sélection **s'ajoute** aux créneaux déjà désignés. Clavier inchangé (`1` `2` `3`, `Espace`, `Maj`+flèches pour étendre la plage, `Entrée`, `Échap`). Avec une durée de plus d'un créneau, chaque créneau désigné est un **départ** et l'aperçu montre sa plage entière (§2.9) ; le geste ne change pas. Toucher le départ d'une plage déjà désignée la retire ; toucher une autre bande, même couverte par une plage, y pose un nouveau départ (chevauchement permis).`
- Proposé :
  ```
  - **Composition (⚠️ geste des dispos)** :
    - un tap court ajoute ou retire **une** bande (inchangé, 36.10) ; un appui maintenu (450 ms) ou un glissement sélectionne **plusieurs jours**, puis la barre de sélection fait choisir le moment et « Ajouter au vote ». Chaque sélection **s'ajoute** aux créneaux déjà désignés. Clavier inchangé (`1` `2` `3`, `Espace`, `Maj`+flèches pour étendre la plage, `Entrée`, `Échap`) ;
    - avec une durée de plus d'un créneau, le geste ne change pas : chaque créneau désigné est un **départ** et l'aperçu montre sa plage entière (§2.9). Toucher le départ d'une plage déjà désignée la retire ; toucher une autre bande, même couverte par une plage, y pose un nouveau départ (chevauchement permis).
  ```
- Raison : sépare le geste inchangé (contrat P9) de son extension aux plages, ajoutée le 2026-10-20 ; le lecteur voit d'un coup ce qui est neuf. Impact : ~0 mot.

**S-E6 · MOVE** — §11, item 5 (ligne 357)
- Texte actuel : `5. **PRD mis à jour le 2026-10-20** : d'abord avec ce delta (FR-5, FR-6, FR-7, FR-8, FR-16, FR-17), puis après l'architecture (FR-2, FR-4, FR-5, FR-7, FR-8, FR-10 à FR-15, FR-18 à FR-23).`
- Proposé : retirer de §11 et ajouter en fin du paragraphe « Mise à jour du 2026-10-20 » de l'en-tête une puce : `- **PRD aligné** : d'abord avec ce delta (FR-5, FR-6, FR-7, FR-8, FR-16, FR-17), puis après l'architecture (FR-2, FR-4, FR-5, FR-7, FR-8, FR-10 à FR-15, FR-18 à FR-23).`
- Raison : c'est un historique, pas un point ouvert ; §11 doit lister ce qui reste à trancher. Impact : 0 mot net.

**S-E7 · MERGE** — §11, items 3 et 7 (lignes 355 et 359)
- Texte actuel (item 7) : `7. **Surfaces sans planche** ajoutées : rail « (suite) », Agenda en une ligne, e-mails en plage, compteur dans la fenêtre d'un événement. Construites depuis les tableaux §2.8 à §2.10.`
- Proposé : supprimer l'item 7 et compléter l'item 3 : `3. **Surfaces sans planche** (choix de l'utilisateur) : choix du rendez-vous, barre de sélection en composition sur mobile, plateau en colonne sur ordinateur, filtre « Seulement », formulaire de création expliqué ; et, depuis l'architecture, rail « (suite) », Agenda en une ligne, e-mails en plage, compteur dans la fenêtre d'un événement. Construites à partir des tableaux de ce document (§2.8 à §2.10 pour les quatre dernières).`
- Raison : même point ouvert, deux entrées ; une seule source de vérité. Impact : ~-8 mots.

**S-E8 · MERGE** — §11, items 2 et 6 (lignes 354 et 358)
- Texte actuel (item 6) : `6. **Libellés de durée et d'échéance** (§3.1) : provisoires, à relire sur l'application.`
- Proposé : supprimer l'item 6 ; l'item 2 (« **Libellés du §3** : tous provisoires, à relire sur l'application dans les trois thèmes. ») le couvre déjà. Au besoin : `2. **Libellés du §3** (y compris durée et échéance) : tous provisoires, à relire sur l'application dans les trois thèmes.`
- Raison : redondance stricte (les libellés de durée et d'échéance sont dans §3.1, donc dans « tous les libellés du §3 »). Impact : ~-10 mots.

**S-E9 · QUESTION (CUT ?)** — §11, item 4 barré (ligne 356)
- Texte actuel : `4. ~~Stockage du masquage et de l'état replié~~ : tranché en architecture (masquage sur le serveur, repli dans le navigateur).`
- Proposé : soit supprimer l'item (la décision est déjà dans §2.2 point 1, « État retenu dans ce navigateur »), soit le garder barré comme trace. Si suppression, renuméroter.
- Raison : un point tranché ne fait plus partie des points ouverts ; le garder brouille la liste. Impact : ~-16 mots si supprimé.

**S-E10 · CONDENSE** — §2.10, puce 2 (ligne 166)
- Texte actuel : `- Dans la fenêtre d'un événement, changer la durée d'un vote qui a des réponses ouvre le même avertissement que le composer (« Changer la durée efface les {n} réponses déjà données. »).`
- Proposé : `- Dans la fenêtre d'un événement, changer la durée d'un vote qui a des réponses ouvre le même avertissement de perte que le composer (§2.8).`
- Raison : le libellé est déjà cité en §2.8 et figure en §3.1 ; un renvoi suffit et évite deux copies à tenir à jour. Impact : ~-8 mots.

**S-E11 · CUT (ligne vide)** — §8, entre UJ-4 et UJ-5 (ligne 317)
- Texte actuel : une ligne vide entre `4. **UJ-4 — …** … (vitrine).` et `5. **UJ-5 — …**`.
- Proposé : supprimer la ligne vide.
- Raison : elle transforme la liste en liste « lâche » à partir de ce point (espacement inégal au rendu) et laisse croire que UJ-5 et UJ-6 forment un groupe à part. Impact : 0 mot.

**S-E12 · QUESTION (MERGE ?)** — §10, ligne 17 (ligne 349)
- Texte actuel : `| 17 | Colonne de droite des calendriers personnel et du groupe | rangeable en dock (›/‹) | FR-4 |`
- Proposé : envisager de fusionner avec la ligne 1 (« Colonne MJ … colonne rangeable en dock à droite ») en un seul écart « Colonnes de droite (MJ, joueur, groupe, plateau) : rangeables en dock ». À vérifier au passage : §4 `SideDock` cite aussi la colonne **joueur**, absente de la ligne 17.
- Raison : même changement, deux lignes ; et la liste d'écrans diffère de celle de §4. Impact : ~-12 mots si fusion.

**S-E13 · PRESERVE** — en-tête, puce « Atelier et vitrine » (ligne 25) et §1 « UI system » (ligne 36)
- Texte actuel : les deux passages définissent atelier et vitrine.
- Proposé : garder les deux.
- Raison : l'en-tête annonce le changement (orientation), §1 donne la définition de référence ; la répétition aide le lecteur qui arrive par l'en-tête. Impact : 0 mot.

### DESIGN.md

**S-D1 · QUESTION** — §7.7, dernier paragraphe, contre EXPERIENCE §2.10 puce 1
- Texte actuel (DESIGN, ligne 202) : `Le même `duration-stepper` (sans texte de plage, départ inconnu) figure dans la fenêtre de création ou de modification d'un événement et dans l'éditeur de séance, sous le champ de date, libellé « Durée », prérempli à 1 créneau.`
- Texte actuel (EXPERIENCE, ligne 165) : `Si la date est déjà saisie, il écrit la plage en clair (« sam. 14 après-midi → sam. 14 soir ») ; sinon, la traduction en jours.`
- Proposé : aligner DESIGN sur la décision retenue. Si c'est EXPERIENCE : `Le même `duration-stepper` figure dans la fenêtre de création ou de modification d'un événement et dans l'éditeur de séance, sous le champ de date, libellé « Durée », prérempli à 1 créneau ; son texte en clair donne la plage si la date est saisie, sinon « soit N jours ».`
- Raison : contradiction directe entre les deux documents sur le même composant ; le développeur ne peut pas suivre les deux. Impact : ~+5 mots.

**S-D2 · MOVE** — en-tête, ordre des deux paragraphes (lignes 111 et 113)
- Texte actuel : `**Mise à jour du 2026-10-20, après l'architecture** : …` placé **avant** `**Ce document est un delta** du delta Palier 10 …`.
- Proposé : placer le paragraphe « Mise à jour » après « Ce document est un delta », comme dans EXPERIENCE.md.
- Raison : le lecteur a besoin de savoir ce qu'est le document avant de lire ce qui a changé ; et les deux documents jumeaux suivent alors le même ordre. Impact : 0 mot.

**S-D3 · MOVE / CONDENSE** — §7.1, ordre et doublon des puces (lignes 160-164)
- Texte actuel (extrait de la puce « Déplié / colonne ») : `ligne « N'ont pas … » (clé existante `poll.missing_prefix`) **pour l'organisateur seulement** (« {n} n'ont pas encore répondu » pour les autres participants, et partout dans la vitrine), puis les actions de l'organisateur`
- Proposé :
  1. dans la puce « Déplié / colonne », remplacer `(« {n} n'ont pas encore répondu » pour les autres participants, et partout dans la vitrine)` par `(« {n} n'ont pas encore répondu » pour les autres participants)` — la vitrine a sa propre puce ;
  2. déplacer la puce « Sous les actions de l'organisateur, un lien texte « Proposer des dates pour un autre rendez-vous ». » juste après « Déplié / colonne » ;
  3. déplacer la puce « Un créneau candidat de plusieurs créneaux s'écrit … » juste après le lien, avant « Remplace, tant que la Destinée est active … ».
- Raison : les ajouts ont été mis en queue ; l'ordre proposé suit la lecture du plateau (replié → déplié → actions → lien → lignes longues → cas particuliers colonne MJ et vitrine) et retire un doublon sur la vitrine. Impact : ~-5 mots.

**S-D4 · CONDENSE (scinder)** — §7.8, paragraphe unique (ligne 206)
- Texte actuel : `Option 2A de la planche. En Mois comme en Semaine, chaque bande couverte prend le marquage de son rang (vote ou séance) ; un `connector` relie … Agenda : une seule ligne « départ → fin » ; rail : la plage sur chaque jour couvert, « (suite) » hors du premier.`
- Proposé :
  ```
  Option 2A de [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html). En Mois comme en Semaine :

  - **Bandes** : chaque bande couverte prend le marquage de sa nature (vote ou séance) ; le reste du jour garde ses bandes normales.
  - **Connecteur** : un `connector` relie la dernière bande d'un jour à la première du lendemain ; au changement de semaine, il sort par le bord droit du dimanche et entre par le bord gauche du lundi.
  - **Nom** : sur la première bande **visible** de chaque ligne de semaine et de chaque mois, précédé de « ← » si la plage a commencé avant.
  - **Chevauchement** : une bande couverte par plusieurs plages du même vote porte « ×{n} » en 9 px, `{colors.text}`, coin supérieur droit.
  - **Aperçu** : la sélection allume toutes les bandes de la plage en état preview.

  Agenda : une seule ligne « départ → fin » ; rail : la plage sur chaque jour couvert, « (suite) » hors du premier.
  ```
- Raison : un bloc de 150 mots porte six règles visuelles ; la liste les rend vérifiables une à une en revue de maquette. Inclut les corrections P-D3 et P-D4. Impact : ~+8 mots.

**S-D5 · QUESTION** — yaml `span-bands.label`, contre §7.8 et EXPERIENCE §2.9
- Texte actuel (yaml, ligne 105) : `label: "nom sur la première bande seulement, 8,5-9,5 px, tronqué"`
- Texte actuel (§7.8) : `le nom s'écrit sur la première bande **visible** de chaque ligne de semaine et de chaque mois, précédé de « ← » si la plage a commencé avant`
- Proposé (si §7.8 fait foi) : `label: "nom sur la première bande visible de chaque ligne de semaine et de chaque mois (précédé de « ← » si la plage a commencé avant), 8,5-9,5 px, tronqué"` ; et en EXPERIENCE §2.9 (ligne 145) : « le nom s'écrit sur la première bande visible ».
- Raison : trois formulations de la même règle ; « seulement » dans le yaml contredit la répétition à chaque ligne de semaine. Impact : ~+15 mots.

**S-D6 · QUESTION** — yaml `span-bands.covered`, contre §2
- Texte actuel (yaml, ligne 103) : `vote = fond {colors.status-todo} 16-18 %` ; (§2, ligne 127) : `fond `{colors.status-todo}` à 16 %`.
- Proposé : une seule valeur (ou préciser quand 18 % s'applique).
- Raison : une fourchette dans un token est inexploitable en CSS ; §2 et le yaml doivent dire la même chose. Impact : 0 mot.

**S-D7 · QUESTION** — paragraphe « Mise à jour » (ligne 111)
- Texte actuel : `**Mise à jour du 2026-10-20, après l'architecture** : trois composants pour les plages longues et l'échéance (`duration-stepper`, `deadline-field`, `span-bands`, §7.7 et §7.8), toujours sans token de thème.`
- Proposé : compléter le relevé, par exemple : `… toujours sans token de thème. Retouches : `rendezvous-picker` passe en menu ancré sur ordinateur (§7.5) ; dans la vitrine, plateau sans noms et « Modifier les dates » vers l'atelier (§7.1, §7.4).`
- Raison : la mise à jour a aussi modifié `rendezvous-picker` (fenêtre « Votre accord » → menu ancré), §7.1 et §7.4 ; un lecteur qui ne relit que le paragraphe de mise à jour les manque. Impact : ~+30 mots.

**S-D8 · MOVE** — §8, place du dernier « Do » (ligne 220)
- Texte actuel : `- **Do** montrer la plage entière dès qu'on touche un départ : l'aperçu est le garde-fou contre une mauvaise durée.` placé après les « Don't ».
- Proposé : le placer après le deuxième « Do » (ligne 215), avant le premier « Don't ».
- Raison : la liste groupe les Do puis les Don't ; l'ajout en queue casse ce regroupement. Impact : 0 mot.

**S-D9 · MERGE** — §7.5, forme mobile absente (ligne 189)
- Texte actuel : `Sur ordinateur (≥ 1024 px) : menu ancré, une ligne = un choix, sans bouton de confirmation.`
- Proposé : `Tiroir modal sous 1024 px, menu ancré au-delà ; une ligne = un choix, sans bouton de confirmation.`
- Raison : §7.2 donne les deux formes, §7.5 n'en donne qu'une alors que le yaml et §4 précisent le tiroir ; même schéma d'une section composant à l'autre. Impact : ~+3 mots.

### Synthèse structure

22 propositions (13 EXPERIENCE, 9 DESIGN), dont 6 `QUESTION` qui demandent un arbitrage de contenu (S-D1, S-D5, S-D6 et S-D7 en priorité). Réduction estimée si tout est accepté : environ 60 mots retirés pour 65 ajoutés sur les ~10 300 mots des deux documents (EXPERIENCE 7 594, DESIGN 2 709), soit un effet net nul : le gain visé est le repérage et la cohérence, pas la longueur. Aucun objectif de longueur fourni. Aucun sacrifice de compréhension : rien d'explicatif n'est coupé ; S-E13 est explicitement gardé.

---

## Lentille prose

### EXPERIENCE.md

**P-E1** — en-tête, puce « Atelier et vitrine » (ligne 25)
- Texte actuel : `le calendrier personnel (la « vitrine ») suit et conclut les votes, et y aiguille.`
- Proposé : `le calendrier personnel (la « vitrine ») suit et conclut les votes, et aiguille vers l'atelier.`
- Raison : « y » renvoie à l'atelier, nommé une phrase plus haut ; le lecteur le rattache à « les votes ».

**P-E2** — en-tête, puce « Plages longues » (ligne 27)
- Texte actuel : `un rendez-vous peut durer plusieurs créneaux, réglés au compteur, affichés en bandes reliées`
- Proposé : `un rendez-vous peut durer plusieurs créneaux : la durée se règle au compteur, la plage s'affiche en bandes reliées`
- Raison : « réglés » et « affichés » s'accordent avec « créneaux », alors qu'on règle la durée et qu'on affiche la plage.

**P-E3** — §5.3 (ligne 272)
- Texte actuel : `Sélectionnée, la grille se place sur sa période.`
- Proposé : `Quand une fenêtre est sélectionnée, la grille se place sur sa période.`
- Raison : participe en suspens : grammaticalement, c'est la grille qui est sélectionnée.

**P-E4** — §5.1, libellés d'états (lignes 255-256) ; aussi §2.4 (lignes 86, 88)
- Texte actuel : `| Actif, avant l'échéance |` puis `| Actif, fin du vote passée |`
- Proposé : `| Actif, avant la fin du vote |` puis `| Actif, fin du vote passée |`
- Raison : deux mots pour la même borne dans deux lignes voisines du même tableau. « Échéance » reste juste comme terme de concept ailleurs, mais dans ce tableau la paire doit être symétrique. Consider : choisir un terme unique pour la prose de concept (échéance) et garder « Fin du vote » pour les libellés ?

**P-E5** — §2.4, avant-dernière puce (ligne 90)
- Texte actuel : `Sans sondage ouvert, la puce reste **absente** (Story 36.9, AC10), validé par l'utilisateur le 2026-10-20 ; le PRD FR-7 est ajusté en conséquence.`
- Proposé : `Sans sondage ouvert, la puce reste **absente** (Story 36.9, AC10) : choix validé par l'utilisateur le 2026-10-20 ; le PRD FR-7 est ajusté en conséquence.`
- Raison : « validé » ne s'accorde avec rien (« la puce » est féminin).

**P-E6** — §2.5, puce « Qui n'a pas répondu » (ligne 99)
- Texte actuel : `et, pour l'organisateur, « voir qui » qui ouvre l'atelier sur ce vote.`
- Proposé : `et, pour l'organisateur, le lien « voir qui », qui ouvre l'atelier sur ce vote.`
- Raison : « voir qui » qui » se lit mal (double « qui ») ; le mot « lien » dit aussi la nature du contrôle.

**P-E7** — §2.3, point 1, sous-puce vitrine (ligne 73)
- Texte actuel : `Annuler laisse aussi à l'atelier, calendrier normal (Destinée rétablie si elle était active)`
- Proposé : `Annuler laisse aussi l'utilisateur dans l'atelier, en calendrier normal (Destinée rétablie si elle était active)`
- Raison : « laisser à » sans complément d'objet est elliptique au point d'être ambigu.

**P-E8** — §2.2 point 4 (ligne 65)
- Texte actuel : `Hors composer, des fenêtres d'un créneau.`
- Proposé : `Hors composer, les fenêtres durent un créneau.`
- Raison : phrase sans verbe, après une phrase complète : on ne sait pas si c'est une règle ou une remarque.

**P-E9** — §2.8, point 1 (ligne 134) et Règles (ligne 139)
- Texte actuel : `le + se grise et une ligne le dit.` ; `une case journée déjà posée est retirée, et une ligne le dit`
- Proposé : `le + se grise et un message l'explique (§3.1).` ; `une case journée déjà posée est retirée, et un message l'explique (§3.1)`
- Raison : « une ligne le dit » est vague (quelle ligne, où ?) ; le renvoi à §3.1 mène au texte exact (« Plafond », « Journée retirée »).

**P-E10** — §2.9, puce « Disponibilité » (ligne 158)
- Texte actuel : `Un chevauchement avec un autre rendez-vous se voit, il n'est jamais refusé.`
- Proposé : `Un chevauchement avec un autre rendez-vous se voit mais n'est jamais refusé.`
- Raison : deux propositions juxtaposées par une virgule ; le lien d'opposition est le sens voulu.

**P-E11** — §2.10, puce 3 (ligne 167)
- Texte actuel : `On corrige la durée à tout moment : dans le composer avant la date ; une fois la date fixée,`
- Proposé : `On corrige la durée à tout moment : dans le composer tant que la date n'est pas fixée ; une fois la date fixée,`
- Raison : « avant la date » se lit comme « avant le jour du rendez-vous ».

**P-E12** — §2.6 (ligne 106)
- Texte actuel : `Perdu au rechargement de la page.`
- Proposé : `Le filtre est perdu au rechargement de la page.`
- Raison : le sujet implicite est à quatre phrases de distance ; le participe s'accorde au masculin alors que la phrase précédente parle de « La pastille ».

**P-E13** — §3.1, libellé de ligne (ligne 190)
- Texte actuel : `| Vote clos, atelier (raison connue) |`
- Proposé : `| Vote clos, atelier : date fixée |`
- Raison : les lignes 204-205 ajoutent « annulé » et « autre raison », qui sont aussi des raisons connues ; le libellé de la ligne 190 ne la distingue plus. Seule la colonne « Usage » change, pas les libellés.

**P-E14** — §3.1, paragraphe sous le tableau (ligne 215)
- Texte actuel : `Les libellés d'accessibilité et de mesure (« Ranger la colonne », … , libellé vertical du dock) aussi : raison « libellé d'accessibilité ou de mesure, volontairement hors thème ».`
- Proposé : `Les libellés d'accessibilité (« Ranger la colonne », … , libellé vertical du dock) y entrent aussi : raison « libellé d'accessibilité ou de mesure, volontairement hors thème ».`
- Raison : « aussi » sans verbe force à remonter à la phrase précédente ; et « de mesure » est déjà le nom du groupe précédent (« Durée », unités…), ce qui brouille la frontière entre les deux groupes.

**P-E15** — §3.3 (ligne 230)
- Texte actuel : `JDR : « séance sans date », ou « séance au vote ouvert » (choix ouvert depuis une fenêtre de l'automate, composer prérempli). Mode soirée : seule une soirée isolée peut figurer, « soirée sans date » dans les trois thèmes.`
- Proposé : `JDR : « séance sans date », ou « séance au vote ouvert » (quand le choix part d'une fenêtre de l'automate ; composer prérempli). Mode soirée : seule une soirée isolée peut y figurer, « soirée sans date » dans les trois thèmes.`
- Raison : « choix ouvert » répète « ouvert » dans un autre sens que « vote ouvert » ; « figurer » sans complément reste en suspens.

**P-E16** — §8, UJ-2 (ligne 314)
- Texte actuel : `elle glisse sur cinq jours, choisit « Soir », puis un samedi, « Après-m. ».`
- Proposé : `elle glisse sur cinq jours, choisit « Soir », puis touche un samedi et choisit « Après-m. ».`
- Raison : l'ellipse fait de « un samedi » un second complément de « choisit » ; le geste (toucher) disparaît.

**P-E17** — §8, UJ-5 (ligne 318)
- Texte actuel : `Proposer des dates : le composer reprend 6 ; il touche un vendredi soir, l'aperçu allume vendredi soir → dimanche après-midi ; deux autres vendredis.`
- Proposé : `Proposer des dates : le composer reprend la durée de 6 créneaux ; il touche un vendredi soir, l'aperçu allume vendredi soir → dimanche après-midi ; puis deux autres vendredis.`
- Raison : « reprend 6 » sans unité ; « deux autres vendredis » sans verbe se lit comme une liste.

**P-E18** — §8, UJ-6 (ligne 319)
- Texte actuel : `Calendrier de partie, composer pour la séance à dater ; Durée + : « 2 créneaux · sam. après-midi → sam. soir ».`
- Proposé : `Calendrier de partie, composer pour la séance à dater ; il touche + sur Durée : « 2 créneaux · sam. après-midi → sam. soir ».`
- Raison : « Durée + : » est une notation, pas une action ; les autres parcours décrivent les gestes.

**P-E19** — §4, ligne `app-compose-bar` (ligne 243)
- Texte actuel : `raison de blocage (2 minimum)`
- Proposé : Consider : `raison de blocage (moins de 2 créneaux)` ?
- Raison : « 2 minimum » ne dit pas de quoi.

**P-E20** — §7, puce compteur de durée (ligne 306)
- Texte actuel : `« Fin du vote » est un champ nommé dont la ligne d'explication est la description.`
- Proposé : Consider : `« Fin du vote » est un champ nommé dont la ligne d'explication sert de description accessible.` ?
- Raison : « la description » sans qualificatif se lit au sens courant ; le sens voulu est la description ARIA.

**P-E21** — §11, items 3 et 7 (lignes 355, 359)
- Texte actuel : `Construites depuis les tableaux de ce document.` ; `Construites depuis les tableaux §2.8 à §2.10.`
- Proposé : `Construites à partir des tableaux de ce document.` ; `Construites à partir des tableaux §2.8 à §2.10.` (sans objet si S-E7 est accepté : la correction passe dans l'item fusionné).
- Raison : « depuis » marque le temps ou le lieu ; « à partir de » marque la source.

### DESIGN.md

**P-D1** — §7.7 et §7.8, première phrase (lignes 197 et 206)
- Texte actuel : `Option 1A de la planche.` ; `Option 2A de la planche.`
- Proposé : `Option 1A de [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html).` ; idem pour 2A.
- Raison : dans §7, « la planche » renvoie jusqu'ici à `proposition-tiroir-destinee-mobile.html` (§7.1, §7.2) ; ici c'en est une autre, nommée seulement dans l'en-tête.

**P-D2** — §7.1, dernière puce (ligne 164)
- Texte actuel : `Un créneau candidat de plusieurs créneaux s'écrit « ven. 6 soir → dim. 8 après-midi » dans sa `candidate-slot-row`.`
- Proposé : `Un créneau candidat long (plusieurs créneaux) s'écrit « ven. 6 soir → dim. 8 après-midi » dans sa `candidate-slot-row`.`
- Raison : « créneau … de plusieurs créneaux » se lit comme une contradiction ; « créneau candidat long » est le terme d'EXPERIENCE §2.9.

**P-D3** — §7.8 (ligne 206)
- Texte actuel : `chaque bande couverte prend le marquage de son rang (vote ou séance)`
- Proposé : `chaque bande couverte prend le marquage de sa nature (vote ou séance)`
- Raison : « rang » évoque un ordre ou une position, pas le type de rendez-vous.

**P-D4** — §7.8 (ligne 206)
- Texte actuel : `sur la première bande **visible** de chaque ligne de semaine et de chaque mois`
- Proposé : Consider : `sur la première bande **visible** de chaque ligne de semaine (vue Mois) et de chaque vue affichée` ?
- Raison : « de chaque mois » est ambigu : premier jour du mois civil, ou début de la vue Mois affichée ? À trancher par l'auteur.

**P-D5** — §7.1, puce vitrine (ligne 163)
- Texte actuel : `« Modifier les dates » y est un lien vers l'atelier, même apparence de bouton.`
- Proposé : `« Modifier les dates » y mène à l'atelier mais garde l'apparence du bouton.`
- Raison : l'apposition finale est elliptique ; et « est un lien » laisse croire à un rendu de lien texte, ce que la fin de phrase dément.

**P-D6** — §7.1, puce « Replié » (ligne 159), contre EXPERIENCE §2.5 (ligne 97)
- Texte actuel (DESIGN) : `« n / N · départ → fin · x oui · fin du vote » (créneau unique : « n / N · date · moment · … »)`
- Texte actuel (EXPERIENCE) : `« n / N · {départ} → {fin} · x oui · fin du vote … » (pour un créneau unique : « n / N · {date} {moment} · x oui · fin du vote … »)`
- Proposé : Consider : aligner DESIGN sur EXPERIENCE (placeholders entre accolades, `{date} {moment}` sans « · » entre les deux) ?
- Raison : le séparateur « · » entre date et moment n'est pas le même d'un document à l'autre ; le développeur ne sait pas lequel suivre.

**P-D7** — §8, « Don't » option 2B (ligne 219)
- Texte actuel : `elle cacherait les bandes dessous et le moment exact du départ et de la fin.`
- Proposé : `elle cacherait les bandes qu'elle recouvre, ainsi que le moment exact du départ et de la fin.`
- Raison : « les bandes dessous » (adverbe employé comme adjectif) est familier et se lit en deux temps.
