---
id: SPEC-palier9-refonte-ui
companions:
  - '../../planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md'
  - '../../planning-artifacts/prds/prd-jdr-master-2026-08-01/addendum.md'
  - '../../planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md'
  - '../../planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md'
  - '../../planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md'
  - '../../project-context.md'
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# SPEC — Palier 9 : Refonte UI & lisibilité de l'état

## Why

Une **douleur à corriger**, constatée en testant l'application sur un vrai téléphone. Huit paliers ont produit une couverture fonctionnelle riche — parties, personnages, scénarios, séances, votes de dates, disponibilités, annonces, export PDF, temps réel. Ce n'est pas ce qui manque. Ce qui manque, c'est que **l'application ne dit pas où on en est** : que dois-je faire sur cette partie, cette campagne est-elle encore active, ce nom est-il le joueur ou son personnage, ce vote porte sur quelles dates, comment lire la chronologie. S'y ajoutent des parcours devenus pénibles (saisie des disponibilités, création de personnage, Homme Dragon) et une navigation qui impose une distinction MJ/joueur dont presque personne n'a besoin. Affectés : le MJ et ses joueurs — aujourd'hui les seuls utilisateurs réels, sur desktop **et** mobile, ce dernier étant désormais testable sur appareil réel. La direction artistique existante est validée et n'est pas le sujet : la ligne éditoriale du palier tient dans la phrase de l'utilisateur, « c'est pas moche, c'est juste pas pratique ». Toute exigence doit se justifier par « l'utilisateur comprend mieux où il en est » ou « le geste est moins pénible ».

## Capabilities

- **CAP-1 — Écran de compte et préférences qui suivent l'utilisateur**
  - **intent:** L'utilisateur accède depuis la navigation à un écran « Compte » regroupant ses informations et ses préférences ; celles-ci sont enregistrées sur le compte et réappliquées sur n'importe quel appareil — thème, masquage des parties terminées, mode d'affichage et tri des listes, couches actives du calendrier.
  - **success:** Un utilisateur règle son affichage sur PC, se connecte depuis son téléphone, et retrouve exactement le même. Avant connexion, les écrans d'authentification s'affichent dans le dernier thème connu localement, sans clignotement.

- **CAP-2 — Nom affiché modifiable, pseudo immuable**
  - **intent:** L'utilisateur choisit un nom affiché, initialisé à son pseudo et librement modifiable, sans contrainte d'unicité ; le pseudo reste immuable car il sert d'identifiant de connexion. Une homonymie est signalée sans jamais bloquer, et le pseudo prend le relais pour distinguer deux homonymes dans les écrans sans personnage.
  - **success:** Deux membres d'une même partie peuvent porter le même nom affiché ; l'un est averti, choisit de l'ignorer, et reste identifiable dans les invitations, la gestion des membres, la distribution d'XP, les disponibilités et l'auteur d'une annonce.

- **CAP-3 — Changement d'e-mail et de mot de passe depuis l'application**
  - **intent:** L'utilisateur connecté change son e-mail et son mot de passe, dans les deux cas en fournissant son mot de passe courant. Le changement d'e-mail ne prend effet qu'après confirmation sur la nouvelle adresse ; l'ancienne reçoit un avis, puis de quoi revenir en arrière pendant un mois.
  - **success:** Une adresse mal saisie ne prend jamais effet. Le retour arrière restaure l'ancien e-mail, **coupe toutes les sessions et impose une réinitialisation du mot de passe** — l'usurpateur est éjecté, pas seulement contrarié. Un changement de mot de passe en session coupe les autres sessions et conserve celle en cours.

- **CAP-4 — Liste unique des parties, sans bascule de rôle**
  - **intent:** Toutes les parties de l'utilisateur apparaissent dans une liste unique — la bascule globale MJ/joueur disparaît — chaque partie indiquant le rôle qu'il y tient ; la liste se filtre et se trie par rôle, date, nom, type et statut, et les parties favorites sont mises en avant. Créer une partie reste possible pour tout utilisateur connecté ; seule la mise en avant du bouton dépend du fait d'être déjà MJ.
  - **success:** Un utilisateur qui cumule les deux rôles atteint n'importe laquelle de ses parties sans changer de mode. Un joueur qui n'a jamais créé de partie ne voit pas d'appel à l'action pour en créer, mais y accède toujours.

