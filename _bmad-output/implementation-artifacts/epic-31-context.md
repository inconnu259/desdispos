# Epic 31 Context: Fiche de personnage

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Un joueur doit pouvoir lire sa fiche de personnage sans avoir le livre de règles à côté, consulter celles de ses compagnons de partie, et le MJ doit pouvoir décider de ce qui reste caché à ses joueurs (anti-spoil). Les actions secondaires (exports PDF) doivent cesser d'occuper le premier plan de la fiche, en particulier sur mobile. Le catalogue de textes explicatifs déjà seedé au Palier 8 (règles, termes de jeu) doit enfin être exploité dans l'interface.

## Stories

- Story 31.1 : Exports regroupés dans le menu de la fiche
- Story 31.2 : Surface de détail adaptative
- Story 31.3 : Aide contextuelle sur les termes de jeu
- Story 31.4 : Refonte du parcours de création de personnage
- Story 31.5 : Consultation des fiches des compagnons
- Story 31.6 : Cadenas de visibilité — modèle et filtrage serveur
- Story 31.7 : Écran de configuration des cadenas

## Requirements & Constraints

- Les cinq actions d'export PDF (fiche éditable, fiche deux pages, équipement, notes, recadrage du portrait) ne doivent plus saturer la vue principale de la fiche ; elles se regroupent dans une entrée dédiée, sans changer le fichier produit.
- Les éléments à texte descriptif (avantages, talents) et les termes de règle du catalogue (classes, spécialités, options) doivent être consultables sans quitter la fiche ni la faire bouger sous les yeux du lecteur. Les textes proviennent uniquement du catalogue déjà seedé — aucun texte de règle écrit en dur, et l'absence de texte pour un terme donné doit se traduire par l'absence d'aide, jamais par un contenu vide.
- Le parcours de création de personnage doit produire un résultat en tout point équivalent à l'ancien parcours ; seule la lisibilité et l'économie de gestes changent.
- Un joueur peut consulter en lecture seule les fiches des autres personnages de sa partie (jamais celles d'une partie dont il n'est pas membre), restreintes aux champs non verrouillés par le MJ ; les notes personnelles restent régies par leur mécanisme existant, inchangé.
- Le verrouillage de champs est une **préférence de jeu anti-spoil, pas un modèle de sécurité** : rien n'est verrouillé par défaut, et le MJ ouvre ce qu'il veut fermer. Le filtrage doit néanmoins être appliqué **côté serveur** — un masquage au seul affichage se contourne par les outils du navigateur et ne protège donc rien.
- L'unité de verrouillage est déclarée par le schéma du système de jeu (jamais codée en dur dans l'écran de configuration) : chaque clé est verrouillable en bloc, une clé de type objet pouvant en plus déclarer ses sous-champs verrouillables individuellement. Un futur système de jeu hérite du mécanisme sans retouche de l'écran.
- Un champ verrouillé doit être **absent** de la réponse (jamais présent à `null` ou vide), avec en regard la liste de ce qui a été retiré pour distinguer « masqué » de « non renseigné ». Toute valeur calculée dérivant d'un champ verrouillé doit être retirée par le même passage.
- La configuration de visibilité est définie par partie et s'applique à tous ses personnages ; seul le MJ y accède, et elle ne doit jamais être transmise aux joueurs.
- **Story 31.6/31.7 = FR-23**, signalé dans le PRD comme le morceau le plus lourd du palier (modèle d'autorisation, pas un simple champ) et comme premier candidat à sortir si le périmètre de l'épic doit être resserré.

## Technical Decisions

- **Point d'application unique du filtrage** : dans la fonction de sérialisation de fiche (`toDto()` côté service personnage), traversée par toutes les lectures (consultation directe, consultation par partie, et les trois exports PDF) — aucun chemin de lecture ne peut la contourner. Cette fonction reste pure/synchrone (aucun accès base) : le masque lui est **passé en paramètre** par l'appelant, jamais résolu en interne. Le changement de signature se propage à tous les appelants existants ; c'est un coût assumé.
- La propriété qui déclare l'unité verrouillable du schéma est **dédiée** et distincte de la propriété qui décrit déjà les composantes d'une clé (celle-ci a un autre sens et ne doit pas être réutilisée).
- La configuration de visibilité d'une partie ne doit **jamais** apparaître dans la projection de données de partie envoyée aux joueurs ; elle n'est servie que par la lecture dédiée de l'écran de configuration, réservée au MJ.
- **Temps réel** : une mutation de la configuration de visibilité (comme une clôture de partie) émet un événement sur le canal `partie:{id}` en fin de méthode — les écrans déjà connectés à cette partie (fiche, détail) en profitent pour relire les fiches concernées. Un état strictement personnel n'émet, lui, jamais d'événement SSE.
- L'aide contextuelle (termes de jeu et éléments possédés) lit exclusivement le catalogue de contenu déjà seedé au Palier 8 ; elle ne crée aucun nouveau mécanisme de contenu. Le registre de thèmes de l'application reste neutre vis-à-vis du système de jeu : aucun texte de règle n'y entre.
- Les refontes d'écran (regroupement des exports, parcours de création) sont un travail d'UI gouverné par les conventions existantes, sans décision d'architecture dédiée.

## UX & Interaction Patterns

- **Surface de détail unique**, mutualisée entre l'aide contextuelle (termes de règle) et les éléments possédés par le personnage (avantages, talents) : panneau latéral à droite sur desktop (la fiche reste entièrement visible, ne bouge pas), feuille montant du bas sur mobile (se referme d'un geste). Activer un nouvel élément remplace le contenu affiché, sans empiler les panneaux.
- Un dépliant en place (contenu court, élément qui reste statique) reste autorisé mais uniquement comme exception documentée, jamais comme comportement par défaut.
- Les cinq actions d'export vivent dans le menu à trois points de l'en-tête de la fiche — rien à l'écran au repos, aucune navigation supplémentaire ajoutée.

## Cross-Story Dependencies

- Les stories 31.6 (modèle + filtrage serveur) et 31.7 (écran de configuration MJ) forment une paire cohérente et extractible ensemble : 31.7 s'appuie directement sur le mécanisme `lockable` posé par 31.6.
- La story 31.5 (consultation des fiches des compagnons) dépend du filtrage serveur de 31.6 pour restreindre ce qui est réellement montré ; sans 31.6, 31.5 n'a rien à filtrer.
- Les stories 31.2 (surface de détail) et 31.3 (aide contextuelle) partagent le même composant de surface de détail : à construire une fois, réutilisé par les deux.
- La story 31.4 (parcours de création) réutilise la surface de détail livrée par 31.2 pour exposer les textes explicatifs déjà seedés pendant la création.
- Toute mutation de la configuration de visibilité (31.7) doit déclencher le rafraîchissement temps réel des fiches déjà ouvertes sur cette partie, via le canal `partie:{id}` existant.
