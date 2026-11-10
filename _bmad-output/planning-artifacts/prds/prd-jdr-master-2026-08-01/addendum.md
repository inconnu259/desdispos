# Addendum — Palier 9

Profondeur technique et contexte de décision qui n'ont pas leur place dans le PRD, mais que l'architecture et les stories devront connaître. Complète `prd.md`, ne le remplace pas.

## 1. État vérifié du serveur (constaté le 2026-08-01)

Ces constats ont été établis par lecture du code, pas par supposition. Ils fondent le §5 du PRD (« Dérogations serveur actées »).

### Endpoints existants

| Domaine | Existant |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Users | `GET /users/search` **uniquement** |
| Poll | Contrôleur monté sur `parties/:id/poll` → `GET /parties/:id/poll` · `POST /parties/:id/poll/:pollId/vote` · `PATCH /parties/:id/poll/:pollId/choose` · `DELETE /parties/:id/poll/:pollId` |

### Manques confirmés

- **Aucun endpoint de modification de profil.** Pas de `PATCH` utilisateur, pas de changement de mot de passe en session. FR-4 à FR-6 partent de zéro.
- **Modèle `User` sans préférences** : `id`, `email`, `pseudo`, `passwordHash`, `role`, `createdAt`. Aucun champ de réglage.
- **Aucun modèle `Favorite` ni `UserPreference`.**
- **Modèle `Announcement` sans notion de lecture** : `partieId`, `scenarioId`, `text`, `createdAt`. Rien pour tracer « vu ».
- **Retrait d'un vote impossible** : `CastVoteDto.answer` est contraint à `YES|NO|MAYBE` (pas de valeur vide), et le seul `DELETE` existant, **réservé au MJ**, supprime le sondage entier.

### Faux besoins écartés

- **Autocomplétion des invitations (FR-30)** : le *câblage* existe déjà — `GET /users/search` est appelé par `PartiesService.searchUsers()`. Mais l'endpoint fait une **égalité stricte**, d'où la dérogation D-8 (recherche partielle sur le pseudo). Reste purement front : la saisie au fil de la frappe et les garde-fous ergonomiques (Q-14).
- **Liste unifiée des parties (FR-7)** : aucun endpoint agrégé nécessaire. Décision explicite de l'utilisateur — le front connaît les rôles de l'utilisateur et appelle conditionnellement `parties?role=player` et/ou `parties?role=mj` (un ou deux appels). Les listes par rôle sont conservées, potentiellement utiles plus tard.

## 2. Alternatives écartées

**Persistance du thème et de l'état « annonce vue » — `localStorage` vs compte** *(FR-2, FR-13, D-1)*.
Le `localStorage` était l'option sans serveur, mais l'état reste attaché à *l'appareil* et non au *compte* : c'est précisément le symptôme constaté (thème conservé sur PC, perdu sur téléphone). Retenu : stockage sur le compte, avec repli local avant connexion — nécessaire puisque les écrans d'authentification s'affichent avant que l'utilisateur soit identifié.

**Mockup `DESIGN.md` comme référence contraignante pour la chronologie** *(FR-29)*.
Écarté. Le défaut relevé le 14/07 (accroches absentes, espacement, dates manquantes) disparaît dans la refonte complète de FR-29. Le mockup reste une inspiration parmi d'autres.

**Seuils d'accessibilité chiffrés (44 px tactile, 14 px texte)** *(P-2, §6)*.
Proposés puis retirés après retour d'usage réel : l'utilisateur, testant sur son propre Android, n'a rencontré aucun problème de tactile, de lisibilité ni de contraste. Écrire des critères d'acceptation contre un problème non observé aurait alourdi chaque story sans bénéfice. Devenu principe de vigilance (P-2).

**« Jamais la couleur seule » imposant une icône ou un libellé** *(P-1, FR-14)*.
Assoupli sur proposition de l'utilisateur : la typographie est un second signal valide et souvent le plus élégant. Exemple retenu — nom de personnage systématiquement en italique, même couleur que le nom de joueur.

