# Backlog & feuille de route

> Découpage en **paliers** (milestones) livrables. Chaque palier apporte une valeur testable.
> Détail des tâches fines : à ouvrir palier par palier. Voir la vision dans `docs/spec.md`.

---

## 🎯 Principe

On avance par **incréments démontrables**. On valide l'abstraction « plugin système » tôt (palier 2),
puis on enrichit. On garde `docker compose up` fonctionnel **à chaque palier**.

---

## Palier 0 — Socle technique & onboarding *(= 1re itération, « toute première version »)*

But : un squelette qui démarre en une commande, base de la collaboration.

- [x] Monorepo (workspaces pnpm) : `apps/web` (Angular 22), `apps/api` (NestJS 11), `packages/shared`.
- [x] `docker-compose.yml` unique : web + api + Postgres 17 → `docker compose up` (image de dev avec OpenSSL).
- [x] API : `GET /health` ; connexion Postgres OK via Prisma 7 + `@prisma/adapter-pg` (`db push` ; migrations propres au palier 1).
- [x] Web : page d'accueil qui appelle `/health` et affiche « API OK / DB OK ».
- [x] `README.md` (démarrage 1 commande) + `CLAUDE.md` (contexte projet).
- [~] Outillage : Prettier/ESLint fournis par les scaffolds (lint unifié racine à finaliser).

**Done quand** : un dev clone, fait `docker compose up`, ouvre le navigateur → front qui parle à l'API qui parle à la base.

---

## Palier 1 — Comptes, modes & campagnes

- [x] Auth : **session cookie httpOnly** (argon2) ; **inscription sur invitation** ; rôle global **USER/ADMIN**. *(1a)*
- [x] Bascule **mode MJ ↔ mode Joueur** (le mode est dérivé des appartenances). *(1b)*
- [x] N'importe quel user **crée une partie** (one-shot **ou** campagne linéaire) → devient **MJ** dessus. *(1b — l'épisodique viendra avec le mode « agence »)*
- [x] **Invitations** : in-app (recherche email/pseudo, accept/refus) **+ liens** (maxUses, expiration, révocables). *(1c — inscription désormais sur invitation)*
- [x] Tableaux de bord : MJ (mes parties) ✅ / Joueur (mes parties + invitations reçues) ✅ *(1c)*.
- [ ] *(détail complet + état réel : `docs/palier-1.md` §10/§11)*

---

## Palier 2 — Moteur de système + Ryuutama + création de perso

> **Changement de plan (décidé avec l'utilisateur, 2026-07-07)** : système v1 = **Ryuutama**, pas
> Draconis — règles plus simples à modéliser, plus utile pour l'utilisateur dans l'immédiat. Draconis
> et Conte de Minuit sont repoussés plus loin dans la feuille de route (voir plus bas).

- [x] `GameSystemPlugin` + `GameSystemRegistry` (back).
- [x] Module **Ryuutama** : `sheetSchema`, `creationSteps`, `validate(strict)`, `computeDerived`.
- [x] **Back-office de contenu (CRM)** : le contenu (classes, types, catégories d'armes, patterns
      d'attributs) est seedé en **base** au démarrage (`GameSystemService.onApplicationBootstrap` →
      `ContentType`/`ContentEntry`, scope `BASE`) depuis des fichiers JSON **versionnés** (textes reformulés, NFR4 révisée le 2026-09-25)
      (`apps/api/game-systems/ryuutama/data/*.json`) qui ne servent que de source de seed pour
      reconstruire la base proprement — **jamais lus directement par l'UI**, qui passe exclusivement par
      `GET /game-systems/:id/content` (lecture DB). Textes reformulés à partir du livre (mécaniques conservées) :
      c'est ce qui permet de les versionner (NFR4 révisée le 2026-09-25). *(Nuance : `getSchema()` — structure de l'assistant de création, étapes/champs — reste codée
      en dur en TypeScript, pas encore pilotée par le catalogue ; à revoir si besoin lors du Palier 12.)*
