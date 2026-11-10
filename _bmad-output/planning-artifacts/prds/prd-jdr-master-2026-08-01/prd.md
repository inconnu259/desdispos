---
title: "Palier 9 — Refonte UI & lisibilité de l'état"
status: final
created: 2026-08-01
updated: 2026-10-04
---

# PRD — Palier 9 : Refonte UI & lisibilité de l'état

## 0. Objet du document

Ce PRD cadre le Palier 9 de master-jdr. Il décrit **ce qui doit changer et pourquoi**, pas comment le construire — les choix techniques vivent dans `addendum.md` et seront tranchés à l'architecture.

Périmètre : l'application Ryuutama existante, sur desktop **et** mobile. Public : le MJ et ses joueurs, qui sont aujourd'hui les seuls utilisateurs réels.

**Mise à jour du 2026-08-05.** Ce PRD a été révisé après les runs d'architecture et d'UX, qui ont tranché la plupart de ses points ouverts et fait apparaître trois exigences absentes. Les contrats produits par ces runs le complètent et ne sont pas recopiés ici : `architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md` pour les invariants techniques, `ux-designs/ux-jdr-master-2026-08-04/DESIGN.md` et `EXPERIENCE.md` pour l'identité visuelle et le comportement.

**Mise à jour du 2026-08-17 — retour d'usage sur le calendrier.** L'épic 30 a livré ; l'utilisateur l'a utilisé et a rapporté que **le calendrier ne répond toujours pas aux questions qu'on lui pose**. Neuf exigences neuves en découlent (FR-49 → FR-57, §4.7 bis), quatre dérogations serveur (D-15 → D-18) et quatre questions ouvertes (Q-19 → Q-22). Le périmètre est très majoritairement de l'interface ; les quatre dérogations ont été vérifiées dans le code et arbitrées une par une. Ces exigences forment un épic distinct, ordonnancé **juste après l'épic 30** — les épics 31 à 35 existant déjà au backlog, c'est un choix d'ordre, pas de numérotation.

**Mise à jour du 2026-09-21 — retour d'usage sur la création de personnage.** En testant le parcours refondu (story 31.4), l'utilisateur a jugé son *point d'entrée* peu évident : il faut deviner que l'initiale du roster est cliquable. Trois exigences neuves en découlent (FR-58 → FR-60) et deux dérogations serveur (D-19, D-20) ; aucune question ouverte. Le parcours de création lui-même (FR-21) n'est pas touché : seuls changent **où l'on y entre** et **pour quels systèmes de jeu**. Deux épics sont concernés : le 29, rouvert, et le 33. Les arbitrages sont dans `sprint-change-proposal-2026-09-20.md` et ne sont pas recopiés ici.

**Mise à jour du 2026-10-04 — architecture du modèle multi-aventures.** L'architecture de FR-63 est faite (`AD-23`, spine du Palier 9). Un Homme Dragon peut suivre plusieurs aventures ; FR-59 est amendée en conséquence (elle posait « un par aventure »), FR-61 précise sa garde, et une dérogation serveur est inscrite (D-22). Les arbitrages sont dans `sprint-change-proposal-2026-10-04.md` et ne sont pas recopiés ici.

## 1. Contexte & problème

Huit paliers ont produit une application fonctionnellement riche : parties, personnages, scénarios, séances, votes de dates, disponibilités, annonces, export PDF, temps réel. La couverture fonctionnelle n'est pas le problème.

Le problème est apparu en testant l'app sur un vrai téléphone : **elle ne dit pas où on en est.** Les irritants relevés ne sont presque jamais esthétiques. Ce sont des questions sans réponse à l'écran :

- Qu'est-ce que je dois faire sur cette partie ?
- Cette campagne est-elle encore active ou terminée ?
- Ce nom que je lis, c'est le joueur ou son personnage ?
- Ce vote, il porte sur quelles dates ?
- Comment fonctionne la chronologie ?

À cela s'ajoutent des parcours devenus pénibles à l'usage (saisie des disponibilités, création de personnage, Homme Dragon) et une navigation qui impose une distinction MJ/joueur dont presque personne n'a besoin.

## 2. Cadrage directeur

> **« C'est pas moche. J'aime bien la DA de l'app. C'est juste que c'est pas pratique. »**

Cette phrase de l'utilisateur est la ligne éditoriale du palier, et elle a deux conséquences fermes :

1. **La direction artistique existante est validée.** L'univers grimoire/médiéval et la palette restent. On ne repart pas d'une page blanche. Le style sert d'inspiration, pas de contrainte : si une meilleure option apparaît en chemin, elle se discute.
2. **Le sujet est l'utilisabilité et la lisibilité de l'état.** Toute exigence de ce palier doit pouvoir se justifier par « l'utilisateur comprend mieux où il en est » ou « le geste est moins pénible ». Une exigence purement décorative n'a pas sa place ici.

**Critère d'arbitrage** — en cas de doute sur l'inclusion d'une demande : est-ce que ça répond à une des cinq questions du §1, ou est-ce que ça supprime un geste pénible ? Si non, ça sort du palier.

## 3. Principes transverses

Ces règles s'appliquent à **tout** écran refondu dans ce palier.

