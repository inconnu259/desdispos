---
title: "Rapprochement UX ↔ PRD — Paliers 10.6 à 10.8"
created: 2026-11-01
ux: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/ (DESIGN.md, EXPERIENCE.md, .memlog.md, mockups/)
prd: _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/ (prd.md FR-1 à FR-14, addendum.md)
---

# Rapprochement UX ↔ PRD — Paliers 10.6 à 10.8

Lecture croisée de `DESIGN.md`, `EXPERIENCE.md`, `.memlog.md` (entrées récentes prioritaires),
`mockups/key-planche-10-6-10-8.html`, `mockups/icones/icones-retenues.json` et des planches d'icônes 2, 2b, 3, 4 et 4b,
face au PRD (FR-1 à FR-14, NFR transverses) et à son addendum.

**Vérifications techniques faites, sans écart :**
- Les 90 SVG de sens de `icones-retenues.json` sont identiques, au caractère près (hors commentaires), aux variantes
  retenues par le memlog : Grimoire 1 V2, 7/19/20 V3, 8 V3, 14 V2, 24 V4, 27 V2 ; Forêt 1 V2, 2 V1, 7/19/20 V2, 8 V2,
  24 V1 ; Atelier 1 V1, 2 V1, 7/19/20 V1, 8 V1, 24 V1 ; tous les autres concepts en version unique.
- Les fichiers de `mockups/icones/<thème>/*.svg` sont identiques au JSON. 30 icônes par thème, 37 communes, mêmes noms
  de fichier dans les trois thèmes.
- Règles du composant `icon` respectées : `viewBox 0 0 32 32` partout, aucun `id`, `mask`, `clipPath` ni `script` ;
  une seule zone pleine par icône de sens, sauf `favori-vide` (zéro, c'est l'état) ; les communes sans zone pleine sont
  bien des glyphes simples (et `dispo-non`, `email`, `lien`…, conformes à la règle « trait seul »).
- Aucun dessin en double à l'intérieur d'un thème.

Notation : **[maj]** écart qui change le sens ou bloque une story ; **[min]** imprécision ou manque de détail.

---

## 1. Couverture des FR — trous par FR

Pour chaque FR : ce qui est couvert, puis les conséquences testables sans réponse UX (surface + comportement).

### FR-1 — Allumer et éteindre le mode déclaration
Couvert : bouton (§3.1), état allumé « Terminer » + bandeau (§3.2), exclusion avec Composer et Destinée (§3.4),
libellé distinct de « Proposer des dates », vue Agenda, `aria-pressed` (§8).

- **1.1 [min] Calendriers concernés non énumérés.** PRD : « dans chaque calendrier où la déclaration existe
  aujourd'hui ». EXPERIENCE §3.1 parle de « la ligne `.calendar-controls` » sans dire lesquels (calendrier personnel,
  calendrier d'une partie, d'un groupe ?). *Correctif :* lister les calendriers dans §2 et §3.1, et dire si le bouton
  est absent là où la déclaration n'existe pas.
- **1.2 [maj] Sortie de page.** PRD : « Le mode ne survit pas à la sortie de la page. » Rien dans §3. *Correctif :*
  ajouter à §3.3 : « Quitter la page éteint le mode ; une sélection non validée est abandonnée sans confirmation. »
- **1.3 [maj] Raccourcis clavier en mode déclaration.** PRD : `Espace`, `1/2/3`, `Maj`+flèches, `Entrée`, `Échap`
  restent valables. §3.3 ne cite que `Entrée`. Le rôle d'`Échap` en mode déclaration (vider la sélection ? éteindre le
  mode ?) n'est pas fixé. *Correctif :* ajouter une ligne à §3.3 ou §8 : « Les raccourcis existants restent ; `Échap`
  vide la sélection, un second `Échap` (ou « Terminer ») éteint le mode » (à trancher).

### FR-2 — Sélectionner au tap
Couvert : tap bande / numéro du jour, glissement direct, mode qui reste allumé après validation, « Annuler »,
barre collante.

