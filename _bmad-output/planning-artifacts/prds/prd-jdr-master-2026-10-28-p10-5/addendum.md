# Addendum — Palier 10.5 : Jeux de société

Matière qui éclaire le PRD sans y avoir sa place : alternative écartée et pistes pour l'architecture.

## Alternative écartée : import BoardGameGeek

Envisagé pour préremplir nombre de joueurs, durée et couverture ; écarté par l'utilisateur le 2026-10-29 au profit de la saisie manuelle. Contraintes relevées (recherche du 2026-10-29) :

- l'API XML de BGG exige d'enregistrer l'application et d'envoyer un jeton d'autorisation ; BGG annonce un délai d'une semaine ou plus, et peut refuser ;
- usage non commercial seulement sans licence ; données à ne pas modifier ; logo « Powered by BGG » avec lien obligatoire pour tout usage public ;
- interdiction d'utiliser les données pour entraîner une IA.

Sources : <https://boardgamegeek.com/using_the_xml_api>, <https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use>.

À reprendre si la saisie manuelle se révèle un frein (SM-1 non atteint).

## Pistes pour l'architecture (non tranchées)

- **Pas d'identité de jeu partagée.** Chaque Jeu appartient à une Ludothèque ; le regroupement « même jeu » (FR-6, FR-8) se fait par nom normalisé (casse, accents, espaces). Éviter une table de jeux globale, qui ramènerait un catalogue.
- **Jeux sur place calculés, pas copiés.** Jeux de l'hôte − écartés + Apports des inscrits, calculés à la lecture ; seuls les écartés, les Apports et les Envies sont stockés par soirée. *Tranché à l'architecture le 2026-10-29 (AD-5) : une soirée passée, terminée ou annulée n'affiche pas ses jeux ; aucun instantané.*
- **Compteur d'hôte** : dérivable de l'hôte immuable de chaque événement (déjà stocké, `group-events.service.ts`) ; rien à stocker.
- **Visibilité (FR-9)** : nouvelle règle « partage un groupe ou une soirée isolée » à placer dans le `PermissionService` du Palier 10.
