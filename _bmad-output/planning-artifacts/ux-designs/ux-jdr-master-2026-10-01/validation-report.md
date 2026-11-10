# Validation Report — jdr master, delta Réserve de souffles (Story 33.6)

- **DESIGN.md :** `DESIGN.md`
- **EXPERIENCE.md :** `EXPERIENCE.md`
- **Run at :** 2026-10-02
- **Lentilles lancées :** grille de validation et couverture des décisions du memlog (`review-rubric.md`), accessibilité (`review-accessibilite.md`), puis relecture éditoriale structure et prose (`bmad-review`).

## Overall verdict
Avant corrections : paire cohérente avec le memlog (22 décisions toutes reflétées, aucune décision écrasée qui subsiste), mais le contrat n'était pas figeable : la ligne grisée se contredisait entre les deux spines, la planche divergeait sur quatre textes, la liste des amendements de planification était incomplète, et la revue d'accessibilité concluait « non conforme » (1 critique : lignes de souffle inopérables au clavier ; 5 élevés : perte de focus, aucune annonce, fenêtre non utilisable à 400 %, contrastes atelier-cuivre, noms de race illisibles). Toutes les corrections mécaniques ont été appliquées, deux décisions utilisateur prises (extension de `DetailSurface`, annulation du dernier retrait), puis 17 corrections de prose. Aucun constat critique ou élevé n'est resté ouvert.

## Sévérités (avant corrections)
- Accessibilité : 1 critical, 5 high, 9 medium, 7 low.
- Grille et couverture : 0 critical, 2 high, 15 medium, 18 low.

## Reste à faire / non traité (à décider)
- **À mesurer à l'implémentation** : `--outline` dans foret-ancienne et atelier-cuivre ; `text-muted` sur `surface-high` en atelier-cuivre ; alias `--mat-sys-*` marqués `[ASSUMPTION]`.
- **Propositions éditoriales non appliquées** (réorganisations, ~28 % de longueur gagnée) : sortir EXPERIENCE §10 vers un document de planification ; fusionner « Décisions de clôture » et §11 en un registre unique ; dédoublonner les occurrences de l'extension de `DetailSurface` (6) et de l'annulation du dernier retrait (8) ; condenser §7 et §9 ; sortir du tableau §5 les lignes longues ; découper le Key Flow en étapes numérotées.
- **Hors de la grille** : chargement ou échec du catalogue ; message de rejet de règle distinct de l'échec réseau ; un même rituel sur plusieurs emplacements ; pas de planche pour une fenêtre ouverte depuis un emplacement rempli.
- **Rapport HTML** (`validation-report.html`) non généré.

## Reviewer files
- `review-rubric.md`
- `review-accessibilite.md`
