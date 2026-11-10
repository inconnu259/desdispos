---
title: "PRD — Palier P3 : Moteur plugin & premier système (Ryuutama)"
status: final
created: 2026-07-03
updated: 2026-07-03 (portrait FR ajoutée suite au run UX)
scope: personal / scope-1
---

# PRD — Palier P3 : Moteur plugin & premier système (Ryuutama)

## Contexte & problème

jdr-master gère aujourd'hui les comptes, les parties, les invitations et la planification (Paliers P1-P2, livrés). Mais une partie de JDR sans **personnages** n'est qu'une coquille administrative — le cœur de l'expérience (fiche de personnage, évolution, règles du système joué) n'existe pas encore.

**L'architecture plugin `GameSystemPlugin`** (interface commune `sheetSchema`, `contentTypes`, `creationSteps`, `createBlankCharacter`, `validate`, `computeDerived`, `canSpendXp`, `applyXp`, `printLayout`) est déjà spécifiée dans `docs/spec.md` §5. Ce palier **pose cette architecture pour de vrai**, en l'implémentant sur un seul système, choisi pour son risque minimal.

**Pourquoi Ryuutama en premier (pas Draconis) :** Ryuutama est le système le plus simple des quatre prévus (Draconis, Conte de Minuit, Ryuutama, Esteren — cf. `docs/spec.md` §1). Si l'interface plugin est mal conçue, on le découvre sur un système simple à corriger, pas sur Draconis (le plus complexe, avec des steps conditionnelles et une hiérarchie de modules). Décision actée dans le brainstorm du 26/06 (`_bmad-output/brainstorming/brainstorm-roadmap-concrétisation-20260626/`).

**Scope de ce palier : scope-1** (usage perso du MJ + son groupe de confiance, instance Docker locale) — même contexte que le Palier Calendrier précédent.

**Utilisateurs concernés :** joueurs (créent et consultent leur personnage), MJ (consulte les personnages de ses joueurs). Accès principalement mobile pour la consultation en séance ; la création peut se faire au calme avant la première séance.

**⚠️ Contenu sous droits :** Ryuutama est un système commercial (cf. `docs/spec.md`). Les données de règles (classes, talents, formules — extraites du guide officiel *Guide du Voyageur*, voir `addendum.md`) ne sont **pas des specs à committer en clair sans réflexion** — voir NFR de confidentialité du seed ci-dessous.

---

## Objectif du palier

Permettre à un joueur de créer un personnage Ryuutama complet (niveau 1) via un assistant guidé piloté par le schéma du plugin, de consulter sa fiche dans l'app, et d'en exporter un PDF — tout en posant une architecture `GameSystemPlugin` réutilisable pour les systèmes suivants (Conte de Minuit, puis Draconis).

**Done when :** un joueur membre d'une partie Ryuutama peut créer son personnage de bout en bout (classe → type → attributs → arme favorite → objet fétiche → équipement → champs narratifs), la fiche est validée selon les règles du système (blocage si invalide), les statistiques dérivées (PV, PE, Initiative, etc.) sont calculées automatiquement, et le joueur peut consulter sa fiche dans l'app et en exporter un PDF.

---

## Fonctionnalités

### F1 — Interface plugin `GameSystem` et registre

Implémentation concrète, côté backend, de l'interface déjà spécifiée dans `docs/spec.md` §5, scopée aux besoins de ce palier.

**FR-1.1 — `GameSystemRegistry`**

Un module NestJS `GameSystemModule` expose un registre listant les systèmes installés (`id`, `name`, `version`). Pour ce palier, un seul système enregistré : `ryuutama`.

**FR-1.2 — Interface `GameSystemPlugin` (sous-ensemble implémenté ce palier)**

