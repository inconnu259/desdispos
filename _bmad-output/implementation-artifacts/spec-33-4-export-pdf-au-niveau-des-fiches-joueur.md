---
title: 'Export PDF au niveau des fiches joueur'
type: 'feature'
created: '2026-09-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '3bf55935bdb0fb13364715291802064836af6083'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'export PDF de l'Homme Dragon remplit le gabarit officiel mais reste en deçà de celui des fiches joueur : l'artefact sort en clé technique brute quand le MJ ne l'a pas renommé, les souffles n'y figurent pas (le gabarit n'a que 4 cases de réserve), et les champs de souffle mentent — `nombre_souffles` (« Nombre Max » de la réserve) reçoit les PS, `souffle_actuel` est pré-rempli comme s'il était suivi.

**Approach:** Offrir, comme pour les joueurs, le choix de format « éditable » ou « 2 pages » (aplati). Corriger le mapping du gabarit (champs de souffle, libellés, voyageurs protégés) et ajouter après le gabarit une ou plusieurs pages « Souffles de mon dragon » dessinées côté serveur, lues dans le catalogue `souffle`, avec le coût et l'effet de chacun. Règle de disponibilité en fonction pure dans `packages/game-rules`, dessin dans le service PDF de l'API.

## Boundaries & Constraints

**Always:**
- Gabarit `Ryuutama_fiche_homme-dragon_big_edit.pdf` inchangé (gitignoré, sous droits). Champs : `souffle_max` = PS max (`derived.PS`) ; `nombre_souffles` = capacité de réserve `max(niveau − 1, 0)` (« Nombre Max : » au-dessus des 4 cases `souffle_1..4`, qui restent vides — réservées à la réserve de la 33.6) ; `souffle_actuel` reste vide (case à remplir à la main).
- Souffles lus du catalogue `souffle` UNIQUEMENT (jamais `eveilPower`) : communs par famille (temps, destin, PNJ), souffles de la race du dragon, et dès le niveau 3 ceux des trois autres races sous une mention « autres races (souffles multicolores) ». Chacun avec son nom, son coût en PS et son effet (description du catalogue, retour à la ligne et saut de page automatiques : une ou plusieurs pages) ; les souffles `reservable: false` signalés comme non mettables en réserve. Repli sur la clé si le catalogue n'a plus de libellé.
- Les éveils restent dans leur section du gabarit, jamais mêlés aux souffles.
- Artefact : libellé du catalogue `hommeDragonArtefact` quand le MJ n'a pas saisi de nom (repli sur la clé seulement si le catalogue ne connaît plus l'entrée).
- Voyageurs protégés : tous imprimés, répartis dans l'ordre sur les deux zones du gabarit (une par ligne), plus seulement deux noms.
- Deux formats, mêmes valeurs que les joueurs : `?format=editable|2pages` (`@IsIn`, obligatoire comme pour `ExportCharacterPdfDto`) ; `2pages` aplatit le formulaire (`form.flatten()`) ; les pages de souffles sont identiques dans les deux. Côté fiche, l'en-tête offre les deux actions dans un petit menu accessible (clavier, `aria-label`, cible ≥ 44 px), qui remplace le bouton actuel ; nom de fichier téléchargé distinct par format.
- Un texte non encodable en WinAnsi (police standard pdf-lib) est remplacé, jamais une erreur d'export. Commentaires et messages en français.

**Never:**
- Aucun suivi de consommation : aucune valeur « actuelle », aucun décompte.
- Pas de réserve de souffles (33.6), d'artefact cadeau ni de souffles rituels (33.7) : la clause d'AC « la réserve par défaut est imprimée si elle existe » n'a aujourd'hui aucune donnée à lire — reportée à la 33.6, consignée dans `deferred-work.md`.
- Ne pas réutiliser ni fourcher `SheetActionsMenu` (propre au personnage : 5 actions figées, recadrage de portrait).
- Ne pas modifier `HommeDragonDto`, les catalogues JSON, ni la logique de disponibilité de la fiche web (`homme-dragon-sheet.ts`, hors export) — la duplication est consignée, pas refactorée ici. Aucune dépendance ajoutée (`pdf-lib` et ses polices standard suffisent).

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Niveau 1, race Rouge | `derived = {1, 3}` | `nombre_souffles`=0, `souffle_max`=3, `souffle_actuel` vide ; page ajoutée : communs + 3 souffles rouges, aucune autre race | N/A |
| Niveau 3 | `derived = {3, 5}` | `nombre_souffles`=2, `souffle_max`=5 ; bloc « autres races » présent | N/A |
| Niveau 5 | `derived = {5, 10}` | `nombre_souffles`=4, `souffle_max`=10 | N/A |
| Format `2pages` | `?format=2pages` | Formulaire aplati (aucun champ éditable restant), pages de souffles présentes | Format absent ou inconnu → 400 |
| Catalogue `souffle` vide | aucune entrée | Aucune page ajoutée, export réussi, gabarit rempli | N/A |
| Artefact sans nom personnalisé | `artefact = { key }` | Libellé du catalogue imprimé, jamais la clé | Clé brute si le catalogue l'a perdu |
| Plus de deux voyageurs protégés | 5 pseudos | Répartis sur les deux zones, un par ligne | N/A |
| Effet long | description de plusieurs lignes, 15+ souffles | Retour à la ligne, saut de page sans coupure au milieu d'un souffle | N/A |
| Caractère hors WinAnsi | libellé ou nom avec un glyphe non encodable | Caractère remplacé, export réussi | Aucune exception |

