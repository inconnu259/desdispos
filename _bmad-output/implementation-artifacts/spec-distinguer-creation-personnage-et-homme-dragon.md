---
title: 'Distinguer visuellement « Créer un voyageur » et « Créer un Homme Dragon »'
type: 'feature'
created: '2026-10-05'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dans la section « À forger » de « Personnages », une ligne de création de personnage joueur et une ligne de création d'Homme Dragon (rôle MJ) ont exactement la même forme : seul le libellé les distingue, ce qui prête à confusion pour un compte à la fois MJ et joueur·euse.

**Approach:** Réutiliser la langue visuelle déjà posée pour l'Homme Dragon (story 33.5) : sur les lignes d'Homme Dragon, le contour pointillé, la pastille « + » et un `NatureMarker` « Homme Dragon » passent en `--jdr-accent-2` ; les lignes de personnage joueur restent inchangées (neutres).

</frozen-after-approval>

## Implementation Notes

- Fichiers : `character-creation-entries.{html,scss,ts,spec.ts}` (dossier `features/characters/my-characters/`). Modificateur `--dragon` sur la ligne, `NatureMarker` plein format sous le libellé dans un conteneur `aria-hidden` (le libellé porte déjà la nature), `__text` en colonne.
- Surprise : placé à droite du libellé, le marqueur écrasait le texte à ~800 px (4 lignes) ; d'où l'empilement libellé / marqueur.
- Vérifié : tests `features/characters/**` 533/533 ; rendu relevé dans le navigateur intégré (compte de démo Diane, thème sombre) — lignes dragon teintées + marqueur, ligne « voyageur » neutre. Non vérifié : les deux autres thèmes visuellement, largeur mobile.

## Review Triage Log

- **[blind] Mot « Homme Dragon » dupliqué (libellé + marqueur)** — `low`, rejeté : la nature n'est jamais portée par la seule couleur (spec 33.5) ; le mot du marqueur est le repère de balayage voulu, et le conteneur `aria-hidden` évite la double lecture.
- **[blind] Lignes dragon plus hautes que les lignes personnage** — `low`, rejeté : écart de quelques pixels, rendu relevé acceptable ; la variante en ligne écrasait le libellé.
- **[blind] Teinte perdue au survol** — `low`, rejeté : le survol/focus passe volontairement en `primary` (même retour pour les deux natures) ; le badge garde sa teinte, ce qui reste lisible.
- **[blind] Contraste d'`accent-2` non vérifié sur les 3 thèmes** — `low`, rejeté : même jeton et même usage que le `NatureMarker` des cartes (33.5) ; la bordure n'est qu'un renfort, la nature est portée par le texte.
- **[blind] Tests limités au DOM (nom accessible)** — `false` : un conteneur `aria-hidden="true"` est exclu du nom accessible par construction, et l'attribut est testé.
- **[blind] Repli `#a68cf0` répété** — `low`, rejeté : même repli que `nature-marker.scss`, trois occurrences locales ne justifient pas une variable.
- **[blind] DESIGN.md §7.3 et `docs/checklist.md` non mis à jour** — defer : modifier un document de conception dépasse ce correctif ; consigné dans `deferred-work.md`.
- **[blind] Fins de ligne LF→CRLF signalées par git** — `false` : avertissement habituel de Windows, présent pour tout fichier édité, indépendant de ce changement.
