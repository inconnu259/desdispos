---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-20260626/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-06-27/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260626/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260626/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-20260703/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-20260703/addendum.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/EXPERIENCE.md"
---

# jdr-master - Epic Breakdown — Palier 2 : Calendrier + Palier P3 : Moteur plugin & Ryuutama

## Overview

Ce document décompose les requirements du PRD, de l'architecture et des specs UX du Palier 2 (Calendrier) en epics et stories implémentables pour l'agent développeur.

## Requirements Inventory

### Functional Requirements

FR1: Un utilisateur peut créer une déclaration UNAVAILABLE (récurrente = pattern hebdo jour+slot, ou ponctuelle = plage de dates+slot), avec granularité FULL_DAY / MORNING / AFTERNOON / EVENING, et une date d'expiration obligatoire.
FR2: Un utilisateur peut créer une déclaration AVAILABLE (même structure qu'UNAVAILABLE) pour déclarer explicitement sa disponibilité sur un créneau.
FR3: Dans la "période couverte" (union des plages temporelles de toutes les déclarations actives de l'utilisateur), les créneaux non mentionnés sont inférés AVAILABLE (inférence positive).
FR4: Hors de la période couverte, les créneaux non mentionnés sont UNKNOWN (traités comme "peut-être" dans le calcul de créneaux).
FR5: Toute déclaration a une date d'expiration obligatoire (défaut 6 mois pour récurrente, date de fin explicite pour ponctuelle). Les déclarations expirées sont archivées (pas supprimées) — renouvellement facilité.
FR6: Les déclarations expirant dans ≤14 jours affichent un indicateur visuel et une CTA de renouvellement.
FR7: Le système calcule (à la demande) les 5 prochains créneaux où aucun membre d'une partie n'est UNAVAILABLE, sur une fenêtre configurable (défaut 8 semaines). Les membres UNKNOWN ne bloquent pas le créneau mais sont signalés.
FR8: Le MJ accède depuis la page détail de la partie à la vue "Trouver une date" listant les 5 prochains créneaux calculés.
FR9: Chaque créneau calculé affiche le statut de chaque membre de la partie (AVAILABLE / UNAVAILABLE / UNKNOWN) avec badge nominatif (pseudo + emoji de classe de personnage).
FR10: Un membre sans aucune déclaration active affiche un indicateur "X membres sans données" — ses créneaux sont UNKNOWN mais n'excluent pas le slot des résultats.
FR11: Le MJ peut créer un vote avec 2 à 4 dates candidates (issues des créneaux calculés ou librement choisies), avec un libellé de scénario optionnel (scenarioRef, texte libre).
FR12: Chaque membre de la partie répond pour chaque option du vote : YES / NO / MAYBE. Deadline optionnelle (défaut 7 jours) ; le vote se ferme automatiquement à la deadline.
FR13: Il ne peut y avoir qu'un seul vote OPEN par partie à la fois. Créer un nouveau vote ferme automatiquement le précédent.
FR14: Le MJ consulte le récapitulatif du vote (YES/NO/MAYBE par option par membre) et choisit manuellement la date finale.
FR15: La date finale choisie est enregistrée comme "prochaine séance" sur la partie.
FR16: Un joueur reçoit une notification in-app (badge/bandeau) quand un vote est ouvert sur une de ses parties.
FR17: Le MJ reçoit une notification in-app quand tous les membres ont répondu avant la deadline.
FR18: La page détail d'une partie (vue MJ) affiche : la prochaine date confirmée, un bouton "Trouver une date", et l'état du vote en cours (si actif).
FR19: Le tableau de bord joueur affiche pour chaque partie : la prochaine date confirmée et un badge si un vote est en attente de sa réponse.
FR20: Un utilisateur peut choisir son thème visuel parmi 3 options (Grimoire Émeraude, Forêt Ancienne, Médiéval Steampunk) depuis ses préférences. Le choix est persisté (localStorage) et change simultanément le thème CSS et le registre de microcopy de toute l'interface.
FR21: Un joueur membre d'une partie peut consulter la disponibilité agrégée de son groupe pour cette partie (combien de membres sont disponibles, indisponibles ou inconnus sur chaque créneau), sans voir l'identité des membres individuels ni leurs déclarations personnelles. Seul le MJ accède à la vue détaillée par membre.
FR22: Un membre (MJ ou joueur) peut spécifier une fenêtre de dates pour la recherche de créneaux disponibles (date début / date fin), au lieu d'une fenêtre fixe "8 semaines à partir d'aujourd'hui". La fenêtre par défaut reste aujourd'hui + 8 semaines si aucune plage n'est précisée.

**Palier P3 — Moteur plugin & Ryuutama (`prd-jdr-master-20260703`) :**

FR23: Le backend expose un `GameSystemRegistry` (module `GameSystemModule`) listant les systèmes de jeu installés (id, name, version). Un seul système enregistré ce palier : Ryuutama.
FR24: Chaque système de jeu implémente l'interface `GameSystemPlugin` (`sheetSchema`, `creationSteps`, `createBlankCharacter`, `validate(data, mode)`, `computeDerived`, `exportPDF`) — sous-ensemble de l'interface complète de `docs/spec.md` §5 (canSpendXp/applyXp/contentTypes différés).
FR25: Le front Angular affiche l'assistant de création et la fiche à partir de `sheetSchema()`/`creationSteps()`, sans code spécifique à Ryuutama codé en dur dans les composants génériques.
FR26: Le contenu de base Ryuutama (7 classes + talents, 3 types, pattern d'attributs Polyvalent, 5 catégories d'armes favorites) est chargé en base au démarrage via `ContentType`/`ContentEntry` (scope `base`).
FR27: Les fichiers JSON de seed Ryuutama vivent dans un dossier dédié, explicitement exclu du dépôt Git (contenu sous droits d'auteur) ; chaque instance fournit son propre seed localement.
FR28: Un joueur choisit 1 classe parmi 7 ; l'UI affiche les 3 talents de la classe sélectionnée avant validation de l'étape. Sous-choix obligatoire pour la classe Artisan (type d'objet de spécialité).
FR29: Un joueur choisit 1 type parmi Attaque/Technique/Magie ; les avantages passifs s'affichent. Si Magie est choisi, un message explicite notifie que le choix de sorts n'est pas encore disponible.
FR30: Un joueur répartit librement les 4 valeurs du pattern d'attributs choisi (Polyvalent : {8,4,6,6}) entre AGI/ESP/INT/VIG.
FR31: Les statistiques dérivées (PV=VIG×2, PE=ESP×2, Condition=VIG+ESP, Initiative=AGI+INT, Encombrement=VIG+3) se recalculent en direct côté client dès que les attributs sont assignés, avant validation finale.
FR32: Un joueur choisit 1 arme favorite parmi 5 catégories (arc, épée courte, épée longue, hache, lance) ; elle est ajoutée gratuitement à l'équipement de départ.
FR33: Un joueur renseigne un objet fétiche (texte libre, optionnel, sans effet mécanique).
FR34: L'équipement de départ est attribué automatiquement en mode "pique-nique" (nécessaire de voyage + nécessaire d'intendance de groupe), sans achat ni catalogue ce palier.
FR35: Un joueur renseigne des champs narratifs optionnels (sexe, âge, particularités, village natal, motivation, nom, personnalité), sans effet mécanique.
FR36: À la soumission, `validate(data, "strict")` vérifie les règles strictes (1 classe, 1 type, attributs conformes au pattern, 1 arme favorite valide, sous-choix Artisan) ; échec = blocage dur avec liste d'erreurs contextualisées, pas de dérogation ce palier.
FR37: Le personnage créé est consultable en lecture seule (fiche reproduisant visuellement la disposition papier officielle, desktop/tablette 2 colonnes, mobile en sections empilables).
FR38: Un joueur peut exporter sa fiche en PDF via `exportPDF()`, en remplissant la fiche officielle vierge Ryuutama.
FR39: Le MJ d'une partie peut consulter en lecture seule la fiche de n'importe quel personnage de ses joueurs sur cette partie.
FR40: Un joueur peut uploader un portrait de personnage avec recadrage/zoom/repositionnement, disponible en étape optionnelle skippable pendant la création ET modifiable après coup depuis la fiche. Sans portrait, l'avatar affiche les initiales ; avec portrait, l'avatar affiche la version recadrée et la fiche affiche en plus l'image complète non recadrée.
FR41: Le MJ distingue visuellement ses propres personnages de ceux de ses joueurs (badge + pseudo propriétaire) dans la liste et sur la fiche ; l'export PDF renseigne le champ "Joueur" (pseudo du propriétaire) et intègre le portrait (centré, ne débordant jamais du cadre) quand il existe.
FR42: Un joueur peut ajuster un recadrage dédié (zoom/repositionnement) de son portrait spécifiquement pour le cadre rectangulaire de l'export PDF, indépendamment du recadrage circulaire de son avatar web. Sans ajustement dédié, l'export utilise le centrage automatique (FR41).

### NonFunctional Requirements

NFR1: Mobile-first — l'interface de déclaration de disponibilités et de réponse au vote est conçue pour mobile (touch targets ≥44px, pas de tableaux larges).
NFR2: Performance — GET /parties/:id/available-slots retourne un résultat en <1s pour 6 membres sur 8 semaines.
NFR3: Cohérence des données — un membre retiré d'une partie (Membership supprimé) est exclu du calcul des créneaux pour cette partie ; ses déclarations globales restent intactes.
NFR4: Confidentialité du seed — les fichiers JSON de contenu de règles Ryuutama ne sont jamais committés dans le dépôt Git. *(NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.)*
NFR5: Architecture réutilisable — l'interface `GameSystemPlugin` implémentée ce palier doit être directement réutilisable pour le prochain système (Conte de Minuit) sans modification de signature.
NFR6: Mobile-first pour la consultation — l'accès à la fiche en séance se fait principalement sur mobile ; la création peut tolérer une UX plus dense.
NFR7: Performance — `computeDerived()` s'exécute côté client en temps réel sans appel réseau pendant la création.

### Additional Requirements

- [ARCH] Créer AvailabilityModule dans apps/api/src/availability/ avec AvailabilityService (propriétaire exclusif de computeSlotStatus), exporté vers PartiesModule et PollModule.
- [ARCH] Créer PollModule dans apps/api/src/poll/, importe PartiesModule + AvailabilityModule.
- [ARCH] PartiesModule importe AvailabilityModule ; PartiesController expose GET /parties/:id/available-slots ; PartiesService.getAvailableSlots charge les membres en une requête et appelle computeSlotStatus en mémoire (pas de N+1).
- [ARCH] computeSlotStatus charge toutes les déclarations actives des membres en une seule requête SQL (WHERE userId IN [...] AND expiresAt > NOW()), puis opère en mémoire.
- [ARCH] PollService enforce "un seul OPEN poll par partie" : ferme l'OPEN existant avant d'en créer un nouveau.
- [ARCH] Migration Prisma `calendar_p2` : 5 nouveaux modèles (AvailabilityDeclaration, SessionPoll, PollOption, PollVote) + 5 enums (DaySlot, RecurKind, AvailKind, PollStatus, VoteAnswer).
- [ARCH] Ajouter dans packages/shared : types DaySlot, AvailKind, RecurKind, PollStatus, VoteAnswer, SlotStatus + DTOs (AvailabilityDeclarationDto, CreateAvailabilityDto, AvailableSlotDto, AggregatedSlotDto, SessionPollDto, PollOptionDto, PollVoteDto).
- [ARCH] `AggregatedSlotDto` = `{ date: string, slot: DaySlot, available: number, unavailable: number, unknown: number, total: number }` — pas d'informations nominatives, utilisé pour la vue joueur.
- [ARCH] `GET /parties/:id/available-slots` distingue le rôle de l'appelant : si MJ → `AvailableSlotDto[]` (détail par membre) ; si membre non-MJ → `AggregatedSlotDto[]` (comptage anonyme). Même endpoint, réponse polymorphe selon le rôle (discriminé côté API par la Membership.role).

**Palier P3 :**

- [ARCH] `GameSystemModule` (apps/api/src/game-systems/) expose `GameSystemRegistry` ; enregistre le plugin `ryuutama`.
- [ARCH] Modèles Prisma `ContentType`/`ContentEntry` (scope BASE/MJ/PARTIE, seul BASE utilisé ce palier) pour le contenu de règles extensible ; `Character` (sheetData/derived en JSONB, + portraitUrl/portraitCropData).
- [ARCH] `validate(data, mode: "strict" | "mj")` — signature complète conservée dès ce palier (mode "mj" en no-op réservé à P4) pour éviter de la retoucher plus tard.
- [ARCH] `exportPDF(data, format: "editable" | "2pages"): Buffer` fait partie du contrat `GameSystemPlugin`, pas un mécanisme séparé. Remplit les 126 champs AcroForm du template "edit" via `pdf-lib`, aplatit (`form.flatten()`) uniquement pour le format "2pages".
- [ARCH] Dossier de seed JSON Ryuutama explicitement gitignoré (contenu sous droits) — README documentant le format attendu. *(NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.)*
- [ARCH] `computeDerived()` et `validate()` vivent dans un nouveau package workspace `packages/game-rules` (fonctions pures, zéro dépendance Angular/Nest), importé par `apps/web` et `apps/api` — pas de duplication de logique de calcul entre front et back.
- [ARCH] Endpoints `PUT`/`DELETE /characters/:id/portrait` pour l'upload/suppression du portrait.

### UX Design Requirements

UX-DR1: Implémenter 3 thèmes CSS switchables (Grimoire Émeraude, Forêt Ancienne, Médiéval Steampunk) via CSS custom properties sur body. Thème persisté dans localStorage. Sélecteur de thème dans les préférences utilisateur.
UX-DR2: ThemeToneService (Angular Signal) avec 3 jeux de microcopy (~25-30 clés chacun). Changer le thème change atomiquement CSS + microcopy. Microcopy thématisé : Grimoire (magie/bibliothèque), Forêt Ancienne (nature/elfes), Médiéval Steampunk (engrenages/vapeur).
UX-DR3: CalendarMonthView : 3 segments colorés en bas de chaque case de jour (Matin | AM | Soir), couleurs par statut (vert=AVAILABLE, rouge=UNAVAILABLE, gris=UNKNOWN, ambre=FULL_DAY avec conflit). Tap sur une case → ConstraintPanel.
UX-DR4: CalendarWeekView : grille 7 colonnes (jours) × 3 lignes (Matin / Après-midi / Soirée), cellules colorées par statut. Tap/clic sur une cellule → ConstraintPanel.
UX-DR5: ConstraintPanel : bottom-sheet sur mobile, side-panel droit 320px sur desktop. Contenu : toggle UNAVAILABLE/AVAILABLE, sélecteur type (ponctuel/récurrent/plage de dates), date d'expiration, boutons Annuler/Sauvegarder.
UX-DR6: Layout desktop MJ pour /parties/:id/calendar : split 60/40 (calendrier gauche, panneau résultats sticky droit). Sur mobile : calendrier et panneau résultats sont deux écrans distincts.
UX-DR7: CreneauCard : affiche date+slot, badges nominatifs par membre (pseudo + emoji classe + icône statut), bouton action MJ ("Convoquer le conseil").
UX-DR8: PollFlow : création (MJ choisit 2-4 dates) → réponse (joueur YES/NO/MAYBE par option) → résultat (MJ voit récap et choisit la date finale).
UX-DR9: Accessibilité : touch targets ≥44px sur les cellules du calendrier mobile, aria-labels sur chacun des 3 segments ("Matin : disponible"), ordre de focus correct dans ConstraintPanel.
UX-DR10: Tous les empty states, toasts de succès, messages d'erreur et alertes d'expiration utilisent le microcopy JDR thématisé via ThemeToneService.tone.
UX-DR11: Indicateur d'expiration : déclarations expirant dans ≤14 jours affichent un badge d'avertissement visuel + CTA de renouvellement.
UX-DR12: Sélecteur de thème dans les préférences utilisateur : 3 options (avec nom thématisé), prévisualisation du thème actif.

**Palier P3 :**

UX-DR13: Avatar — cercle 44px (liste) ou 64px (fiche), initiales par défaut, image recadrée (`object-fit: cover`) si portrait présent. Lien "Modifier le portrait" en `{colors.accent-2}` à proximité.
UX-DR14: PortraitPanel — carte affichant l'image complète non recadrée du portrait, n'apparaît que si un portrait existe (pas de placeholder vide).
UX-DR15: WizardLayout desktop (≥1024px) : 65% zone principale (étape courante) / 35% panneau latéral résumé (réutilise SlotPanel), mise à jour live des stats dérivées à chaque changement d'attribut.
UX-DR16: WizardLayout mobile (<768px) : une étape par écran, barre de progression avec libellé textuel de l'étape (pas de points abstraits), navigation via barre inférieure fixe Précédent/Suivant (≥44px).
UX-DR17: ChoiceCard (réutilise PollOption) : grille de cartes cliquables pour classe/type/arme favorite, affichage immédiat du détail informatif associé sans navigation supplémentaire.
UX-DR18: CharacterSummaryCard (réutilise CreneauCard + AvailabilityBadge) : avatar + nom + classe + badges de stats dérivées (PV/PE/Initiative/Encombrement) dans la liste de l'onglet Personnages.
UX-DR19: Nouvelles clés microcopy `character.*` (7 clés : create_cta, tab_label, step_class, step_type, magic_deferred_notice, portrait_missing, portrait_edit_cta) déclinées dans les 3 thèmes existants via ThemeToneService.
UX-DR20: Nouvel onglet "Personnages" dans la page détail de partie (à côté de Calendrier/Vote existants) — pas de nouvelle entrée dans la toolbar globale.
UX-DR21: Accessibilité spécifique : aria-label complet sur chaque ChoiceCard ("[Nom classe] : [talents résumés]"), `aria-live="polite"` sur le libellé d'étape du wizard, alt/aria-label explicite pour l'avatar sans portrait ("Portrait de [Nom] (aucune image)", jamais un état d'erreur).

### FR Coverage Map

FR1: Epic 1 — Créer déclaration UNAVAILABLE (récurrente/ponctuelle, granularité slot)
FR2: Epic 1 — Créer déclaration AVAILABLE (même structure)
FR3: Epic 1 — Logique période couverte → inférence AVAILABLE
FR4: Epic 1 — Hors période couverte → UNKNOWN
FR5: Epic 1 — Expiration obligatoire + archivage
FR6: Epic 1 — Indicateur expiration ≤14 jours + CTA renouvellement
FR7: Epic 2 — Calcul 5 prochains créneaux (intersection membres)
FR8: Epic 2 — Vue MJ "Trouver une date" depuis page partie
FR9: Epic 2 — Statuts AVAILABLE/UNAVAILABLE/UNKNOWN par membre + badges
FR10: Epic 2 — Indicateur "X membres sans données"
FR11: Epic 3 — Création vote MJ (2-4 dates, scenarioRef optionnel)
FR12: Epic 3 — Réponse joueur YES/NO/MAYBE, deadline 7j auto-close
FR13: Epic 3 — Un seul OPEN poll par partie (auto-close précédent)
FR14: Epic 3 — Récapitulatif vote + choix date finale MJ
FR15: Epic 3 — Date finale enregistrée comme prochaine séance
FR16: Epic 3 — Badge in-app joueur (vote en attente)
FR17: Epic 3 — Notification in-app MJ (tous ont répondu)
FR18: Epic 2 (bouton "Trouver une date" + prochaine date) + Epic 3 (widget vote en cours)
FR19: Epic 3 — Badge dashboard joueur (prochaine date + vote en attente)
FR20: Epic 1 — Sélecteur de thème (3 options, persisté localStorage)
FR21: Epic 2 — Vue joueur agrégée (comptage anonyme disponibles/indisponibles/inconnus) via Story 2.4
FR22: Epic 2 — Fenêtre de planification configurable (from/to) via Story 2.5

FR23: Epic 4 — Registre GameSystemRegistry (id/name/version, ryuutama)
FR24: Epic 4 — Interface GameSystemPlugin (sous-ensemble)
FR25: Epic 4 — Front générique piloté par schéma
FR26: Epic 4 — Seed de contenu Ryuutama (ContentType/ContentEntry scope base)
FR27: Epic 4 — Seed hors dépôt Git (gitignore, contenu sous droits) *(NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.)*
FR28: Epic 4 — Choix de la classe (7 classes, 3 talents affichés, sous-choix Artisan)
FR29: Epic 4 — Choix du type (Attaque/Technique/Magie, notice différée si Magie)
FR30: Epic 4 — Répartition des attributs (pattern Polyvalent)
FR31: Epic 4 — Calcul live des statistiques dérivées
FR32: Epic 4 — Choix de l'arme favorite
FR33: Epic 4 — Objet fétiche (texte libre)
FR34: Epic 4 — Équipement pique-nique (automatique)
FR35: Epic 4 — Champs narratifs (texte libre)
FR36: Epic 4 — Validation finale stricte (blocage dur)
FR37: Epic 4 — Vue fiche en lecture seule (desktop 2 colonnes / mobile accordéon)
FR38: Epic 4 — Export PDF (2 options : éditable et 2 pages, via le fichier officiel avec champs AcroForm ; option 1 page différée)
FR39: Epic 4 — Accès MJ à la fiche de ses joueurs
FR40: Epic 4 — Portrait de personnage (upload/recadrage, étape optionnelle + édition après coup)
FR41: Epic 4 — Distinction MJ/joueur + attribution PDF (champ "Joueur" + portrait centré)
FR42: Epic 4 — Recadrage dédié du portrait pour l'export PDF (Story 4.7)

## Epic List

### Epic 1 : Déclarations de disponibilités & Expérience thématisée
Un utilisateur (MJ ou joueur) peut déclarer ses contraintes de disponibilité dans un calendrier visuel et personnaliser le thème de l'interface. C'est la pierre angulaire du palier 2 : sans ces données, aucun calcul n'est possible.
**FRs couverts :** FR1, FR2, FR3, FR4, FR5, FR6, FR20
**ARCH :** Migration Prisma `calendar_p2`, AvailabilityModule + controller/service/DTOs, Shared types (enums + DTOs availability), ThemeToneService + 3 tones, CalendarViewComponent (mode personal), CalendarMonthView, CalendarWeekView, ConstraintPanel
**UX-DR :** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR9, UX-DR10, UX-DR11, UX-DR12

### Epic 2 : Visibilité croisée & Trouver une date
Le MJ et les joueurs peuvent voir la disponibilité du groupe pour une partie. Le MJ accède à la vue détaillée par membre (badges nominatifs), les joueurs voient un comptage agrégé anonyme. La fenêtre de recherche est configurable.
**FRs couverts :** FR7, FR8, FR9, FR10, FR18 (partiel), FR21, FR22
**ARCH :** `PartiesService.getAvailableSlots` (rôle-aware), `AvailabilityService.computeSlotStatus`, `GET /parties/:id/available-slots` (réponse polymorphe MJ/joueur), `AggregatedSlotDto`, CalendarViewComponent (modes mj + player), split layout 60/40 desktop, CreneauCard, fenêtre de planification from/to
**UX-DR :** UX-DR6, UX-DR7 + NFR2, NFR3

### Epic 3 : Vote de date & Widgets d'intégration
Le MJ peut lancer un vote sur des créneaux candidats, les joueurs répondent depuis leur dashboard, la date finale est choisie et s'affiche partout dans l'application.
**FRs couverts :** FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18 (partiel : widget vote en cours), FR19
**ARCH :** PollModule + PollController + PollService (enforce single OPEN), Shared types (SessionPollDto, PollOptionDto, PollVoteDto), PollFlow Angular components, badges dashboard joueur
**UX-DR :** UX-DR8, UX-DR10 (microcopy vote)

### Epic 4 : Personnages Ryuutama — Moteur plugin & création guidée
Un joueur peut créer un personnage Ryuutama complet via un assistant guidé, le consulter (avec portrait optionnel), l'exporter en PDF, et le MJ peut consulter les personnages de ses joueurs — le tout posant une architecture `GameSystemPlugin` réutilisable pour les futurs systèmes.
**FRs couverts :** FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42
**ARCH :** GameSystemModule + GameSystemRegistry, ContentType/ContentEntry (scope base), Character model (JSONB + portrait), plugin `ryuutama` (validate/computeDerived/exportPDF), seed JSON gitignoré
**UX-DR :** UX-DR13, UX-DR14, UX-DR15, UX-DR16, UX-DR17, UX-DR18, UX-DR19, UX-DR20, UX-DR21 + NFR4, NFR5, NFR6, NFR7

---

## Epic 1 : Déclarations de disponibilités & Expérience thématisée

Un utilisateur (MJ ou joueur) peut déclarer ses contraintes de disponibilité dans un calendrier visuel thématisé. C'est la fondation du palier 2 : sans ces données, aucun calcul n'est possible.

### Story 1.1 : API disponibilités — CRUD complet

As a user (MJ or player),
I want to manage my availability declarations via the API,
So that the system can compute when I'm free to play.

**Acceptance Criteria:**

**Given** the Prisma schema does not yet have availability models
**When** the developer runs `prisma migrate dev --name calendar_p2`
**Then** the migration creates the `AvailabilityDeclaration` model with all fields (id, userId, kind, recurKind, dayOfWeek, slot, startDate, endDate, expiresAt, createdAt), the enums `DaySlot`, `RecurKind`, `AvailKind`, and the index `@@index([userId, expiresAt])`
**And** the shared package `@master-jdr/shared` exports `DaySlot`, `AvailKind`, `RecurKind`, `SlotStatus`, `AvailabilityDeclarationDto`, and `CreateAvailabilityDto`

**Given** an authenticated user
**When** they call `POST /availability` with `{ kind: "UNAVAILABLE", recurKind: "RECURRING", dayOfWeek: 2, slot: "EVENING", expiresAt: "2027-01-01" }`
**Then** a new `AvailabilityDeclaration` is created linked to `req.user.id`
**And** the response returns the created declaration (201)

**Given** an authenticated user
**When** they call `POST /availability` with `{ kind: "AVAILABLE", recurKind: "PUNCTUAL", slot: "FULL_DAY", startDate: "2026-07-12", endDate: "2026-07-12", expiresAt: "2026-07-13" }`
**Then** a ponctuelle AVAILABLE declaration is created

**Given** an authenticated user with active declarations
**When** they call `GET /availability`
**Then** they receive only their own declarations where `expiresAt > now()` (archived declarations excluded)

**Given** an authenticated user
**When** they call `PATCH /availability/:id` with updated fields
**Then** the declaration is updated (only their own — 403 if different userId)

**Given** an authenticated user
**When** they call `DELETE /availability/:id`
**Then** the declaration is soft-archived (expiresAt set to now()) rather than hard-deleted

**Given** an unauthenticated request
**When** any `/availability` endpoint is called
**Then** the response is 401 Unauthorized

**Given** `AvailabilityService.computeSlotStatus(declarations, date, slot)` is unit tested (Jest, `availability.service.spec.ts`)
**When** the test suite runs
**Then** the following cases pass:
  - UNAVAILABLE declaration covering date+slot → returns `UNAVAILABLE`
  - AVAILABLE declaration covering date+slot → returns `AVAILABLE`
  - UNAVAILABLE takes priority over AVAILABLE on same slot → returns `UNAVAILABLE`
  - Date within covered period, no declaration on slot → returns `AVAILABLE` (positive inference)
  - Date outside covered period, no declaration → returns `UNKNOWN`
  - Expired declaration (expiresAt < now) is ignored → slot falls back to covered-period logic
  - RECURRING declaration: matches correct dayOfWeek only → no false positives on other days

---

### Story 1.2 : Sélecteur de thème & ThemeToneService

As a user,
I want to choose my visual theme from 3 options,
So that the interface reflects my preferred RPG universe.

**Acceptance Criteria:**

**Given** the Angular app is running
**When** `ThemeToneService` is instantiated
**Then** it reads the saved theme from `localStorage` (key: `jdr-theme`), defaults to `grimoire-emeraude` if absent
**And** it applies the corresponding CSS class (`theme-grimoire-emeraude`, `theme-foret-ancienne`, or `theme-medieval-steampunk`) on `document.body`
**And** it exposes a `computed` signal `tone` returning the microcopy `Record<string, string>` for the active theme

**Given** a user on the profile/settings page
**When** they see the theme selector
**Then** 3 options are shown with their thematic names (e.g. "Grimoire Émeraude", "Forêt Ancienne", "Médiéval Steampunk")
**And** the currently active theme is visually highlighted

**Given** a user selects "Forêt Ancienne"
**When** the selection is confirmed
**Then** `ThemeToneService.setTheme('foret-ancienne')` is called
**And** the CSS class on `document.body` changes immediately (no page reload)
**And** all components consuming `ThemeToneService.tone` re-render with the Forêt Ancienne microcopy
**And** `localStorage` is updated with the new theme

**Given** the `tones.ts` file in `core/theme/`
**When** a developer inspects it
**Then** it exports `TONE_MAP` with exactly 3 keys (`grimoire-emeraude`, `foret-ancienne`, `medieval-steampunk`), each containing at minimum the keys: `cta.find_date`, `cta.launch_vote`, `cta.save_constraint`, `cta.send_reminder`, `section.slots`, `section.constraints`, `empty.no_slots`, `empty.no_constraints`, `success.constraint_saved`, `alert.expiring_soon`, `alert.missing_player`, `status.unavailable_label`, `status.unknown_label`

---

### Story 1.3 : Calendrier personnel — vue mois

As a user,
I want to see my monthly calendar showing my declared constraints per slot,
So that I can visualize at a glance when I'm available or not.

**Acceptance Criteria:**

**Given** an authenticated user navigates to `/profile/calendar`
**When** the page loads
**Then** the `CalendarViewComponent` (mode: `personal`) is displayed
**And** `AvailabilityService.getMyDeclarations()` is called to load active declarations
**And** the current month is shown as a 7-column grid

**Given** the month view is displayed
**When** the user looks at any day cell
**Then** 3 colored segments are visible at the bottom of the cell (left=Matin, center=AM, right=Soir)
**And** each segment is colored according to `computeDisplayStatus(date, slot, declarations)`:
  - Vert (`--color-available`) = AVAILABLE (explicit or inferred in covered period)
  - Rouge (`--color-unavailable`) = UNAVAILABLE
  - Gris pointillé (`--color-unknown`) = UNKNOWN (outside covered period)
  - Ambre (`--color-mixed`) = FULL_DAY declaration with partial slot conflict

**Given** a day cell with 3 segments
**When** a screen reader announces the cell
**Then** each segment has an `aria-label` in the format "Matin : disponible", "Après-midi : indisponible", "Soirée : inconnu"

**Given** the month view
**When** the user taps/clicks the month header navigation `<` or `>`
**Then** the displayed month changes and declarations are recalculated for the new month

**Given** an Angular `AvailabilityService` in `core/availability/`
**When** a developer inspects it
**Then** it exposes `getMyDeclarations(): Promise<AvailabilityDeclarationDto[]>` calling `GET /availability` with session credentials

---

### Story 1.4 : Déclarer une contrainte depuis le calendrier

As a user,
I want to tap a day in my calendar and declare an availability constraint,
So that I can manage my schedule directly from the calendar without navigating elsewhere.

**Acceptance Criteria:**

**Given** the calendar (month or week view) is displayed
**When** the user taps/clicks a day cell or slot cell
**Then** the `ConstraintPanel` opens:
  - On mobile (< 768px): as a bottom-sheet sliding up
  - On desktop (≥ 768px): as a 320px right side-panel sliding in

**Given** the `ConstraintPanel` is open for "Mercredi 2 juillet — Soirée"
**When** the user views the panel
**Then** the title shows the selected day and slot
**And** a toggle allows switching between "Indisponible" and "Disponible"
**And** a type selector offers 3 options: "Ce créneau uniquement", "Récurrent (chaque semaine)", "Plage de dates"
**And** an expiration date picker is visible (required field, default +6 months for recurring)
**And** "Annuler" and "Sauvegarder la contrainte" buttons are present

**Given** the user selects "Récurrent" type
**When** they confirm the form
**Then** `POST /availability` is called with `recurKind: "RECURRING"`, `dayOfWeek` inferred from the selected date, and the selected slot
**And** the panel closes with a success toast using `ThemeToneService.tone['success.constraint_saved']`
**And** the calendar refreshes to show the new declaration

**Given** the user selects "Plage de dates"
**When** they fill the start/end dates and submit
**Then** `POST /availability` is called with `recurKind: "PUNCTUAL"`, `startDate`, `endDate`

**Given** the user taps "Annuler"
**When** no changes have been saved
**Then** the panel closes with no API call made

**Given** all mobile calendar cells in the week view
**When** measured on a 375px viewport
**Then** each cell's tappable area is ≥ 44×44px (NFR1 touch target)

**Given** an existing declaration is tapped in the calendar
**When** the ConstraintPanel opens
**Then** it pre-fills the existing values and shows a "Supprimer" button
**And** tapping "Supprimer" calls `DELETE /availability/:id` and refreshes the calendar

---

### Story 1.5 : Calendrier personnel — vue semaine

As a user,
I want to switch to a weekly view of my calendar,
So that I can see slot-level detail and manage constraints with more precision.

**Acceptance Criteria:**

**Given** the `/profile/calendar` page is displayed
**When** the user taps/clicks the "Vue semaine" toggle
**Then** `CalendarWeekView` replaces `CalendarMonthView` (no navigation away)
**And** the current week (Lundi–Dimanche) is shown as a 7-column × 3-row grid
**And** row labels on the left show "Matin", "Après-midi", "Soirée"
**And** column headers show abbreviated day names + date number

**Given** the week view is displayed
**When** the user looks at a cell (e.g. Mercredi × Soirée)
**Then** the cell background color reflects the slot status (AVAILABLE / UNAVAILABLE / UNKNOWN)
**And** explicitly declared slots show a small label (e.g. "Indispo · Récurrent")
**And** UNKNOWN cells (outside covered period) have a dashed border

**Given** the week view is displayed on desktop (≥ 768px)
**When** the user clicks a cell
**Then** the ConstraintPanel opens as the right side-panel (reusing Story 1.4 component)

**Given** the week view
**When** the user taps `<` or `>` navigation
**Then** the displayed week shifts by 7 days and declarations are recalculated

**Given** the user switches from week view back to month view
**When** they click "Vue mois"
**Then** the month view is restored showing the same month as the current week

---

### Story 1.6 : Indicateur d'expiration & renouvellement

As a user,
I want to be warned when my availability declarations are about to expire,
So that I can renew them before the system loses track of my availability.

**Acceptance Criteria:**

**Given** the `/profile/calendar` page loads
**When** one or more active declarations have `expiresAt` within the next 14 days
**Then** a warning banner is shown at the top of the calendar using `ThemeToneService.tone['alert.expiring_soon']`
**And** each expiring declaration is highlighted with an amber warning badge in the declaration list

**Given** a warning banner is visible
**When** the user taps/clicks "Renouveler"
**Then** the `ConstraintPanel` opens pre-filled with the expiring declaration's values
**And** the expiration date field is pre-set to +6 months from today
**And** saving creates a new declaration (does not modify the original's expiry)

**Given** all active declarations are shown in a list below the calendar
**When** the user views the list
**Then** each declaration shows: type (récurrent/ponctuel), slot, kind (indispo/dispo), expiration date
**And** declarations expiring within 14 days show an amber "⚠ Expire bientôt" badge
**And** archived (expired) declarations are not shown in the list (but can be retrieved via a "Voir les archives" toggle)

**Given** a declaration is expired (expiresAt < now())
**When** the user taps "Voir les archives"
**Then** expired declarations are shown in a visually distinct (muted) section
**And** a "Reconduire" button pre-fills the ConstraintPanel with the archived declaration's values

---

## Epic 2 : Visibilité croisée & Trouver une date

Tous les membres d'une partie (MJ et joueurs) peuvent voir quand le groupe est disponible pour jouer, directement depuis la page de la partie. Le MJ accède à la vue détaillée par membre ; les joueurs voient un comptage agrégé anonyme (X dispo / Y indispo / Z sans données). La fenêtre de recherche est configurable pour cibler une période précise ("on cherche en août").

### Story 2.1 : API — Calcul des créneaux disponibles

As a GM,
I want the API to compute the next available slots for my party,
So that I can see when everyone is free without manually cross-checking.

**Acceptance Criteria:**

**Given** `PartiesModule` does not yet import `AvailabilityModule`
**When** the developer updates `PartiesModule`
**Then** `PartiesModule` imports `AvailabilityModule` and injects `AvailabilityService`
**And** `@master-jdr/shared` exports `AvailableSlotDto` with shape `{ date: string, slot: DaySlot, members: { userId: string, pseudo: string, status: SlotStatus }[] }`

**Given** an authenticated user who is MJ of a party
**When** they call `GET /parties/:id/available-slots?weeks=8`
**Then** `PartiesService.getAvailableSlots(partieId, 8)` executes:
  1. Loads all `Membership` records for the party (userId[])
  2. Loads all active declarations for those users in ONE query (`WHERE userId IN [...] AND expiresAt > NOW()`)
  3. Iterates in-memory over all date×slot combinations (up to 8 weeks × 7 days × 3 slots = 168 slots)
  4. For each slot, calls `AvailabilityService.computeSlotStatus(declarations, date, slot)` per member
  5. Returns the 5 first slots where NO member is UNAVAILABLE, sorted by date
**And** the response is returned in < 1s for a party of 6 members (NFR2)

**Given** a party member has been removed (Membership deleted)
**When** `GET /parties/:id/available-slots` is called
**Then** the removed member's declarations are NOT included in the calculation (NFR3)
**And** their removal does not affect their global `AvailabilityDeclaration` records

**Given** a member has no active declarations
**When** the slots are computed
**Then** all their slots are UNKNOWN (not UNAVAILABLE)
**And** the slot still appears in results (UNKNOWN doesn't block the slot)
**And** the slot's `members` array shows that member with `status: "UNKNOWN"`

**Given** an authenticated party member (non-MJ / joueur)
**When** they call `GET /parties/:id/available-slots?weeks=8`
**Then** the response is 200 with `AggregatedSlotDto[]` — chaque slot indique `{ date, slot, available, unavailable, unknown, total }` sans aucune information nominative sur les membres

**Given** a request from a non-member of the party
**When** `GET /parties/:id/available-slots` is called
**Then** the response is 403 Forbidden

**Given** `PartiesService.getAvailableSlots` is unit tested (Jest, `parties.service.spec.ts`)
**When** the test suite runs
**Then** the following cases pass:
  - 6 members × 8 weeks scenario loads declarations in exactly 1 SQL query (spy on PrismaService)
  - A slot where one member is UNAVAILABLE is excluded from results
  - A slot where all members are UNKNOWN is included (UNKNOWN ≠ UNAVAILABLE)
  - A removed member (not in memberships) is not included in the computation
  - Returns at most 5 slots, sorted by date ascending
  - When caller is MJ → response body is `AvailableSlotDto[]` (contains `members[]` with userId+pseudo+status)
  - When caller is non-MJ member → response body is `AggregatedSlotDto[]` (contains counts only, no member identity)

---

### Story 2.2 : Vue MJ "Trouver une date" — frontend & layout desktop

As a GM,
I want to see the computed available slots in a split-screen view on desktop,
So that I can see the calendar and the results side by side without switching screens.

**Acceptance Criteria:**

**Given** the GM navigates to `/parties/:id/calendar`
**When** the page loads
**Then** `CalendarViewComponent` renders in `mode: 'mj'`
**And** on desktop (≥ 768px): a 60/40 split layout is shown — left column = calendar (month view by default), right column = sticky "Prochaines fenêtres d'aventure" panel
**And** on mobile (< 768px): the calendar is shown first; a button "Voir les créneaux calculés" navigates to the results panel

**Given** the split layout on desktop
**When** the page loads
**Then** `GET /parties/:id/available-slots?weeks=8` is called
**And** the right panel shows up to 5 `CreneauCard` components, sorted by date

**Given** a `CreneauCard` for a slot where all members are available
**When** the GM views it
**Then** the card shows: date + slot label (using `ThemeToneService.tone['section.slots']`)
**And** per-member badges: pseudo + character class emoji + status icon (✅ / ❌ / ⚠️)
**And** members with status UNKNOWN show the microcopy from `ThemeToneService.tone['status.unknown_label']`
**And** a slot where all members are AVAILABLE shows a "Guilde complète" tag (accent color)

**Given** a member has not declared any availability
**When** their badge is shown in a `CreneauCard`
**Then** an additional alert uses `ThemeToneService.tone['alert.missing_player']` with their pseudo interpolated

**Given** no common slot is found in the 8-week window
**When** the results panel renders
**Then** the empty state shows `ThemeToneService.tone['empty.no_slots']`
**And** a suggestion to extend the window or revise constraints is shown

**Given** an Angular `PollService` in `core/poll/`
**When** a developer inspects it (stub for Epic 3)
**Then** it exposes at minimum `getAvailableSlots(partieId: string, weeks?: number): Promise<AvailableSlotDto[]>` calling `GET /parties/:id/available-slots`

---

### Story 2.3 : Widget "Trouver une date" sur la page de partie (MJ)

As a GM,
I want to see the next confirmed date and a "Find a date" button directly on my party detail page,
So that I can access the scheduling tools without navigating through menus.

**Acceptance Criteria:**

**Given** the GM is on `/parties/:id` (PartieDetail page)
**When** the page renders
**Then** a scheduling widget is visible showing:
  - "Prochaine séance : [date+slot]" if a confirmed date exists on the party
  - "Aucune séance prévue" (empty state) if no confirmed date is set
  - A button using `ThemeToneService.tone['cta.find_date']` linking to `/parties/:id/calendar`

**Given** the party has no confirmed next date
**When** the GM views the widget
**Then** the button "Trouver une date" is prominently visible
**And** clicking it navigates to `/parties/:id/calendar`

**Given** the party has a confirmed next date
**When** the GM views the widget
**Then** the confirmed date is displayed in a human-readable format (e.g. "Samedi 12 juillet — Soirée")
**And** the button remains accessible to find a new date if needed

**Given** the widget is viewed by a player (not the MJ)
**When** the player accesses `/parties/:id`
**Then** they see the confirmed next date (if any) but do NOT see the "Trouver une date" button
**And** they see a badge if a poll is open (implemented in Epic 3 Story 3.4)

---

### Story 2.4 : Calendrier de guilde — vue joueur (visibilité agrégée)

As a player,
I want to see when my party members are collectively available,
So that I can check potential session dates without relying on the GM.

**Acceptance Criteria:**

**Given** a player navigates to `/parties/:id`
**When** the party detail page loads
**Then** a "Calendrier de la guilde" button is visible (accessible to all members, including non-MJ)
**And** it links to `/parties/:id/calendar` in mode `player`

**Given** a player navigates to `/parties/:id/calendar`
**When** the page loads in `mode: 'player'`
**Then** `GET /parties/:id/available-slots?weeks=8` is called with the player's credentials
**And** the response is `AggregatedSlotDto[]` (no member names or identities)
**And** the page displays a list of upcoming slots with availability counts:
  - "X membres disponibles" (green)
  - "Y membres indisponibles" (red)
  - "Z membres sans données" (grey)
  - "N membres au total dans la partie"

**Given** the player view is displayed
**When** the player looks at a slot where all members are available
**Then** a "Guilde disponible" indicator is shown (same visual treatment as the MJ view, no member details)

**Given** the player view is displayed
**When** the player looks at a slot where some members are unavailable
**Then** only the aggregated count is shown — no pseudo, no character class emoji, no individual identification
**And** a slot with at least 1 UNAVAILABLE member is visually distinguished (e.g. amber or red border)

**Given** a player navigates to `/parties/:id/calendar`
**When** the page loads
**Then** there is NO "Lancer un vote" / `ThemeToneService.tone['cta.launch_vote']` button — that action is MJ-only
**And** a banner invites the player to declare their own availability if they have no active declarations ("Ajoutez vos contraintes pour que le calcul soit précis" → link to `/profile/calendar`)

**Given** the `GET /parties/:id/available-slots` endpoint is called by a non-MJ member
**When** inspecting `@master-jdr/shared`
**Then** the response type is `AggregatedSlotDto` (not `AvailableSlotDto`) — discriminated by role in the NestJS service
**And** `AggregatedSlotDto` is exported from `@master-jdr/shared` with shape: `{ date: string; slot: DaySlot; available: number; unavailable: number; unknown: number; total: number }`

---

### Story 2.5 : Fenêtre de planification configurable

As a GM or player,
I want to specify a date range for the availability search,
So that I can find a session date for a specific period (e.g. "only in August", "next 3 weeks").

**Acceptance Criteria:**

**Given** the MJ or player is on `/parties/:id/calendar`
**When** the results panel loads
**Then** a date range picker is visible at the top of the results panel:
  - "Du [date début]" (default: today)
  - "Au [date fin]" (default: today + 8 weeks)
  - A "Rechercher" button or auto-trigger on change

**Given** the GM sets "Du 1er août" / "Au 31 août"
**When** the search is triggered
**Then** `GET /parties/:id/available-slots?from=2026-08-01&to=2026-08-31` is called
**And** the results panel shows only slots within that date range

**Given** the API receives `?from=YYYY-MM-DD&to=YYYY-MM-DD`
**When** `PartiesService.getAvailableSlots()` runs
**Then** it iterates only over date×slot combinations within the [from, to] range (instead of weeks×7)
**And** the query `WHERE expiresAt > NOW()` still applies to declarations
**And** the response is still at most 5 slots (the first 5 within the range where no member is UNAVAILABLE)

**Given** the API receives `?weeks=8` (no from/to)
**When** `PartiesService.getAvailableSlots()` runs
**Then** the behavior is unchanged from Story 2.1 (backward compatible, defaults to today + 8 weeks)

**Given** the date range picker has a value set
**When** the user shares or reloads the URL `/parties/:id/calendar?from=2026-08-01&to=2026-08-31`
**Then** the date range picker is pre-filled from the URL params
**And** the search is automatically triggered with those values

**Given** `PartiesService.getAvailableSlots` is unit tested with the new `from/to` params (Jest, `parties.service.spec.ts`)
**When** the test suite runs
**Then** the following cases pass:
  - `from/to` range narrows the search to only those dates
  - Slots outside the `from/to` range are not returned even if members are available
  - `from` after `to` returns a 400 Bad Request
  - Missing both `from/to` and `weeks` defaults to today + 8 weeks

---

## Epic 3 : Vote de date & Widgets d'intégration

Le MJ peut lancer un vote sur des créneaux candidats, les joueurs répondent, la date finale est choisie par le MJ et s'affiche partout dans l'application.

### Story 3.1 : API Vote — PollModule backend complet

As a GM or player,
I want the API to handle the full poll lifecycle,
So that date votes can be created, answered, and resolved.

**Acceptance Criteria:**

**Given** the Prisma schema does not yet have poll models
**When** the developer runs a new migration
**Then** `SessionPoll`, `PollOption`, `PollVote` models are created with all fields from the PRD schema
**And** enums `PollStatus` (OPEN, CLOSED) and `VoteAnswer` (YES, NO, MAYBE) are added
**And** `@@index([partieId, status])` exists on `SessionPoll`
**And** `@@unique([optionId, userId])` exists on `PollVote`
**And** `@master-jdr/shared` exports `SessionPollDto`, `PollOptionDto`, `PollVoteDto`, `CreatePollDto`, `CastVoteDto`

**Given** an authenticated MJ of a party
**When** they call `POST /parties/:id/poll` with `{ options: [{date, slot}, ...], scenarioRef? }`
**Then** if an OPEN poll already exists for the party, it is automatically set to CLOSED
**And** a new `SessionPoll` is created with status OPEN and 2–4 `PollOption` records
**And** the response returns the full `SessionPollDto` (201)
**And** a non-MJ user calling this endpoint receives 403

**Given** an active OPEN poll on a party
**When** any authenticated member calls `GET /parties/:id/poll`
**Then** the current OPEN poll is returned with all options and existing votes
**And** if no poll is OPEN, the response is `null` (200)

**Given** an authenticated party member
**When** they call `POST /parties/:id/poll/:pollId/vote` with `{ optionId, answer: "YES" }`
**Then** a `PollVote` is created (or updated if they already voted on that option)
**And** the constraint `@@unique([optionId, userId])` is respected (upsert behavior)

**Given** an authenticated MJ
**When** they call `PATCH /parties/:id/poll/:pollId/choose` with `{ optionId }`
**Then** the poll's `chosenDate` and `chosenSlot` are set from the chosen `PollOption`
**And** the poll status is set to CLOSED
**And** the party's next session date is updated (field `nextSessionDate` + `nextSessionSlot` on `Partie` — requires schema update)
**And** a non-MJ user calling this endpoint receives 403

**Given** an authenticated MJ
**When** they call `DELETE /parties/:id/poll/:pollId`
**Then** the poll status is set to CLOSED (soft close, not deleted)
**And** a non-MJ user calling this endpoint receives 403

**Given** `PollService` is unit tested (Jest, `poll.service.spec.ts`)
**When** the test suite runs
**Then** the following cases pass:
  - `create()` with no existing OPEN poll → creates new poll, no close call
  - `create()` with an existing OPEN poll → closes the existing one, then creates the new one (2 DB writes, in order)
  - `castVote()` called twice by same user on same option → second call updates, no duplicate row (upsert)
  - `choose()` called by non-MJ → throws ForbiddenException
  - `choose()` sets `chosenDate`, `chosenSlot`, closes poll, updates `Partie.nextSessionDate`

---

### Story 3.2 : Créer un vote — frontend MJ

As a GM,
I want to create a date poll from the available slots view,
So that my players can vote on the best option.

**Acceptance Criteria:**

**Given** the MJ is on `/parties/:id/calendar` viewing the computed slots
**When** they click the button using `ThemeToneService.tone['cta.launch_vote']`
**Then** the `PollCreationComponent` (part of PollFlow) opens — as a modal on desktop, full screen on mobile

**Given** the poll creation form is open
**When** the MJ views it
**Then** the 5 computed available slots are pre-listed as selectable options (checkboxes)
**And** the MJ can also add up to 4 custom date/slot combinations not in the computed list
**And** a text field for `scenarioRef` (optional) is present (e.g. "Séance 3 — Le Donjon de Fer")
**And** the form enforces selecting 2–4 options total before submitting

**Given** the MJ selects 3 options and clicks the submit button
**When** `POST /parties/:id/poll` is called successfully
**Then** the poll creation form closes
**And** a success toast uses `ThemeToneService.tone['success.constraint_saved']` (repurposed key or dedicated `success.poll_created`)
**And** the MJ is shown the newly created poll in its OPEN state

**Given** an error during poll creation (e.g. network failure)
**When** the API returns an error
**Then** the form remains open with an error message using the thematized error microcopy
**And** no data is lost from the form

---

### Story 3.3 : Répondre au vote — frontend joueur

As a player,
I want to respond to an open date poll from my dashboard,
So that the GM knows when I'm available.

**Acceptance Criteria:**

**Given** an OPEN poll exists on a party the player belongs to
**When** the player loads the dashboard
**Then** a prominent badge/banner is visible on the party card using `ThemeToneService.tone['cta.launch_vote']`-related microcopy
**And** the badge indicates their response is pending

**Given** the player taps the badge or navigates to the poll
**When** `GET /parties/:id/poll` returns an OPEN poll
**Then** the `PollResponseComponent` shows each option as a card: date, slot, and 3 answer buttons (YES / NO / MAYBE)
**And** options the player already answered show their current answer highlighted

**Given** a player selects YES for one option and MAYBE for another
**When** they confirm
**Then** `POST /parties/:id/poll/:pollId/vote` is called for each option
**And** a success toast confirms their response was recorded using thematized microcopy
**And** the poll view updates to show their submitted answers

**Given** a player changes their answer (e.g. YES → NO)
**When** they resubmit
**Then** the previous vote is overwritten (upsert behavior from Story 3.1)
**And** the UI reflects the updated answer immediately

**Given** the poll's `expiresAt` has passed
**When** the player tries to vote
**Then** the poll shows as CLOSED and the vote buttons are disabled

---

### Story 3.4 : Résultat du vote & choix de la date finale (MJ)

As a GM,
I want to see a summary of all player responses and choose the final session date,
So that I can confirm the next session with full visibility of everyone's availability.

**Acceptance Criteria:**

**Given** an OPEN poll where all members have voted
**When** the MJ views the poll
**Then** each option shows the full vote breakdown: count of YES / NO / MAYBE
**And** per-member badges show each player's answer (pseudo + emoji + answer label)
**And** an option where all members voted YES is visually highlighted

**Given** the MJ views the poll result
**When** they click "Sceller ce créneau" (or equivalent `ThemeToneService` key) on one option
**Then** a confirmation dialog appears showing the selected date and slot
**And** on confirmation, `PATCH /parties/:id/poll/:pollId/choose` is called
**And** the poll closes (status: CLOSED)
**And** the party's confirmed next session date is updated

**Given** the date has been chosen
**When** the MJ returns to the party detail page
**Then** the scheduling widget (Story 2.3) shows the newly confirmed date
**And** the poll is no longer shown as OPEN

**Given** the MJ wants to close the poll without choosing a date
**When** they click "Annuler le vote"
**Then** `DELETE /parties/:id/poll/:pollId` is called (soft close)
**And** the poll disappears from the OPEN state
**And** no session date is recorded

---

### Story 3.5 : Notifications in-app & widgets d'intégration

As a GM or player,
I want to be notified of vote activity and see scheduling info on every relevant screen,
So that I never miss a pending action.

**Acceptance Criteria:**

**Given** a new OPEN poll is created on a party
**When** a member (player) loads any page of the app
**Then** their party card on the dashboard shows a badge "Vote en attente" using thematized microcopy
**And** the badge count is visible in the app navigation if multiple parties have open polls

**Given** a player has responded to all options in the poll
**When** the MJ loads the poll view
**Then** a notification banner/badge is shown using `ThemeToneService.tone['alert.missing_player']`-equivalent for "tous ont répondu"
**And** if some players haven't responded, their names are listed using `ThemeToneService.tone['alert.missing_player']`

**Given** the party detail page (`/parties/:id`)
**When** an OPEN poll exists for this party
**Then** the scheduling widget (Story 2.3) shows an additional section with:
  - Poll status: "Vote ouvert — X/Y membres ont répondu"
  - Link to the poll view for the MJ
  - Link to vote for a player who hasn't responded

**Given** the player dashboard page
**When** any of the user's parties has an OPEN poll with a pending player response
**Then** the party card prominently shows a "Vote en attente" badge (distinct from the confirmed date)
**And** tapping it navigates directly to the `PollResponseComponent` for that party

**Given** all the above notifications use thematized microcopy
**When** the user changes their theme
**Then** all notification texts update immediately via `ThemeToneService.tone` signals

---

## Epic 4 : Personnages Ryuutama — Moteur plugin & création guidée

Un joueur peut créer un personnage Ryuutama complet via un assistant guidé, le consulter (avec portrait optionnel), l'exporter en PDF, et le MJ peut consulter les personnages de ses joueurs — le tout posant une architecture `GameSystemPlugin` réutilisable pour les futurs systèmes (Conte de Minuit, Draconis).

### Story 4.1 : API Personnage — Backend complet

As a developer,
I want the API to expose a GameSystemRegistry, the Ryuutama plugin, and Character CRUD,
So that character creation and consultation can be built on a stable, schema-driven backend.

**Décision d'architecture (issue d'une session de revue collective)** : `computeDerived()` et `validate()` sont des **fonctions pures** (mêmes entrées → même sortie, aucun accès BDD/réseau interne), extraites dans un nouveau package workspace `packages/game-rules` (distinct de `packages/shared` qui reste type-only). Le front (Angular) et le back (NestJS) importent la **même implémentation** — plus de duplication de formule entre client et serveur. Tout besoin de données externes (contenu homebrew MJ, jet de dé) est résolu par l'appelant et passé en paramètre à la fonction, jamais récupéré en interne par le package partagé.

**Acceptance Criteria:**

**Given** the Prisma schema does not yet have game-system models
**When** the developer runs a new migration
**Then** `GameSystem` (id, name, version), `ContentType` (id, gameSystemId, key, label), `ContentEntry` (id, contentTypeId, scope, key, data Json) and `Character` (id, userId, partieId, gameSystemId, sheetData Json, derived Json, portraitUrl String?, portraitCropData Json?, createdAt, updatedAt) models are created
**And** the enum `ContentScope` (BASE, MJ, PARTIE) is added
**And** `@@unique([gameSystemId, key])` exists on `ContentType`, `@@unique([contentTypeId, key])` on `ContentEntry`
**And** `@@index([partieId])` and `@@index([userId])` exist on `Character`
**And** `@@unique([userId, partieId, gameSystemId])` exists on `Character` (un seul personnage par joueur et par partie ce palier — cf. Assumption PRD §F3)

**Given** seed JSON files exist in `apps/api/game-systems/ryuutama/data/` (gitignoré, cf. NFR4) *(NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.)*
**When** the app démarre
**Then** un `GameSystem` `{ id: "ryuutama", name: "Ryuutama", version }` est upserted
**And** les `ContentEntry` scope `BASE` pour les 7 classes (avec leurs 3 talents chacune), les 3 types (Attaque/Technique/Magie), le pattern d'attributs Polyvalent ({8,4,6,6}), et les 5 catégories d'armes favorites sont chargées
**And** si les fichiers JSON sont absents, le démarrage échoue avec un message d'erreur explicite pointant vers le README du dossier de seed

**Given** un utilisateur authentifié
**When** il appelle `GET /game-systems`
**Then** la réponse liste les systèmes installés (200) — un seul élément ce palier : `ryuutama`

**Given** un utilisateur authentifié
**When** il appelle `GET /game-systems/ryuutama/schema`
**Then** la réponse contient `sheetSchema()` et `creationSteps()` (8 étapes dans l'ordre défini par l'addendum PRD : classe, type, attributs, arme favorite, objet fétiche, équipement, narratif, portrait)

**Given** un membre authentifié d'une partie utilisant Ryuutama, sans personnage existant sur cette partie
**When** il appelle `POST /parties/:id/characters` avec un `sheetData` valide (1 classe, 1 type, attributs conformes au pattern Polyvalent, 1 arme favorite valide)
**Then** `validate(data, "strict")` (importée de `packages/game-rules`) passe, un `Character` est créé avec `derived` calculé via `computeDerived()` (même package) : PV=VIG×2, PE=ESP×2, Condition=VIG+ESP, Initiative=AGI+INT, Encombrement=VIG+3
**And** la réponse retourne le personnage créé (201)

**Given** un `sheetData` invalide (0 ou 2+ classes sélectionnées, valeurs d'attributs ne correspondant à aucun pattern connu, classe Artisan sans type d'objet de spécialité)
**When** `POST /parties/:id/characters` est appelé
**Then** la réponse est 400 avec la liste des erreurs de validation, aucun `Character` n'est créé

**Given** un joueur a déjà un personnage Ryuutama sur cette partie
**When** il appelle à nouveau `POST /parties/:id/characters` (double-soumission, double onglet, etc.)
**Then** la contrainte `@@unique([userId, partieId, gameSystemId])` rejette la création avec une réponse 409 explicite ("Vous avez déjà un personnage sur cette partie"), pas une erreur 500 générique

**Given** un `Character` existant
**When** son propriétaire ou le MJ de la partie associée appelle `GET /characters/:id`
**Then** la réponse retourne le personnage (200) avec `derived` inclus
**And** un utilisateur qui n'est ni le propriétaire ni le MJ reçoit 403

**Given** une partie avec plusieurs personnages créés
**When** un joueur appelle `GET /parties/:id/characters`
**Then** il reçoit uniquement ses propres personnages sur cette partie
**And** quand le MJ de la partie appelle le même endpoint, il reçoit les personnages de tous les joueurs

**Given** `computeDerived()` est unit-testé une seule fois dans `packages/game-rules` (Jest ou Vitest, partagé)
**When** la suite de tests s'exécute
**Then** les cas suivants passent : VIG=8→PV=16, ESP=6→PE=12, VIG=8+ESP=6→Condition=14, AGI=4+INT=6→Initiative=10, VIG=8→Encombrement=11
**And** un test d'intégration côté `apps/api` confirme que `CharacterService` appelle bien cette implémentation partagée (pas une copie locale)

**Given** `validate(data, "strict")` est unit-testé dans `packages/game-rules`
**When** la suite de tests s'exécute
**Then** les 5 règles strictes de l'addendum §9 sont couvertes (1 classe unique, 1 type unique, attributs conformes au pattern, 1 arme favorite parmi les 5 catégories, sous-choix Artisan obligatoire)

---

### Story 4.2 : Créer un personnage — Assistant frontend

As a player,
I want a guided step-by-step wizard to create my Ryuutama character,
So that I don't have to calculate anything myself and can't submit an invalid sheet.

**Acceptance Criteria:**

**Given** un joueur membre d'une partie Ryuutama sans personnage existant
**When** il ouvre l'onglet "Personnages" de la partie et clique sur le CTA de création
**Then** l'assistant de création s'ouvre, rendu à partir de `sheetSchema()`/`creationSteps()` (FR25) — aucun contenu Ryuutama n'est codé en dur dans les composants génériques

**Given** l'assistant sur desktop (≥1024px)
**When** une étape est affichée
**Then** le layout est 65% zone principale / 35% panneau latéral résumé (réutilise `SlotPanel`), avec une barre de progression en haut (titre = nom de l'étape, boutons prev/next 32×32px)

**Given** l'assistant sur mobile (<768px)
**When** une étape est affichée
**Then** le layout est une colonne unique, barre de progression avec libellé textuel de l'étape ("Étape 3/8 · Attributs"), navigation via barre inférieure fixe Précédent/Suivant (≥44px)

**Given** l'étape 1 (Classe)
**When** le joueur sélectionne une classe parmi les 7 (grille de `ChoiceCard`)
**Then** les 3 talents de la classe s'affichent immédiatement sans navigation supplémentaire
**And** si la classe est Artisan, un sous-choix obligatoire (type d'objet de spécialité) apparaît et bloque le bouton "Suivant" tant qu'il n'est pas fait

**Given** l'étape 2 (Type)
**When** le joueur sélectionne un type parmi Attaque/Technique/Magie
**Then** les avantages passifs du type s'affichent
**And** si Magie est sélectionné, le message `character.magic_deferred_notice` (thématisé) s'affiche avant de pouvoir continuer

**Given** l'étape 3 (Attributs)
**When** le joueur assigne les 4 valeurs du pattern Polyvalent ({8,4,6,6}) aux attributs AGI/ESP/INT/VIG (contrôle "chips assignables")
**Then** le panneau résumé (desktop) ou la zone dédiée (mobile) affiche PV/PE/Condition/Initiative/Encombrement recalculés en direct côté client via `computeDerived()` importée de `packages/game-rules` (même implémentation que le backend, sans appel réseau, cf. NFR7), à chaque changement d'assignation
**And** le bouton "Suivant" reste désactivé tant que les 4 attributs ne sont pas tous assignés

**Given** l'étape 4 (Arme favorite)
**When** le joueur choisit 1 arme parmi les 5 catégories
**Then** les valeurs Toucher/Dégâts de la catégorie s'affichent

**Given** les étapes 5-7 (Objet fétiche, Équipement, Champs narratifs)
**When** le joueur les traverse
**Then** l'objet fétiche est un champ texte libre optionnel, l'équipement est attribué automatiquement en mode pique-nique sans interaction requise, les champs narratifs sont tous des champs texte libres optionnels

**Given** toutes les étapes obligatoires complétées
**When** le joueur soumet l'assistant
**Then** `POST /parties/:id/characters` (Story 4.1) est appelé
**And** en cas de succès, redirection automatique vers la fiche du personnage créé (Story 4.3)
**And** en cas d'échec de validation, retour à l'étape concernée avec la liste des erreurs contextualisées (pas un écran d'erreur générique)

**Périmètre de cette story** : l'assistant tel que livré ici couvre les étapes 1 à 7 (Classe → Champs narratifs) puis soumission — il est complet et fonctionnel de façon autonome. L'étape 8 optionnelle (Portrait) est ajoutée par la Story 4.5 sans modifier ce flux (ajout additif, pas de dépendance en amont sur une story future).

---

### Story 4.3 : Consulter la fiche de personnage

As a player or GM,
I want to view a Ryuutama character sheet within the party,
So that I can reference it during and between sessions.

**Acceptance Criteria:**

**Given** une partie utilisant Ryuutama
**When** un membre ouvre l'onglet "Personnages" de la page détail de partie
**Then** la liste des personnages créés s'affiche (une `CharacterSummaryCard` par personnage : avatar, nom, classe, badges PV/PE/Initiative/Encombrement)
**And** si le joueur courant n'a pas encore créé son personnage sur cette partie, une carte avec un CTA "Créer un personnage" s'affiche

**Given** un personnage créé
**When** son propriétaire ou le MJ de la partie clique dessus
**Then** la fiche en lecture seule s'affiche : sur desktop/tablette en 2 colonnes fidèles à la disposition papier officielle (classe, type, talents, attributs, PV/PE/Condition/Initiative, arme favorite, équipement, champs narratifs) ; sur mobile en sections empilables/accordéon (même identité visuelle, pas de décalque littéral)

**Given** le MJ d'une partie
**When** il consulte la fiche d'un personnage appartenant à un de ses joueurs
**Then** il y accède en lecture seule, sans action d'édition disponible (FR39, pas d'édition ce palier)

**Given** un utilisateur qui n'est ni membre de la partie ni propriétaire du personnage
**When** il tente d'accéder à une fiche via `GET /characters/:id` ou l'URL correspondante
**Then** l'accès est refusé (403, cohérent avec Story 4.1)

---

### Story 4.4 : Export PDF de la fiche

As a player,
I want to export my character sheet as a filled official PDF,
So that I can bring a portable copy to the table.

**Fichiers sources (fournis par l'utilisateur, extraction confirmée)** : `Ryuutama_fiche_de_voyageur_big_edit.pdf` (2 pages, 126 champs AcroForm réels et nommés — seul fichier avec de vrais champs remplissables), `Ryuutama_voyageur.pdf` (1 page paysage, purement visuel, aucun champ), `Ryuutama_voyageur_big.pdf` (2 pages portrait, purement visuel, aucun champ — même contenu que le 1-page, juste reséparé). Seul le fichier "edit" permet un remplissage fiable par nom de champ (`pdf-lib`) ; les deux autres nécessiteraient un positionnement de texte au pixel près, fragile.

**Décision de scope (issue d'une session de revue collective)** : ce palier livre 2 des 3 options d'export demandées, toutes deux basées sur le fichier "edit" :
- **Éditable** : remplissage des 126 champs AcroForm, PDF laissé interactif (pas d'aplatissement).
- **2 pages** : même remplissage, puis `form.flatten()` pour un rendu final non modifiable.

L'option **"1 page"** (format paysage condensé) est différée — elle demande un travail de positionnement manuel supplémentaire sans les vrais champs, jugé disproportionné tant que le besoin réel n'est pas confirmé à l'usage. Suivi noté dans `deferred-work.md` une fois ce palier livré.

**Note** : la liste déroulante "Classe" du PDF officiel propose 12 valeurs (les 7 classes de ce palier + les 4 classes différées : Dresseur, Ermite, Météomancien, Navigateur, Professeur). L'assistant de création (Story 4.2) ne propose que les 7 connues — le mapping vers le champ PDF n'utilise donc jamais les 5 valeurs restantes ce palier.

**Acceptance Criteria:**

**Given** un personnage Ryuutama créé
**When** un joueur clique sur "Exporter en PDF (éditable)" depuis sa fiche
**Then** `GET /characters/:id/export.pdf?format=editable` (`exportPDF()` du plugin) remplit les 126 champs AcroForm du fichier "edit" avec les données du personnage (nom, classe, type, talents, attributs, PV/PE/Condition/Initiative, arme favorite, équipement, paysage/climat si renseigné, champs narratifs) sans aplatir le formulaire
**And** le fichier est téléchargé côté navigateur, toujours modifiable dans un lecteur PDF compatible formulaires

**Given** un personnage Ryuutama créé
**When** un joueur clique sur "Exporter en PDF (2 pages)" depuis sa fiche
**Then** `GET /characters/:id/export.pdf?format=2pages` remplit le même template puis aplatit le formulaire (`form.flatten()`) avant de le retourner
**And** le fichier est téléchargé côté navigateur, non modifiable

**Given** le mapping champ personnage → champ PDF (ex. classe Ryuutama → dropdown `Classe 1`, attribut VIG → dropdown `VIG` parmi `4/6/8/10/12`)
**When** ce mapping est unit-testé
**Then** chaque champ du `sheetData` a une correspondance explicite et testée vers un nom de champ AcroForm du fichier "edit" (pas de champ orphelin ni de valeur non mappée pour les 7 classes/3 types/5 armes du scope de ce palier)

**Given** le MJ consulte la fiche d'un de ses joueurs
**When** il clique sur un des deux boutons d'export
**Then** le même export fonctionne (pas de restriction supplémentaire par rapport à la consultation en lecture seule)

**Given** un personnage avec un portrait (`portraitUrl`, Story 4.5)
**When** le PDF est généré (`format=editable` ou `format=2pages`)
**Then** l'image est centrée automatiquement et rognée aux proportions exactes du cadre portrait de la fiche (comportement équivalent à `object-fit: cover` centré) — l'image ne déborde jamais du cadre, quel que soit son ratio d'origine
**And** les coordonnées exactes du cadre portrait sur le template "edit" sont documentées en story de dev (non extraites lors de l'analyse initiale des 126 champs AcroForm, qui portait sur les champs texte/liste, pas sur la zone image)

**Given** un personnage sans portrait
**When** le PDF est généré
**Then** le cadre portrait reste vide (pas de placeholder, cohérent avec le comportement de l'avatar web)

**Out of Scope :** option d'export "1 page" (format paysage condensé) — différée, cf. décision de scope ci-dessus. Recadrage dédié du portrait pour le cadre PDF (proportions potentiellement différentes de l'avatar rond web) — voir Story 4.6.

---

### Story 4.5 : Portrait de personnage

As a player,
I want to add and edit a portrait image for my character,
So that my character sheet feels more personal.

**Acceptance Criteria:**

**Given** un personnage en cours de création, à l'étape 8 (Portrait, optionnelle)
**When** le joueur n'a pas d'image sous la main
**Then** il peut cliquer sur "Passer cette étape" et finaliser son personnage sans portrait — l'avatar affichera les initiales

**Given** un personnage en cours de création, à l'étape 8
**When** le joueur choisit une image depuis son appareil
**Then** un outil de recadrage circulaire (zoom + repositionnement par glisser) permet de centrer le visage
**And** à la validation, `PUT /characters/:id/portrait` (ou équivalent en fin d'assistant) enregistre l'image source complète (`portraitUrl`) et la zone de recadrage (`portraitCropData`)

**Given** un personnage déjà créé sans portrait
**When** le joueur clique sur "Modifier le portrait" depuis sa fiche
**Then** le même outil de recadrage s'ouvre, l'image et le recadrage sont enregistrés via `PUT /characters/:id/portrait`

**Given** un personnage déjà créé avec un portrait existant
**When** le joueur clique sur "Modifier le portrait" et choisit une nouvelle image (ou ajuste le recadrage de l'image actuelle)
**Then** le portrait est remplacé (pas de cumul d'anciennes versions ce palier)

**Given** un fichier sélectionné pour le portrait
**When** `PUT /characters/:id/portrait` est appelé
**Then** le type MIME est vérifié côté serveur (pas seulement l'extension) parmi `image/jpeg`, `image/png`, `image/webp` — tout autre type est rejeté (400, `docs/security.md`)
**And** la taille du fichier est limitée à 5 Mo — un fichier plus lourd est rejeté (413) avant tout traitement
**And** côté frontend, l'input de sélection de fichier restreint déjà les types acceptés (`accept="image/jpeg,image/png,image/webp"`) pour guider l'utilisateur, sans remplacer la validation serveur

**Given** un personnage sans portrait
**When** sa carte (`CharacterSummaryCard`) ou sa fiche est affichée
**Then** l'avatar affiche les initiales du personnage (jamais un cercle vide ou une icône d'erreur), et aucun `PortraitPanel` n'apparaît sur la fiche

**Given** un personnage avec un portrait
**When** sa carte ou sa fiche est affichée
**Then** l'avatar affiche l'image recadrée (`object-fit: cover`, jamais déformée), et la fiche affiche en plus un `PortraitPanel` avec l'image complète non recadrée

---

### Story 4.6 : Attribution du personnage — distinction MJ/joueur et enrichissement de l'export PDF

As a MJ,
I want to see at a glance which characters belong to me versus my players, and which player owns each one,
So that I can navigate a party's character list without confusion, and my players' exported PDF sheets are properly attributed with the player's name and portrait.

**Contexte** : cette story comble un manque identifié après la Story 4.5 (portrait) — `CharacterDto` n'expose aujourd'hui aucune information sur le propriétaire au-delà de `userId` (un UUID opaque côté frontend), et le champ AcroForm "Joueur" du template PDF officiel (`Ryuutama_fiche_de_voyageur_big_edit.pdf`) ainsi que la zone visuelle réservée au portrait (en haut de page, au-dessus de "Joueur", à droite du titre/date de création) n'ont jamais été renseignés — volontairement laissés hors scope par la Story 4.4 (cf. `packages/game-rules/src/ryuutama/pdf-field-map.ts` : "Joueur... non couverts").

**Acceptance Criteria:**

**Given** le MJ d'une partie consultant l'onglet "Personnages"
**When** la liste des personnages s'affiche
**Then** chaque `CharacterSummaryCard` distingue visuellement les personnages du MJ (ex. badge "Vous"/MJ) de ceux de ses joueurs, et affiche le pseudo du joueur propriétaire pour ces derniers

**Given** le MJ consultant la fiche d'un personnage
**When** la fiche s'affiche
**Then** la même distinction MJ/joueur et le pseudo du propriétaire sont visibles sur l'en-tête de la fiche (à proximité du nom du personnage, sans s'y substituer)

**Given** un joueur consultant l'onglet "Personnages" ou sa propre fiche
**When** la liste/fiche s'affiche
**Then** aucun changement visible côté joueur — il ne voit jamais que ses propres personnages (comportement `findByPartie` déjà en place, Story 4.1), cette story n'ajoute rien pour lui

**Given** un personnage exporté en PDF (éditable ou 2 pages)
**When** l'export est généré
**Then** le champ AcroForm "Joueur" est rempli avec le pseudo du propriétaire du personnage (le MJ inclus, s'il exporte son propre personnage)

**Given** un personnage avec un portrait existant, exporté en PDF
**When** l'export est généré
**Then** l'image de portrait est intégrée dans la zone dédiée du template (au-dessus du champ "Joueur", à droite du titre "Fiche de voyageur, créé le..."), centrée et mise à l'échelle en conservant son ratio d'origine (`fitCentered`, équivalent PDF de `object-fit: contain` centré) — ne déborde jamais du cadre et n'est jamais déformée

**Given** un personnage sans portrait, exporté en PDF
**When** l'export est généré
**Then** la zone dédiée reste vide (pas d'image placeholder, cohérent avec le comportement déjà établi pour `PortraitPanel` sur le web)

**Given** le mapping "Joueur" → pseudo et la logique d'intégration du portrait
**When** ces logiques sont unit-testées
**Then** `mapToPdfFields`/`RyuutamaPdfContent` couvrent le nouveau champ "Joueur" (dans `packages/game-rules`), et `RyuutamaPdfService` couvre l'intégration d'image (mock `pdf-lib`, cf. conventions déjà établies dans `ryuutama-pdf.service.spec.ts`)

**Out of Scope :** le recadrage circulaire du portrait (`portraitCropData`, web) n'est pas réutilisé pour le PDF — l'intégration utilise l'image source complète non recadrée avec un centrage automatique (`fitCentered`), pas le crop web (qui vise un cercle, pas le cadre rectangulaire du PDF). Un widget de recadrage dédié à la proportion exacte du cadre PDF est différé — voir Story 4.7. L'option d'export "1 page" reste hors scope (déjà différée par la Story 4.4).

---

### Story 4.7 : Recadrage dédié du portrait pour l'export PDF

As a player,
I want to adjust how my portrait is cropped specifically for the PDF export (a different aspect ratio than the circular avatar),
So that the exported sheet shows exactly the part of my portrait I want, not just an automatic center-fit.

**Contexte** : la Story 4.6 centre automatiquement l'image source complète dans le cadre PDF (`fitCentered`, sans contrôle utilisateur). Cette story ajoute un recadrage manuel dédié, sur le modèle du widget `PortraitCropper` déjà existant (Story 4.5 — scale/offsetX/offsetY en pourcentage, zoom molette/clavier, pan par glisser), généralisé pour accepter une forme rectangulaire à la proportion exacte du cadre PDF (90×110, cf. `ryuutama-pdf.service.ts`) en plus de la forme circulaire déjà utilisée pour l'avatar web.

**Acceptance Criteria:**

**Given** un personnage avec un portrait existant
**When** le joueur clique sur "Ajuster le cadrage PDF" depuis sa fiche
**Then** `PortraitCropper` s'ouvre avec un masque de prévisualisation rectangulaire (proportion 90:110) au lieu du masque circulaire habituel, réutilisant la même image source déjà uploadée (pas de nouvel upload requis)

**Given** le joueur ajuste le zoom/la position dans ce mode rectangulaire
**When** il valide
**Then** un nouveau champ `pdfPortraitCropData` (même forme que `portraitCropData` : scale/offsetX/offsetY) est enregistré séparément sur le `Character`, sans modifier `portraitCropData` (le recadrage de l'avatar web reste indépendant)

**Given** un personnage avec `pdfPortraitCropData` renseigné
**When** son PDF est exporté
**Then** `RyuutamaPdfService` applique ce recadrage (au lieu du centrage automatique `fitCentered`) pour positionner l'image dans le cadre — le calcul traduit `scale/offsetX/offsetY` en région source à dessiner, cohérent avec l'interprétation déjà utilisée côté web pour l'avatar circulaire

**Given** un personnage sans `pdfPortraitCropData` (portrait ajouté avant cette story, ou jamais ajusté pour le PDF)
**When** son PDF est exporté
**Then** le comportement de la Story 4.6 s'applique tel quel (`fitCentered`, centrage automatique) — pas de régression, dégradation gracieuse

**Given** le calcul de conversion `pdfPortraitCropData` (scale/offset) → région source à dessiner
**When** cette logique est unit-testée
**Then** elle couvre au moins : zoom neutre centré, zoom maximal avec offset aux bornes, offset qui pousserait la région hors de l'image source (clampé, jamais d'erreur)

**Out of Scope :** aperçu live dans la forme exacte du cadre orné de la fiche officielle (juste un rectangle aux bonnes proportions, pas le contour décoratif réel) — différé, pas de story prévue pour l'instant.

**Dev Notes attendues** : les coordonnées exactes de la zone portrait sur le template PDF ne sont pas encore mesurées/documentées (`apps/api/game-systems/ryuutama/assets/README.md` ne les couvre pas) — à déterminer empiriquement via `page.getSize()`/inspection visuelle du PDF source, puis à documenter dans ce README pour éviter une redécouverte future.
