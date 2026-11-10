---
baseline_commit: 628bc4662cf1b58e2a47fc001d218f52e1b107e7
---

# Story 31.4: Refonte du parcours de création de personnage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a joueur qui crée son personnage,
I want un parcours plus lisible et moins bavard en gestes,
so that la création cesse d'être une épreuve avant la première partie.

---

**Quatrième story de l'épic 31** (Palier 9 — Fiche de personnage). Porte **FR-21** seule
(`prd.md:211-212`), sans AD dédiée (`ARCHITECTURE-SPINE.md:470` : « travail d'UI, gouverné par les
conventions »).

## 🎨 Cette story a désormais un contrat UI

À sa création, aucune planche n'existait pour ce wizard. **Une passe UX (`bmad-ux`) a été menée le
2026-09-20 avec l'utilisateur** ; elle est finalisée et **fait contrat** :

| Document | Rôle |
| --- | --- |
| [`ux-jdr-master-2026-08-31/DESIGN.md`](../planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md) | comment ça se voit — §7.1 ChoiceCard, §7.2 DetailSurface, §7.3 AttributePool, §7.4 EquipmentCatalog + BudgetGauge |
| [`ux-jdr-master-2026-08-31/EXPERIENCE.md`](../planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/EXPERIENCE.md) | comment ça marche — patterns, états, accessibilité, flux |
| [`mockups/contrat-ui-wizard-creation.html`](../planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/mockups/contrat-ui-wizard-creation.html) | **planche contractuelle** : tout ce qui y est dessiné est implémenté, rien n'y figure pour embellir |
| [`mockups/wizard-pistes-de-solutions.html`](../planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/mockups/wizard-pistes-de-solutions.html) | exploration, variantes écartées — **ne fait pas contrat** |

> **⚠️ Règle de travail posée par l'utilisateur** : toute décision d'implémentation qui
> **modifierait** la planche doit le signaler par une icône ⚠️ placée juste avant la partie
> concernée, en disant ce qui change et pourquoi. En cas de conflit entre une planche de
> `.working/`/`mockups/` et les deux spines, **les spines gagnent**.

### Décisions de l'utilisateur (2026-09-20)

**A1** sous-titre descriptif sur les cartes · **B1** tableau mécanique + récit, **récit replié sur
mobile** · **C1** puces d'attributs fusionnées avec compteur (**C3 glisser-déposer mis sous le
coude, hors périmètre**) · **D1 + D2** équipement regroupé + recherche · **surface de détail
desktop = fenêtre centrée, pour toute l'application, feuille du bas conservée sur mobile**.

### ⚠️ Cette story amende du code déjà livré et revu

- **La surface de détail desktop devient modale** (voile, `aria-modal`, piège de focus). Elle était
  un panneau latéral **non modal** — décision de la revue de code de la 31.2, et défaut réel trouvé
  à l'écran (voile bloquant les clics, AC4 de la 31.2). C'est une **inversion assumée par
  l'utilisateur**, pas une régression : les tests de la 31.2/31.3 qui assertent le comportement non
  modal ou le « remplacement en place » sur desktop sont à **réécrire**, pas à contourner.
- **La description de classe/type quitte l'affichage en ligne** de l'assistant (arbitrage de la
  31.3 : « elle sert à choisir ») — elle est remplacée par le sous-titre de carte, le texte complet
  passe par la surface de détail.

---

## Acceptance Criteria

### Les trois AC d'`epics.md:1394-1406`, verbatim

**AC1 — lisible sur téléphone, sans défilement horizontal**
**Given** l'assistant de création
**When** je le parcours de bout en bout
**Then** chaque étape est lisible sur téléphone sans défilement horizontal

**AC2 — les textes explicatifs déjà seedés sont accessibles par la surface de détail**
**Given** une étape offrant des choix
**When** elle s'affiche
**Then** les textes explicatifs déjà seedés y sont accessibles par la surface de détail

**AC3 — équivalence stricte des données produites**
**Given** le personnage créé par le parcours refondu
**When** il est enregistré
**Then** il est en tout point équivalent à celui que produisait l'ancien parcours

### AC de cadrage

**AC4 — portée close : front uniquement**
**Given** la fin de l'implémentation
**When** `git status` est lu
**Then** aucun fichier de `apps/api/`, aucun de `packages/shared/`, aucune migration, aucun JSON de
seed, aucune dépendance ajoutée

**AC5 — une seule surface flottante, celle qui existe**
**Given** un texte long à afficher
**When** il est ouvert
**Then** il passe par `DetailSurface`/`createDetailSurfaceHost()` (`apps/web/src/app/shared/detail-surface/`),
étendus si besoin — jamais un second panneau, tooltip ou modale

**AC6 — nombre, clés et ordre des étapes inchangés**
**Given** les 9 clés de `SUPPORTED_STEP_KEYS` (`character-wizard.ts:38-48`), `magic` restant
conditionnelle à `typeId === 'magie'`
**When** le parcours refondu est livré
**Then** clés, ordre et visibilité conditionnelle sont identiques, et
`apps/api/src/game-systems/game-system.service.ts` (source de `creationSteps`) n'est pas modifié

### AC issus du contrat UI

**AC7 — ChoiceCard : un sous-titre descriptif (A1, DESIGN §7.1)**
**Given** une carte de choix dont le catalogue porte un texte source
**When** elle s'affiche
**Then** elle montre le nom **et** un sous-titre de **2 lignes maximum** coupé par une ellipse
**And** les sources sont : classe et type → première phrase de la description ; catégorie d'arme →
formules « Toucher … · Dégâts … » ; profil d'attributs → valeurs par ordre décroissant
(« 8 · 6 · 6 · 4 ») ; saison de magie → **aucun**
**And** une carte sans texte source reste compacte : jamais de sous-titre vide ni de texte de remplacement
**And** le sous-titre est relié à la carte par `aria-describedby`, sans dupliquer l'`aria-label` actuel

**AC8 — ⚠️ ANNULÉ le 2026-09-20 (revue de code) : le bouton « Voir le détail de… » ne sert à rien, le détail est affiché DIRECTEMENT — voir AC14.** *Texte initial conservé pour mémoire :*
**Given** l'étape Classe ou Type avec une carte sélectionnée
**When** j'active le déclencheur « Voir le détail de <nom> » placé sous la grille
**Then** la surface de détail s'ouvre sur la description complète
**And** cette description n'est **plus** imprimée en bloc sous la grille
**And** le déclencheur est un vrai `<button type="button">` placé **hors** de la carte-radio (aucun bouton imbriqué dans le radiogroup)
**And** `[ASSUMPTION]` forme et emplacement exacts du déclencheur validés par l'utilisateur au plus tard à la vérification visuelle

**AC9 — corps structuré de la surface de détail (B1, DESIGN §7.2)**
**Given** un terme portant des données structurées (talent : attributs, difficulté, effet,
conditions ; objet d'équipement : effet)
**When** la surface s'ouvre
**Then** le corps suit **titre → tableau mécanique → récit d'ambiance**, le tableau en deux
colonnes libellé/valeur, ses lignes **présentes seulement si la donnée existe**
**And** un terme sans donnée structurée garde un corps de texte simple
**And** sur **mobile (< 1024 px)** le récit est **replié par défaut** derrière une divulgation
« Lire le récit » / « Masquer le récit » (bouton natif, `aria-expanded`, cible ≥ 44 px), **replié à
chaque ouverture**
**And** sur **desktop (≥ 1024 px)** le récit est déployé, sans divulgation

**AC10 — ⚠️ fenêtre centrée modale sur desktop, dans toute l'application (DESIGN §7.2)**
**Given** la surface de détail ouverte à ≥ 1024 px, depuis l'assistant **ou** la fiche
**When** elle s'affiche
**Then** c'est une fenêtre centrée (largeur ≤ 560 px, hauteur ≤ 80 % de la fenêtre, défilement
interne), avec un voile visible sur toute la page
**And** elle est **modale** : `aria-modal="true"`, piège de focus actif, `Échap` et clic sur le
voile ferment, le focus revient au déclencheur
**And** sur mobile la feuille du bas est conservée (présentation inchangée hors AC9)
**And** un seul terme est ouvert à la fois : il n'y a plus de « remplacement en place »

