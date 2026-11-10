---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: 'READY'
issuesFound: 21
issuesRemediated: 15
scope: 'Palier 9 — Refonte UI & lisibilité de l''état'
inputDocuments:
  - '_bmad-output/specs/spec-palier9-refonte-ui/SPEC.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/addendum.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/review-resolutions.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260626/DESIGN.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-05
**Project:** jdr-master
**Scope under review:** Palier 9 — Refonte UI & lisibilité de l'état

---

## Step 1 — Document Discovery

### Documents selected for this assessment

| Type | File | Size | Modified |
|---|---|---|---|
| SPEC | `_bmad-output/specs/spec-palier9-refonte-ui/SPEC.md` | 23 KB | 2026-08-05 |
| PRD | `planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md` | 42 KB | 2026-08-05 |
| PRD (addendum) | `.../prd-jdr-master-2026-08-01/addendum.md` | 7 KB | 2026-08-03 |
| PRD (review resolutions) | `.../prd-jdr-master-2026-08-01/review-resolutions.md` | 25 KB | 2026-08-05 |
| Architecture | `planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md` | 62 KB | 2026-08-05 |
| UX — design system delta | `planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md` | 23 KB | 2026-08-05 |
| UX — experience | `planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md` | 27 KB | 2026-08-05 |
| UX — design system de base (hérité) | `planning-artifacts/ux-designs/ux-jdr-master-20260626/DESIGN.md` | 21 KB | 2026-06-27 |
| Epics & Stories | `planning-artifacts/epics.md` | 76 KB | 2026-08-05 |

### Document format

All documents are **whole documents** (one file per artifact, versioned by dated folder). No sharded (`index.md` + parts) variant exists for any type.

### Historical versions (not under review)

- PRDs: 9 earlier dated folders (`20260626` → `2026-07-24`)
- Architecture: 8 earlier dated folders (`2026-06-27` → `2026-07-24`)
- UX: 4 earlier dated folders (`20260626` → `20260711`) — the `20260626` DESIGN.md is retained as an *input* because the current UX contract is expressed as a delta on it
- Epics: 8 earlier per-palier files (`epics-p1-p3-ryuutama.md` … `epics-palier8.md`)
- Prior readiness reports: 2026-07-03, 2026-07-12, 2026-07-15, 2026-07-25

### Issues found

- **Duplicates requiring resolution:** none. Older versions live in distinct dated folders and are not competing sources of truth for Palier 9.
- **Missing documents:** none. PRD, UX, Architecture and Epics are all present for the scope under review.
- **Note:** `epics.md` is the only unversioned epics file (the earlier paliers use `epics-palierN.md`). It currently holds Palier 9 only.

---

## Step 2 — PRD Analysis

Sources read in full: `prd.md` (final, updated 2026-08-05), `addendum.md`, `review-resolutions.md`.

### Functional Requirements

**§4.1 — Profil, compte & préférences**

- **FR-1** — Écran « Compte » accessible depuis le menu principal, regroupant préférences et informations personnelles.
- **FR-2** — Thème persisté sur le compte et réappliqué à la reconnexion sur n'importe quel appareil ; repli local avant connexion (écrans d'auth).
- **FR-3** — Préférences d'affichage mémorisées sur le compte : masquage par défaut des parties terminées, **mode d'affichage** et **tri** par défaut des listes (FR-45), **couches actives** par défaut du calendrier (FR-46). Toutes suivent l'utilisateur d'un appareil à l'autre et se règlent depuis l'écran de compte.
- **FR-4** — Nom affiché modifiable (initialisé au pseudo), **pseudo immuable** (identifiant de connexion). Nom affiché **non soumis à unicité**.
- **FR-4b** — Levée d'ambiguïté entre noms affichés identiques : signalement non bloquant proposant de changer ou d'ignorer ; dans les écrans sans personnage (invitations, membres, XP, disponibilités, auteur d'annonce) le pseudo est utilisé ou affiché en complément.
- **FR-5** — Modification de l'e-mail : mot de passe courant exigé, avis vers l'ancienne adresse, prise d'effet après confirmation par lien sur la **nouvelle** adresse, puis **lien de retour arrière valable un mois** vers l'ancienne — son activation restaure l'ancien e-mail, **coupe toutes les sessions actives et impose une réinitialisation du mot de passe**.
- **FR-6** — Changement de mot de passe en session : mot de passe courant exigé et vérifié ; coupe toutes les **autres** sessions, conserve la courante (écart assumé avec le reset par e-mail).

**§4.2 — Navigation & liste des parties**

- **FR-7** — Suppression de la bascule globale MJ/Joueur ; liste unique de toutes les parties de l'utilisateur.
- **FR-8** — Distinction visuelle du rôle (MJ / joueur) par partie, conforme à P-1.
- **FR-9** — Création de partie **ouverte à tout utilisateur connecté** (aucune restriction ajoutée) ; seule la *mise en avant* (bouton proéminent) est conditionnée au fait d'être déjà MJ d'au moins une partie. Les options d'une partie donnée restent évaluées par partie.
- **FR-10** — Filtres et tris de la liste des parties : rôle, date, nom, type (one-shot, campagne…), statut (en cours, terminée, pas commencée).
- **FR-11** — Parties favorites, mises en avant dans la liste.
- **FR-12** — Signalétique d'état sur les cartes de partie. Joueur : personnage à créer, date de prochaine séance, vote en cours, compte-rendu non rédigé. MJ : Homme Dragon à créer, aucun membre invité, aucun scénario, aucune date, aucun vote, rapport de fin manquant. Partie terminée en retrait (FR-44), partie nouvelle ou requérant une action mise en avant.
  - *NFR propre à FR-12* : signaux calculés pour **toutes** les parties sans fan-out réseau. Tranché (Q-11) : **un appel unique** renvoyant la carte des signaux de toutes les parties, calculée serveur par requêtes groupées.
- **FR-44** — Clôture explicite d'une partie par le MJ, réversible. Conditionne FR-3, FR-10, FR-12. Partie terminée reste consultable (état d'affichage, ni archivage ni suppression).
- **FR-45** — Trois modes d'affichage des listes (grande vignette / intermédiaire / liste compacte), mémorisés avec le tri sur le compte. Même grammaire et même barre de contrôles pour la liste des parties et « mes personnages » (FR-16). *Réserve consignée : outillage sans utilité immédiate à 2-4 parties, construit sciemment contre recommandation.*
- **FR-48** — Navigation principale à **quatre destinations** — Parties, Personnages, Calendrier, Compte — barre basse sur mobile, haute sur desktop. Le calendrier cesse d'être une entrée de menu.
- **FR-47** — Identité visuelle d'une partie : **bannière générée** à partir de l'identifiant de la partie, déclinée selon le thème actif, stable dans le temps ; le MJ peut lui substituer une **image de couverture** (D-11), la bannière servant de repli.
- **FR-13** — Notification éphémère à la connexion signalant les annonces non vues ; disparaît à l'ouverture. État « vue » mémorisé sur le compte. Portée et ciblage des annonces inchangés.

**§4.3 — Identité : joueur vs personnage**

- **FR-14** — Convention visuelle unique joueur / personnage, appliquée partout, conforme à P-1.
- **FR-15** — Affichage conjoint joueur **et** personnage sur les écrans listant des participants (cas à corriger : Détails › Troupe). À défaut de personnage, le pseudo prend le relais en cas d'homonymie.
- **FR-16** — Vue « mes personnages » avec recherche, **distincte** de la liste des parties, jamais mélangée. Tranché (Q-8) : deux **destinations** de la navigation principale (FR-48). Prérequis : endpoint absent (D-10).
- **FR-17** — Correction du placement de la pastille de montée de niveau, près du nom du personnage.

**§4.4 — Fiche & création de personnage**

