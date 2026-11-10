---
baseline_commit: 1a0c7d279932a0fb5a76a313d78a369671401d82
---

# Story 31.3: Aide contextuelle sur les termes de jeu

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a joueur débutant,
I want comprendre un terme du système sans ouvrir le livre,
so that je puisse jouer sans interrompre la partie pour poser une question.

---

**Troisième story de l'épic 31** (Palier 9 — Fiche de personnage). Porte **FR-19** seule
(`prd.md:200`). L'épic ne lui attache **aucune AD dédiée** (`epics.md:291` : l'`AD-7` de l'épic
concerne exclusivement les cadenas de visibilité, stories 31.6/31.7) — mais **deux invariants
existants la contraignent directement** :

| Invariant | Contrainte concrète sur cette story |
| --- | --- |
| **P5-AD-4** (`ARCHITECTURE-SPINE.md:56`) | « Tout catalogue de choix fixes = `ContentType`/`ContentEntry` seedé — l'aide contextuelle (FR-19/FR-20) **lit** ce catalogue, **ne crée aucun mécanisme de contenu** » |
| **P8-AD-9** (`ARCHITECTURE-SPINE.md:61`, `AD-13` `:150`) | « `tones.ts` reste **neutre vis-à-vis du système de jeu** : aucun texte de règle Ryuutama n'y entre » |

La carte FR → module de la spine (`ARCHITECTURE-SPINE.md:471`) est explicite :
`FR-19, FR-20 (aide contextuelle) → GameSystemService.getContent() (catalogue seedé au Palier 8)`.

🚨 **Cette story ne construit AUCUN composant neuf de présentation.** `DetailSurface`
(`apps/web/src/app/shared/detail-surface/`) a été construit par la 31.2 **explicitement pour être
réutilisé ici** (`31-2-…md:208-215`, Encadré n°1 ; `EXPERIENCE.md:416` : « Sert indifféremment les
termes de règle du catalogue (FR-19) et les éléments possédés par le personnage (FR-20) —
mutualisation confirmée »). Le réécrire, le forker ou en dupliquer la mécanique est un échec de la
story, pas une variante acceptable.

---

## Acceptance Criteria

### Les trois AC d'`epics.md:1375-1386`, verbatim

**AC1 — activer un terme ouvre son texte dans la surface de détail**
**Given** un terme de règle affiché sur ma fiche ou dans l'assistant — classe, spécialité, option
**When** je l'active
**Then** son texte explicatif s'affiche dans la surface de détail

**AC2 — les textes viennent du catalogue, jamais du registre de thèmes**
**Given** ces textes
**When** ils sont chargés
**Then** ils proviennent du catalogue déjà seedé
**And** aucun texte de règle n'est écrit en dur dans le registre de thèmes

**AC3 — pas de texte ⇒ pas d'aide (jamais une surface vide)**
**Given** un terme dont le catalogue ne porte aucun texte
**When** je l'active
**Then** l'application ne propose pas d'aide plutôt que d'afficher un contenu vide

### AC ajoutés par cette story

**AC4 — déclencheurs réels, jamais un `<span>` cliqué**
**Given** un terme rendu comme activable
**When** son nom est affiché
**Then** il est porté par un `<button type="button">`, jamais un gestionnaire de clic posé sur du
texte inerte — même exigence que l'AC7 de la 31.2, accessible au clavier sans changement

**AC5 — une seule surface à la fois, y compris dans l'assistant**
**Given** une surface de détail ouverte sur un terme
**When** j'en active un autre sur le même écran
**Then** son contenu est remplacé, sans empiler deux panneaux ni deux voiles
**And** ceci vaut dans l'assistant de création comme sur la fiche

**AC6 — le focus revient au déclencheur, partout**
**Given** une surface de détail ouverte depuis n'importe quel nouvel emplacement de cette story
**When** elle se referme (croix, `Échap`, ou voile sur mobile)
**Then** le focus retourne au déclencheur d'origine
**And** ce comportement n'est pas réimplémenté indépendamment à chaque emplacement (cf. Task 1)

**AC7 — portée close : front uniquement**
**Given** la fin de l'implémentation
**When** `git status` est lu
**Then** aucun fichier de `apps/api/`, aucun JSON de `apps/api/game-systems/ryuutama/data/`,
aucun de `packages/shared/`, aucune migration — les textes affichés existent **déjà** dans le
catalogue seedé, aucun n'est à créer ni à enrichir par cette story

---

## Tasks / Subtasks

- [x] **Task 0 — Mesurer la baseline AVANT toute modification** (préalable à tout)
  - [x] Vérifier l'arbre propre et relever le `HEAD` réel. ⚠️ **La branche courante au moment de la
        création de cette story est `fix/ci-env`** (`HEAD = 7d6fc2f`), une branche de CI, pas une
        branche de feature — et deux commits d'outillage (`3210564`, `7d6fc2f`) ont atterri après
        le `424f506` qui servait de baseline à la 31.2. **Confirmer avec l'utilisateur sur quelle
        branche implémenter avant de commencer.** Ne jamais changer l'état git soi-même.
  - [x] `docker compose exec web pnpm test` → relever fichiers/tests
  - [x] `docker compose exec web pnpm lint` → relever le nombre d'erreurs
  - [x] 🚨 **Ne pas recopier les chiffres de la 31.2** (116 fichiers / 2256 tests, lint 145,
        mesurés le 2026-08-25 sur `424f506`). Ce sont des repères, pas la baseline. **La mesure
        fraîche fait foi.** Objectif de sortie : **lint = baseline exactement**.

