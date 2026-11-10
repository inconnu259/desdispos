---
title: jdr-master Experience — Delta Formulaire de création de l'Homme Dragon (Story 33.3)
status: final
updated: 2026-09-23
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/implementation-artifacts/spec-33-1-fiche-homme-dragon-refondue.md"
---

# jdr-master — Experience — Delta Formulaire de création de l'Homme Dragon (33.3)

Problème traité : le formulaire de création de l'Homme Dragon (`homme-dragon-sheet.html`, formulaire de création intégré) est une liste verticale brute de 9 champs — un `<select>` race, un `<select>` artefact sans description, puis 7 champs texte à la suite. Aucun texte d'accompagnement, aucune structure, aucun composant Material. Il tranche avec le wizard de création de personnage (`ux-jdr-master-2026-08-31`), auquel le MJ le compare directement.

Ce delta transforme ce formulaire en parcours guidé de 5 étapes, sur le patron déjà établi par le wizard perso, sans y toucher.

## 1. Foundation

Web responsive, Angular Material 22 — hérité intégralement du spine de base et du delta wizard perso (`ux-jdr-master-2026-08-31`). Aucun nouveau form-factor.

## 2. Information Architecture

Le formulaire de création actuel (9 champs à plat) devient un parcours en **5 étapes**, bandeau de progression + Précédent/Suivant (patron identique au wizard perso, adapté à un parcours plus court) :

1. **Race** — choix parmi les 4 races (`ChoiceCard`, voir DESIGN.md §7).
2. **Artefact** — choix filtré par la race choisie à l'étape 1 (même patron `ChoiceCard`, sans teinte de race — c'est un choix d'objet, pas d'identité).
3. **Identité** — Nom, Apparence, Caractère.
4. **Vie de l'Homme Dragon** — Vocation, Demeure, Mondes protégés.
5. **Avatar** — image/URL, reprend le champ existant tel quel dans le nouvel habillage d'étape.

Aucun champ n'est ajouté ni retiré par rapport au formulaire actuel — seul le regroupement change. `[ASSUMPTION]` L'étape Avatar n'a pas été maquettée séparément (patron identique aux étapes de champs, un seul champ) ; à confirmer en implémentation si un traitement particulier s'avère nécessaire (ex. aperçu d'image).

## 3. Voice and Tone

Principe explicite de l'utilisateur : **accompagner, ne pas donner trop d'information d'un coup** — le MJ doit comprendre ce qu'on lui demande avant d'agir, à chaque étape. Deux couches de texte, toutes deux en **substitution** dans les mocks (le contenu définitif est produit par d'autres stories, hors périmètre UX) :

- **Texte de champ** (étapes Identité, Vie, Avatar) : une ligne d'aide sous le label, qui dit ce qu'on attend (ex. « Comment se manifeste ton Homme Dragon aux yeux des voyageurs ? » pour Apparence).
- **Texte de choix** (étapes Race, Artefact) : 1-2 phrases par option, qui expliquent ce que c'est, sur le modèle des talents/classes du wizard perso.

## 4. Component Patterns

Voir DESIGN.md §7 pour les spécifications visuelles. Comportement :

- **`ChoiceCard` (Homme Dragon)** : un seul choix actif par étape (radio implicite), sélection immédiate au clic — pas de confirmation séparée. La sélection à l'étape Race détermine le sous-ensemble d'artefacts proposé à l'étape 2 (patron déjà en place côté service, `artefactsForExistingRace()`).
- **Champs Material** : un seul groupe de champs visible par étape (jamais les 7 à la fois) — c'est le mécanisme qui porte « ne pas donner trop d'info d'un coup ».
- **Barre d'actions** : Précédent/Suivant fixes en bas, patron identique au wizard perso.

## 5. State Patterns

| État | Comportement |
|---|---|
| Race non choisie, étape Artefact atteinte | Ne devrait pas se produire (Suivant bloqué à l'étape 1 sans choix) |
| Champs de l'étape courante tous optionnels sauf ceux requis par le formulaire actuel | Suivant reste actif ; la validation existante (ex. nom obligatoire) s'applique à l'étape qui porte le champ, pas en fin de parcours |
| Retour en arrière (Précédent) | Les choix/saisies déjà faits sont conservés |

## 6. Interaction Primitives

Clic/tap pour choisir une carte ou activer un champ. Cible tactile 44px minimum (héritée). Aucun geste de glisser-déposer. Navigation clavier standard (Tab, flèches sur les groupes de choix si implémentées en `radiogroup`, comme le wizard perso).

## 7. Accessibility Floor

Hérité du spine wizard : information jamais portée par la seule couleur — la teinte de race (DESIGN.md §2) est toujours doublée du nom de la race et de l'étiquette texte. Cible tactile 44px. Contraste à vérifier dans les 3 thèmes à l'implémentation (même réserve que le wizard perso pour ses propres teintes).

## 8. Key Flows

**Kaien, MJ, crée son second Homme Dragon pour une nouvelle aventure.** Il ouvre « Personnages », clique sur l'entrée de création proposée pour son aventure. Étape 1/5 : quatre cartes de race, chacune avec un court texte expliquant ce qui la distingue — il hésite entre Dragon Bleu et Dragon Rouge, lit les deux descriptions, choisit Dragon Bleu. Étape 2/5 : seuls les artefacts du Dragon Bleu sont proposés, chacun avec sa description — il en choisit un sans avoir à deviner ce qu'il fait. Étapes 3 et 4 : un groupe de champs à la fois, chacun avec une ligne d'aide — il ne se retrouve jamais face à un mur de 7 champs vides. Étape 5 : il renseigne un avatar et valide la dernière étape. Sa fiche est créée, en tout point équivalente à ce que produisait l'ancien parcours (AC de la story 33.3).

## 9. Questions ouvertes et hypothèses

- `[ASSUMPTION]` Étape Avatar non maquettée séparément — voir §2.
- Le rattrapage vers les champs Material (DESIGN.md §7) reste **limité à cette page**. L'utilisateur a signalé le même écart sur 14 autres pages de l'application (10 en remplacement purement mécanique, dont — ironiquement — 4 étapes du wizard perso lui-même ; 4 plus complexes, logique de binding à revoir) ; le détail est documenté dans `.memlog.md` pour un suivi `bmad-build` séparé — ce document n'en fait pas le contrat.