- **1.4 [min] Retrait du dernier créneau.** PRD : « retirer le dernier créneau sélectionné ne l'éteint pas non plus
  (contrairement à AC17) ». Non dit ; on ne sait pas non plus si la barre disparaît quand la sélection redevient vide.
  *Correctif :* §3.3 : « Retirer le dernier créneau masque la barre ; le mode reste allumé. »
- **1.5 [min] Double-clic.** PRD : « Un double-clic vaut deux taps. » Absent. *Correctif :* une demi-phrase en §3.3.
- **1.6 [maj] Rail et repère de date.** PRD : « le rail ne suit pas la sélection ; le repère de date courante (AC16)
  suit le dernier créneau touché. » Absent de §3. *Correctif :* §3.3 : « En mode déclaration, le rail reste sur le jour
  affiché ; le repère de date suit le dernier créneau touché. »
- **1.7 [min] Confirmation de validation.** La snackbar « 4 créneaux déclarés disponibles » n'a ni singulier, ni
  version « indisponibles », ni variante par thème (voir 2.2). *Correctif :* table à trois thèmes en §3.3.

### FR-3 — Conserver les raccourcis
Couvert implicitement par §3.4 (« mode lecture : rien ne change »).

- **1.8 [min] Composer non modifié.** Le PRD demande explicitement que le Composer (Story 45.3) ne change pas ; §3.4 ne
  parle que du mode lecture. *Correctif :* ajouter « Le geste du Composer (45.3) n'est pas modifié. »

### FR-4 — Signaler les dispos à déclarer
Couvert : bandeau unique en tête du tableau de bord, textes par thème, action vers le calendrier personnel en mode
déclaration, disparition en direct (`user:{id}`).

- **1.9 [maj] Population concernée.** PRD : « tout membre d'au moins une partie active, de JDR ou de soirée ». §3.5
  ne dit pas qui voit le bandeau ; un utilisateur sans partie active ne doit pas le voir. *Correctif :* première puce
  de §3.5 : « Visible pour tout membre d'au moins une partie active (JDR ou soirée). »
- **1.10 [min] Retour du rappel et contraintes récurrentes.** PRD : il « revient chaque fois que c'est de nouveau le
  cas » ; une contrainte récurrente compte. Non dit (règle métier, mais l'UX doit dire si le retour se fait en direct
  ou au prochain affichage). *Correctif :* une puce en §3.5.
- **1.11 [min] Cohabitation avec le bandeau de la Destinée.** §3.5 reprend le patron `destinyNotice` sans dire l'ordre
  si les deux bandeaux sont présents. *Correctif :* fixer l'ordre (rappel des dispos sous la Destinée, par exemple).

### FR-5 — Faire taire le rappel
Couvert : « Ne plus me le rappeler », snackbar avec « Annuler », case de la page Compte cochée par défaut.

- **1.12 [min] Portée du choix.** « Mémorisé sur le compte, tous appareils » : hors de portée UX (stockage), à laisser
  à l'architecture ; mais « ne vaut que pour ce signal » mérite une phrase, pour qu'on ne cherche pas de case « tous
  les rappels ». *Correctif :* §3.6 : « Cette case ne concerne que ce rappel. »

### FR-6 — Icônes de sens par thème
Couvert : 29 concepts du PRD × 3 thèmes (favori en deux états = 30), un sens = une icône (§6), `currentColor`.
Retouches ✱ respectées dans les dessins (écureuil, bâton de mage, calice seul, baguettes croisées à étincelles).

- Pas de trou fonctionnel. Écarts de description et d'intention : sections 3 et 4.

### FR-7 — Icônes utilitaires communes
Couvert : toute la liste minimale du PRD est dans `communes/` ; une seule `telecharger`.

