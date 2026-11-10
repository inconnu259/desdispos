# Revue « grille de qualité » — ARCHITECTURE-SPINE Palier 9

- **Cible :** `_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md`
- **Références :** PRD Palier 9 (`prd.md` + `addendum.md`, 44 FR, D-1..D-10, Q-1..Q-14) ; spines parentes Palier 7 (`…2026-07-18-p7`) et Palier 8 (`…2026-07-24`)
- **Vérifications brownfield faites pour cette revue :** `apps/web/src/app/core/realtime/realtime.service.ts`, `apps/web/src/app/core/mode/mode.service.ts`, `apps/api/src/characters/character.service.ts` (`toDto`), `apps/api/src/characters/characters.controller.ts` (3 exports PDF), `packages/shared/src/index.ts` (`UserSearchResultDto`, `SlotStatus`, `AvailableSlotDto`, `AggregatedSlotDto`), `apps/api/src/` (modules existants, dont `email/`)
- **Date :** 2026-08-04
- **Verdict :** spine solide et bien ancrée dans le code réel, mais **deux points de divergence de premier ordre ne sont pas fixés** (forme des signaux d'état, mécanique de rafraîchissement temps réel de la liste) — à corriger avant d'écrire les stories §4.2.

---

## 1. Fixe-t-elle les vrais points de divergence pour les stories ?

### Ce qui est bien fixé

| Point de divergence | Traitement | Jugement |
| --- | --- | --- |
| Où vit une préférence de compte | AD-1 : colonne typée si scalaire, modèle relationnel si multi-valué, **jamais** de table clé/valeur ni de blob `preferences` | Excellent — la Rule ferme explicitement la troisième forme, ce que la plupart des spines oublient |
| Forme des DTO d'identité | AD-2 : `pseudo` **et** `displayName`, exception unique et nommée | Excellent — l'exception est énoncée, donc non réinventable |
| Point d'application du filtrage de fiche | AD-7 (1) : `toDto()` | **Vérifié exact.** `toDto(character, ownerPseudo, isMj, canSeeNotes)` est déjà une fonction unique de `character.service.ts` recevant déjà des drapeaux dérivés du lecteur, et les 3 exports PDF passent bien par `findOne()`. La Rule est applicable telle quelle, sans changement de signature non dit |
| Unité verrouillable (Q-12) | AD-7 (2) : clé de `sheetSchema`, sous-champs seulement si la clé le déclare, `narrative` énuméré pour Ryuutama | Tranche réellement la question bloquante du PRD, et le fait de façon data-driven (un champ ajouté plus tard est verrouillable sans code) |
| Représentation de « n'a pas répondu » | AD-10 : suppression de ligne, enum inchangé | Ferme la seule alternative plausible |
| Devenir de `ModeService` | AD-11 : évidé, jamais réécrit, `seq` conservé | **Vérifié :** le compteur anti-course de `mode.service.ts` est bien actif et commenté (bug de production). Interdire la réécriture est le bon réflexe |
| Non-fuite cross-partie | AD-9 : conversion à la lecture en `UNAVAILABLE`, aucun nouveau `SlotStatus`, jamais persisté | **Vérifié :** `SlotStatus`, `AvailableSlotDto`, `AggregatedSlotDto` existent sous ces noms exacts. Non-fuite structurelle et non déclarative — la bonne forme |
| Garantie de complétude des thèmes (Q-2) | AD-13 : thème de référence typant les deux autres | Transforme un défaut d'exécution en erreur de compilation ; répond précisément à la question posée |

### Ce qui manque — points de divergence non fixés

**(A) La forme des signaux d'état (AD-3) — grave.**
AD-3 fixe la **topologie d'appel** (un appel, une carte `partieId → signaux`, requêtes groupées) et rien d'autre. Or FR-12 énumère **dix signaux hétérogènes** (4 côté joueur, 6 côté MJ) plus une hiérarchie d'affichage (« mise en avant » / « en retrait »). Ne sont fixés nulle part :

- la forme du DTO de signaux (drapeaux booléens ? liste d'actions requises typées ? compteurs ? données jointes, ex. la *date* de la prochaine séance, qui n'est pas un booléen) ;
- **où se décide « cette partie requiert une action »** et l'ordre de priorité entre signaux : serveur ou front ?
- ce que renvoie l'endpoint pour une partie sans signal (entrée absente vs. entrée à drapeaux faux) — deux agrégations front différentes selon le choix.

Ce n'est ni décidé, ni reporté, ni posé en question ouverte : c'est un trou. FR-12 est bindé par trois AD (AD-3, AD-8, AD-14) et alimente FR-3 et FR-10 ; c'est le contrat le plus consommé du palier. Deux stories écriront deux contrats.

**(B) La dérivation de l'état d'une partie (AD-8) — moyenne.**
La Rule dit « dérivés à la lecture, à un seul endroit » sans dire **de quel côté** ni **sous quel nom**. Conséquence concrète : FR-10 demande un filtre par statut (`en cours` / `terminée` / `pas encore commencée`). Le front ne dispose pas, dans la liste des parties, du nombre de scénarios/séances nécessaire pour dériver « pas encore commencée » — la dérivation doit donc vivre côté serveur et sortir dans le DTO de partie, mais la spine ne le dit pas et ne nomme pas le champ. Divergences possibles : dérivation front sur `closedAt` seul (faux pour « pas encore commencée »), champ `status` calculé serveur, ou paramètre de requête `?status=` sur `/parties`. À trancher en une phrase.

---

## 2. Chaque Rule est-elle applicable, et empêche-t-elle vraiment la divergence annoncée en « Prevents » ?

Passage AD par AD :

| AD | Applicable ? | La Rule couvre-t-elle son « Prevents » ? |
| --- | --- | --- |
| AD-1 | Oui — vérifiable au schéma Prisma | Oui, y compris la troisième forme (blob) explicitement interdite |
| AD-2 | Oui — vérifiable par relecture des DTO de `packages/shared` | Oui. `UserSearchResultDto` expose bien `email` aujourd'hui : l'écart signalé est réel et la correction est nommée |
| AD-3 | **Partiellement** — la topologie est vérifiable, le contrat ne l'est pas (cf. §1-A) | Le « Prevents » sur le fan-out est couvert ; celui sur « un contrat d'endpoint qui changerait » ne l'est pas, faute de contrat |
| AD-4 | Oui — vérifiable par la localisation des contrôleurs | Oui. Bonne distinction route/module, rarement faite explicitement |
| AD-5 | Oui — le pattern `PasswordResetToken` existe, `EmailModule` existe | Oui, et le point le plus fin (retour arrière + coupure de sessions + réinit forcée) est traité |
| AD-6 | Oui | Oui — aligne explicitement les deux chemins de changement de mot de passe |
| AD-7 | Oui — **vérifié contre le code**, `toDto()` est bien le point unique traversé par `findOne`/`findByPartie`/les 3 exports PDF | Oui, les trois « Prevents » sont couverts, y compris la fuite par export PDF (fuite réelle constatée aujourd'hui) |
| AD-8 | **Partiellement** (cf. §1-B) | Le « Prevents » (statut à 3 valeurs piloté à la main) est couvert ; le corollaire (qui dérive, où) ne l'est pas |
| AD-9 | Oui | Oui — non-fuite structurelle, pas déclarative |
| AD-10 | Oui | Oui |
| AD-11 | Oui | Oui — interdire la réécriture est plus efficace qu'un rappel de prudence |
| AD-12 | Oui | Oui — reporte l'apparence **sans** rouvrir la divergence, puisque le point d'application est unique (cf. §3) |
| AD-13 | Oui | Oui sur la complétude ; **réserve** sur la persistance (cf. §5, constat mineur) |
| AD-14 | **Non — la Rule ne produit pas le comportement annoncé** (cf. ci-dessous) | Non |

### AD-14 — défaut d'applicabilité (grave)

Le « Prevents » vise « un badge d'état de partie qui reste périmé jusqu'au rechargement de la page ». La Rule prescrit : émission sur `partie:{id}` côté serveur, et côté front un `PartySignalsService` « qui se rafraîchit sur les deux préfixes `partie:` et `user:` ».

Le mécanisme hérité ne le permet pas tel quel :

1. Le tableau `handlers` de `RealtimeService` ne se déclenche que **sur une connexion `EventSource` effectivement ouverte** (`connect(topic)` → un `EventSource` par topic). Sur l'écran de **liste des parties**, aucune connexion `partie:{id}` n'est ouverte — le composant de liste n'a qu'un topic naturel, `user:{id}`. Un `emit(partie:{id})` de clôture (AD-8) ou de configuration de visibilité (AD-7) **n'atteindra donc jamais** un utilisateur assis sur la liste. La Rule est inerte exactement là où elle est censée agir.
2. Symétriquement, inscrire `PartySignalsService` sur le préfixe `partie:` le fait se déclencher sur **toute** mutation de **toute** partie dont une page est ouverte — c'est précisément le motif retiré en production : `ModeService` a été **reculé de `partie:` vers `user:`** après un bug documenté dans `realtime.service.ts` et `mode.service.ts` (rafraîchissement complet non protégé, liste de parties vidée silencieusement). AD-3 cite ce bug comme justification et AD-14 réintroduit le motif qui l'a causé.
3. Le cas « un composant ouvre plusieurs topics simultanément » est **explicitement reporté par la spine du Palier 7** (section Deferred : « cas non rencontré par les 10 composants actuels — à traiter si un futur composant en a besoin »). AD-14 en a besoin et ne le rouvre pas.

Trois issues divergentes s'offrent aux stories, sans arbitrage : ouvrir N connexions `partie:` depuis la liste ; faire émettre au serveur un `user:{id}` supplémentaire aux membres concernés lors des mutations de signal ; ou accepter la péremption jusqu'au retour sur la liste. **À trancher dans la spine.**

---

## 3. Y a-t-il un « Deferred » qui laisserait deux stories diverger ?

Passage en revue des 12 entrées :

- **Q-13 / FR-26** — correctement traité : marqué bloquant, avec un **comportement par défaut explicite** (« se réduit au périmètre de FR-24 ») ; une story écrite avant l'arbitrage a une conduite définie. Bon report.
- **Traitement visuel de FR-14** — le report est sûr **parce que** AD-12 impose un composant unique : le choix ne peut atterrir qu'à un seul endroit. C'est le modèle du bon report ; à généraliser (cf. §4, P-1).
- **Q-1, Q-5, Q-6, Q-8, Q-9** — conception d'écran, aucune structure engagée ; sûrs.
- **Q-14** — sûr : le contrat de DTO (pseudo seul) est déjà verrouillé par AD-2 ; ne restent que des seuils ergonomiques, sans conséquence de structure.
- **Registre de plugin, homebrew, hors-périmètre PRD §6, environnement/déploiement** — reports hérités, cohérents.

**Aucun report dangereux détecté.** La section Deferred est la partie la mieux tenue de la spine : chaque report est justifié par l'absence d'incidence structurelle, ou neutralisé par une AD qui garantit un point d'atterrissage unique.

En revanche — et c'est l'inverse du défaut habituel — **les deux vrais trous (§1-A, §1-B, §2/AD-14) ne figurent pas en Deferred** : ils ne sont pas reportés, ils sont simplement absents. Un report explicite les rendrait au moins visibles.

---

## 4. Couverture du PRD (44 FR, 10 dérogations, questions bloquantes)

### FR — couverture nominale complète

Les 44 FR (dont FR-4b) sont présents en `binds` **et** dans la « Capability → Architecture Map ». Aucun FR orphelin. Deux nuances :

- **Incohérence mineure de rangement :** FR-32 apparaît dans la ligne « refontes d'écran — aucune AD dédiée » alors qu'AD-9 le binde explicitement. Cosmétique.
- **Densité de gouvernance :** une ligne agrège **14 FR** (FR-18, FR-21, FR-24→FR-29, FR-31, FR-32, FR-36, FR-40) sous « aucune AD dédiée — travail d'UI, gouverné par les conventions ». Voir ci-dessous : les conventions invoquées ne couvrent pas ces FR.

### Dérogations serveur — 10/10 couvertes

| D | Gouvernée par | OK |
| --- | --- | --- |
| D-1 | AD-1, AD-4 | ✅ |
| D-2 | AD-2, AD-4, AD-5, AD-6 | ✅ (le plus fouillé du palier) |
| D-3 | AD-1 | ✅ |
| D-4 | AD-7 | ✅ |
| D-5 | AD-10 | ✅ |
| D-6 | AD-9 | ✅ |
| D-7 | Deferred/Q-13, requalification prévue | ✅ (report conforme au PRD) |
| D-8 | AD-2 + `users.service.ts` au Structural Seed | ✅ |
| D-9 | AD-8 | ✅ sur le modèle, ⚠️ sur la dérivation (§1-B) |
| D-10 | AD-4 | ✅ |

### Questions ouvertes

Q-2 (AD-13), Q-3 (AD-5), Q-4 (AD-6), Q-11 (AD-3, partiellement — cf. §1-A), **Q-12 (AD-7, réellement tranchée)** : les cinq questions à trancher « à l'architecture » sont traitées. Q-13 reste ouverte et signalée bloquante, conformément au PRD. Q-1/Q-5/Q-6/Q-8/Q-9/Q-14 reportées à la conception, conformément au PRD. Q-7/Q-10 closes en amont. **Rien n'est passé à travers.**

### Trou de couverture : le principe transverse P-1

Le PRD pose P-1 (« jamais la couleur seule ») comme s'appliquant à **tout** écran refondu, et cite nommément quatre informations concernées : rôle MJ/joueur (FR-8), partie active/terminée (FR-12, FR-44), joueur/personnage (FR-14), état d'une séance (FR-29). La spine ne l'ancre que sur **un** de ces quatre cas : AD-12, l'identité.

Les trois autres retombent dans la ligne « gouverné par les conventions » — mais la table *Consistency Conventions* ne comporte **aucune ligne** sur la signalétique d'état : ses dix lignes sont des conventions de données, de routage, de sécurité et de temps réel, plus deux lignes d'UI (textes de thème, affichage d'un nom). Or l'argument qui a justifié AD-12 (« dix écrans appliquant à la main deux classes CSS, dont un les oubliera ») s'applique mot pour mot aux badges d'état de partie et de séance, répartis sur au moins la liste des parties, la vue de partie, la chronologie et le calendrier. Pour une spine dont le centre de gravité est déclaré **front**, c'est le trou de couverture le plus visible après §1-A.

*Note :* P-3 (parité desktop/mobile) et P-4 (états vides) sont, eux, légitimement laissés aux stories — ce sont des réflexes de conception, pas des points de divergence structurelle.

---

## 5. Une AD nouvelle affaiblit-elle un invariant hérité ?

**Hérités correctement portés :** P1-AD-1 à P1-AD-5, P5-AD-4, P6-AD-1, P7-AD-2, P7-AD-4, P8-AD-6, P8-AD-9 sont tous repris avec un « Binds here » concret, pas décoratif. La ligne P6-AD-1 est particulièrement bien tenue : AD-1 (relationnel) et AD-7 (JSON) sont présentés comme les **deux côtés** de l'arbitrage hérité, avec le critère explicite (« écrite d'un bloc, jamais interrogée par valeur » → JSON). Aucune contradiction.

**Tension réelle, unique :** **AD-14 vs. P7-AD-6 et le Deferred du Palier 7** (cf. §2). Ce n'est pas une contradiction frontale — la spine n'énonce rien de faux — mais elle **consomme une capacité que sa parente a explicitement laissée ouverte**, sans la rouvrir ni la trancher. C'est le seul endroit où l'héritage est traité par omission.

**Deux réserves mineures :**

- **AD-13 / migration du thème.** `User.theme @default("grimoire-emeraude")` combiné à « un thème local ne remonte jamais écraser la préférence du compte » signifie que chaque utilisateur existant **perd silencieusement son thème courant** à la première connexion après migration — soit exactement le symptôme que FR-2 vient corriger. Ni migration ponctuelle (remontée unique du `localStorage` à la première connexion) ni acceptation explicite du désagrément ne sont énoncées. Faible impact réel (deux utilisateurs), mais c'est un choix, pas un détail d'implémentation.
- **AD-13 / lieu de validation.** « `theme` validée à la frontière API contre la liste des thèmes » : la liste des thèmes vit côté front (`core/theme/tones/`, AD-13). Le serveur aura donc besoin de sa propre copie — une seconde source de vérité que l'AD ne nomme pas et qui contredit son propre esprit. À dire (ex. liste dans `packages/shared`, dérivée du registre).
- **Cosmétique :** l'ERD attribue `displayName` à AD-2, le bloc Prisma à AD-1.

---

## 6. Chaque dimension de cette altitude est-elle décidée, reportée, ou posée en question ?

| Dimension | Statut | Jugement |
| --- | --- | --- |
| Modèle de données | Décidée — bloc Prisma complet (3 colonnes, 3 modèles, 1 enum) + « aucun ajout de modèle pour… » explicite | Excellent : la liste des non-ajouts vaut autant que celle des ajouts |
| Découpe en modules | Décidée — AD-4, diagramme de dépendances, source tree | Complète |
| Contrats d'API | **Partielle** — routes énumérées, **formes de DTO non fixées** pour les signaux (§1-A) et l'état dérivé (§1-B) | Trou principal |
| Autorisation | Décidée — AD-4 (argon2/sessions chez `AuthService`), AD-7 (verrouillage = préférence anti-spoil, pas modèle de sécurité), AD-9 (non-fuite structurelle) | Solide, et la qualification « pas un modèle de sécurité » est un arbitrage utile pour la revue de sécurité à venir |
| Temps réel | **Décidée mais non applicable** (AD-14, §2) | À reprendre |
| Structure front | Décidée — AD-11, AD-12, AD-13, source tree | Bonne, hors P-1 (§4) |
| Stack / dépendances | Décidée — aucun ajout | Net |
| **Enveloppe opérationnelle (déploiement, environnements, exploitation)** | **Explicitement traitée en Deferred** : aucun service externe, aucune variable d'environnement, aucune évolution de la topologie Docker Compose ; les deux aménagements de développement (`API_BASE` calculé, `WEB_ORIGIN` multi-origines) sont nommés et rendus à la propriété du Palier 11 | **Traitement exemplaire.** La dimension n'est pas décidée par défaut ni oubliée : elle est nommée, bornée, et son propriétaire est désigné. C'est la bonne façon de ne pas décider |
| Migration / reprise de données | **Partielle** — le backfill `displayName ← pseudo` est dit ; la reprise du thème local ne l'est pas (§5) | Point mineur |
| Tests / observabilité | Non traitée | Acceptable à cette altitude sur ce projet (conventions de test déjà établies au dépôt, aucune AD n'en dépend) |

---

## Synthèse des actions recommandées

Par gravité décroissante :

1. **AD-14 — trancher la mécanique de rafraîchissement de la liste.** Choisir entre (a) émission serveur d'un `user:{id}` supplémentaire aux membres concernés lors des mutations porteuses de signal, (b) N connexions `partie:` depuis la liste, (c) péremption acceptée jusqu'au retour sur l'écran. L'option (a) est la seule cohérente à la fois avec le recul de `ModeService` sur `user:` et avec le Deferred du Palier 7. Sans arbitrage, la Rule ne produit pas son « Prevents ».
2. **AD-3 — fixer la forme du DTO de signaux** et dire **où** s'arbitre « cette partie requiert une action » (serveur ou front), ainsi que la représentation d'une partie sans signal.
3. **AD-8 — nommer le côté et le champ** de l'état dérivé (`en cours` / `terminée` / `pas encore commencée`), sous peine de rendre FR-10 non implémentable de façon cohérente.
4. **P-1 — ajouter une ligne de convention** sur la signalétique d'état (second signal non chromatique obligatoire, point d'application unique), sur le modèle de ce qu'AD-12 fait pour les noms.
5. **AD-13 — deux précisions :** reprise unique du thème `localStorage` à la première connexion post-migration (ou acceptation explicite de sa perte) ; lieu de la liste de thèmes utilisée pour la validation serveur.

Les points 1 à 3 sont à traiter **avant** l'écriture des stories §4.2 ; les points 4 et 5 peuvent l'être en même temps que la première story concernée.