**AC11 — AttributePool : plus de puces jumelles (C1, DESIGN §7.3)**
**Given** l'étape Attributs avec un profil choisi dont une valeur figure plusieurs fois (ex. [8, 4, 6, 6])
**When** je place des valeurs
**Then** chaque rangée d'attribut montre **une puce par valeur distincte**, triées par ordre décroissant
**And** un badge « ×N » indique les exemplaires **encore à placer**, affiché uniquement pour une valeur multiple
**And** une valeur épuisée est grisée et non activable dans les **autres** rangées, jamais dans sa propre rangée (la réactiver la retire)
**And** changer de profil efface l'assignation ; « Suivant » n'est actif qu'avec les 4 attributs placés
**And** les valeurs émises (`attributesChange`) sont **identiques** à celles de l'ancien parcours pour les mêmes choix
**And** le compteur est lu aux lecteurs d'écran (« 6, encore 2 à placer »)

**AC12 — EquipmentCatalog et BudgetGauge (D1 + D2, DESIGN §7.4)**
**Given** l'étape Équipement
**When** j'affiche le mode « Achat libre »
**Then** les objets sont regroupés par `nature` sous des titres **Objets · Contenants · Animaux**, lignes ≥ 44 px
**And** le nom d'un objet porteur d'un `effect` non vide est un déclencheur de la surface de détail (soulignement pointillé) ; un objet sans `effect` reste un simple nom — **dans les deux modes** (pré-fait et achat libre)
**And** un champ de recherche (44 px, « Rechercher un objet… ») filtre sur le libellé, insensible à la casse et aux accents, à la frappe ; les groupes vides disparaissent ; sans résultat, le message de l'EXPERIENCE §3 s'affiche
**And** le budget est une jauge de 8 px **avec** le texte « Budget · N / 1000 Po » toujours visible ; au-delà du plafond elle passe en `status-unavailable` **et** ajoute « — dépassement de N Po »
**And** changer de mode réinitialise la sélection **et** vide la recherche ; le panier et le blocage de « Suivant » au-delà du budget sont inchangés

**AC13 — plancher d'accessibilité et de lisibilité**
**Given** les zones refondues
**When** elles sont vérifiées
**Then** toute puce, ligne de catalogue, bascule de mode et divulgation mesure ≥ 44 × 44 px
**And** le contraste du sous-titre de carte (12 px, `text-muted`) est **mesuré dans les trois thèmes** ; s'il passe sous 4,5:1 dans un thème, **c'est la palette de ce thème qu'on corrige**, pas la taille du texte
**And** aucune information n'est portée par la couleur seule (jauge, puce épuisée, compteur)

### AC ajoutés le 2026-09-20 (retours d'usage pendant la vérification et la revue)

**AC14 — ⚠️ la carte choisie se déploie en place (classe, type) — piste B**
**Given** l'étape Classe ou Type
**When** je sélectionne une carte
**Then** elle prend toute la largeur de la grille et forme avec son détail **une seule carte à deux parties** : en-tête (le bouton radio, « Toucher pour désélectionner ») et détail (groupe **voisin**, jamais un enfant du radio)
**And** le détail porte la description, les talents (classe) ou avantages (type) en **pastilles tactiles ⓘ** qui ouvrent la surface de détail
**And** aucune zone de détail séparée n'existe plus sous la grille

**AC15 — re-toucher la carte déployée la désélectionne**
**Given** une classe (ou un type) sélectionné
**When** je touche de nouveau sa carte
**Then** elle se referme et redevient une carte ordinaire ; `classIdChange`/`typeIdChange` émettent `undefined`
**And** « Suivant » se re-bloque ; spécialité, choix obligatoires et choix de magie liés sont effacés

**AC16 — un choix obligatoire est toujours visible**
**Given** une classe avec un choix obligatoire (Métier d'appoint, type de paysage, type de créature, climat, **spécialité de l'Artisan**)
**When** sa carte est déployée
**Then** ce choix est affiché d'emblée dans un cadre ambré portant la mention « Obligatoire » — **jamais replié**
**And** « Occupations et actions » est une divulgation **repliée à chaque nouvelle sélection**, déployée en petites étiquettes (non interactives)

**AC17 — le panneau « Voyageur » évolue (desktop)**
**Given** l'assistant à ≥ 1024 px
**When** je progresse
**Then** la colonne de droite affiche le bloc « Voyageur » dont le titre suit le nom saisi, les pastilles PV/PE/… **passent à la ligne** (rien ne déborde de la colonne), puis des lignes qui **apparaissent au fil des étapes** (classe, spécialité, type, saison, sorts, arme, fétiche, informations narratives) et les quatre valeurs d'attributs
**And** une donnée non renseignée n'affiche aucune ligne
**And** l'équipement choisi figure dans un bloc **« Panier » séparé, sous** « Voyageur », avec « Retirer » (supprime la ligne) et le total ; le bloc n'existe que s'il contient quelque chose

**AC18 — sur téléphone : bouton « Récap » et feuille**
**Given** l'assistant à < 1024 px
**When** je regarde le bandeau d'étape
**Then** il est collant et porte un bouton « Récap » (avec la pastille du nombre d'exemplaires d'équipement) à la place de la flèche « suivant »
**And** ce bouton ouvre le même récapitulatif dans la surface de détail ; `Fermer` ramène le focus au bouton
**And** l'ancien bloc du bas de page n'est plus rendu

**AC19 — équipement : repli, compteur, filtre**
**Given** l'étape Équipement, « Achat libre »
**When** j'utilise le catalogue
**Then** chaque groupe se **replie / se déplie** (titre-bouton de 44 px, nombre d'objets, `aria-expanded`), déployé par défaut ; une recherche ou « Ma sélection » déplie tout
**And** « Ajouter » devient un compteur **− ×n +** dès qu'un objet est pris (« − » à ×1 le retire), ligne repérée par un liseré
**And** un filtre « Tout » / « Ma sélection · n » permet de relire ce qu'on a pris
**And** le Panier de fin d'étape n'existe plus (il vit dans la colonne de droite / la feuille « Récap »)

**AC20 — descriptions d'arme et de sorts derrière la surface (revue de code)**
**Given** l'étape Arme ou Magie
**When** j'affiche une catégorie d'arme sélectionnée ou la liste des sorts rituels
**Then** la description n'est plus en ligne : une pastille ⓘ (catégorie) ou un bouton ⓘ voisin de la ligne (sort, jamais dans le `<label>`) l'ouvre dans la surface de détail
**And** le coût en PE reste sur la ligne du sort

---

## Tasks / Subtasks

- [x] **Task 0 — Mesurer la baseline AVANT toute modification**
  - [x] Arbre propre, `HEAD = 628bc46` = `baseline_commit`.
  - [x] Mesure fraîche (2026-08-31) : **117 fichiers / 2283 tests verts, lint 0** — identique aux repères de la 31.3. **À remesurer au démarrage de l'implémentation** (plusieurs semaines ont passé : `git log` d'abord).

- [x] **Task 1 — Trancher le périmètre** *(résolue)*
  - [x] Aucune option A/B/C de la version initiale n'a été retenue : l'utilisateur a demandé une vraie passe UX, menée avec `bmad-ux` (voir « Contrat UI » ci-dessus). Le périmètre est celui des AC7 à AC13. L'ancienne Option B (restructurer les étapes) est **écartée** (AC6).

