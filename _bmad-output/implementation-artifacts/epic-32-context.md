# Epic 32 Context: Vue de partie et chronologie

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Le contenu d'une partie cesse d'être un fouillis. L'onglet Détails juxtaposait sans hiérarchie la prochaine séance, la distribution d'XP, les fiches à télécharger et les annonces ; Scénario et Chronologie donnaient le sentiment que « l'information est là sans être là ». Cet épic sépare l'action immédiate, la consultation et la référence, statue explicitement sur la place des fonctionnalités arrivées au fil des paliers (rôles de groupe, XP, gestion des membres, rappels e-mail), rend lisibles d'un coup d'œil les états de scénario et de séance, refond la chronologie pour qu'on y comprenne l'enchaînement des scénarios — sans jamais trahir au joueur l'existence d'un brouillon — et corrige l'autocomplétion des invitations. Critère de réussite : l'utilisateur comprend l'état d'un scénario et l'enchaînement d'une chronologie en les regardant, sans explication.

## Stories

- Story 32.1 : Autocomplétion des invitations
- Story 32.2 : Réorganisation de la vue de partie
- Story 32.3 : États de scénario et de séance
- Story 32.4 : Refonte de la chronologie

## Requirements & Constraints

- La recherche d'utilisateurs pour l'invitation passe d'une égalité stricte à une correspondance partielle **sur le pseudo uniquement** — jamais sur l'e-mail, jamais un e-mail renvoyé dans les résultats. Longueur minimale de saisie et plafond de résultats obligatoires. L'invitation par e-mail exact garde son chemin actuel, inchangé.
- La vue de partie distingue ce qui appelle une action immédiate, ce qui relève de la consultation et ce qui relève de la référence ; sur mobile, ce qui appelle une action est visible sans défilement. Les actions réservées au MJ ne sont jamais proposées à un joueur.
- **Dix états** (quatre de scénario : Brouillon *MJ seul* · À venir · Courant · Passé ; six de séance : À planifier · En vote · Inscriptions ouvertes · Programmée · À débriefer · Jouée) se partagent **quatre teintes seulement**. La couleur ne répond jamais à « qu'est-ce que c'est ? » mais à « est-ce que ça me concerne maintenant ? » ; l'état précis est toujours porté par un libellé.
- Répartition des teintes : *ça t'attend* (À planifier, vote non répondu, À débriefer) · *en cours* (Courant, vote répondu, Inscriptions ouvertes) · *à venir* (À venir, Programmée) · *terminé* (Passé, Jouée).
- **Deux teintes pour un même état sous-jacent exigent deux libellés distincts** : « Réponds au vote » contre « Vote en cours » — la distinction à faire / fait ne repose jamais sur la seule teinte.
- Un scénario brouillon n'est **pas une cinquième couleur** : c'est un traitement de forme (contour tireté), lisible par qui distingue mal les couleurs. Exception de forme : une bande ou pastille de 4 à 8 px ne peut porter ni contour tireté ni nuance — le brouillon y est signalé par son libellé.
- L'imminence d'une séance est une **intensité**, jamais un état ni une teinte supplémentaire : la séance garde la teinte « à venir » et son badge se densifie (contour seul au-delà de 7 jours, badge teinté de 7 à 2 jours, badge plein la veille et le jour même, avec libellé humain — « demain soir », « ce soir »).
- Une séance passée dont le compte-rendu n'est pas rédigé bascule dans la teinte de ce qui réclame une action.
- Chronologie : chaque nœud ancré sur la ligne, dates affichées, espacement lisible ; état et séances d'un scénario lisibles sans l'ouvrir. Côté joueur elle s'arrête au dernier scénario publié — aucun espace vide, aucun nœud fantôme, aucun compteur qui trahisse un brouillon. Le MJ voit son brouillon distinctement marqué ; son compteur d'en-tête diffère légitimement de celui du joueur.
- Le filtrage anti-spoil est une responsabilité du **rendu frontend** et n'est jamais redondant : il n'existe aucun filtrage serveur à invoquer pour le retirer.
- `prefers-reduced-motion` coupe toute animation (badges, compte à rebours) sans qu'aucune information ne disparaisse au repos.

## Technical Decisions