## 3. Notes d'implémentation

**FR-23 (cadenas de visibilité) — le point dur.**
C'est un modèle d'autorisation à part entière : définition des champs verrouillables, stockage par partie, et **filtrage côté serveur** (jamais un simple masquage à l'affichage, qui laisserait fuiter les données dans les réponses API). À traiter comme une epic autonome ; premier candidat à sortir du palier si le périmètre doit être resserré.

**FR-33 (séances cross-partie) — contrainte de sécurité.**
Contrainte posée par l'utilisateur : ne remonter que les séances des parties dont il est réellement membre ou MJ. Le risque est une fuite d'information entre parties tierces ; le filtrage doit être serveur.

**FR-43 (réorganisation des thèmes).**
La séparation de `tones.ts` en fichiers par thème est un refactor de structure, pas une relecture de texte. Le typage réel est `Record<Theme, Record<string, string>>` : il garantit la présence des **trois thèmes**, mais **pas** celle d'une clé donnée dans chacun. La découpe ne fait donc rien perdre — c'est au contraire l'occasion d'ajouter la garantie absente. À trancher à l'architecture (Q-2) : typage dérivé d'un thème de référence, ou validation au build.

**FR-2 (thème avant connexion).**
Les écrans d'authentification s'affichent avant identification : un repli local est structurellement nécessaire, et la préférence de compte prend le relais après connexion.

## 4. Modifications déjà appliquées au dépôt (2026-08-01)

### 4.1 Défaut corrigé en cours de cadrage

Quatre services front redéfinissaient chacun `const API = 'http://localhost:3000'` en dur au lieu d'utiliser `API_BASE` : `auth`, `parties`, `invitations`, `join`. Incohérence **préexistante** — un `TODO` l'anticipait dans `auth.service.ts` et un commentaire de `invitations.service.spec.ts` la documentait — restée invisible tant que tout tournait sur `localhost`. Elle rendait l'application inutilisable depuis tout autre appareil : la connexion échouait avec un message trompeur (« identifiants invalides » alors que l'API était injoignable), ce qui a directement inspiré FR-38.

Corrigé : les quatre services pointent sur `API_BASE`. Vérifié — aucune occurrence de `localhost:3000` dans les chunks servis, 1017/1017 tests web au vert.

### 4.2 Aménagements temporaires à reprendre au Palier 11

Faits avec accord explicite, pour permettre le test sur téléphone réel via le réseau local. Consignés dans `docs/backlog.md` § Palier 11.

- `apps/web/src/app/core/api-base.ts` — `API_BASE` est calculé depuis `window.location` au lieu d'être figé sur `http://localhost:3000`. En production, l'API sera vraisemblablement derrière le même domaine (reverse-proxy, chemin `/api`) et/ou en HTTPS : le port 3000 en dur n'aura plus de sens.
- `apps/api/src/main.ts` + `.env` — `WEB_ORIGIN` accepte une liste d'origines séparées par des virgules. **En production, n'y laisser que l'origine publique réelle, jamais une IP de réseau local.**

C'est cet accès réseau local qui rend les exigences mobile du PRD vérifiables sur appareil réel (P-3).

## 5. État vérifié du serveur pour le §4.7 bis (constaté le 2026-08-17)

Constats établis par lecture du code après livraison de l'épic 30, avant inscription de D-15 à D-18. Ils expliquent *pourquoi* certains irritants ne sont pas des défauts de réalisation mais des trous de spécification.

### 5.1 Pourquoi le filtre « inscriptions ouvertes » ne produit rien à l'écran

`MyCalendarOpenInscriptionEntry` porte son propre démenti en commentaire : *« Non filtrée par plage de dates : une séance en attente d'inscriptions n'a pas encore de date propre »*. Une inscription ouverte n'a **aucune coordonnée** dans une grille de dates. Aucune implémentation ne pouvait donner à ce filtre un effet visible : l'erreur est dans FR-46, qui l'a rangée parmi les couches. D'où son déplacement vers l'Agenda (FR-56).