- [x] **Task 1 — 🔶 Trancher le point d'architecture : comment un nouvel emplacement consomme `DetailSurface`** (AC5, AC6)
  - [x] **Ce point est un vrai choix, à faire AVANT d'écrire du code, et à valider avec
        l'utilisateur.** Il conditionne la forme de tout le reste de la story.
  - [x] **Le problème** : `DetailSurface` est un composant de *rendu pur*. Tout ce qui l'entoure —
        le signal `selectedDetail`, le compteur `detailOpenToken`, la mémorisation du déclencheur
        et le retour de focus — vit aujourd'hui **dans `CharacterSheet`**
        (`character-sheet.ts:228-258`). C'est exactement la dette consignée en
        `deferred-work.md:15`, **[P:MOYENNE], qui nomme cette story** : « Chaque story qui
        réutilisera `DetailSurface` (31.3 glossaire, 31.4 assistant de création) devra
        réimplémenter ce tracking/refocus indépendamment. »
  - [x] Or cette story ajoute des emplacements dans **au moins 3 composants distincts**
        (`class-step`, `type-step`, et la fiche), et la 31.4 en ajoutera d'autres. Recopier 30
        lignes d'état trois fois est une régression de conception, pas une implémentation.
  - [x] **Option A — hôte partagé (recommandée).** Extraire l'état + le retour de focus dans un
        élément réutilisable de `apps/web/src/app/shared/detail-surface/` : soit une directive
        hôte, soit une petite classe/fonction `createDetailSurfaceHost(hostElement)` exposant
        `{ selected, openToken, open(title, body, event), close() }`. `CharacterSheet` est
        **migré dessus** (son comportement actuel devient le comportement de référence, ses 6 tests
        existants servent de filet), chaque nouveau consommateur l'utilise tel quel.
        *Coût* : touche `CharacterSheet`, déjà validé en revue. *Gain* : ferme
        `deferred-work.md:15`, la 31.4 hérite du mécanisme.
  - [x] **Option B — une surface unique, propriété d'un service racine.** `DetailSurfaceService`
        (`providedIn: 'root'`) porte l'état, la surface est montée une seule fois dans le shell,
        les déclencheurs appellent `service.open()`. *Gain* : garantit AC5 même entre composants
        frères sans coordination. *Coût* : touche le shell de l'application, mécanisme global
        nouveau — nettement plus large que ce que la story demande, et non exigé par les AC.
  - [x] **Option C — statu quo, on recopie l'état dans chaque nouveau composant.** *Le seul
        avantage est l'absence de refactoring* ; il triple la dette que `deferred-work.md:15`
        signale déjà. **À ne retenir que sur décision explicite de l'utilisateur.**
  - [x] Quelle que soit l'option : **`DetailSurface` lui-même n'est pas réécrit** — son contrat
        `[title] [body] [openToken] (closed)` (`detail-surface.ts:29-37`) reste tel quel.
  - [x] Consigner la décision et sa raison dans les Completion Notes.

- [x] **Task 2 — Fiche : rendre activables les termes qui portent un texte** (AC1, AC3, AC4)
  - [x] `character-sheet.ts` : **les interfaces locales `ClassData` (`:85-89`) et `TypeData`
        (`:125-128`) ne déclarent PAS `description`** — alors que `classes.json` et `types.json` en
        portent une. Le cast local l'efface. **Ajouter `description?: string`** à ces deux
        interfaces est le premier geste, sinon le texte est invisible côté TypeScript.
  - [x] **Classe** — `character-sheet.html:217` (`Vocation — {{ classData()?.label }}`) et `:233`
        (`Classe secondaire : {{ secondary.label }}`) : le libellé devient un déclencheur ouvrant
        `classData()?.description`.
  - [x] **Option de classe** (`requiredChoices` — Métier d'appoint / Métamorphose / Autorité) —
        `character-sheet.html:245-256`. 🎁 **Le texte est déjà résolu** : `ClassChoiceDisplay`
        (`character-sheet.ts:98-107`) porte `talentName` et `talentEffectDescription`, produits par
        la résolution du `talentId` du choix vers le talent parent. **Ne pas réécrire cette
        résolution** — la brancher. La branche `eligible-talent` (`:248-252`) affiche aujourd'hui
        `talentEffectDescription` **en ligne** : appliquer le même arbitrage que la 31.2 (Completion
        Note 2) — le texte **quitte** la ligne quand il passe derrière un déclencheur, il n'est pas
        dupliqué. Le malus et la classe d'origine restent en ligne (statistiques de référence).
  - [x] **Spécialité** — `character-sheet.html:218-220`. ⚠️ **La spécialité n'a AUCUNE entrée de
        catalogue** : c'est du texte libre saisi par le joueur (`sheetData.specialtyTypeId`), seul
        un libellé d'aide `specialtyLabel` existe sur la classe Artisan. **C'est le cas d'école de
        l'AC3 : aucun déclencheur n'est rendu.** Ne pas fabriquer un texte, ne pas afficher une
        surface vide, ne pas ajouter d'entrée de seed (AC7).
  - [x] 🔶 **Décision à prendre : le Type/Voie est-il dans le périmètre ?** L'AC1 énumère « classe,
        spécialité, option » ; le FR-19 (`prd.md:200`) écrit « Les **termes**, classes, spécialités
        et options ». `types.json` porte bien une `description`, et la fiche rend « Vocation — »
        (`:217`) et « Voie — » (`:260`) de façon strictement symétrique : n'en câbler qu'une donne
        un écran visiblement incohérent. **Recommandation : inclure Type/Voie** (`:260`, `:273`) —
        coût quasi nul, même mécanisme. Trancher explicitement et le consigner.
  - [x] 🔶 **Même question pour la catégorie d'arme** (`weapon-categories.json` porte une
        `description`, rendue en ligne nulle part sur la fiche — `character-sheet.html:371`).
        **Recommandation : inclure** si Type/Voie est inclus, exclure sinon — mais ne pas laisser
        la question implicite.
  - [x] **Explicitement HORS périmètre sur la fiche** : talents et avantages (déjà faits par la
        31.2), sorts rituels (idem), saison d'affinité / paysages / immunités (`seasons.json`,
        `landscapes.json`, `immunity-states.json` sont `{key, label}` **nus**, aucun texte → AC3),
        arme précise (`weapon-items.json`, pas de description), patron d'attributs.