- [x] **Task 2 — `DetailSurface` : fenêtre centrée modale + corps structuré** (AC5, AC9, AC10)
  - [x] **Présentation** (`detail-surface.scss`, `.html`, `.ts`) : desktop = fenêtre centrée (560 px max, 80 % de haut max, défilement interne, `elevation.modal`, `radius.card`) ; voile **affiché** aussi au-delà de 1024 px (`display: none` supprimé) ; mobile inchangé.
  - [x] **Accessibilité** : `aria-modal="true"` et `[cdkTrapFocus]` **inconditionnels** — supprimer `isDesktop` **s'il ne sert plus** (il pilotait uniquement ces deux liaisons ; vérifier avant de retirer `BreakpointObserver`). Reprendre le focus initial sur le bouton Fermer (`focusOnContentChange` existant).
  - [x] **Corps structuré** : étendre le contrat sans casser l'existant — entrées **optionnelles** `rows: { label; value }[]` et `narrative: string` en plus de `body`. `DetailSurfaceContent`, `detailContent()` et `createDetailSurfaceHost().open()` suivent. Un consommateur qui ne passe que `body` garde le rendu texte simple (repli `'Aucune description disponible.'` inchangé).
  - [x] **Divulgation du récit** : un `<button type="button">` natif avec `aria-expanded`, libellé « Lire le récit » / « Masquer le récit », `min-height: 44px`, **uniquement sous 1024 px** ; état **replié à chaque ouverture** (réinitialisé par `openToken`). À ≥ 1024 px, récit déployé, aucun bouton.
  - [x] **Libellés du tableau** (« Attributs », « Difficulté », « Effet », « Conditions ») et des divulgations : micro-copie d'interface, **pas** de texte de règle → dans `tones.ts`, **dans les trois blocs**, avec un test de parité (`theme-tone.service.spec.ts:68-74`). ⚠️ Piège connu : une clé oubliée dans un thème compile et rend `undefined`.
  - [x] **Helper de talent partagé** : les données d'un talent (`attributes`, `difficulty`, `effect.description`, `effect.conditions`, `description`) existent déjà dans `class-step` et sur la fiche. Écrire **une seule** fonction `talentDetail(talent)` (dans `shared/detail-surface/`) qui produit `{title, rows, narrative}` — la fiche (`character-sheet.ts`) et `class-step` l'appellent. Ne pas dupliquer `talentText()`.
  - [x] Avantages de type et sorts rituels (fiche) : **restent en `body` simple** (données non structurées). Ne pas inventer de lignes.
  - [x] ⚠️ **Tests à réécrire, pas à supprimer** : `detail-surface.spec.ts` (non-modalité desktop), `detail-surface-host.spec.ts`, et dans `character-sheet.spec.ts` / `class-step.spec.ts` / `type-step.spec.ts` tout test qui assertait le remplacement en place ou la présence en ligne du texte du talent.

