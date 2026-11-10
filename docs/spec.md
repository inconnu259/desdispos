# Spec — Plateforme de gestion de parties de JDR (nom à définir)

> **Statut : v0.2 — VISION / BROUILLON.**
> Décrit la cible idéale, pas le découpage en tâches (ça, c'est `docs/backlog.md`).
> Itératif. Les points marqués ⚠️ sont des décisions ouvertes.

---

## 1. Pitch

Plateforme web **open source** et **auto-hébergeable** pour gérer des parties de jeu de rôle sur table,
côté **MJ** comme côté **Joueur**, sur **plusieurs systèmes de jeu**.

Contraintes fortes :
- **Open source**.
- **Onboarding ultra-simple** : `docker compose up` et tout tourne (front + back + base + jeu de données
  de démo). Un nouveau dev contribue sans galère ; on change de machine sans rien reconfigurer.
- **Auto-hébergeable** (Raspberry Pi / petit serveur) ou déployable à moindre coût.
- **Architecture évolutive** : démarrer petit (1 système, 1 MJ) sans verrouiller le multi-système ni le multi-MJ.

---

## 2. Périmètre & ambitions

| | **v1 (premier jalon réel)** | **Cible idéale** |
|---|---|---|
| Systèmes de jeu | **1 système** (Draconis pressenti) | Multi-systèmes via **plugins** |
| Utilisateurs | Mon groupe (1 MJ + joueurs) | Plateforme **multi-MJ** |
| Format de partie | Campagne linéaire + **one-shot** | Linéaire, épisodique (« agence ») **et** one-shot |
| Carte | — | Carte interactive (événements, lieux, routes) |

---

## 3. Comptes, rôles & modes

- **Un seul type de compte**, qui peut jouer **deux rôles selon le contexte** :
  - **Mode MJ** : on voit les parties qu'on maîtrise, les joueurs liés à chaque partie, on gère
    campagnes/scénarios, invitations, résumés, carte.
  - **Mode Joueur** : on voit ses personnages, les campagnes/scénarios où on participe, le calendrier, les résumés.
- L'interface propose un **bascule de mode** (MJ ↔ Joueur). Le même utilisateur peut être MJ d'une campagne
  et joueur d'une autre.
- **Règle d'or — le MJ n'est pas contraint par les règles** : la validation du moteur de règles est
  **bloquante pour le joueur**, mais **seulement indicative pour le MJ** (avertissements, jamais de blocage).
  Le MJ peut éditer/forcer n'importe quel champ d'une fiche « pour les besoins du scénario ».
- (Futur multi-MJ) **Isolation des données** : un MJ ne voit que ses propres tables.

---

## 4. Fonctionnalités

### Côté Joueur
- **Créer un personnage** : on choisit l'**univers / le système**, puis création **guidée pas à pas**
  (assistant) en suivant les règles.
- **Faire évoluer son perso** : dépense d'**XP** selon les règles (montée de niveau / achats).
- **Gérer sa fiche** : **inventaire / équipements**, et **notes personnelles** du joueur.
- **Rejoindre une campagne** sur invitation, avec un **perso neuf** ou un **perso existant compatible** avec le système.
- Accès à la **campagne / au scénario** : autres joueurs & personnages, **aperçu des parties jouées**,
  **prochaine partie**, **résumés** de séance.
- **Calendrier de disponibilités** : indiquer ses créneaux à venir.
- **Export PDF** de la fiche de perso.

### Côté MJ
- Créer **campagnes** et **scénarios**, **inviter** des joueurs.
- **Voir / suggérer / éditer** les fiches des joueurs (sans contrainte de règles — cf. §3).
- Publier **infos** et **résumés de session**.
- **Journal de campagne** : **événements**, **historique / timeline** (chronologie), **missions** (≈ scénarios / quêtes).
- Lancer la **recherche de date** (agrège les dispos, met en avant le meilleur créneau).
- **Carte** : poser des événements, lieux, routes ; contrôler ce que les joueurs voient.

### Trois formats de « partie » à supporter (important)

> **Vocabulaire** (pour lever l'ambiguïté du mot « partie ») :
> **Partie** = le conteneur que le MJ crée et que les joueurs rejoignent (campagne *ou* one-shot).
> **Séance** = une soirée de jeu concrète (date + participants + rapport).

1. **Campagne linéaire** (ex. **Draconis**) : groupe stable, séances successives, tous les membres jouent.
2. **Épisodique / « agence »** (ex. **Conte de Minuit**) : un **pool** de personnages (les détectives d'une
   agence) ; chaque **séance = une enquête** jouée avec un **sous-ensemble** de joueurs, pas forcément les
   mêmes ; on annonce une enquête → « qui est dispo / qui veut jouer » → on constitue l'équipe.
   Les **absents peuvent lire le rapport** pour savoir ce qui s'est passé.
3. **One-shot** (sans campagne) : une partie **autonome**, en général **un scénario / une séance**, sans
   suivi long terme. Un MJ peut en lancer une à la volée.

> 👉 Les trois se modélisent **de la même façon** : une **Partie** a un `kind`
> (`campagne_linéaire | campagne_épisodique | one_shot`), un **pool de membres**, et des **séances** ayant
> chacune une **liste de participants** (un sous-ensemble). Linéaire = participants = tous les membres ;
> agence = épisodique ; one-shot = une partie à séance unique. **Un seul modèle.**

---

## 5. Architecture — systèmes de jeu en **plugins**

Objectif : **ajouter un système de jeu sans réécrire le cœur ni le front**.

### Principe : fiche **pilotée par un schéma** + règles côté serveur

Chaque système = un **module/plugin** exposant une interface commune :

```ts
interface GameSystemPlugin {
  id: string;                 // ex: "draconis"
  name: string;               // ex: "Draconis"
  version: string;

  sheetSchema(): SheetSchema;                      // structure de la fiche (sections, champs, types)
  contentTypes(): ContentTypeDef[];                // catalogue : classes, races, compétences, métiers… (extensible par le MJ)
  creationSteps(): CreationStep[];                 // assistant pas à pas (ordre, choix, dépendances)
  createBlankCharacter(): SheetData;
  validate(data, mode: "strict" | "mj"): Result;   // strict = joueur (bloquant) / mj = indicatif
  computeDerived(data): Derived;                    // modificateurs, PV, etc. (calculs auto)
  canSpendXp(data, choice): Result;                 // règles d'évolution
  applyXp(data, choice): SheetData;
  printLayout?(data): PrintModel;                   // gabarit d'impression
}
```

- **Back (NestJS)** : un module par système, enregistré dans un `GameSystemRegistry`. Le **moteur de
  règles** (validation, calculs, création, XP) vit ici.
- **Front (Angular)** : un **moteur de rendu générique** affiche la fiche et **l'assistant de création**
  à partir du schéma fourni → **aucun code front spécifique** à écrire pour un nouveau système.
- **Stockage** : un personnage = `gameSystemId` + `sheetData` (JSON / Postgres **JSONB**) + `derived` calculé
  + historique de versions.

### Deux couches : **moteur (code)** vs **contenu (données)** — le contenu est extensible par le MJ

Pour qu'un MJ puisse **ajouter des classes, métiers, compétences…**, on sépare :

- **Le moteur** (le *plugin* code) : *comment* marchent les règles (calculs, validation, XP) et *quels types
  de contenu* le système possède (ex. Draconis : classes, races, sorts, compétences…).
- **Le contenu** (des *données* en base) : les **entrées** de chaque type (la classe « Guerrier », le métier
  « Forgeron »…). Livré avec un **catalogue de base** (seed), mais **extensible**.

Chaque entrée de contenu a un **scope** :
- `base` — fourni avec le système ;
- `mj` — bibliothèque perso d'un MJ, réutilisable sur ses parties ;
- `partie` — propre à une partie donnée.

→ Le MJ ajoute du homebrew **sans écrire de code**. La fiche d'un perso **référence** des entrées du catalogue
(ex. `classId`). En multi-MJ, le contenu custom reste **scopé** (pas de pollution entre MJ).

> **Cap lointain (ambitieux)** : un **éditeur de système complet** où le MJ définit un système entier
> (types de contenu + schéma de fiche + règles simples, sans coder). Noté, mais pas pour bientôt.

---

## 6. Modèle de données (grossier)

**Cœur (agnostique du système)** :
- **User** — compte : auth, nom affiché. (Le rôle MJ/Joueur est porté par l'appartenance, pas par le compte.)
- **Partie** (table de jeu) — appartient à un MJ (owner) ; rattachée à **un** système ;
  `kind` = `campagne_linéaire | campagne_épisodique | one_shot`.
  - **« agence »** (Conte de Minuit) = `campagne_épisodique` ; **one-shot** = partie à séance unique, sans campagne.
- **Membership** — lien User ↔ Partie, avec **rôle** (MJ / Joueur) et le(s) **personnage(s)** engagé(s).
- **Character** — possédé par un User, rattaché à une Partie ; `gameSystemId`, `sheetData` (JSONB),
  `derived`, **inventaire/équipements**, **notes** du joueur, versions/historique.
- **Scenario** — unité de contenu narratif : un arc d'une campagne, **ou l'unique scénario d'un one-shot**.
- **Session** (séance) — rattachée à une Partie (et éventuellement un Scénario) ; date(s), lieu, statut ;
  **participants** = sous-ensemble des personnages/joueurs ; possède un **Report**.
- **Report** — résumé de séance, **lisible par tous les membres** (même non-participants).
- **Event** — événement de campagne (daté, lieu optionnel) → alimente la **timeline / l'historique** ; une **Mission** est un type d'arc (≈ Scénario).
- **AvailabilityPoll** — créneaux candidats pour planifier une séance.
- **Availability** — réponse d'un User à un créneau : oui / non / peut-être.
- **Feed** — infos / annonces / rappels postés par le MJ dans une Partie.

**Catalogue de contenu** (extensible — cf. §5) :
- **ContentType** — un type de contenu d'un système (ex. « classe », « métier », « compétence »), défini par le plugin.
- **ContentEntry** — une entrée d'un type (ex. la classe « Guerrier ») ; `scope` = `base | mj | partie` ; `data` (JSONB).

**Carte** (palier ultérieur) :
- **Map** — rattachée à une campagne/univers (fond de carte image ou tuiles).
- **MapMarker** — point : lieu, événement, scénario ; type, **visibilité** (MJ seul ↔ révélé aux joueurs).
- **MapRoute** — tracé (polyligne).

`GameSystem` n'est pas une donnée mais du **code** (un module) ; une petite table liste juste les systèmes installés.

---

## 7. Pile technique (recommandée — à valider ✅)

- **Projet : `desdispos`** (« Dés Dispos », anciennement `master-jdr`) (scope npm `@desdispos/*`).
- **Monorepo** (workspaces pnpm) : `apps/web` (Angular), `apps/api` (NestJS), `packages/shared` (types partagés).
- **Front** : Angular.
- **Back** : **NestJS** (Node/TS) — modules natifs = parfait pour les plugins de système ; TS partagé avec le front.
- **Base** : **PostgreSQL** (`JSONB` pour les fiches flexibles).
- **ORM** : Prisma (DX TypeScript) — ⚠️ ou TypeORM.
- **Auth** : self-contained (JWT/sessions), pour rester portable et forkable.
- **Conteneurisation** : **Docker + docker-compose** unique → `up` lance web + api + Postgres + seed.
- **Carte** : Leaflet (avec fond image custom pour un monde imaginaire) — à confirmer au palier carte.
- **PDF** : ⚠️ serveur (gabarit → PDF) ou impression navigateur.

> **BaaS pur (Supabase/PocketBase) écarté** : moteur de règles + multi-système plugin = vraie logique
> métier, mal servie par des fonctions isolées. (Supabase resterait un *Postgres + auth managés* possible,
> mais on perd en portabilité pour un projet open source auto-hébergé.)

---

## 8. Hébergement (réponse à la question « OVH gratuit / static ? »)

**Point clé : l'app est *dynamique*** (backend + base). Donc **l'hébergement statique gratuit ne suffit pas**
pour le back — il ne sert que les fichiers Angular compilés. Et l'**OVH “mutualisé pas cher” est PHP/MySQL**,
pas adapté à un back Node (ça te ramènerait vers Symfony). Pas de vrai gratuit dynamique chez OVH.

Options réalistes, par préférence :

1. ✅ **Raspberry Pi chez toi + Docker** (recommandé pour démarrer) — colle parfaitement au `docker compose up`.
   Pour le rendre accessible de l'extérieur **sans ouvrir de ports** : **Cloudflare Tunnel** (gratuit, HTTPS
   inclus, masque ton IP perso). Alternative : DuckDNS + reverse proxy Caddy (HTTPS Let's Encrypt auto).
2. **Split free-tier** (alternative) : Angular (statique) → Cloudflare Pages / Netlify (gratuit) ;
   NestJS + Postgres → un tier gratuit *dynamique* (Fly.io / Render / Koyeb) + Postgres managé gratuit
   (Neon / Supabase). ⚠️ Les offres gratuites « dorment », expirent et changent souvent.
3. **Petit VPS** (~3-5 €/mois, Hetzner/OVH VPS) — pas gratuit mais le plus fiable ; **même** `docker-compose`.

> Le même `docker-compose` tourne sur le Pi, un VPS, ou la machine d'un dev. On garde le déploiement portable.

---

## 9. Inspirations & aspects légaux

- **Systèmes visés** (ordre indicatif) : **Draconis** (basé **D&D 5e**) → **Conte de Minuit** (agence) →
  **Ryuutama** → **Esteren**. Mécaniques très différentes ⇒ ça **valide** l'architecture en plugins.
- **Système v1 = Draconis** : il me faudra une **référence des règles** (PDF / wiki / tes notes) pour
  modéliser la fiche et l'assistant de création au **palier 2**. Ryuutama envisagé comme alternative / 2e système.
- **Inspiration UX** (repos de Pierstoval, génériques même si v1 ≠ Esteren) — **Corahn-Rin** (création de
  perso pas à pas), **Esteren Maps** (carte interactive), **CharacterManagerBundle**. On vise **plus poussé**
  et multi-système.
- **D&D 5e / SRD** : les mécaniques de base D&D 5e sont publiées sous **SRD / OGL (désormais Creative
  Commons)** → réutilisables. Pratique pour Draconis (basé D&D 5e).
- ⚠️ **Contenu sous droits** : Draconis / Esteren / Conte de Minuit / Ryuutama sont des produits **commerciaux**.
  On peut implémenter les **mécaniques**, mais **ne pas redistribuer** dans un repo public le **texte des règles**
  ni les **illustrations/cartes officielles** (copyright). Vérifier les licences des repos d'inspiration avant réemploi.
- 🔑 **Séparation code / contenu** : le **dépôt public** = uniquement **code + mécaniques + contenu libre**
  (homebrew, SRD/OGL). Le **contenu propriétaire** (descriptions, lore, illustrations) est **saisi en base
  via un back-office**, **jamais commité**. Saisir du contenu pour l'**usage privé de son groupe** ≠ le
  redistribuer publiquement. → impose un **back-office de contenu (CRM)** tôt dans la roadmap (cf. Palier 2).
- ℹ️ *Pas un avis juridique.* En France (droit d'auteur, pas de « fair use » large), reproduire des textes
  de règles reste risqué même partiellement. Vérifier la **politique de contenu amateur** de chaque éditeur.

---

## 10. Décisions ouvertes ⚠️

1. Système v1 = **Draconis** ✅ — fournir la **référence des règles** pour le palier 2.
2. Hébergement cible (Pi + Cloudflare Tunnel ? VPS ?).
3. PDF : serveur ou navigateur ?
4. ORM : Prisma ou TypeORM ?
5. Notifications : e-mail, in-app, les deux ?
6. Nom du projet = **desdispos** (« Dés Dispos », renommé depuis `master-jdr`) ✅.
7. Ampleur « multi-MJ » visée (entre amis ↔ plateforme publique avec modération).