```ts
interface GameSystemPlugin {
  id: string;
  name: string;
  version: string;

  sheetSchema(): SheetSchema;               // structure de la fiche Ryuutama (sections/champs/types)
  creationSteps(): CreationStep[];          // les 8 étapes de l'addendum, dans l'ordre
  createBlankCharacter(): SheetData;
  validate(data: SheetData, mode: "strict" | "mj"): ValidationResult; // signature complète (docs/spec.md §5) ; ce palier n'implémente/teste que mode "strict" — "mj" reste un no-op réservé à P4, pour ne pas devoir changer la signature plus tard
  computeDerived(data: SheetData): DerivedStats; // PV, PE, Initiative, etc.
  exportPDF(data: SheetData, format: "editable" | "2pages"): Buffer; // remplit la fiche officielle "edit" (F4.2, 126 champs AcroForm) — fait partie du contrat plugin, pas un mécanisme à part
  // Différé à un palier ultérieur : contentTypes() (homebrew MJ), canSpendXp, applyXp
}
```

**FR-1.3 — Front générique piloté par le schéma**

Le front Angular affiche l'assistant de création et la fiche à partir de `sheetSchema()`/`creationSteps()` sans code spécifique à Ryuutama codé en dur dans les composants génériques — seuls les composants de rendu spécifiques (ex. sélecteur de classe avec ses 3 talents) sont propres au plugin. Réalise l'objectif "aucun système hard-codé" de `docs/spec.md` §5.

---

### F2 — Seed de données Ryuutama

**FR-2.1 — Contenu de base (`ContentEntry`, scope `base`)**

Les 7 classes, leurs talents, les 3 types, le pattern d'attributs Polyvalent (seul implémenté ce palier, voir Open Question 1) et les 5 catégories d'armes favorites sont chargés en base au démarrage depuis un fichier JSON (voir `addendum.md` pour le détail complet des valeurs), avec `scope: "base"` (cf. modèle `ContentType`/`ContentEntry` de `docs/spec.md` §6).

**FR-2.2 — Localisation du seed, hors dépôt Git**

*(Révisé le 2026-09-25 : dossier versionné, textes reformulés.)* Les fichiers JSON de seed vivent dans un dossier dédié (ex. `apps/api/game-systems/ryuutama/data/`), **explicitement ajouté au `.gitignore`**. Raison : contenu sous droits d'auteur (règles officielles Ryuutama). Chaque instance de jdr-master doit fournir son propre seed localement — non distribué avec le dépôt public. Un `README` dans le dossier documente le format attendu et où se procurer le contenu légalement.

**Out of Scope :** homebrew MJ (`scope: "mj"` / `"partie"`), pas de mécanisme de gestion de contenu personnalisé ce palier.

---

### F3 — Création de personnage guidée (Ryuutama, niveau 1)

**Description :** Un joueur membre d'une partie Ryuutama accède à l'assistant de création depuis la page détail de la partie (cohérent avec le point d'entrée "Trouver une date" des paliers précédents). L'assistant déroule les étapes du `Guide du Voyageur` dans l'ordre (voir `addendum.md` §1), avec rendu adapté (formulaire simple, pas de stepper complexe — le nombre d'étapes est faible et linéaire pour Ryuutama). `[ASSUMPTION]` : un seul personnage actif par (joueur, partie) ce palier — pas de personnages multiples par partie.

**FR-3.1 — Choix de la classe**

Le joueur choisit 1 classe parmi les 7. L'UI affiche les 3 talents de la classe sélectionnée (effet, conditions, attributs utilisés, difficulté) pour que le choix soit informé. Les classes recommandées aux débutants (Chasseur, Guérisseur, Marchand, Ménestrel) sont signalées visuellement, sans bloquer le choix des autres.

**Consequences (testable):**
- Un seul `classId` peut être sélectionné à la fois.
- Les 3 talents de la classe choisie s'affichent avant validation de l'étape.
- **Artisan uniquement** : un sous-choix "type d'objet de spécialité" devient obligatoire et bloque le passage à l'étape suivante tant qu'il n'est pas fait.

**FR-3.2 — Choix du type**

Le joueur choisit 1 type parmi Attaque / Technique / Magie. Les avantages passifs du type choisi s'affichent.

**Consequences (testable):**
- Un seul `typeId` peut être sélectionné à la fois.
- Si Magie est choisi, un message explicite indique que le choix de sorts n'est pas encore disponible dans l'app et sera ajouté plus tard — le personnage reçoit les 3 avantages passifs du type Magie (Volonté +4 PE, Grimoire, Lié aux saisons) sans sélection de sorts opérationnelle.

