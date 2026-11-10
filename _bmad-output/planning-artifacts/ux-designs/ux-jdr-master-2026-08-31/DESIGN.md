---
title: jdr-master Design System — Delta Wizard de création de personnage (Story 31.4)
status: final
updated: 2026-09-20
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/mockups/key-creation-desktop.html"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/mockups/key-creation-mobile.html"
  - "_bmad-output/implementation-artifacts/31-4-refonte-du-parcours-de-creation-de-personnage.md"
---

# jdr-master — Design System — Delta Wizard de création (31.4)

Ce document est un **delta** : il n'ajoute **aucun token** (couleur, typographie, espacement, rayon, élévation). Cadrage posé par l'utilisateur : les trois thèmes, la palette et la typographie sont validés ; le sujet est la **finesse de mise en forme** d'un wizard jugé « première version ». Il amende un composant existant (`DetailSurface`, §7.8 du delta 2026-08-04) et en spécifie trois nouveaux.

En cas de conflit avec une planche de `.working/`, **ce document gagne**. La planche contractuelle est [`mockups/contrat-ui-wizard-creation.html`](mockups/contrat-ui-wizard-creation.html) ; l'exploration qui y a mené (variantes écartées, dont le glisser-déposer gardé « sous le coude ») est [`mockups/wizard-pistes-de-solutions.html`](mockups/wizard-pistes-de-solutions.html).

> ## ⚠️ Règle de travail héritée
> Toute spécification écrite ensuite — story, critère d'acceptation, décision d'implémentation — qui **modifierait** la planche contractuelle doit le signaler par une icône ⚠️ placée juste avant la partie concernée, en disant ce qui change et pourquoi.

## 1. Brand & Style

Aucun changement d'identité. Le ton éditorial de la base (léger, JDR) s'applique aux microcopies nouvelles (EXPERIENCE.md §Voice and Tone).

## 2. Colors

Aucune couleur nouvelle. Emplois de l'existant :

| Usage | Token |
| --- | --- |
| Sous-titre de carte, libellés de tableau, récit replié/déployé | `{colors.text-muted}` |
| Carte / puce sélectionnée | contour `{colors.accent-2}`, fond `{colors.accent-2}` à 16 % |
| Jauge de budget (sous le plafond) | remplissage `{colors.accent-1}` |
| Jauge de budget (au-delà du plafond) | remplissage `{colors.status-unavailable}` **et** libellé de dépassement en toutes lettres |
| Badge de compteur de puce | fond `{colors.accent-1}`, texte `{colors.primary-bg}` |

> **Contraste à mesurer, pas à supposer.** Le sous-titre de carte est un texte de 12 px en `text-muted` posé sur `surface-high`. La base sait déjà que `text-muted` frôle 4,5:1 sur certaines surfaces (le thème Steampunk plafonne à ~4,4:1). L'implémentation **mesure le ratio dans les trois thèmes** avant de livrer ; si un thème passe sous 4,5:1, c'est la palette du thème qu'il faut corriger, pas la taille du texte (même conclusion que la 36.11).

## 3. Typography

Échelle existante, usages nouveaux :

| Élément | Token |
| --- | --- |
| Sous-titre de carte | `{typography.text-sm}` (12 px), interligne 1,35, **2 lignes maximum** |
| Libellés / valeurs du tableau mécanique | `{typography.text-sm}` |
| Récit d'ambiance | `{typography.text-base}`, *italique*, `text-muted` |
| Titre de groupe du catalogue d'équipement | `{typography.text-sm}`, capitales, espacement de lettres 0,04 em, `text-muted` |

## 4. Layout & Spacing

- **Cible tactile 44 × 44 px minimum** pour toute puce, ligne de catalogue, bascule de mode et divulgation. (Le déclencheur de terme dans une phrase reste soumis à la dette connue de la 31.2 ; les *lignes* du catalogue, elles, portent la cible.)
- Grille de cartes inchangée : `auto-fill, minmax(140px, 1fr)`. Une carte à sous-titre grandit en hauteur ; la grille aligne en haut, sans hauteur forcée.
- Seuil desktop inchangé : **1024 px** (fenêtre centrée pour la surface de détail, mise en page 65/35 du wizard).