- **FR-18** — Actions d'export PDF regroupées dans une entrée dédiée (menu de la fiche, Q-5).
- **FR-19** — Aide contextuelle d'un geste sur les termes, classes, spécialités et options, affichant les textes du catalogue seedé au Palier 8.
- **FR-20** — Textes descriptifs des éléments possédés (avantages, talents…) consultables sans quitter la fiche. Tranché (Q-9) : **surface de détail unique** — panneau latéral desktop / feuille montante mobile. Dépliant autorisé en exception seulement. Frontière avec FR-19 : règles du catalogue (FR-19) vs éléments possédés (FR-20) ; mutualisation si une même forme convient.
- **FR-21** — Refonte du parcours de création de personnage (lisibilité, moins de gestes).
- **FR-22** — Consultation limitée des fiches des compagnons, restreinte aux champs non verrouillés (FR-23) ; notes exclues par défaut (mécanisme existant).
- **FR-23** — Cadenas de visibilité posés par le MJ via un écran de configuration sur fiche type. Verrouillage **par partie**, applicable à tous ses personnages, jamais opposable au propriétaire ni au MJ. Tranché (Q-12) : l'unité de verrouillage est **déclarée par le schéma du système de jeu** — verrouillage en bloc par clé, sous-champs individuels si la clé le déclare. Recadrage : **préférence de jeu anti-spoil, pas un modèle de sécurité — rien n'est verrouillé par défaut**. Filtrage **côté serveur** : un champ verrouillé ne transite jamais dans une réponse d'API.

**§4.5 — Homme Dragon**

- **FR-24** — Fiche Homme Dragon refondue au niveau des fiches de personnage joueur.
- **FR-25** — Formulaire de création guidé, accompagné de textes explicatifs.
- **FR-26** — Souffles disponibles sur la fiche : seeder les souffles **propres à chaque race** (vert, bleu, rouge, noir), absents de l'application, sur le modèle du catalogue d'artefacts ; puis présenter les souffles dont ce dragon dispose (communs + ceux de sa race), avec coût et description. **Aucun suivi de consommation.**
- **FR-27** — Export PDF de la fiche Homme Dragon mis au niveau de celui des fiches joueur.

**§4.6 — Vue de partie, scénarios & chronologie**