- [x] Front : **rendu de fiche** et **assistant de création pas à pas** pilotés par le schéma.
- [x] Créer un personnage (guidé), le **rattacher** à une partie (neuf ou existant compatible).

**Livré** (Épic 4) : un joueur crée un perso Ryuutama guidé par les règles, le voit dans sa partie, et
peut l'exporter en PDF (recoupe une partie du Palier 3).

---

## Palier 3 — Évolution, édition MJ & PDF

- [x] Évolution par **XP** (distribution MJ, montée de niveau guidée joueur). *(Épic 6, stories 6.2/6.3)*
- [x] **Historique / versions** de la fiche (`CharacterSnapshot`, déclencheurs montée de niveau + édition MJ). *(Épic 6, stories 6.3/6.6)*
- [x] **Inventaire / équipements** et **notes personnelles** sur la fiche du joueur. *(Épic 6, stories 6.4/6.5)*
- [x] **Édition MJ** sans contrainte (validation `mode: "mj"` indicative). *(Épic 6, story 6.6 + durcissement revue de code)*
- [x] **Export PDF** de la fiche. *(livré en avance, Épic 4 — portrait inclus)*
- [x] Champs narratifs et arme de prédilection éditables (MJ + propriétaire). *(Épic 6, story 6.7)*

---

## Palier 4 — Sessions, dispos & résumés

- [x] **Sessions** (séances) avec **participants** (sous-ensemble) — gère linéaire **et** épisodique. *(Épic 8)*
- [x] **Calendrier de dispos** + **recherche de date** (meilleur créneau) + **vote de date** entre joueurs. *(Épics 1-3)*
- [x] **Rapports / résumés** de séance, lisibles par tous les membres. *(Épic 8, stories 8.4/8.5)*
- [x] **Événements** + **timeline / historique** de la campagne ; **missions** (= scénarios / quêtes). *(Épic 7)*
- [x] Flux d'**infos/annonces** du MJ. *(Épic 9)*
- [x] **Infra e-mail (SMTP)** + notifications (rappels de séance, invitations par mail) ; débloque le **« mot de passe oublié »** self-service. *(Épic 5)*

---

## Palier 5 — Amélioration du système de jeu (contenu & fiches, propre à Ryuutama mais généralisable)

> Approfondit le système v1 (Ryuutama) au-delà de la fiche de personnage joueur, avec un souci de
> généralisation (d'autres systèmes futurs auront des besoins similaires : PNJ évolutifs, fiches
> structurées annexes). Ce qui est spécifique aux règles Ryuutama reste dans `packages/game-rules`,
> ce qui est générique (mécanisme de fiche typée, plugin) doit rester réutilisable par d'autres systèmes.