**Out of Scope :** sélection de sorts (magie rituelle ou magie des saisons) — différée, voir Non-Goals.

**FR-3.3 — Répartition des attributs**

Le joueur choisit un pattern (Polyvalent — seul pattern aux valeurs confirmées ce palier, voir Open Questions) puis répartit librement les valeurs du pattern entre AGI/ESP/INT/VIG.

**Consequences (testable):**
- Chaque attribut reçoit exactement une valeur du multi-ensemble du pattern choisi (pas de doublon au-delà de ce que permet le pattern, pas d'omission).
- Les 4 attributs sont tous assignés avant de pouvoir continuer.

**FR-3.4 — Calcul automatique des statistiques dérivées**

Dès que les attributs sont assignés, l'UI affiche en direct PV (VIG×2), PE (ESP×2), Condition (VIG+ESP), Initiative (AGI+INT), Limite d'encombrement (VIG+3) — recalculés à chaque changement d'attribut avant validation finale. Réalise `computeDerived()`.

**FR-3.5 — Choix de l'arme favorite**

Le joueur choisit 1 arme favorite parmi les 5 catégories (arc, épée courte, épée longue, hache, lance). Les valeurs Toucher/Dégâts de la catégorie s'affichent (voir `addendum.md` §7). L'arme est ajoutée gratuitement à l'équipement de départ.

**FR-3.6 — Objet fétiche**

Champ texte libre, optionnel, sans effet mécanique.

**FR-3.7 — Équipement (mode pique-nique)**

Équipement de départ fixe attribué automatiquement (nécessaire de voyage individuel + nécessaire d'intendance de groupe partagé, cf. `addendum.md` §8) — aucune interaction joueur requise à cette étape pour ce palier.

**Out of Scope :** achat d'équipement avec budget de 1000 Po, catalogue d'objets — différé, voir Non-Goals.

**FR-3.8 — Champs narratifs**

Sexe, âge, particularités physiques, village natal, motivation, nom, personnalité — champs texte libres, optionnels, sans validation de contenu, sans effet mécanique.

**FR-3.9 — Validation finale**

À la soumission, `validate(data, "strict")` vérifie l'ensemble des règles strictes de `addendum.md` §9 (1 classe, 1 type, attributs conformes au pattern, 1 arme favorite valide, sous-choix Artisan si applicable). En cas d'échec, le joueur voit la liste des erreurs et ne peut pas soumettre tant qu'elles ne sont pas corrigées — **blocage dur, pas de dérogation** ce palier. La signature complète `validate(data, mode)` de `docs/spec.md` §5 est conservée dès maintenant (`mode: "mj"` en no-op réservé à P4) : c'est la façon dont ce palier "formalise" la question de propriété de la validité posée dans le brainstorm (`brainstorm-intent.md` §6), sans construire le mécanisme d'override lui-même.

**Consequences (testable):**
- Soumission avec 0 ou 2+ classes sélectionnées → rejetée avec message d'erreur explicite.
- Soumission avec des valeurs d'attributs ne correspondant à aucun pattern connu → rejetée.
- Soumission Artisan sans type d'objet de spécialité → rejetée.
- Soumission valide → personnage créé, redirection vers la fiche (F4).

---

### F4 — Consultation et export de la fiche

**FR-4.1 — Vue fiche en lecture seule**

Une fois créé, le personnage est consultable via une page dédiée reproduisant visuellement la fiche papier officielle dans la mesure du raisonnable pour le web (classe, type, talents, attributs, PV/PE/Condition/Initiative, arme favorite, équipement, champs narratifs). **Résolu par le run UX** (`_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/`) : desktop/tablette = disposition 2 colonnes fidèle au papier, mobile = sections empilables/accordéon (même identité visuelle, pas de décalque littéral).

**FR-4.2 — Export PDF**

Le joueur peut exporter sa fiche en PDF via `exportPDF()` (F1.2), dans 2 formats : **éditable** (champs restent modifiables) et **2 pages** (aplati, non modifiable). **Résolu** : 3 fichiers officiels fournis par l'utilisateur — `Ryuutama_fiche_de_voyageur_big_edit.pdf` (2 pages, 126 champs AcroForm réels, seul fichier remplissable de façon fiable), `Ryuutama_voyageur.pdf` (1 page, visuel pur) et `Ryuutama_voyageur_big.pdf` (2 pages, visuel pur, même contenu que le 1-page). Les 2 formats livrés ce palier utilisent le fichier "edit". Un 3e format ("1 page", format paysage condensé) est différé — il demanderait un positionnement de texte manuel sans les champs, jugé disproportionné tant que le besoin n'est pas confirmé à l'usage.

**FR-4.3 — Accès MJ**

Le MJ d'une partie peut consulter la fiche de n'importe quel personnage de ses joueurs sur cette partie (lecture seule, pas d'édition ce palier).

**FR-4.4 — Portrait de personnage** *(ajoutée suite au run UX du 2026-07-03, `ux-jdr-master-20260703/`)*

Le joueur peut uploader une image de portrait pour son personnage, avec un outil de recadrage/zoom/repositionnement permettant de centrer le visage dans l'avatar circulaire. Disponible à deux moments : une étape optionnelle et skippable en fin d'assistant de création (après les champs narratifs), et depuis la fiche à tout moment après création (ajout si absent, remplacement si insatisfait).

**Consequences (testable):**
- Sans portrait : l'avatar affiche les initiales du personnage (comportement par défaut, jamais un état "cassé").
- Avec portrait : l'avatar affiche la version recadrée (`object-fit: cover`, jamais déformée) ; la fiche affiche en plus l'image complète non recadrée dans un panneau dédié.
- L'étape de création est explicitement skippable — ne bloque jamais la validation finale du personnage (FR-3.9) en son absence.

**Out of Scope :** édition de la fiche après création (évolution XP, dons MJ, mode MJ-valide) — Palier P4. Rôle de groupe (cartographe/chef/chroniqueur/intendant) — décidé en session de jeu, pas à la création ; **[NOTE FOR PM]** prévoir un champ dédié sur la fiche pour l'indiquer plus tard, une fois le mécanisme de décision en session conçu. Outil de recadrage détaillé (implémentation exacte du contrôle zoom/repositionnement) — spine-only côté UX (`EXPERIENCE.md` §4), pas de mock visuel produit pour ce contrôle précis.

---

## API (esquisse NestJS)

```
# Registre de systèmes
GET    /game-systems                              → liste des systèmes installés (id, name, version)
GET    /game-systems/:id/schema                    → sheetSchema() + creationSteps() du système

# Personnages
GET    /parties/:id/characters                     → mes personnages sur cette partie (+ ceux des joueurs si MJ)
GET    /characters/:id                              → détail d'un personnage (avec derived calculé)
POST   /parties/:id/characters                      → créer un personnage (gameSystemId, sheetData)
GET    /characters/:id/export.pdf?format=editable|2pages → export PDF (fiche officielle "edit" remplie, éditable ou aplatie)
PUT    /characters/:id/portrait                      → upload/remplacement du portrait (image source + zone de recadrage)
DELETE /characters/:id/portrait                       → suppression du portrait (retour aux initiales)
```

Tous les endpoints nécessitent une session active (`AuthenticatedGuard`). `GET /characters/:id` : vérifie que l'appelant est le propriétaire du personnage OU le MJ de la partie associée.

---

## Exigences non fonctionnelles

**NFR-1 — Confidentialité du seed.** *(Révisée le 2026-09-25 : les JSON sont désormais versionnés, avec des textes reformulés — voir NFR4 du PRD 2026-07-24.)* Les fichiers JSON de contenu de règles Ryuutama (classes/talents/formules officielles) ne sont **jamais committés** dans le dépôt Git (contenu sous droits). `.gitignore` couvre le dossier de seed dès la première migration. Documentation claire dans le dossier sur comment fournir son propre seed localement.

**NFR-2 — Architecture réutilisable.** L'interface `GameSystemPlugin` implémentée ce palier doit être directement réutilisable pour le prochain système (Conte de Minuit) sans modification de signature — seule l'implémentation concrète du plugin change.

**NFR-3 — Mobile-first pour la consultation.** Comme les paliers précédents, l'accès à la fiche en séance se fait principalement sur mobile. La création peut tolérer une UX plus dense (formulaire), la consultation doit rester lisible sur petit écran.

**NFR-4 — Performance.** `computeDerived()` s'exécute côté client en temps réel (à chaque changement d'attribut pendant la création) sans appel réseau — calcul pur, pas de dépendance backend pour l'affichage live des stats dérivées pendant la création.

**NFR-5 — Règles partagées front/back.** `computeDerived()` et `validate()` sont des fonctions pures extraites dans un package workspace dédié `packages/game-rules` (distinct de `packages/shared`, qui reste type-only), importées à l'identique par `apps/web` et `apps/api` — aucune duplication de formule entre client et serveur. Tout besoin de données externes (contenu homebrew, aléatoire) est injecté en paramètre par l'appelant, jamais résolu en interne par le package.

---

## Ce qui est hors périmètre (ce palier)

- **Sélection de sorts** (magie rituelle ou magie des saisons) — le type Magie est sélectionnable et donne ses avantages passifs, mais aucune mécanique de sorts n'est implémentée. `[NOTE FOR PM]` : à notifier clairement dans l'UI pour éviter la confusion des joueurs qui choisiraient Magie en s'attendant à lancer des sorts.
- **Achat d'équipement complet** (budget 1000 Po, catalogue d'objets, spécificités multiplicatrices) — mode pique-nique uniquement ce palier.
- **Rôle de groupe** (cartographe/chef/chroniqueur/intendant) — décidé en session de jeu 1, pas à la création. Prévoir un champ futur sur la fiche.
- **Évolution du personnage** (XP, montée de niveau, achat de compétences) — Palier P4.
- **Validation niveaux 2-3** (dons MJ trackés, mode MJ-valide/override) — Palier P4. La signature `validate(data, mode)` est déjà en place ; seul le comportement de `mode: "mj"` reste à construire.
- **Homebrew MJ** (ajout de classes/objets custom, `ContentEntry` scope `mj`/`partie`) — palier ultérieur non planifié.
- **Personnage du MJ (homme-dragon)** — hors scope de ce guide et de ce palier.
- **Combat / moteur de résolution générique** — hors scope (jdr-master n'est pas un simulateur de combat, cf. vision "bridge Amsel → joueurs").
- **Herbes de soins en détail, Améliorations de sorts** — liées à la magie avancée, différées avec elle.
- **Autres systèmes** (Conte de Minuit, Draconis, Esteren) — paliers ultérieurs. Ordre indicatif Conte de Minuit → Draconis (teste d'abord les champs libres/workflow d'approbation), mais `brainstorm-intent.md` §5 laisse la porte ouverte à une priorité Draconis en P7 "si le groupe le réclame" — décision à reprendre le moment venu, pas figée par ce PRD.
- **Autres contenus Ryuutama** (personnage du MJ complet, catalogue équipement étendu, notes, villes) — d'autres PDFs existent, non traités ici ; à ajouter une fois la création de base fonctionnelle.

---

## Modèle de données (esquisse Prisma)

Reprend et complète `docs/spec.md` §6 pour ce palier.

```prisma
model GameSystem {
  id      String @id            // ex: "ryuutama"
  name    String
  version String
}

enum ContentScope { BASE MJ PARTIE }

model ContentType {
  id           String @id @default(uuid())
  gameSystemId String
  key          String            // ex: "class", "type", "attributePattern", "weaponCategory"
  label        String

  entries      ContentEntry[]

  @@unique([gameSystemId, key])
}

model ContentEntry {
  id            String        @id @default(uuid())
  contentTypeId String
  contentType   ContentType   @relation(fields: [contentTypeId], references: [id], onDelete: Cascade)
  scope         ContentScope  @default(BASE)  // BASE uniquement ce palier
  key           String        // ex: "artisan", "chasseur"
  data          Json          // talents, formules, etc. — structure définie par le plugin

  @@unique([contentTypeId, key])
}

model Character {
  id           String     @id @default(uuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  partieId     String
  partie       Partie     @relation(fields: [partieId], references: [id], onDelete: Cascade)
  gameSystemId String

  sheetData    Json       // classId, typeId, attributs, armeFavorite, objetFetiche, narratif...
  derived      Json       // PV, PE, Condition, Initiative, Encombrement — recalculé et mis en cache

  portraitUrl     String?  // image source complète, non recadrée (PortraitPanel) — null si absente
  portraitCropData Json?   // zone de recadrage (offset/zoom) appliquée pour générer l'avatar circulaire

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([partieId])
  @@index([userId])
}
```

**Note d'implémentation** : `sheetData`/`derived` en JSONB plutôt que colonnes typées — cohérent avec le principe "fiche pilotée par un schéma" de `docs/spec.md` §5 (un système = un schéma différent, pas de migration Prisma par système). La validation de structure se fait applicativement via `validate()`, pas au niveau base.

---

## Métriques de succès

- **Complétude** : un joueur peut aller du début à la fin de l'assistant de création sans blocage inattendu (hors erreurs de validation légitimes) dans 100% des cas testés manuellement.
- **Réutilisabilité** : l'ajout du système suivant (Conte de Minuit, palier futur) ne nécessite aucune modification de l'interface `GameSystemPlugin` définie ce palier — seule une nouvelle implémentation.
- **Fidélité** : les statistiques dérivées calculées par l'app correspondent exactement aux formules du guide officiel (vérification manuelle croisée sur au moins 3 personnages de classes différentes).

**Contre-métrique :** ne pas chercher à couvrir 100% du contenu du guide dès ce palier (magie, équipement complet) — le succès est la validité de l'architecture sur un scope volontairement réduit, pas l'exhaustivité des règles.

---

## Open Questions

1. **Patterns d'attributs Équilibré et Spécialiste** — **Résolu** : seul le pattern Polyvalent ({8,4,6,6}, seul aux valeurs confirmées par le PDF fourni) est implémenté ce palier (FR-2.1/FR-3.3). Équilibré et Spécialiste seront ajoutés dans une story de suivi dès que leurs valeurs exactes (livre de base Ryuutama) seront fournies.
2. **PDFs des fiches vierges officielles** — **Résolu** : 3 fichiers fournis (cf. FR-4.2). Nouveau point ouvert dérivé : le mapping exact champ personnage → nom de champ AcroForm reste à finaliser en story (Story 4.4), notamment pour le sous-ensemble de valeurs des listes déroulantes (le PDF officiel propose 12 classes, ce palier n'en couvre que 7).
3. **Talent Soins du Guérisseur** — le texte du guide est ambigu entre "(INT+ESP) ou INT" et "Réussite automatique" hors combat ; à clarifier en story si ce talent est implémenté avec un impact mécanique visible dès ce palier (probablement hors scope, les talents ne sont affichés qu'informativement ce palier — voir Assumptions).
4. **Multi-personnages par (joueur, partie)** — actuellement supposé 1 seul (voir Assumptions Index) ; à confirmer si un joueur peut vouloir plusieurs personnages sur la même partie (ex. one-shot avec pré-tirés).
5. **Héritage/composition de plugins** (ex. "Draconis hérite d'un plugin D&D 5e SRD générique et surcharge", `roadmap.md` décision #1) — identifié dans le brainstorm comme "à étudier avant P3/P7" mais non traité ici : Ryuutama seul ne nécessite aucun héritage. L'interface `GameSystemPlugin` telle que définie en F1.2 n'empêche pas un futur plugin d'en composer un autre en interne, mais le mécanisme concret (registre de dépendances entre plugins ?) reste à concevoir avant Draconis (P7/P8).

---

## Assumptions Index

- `[ASSUMPTION]` §F3 — Un seul personnage actif par (joueur, partie) ce palier. Voir Open Question 4.
- `[ASSUMPTION]` (implicite dans F3, FR-3.1 à FR-3.9) — Les talents de classe (effets, conditions, difficultés) sont affichés **informativement** dans l'UI de création mais **ne sont pas mécaniquement actionnables** dans l'app ce palier (pas de simulateur de jets/tests) — jdr-master reste un bridge de partage, pas un moteur de jeu. À confirmer si un talent devait avoir un effet applicatif direct (ex. Herboristerie générant réellement des objets en base).
