# Epic 38 Context: Tout le monde peut créer, et voir ses ralliements

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

N'importe quel utilisateur connecté (MJ, joueur ou nouvel inscrit) crée une quête de JDR ou un ralliement (rencontre isolée ou groupe) depuis un bouton global de l'en-tête, puis retrouve ses parties dans sa liste d'accueil, reconnaissables à leur pastille et à leur badge de système. Aujourd'hui seul un MJ existant voit le bouton ; l'epic ouvre la création à tous et rend visible la nouvelle famille « ralliement » sans rien enlever au JDR. Les écrans validés modifiés portent ⚠️ (contrat UI : une planche validée fait contrat, toute modification est signalée).

## Stories

- Story 38.1: Créer depuis un bouton d'en-tête, pour tout utilisateur
- Story 38.2: Choisir quête ou ralliement à la création
- Story 38.3: Changer la couverture depuis la bannière
- Story 38.4: Afficher la page d'une partie selon sa famille
- Story 38.5: Reconnaître ses ralliements dans la liste

## Requirements & Constraints

- Le mode (quête/ralliement) se choisit à la création et est définitif : la bascule n'existe pas à l'édition, le serveur refuse tout changement de famille ou de forme d'un ralliement.
- Un ralliement n'a aucune capacité de JDR (pas de livre de règles, scénario, personnage, XP, Homme Dragon, visibilité) : aucune section ni action correspondante à l'écran, et le serveur les refuse.
- Hors JDR, l'interface n'emploie ni « MJ », « campagne », « scénario », « séance », « joueur » ; libellés via le registre de textes, une variante par thème. Les libellés JDR sont inchangés, sauf le sous-titre des tuiles (le nom du système passe dans la pastille). Les e-mails restent neutres de thème.
- Le comportement du JDR reste inchangé ; les onglets du JDR restent les cinq existants.
- Créer un ralliement rafraîchit la liste sans recharger (canal `user:{id}`).
- Aucune dépendance à installer (règle absolue du dépôt).

## Technical Decisions

- Le registre `GAME_SYSTEMS` (`@master-jdr/shared`) est la source unique : `family` (`jdr` | `ralliement`), `capabilities`, `kinds`, `openForCreation`. L'entrée `ralliement` (aucune capacité, kinds `ONE_SHOT` et `CAMPAGNE_EPISODIQUE`) existe déjà fermée à la création (epic 37) ; cet epic l'ouvre. Le mode se dérive de `family`, jamais stocké. Lectures autorisées : `familyOf`, `hasCapability`, `kindsOf`, `isOpenForCreation`. Pas de ligne en table `GameSystem` pour le ralliement.
- Rencontre isolée = partie `ONE_SHOT` avec exactement un `Event` et une séance non datée, sans `Scenario`. Groupe = `CAMPAGNE_EPISODIQUE`. Le `Scenario` n'existe que pour les événements de JDR.
- Migration de cet epic : `Membership.role` (`ADMIN` | `MEMBER`, défaut `MEMBER`, union fermée `MembershipRole` partagée). Le créateur d'un ralliement reçoit un `Membership` `ADMIN` dans la même transaction que la création ; `membersOf` ne compte alors pas deux fois le créateur. Migrations via `pnpm exec prisma` dans le conteneur.
- `PermissionService` est le seul décideur de droits ; la politique `ralliement` couvre « voir » et « modifier la partie », avec un test de refus par cellule actions × rôles × familles. `rolesOf(userId, partieIds)` en lot renvoie `mj | player | admin | member` pour toute la liste ; jamais d'appel par partie. Aucun code hors `permissions/` ne lit `ownerId` pour un droit.
- `GET /me/party-signals` n'émet aucun code de couche 3 (personnage à créer, scénario, compte-rendu…) pour un ralliement.
- Le statut de partie (`A_VENIR | EN_COURS | TERMINEE | ANNULEE`) est calculé côté serveur par une fonction unique ; le front ne le dérive pas.
- Web : une seule page de partie, onglets déduits de `family` + `kind` via le registre ; un ralliement n'affiche que « Détails » et « Missives » dans cet epic (onglets de conjonctions : epics 39 et 41). Upload de couverture via l'utilitaire existant.
- Projection explicite vers les DTO (jamais d'objet Prisma brut) ; mutations en couche Service ; `emit` hors transaction. Tout nouveau composant scopé à une partie ou à l'utilisateur doit être évalué pour le câblage SSE (`notifyChanged()`, `docs/checklist.md`).

## UX & Interaction Patterns

**Bouton de création (⚠️, global).** Pour tout utilisateur connecté, sur toutes les pages, il quitte le contenu de la page « Parties » (plus de condition `hasMjParties()`) et ouvre `/parties/new`. Bureau : bord droit de la `mat-toolbar` du haut, pilule pleine (rayon bouton) avec libellé de thème + icône. Mobile : à droite du titre de l'en-tête contextuel, icône seule 48 × 40 px (rayon 20 px, glyphe 26 px), zone de toucher d'au moins 44 px de haut, nom accessible = libellé de thème jamais affiché ; le titre n'est jamais raccourci (en cas de gêne, c'est le bouton qui reste en icône). Seuils mesurés : le libellé complet exige 399 px (grimoire), 422 px (atelier), 437 px (forêt) ; icône seule sous 440 px, libellé au-dessus ; à revérifier sur téléphone réel. Libellé par thème : Grimoire Émeraude « Lancer une quête », Forêt Ancienne « Ouvrir un sentier », Atelier Cuivré « Initier une mission » (identique en mode ralliement). Icône : d20 du logo traversé d'un crayon en bas à droite (trou découpé autour du crayon), contour 2 px, SVG `currentColor`, sans masque ni identifiant, lisible à 24 px, jamais rognée dans un cercle ; remplace le « + » générique (interdit). Source : `ux-designs/ux-jdr-master-2026-10-08/mockups/icone-B-de-crayon.svg`.

