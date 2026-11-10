# Idée forgée — Soirée entre amis (nouveau palier, avant la mise en production)

## Décisions
- **Deux formes** : la *soirée isolée* (ex-one-shot : on invite, on trouve une date, c'est fini, pas de limite d'invités) et le *groupe* (ex-campagnes linéaire + épisodique fusionnées). Le « cas projet d'un hôte » est supprimé : c'est une soirée isolée de plus.
- **Le mode « soirée » est la base, le « mode JDR » en est une spécialisation** qui ajoute les contraintes du MJ. Mode et système de JDR sont deux axes distincts : le système ne vaut qu'en mode JDR.
- **Vocabulaire** : créateur / admin / hôte, plus « MJ » hors JDR. En JDR, le créateur est le MJ et garde ses pouvoirs (seul hôte, crée les scénarios…).
- **Groupe** : le créateur est admin (ajoute et retire des membres). Tout membre peut proposer un événement et en être l'hôte, chez lui. Pas d'« invité d'un soir » : un membre qui veut d'autres personnes crée une soirée isolée.
- **Événement du groupe** : participants au choix (tous, ouvert avec places, ou imposés avec maximum) ; date fixée ou sondage. Cycle : on propose → les intéressés s'inscrivent et donnent leurs dispos → vote → date fixée → inscriptions tardives possibles.
- **En mode soirée, sondage et inscriptions cohabitent** ; la règle « l'un ou l'autre » (AD-4) ne reste qu'en mode JDR.
- **Refactor retenu** (le cœur portera d'autres systèmes de JDR) : à comportement constant, dimensionné sur les deux cas réels, un point unique pour les règles de permission (aujourd'hui `mjId` lu dans 13 services). Aucun changement du JDR existant.
- **Un seul palier avec une porte** : l'épic de refactor passe en premier ; aucune story « soirée » avant que tous les tests passent et que l'interface JDR soit inchangée.

## Périmètre
- **Ce palier** : formes de soirée, inscription libre + sondage + date imposée, admin du groupe, tout membre propose et héberge, renommage des libellés hors JDR.
- **Palier suivant (aussi avant la mise en prod)** : liste de jeux par personne et « j'apporte », historique et équilibre des hôtes, bibliothèque de jeux commune.

## Écarté
- Sondage de dates pour une soirée à places limitées, places attribuées après coup (cas A) : n'arrivera pas.
- Rôle « MJ qui change à chaque événement » : n'existera pas.
- Ajout en parallèle sans toucher à l'existant : écarté au profit du refactor.

## Pourquoi pas Doodle
Version gratuite limitée à 10 choix, pas de sondage sur longue période, dates à saisir à la main, aucune fonction ajoutable. Les dispos persistantes de l'utilisateur sont déjà dans l'app.

## Points faibles à traiter en PRD / architecture
1. `Partie.mjId` est en suppression en cascade : supprimer le créateur supprime le groupe ; pas de transfert d'admin.
2. La matrice des permissions par mode n'est pas écrite.
3. Retrait d'un membre : sort de ses inscriptions et de ses votes.
4. Qui vote au sondage quand l'inscription précède le vote.
5. Migration : toutes les parties existantes passent en mode JDR par défaut.
6. E-mails et rappels du mode soirée non discutés.