- **1.13 [maj] « Note partagée ou non ».** PRD : quatre paires à deux états, dont « verrou ouvert ou fermé » **et** « note
  partagée ou non ». EXPERIENCE §6 rattache 🔒 🔓 « des notes » au cadenas, ce qui fait porter au cadenas deux sens
  (verrou et partage d'une note) ou suppose qu'ils n'en font qu'un. *Correctif :* dire en §6 quelle paire porte
  « partagée / privée » (cadenas, ou `oeil` / `oeil-barre`), et vérifier que le cadenas ne sert pas aussi à autre chose.

### FR-8 — Lever les surcharges
Couvert : terminé / signal, compte / joueur, MJ / admin, suivant / ouvrir, accepter / actif.

- **1.14 [min] Icône de repli.** PRD : « y compris en icône de repli ». Aucune icône de repli n'est désignée.
  *Correctif :* nommer l'icône utilisée quand un concept n'a pas d'icône (aucune, ou `information`), en §6.

### FR-9 — Plus d'emoji ni de caractère-icône
Couvert : liste complète des caractères du PRD (§6, table de correspondance DESIGN).

- **1.15 [min] Fond clair.** NFR : lisibles « sur fond clair comme sombre de chaque thème ». Toutes les planches sont
  sur fond sombre (`color-scheme: dark`). *Correctif :* bande sur fond clair dans une planche, ou mention explicite
  que les trois thèmes n'ont pas de fond clair.
- **1.16 [min] Retrait de la police Material.** Hors de portée UX (technique) ; l'inventaire complet de §6 / DESIGN en
  est la condition. Rien à ajouter.

### FR-10 — « Ma situation » sur les cartes
Couvert : six valeurs, tons, ligne en bas de séance, chapitre = prochaine séance, badge d'état sans appel à l'action.

- **1.17 [maj] Cas non couverts.** Pas de valeur pour : séance passée sans participation du joueur ; inscriptions
  fermées et joueur non inscrit ; vote clôturé sans date ; séance à dater sans vote côté joueur ; chapitre sans
  séance à venir. *Correctif :* compléter la table de §4.1 (« aucune pastille » est une réponse valable).
- **1.18 [maj] Temps réel.** PRD : « La pastille suit les changements faits par les autres, sans recharger la page »
  (et NFR transverse). EXPERIENCE ne le dit que pour le rappel (§3.5). *Correctif :* §4.1 : « suit le signal `changed`
  de la partie (`RealtimeService`) ».

### FR-11 — Fiche de scénario « situation d'abord »
Couvert : encadré de situation en tête de chaque séance, actions joueur (voter, participer, se désinscrire) et MJ
(lancer le vote, fixer la date).

- **1.19 [min] Documents joints.** L'ordre de §5.1 (joueur) ne place pas les documents joints que le PRD veut
  inchangés. *Correctif :* les insérer dans l'ordre de §5.1.

### FR-12 — Vote en résumé
Couvert : mes réponses, meilleur créneau ou son absence, plage, échéance, noms (MJ) / nombre (joueur), « Voter dans
le calendrier », « Fixer la date… », « Clôturer le vote », lien vers la Destinée, date en grand, disparitions ⚠️.

- **1.20 [min] Vote clôturé sans date.** Ce que montre le résumé entre « Clôturer » et « Fixer » n'est pas dit.
  *Correctif :* une ligne en §5.3.
- **1.21 [min] « Lancer le vote ».** PRD : il « mène au Composer comme aujourd'hui ». §5.2 nomme le bouton sans sa
  destination. *Correctif :* « + Lancer le vote » ouvre le Composer.
- **1.22 [min] Temps réel du résumé.** Même remarque que 1.18.

### FR-13 — Ouverture sur la suite des séances
Couvert : ordre et onglet par défaut par rôle et par forme, exception du personnage à créer, « + Inviter ».

- **1.23 [min] Autres accès internes.** PRD : « Les accès internes qui ouvrent un onglet précis… ouvrent toujours le
  bon onglet ». Seul « + Inviter » est cité. *Correctif :* lister les autres (signal « Créer son héros », liens des
  notifications, retour depuis la Destinée) ou dire qu'aucun autre n'existe.

### FR-14 — Couverture depuis la bannière
Couvert : pastilles « Changer » / « Retirer », réservées à qui peut modifier, enregistrement immédiat avec « Annuler ».

- **1.24 [min] Sans couverture.** « Retirer » est absente ; ce que porte « Changer » quand il n'y a rien (libellé
  « Ajouter une couverture » ? bannière générée ?) n'est pas dit. *Correctif :* une ligne en §4.3.
- **1.25 [min] Vérification du formulaire (Story 38.3).** Hors de portée UX (vérification de livraison).

---

## 2. Contradictions UX ↔ PRD