**Formulaire (⚠️).** Ordre fixe : couverture, nom, bascule, champs du mode, description (toujours dernière). Bascule : `mat-button-toggle-group` à deux options, une active, hauteur min 44 px, directement après le nom, ralliement à gauche et quête à droite ; groupe nommé annoncé (`aria-pressed` ou radiogroup) ; changer d'option reconfigure les champs suivants sans effacer nom ni description ; absente à l'édition. Libellés de bascule (ralliement | quête) : Grimoire « Ralliement | Quête », Forêt « Veillée | Sentier », Atelier « Rassemblement | Mission ». Mode Quête : « Livre de règles » puis « Nature de la quête » (comportement actuel). Mode Ralliement : seulement « Nature du ralliement » (pas de livre de règles), deux types : isolé = Grimoire « La conjonction des Esprits », Forêt « La halte au gué » (provisoire), Atelier « La réunion d'établi » ; durable = Grimoire « La convergence des Sortilèges », Forêt « La grande transhumance », Atelier « Le grand chantier ». Libellés de champs du mode ralliement : Grimoire « Nature du ralliement » et « Nom du ralliement » (arrêtés) ; Forêt « Nature de la veillée » et « Nom de la veillée », Atelier « Régime du rassemblement » et « Nom du rassemblement » (hypothèses non validées).

**Open items 3 et 4 (à proposer au début de 38.2 et à relire avec l'utilisateur, non arrêtés par l'UX).** (3) Le libellé final du bouton de validation du formulaire en mode ralliement n'est pas décidé (le bouton de création de l'en-tête, lui, ne change pas). (4) Les libellés de champs des thèmes forêt et atelier ci-dessus (nature, nom) sont des hypothèses ; « La halte au gué » reste le nom provisoire du type isolé en forêt.

**Couverture (⚠️, 38.3).** Remplace la ligne brute « Enluminer… / Choisir un fichier / Aucun fichier choisi » et la vignette de 40 px par une bannière d'aperçu pleine largeur du formulaire, 170 px de haut, arrondie à 14 px. Puce « Changer » translucide en bas à droite, décalage 12 px, padding 8/15/8/12, pilule 999 px, fond `rgba(8,6,16,.58)`, flou 8 px, bord `rgba(255,255,255,.30)`, texte 13 px/500, crayon 16 px ; l'`<input type=file>` natif est masqué sous la puce et jamais visible. Seconde puce « Retirer » à côté si une image personnelle existe. Sans image, l'aperçu est la bannière générée.

**Tuiles et filtres de la liste (⚠️, 38.5).** Pastille texte du système (« Ryuutama », « Draconis », « Ralliement ») : 11 px, bord `rgba(255,255,255,.40)`, pilule, padding 1/8 px, après l'indicateur de rôle ; informative, non interactive. Badge rond du système au coin bas-droit de la vignette : 26 px, glyphe 19 px (jamais en dessous), fond `primary-bg`, bord `rgba(255,255,255,.28)`, décalage -6/-6 px, `aria-hidden`, SVG `currentColor` sans masque ni identifiant. R1 (Ryuutama) : carte pliée, trajet pointillé et dé ; L1 (Ralliement) : feu de camp, flamme sur deux bûches ; Draconis : pastille seule. Sources : `mockups/badge-R1-…svg`, `mockups/badge-L1-…svg`. Sous-titre de tuile réduit à la nature (« Chronique », « La convergence des Sortilèges »), y compris pour les quêtes. Rôle traduit (JDR Maître/Héros ; ralliement libellés de travail Admin, Membre, Hôte, Invité, variantes par thème non validées). Filtres : « Ranger par », « Genre » (Tous / Quêtes / Ralliements), « Rang » étendu aux rôles du ralliement, « Phase », plus la case « Grouper par type » (sections Quêtes et Ralliements, décoché = liste unique). Le sous-titre d'en-tête d'un ralliement dit le type (« Ralliement · La convergence des Sortilèges »).

**Accessibilité.** Jamais la couleur seule (badge d'état avec mot) ; cible tactile du bouton mobile 44 px ; bascule annoncée ; contrastes ≥ 4,5:1 ; `prefers-reduced-motion` : aucune animation ajoutée.

## Cross-Story Dependencies

- 38.1 (bouton global) est indépendante du reste ; 38.2 suppose 38.1 (le bouton ouvre `/parties/new`) et pose le socle serveur (ouverture du registre, `Membership.role`, politique `ralliement`) dont dépendent 38.4 et 38.5.
- 38.3 (couverture) porte sur le même formulaire que 38.2 ; 38.4 suppose 38.2 et 38.3 ; 38.5 suppose 38.4 (famille et registre de textes disponibles).
- Dépend de l'epic 37 (socle : `Event`, `ownerId`, registre des capacités, `PermissionService`, ports). Prépare l'epic 39 (vue à onglets du groupe, admins multiples, invitations, départ) et l'epic 40 (conjonctions).
- Hors périmètre ici : annulation, masquage « retirer de ma liste », suppression de compte, rôles par thème validés, refonte du sondage/calendrier (Palier 10.4).