## 5. Elevation & Depth

Aucun niveau nouveau. La feuille mobile garde `{elevation.panel}` ; la fenêtre centrée desktop prend `{elevation.modal}` (déjà défini dans la base).

## 6. Shapes

Rayons existants : carte `{radius.card}`, puce `{radius.button}`, champ de recherche `{radius.input}`, piste de jauge 4 px.

## 7. Components

### 7.1 ChoiceCard — *amendé*

Nom (`text-base`, 500) **+ sous-titre** de 2 lignes maximum, coupé par une ellipse. Sélection : contour et fond `accent-2` (inchangé). Le sous-titre est **du texte visible, plus un `aria-label`** : la donnée `detail` existante ne sert plus seulement au lecteur d'écran.

| Étape | Source du sous-titre |
| --- | --- |
| Classe, Type | première phrase de la description du catalogue |
| Catégorie d'arme | formules « Toucher … · Dégâts … » (le `detail` actuel) |
| Profil d'attributs | valeurs, triées par ordre décroissant (« 8 · 6 · 6 · 4 ») |
| Saison (magie) | **aucun** — le catalogue ne porte pas de texte |

**Pas de texte ⇒ pas de ligne.** Une carte sans source de sous-titre reste compacte ; on n'affiche jamais un sous-titre vide ni un texte de remplacement.

> ## ⚠️ Amendement du 2026-09-20 — la carte choisie se **déploie en place** (piste B)
> Le §7.1 initial retirait la description de la grille pour la confier à la surface de détail derrière un bouton « Voir le détail de… ». **L'utilisateur l'a jugé inutile : le détail est affiché directement**, et sa présentation refondue.
>
> **Carte déployée.** La carte de la classe (ou du type) sélectionnée **prend toute la largeur de la grille** et forme, avec son détail, **une seule carte à deux parties** :
> - **en-tête** — le bouton radio : libellé à gauche, « Toucher pour désélectionner » à droite (le sous-titre cède la place : le détail est dessous) ;
> - **détail** (`ChoiceDetail`, groupe *voisin* du radio, jamais son enfant) : description, puis **Talents / Avantages** en **pastilles tactiles** (34 px, ⓘ — elles ouvrent la surface de détail), puis les **choix obligatoires**, puis la divulgation « Occupations et actions ».
>
> **Re-toucher la carte déployée la désélectionne** : elle se referme et redevient une carte comme les autres ; l'étape se re-bloque (« Suivant » désactivé), spécialité et choix obligatoires sont effacés.
>
> **Choix obligatoire — toujours visible.** Métier d'appoint, type de paysage, type de créature, spécialité de l'Artisan : cadre **ambré**, mention **« Obligatoire »**, libellé au-dessus d'un champ de 44 px. **Jamais replié** avec occupations et actions — c'est lui qui bloque « Suivant ». Le libellé porte, quand le terme a un texte, la pastille ⓘ.
>
> **Référence.** « Occupations et actions » : divulgation de 44 px, **repliée à chaque sélection** ; déployée, deux colonnes de **petites étiquettes** (`{radius.badge}`, pas de puces) — ce sont des termes de référence, **pas des boutons** (donc pas de ⓘ).
>
> **Autres cartes.** Description d'une **catégorie d'arme** et d'un **sort rituel** : derrière la surface de détail (AC2 lu strictement) — pastille ⓘ portant le nom de la catégorie, ou bouton ⓘ de 44 px voisin de la ligne du sort.

### 7.2 DetailSurface — présentation desktop et corps structuré *(amende le §7.8 du delta 2026-08-04)*

