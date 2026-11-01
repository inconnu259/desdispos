# Revue éditoriale — polissage des spines (2026-11-01)

Revue `bmad-review`, lentilles `structure` puis `prose`, appliquée fichier par fichier (DESIGN.md, puis
EXPERIENCE.md). Lecteur visé : humain, non-développeur compris. Guide de style : Microsoft Writing Style Guide,
adapté au français du dépôt (vouvoiement, « inscrit·e »).

Lecture du but : ces deux documents servent à l'équipe (porteur du projet, développeurs, agents de stories)
pour savoir à quoi ressemblent et comment se comportent les Paliers 10.6 à 10.8, sans revenir au PRD ni aux planches.

Modèle de structure retenu : **Référence** (accès direct par section, numérotation §1–§9 citée ailleurs). Le
découpage est sain ; seuls des regroupements internes à une section ont été faits, sans toucher aux numéros.

Contraintes respectées : aucune décision, valeur, token, libellé « … », chemin, lien, identifiant FR/UJ/SM ou
marqueur ⚠️ modifié ; frontmatter YAML inchangé ; ordre des sections de DESIGN.md conforme (Components · Do's and
Don'ts). Contrôle : 2 ⚠️ dans DESIGN.md, 7 dans EXPERIENCE.md, comme avant ; guillemets « » appariés.

## DESIGN.md — 15 changements

Mots : 2 100 avant ; variation négligeable (clarifications compensant les coupes).

### Structure (1)

| Original | Révisé | Motif |
|---|---|---|
| « À surveiller en recette », placé entre « Pourquoi ces choix » et « Libellés de thème » | MOVE en fin de la sous-section Icônes, après le paragraphe des icônes Material | La liste cite des utilitaires (`menu-affichage`, `quitter`, `dispo-non`) avant que les utilitaires ne soient présentés ; elle couvre les deux niveaux, sa place naturelle est à la fin |

### Prose (14)

| Original | Révisé | Motif |
|---|---|---|
| « (`inherits`) … et accueillera le jeu d'icônes du 10.7. Les spines l'emportent sur toute planche. » | « (champ `inherits` de l'en-tête) … et porte le jeu d'icônes du Palier 10.7. En cas d'écart, les spines (ce document et `EXPERIENCE.md`) l'emportent sur toute planche. » | Futur périmé (les icônes sont dans le document) ; « spines » explicité pour un non-développeur |
| « marque l'écriture, comme la sélection de dispos l'est déjà » | « marque l'écriture, comme elle marque déjà la sélection de dispos » | Construction incorrecte (« l'est » sans attribut) |
| « teinte `{colors.status-todo}`, « ça t'attend » » | « teinte `{colors.status-todo}` (« ça t'attend ») » | Le libellé est une connotation de la teinte, pas un élément de liste |
| « choisi … parmi trois : le langage de l'icône de création … Contour 2, détails 1,3 » | « parmi trois styles : il reprend le langage … Trait de 2 au contour et de 1,3 aux détails » | « trois » sans nom ; valeurs d'épaisseur rendues lisibles |
| « favori compté en deux états » | « le favori comptant pour deux : vide et posé » | Explicite le décompte (noms de fichiers `favori-vide` / `favori-pose`) |
| « C'est elle qui fait qu'on reconnaît son thème aux icônes » | « C'est elle qui permet de reconnaître son thème à ses icônes » | Tournure lourde |
| « (le sablier seul en sort) » | « (seul le sablier fait exception) » | Image ambiguë |
| « (à la place de ⚙), aucune autre icône n'en dessine » | « (à la place de ⚙) ; aucune autre icône n'en dessine » | Ponctuation (deux propositions indépendantes) |
| « (c'est pour cela que l'Atelier garde le gant V1 plutôt que l'urne à manivelle) » | « (d'où le gant V1 gardé par l'Atelier plutôt que l'urne à manivelle) » | Resserrement |
| « parce qu'il faisait portefeuille » | « parce qu'il ressemblait à un portefeuille » | Registre trop familier pour un écrit de référence |
| « Libellés de thème » : une seule phrase de cinq lignes | Trois phrases : concept ≠ nom affiché ; source des libellés ; « D'autres exemples figurent sur les planches » | Phrase trop longue ; « Les planches en donnent d'autres » ambigu |
| « passent aux icônes de sens du tableau précédent » | « sont remplacés par les icônes de sens du tableau des familles (plus haut) » | Le tableau qui précède immédiatement est celui des utilitaires : renvoi faux à la lecture |
| « 11 et 12 (Terminée / Annulée) … 14 (iris) … 16 (jetons) » | « Terminée et Annulée (11 et 12) … l'iris de Masquer (14) … les jetons de Distribuer l'XP (16) » | Les numéros ne figurent pas dans le tableau : on nomme le concept, numéros conservés |
| « Do : réserver `{colors.accent-1}` en contour plein au mode déclaration allumé, pour qu'on sache qu'on écrit. » | « Do : réserver le contour plein `{colors.accent-1}` au mode déclaration allumé : il signale qu'on est en train d'écrire. » | Ordre des mots, lisibilité |

