# Rapprochement — PRD Palier 10.5 ↔ spines UX

*2026-10-29. Source : `prds/prd-jdr-master-2026-10-28-p10-5/prd.md` (final). Les spines l'emportent sur les planches.*

| PRD | Spines | Statut |
| --- | --- | --- |
| FR-1 Gérer sa Ludothèque | EXPERIENCE §2.4, `QuickAddRow` §4, refus de nom en double §3.2 | couvert ; « durée entier positif » laissé à la validation des champs |
| FR-2 Facultatif | §5.1, §5.2, DESIGN §8 (pas d'invitation insistante) ; lien discret §3.2 | couvert |
| FR-3 Jeux de l'hôte d'office | §2.3 section « Chez {hôte} » | couvert ; changement d'hôte = comportement, sans écran propre |
| FR-4 Écarter | §2.3 section du bas, §4 menu ⋮, `UnavailableRow` | couvert |
| FR-5 J'apporte | §2.3 « Dans mon … », §6 sans confirmation | couvert ; l'« option inerte » du PRD devient l'état vide de la section |
| FR-6 Lire les jeux sur place | §2.3, §10 n° 7 | **⚠️ amendé** : un jeu figure dans chaque section où il est présent (×N), au lieu d'une ligne unique |
| FR-7 Envie | `EnvyToggle` §4, §3.1 | couvert |
| FR-8 Jeux du groupe | §2.5 (recherche + filtre) | couvert |
| FR-9 Visibilité | §2.7 `LibrarySheet` | couvert |
| FR-10 Compteur d'hôte | §2.6 « Qui reçoit » | couvert |
| NFR temps réel | §5.3 | couvert |
| §8 Q1 libellés | §3 | **résolu** |
| §8 Q2 tri des jeux sur place | §2.3 filtres « Jouables à N » et « Les plus … » | **résolu** |
| §8 Q3 recherche dans les Jeux du groupe | §2.5 | **résolu** (recherche + filtre) |

**Écarts à reporter dans le PRD** : FR-6 (doublons par section, soirée seulement) et §8 (trois questions résolues par l'UX).

**Idées qualitatives** : « pas la feature du siècle », tout facultatif, prêt hors appli — conservées (DESIGN §1 et §8, ligne sur le prêt §3.1).