- **CAP-5 — Signalétique d'état des parties et clôture explicite**
  - **intent:** Chaque partie affiche d'un coup d'œil ce qui requiert une action et où elle en est — côté joueur (personnage à créer, prochaine séance, vote en cours, compte-rendu manquant), côté MJ (Homme Dragon à créer, aucun membre, aucun scénario, aucune date, aucun vote, rapport de fin manquant). Le MJ peut déclarer sa partie terminée et revenir sur cette décision ; une partie terminée est visuellement en retrait et reste consultable.
  - **success:** En ouvrant sa liste sur téléphone, l'utilisateur voit sans chercher laquelle de ses parties attend quelque chose de lui. Ces signaux sont obtenus **sans multiplier les appels réseau par partie**, quel que soit le nombre de parties affichées.

- **CAP-6 — Annonces non vues signalées à la connexion**
  - **intent:** À la connexion, une notification éphémère signale les annonces non encore vues et disparaît une fois l'annonce ouverte ; l'état « vue » est mémorisé sur le compte. La portée et l'emplacement des annonces ne changent pas.
  - **success:** Une annonce lue sur téléphone n'est plus signalée à la connexion suivante sur PC.

- **CAP-7 — Convention unifiée joueur / personnage**
  - **intent:** Une convention visuelle unique distingue partout le nom du joueur de celui du personnage, sans reposer sur la couleur seule ; les écrans listant des participants affichent les deux lorsque l'information existe. L'indicateur de montée de niveau retrouve un placement correct près du nom du personnage.
  - **success:** L'utilisateur ne se demande plus si un nom qu'il lit est celui d'un joueur ou d'un personnage, sur n'importe quel écran — y compris ceux qui n'affichent qu'un seul des deux noms. L'onglet Détails › Troupe, qui n'affiche aujourd'hui que les joueurs, montre les deux.

- **CAP-8 — Vue « mes personnages »**
  - **intent:** L'utilisateur consulte, avec recherche, la liste de tous ses personnages toutes parties confondues, dans une vue **distincte** de la liste des parties — les deux ne sont jamais mélangées. On y accède comme à une destination de la navigation (CAP-21), non par une bascule.
  - **success:** Un joueur retrouve un personnage précis sans se rappeler dans quelle partie il l'a créé, et sans jamais voir parties et personnages dans une même liste.

- **CAP-9 — Fiche de personnage lisible et auto-explicative**
  - **intent:** Les actions d'export PDF quittent le premier plan et sont regroupées dans le menu de la fiche ; les termes, classes, spécialités et options exposent d'un geste l'aide déjà seedée au catalogue ; les éléments possédés par le personnage sont consultables sans quitter la fiche, via une surface de détail unique. Le parcours de création est retravaillé pour réduire les gestes inutiles.
  - **success:** Un joueur débutant comprend un terme du système sans quitter sa fiche ni consulter le livre, et la fiche ne se déplace pas sous ses yeux pendant qu'il lit. Sur mobile, la vue principale n'est plus saturée par des actions secondaires.

- **CAP-10 — Consultation des fiches des compagnons, sous cadenas du MJ**
  - **intent:** Un joueur consulte la fiche des autres personnages de sa partie, restreinte à ce que le MJ n'a pas verrouillé ; le MJ dispose d'un écran de configuration où il verrouille ce que les autres joueurs ne voient pas. Le verrouillage vaut pour la partie entière et ne s'applique jamais au propriétaire de la fiche ni au MJ ; les notes restent régies par leur mécanisme existant.
  - **success:** Un champ verrouillé n'apparaît ni à l'écran, ni dans une réponse d'API, ni dans un export PDF demandé par un autre joueur. **Rien n'est verrouillé par défaut** : une partie neuve laisse tout visible tant que le MJ n'a rien fermé.

- **CAP-11 — Homme Dragon au niveau des fiches de personnage joueur**
  - **intent:** La fiche Homme Dragon est refondue pour atteindre le même soin de présentation et de lisibilité que les fiches joueur, sa création passe par un formulaire guidé accompagné de textes explicatifs, et son export PDF est mis au même niveau. La fiche présente les **souffles dont ce dragon dispose** — les communs et ceux propres à sa race — avec leur coût et leur description.
  - **success:** Le MJ ne rejette plus la section : créer et consulter son Homme Dragon se fait avec le même confort que pour un personnage joueur. En séance, il retrouve les souffles de son dragon et ce qu'ils font **sans rouvrir le livre**.