**La clé reste, l'interrupteur part.** `CALENDAR_LAYER_KEYS` est une union fermée validée par `@IsIn(..., { each: true })` et **persistée par compte** dans une table relationnelle (`calendarLayers`, story 30.4). Retirer la clé imposerait une migration de préférences livrées trois jours plus tôt, pour aucun gain fonctionnel.

### 5.2 Ce que la tendance de vote coûte, selon le contexte

| Contexte | Données disponibles | Coût |
|---|---|---|
| Calendrier d'une **partie** | `SessionPollDto.options[].votes` — chaque votant avec son `userId`, son nom affiché et sa réponse | **Nul.** Tendance, favoris, « ma réponse » et « qui manque » se calculent côté client, sans appel supplémentaire |
| Calendrier **personnel** | `MyCalendarPollEntry.options` — uniquement `{ date, slot }` | **D-17.** Ni compteurs ni réponse propre. Enrichissement du DTO, aucune migration |

### 5.3 Ce qui existe déjà pour FR-52, et ce qui manque

Les chemins de vote côté serveur sont au nombre de cinq : créer, voter, retirer sa réponse, sceller (`PATCH :pollId/choose`), clore. Conséquences pour FR-52 :

- **Créer un vote par sélection sur la grille : front seul.** `CreatePollDto` prend déjà `options: { date, slot }[]` — exactement ce qu'un mode de sélection produit.
- **Sceller depuis la grille : front seul.** L'endpoint existe.
- **Ajouter ou retirer une option sur un vote ouvert : rien n'existe (D-16).** C'est le seul manque, et il porte une règle métier — d'où Q-22.

### 5.4 Pourquoi la règle d'écrasement de FR-57 est gratuite

L'indisponibilité dérivée d'une séance **n'est pas stockée** : `getActiveDeclarationsWithDerived()` la calcule à la lecture et la fusionne aux déclarations (`availability.service.ts`, AD-9). Il n'existe donc aucune ligne à écraser, et l'annulation d'une séance libère le créneau sans traitement. La règle posée par l'utilisateur — « Remplacer ne remplace que mes propres déclarations, la séance résiste, et si elle est annulée je redeviens disponible » — décrit le comportement structurel du modèle actuel.

### 5.5 Ce que D-18 renverse, exactement

La story 30.2 porte une garde formelle : **interdiction de faire passer le panneau de déclaration par la route groupée**, au motif que celle-ci n'offre ni écrasement ni conservation (AD-21 tranchant que le lot échoue et que l'utilisateur corrige), et que l'unification silencieuse ferait disparaître le dialogue de résolution, `createWithHoles()` et le mécanisme de découpe de la story 1.7.

FR-57 demande précisément l'inverse : la route groupée doit **absorber** ces mécanismes. La garde n'est pas violée par inadvertance, elle est levée sciemment. La découpe (`createWithHoles`) et la résolution de conflits doivent être portées jusque dans le lot, sans duplication du prédicat de conflit — lequel est déjà extrait et appliqué en mémoire depuis la story 30.2.

### 5.6 La récurrence, angle mort de la sélection

`AvailabilityDeclaration` porte `recurKind: RECURRING` avec `dayOfWeek`. « Tous les mardis soir » ne s'exprime pas par un glissement sur des dates : c'est une règle, pas une énumération. Le panneau de déclaration est aujourd'hui **le seul chemin** vers cette forme. FR-57 le conserve comme chemin avancé pour cette raison précise — le supprimer retirerait une capacité livrée à la story 1.7.

### 5.7 Ce que « informations pratiques » n'est pas (D-15) — *amendé le 2026-08-19*

`Seance` porte `dateValidee` et un créneau de la journée (`MORNING` / `AFTERNOON` / `EVENING` / `FULL_DAY`). **Ce créneau reste la seule granularité temporelle du modèle.**

La rédaction d'origine interdisait « tout champ d'heure ». Elle confondait deux objets qu'il faut séparer :

