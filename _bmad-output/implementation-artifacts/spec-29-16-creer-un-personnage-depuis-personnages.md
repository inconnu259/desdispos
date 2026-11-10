---
title: '29.16 — Créer un personnage depuis « Personnages »'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_revision: '172259c4d968b42e5407e21ef8394dc88a6c72a7'
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem :** Sur l'écran « Personnages », rien ne signale à un joueur les parties où il lui reste à créer un personnage — la liste (story 29.2) ne montre que ce qu'il possède déjà.

**Approche :** Ajouter, au-dessus de la liste, une section distincte « À forger » listant une ligne par partie éligible (joueur, système avec module, partie non terminée, aucun personnage), chaque ligne menant à l'assistant de création. Source de vérité de l'éligibilité : le signal serveur `PERSONNAGE_A_CREER`, déjà calculé par `party-signals.service.ts` pour la story 29.15 — jamais un recalcul côté web.

## Boundaries & Constraints

**Always :**
- Éligibilité par partie = signal `PERSONNAGE_A_CREER` de `PartySignalsService.signals` (déjà calculé côté API : non-MJ · pas de personnage sur cette partie · système avec module · partie non `TERMINEE`) — jamais de recalcul du prédicat côté web.
- Croiser ce signal (par `partieId`) avec `MyPartiesService.allParties()` pour obtenir le nom de la partie et son `gameSystemId` (absents du DTO de signal).
- Ordre des lignes = ordre par défaut de `allParties()`, en une seule pile, sans sous-groupes.
- 3 lignes visibles, puis bouton de divulgation `aria-expanded` : « Voir les N autres » (`my_characters.create_more`, `{n}`) / « Voir moins » (`my_characters.create_less`).
- Chaque ligne : vrai lien (`routerLink`) vers `/parties/:id/characters/new` avec `queryParams: { gameSystemId }`, atteignable au clavier, cible ≥44px (56px au repos), bordure pointillée — jamais une carte de personnage.
- Libellé de ligne = `my_characters.create_entry`, `{partie}` remplacé par le nom de la partie (même mécanique `.replace()` que `partie.signal_more_count`/`character.equipment_group_toggle`).
- Titre de section = `my_characters.create_title` (nouvelle clé ×3 thèmes).
- Section rendue **au-dessus** de `<app-list-control-bar>`, hors de son masquage au défilement ; jamais affectée par recherche/tri/mode d'affichage de la liste.
- Section totalement absente (ni titre ni cadre) si aucune ligne éligible.
- Si la section est rendue ET que la liste de personnages est vide : message vide = `my_characters.empty_with_entries` (remplace `my_characters.empty` seulement dans ce cas précis).
- Pas de squelette de chargement : la section n'apparaît qu'une fois signaux + parties chargés.
- Rafraîchir les signaux à l'activation de la route (minimum temps réel exigé par l'AC) : appeler `partySignalsService.refresh()` dans `ngOnInit`, à côté de `listMine()`.
- Nouvelles clés `tones.ts` : guillemets typographiques `’` obligatoires (une apostrophe droite casse déjà la compilation).

**Never :**
- Aucune ligne Homme Dragon/MJ (`my_characters.create_entry_dragon`, FR-59, story 33.5) — hors périmètre de cette story.
- Ne pas recalculer `gameSystemHasModule`/le statut de clôture côté composant — uniquement lire le signal déjà calculé.
- Ne pas modifier la liste de personnages elle-même (story 29.2), ni sa recherche/tri/mode d'affichage.
- Ne pas toucher `partie-detail.ts`/`canCreateCharacter` (story 29.15, déjà livrée) ni le calcul du signal dans `party-signals.service.ts` (déjà correct).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Joueur, ≥1 partie éligible | signals contient `PERSONNAGE_A_CREER` pour ≥1 partie jouée | Section rendue, 1 ligne par partie éligible, ordre de `allParties()` | N/A |
| Joueur, aucune partie éligible | aucun signal `PERSONNAGE_A_CREER` en rôle joueur | Section absente (ni titre ni cadre) | N/A |
| >3 parties éligibles | ex. 5 lignes | 3 visibles + « Voir les 2 autres » ; clic → 5 visibles + « Voir moins » | N/A |
| Personnage vient d'être créé | retour de navigation depuis le wizard | Ligne de cette partie disparue (signal rafraîchi), personnage dans la liste | N/A |
| MJ ouvre « Personnages » | toutes ses parties en rôle mj | Aucune ligne (signal jamais émis en rôle mj) | N/A |
| Système sans module / partie terminée | signal absent pour ces parties | Aucune ligne pour ces parties | N/A |
| Section rendue + liste de personnages vide | 0 personnage, ≥1 ligne | Message `my_characters.empty_with_entries` au lieu de `my_characters.empty` | N/A |

