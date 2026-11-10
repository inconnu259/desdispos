---
title: 'Fiche Homme Dragon refondue'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '0d055bc92af80679e53cb4cc89231a8da5ef3cb8'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La fiche d'Homme Dragon (`HommeDragonSheet`) n'a jamais reçu le soin accordé à la fiche de personnage joueur (`CharacterSheet`) : mise en page brute (paragraphes empilés, pas de carte, pas d'onglet), aucun texte descriptif consultable en détail, et une feuille de style absente.

**Approach:** Reprendre pour `HommeDragonSheet` les mêmes briques déjà en place sur `CharacterSheet` — structure en `sheet__card`, surface de détail partagée (`DetailSurface`/`createDetailSurfaceHost()`), convention de nom affiché (épic 28) — sans toucher au service, au DTO ni à l'API. Rework de présentation uniquement : chaque champ actuellement affiché doit continuer à l'être.

## Boundaries & Constraints

**Always:**
- Conserver à l'écran tout ce que le template actuel affiche : formulaire de création, affichage/édition d'artefact, champs libres (apparence, caractère, vocation, demeure, avatar, mondesProteges), invite de choix de pouvoir d'éveil en attente, pouvoirs d'éveil déjà choisis, section dérivée (niveau, Points de Souffle), voyageurs protégés, historique, export PDF, rafraîchissement temps réel.
- Réutiliser tel quel `DetailSurface` / `createDetailSurfaceHost()` / `detailContent()` (`apps/web/src/app/shared/detail-surface/`) pour tout élément à texte descriptif — même API que `CharacterSheet` (`detail.open(title, body, $event)`).
- Les déclencheurs de surface de détail ne portent que sur le contenu adossé à un catalogue avec description propre : l'artefact (label/description du catalogue `hommeDragonArtefact`, avec `nom`/`inscription` personnalisés du MJ en override) et chaque pouvoir d'éveil choisi (catalogue `eveilPower`, qui porte déjà `description` — non exploitée aujourd'hui). Les champs libres saisis par le MJ (apparence, caractère, vocation, demeure, mondesProteges) restent en texte simple, comme leurs équivalents sur `CharacterSheet`.
- Le nom affiché (`sheetData.nom`) suit la même convention de repli que `characterName()` (`apps/web/src/app/core/characters/character.util.ts`) : valeur normalisée ou libellé de repli en français si absente.
- Si un point de rupture responsive est nécessaire, réutiliser le seuil unique du projet (1024px, `BreakpointObserver` comme dans `CharacterSheet`) — ne pas en introduire un second.

**Never:**
- Ne pas modifier `DetailSurface`, `detail-surface-host.ts`, `IdentityLabel` ou `character.util.ts`.
- Ne pas toucher `HommeDragonService`, son câblage temps réel (`changed`/`notifyChanged`), ni `HommeDragonDto`/`HommeDragonSheetData` (`packages/shared/src/index.ts` L1174-1225).
- Ne pas donner de route dédiée à la fiche — elle reste incrustée dans `PartieDetail`, comme aujourd'hui.
- Ne pas ajouter de suivi de consommation des pouvoirs d'éveil ou des souffles — hors périmètre (Story 33.2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Aucun pouvoir d'éveil choisi | `hommeDragon().eveilPowers = []` | Section « Pouvoirs d'éveil » absente (comme aujourd'hui) | N/A |
| Artefact sans `nom`/`inscription` personnalisés | `sheetData.artefact = { key }` seul | Le déclencheur de détail affiche le `label`/`description` du catalogue | N/A |
| Écran < 1024px | viewport téléphone | Cartes empilées, aucune troncature, surface de détail en feuille du bas | N/A |
| Écran ≥ 1024px | viewport desktop | Même structure en cartes (onglets si le regroupement l'justifie), surface de détail en fenêtre centrée | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` -- composant à reprendre ; conserver tel quel l'état (`hommeDragon`, `artefactCatalog`, `eveilPowerCatalog`, ...), les handlers (`onSubmit`, `openArtefactEdit`/`onArtefactSubmit`, `onChooseEveilPower`, `onExportPdf`) et l'effet de rafraîchissement temps réel (L93-110) ; y ajouter `createDetailSurfaceHost()` et l'import de `DetailSurface`.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` -- template à réécrire en s'inspirant de `character-sheet.html` (structure `sheet__card`, déclencheurs `detail.open(...)` L244/L337/L380 de ce fichier comme modèle) ; aucune section actuelle (L7-209 du fichier existant) ne doit disparaître.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.scss` -- à créer (n'existe pas aujourd'hui) ; s'inspirer de `apps/web/src/app/features/characters/character-sheet/character-sheet.scss` pour les cartes/espacements.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts` -- 539 lignes, ~32 blocs existants à conserver ; étendre pour les nouvelles ouvertures de surface de détail (artefact, pouvoir d'éveil) et le repli de nom.
- `apps/web/src/app/features/characters/character-sheet/character-sheet.ts` / `.html` / `.scss` -- référence de lecture seule pour le motif de mise en page (cartes, éventuels onglets `MatTabsModule`, seuil desktop `isDesktop` L207-211) ; ne pas modifier.
- `apps/web/src/app/shared/detail-surface/detail-surface.ts` et `detail-surface-host.ts` -- `DetailSurface` (inputs `title`, `body`, `rows`, `narrative`, `openToken` ; output `closed`) et `createDetailSurfaceHost()` (`{ selected, openToken, open(title, body, event), openContent(content, event), close() }`) + `detailContent(label, text)` -- à consommer tels quels.
- `apps/web/src/app/core/characters/character.util.ts` L1-7 -- `characterName()`, modèle du repli de nom à reproduire pour `sheetData.nom`.
- `packages/shared/src/index.ts` L1174-1225 -- `HommeDragonDto`/`HommeDragonSheetData` -- référence de forme, aucune modification.
- `apps/api/game-systems/ryuutama/data/eveil-powers.json` et `homme-dragon-artefacts.json` -- confirment que les catalogues `eveilPower`/`hommeDragonArtefact` portent chacun un `label` et une `description` exploitables par la surface de détail ; fichiers backend, non modifiés par cette story.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.ts` -- Ajouter `createDetailSurfaceHost()`, l'import de `DetailSurface`/`detailContent`, le calcul du nom de repli ; ne pas toucher aux signaux/handlers existants -- alimente le nouveau template sans changer `HommeDragonService`.
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` -- Réécrire en cartes (`sheet__card`) façon `CharacterSheet`, brancher `detail.open(...)` sur l'artefact et chaque pouvoir d'éveil, appliquer le repli de nom -- couvre AC1-AC4 sans perte de champ (AC3).
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.scss` -- Créer la feuille de style sur le modèle de `character-sheet.scss` -- condition de parité visuelle (AC1).
- [x] `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts` -- Étendre les ~32 tests existants : ouverture/fermeture de la surface de détail (artefact, pouvoir d'éveil), rendu du nom de repli -- ferme l'écart de couverture introduit par le rework.

**Acceptance Criteria:**
- Given la fiche ouverte sur un viewport téléphone (<1024px), when elle se rend, then aucun champ n'est tronqué et la structure suit le même motif de cartes que `CharacterSheet`.
- Given un élément artefact ou pouvoir d'éveil affiché, when il est activé, then il s'ouvre via `DetailSurface`/`createDetailSurfaceHost()`, avec la même API que `CharacterSheet`.
- Given chaque champ présent sur le template actuel (formulaire de création, artefact, champs libres, invite d'éveil, pouvoirs choisis, dérivé, voyageurs protégés, historique, export PDF), when le rework est livré, then chacun reste visible et fonctionnel.
- Given le nom affiché sur la fiche, when il est rendu, then il suit le même repli que `characterName()`.

## Implementation Notes

- La commande de vérification listée (`pnpm vitest run ...`) échoue dans ce dépôt : `apps/web` teste via le builder Angular `@angular/build:unit-test` (`ng test`, cf. `apps/web/package.json` script `test` et `angular.json`), pas un `vitest.config.ts` autonome — un `pnpm vitest run` direct plante sur `window is not defined` (l'environnement jsdom/TestBed n'est initialisé que par le builder). Commande réellement utilisée pour vérifier cette story (même outillage projet, juste le bon point d'entrée) :
  `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts"`.
- `artefactDetail()`/`eveilPowerDetail()` n'affichent un déclencheur `DetailSurface` que si le catalogue (ou l'`inscription` MJ pour l'artefact) porte un texte non vide (`detailContent()`) ; sinon le libellé reste du texte simple, comme le veut AC3/FR-19. Les catalogues `eveil-powers.json`/`homme-dragon-artefacts.json` portent tous une `description` en production — le repli "texte simple" ne se déclenche que sur des données de test volontairement incomplètes.
- Regroupement des champs libres restants (apparence, caractère, vocation, demeure, avatar, mondesProteges) sous une carte "Présentation" commune (affichée seulement si au moins un champ est renseigné) plutôt qu'en paragraphes isolés au niveau racine — chaque champ reste individuellement conditionné comme avant, seul le conteneur change.
- Aucune route dédiée ni `BreakpointObserver` ajoutés dans `HommeDragonSheet` : la bascule feuille du bas (mobile) / fenêtre centrée (desktop) de la surface de détail est déjà entièrement gérée en interne par `DetailSurface` (seuil 1024px), rien à répliquer ici.
- Vérification indépendante (étape build) : les deux commandes ci-dessous ont été rejouées telles quelles et confirment le rapport du sous-agent d'implémentation (35/35 puis 144/144). `eslint` sur les deux fichiers `.ts` touchés ne remonte rien. Les deux lignes de la matrice non couvertes par un test (largeur < 1024px / ≥ 1024px) ont été vérifiées manuellement dans le navigateur (voir Verification) plutôt que par un test jsdom, cette bascule étant portée par une media query CSS pure (`homme-dragon-sheet.scss`, seuil 768px pour l'empilement en colonnes — cf. précédent identique dans `character-sheet.scss`) et par le seuil interne 1024px de `DetailSurface`, ni l'un ni l'autre observables en jsdom.

