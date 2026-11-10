# Spine Pair Review — jdr-master, delta Réserve de souffles de l'Homme Dragon (Story 33.6)

Lentille : grille de validation (rubric walker, passes 1 et 2) + couverture des décisions du memlog. Revue en lecture seule : aucun autre fichier n'a été modifié. Référence d'héritage et de niveau de détail : `ux-jdr-master-2026-09-23` (delta Homme Dragon) ; c'est un delta, donc « identique au spine hérité » est tenu pour légitime.

## Overall verdict

Paire de spines cohérente et bien resserrée : les 22 entrées du memlog sont reflétées fidèlement, les décisions écrasées (réserve par séance, « Vider la réserve », variante C, interdits masqués, un souffle d'autre race sur plusieurs emplacements) ne subsistent que sous forme de rejets explicites, et tous les liens `mockups/` résolvent. Le contrat n'est pas encore prêt à figer : (1) la planche contractuelle `key-reserve-final.html` contredit ou dépasse les spines sur plusieurs textes et placements (compteur, « Déjà en emplacement N », « Annuler », mention d'enregistrement), alors que les spines déclarent gagner sans fournir les textes manquants ; (2) la sémantique d'une ligne grisée est contradictoire entre DESIGN.md et EXPERIENCE.md ; (3) la liste d'amendements de planification du §10 est incomplète (le PRD, source de FR-61, n'y figure pas) et contient une instruction sans objet (« ajuster le diagramme »). Aucun constat critique ; un constat « high » sur les spines, un sur la planification.

## 1. Flow coverage — adequate

Vérifié : sources en frontmatter sans UJ nommés ; exigences extraites = FR-61 / D-21 et les AC de la Story 33.6 (après amendement §10). Un Key Flow (protagoniste nommée : Maëlle, MJ, Dragon Rouge niveau 4), étapes numérotées en ligne (1)-(4), climax balisé (« **Climax :** »), variante PDF sans souffles. Les autres AC (niveau 1, rituels niveau 5, souffle retiré du catalogue, MJ seul) sont couverts en State Patterns, ce qui est acceptable pour un delta à surface unique.

### Findings
- **[medium]** Le climax fait « déplier la catégorie d'une autre race », alors que §5 « Catégories repliées par défaut » et la planche P3 la montrent **dépliée** par défaut au niveau 4 (quota 0 / 1 : des souffles y sont choisissables). Le flow décrit un geste inutile et contredit la règle d'état (EXPERIENCE.md §8 vs §5). *Fix :* « elle parcourt la catégorie d'une autre race » (sans « déplie »), ou la faire démarrer repliée par une action explicite.
- **[low]** Aucun chemin d'échec dans le flow alors qu'il est applicable (échec d'enregistrement, qui a un comportement défini en §5 et une planche P5). *Fix :* une ligne « Échec : … l'emplacement revient à son état précédent, message `role="alert"` ».
- **[low]** Les étapes sont des (1)…(4) dans un paragraphe unique (précédent accepté du delta 2026-09-23) ; l'étape (4) est hors application (annonce orale, mois suivant). Lisibilité seulement ; non bloquant.

## 2. Token completeness — adequate

Vérifié : aucun token de thème ajouté (le delta le dit), 4 tokens component-scoped (`reserve-slot`, `reserve-slot-empty`, `reserve-category-header`, `reserve-row-off`), toutes les références `{…}` des §2-§8 extraites. Pas de couleur nouvelle donc pas de hex manquant ; mais certaines références ne se résolvent pas par nom dans la chaîne héritée.

### Findings
- **[medium]** `{colors.text}` (DESIGN.md L37 `reasonTextColor`, L60) ne résout aucun token : la base (`ux-jdr-master-20260626/DESIGN.md` L109) définit `text-primary`. Le token porte l'information « raison de grisage », donc il est load-bearing. *Fix :* `{colors.text-primary}`.
- **[medium]** `{colors.surface-high}` (L19, L56) n'est défini dans aucun frontmatter ni dans la base (qui a `surface-bg`) ; il n'existe que dans les CSS des planches (`--surface-high:#221c35`, thème grimoire) et sous l'alias `surface-container-high` dans le code. Dette héritée de 2026-08-31 et 2026-09-21, mais ce delta est le premier à le mettre dans des tokens YAML. Idem `{radius.card}` / `{radius.badge}` / `{radius.button}` / `{typography.text-sm}` (la base nomme `radius-card`, `--text-sm`). *Fix :* ajouter dans §2 une ligne « alias de la base » (nom delta → token de la base / hex par thème), ou corriger les références.
- **[medium]** Contrastes : aucune cible chiffrée (le delta 08-31 disait 4,5:1). Le libellé « Choisir un souffle » est en texte `accent-2` sur `surface-high` et n'est pas dans la liste « à mesurer » du §2 ; or `accent-2` du thème cuivre/steampunk de la base (`#4a7c59`) ressort autour de 3,2-3,6:1 sur fond sombre (❓ palette éventuellement révisée depuis : à vérifier). Le contour pointillé `accent-2` à 50 % est un contour d'interface (3:1 attendu). *Fix :* écrire « texte ≥ 4,5:1, contour d'interface ≥ 3:1 » et ajouter ces deux couples à la liste de mesure.
- **[low]** Frontmatter sans `name` / `description` (design-md-spec), `title` à la place (même usage que les deltas précédents). La valeur `"1px dashed {colors.accent-2} à 50 %"` est de la prose dans un token, non résoluble ; préférer `border: "1px dashed {colors.accent-2}"` + `borderOpacity: 0.5`.

## 3. Component coverage — thin

Vérifié : composants extraits des deux fichiers et de la planche ; croisement DESIGN.md §7 / EXPERIENCE.md §4.

| Composant | DESIGN.md | EXPERIENCE.md | Verdict |
| --- | --- | --- | --- |
| Ligne d'emplacement / Emplacement | oui (`reserve-slot`) | oui (« Emplacement ») | OK, nom différent |
| Emplacement vide | oui (`reserve-slot-empty`) | dans « Emplacement » + §5 | OK |
| En-tête de catégorie / Catégorie repliable | oui | oui | OK, nom différent |
| Ligne grisée (`reserve-row-off`) | oui | **aucune ligne** (comportement éclaté §4 et §5) | manque |
| Fenêtre de choix | oui | oui | OK |
| Souffle choisi | **aucune ligne** | oui | manque |
| Compteur (« k / N emplacements » + barre segmentée) | **aucune** | texte seul §3 | manque |
| Ligne d'info niveau 1 | **aucune** | texte seul §3 | manque |
| Message d'erreur / mention d'enregistrement | couleur seule §2 | textes §3 | manque (spec visuelle) |
| Étiquette famille / race (tag), zone de détail, pied épinglé mobile | partiel | partiel | manque |

### Findings
- **[high]** Sémantique de la ligne grisée contradictoire : DESIGN.md §7 « non activable », EXPERIENCE.md §4 « un souffle grisé se consulte mais ne se place pas », DESIGN.md §8 « la liste complète doit rester consultable instantanément ». La planche montre des lignes grisées `aria-disabled="true"` sans description ni détail. Un développeur ne sait pas si le clic/Entrée ouvre le détail (bouton principal désactivé) ou ne fait rien, ni si la ligne est focalisable au clavier. *Fix :* trancher (recommandé : focalisable, détail affiché avec la raison, bouton principal désactivé) et le porter dans une ligne « Ligne grisée » d'EXPERIENCE.md §4.
- **[medium]** Noms divergents entre spines : « Ligne d'emplacement » / `reserve-slot` vs « Emplacement » ; « En-tête de catégorie repliable » vs « Catégorie repliable » ; « Ligne grisée » absente d'EXPERIENCE §4 ; « Souffle choisi » absent de DESIGN §7. *Fix :* une table de noms canoniques (un seul nom par composant dans les deux fichiers).
- **[medium]** Éléments de la planche contractuelle sans spec visuelle ni comportementale (compteur segmenté, ligne d'info, message d'erreur avec icône ⚠, mention « ✓ Enregistrée… », tag famille/race, bouton secondaire « Annuler »). *Fix :* lignes dans DESIGN §7, ou les déclarer non contractuels.
- **[low]** Les tokens `reserve-*` ne couvrent ni la pastille de numéro (32 px, citée en prose §4) ni la zone de détail ; cohérence de nommage token/prose.

## 4. State coverage — adequate

Vérifié : IA = 2 surfaces (section de fiche, fenêtre de choix). Couverts : niveau 1, niveaux 2-5, vide / rempli, doublons, autre race, quota, interdits grisés, replis, rituels, auto-enregistrement et échec (revert), montée de niveau, souffle retiré du catalogue, réserve vide, niveau qui baisse (décision : rien), visibilité MJ seul, focus. Solide sur la règle métier.

### Findings
- **[medium]** Pas d'état de chargement / d'échec de chargement : fiche ou catalogue `souffle` non encore chargé (la fenêtre n'a rien à lister), catalogue indisponible. *Fix :* une ligne « Chargement / échec du catalogue » (désactiver les emplacements ou message).
- **[medium]** Concurrence : mise à jour temps réel d'un autre appareil pendant que la fenêtre est ouverte (quota ou emplacement devenu obsolète) ; rejet serveur d'une règle (capacité, quota) fusionné avec l'échec réseau sous le même message « Impossible d'enregistrer la réserve. Réessayez. » — « Réessayez » est faux pour un rejet de règle. *Fix :* définir le rafraîchissement de la fenêtre ouverte et un second message pour le rejet de règle (ou assumer le message unique).
- **[low]** État « enregistrement en cours » non défini : §6 ferme la fenêtre dès « Mettre dans l'emplacement N » et P5 montre le retour en arrière après coup (mise à jour optimiste ?), double activation, focus après revert.
- **[low]** Un même rituel peut-il occuper plusieurs emplacements ? Silence (les rituels n'ont ni race ni famille ; §5 ne couvre que « commun ou de la race »).

## 5. Visual reference coverage — adequate

Vérifié : `mockups/key-reserve-final.html` (contractuelle, P1-P6) et `mockups/key-reserve-variantes.html` (exploration non contractuelle) existent tous deux, liés dans les deux spines avec leur rôle, « le document gagne » énoncé ; aucune orpheline (les copies de `.working/` sont identiques, `diff` vide). Mais les liens ne sont posés qu'en tête de document, sans renvoi aux planches P1-P6 dans les sections concernées, et la planche contractuelle diverge des spines sur plusieurs points.

### Findings
- **[medium]** Compteur : décision (memlog L27, EXPERIENCE §3, DESIGN §7, flow « 0 / 3 emplacements ») = « k / N emplacements » **en tête de la fenêtre** ; la planche met le compteur (avec barre segmentée) **dans la section de la fiche** et le sous-titre de la fenêtre dit « Emplacement 3 sur 3 ». Les deux comptes (remplis / emplacement visé) sont différents. *Fix :* aligner la planche, ou amender les spines (compteur dans la section, sous-titre de fenêtre « Emplacement N sur M »).
- **[medium]** Libellé « Déjà en emplacement N » dans la planche (P3, P4, P6) vs « Déjà dans l'emplacement N » dans EXPERIENCE §3/§5 et memlog L25. La planche montre en plus ce marqueur sur des lignes **non** grisées (même souffle déjà placé) et une note « un même souffle peut occuper plusieurs emplacements » absents des spines. *Fix :* une seule formulation ; décrire le marqueur non grisé dans §5.
- **[medium]** Zone de détail : la planche affiche « Annuler » + « Mettre dans l'emplacement 3 » ; DESIGN §7 spécifie « Retirer » en secondaire quand l'emplacement est rempli et ne parle pas d'« Annuler ». Aucune planche ne montre la fenêtre ouverte depuis un emplacement rempli (« Changer »). *Fix :* ajouter la planche ou lever l'ambiguïté dans DESIGN §7.
- **[medium]** Textes visibles uniquement dans la planche, que les spines déclarent supplantés sans les fournir : lignes « Règle : … » (3 variantes : section, fenêtre, quota atteint avec nom du souffle, niveau 2), qualificatifs d'en-tête (« (non réservables) », « (dès le niveau 5) », « — 0 / 1 souffle autorisé », « — 1 / 1 souffle autorisé (quota atteint) »), titre « Choisir un souffle », « + Choisir un souffle », « Emplacement libre », intertitres (« Souffles communs », « Votre race », « Autres races et rituels »). DESIGN §7 donne comme exemple d'en-tête « Admis dès le niveau 5 » alors que la planche écrit « (dès le niveau 5) » ; et §7 réserve la règle d'en-tête aux catégories repliées alors que la planche l'affiche aussi dépliée (« — 0 / 1 … »). *Fix :* compléter le tableau Voice and Tone d'EXPERIENCE §3.
- **[low]** Mention d'enregistrement : spine « sous le titre de la section » (§3), planche « en pied de section » (P1, P5, P6).
- **[low]** Pas de renvoi aux ancres de planche (`#p1`…`#p6` existent) dans §5 (P5 erreur), §9 / DESIGN §4 (P6 mobile), DESIGN §7 (P3/P4 fenêtre). Les planches sont citées en bloc « (fiche, fenêtre de choix, états, mobile) ».
- **[low]** Spécificités mobiles visibles seulement en P6 (emplacement sur deux lignes, boutons pleine largeur 44 px, détail + bouton principal épinglés en bas de la feuille) ; DESIGN §4 dit « boutons d'action à droite » sans exception mobile.

## 6. Bloat & overspecification — adequate

DESIGN.md est sobre (§1, §3, §5, §6 « identique »), pixel specs limitées à ce que les tokens ne couvrent pas. EXPERIENCE.md porte du poids hors contrat UX.

### Findings
- **[low]** §10 (« Impact sur les artefacts de planification ») recopie des AC et des numéros de ligne de documents tiers (corrects aujourd'hui, mais voués à pourrir) ; c'est du contenu de sprint change proposal. À garder en liste courte et ancrée sur des noms (Story, AD, puce), pas sur des L-numéros, et à corriger (voir « Couverture » plus bas).
- **[low]** Les hypothèses apparaissent trois fois (marqueur en ligne, §11 liste, « Décisions de clôture ») et six des sept décisions de clôture sont déjà écrites en §3/§5/§6/§10. *Fix :* ne garder que les `[ASSUMPTION]` en ligne + une liste de questions réellement ouvertes.
- **[low]** L'introduction (« Périmètre tranché pendant la passe », citation de l'utilisateur, histoire du bouton « Vider ») est de l'historique de décision ; une ligne « Don't : pas de réserve par séance, pas de “Vider la réserve” » suffit.

## 7. Inheritance discipline — adequate

Vérifié : `inherits` et tous les chemins de `sources` des deux fichiers résolvent (y compris ARCHITECTURE-SPINE, spec-33-4, spec-33-7, `docs/dragons.md`) ; `design: ./DESIGN.md` valide ; noms de réserve, d'emplacement, de races et de thèmes identiques aux sources.

### Findings
- **[low]** `stat-pill` et la fiche proviennent de `ux-jdr-master-20260703` / `20260708`, hors chaîne d'héritage (09-23 → 08-31 → 08-04 → 20260626) et hors `sources`. *Fix :* l'ajouter aux sources du DESIGN.md.
- **[low]** Lettres surchargées : `N` = niveau (« Niveau N · k emplacements »), `N` = nombre d'emplacements (« k / N »), `N` = numéro d'emplacement (« emplacement N »), `k` = nombre d'emplacements puis nombre de remplis. *Fix :* des lettres distinctes ou des exemples chiffrés.
- **[low]** Dérive de vocabulaire : « aide aux PNJ » (EXPERIENCE §2) vs « PNJ » (planche) ; « surface de détail » / `DetailSurface` / « fenêtre » / « feuille ».

## 8. Shape fit — adequate

DESIGN.md : sections 1→8 dans l'ordre canonique, toutes présentes. EXPERIENCE.md : Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows, Responsive & Platform présentes ; §10 et §11 sont des sections inventées (§10 justifiée par la conséquence de l'abandon de la réserve par séance, §11 en partie redondante, voir 6).

### Findings
- **[low]** « Inspiration & Anti-patterns » est une section requise quand le memlog montre des rejets : variante C (stepper −/+), « Vider la réserve », interdits masqués, réserve par séance. Les rejets sont tous écrits mais dispersés (§ intro, §5, §6, DESIGN intro). *Fix :* une courte section « Anti-patterns » regroupant ces quatre rejets et leur raison.

## Couverture des décisions du memlog

Légende : OK = reflétée fidèlement ; mockup ≠ = spines OK mais la planche contractuelle diverge.

| # | Memlog | Type | Décision | Où dans les spines | Verdict |
| --- | --- | --- | --- | --- | --- |
| L6 | decision | Coaching ; usage interne, sans réglementaire ; hérite de 2026-09-23 (teinte, ChoiceCard, DetailSurface, info jamais par la couleur) | DESIGN frontmatter `inherits`, intro, §2, §8 ; EXPERIENCE §7 | OK (aucune mention explicite « hors réglementaire » : à ajouter en une ligne, la règle globale demande de signaler le sujet) |
| L7 | decision | Sources confirmées | frontmatter des deux fichiers | OK (ARCHITECTURE-SPINE seulement dans EXPERIENCE ; « page de séance » devenue sans objet) |
| L8 | event | Faits clés (fiche 2 colonnes dès 768 px, ordre de la colonne gauche, règles, 1024 px / 44 px / 3 thèmes) | EXPERIENCE §2, §9 ; DESIGN §4 | OK |
| L9 | decision | Réserve absente de l'app, surface = fiche, sauvegardée par défaut, sert au PDF, bouton + fenêtre listant description | EXPERIENCE « Problème traité », §2, §4 ; DESIGN §7 | OK |
| L10 | assumption | Réserve par séance : à trancher | résolue par L13 | OK (aucune trace résiduelle) |
| L11-L12 | decision | « Vider la réserve » efface la réserve sauvegardée | écrasée par L17 | OK : n'apparaît que dans EXPERIENCE intro comme proposé-puis-retiré ; aucune surface / texte / flux ne la porte |
| L13 | override | Une seule réserve par Homme Dragon ; plus de `Seance.reserveSouffles`, d'écran de séance, de résolution défaut/séance, d'impact `SeanceDto` ; amender AC, AD-22, epic-33-context | EXPERIENCE intro, §2, §5, §10.1-10.3 | OK dans les spines ; **partiel** côté amendements (voir plus bas : PRD et autres passages absents du §10) |
| L14 | event | Abandon de la réserve par séance | idem L13 | OK |
| L15 | event | Planche de comparaison B / C ouverte | `mockups/key-reserve-variantes.html`, bannière « NON CONTRACTUELLE » | OK (fichier présent, lié, rôle dit) |
| L16 | decision | Variante B retenue : bouton par emplacement, libellés « Choisir un souffle » / « Changer » / « Retirer », fenêtre modale ≥ 1024 px / feuille basse, détail + « Mettre dans l'emplacement N » ; variante C écartée | EXPERIENCE §3, §4, §6, §9 ; DESIGN intro, §7 | OK ; **mockup ≠** : zone de détail « Annuler » (sans « Retirer »), « + Choisir un souffle » |
| L17 | override | « Vider la réserve » retiré ; on retire un à un (max N − 1, soit 4 au niveau 5) | EXPERIENCE intro, §4 (« Retirer » sans confirmation), §5 (« Réserve vide »), §8 variante | OK ; le « 4 au niveau 5 » est en §5 |
| L18 | decision | Interdits grisés avec raison écrite, pas masqués, repliables | EXPERIENCE §3, §5 ; DESIGN §7, §8 | OK (sémantique de la ligne grisée contradictoire, voir cat. 3) |
| L19 | decision | Chaque catégorie repliable ; par défaut dépliées sauf celles sans choix possible ; lignes grisées gardent leur raison | EXPERIENCE §4, §5 ; DESIGN §7 ; a11y `aria-expanded` | OK ; flow §8 en contradiction (cat. 1) |
| L20 | decision | Auto-enregistrement à chaque geste ; échec : `role="alert"`, état précédent | EXPERIENCE §3, §5, §7 | OK ; mockup ≠ sur la position de la mention (pied vs « sous le titre ») |
| L21 | decision | Niveau 1 : ligne d'info, pas de composeur | EXPERIENCE §3, §5 | OK (texte identique à P2a) |
| L22 | assumption | (a) Retirer sans confirmation ; (b) nouveaux emplacements vides ; (c) souffle retiré : clé brute et retirable ; (d) carte « Souffles rituels » reste un catalogue, consigne réécrite, rituels choisissables dès niveau 5 | EXPERIENCE §4, §5, §10.5, §11 | OK |
| L23 | decision | Section en colonne gauche, juste avant la carte « Souffles » ; (a)-(d) retenues | EXPERIENCE §2, §8, §9 ; planche P1 | OK |
| L24 | event | Écart 33.4 (`nombre_souffles = max(N−1,0)`, `souffle_1..4` vides) ; 6 questions ouvertes | EXPERIENCE §10.4 ; « Décisions de clôture » 1-7 | OK (vérifié contre spec-33-4 L23 et deferred-work L168-169) |
| L25 | decision | Souffle d'autre race : un seul emplacement ; grisé « Déjà dans l'emplacement N » | EXPERIENCE §3, §5, §10.2 | OK ; **mockup ≠** (« Déjà en emplacement N ») |
| L26 | decision | Niveau qui baisse : aucune règle | EXPERIENCE §5, clôture 2 | OK |
| L27 | assumption | Cases PDF = nom seul ; compteur « k / N emplacements » en tête de fenêtre ; texte d'erreur ; temps réel via signal de la partie, évalué à l'implémentation | EXPERIENCE §3, §6, §10.4, clôture 3-7 | OK dans les spines ; **mockup ≠** pour le compteur (dans la section, sous-titre « Emplacement 3 sur 3 ») ; **tension** avec l'AC temps réel imposé par §10.1 |
| L28 | event | Planches promues dans `mockups/` ; EXPERIENCE.md tronqué puis réécrit | liens `mockups/…` | OK : EXPERIENCE.md complet (§1-§11 + clôture), les deux planches existent |

Synthèse : décisions manquantes dans les spines : **0** ; décisions écrasées subsistant dans les spines : **0** ; contradictions spines ↔ planche contractuelle sur une décision : **4** (compteur L27, libellé « Déjà … » L25, boutons de la zone de détail L16, position de la mention d'enregistrement L20) ; décision partiellement reportée : **1** (L13, liste d'amendements incomplète).

### Cohérence des amendements de planification (§10) avec les artefacts

Vérifié et exact : numéros de ligne cités (`epics.md` L253, L326, L1877, L2005, bloc Story 33.6 L1915-1958), `nombre_souffles = max(N − 1, 0)` déjà livré (spec 33.4 L23), `docs/dragons.md` L227, puces d'`epic-33-context.md` (Goal L7, Réserve L28, AD-22 L42, UX L51, Cross-Story L57 et L59).

- **[high] Amendements manquants (source de FR-61 non listée).** Le PRD `prds/prd-jdr-master-2026-08-01/prd.md` n'est pas dans §10 : L268-272, FR-61 (« le MJ compose **sur la page d'une séance** … une **réserve par défaut** … **pré-remplit toute séance** ») est exactement l'inverse de la décision ; L484, D-21 (« réserve par séance et réserve par défaut ») ; L263 et L488 (« préparée avant la séance », acceptable mais à relire). Autres passages absents du §10 : `epics.md` L52 et L79 (libellé FR-61), L1768 (note Q-13 « la réserve préparée avant la séance est portée par la 33.6 ») ; `ARCHITECTURE-SPINE.md` L498 (ligne Q-13 : « la réserve préparée avant la séance relève d'AD-22 ») ; `epic-33-context.md` L31 (« réserve par défaut imprimée si elle existe (33.6) ») ; `implementation-artifacts/deferred-work.md` L168-169 (clause « réserve par défaut » à rouvrir/clore) et `apps/api/game-systems/ryuutama/assets/README.md` L89 (à tenir à jour à la livraison). Le `sprint-change-proposal-2026-09-26.md` reste un document historique : ne pas le réécrire. *Fix :* compléter §10 par le PRD (FR-61 corps, D-21) en tête de liste.
- **[medium] Epics Story 33.6 — passages précis à réécrire** (§10.1 les regroupe sans les citer tous) : L1917-1919 (énoncé « pour cette séance, à partir d'une réserve par défaut … sans la recalculer à chaque fois ») ; L1923-1925 (« j'ouvre une séance ») ; L1928 (« par défaut sur la fiche, ou pour une séance ») ; L1933-1936 (supprimer) ; L1938-1940 (« When la séance a lieu » à reformuler : plus de séance) ; L1942-1944 (supprimer) ; L1950-1952 (« la séance est ouverte sur un autre de mes appareils ») ; L1954-1956 (ajouter « et reste retirable ») ; L1958 (note « écran conçu par une passe bmad-ux » : fait ; « souffles rituels traités comme les autres souffles » à confronter à la décision (d)).
- **[medium] ARCHITECTURE-SPINE AD-22 (L221-228)** : titre L221 ; **Prevents** L224 (« la recopie de la réserve par défaut dans chaque séance » : sans objet) ; **Rule** L225 (`reserveSouffles` sur `Seance`, `reserveParDefaut`, forme `{ key, count }` — à remplacer par une liste positionnelle car l'emplacement compte : « Déjà dans l'emplacement N », « Retirer » par emplacement, emplacement vide) ; **Lecture** L226 (« DTO de séance » → réponse servie aux joueurs) ; **Écriture** L227 (ajouter : un souffle d'autre race sur un seul emplacement ; compatibilité avec l'écriture à chaque geste) ; **Ne pas** L228 (« recopier … dans les séances »). **Instruction sans objet** : « Ajuster le diagramme qui suit l'AD » — le Mermaid L230-250 est le graphe de dépendances des modules (`AppModule`, `PartiesModule`, `CharacterModule`…), sans nœud réserve/séance ; rien à ajuster. *Fix :* retirer la phrase du §10.2 (ou nommer le diagramme visé).
- **[medium] Temps réel : incohérence interne.** §10.1 impose de réécrire l'AC multi-appareils (« la vue concernée devient la fiche, via le signal de la partie ») alors que §6 et la décision de clôture 7 disent que le câblage est « à évaluer à l'implémentation selon `docs/checklist.md` ». Un AC testable ne peut pas être « à évaluer ». *Fix :* trancher dans les deux sens ; la convention SSE du `CLAUDE.md` du dépôt demande une évaluation, pas une obligation.
- **[low] epic-33-context.md** : la liste du §10.3 omet la puce *PDF (33.4)* L31 (voir plus haut) ; le reste (Goal, puce Réserve, puce AD-22, puce UX, Cross-Story 33.4 et 33.6) est exact. La puce L28 contient aussi « Réserve par défaut sur la fiche, pré-remplissant toute séance non composée … » à supprimer en entier, pas seulement les deux fragments cités.
- **[low] §10.5** : la consigne « sans réserve ni décompte » vit dans le code à `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` L334 (« Mère-dragon : ces souffles sont consultables ici, sans réserve ni décompte. ») et dans la spec 33-7 (L27, L78, document de story livrée : ne pas réécrire) ; `docs/dragons.md` L227 est exact. Citer le fichier de code plutôt que la spec.

## Mechanical notes

- Frontmatter : `inherits`, `design`, `sources` (7 et 8 entrées) résolvent tous ; `status: draft`, `updated: 2026-10-02` cohérent avec le memlog (14:20).
- Liens : `mockups/key-reserve-final.html` et `mockups/key-reserve-variantes.html` existent ; copies identiques dans `.working/` (pas d'orpheline sémantique).
- Références `{…}` non résolues par nom : `{colors.text}` (×2). Résolues seulement par héritage implicite et sans définition YAML nulle part : `{colors.surface-high}`, `{radius.card|badge|button}`, `{typography.text-sm|text-base}`, `{elevation.modal|panel}`.
- Pas de Mermaid dans les deux spines. Numérotation de sections cohérente (DESIGN 1-8, EXPERIENCE 1-11).
- Hors périmètre de cette revue (non vérifié) : mesure réelle des contrastes dans les trois thèmes, contenu des JSON de catalogue. Réglementaire (IEC 62304) : non applicable à cet usage interne, à écrire en une ligne dans la Foundation.

## Totaux

Par catégorie : 1 adequate · 2 adequate · 3 thin · 4 adequate · 5 adequate · 6 adequate · 7 adequate · 8 adequate.
Constats des 8 catégories : critical 0 · high 1 · medium 12 · low 16 (29).
Constats de planification (§10) : high 1 · medium 3 · low 2 (6) ; dont à reporter dans les artefacts tiers : PRD, epics, ARCHITECTURE-SPINE, epic-33-context.
Total : critical 0 · high 2 · medium 15 · low 18 (35).