- [x] **Personnage du MJ (« Homme Dragon », Ryuutama)** : fiche distincte de celle du joueur, avec sa
      propre progression (niveau fonction du nombre de scénarios `PASSE`, pas d'XP distribuée) et son
      propre export PDF. *(Épic 10.)* **Un même Homme Dragon peut suivre plusieurs aventures** (parties
      Ryuutama dont on est MJ ; une aventure a au plus un Homme Dragon) : son niveau et son historique
      cumulent les scénarios `PASSE` de toutes ses aventures, il se retrouve (avec ou sans aventure)
      dans « Personnages », et se dissocie sans perdre la fiche. *(Épic 33, story 33.8 — remplace
      « un seul par Partie » ; AD-23.)*
- [x] **Fiches de référence Ryuutama** : journal, carte, monde, monstre, ville, objectifs (chasse/quête/
      voyage), œuf de bataille, structure — servies telles quelles en téléchargement PDF (journal/carte
      à tout membre, le reste au MJ seul), aucun remplissage dynamique à ce stade. *(Épic 12.)*
- [x] **Export PDF équipement & notes du PJ** : deux nouveaux exports auto-remplis depuis les données déjà
      en base (`Character.sheetData.equipment`, `CharacterNote`), en plus de l'export fiche complète déjà
      existant. *(Épic 11.)*

**Reliquat déplacé vers le Palier 8** : l'ajout des classes/textes manquants au contenu Ryuutama seedé
n'est plus traité en fin de Palier 5 mais fusionné dans une vraie refonte de contenu, repoussée après
la dette technique et la synchro (cf. ordre ci-dessous).

---

## Palier 6 — Dette technique accumulée *(décidé le 2026-07-18 — livré, épics 13 à 17)*

> Rassemble les items différés (`_bmad-output/implementation-artifacts/deferred-work.md`) jugés
> substantiels/cohérents pour justifier une passe dédiée, hors ceux explicitement écartés ou déplacés
> ailleurs (cf. `deferred-work.md`, section « Décisions actées le 2026-07-18 »).

- [x] **Nettoyage synchronisation & anti-double-clic UI** : gardes anti-double-clic manquantes sur les
      CTA `ScenarioEditor`/`ScenarioReadDialog` (Marquer Courant, Clôturer, Participer), signaux
      d'erreur jamais réinitialisés après un rechargement externe, `_changed` non scopé par Partie,
      `loadScenarios()` sans garde de démontage, `ScenarioTimeline` pas réactif si `partieId` change.
- [x] **Fusion du système d'inventaire équipement** : `equipment.group` (texte libre) et
      `equipment.individual` (`InventoryItem[]`) unifiés, sélection couplée nom/poids — migration
      Prisma + 2 UI (MJ et propriétaire).
- [x] **Durcissement sécurité auth/reset** : hachage du token de reset (actuellement en clair),
      invalidation des sessions actives au reset réussi, e-mail de confirmation post-changement de mot
      de passe, rate-limit par e-mail (pas seulement IP), purge des tokens expirés.
- [x] **Durcissement sécurité fichiers/uploads** : détection PDF par signature magique contournable,
      nettoyage EXIF des portraits uploadés (nouvelle dépendance `sharp`), header
      `X-Content-Type-Options` manquant sur les téléchargements.
- [x] **Robustesse mineure / perf** : pagination des listes qui grossissent (historique XP, scénarios),
      idempotence des `POST` sensibles, `orderBy` déterministe sur les inscriptions. Traité comme un
      5e epic formel du Palier 6 (décision actée le 2026-07-18, cf. PRD), pas au fil de l'eau.

---

## Palier 7 — Synchronisation client/serveur en temps quasi réel (SSE) *(décidé le 2026-07-18 — livré, épics 18 à 22)*

> Pas de vrai temps réel bidirectionnel visé — juste éliminer le besoin de recharger la page pour voir
> une modif faite par quelqu'un d'autre (MJ ↔ joueur, ou un autre onglet). **Approche tranchée avec
> l'utilisateur : Server-Sent Events (SSE)**, pas de polling. Le serveur pousse un événement léger
> (« ça a changé sur la Partie X ») via une connexion HTTP longue durée (`@Sse()` NestJS, nouveau
> mécanisme d'émission — rien de tel n'existe encore dans ce projet) ; le client, en écoute, déclenche
> le refetch qu'il a déjà (pattern `changed` signal déjà en place partout, à étendre pour être aussi
> déclenché par le push serveur, pas seulement par une action locale). Touche potentiellement toutes
> les pages consommant des listes (partie, timeline, séances, calendrier).

- [x] Mécanisme d'émission d'événements côté NestJS (scope minimal : par Partie, pas par ressource fine).
- [x] Connexion SSE côté Angular (`EventSource` ou wrapper), reconnexion sur coupure.
- [x] Câblage sur les pages existantes (`partie-detail`, `scenario-timeline`, `seance-list`,
      `calendar-view`) pour déclencher leur refetch déjà existant à la réception d'un événement.
- [x] Détail cadré et livré : fondation + partie en direct (épic 18), scénarios/séances/calendrier (19), fiches (20), dashboard/brouillons/annonces (21), services partagés (22).

---

## Palier 8 — Refonte complète des classes et textes Ryuutama *(décidé le 2026-07-18 — livré, épics 23 à 27)*