- [x] **Task 3 — Assistant de création : mêmes termes, même geste** (AC1, AC3, AC4, AC5)
  - [x] L'AC1 dit « sur ma fiche **ou dans l'assistant** » — l'assistant n'est pas optionnel.
        `EXPERIENCE.md:488` étend explicitement le geste à l'assistant.
  - [x] **`class-step`** : les cartes de classe (`class-step.html:10-16`) et le bloc de détail
        (`:21` `{{ data.description }}`, `:22-30` talents en ligne). Le texte de classe est
        **aujourd'hui toujours visible en ligne** — le faire passer derrière la surface est
        cohérent avec l'AC1 et avec l'arbitrage de la 31.2. ⚠️ Mais l'assistant est un écran de
        **choix** : masquer la description qui aide à choisir peut dégrader le parcours.
        🔶 **Arbitrage à trancher et à consigner** — recommandation : dans l'assistant, la
        description courte reste en ligne (elle sert au choix), et **les termes** (talents,
        occupations, options) passent derrière la surface. Ne pas décider en silence.
  - [x] **`type-step`** : `type-step.html:21` (`data.description`), `:24-27` (avantages en ligne).
  - [x] **`weapon-step`** : `weapon-step.html:18` (`category.description`) — à inclure si la
        catégorie d'arme est retenue en Task 2.
  - [x] Les cartes de choix passent par `<app-choice-card>`
        (`choice-card.ts:3-7`, `ChoiceCardOption { key; label; detail? }`) et une navigation clavier
        `appRadioGroupNav` (`radio-group-nav.directive.ts`). 🚨 **Un bouton d'aide imbriqué dans une
        carte-radio est un piège** : il ne doit ni voler le clic de sélection, ni casser la
        navigation aux flèches du radiogroup. Vérifier ce point explicitement à la Task 6.
  - [x] **HORS périmètre dans l'assistant** : `magic-step` (saisons `{key,label}` nues, et les
        sorts ont déjà leur description en ligne — même famille que la 31.2), `attributes-step`,
        `fetish-step`, `equipment-step`, `narrative-step`, `portrait`. Et **toute refonte du
        parcours** : c'est la story 31.4, pas celle-ci.

- [x] **Task 4 — AC3 vérifié comme une règle, pas comme un cas particulier**
  - [x] Écrire la condition **une seule fois**, au plus près du rendu : un terme n'est rendu
        activable que si son texte est une chaîne non vide après `trim()`.
  - [x] 🚨 **Le déclencheur ne doit pas exister dans le DOM** quand il n'y a pas de texte — ni
        bouton désactivé, ni bouton qui ouvre `'Aucune description disponible.'`. Le repli
        `detail-surface.html:18` est un filet de sécurité du composant partagé, **pas** le
        comportement attendu par l'AC3.
  - [x] Cas de test naturel : la spécialité (Task 2) et un personnage dont la classe n'a pas de
        `description`.

- [x] **Task 5 — Tests** (AC1 à AC7)
  - [x] Un test par AC verbatim, nommé avec son numéro (convention du projet, cf.
        `character-sheet.spec.ts:916-983`).
  - [x] **AC2 est testable, et doit l'être** : le patron existe déjà —
        `character-wizard.spec.ts:153,276` monte une fixture `wizardStepIntro` seedée tandis que le
        `ThemeToneService` factice ne porte **que** `character.step_portrait_intro`. C'est ce test
        qui attraperait un texte de règle remis dans `tones.ts`. Le reproduire pour les nouveaux
        emplacements : le texte affiché doit venir de la fixture de contenu, jamais du service de
        thème.
  - [x] **AC3** : absence du déclencheur dans le DOM (`expect(...).toBeNull()`), pas seulement
        absence de la surface.
  - [x] **AC5** : un seul `.detail-surface-panel` dans le DOM après avoir activé un second terme
        (même assertion que `character-sheet.spec.ts:938`).
  - [x] **AC6** : `document.activeElement` revient au déclencheur après fermeture.
  - [x] ⚠️ **Tests préexistants qui vont casser, à METTRE À JOUR et non à supprimer** — le piège
        s'est produit sur la 31.1 **et** la 31.2 (Completion Note 4) : tout test qui assertait la
        présence d'une description **en ligne** devient faux dès qu'elle passe derrière un
        déclencheur. Candidats connus : `class-step.spec.ts` (fixture avec `description` `:11`,
        Météomancien `:177-195`), `type-step.spec.ts`, `weapon-step.spec.ts`,
        `character-sheet.spec.ts:1708-1810` (cas Météomancien/Climatophile).
  - [x] **Limite connue du harnais** : jsdom ne vérifie pas de façon fiable le re-focus lors d'un
        remplacement en place (`detail-surface.spec.ts:103-111`, Completion Note 5 de la 31.2).
        Ne pas y perdre du temps ni contourner en silence : le documenter et le vérifier à la
        Task 6.
  - [x] Zoneless : reprendre la boucle de ticks établie (`detail-surface.spec.ts:35-50`),
        `whenStable()` seul ne suffit pas.

- [x] **Task 6 — Vérification visuelle réelle** (non négociable) — **REALISEE PAR L'UTILISATEUR** (2026-08-29), pas par l'agent : l'extension Chrome est restee injoignable cote agent (`list_connected_browsers` vide, `tabs_context` en echec). Voir Completion Note 6.
  - [x] Via **Chrome MCP `claude-in-chrome`** sur une session ouverte par l'utilisateur — jamais le
        navigateur interne. Piège connu `resize_window`/`outerWidth` (31.1, 31.2, 36.11).
  - [x] 🚨 **C'est la vérification visuelle, et non les tests unitaires, qui a trouvé les défauts
        réels des deux stories précédentes** (31.1 : 4 correctifs ; 31.2 : 3 défauts dont deux
        cassaient un AC en pratique alors que la logique signal était correcte). Ne pas s'en passer.
  - [x] Scénarios obligatoires : (a) fiche, ouvrir un terme puis **en activer un second pendant que
        la surface est ouverte** — c'est ce scénario précis qui a révélé le backdrop bloquant de la
        31.2 ; (b) `Échap` **après** un remplacement en place ; (c) dans l'assistant, cliquer le
        bouton d'aide d'une carte-radio **sans** sélectionner la carte, puis vérifier que les
        flèches du radiogroup naviguent toujours ; (d) un terme sans texte : **aucun** déclencheur
        visible (AC3) ; (e) les deux présentations, téléphone (feuille) et ordinateur (panneau).