- [x] **Task 3 — ChoiceCard : sous-titre + déclencheur de détail** (AC7, AC8)
  - [x] `choice-card.{ts,html,scss}` : rendre `option().detail` **visiblement** (2 lignes, `-webkit-line-clamp: 2`, `text-sm`, `text-muted`), relié par `aria-describedby`. **Constat clé de l'analyse** : `ChoiceCardOption.detail` existe déjà et est renseigné par chaque étape (`class-step.ts:113` liste de talents, `type-step.ts:49` avantages, `attributes-step.ts:43` valeurs, `weapon-step.ts:71` formules) mais n'est utilisé **que dans l'`aria-label`** (`choice-card.html:7`) — jamais affiché.
  - [x] Changer **les sources** des étapes classe et type : `detail` = **première phrase de `description`** (aujourd'hui liste de noms de talents/avantages). Écrire l'extraction de « première phrase » **une fois**, testée (attention aux abréviations : « etc. » ne termine pas la phrase — le clamp à 2 lignes borne de toute façon le résultat). Profil d'attributs : valeurs **triées par ordre décroissant**. Arme : inchangé. Saison de magie : `detail` **absent** (le catalogue est `{key,label}`).
  - [x] **Règle « pas de texte ⇒ pas de ligne »** : `detail` vide/absent → aucun élément rendu (`toBeNull()` en test).
  - [x] **`aria-label`** : ne plus concaténer nom + détail (le sous-titre visible + `aria-describedby` suffisent). Vérifier que la navigation aux flèches (`appRadioGroupNav`) et le comportement radio sont **inchangés**.
  - [x] **Déclencheur « Voir le détail de <nom> »** sous la grille (`class-step.html`, `type-step.html`) remplaçant `<p class="…__description">{{ data.description }}</p>` : `<button type="button">` **hors** du radiogroup, via `createDetailSurfaceHost()`. Texte du déclencheur = micro-copie → `tones.ts` (trois blocs + parité). Rendu seulement si la description est non vide.
  - [x] `class-step` : les **talents** utilisent `talentDetail()` (Task 2). L'option de classe (`choiceHelp`) aussi, via le talent parent (`talentId`) — logique de résolution **inchangée**.
  - [x] **Ne pas toucher** : `weapon-step` (sa description de catégorie reste en ligne, `weapon-step.html:18`), `magic-step` (descriptions de sorts en ligne), `fetish-step`, `narrative-step`, `portrait-cropper` (partagé avec la fiche).

- [x] **Task 4 — AttributePool** (AC11)
  - [x] **Modèle actuel** (`attributes-step.ts`) : `assignment: attr → index` dans `values()` ; `isChipUsedElsewhere` compare des **index** — d'où le défaut : avec [8,4,6,6], placer le premier 6 grise « le premier 6 » dans les autres rangées mais pas le second, deux puces identiques à l'écran.
  - [x] **Nouveau rendu** : par rangée, itérer les **valeurs distinctes** (décroissant). Garder `assignment` par index en interne : placer une valeur = prendre **le plus petit index libre** portant cette valeur. `isChipSelected(attr, value)` = `values()[assignment()[attr]] === value`. `remaining(value)` = occurrences de `value` − index assignés portant cette valeur. Puce épuisée dans une autre rangée ⇔ `remaining === 0` **et** non sélectionnée dans cette rangée.
  - [x] Badge « ×N » = `remaining(value)`, **affiché seulement si** la valeur apparaît plusieurs fois dans le profil. Nom accessible : « 6, encore 2 à placer ».
  - [x] **`emitIfComplete()` et la resynchronisation depuis `attributes()`** (`:71-115`, garde `hasSyncedFromInput`) : **ne pas les réécrire** — l'invariant est que le résultat émis soit identique. Un test doit comparer les valeurs émises avant/après pour les 3 profils et chaque permutation utile.
  - [x] Cibles ≥ 44 × 44 px. **C3 (glisser-déposer) : hors périmètre** — ne pas l'ébaucher.

- [x] **Task 5 — Étape Équipement** (AC12, AC6 de la version initiale : trou `effect`)
  - [x] **État actuel** : liste plate `<ul>` de 68 objets (54 individuels, 9 contenants, 5 animaux), **aucune** recherche ; `EquipmentItemEntry.effect?` est lu (`equipment-step.ts:10,42-47`) mais **jamais rendu** — 68 objets sur 68 portent un `effect`. Aucune sous-catégorie plus fine que `nature` n'existe dans les données (`equipment-items.json` : clés `key,label,priceGold,nature,weight,effect`) : **ne pas en inventer**.
  - [x] Regrouper par `nature` (`individual` → « Objets », `contenant` → « Contenants », `animal` → « Animaux »). Titres = micro-copie → `tones.ts` (trois blocs + parité).
  - [x] Déclencheur de détail sur le nom (via `createDetailSurfaceHost()`, `rows: [{Effet, …}]` ou `body` simple), **dans les deux modes**, seulement si `effect?.trim()`.
  - [x] Recherche : signal de filtre, normalisation `normalize('NFD')` + suppression des diacritiques + `toLowerCase()`. Message sans résultat : voir EXPERIENCE §3 (**`[ASSUMPTION]`** formulation à valider).
  - [x] Jauge de budget : réutiliser `totalSpent()`/`overBudget()`/`STARTING_BUDGET_GOLD` **existants** ; ne pas recalculer.
  - [x] Ne pas modifier `selectionChange`, `kitSelection()`, ni le calcul de budget du wizard (`character-wizard.ts:237-245`, plafond 1000).

- [x] **Task 6 — AC1 : aucun défilement horizontal** (AC1)
  - [x] Analyse statique à la création : aucun offenseur évident (grilles `auto-fill minmax(140px,1fr)`, pas de `<table>` dans les étapes, largeur fixe maximale 220 px dans `portrait-cropper`). **Ne remplace pas la vérification à l'écran.**
  - [x] ⚠️ Vérifié à **500 px** (largeur minimale de la fenêtre Chrome pilotée, `innerWidth = 500` ; 360 px inatteignable), pas 360 : `scrollWidth 485 ≤ innerWidth 500` sur Classe, Type, Attributs (chips + badges), Arme, Équipement (catalogue de 68 objets) et sur la feuille de détail. Étapes Fétiche/Narratif/Portrait/Magie non parcourues à l'écran. **360 px reste à confirmer sur un vrai téléphone.**

- [x] **Task 7 — Tests** (AC1 à AC13)
  - [x] Un test par AC, **nommé avec son numéro** (convention du projet).
  - [x] AC3 : **aucun nouveau test de parcours complet** — l'orchestrateur n'est pas modifié (`git diff` vide sur `character-wizard.ts/html/scss`) et ses tests préexistants (`character-wizard.spec.ts` : soumission, 400/409/500, `canGoNext`) passent sans modification ; l'équivalence des valeurs d'attributs, seul point de logique touché, est prouvée par le test « chaque profil × chaque permutation ».
  - [x] AC6 : couvert par le test préexistant `character-wizard.spec.ts:318` (étapes dérivées de `creationSteps()`), inchangé et vert ; aucun test neuf.
  - [x] AC7 : absence du sous-titre pour une carte sans texte (`toBeNull()`) ; le radiogroup navigue toujours aux flèches.
  - [x] AC9/AC10 : présence du tableau/lignes conditionnelles ; divulgation seulement < 1024 px (mocker `BreakpointObserver`, **desktop par défaut** — jsdom répond `matches:false` à toute media query, piège de la 36.11) ; replié à chaque ouverture ; `aria-modal`/piège de focus/`Échap`/voile.
  - [x] AC11 : pool sur [8,4,6,6], [6,6,6,6], [4,4,8,8] — compteurs, épuisement, retrait, changement de profil, valeurs émises identiques.
  - [x] AC12 : regroupement, déclencheurs (deux modes), filtre (casse/accents/vide), jauge et dépassement.
  - [x] AC2/parité : les textes affichés viennent des fixtures de contenu, jamais de `tones.ts` (patron `character-wizard.spec.ts:153,276`).
  - [x] Zoneless : boucle de ticks établie ; `whenStable()` seul ne suffit pas.

- [x] **Task 8 — Mesure du contraste** (AC13)
  - [x] Mesurer le ratio du sous-titre (`text-muted` sur la surface de carte) dans les **trois thèmes**. Documenter les valeurs dans les Completion Notes. Sous 4,5:1 dans un thème → corriger la palette de ce thème (`tones`/thème), pas la taille.

- [x] **Task 9 — Vérification visuelle réelle** (non négociable) — **complète** (g compris, voir note 10)
  - [x] Via **Chrome MCP `claude-in-chrome`** sur la session de test déjà connectée — jamais le navigateur interne. Si l'extension est injoignable (comme en 31.3), **le dire** dans les Completion Notes ; ne pas déclarer la vérification faite sans l'avoir réalisée.
  - [x] Scénarios (tous réalisés, **(g)** compris — création réelle autorisée par l'utilisateur le 2026-09-20) : (a) 9 étapes à ~360 px, aucun défilement horizontal ; (b) classe : cartes à sous-titre, « Voir le détail », talent → tableau + récit replié ; (c) **desktop** : fenêtre centrée, voile, `Échap`, clic voile, retour du focus, **fiche incluse** (talent sur la fiche) ; (d) attributs [8,4,6,6] : placer/retirer les deux 6 ; (e) équipement : recherche, objet avec effet, jauge jusqu'au dépassement ; (f) les **trois thèmes** ; (g) création de bout en bout, personnage identique (AC3).
  - [x] **Regarder aussi** le shell du wizard (en-tête d'étape, progression, panneau résumé) : la planche ne le redessine **pas** (EXPERIENCE §11) ; consigner tout défaut de fond pour `bmad-ux`, sans le corriger ici.

- [x] **Task 10 — Non-régression et portée**
  - [x] `docker compose exec web pnpm test` (2328/2330 — les 2 échecs sont `calendar-view.spec.ts`, fixture `'2026-09-01'` périmée, sans rapport) · `pnpm lint` (0 = baseline) · `pnpm ng build --configuration development` (propre).
  - [x] `git status` : seuls des fichiers `apps/web/` (AC4). **⛔ aucun `pnpm add`.**

- [x] **Task 11 — Carte déployée, piste B (classe, type) — AC14, AC15, AC16** *(retours du 2026-09-20)*
  - [x] `ChoiceCard` : entrées `expanded` / `expandedHint` ; `ChoiceDetail` (conteneur voisin du radio, styles partagés `choice-detail__*`) ; class-step et type-step réécrits ; re-toucher désélectionne (`onSelect` émet `undefined`, sorties `string | undefined`).
  - [x] Choix obligatoires (spécialité, `requiredChoices`) hors de la zone repliable ; « Occupations et actions » replié par défaut, dérivé de la classe (pas d'`effect`).
  - [x] Retrait du bouton « Voir le détail de… » (clé de thème, styles, tests).
- [x] **Task 12 — Récapitulatif du voyageur — AC17, AC18** : composant `WizardSummary` (deux hôtes : colonne de droite et feuille « Récap »), `DetailSurface` étendue d'un contenu projeté (`custom` + `<ng-content>`), bandeau d'étape collant + bouton « Récap » + pastille, correction du débordement de la colonne de droite (`border-box`).
- [x] **Task 13 — Équipement : repli, compteur, filtre — AC19** : groupes repliables, compteur − ×n +, filtre « Ma sélection », Panier retiré de l'étape ; nature inconnue → « Objets ».
- [x] **Task 14 — Descriptions d'arme et de sorts derrière la surface — AC20** (décision de revue).
- [x] **Task 15 — Vérification à l'écran de ce lot** : desktop (carte déployée, choix obligatoire, colonne Voyageur + Panier), téléphone 500 px (Récap, compteur, filtre, repli).

---

## Dev Notes

### Encadré n°1 — Ce qui NE DOIT PAS bouger (AC3, AC6)

`character-wizard.ts` : 9 clés (`SUPPORTED_STEP_KEYS:38-48`), `magic` conditionnelle
(`CONDITIONAL_STEP_VISIBILITY:56-58`), navigation par **clé** (`currentStepKeyTracked`),
`canGoNext()` (`:259-291`), `FIELD_TO_STEP_KEY` (`:75-94`), `sheetData`/`updateSheetData()`/handlers
`on*Change()`, `onSubmit()`. Toucher l'un d'eux sans raison directement liée à un AC est un signal
d'alerte : cette story change la **présentation**, jamais le **contrat**.

### Encadré n°2 — Le composant partagé `DetailSurface`, état exact avant modification

`apps/web/src/app/shared/detail-surface/` : `detail-surface.{ts,html,scss,spec.ts}`,
`detail-surface-host.{ts,spec.ts}`.
- Entrées : `title` (requis), `body` (requis), `openToken` (défaut 0) ; sortie `closed`.
- Aujourd'hui : `aria-modal` et `cdkTrapFocus` **désactivés à ≥ 1024 px** via `isDesktop`
  (`BreakpointObserver`, `detail-surface.ts:42-52`) ; voile `display:none` à ≥ 1024 px
  (`detail-surface.scss`) ; panneau desktop `position: fixed; top: 64px; right: 0; width: 320px`.
- `focusOnContentChange` (effect sur `openToken`) : focus sur le bouton Fermer à chaque ouverture.
- `createDetailSurfaceHost()` porte contenu courant, jeton, retour du focus (repli `isConnected`).
- Le seuil `1024px` est en dur à plusieurs endroits — dette connue (`deferred-work.md:17`),
  **ne pas centraliser ici**.
- Le composant utilise `--mat-sys-*` (pas les tokens `--surface-bg`… du DESIGN) : rester cohérent
  avec le reste du composant, ne pas mélanger deux systèmes de variables.

### Encadré n°3 — Données réelles (catalogue Ryuutama seedé)

- **Talent** : `id`, `name`, `effect: { description, conditions }`, `attributes: string[]`,
  `difficulty`, `description` (récit). Ex. *Création* : VIG · AGI, difficulté « variable ».
- **Classe / type** : `description` (prose), 12 classes (`artisan, chasseur, fermier, guerisseur,
  marchand, menestrel, noble, dresseur, ermite, meteomancien, navigateur, professeur`).
- **Profils d'attributs** (`attribute-patterns.json`) : `equilibre [6,6,6,6]`, `polyvalent [8,4,6,6]`,
  `specialiste [4,4,8,8]` — **aucun texte** (`{key,label,values}`).
- **Équipement** : 68 objets, `nature` ∈ `individual` (54) · `contenant` (9) · `animal` (5), tous
  avec `effect`. Prix et budget en Po, plafond 1000.
- ⛔ **Ne pas enrichir les JSON de seed** (`apps/api/game-systems/ryuutama/data/` est gitignoré,
  droits d'auteur ; `contentCache` jamais invalidé sans redémarrage).
- Le terminal Windows affiche les accents de ces JSON en `�` : c'est l'affichage, pas la donnée.

### Encadré n°4 — Micro-copie : `tones.ts` vs catalogue

Les textes de règle viennent **toujours** du catalogue (AD-13/P8-AD-9, 23.3). Seule la micro-copie
d'interface est ajoutée à `tones.ts` (`apps/web/src/app/core/theme/tones.ts`, 3 blocs répliqués,
lue via `theme.tone()['<clé>']`) : libellés du tableau, divulgation, « Voir le détail », titres de
groupes, placeholder de recherche, message sans résultat, libellé de budget. `TONE_MAP` garantit les
trois thèmes, **pas** la présence d'une clé dans chacun : test de parité obligatoire.

### Encadré n°5 — Points ouverts à confirmer avec l'utilisateur

- `[ASSUMPTION]` forme/emplacement du déclencheur « Voir le détail de <nom> » (AC8).
- `[ASSUMPTION]` message de recherche sans résultat (« Aucun objet ne répond à cet appel… », AC12).
- Le sentiment de « première version » du **shell** (en-tête d'étape, progression, panneau résumé) et
  des étapes non refondues n'est **pas** couvert par la planche (EXPERIENCE §11).

### Pas de temps réel à câbler

Le catalogue est statique (seedé au bootstrap, cache jamais invalidé). Rien à propager via
`changed`/`notifyChanged()`.

### Ce qui est HORS périmètre

- `apps/api/`, `packages/shared/`, JSON de seed, migration, dépendance (AC4).
- **C3 glisser-déposer**, sélecteurs déroulants d'attributs (C2), restructuration des étapes.
- `weapon-step`, `magic-step` (descriptions de sorts en ligne), `fetish-step`, `narrative-step`,
  `portrait-cropper`, level-up wizard, fiche Homme Dragon.
- Centraliser le seuil 1024 px / les `z-index`.
- Le weaponCategoryId/`weaponId` de `wizardStepIntro` (défaut préexistant signalé en 31.3) : à
  remonter, pas à corriger ici.

### Project Structure Notes

Fichiers attendus en modification :

```
apps/web/src/app/shared/detail-surface/detail-surface.{ts,html,scss,spec.ts}
apps/web/src/app/shared/detail-surface/detail-surface-host.{ts,spec.ts}
apps/web/src/app/shared/detail-surface/   (+ talent-detail.ts helper partagé, à créer)
apps/web/src/app/features/characters/character-sheet/character-sheet.{ts,html,spec.ts}   (talents → talentDetail ; tests non-modal à réécrire)
apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.{ts,html,scss,spec.ts}
apps/web/src/app/features/characters/character-wizard/steps/class-step/*
apps/web/src/app/features/characters/character-wizard/steps/type-step/*
apps/web/src/app/features/characters/character-wizard/steps/attributes-step/*
apps/web/src/app/features/characters/character-wizard/steps/equipment-step/*
apps/web/src/app/core/theme/tones.ts  +  theme-tone.service.spec.ts
```

Conventions : composants **standalone**, `@if`/`@for` et signals (jamais `*ngIf`/`*ngFor`,
`P1-AD-5`) ; `input()`/`output()` ; `*.spec.ts` à côté du source ; commentaires et messages **en
français** (dérogation assumée du dépôt).

### Testing

- Vitest (`@angular/build:unit-test`, jsdom) : `docker compose exec web pnpm test`
- Lint : `docker compose exec web pnpm lint` — objectif **= baseline exactement**
- Build : `docker compose exec web pnpm ng build --configuration development`
- **Tout par Docker**, jamais d'installation de dépendance.
- Repères (2026-08-31, `628bc46`) : web 117 fichiers / 2283 tests, lint 0 — **à remesurer**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md:1388-1406] — Story 31.4, AC verbatim
- [Source: _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md:211-212] — FR-21
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md:470] — pas d'AD dédiée
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md] — §7.1 à §7.4 (contrat)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/EXPERIENCE.md] — patterns, états, flux, points ouverts
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/mockups/contrat-ui-wizard-creation.html] — planche contractuelle
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md:299-303] — §7.8 DetailSurface, amendé ici
- [Source: _bmad-output/implementation-artifacts/31-2-surface-de-detail-adaptative.md] — décisions de la 31.2 inversées (non-modal desktop)
- [Source: _bmad-output/implementation-artifacts/31-3-aide-contextuelle-sur-les-termes-de-jeu.md] — `createDetailSurfaceHost()`, arbitrage « description en ligne » amendé
- [Source: apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.html:7] — `detail` utilisé seulement dans `aria-label`
- [Source: apps/web/src/app/features/characters/character-wizard/steps/attributes-step/attributes-step.ts:54-152] — modèle `assignment` par index
- [Source: apps/web/src/app/features/characters/character-wizard/steps/equipment-step/equipment-step.{ts,html}] — `effect` non rendu, liste plate
- [Source: apps/web/src/app/shared/detail-surface/] — composant partagé (Encadré 2)