**P-1 — Jamais la couleur seule.** Toute information encodée par la couleur (rôle MJ/joueur, partie active/terminée, joueur/personnage, état d'une séance) doit être doublée d'**au moins un autre signal** : icône, libellé, **ou traitement typographique** (italique, gras). Exemple retenu : le nom de personnage toujours en italique, quelle que soit sa couleur.

**P-2 — Accessibilité : vigilance, pas conformité.** On conçoit avec le confort au pouce, le texte non tronqué et un contraste tenant sur les trois thèmes. Ce sont des réflexes de conception, **pas des critères d'acceptation chiffrés**. Aucun audit rétroactif de l'existant. Tout irritant constaté à l'usage se traite au cas par cas.

**P-3 — Desktop et mobile à parité.** Aucun des deux n'est un support secondaire. Le mobile est désormais testable sur appareil réel, donc vérifiable.

**P-4 — États vides et erreurs, au cas par cas.** Traités sur les écrans refondus, sans exigence générale. Un message d'erreur ne doit jamais mentir sur la cause (cf. FR-38).

**P-5 — Rien de silencieux côté serveur.** Toute évolution touchant le serveur est listée au §5. Si l'implémentation en révèle une nouvelle, elle est remontée et discutée avant d'être codée — jamais décidée en chemin.

## 4. Exigences fonctionnelles

Neuf regroupements. L'ordre de présentation n'est **pas** un ordre d'exécution : il suit la lecture, du compte vers le contenu. Les seules contraintes de séquence réelles sont :

- **§4.1 avant §4.2 et §4.9** — les préférences (thème, masquage) n'ont nulle part où vivre tant que l'écran de compte n'existe pas.
- **§4.9 en dernier** — on ne peut relire les libellés qu'une fois tous les écrans refondus.
- **La convention de nommage (FR-14) avant les écrans qui l'appliquent** — sinon chaque écran invente la sienne et il faudra tout reprendre.

Le reste peut être ordonné librement au moment de la planification.

### 4.1 Profil, compte & préférences

**Description.** L'application n'a aujourd'hui **aucun écran de profil** — la seule route `profile/` est le calendrier. On ne peut ni changer son mot de passe, ni son pseudo, ni son e-mail depuis l'app. Or ce palier introduit des préférences qui ont besoin d'un endroit où vivre.

#### FR-1 : Écran de compte accessible depuis le menu
L'utilisateur accède à un écran « Compte » depuis le menu principal, regroupant ses préférences et ses informations personnelles.

#### FR-2 : Thème persisté sur le compte
Le thème choisi est enregistré sur le compte et réappliqué automatiquement à la reconnexion, **sur n'importe quel appareil**.
- Avant connexion (écrans d'authentification), un repli local reste nécessaire puisque l'utilisateur n'est pas encore identifié.

#### FR-3 : Préférences d'affichage mémorisées sur le compte
L'utilisateur peut choisir que les parties terminées soient masquées par défaut dans ses listes. Elles restent accessibles à la demande.
- S'appuie sur la clôture explicite définie en FR-44.
- **Le jeu de préférences s'est élargi** à l'issue du run d'UX : s'y ajoutent le **mode d'affichage** et le **tri** par défaut de la liste (FR-45), ainsi que les **couches actives** par défaut du calendrier (FR-46). Toutes suivent l'utilisateur d'un appareil à l'autre, et toutes se règlent depuis l'écran de compte.

#### FR-4 : Nom affiché modifiable, pseudo immuable
L'utilisateur peut choisir un **nom affiché**, initialisé avec son pseudo et librement modifiable. Le **pseudo reste immuable**.
- **Motif :** le pseudo est un identifiant de connexion — l'authentification accepte l'e-mail *ou* le pseudo. Le rendre modifiable reviendrait à laisser changer un élément de connexion, et libérerait un identifiant réutilisable par un tiers.
- Le nom affiché est ce que voient les autres utilisateurs dans l'application.
- Le nom affiché **n'est pas soumis à unicité** : y imposer une contrainte n'aurait pas de sens sur un champ qui n'est pas un identifiant, et créerait des impasses (qui doit céder ? le dernier arrivé est-il bloqué ?).

#### FR-4b : Levée d'ambiguïté entre noms affichés identiques
Lorsqu'un utilisateur porte le même nom affiché qu'un autre membre d'une partie, l'application le signale sans jamais bloquer.
- Le message propose de changer son nom affiché, ou de l'ignorer.
- Ignorer est un choix légitime : le nom du personnage lève l'ambiguïté dans la plupart des écrans (FR-15).
- **Dans les écrans sans personnage** (invitations, gestion des membres, distribution d'XP, disponibilités, auteur d'une annonce), le pseudo est utilisé ou affiché en complément pour distinguer les homonymes.

**Hors périmètre :** un nom affiché différent selon la partie. Écarté — introduirait un quatrième niveau de nom et une règle de priorité à maintenir partout, pour un cas que FR-15 et le recours au pseudo couvrent déjà.

#### FR-5 : Modification de l'e-mail
L'utilisateur peut changer son e-mail.
- Le mot de passe courant doit être saisi explicitement pour valider le changement.
- **Tranché (Q-3 close).** Le changement exige le mot de passe courant, un avis part vers l'ancienne adresse, et il ne prend effet qu'après confirmation par un lien envoyé sur la **nouvelle** adresse. Un **lien de retour arrière valable un mois** part ensuite vers l'ancienne adresse : l'activer restaure l'ancien e-mail, **coupe toutes les sessions actives et impose une réinitialisation du mot de passe** — le scénario qui justifie ce lien suppose un mot de passe déjà compromis.

#### FR-6 : Changement de mot de passe en session
L'utilisateur connecté peut changer son mot de passe en fournissant le mot de passe courant.
- Le mot de passe courant est exigé et vérifié.
- **Tranché (Q-4 close).** Le changement coupe toutes les **autres** sessions actives et conserve la session courante. Écart assumé avec la réinitialisation par e-mail, qui les coupe toutes sans exception : dans un cas quelqu'un vient de prouver qu'il connaît le mot de passe, dans l'autre on répare peut-être une compromission.

> **Note.** FR-4 à FR-6 portent des enjeux de sécurité réels et n'existent pas côté serveur aujourd'hui. Ce regroupement mérite un passage par `/security-review`.

### 4.2 Navigation & liste des parties

**Description.** La bascule globale MJ/Joueur occupe une place disproportionnée, surtout sur mobile, alors que **très peu d'utilisateurs cumulent les deux rôles** — pour la majorité, ce sélecteur ne s'affiche même pas. Et ceux qui les cumulent ne basculent presque jamais en cours de session : on se connecte avec un but précis, lié à une partie.

#### FR-7 : Suppression de la bascule globale MJ/Joueur
La distinction MJ/joueur disparaît de la navigation globale. Toutes les parties de l'utilisateur apparaissent dans une liste unique.

#### FR-8 : Distinction visuelle du rôle par partie
Chaque partie indique immédiatement si l'utilisateur y est MJ ou joueur, selon P-1.

#### FR-9 : Visibilité de la création de partie, et actions par rôle
Créer une partie **reste possible pour tout utilisateur connecté** ; c'est sa *mise en avant* qui dépend du profil d'usage.
- **Aucune restriction n'est ajoutée.** Il n'existe pas de rôle MJ global dans le modèle : `GlobalRole` vaut `USER` ou `ADMIN`, et l'on devient MJ *d'une partie* en la créant. L'entrée de menu vers la création est aujourd'hui ouverte à tous et le reste.
- **Mise en avant conditionnelle :** l'appel à l'action visible (bouton proéminent) n'apparaît que si l'utilisateur est déjà MJ d'au moins une partie. Pour les autres, la création reste accessible via le menu, sans occuper d'espace.
- Les options **d'une partie donnée** continuent de dépendre du rôle sur cette partie — évalué par partie, jamais globalement.
- **Précisé le 2026-09-21 (FR-60).** « Aucune restriction » porte sur **qui** peut créer une partie, et cela ne change pas. FR-60 restreint **le système de jeu** que l'on peut choisir, pas l'utilisateur.

> **Note.** Cette exigence corrige une incohérence existante : l'entrée de menu est ouverte à tous, tandis que le bouton du tableau de bord est masqué hors « mode MJ ». La suppression de la bascule (FR-7) impose de trancher cette règle explicitement.

#### FR-60 : Seuls les systèmes disposant d'un module peuvent être choisis pour une nouvelle partie
Le formulaire de création de partie ne propose que les systèmes de jeu que l'application sait réellement faire jouer, et le serveur refuse les autres avec un message explicite — le formulaire n'est pas la seule barrière.
- **Constat.** Aujourd'hui trois systèmes sur quatre (Draconis, Conte de Minuit, Esteren) sont proposés alors qu'ils n'ont aucun module : seul Ryuutama en a un. Sur une telle partie, la création de personnage échoue et l'utilisateur voit une erreur trompeuse.
- **Une seule source de vérité.** Le formulaire, la validation serveur et les points d'entrée de création (FR-58) lisent le même signal « ce système a un module ». Un système qui reçoit son module devient proposé sans qu'on touche une autre liste.
- **Les parties déjà créées ne sont pas migrées.** Elles restent consultables, inchangées, sans entrée de création de personnage ; le parcours de création y affiche un message explicite (correctif séparé, déjà ouvert).
- **Prérequis serveur :** D-19.

#### FR-10 : Filtres et tris sur la liste des parties
L'utilisateur peut filtrer et trier ses parties.
- **Tranché le 2026-08-05.** Les deux mécanismes ne portent pas sur les mêmes critères : on **filtre** par rôle et par statut (en cours, terminée, pas encore commencée) ; on **trie** par urgence, date, nom, type (one-shot, campagne…) et statut.
- Filtrer par date ou par nom n'a pas de sens à l'échelle visée ; ces critères sont conservés **en tri**, conformément au vocabulaire de tri déjà fixé à l'architecture.

#### FR-11 : Parties favorites
L'utilisateur peut marquer des parties comme favorites ; elles sont mises en avant dans la liste.

#### FR-12 : Signalétique d'état sur les cartes de partie
Chaque partie affiche, d'un coup d'œil, ce qui requiert une action et où elle en est.
- Côté joueur : personnage à créer, date de la prochaine séance si connue, vote en cours, compte-rendu non rédigé sur une partie terminée.
- Côté MJ : Homme Dragon à créer, aucun membre invité, aucun scénario en cours, aucune date, aucun vote, rapport de fin manquant.
- Une partie terminée est visuellement en retrait (dépend de FR-44) ; une partie nouvelle ou requérant une action est mise en avant.

**Exigence non fonctionnelle propre à FR-12.** Ces signaux se calculent pour **chaque** partie de la liste. Ils doivent être obtenus sans multiplier les appels réseau par partie : le projet a déjà connu deux bugs de production causés par ce type de fan-out (rafales de `429`, listes vidées silencieusement). Si la charge le justifie, la solution retenue peut impliquer le serveur — auquel cas elle est remontée avant d'être codée (P-5). **Tranché à l'architecture (Q-11 close)** : un appel unique renvoie une carte de tous les signaux de toutes les parties de l'utilisateur, calculée serveur par requêtes groupées.

#### FR-44 : Clôture explicite d'une partie par le MJ
Le MJ peut déclarer sa partie terminée, et revenir sur cette décision.
- **Motif du choix :** la notion de « partie terminée » n'existait pas dans le modèle. Une dérivation automatique (tous les scénarios clôturés, aucune séance à venir…) a été écartée : elle échapperait au MJ et se tromperait sur une campagne simplement en pause.
- L'état conditionne FR-3 (masquage), FR-10 (filtre par statut) et FR-12 (affichage en retrait).
- Une partie terminée reste consultable ; la clôture est un état d'affichage, pas un archivage ni une suppression.

#### FR-45 : Modes d'affichage de la liste
L'utilisateur choisit la densité d'affichage de ses listes : **grande vignette**, **intermédiaire**, ou **liste compacte** — sur le principe d'un explorateur de fichiers. Le mode retenu et le tri sont mémorisés sur le compte (FR-3).
- **Origine :** exigence issue du run d'UX, absente de la version initiale de ce PRD. Le tri et les filtres, eux, relèvent de FR-10.
- S'applique de la même façon à la liste des parties et à la vue « mes personnages » (FR-16) : même grammaire, même barre de contrôles.
- **Réserve consignée.** Avec 2 à 4 parties simultanées, cet outillage n'a pas d'utilité immédiate ; il en prend à partir d'une quinzaine. La décision de le construire maintenant a été prise en connaissance de cause, contre recommandation, pour ne pas avoir à y revenir.

#### FR-48 : Navigation principale à quatre destinations
La navigation globale est restructurée autour de quatre destinations : **Parties, Personnages, Calendrier, Compte** — en barre basse sur mobile, en barre haute sur desktop.
- Elle absorbe d'un seul mouvement trois besoins : la bascule parties ↔ personnages (FR-16), l'accès à l'écran de compte (FR-1) et le vide laissé par la suppression du sélecteur MJ/joueur (FR-7).
- Le **calendrier cesse d'être une entrée de menu** : avec les couches de FR-46, il devient un écran de consultation courante et non un formulaire ouvert deux fois par mois.
- **Origine :** résolution de Q-8 au run d'UX, d'une portée dépassant la question posée — d'où une exigence à part entière.

#### FR-47 : Identité visuelle d'une partie
Chaque partie porte une identité visuelle qui permet de la reconnaître d'un coup d'œil dans une liste.
- Par défaut, une **bannière générée** à partir de l'identifiant de la partie, déclinée selon le thème actif. Une fois générée, elle est stable dans le temps.
- Le MJ peut lui substituer une **image de couverture** de son choix (D-11) ; la bannière générée sert de repli tant qu'aucune image n'est fournie.
- **Origine :** exigence issue du run d'UX. Elle répond au second manque relevé sur la page d'arrivée — distinguer une partie d'une autre — là où FR-12 traite du premier, savoir ce qui requiert une action.

#### FR-13 : Notification éphémère d'annonce à la connexion
À la connexion, une notification éphémère signale les annonces non encore vues ; elle disparaît une fois l'annonce ouverte.
- La portée et le ciblage des annonces **ne changent pas** : elles restent consultables à leur emplacement actuel.
- L'état « annonce vue » est mémorisé sur le compte, donc valable sur tous les appareils.

### 4.3 Identité : joueur vs personnage

**Description.** L'application affiche tantôt le nom du joueur, tantôt celui du personnage, rarement les deux, et **jamais de façon à savoir lequel on regarde**. C'est l'incohérence la plus transverse relevée.

#### FR-14 : Convention unifiée joueur / personnage
Une convention visuelle unique distingue le nom du joueur de celui du personnage, appliquée partout dans l'application, conformément à P-1.

#### FR-15 : Affichage conjoint là où c'est utile
Les écrans listant des participants affichent joueur **et** personnage lorsque l'information existe.
- Cas concret à corriger : l'onglet Détails › Troupe n'affiche aujourd'hui que les joueurs.
- Là où le personnage n'existe pas ou n'a pas sa place, le pseudo prend le relais en cas d'homonymie (FR-4b).

#### FR-16 : Vue « mes personnages »
L'utilisateur peut consulter la liste de tous ses personnages, avec recherche, dans une **vue distincte** de la liste des parties.
- Les deux listes ne sont **jamais mélangées** : parties et personnages ne cohabitent pas dans une même liste.
- On bascule de l'une à l'autre ; l'entrée par défaut reste la partie.
- **Tranché (Q-8 close).** Ce ne sont plus deux vues entre lesquelles on bascule, mais **deux destinations de la navigation principale** (FR-48).
- **Prérequis :** aucun endpoint ne liste aujourd'hui les personnages d'un utilisateur toutes parties confondues (voir D-10).
- **Amendé le 2026-09-21 (FR-58, FR-59).** « Jamais mélangées » reste vrai **de la liste** : elle ne mêle toujours pas parties et personnages, et ne contient que ceux de l'utilisateur. Deux ajouts l'entourent. La **section de création** de FR-58 est un bloc distinct, placé au-dessus de la liste, qui ne contient aucune carte de personnage. Les **Hommes Dragons** des MJ rejoignent la liste elle-même (FR-59), reconnaissables comme tels.

#### FR-17 : Correction de la pastille de montée de niveau
Sur la fiche de personnage, l'indicateur de montée de niveau disponible retrouve un placement correct, près du nom du personnage.

### 4.4 Fiche & création de personnage

**Description.** La fiche est dense, ses actions secondaires occupent le premier plan sur mobile, et rien n'aide un joueur débutant à comprendre les termes du système — alors que les textes explicatifs ont été seedés au Palier 8 et ne sont exploités nulle part.

#### FR-18 : Actions d'export regroupées
Les boutons d'export PDF ne saturent plus la vue principale de la fiche ; ils sont regroupés dans une entrée dédiée.

#### FR-19 : Aide contextuelle sur les termes de jeu
Les termes, classes, spécialités et options exposent une aide accessible d'un geste, affichant les textes du catalogue seedé au Palier 8.

#### FR-20 : Textes descriptifs consultables sans quitter la fiche
Les éléments dotés d'un texte descriptif (avantages, talents…) sont consultables depuis la fiche, sans navigation ni perte de contexte.
- **Tranché (Q-9 close)** après comparaison de trois formes : une **surface de détail unique**, qui s'ouvre en panneau latéral sur desktop et en feuille montant du bas sur mobile. Le dépliant repéré sur charactersheetonline.com reste un motif autorisé, mais d'exception — texte court, élément qui reste en place — et jamais par défaut.
- **Frontière avec FR-19 :** FR-19 porte sur les termes de règle du catalogue (classes, spécialités, options) ; FR-20 sur les éléments effectivement possédés par le personnage (avantages, talents…). Si une même forme convient aux deux, elle est mutualisée.

#### FR-21 : Refonte du parcours de création de personnage
Le parcours de création est retravaillé pour améliorer sa lisibilité et réduire les gestes inutiles.

#### FR-58 : Un point d'entrée explicite pour créer son personnage
Un joueur qui n'a pas encore de personnage sur une partie voit **où le créer**, sans avoir à le deviner.
- **Sur la partie.** Un bouton explicite « Créer mon personnage » figure sur l'écran de la partie, sur téléphone comme sur ordinateur, sans changer d'onglet ni défiler. Le slot d'initiale du roster garde son comportement, mais n'est plus le seul point d'entrée.
- **Dans « Personnages » (FR-16).** Une section placée au-dessus de la liste propose une entrée par partie où le joueur n'a pas encore de personnage : « Créer un personnage pour *<nom de l'aventure>* ». Elle n'existe pas quand il n'y a rien à proposer — jamais un bloc vide — et l'entrée d'une partie disparaît dès que le personnage est créé.
- **Jamais un refus.** L'entrée n'est offerte que si le joueur n'est pas MJ de la partie, n'y a pas déjà de personnage, que le système de jeu dispose d'un module (FR-60), et que la partie n'est pas terminée (arbitré au run UX du 2026-09-21 : une aventure close n'accueille plus de personnage). Elle ne mène donc jamais à un « vous avez déjà un personnage » ni à une erreur de schéma.
- **Un MJ n'a pas de personnage joueur sur sa partie.** Tranché le 2026-09-20. Son entrée de création est celle de son Homme Dragon (FR-59). Le serveur l'autoriserait techniquement ; c'est un choix produit de ne pas l'exposer.
- **Une seule règle** décide de l'affichage de l'entrée sur la partie comme dans « Personnages » : elle s'écrit une fois.

#### FR-22 : Consultation limitée des fiches des compagnons
Un joueur peut consulter la fiche des autres personnages de sa partie, restreinte aux champs non verrouillés par le MJ (FR-23).
- Par défaut tout est visible **sauf les notes**, qui restent à la discrétion de leur auteur (mécanisme existant, inchangé).

#### FR-23 : Cadenas de visibilité posés par le MJ
Le MJ dispose d'un écran de configuration présentant une fiche type, où il verrouille champ par champ ce que les autres joueurs ne peuvent pas voir.
- La restriction s'applique à la consultation par les autres joueurs, jamais au propriétaire de la fiche ni au MJ.
- Le verrouillage est défini **par partie** et s'applique à tous ses personnages.
- **Tranché (Q-12 close).** L'unité de verrouillage est **déclarée par le schéma du système de jeu**, jamais codée en dur dans l'écran de configuration : chaque clé du schéma de fiche est verrouillable en bloc, et une clé de type objet peut en plus déclarer ses sous-champs verrouillables individuellement. Un système de jeu futur hérite du mécanisme sans qu'on retouche l'écran.
- **Recadrage important.** Ce verrouillage est une **préférence de jeu (anti-spoil), pas un modèle de sécurité** : **rien n'est verrouillé par défaut**, et le MJ ouvre ce qu'il veut fermer. Le filtrage reste serveur pour une raison pratique — un masquage à l'affichage se contourne par les outils du navigateur, il ne protège donc même pas du spoil qui motive la fonctionnalité.
- Le filtrage est appliqué **côté serveur** : un champ verrouillé ne doit jamais transiter dans une réponse d'API, un masquage à l'affichage ne suffit pas.

> **Note.** FR-23 est **le morceau le plus lourd du palier** : c'est un modèle d'autorisation, pas un champ. Si le palier doit être resserré, c'est le premier candidat à sortir.

### 4.5 Homme Dragon

**Description.** La section est rejetée en l'état par l'utilisateur. Elle n'a ni le soin ni la structure des fiches de personnage joueur, alors qu'elle remplit le même office pour le MJ.

*Règles de référence : `docs/dragons.md`. Niveau : l'application compte les scénarios `PASSE` et non les séances jouées du livre (décision du 2026-09-25).*

#### FR-24 : Fiche Homme Dragon au niveau des fiches joueur
La fiche est refondue pour atteindre le même niveau de présentation et de lisibilité que celles des personnages joueurs.

#### FR-25 : Formulaire de création guidé
La création passe par un véritable formulaire, accompagné de textes explicatifs.

#### FR-26 : Souffles disponibles sur la fiche de l'Homme Dragon
Le MJ retrouve sur la fiche les souffles dont **son** Homme Dragon dispose, chacun avec son coût et sa description, pour les utiliser en séance sans rouvrir le livre.
- **Q-13 tranchée le 2026-08-05, corrigée le 2026-09-25.** Les six entrées seedées (`eveil-powers.json`) sont les **éveils**, pas des souffles : la décision du 2026-08-05 les confondait. Les souffles — 9 **communs** en trois familles (temps, destin, aide aux PNJ) et 3 **propres à chaque race** — n'existaient nulle part ; ils sont seedés par la story 33.2 (`souffles.json`). Référence des règles : `docs/dragons.md`.
- **Deux morceaux :** seeder les souffles par race, sur le modèle du catalogue d'artefacts qui porte déjà un identifiant de race ; puis présenter sur la fiche les souffles disponibles pour ce dragon — les communs plus ceux de sa race.
- **Aucun suivi de consommation.** On reste du côté « outil entre les sessions » : rien n'est décompté pendant la séance. La **réserve** de souffles, composée une fois sur la fiche de l'Homme Dragon, est portée par FR-61 (décision du 2026-09-29, révisée le 2026-10-02).

#### FR-27 : Export amélioré
L'export PDF de la fiche Homme Dragon est mis au niveau de celui des fiches de personnage joueur.

#### FR-61 : Réserve de souffles de l'Homme Dragon
Dès le niveau 2, le MJ compose sur la **fiche** de son Homme Dragon la réserve de souffles de celui-ci. Il la compose **une seule fois** : elle est enregistrée automatiquement, mémorisée, et imprimée dans l'export PDF. Il n'y a **qu'une réserve par Homme Dragon** ; aucune réserve n'est attachée à une séance. *(Révisée le 2026-10-02 : la réserve « par séance » et la réserve « par défaut » du 2026-09-29 sont abandonnées.)*
- **Règles :** (niveau − 1) emplacements ; un même souffle commun ou de la race peut occuper plusieurs emplacements ; les souffles du temps n'y entrent jamais ; à partir du niveau 3, au plus **un** souffle d'une autre race, qui n'occupe qu'**un seul** emplacement. Communs et souffles de la race toujours autorisés ; souffles rituels admis au niveau 5, sans compter comme souffle d'une autre race.
- **Aucun décompte :** la réserve est une composition, pas un stock. L'application ne la consomme jamais et n'affiche aucun compteur « utilisé » ou « restant ».
- **Export PDF :** la réserve remplit les cases de souffles du PDF (le nom de chaque souffle, dans l'ordre des emplacements) ; une réserve vide laisse les cases vides, à cocher au crayon. Pour exporter sans souffles, le MJ retire les souffles un à un.
- **MJ seul :** la fiche de l'Homme Dragon, son export PDF et donc sa réserve sont réservés au MJ ; un joueur n'y a accès ni dans l'application ni par l'API (décision du 2026-10-02, qui révise la lecture « par tout membre » du Palier 5). Le meneur annonce la réserve en jeu ; s'il veut que quelqu'un d'autre imprime la fiche, il fait l'export PDF et le lui envoie. Le droit de lire et d'écrire la fiche est celui de son **propriétaire** (le MJ qui l'a créée), quelle que soit l'aventure d'où il l'ouvre ; un Homme Dragon qui n'est pas le sien ne se distingue pas d'un Homme Dragon inexistant.
- **Prérequis serveur :** D-21.

#### FR-62 : Capacités de niveau de l'Homme Dragon
La fiche montre les capacités acquises selon le niveau (réserve, souffles multicolores, invitation au voyage, envol du dragon des saisons) avec leur texte ; au niveau 4, le MJ choisit une fois pour toutes un **artefact cadeau** d'une autre race ; au niveau 5, la mère-dragon accède aux **souffles rituels**, traités pour l'instant comme les autres souffles (décision du 2026-09-29).

#### FR-63 : Un Homme Dragon pour plusieurs aventures
Un même Homme Dragon peut suivre plusieurs groupes et plusieurs mondes : son **historique et son niveau cumulent les scénarios `PASSE` de toutes ses aventures**.
- **Associer / dissocier.** Le MJ associe un de ses Hommes Dragons à une aventure Ryuutama dont il est MJ et qui n'en a pas encore, et peut l'en dissocier. Une aventure a au plus un Homme Dragon ; il n'y a pas de remplacement implicite.
- **Rien ne se perd.** Dissocier, supprimer l'aventure ou changer son système de jeu dissocie l'Homme Dragon sans supprimer sa fiche ; le niveau est recalculé, et ce qui dépasse le nouveau niveau (éveils, artefact cadeau, réserve) reste lisible, seuls les nouveaux choix sont refusés. Retirer un souffle de la réserve reste possible à tout niveau.
- **Voyageurs protégés par aventure.** La fiche présente les joueurs de chaque aventure séparément.
- **Données existantes.** Chaque fiche actuelle reste intacte et liée à sa partie.
- **Prérequis serveur :** D-22.

#### FR-59 : Les Hommes Dragons dans « Personnages », avec leur création
Le MJ retrouve ses Hommes Dragons là où les joueurs retrouvent leurs personnages, et peut en créer un depuis la section de création de FR-58.
- **Dans la liste.** Chaque Homme Dragon apparaît **une seule fois**, avec **ses aventures** (éventuellement aucune) ; sa nature (Homme Dragon, et non personnage joueur) se lit sans l'ouvrir, et pas par la couleur seule (P-1). La recherche, le tri et le mode d'affichage s'appliquent à lui comme aux personnages ; son nom suit la convention de FR-14. On y ouvre sa fiche.
- **Dans la section de création.** Une entrée « Créer un Homme Dragon pour *<nom de l'aventure>* » par aventure Ryuutama dont l'utilisateur est MJ et où il n'en a pas encore. Un Homme Dragon peut suivre **plusieurs aventures** (FR-63) : l'entrée n'est donc proposée que pour une aventure qui n'en a pas encore, et un MJ peut avoir plus ou moins d'Hommes Dragons que d'aventures.
- **Jamais chez les joueurs.** L'Homme Dragon du MJ n'apparaît pas dans « Personnages » des autres membres de la partie.
- **Prérequis serveur :** D-20. Les consommateurs existants de la liste des personnages n'en sont pas affectés.
- La fiche Homme Dragon n'a pas de route propre aujourd'hui ; la façon de l'ouvrir depuis « Personnages » relève de la story, pas du PRD.

### 4.6 Vue de partie, scénarios & chronologie

**Description.** La vue d'une partie est jugée fouillis : l'onglet Détails juxtapose la prochaine séance, la distribution d'XP, les fiches à télécharger et les annonces, sans hiérarchie. Scénario et Chronologie génèrent une frustration particulière — « l'information est là sans être là ».

#### FR-28 : Réorganisation de la vue de partie
Le contenu de la vue de partie est réorganisé selon une hiérarchie lisible, en séparant ce qui relève de l'action immédiate, de la consultation et de la référence.

#### FR-29 : Refonte de Scénario & Chronologie
Les vues Scénario et Chronologie sont refondues pour rendre compréhensibles l'enchaînement des scénarios, leur état et leurs séances.
- Le défaut d'affichage de la ligne chronologique signalé le 14/07 (accroches, espacement, dates absentes) est absorbé par cette refonte ; le mockup `DESIGN.md` sert d'inspiration, pas de référence contraignante.

#### FR-30 : Autocomplétion des invitations
Lors de l'invitation d'un joueur, la saisie propose les utilisateurs déjà enregistrés au fil de la frappe.
- **Constat de vérification :** l'endpoint `GET /users/search` existe et est déjà appelé, mais il effectue une **égalité stricte** sur l'e-mail ou le pseudo. Une saisie partielle ne renvoie rien : l'autocomplétion est impossible sans changement serveur (D-8).
- **L'autocomplétion porte sur le pseudo uniquement.** Elle ne recherche pas sur l'e-mail et n'en renvoie aucun. Le pseudo étant unique et immuable (FR-4), il suffit à identifier un utilisateur sans exposer de donnée personnelle.
- L'invitation par e-mail exact reste possible par son chemin actuel, inchangé.
- Garde-fous complémentaires (longueur minimale de saisie, plafond de résultats) à arrêter en Q-14.

#### FR-31 : Place des fonctionnalités récentes dans les écrans refondus
La refonte statue explicitement sur la place des rôles de groupe, de la distribution d'XP, de la gestion des membres et des rappels e-mail dans les écrans qui les hébergent.

### 4.7 Calendrier & votes

**Description.** Le plus gros foyer de frustration. La saisie des disponibilités est pénible, en particulier la sélection de dates sur PC. Et les calendriers ne montrent pas l'information la plus utile : les séances réellement programmées.

#### FR-32 : Saisie des disponibilités repensée
La déclaration de disponibilité et d'indisponibilité est retravaillée pour réduire le nombre de gestes, en traitant spécifiquement la sélection de dates sur desktop.
- **Écriture groupée (D-14).** Une sélection par glissement couvrant plusieurs jours et créneaux part en **un seul appel**, jamais une boucle côté client : sélectionner une semaine entière déclencherait sinon vingt-et-un appels, sous le limiteur de débit qui a déjà causé deux incidents. L'écriture est tout-ou-rien — pas de semaine à moitié déclarée.
- **Amendé le 2026-08-17 (FR-57).** L'usage a montré que la sélection est le geste naturel et que l'échec en bloc sur conflit est un mur. Le « tout-ou-rien » reste vrai de l'**écriture** ; il cesse d'être la réponse au **conflit**, désormais traité par un dialogue.

#### FR-33 : Séances datées visibles dans les calendriers
Les séances dont la date est validée apparaissent dans les calendriers.
- Dans le calendrier personnel : de façon explicite et légendée.
- Dans le calendrier d'une partie : une séance de **cette** partie affiche ses informations ; une séance d'une **autre** partie de l'utilisateur apparaît comme une indisponibilité.
- **Contrainte de sécurité :** seules les séances des parties auxquelles l'utilisateur appartient réellement remontent. Aucune donnée d'une partie tierce ne doit fuiter.

#### FR-34 : Options de vote affichées dans le calendrier
Pendant un vote en cours, les créneaux proposés apparaissent dans le calendrier de la partie.

#### FR-35 : Annulation d'une réponse de vote
Un joueur peut revenir sur sa réponse et la retirer, pas seulement la modifier.

#### FR-36 : Sort de la vue semaine — tranché
**La vue semaine est conservée, mais change de rôle** (Q-6 close). Elle n'était pas utile parce qu'elle faisait le même travail que la vue mois à un autre grossissement ; elle devient l'outil de **saisie en masse** : une sélection par glissement y couvre plusieurs jours et créneaux d'un seul geste, ce qui répond frontalement à FR-32.
- La vue mois conserve un glissement plus grossier, à la journée entière.
- Une troisième vue **Agenda** est ajoutée par FR-46.
- **Élargi le 2026-08-17.** La vue semaine est saisie en masse **et** lecture détaillée : ses cases sont les plus grandes des trois vues, et les laisser porter une simple pastille est le gaspillage le plus visible du calendrier actuel. Q-6 reste close — le rôle s'ajoute, il ne se substitue pas.
- **Révisé le même jour, au run d'UX.** La ligne « la vue mois reçoit un glissement plus grossier, à la journée entière » **ne tient plus**. Elle reposait sur un fait devenu faux : la case du mois est désormais découpée en **trois bandes horizontales pleine largeur** (FR-49), attrapables au doigt, là où les anciens segments faisaient ~15 px. **La vue mois reçoit donc aussi la sélection au créneau**, en plus de la journée entière. Conséquence assumée : la spécialisation de la vue semaine en outil de saisie fine perd sa justification d'origine — **la vue semaine est conservée**, avec pour rôle propre la **lecture détaillée** d'une semaine précise. Les deux gestes existent aux deux endroits, et l'utilisateur n'a plus à changer de vue pour changer de finesse.

#### FR-46 : Couches d'affichage du calendrier
Le calendrier devient une surface unique portant des **couches combinables** que l'utilisateur allume et éteint : ses indisponibilités, ses disponibilités, ses séances confirmées, les votes en cours, les inscriptions ouvertes, et — en contexte de partie — la disponibilité agrégée du groupe.
- **Tranché le 2026-08-05.** La couche « disponibilité du groupe » est accessible à **tous les membres** d'une partie, mais **son contenu dépend du rôle** : le MJ voit la disponibilité **par membre, nommément** ; un joueur voit des **compteurs agrégés sans identité**. Réserver la couche au MJ aurait retiré aux joueurs une lecture agrégée dont ils disposent déjà — les deux vues existent aujourd'hui côté serveur et restent inchangées.
- **Trois présentations des mêmes couches** : Mois, Semaine et Agenda. L'Agenda est la liste chronologique de ce qui est actif.
- **Conséquence sur l'existant :** le panneau « Voir les créneaux calculés », aujourd'hui relégué en bas de page derrière un bouton de défilement, devient une couche affichable dans n'importe laquelle des trois vues.
- Le jeu de couches par défaut est mémorisé sur le compte (FR-3) ; les bascules faites en cours de visite sont temporaires, et un indicateur signale tout écart au défaut avec un moyen de rétablir.
- **Origine :** exigence issue du run d'UX, absente de la version initiale de ce PRD.
- **Risque assumé :** éteindre une couche d'indisponibilité peut faire paraître libre un créneau qui ne l'est pas. L'indicateur d'écart au défaut est la parade retenue ; le risque est inhérent au principe même des couches et n'est pas considéré comme un défaut.
- **Risque restreint le 2026-08-17.** Il ne vaut plus que pour les indisponibilités **déclarées à la main**. Une séance confirmée bloque désormais le créneau quel que soit l'état des couches (FR-50) : éteindre une couche masque un texte, jamais un engagement.
- **Correction du 2026-08-17 — « inscriptions ouvertes » n'aurait jamais dû être une couche.** Une séance à inscription ouverte **n'a pas de date** tant que les inscriptions courent : elle n'a aucune case où se poser dans une grille, et l'interrupteur n'a donc jamais rien produit à l'écran. Elle quitte les filtres de la grille et trouve sa place dans la vue Agenda (FR-56). La **clé de couche reste** dans l'union fermée et dans la préférence de compte : c'est l'interrupteur qui disparaît de l'écran, pas la clé — aucune préférence déjà enregistrée n'est invalidée.

### 4.7 bis — Reprise du 2026-08-17 : lisibilité du calendrier

**Description.** L'épic 30 a livré ce que ce PRD demandait : les couches existent, les séances et les votes remontent, la sélection par glissement fonctionne, la réponse de vote est retirable. À l'usage, l'utilisateur constate que **le calendrier ne répond toujours pas aux questions qu'on lui pose** — les informations sont présentes mais illisibles, hiérarchisées à plat, et plusieurs filtres ne produisent aucune différence visible. Ces exigences ne remplacent pas les précédentes : elles portent la lisibilité que FR-46 supposait acquise. Elles sont regroupées dans un épic distinct, ordonnancé juste après l'épic 30.

**Ligne directrice.** *Le calendrier n'est pas un formulaire qui affiche des données ; c'est la réponse à « qu'est-ce qui m'attend, et suis-je pris ? ».* Toute exigence de cette section se justifie par là.

#### FR-49 : Préséance de l'information dans un créneau
Un créneau n'empile pas les couches actives : il affiche **ce qui compte le plus**, selon un ordre unique et identique dans les trois vues — séance confirmée, puis vote en cours, puis mes disponibilités et indisponibilités, puis la tendance du groupe.
- L'information écartée par la préséance n'est pas perdue : elle reste atteignable au survol, au tap ou dans le détail du créneau.
- **Motif :** l'irritant fondateur de cette reprise. « Quand une séance est confirmée, je me fous d'avoir sur le créneau d'autres informations » — la couche gagnante doit occuper la place, pas la partager.
- La densité s'adapte à la vue : la vue mois arbitre plus durement que la vue semaine, dont les cases sont larges.
- **Précisé le 2026-08-17, au run d'UX. L'unité d'arbitrage est le créneau, jamais la journée.** La case du mois est **découpée en trois bandes horizontales pleine largeur** — matin, après-midi, soir — et la préséance s'applique bande par bande. Une séance du soir occupe la bande du soir ; elle n'efface pas la disponibilité du matin, et rien n'est jamais moyenné entre deux moments d'une même journée. La **position verticale porte le moment**, sans icône ni légende. Un jour dont les trois créneaux portent le même état fusionne ses bandes en une seule.

#### FR-50 : Séance confirmée lisible, et bloquante quoi qu'il arrive
Une séance dont la date est validée se lit **sans effort** sur le créneau : au minimum son titre, et selon la place disponible la partie, le créneau et ses informations pratiques.
- **Elle rend ses participants indisponibles, indépendamment de l'affichage.** Éteindre la couche « mes séances » retire le **texte** du créneau, jamais le fait d'être pris. Cette garantie ne dépend d'aucun réglage.
- **Informations pratiques (D-15).** Une séance porte trois informations facultatives, rédigées par le MJ : une **heure de rendez-vous**, un **lieu**, et une **note libre** — où l'on joue, à quelle heure on se retrouve, quoi apporter. Elles sont séparées pour trois raisons : l'heure peut être saisie par un sélecteur au lieu d'une frappe libre, un champ Lieu vide **rappelle** au MJ de le renseigner, et l'affichage peut **lâcher la note en premier** quand la place manque, en gardant l'heure et le lieu.
  - **Ce n'est toujours pas un modèle d'horaires (amendé le 2026-08-19).** L'heure est une **étiquette**, pas un instant : une chaîne affichée et transmise, que **rien ne parse, ne compare, ne trie ni ne calcule**. Aucune durée, aucun fuseau, **aucun conflit d'agenda calculé à la minute**. L'unité d'arbitrage du calendrier reste le **créneau de journée**, et la chaîne de disponibilité est inchangée. Le lieu reste une chaîne non structurée — ni adresse, ni géocodage.
- **Écriture depuis la chronologie du scénario**, où la séance vit déjà (§4.6) ; **lecture** sur le créneau et dans l'Agenda.
- **Motif :** aujourd'hui une séance confirmée se signale par un point de couleur que l'utilisateur rate systématiquement.

#### FR-51 : État d'un vote lisible dans le calendrier
Pendant un vote en cours, un créneau proposé se distingue au premier coup d'œil, et le calendrier dit **où en est ce vote** : que d'autres l'ont choisi, et si l'option est plutôt favorite ou plutôt délaissée.
- L'utilisateur voit aussi **sa propre réponse**, distinctement du reste.
- La même lecture sert au MJ à **sceller** un créneau : repérer les créneaux qui ne portent que des oui, sans lire une liste.
- **Portée (D-17).** Cette lecture vaut dans le calendrier d'une partie **et** dans le calendrier personnel — c'est là que l'utilisateur découvre qu'un vote l'attend.
- **Motif :** le filtre « votes en cours » existe et ne produit aujourd'hui aucune différence visible.
- **Précisé le 2026-08-17, au run d'UX. La participation est une information distincte de la tendance, et elle doit se voir.** « Une seule personne a voté, elle a dit oui » et « toute la troupe a dit oui » ne doivent pas se ressembler. La représentation retenue fait porter à la **piste entière l'effectif de la troupe** : la portion remplie dit combien ont répondu, les couleurs disent quoi, la portion restante est tramée. Un compteur « 3 / 4 » double la forme partout où la place le permet.

#### FR-52 : Composer un vote depuis le calendrier
Le MJ ouvre un vote en **désignant ses créneaux sur le calendrier**, dans un mode de sélection qui permet d'ajouter et de retirer avant de valider — au lieu de saisir des dates dans un formulaire séparé.
- Il peut de la même façon **ajouter ou retirer des créneaux à un vote déjà ouvert** (D-16).
- Un mode de mise en avant — dit **« Destinée »** — ne laisse à l'écran que ce qui se rapporte au vote en cours, pour choisir sans bruit ; quand plusieurs votes sont ouverts, on passe de l'un à l'autre.
- **Motif :** le panneau « Vote en cours » et la fenêtre de la Destinée présentent aujourd'hui des **listes groupées par jour**, à côté d'un calendrier qui ne les montre pas. Se représenter des dates en liste est un effort mental que la grille supprime.

#### FR-53 : Lisibilité de l'Oracle des créneaux
Le résumé de disponibilité de l'Oracle devient lisible : **le MJ voit ses joueurs un par un, nommément** ; un joueur voit la tendance du groupe.
- Ce partage est **déjà tranché** par FR-46 et **déjà servi** par le serveur, sous deux formes distinctes selon le rôle. Cette exigence ne porte que la **présentation** — aucun changement serveur.
- **Corrigé le 2026-08-17, au run d'UX.** La disponibilité du groupe était rangée au dernier rang de la préséance de FR-49, ce qui la rendait invisible dès qu'un créneau portait autre chose — c'est-à-dire presque toujours. Elle **sort de la préséance** et s'affiche sur un **canal distinct** : une jauge en bord de créneau pour un joueur, une marque par membre pour le MJ, les noms dans le détail. Elle reste ainsi lisible **sous** une séance ou un vote, ce qui était impossible tant qu'elle concourait pour la même place.
- L'Oracle hérite par ailleurs des trois vues, de la préséance (FR-49), de la légende (FR-54) et du même traitement des votes (FR-51) : ce n'est pas un écran à part, c'est le calendrier avec une question en plus.

#### FR-54 : Légende du calendrier
Le calendrier porte une **légende affichable et masquable**, qui explique les codes visuels non évidents.
- **Règle retenue :** un codage courant se passe d'explication — vert et rouge pour disponible et indisponible. Tout le reste en demande une : intensités de vote, tendance du groupe, teintes qui ne portent pas de sens partagé.
- La légende est un **complément**, jamais la condition pour comprendre l'écran.

#### FR-55 : « Qu'est-ce qui m'intéresse » — visibilité par défaut et mémoire de session
La préférence de calendrier cesse d'être une liste de couches techniques et pose la question utile : **qu'est-ce que je veux voir en arrivant sur un calendrier ?** Les choix sont regroupés par intention — mes disponibilités et indisponibilités, les séances confirmées, les votes en cours, la disponibilité du groupe.
- Ce réglage définit l'**état d'arrivée**, jamais un verrou : les filtres de l'écran restent libres à tout moment.
- **Mémoire de session.** Les bascules faites en cours de visite survivent si l'on revient sur **le même** calendrier **dans la même session**. Un rechargement, une déconnexion, ou l'ouverture d'un **autre** calendrier repartent des défauts du compte.
- **Retour dans l'application.** Quitter l'application et y revenir repart également des défauts. Cette garantie est **acquise sans coût** : une mémoire de portée session expire d'elle-même à la fermeture. Elle ne justifie aucun mécanisme de détection dédié — si elle devait en demander un, elle serait abandonnée.

#### FR-56 : La vue Agenda répond à « qu'est-ce qui m'attend »
La vue Agenda cesse d'être une liste de texte que personne n'a envie de lire. Elle devient la vue **de ce qui réclame quelque chose de moi** : mes prochaines séances, les votes auxquels je n'ai pas répondu, et les **inscriptions ouvertes** — qui trouvent enfin leur place, n'ayant pas de date à occuper dans une grille.
- Depuis l'Agenda, une séance s'**ouvre directement**.
- **Sa forme visuelle n'est pas tranchée ici (Q-19).** L'utilisateur soupçonne qu'il lui manque une représentation graphique propre, et non davantage de texte. La décision revient au run d'UX, sur propositions comparées.
- **Si la forme retenue tient, l'Agenda devient la vue par défaut sur mobile**, où les cases des deux autres vues sont trop petites pour porter ce que FR-49 et FR-50 demandent.

#### FR-57 : La sélection devient le geste de déclaration
Déclarer sa disponibilité passe par la **sélection sur la grille**, geste jugé nettement plus naturel que le panneau ouvert créneau par créneau.
- **La portée se choisit après la sélection**, pas avant : après avoir sélectionné plusieurs jours en vue mois, on peut ne déclarer que le soir, ou la journée entière.
- **La vue mois sélectionne aussi au créneau** (précisé le 2026-08-17) : glisser le long d'une bande couvre ce créneau sur les jours traversés, glisser sur le corps de la case couvre les journées entières. Deux gestes, une seule grille — voir FR-36.
- **Le tap reste pleinement fonctionnel** — il devient la sélection d'une seule case, et rejoint le même flux. La garantie de non-régression de FR-32 tient.
- **Le panneau de déclaration ne disparaît pas :** il devient le chemin **avancé**, atteignable depuis la barre de sélection, et reste le seul endroit où se déclare une **contrainte récurrente** — « tous les mardis soir » ne s'exprime pas par un glissement sur des dates.
- **Résolution des conflits (D-18).** Quand la sélection recouvre des créneaux déjà déclarés, l'application **ne refuse plus le lot**. Elle propose **Remplacer**, **Conserver**, ou **Au cas par cas** — cette dernière déroulant les conflits un par un.
  - **Remplacer ne touche que mes propres déclarations.** Une indisponibilité issue d'une séance de partie résiste toujours : me déclarer disponible du 3 au 9 ne me rend pas disponible le 8 si j'y ai une séance. Si cette séance est annulée, la disponibilité revient d'elle-même.
  - Cette garantie est **structurelle et gratuite** : l'indisponibilité dérivée d'une séance n'est pas stockée, elle est calculée à la lecture.

### 4.8 Authentification & entrée dans l'application

**Description.** Quatre écrans d'authentification plus le parcours « rejoindre par lien » forment la première impression, et la porte d'entrée des futurs joueurs. Ils n'ont jamais été retravaillés.

#### FR-37 : Suppression du lien « Créer un compte »
Le lien « Créer un compte » disparaît de la page de connexion.
- **Motif :** l'inscription est ouverte **uniquement sur invitation** (règle métier de la spec §2). Sans jeton, le formulaire ne peut pas aboutir : le lien mène aujourd'hui à une impasse silencieuse.
- La règle métier elle-même n'est pas remise en cause.

#### FR-38 : Messages d'erreur véridiques à la connexion
Un échec de connexion distingue des identifiants invalides d'une indisponibilité du serveur.

#### FR-39 : Afficher / masquer le mot de passe
Les champs de mot de passe permettent d'en révéler le contenu.

#### FR-40 : Mise en forme des écrans d'authentification
Les écrans d'authentification et le parcours d'invitation sont repris (hiérarchie, séparation des actions secondaires, rendu mobile).

### 4.9 Thèmes & textes

**Description.** Ce regroupement vient **en dernier**, délibérément : on ne peut relire les libellés qu'une fois tous les écrans refondus et donc tous les textes connus. La logique des trois thèmes est conservée.

#### FR-41 : Revue complète des textes des trois thèmes
Les textes des trois thèmes sont relus intégralement : cohérence de registre, complétude des clés, élimination des libellés orphelins ou codés en dur.
- La relecture éditoriale est faite par l'utilisateur lui-même.

#### FR-42 : Classement des textes non thématisés
Chaque texte de l'application est statué : relève-t-il du fichier de thème ou non ?
- Les textes **officiels du système de jeu** ne changent pas et restent hors thème.

#### FR-43 : Réorganisation du stockage des thèmes
Les textes de thème sont réorganisés pour être relisibles thème par thème, sur le modèle de fichiers de langue.
- **Complétude des clés (Q-2 close) :** la découpe s'accompagne d'un typage dérivé d'un thème de référence, de sorte qu'une clé absente d'un thème devienne une erreur de compilation — garantie que la structure actuelle n'offrait pas.
- **Renommage du troisième thème.** `medieval-steampunk` devient `atelier-cuivre`, affiché « Atelier Cuivré » : rien dans ce thème ne relève du médiéval, ni sa palette ni son univers. Le renommage se fait **dans cette exigence**, puisque le fichier du thème y est de toute façon recréé — et il emporte une **migration des préférences de thème déjà enregistrées**.

## 5. Dérogations serveur actées

Le principe du palier est de ne pas toucher au serveur. **Vingt-deux cas** sont recensés ici pour qu'aucun ne passe inaperçu (P-5). D-8 à D-10 ont été découvertes lors de la revue du PRD ; **D-11 à D-13 sont issues du run d'UX** et **D-14 de la revue d'architecture**, toutes inscrites le 2026-08-05. **D-15 à D-18 sont issues du retour d'usage du 2026-08-17**, toutes vérifiées dans le code avant inscription et arbitrées une par une avec l'utilisateur. **D-19 et D-20 sont issues du retour d'usage du 2026-09-20**, vérifiées dans le code et arbitrées avec l'utilisateur le jour même. **D-22 est issue de l'architecture du 2026-10-04** (AD-23), vérifiée dans le code.

Une ligne porte une ampleur **nulle à ce stade** — D-12. Elles restent au tableau pour que le sujet demeure visible au découpage en épics, mais **elles ne demandent aucun travail** tant que le constat qui les accompagne tient. Ne pas les implémenter par réflexe de complétude.

| # | Dérogation | FR | Ampleur | Statut |
|---|---|---|---|---|
| D-1 | Préférences de compte (thème, masquage, annonce vue) | FR-2, FR-3, FR-13 | Modérée | ✅ actée |
| D-2 | Gestion de compte : **nom affiché**, e-mail, mot de passe | FR-4 → FR-6 | **Élevée** — endpoints inexistants, enjeux de sécurité | ✅ actée |
| D-3 | Favoris de parties | FR-11 | Faible | ✅ actée |
| D-4 | Filtrage serveur de la visibilité des champs de fiche | FR-23 | **Élevée** — touche tous les chemins de lecture d'une fiche, exports PDF compris | ✅ actée |
| D-5 | Annulation d'une réponse de vote | FR-35 | Faible | ✅ actée |
| D-6 | Exposition cross-partie des séances | FR-33, FR-46 | Modérée — porte une contrainte de sécurité | ✅ actée |
| D-7 | Souffles propres à chaque race de dragon | FR-26 | **Faible** — contenu seedé par le mécanisme de catalogue existant, aucun endpoint nouveau (requalifiée le 2026-08-05, Q-13 tranchée) | ✅ actée | *Corrigée le 2026-09-25 : le catalogue manquant était celui de tous les souffles, communs compris ; porté par un content-type `souffle` distinct des éveils.*
| D-8 | Recherche **partielle sur le pseudo** — l'endpoint actuel ne fait qu'une égalité stricte | FR-30 | Faible — recherche et résultats limités au pseudo, aucun e-mail exposé | ✅ actée |
| D-9 | Clôture explicite d'une partie — état absent du modèle | FR-44, FR-3, FR-10, FR-12 | Modérée — migration + action MJ | ✅ actée |
| D-10 | Liste des personnages de l'utilisateur, toutes parties confondues | FR-16 | Faible — restreinte à ses propres personnages | ✅ actée |
| D-11 | **Image de couverture de partie** téléversée par le MJ, avec repli sur la bannière générée | FR-47 | Modérée — champ, endpoint et stockage, en réutilisant le mécanisme des portraits (upload, recadrage, plafond 5 Mo, nettoyage EXIF) | ✅ actée |
| D-12 | **États dépendants du lecteur** — « Réponds au vote » contre « Vote en cours », et compteur de chronologie différent selon qui regarde | FR-12, FR-29 | **Nulle à ce stade** — vérification faite, `PollOptionDto.votes` porte déjà les `userId` et les brouillons vivent derrière un endpoint séparé : le front résout ces états sans appel supplémentaire. Redeviendrait justifiée si l'on voulait masquer l'identité des autres votants | ⚠️ inscrite pour visibilité |
| D-14 | **Déclaration de disponibilité en masse** — un seul appel portant les N créneaux sélectionnés par glissement, écriture transactionnelle tout-ou-rien | FR-32 | Modérée — endpoint neuf, détection de conflits appliquée au lot | ✅ actée |
| D-13 | **Inscriptions ouvertes exposées au calendrier**, toutes parties confondues | FR-46 | **Modérée** — dans le calendrier d'une partie le besoin est déjà couvert (`GET /parties/:id/scenarios` renvoie les séances avec leur état d'inscription complet), mais la couche vaut aussi dans le **calendrier personnel**, où aucun endpoint agrégé n'existe et où itérer partie par partie serait le fan-out proscrit | ✅ actée |
| D-15 | **Informations pratiques d'une séance** — trois champs facultatifs du MJ : heure de rendez-vous, lieu, note libre *(amendé le 2026-08-19 : un champ unique à l'origine)* | FR-50 | Faible à modérée — trois colonnes nullables, un point d'écriture MJ, les champs ajoutés aux DTO du calendrier. **L'heure est une étiquette, jamais un instant** : chaîne `"HH:MM"` que rien ne parse ni ne compare, aucune durée, aucun fuseau. **La chaîne de disponibilité reste au créneau de journée** | ✅ actée, amendée |
| D-16 | **Modification des options d'un vote ouvert** — ajouter ou retirer un créneau après ouverture | FR-52 | Modérée — endpoint inexistant : les cinq chemins de vote actuels sont créer, voter, retirer sa réponse, sceller, clore. Porte une règle métier à trancher (Q-22) | ✅ actée |
| D-17 | **Tendance de vote dans le calendrier personnel** — `GET /me/calendar` ne renvoie aujourd'hui que les couples date + créneau d'un vote, ni compteurs ni réponse propre | FR-51 | Faible — enrichissement d'un DTO existant, aucune migration. **Sans objet en contexte de partie**, où les votes portent déjà leurs votants nommément | ✅ actée |
| D-18 | **Résolution de conflits sur l'écriture groupée** — Remplacer / Conserver / Au cas par cas appliqués au lot | FR-57, FR-32 | **Élevée** — renverse une décision de l'épic 30 : la route groupée avait été spécifiée pour **échouer en bloc**, avec une garde interdisant explicitement d'y faire passer le panneau de déclaration, faute d'écrasement et de découpe. Elle doit désormais absorber les deux | ✅ actée |

**Précision sur D-2.** Le pseudo étant devenu immuable (FR-4), cette dérogation ne porte **pas** sa modification. Elle couvre l'ajout d'un champ « nom affiché », le changement d'e-mail et le changement de mot de passe en session.

**Ne nécessitent aucun changement serveur**, vérification faite : la liste unifiée des parties (le front appelle conditionnellement les listes par rôle existantes), la création de partie (FR-9 — aucune restriction ajoutée sur **qui** crée, seule la mise en avant change ; le choix du **système de jeu** est en revanche restreint par FR-60, voir D-19), les **modes d'affichage** (FR-45, pur front plus deux préférences de compte déjà prévues par D-1), et la **bannière générée** (FR-47 — calculée à l'affichage à partir de l'identifiant de la partie, rien n'est stocké).
| D-19 | **Validation du système de jeu à la création d'une partie** — le serveur refuse un système sans module, avec un message explicite | FR-60 | Faible — validation d'entrée seule, aucune migration ; les parties existantes ne sont pas touchées. Des tests utilisent aujourd'hui Draconis comme donnée de départ : à vérifier, pas à présumer | ✅ actée |
| D-20 | **Lecture agrégée des Hommes Dragons de l'utilisateur**, toutes parties confondues | FR-59 | Modérée — aucune migration ; une lecture par utilisateur, jamais une requête par partie (le fan-out proscrit par FR-12). La liste des personnages et son contrat ne changent pas pour leurs consommateurs. Forme (route dédiée ou extension de la lecture existante) laissée à la story | ✅ actée |
| D-21 | **Réserve de souffles** — réserve unique de l'Homme Dragon, portée par sa fiche ; la fiche entière et son export PDF sont réservés au MJ | FR-61 | Modérée — un chemin d'écriture MJ neuf (route dédiée, jamais la modification générale de la fiche), validations de règles côté serveur (capacité, souffles du temps, souffle d'une autre race sur un seul emplacement), **lecture de la fiche et export PDF durcis de « tout membre » à « MJ seul »** (changement de comportement du livré, aucun appelant web non-MJ), pas de lecture fan-out, aucune migration | ✅ actée (2026-09-29, AD-22 ; révisée le 2026-10-02, option B2) |
| D-22 | **Homme Dragon multi-aventures** — colonne `Partie.hommeDragonId`, fiche adressée par son identifiant (`/homme-dragons/:id`, gardée par son propriétaire), association et dissociation par partie, lecture en lot des scénarios `PASSE` de plusieurs parties | FR-63, FR-59, FR-61 | **Élevée** — migration avec rattrapage, **contrat du livré (33.5 à 33.7) cassé volontairement**, toutes les écritures de fiche passent sous verrou (le `PATCH` compris), signal 29.7 recalculé | ✅ actée (2026-10-04, AD-23) |

## 6. Hors périmètre

- **Suivi en jeu** (état, blessures, fiche vivante pendant la session), **y compris la consommation des souffles et des PS de l'Homme Dragon pendant la séance** *(la réserve de souffles, composée une fois sur la fiche, en est sortie le 2026-09-29 : FR-61)*. Reporté après la mise en production à un palier ultérieur : cela change la nature de l'application, qui passerait d'un outil *entre* les sessions à un outil *pendant* la session. La forme souhaitée est déjà connue et volontairement simple — valeurs plafonnées non dépassables, valeur courante librement modifiable.
- **Mode tutoriel / onboarding guidé.** Reporté, à décider avec de vrais retours utilisateurs.
- **Conformité d'accessibilité formelle** (navigation clavier, lecteurs d'écran, audit WCAG AA). Écartée : coût élevé, invérifiable dans le contexte actuel, aucune obligation. Voir P-2.
- **Ouverture de l'inscription libre.** La création de compte reste sur invitation. Remettre cette règle en cause serait un changement métier, pas une refonte d'UI.
- **Refonte de la direction artistique.** La DA est validée (§2).
- ~~**Un même Homme Dragon réutilisé sur plusieurs aventures.**~~ *Planifié le 2026-09-29 : FR-63, story 33.8 ; architecture faite le 2026-10-04 (AD-23).*
- **Modules des systèmes de jeu manquants** (Draconis, Conte de Minuit, Esteren). FR-60 empêche d'y créer une partie ; leur donner un module est un chantier de contenu à part, au backlog.
- **Thème dédié à l'accessibilité.** Le run d'UX a relevé, dans les trois thèmes, des couleurs de statut qui se rapprochent en vision dichromatique. Plutôt que de raboter les trois univers pour un cas aujourd'hui théorique — un seul utilisateur, qui distingue les couleurs —, la réponse retenue est un **quatrième thème** conçu pour cela. Reporté : le mécanisme de thème existe déjà, l'ajout est un travail de contenu, à faire le jour où un joueur concerné rejoint une partie.

