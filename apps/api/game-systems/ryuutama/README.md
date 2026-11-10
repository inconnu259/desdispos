# Seed Ryuutama

Ce dossier attend, dans un sous-dossier `data/`, les fichiers JSON de contenu décrits
ci-dessous. Depuis le 2026-09-25 (NFR4 révisée), ces fichiers sont **versionnés** : les textes
y sont reformulés à partir du *Guide du Voyageur* (mécaniques conservées, formulation propre au
projet) — le livre reste nécessaire pour jouer. Sans ces
fichiers, le démarrage de l'API échoue au bootstrap avec un message d'erreur pointant
vers ce README.

```
apps/api/game-systems/ryuutama/data/
  classes.json
  types.json
  attribute-patterns.json
  weapon-categories.json
  wizard-step-intros.json
```

## classes.json

Tableau de 7 objets (une entrée par classe : artisan, chasseur, fermier, guerisseur,
marchand, menestrel, noble) :

```json
[
  {
    "key": "artisan",
    "label": "Artisan",
    "recommendedForBeginners": false,
    "requiresSpecialty": true,
    "specialtyLabel": "Type d'objet de spécialité",
    "talents": [
      { "name": "Création", "effect": "Fabrique un objet", "attributes": ["VIG", "AGI"], "difficulty": "variable" },
      { "name": "Réparation", "effect": "Répare un objet", "attributes": ["VIG", "AGI"], "difficulty": "variable" },
      { "name": "Transformation", "effect": "Transforme une dépouille", "attributes": ["AGI", "INT"], "difficulty": "2×niveau" }
    ]
  }
]
```

Chaque classe doit avoir exactement 3 talents. Seule la classe `artisan` a
`requiresSpecialty: true`.

## types.json

Tableau de 3 objets (attaque, technique, magie) :

```json
[
  {
    "key": "attaque",
    "label": "Attaque",
    "advantages": [
      { "name": "Endurance", "effect": "+4 PV" },
      { "name": "Puissance", "effect": "+1 dégâts" },
      { "name": "Entraînement", "effect": "+1 arme favorite supplémentaire" }
    ]
  }
]
```

## attribute-patterns.json

Tableau (un seul pattern documenté ce palier : Polyvalent) :

```json
[
  { "key": "polyvalent", "label": "Polyvalent", "values": [8, 4, 6, 6] }
]
```

## weapon-categories.json

Tableau de 5 objets (arc, epee-courte, epee-longue, hache, lance) :

```json
[
  { "key": "arc",         "label": "Arc",          "touchFormula": "AGI+INT-2", "damageFormula": "AGI",   "price": 750, "encumbrance": 3, "hands": 2 },
  { "key": "epee-courte", "label": "Épée courte",  "touchFormula": "AGI+INT+1", "damageFormula": "INT-1", "price": 400, "encumbrance": 1, "hands": 1 },
  { "key": "epee-longue", "label": "Épée longue",  "touchFormula": "VIG+AGI",   "damageFormula": "VIG",   "price": 700, "encumbrance": 3, "hands": 1 },
  { "key": "hache",       "label": "Hache",         "touchFormula": "VIG+VIG-1", "damageFormula": "VIG",   "price": 500, "encumbrance": 3, "hands": 2 },
  { "key": "lance",       "label": "Lance",         "touchFormula": "VIG+AGI",   "damageFormula": "VIG+1", "price": 350, "encumbrance": 3, "hands": 2 }
]
```

## wizard-step-intros.json

Tableau de 7 objets (une entrée par étape de l'assistant de création — hors `portrait`,
qui n'a pas de texte dans le livre et reste géré en dur côté frontend, `tones.ts`) :

```json
[
  { "key": "classId", "label": "Choisir sa classe", "text": "La première chose à faire est de choisir sa classe. ..." }
]
```

`key` correspond aux clés d'étape du wizard (`classId`, `typeId`, `attributes`,
`weaponCategoryId`, `fetiqueObject`, `equipment`, `narrative`). `text` est le texte
d'introduction affiché avant toute sélection, transcrit tel quel de `docs/assistant.md`
(*Guide du Voyageur*, chapitre « Créer un Voyageur ») — Story 23.3.

## homme-dragon-level-capacities.json

Tableau de 6 objets : les capacités que l'Homme Dragon acquiert en montant de niveau (clé de
catalogue `hommeDragonLevelCapacity`, Story 33.7). La fiche liste celles dont `level` est inférieur
ou égal à son niveau ; la carte est masquée au niveau 1.

```json
[
  { "key": "reserve", "label": "Réserve de souffles", "level": 2, "description": "À partir du niveau 2, ..." }
]
```

La capacité `artefact-cadeau` (niveau 4) s'accompagne d'un choix unique et définitif porté par la
fiche (`sheetData.artefactCadeau`), pas par ce catalogue.

## souffles-rituels.json

Tableau de 6 objets : les souffles rituels de la mère-dragon, consultables dès le niveau 5 (clé de
catalogue `souffleRituel`, Story 33.7). Même forme que `souffles.json` (`key`, `label`, `ps`,
`description`) mais **sans** `race`, `famille` ni `reservable` : ils ne sont jamais classés « autre
race ». Le livre ne précise pas leur coût ; hypothèse retenue et documentée dans `docs/dragons.md` :
`ps: 1`, comme les autres souffles.