---

## Change Log

- 2026-09-21 — **Story acceptée `done` par l'utilisateur** après test manuel complet (« ça fonctionne et c'est parfait »). Le lot du 2026-09-20/21 (AC14 à AC20) n'a pas eu de seconde passe de revue de code : décision de l'utilisateur.
- 2026-09-21 — Lot « retours d'usage » (Tasks 11 à 15, AC14 à AC20) : piste B pour classe et type,
  récapitulatif du voyageur (colonne de droite + feuille « Récap »), équipement repliable avec
  compteur et filtre, descriptions d'arme et de sorts derrière la surface. Contrat UI amendé
  (DESIGN §7.1/§7.4 bis/§7.5, EXPERIENCE). Vérifié à l'écran (desktop et téléphone).
- 2026-09-20 — Vérification à l'écran complète (Task 9), création réelle de bout en bout (AC3),
  message explicite sur un système sans module (`character-wizard.ts`, +3 tests), `sprint-status.yaml`
  réparé. Statut → `review`. Tests 2331/2333 (2 échecs de `calendar-view.spec.ts` sans rapport : date
  codée en dur), lint 0, build propre.
- 2026-09-20 — Implémentation Tasks 2 à 5, 7, 8 (bmad-dev-story) : surface de détail modale +
  corps structuré, sous-titre de carte, AttributePool, catalogue d'équipement ; contraste mesuré et
  corrigé sur la carte sélectionnée. Vérification visuelle (Task 9) en attente. +64 tests environ,
  lint 0.