## 7. Points ouverts

**Plus aucune question ne bloque le démarrage d'un chantier.** Les runs d'architecture et d'UX ont tranché neuf des quatorze questions initiales, dont Q-12 qui bloquait l'epic §4.4 ; Q-13, dernière bloquante, est tombée le 2026-08-05 lors du découpage en épics. Quatre questions neuves sont apparues en chemin ; aucune n'est bloquante.

**Ajout du 2026-08-17.** Quatre questions ont accompagné le §4.7 bis. **Les quatre ont été tranchées le jour même au run d'UX**, sur planches comparatives — dont Q-19, qui bloquait l'écriture des stories de FR-56. Deux questions neuves, de détail d'implémentation, les remplacent (Q-23, Q-24) : aucune ne bloque. Les décisions vivent dans `ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md` (§4.3 bis, §4.4 bis, §4.4 ter, §4.4 quater, §9) et `DESIGN.md` (§7.9 à §7.11) ; elles ne sont pas recopiées ici.

| # | Question | Quand trancher |
|---|---|---|
| Q-1 | Périmètre de la refonte création/édition de partie — l'utilisateur veut qu'on lui repose la question. **Retenue dans le palier 9** (décision du 2026-08-05) ; portée par la story 29.12 | Au démarrage de la story 29.12 |
| Q-2 | *Close.* Complétude des clés de thème (FR-43) — tranchée : typage dérivé d'un thème de référence, une clé manquante devient une erreur de compilation | — |
| Q-3 | *Close.* Vérification du nouvel e-mail (FR-5) — tranchée : mot de passe courant, avis à l'ancienne adresse, confirmation par lien sur la nouvelle, et lien de retour arrière valable un mois qui **coupe toutes les sessions et force une réinitialisation de mot de passe** | — |
| Q-4 | *Close.* Sessions lors d'un changement de mot de passe (FR-6) — tranchée : les autres sessions tombent, la courante survit | — |
| Q-5 | *Close.* Regroupement des exports (FR-18) — tranché : menu de la fiche. À rouvrir si le journal devient une destination à part entière | — |
| Q-6 | *Close.* Sort de la vue semaine (FR-36) — tranché : conservée et spécialisée en outil de saisie en masse | — |
| Q-7 | *Close.* Homonymie des noms affichés — tranchée : aucune contrainte d'unicité, alerte non bloquante (FR-4, FR-4b) | — |
| Q-8 | *Close.* Bascule parties ↔ personnages (FR-16) — tranchée : ce ne sont plus deux vues à basculer mais deux destinations d'une navigation restructurée, portée par FR-48 | — |
| Q-9 | *Close.* Consultation des textes descriptifs (FR-20) — tranchée : une surface de détail unique, panneau latéral sur desktop et feuille sur mobile | — |
| Q-10 | *Close.* Définition de « partie terminée » — tranchée : champ explicite posé par le MJ (FR-44, D-9) | — |
| Q-11 | *Close.* Signaux d'état de FR-12 — tranché : un appel unique renvoyant la carte des signaux de toutes les parties | — |
| Q-12 | *Close.* Champs verrouillables (FR-23) — tranchée : l'unité de verrouillage est déclarée par le schéma du système de jeu, en bloc par clé, au sous-champ pour les clés qui le déclarent. Recadrage : préférence de jeu, rien de verrouillé par défaut | — |
| Q-13 | *Close, corrigée le 2026-09-25.* Souffles de l'Homme Dragon — les six entrées seedées étaient les **éveils** ; les 21 souffles (9 communs, 12 de race) sont seedés par la 33.2. Réserve : FR-61. Aucun décompte pendant la séance | — |
| Q-14 | Garde-fous de l'autocomplétion (D-8) : longueur minimale de saisie, plafond de résultats | Conception de l'écran d'invitation |
| Q-15 | L'image de couverture (FR-47, D-11) remplace-t-elle la bannière générée dans **tous** les modes d'affichage ou seulement en grande vignette ? Et que devient l'animation du thème lorsqu'une image est fournie ? | Conception de l'écran de partie |
| Q-16 | *Close le 2026-08-05.* Plancher d'accessibilité — formulation **validée par l'utilisateur** : les seuils chiffrés hérités passent de *critère de recette* à *valeur de conception par défaut*, conformément à P-2. Les règles de navigation clavier, d'ordre de focus et d'`aria-label` de la base **restent en vigueur**. Si un besoin réel apparaît, la réponse sera un **quatrième thème dédié**, comme prévu au §6 — jamais un rabotage des trois univers | — |
| Q-17 | Plafond de badges d'état par carte et ordre de priorité entre signaux concurrents (FR-12) — proposés au run d'UX, jamais discutés | Conception de la liste |
| Q-18 | *Close.* Périmètre du renommage de thème — tranché au run d'UX : renommage et migration se font **dans la story FR-43**, puisque le fichier du thème y est de toute façon recréé | — |
| Q-19 | *Close le 2026-08-17, au run d'UX.* Forme de la vue Agenda (FR-56) — tranchée sur planche comparative à trois pistes : **organisation par ce qu'on attend de moi**, trois sections (Ça t'attend · C'est programmé · C'est passé), **aucun jour en en-tête**, la date redevient une propriété de la ligne. Défaut mobile confirmé. Écartée : la piste du ruban calendaire, la plus proche de l'intuition initiale, mais qui réintroduisait un doublon du Mois | — |
| Q-20 | *Close le 2026-08-17, au run d'UX.* Vue Semaine sur mobile — tranchée **après mesure** : la piste « récupérer la gouttière des libellés » ne rend que 2 à 5 px par colonne, très en deçà des ~90 px qu'un titre réclame. Retenu : **une seule grille à sept colonnes, à densité variable** — icônes de créneau, un mot dans la case et un rail de détail sous la grille en portrait ; titre, lieu et heure dans la cellule dès ~500 px, donc en paysage | — |
| Q-21 | *Close le 2026-08-17, au run d'UX.* La **fenêtre de la Destinée devient un mode** du calendrier (estompage de tout ce qui ne relève pas du vote, navigation d'un vote à l'autre) ; le panneau « Vote en cours » **se réduit à « qui manque »** — une information de personnes, sans case où se poser | — |
| Q-22 | *Close le 2026-08-17.* Retrait d'une option de vote ouvert (D-16) — tranché : **permis même si des membres ont voté**, avec **avertissement préalable** nommant le nombre de votants ; les réponses de l'option retirée sont supprimées, celles des autres créneaux intactes | — |
| Q-23 | Le **rail de détail** de la grille Semaine en portrait suit-il la sélection multiple en cours, ou seulement la dernière case touchée ? | Conception de la vue Semaine |
| Q-25 | **Qu'est-ce qu'un vote « mûr »**, dont les options se déplient d'office dans l'Agenda du MJ (FR-56) ? Proposition à confirmer : tout le monde a répondu, **ou** une option réunit la majorité absolue des membres, **ou** l'échéance approche | Conception de l'Agenda, avant les stories |
| Q-24 | Seuil exact de bascule de densité de la grille Semaine (≈ 500 px), à caler sur un téléphone réel en paysage | Implémentation |

## 8. Comment on saura que c'est réussi

Pas de métriques chiffrées — projet personnel, un seul utilisateur réel aujourd'hui. Le palier est réussi si, à l'usage :

- En ouvrant une partie sur son téléphone, l'utilisateur voit **sans chercher** ce qu'il doit y faire.
- Il ne se demande plus si un nom affiché est celui d'un joueur ou d'un personnage.
- Il déclare ses disponibilités sans agacement, sur PC comme sur mobile.
- Il comprend l'état d'un scénario et l'enchaînement d'une chronologie en les regardant.
- Aucune évolution serveur n'a été faite sans avoir été discutée au préalable.
- **Ajouté le 2026-08-17.** En ouvrant son calendrier, il voit sa prochaine séance **sans la chercher** — et il sait, sans cliquer, si un vote l'attend et si un créneau est encore libre. Signal d'échec symétrique : si un filtre reste à l'écran sans produire de différence visible, la reprise a échoué.

- **Ajouté le 2026-09-21.** Un joueur qui rejoint une partie sait **sans deviner** où créer son personnage, et un MJ Ryuutama retrouve ses Hommes Dragons là où il cherche ses personnages. Signal d'échec : si l'on doit encore expliquer que l'initiale du roster est cliquable, ou qu'un bouton de création mène à une erreur, la reprise a échoué.

**Signal d'échec à surveiller :** si la refonte ajoute des écrans et des options sans réduire le nombre de gestes pour les parcours courants (voter une date, déclarer une dispo, retrouver son personnage), le palier aura manqué sa cible — quelle que soit la qualité visuelle du résultat.