> Regroupe le reliquat « classes et textes manquants » du Palier 5 en une vraie passe de contenu,
> plutôt qu'un ajout ponctuel en fin de palier précédent. **À discuter ensemble au moment d'attaquer ce
> palier** — périmètre exact (quelles classes/textes, quelle profondeur) pas encore cadré.

- [x] Périmètre cadré et livré : contenu enrichi (épic 23), profils d'attributs (24), choix d'arme (25), équipement de départ (26), rôles de groupe (27).

---

## Palier 9 — Refonte UI & harmonisation des thèmes *(livré, clos le 2026-10-07 — épics 28 à 36)*

> Détail : `_bmad-output/planning-artifacts/epics.md` ; état réel : `sprint-status.yaml`.

- [x] **Compte et identité** : écran de compte, nom affiché, thème persisté, changement de mot de passe
      et d'e-mail. *(Épic 28.)*
- [x] **Navigation et listes** : quatre destinations, filtres/tris/favoris, signalétique d'état, bannières,
      clôture explicite d'une partie, refonte de la création/édition de partie. *(Épic 29.)*
- [x] **Calendrier** : écriture groupée, sélection par glissement, couches et vue Agenda *(Épic 30)* ;
      puis lisibilité : rail de détail, case de mois à trois bandes, piste de vote, grille semaine
      *(Épic 36)*.
- [x] **Fiche de personnage** : exports regroupés, surface de détail, aide contextuelle, parcours de
      création refondu, fiches des compagnons, cadenas de visibilité. *(Épic 31.)*
- [x] **Vue de partie et chronologie** : autocomplétion des invitations, réorganisation, états de
      scénario/séance, `ScenarioTimeline` refondue. *(Épic 32.)*
- [x] **Homme Dragon** : fiche refondue, souffles, création guidée, export PDF, réserve de souffles,
      capacités de niveau, un Homme Dragon pour plusieurs aventures. *(Épic 33.)*
- [x] **Entrée dans l'application** : messages d'erreur véridiques, champ de mot de passe révélable,
      identité visuelle « Dés Dispos ». *(Épic 34.)*
- [x] **Thèmes et textes** : un fichier par thème, renommage `atelier-cuivre`, classement des textes,
      revue éditoriale des trois thèmes. *(Épic 35.)*

---

## Palier 10 — Soirées entre amis (mode soirée, groupes, socle de permissions) *(PRD, UX, architecture et épics finals — prochaine étape : sprint planning, porte en premier)*

> PRD : `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/prd.md` (final, 2026-10-08). Issu de la forge
> `_bmad-output/forge/soiree-jeux-de-societe/`. Palier **avant** la mise en production.
> Épics : `_bmad-output/planning-artifacts/epics-palier10.md` (final, 2026-10-09) — épics 37 à 43, 38 stories ;
> épic 37 = la porte (9 stories), seule à démarrer.

- [ ] **Porte : socle de permissions à comportement constant** (point unique des règles « qui peut faire quoi »,
      mode soirée/JDR, migration des parties existantes en mode JDR) — aucune story « soirée » avant.
- [ ] Soirée isolée et groupe ; admins multiples ; tout membre propose et héberge un événement.
- [ ] Participation (tous / places limitées avec places réservées), date fixée ou sondage, inscriptions tardives.
- [ ] E-mails du mode soirée (dont une relance du vote) ; libellés propres au mode soirée.
- [ ] *Palier suivant : voir Palier 10.5 ci-dessous.*

---

## Palier 10.4 — Sondage et Destinée dans le calendrier *(avant le 10.5, vaut aussi pour le JDR — PRD, UX et architecture finals, prochaine étape : épics et stories)*