> ## ⚠️ Amendement de présentation desktop, décidé le 2026-09-20
> Le §7.8 posait « panneau latéral à droite sur desktop ». **Sur desktop, la surface devient une fenêtre centrée**, pour toute l'application (wizard **et** fiche : un seul composant, un seul comportement). La feuille montant du bas sur mobile est **conservée**.
>
> | | Spécification |
> | --- | --- |
> | Position | centrée horizontalement et verticalement dans la fenêtre |
> | Taille | largeur 560 px maximum (et `100 % − 2 × 16 px` en dessous), hauteur 80 % de la fenêtre maximum, défilement **interne** au-delà |
> | Voile | `{colors.overlay}` sur toute la page, **présent aussi sur desktop** (il était masqué au-delà de 1024 px) ; un clic sur le voile ferme |
> | Élévation / forme | `{elevation.modal}`, `{radius.card}` |
>
> **Ce que cela retire :** le panneau latéral laissait la page interactive et la surface non modale sur desktop (décision de la revue de la 31.2 : `aria-modal` et `cdkTrapFocus` désactivés au-delà de 1024 px). **La fenêtre centrée est modale sur toutes les tailles** : `aria-modal="true"`, piège de focus actif, `Échap` et voile ferment, le focus revient au déclencheur. Raison : une fenêtre centrée recouvre le contenu qu'elle explique ; la laisser non modale rendrait des contrôles cliquables sous un voile. La page étant sous le voile, on ne peut plus activer un autre terme sans fermer la surface d'abord — **sur desktop comme sur mobile** (le voile mobile, plein écran, l'interdisait déjà) : un seul terme ouvert à la fois, le focus revient au déclencheur à chaque fermeture.

Le §7.8 décrit la surface mais **pas son corps**, d'où le « pavé de texte ». Le corps devient :

1. **Titre** (`text-lg`, 600) et croix de fermeture 32 px.
2. **Tableau mécanique** — deux colonnes libellé / valeur, filets `border-subtle` entre lignes. Lignes présentes **seulement si la donnée existe** : Attributs, Difficulté, Effet, Conditions (talent) ; Effet seul (objet d'équipement) ; rien de plus pour un terme sans donnée structurée.
3. **Récit d'ambiance** — italique, `text-muted`, **après** le tableau.

| Présentation | Comportement du récit |
| --- | --- |
| Feuille mobile (< 1024 px) | **replié par défaut** derrière une divulgation « ▸ Lire le récit » / « ▾ Masquer le récit », cible 44 px. La feuille grandit vers le haut sans dépasser la zone sûre, puis défile en interne. |
| Fenêtre centrée desktop (≥ 1024 px) | **déployé**, sans divulgation |

> **Décision explicite exigée par le §7.8.** Le dépliant en place est « motif autorisé mais d'exception, décidé explicitement à la conception de l'écran concerné ». Il est décidé ici, pour le seul récit d'ambiance sur mobile, parce que c'est ce texte — et non l'information mécanique — qui provoquait le défilement. Il ne fait pas précédent pour d'autres contenus.

Le contrat public du composant (`[title] [body] [openToken] (closed)`) est un sujet d'implémentation : le corps structuré peut s'y loger sans changer les quatre entrées, ou l'étendre — arbitrage laissé à la story.

### 7.3 AttributePool — nouveau

Remplace, dans l'étape Attributs, les quatre rangées de puces indexées par emplacement.

- **Une puce par valeur distincte** du profil, triées par ordre décroissant, dans **chaque** rangée d'attribut (Agilité, Esprit, Intelligence, Vigueur).
- **Badge « ×N »** en coin haut-droit : nombre d'exemplaires **encore à placer**. Affiché uniquement pour une valeur présente plusieurs fois dans le profil. Au premier placement d'un « 6 » de [8, 6, 6, 4], les autres rangées passent de « ×2 » à « ×1 ».
- **États d'une puce** : *libre* (fond `surface-high`) · *sélectionnée dans cette rangée* (contour `accent-2`) · *épuisée ailleurs* (opacité 35 %, non activable). Une puce sélectionnée dans sa propre rangée reste activable : c'est la façon de la retirer.
- Le compteur ne désigne jamais un exemplaire précis : **il n'existe plus deux « 6 » indiscernables**.
- Le résultat émis (les valeurs par attribut) est strictement celui de l'ancien parcours.

### 7.4 EquipmentCatalog et BudgetGauge — nouveaux

**Catalogue** (mode « Achat libre ») : lignes de 44 px minimum, regroupées sous des titres de groupe par **nature** — Objets · Contenants · Animaux — à la place de la liste unique. Chaque ligne : nom, prix, action « Ajouter ». Un objet **porteur d'un texte d'effet** a son nom rendu comme déclencheur de la surface de détail (soulignement pointillé) ; un objet sans effet reste un simple nom. Le mode « Nécessaire pré-fait » applique la même règle à ses lignes.

**Recherche** : champ de 44 px au-dessus du catalogue, filtre sur le libellé, insensible à la casse et aux accents. Les groupes vides disparaissent pendant la recherche.

**BudgetGauge** : piste de 8 px, rayon 4 px, remplie à proportion du budget dépensé, avec le texte « Budget · N / 1000 Po » **toujours visible** (la jauge ne porte jamais seule l'information). Au-delà du plafond : remplissage `status-unavailable` **et** « — dépassement de N Po ».

### 7.5 WizardSummary — colonne de droite et feuille « Récap » *(ajouté le 2026-09-20)*

Un composant, **deux hôtes**.

**Desktop (≥ 1024 px)** — colonne de droite (35 %), **deux blocs séparés** :
1. **Voyageur** — titre = le **nom saisi** à l'étape Narratif (« Voyageur » tant qu'il est vide) ; **pastilles PV / PE / Condition / Initiative / Encombrement qui passent à la ligne** (`flex-wrap`, aucune ne déborde) ; puis des **lignes libellé / valeur qui apparaissent au fil des étapes**, dans l'ordre du parcours : Classe · Spécialité · Type · Saison · Sorts · Arme · Fétiche · Sexe · Âge · Particularités · Village · Motivation · Personnalité — **une ligne sans valeur n'est pas rendue** ; enfin les **quatre valeurs d'attributs** (AGI ESP INT VIG) dès qu'elles sont posées. Sans statistiques dérivées : l'aide « Les statistiques dérivées apparaîtront… », qui passe à la ligne.
2. **Panier** — l'équipement de départ (ancien « Panier » de l'étape, déménagé) : « 2× Corde » + **Retirer** (supprime la **ligne entière**), total en Po. **N'apparaît que s'il contient quelque chose.**

**Mobile (< 1024 px)** — la colonne n'existe pas (l'ancien bloc, en bas de page, était à moitié caché par les barres fixes) :
- le **bandeau d'étape est collant** ; sa flèche « suivant » (doublon de « Suivant ») cède la place à un bouton **« Récap »** (pilule 36 px) portant, dès qu'il y a de l'équipement, une **pastille du nombre d'exemplaires** ;
- « Récap » ouvre le **même contenu dans la surface de détail** (feuille du bas) ; `Fermer` ramène le focus au bouton.