## EXPERIENCE.md — 24 changements

Mots : 4 670 avant ; variation négligeable.

### Structure (2)

| Original | Révisé | Motif |
|---|---|---|
| §4.1, puce « Les tons suivent la spec du Palier 10… » placée après « Temps réel » | MOVE juste sous le tableau des valeurs et tons | Elle commente le tableau ; elle était séparée de lui par trois puces |
| §5.3, deux listes à puces séparées par une ligne vide (thèmes/temps réel/vote clôturé, puis plusieurs créneaux/fixer/clôturer/date fixée/disparitions) | MERGE en une seule liste | Coupure sans raison ; même niveau de détail |

### Mise en forme (1)

| Original | Révisé | Motif |
|---|---|---|
| §3.2, « ␣La grille porte un liseré… » (espace en tête) | Espace supprimée | Coquille de mise en page |

### Prose (21)

| Où | Original | Révisé | Motif |
|---|---|---|---|
| Intro | « Il décrit comment fonctionnent, après les Paliers 10.6 à 10.8 (PRD …), la déclaration des dispos, … » | « Il décrit comment fonctionnent la déclaration des dispos, le jeu d'icônes et les pages de JDR après les Paliers 10.6 à 10.8 (PRD …). » | Incise trop longue entre verbe et sujet |
| Intro | « Les spines l'emportent sur toute planche. » | « En cas d'écart, les spines (ce document et `DESIGN.md`) l'emportent sur toute planche. » | Jargon explicité |
| §1 | « **Form-factor** » | « **Supports** » | Français |
| §1 | « **UI system** » | « **Bibliothèque d'interface** » | Français |
| §1 | « n'apparaît qu'en mode déclaration allumé » | « n'apparaît que lorsque le mode déclaration est allumé » | Fluidité |
| §1 | « Deux exceptions … : « Déclarer mes dispos » et le titre … , et les pastilles … » | « … : d'une part … ; d'autre part les pastilles … » | On annonçait deux exceptions et on en lisait trois |
| §3.1 | « Même ligne sur mobile » | « Même ligne sur téléphone » | Terme unique dans tout le document |
| §3.1 | « Libellé identique dans les trois thèmes, volontairement, les dispos n'étant pas thématisées : « Déclarer mes dispos » » | « Libellé « Déclarer mes dispos », volontairement identique dans les trois thèmes puisque les dispos ne sont pas thématisées » | Le libellé arrivait en fin de phrase |
| §3.1 | « l'allumer bascule en vue Mois puis allume le mode » | « le toucher bascule en vue Mois puis allume le mode » | Répétition d'« allumer » |
| §3.3 | « Retirer le dernier créneau sélectionné masque la barre » | « Désélectionner le dernier créneau masque la barre » | Confusion possible avec l'action « Retirer » |
| §3.4 | « … et ouvre l'autre. Et réciproquement. » | « … (la sélection en cours est abandonnée) et ouvre l'outil touché, et réciproquement. » | « l'autre » sans antécédent clair ; phrase nominale isolée |
| §3.5 | « Patron du bandeau fermable déjà employé … » | « Il reprend le patron du bandeau fermable déjà employé … » | Phrase sans verbe |
| §3.5 | « quand c'est le temps qui fait sortir les déclarations de la fenêtre » | « quand les déclarations sortent de la fenêtre par le seul passage du temps » | Tournure lourde |
| §4.1 | « sur une ligne « Ma situation » à gauche, pastille à droite — comme la carte d'événement » | « sur une ligne : « Ma situation » à gauche, la pastille à droite — comme sur la carte d'événement » | Lecture ambiguë |
| §4.1 | « une date fixée par un autre » | « une date fixée par quelqu'un d'autre » | Antécédent manquant |
| §5.1 | « Les séances remontent en tête ; aujourd'hui elles sont en dernier. ⚠️ (…). … aujourd'hui non plus : rien à placer. » | « Les séances remontent en tête, alors qu'elles sont aujourd'hui en dernier ⚠️ (…). … (pas plus qu'aujourd'hui) : rien à placer. » | ⚠️ détaché de sa phrase ; ellipse obscure |
| §5.2 | « Texte + action ; » | « L'encadré associe un texte et une action ; » | Notation télégraphique |
| §5.2 | « « Réinitialiser la date » (dernière ligne, action actuelle de la séance) » | « … (nom générique de l'action de la dernière ligne, qui existe déjà sur la séance) » | Le libellé n'apparaît pas dans le tableau (seulement ses variantes de thème) |
| §5.3 | « Reprend le résumé de la fenêtre d'événement (Palier 10), en lignes : » | « Le résumé reprend celui de la fenêtre d'événement (Palier 10), présenté en lignes : » | Phrase sans sujet |
| §6 | « ce paragraphe fixe le comportement » | « cette section fixe le comportement » | C'est une section entière |
| §6 | « Le verrou et le partage d'une note ne font qu'un sens, qui peut voir » | « Verrouiller une note et la partager relèvent d'un seul et même sens : qui peut la voir » | Syntaxe |

### Laissé volontairement

- Titres de section en anglais (« Foundation », « Key Flows », « Components », « Do's and Don'ts »…) : imposés par
  les gabarits bmad-ux et le format design.md ; numérotation §1–§9 citée ailleurs.
- « mode allumé / éteint », « emphase paire », « rail », « Composer » : vocabulaire établi dans les spines
  précédentes (« emphase paire » = rôle de `accent-1` dans le DESIGN.md de base).
- « idem » (§5.3, joueur → MJ) et « identique » (entre thèmes) : deux sens différents, distinction utile.

## À arbitrer (décisions de contenu, non appliquées)

1. **EXPERIENCE §1 — « Deux exceptions voulues »** : d'autres libellés sont aussi identiques dans les trois thèmes
   (« Ne plus me le rappeler » §3.5, case « Me rappeler de déclarer mes dispos » §3.6, lignes du résumé de vote
   §5.3, « Voter dans le calendrier » / « Fixer la date… » §5.2). Liste à compléter ou formulation à assouplir ?
2. **EXPERIENCE §7, flux de Marc** : « Meilleur créneau : samedi soir — 3 oui » ne reprend pas le libellé fixé en §5.3
   (« Meilleur créneau pour l'instant : … »). Lequel fait foi ?
3. **EXPERIENCE §5.2, ligne « Joueur, inscrit·e »** : « (bouton texte) » n'est précisé que pour Grimoire
   (« Retirer mon nom »). La forme bouton texte vaut-elle aussi pour Forêt et Atelier ?
4. **EXPERIENCE §7, flux de Nina** : « trois soirées et un samedi » donnent « 4 créneaux » ; or un tap sur le numéro
   du jour prend la journée entière (§3.3). Le samedi est-il une seule bande ou la journée ?
5. **DESIGN « Icônes », tableau des familles** : quatre lignes n'indiquent pas le nom de fichier (En cours / À venir,
   Terminée / Annulée, Inviter / Retirer, Nommer admin / Quitter l'office), contrairement aux autres. Ajouter les
   noms tirés de `mockups/icones/icones-retenues.json` ?
6. **DESIGN « Icônes », À surveiller** : les numéros 11, 12, 14, 16 renvoient à une numérotation des planches absente
   du document. Ajouter une colonne n° au tableau, ou retirer les numéros ?
7. **DESIGN frontmatter, commentaire YAML** : « tokens component-scoped » reste en anglais (frontmatter laissé
   intact). À franciser lors d'une prochaine mise à jour ?