- **FR-28** — Réorganisation de la vue de partie selon une hiérarchie lisible : action immédiate / consultation / référence.
- **FR-29** — Refonte de Scénario & Chronologie (enchaînement, état, séances). Absorbe le défaut d'affichage de la ligne chronologique du 14/07 ; mockup = inspiration, pas référence contraignante.
- **FR-30** — Autocomplétion des invitations au fil de la frappe. Porte **sur le pseudo uniquement** (jamais l'e-mail, aucun e-mail renvoyé). L'endpoint actuel fait une égalité stricte → D-8. Invitation par e-mail exact inchangée. Garde-fous en Q-14.
- **FR-31** — Statuer explicitement sur la place des rôles de groupe, de la distribution d'XP, de la gestion des membres et des rappels e-mail dans les écrans refondus.

**§4.7 — Calendrier & votes**

- **FR-32** — Saisie des disponibilités repensée, sélection de dates sur desktop traitée spécifiquement. **Écriture groupée (D-14)** : une sélection par glissement part en **un seul appel**, transactionnel tout-ou-rien, jamais une boucle client.
- **FR-33** — Séances datées visibles dans les calendriers : explicites et légendées dans le calendrier personnel ; dans le calendrier d'une partie, une séance de cette partie affiche ses informations, une séance d'une **autre** partie apparaît comme une indisponibilité. **Contrainte de sécurité** : seules les séances des parties dont l'utilisateur est réellement membre remontent.
- **FR-34** — Créneaux proposés d'un vote en cours affichés dans le calendrier de la partie.
- **FR-35** — Annulation (retrait) d'une réponse de vote, pas seulement modification.
- **FR-36** — Vue semaine **conservée et spécialisée** en outil de saisie en masse (glissement multi-jours / multi-créneaux). Vue mois : glissement plus grossier à la journée entière. Troisième vue Agenda ajoutée par FR-46.
- **FR-46** — Calendrier à **couches combinables** : indisponibilités, disponibilités, séances confirmées, votes en cours, inscriptions ouvertes, et — pour le MJ dans une partie — disponibilité agrégée du groupe. **Trois présentations** : Mois, Semaine, Agenda. Le panneau « Voir les créneaux calculés » devient une couche. Jeu de couches par défaut sur le compte (FR-3), bascules temporaires, indicateur d'écart au défaut avec rétablissement. *Risque assumé : éteindre une couche d'indisponibilité peut faire paraître libre un créneau occupé.*

**§4.8 — Authentification & entrée dans l'application**

- **FR-37** — Suppression du lien « Créer un compte » de la page de connexion (inscription sur invitation uniquement ; le lien mène à une impasse silencieuse).
- **FR-38** — Messages d'erreur véridiques à la connexion : distinguer identifiants invalides d'une indisponibilité serveur.
- **FR-39** — Afficher / masquer le contenu des champs de mot de passe.
- **FR-40** — Mise en forme des écrans d'authentification et du parcours d'invitation (hiérarchie, actions secondaires, rendu mobile).

**§4.9 — Thèmes & textes** *(en dernier, délibérément)*

- **FR-41** — Revue complète des textes des trois thèmes : registre, complétude des clés, libellés orphelins ou codés en dur. Relecture éditoriale faite par l'utilisateur.
- **FR-42** — Classement de chaque texte : relève-t-il du fichier de thème ou non ? Les textes officiels du système de jeu restent hors thème.
- **FR-43** — Réorganisation du stockage des thèmes en fichiers par thème (modèle fichiers de langue). Typage dérivé d'un thème de référence → clé absente = erreur de compilation (Q-2). **Renommage** `medieval-steampunk` → `atelier-cuivre` (« Atelier Cuivré ») avec **migration des préférences déjà enregistrées** (Q-18).

**Total FRs : 49** (FR-1 → FR-48, plus FR-4b).

### Non-Functional Requirements

Le PRD ne comporte **aucune section NFR numérotée**. Les exigences non fonctionnelles sont portées par les principes transverses (§3), une NFR attachée à FR-12, et des contraintes disséminées dans les FR et l'addendum.

| Réf. | Nature | Énoncé |
|---|---|---|
| **P-1** | Accessibilité / lisibilité | **Jamais la couleur seule.** Toute information encodée par la couleur doit être doublée d'au moins un autre signal : icône, libellé **ou** traitement typographique (ex. nom de personnage toujours en italique). |
| **P-2** | Accessibilité | **Vigilance, pas conformité.** Confort au pouce, texte non tronqué, contraste tenant sur les trois thèmes — réflexes de conception, **pas des critères d'acceptation chiffrés**. Aucun audit rétroactif. Irritants traités au cas par cas. |
| **P-3** | Portée | **Desktop et mobile à parité.** Aucun support secondaire ; mobile vérifiable sur appareil réel. |
| **P-4** | Robustesse | États vides et erreurs traités **au cas par cas** sur les écrans refondus. Un message d'erreur ne doit jamais mentir sur la cause (FR-38). |
| **P-5** | Gouvernance | **Rien de silencieux côté serveur.** Toute évolution serveur est listée au §5 ; une évolution nouvelle découverte en implémentation est remontée et discutée **avant** d'être codée. |
| **NFR-FR12** | Performance | Les signaux d'état de toutes les parties sont obtenus **sans multiplier les appels réseau par partie** (deux bugs de production antérieurs : rafales de 429, listes vidées). Tranché : appel unique, calcul serveur groupé. |
| **NFR-FR32** | Performance / intégrité | Écriture groupée des disponibilités : un seul appel pour N créneaux, **transactionnel tout-ou-rien**, jamais de boucle client (limiteur de débit). |
| **NFR-FR23** | Sécurité | Filtrage des champs verrouillés **côté serveur** sur tous les chemins de lecture d'une fiche, exports PDF compris — jamais un masquage à l'affichage. |
| **NFR-FR33** | Sécurité / confidentialité | Aucune fuite d'information entre parties tierces : seules les séances des parties dont l'utilisateur est membre remontent ; filtrage serveur. |
| **NFR-FR4/6** | Sécurité | Gestion de compte (nom affiché, e-mail, mot de passe) : mot de passe courant exigé, coupure de sessions ciblée, double canal e-mail. Passage par `/security-review` demandé explicitement. |
| **NFR-FR43** | Maintenabilité | Complétude des clés de thème **garantie à la compilation** par un typage dérivé du thème de référence. |
| **NFR-FR47** | Déterminisme | Bannière générée : graine = identifiant de partie (jamais le nom), tirée **une fois**, stable dans le temps, non stockée. |

### Additional Requirements & Constraints

**Dérogations serveur actées (§5) — 14 lignes, contrat de gouvernance P-5**

| # | Objet | FR | Ampleur |
|---|---|---|---|
| D-1 | Préférences de compte (thème, masquage, annonce vue) | FR-2, FR-3, FR-13 | Modérée |
| D-2 | Gestion de compte : nom affiché, e-mail, mot de passe | FR-4 → FR-6 | **Élevée** |
| D-3 | Favoris de parties | FR-11 | Faible |
| D-4 | Filtrage serveur de la visibilité des champs de fiche | FR-23 | **Élevée** |
| D-5 | Annulation d'une réponse de vote | FR-35 | Faible |
| D-6 | Exposition cross-partie des séances | FR-33, FR-46 | Modérée (contrainte de sécurité) |
| D-7 | Souffles propres à chaque race de dragon | FR-26 | Faible (contenu seedé) |
| D-8 | Recherche partielle sur le pseudo | FR-30 | Faible |
| D-9 | Clôture explicite d'une partie (état absent du modèle) | FR-44, FR-3, FR-10, FR-12 | Modérée |
| D-10 | Liste des personnages de l'utilisateur toutes parties confondues | FR-16 | Faible |
| D-11 | Image de couverture de partie (mécanisme des portraits réutilisé) | FR-47 | Modérée |
| D-12 | États dépendants du lecteur | FR-12, FR-29 | **Nulle à ce stade** ⚠️ inscrite pour visibilité |
| D-13 | Inscriptions ouvertes exposées au calendrier, toutes parties confondues | FR-46 | Modérée |
| D-14 | Déclaration de disponibilité en masse | FR-32 | Modérée |

**Ne nécessitent aucun changement serveur** (vérifié) : liste unifiée des parties, création de partie (FR-9), modes d'affichage (FR-45), bannière générée (FR-47).

**Contraintes de séquence déclarées (§4)** — seules contraintes réelles, le reste étant librement ordonnable :
1. §4.1 avant §4.2 et §4.9 (les préférences n'ont nulle part où vivre sans écran de compte).
2. §4.9 en dernier (relecture des libellés seulement une fois tous les écrans refondus).
3. FR-14 (convention de nommage) avant les écrans qui l'appliquent.

**Hors périmètre explicite (§6)** : suivi en jeu (dont réserve de souffles), mode tutoriel / onboarding, conformité d'accessibilité formelle (WCAG AA, clavier, lecteurs d'écran), ouverture de l'inscription libre, refonte de la DA, quatrième thème dédié à l'accessibilité.

**Points ouverts restants (§7)** — aucun bloquant déclaré : Q-1 (périmètre refonte création/édition de partie), Q-14 (garde-fous autocomplétion), Q-15 (image de couverture vs bannière selon les modes ; animation de thème), Q-16 (formulation du plancher d'accessibilité — *« avant l'écriture des stories »*), Q-17 (plafond de badges par carte et priorité entre signaux).

**Dette consignée dans l'addendum §4.2** — aménagements temporaires à reprendre au Palier 11 : `API_BASE` calculé depuis `window.location`, `WEB_ORIGIN` multi-origines. Hors périmètre du palier mais à ne pas perdre.

### PRD Completeness Assessment

**Qualité d'ensemble : élevée.** Le PRD est daté, versionné, explicitement réconcilié avec les runs d'architecture et d'UX, et chaque exigence porte son motif. Les décisions écartées sont documentées (addendum §2), l'état serveur a été **vérifié par lecture de code** et non supposé (addendum §1), et la gouvernance des évolutions serveur est formalisée (P-5 + tableau des 14 dérogations). C'est une base de traçabilité inhabituellement solide.

**Points d'attention relevés à ce stade** (à confronter aux épics aux étapes 3-5) :

1. **Absence de NFR numérotées.** Les exigences non fonctionnelles vivent dans les principes P-1..P-5 et dans le corps des FR. Elles sont réelles et fortes (sécurité, anti-fan-out, transactionnalité) mais **non adressables individuellement** : aucune story ne peut les citer par référence. Risque de couverture silencieuse.
2. **Trois correctifs de la revue d'exactitude ne semblent pas répercutés dans le PRD final** :
   - *(#3, gravité Élevée)* **D-12** reste classée « ampleur nulle — ne pas implémenter par réflexe de complétude », alors que la revue établit que cela contredit la règle « aucun calcul d'état côté client » (EXPERIENCE §5 + convention de la spine). Le PRD instruit donc de ne rien faire là où la spine exige un code d'état fermé calculé par lecteur.
   - *(#7, gravité Moyenne)* **FR-46** borne toujours la couche « disponibilité du groupe » au MJ, en tension avec `AggregatedSlotDto` (vue joueur agrégée déjà existante, AD-9).
   - *(#8, gravité Faible)* **FR-12** dit seulement qu'une partie terminée est « visuellement en retrait », là où AD-3 exige que ses signaux d'action soient **supprimés**, pas atténués.
   - *(#9, gravité Faible)* **FR-36** écrit que la vue mois « **conserve** » un glissement qu'elle n'a jamais eu — capacité neuve des deux côtés.
   *(Les correctifs #1, #2, #4, #5, #6, #10 et #11 sont, eux, bien répercutés : D-6/D-13 requalifiées, les cinq corps d'exigence mis à jour, le retour arrière e-mail explicité, le recadrage anti-spoil ajouté à FR-23, FR-48 créée, le décompte corrigé et Q-18 close.)*
3. **Q-16 est déclarée à trancher « avant l'écriture des stories »** — or les stories existent déjà (`epics.md`, 2026-08-05). À vérifier à l'étape 4.
4. **FR-23 porte un avertissement de périmètre explicite** (« le morceau le plus lourd du palier », premier candidat à sortir). Le découpage en épics doit permettre de l'extraire sans casser le reste — point à vérifier à l'étape 5.

---

## Step 3 — Epic Coverage Validation

`epics.md` lu intégralement (1 656 lignes) : 8 épics, 44 stories, une **FR Coverage Map** explicite, un inventaire d'exigences, 12 NFR numérotées et 22 exigences de design (UX-DR1 → UX-DR22).

### Coverage Matrix

Légende — ✅ couverte par des critères d'acceptation explicites · ⚠️ mappée mais couverture partielle (un pan de l'exigence n'a aucun AC) · ❌ absente.

| FR | Exigence | Story | Statut |
|---|---|---|---|
| FR-1 | Écran de compte | 1.1 | ✅ |
| FR-2 | Thème persisté | 1.4 | ✅ (4 AC dont l'adoption unique du local et la non-régression) |
| FR-3 | Préférences sur le compte | 1.1 · 2.6 · 2.7 · 3.4 | ✅ chaque préférence portée par la story qui la consomme |
| FR-4 | Nom affiché / pseudo immuable | 1.1 | ✅ (migration + `register()` + absence d'unicité) |
| FR-4b | Homonymie | 1.3 | ✅ (non bloquant, non répétitif, repli pseudo) |
| FR-5 | Changement d'e-mail | 1.6 | ✅ (double canal, retour arrière coupant les sessions, jetons invalides) |
| FR-6 | Mot de passe en session | 1.5 | ✅ (écart avec le reset explicitement testé) |
| FR-7 | Bascule MJ/Joueur supprimée | 2.1 | ✅ |
| FR-8 | Rôle par partie | 2.1 | ✅ |
| FR-9 | Création : accès vs mise en avant | 2.1 | ✅ (les deux cas, MJ et non-MJ) |
| FR-10 | Filtres **et tris** | 2.6 | ⚠️ AC sur rôle et statut uniquement ; **date, nom et type (one-shot / campagne) n'ont aucun AC** |
| FR-11 | Favoris | 2.6 | ✅ |
| FR-12 | Signalétique d'état | 2.5 | ⚠️ mécanisme entièrement couvert (appel unique, union fermée, tableau vide, plafond 2 badges, partie close sans signal d'action, SSE) mais **la liste des signaux du PRD n'est énumérée dans aucun AC** |
| FR-13 | Annonces non vues | 2.11 | ✅ (cross-device + non-régression de portée) |
| FR-14 | Convention d'identité | 1.2 | ✅ (`IdentityLabel` point de passage unique) |
| FR-15 | Affichage conjoint | 1.2 | ⚠️ règle générale couverte ; **le cas concret nommé par le PRD — Détails › Troupe — n'apparaît dans aucun AC** |
| FR-16 | Vue mes personnages | 2.2 | ✅ |
| FR-17 | Pastille de niveau | 1.3 | ✅ |
| FR-18 | Exports regroupés | 4.1 | ✅ (les 5 actions énumérées, non-régression du fichier produit) |
| FR-19 | Aide contextuelle | 4.3 | ✅ (dont le cas « pas de texte au catalogue ») |
| FR-20 | Textes descriptifs | 4.2 | ✅ (surface adaptative + dépliant en exception documentée) |
| FR-21 | Parcours de création | 4.4 | ✅ (équivalence du personnage produit) |
| FR-22 | Fiches des compagnons | 4.5 | ✅ |
| FR-23 | Cadenas de visibilité | 4.6 · 4.7 | ✅ (clé absente et non vide, `lockedKeys`, `derived` solidaire, PDF, point unique) |
| FR-24 | Fiche Homme Dragon | 6.1 | ✅ |
| FR-25 | Création guidée | 6.3 | ✅ |
| FR-26 | Souffles par race | 6.2 | ✅ dans le corps de l'épic — mais voir le conflit interne ci-dessous |
| FR-27 | Export Homme Dragon | 6.4 | ✅ |
| FR-28 | Vue de partie réorganisée | 5.2 | ✅ |
| FR-29 | Scénario & chronologie | 5.3 · 5.4 | ✅ (dont l'anti-spoil et l'interdiction de retirer le filtrage front) |
| FR-30 | Autocomplétion | 5.1 | ✅ (garde-fous présents en forme paramétrable, valeurs Q-14 non fixées) |
| FR-31 | Place des fonctionnalités récentes | 5.2 | ✅ (« aucune n'a disparu sans décision explicite ») |
| FR-32 | Disponibilités repensées | 3.2 · 3.3 | ✅ (appel unique, transactionnel, conflit nommé) |
| FR-33 | Séances dans les calendriers | 3.5 | ✅ (non-fuite cross-partie testée dans les deux sens) |
| FR-34 | Options de vote dans le calendrier | 3.5 · 3.6 | ⚠️ « votes en cours » existe comme **couche** (3.4, 3.6) mais **aucun AC ne dit que les créneaux proposés d'un vote apparaissent dans le calendrier de la partie** — 3.5 est le calendrier *personnel* |
| FR-35 | Retrait d'une réponse | 3.1 | ✅ (isolation par option, refus sur autrui, clôture MJ inchangée) |
| FR-36 | Vue semaine spécialisée | 3.3 | ✅ — et **le PRD est corrigé au passage** : l'AC traite le glissement mois comme une capacité neuve |
| FR-37 | Lien « Créer un compte » retiré | 7.2 | ✅ |
| FR-38 | Erreurs véridiques | 7.1 | ✅ |
| FR-39 | Mot de passe révélable | 7.2 | ✅ |
| FR-40 | Écrans d'auth mis en forme | 7.3 | ✅ |
| FR-41 | Revue éditoriale | 8.3 | ✅ |
| FR-42 | Classement des textes | 8.2 | ✅ (dont les libellés orphelins) |
| FR-43 | Découpe + renommage | 8.1 | ✅ (migration `User.theme` dans la même story) |
| FR-44 | Clôture explicite | 2.4 | ✅ (dont « pas encore commencée » et calcul serveur) |
| FR-45 | Modes d'affichage | 2.7 | ✅ (paire mode+tri distincte par liste) |
| FR-46 | Couches du calendrier | 3.4 · 3.5 · 3.6 | ✅ mécanisme complet — voir la réserve « disponibilité du groupe » ci-dessous |
| FR-47 | Identité visuelle | 2.8 · 2.10 | ✅ (déterminisme, non-persistance, upload durci) |
| FR-48 | Navigation à 4 destinations | 2.3 | ✅ |

### Missing Requirements

**Aucune FR n'est absente de la carte de couverture.** Les manques sont des **pans d'exigence sans critère d'acceptation** à l'intérieur de stories existantes.

#### Priorité haute

- **FR-34 — options de vote dans le calendrier de la partie.** Le PRD demande que « pendant un vote en cours, les créneaux proposés apparaissent dans le calendrier **de la partie** ». La carte la rattache à 3.5 (endpoint du calendrier **personnel**) et 3.6 (couches à l'écran). Ni l'une ni l'autre ne porte d'AC sur le calendrier d'une partie pendant un vote. L'exigence survit comme nom de couche (`votes en cours`), pas comme comportement vérifiable.
  → *Recommandation :* un AC dans 3.6, ou une story dédiée au calendrier de partie dans l'épic 3.

- **FR-10 — filtres date / nom / type.** Trois des cinq critères de filtre demandés n'ont aucun AC. Le type de partie (one-shot / campagne) est le plus visible à l'usage.
  → *Recommandation :* compléter les AC de 2.6, ou retirer explicitement ces critères du PRD.

#### Priorité moyenne

- **FR-12 — liste des signaux.** Le PRD énumère 10 signaux (6 MJ, 4 joueur) ; UX-DR18 les cartographie vers trois teintes. Aucun AC de 2.5 ne les énumère : une implémentation conforme à tous les AC pourrait n'en produire que deux.
  → *Recommandation :* un AC énumérant l'union fermée `PartySignalCode` attendue.

- **FR-15 — Détails › Troupe.** Le seul défaut concret nommé par le PRD (« l'onglet Détails › Troupe n'affiche aujourd'hui que les joueurs ») n'a pas d'AC. La règle générale de 1.2 porte sur les DTO et la typographie, pas sur cet écran.

### Conflits internes au document d'épics

Trois incohérences **internes à `epics.md`** — le document n'a pas été relu de bout en bout après la résolution de Q-13 :

1. **D-7 : « à ne pas implémenter » contre la story 6.2.** La section *Additional Requirements* affirme : « **D-7** et **D-12** sont d'ampleur nulle : […] ne demandent aucun travail ». Or D-7 (souffles par race) a été **requalifiée « Faible — actée »** par le PRD le 2026-08-05, et la story 6.2 la spécifie en détail. Un implémenteur lisant la section transverse ne fera pas la story. **Gravité élevée.**
2. **Épic 6 déclaré « bloqué par Q-13 ».** Les *Notes d'implémentation* de l'Epic List disent : « bloqué par Q-13 […] FR-26 ne peut pas produire de critères vérifiables et se réduit au périmètre de FR-24 ». Le corps de l'épic 6, lui, ouvre par « Q-13 tranchée le 2026-08-05 » et la story 6.2 porte 6 AC vérifiables. Contradiction frontale.
3. **Inventaire stale.** L'inventaire d'exigences liste encore « FR-26 : Souffles **et éveils** sur la fiche *(périmètre suspendu à Q-13)* ». Les « éveils » n'existent ni dans le PRD ni dans la story 6.2 — vestige de la formulation d'avant la résolution.

### Points de tension hérités, non résolus par les épics

- **FR-46 / couche « disponibilité du groupe ».** La story 3.4 ne traite que son absence du calendrier personnel. La restriction au MJ (PRD + EXPERIENCE) contre `AggregatedSlotDto` (vue joueur agrégée existante, AD-9) — correctif #7 de la revue d'exactitude — **n'est arbitrée nulle part**, ni dans le PRD, ni dans les épics.
- **D-12.** Reconduite en « ampleur nulle » dans les épics comme dans le PRD, alors que la revue d'exactitude la déclare en contradiction avec « aucun calcul d'état côté client ». Les épics ajoutent toutefois `AD-20`, qui **tranche dans l'autre sens** (« les états dépendants du lecteur sont résolus côté client sur les écrans qui détiennent la charge utile »). La contradiction est donc résolue par l'architecture, mais **le PRD et la revue disent l'inverse l'un de l'autre** — à consigner comme décision, pas à laisser en l'état.

### Questions ouvertes du PRD tranchées par les épics *(non remontées au PRD)*

- **Q-15** (image de couverture dans tous les modes ? animation ?) → tranchée par la story 2.10 : elle remplace la bannière **dans tous les modes**, **sans animation de thème**.
- **Q-16** (plancher d'accessibilité) → tranchée par NFR-2 : valeur de conception par défaut, pas critère de recette.
- **Q-17** (plafond de badges) → plafond de 2 badges + compteur tranché par l'AC de 2.5 ; **l'ordre de priorité entre signaux concurrents reste sans AC** (seulement dans UX-DR18).
- **Q-14** (garde-fous d'autocomplétion) → forme tranchée par 5.1 (longueur minimale, plafond), **valeurs non fixées** — acceptable, non bloquant.
- **Q-1** (périmètre refonte création/édition de partie) → **toujours ouverte, et aucune FR ni story ne la porte.** Cohérent avec son statut, mais à confirmer comme hors périmètre du palier.

### Coverage Statistics

- **Total PRD FRs :** 49
- **FRs présentes dans la carte de couverture :** 49 — **100 %**
- **FRs couvertes par des AC explicites et complets :** 45 — **91,8 %**
- **FRs à couverture partielle :** 4 (FR-10, FR-12, FR-15, FR-34) — **8,2 %**
- **FRs absentes :** 0
- **NFRs du PRD (P-1..P-5 + contraintes) :** reformulées en **12 NFR numérotées** dans les épics — un gain net de traçabilité par rapport au PRD.
- **Stories sans ancrage FR :** 1 (story 2.9, animations et compte à rebours) — tracée sur UX-DR8, UX-DR9 et NFR-9/NFR-12, pas sur une FR. Traçabilité descendante correcte.

---

## Step 4 — UX Alignment

### UX Document Status

**Found.** Contrat d'UX complet et daté du 2026-08-05 :

- `ux-jdr-master-2026-08-04/DESIGN.md` — delta du design system : 4 amendements à la base, les 3 palettes de statut, 8 composants, section Motion nouvelle.
- `ux-jdr-master-2026-08-04/EXPERIENCE.md` — delta comportemental : architecture de l'information réécrite, modèle de couches, 4 parcours clés, plancher d'accessibilité amendé.
- `ux-jdr-master-20260626/DESIGN.md` — design system de base dont les deux précédents sont le delta.
- 9 maquettes HTML figées dans `mockups/`, plus 22 planches de travail dans `.working/`. Règle de préséance explicite : « en cas de conflit avec une planche de `.working/`, ce document gagne ».

Les documents d'architecture citent l'UX dans leurs `sources`, et réciproquement — les quatre contrats ont été produits en boucle, pas en cascade.

### ⚠️ Correction d'un constat de l'étape 2

Le correctif **#3** de `review-resolutions.md` (D-12 « ampleur nulle » contre « aucun calcul d'état côté client ») **est résolu** — non pas dans le PRD, mais dans `EXPERIENCE.md` §5, qui a été réécrit le 2026-08-05 et dit désormais l'inverse de la phrase citée par la revue : « Ces états sont résolus par lecteur […] aucun changement serveur n'est nécessaire aujourd'hui […] c'est le sens de la dérogation D-12 ». La position est **cohérente sur les quatre documents** : PRD (ampleur nulle), EXPERIENCE §5, spine `AD-20`, épics. **Il n'y a pas de contradiction à arbitrer** — la revue d'exactitude est simplement antérieure à l'amendement d'EXPERIENCE. Le point d'attention n°2 de l'étape 2 est corrigé en conséquence : il reste **trois** correctifs non répercutés (#7, #8, #9), tous de gravité faible à moyenne, et tous compensés par les épics ou l'architecture sauf #7.

### UX ↔ PRD Alignment

**Répercussion en amont : complète.** `EXPERIENCE.md` §10 exigeait que trois décisions du run d'UX soient portées au PRD **avant le découpage en épics**. Les trois y sont : modes d'affichage → FR-45, couches + deux préférences → FR-46 et FR-3, image de couverture → FR-47 et D-11. La discipline P-5 a été tenue.

**Écarts relevés :**

| # | Écart | Gravité |
|---|---|---|
| 1 | **Nuance apportée à FR-15 par l'UX, jamais remontée au PRD.** EXPERIENCE §4.5 : « afficher joueur et personnage là où c'est utile » **ne signifie pas** « toujours les deux » — n'en afficher qu'un est une option de conception légitime, dont l'icône est la contrepartie obligatoire. Le PRD lit toujours comme une obligation d'affichage conjoint. Les épics suivent l'UX (story 1.2). | Faible — la chaîne UX→épics est cohérente, seul le PRD est en retard |
| 2 | **Couche « disponibilité du groupe » réservée au MJ.** EXPERIENCE §2 et §4.3 la bornent au MJ en contexte de partie ; le PRD (FR-46) reprend cette borne. Or `AD-9` décrit **deux vues existantes** : `AvailableSlotDto` (MJ, statut par membre) et `AggregatedSlotDto` (**joueur**, compteurs sans identité). Restreindre la couche au MJ **retire aux joueurs une lecture agrégée qu'ils ont déjà aujourd'hui**. | **Moyenne — non arbitré, et c'est une régression fonctionnelle potentielle** |
| 3 | **Points ouverts d'EXPERIENCE §12 non tous remontés.** #1 (plancher d'accessibilité) devient Q-16 au PRD et NFR-2 aux épics — mais la formulation n'a **jamais été validée par l'utilisateur**, alors qu'EXPERIENCE l'exigeait « avant l'écriture des stories », qui sont écrites. #4 (pondération d'usage 60-80 % / 30 %, issue d'un seul utilisateur) n'est remonté nulle part et sous-tend pourtant l'amendement 2 de DESIGN. | Faible à moyenne |

### UX ↔ Architecture Alignment

**Alignement globalement excellent.** La spine traite explicitement les besoins nés du run d'UX : `AD-16` (couches relationnelles), `AD-17` (upload partagé pour l'image de couverture), `AD-18` (endpoint unique du calendrier), `AD-19` (dérivation unique de la bannière), `AD-20` (états par lecteur). Elle **tranche même deux points laissés ouverts par l'UX** :

- **Q-15 / point ouvert #2 d'EXPERIENCE** → `AD-19` : « si `coverImageUrl` est renseigné, l'image l'emporte dans **tous** les modes ; l'animation n'accompagne que la bannière générée ». Repris tel quel par la story 2.10. Le PRD, lui, garde Q-15 ouverte.
- **UX-DR7 (mécanique de graine)** → `AD-19` : graine dérivée du seul identifiant, ni le nom ni la clé de thème n'y entrent, rien n'est persisté. Concordance mot pour mot avec DESIGN §7.3.

**Aucun composant d'UX n'est architecturalement impossible.** Les 8 composants de DESIGN §7 sont soit du front pur (StatusBadge, StateRail, DetailSurface, BottomNav, ListControlBar), soit adossés à une AD (GeneratedBanner→AD-19, IdentityLabel→AD-12).

**Écarts relevés :**

| # | Écart | Gravité |
|---|---|---|
| 4 | **Les trois palettes de statut n'ont aucune story.** `UX-DR1` (12 valeurs hexadécimales + l'invariant de palette) et `UX-DR2` (couleurs de texte des badges, avec deux pièges de contraste chiffrés) corrigent un **défaut réel constaté dans les tokens actuels** : `status-available: var(--accent-1)` rend l'urgence indistinguable de la normalité en Atelier Cuivré. Aucune des 44 stories ne porte ce travail — l'épic 8 traite les **textes** des thèmes, pas leurs couleurs. Or les stories 2.5, 2.9 et 5.3 **en dépendent** : elles présupposent quatre teintes distinguables. | **Élevée — prérequis non planifié** |
| 5 | **`StateRail` et la règle « en mode liste, la pastille n'est jamais seule ».** `UX-DR4` et EXPERIENCE §4.1 posent que la pastille de 4-8 px est toujours doublée du libellé du signal dominant — c'est l'application de P-1 au mode le plus dense, celui qui affiche ~12 éléments. Aucun AC de 2.5 ni de 2.7 ne l'exige. | Moyenne |
| 6 | **Ordre de priorité entre signaux concurrents.** `UX-DR18` et EXPERIENCE §4.1 bis le définissent (ce qui bloque le démarrage → ce qui a une échéance → ce qui est en retard) et il détermine **la teinte de la carte**. La story 2.5 fixe le plafond de 2 badges mais pas l'ordre. Sans lui, deux implémentations conformes donneront deux couleurs différentes à la même carte. | Moyenne |
| 7 | **Poids des images de couverture au rendu.** La spine le nomme explicitement en *Deferred* (« N × 5 Mo en grande vignette sur mobile — à traiter à la story »). La story 2.10 ne porte aucun AC de dimensionnement ou de rendu. Le report a été fait vers un destinataire qui ne l'a pas reçu. | Moyenne |
| 8 | **Source tree de la spine incohérente avec `AD-13`.** L'arborescence liste `theme/tones/medieval-steampunk.ts` alors qu'`AD-13`, dans le même document, impose le renommage en `atelier-cuivre`. | Faible — coquille, mais dans un document qui sert de plan de fichiers |
| 9 | **`Deferred` de la spine périmé sur Q-13.** La table déclare encore « Q-13 — **Bloquant : à trancher avant l'epic §4.5** […] souffles et éveils existent déjà de bout en bout ». C'est le constat que le PRD a corrigé le 2026-08-05 (les souffles seedés sont les **communs** ; ceux par race manquent). Même origine que les trois conflits internes aux épics : la résolution de Q-13 n'a été répercutée qu'à un seul endroit sur trois. | Moyenne — cohérente avec les conflits relevés à l'étape 3 |

### Warnings

- ⚠️ **Le plancher d'accessibilité n'a jamais été validé.** `UX-DR21` et NFR-2 le formulent (« valeur de conception par défaut, pas critère de recette »), EXPERIENCE §7 dit explicitement « **ce document ne tranche pas** » et « à arbitrer explicitement **avant l'écriture des stories** ». Les stories sont écrites. C'est le seul point où une consigne de séquencement du contrat d'UX a été enjambée.
- ⚠️ **La résolution de Q-13 n'a été propagée qu'au PRD.** Elle laisse derrière elle trois documents en contradiction : l'inventaire et l'Epic List d'`epics.md`, et la table `Deferred` de la spine. Un implémenteur qui ouvre l'un des trois croira l'épic 6 bloqué.
- ✅ **Aucun besoin d'UX n'est architecturalement non supporté**, et aucune contrainte de performance posée par l'UX (animations, densité, fan-out) n'est laissée sans réponse dans la spine — seul leur **portage en critères d'acceptation** est incomplet (écarts 4 à 7).

---

## Step 5 — Epic Quality Review

Revue des 8 épics et 44 stories contre les standards de `create-epics-and-stories`.

### A. Valeur utilisateur des épics

| Épic | Titre | Verdict |
|---|---|---|
| 1 | Compte et identité | ✅ valeur utilisateur, énoncée en résultat (« dispose enfin d'un endroit où vivre ») |
| 2 | Navigation et listes | ✅ |
| 3 | Calendrier | ✅ |
| 4 | Fiche de personnage | ✅ |
| 5 | Vue de partie et chronologie | ✅ |
| 6 | Homme Dragon | ✅ |
| 7 | Entrée dans l'application | ✅ |
| 8 | Thèmes et textes | ⚠️ le plus faible en valeur utilisateur directe — c'est un chantier éditorial et de refactor. Il reste cadré par un bénéfice lisible (« relire un univers d'un seul tenant ») et le PRD l'exige en dernier. **Acceptable**, mais c'est le seul épic dont un utilisateur ne verrait pas la livraison |

**Aucun épic technique.** Pas de « Setup Database », pas d'« API Development », pas d'« Infrastructure ». Les refactors lourds (`toDto()`, `ModeService`, utilitaire d'upload, `revokeSessions`) sont **répartis dans les stories qui en ont besoin**, jamais érigés en épic. C'est exactement le comportement attendu et c'est rare.

### B. Indépendance des épics

**Aucune dépendance avant.** Vérifié épic par épic :

- **Épic 1** se suffit à lui-même, et le document le prouve explicitement : *« l'écran de compte s'accroche au menu existant. L'épic 2 déplacera l'entrée dans la barre de navigation — l'épic 1 ne dépend donc d'aucun épic suivant. »* C'est le traitement exact d'un piège classique.
- **Épic 2** → consomme 1 (préférences, `IdentityLabel`). **Épic 3** → 1. **Épic 4** → 1. **Épic 5** → 1, 2 (badges). **Épic 6** → 1, 4 (`DetailSurface`). **Épic 7** → 1 (thème local). **Épic 8** → tous, par construction.
- Toutes les flèches pointent vers l'arrière. **Aucun cycle.**

**Note de séquencement (pas un défaut) :** l'épic 2 livre une destination « Calendrier » qui pointera sur le calendrier actuel jusqu'à ce que l'épic 3 le refonde. C'est cohérent en brownfield, mais ce n'est écrit nulle part — à mentionner dans les notes de l'épic 2.

### C. Dépendances intra-épic et ordonnancement

Chaque épic dont l'ordre compte le **déclare en tête** :

- Épic 2 : *« la vue mes personnages précède la barre de navigation, sinon l'onglet mène au vide ; la signalétique d'état suit la clôture, sinon aucun signal ne peut porter le statut terminée »* — et la numérotation le respecte (2.2 < 2.3, 2.4 < 2.5).
- Épic 3 : couches (3.4) → endpoint (3.5) → interface (3.6). Écriture groupée (3.2) → glissement (3.3).
- Épic 4 : `DetailSurface` (4.2) avant ses deux consommateurs (4.3, 4.4).
- Épic 6 : souffles seedés (6.2) avant l'export qui les imprime (6.4).

**Aucune story ne référence une story ultérieure.** Vérifié sur les 44.

### D. Création des tables au moment du besoin

Contrôle du piège « épic 1 story 1 crée tout le schéma » :

| Ajout de schéma | Story qui le porte | ✓ |
|---|---|---|
| `User.displayName` (+ migration + `register()`) | 1.1 | ✅ |
| `User.theme` | 1.4 | ✅ |
| `EmailChangeToken` | 1.6 | ✅ |
| `Partie.closedAt` | 2.4 | ✅ |
| `User.hideFinishedParties`, `PartieFavorite` | 2.6 | ✅ |
| 4 scalaires de mode/tri | 2.7 | ✅ |
| `Partie.coverImageUrl` | 2.10 | ✅ |
| `AnnouncementRead` | 2.11 | ✅ |
| `UserCalendarLayer`, `calendarLayersSetAt` | 3.4 | ✅ |
| `Partie.sheetVisibility` | 4.6 | ✅ |

**Onze ajouts de schéma, onze stories différentes, chacune au premier besoin.** Aucune story de migration groupée. Conforme sans exception.

### E. Qualité des critères d'acceptation

**Format :** Given/When/Then sur la totalité des stories. Aucune formulation vague du type « l'utilisateur peut se connecter ».

**Cas d'erreur et cas négatifs — couverture inhabituellement bonne.** Échantillon : mot de passe courant incorrect (1.5), jeton expiré / déjà utilisé / inconnu (1.6), adresse mal saisie jamais confirmée (1.6), retrait du vote d'autrui refusé (3.1), lot en conflit intégralement rejeté (3.2), annulation d'une sélection (3.3), joueur tentant d'ouvrir l'écran MJ (4.7), accès à une partie non membre (4.5), terme sans texte au catalogue (4.3), catalogue re-seedé après retrait d'un souffle (6.2).

**Non-régressions explicitement testées** — le marqueur le plus fiable d'un découpage brownfield mûr : compteur anti-course et SSE conservés à l'identique (2.1), fichier d'export inchangé (4.1), personnage produit équivalent (4.4), Homme Dragon équivalent (6.3), portée des annonces inchangée (2.11), clôture de sondage par le MJ distincte du retrait (3.1), `jest.mock` du test de personnage mis à jour sous peine de test silencieux (2.10).

### F. Violations et points d'attention

#### 🔴 Critique

**V-1 — Une story manquante : les trois palettes de statut.** (Reprise de l'écart 4, étape 4.) `UX-DR1` et `UX-DR2` ne sont portées par aucune des 44 stories. Ce n'est pas un AC oublié, c'est **un travail entier absent du plan**, et il est **prérequis** de 2.5, 2.9 et 5.3 — dont les AC (« quatre teintes seulement », « badge plein », « badge `done` ») présupposent une palette qui n'existe pas encore et qui, en Atelier Cuivré, est aujourd'hui défectueuse.
→ *Remédiation :* créer une story en **tête de l'épic 2** (ou en épic 0 partagé) portant les 12 valeurs, l'invariant de palette, et les deux règles de couleur de texte de `UX-DR2`.

#### 🟠 Majeur

**V-2 — Trois conflits internes bloquants sur l'épic 6.** (Étape 3.) La consigne transverse « D-7 : ne demande aucun travail », l'Epic List « bloqué par Q-13 » et l'inventaire « souffles **et éveils** *(suspendu)* » contredisent frontalement la story 6.2, seule à jour. Un agent d'implémentation qui lit l'en-tête du document **ne fera pas la story 6.2**.
→ *Remédiation :* trois corrections ponctuelles dans `epics.md`, plus la ligne `Deferred` de la spine.

**V-3 — Trois stories surdimensionnées.** Elles restent cohérentes, mais chacune mêle une migration, un refactor à propagation large et de l'UI :

| Story | Charge | Risque |
|---|---|---|
| 2.5 Signalétique d'état | Endpoint neuf + union fermée partagée + requêtes groupées + double émission SSE par membre + badges + plafond + intertitres | La plus lourde du palier après 4.6 |
| 4.6 Cadenas — filtrage serveur | Changement de signature de `toDto()` propagé à ~14 appels + filtrage `sheetData` **et** `derived` + `lockedKeys[]` + 3 exports PDF + `getSchema().lockable` | Refactor à surface large, sur le chemin de lecture le plus emprunté |
| 2.10 Image de couverture | Extraction de l'utilitaire d'upload + 3 consommateurs à mettre à jour + champ + endpoint sous garde + permissions MJ + plafond redéclaré | Le refactor `AD-17` pourrait être sa propre story |

→ *Remédiation :* envisager de scinder 2.10 (refactor de l'utilitaire / fonctionnalité de couverture) et 4.6 (changement de signature `toDto()` / logique de verrouillage). Non bloquant.

**V-4 — Quatre pans d'exigence sans AC.** FR-34 (votes dans le calendrier de partie), FR-10 (filtres date/nom/type), FR-12 (liste des signaux), FR-15 (Détails › Troupe). Détail à l'étape 3.

**V-5 — Trois règles d'UX perdues au passage en stories.** `UX-DR4` (pastille jamais seule en mode liste), `UX-DR18` (ordre de priorité des signaux, qui **détermine la teinte de la carte**), et le dimensionnement des images de couverture que la spine avait explicitement renvoyé « à la story ». Détail à l'étape 4.

#### 🟡 Mineur

**V-6 — Deux stories aux AC non vérifiables par une machine.** Les stories **8.2** (« Given chaque texte affiché → Then il est statué comme relevant d'un thème ou non ») et **8.3** (« Given je relis un thème → Then je lis l'intégralité de ses textes ») décrivent un travail d'audit et de relecture humaine. Le PRD l'assume (« la relecture éditoriale est faite par l'utilisateur lui-même »), mais ces AC ne sont pas des critères de recette — un agent ne peut pas les déclarer satisfaits.
→ *Remédiation :* les requalifier explicitement en stories à revue humaine, ou leur donner un critère vérifiable (ex. 8.2 : « aucun libellé codé en dur ne subsiste dans les composants refondus », vérifiable par recherche).

**V-7 — La section Motion du design system.** `UX-DR8` demande de **créer la section** ; la story 2.9 en implémente les comportements. Le livrable documentaire n'a pas de porteur.

**V-8 — Aucune story ne valide les quatre parcours clés.** `UX-DR22` et EXPERIENCE §8 décrivent quatre parcours de bout en bout (ouverture rapide, levée d'ambiguïté, recherche de date, approche d'une séance). Ils sont couverts *par morceaux* mais aucun AC ne les vérifie **de bout en bout** — or le PRD §8 en fait ses critères de réussite du palier.

**V-9 — Q-1 n'existe nulle part dans les épics.** Le périmètre de la refonte création/édition de partie est une question que le PRD demande de reposer à l'utilisateur. Les épics ne la mentionnent pas — risque d'abandon silencieux plutôt que de report décidé.

**V-10 — Story 2.9 sans ancrage FR.** Légitime (elle porte `UX-DR8`/`UX-DR9` et NFR-9/NFR-12), mais la carte de couverture ne la mentionne pas : la traçabilité **descendante** UX → story n'existe qu'implicitement, là où la traçabilité FR → story est explicite et complète.

### G. Checklist de conformité

| Critère | Épic 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Valeur utilisateur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Fonctionne indépendamment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories bien dimensionnées | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Aucune dépendance avant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tables créées au besoin | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| AC clairs et testables | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Traçabilité aux FR | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |

### H. Éléments brownfield — conformes

- **Aucune story d'amorçage de projet**, et le document le dit explicitement (« l'application existe et tourne ; toutes les stories modifient de l'existant »). Correct : la spine ne prescrit aucun starter template.
- **Points d'intégration nommés** : `ModeService`, `toDto()`, `AuthService.resetPassword()`, `portrait-storage.util.ts`, `ryuutama-pdf.service.ts`, `character.service.spec.ts`, `findAllForPartie`.
- **Stories de migration présentes et rattachées** : `displayName` (1.1), valeurs de `User.theme` au renommage (8.1) — cette dernière avec l'AC de non-perte silencieuse.
- **Cinq refactors imposés listés comme non optionnels**, avec leurs pièges (le `jest.mock` qui devient inopérant sans bruit).
- **Extraction de périmètre préparée** : la paire 4.6 / 4.7 est déclarée extractible, et la story 4.5 (FR-22) ne dépend d'aucune des deux — retirer FR-23 laisse un épic 4 cohérent. Le PRD demandait cette propriété, elle est vérifiée.

---

## Summary and Recommendations

### Overall Readiness Status

## ⚠️ NEEDS WORK — mais de peu

Le corpus de planification est de qualité élevée : quatre contrats produits en boucle, 49 FR toutes tracées, aucun épic technique, aucune dépendance avant, onze migrations rattachées chacune à sa story, et des critères d'acceptation qui testent les cas d'erreur et les non-régressions. **Ce n'est pas un plan à refaire.**

Il reste une **story manquante** et un **jeu d'incohérences documentaires nées d'une résolution de question propagée à un seul endroit sur quatre**. La remédiation est chirurgicale — de l'ordre de la demi-journée — mais elle doit précéder l'implémentation, parce que deux des défauts feraient produire du travail faux plutôt qu'incomplet.

### Critical Issues Requiring Immediate Action

**1. 🔴 Les trois palettes de statut n'ont aucune story** *(V-1)*
`UX-DR1` et `UX-DR2` corrigent un défaut **réel et constaté dans les tokens actuels** : `status-available: var(--accent-1)` rend, en Atelier Cuivré, l'urgence indistinguable de la normalité. Aucune des 44 stories ne porte les 12 valeurs, l'invariant de palette, ni les deux règles de couleur de texte des badges. Or les stories 2.5, 2.9 et 5.3 **présupposent** cette palette.
→ Créer une story en tête de l'épic 2. **Sans elle, trois stories sont bâties sur un socle inexistant.**

**2. 🔴 Trois documents déclarent l'épic 6 bloqué alors qu'il ne l'est plus** *(V-2)*
Q-13 a été tranchée le 2026-08-05 et répercutée **uniquement dans le PRD et dans le corps de l'épic 6**. Restent en contradiction :
- `epics.md` § *Additional Requirements* → « D-7 […] ne demande aucun travail » ;
- `epics.md` § *Epic List* → « bloqué par Q-13 […] FR-26 se réduit au périmètre de FR-24 » ;
- `epics.md` § *Requirements Inventory* → « souffles **et éveils** *(périmètre suspendu à Q-13)* » ;
- `ARCHITECTURE-SPINE.md` § *Deferred* → « **Bloquant : à trancher avant l'epic §4.5** […] souffles et éveils existent déjà de bout en bout ».
→ Un agent d'implémentation qui lit l'en-tête d'`epics.md` **sautera la story 6.2**. Quatre corrections ponctuelles.

**3. 🟠 FR-34 n'a pas de comportement vérifiable**
Le PRD demande les créneaux d'un vote en cours dans le calendrier **de la partie** ; les stories mappées portent sur le calendrier **personnel**. L'exigence ne survit que comme nom de couche.
→ Un AC dans la story 3.6, ou une story de calendrier de partie dans l'épic 3.

**4. 🟠 FR-10 : trois filtres sur cinq sans critère d'acceptation**
Date, nom et type de partie (one-shot / campagne) n'ont aucun AC.
→ Compléter la story 2.6, **ou** retirer explicitement ces critères du PRD. Le silence est le seul choix inacceptable.

### Recommended Next Steps

1. **Écrire la story de palettes de statut** et la placer avant 2.5 dans l'épic 2 (V-1).
2. **Corriger les quatre passages périmés sur Q-13 / D-7** dans `epics.md` (3 endroits) et dans le `Deferred` de la spine (V-2).
3. **Compléter les AC manquants** : FR-34 (3.6), FR-10 (2.6), énumération des signaux `PartySignalCode` (2.5), Détails › Troupe (1.2).
4. **Rapatrier les trois règles d'UX perdues** : pastille jamais seule en mode liste, ordre de priorité entre signaux — qui détermine la teinte de la carte —, dimensionnement des images de couverture.
5. **Arbitrer la couche « disponibilité du groupe »** : la réserver au MJ retire aux joueurs l'`AggregatedSlotDto` qu'ils ont déjà. Décision produit, pas technique.
6. **Faire valider le plancher d'accessibilité** (Q-16 / `UX-DR21`). `EXPERIENCE.md` l'exigeait « avant l'écriture des stories » ; elles sont écrites. C'est la seule consigne de séquencement du contrat d'UX qui ait été enjambée.
7. **Envisager de scinder les stories 2.10 et 4.6** — le refactor d'infrastructure et la fonctionnalité y cohabitent. Optionnel, non bloquant.
8. **Statuer sur Q-1** (périmètre de la refonte création/édition de partie), absente des épics : report décidé plutôt qu'abandon silencieux.
9. **Requalifier les stories 8.2 et 8.3** en travail à revue humaine, ou leur donner un critère vérifiable.

### Final Note

Cette évaluation a relevé **21 constats** répartis en 4 catégories : **1 critique**, **3 majeurs**, **7 moyens**, **10 mineurs**. Les quatre premiers doivent être traités avant l'implémentation — les deux premiers parce qu'ils produiraient du travail **faux**, les deux suivants parce qu'ils produiraient du travail **incomplet sans que personne ne le voie**. Les dix-sept autres peuvent être absorbés au fil des stories.

Deux constats méritent d'être notés au crédit du corpus, parce qu'ils sont rares : **les épics corrigent silencieusement quatre défauts de leurs documents sources** (le glissement de la vue mois traité comme capacité neuve, la partie clôturée sans signal d'action, Q-15 tranchée, Q-17 partiellement tranchée), et **la propriété d'extraction de FR-23 demandée par le PRD est effectivement vérifiée** dans le découpage.

**Origine commune des trois défauts les plus sérieux :** une décision tranchée tardivement (Q-13, le 2026-08-05) et une décision d'UX jamais transformée en story (les palettes). Aucun des deux ne relève d'une faiblesse de méthode — les deux relèvent d'une passe de relecture croisée qui n'a pas eu lieu après le dernier amendement.

---

*Évaluation conduite le 2026-08-05 · 9 documents lus intégralement · 49 FR, 12 NFR, 22 exigences d'UX, 21 décisions d'architecture, 8 épics et 44 stories confrontés.*

---

## Remédiation appliquée le 2026-08-05

Corrections portées aux artefacts **après** l'évaluation, sur décision de l'utilisateur.

> ⚠️ **Renumérotation des épics, postérieure à ce rapport.** Au moment de la planification de sprint, une collision a été constatée : le projet numérote ses épics **en continu depuis le palier 1** (palier 8 = épics 23-27), alors qu'`epics.md` du palier 9 repartait de 1. Les épics ont donc été renumérotés **28 à 35**, et toutes les stories avec eux.
>
> **Toutes les références de ce rapport suivent l'ancienne numérotation.** Table de conversion : épic 1→28, 2→29, 3→30, 4→31, 5→32, 6→33, 7→34, 8→35 ; une story `N.X` devient `(N+27).X`. Ainsi la story des palettes 2.0 → **29.0**, la signalétique 2.5 → **29.5**, les cadenas 4.6/4.7 → **31.6/31.7**, les souffles 6.2 → **33.2**, la création de partie 2.12 → **29.12**.

### Constats traités

| # | Constat | Traitement | Fichier |
|---|---|---|---|
| V-1 | 🔴 Palettes de statut sans story | **Story 2.0 créée** en tête de l'épic 2 : suppression de la dérivation `status-available: var(--accent-1)`, invariant de palette, deux règles de couleur de texte des badges, règle opposable aux thèmes futurs, non-réservation du rouge | `epics.md` |
| V-2 | 🔴 Épic 6 déclaré bloqué par Q-13 dans 4 passages | Les 4 corrigés : inventaire, consigne « à ne pas implémenter » (D-7 requalifiée), notes de l'Epic List, table `Deferred` de la spine | `epics.md`, spine |
| — | 🟠 FR-34 sans comportement vérifiable | **AC ajouté à la story 3.6** : les créneaux d'un vote apparaissent dans le calendrier **de la partie**, distingués des déclarations propres, sans appel supplémentaire | `epics.md` |
| — | 🟠 FR-10 : trois filtres sans AC | **Tranché** : filtres = rôle + statut ; date, nom et type deviennent des critères de **tri**. AC ajoutés à 2.6 énumérant l'union fermée (urgence, date, nom, type, statut) et bornant les filtres. FR-10 réécrite en conséquence | `epics.md`, `prd.md` |
| V-4 | 🟠 FR-12 : signaux non énumérés | **AC ajouté à 2.5** énumérant les dix codes de `PartySignalCode` | `epics.md` |
| V-4 | 🟡 FR-15 : Détails › Troupe | **AC ajouté à 1.2** sur le cas concret nommé par le PRD | `epics.md` |
| V-5 | 🟠 `UX-DR4` pastille jamais seule | **AC ajouté à 2.5** | `epics.md` |
| V-5 | 🟠 `UX-DR18` ordre de priorité des signaux | **AC ajouté à 2.5**, teinte de carte comprise, avec la règle « une partie terminée reste en teinte terminé même si un rapport manque » | `epics.md` |
| V-5 | 🟠 Poids des images de couverture | **AC ajouté à 2.10** : image dimensionnée par mode, jamais le fichier d'origine | `epics.md` |
| V-9 | 🟡 Q-1 absente des épics | **Retenue dans le palier 9** : story 2.12 créée, avec l'exigence explicite que le périmètre soit arbitré avec l'utilisateur au démarrage. Q-1 mise à jour au PRD | `epics.md`, `prd.md` |
| — | 🟠 Plancher d'accessibilité non validé | **Validé par l'utilisateur.** Q-16 close au PRD ; `EXPERIENCE.md` §7 ne dit plus « ce document ne tranche pas » ; point ouvert n°1 d'EXPERIENCE clos. Recours au quatrième thème confirmé comme réponse en cas de besoin réel | `prd.md`, `EXPERIENCE.md` |
| — | 🟠 Couche « disponibilité du groupe » réservée au MJ, contre `AggregatedSlotDto` | **Tranché : couche accessible à tous les membres, contenu dépendant du rôle** — par membre et nommément pour le MJ, compteurs anonymes pour un joueur. Aucune régression, `AD-9` inchangée, aucune troisième forme d'agrégation. Trois AC ajoutés à 3.4 ; FR-46 et `EXPERIENCE.md` §2/§4.3 mis à jour | `epics.md`, `prd.md`, `EXPERIENCE.md` |
| V-8 / V-10 | 🟡 Traçabilité UX descendante | **Table « Exigences d'UX sans ancrage FR » ajoutée** après la carte de couverture : `UX-DR1`/`UX-DR2` → 2.0, `UX-DR8`/`UX-DR9` → 2.9, `UX-DR22` → recette de palier | `epics.md` |
| — | 🟡 Coquille de source tree | `medieval-steampunk.ts` → `atelier-cuivre.ts` | spine |
| — | 🟡 Séquencement de la destination Calendrier | Note ajoutée aux notes de l'épic 2 | `epics.md` |

### Constats laissés ouverts

| # | Constat | Raison |
|---|---|---|
| V-3 | Stories 2.5, 4.6 et 2.10 surdimensionnées | Signalé, non scindé — décision volontaire : chacune reste cohérente et le découpage se rediscutera au sprint planning si besoin |
| V-6 | Stories 8.2 et 8.3 aux AC non machine-vérifiables | Assumé par le PRD (« la relecture éditoriale est faite par l'utilisateur lui-même ») ; à traiter comme stories à revue humaine |
| V-7 | Section Motion du design system sans porteur documentaire | Absorbée en pratique par la story 2.9 ; livrable de documentation à faire au fil de l'eau |
| — | Correctifs #8 et #9 de la revue d'exactitude non répercutés au PRD | Sans effet : les épics portent déjà la bonne règle (partie close sans signal d'action, glissement mois comme capacité neuve). Le PRD est en retard sur les épics, pas en contradiction avec eux |

### État après remédiation

## ✅ READY

**Les deux constats critiques, les trois majeurs et l'intégralité des constats moyens sont traités.** Ne subsistent que quatre constats mineurs, tous consciemment acceptés : le dimensionnement de trois stories, deux stories éditoriales à revue humaine, un livrable de documentation, et un PRD en léger retard sur les épics sans contradiction avec eux.

`epics.md` compte désormais **46 stories** (2.0 et 2.12 ajoutées). Aucun épic n'est bloqué. Le palier peut entrer en planification de sprint.