### 7.4 bis EquipmentCatalog — compteur, filtre, repli *(amende le §7.4, 2026-09-20)*

- **Groupes repliables.** Le titre de groupe est un **bouton de 44 px** : nom, **nombre d'objets**, chevron ▾ / ▸ (`aria-expanded`). Déployés par défaut. **Une recherche — ou le filtre « Ma sélection » — déplie tout** : un résultat ne se cache jamais dans un groupe replié.
- **Compteur.** « Ajouter » devient **− ×n +** (boutons de 44 px) dès qu'un objet est pris ; **« − » à ×1 le retire**. La ligne prise reçoit un **liseré** `accent-1`. Même compteur sur desktop et mobile.
- **Filtre** « **Tout** » / « **Ma sélection · n** » (pastilles de 36 px, `aria-pressed`) : relire ce qu'on a pris sans parcourir le catalogue. Remplace le Panier de fin de page, **supprimé de l'étape**.
- Le Panier vit désormais dans le §7.5 (colonne de droite ; feuille « Récap » sur mobile).

## 8. Do's and Don'ts

**Do** : dériver chaque sous-titre du catalogue seedé ; conserver « pas de texte ⇒ pas de ligne » ; réutiliser la surface de détail existante pour tout texte long.
**Don't** : recopier un texte de règle dans le registre de thèmes ; ajouter une seconde surface flottante ; rendre un sous-titre vide ; rétablir des puces jumelles indiscernables ; laisser la jauge de budget porter l'information par la seule couleur.