- **2.1 [maj] Forme et libellé du rappel.** PRD FR-4 : « un **signal à traiter** « Dispos à déclarer » » ; Glossaire :
  signal à traiter = « pastille existante ». EXPERIENCE §3.5 : « un **bandeau** … et non une pastille » ; le libellé
  « Dispos à déclarer » n'apparaît dans aucun texte d'interface (seulement en commentaire du composant
  `reminder-banner`). *Correctif :* soit amender le PRD (« un rappel, en bandeau »), soit donner au bandeau un titre
  « Dispos à déclarer » par thème ; dans les deux cas, lister l'écart en §9.
- **2.2 [maj] Libellés dans les trois thèmes.** PRD NFR transverse : « Chaque nouveau libellé (bouton de déclaration,
  bandeau, signal, pastilles, boutons du vote) existe dans les trois thèmes, avec le ton de chacun. » EXPERIENCE §3.1 :
  bouton « Libellé identique dans les trois thèmes » ; §4.1 pastilles, §5.3 résumé et boutons du vote, snackbars
  (§3.3, §3.5 « Vous pourrez le réactiver », §4.3 « Couverture changée ») en une seule version, au vouvoiement, alors
  que la Forêt tutoie. Seuls les bandeaux (§3.2, §3.5) sont déclinés. *Correctif :* tables à trois colonnes pour les
  pastilles, le résumé, l'encadré et les snackbars ; pour le bouton, garder le choix « dispos non thématisées » mais le
  noter comme écart assumé au PRD.
- **2.3 [maj] Mode soirée modifié.** PRD NFR : « Hors icônes (10.7) et bannière (FR-14), aucun écran du mode soirée ne
  change. » EXPERIENCE §4.1 et §9 : la carte d'événement passe « Vote à faire » de `status-live` à `status-todo`.
  Validé par l'utilisateur (memlog), mais contraire au PRD. *Correctif :* amender le NFR du PRD (exception « alignement
  du ton de Vote à faire sur la spec du Palier 10 »), ou faire de ce correctif une story à part.
- **2.4 [maj] Bannière dans les deux modes.** PRD FR-14 : « vaut pour les deux modes puisque la bannière est commune ».
  EXPERIENCE §2 (« Page d'une partie de JDR … FR-13, FR-14 »), §4.3 (sous « Cartes et onglets d'une partie de JDR ») et
  §9 ne parlent que du JDR. *Correctif :* §2 et §4.3 : « page d'une partie, JDR et soirée » ; ajouter en §9 « Page d'une
  soirée : pastilles sur la bannière ».
- **2.5 [maj] Libellés des onglets.** PRD FR-13 : « arrive toujours sur **Fiches** », « « + Inviter » vers
  **Invitations** », quête unique « le MJ arrive sur son onglet **Scénario** ». EXPERIENCE §4.2 : « Folios »,
  « Missives », « Chapitre ». *Correctif :* en §4.2, écrire les concepts (Fiches, Invitations, Scénario) et donner les
  libellés de thème en note (Grimoire : Folios, Missives…) ; trancher « Scénario » contre « Chapitre » pour la quête
  unique.
- **2.6 [min] Parcours d'Hugo, meilleur créneau.** PRD UJ-3 : résumé « meilleur créneau : samedi soir ». EXPERIENCE §7
  (Hugo, étape 3) : « le résumé montre « Pas encore de meilleur créneau » ». La planche E montre « samedi 7 novembre,
  soir — 3 oui ». *Correctif :* §7 → « Meilleur créneau pour l'instant : samedi soir — 3 oui ».
- **2.7 [min] Écu Admin.** PRD FR-8 : « L'écu Admin déjà présent sur les avatars (Palier 10) est **repris** dans le
  nouveau style. » DESIGN : l'admin devient clé de bibliothécaire / couronne de bois de cerf / galons, y compris en
  badge de 14 px sur l'avatar (planche 2b). L'écu disparaît. *Correctif :* noter en DESIGN, « Icônes », que `role-admin`
  remplace l'écu du Palier 10, et le lister en §9.