- **États dépendants du lecteur résolus côté client, aucun endpoint dédié (AD-20).** Les écrans qui détiennent déjà la charge utile de la partie — vue de partie, chronologie, fiche de scénario — résolvent l'état localement : `PollOptionDto.votes` porte le `userId` et le `pseudo` de tous les votants, sans filtrage par lecteur. **Frontière contraignante :** la règle ne vaut pas pour la liste des parties, où l'appel par partie est interdit (AD-3) et où l'état reste un code de signal calculé serveur. Un même état sous-jacent n'est jamais exprimé aux deux endroits sous deux noms : si un code de signal serveur existe pour lui, la vue de partie lit ce code plutôt que de le recalculer.
- **Rappel de fait à ne jamais inverser :** `ScenariosService.findAllForPartie` / `GET /parties/:id/scenarios` ne filtre **aucun** statut et renvoie les scénarios `BROUILLON` à tout membre ; `GET /parties/:id/scenarios/drafts` est une vue MJ dédiée, pas un filtre. Le masquage est frontend, par décision explicite du Palier 4.
- **Agrégats dépendants du lecteur.** Tout compteur exposé est calculé sous la même règle de visibilité que la collection qu'il résume, avec le rôle du demandeur en paramètre — jamais dérivé d'un `_count` brut. Un nombre visible sur deux surfaces provient d'une seule source, serveur ou client, jamais des deux.
- **Projection explicite des parties (AD-15)** : aucune donnée de partie n'est renvoyée via l'objet Prisma brut.
- **Recherche partielle sur le pseudo (D-8/FR-30)** : dérogation serveur actée, de faible ampleur. Le câblage front existe déjà ; seuls le comportement de l'endpoint (égalité stricte → correspondance partielle) et l'ergonomie de saisie restent à livrer.
- **Condition de révision nommée (D-12)** : un calcul serveur des états par lecteur ne redeviendrait justifié que si l'on voulait masquer l'identité des autres votants — hors périmètre.
- **Angular Material 22 en theming M3** : l'attribut `color="warn"` n'a aucun effet (supporté en M2 seulement) ; une teinte d'erreur passe par une classe dédiée référençant `--mat-sys-error`.

## UX & Interaction Patterns

- **Badge d'état** : teinte issue de la palette de statut du thème actif, libellé toujours présent. Variante « terminé » : texte en teinte atténuée, jamais dans la teinte du statut (contraste) ; variante « brouillon » : contour tireté, fond transparent. Badge plein (palier imminent) : texte sur la teinte de fond sombre du thème, jamais blanc.
- **Bande d'état** : bande verticale de 4 px sur le bord gauche d'une carte, équivalent exact de la pastille du mode liste — un seul vocabulaire d'état quel que soit le mode d'affichage.
- **Carte de zone (retouche du 2026-09-23)** : patron de carte unique réutilisé par les trois zones Action / Consultation / Référence et par chaque item de flux (entrée d'historique XP, annonce) — liseré gauche 3 px + titre en majuscules dans la teinte du liseré. ⚠️ **Ces trois liserés classent la nature du contenu (agir / consulter / se référer), ils n'introduisent aucune échelle de statut** : ne pas les confondre avec les quatre teintes d'état, et ne pas ajouter de quatrième teinte de liseré. Un seul bouton d'action visible par carte.
- **Aération** : espace vertical net entre le titre d'une zone et son premier bloc ; marge d'environ `2rem` entre zones, plus large qu'entre deux cartes d'une même zone.
- **Barre d'icônes** : actions MJ et actions de pied de carte suivent le même patron — bouton icône **+ libellé** (jamais l'icône seule), alignés en ligne avec retour automatique, 2 à 4 boutons maximum par barre.
- **Puce de téléchargement** : les fiches se présentent en puces compactes en pilule (icône + libellé court) enchaînées en ligne, à la place des boutons pleine largeur empilés.
- **Zones repliables** : les fiches de référence/préparation sont repliées par défaut à chaque affichage de l'onglet, sans mémorisation entre visites. **Ne jamais replier une carte qui appelle une action** — la zone Action reste immédiatement visible.
- **Défilement de page unique (portée globale)** : le défilement interne par défaut des contenus d'onglets Material est neutralisé une seule fois, globalement ; toute page à onglets défile au niveau du corps de page, pour que les boutons de pied de carte restent atteignables. Exception légitime : une surface flottante modale garde son propre défilement interne.
- **Accessibilité** : plan de titres `<h3>` pour un titre de zone, `<h4>` pour un titre de bloc interne ; les items de flux se contentent d'un intitulé en gras. Cibles tactiles ≥ 44×44 px effectifs, y compris en version compacte.
- **Activer une séance ouvre le scénario qui la porte**, jamais un écran de séance — il n'en existe aucun. Le libellé accessible de l'action doit annoncer l'ouverture du scénario.
- La refonte statue par écrit, dans l'écran livré, sur la place de chaque fonctionnalité existante ; aucune ne disparaît sans décision documentée.

## Cross-Story Dependencies

- **Prérequis dur : story 29.0** (palettes de statut des trois thèmes, invariant de palette, couleurs de texte des badges) doit être livrée avant 32.3 — les quatre teintes distinguables par thème sont un prérequis explicite, pas une supposition.
- **32.2 est livrée** : elle pose les trois zones Action / Consultation / Référence et le patron de carte retouché. 32.3 s'insère dans cette structure sans la rejouer.
- **32.4 dépend de 32.3** : la chronologie affiche la signalétique d'états définie par 32.3 ; les deux doivent partager le même composant de badge et le même vocabulaire de libellés, sans réimplémentation locale.
- Le vocabulaire d'états est partagé avec l'épic 29 (liste des parties, pastilles/signaux serveur) et avec le calendrier — un libellé ou un code inventé ici diverge immédiatement de ces surfaces.
- Rappel transverse du dépôt : toute vue affichant des données scopées à une partie (vue de partie, chronologie, liste de séances) doit être évaluée pour un câblage sur le signal `changed`/`notifyChanged()` propagé via `RealtimeService`.