- [x] **Task 7 — Non-régression et portée**
  - [x] `docker compose exec web pnpm test` · `pnpm lint` (= baseline exactement) ·
        `pnpm ng build --configuration development`
  - [x] `git status` : **seuls des fichiers `apps/web/`** doivent apparaître (AC7).
  - [x] Aucune dépendance ajoutée. `@angular/cdk` 22.1.3 est déjà présent
        (`apps/web/package.json:15`) et fournit tout le nécessaire — **⛔ aucun `pnpm add`,
        règle absolue du dépôt.**

---

## Dev Notes

### Encadré n°1 — Le contrat de `DetailSurface`, à consommer tel quel

`apps/web/src/app/shared/detail-surface/detail-surface.ts` — standalone, sélecteur
`app-detail-surface`. **Toute la surface d'API publique tient en quatre lignes** :

| Membre | Type | Ligne |
| --- | --- | --- |
| `title` | `input.required<string>()` | `:29` |
| `body` | `input.required<string>()` | `:30` |
| `openToken` | `input<number>(0)` | `:36` |
| `closed` | `output<void>()` | `:37` |

Aucune méthode publique, aucun `open()`. **L'ouverture appartient à l'appelant** : le composant est
monté sous `@if` et démonté quand l'état de l'hôte repasse à `null`. Patron d'usage de référence,
`character-sheet.html:521-528` :

```html
@if (selectedDetail(); as d) {
  <app-detail-surface
    [title]="d.title"
    [body]="d.body"
    [openToken]="detailOpenToken()"
    (closed)="closeDetail()"
  />
}
```

🚨 **`openToken` n'est pas décoratif.** C'est un compteur que l'appelant incrémente à **chaque**
activation. Sans lui, deux déclencheurs portant un titre **et** un corps strictement identiques
(un même talent atteignable par la classe primaire *et* la secondaire) ne redéclenchent pas
l'`effect()` de focus — égalité de valeur des signaux — et `Échap` cesse silencieusement de
fonctionner. Défaut réel trouvé en revue de code de la 31.2 (`31-2-…md:197`). **Tout nouveau
consommateur doit l'incrémenter.**

Trois chemins de fermeture, tous émettant `closed` : voile (mobile uniquement — le voile est
`display:none` au-delà de `1024px`, `detail-surface.scss:23-25`), bouton Fermer, `Échap`.
`role="dialog"` est inconditionnel ; `aria-modal` et `cdkTrapFocus` sont **volontairement
désactivés en desktop** (`detail-surface.html:5,7`) pour que la fiche reste interactive — décision
utilisateur validée en revue de la 31.2, ne pas la « corriger ».

### Encadré n°2 — Où vit chaque texte, et lequel n'existe pas

Tout passe par `GET /game-systems/:id/content`
(`game-system.controller.ts:20-23`, guard `AuthenticatedGuard`) → `GameSystemContentDto` =
`Record<string, ContentEntryDto[]>` (`packages/shared/src/index.ts:1094`), où `ContentEntryDto.data`
est **`unknown`** : chaque consommateur fait son propre cast. Résolution côté front :
`findContentEntry<T>(content, contentType, key)` (`character.util.ts:9-17`), ou
`content()?.['<type>']` (patron `character-wizard.ts:191-200`).

| Terme | ContentType | Texte disponible ? |
| --- | --- | --- |
| **Classe** | `class` | ✅ `description` (12 classes) + par talent `description` et `effect.description` |
| **Type / Voie** | `type` | ✅ `description` ; les avantages n'ont que `effect` (chaîne) |
| **Catégorie d'arme** | `weaponCategory` | ✅ `description` |
| **Option de classe** | *(aucun)* | 🎁 pas d'entrée propre — `requiredChoices[]` ne porte que `key/talentId/kind/label` ; **le texte est celui du talent parent**, déjà résolu dans `ClassChoiceDisplay.talentEffectDescription` |
| **Spécialité** | *(aucun)* | ❌ texte libre du joueur, aucune entrée — **cas AC3** |
| Saison, paysage/climat, état d'immunité | `season`, `landscape`, `immunityState` | ❌ `{key, label}` nus — **cas AC3** |
| Arme précise, patron d'attributs | `weaponItem`, `attributePattern` | ❌ pas de texte |

⛔ **Ne pas enrichir les JSON de seed pour combler ces trous.**
`apps/api/game-systems/ryuutama/data/` est **gitignoré** (contenu sous droits d'auteur, NFR4) — un
enrichissement ne serait ni versionné ni reproductible, et le cache `contentCache`
(`game-system.service.ts:122`) n'est **jamais invalidé** : il exigerait un redémarrage de l'API.
L'AC3 est la réponse prévue à ces trous, pas un contournement.

### Encadré n°3 — AC2 : ce que « pas dans le registre de thèmes » interdit exactement

`tones.ts` (`apps/web/src/app/core/theme/tones.ts`) est un registre de **micro-copie d'interface
teintée par thème**, 308 clés répliquées dans trois blocs (`grimoire-emeraude` `:16-371`,
`foret-ancienne` `:374-723`, `medieval-steampunk` `:726-1071`), lues via
`theme.tone()['<clé>']`.

- ✅ **Autorisé** : une étiquette générique d'interface, si elle est vraiment nécessaire (ex. un
  `aria-label` « Aide sur ce terme »). Elle s'ajoute alors dans **les trois blocs** + une entrée
  dans un `describe` de parité de `theme-tone.service.spec.ts` (patron `:68-74`).
- ⛔ **Interdit** : tout texte de règle Ryuutama, même court, même « ce n'est qu'un texte » — c'est
  la formulation exacte de l'AD-9 révisée. Précédent : la story 23.3 a dû déplacer 7 textes de
  `tones.ts` vers un `ContentType` `wizardStepIntro` **après** revue, sur retour utilisateur.
- ⚠️ **Piège de typage** : `TONE_MAP: Record<Theme, Record<string, string>>` (`tones.ts:14`)
  garantit la présence des trois thèmes, **pas** celle d'une clé dans chacun. Une clé oubliée dans
  un thème compile et rend `undefined` à l'écran. **Aucun lint ne l'attrape** — seul un test de
  parité écrit à la main. (La découpe qui fermerait ce trou est la story 35.1, pas celle-ci.)