- **2.8 [min] Caractères tenant lieu d'icône.** PRD FR-9 : « Aucun emoji ni caractère spécial ne sert d'icône. »
  EXPERIENCE §5.3 introduit « Voir dans le calendrier **→** » ; §4.2 « **+** Inviter », planche F « **+** Ajouter une
  séance » ; la planche B/C montre « **‹** Novembre 2026 **›** » (absent de la table de correspondance) ; §3.1 parle
  encore de « la puce **✦** ». *Correctif :* retirer « → » (ou le remplacer par `ouvrir`), « + » → `ajouter`, ajouter
  ‹ › à la table (→ `precedent` / `suivant`), et écrire « la puce de la Destinée » en §3.1.
- **2.9 [min] Réordonnancement de la fiche joueur.** PRD FR-11 n'agit que **dans** chaque séance et dit « le reste du
  contenu de la fiche … est inchangé ». EXPERIENCE §5.1 remonte toutes les séances au-dessus de la description ⚠️
  (validé par l'utilisateur, memlog). *Correctif :* reporter ce choix dans le PRD (FR-11) pour que les stories ne le
  contestent pas.
- **2.10 [min] « Autre… ».** PRD FR-2 et EXPERIENCE §3.3 : « Autre… ». Planche B : « Autrement… ». *Correctif :*
  aligner la planche (ou dire que « Autrement… » est le libellé Grimoire existant).
- **2.11 [min] (interne UX) Hypothèses.** L'en-tête de la planche clé dit « Les libellés marqués [ASSUMPTION] dans
  EXPERIENCE.md le restent ici », alors que le memlog (dernière entrée) les a retirées, validées. *Correctif :* mettre la
  phrase à jour à la prochaine retouche de la planche.

---

## 3. Intentions qualitatives perdues

- **3.1 Retouches de l'utilisateur non tracées.** L'addendum marque ✱ quatre retouches, reprises en FR-6 : Forêt
  Compagnons = petit animal (écureuil) ; Grimoire joueur = bâton de mage **et** membres = baguettes croisées, « pour
  qu'ils ne se confondent pas » ; Grimoire jeux = « une relique seule, sans coffret » ; Grimoire membres = « symbole
  magique ». Les dessins les respectent (orbe plein sur le bâton, étincelles aux deux pointes des baguettes, calice
  seul), mais le tableau DESIGN n'en dit rien : ni l'origine, ni la règle de non-confusion bâton / baguettes, ni le
  « sans coffret » qui oppose le calice au coffre de la Forêt. *Correctif :* une note sous le tableau (« ✱ retouches de
  l'utilisateur, à ne pas changer sans lui ») et « baguettes croisées étincelantes (symbole magique) » dans la ligne
  Membres.
- **3.2 Porte « Seigneur des anneaux ».** Memlog : porte ronde de hobbit « version inspirée, pas une copie » ; V4
  (glyphes inventés) écartée. DESIGN écrit « porte ronde **de hobbit** », un nom propre de l'œuvre, là où la planche
  2b et le SVG disent « porte ronde de terrier ». L'intention « inspirée, sans emprunt » disparaît. *Correctif :*
  « porte ronde de terrier (inspirée du Seigneur des anneaux, sans emprunt) ».
- **3.3 Familles par thème.** Les planches donnent à chaque thème une logique : Grimoire « la famille du livre :
  ouvert, scellé, scellé puis fêlé, rouvert », gouvernance où « la clé passe de main en main » ; Forêt « la famille du
  chemin » ; Atelier « la famille du pupitre », « 29 est le seul engrenage nu ». C'est ce qui sert SM-2 (« chacun
  reconnaît son thème aux icônes ») et guidera tout futur dessin ; DESIGN n'en garde rien. *Correctif :* une phrase par
  thème au-dessus du tableau.
- **3.4 Raisons des écarts à l'addendum.** Absentes de DESIGN : Forêt sans feu de camp (réservé au badge de
  ralliement L1) ; vote = main levée dans les trois thèmes « par cohérence » (Atelier V1 retenu pour ça) ; Grimoire 1 V2
  parce que le livre à fermoir V1 « se lit comme un portefeuille » ; Atelier 1 V1 retenu pour la lisibilité en petit
  alors que l'utilisateur préférait le zeppelin V2. *Correctif :* une colonne ou des notes « pourquoi » sous le tableau,
  pour éviter qu'une story revienne à l'addendum.