## Spec Change Log

## Review Triage Log

- **[blind-hunter] `sprint-status.yaml` marque `in-progress` alors que la spec est en revue avec tests verts** — `false` : c'est l'état intermédiaire voulu par le workflow — `sync-sprint-status.md` n'est appelé qu'à l'étape 3 (`in-progress`) et le sera à l'étape 5 (`review`) ; rien ne le déclenche à l'étape 4.
- **[blind-hunter] `artefactLabel()`/`artefactDetail()`/`eveilPowerDetail()` refont chacun un `.find()` sur le même catalogue** — `low`, rejeté : impact imperceptible (catalogues de quelques entrées, lus en changement de détection Angular) et la consolidation ajouterait un accessoire computed partagé — plus qu'une correction directe.
- **[blind-hunter] Le texte de la spec (« un seul seuil, 1024px ») n'explique pas le second seuil 768px de mise en page** — fix = éditer la spec de ce build, exclu par la règle de triage.
- **[blind-hunter] `makeBreakpointObserver(desktop = false)` : les nouveaux tests « Surface de détail » n'exercent jamais `desktop: true`** — `low`, vérifié : le composant reste correct (vérifié manuellement en navigateur ci-dessous), seule la couverture par test unitaire est asymétrique par rapport au patron explicite de `character-sheet.spec.ts`. Correction directe (un paramètre) → non rejeté, route en `patch`.
- **[blind-hunter] Cas mixtes non testés pour l'artefact (nom perso + description catalogue / label catalogue + inscription perso)** — `low`, rejeté : logique à deux OR indépendants déjà bornée aux deux extrêmes testés, sans interaction entre titre et corps ; ajouter les combinaisons est plus qu'une correction directe pour un risque quasi nul.
- **[blind-hunter] Repli sur la clé brute (`art.key`) quand ni `nom` ni `label` catalogue ne sont disponibles** — `false` : comportement hérité à l'identique de l'ancien template (`nom || key`) — la nouvelle version ajoute même un palier `catalogData?.label` avant d'atteindre ce repli, donc réduit le risque au lieu de l'introduire.
- **[blind-hunter] `&__header` utilise `align-items: flex-start` alors que `character-sheet.scss` (le patron explicitement suivi) utilise `center`** — `low`, vérifié par lecture directe de `character-sheet.scss:17-22`. Correction directe (une ligne CSS) → non rejeté, route en `patch`.
- **[blind-hunter] Titres de carte codés en dur (« Présentation », « Statistiques dérivées », ...) au lieu de `theme.tone()`** — `false` : `character-sheet.html`, le patron suivi, code déjà ses propres titres de section en dur — aucun écart introduit par cette story, aucun préjudice nommé.
- **[blind-hunter] La note d'implémentation sur la commande `vitest` erronée ne corrige pas sa source documentée** — réel mais préexistant, sans rapport avec le code de cette story (gabarit/doc BMAD) → `defer`.
- **[edge-case-hunter] `hommeDragon()` pourrait redevenir `null` pendant qu'une surface de détail est ouverte, laissant un contenu obsolète affiché par-dessus le formulaire de création** — `false`, vérifié : `HommeDragonService`/l'API backend n'exposent aucune suppression (`apps/api/src/homme-dragon/homme-dragon.service.ts` ne porte ni `delete` ni `remove`), donc `findOne()` ne peut jamais repasser à `null` une fois la fiche créée pour ce couple utilisateur/Partie — le déclencheur décrit est inatteignable.
- **[verification-gap] La nouvelle carte « Présentation » regroupe 6 champs (apparence/caractère/vocation/demeure/avatar/mondesProteges) derrière une condition agrégée jamais exercée par un test sur une fiche existante affichée** — `medium` (finding pré-vérifié, disposition classée `patch` par la couche elle-même) : aucun test ne construit une fiche existante avec l'un de ces champs renseigné, donc une régression sur la condition agrégée (ex. `&&` au lieu de `||`, un champ oublié) ferait disparaître ces 6 champs sans qu'aucun test échoue — exactement ce que l'AC3 de la story interdit.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.spec.ts"` -- 36/36 tests passent après les 3 correctifs de revue (35 + 1 test sur les champs libres de la carte « Présentation »).
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/parties/partie-detail/partie-detail.spec.ts"` -- 144/144 tests passent (non-régression de l'intégration dans `PartieDetail`).

**Manual checks (if no CLI):**
- Fait (compte de démo `mj-demo@example.com`, Partie « La Route des Lanternes », Homme Dragon « Kaien ») : viewport téléphone (375px) → cartes empilées, aucune troncature, déclencheur d'artefact ouvre la surface de détail en feuille du bas. Viewport desktop (1280px) → mise en page à deux colonnes, même déclencheur ouvre la surface de détail en fenêtre centrée. Les deux lignes de matrice « Écran < 1024px » / « Écran ≥ 1024px » sont donc couvertes.