- 2026-09-20 — Story réécrite après la passe UX (`bmad-ux`) menée avec l'utilisateur : contrat UI
  (DESIGN.md + EXPERIENCE.md + planche `contrat-ui-wizard-creation.html`) ; 13 AC (3 verbatim, 3 de
  cadrage, 7 issus du contrat) ; ancienne Task 1 (options A/B/C) résolue et remplacée. Nouveaux
  périmètres : sous-titre de carte, surface de détail structurée et **centrée modale sur desktop
  pour toute l'application** (⚠️ inverse une décision de la 31.2), AttributePool, catalogue
  d'équipement + jauge + recherche.
- 2026-08-31 — Story créée (bmad-create-story) ; Task 0 exécutée (baseline 117/2283, lint 0).

## Review Findings

*Revue de code (bmad-code-review) du 2026-09-20 — trois passes (Blind Hunter, Edge Case Hunter, Acceptance Auditor) menées par l'agent lui-même, sans sous-agents, à la demande de l'utilisateur. 34 fichiers modifiés + 4 nouveaux, ≈ +1 624 / −322 lignes.*

- [x] [Review][Decision] **Tranché par l'utilisateur (2026-09-20) : option 2** — sortir AUSSI derrière la surface de détail la description de catégorie d'arme et celle des sorts rituels. **À implémenter avec la refonte du bloc de détail (en attente du choix de design).** AC2 « les textes explicatifs déjà seedés y sont accessibles par la surface de détail » — deux familles de texte restent **en ligne** et n'ouvrent pas la surface : la description de catégorie d'arme (`weapon-step.html:18`) et la description de chaque sort rituel (`magic-step.html:40`). C'est l'arbitrage hérité de la 31.3 (« elle sert à choisir »), consigné en Encadré 3 avec « confirmer l'arbitrage plutôt que le rouvrir » — **jamais confirmé explicitement par l'utilisateur**. Options : (1) garder tel quel, AC2 lu comme « tout texte *long ou structuré* est accessible par la surface » (recommandé — ces deux textes servent à choisir, comme les descriptions de classe qui, elles, ont été sorties parce qu'un sous-titre les remplace) ; (2) sortir aussi ces deux textes derrière la surface. [weapon-step.html:18, magic-step.html:40]
- [x] [Review][Decision] **Tranché (2026-09-20) :** (a) le bouton « Voir le détail de… » **ne sert à rien : retiré, le détail est affiché directement** (annule l'AC8 initial ; clé de thème et styles supprimés) ; (b) le message de recherche vide et le reste du catalogue sont acceptés (« parfait »). Deux `[ASSUMPTION]` de la planche jamais validées par l'utilisateur, alors que l'AC8 exige leur validation « au plus tard à la vérification visuelle » : (a) forme et emplacement du déclencheur « Voir le détail de <nom> » (bouton texte sous la grille, hors radiogroup) ; (b) message d'une recherche sans résultat (« Aucun objet ne répond à cet appel… », avec une variante par thème). Les deux sont implémentés et vus à l'écran. [class-step.html:20, tones.ts]
- [x] [Review][Patch] *(appliqué : `align="center"` sur les cartes du level-up)* `ChoiceCard` est aussi consommé par le **level-up wizard** de la fiche (`level-up-wizard.html:104`), hors périmètre de la story et **non vérifié à l'écran** : la refonte de la carte (colonne, alignement à gauche, padding 0.5×0.75 rem, largeur 100 %) y remplace des cartes centrées. Comportement à préserver — passer `align="center"` sur ces cartes (ou vérifier à l'écran et assumer). [level-up-wizard.html:104, choice-card.scss]
- [x] [Review][Patch] *(appliqué + test)* Un objet d'équipement dont `nature` sort des trois valeurs attendues (`individual`/`contenant`/`animal`) **disparaît silencieusement** du catalogue « Achat libre » : `groups()` ne rend que les trois groupes connus (`NATURE_GROUPS.map…`). Aujourd'hui les 68 objets seedés sont conformes, mais un contenu futur mal typé rendrait un objet invisible et inachetable. Rattacher tout objet de nature inconnue au groupe « Objets ». [equipment-step.ts:groups]
- [x] [Review][Patch] *(sans objet : le bouton et `detailCta()` ont été supprimés)* `detailCta()` (class-step, type-step) utilise `String.replace('{name}', name)` avec une chaîne de remplacement : un libellé contenant `$&`, `$1` ou `$'` serait interprété par `replace`. Utiliser une fonction de remplacement (`() => name`). Même remarque, sans conséquence réelle (nombres), pour `budgetText`/`overBudgetText`. [class-step.ts:detailCta, type-step.ts:detailCta]
- [x] [Review][Patch] *(appliqué)* `aria-controls="detail-surface-narrative"` sur la divulgation référence un élément **absent du DOM tant que le récit est replié**. Ne poser l'attribut que lorsque le récit est déplié. [detail-surface.html:disclosure]
- [x] [Review][Defer] La fenêtre modale desktop ne **verrouille pas le défilement** de la page derrière le voile (molette). Conséquence directe du passage en modal ; la feuille mobile a le même comportement depuis la 31.2. — deferred, pre-existing
- [x] [Review][Defer] Incohérence connue et documentée (Completion Note 3) : l'**option de classe** est structurée (tableau + récit) dans l'assistant mais reste en `body` simple sur la fiche (`ClassChoiceDisplay` ne porte que l'effet résolu). — deferred, documented
- *Rejetés comme bruit (5) :* objets recréés à chaque détection de changements par `talentHelp()`/`itemHelp()` (même patron qu'avant, aucun effet mesurable) ; voile à .55 au lieu de .32 aussi sur mobile (consigné, valeur du DESIGN) ; libellés de bannière des attributs codés en dur (patron existant du fichier) ; test « aucun bouton imbriqué » trivial mais inoffensif ; `focus` / piège Tab non simulables en jsdom (limite déjà documentée, vérifié à l'écran pour `Échap`, voile et retour du focus — **le piège Tab n'a pas été essayé à la main**).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-create-story, bmad-dev-story — début)

### Debug Log References

- 2026-08-31 — Baseline mesurée (Task 0) : web 117 fichiers / 2283 tests verts, lint 0, `HEAD = 628bc46`.
- 2026-08-31 — Task 1 soumise à l'utilisateur : aucune des options A/B/C retenue, passe UX
  demandée puis menée avec `bmad-ux` (2026-09-20). `dev-story` mis en pause pendant cette passe ;
  aucun fichier `apps/web/` touché à ce stade.
- 2026-09-20 — Story mise à jour contre le contrat UI finalisé.
- 2026-09-20 — Implémentation Tasks 2 à 5, 7, 8. `docker compose exec web pnpm test` :
  **119 fichiers / 2330 tests, 2328 verts** ; les 2 échecs sont dans `calendar-view.spec.ts` et sont
  **indépendants de cette story** (fixture codée en dur `'2026-09-01'`, désormais passée : la date du
  jour est 2026-09-20 ; aucun fichier `calendar/` touché — `git diff --stat` vide). Chip de correction
  ouverte à part. Lint : **0 = baseline**. `ng build --configuration development` : propre.
- 2026-09-20 — Mesure de contraste (Task 8), sous-titre 12 px `on-surface-variant` : sur carte non
  sélectionnée (`surface-container`) **5,92 / 6,34 / 5,74:1** (grimoire / forêt / steampunk) ✓ ; sur
  carte SÉLECTIONNÉE (`primary-container`) **3,42 / 4,36 / 4,48:1** ✗ → corrigé par `color: inherit`
  (`on-primary-container`, **6,41 / 7,57 / 5,81:1**). Tableau/récit de la surface sur `surface` :
  6,49 / 7,17 / 6,62:1 ✓ ; prix d'équipement sur `surface-container-high` : 5,41 / 5,22 / 4,87:1 ✓.
- 2026-09-20 — Task 9 : Chrome MCP connecté, mais l'onglet est sur `/login` (identifiants préremplis
  par le navigateur). L'agent n'authentifie pas : **en attente que l'utilisateur ouvre la session**.

### Completion Notes List

**1. Périmètre livré (Tasks 2–5, 7, 8) — vérification à l'écran (Task 9) NON encore faite.**
La story reste `in-progress` : ni AC1 (aucun défilement horizontal, mesuré à l'écran), ni les AC
visuels (7 à 13) ne sont confirmés autrement que par tests jsdom et mesure de contraste calculée.

**2. `DetailSurface` (AC5, AC9, AC10).** Contrat étendu sans rien casser : `body` devient optionnel,
s'ajoutent `rows` et `narrative` ; `DetailSurfaceContent`/host gagnent `openContent()` (`open()` en
est un cas particulier). ⚠️ **Modale partout** : voile toujours visible, `aria-modal` et
`cdkTrapFocus` inconditionnels, fenêtre centrée ≥ 1024 px (`translate`/`scale` plutôt que
`transform`, pour ne pas écraser le centrage). `isDesktop`/`BreakpointObserver` **conservés** : ils ne
servent plus qu'à la divulgation du récit. Le récit replié est **dérivé du jeton d'ouverture**
(`narrativeOpenedFor === openToken`) plutôt que remis à zéro par un `effect()` : le premier essai
avec un effet a échoué dans le harnais zoneless (limite déjà documentée en 31.2) — la version
dérivée est plus simple ET testable. Sans tableau, le récit s'affiche directement même sur mobile
(le replier ne laisserait qu'un panneau vide) : **précision non écrite dans la planche, à valider.**

**3. `talentDetail()` partagé** (`shared/detail-surface/talent-detail.ts`) : une seule fonction pour
la fiche et l'assistant ; `'-'`/vide = ligne absente ; `null` sans donnée (règle « pas de texte ⇒
pas d'aide »). Effet de bord voulu : les talents de la **fiche** appliquent maintenant aussi la garde
AC3 (`<strong>` sans texte) — ce qui ferme l'item différé « garde AC3 non appliquée aux déclencheurs
FR-20 » de la revue 31.3 **pour les talents** (avantages et sorts restent en `body` simple).
L'option de classe côté **fiche** reste en `body` simple (`ClassChoiceDisplay` ne porte que l'effet
résolu) alors qu'elle est structurée dans l'assistant : incohérence mineure connue.

**4. `ChoiceCard` (AC7, AC8).** `detail` était déjà renseigné partout mais **jamais affiché**
(`aria-label` seul). Désormais rendu (2 lignes, ellipse), `aria-label` = libellé seul +
`aria-describedby`. `firstSentence()` partagé (`card-subtitle.ts`). Classe/type : sous-titre = 1re
phrase de la description, **description retirée de l'affichage en ligne** et remplacée par le
déclencheur « Voir le détail de <nom> » (⚠️ inverse l'arbitrage de la 31.3). Profil d'attributs :
valeurs triées décroissantes, `align="center"` (nouvelle entrée de `ChoiceCard`, requise pour rester
fidèle à la planche). Arme : séparateur `·` au lieu de `,`. **Hors planche, à signaler :** le
déclencheur « Voir le détail » est un `<button>` sous la grille, hors radiogroup — `[ASSUMPTION]`
d'emplacement toujours ouverte.

**5. `AttributePool` (AC11).** État interne **inchangé** (assignation par index, resynchronisation,
`emitIfComplete`) — seul le rendu passe à une puce par valeur distincte ; placer une valeur prend le
plus petit index libre. Test d'invariance : pour les 3 profils et **toutes** les permutations, les
valeurs émises sont exactement celles placées (AC3). Le résumé remplace « valeurs à distribuer » par
« Profil X — n valeur(s) sur 4 placée(s) » (contrat).

**6. Équipement (AC12).** Groupes par `nature`, déclencheur sur les objets à `effect` dans les deux
modes, recherche (NFD + minuscules), jauge (texte permanent + dépassement en toutes lettres), reset
de la recherche au changement de mode. `.equipment-step__catalog-item`/`__budget` conservés : les 6
tests préexistants passent sans modification. Micro-copie dans `tones.ts` (15 clés × 3 thèmes, test de
parité). Le message de recherche vide est **thématisé** (3 variantes) : proposition, `[ASSUMPTION]`.

**7. Non touchés (AC3/AC6, vérifié par `git status`).** `character-wizard.ts`, `canGoNext`,
`FIELD_TO_STEP_KEY`, `updateSheetData`, `onSubmit`, `steps()` ; `weapon-step` (sauf séparateur du
sous-titre), `magic-step`, `fetish-step`, `narrative-step`, `portrait-cropper` ; tout `apps/api`,
`packages/*`, seed, dépendances.

**8. Écart connu à la planche.** Voile à `rgba(0,0,0,.32)` (valeur historique du composant) et non
`{colors.overlay}` `.55` du DESIGN : le composant utilise les jetons `--mat-sys-*`, pas ceux du
DESIGN. ⚠️ À trancher à l'écran.

**9. Task 9 — vérification à l'écran (Chrome MCP, session ouverte par l'utilisateur).** QUATRE
défauts trouvés, qu'aucun des tests jsdom ne voyait, tous corrigés :
1. 🚨 **Fenêtre desktop invisible sur la page** : fond `surface` sur une page déjà sombre + voile à .32 →
   elle se confondait avec l'arrière-plan. Fond `surface-container-high` + filet, voile à .55 (valeur
   `{colors.overlay}` du DESIGN — l'écart noté plus haut est donc **résolu**).
2. **Largeur 610 px** au lieu de 560 : `content-box` + padding → `box-sizing: border-box`.
3. **Cartes de profil d'attributs dispersées dans la grille** (largeur « au contenu » d'un bouton, hôte
   `app-choice-card` inline) → `:host { display:block }` + `width:100%`.
4. **Chiffres des puces d'attributs en police à empattements** (`font: inherit` absent — préexistant,
   révélé par le nouveau rendu).