- Le bouton Fermer de `DetailSurface` porte déjà `aria-label="Fermer"` en dur
  (`detail-surface.html:10-16`) — hérité de la 31.2, ne pas le « corriger » au passage.

### Encadré n°4 — Le seuil `1024px` et le `z-index`, déjà connus, à ne pas re-débattre

`DetailSurface` code le seuil desktop en dur à trois endroits (`detail-surface.ts:42`,
`detail-surface.scss:23`, `:43`), et le projet en compte sept au total sans source unique
(`calendar-view.ts:228`, `character-sheet.ts:194`, `partie-detail.ts:126`,
`list-control-bar.ts:34`, `character-wizard.scss:155`…). Idem pour le couple `z-index: 199/200`.
C'est une dette **préexistante**, consignée en `deferred-work.md:17`, **explicitement hors périmètre
ici** — ne pas centraliser au passage, ne pas la reconsigner.

*(Note : les références de ligne de `deferred-work.md:16-17` sont périmées — elles pointent
`detail-surface.ts:36` et `character-sheet.scss:99-114`, les emplacements réels sont
`detail-surface.ts:42` et `character-sheet.scss:271-286`. Ne pas s'y fier aveuglément.)*

### Encadré n°5 — Style du déclencheur : réutiliser, pas réinventer

`.sheet__detail-trigger` (`character-sheet.scss:271-286`) est le style établi par la 31.2 : reset de
bouton pour ressembler au `<strong>` qu'il remplace, soulignement au `:hover`/`:focus-visible`.
Il est **local à la fiche**, pas fourni par le composant partagé — chaque nouvel emplacement doit
fournir son style de déclencheur. En reprendre l'aspect (et non le copier-coller à l'identique dans
trois SCSS) fait partie de l'arbitrage de la Task 1.

Dette héritée à connaître, **non bloquante** : la cible tactile de ce déclencheur est limitée au
texte du nom, sans `min-height`/padding (`deferred-work.md:16`, risque WCAG 2.5.5). Ne pas
l'aggraver sur les nouveaux emplacements ; la corriger globalement n'est pas demandé ici.

### Pas de temps réel à câbler — vérification explicite

`CLAUDE.md` exige d'évaluer tout nouveau composant affichant des données scopées à une Partie pour
un câblage sur `changed`/`notifyChanged()` (`docs/checklist.md`). **Évalué : sans objet.** Le
catalogue de contenu est statique — seedé une seule fois au bootstrap
(`game-system.service.ts:129-131`), servi depuis un cache mémoire jamais invalidé (`:122`), et
aucun endpoint ne le modifie. Rien à propager.

### Ce qui est HORS périmètre

- **`apps/api/`, `packages/shared/`, les JSON de seed, toute migration** (AC7).
- **La refonte du parcours de création** : story 31.4. Cette story *ajoute une aide* aux étapes
  existantes, elle ne réorganise ni ne redessine l'assistant.
- **Enrichir les catalogues sans texte** (saisons, paysages, immunités, armes précises) — cf.
  Encadré n°2, l'AC3 est la réponse prévue.
- **Les talents, avantages et sorts rituels de la fiche** : déjà livrés par la 31.2, ne pas y
  retoucher.
- **La fiche Homme Dragon** (`homme-dragon-sheet`), le **level-up wizard** et la **carte de résumé**
  (`character-summary-card`) : aucun AC ne les vise.
- **La centralisation du seuil `1024px`** et du `z-index` (Encadré n°4).

### 🐛 Défaut préexistant repéré pendant l'analyse — À SIGNALER, PAS À CORRIGER ICI