- **CAP-12 — Vue de partie, scénarios et chronologie réorganisés**
  - **intent:** Le contenu de la vue de partie est hiérarchisé en séparant l'action immédiate, la consultation et la référence ; les vues Scénario et Chronologie sont refondues pour rendre lisibles l'enchaînement des scénarios, leur état et leurs séances. La refonte statue explicitement sur la place des rôles de groupe, de la distribution d'XP, de la gestion des membres et des rappels e-mail.
  - **success:** L'utilisateur comprend l'état d'un scénario et l'enchaînement d'une chronologie en les regardant, sans explication. Un joueur ne peut déduire d'aucun indice — espace, compteur, position — qu'un scénario brouillon existe.

- **CAP-13 — Autocomplétion des invitations sur le pseudo**
  - **intent:** Lors de l'invitation d'un joueur, la saisie propose au fil de la frappe les utilisateurs déjà enregistrés, en recherchant **sur le pseudo uniquement** et sans jamais renvoyer d'e-mail. L'invitation par e-mail exact reste possible par son chemin actuel.
  - **success:** Une saisie partielle de pseudo propose les candidats correspondants ; aucune adresse e-mail n'apparaît dans les résultats.

- **CAP-14 — Disponibilités déclarées sans agacement**
  - **intent:** La déclaration de disponibilité et d'indisponibilité est retravaillée pour réduire le nombre de gestes. La vue semaine cesse d'être un doublon de la vue mois : elle devient l'outil de **saisie en masse**, où une sélection par glissement couvre plusieurs jours et créneaux d'un seul geste ; la vue mois conserve un glissement plus grossier, à la journée entière.
  - **success:** L'utilisateur déclare quatre créneaux consécutifs en un geste, là où il fallait quatre allers-retours dans le panneau de déclaration — et ce geste unique ne produit qu'un seul aller-retour réseau, enregistré tout-ou-rien. La saisie case par case reste possible et n'est jamais retirée.

- **CAP-15 — Retrait d'une réponse de vote**
  - **intent:** Un joueur revient sur sa réponse à un vote de date et la retire, pas seulement la modifie.
  - **success:** Après retrait, le joueur est compté comme n'ayant pas répondu, exactement comme avant son premier vote.

- **CAP-16 — Écrans d'authentification et d'entrée repris**
  - **intent:** Les quatre écrans d'authentification et le parcours « rejoindre par lien » sont repris (hiérarchie, séparation des actions secondaires, rendu mobile) ; le lien « Créer un compte » disparaît puisque l'inscription est uniquement sur invitation ; un échec de connexion distingue des identifiants invalides d'une indisponibilité du serveur ; les champs de mot de passe permettent d'en révéler le contenu.
  - **success:** Un utilisateur dont l'API est injoignable lit un message qui le dit, au lieu de « identifiants invalides ». Aucun écran ne mène plus à une impasse silencieuse.

- **CAP-17 — Textes de thème relisibles et complets**
  - **intent:** Les textes des trois thèmes sont relus intégralement (cohérence de registre, complétude, élimination des libellés orphelins ou codés en dur), chaque texte de l'application est statué comme relevant ou non d'un thème, et le stockage est réorganisé pour être relisible thème par thème. Le thème `medieval-steampunk` est renommé `atelier-cuivre` — « Atelier Cuivré » — à cette occasion.
  - **success:** Un thème se relit d'un seul tenant, comme un fichier de langue. **Une clé présente dans un thème et absente d'un autre est détectée avant l'exécution** — elle ne peut plus se découvrir à l'affichage, en production. Les textes officiels du système de jeu restent hors thème, et les préférences de thème déjà enregistrées survivent au renommage.

- **CAP-18 — Modes d'affichage des listes**
  - **intent:** L'utilisateur choisit la densité d'affichage de ses listes — grande vignette, intermédiaire, ou liste compacte — sur le principe d'un explorateur de fichiers. Le mode et le tri retenus sont mémorisés sur le compte, et les mêmes contrôles servent la liste des parties comme la vue « mes personnages ».
  - **success:** Un utilisateur bascule en liste compacte, quitte l'application, revient depuis un autre appareil et retrouve ce mode. Les deux listes se pilotent avec les mêmes gestes — il n'y a qu'une grammaire à apprendre.