Confirmé à l'écran : sous-titres 2 lignes, « Voir le détail de Artisan », tableau + récit déployé
(desktop) / replié avec divulgation 44 px (mobile, bouton mesuré à 44 px de haut), `Échap` et clic sur
le voile ferment et **rendent le focus au déclencheur**, fenêtre centrée sur la **fiche** aussi
(talent « Chasse » d'Orla : 4 lignes de tableau + récit, focus sur Fermer), `×2 → ×1 → badge disparu`
sur [8,6,6,4] avec la valeur épuisée grisée dans les autres rangées, catalogue de 68 objets en 3
groupes, 68 déclencheurs, recherche « corde » → 1 résultat, message vide, jauge à 100 % en erreur avec
« — dépassement de 2800 Po ».
**Contraste mesuré EN PAGE** (`getComputedStyle`, trois thèmes appliqués par classe de `<body>`, sans
écriture de préférence) : non sélectionnée 5,92 / 6,34 / 5,74:1 ; sélectionnée 6,41 / 7,57 / 5,81:1 —
identique au calcul, tous ≥ 4,5:1.
**Non fait :** largeur 360 px ; étapes Magie,
Fétiche, Narratif, Portrait non parcourues ; navigation aux flèches du radiogroup non testée à la
main (couverte par les tests préexistants, `appRadioGroupNav` non modifié).
**Shell du wizard** (en-tête d'étape, progression, panneau résumé) regardé sans être modifié : rien de
cassé, mais à 500 px le panneau « Voyageur » passe **sous** le contenu et l'introduction seedée de
l'étape Attributs occupe ~10 lignes avant tout choix — ce texte est du contenu seedé, pas de la
mise en page. À évaluer par `bmad-ux` si le « manque de polish » du shell reste ressenti.
**Observation hors périmètre :** les 54 objets « individuels » sont dans l'ordre du seed, pas
alphabétique ; un tri alphabétique par groupe faciliterait le balayage (non demandé par la planche).

**10. (g) — création réelle de bout en bout, AC3 vérifié à l'écran** (autorisée par l'utilisateur le
2026-09-20). Parcours complet de l'assistant (Classe Chasseur → Type Technique → Attributs Polyvalent
avec les deux 6 → Arme → Fétiche → Équipement « nécessaire pré-fait » → Narratif → Portrait
« Passer »), sur la partie « Les Veilleurs du Pont » (l'utilisateur y est MJ ; l'API l'autorise).
`GET /characters/a2375a73-…` relu : `classId chasseur`, `typeId technique`,
`attributes {AGI 6, ESP 6, INT 8, VIG 4}`, `weaponId dague`, 12 objets d'équipement, `narrative.name`
saisi — **exactement les choix effectués**, mêmes clés `sheetData` que l'ancien parcours
(`typeId, classId, weaponId, equipment, narrative, attributes`). La fiche s'affiche correctement
(patron Polyvalent, arme « Dague (Épée courte) »).
⚠️ **Donnée de test laissée en base** : personnage « TEST 31.4 (a supprimer) », id
`a2375a73-8407-4066-856d-23efd54a6bfd`. L'API n'expose **aucune route de suppression de personnage** —
suppression par SQL uniquement (commande donnée à l'utilisateur).

**11. Ajout hors périmètre initial, demandé par l'utilisateur (2026-09-20) : message explicite sur un
système sans module.** `character-wizard.ts` n'est donc **pas** resté intact : SEUL le `catch` de
`ngOnInit` change (un 404 pendant le chargement du schéma/contenu → « Ce système de jeu n'a pas encore
d'assistant de création. » ; tout autre échec, y compris un 404 de la PARTIE, garde le message
générique). L'orchestration (`steps`, `canGoNext`, `FIELD_TO_STEP_KEY`, `updateSheetData`, `onSubmit`)
est toujours identique. +3 tests. Le chip correspondant est retiré ; le volet « ne plus proposer la
création » relève des stories 29.15 / 29.16 / 29.17 (sprint change 2026-09-20).

**12. `sprint-status.yaml`** : une ligne de la 31.3 (`note:` de `31-3-…`) avait perdu son guillemet
fermant — fichier illisible pour un parseur YAML strict. Guillemet rétabli ; fichier entièrement
valide (249 entrées, vérifié avec js-yaml).

**13. Lot du 2026-09-20/21 — retours d'usage (Tasks 11 à 15).** Décisions de l'utilisateur : la piste B
pour l'étape Classe (re-clic = désélection, choix obligatoire toujours visible), le bouton « Voir le
détail » supprimé, description d'arme et de sorts derrière la surface, groupes d'équipement repliables
(« exactement ça »), colonne « Voyageur » qui se remplit + Panier dessous, quantités sur mobile.
**Choix de conception laissés à l'agent, à confirmer :** (a) sur mobile, **bouton « Récap »** dans le
bandeau collant (à la place de la flèche « suivant », doublon de « Suivant ») plutôt que le bloc du bas
supprimé ; (b) « Retirer » du Panier supprime la **ligne entière** ; (c) filtre « Ma sélection » comme
substitut du Panier sur mobile ; (d) groupes d'équipement **déployés par défaut**.
**Défaut trouvé à l'écran** : la colonne de droite (`flex-basis: 35 %` + padding en `content-box`)
**débordait hors de la page** — texte d'aide coupé ; préexistant, révélé par le nouveau contenu.
Corrigé (`border-box` sur les deux colonnes).
**Accessibilité de la carte déployée** : en-tête = `role="radio"`, détail = `role="group"` voisin dans
le `radiogroup` ; test dédié « aucun contrôle imbriqué dans un bouton radio » ; la navigation aux
flèches ne peut plus désélectionner par erreur (elle clique une *autre* carte).
**`character-wizard.ts`** : au-delà du `catch` (note 11), le shell gagne `recapOpen`/`cartCount`/
`openRecap`/`closeRecap` — présentationnel ; `steps`, `canGoNext`, `FIELD_TO_STEP_KEY`,
`updateSheetData`, `onSubmit` toujours identiques.
Vérification : tests 2363/2365 (+ magic-step : 2366 environ), lint 0, build propre ; les 2 échecs sont
ceux de `calendar-view.spec.ts` (date codée en dur, sans rapport).

### File List

**Créés**

- `apps/web/src/app/features/characters/character-wizard/choice-card/card-subtitle.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/choice-card/card-subtitle.ts`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-detail.scss`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-detail.ts`
- `apps/web/src/app/shared/detail-surface/talent-detail.spec.ts`
- `apps/web/src/app/shared/detail-surface/talent-detail.ts`
- `apps/web/src/app/features/characters/character-wizard/wizard-summary/wizard-summary.html`
- `apps/web/src/app/features/characters/character-wizard/wizard-summary/wizard-summary.scss`
- `apps/web/src/app/features/characters/character-wizard/wizard-summary/wizard-summary.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/wizard-summary/wizard-summary.ts`

**Modifiés**

- `apps/web/src/app/core/theme/theme-tone.service.spec.ts`
- `apps/web/src/app/core/theme/tones.ts`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.html`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.ts`
- `apps/web/src/app/features/characters/character-sheet/level-up-wizard/level-up-wizard.html`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.html`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.scss`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.ts`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.html`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.scss`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/choice-card/choice-card.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/attributes-step/attributes-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/attributes-step/attributes-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/attributes-step/attributes-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/attributes-step/attributes-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/class-step/class-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/equipment-step/equipment-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/equipment-step/equipment-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/equipment-step/equipment-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/equipment-step/equipment-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/magic-step/magic-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/magic-step/magic-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/magic-step/magic-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/magic-step/magic-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/type-step/type-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.ts`
- `apps/web/src/app/shared/detail-surface/detail-surface-host.spec.ts`
- `apps/web/src/app/shared/detail-surface/detail-surface-host.ts`
- `apps/web/src/app/shared/detail-surface/detail-surface.html`
- `apps/web/src/app/shared/detail-surface/detail-surface.scss`
- `apps/web/src/app/shared/detail-surface/detail-surface.spec.ts`
- `apps/web/src/app/shared/detail-surface/detail-surface.ts`

**Artefacts BMad** (hors `apps/web`) : ce fichier, `sprint-status.yaml`, `deferred-work.md`, `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/` (DESIGN.md, EXPERIENCE.md, mockups/, .working/, .memlog.md), `epics.md` et `sprint-change-proposal-2026-09-20.md` (passe de correction de trajectoire, hors 31.4).