</frozen-after-approval>

## Code Map

- `packages/game-rules/src/ryuutama/homme-dragon-pdf-field-map.ts` -- `mapHommeDragonToPdfFields()` : corriger `nombre_souffles`, `souffle_actuel`, `voyageurs_proteges_*`, ajouter `artefactLabel` à `HommeDragonPdfContent` ; y consigner en commentaire le changement de décision par rapport à la 10.5 (« état plein »).
- `packages/game-rules/src/ryuutama/homme-dragon-derived.ts` -- niveau et PS (`HOMME_DRAGON_LEVEL_THRESHOLDS`) ; ne pas modifier. Capacité de réserve = `niveau − 1`.
- `packages/game-rules/src/index.ts` -- exporter la nouvelle fonction de disponibilité des souffles.
- `packages/game-rules/src/__tests__/homme-dragon-pdf-field-map.spec.ts` -- 300 lignes ; mettre à jour les assertions `souffle_actuel`/`nombre_souffles`, étendre.
- `apps/api/src/homme-dragon/homme-dragon.pdf.service.ts` -- `fillHommeDragonPdf(dto, mjPseudo)` : ajouter le paramètre `format` ; résout déjà `eveilPower` via `gameSystems.getContent(RYUUTAMA_ID)` : y ajouter `hommeDragonArtefact` et `souffle`, puis dessiner les pages ajoutées (`PDFDocument.addPage`, polices standard). Patron de robustesse : `ryuutama-pdf.service.ts` (`embedPortrait` dégrade sans jamais échouer l'export).
- `apps/api/src/homme-dragon/homme-dragon.controller.ts` L62-75 -- `exportPdf` : ajouter `@Query()` ; DTO à créer sur le modèle de `apps/api/src/characters/dto/export-character-pdf.dto.ts` (`@IsIn(['editable','2pages'])`) ; nom de fichier `homme-dragon-{partieId}-{format}.pdf`.
- `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` L66 -- `exportPdf(partieId)` : ajouter le paramètre `format` (patron : `exportPdf(id, format)` du service personnage).
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` L352-378 et `.html` L25 -- `onExportPdf()` + bouton « Exporter en PDF » : passer à un menu à deux entrées, garder `exporting`/`exportError`.
- `apps/api/src/homme-dragon/homme-dragon.pdf.service.spec.ts` (137 l.) et `homme-dragon.controller.spec.ts` (102 l.) -- à étendre.
- `apps/api/game-systems/ryuutama/data/souffles.json` -- champs `key`, `label`, `famille` (temps/destin/pnj), `ps`, `reservable`, `race` (absent = commun), `description` ; tout est encodable WinAnsi (vérifié).
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` L27-350 -- règle de disponibilité de référence (communs, race, autres races dès le niveau 3, `SOUFFLE_FAMILLE_INFO`) à reproduire à l'identique côté game-rules ; ne pas modifier.
- `apps/api/game-systems/ryuutama/assets/README.md` -- y documenter la page ajoutée et les champs de souffle.
- `docs/dragons.md` -- source des règles (réserve = niveau − 1, PS 3/5/10).
- Constaté sur le gabarit (rendu et rectangles lus avec PyMuPDF) : « Points de Souffle » = `souffle_max` ⇒ `souffle_actuel` ; « Souffles — Nombre Max : » = `nombre_souffles` ; 4 cases `souffle_1..4` de ~241×28 pt ; `voyageurs_proteges_1/2` = deux zones multilignes de ~248×84 pt.

## Tasks & Acceptance

**Execution:**
- [x] `packages/game-rules/src/ryuutama/homme-dragon-souffles.ts` -- fonction pure `availableSouffles(level, race, catalogue)` → groupes ordonnés (communs par famille, race, autres races dès le niveau 3) ; l'exporter dans `index.ts` -- règle unique testable hors pdf-lib.
- [x] `packages/game-rules/src/ryuutama/homme-dragon-pdf-field-map.ts` -- champs de souffle, libellé d'artefact, répartition des voyageurs -- couvre AC3 et le rendu lisible.
- [x] `apps/api/src/homme-dragon/homme-dragon.pdf.service.ts` -- résolution des catalogues, pages « Souffles de mon dragon » (regroupées, coût, mention non-réservable), assainissement WinAnsi -- couvre AC2.
- [x] `apps/api/src/homme-dragon/homme-dragon.controller.ts` + nouveau DTO de format -- `?format=` validé, transmis au service -- alignement sur l'export joueur.
- [x] `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts`, `homme-dragon-sheet.ts`/`.html` -- menu à deux formats et paramètre `format` -- alignement sur le menu joueur sans le fourcher.
- [ ] Tests game-rules, API et web (matrice E/S ci-dessus, dont le format `2pages` aplati et le 400 sur format invalide, dont un test qui passe TOUT le catalogue `souffle` réel dans l'encodeur de police) -- ferme le risque d'un glyphe qui casserait l'export.
- [x] `apps/api/game-systems/ryuutama/assets/README.md` et `deferred-work.md` -- documentation ; report de la clause « réserve par défaut » à la 33.6.

**Acceptance Criteria:**
- Given un Homme Dragon de niveau N, when j'exporte, then `nombre_souffles` vaut `max(N − 1, 0)`, `souffle_max` les PS du niveau, et `souffle_actuel` reste vide.
- Given des souffles disponibles pour mon dragon, when l'export est produit, then ils figurent avec leur coût, lus du catalogue `souffle`, et les éveils restent listés à part.
- Given la fiche de mon Homme Dragon, when j'ouvre le menu d'export, then je peux choisir « éditable » ou « 2 pages » et le PDF téléchargé correspond au format choisi.
- Given un export d'un dragon dont le catalogue est incomplet, when il est produit, then il réussit (repli sur la clé, aucun texte non encodable ne le fait échouer).

## Implementation Notes

- Implémenté par sous-agent, diff relu et commandes rejouées par l'étape build (game-rules 196/196, API `homme-dragon` 106/106, API complet 1448/1450 avec les 2 échecs préexistants connus `parties.service.spec.ts` et `party-signals.service.spec.ts`, web homme-dragon 86/86, `pnpm build` propre hors avertissements de budget déjà connus).
- Menu d'export web écrit sans `MatMenu` (proscrit par `shell.spec.ts`) : bouton à menu WAI-ARIA (Échap, flèches, Début/Fin), cibles ≥ 44 px.
- Pages de souffles : `apps/api/src/homme-dragon/homme-dragon-souffles-pages.ts` (Helvetica, A4) ; `sanitizeWinAnsi` remplace tout glyphe non encodable par `?`, y compris dans les champs du gabarit.
- Tests « réels » (`homme-dragon.pdf.service.real.spec.ts`) sur un gabarit synthétique aux mêmes noms de champs (le vrai est gitignoré, la CI ne l'a pas).
- Non vérifié : le menu sur un vrai téléphone, et un rendu du vrai gabarit par l'utilisateur (le sous-agent l'a rendu avec PyMuPDF).

## Spec Change Log

## Review Triage Log

- **[blind/edge/gap] Le focus est perdu après le choix d'un format** — `medium`, patch : `onExportPdf()` demande le focus du déclencheur puis passe `exporting` à `true`, ce qui désactive le déclencheur avant le rendu ; `focus()` sur un bouton désactivé ne fait rien, le focus tombe sur `<body>`. Lu dans le code (`[disabled]="exporting()"`).
- **[blind/edge] Tab dans le menu le ferme sans placer le focus (l'item focalisé disparaît du DOM)** — `low`, patch : correction directe (focaliser le déclencheur avant de fermer, sans `preventDefault`, pour que Tab continue depuis lui).
- **[gap] Aucune validation HTTP réelle de `format` sur la route d'export (400 absent/inconnu)** — `medium`, patch : la ligne « Format absent ou inconnu → 400 » de la matrice n'est couverte que par le DTO seul ; le patron `characters.controller.spec.ts:679` existe pour la route sœur.
- **[gap] Clic sur le fond, Tab, Début/Fin et retour du focus non testés** — `low`, patch, traité avec les deux correctifs de focus ci-dessus (tests ajoutés en même temps).
- **[edge] `sanitizeWinAnsi` : un pseudo saisi en NFD (e + U+0301) sort en `?`** — `low`, patch : correction d'une ligne (`normalize('NFC')`).
- **[blind/edge] Les pages de suite n'affichent pas le titre du groupe (famille ou race) en cours** — `medium`, patch : un groupe coupé par un saut de page laisse le lecteur de la page 2 sans savoir de quelle race/famille relève un souffle.
- **[edge] Un souffle plus haut qu'une page, titres/consignes non retournés à la ligne** — `false`/rejeté : il faudrait ~55 lignes d'effet (le plus long du catalogue en fait moins de 6) ; titres et consignes du livre tiennent en une ligne (≈50 caractères à 9 pt sur 495 pt).
- **[edge/gap] Valeur multiligne sur un champ non multiligne du vrai gabarit → exception** — `false` : drapeaux lus sur le vrai gabarit avec PyMuPDF, `voyageurs_proteges_1` et `_2` valent `4096` (bit multiligne actif).
- **[edge/blind] Trop de voyageurs pour les deux zones (~7 lignes chacune) → coupés par le champ** — `low`, rejeté : plus de 14 voyageurs protégés est improbable (groupe de table) et le correctif (plafond, « +N ») ajoute une branche ; noté pour l'approbation.
- **[edge] Escape sans focus dans le menu, flèche bas sur le déclencheur** — `low`, rejeté : variantes facultatives du patron WAI-ARIA, correctif = nouveaux gestionnaires.
- **[blind] `format` obligatoire = rupture de contrat sans note** — `false` : voulu par la spec (comme l'export joueur), unique consommateur (le web) mis à jour dans le même diff.
- **[blind] Union `'editable' | '2pages'` écrite quatre fois ; règle `niveau − 1` codée dans le mapping ; `RACE_LABELS`/familles en trois copies ; `sanitizeWinAnsi` dans un module de dessin, `Set` reconstruit à chaque appel** — `low`, rejetés : problèmes de développeur sans divergence démontrée ; la duplication web/game-rules est déjà consignée dans `deferred-work.md`, la règle de réserve sera reprise par la 33.6.
- **[blind] `?` remplaçant silencieusement un glyphe, sans journal** — `false` : comportement exigé par la spec (« remplacé, jamais une erreur d'export »).
- **[blind] Libellé « PDF 2 pages (à imprimer) » trompeur (2 + N pages)** — `false` : le libellé joueur est « Exporter en PDF (2 pages) », même sens ; le nombre de pages du gabarit est bien 2.
- **[blind] Tests dépendants du cwd, gabarit synthétique, `sanitizeWinAnsi` simulé en identité dans l'ancien spec** — `low`, rejetés : même convention que le service (`process.cwd()`), le gabarit réel est gitignoré, et le comportement réel est couvert par `homme-dragon-souffles-pages.spec.ts`.
- **[blind/edge] Aucune vérification visuelle du rendu réel** — reportée à l'étape de présentation (contrôle manuel de la spec) ; le sous-agent a rendu le vrai gabarit avec PyMuPDF.

## Design Notes

L'ancienne décision (story 10.5) pré-remplissait `souffle_actuel` = `souffle_max` (« état de départ plein »). L'épic 33 la renverse : un champ « actuel » rempli laisse croire à un suivi que l'application n'a pas (épic 33 : aucun décompte en séance). La case reste vide pour être remplie au stylo à la table.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/**/*.spec.ts"` -- expected: tous les tests passent.
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front).
- `docker compose exec api pnpm --filter @master-jdr/game-rules test` -- expected: tous les tests passent (à confirmer : la commande suppose que l'API voit le workspace ; sinon `docker compose exec api pnpm -r test`).
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`party-signals.service.spec.ts`, `parties.service.spec.ts`).

**Manual checks (if no CLI):**
- Exporter la fiche d'un dragon de démo dans les deux formats (niveau 1, puis un niveau ≥ 3), ouvrir le PDF et le rendre à l'écran : cases « Points de Souffle » et « Nombre Max » cohérentes, case « actuel » vide, menu d'export utilisable au clavier et sur téléphone, page(s) de souffles lisibles sans débordement ni glyphe manquant.