Le `ContentType` `wizardStepIntro` porte une entrée de clé **`weaponCategoryId`**
(`wizard-step-intros.json`), alors que la clé d'étape déclarée par l'assistant est **`weaponId`**
(`character-wizard.ts:40`, `SUPPORTED_STEP_KEYS`). Le `stepIntroText` de cette étape
(`character-wizard.ts:195-200`) **ne correspond donc jamais** : le texte d'introduction de l'étape
« arme » n'a jamais été affiché depuis la story 23.3. Le dev agent va croiser ce code en Task 3.
**Hors périmètre de cette story** (c'est FR-21/31.4 ou un correctif dédié) — le remonter à
l'utilisateur, ne pas le corriger au passage.

### Project Structure Notes

Fichiers **attendus en modification** :

```
apps/web/src/app/features/characters/character-sheet/character-sheet.{ts,html,scss,spec.ts}
apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.{ts,html,scss,spec.ts}
apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.{ts,html,scss,spec.ts}
apps/web/src/app/features/characters/character-wizard/steps/weapon-step/*   (si la catégorie d'arme est retenue)
```

Fichiers **potentiellement créés**, selon l'arbitrage de la Task 1 :

```
apps/web/src/app/shared/detail-surface/   (hôte partagé — Option A)
```

Fichiers **interdits** : tout `apps/api/`, tout `packages/shared/`, tout
`apps/api/game-systems/ryuutama/data/*.json`, toute migration.

Conventions : composants **standalone**, `@if`/`@for` et signals — jamais `*ngIf`/`*ngFor`
(`P1-AD-5`) ; `input()`/`output()`, jamais `Subject` ; `*.spec.ts` à côté du source ; commentaires
et messages **en français** (dérogation assumée du dépôt, `CLAUDE.md`).

### Testing

- **Runner** : Vitest via `@angular/build:unit-test`, jsdom. `docker compose exec web pnpm test`
- **Lint** : `docker compose exec web pnpm lint` — objectif **= baseline exactement**
- **Build** : `docker compose exec web pnpm ng build --configuration development`
- **Tout par Docker** — aucun outil Node sur l'hôte, jamais d'installation de dépendance
- **Zoneless** : boucle de ticks établie du projet, `whenStable()` seul ne suffit pas
- **Repères de la 31.2** (2026-08-25, `424f506`) : web 116 fichiers / 2256 tests, lint 145.
  **À remesurer** (Task 0) — la branche et le `HEAD` ont changé depuis.
- **Vérification visuelle réelle obligatoire** via Chrome MCP (Task 6)

### References

- [Source: _bmad-output/planning-artifacts/epics.md:1367-1386] — Story 31.3, les 3 AC verbatim
- [Source: _bmad-output/planning-artifacts/epics.md:285-291] — FRs de l'épic 31, note « AD-7 hors périmètre »
- [Source: _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md:196-209] — FR-19, FR-20 et la frontière entre les deux ; §4.4 « les textes explicatifs ont été seedés au Palier 8 et ne sont exploités nulle part »
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md:56] — P5-AD-4, l'aide contextuelle **lit** le catalogue
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md:61, :150] — P8-AD-9 / AD-13, `tones.ts` neutre vis-à-vis du système de jeu
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md:471] — carte FR-19/FR-20 → `GameSystemService.getContent()`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-07-24/ARCHITECTURE-SPINE.md:99-104] — AD-9 `[REVISED]`, le précédent des 7 textes sortis de `tones.ts`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md:416] — §4.6, mutualisation FR-19/FR-20 confirmée
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md:488, :692-693] — geste d'activation, tableau responsive
- [Source: _bmad-output/implementation-artifacts/31-2-surface-de-detail-adaptative.md:208-253] — Encadrés 1-3 et périmètre exclu de la 31.2 (le glossaire FR-19 y est nommément renvoyé ici)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:15-17] — dette héritée, dont l'item [P:MOYENNE] qui nomme cette story
- [Source: apps/web/src/app/shared/detail-surface/detail-surface.ts:29-37] — contrat public complet
- [Source: apps/web/src/app/shared/detail-surface/detail-surface.html:1-19] — voile, `role="dialog"`, replis de titre/corps
- [Source: apps/web/src/app/features/characters/character-sheet/character-sheet.ts:228-258] — état, `openDetail()`/`closeDetail()`, retour de focus à extraire (Task 1)
- [Source: apps/web/src/app/features/characters/character-sheet/character-sheet.ts:85-89, :125-128] — `ClassData`/`TypeData` sans `description`, à compléter
- [Source: apps/web/src/app/features/characters/character-sheet/character-sheet.ts:98-107] — `ClassChoiceDisplay`, `talentEffectDescription` déjà résolu
- [Source: apps/web/src/app/features/characters/character-sheet/character-sheet.html:215-260] — Vocation, spécialité, options de classe, Voie
- [Source: apps/web/src/app/features/characters/character-wizard/character-wizard.ts:191-200] — patron de lecture d'un texte de catalogue (`content()?.['<type>']`)
- [Source: apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.html:10-82] — cartes, description, talents, spécialité, options
- [Source: apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.html:10-27] — cartes, description, avantages
- [Source: apps/web/src/app/core/characters/character.util.ts:9-17] — `findContentEntry<T>()`
- [Source: apps/api/src/game-systems/game-system.service.ts:53-109, :122, :203-220] — `CONTENT_TYPES`, cache non invalidé, `getContent()` scope `BASE` seul
- [Source: packages/shared/src/index.ts:1088-1094] — `ContentEntryDto` (`data: unknown`), `GameSystemContentDto`
- [Source: apps/web/src/app/core/theme/theme-tone.service.spec.ts:68-74] — patron de test de parité d'une clé de thème
- [Source: apps/web/src/app/features/characters/character-wizard/character-wizard.spec.ts:153, :276] — patron de test AC2 (contenu seedé vs `tones.ts`)

---

## Change Log