</intent-contract>

## Code Map

- `apps/web/src/app/core/theme/tones.ts` -- ajouter 6 clés ×3 thèmes : `my_characters.create_title`, `my_characters.create_entry` (`{partie}`), `my_characters.create_more` (`{n}`), `my_characters.create_more_one`, `my_characters.create_less`, `my_characters.empty_with_entries` -- valeurs exactes dans `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-21/EXPERIENCE.md:54-61` ; `create_more_one` = « Voir l’autre » **identique dans les 3 thèmes** (même patron non-thématisé que `create_more`/`create_less`, déjà identiques ×3 dans EXPERIENCE.md) -- couvre le singulier grammaticalement correct quand une seule partie est masquée (revue 2026-09-21, voir Spec Change Log).
- `apps/web/src/app/features/characters/my-characters/character-creation-entries/character-creation-entries.ts` -- `moreLabel()` doit distinguer `hiddenCount() === 1` (→ `my_characters.create_more_one`, pas de placeholder) du cas général (→ `my_characters.create_more` avec `{n}`) : « Voir les 1 autres » est un français incorrect (revue 2026-09-21).
- `apps/web/src/app/core/parties/party-signals.service.ts` -- `signals: Signal<Map<string, PartySignalsDto>>` + `refresh()` ; source du signal `PERSONNAGE_A_CREER` (calculé par `apps/api/src/parties/party-signals.service.ts:137`).
- `apps/web/src/app/core/my-parties/my-parties.service.ts` -- `allParties` computed (id, name, gameSystemId, role, status) à croiser avec les signaux par `partieId`.
- `apps/web/src/app/features/characters/my-characters/my-characters.ts` -- ajouter un computed `creationEntries` (croise signals × allParties), appeler `partySignalsService.refresh()` dans `ngOnInit` à côté de `characterSvc.listMine()`. Le message vide (`emptyMessageKey`) doit être un `computed()` (cohérence avec `creationEntries`, pas une méthode simple) et rester sur `my_characters.empty` tant que le `refresh()` de `ngOnInit` n'a pas encore résolu au moins une fois -- sinon un chargement lent de `characterSvc.listMine()` par rapport à `partySignalsService.refresh()` fait clignoter le message de `my_characters.empty` vers `empty_with_entries` une fois les signaux arrivés (revue 2026-09-21, voir Spec Change Log) ; un booléen `creationDataLoaded` mis à `true` une fois la promesse de `refresh()` résolue (succès ou échec) suffit, cohérent avec l'« Always » « pas de squelette de chargement » déjà posé pour la section elle-même.
- `apps/web/src/app/features/characters/my-characters/my-characters.html:1` -- insérer le nouveau bloc juste avant `<app-list-control-bar>` ; message vide conditionnel selon `creationEntries().length`.
- Nouveau : `apps/web/src/app/features/characters/my-characters/character-creation-entries/character-creation-entries.ts` (+ `.html`, `.scss`, `.spec.ts`) -- composant standalone dédié, `input()` de `{partieId, gameSystemId, partieName}[]` ; signal `expanded` pour la divulgation 3→N (patron du signal d'expansion de `apps/web/src/app/features/parties/roster-rail/roster-rail.ts:39,55`) ; liens `routerLink="/parties/:id/characters/new"` + `[queryParams]="{gameSystemId}"`. Le commentaire citant le patron `.replace()` ne doit citer que `character.equipment_group_toggle` comme précédent (remplaceur sous forme de fonction) -- `partie.signal_more_count` (`dashboard.ts:288`) utilise un remplaceur chaîne simple, pas la même forme, donc pas un vrai précédent pour cette mécanique (revue 2026-09-21). Dans le `.scss`, les deux valeurs de repli `var(--mat-sys-primary, #...)` (bordure de ligne au survol/focus et couleur du bouton de divulgation) doivent utiliser la même couleur de repli -- deux teintes différentes dans le même composant si la variable Material n'est jamais résolue (revue 2026-09-21).
- `apps/web/src/app/app.routes.ts:87-92` -- route cible `parties/:id/characters/new`, inchangée, réutilisée telle quelle.
- Non touchés : `apps/api/src/parties/party-signals.service.ts` (signal déjà correct), `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` (`canCreateCharacter`, story 29.15), `apps/web/src/app/features/characters/character-wizard/*`.

## Tasks & Acceptance

**Execution:**
- `apps/web/src/app/core/theme/tones.ts` -- ajouter les 6 nouvelles clés ×3 thèmes (valeurs de `EXPERIENCE.md:54-61`, `create_more_one` ajoutée en revue) -- section et lignes thématisées, guillemets `’` obligatoires
- `apps/web/src/app/features/characters/my-characters/character-creation-entries/character-creation-entries.ts` + `.html` -- nouveau composant : lignes pointillées, 3 visibles puis divulgation, liens clavier-atteignables ≥44px -- isole l'affichage/la divulgation, testable seul
- `apps/web/src/app/features/characters/my-characters/my-characters.ts` -- computed `creationEntries` (signals × allParties), appel `partySignalsService.refresh()` en `ngOnInit` -- calcule les entrées éligibles sans dupliquer le prédicat
- `apps/web/src/app/features/characters/my-characters/my-characters.html` -- insérer `<app-character-creation-entries>` avant la barre de contrôles, message vide conditionnel -- respecte la position hors masquage au défilement
- `apps/web/src/app/features/characters/my-characters/character-creation-entries/character-creation-entries.spec.ts` -- couvrir : rendu ligne par ligne, absence totale si 0 entrée, divulgation 3→N→3, lien + `queryParams` corrects, **exactement 4 entrées → libellé singulier `my_characters.create_more_one` (pas « Voir les 1 autres »)**
- `apps/web/src/app/features/characters/my-characters/my-characters.spec.ts` -- étendre : section absente/présente selon signals, message vide conditionnel, `refresh()` appelé en `ngOnInit`, **message reste `my_characters.empty` tant que `refresh()` n'a pas résolu même si `characterSvc.listMine()` a déjà résolu (pas de clignotement)**

**Acceptance Criteria:**
- Given un joueur avec au moins une partie éligible (système avec module, non terminée, sans personnage), when il ouvre « Personnages », then une section distincte au-dessus de la liste propose une ligne par partie, jamais une carte de personnage
- Given plus de 3 parties éligibles, when la section s'affiche, then seules 3 lignes sont visibles avec « Voir les N autres », qui bascule vers « Voir moins » une fois déplié
- Given aucune partie éligible, when l'écran se charge, then la section n'est pas rendue (ni titre ni cadre)
- Given une ligne activée, when le joueur clique/valide au clavier, then il arrive sur l'assistant de création de la bonne partie avec le bon `gameSystemId`
- Given le joueur vient de créer son personnage sur une partie puis revient sur « Personnages », when l'écran se recharge, then la ligne de cette partie a disparu et son personnage figure dans la liste
- Given la section est rendue et la liste de personnages est vide, when l'écran s'affiche, then le message vide est `my_characters.empty_with_entries` plutôt que `my_characters.empty`

## Spec Change Log

- 2026-09-21 — Revue de code (Blind Hunter / Edge Case Hunter / Verification Gap / Intent Alignment, passe 1 sur le commit non commité issu de `baseline_revision`). Un finding `bad_spec` (root cause hors `<intent-contract>`, dans les valeurs de micro-copie/Code Map) et un finding `patch` (course entre deux appels réseau) retenus, tous deux repliés dans le même amendement de spec plutôt que deux boucles séparées :
  1. **Grammaire du compteur singulier** — `my_characters.create_more` (« Voir les {n} autres ») produit « Voir les 1 autres » quand exactement 4 parties sont éligibles (`hiddenCount() === 1`), faute vérifiée : jamais anticipée par EXPERIENCE.md ni par le Code Map d'origine. Amendement : nouvelle clé `my_characters.create_more_one` (« Voir l’autre », identique ×3 thèmes comme `create_more`/`create_less` le sont déjà), branchement dans `moreLabel()` sur `hiddenCount() === 1`. État connu-mauvais évité : texte grammaticalement incorrect visible à chaque utilisateur ayant exactement 4 parties à créer.
  2. **Clignotement du message vide** — `characterSvc.listMine()` peut résoudre avant `partySignalsService.refresh()` (deux appels réseau non coordonnés en `ngOnInit`), faisant passer brièvement le message vide de `my_characters.empty` à `empty_with_entries` une fois les signaux arrivés. Amendement : `emptyMessageKey` devient un `computed()` gardé par un nouveau booléen `creationDataLoaded` (vrai une fois la promesse de `refresh()` résolue), cohérent avec l'« Always » déjà posé pour la section elle-même (« pas de squelette de chargement »). État connu-mauvais évité : message trompeur pendant la fenêtre de chargement initiale.
  **KEEP** (vérifié correct par 3 des 4 couches de revue, ne pas rederiver) : le croisement `PartySignalsService.signals()` × `MyPartiesService.allParties()` sans recalcul du prédicat ; la structure du composant `CharacterCreationEntries` (`input.required`, signal `expanded`, `visibleEntries`/`hiddenCount`) ; le style bordure pointillée/cible ≥44px/grille desktop ; les valeurs de micro-copie `create_title`/`create_entry`/`create_less`/`empty_with_entries` (verbatim EXPERIENCE.md) ; l'emplacement du bloc avant `<app-list-control-bar>` ; la structure des tests existants (fixtures `makePartie`/`makePartySignalsService`/`makeMyPartiesService`). Deux corrections cosmétiques `patch` repliées dans le même amendement plutôt qu'une boucle séparée : citation de précédent `.replace()` à corriger dans le commentaire de `entryLabel()`/`moreLabel()` (ne citer que `character.equipment_group_toggle`, pas `partie.signal_more_count` qui utilise un remplaceur chaîne et non fonction) ; couleurs de repli `--mat-sys-primary` à harmoniser dans `character-creation-entries.scss`.

## Review Triage Log

### 2026-09-21 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 8, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind Hunter : couleurs de repli `--mat-sys-primary` incohérentes entre la ligne (`#9b6dff`) et le bouton de divulgation (`#6750a4`) dans `character-creation-entries.scss` — repli théorique seulement si la variable Material n'est jamais résolue ; replié dans l'amendement `bad_spec` ci-dessus plutôt qu'une boucle `patch` séparée.
  - `[low]` `[reject]` Blind Hunter : `PartySignalsService.refresh()` peut s'exécuter deux fois au premier chargement froid (constructeur du service + `ngOnInit` de `MyCharacters`) — réel mais invisible (garde `seq`, aucune donnée fausse), et ne se produit que si `/characters` est la toute première route à injecter le service dans la session ; correctif propre exigerait une coordination d'état non triviale pour un gain quasi nul.
  - `[low]` `[patch]` Blind Hunter : commentaire de `entryLabel()`/`moreLabel()` citant `partie.signal_more_count` comme précédent `.replace()` à forme fonction alors que ce site utilise un remplaceur chaîne simple (`dashboard.ts:288`) — seul `character.equipment_group_toggle` est un vrai précédent ; replié dans l'amendement `bad_spec` ci-dessus.
  - `[false]` `[reject]` Blind Hunter : absence de test d'activation clavier dédié — réfuté : les lignes (`<a routerLink>`) et le bouton de divulgation (`<button type="button">`) sont des éléments HTML natifs, accessibles au clavier par construction du navigateur, sans câblage JS additionnel à tester.
  - `[low]` `[reject]` Blind Hunter : bouton de divulgation sans `aria-controls`/région live — amélioration d'accessibilité réelle mais au-delà de l'AC (qui exige seulement `aria-expanded`, présent) ; correctif non trivial (ids uniques, région live) pour un bénéfice marginal (`aria-expanded` seul est un patron de divulgation déjà standard).
  - `[low]` `[patch]` Blind Hunter : `emptyMessageKey()` est une méthode simple alors que `creationEntries` (posé deux lignes plus haut par ce même diff) est un `computed()` — incohérence de patron introduite par le diff lui-même ; corrigé de fait par l'amendement `bad_spec` ci-dessus (qui transforme `emptyMessageKey` en `computed()` gardé par `creationDataLoaded`).
  - `[false]` `[reject]` Blind Hunter : absence de test garantissant qu'aucune ligne Homme Dragon (`my_characters.create_entry_dragon`) ne s'affiche — réfuté : aucun chemin de code ne référence cette clé, et le signal `PERSONNAGE_A_CREER` n'est émis que pour `role === 'player'` (`party-signals.service.ts`, story 29.15) — une ligne MJ est structurellement impossible dans ce diff, pas seulement non testée.
  - `[low]` `[reject]` Blind Hunter : `warnings: ['oversized']` du frontmatter sans justification enregistrée — rejeté d'office, le correctif consisterait à éditer cette spec elle-même.
  - `[low]` `[bad_spec]` Edge Case Hunter : exactement 4 parties éligibles (`hiddenCount() === 1`) → « Voir les 1 autres », français incorrect — vérifié par lecture directe de `TONE_MAP`/`moreLabel()` ; aucune variante singulière dans EXPERIENCE.md ni dans le Code Map d'origine, root cause hors `<intent-contract>`. Amendement : voir Spec Change Log ci-dessus (nouvelle clé `create_more_one`).
  - `[low]` `[patch]` Edge Case Hunter : `characterSvc.listMine()` peut résoudre avant `partySignalsService.refresh()`, faisant clignoter le message vide de `my_characters.empty` vers `empty_with_entries` — vérifié par lecture du `ngOnInit` (deux appels réseau non coordonnés) ; replié dans l'amendement `bad_spec` ci-dessus (garde `creationDataLoaded`).
  - `[false]` `[reject]` Intent Alignment Auditor : `sprint-status.yaml` reste `status: backlog` pour `29-16-...`, non mis à jour par le diff — réfuté : ce fichier est un artefact de suivi de sprint maintenu par un processus séparé (planification), jamais mis à jour par les diffs d'implémentation dans ce dépôt (aucune des ~150 stories précédentes ne le fait depuis son propre diff) ; l'intent ne demande pas de le toucher.
  - `[false]` `[reject]` Intent Alignment Auditor : `CharacterCreationEntry` n'a pas de discriminant `kind`/`role` pour la réutilisation future par la story 33.5 (Homme Dragon) qu'EXPERIENCE.md §4.3 anticipe — réfuté : 33.5 n'existe pas encore, l'AC de 29.16 exclut explicitement les lignes MJ, et construire un point d'extension pour une story non spécifiée serait la généralisation prématurée que le projet demande justement d'éviter.
  - `[false]` `[reject]` Intent Alignment Auditor : la décision temps réel (minimum = rafraîchissement au retour de navigation) ne serait pas « documentée » dans `docs/checklist.md` — réfuté : ce fichier est un pense-bête d'actions humaines récurrentes (case à cocher), pas un registre de décisions par story ; la décision est correctement consignée dans la spec (Design Notes, commentaire de code), convention déjà suivie par les stories précédentes (ex. 29.15).
  - `[false]` `[reject]` Intent Alignment Auditor : absence de `aria-labelledby` liant le `<h2>` à la `<section>` — réfuté : EXPERIENCE.md §4.3 n'exige `aria-labelledby` que pour le bloc d'invitation §4.2 (story 29.15), pas pour cette section ; aucune exigence violée.

### 2026-09-21 — Review pass (passe 2, sur le diff patché directement — voir note ci-dessous)
- **Note de procédure :** le classificateur de permissions de l'environnement a refusé le `git restore`/`rm -rf` requis par la branche `bad_spec` stricte (« Irreversible Local Destruction »), de la même façon qu'il avait refusé le `git commit` du sous-agent d'implémentation. Plutôt que de contourner ce refus, les deux correctifs retenus en passe 1 (`create_more_one`, garde `creationDataLoaded`) et les deux correctifs `patch` repliés avec eux ont été appliqués directement par édition sur l'implémentation existante — résultat final identique à une re-dérivation complète, sans l'opération destructive. Cette passe 2 revérifie le diff patché en conditions réelles (4 couches de nouveau, en parallèle) plutôt que de faire confiance à l'auto-certification.
- verdicts: 18 findings — high 0, medium 0, low 8, false 10, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind Hunter : `creationDataLoaded` ne dépend que du `refresh()` propre à `MyCharacters` — un utilisateur arrivant depuis une page ayant déjà chargé `PartySignalsService` (Dashboard, etc.) revoit quand même `my_characters.empty` le temps de ce second appel réseau, alors que les signaux étaient déjà frais en mémoire — réel mais un simple délai d'affichage (jamais un message faux), et `PartySignalsService` n'expose aucun état « déjà chargé » à lire sans y ajouter une nouvelle surface publique partagée par d'autres écrans ; correctif propre hors périmètre minimal de cette story.
  - `[false]` `[reject]` Blind Hunter : absence de test pour `creationEntries` avec plusieurs entrées croisées au niveau de `my-characters.ts` (pas seulement au niveau du composant présentationnel) — le calque Verification Gap a tracé ce chemin indépendamment et l'a jugé sain ; lacune de couverture, pas un défaut démontré.
  - `[false]` `[reject]` Blind Hunter : absence de test pour un `partieId` présent dans `signals` mais absent de `allParties()` (ou l'inverse) — même verdict : le `.filter()` gère déjà ce cas en toute sécurité (confirmé indépendamment par Verification Gap), lacune de couverture non un défaut.
  - `[low]` `[patch]` Blind Hunter : `entryLabel()`/`moreLabel()` indexaient `theme.tone()[...]` sans repli, contrairement au patron défensif déjà établi par `MyCharacters.sortLabel()` (`?? sort`) — corrigé : `?? '{partie}'`/`?? 'Voir les {n} autres'`/`?? ''` ajoutés.
  - `[low]` `[reject]` Blind Hunter : incohérence de rédaction dans cette spec elle-même (« deux findings `bad_spec` » alors qu'un seul l'était) — rejeté d'office (fix = éditer cette spec) ; corrigé quand même par cohérence rédactionnelle (voir Spec Change Log ci-dessus).
  - `[false]` `[reject]` Blind Hunter : absence de règle CSS `:visited` sur `.character-creation-entries__row` — réfuté : une règle d'auteur (`color: inherit`) l'emporte toujours sur le style par défaut de l'agent utilisateur (`a:visited`) quelle que soit la spécificité comparée, par la cascade CSS (origine auteur > origine agent utilisateur pour des déclarations de priorité normale) ; aucun risque réel.
  - `[false]` `[reject]` Blind Hunter : la section peut apparaître au-dessus d'une liste déjà rendue et provoquer un déplacement de mise en page (« pas de squelette » choisi dans l'`<intent-contract>`) — réfuté comme finding actionnable : c'est la conséquence directe et anticipée d'une décision déjà gelée dans les Boundaries (« Always : pas de squelette de chargement »), non modifiable à ce stade sans renégocier l'intent avec l'utilisateur.
  - `[low]` `[patch]` Blind Hunter : le test « refresh() encore en vol » dépendait d'exactement deux `await Promise.resolve()` codés en dur après la résolution — fragile à un futur changement de profondeur de microtâches ; corrigé en réutilisant la boucle de 10 tours déjà en place dans `createFixture()`.
  - `[false]` `[reject]` Blind Hunter : `party-signals.service.spec.ts` non étendu pour le nouvel appelant — réfuté : le changement est un simple élargissement de visibilité (`private`→public), le comportement interne de `refresh()` reste couvert par sa suite existante inchangée ; mocker le collaborateur au site d'appel (déjà fait dans `my-characters.spec.ts`) est le patron de test standard de ce projet, pas une lacune.
  - `[false]` `[reject]` Blind Hunter : `character-creation-entries.spec.ts` ne teste pas 1 ou 2 entrées — réfuté : même chemin de code que 0/3/4/5 entrées déjà couverts, jugé sain indépendamment par Verification Gap ; lacune de couverture mineure, pas un défaut.
  - `[low]` `[reject]` Edge Case Hunter : `creationDataLoaded` ne garde que le côté `partySignals` — si `myParties.allParties()` (chargé par `Shell`, hors de cette story) résout après que `refresh()` a déjà résolu, le même clignotement peut réapparaître par l'autre source — réel, mais fenêtre étroite en pratique (`Shell.ngOnInit()` s'exécute avant le montage de `MyCharacters`, lui donnant une avance) ; un correctif complet exigerait d'ajouter un état « chargé » à `MyPartiesService`, un service partagé par d'autres écrans — hors périmètre minimal de cette story. **Risque résiduel documenté, non corrigé** (voir Auto Run Result).
  - `[low]` `[reject]` Edge Case Hunter : le signal `expanded` du composant ne se réinitialise pas si `entries()` repasse sous puis au-dessus de 3 pendant que le composant reste monté — réel mais rare (les entrées ne varient qu'au gré des signaux temps réel) et sans conséquence fonctionnelle, seulement un état de divulgation qui persiste un peu plus longtemps que nécessaire.
  - `[low]` `[reject]` Edge Case Hunter (claim) : cette spec disait « 5 nouvelles clés » alors que 6 sont ajoutées (`create_more_one` compté) — rejeté d'office (fix = éditer cette spec) ; corrigé quand même (voir Tasks & Acceptance ci-dessus).
  - `[false]` `[reject]` Edge Case Hunter (claim) : l'AC « le message vide est `empty_with_entries` » serait contredite par la garde `creationDataLoaded` — réfuté : l'AC décrit l'état stabilisé de l'écran (« quand il s'affiche »), pas la toute première milliseconde de rendu ; le comportement livré atteint exactement cet état stabilisé, en évitant en plus un message trompeur pendant le chargement.
  - `[false]` `[reject]` Intent Alignment Auditor : re-confirmation (cadrage différent) que `sprint-status.yaml` reste `backlog` — même réfutation que la passe 1.
  - `[false]` `[reject]` Intent Alignment Auditor : la copie littérale d'epics.md (« Créer un personnage pour {partie} ») diverge du texte thématisé livré — réfuté : EXPERIENCE.md dit explicitement que le texte de l'AC-brouillon « n'est pas la copie définitive » et fournit lui-même le texte thématisé livré ; aucune divergence non résolue.
  - `[false]` `[reject]` Intent Alignment Auditor : le mécanisme temps réel choisi (`refresh()` en `ngOnInit`) ne serait écrit dans aucun document source — réfuté : c'est une décision d'implémentation dans le minimum requis explicitement laissé ouvert par epics.md, correctement consignée dans cette spec.
  - `[false]` `[reject]` Intent Alignment Auditor : `create_more_one`/`creationDataLoaded` n'ont pas d'ancrage dans epics.md/EXPERIENCE.md — réfuté : ce sont des correctifs issus de cette même revue de code, consignés avec leur justification dans le Spec Change Log ci-dessus ; comportement normal d'un cycle de revue, pas un défaut.

## Design Notes

Le signal serveur `PERSONNAGE_A_CREER` (déjà calculé par `party-signals.service.ts` pour la story 29.15) encode exactement le prédicat requis ici (non-MJ, pas de personnage, module, non terminée) — la section ne recalcule donc rien : elle croise ce signal (par `partieId`) avec `MyPartiesService.allParties()` pour récupérer nom et `gameSystemId`, absents du DTO de signal. Le remplacement de placeholder (`{partie}`, `{n}`) suit le patron déjà en place ailleurs (`theme.tone()['clé'].replace('{x}', valeur)`, ex. `partie.signal_more_count`, `character.equipment_group_toggle`). La ligne Homme Dragon (`my_characters.create_entry_dragon`) existe déjà dans le contrat UX mais reste hors périmètre : elle appartient à FR-59/story 33.5, non encore construite.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: tous les tests passent, y compris les nouveaux cas de `character-creation-entries.spec.ts` et `my-characters.spec.ts` (`pnpm vitest run` brut échoue en cascade sur ~300 tests sans rapport, faute de la résolution de ressources qu'`ng test` effectue — script réel du package plutôt que le texte littéral initial)
- `docker compose exec api pnpm test` -- expected: suite inchangée verte (aucune modification API dans cette story)

**Manual checks (if no CLI):**
- Vérification visuelle sur les trois thèmes : compte joueur avec 1, 3 et 5+ parties éligibles ; bordure pointillée, divulgation, absence de squelette, disparition de la ligne après création d'un personnage (retour de navigation).

## Auto Run Result

Status: done
Blocking condition: aucune

**Résumé :** Ajout d'une section « À forger » au-dessus de la liste « Personnages » (story 29.2) : une ligne par partie où le joueur peut créer un personnage (signal serveur `PERSONNAGE_A_CREER`, déjà calculé par la story 29.15, jamais recalculé côté web), 3 lignes visibles puis divulgation « Voir les N autres », absente si aucune partie éligible, message de liste vide conditionnel. Front web uniquement, aucune modification API.

**Fichiers modifiés :**
- `apps/web/src/app/core/theme/tones.ts` -- 6 nouvelles clés ×3 thèmes (titre, libellé de ligne, compteur pluriel/singulier, « voir moins », message vide avec entrées)
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- test de parité ×3 thèmes pour ces 6 clés
- `apps/web/src/app/core/parties/party-signals.service.ts` -- `refresh()` rendu public (visibilité seule, comportement inchangé), appelé désormais par `MyCharacters`
- `apps/web/src/app/features/characters/my-characters/character-creation-entries/character-creation-entries.{ts,html,scss,spec.ts}` (nouveau) -- composant standalone de la section : lignes pointillées, divulgation 3→N, libellé singulier dédié, repli défensif sur clé de thème manquante
- `apps/web/src/app/features/characters/my-characters/my-characters.{ts,html,spec.ts}` -- computed `creationEntries` (croise signals × allParties), `emptyMessageKey` computed gardé par `creationDataLoaded` (anti-clignotement), insertion du bloc avant la barre de contrôles
- `_bmad-output/implementation-artifacts/spec-29-16-creer-un-personnage-depuis-personnages.md` (ce fichier, nouveau)

**Revues de code (2 passes, 4 couches à chaque fois — Blind Hunter, Edge Case Hunter, Verification Gap, Intent Alignment) :**
- Passe 1 : 14 findings — 1 `bad_spec` (grammaire du compteur singulier, root cause hors `<intent-contract>`) + 1 `patch` (clignotement du message vide) repliés dans un même amendement de spec ; 3 autres `patch` cosmétiques (couleurs de repli SCSS, commentaire de précédent, `emptyMessageKey` en `computed()`) ; 9 `reject` (6 `false` réfutés par lecture directe du code, 3 `low` rejetés — non-trivial pour un gain marginal, ou correctif interdit par la règle « jamais éditer cette spec »).
- Passe 2 (sur le diff patché) : 18 findings — 4 `patch` appliqués (repli défensif `entryLabel`/`moreLabel`, test moins fragile, 2 corrections de cohérence rédactionnelle de cette spec) ; 14 `reject` (10 `false` réfutés, 4 `low` rejetés dont 1 risque résiduel documenté ci-dessous plutôt que corrigé).
- **Déviation de procédure assumée :** la branche `bad_spec` stricte (revert intégral + re-dérivation par un sous-agent neuf) a été bloquée par le classificateur de permissions de l'environnement (« Irreversible Local Destruction » sur `git restore`/`rm -rf`). Plutôt que de contourner ce refus, les correctifs identifiés ont été appliqués directement sur l'implémentation existante par édition — même résultat final, sans l'opération destructive. La passe 2 a revérifié le diff patché en conditions réelles (4 couches indépendantes) plutôt que de se fier à une auto-certification.
- Follow-up review recommendation : **false** — aucun finding `high` patché, et aucune paire de finding `medium` patchée sur aucune des deux passes (tous les `patch` étaient `low`).

**Vérification :**
- `docker compose exec web pnpm test` : 2404/2406 verts (2 échecs préexistants, sans rapport, fixtures de date codées en dur `2026-09-01` désormais dans le passé — `calendar-view.spec.ts`, non touché par cette story), exécuté deux fois (avant et après la passe 2 de correctifs), résultat stable.
- `docker compose exec api pnpm test` : 1346/1348 verts (2 échecs préexistants, sans rapport, même classe de fixtures de date), aucune modification API dans cette story.
- Audit de la matrice I/O : les 7 lignes sont couvertes chacune par au moins un test qui a effectivement tourné et passé (`character-creation-entries.spec.ts`, `my-characters.spec.ts`).

**Risques résiduels :**
- `creationDataLoaded` ne garde que le côté `PartySignalsService` ; si `MyPartiesService.allParties()` (chargé par `Shell`, hors périmètre de cette story) résout après coup, le même clignotement du message vide peut réapparaître par cette autre source. Fenêtre étroite en pratique (`Shell.ngOnInit()` s'exécute avant le montage de `MyCharacters`), correctif complet hors périmètre minimal (exigerait un état « chargé » sur un service partagé par d'autres écrans).
- `PartySignalsService.refresh()` peut s'exécuter deux fois au tout premier chargement froid si `/characters` est la toute première route à injecter le service dans la session (son constructeur le fait déjà) — invisible pour l'utilisateur (garde `seq`), un appel réseau redondant seulement.
- Le sous-agent d'implémentation initial n'a pas pu committer ses changements (même classificateur de permissions) ; l'ensemble du travail de cette story reste dans l'arbre de travail, non committé.