| | Ce que c'est | Verdict |
| --- | --- | --- |
| **Heure-étiquette** | une chaîne `"20:30"` affichée et transmise ; rien ne la lit, ne la compare, ne la trie, ne la calcule | ✅ autorisée |
| **Heure-modèle** | un `DateTime` entrant dans la détection de conflits, la heatmap, la dérivation d'indisponibilité | ❌ **interdite** |

**Ce que D-15 interdit toujours, et qui est le vrai motif :** un **conflit d'agenda calculé à la minute**. Toute la chaîne (`AD-9`, heatmap, dérivation d'indisponibilité, préséance de la case) raisonne en créneau de journée ; une heure entrant dans le moteur y créerait une seconde granularité temporelle que rien ne sait consommer.

**Gardes, opposables à toute story ultérieure :**

1. `heureRdv` est une **chaîne `"HH:MM"`** — jamais un `DateTime`, jamais un type `time` Prisma. *Une colonne typée « heure » invite le code suivant à calculer avec.*
2. Rien ne la parse, ne la compare, ne la trie, ni ne l'injecte dans la chaîne de disponibilité.
3. **Une seule heure**, jamais un début/fin — **la durée reste interdite**.
4. **Aucun fuseau horaire.**
5. `lieu` est une chaîne courte **non structurée** — ni adresse, ni géocodage.
6. Les trois champs sont **facultatifs**.

Trois champs, un point d'écriture MJ dans la chronologie du scénario, une lecture sur le créneau et dans l'Agenda.

## 6. Retour d'usage du 2026-09-20 : point d'entrée de la création (FR-58 → FR-60)

Constaté dans le code le 2026-09-20 ; ces éléments détaillent D-19 et D-20 sans encombrer le PRD.

### 6.1 Pourquoi trois systèmes sur quatre mènent à une erreur

- La constante partagée des systèmes de jeu propose **quatre** systèmes au formulaire de création de partie, et le DTO de création les accepte tous.
- **Seul Ryuutama a un module** : le schéma de fiche d'un autre système lève une 404. Une partie Draconis se crée donc sans problème, puis échoue à la première création de personnage.
- La liste des systèmes servie par l'API reflète **ce qui est en base**, pas les modules disponibles : elle ne peut pas servir de signal.

### 6.2 Choix : un indicateur sur la constante partagée (D-19)

Un indicateur booléen porté par la constante partagée des systèmes, vrai pour Ryuutama seul, devient la source de vérité unique : validation du DTO, formulaire de création de partie, et points d'entrée de création (FR-58) le lisent, **sans appel réseau**.

**Alternative écartée : lire la liste des systèmes servie par l'API.** Elle liste tout ce qui est en base ; il aurait fallu l'enrichir côté API pour un résultat équivalent à une constante déjà partagée avec le front.

### 6.3 Modèle de l'Homme Dragon (D-20)

- L'Homme Dragon **n'est pas un personnage dans le modèle** : c'est une table distincte, unique par utilisateur, partie et système, et absente de la liste des personnages de l'utilisateur.
- Sa fiche n'a **pas de route propre** : elle est incrustée dans l'écran de la partie, pour le MJ Ryuutama. L'ouvrir depuis « Personnages » exige soit une route dédiée, soit une navigation vers l'écran de la partie — à trancher à la création de la story.
- **Choix ouvert, laissé à la story :** endpoint dédié ou extension de la lecture existante. Contrainte ferme : ne pas casser le contrat de la liste des personnages ni ses consommateurs (écran « Personnages », tableau de bord, tris).
- **Le serveur autoriserait un MJ à créer un personnage joueur sur sa propre partie.** Ne pas l'exposer est un choix produit (FR-58), pas une contrainte technique.

**Révisé le 2026-10-04 (AD-23, D-22).** Les deux premières puces décrivent l'état d'origine. Désormais : la table n'est plus unique par utilisateur, partie et système ; le lien est porté par `Partie.hommeDragonId`, un Homme Dragon a 0..N aventures, et sa fiche a une route propre (`/homme-dragons/:id`), plus incrustée dans l'écran de la partie.
