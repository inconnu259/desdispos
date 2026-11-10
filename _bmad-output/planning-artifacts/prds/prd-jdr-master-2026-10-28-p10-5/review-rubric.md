# PRD Quality Review — Palier 10.5 : Jeux de société

*Passe menée en ligne par l'agent parent (enjeu privé, PRD court), contre `assets/prd-validation-checklist.md`, le 2026-10-29.*

## Overall verdict
PRD court et cohérent : une thèse claire (savoir ce qui sera sur place), quatre situations concrètes du §1 qui se retrouvent dans les FR, et des non-objectifs qui empêchent la dérive vers un catalogue. Le seul risque réel pour l'aval est le flou sur **qui compte** dans une soirée (inscrit, invité, hôte), qui conditionne « jouable à N », « J'apporte » et la visibilité.

## Decision-readiness — strong
Les choix sont posés comme des décisions (BGG écarté avec sa raison, bibliothèque commune ramenée à une vue, Envie minimale assumée comme sonde). Les questions ouvertes du §8 sont de vraies questions d'UX.

## Substance over theater — strong
Pas de persona, NFR peu nombreux et propres au produit (mode soirée seul, permissions, temps réel). Le NFR « Volume » est le seul à chiffres supposés.

### Findings
- **low** NFR Volume sans mesure (§ NFR) — « restent lisibles et rapides » est un adjectif. *Fix :* acceptable à cet enjeu ; laisser l'architecture fixer un budget si besoin.

## Strategic coherence — strong
Chaque feature répond à une situation du §1 ; SM-2 sert explicitement de garde-fou avant d'étendre l'Envie. Contre-métrique présente (SM-C1).

## Done-ness clarity — adequate

### Findings
- **high** « Participant » non défini (FR-5, FR-6, FR-7, FR-9) — « participant inscrit » n'existe pas pour une soirée isolée (le PRD 10 parle d'invités qui acceptent), et l'on ne sait pas si l'hôte compte dans le N de « jouable à N ». *Fix :* ajouter **Participant** au Glossaire (hôte + invités ayant accepté pour une soirée isolée ; hôte + membres inscrits ou titulaires d'une place réservée pour un événement) et définir N = nombre de Participants.
- **medium** FR-9 mélange deux populations — la visibilité d'une soirée isolée vise tous les invités (répondu ou non), alors que les actions visent les Participants. *Fix :* nommer « personnes invitées » dans FR-9, distinct de Participant.
- **low** SM-1 « habitués » non défini (§7). *Fix :* « membres ayant participé à au moins un événement du groupe ».

## Scope honesty — strong
§5 et §6.2 explicites ; 14 `[ASSUMPTION]` toutes indexées, confirmées par l'utilisateur le 2026-10-29.

## Downstream usability — adequate
Glossaire présent, IDs FR-1→FR-10 / UJ-1→UJ-3 / SM-1→SM-3 contigus. Renvoi au PRD 10 (FR-13) correct.

### Findings
- **low** Casse instable — « jeux sur place » / « Jeux sur place », « jeu » / « Jeu ». *Fix :* majuscule pour l'entité Jeu ; « jeux sur place » en minuscules dans le texte courant, comme terme du Glossaire.

## Shape fit — strong
Produit grand public à petite échelle : trois UJ courtes avec protagonistes nommés, longueur adaptée (~4 pages).

## Mechanical notes
- Assumptions Index : aller-retour complet (14/14).
- §0 en première personne corrigé avant la revue.
