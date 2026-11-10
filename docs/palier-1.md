# Palier 1 — Comptes, modes & parties (spec)

> Spec **focalisée** sur le Palier 1. Vision globale : `spec.md` · Feuille de route : `backlog.md`.
> Périmètre volontairement resserré ; tout le reste (fiches, moteur de système, dispos, carte…) = paliers suivants.

## 1. Objectif

Permettre à un utilisateur de **créer un compte**, de **basculer entre mode MJ et mode Joueur**, à un MJ de
**créer des parties** et d'**inviter des joueurs**, et à un joueur de **rejoindre** une partie. Pas encore de
personnage ni de contenu de jeu.

## 2. Décisions techniques (verrouillées)

- **Identité** : `email` (connexion) **+ `pseudo` unique** (affichage + recherche). Recherche d'utilisateur par **email ou pseudo**.
- **Inscription** : **sur invitation uniquement** (pas d'inscription ouverte). Le **premier compte admin** est créé par seed.
- **Rôles** :
  - **Global** (sur `User`) : `USER` ou **`ADMIN`** — l'admin gère le **serveur** (supprimer des comptes, etc.).
  - **Par partie** : **un seul MJ = le créateur** (`Partie.mjId`). N'importe quel user peut **créer une partie → devient MJ** dessus. Le MJ ne gère que **ses** parties (ex. retirer un joueur de SA partie ≠ du serveur).
- **Auth** : **session par cookie httpOnly** (`Secure`, `SameSite=Lax`), mot de passe haché **argon2**.
- **UI** : **Angular Material** (+ thème custom léger « JDR »).
- **Invitations** : **in-app** (utilisateur inscrit, accept/refus) **+ liens** d'invitation (nouveaux venus — cf. §3/§5).
- **E-mail (SMTP)** : **pas au P1** → reporté au **Palier 4** (avec notifications/rappels). En attendant : pas de vérif e-mail ; mot de passe oublié = **reset par l'admin**.
- **Base** : passage aux **vraies migrations Prisma** (le schéma se stabilise ici).

## 3. Modèle de données (Prisma — à affiner en mode plan)

> On **retire** le modèle jetable `AppInfo` du Palier 0 et on introduit les entités réelles.

```prisma
enum GlobalRole       { USER ADMIN }
enum PartieKind       { CAMPAGNE_LINEAIRE CAMPAGNE_EPISODIQUE ONE_SHOT }
enum InvitationStatus { PENDING ACCEPTED DECLINED REVOKED }

model User {
  id           String     @id @default(uuid())
  email        String     @unique   // connexion
  pseudo       String     @unique   // handle public + affichage + recherche
  passwordHash String
  role         GlobalRole @default(USER)   // ADMIN = gestion du serveur
  createdAt    DateTime   @default(now())

  mjOfParties  Partie[]     @relation("PartieMJ")   // les parties qu'il maîtrise
  memberships  Membership[]                          // ses participations en tant que joueur
  invitesSent  Invitation[] @relation("InvitationInviter")
  invitesRecv  Invitation[] @relation("InvitationInvitee")
}

model Partie {
  id           String     @id @default(uuid())
  name         String
  kind         PartieKind                 // choisi à la création (one-shot / campagne)
  gameSystemId String                     // libellé du système (liste constante au P1)
  mjId         String                     // le MJ = le créateur (un seul MJ par partie)
  mj           User       @relation("PartieMJ", fields: [mjId], references: [id])
  createdAt    DateTime   @default(now())

  memberships  Membership[]               // les joueurs (le MJ n'est pas ici, il est `mjId`)
  invitations  Invitation[]
  inviteLinks  InviteLink[]
}

model Membership {                         // un JOUEUR dans une partie
  id       String   @id @default(uuid())
  userId   String
  partieId String
  joinedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id])
  partie   Partie   @relation(fields: [partieId], references: [id])
  @@unique([userId, partieId])
}

// Invitation ciblée d'un utilisateur DÉJÀ inscrit (accept/refus dans l'app)
model Invitation {
  id            String           @id @default(uuid())
  partieId      String
  partie        Partie           @relation(fields: [partieId], references: [id])
  inviterId     String
  inviter       User             @relation("InvitationInviter", fields: [inviterId], references: [id])
  inviteeUserId String
  invitee       User             @relation("InvitationInvitee", fields: [inviteeUserId], references: [id])
  status        InvitationStatus @default(PENDING)
  createdAt     DateTime         @default(now())
  respondedAt   DateTime?
  @@unique([partieId, inviteeUserId])
}

// Lien d'invitation = aussi le SEUL moyen de s'inscrire (inscription sur invitation)
model InviteLink {
  id          String   @id @default(uuid())
  token       String   @unique
  partieId    String
  partie      Partie   @relation(fields: [partieId], references: [id])
  createdById String   // le MJ qui l'a généré
  maxUses     Int?     // null = illimité · 1 = usage unique · N = X joueurs
  usesCount   Int      @default(0)
  expiresAt   DateTime // défaut +7 jours, configurable
  revoked     Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

- **Le « mode »** n'est pas stocké : il est **dérivé** (on est MJ là où on est `Partie.mjId`, joueur via ses `Membership`).
- **Personnages engagés** : la liaison `Membership ↔ Character` arrivera au Palier 2 (pas de perso ici).
- **Sessions** : stockage côté serveur (table de sessions / store Postgres) pour pouvoir **révoquer** — lib exacte tranchée en mode plan (Context7).

## 4. API (esquisse)

- **Auth** : `POST /auth/register` (consomme un **token de lien**) · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`
- **Users** : `GET /users/search?q=` (par **email ou pseudo**, correspondance exacte)
- **Parties** : `POST /parties` · `GET /parties` (les miennes) · `GET /parties/:id`
- **Membres** : `GET /parties/:id/members` · `DELETE /parties/:id/members/:userId` (le MJ retire un joueur)
- **Invitations in-app** : `POST /parties/:id/invitations` · `GET /invitations` (reçues) · `POST /invitations/:id/{accept,decline}` · `DELETE /invitations/:id`
- **Liens** : `POST /parties/:id/invite-links` (maxUses, expiresAt) · `GET /parties/:id/invite-links` · `DELETE /invite-links/:id` · `GET /invite-links/:token` (prévisualiser)
- **Admin** (rôle `ADMIN`) : `GET /admin/users` · `DELETE /admin/users/:id`

## 5. Écrans (Angular Material, responsive — joueurs surtout sur mobile)

- **Auth** : `/register`, `/login`.
- **Shell** : barre du haut (logo · **bascule MJ ⇄ Joueur** · menu utilisateur), navigation latérale selon le mode.
- **Mode Joueur** : tableau de bord (mes parties + **invitations reçues**).
- **Mode MJ** : tableau de bord (mes parties + **créer**), « mes joueurs ».
- **Créer une partie** : formulaire (nom, type, système).
- **Détail d'une partie** : liste des membres ; (MJ) **inviter** (rechercher un joueur **ou** générer un lien).
- **Rejoindre via lien** : `/join/:token`.

## 6. Sécurité (surtout 1a — cf. `security.md`)

- Hachage **argon2** ; **rate-limiting** (`@nestjs/throttler`) sur `/auth/login` et `/auth/register`.
- Cookie **HttpOnly + Secure + SameSite** ; **validation** stricte des entrées (`class-validator`, `whitelist`).
- **Autorisation** vérifiée partout (un MJ n'agit que sur ses parties ; un joueur ne voit que les siennes).
- 🔔 Lancer **`/security-review`** à la fin de 1a.

## 7. Découpage en sous-itérations

- ✅ **1a — Auth + shell** (committé `704e621`) : register/login/logout, `GET /auth/me`, cookie de session,
  **guard** de routes, shell avec bascule de mode. Durcissement sécu en place.
  *Done* : on s'inscrit, se connecte, voit le shell selon le mode, se déconnecte.
- ✅ **1b — Parties** (committé `8409705`) : modèle de données migré (vraies **migrations Prisma**), créer une
  partie (MJ), lister ses parties par mode, page détail (emplacement membres « à venir 1c »).
  *Done* : un MJ crée une partie et la voit dans son tableau de bord. **Détail réel : voir §11.**
- ✅ **1c — Invitations** (implémenté, tests verts API 37 / web 11 ; **à committer** après `/security-review` +
  `/code-review`) : modèles `Membership`/`Invitation`/`InviteLink` migrés ; recherche d'utilisateur (email/pseudo
  exact) ; invitation in-app (accept/refus/révoque) ; **liens** (maxUses/expiration/révocation) + preview public ;
  flux **rejoindre** (`/join/:token`) ; **inscription désormais invitation-only** (register consomme un token).
  Dashboard Joueur peuplé (mes parties + invitations reçues).
  *Done* : un MJ invite un joueur existant qui accepte ; un nouveau rejoint via lien. ✔️ vérifié e2e.

## 8. Hors périmètre (paliers suivants)

Personnages & fiches, moteur de système + back-office contenu (P2), évolution/PDF (P3), séances/dispos/
résumés/événements (P4), carte (P5), notifications.

## 9. Décisions ouvertes (pour le mode plan)

- ✅ **Tranché** — Lib de session : **Passport-local + express-session + connect-pg-simple** (store Postgres) +
  **argon2**. Cookie httpOnly/SameSite=Lax. **Pas de token CSRF dédié** (SameSite=Lax suffit pour l'instant).
- ✅ **Tranché** — `gameSystemId` : **liste constante `GAME_SYSTEMS`** définie dans **`packages/shared`** (front + back).
- ✅ **Tranché (1c)** — Comportement à la **suppression** : **cascade complète**. `Partie → memberships /
  invitations / liens` ; `User → memberships + invitations émises/reçues + liens créés` (toutes les FK en
  `onDelete: Cascade`). Vérifié e2e (suppression d'une partie → 0 enfant orphelin).
- ✅ **Tranché** — **Tests** : back **Jest**, front **Vitest** ; `pnpm -r test` lance les deux.
- ⏳ Thème Material « JDR » : palette + police — quelques essais (cosmétique, non bloquant).

---

## 10. Sous-itération 1b — spec détaillée (validée)

**Périmètre.** Créer / voir / éditer / supprimer **ses** parties (dans les 2 modes). Les **membres &
invitations = 1c** → en 1b, une partie n'a que **son MJ** (`Partie.mjId`), pas de joueurs.

**Liste des systèmes** : constante (ex. dans `packages/shared`) — Draconis · Conte de Minuit · Ryuutama · Esteren.

### Création d'une partie
- Champs : **nom** (requis), **système** (select, liste constante), **type** (`one-shot` | `campagne` —
  l'**épisodique** viendra avec le mode « agence »), **description** (optionnelle).
- Le créateur devient **MJ** (`mjId`). **Après création → redirection vers la page détail**.

### Bascule de mode (logique réelle)
- Le **toggle MJ** n'apparaît **que si l'utilisateur a ≥ 1 partie** dont il est MJ.
- **« Créer une partie »** est accessible **via le menu** (pour tous, même sans statut MJ) **+** via un bouton
  dans le tableau de bord MJ. → résout l'amorçage (créer sa 1ʳᵉ partie).
- Mode **Joueur par défaut**, choix **mémorisé** (localStorage). En 1b, le tableau de bord **Joueur est vide**.

### Écrans
- **Tableau de bord MJ** : tuiles (`mat-card`) — nom, système, type (+ méta légères : date, nb joueurs = 0) + bouton **Créer**.
- **Tableau de bord Joueur** : « mes parties » (où je suis joueur) — **vide en 1b** (jusqu'à la 1c).
- **Formulaire de création** (champs ci-dessus).
- **Détail d'une partie** : nom, système, type, description ; emplacement **Membres** « à venir (1c) » ; boutons **Éditer** / **Supprimer**.

### CRUD
- Le MJ **édite** (nom / description / type / système) et **supprime** ses parties.
- **Suppression → confirmation** avant exécution.

### Données / migration
- `Partie` + enum `PartieKind` (cf. §3) → nouvelle migration Prisma. `Membership` existe mais **non peuplé** en 1b.

---

## 11. État réel — historique 1b puis **1c**

### 1c (implémenté, non encore committé)
- **Migration** `20260626003517_invitations_1c` : `Membership`, `Invitation` (+ enum `InvitationStatus`),
  `InviteLink`, toutes FK en `onDelete: Cascade` (cf. §9).
- **API** : `GET /users/search` ; `GET/DELETE /parties/:id/members(/:userId)` ; module `invitations`
  (`InvitationsService` + `InviteLinksService`, exporté pour `AuthService`). `register` est **invitation-only**
  (consomme un token de lien dans une transaction). `consumeLink` partagé join + register, avec **incrément
  conditionnel** anti-race sur `maxUses`.
- **Front** : services `parties` (étendu), `invitations`, `join` ; `mode.service.playerParties` ; dashboard
  Joueur ; détail de partie (membres + encart inviter/liens) ; feature `Join` (`/join/:token`, hors authGuard) ;
  `register` lit `?token=`.
- **Tests** : API 37 / web 11 verts. Vérifié e2e (lien→register→membre→liste joueur ; invite in-app→accept ;
  retrait membre ; cascade suppression).
- ⚠️ **Connu, hors 1c** : `pnpm --filter web build` (ng build **prod**) casse sur `@angular/animations/browser`
  (manque `@angular/animations` dans les deps — `provideAnimationsAsync`). Dev (`ng serve`) et Vitest OK.
- **Reste à faire** : `/security-review` + `/code-review`, puis **commit**.

### 1b (committé)
**Fait & committé** : 1a (`704e621`) et 1b (`8409705`). Tests verts (API 13 / web 11, via `pnpm -r test`).
`/security-review` 1b : **aucun finding**. Refacto lisibilité : chaque composant Angular conséquent est éclaté
en `.ts` / `.html` / `.scss` (les tout petits — `app`, `confirm-dialog` — restent inline).

**Stack tranchée** (verrouille les décisions ouvertes — détaillé au §9) :
- **Prisma 7** : driver adapter `@prisma/adapter-pg` (`PrismaPg`) + `prisma.config.ts` (l'`url` n'est plus dans
  le schéma). ⚠️ **Toute table créée au runtime doit être modélisée dans Prisma**, sinon `migrate` la voit comme
  un *drift* — c'est pourquoi le modèle `Session` (table `session`) est mappé et `connect-pg-simple` tourne en
  `createTableIfMissing: false`. **À refaire pour tout nouveau store/table en 1c.**

**Schéma réel en base aujourd'hui vs §3 — ce que 1c devra créer** :
- Présents : `User`, `Partie` (+ champ **`description String?`** ajouté, non listé au §3), `Session`.
  `Partie.mj` est en **`onDelete: Cascade`** (suppression user → ses parties).
- **Pas encore créés** : `Membership`, `Invitation`, `InviteLink`, enum `InvitationStatus` → **c'est le cœur de
  1c** (modèles du §3 + nouvelle migration ; trancher la cascade `Partie → enfants`).
- `PartiesService.listForUser(userId, 'player')` renvoie **`[]`** (placeholder) → à brancher sur `Membership` en 1c.
- Dashboard **Joueur vide** (normal) jusqu'à ce que les `Membership` existent.

**Pièges déjà rencontrés (éviter de les redécouvrir)** :
- DTO `class-validator` : un **type** importé utilisé dans une signature décorée doit être en `import type { … }`
  séparé (sinon **TS1272**).
- Front : alias `@desdispos/shared` via `paths` dans `apps/web/tsconfig.json` (**sans `baseUrl`**, déprécié TS6).
- Agent : recharger le PATH depuis le registre avant tout `docker …` (cf. `CLAUDE.md`).