> PRD : `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/prd.md` (final, 2026-10-20) — FR-1 à FR-16 ;
> ajoute aux demandes ci-dessous « Créer un sondage » dans les 3 calendriers (choix d'un rendez-vous à dater) et la
> fixation de la date depuis la Destinée ; FR-17 (mode et nature expliqués à la création) ajoutée pendant l'UX.
> UX : `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/` (final, 2026-10-20).
> Architecture : `_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md`
> (final, 2026-10-20) — AD-1 à AD-17. PRD mis à jour après l'architecture : FR-18 (échéance proposée et modifiable dans
> le composer) et **plages longues** FR-19 à FR-23 (une journée JDR, un week-end jeux : durée facultative du rendez-vous,
> 15 jours au plus, corrigeable à tout moment). Le calendrier personnel suit et conclut les votes ; on compose dans le
> calendrier de la partie ou du groupe.

> Demandé pendant l'UX du Palier 10 (2026-10-08) : « j'ai galéré » à créer un sondage. Touche le calendrier **et** le
> JDR ; lève, pour ce sujet seulement, la contrainte « le JDR ne change pas » du Palier 10. En attendant, le Palier 10
> utilise le mode « composer » existant pour les sondages de conjonction.

- [ ] **Créneaux de l'automate** (« Fenêtres de la destinée ») **sélectionnables** : mise en évidence dans le
      calendrier, tous les autres créneaux grisés ; actions « Ajouter au vote » / « Masquer » ; un créneau ajouté
      quitte la liste de l'automate (il vit dans le vote, où on peut le retirer) ; liste **repliable**.
- [ ] **Créer un vote par sélection de jours**, comme on déclare ses dispos (rendre le mode « composer » trouvable).
- [ ] **Mode Destinée enrichi** : choisir sa destinée active parmi **toutes** celles des parties **actives** (plus
      seulement le mois affiché) via une liste ; les flèches ‹ n/N › servent à parcourir les **moments de vote**
      (options) du vote actif et déplacent le calendrier ; créer / éditer le sondage depuis la Destinée (MJ / hôte).
- [ ] **Ouvrir le calendrier directement en Destinée sur un sondage précis** (paramètre d'URL) et **filtrer le
      calendrier par partie / groupe** (aujourd'hui le panneau « Affichage » filtre par nature, pas par partie).
- [ ] **Échéance visible** dans le composer, avec un défaut (le plus tôt entre +14 jours et la veille du premier créneau).
- [ ] **Plages longues** : un rendez-vous peut durer plusieurs créneaux (après-midi + soir, vendredi soir → dimanche
      après-midi), voté, fixé, affiché et occupé sur toute la plage.

---

## Palier 10.5 — Jeux de société : liste de jeux, « j'apporte », historique des hôtes *(avant la mise en production — PRD final, prochaine étape : UX)*

> PRD : `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/prd.md` (final, 2026-10-29) — FR-1 à FR-10.
> Retaillé avec l'utilisateur : saisie manuelle seulement (pas d'import BoardGameGeek), « bibliothèque commune » =
> vue agrégée des jeux des membres, historique des hôtes réduit à un **compteur** (l'historique des événements existe
> déjà), « envie d'y jouer » minimale sur la fiche de la soirée ; tout reste facultatif ; mode soirée seulement.

- [ ] Liste des jeux possédés par chaque utilisateur (profil), affichée quand il est hôte.
- [ ] « J'apporte » : un invité coche les jeux qu'il apporte en rejoignant un événement.
- [ ] Historique et équilibre des hôtes d'un groupe.
- [ ] Bibliothèque de jeux commune au groupe.

---

## Palier 10.6 — Découvrabilité de la déclaration des dispos *(après le 10.5, avant la mise en production)*

> Remonté pendant l'UX du Palier 10 (2026-10-08). Aujourd'hui, déclarer ses dispos exige un **appui long** sur le
> calendrier (Story 36.3, AC15) : rien à l'écran ne l'annonce, un nouvel utilisateur ne le trouvera pas.

- [ ] Rendre la déclaration de dispos découvrable : tutoriel, ou autre mécanisme à choisir (⚠️ modifie un écran
      validé : calendrier, Épic 30 / 36). Peut remonter si les amis de la bande ne trouvent pas le geste.

---

## Palier 10.7 — Jeu d'icônes sur mesure, par thème *(après le 10.6, avant la mise en production)*

> Décidé pendant l'UX du Palier 10 (2026-10-08). Inventaire de départ :
> `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/.working/inventaire-icones.md`.

- [ ] Remplacer les ~43 icônes Material génériques (identiques dans les 3 thèmes) par un jeu propre à l'app,
      éventuellement **différent selon le thème** ; icône du bouton de création déjà dessinée au Palier 10 (dé + crayon).
- [ ] Lever les surcharges : `flag` (terminé / signal à traiter), `person` (compte / rôle joueur).
- [ ] Remplacer les emoji des titres de liste (⚔ 🌿 ⚙) par des icônes teintées par le thème.

---

## Palier 10.8 — Reporter côté JDR les acquis UX du mode soirée *(après le 10.7, avant la mise en production)*

> Décidé pendant l'UX du Palier 10 (2026-10-08) : le travail fait pour le mode soirée vaut aussi pour le JDR, qui
> garde pour l'instant son interface inchangée (contrainte dure du Palier 10). Candidats, à trier avec l'utilisateur :

- [ ] Pastille « **Ma situation** » sur les cartes de chapitres/séances (participe, vote à faire, pas inscrit).
- [ ] Détail d'un chapitre/séance **« situation d'abord »** (l'action à faire en tête, la fiche ensuite) ; vote en **résumé** (réponses, meilleur créneau, qui n'a pas répondu) plutôt qu'en liste.
      **⚠️ Laissé explicitement au 10.8 par le PRD du 10.4** (2026-10-19, FR-14 « Out of Scope ») : dans la fiche de
      scénario, remplacer la liste des créneaux du vote (réponse + « Sceller ce créneau ») par ce résumé et un bouton
      « Voter dans le calendrier » qui ouvre le calendrier **en Destinée sur ce sondage**, comme pour une conjonction.
      Le 10.4 fournit l'ouverture directe (paramètre d'URL, FR-13), la fixation de la date depuis la Destinée (FR-11)
      et redirige les liens existants, mais ne touche pas à la forme du vote dans la fiche.
