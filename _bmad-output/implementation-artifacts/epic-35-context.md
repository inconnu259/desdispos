# Epic 35 Context: Thèmes et textes

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Les trois univers (Grimoire Émeraude, Forêt Ancienne, Atelier Cuivré) retrouvent un registre cohérent d'un écran à l'autre ; chaque texte de l'application est statué comme thématisé ou non ; le stockage des textes de thème devient relisible thème par thème, sur le modèle de fichiers de langue. L'épic vient **en dernier par construction** : on ne relit les libellés qu'une fois tous les écrans refondus, donc tous les textes connus. Il porte aussi le renommage du thème `medieval-steampunk` en `atelier-cuivre` (affiché « Atelier Cuivré »), avec la migration des valeurs déjà enregistrées.

## Stories

- Story 35.1 : Découpe des thèmes et renommage
- Story 35.2 : Classement des textes non thématisés
- Story 35.3 : Revue éditoriale des trois thèmes

## Requirements & Constraints

- Relecture complète des textes des trois thèmes : cohérence de registre, complétude des clés, suppression des libellés orphelins ou codés en dur. La relecture éditoriale est faite par l'utilisateur lui-même.
- Chaque texte affiché est statué : relève du fichier de thème ou non. Les textes **officiels du système de jeu** restent inchangés et hors thème (hors registre).
- Un texte codé en dur qui relève d'un thème rejoint le registre du thème concerné ; un libellé présent mais utilisé nulle part est supprimé.
- Une clé absente d'un thème doit être détectée **à la compilation**, jamais à l'affichage en production.
- Renommage : le thème `atelier-cuivre` remplace `medieval-steampunk` (classe racine, clés, type suivent). Un compte ayant choisi l'ancien thème doit le retrouver : la **migration des valeurs persistées de `User.theme` est dans la même story** que la découpe. Sans elle, le thème est perdu silencieusement.
- Les écrans nouveaux ou refondus par le palier doivent avoir leurs libellés dans les trois thèmes, sans formulation générique par défaut.

## Technical Decisions

- Le registre actuel (`apps/web/src/app/core/theme/tones.ts`, un seul fichier) est découpé en **un fichier par thème** sous `core/theme/tones/` ; un `index.ts` recompose `THEMES`, `THEME_NAMES`, `TONE_MAP`. Le fichier `medieval-steampunk.ts` devient `atelier-cuivre.ts`.
- **`grimoire-emeraude` est le thème de référence** : son objet est la source du type, les deux autres sont typés d'après ses clés. Une clé manquante devient une erreur de compilation. Toute nouvelle clé s'ajoute par le thème de référence d'abord. C'est une garantie nouvelle : le typage actuel `Record<Theme, Record<string, string>>` ne garantit que la présence des trois thèmes, pas des clés.
- Le registre reste **neutre vis-à-vis du système de jeu** : aucun texte de règle Ryuutama n'y entre ; ces textes sont lus depuis le catalogue seedé.
- `User.theme` est une `String?` nullable (`null` = jamais choisi), volontairement pas un enum Prisma : ajouter ou renommer un thème ne doit pas exiger de changement de type, mais le renommage exige une migration de **données** sur les valeurs existantes.
- La liste des thèmes valides est déclarée **une seule fois** dans `@master-jdr/shared` ; la validation API s'y réfère, jamais de seconde liste côté serveur. Importer les valeurs runtime avec `import`, pas `import type`.
- Persistance : le compte est la source de vérité du thème ; `localStorage` (`jdr-theme`) n'est qu'un cache d'amorçage, y compris la valeur éventuellement stockée sous l'ancien nom `medieval-steampunk`. `ThemeToneService` reste seul propriétaire de l'application du thème.
- Conventions du dépôt : commentaires et messages en français ; aucune installation de dépendance ; tout via Docker ; tests (dont un test de parité de clés entre thèmes) exécutés par l'outillage du projet.

## UX & Interaction Patterns

- Les écrans d'authentification (épic 34) ajoutent des clés de ton à couvrir dans les trois thèmes avec test de parité : `auth.tagline` (accroches par thème), `auth.login_invite_only`, `auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min`. Le nom « Dés Dispos » est constant, non thématisé.
- Les messages d'échec de connexion (`auth.login_*`) tutoient en Forêt Ancienne et vouvoient dans les deux autres thèmes ; un message d'erreur nomme sa cause et ne ment jamais ; un message de validation nomme la règle et la valeur attendue même quand le thème l'habille. La connexion ne distingue jamais « compte inexistant » de « mot de passe incorrect ».
- Les textes des écrans d'authentification hors tableaux (titres, `Lien invalide.`, etc.) sont codés en dur, en tutoiement ou vouvoiement selon l'écran : leur harmonisation est renvoyée explicitement à la revue éditoriale de cet épic. Libellés d'état en mots, pas en codes.
- Contraste noté en Atelier Cuivré : erreur à 4,51:1 (marge nulle) ; ne pas dégrader en retouchant les textes ou couleurs.

## Cross-Story Dependencies

- 35.1 doit précéder 35.2 et 35.3 : le classement et la revue s'appuient sur les fichiers par thème (relecture d'un thème d'un seul tenant).
- 35.2 alimente 35.3 : les textes codés en dur identifiés rejoignent le registre avant la relecture éditoriale.
- 35.3 suppose les écrans refondus par les autres épics livrés (dont les écrans d'authentification de l'épic 34) : l'épic est volontairement le dernier dans l'ordonnancement.
- Migration `User.theme` (35.1) : touche le schéma/données API, le cache local du front et la liste partagée `@master-jdr/shared`.