- **CAP-19 — Couches d'affichage du calendrier**
  - **intent:** Le calendrier devient une surface unique portant des couches combinables que l'utilisateur allume et éteint : ses indisponibilités, ses disponibilités, ses séances confirmées, les votes en cours, les inscriptions ouvertes, et — pour le MJ, dans une partie — la disponibilité agrégée du groupe. Trois présentations des mêmes couches : Mois, Semaine et Agenda. Le jeu de couches par défaut est mémorisé sur le compte ; les bascules en cours de visite sont temporaires.
  - **success:** Ce qui vivait dans un panneau en bas de page, atteint par un bouton de défilement, s'affiche dans n'importe laquelle des trois vues. Quand l'affichage courant s'écarte du défaut, l'écran le signale et propose de rétablir — un calendrier ne peut pas paraître vide sans qu'on sache pourquoi.

- **CAP-20 — Identité visuelle d'une partie**
  - **intent:** Chaque partie porte une identité visuelle qui permet de la reconnaître d'un coup d'œil : par défaut une bannière générée à partir de son identifiant et déclinée selon le thème actif, à laquelle le MJ peut substituer une image de couverture de son choix.
  - **success:** Une partie donnée présente toujours la même bannière, sur tous les appareils et à toutes les connexions — elle ne change qu'au changement de thème. Aucune partie n'est jamais nue : sans image téléversée, la bannière générée tient le rôle.

- **CAP-21 — Navigation principale à quatre destinations**
  - **intent:** La navigation globale est restructurée autour de quatre destinations — Parties, Personnages, Calendrier, Compte — en barre basse sur mobile et en barre haute sur desktop. Elle absorbe la bascule parties ↔ personnages, l'accès au compte et le vide laissé par la suppression du sélecteur MJ/joueur.
  - **success:** Sur téléphone, atteindre le calendrier ou son compte ne demande plus d'ouvrir un menu ni de remonter en haut de page. Le calendrier cesse d'être une entrée enfouie : c'est une destination.

## Constraints

- **Rien de silencieux côté serveur.** Le principe du palier est de ne pas toucher au serveur ; **quatorze dérogations** sont recensées et actées. Deux portent une ampleur **nulle à ce stade** (souffles et éveils, états dépendants du lecteur) : elles restent inscrites pour rester visibles, mais ne demandent aucun travail tant que le constat qui les accompagne tient — ne pas les implémenter par réflexe de complétude. Toute évolution serveur découverte en cours d'implémentation est **remontée et discutée avant d'être codée**, jamais décidée en chemin.
- **Jamais la couleur seule.** Toute information encodée par la couleur porte au moins un second signal : icône, libellé, ou traitement typographique. Corollaire éprouvé : **deux teintes pour un même état sous-jacent exigent deux libellés distincts.**
- **Accessibilité : vigilance, pas conformité.** Confort au pouce, texte non tronqué, contraste tenant sur les trois thèmes sont des réflexes de conception, **pas des critères d'acceptation chiffrés**. Aucun audit rétroactif, aucun seuil numérique dans une story.
- **États vides et messages d'erreur : au cas par cas**, sur les écrans refondus. Un message d'erreur ne doit jamais mentir sur la cause.
- **Desktop et mobile à parité** — au sens « aucune surface cassée sur l'un des deux », pas « même effort partout » : la cible d'optimisation se décide surface par surface.
- **La direction artistique existante est validée.** L'univers et la palette restent.
- **Critère d'arbitrage d'inclusion.** Une demande entre dans le palier si elle répond à l'une des cinq questions sans réponse du *Why*, ou si elle supprime un geste pénible. Sinon elle en sort.
- **Trois contraintes de séquence, les seules réelles.** CAP-1 avant CAP-4 et CAP-17 — les préférences n'ont nulle part où vivre tant que l'écran de compte n'existe pas. CAP-17 en dernier — on ne relit les libellés qu'une fois tous les écrans refondus. **CAP-7 avant tout écran qui applique la convention joueur/personnage.**
- **Le pseudo est immuable.** Il sert d'identifiant de connexion ; le rendre modifiable libérerait un identifiant réutilisable par un tiers. Le nom affiché n'est soumis à aucune contrainte d'unicité.
- **Le verrouillage de champs est une préférence de jeu (anti-spoil), pas un modèle de sécurité.** Rien n'est verrouillé par défaut. Le filtrage reste serveur pour une raison pratique : un masquage à l'affichage se contourne par les outils du navigateur, il ne protège donc même pas du spoil qui motive la fonctionnalité.
- **Un champ verrouillé ne transite jamais dans une réponse d'API**, y compris sur le chemin d'export PDF.
- **Aucun appel réseau proportionnel au nombre de parties.** Ce motif a déjà causé deux bugs de production.
- **Aucune donnée d'une partie tierce ne remonte à qui n'en est pas membre**, y compris à travers les calendriers.
- **Toute animation est coupée par `prefers-reduced-motion`, et aucune ne porte d'information** : au repos, rien ne manque.
- **Les règles d'architecture et d'interface qui bornent l'implémentation vivent dans les companions** — `ARCHITECTURE-SPINE.md` (AD-1 à AD-15), `DESIGN.md` et `EXPERIENCE.md`. Elles s'imposent aux stories au même titre que les contraintes ci-dessus et ne sont pas recopiées ici.