- [ ] Onglet d'accueil d'une partie = **la suite des chapitres/séances** (ordre des onglets inversé), badges de rôle sur les avatars.
- [ ] Couverture : pastille « Changer » sur la bannière (déjà prévue au 10 pour la création ; à étendre à l'édition).
- [ ] Boutons d'action du pied de page (clore, brûler…) et libellés revus avec la même langue.

---

## Palier 11 — Mise en production d'une première version *(ex-Palier 7)*

- [ ] Décision d'hébergement : auto-hébergé (VPS, Docker Compose en prod) **vs** hébergement managé
      (PaaS) — arbitrage coût / simplicité / maintenance.
- [ ] Durcissement production : variables d'environnement/secrets, HTTPS, sauvegardes base de données,
      monitoring/logs minimal.
- [ ] Procédure de déploiement (manuelle ou CI/CD minimal) documentée.
- [ ] **⚠️ Reprendre les 2 aménagements de dev faits au Palier 9 pour tester sur un vrai téléphone**
      (décidés avec l'utilisateur le 2026-08-01 — à vérifier/inverser ici, ne pas les laisser filer en prod) :
      - `apps/web/src/app/core/api-base.ts` : `API_BASE` n'est plus codé en dur sur `http://localhost:3000`,
        il est calculé depuis `window.location` (`{protocol}//{hostname}:3000`). En prod l'API sera
        vraisemblablement derrière le même domaine (reverse-proxy, chemin `/api`) et/ou en HTTPS sur 443 —
        le port 3000 en dur n'aura alors plus de sens. **À reprendre selon la topologie retenue.**
      - `apps/api/src/main.ts` + `.env` : `WEB_ORIGIN` accepte désormais une **liste** d'origines séparées
        par des virgules (pour autoriser à la fois `localhost:4200` et l'IP LAN du poste).
        **En prod, n'y laisser que l'origine publique réelle — surtout aucune IP de réseau local.**

---

## Palier 12 — 2e système (Conte de Minuit) & durcissement multi-MJ *(ex-Palier 8)*

> Ryuutama étant le système v1 (Palier 2), ce palier valide l'abstraction plugin sur un
> **2ᵉ système** avec **Conte de Minuit** (agence, épisodique — mécaniques très différentes de
> Ryuutama, bon test de l'architecture plugin).

- [ ] Module **Conte de Minuit** (`sheetSchema`, `creationSteps`, `validate`, `computeDerived`).
- [ ] Durcissement **multi-MJ** : isolation des données, invitations, permissions, polish.
- [ ] Flow **« agence »** (Conte de Minuit) : annoncer une enquête → opt-in selon dispo → équipe. *(déplacé depuis Palier 4, dépend du module Conte de Minuit livré dans ce même palier)*

---

## Palier 13 — Module Draconis (3ᵉ système) *(ex-Palier 9)*

> Repoussé depuis le Palier 2 initial (décidé avec l'utilisateur, 2026-07-07) : Ryuutama puis Conte de
> Minuit passent devant. Draconis nécessite une référence des règles (D&D 5e) — cf. spec §9.

- [ ] Module **Draconis** : `sheetSchema`, `creationSteps`, `validate(strict)`, `computeDerived`
      (basé D&D 5e — SRD/Creative Commons si possible, cf. spec §9).
- [ ] Contenu Draconis (classes, races, sorts, compétences…) seedé en base via le même mécanisme
      CRM/JSON que Ryuutama (Palier 2).
- [ ] Front : rendu de fiche + assistant de création pour Draconis (réutilise l'infra plugin existante).

---

## Palier 14 — Carte interactive *(ex-Palier 10)*

- [ ] Carte (Leaflet + fond image) : **marqueurs** (lieux, événements, scénarios), **routes**.
- [ ] **Visibilité contrôlée par le MJ** (révéler / masquer aux joueurs).

---

## Palier 15 — Contenu personnalisable par le MJ (homebrew) *(ex-Palier 11)*

- [ ] Le MJ **ajoute / édite** des entrées (classes, métiers, compétences…) par-dessus le catalogue
      d'un système existant, scope `MJ` / `PARTIE` (le scope `BASE` sert déjà au contenu officiel
      depuis le Palier 2 — `ContentType`/`ContentEntry` existent déjà en base).
- [ ] Interface MJ pour saisir/éditer ce contenu custom.
- [ ] Moteur de règles et assistant de création **lisent le catalogue fusionné** (`BASE` + `MJ`/`PARTIE`
      du MJ courant).

---

## Idées / plus tard

- **Éditeur de système complet** : un MJ définit un nouveau système (types de contenu + schéma de fiche +
  règles simples) **sans coder**. Ambitieux.
- Notifications (e-mail / in-app).
- Import de perso existant entre parties du même système.
- Rôles avancés / modération (si plateforme publique).
- Thèmes par univers.
- **Créer directement un événement de groupe depuis le calendrier** : « Créer un sondage » (Palier 10.4) ne date
  que des rendez-vous existants ; proposer aussi d'y créer une conjonction. À réévaluer **après la mise en
  production**, sur l'app réelle et les retours de la bande. Idée notée le 2026-10-19 pendant le PRD du 10.4.
- **Durées différentes dans un même vote** : proposer ensemble « ven. soir → dim. après-midi » et « sam. après-midi →
  dim. après-midi » pour voir si une nuit de gîte en plus vaut le coup. Le 10.4 garde une seule durée par vote ; à
  réévaluer selon les besoins réels. Idée notée le 2026-10-20 pendant l'UX du 10.4.
- **Aperçu résumé + détail au clic pour les types (assistant de création)** : à l'étape Type, afficher les courts textes de `docs/assistant.md` (ex. "Le voyageur sait comment se débarrasser des monstres.") en aperçu par type, avec un clic pour afficher la description complète déjà seedée dans `types.json` (effets, avantages...). Idée notée le 2026-07-26 pendant la Story 23.3, non implémentée (hors scope).