- **3.5 Compromis de lisibilité connus.** Le memlog signale : Grimoire 11/12 presque identiques à 16 px ; Atelier 14
  (iris) lu comme un diaphragme photo, 16 (jetons) comme une base de données ; utilitaires proches à 16 px
  (`menu-affichage` / `vue-compacte`, `actif` / `dispo-partiel`), `quitter` proche de la trappe Atelier, `dispo-non` en
  ⊘ pour ne pas se confondre avec `effacer`. DESIGN n'a pas de « points de vigilance ». *Correctif :* une liste courte
  « À surveiller en recette » en DESIGN, « Icônes ».
- **3.6 Libellés de thème des icônes.** Les planches donnent les noms thématiques (« Close », « Achevé »,
  « Démantelée », « Convoquer le conseil », « Réunir le cercle », « Ouvrir le scrutin », « Cette relique m'appelle »,
  « J'ai envie d'y jouer », « Je veux l'essayer »…). Ce sont eux qui feront l'`aria-label` (§6). Le tableau DESIGN ne
  garde que le concept. *Correctif :* donner le libellé de thème entre parenthèses dans chaque case, ou renvoyer aux
  fichiers de ton.
- **3.7 Ton et sobriété.** PRD FR-4 : un rappel « régulier, pas seulement une porte de découverte : le porteur du
  projet tient à ce que chacun pense à mettre ses dispos à jour » ; SM-C1 : ne pas encombrer la lecture du calendrier.
  EXPERIENCE applique les deux (bandeau d'aide seulement en mode allumé, rappel qu'on peut faire taire) sans les
  énoncer. Le cadre « projet perso, bande d'amis » (memlog) n'est rappelé nulle part, alors qu'il justifie le ton
  familier des textes (« apportez vos dés et de quoi grignoter »). *Correctif :* deux lignes de principe en §1
  Foundation.

---

## 4. Tableau « Icônes » de DESIGN.md face aux dessins retenus

Référence : premier commentaire de chaque SVG de `icones-retenues.json` (identique à la légende de la planche de la
variante retenue) et lecture du tracé. Les lignes non listées sont exactes.

### Grimoire émeraude
| # | Ligne DESIGN | Écrit | Dessiné (planche, variante) | Libellé correct proposé |
|---|---|---|---|---|
| G1 [min] | Hôte | porte ronde de hobbit | « porte ronde de terrier », bouton plein au centre (2b, V3) | porte ronde de terrier (voir 3.2) |
| G2 [maj] | Terminée / Annulée | sceau de cire / sceau brisé | « livre fermé, cachet de cire » / même livre, « cachet de cire fêlé » (planche 2) | livre fermé au cachet de cire / même livre, cachet fêlé |
| G3 [min] | Proclamer | parchemin scellé | « parchemin déroulé » entre deux rouleaux, cachet plein | parchemin déroulé à cachet |
| G4 [min] | Distribuer l'XP | étoile sur une page | « étoile qui s'élève » au-dessus d'un livre ouvert | étoile qui s'élève d'un livre ouvert |
| G5 [min] | Retirer | missive barrée | enveloppe + croix pleine à côté (la légende dit « barrée », le tracé ne barre pas) | missive et croix |
| G6 [maj] | Quitter le groupe | sortie du cercle de chandelles | « sortir du cercle » : cercle ouvert et flèche, aucune chandelle | flèche qui sort d'un cercle ouvert |
| G7 [maj] | Destinée | étoile filante | « constellation » : astre plein à quatre branches, deux petites étoiles en croix, traits de liaison | constellation |
| G8 [maj] | Envie | éclat qui appelle | « cœur qui rayonne » : cœur plein et rayons | cœur qui rayonne |

### Forêt ancienne
| # | Ligne DESIGN | Écrit | Dessiné (planche, variante) | Libellé correct proposé |
|---|---|---|---|---|
| F1 [min] | Mes parties | sentier sous une arche de troncs | « sentier sous une voûte d'arbres » (planche 3, V2) | sentier sous une voûte d'arbres |
| F2 [min] | Calendrier | croissant de lune | « calendrier au croissant » : feuillet à anneaux, croissant plein | calendrier au croissant de lune |
| F3 [min] | Joueur | bâton de marche | « bâton de marche et baluchon », baluchon plein | bâton de marche et baluchon |
| F4 [maj] | Rouvrir | sentier et flèche | « pas et flèche qui repart » : une empreinte de pied et une flèche, pas de sentier | empreinte et flèche qui repart |
| F5 [min] | Masquer | œil sous le feuillage | « œil clos sous un rameau » (paupière pleine, trois feuilles) | œil clos sous un rameau |
| F6 [min] | Favori | encoche | « poteau, encoche vide / taillée » | poteau à encoche |
| F7 [maj] | Destinée | trace de luciole | « étoile prise dans les branches » (étoile pleine dans une fourche) | étoile prise dans les branches |
| F8 [maj] | Membres | demi-feuille de chêne | « feuille de chêne » entière, une moitié pleine, nervure en vide | feuille de chêne à moitié pleine |

### Atelier de cuivre
| # | Ligne DESIGN | Écrit | Dessiné (planche, variante) | Libellé correct proposé |
|---|---|---|---|---|
| A1 [maj] | Calendrier | horloge à engrenage | « Registre horaire (feuillet à cadran) » : feuillet de calendrier, cadran et aiguilles pleines, aucun engrenage | feuillet de calendrier à cadran |
| A2 [min] | En cours | machine en marche | « cylindre à vapeur qui souffle », bouffée pleine | cylindre à vapeur qui souffle |
| A3 [maj] | À venir | plan roulé | « plan déroulé », rouleau plein sur le bord | plan déroulé |
| A4 [maj] | Retirer | tampon barré | « tampon et croix » : croix pleine à côté du tampon | tampon et croix |
| A5 [min] | Quitter le groupe | trappe de sortie | « sortir par l'écoutille » : écoutille rivetée, flèche | sortie par l'écoutille |
| A6 [min] | Jeux | râtelier | « étagère à boîtes de jeux », une boîte pleine penchée | râtelier à boîtes de jeux |

Exacts, pour mémoire : « trois chevrons » (Admin Atelier) correspond bien aux « galons de chef » (deux chevrons en trait,
le supérieur plein) ; « clé + / clé ↓ », « couronne + / couronne ↓ », « chevrons + / chevrons ↓ » correspondent aux
variantes « + plus » / « déposée ».

---

## 5. Liens relatifs cassés

**Aucun.** Tous les liens de `DESIGN.md` et `EXPERIENCE.md` mènent à un fichier existant :
`mockups/icones-1-style.html`, `mockups/icones/` (et `icones-retenues.json`), `mockups/icones-2-grimoire.html`,
`mockups/icones-2b-grimoire-retouches.html`, `mockups/icones-3-foret.html`, `mockups/icones-4-atelier.html`,
`mockups/icones-4b-atelier-admin.html`, `mockups/icones-5-utilitaires.html`, `mockups/key-planche-10-6-10-8.html`.
Les chemins du front-matter (`inherits`, `sources` : `ux-jdr-master-2026-10-29/DESIGN.md` et `EXPERIENCE.md`,
`ux-jdr-master-2026-10-08/EXPERIENCE.md`, `ux-jdr-master-2026-10-20/EXPERIENCE.md`, PRD et addendum) existent aussi.

Remarque hors liens : le memlog cite les planches sous `.working/…html`, alors qu'elles sont maintenant dans `mockups/`
(seuls les JSON de travail restent dans `.working/`). Ce ne sont pas des liens, mais une relecture pourrait s'y perdre ;
à corriger par une entrée de memlog (« planches déplacées dans mockups/ ») plutôt qu'en réécrivant les anciennes.

---

## Récapitulatif

| Section | Nombre | Dont [maj] |
|---|---|---|
| 1. Trous par FR | 25 (dont 2 hors portée UX : 1.16, 1.25) | 7 |
| 2. Contradictions | 11 | 5 |
| 3. Intentions perdues | 7 | — |
| 4. Descriptions d'icônes à corriger | 22 (Grimoire 8, Forêt 8, Atelier 6) | 10 |
| 5. Liens cassés | 0 | — |