## Non-goals

- **Suivi en jeu** (état, blessures, fiche vivante pendant la session). Reporté : cela changerait la nature de l'application, qui passerait d'un outil *entre* les sessions à un outil *pendant* la session.
- **Mode tutoriel / onboarding guidé.** Reporté, à décider avec de vrais retours utilisateurs.
- **Conformité d'accessibilité formelle** (navigation clavier exhaustive, lecteurs d'écran, audit WCAG AA) : coût élevé, invérifiable dans le contexte actuel, aucune obligation.
- **Réserve de souffles constituée en début de séance** par l'Homme Dragon : c'est du suivi en jeu, reporté après la mise en production.
- **Thème dédié à la vision dichromatique.** Des rapprochements de couleurs ont été relevés dans les trois thèmes ; la réponse retenue est un **quatrième thème** conçu pour cela, plutôt qu'un rabotage des trois univers existants. Reporté au jour où un joueur concerné rejoint une partie.
- **Ouverture de l'inscription libre.** La création de compte reste sur invitation — règle métier, pas défaut d'interface.
- **Refonte de la direction artistique.**
- **Nom affiché différent selon la partie.** Écarté : quatrième niveau de nom et règle de priorité à maintenir partout.
- **Mise en production, hébergement, déploiement.** Palier 11, y compris la reprise des deux aménagements de développement en vigueur.
- **Contenu homebrew MJ, 2ᵉ système de jeu, carte interactive.** Paliers 12 à 15.

## Success signal

À l'usage, sur son téléphone comme sur son PC : l'utilisateur ouvre une partie et voit **sans chercher** ce qu'il doit y faire ; il ne se demande plus si un nom est celui d'un joueur ou d'un personnage ; il déclare ses disponibilités sans agacement ; il comprend l'état d'un scénario et l'enchaînement d'une chronologie en les regardant. Et aucune évolution serveur n'aura été faite sans avoir été discutée au préalable.

**Signal d'échec à surveiller :** si la refonte ajoute des écrans et des options sans réduire le nombre de gestes des parcours courants (voter une date, déclarer une dispo, retrouver son personnage), le palier a manqué sa cible — quelle que soit la qualité visuelle du résultat.

## Assumptions

- **Pondération d'usage mobile/desktop** — joueur 60-80 % sur téléphone, MJ environ 30 % — estimée par le seul utilisateur réel, sur un test mobile récent et un usage jusqu'ici surtout côté MJ. À re-vérifier à l'usage.
- **Échelle** — 2 à 4 parties simultanées. L'outillage de CAP-18 ne prend son utilité qu'à partir d'une quinzaine ; sa construction immédiate a été décidée en connaissance de cause, contre recommandation, pour ne pas avoir à y revenir.

## Open Questions

- **Q-1 :** quel périmètre pour la refonte de création/édition de partie ? L'utilisateur demande qu'on lui repose la question au démarrage du chantier.
- **Q-14 :** garde-fous de l'autocomplétion — longueur minimale de saisie, plafond de résultats (CAP-13).
- **Q-15 :** l'image de couverture remplace-t-elle la bannière générée dans **tous** les modes d'affichage ou seulement en grande vignette ? Et que devient l'animation du thème lorsqu'une image est fournie (CAP-20) ?
- **Q-16 :** le plancher d'accessibilité hérité passe-t-il de *critère de recette* à *valeur de conception par défaut*, comme le propose le run d'UX ? Formulation à valider avant l'écriture des stories.
- **Q-17 :** plafond de badges d'état par carte et ordre de priorité entre signaux concurrents (CAP-5) — proposés au run d'UX, jamais discutés.