- 2026-08-29 — Revue de code (bmad-code-review, 4 couches parallèles : Blind Hunter, Edge Case
  Hunter, Verification Gap, Acceptance Auditor). 0 decision-needed, 4 patch, 2 defer, 9 rejetés
  comme bruit. **4 patches corrigés** : bouton d'aide imbriqué dans `<label for>` associé à un
  `<select>` (anti-pattern HTML, remplacé par `<span id>` + `aria-labelledby`, rendu inchangé) ;
  espaces parasites dans le nom d'arme (` Lance ( Lance ) ` → `Lance (Lance)`, confirmé
  empiriquement) ; 2 déclencheurs sur 6 affichant le libellé brut au lieu de `h.title` ; repli
  `'Détail'` dupliqué et codé en dur dans `detailContent()`, retiré (label vide traité comme
  absence d'aide). 2 tests de non-régression ajoutés. Suite complète 117 fichiers / 2283 tests
  verts (+2), lint 0 = baseline exactement. 2 items différés vers `deferred-work.md` (garde AC3 non
  appliquée aux déclencheurs FR-20 préexistants ; absence de sémantique ARIA de divulgation — tous
  deux hérités tels quels de la 31.2, non introduits par cette story). Un item de la 31.2 archivé
  comme résolu par cette story (retour de focus désormais dans le composant partagé).
- 2026-08-29 — Implémentation (bmad-dev-story). Pièce partagée `createDetailSurfaceHost()` créée
  (Option A tranchée par l'utilisateur), `CharacterSheet` migré dessus ; 6 termes rendus activables
  sur la fiche (classe primaire/secondaire, Type/Voie primaire/secondaire, option de classe,
  catégorie d'arme) et les termes de 2 étapes de l'assistant (talents de classe + option de classe,
  avantages de type). +25 tests, lint ramené à la baseline (0), aucune régression.
  ⚠️ **Task 6 (vérification visuelle réelle) NON RÉALISÉE** — aucune extension Chrome connectée,
  cf. Completion Note 6.
- 2026-08-28 — Story créée (bmad-create-story). Analyse exhaustive du catalogue seedé, du contrat
  `DetailSurface`, du registre de thèmes et de tous les emplacements de termes de règle
  (fiche + assistant). Trois points d'arbitrage 🔶 laissés ouverts et documentés (hôte partagé du
  retour de focus, périmètre Type/Voie + catégorie d'arme, description en ligne vs surface dans
  l'assistant). Un défaut préexistant repéré et signalé sans être corrigé (`weaponCategoryId`
  vs `weaponId`).

---

## Review Findings

- [x] [Review][Patch] Bouton d'aide imbriqué dans `<label [for]="choice.key">`, associé à un `<select>` — anti-pattern HTML documenté (comportement de renvoi de clic natif du label vers son contrôle imprévisible en présence d'un enfant interactif) ; aucune vérification réelle n'a couvert ce cas précis. **Corrigé** : `<label for>` remplacé par `<span id>` + `[attr.aria-labelledby]` sur le `<select>` dans la branche avec bouton d'aide, rendu visuel inchangé. Test de non-régression ajouté (`trigger.closest('label')` doit être `null`). [apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.html:75-91]
- [x] [Review][Patch] Rendu du nom d'arme avec espaces parasites — confirmé empiriquement (`" Lance ( Lance ) "` au lieu de `"Lance (Lance)"`) : le `@if/@else` imbriqué en plein milieu d'un texte inline casse la mise en forme, visible sur toute fiche avec une arme équipée. **Corrigé** : la parenthèse reste désormais à l'intérieur de chaque branche `@if`/`@else`, plus jamais scindée autour du bloc — reconfirmé empiriquement (plus d'espace collé aux parenthèses ; l'espace résiduel autour, dû à l'indentation du template, se referme par la fusion d'espaces du navigateur, même patron que les titres de classe/type secondaires). Test de non-régression ajouté. [apps/web/src/app/features/characters/character-sheet/character-sheet.html:420-437]
- [x] [Review][Patch] Deux déclencheurs sur six affichent le libellé source brut au lieu de `h.title` (catégorie d'arme, option de classe eligible-talent) — incohérent avec les 4 autres, sans conséquence aujourd'hui (libellés source jamais vides) mais fragile si `detailContent()` évolue. **Corrigé** : les deux déclencheurs utilisent désormais `h.title`, comme les 4 autres. [apps/web/src/app/features/characters/character-sheet/character-sheet.html:277,431]
- [x] [Review][Patch] Repli `'Détail'` dupliqué et codé en dur dans `detailContent()` — déjà géré par le repli natif de `DetailSurface` (`detail-surface.html:6,17`), redondant et introduit une micro-copie hors `tones.ts` que l'Encadré n°3 de cette même story demande d'éviter. **Corrigé** : `detailContent()` traite désormais un `label` vide comme une absence d'aide (au même titre qu'un `body` vide), plutôt que de lui substituer un repli générique — cohérent avec `h.title` servant aussi de texte visible au bouton depuis la correction du finding précédent (un repli silencieux y produirait un bouton sans nom accessible). Chemin de toute façon inatteignable en pratique (tous les libellés source sont garantis non vides par le schéma du catalogue) ; aucun test existant n'en dépendait. [apps/web/src/app/shared/detail-surface/detail-surface-host.ts:7-22]
- [x] [Review][Defer] Garde AC3 (pas de texte ⇒ pas de déclencheur) non appliquée aux déclencheurs FR-20 préexistants (talents/avantages/sorts) — comportement hérité de la 31.2, non touché par ce diff, hors périmètre de l'AC3 de la 31.3. [apps/web/src/app/features/characters/character-sheet/character-sheet.html:227,240,299] — deferred, pre-existing
- [x] [Review][Defer] Aucune sémantique ARIA de divulgation (`aria-haspopup`/`aria-expanded`) sur les déclencheurs de terme — pattern hérité tel quel de `.sheet__detail-trigger` (31.2), reproduit à l'identique sur les nouveaux emplacements, pas une régression introduite par cette story. [apps/web/src/app/shared/detail-surface/detail-surface.html] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-opus-5 (bmad-dev-story), 2026-08-29

### Debug Log References

- **Baseline mesurée avant toute modification** (Task 0), arbre propre, branche `fix/ci-env`,
  `HEAD = 1a0c7d2` : web **116 fichiers / 2256 tests** verts, **lint 0 (« All files pass
  linting »)**.
  🚨 **Deux écarts par rapport à ce que la story annonçait**, tous deux constatés à la mesure :
  1. Le `HEAD` de la story (`7d6fc2f`) **n'existe plus** — l'historique de `fix/ci-env` a été
     réécrit entre la création de la story et l'implémentation : `3210564` + `7d6fc2f` sont
     devenus le seul `1a0c7d2 ci: update packages (#10)`.
  2. **La baseline de lint n'est pas 145 mais 0.** Le commit `da81651 fix: code format, errors
     lint etc.` l'avait nettoyée entre-temps. La barre de sortie est donc plus stricte que ce que
     la story supposait — c'est la mesure fraîche qui a fait foi, comme la Task 0 l'exigeait.
- Livraison : **117 fichiers / 2281 tests** verts (+1 fichier, +25 tests), **lint 0 = baseline
  exactement** (9 erreurs prettier corrigées par `ng lint --fix`, aucune logique touchée), build de
  développement propre.
- `docker compose exec web pnpm test` · `pnpm exec ng lint --fix` · `pnpm lint` ·
  `pnpm ng build --configuration development`

### Completion Notes List

**1. Option A livrée telle que tranchée : `createDetailSurfaceHost()`**
(`apps/web/src/app/shared/detail-surface/detail-surface-host.ts`). Fonction appelée en contexte
d'injection, exposant `{ selected, openToken, open(title, body, event), close() }`. Elle porte les
trois pièces que chaque consommateur aurait dû réécrire : le contenu courant, le jeton d'ouverture,
et le retour du focus au déclencheur — y compris le repli `isConnected` quand ce déclencheur a
quitté le DOM. `DetailSurface` lui-même n'a **pas** été modifié : contrat
`[title] [body] [openToken] (closed)` inchangé, aucune ligne touchée dans ses quatre fichiers.

**2. `CharacterSheet` migré, à comportement constant.** Les ~30 lignes de plomberie ont été
supprimées (net −30 lignes) et remplacées par un champ `detail` ; les 5 déclencheurs existants
passent de `openDetail(...)` à `detail.open(...)`. **Les 110 tests préexistants de la fiche sont
passés sans aucune modification** — c'est le filet qui rendait la migration sûre, comme la story
l'avait anticipé. L'item `deferred-work.md:15` [P:MOYENNE] est de fait résolu : la 31.4 hérite du
mécanisme au lieu de le réécrire.

**3. Périmètre de la fiche livré tel que tranché (classe + option + Type/Voie + arme).** Six
emplacements : « Vocation — <classe> », « Classe secondaire : <classe> », « Voie — <type> »,
« Type secondaire : <type> », l'option de classe (branche `eligible-talent`) et la catégorie
d'arme. Trois points à connaître du relecteur :
- `ClassData` et `TypeData` **ne déclaraient pas `description`** côté fiche alors que le catalogue
  en porte une : le cast local l'effaçait silencieusement. Champ ajouté aux deux interfaces.
- La description de catégorie d'arme n'est **pas** dans `ResolvedWeapon` (qui ne porte que ce qui
  sert au calcul) et `WeaponCategoryEntry` (`packages/game-rules`) ne la déclare pas non plus.
  Plutôt que d'élargir un type d'un autre paquet, elle est relue du catalogue côté fiche par la clé
  déjà résolue (`weaponCategoryDescription`) — **la portée front-only de l'AC7 est tenue**.
- Conformément à la 31.2 (Completion Note 2), le texte de l'option de classe **quitte la ligne**
  quand il passe derrière le déclencheur ; le malus et la classe d'origine y restent (statistiques
  de référence rapide).

**4. Assistant livré tel que tranché (description en ligne, termes derrière).** `class-step` : les
talents deviennent des déclencheurs — effet mécanique et texte d'ambiance réunis dans la surface,
séparés par une ligne vide (`.detail-surface-body` porte déjà `white-space: pre-line`, rien à
ajouter côté composant partagé) — et l'option de classe obtient une aide **résolue depuis le talent
parent par `talentId`**, seul texte qui existe pour elle. Les descriptions de classe et de type
**restent en ligne** : elles servent à choisir. `type-step` : mêmes règles pour les avantages.

**4bis. Le risque « bouton d'aide dans une carte-radio » ne s'est pas matérialisé, par
construction.** La story signalait qu'un déclencheur imbriqué dans `<app-choice-card>` pourrait
voler le clic de sélection ou casser la navigation aux flèches d'`appRadioGroupNav`. Aucun
déclencheur n'a été posé **dans** le radiogroup : les termes activables vivent tous dans le bloc de
détail affiché **sous** les cartes. Un test dédié verrouille cette propriété (`class-step.spec.ts`,
« aucun déclencheur d'aide n'est posé DANS une carte-radio ») pour qu'un ajout futur ne la casse pas
en silence.

**5. `weapon-step` volontairement NON touché.** La story le donnait comme candidat conditionnel.
Sa description de catégorie d'arme est déjà affichée en ligne (`weapon-step.html:18`) et c'est
précisément la description de la chose que l'on est en train de choisir — donc couverte par
l'arbitrage « la description reste en ligne dans l'assistant ». La déplacer derrière un geste aurait
contredit cette décision. La catégorie d'arme **est** en revanche activable sur la fiche, où sa
description n'était affichée nulle part.

**6. ⚠️ Task 6 (vérification visuelle réelle) : FAITE PAR L'UTILISATEUR, PAS PAR L'AGENT.**
L'extension Chrome est restée injoignable côté agent pendant toute la session
(`list_connected_browsers` renvoie une liste vide, `tabs_context` échoue avec « Claude in Chrome is
not connected »), y compris après que l'utilisateur a proposé une session déjà authentifiée. Le
navigateur interne n'a **pas** été utilisé en remplacement — la story l'interdit explicitement, et
c'est le contournement qui aurait rendu le résultat non comparable à celui des stories 31.1/31.2.
L'utilisateur a déclaré la vérification faite (« c'est bon, c'est vérifié », 2026-08-29) ; **elle
est donc consignée comme une observation utilisateur, non reproduite ni observée par l'agent, et
le détail scénario par scénario n'est pas capturé dans ce fichier.**

🔎 **Point d'attention pour la revue de code.** Sur les deux stories précédentes, c'est
exactement cette vérification — et non les tests unitaires — qui a trouvé les défauts réels de ce
patron de composant flottant (31.2 : voile bloquant les clics en desktop, perte du focus après un
remplacement en place ; aucun des deux visible en jsdom). Les scénarios les plus à risque ici sont
le remplacement en place depuis un second terme, `Échap` après ce remplacement, et l'interaction
déclencheur/radiogroup dans l'assistant. Ils sont couverts par des tests unitaires dédiés, mais
ceux-ci n'ont jamais suffi sur ce patron précis.

🔧 **Point d'outillage à réparer, hors périmètre de cette story** : tant que l'extension Chrome
reste injoignable côté agent, aucune story front ne peut être vérifiée à l'écran par l'agent
lui-même.

**7. Deux tests préexistants mis à jour, aucun supprimé** (le piège annoncé, survenu deux fois) :
- `character-sheet.spec.ts` (classe et type secondaires) : le titre porte un espace de rendu
  supplémentaire depuis que le libellé vit dans son propre bloc `@if`. Le navigateur replie ces
  espaces, `textContent` non — assertions lues en espaces normalisés, l'intention est intacte.
- `class-step.spec.ts` (« affiche les talents immédiatement ») : quatre assertions portaient sur des
  textes de talents affichés **en ligne**, devenus faux dès qu'ils sont passés derrière un
  déclencheur. Réécrit pour cliquer chaque talent et vérifier le contenu de la surface — le test
  couvre désormais davantage qu'avant (il vérifie aussi le non-empilement).

**8. Portée tenue (AC7).** `git status` ne montre que des fichiers `apps/web/` (plus les deux
fichiers bmad de suivi). Aucun `apps/api/`, aucun `packages/shared/`, aucun `packages/game-rules/`,
aucun JSON de seed, aucune migration, aucune dépendance ajoutée.

**9. Pas de temps réel à câbler — vérifié.** Le catalogue de contenu est seedé au bootstrap et servi
depuis un cache mémoire qu'aucun endpoint ne modifie ; aucun `notifyChanged()` n'est pertinent.
Conforme à l'évaluation faite à la création de la story.

### File List

**Créés**

- `apps/web/src/app/shared/detail-surface/detail-surface-host.ts`
- `apps/web/src/app/shared/detail-surface/detail-surface-host.spec.ts`

**Modifiés**

- `apps/web/src/app/features/characters/character-sheet/character-sheet.ts`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.html`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.spec.ts`
