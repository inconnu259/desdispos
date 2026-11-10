# Dés Dispos

Application web **open source** et **auto-hébergeable** pour organiser ses parties entre amis : campagnes
de **jeu de rôle** (côté MJ comme côté joueur) et **soirées jeux de société** au sein d'un groupe. Elle
répond à la question de fond de toute bande de joueurs : *qui est dispo, quand, pour jouer à quoi ?*
Calendrier de disponibilités partagé, votes de date, invitations, rappels par e-mail — et, pour le JDR,
fiches de personnage pilotées par les règles du système de jeu (Ryuutama aujourd'hui).

- Vision : [docs/spec.md](docs/spec.md) · Feuille de route : [docs/backlog.md](docs/backlog.md)
- Déploiement : [docs/deploiement.md](docs/deploiement.md) · Sécurité : [docs/security.md](docs/security.md)

## Fonctionnalités

**Comptes et accès**
- Inscription **sur invitation** (in-app ou lien à usage limité, expirable, révocable), session par cookie.
- Mot de passe oublié, changement de mot de passe et d'e-mail (avec lien d'annulation), nom affiché,
  effacement du compte avec aperçu de ce qui disparaît.
- Un seul type de compte : on est MJ d'une partie et joueur d'une autre ; rôle global USER / ADMIN.

**Jeu de rôle (famille `jdr`)**
- Parties de type **one-shot**, **campagne linéaire** ou **campagne épisodique** ; scénarios, séances
  (participants = sous-ensemble des membres), inscriptions, résumés lisibles par tous, chronologie.
- **Annonces** du MJ, documents attachés à la partie ou au scénario, couverture de partie.
- **Ryuutama** (seul système ouvert à la création) : assistant de création pas à pas piloté par un schéma,
  fiche, inventaire / équipement, notes, portrait, rôles de groupe, distribution d'**XP** et montée de
  niveau, historique de la fiche, édition MJ sans contrainte, **cadenas de visibilité** sur certains champs.
- **Homme Dragon** (personnage du MJ) : fiche, souffles et réserve, création guidée ; peut suivre
  plusieurs aventures.
- **Exports PDF** : fiche complète, équipement, notes, fiche d'Homme Dragon ; fiches de référence
  Ryuutama (journal, carte, monde, ville, monstre…) en téléchargement.

**Soirées entre amis (famille `ralliement`)**
- **Groupes** : invitations, admins multiples, quitter / retirer un membre ; tout membre propose et
  héberge un événement (**conjonction**). Soirée **isolée** possible, hors groupe.
- Participation ouverte à tous ou **places limitées** (avec places réservées), date fixée ou sondage,
  prolongation du vote, annulation.
- **Jeux de société** : ludothèque personnelle, « j'apporte » à une soirée, jeu écarté par l'hôte,
  « envie d'y jouer », bibliothèque agrégée du groupe, compteur « qui reçoit ».

**Calendrier, disponibilités et votes** (JDR comme soirées)
- Calendrier personnel, de partie et de groupe : vues mois / semaine / agenda, couches affichables,
  déclaration de dispos (y compris par sélection groupée).
- **Recherche de date** (créneaux où le groupe est dispo), **votes de date** composés dans le
  calendrier, échéance, rendez-vous sur **plages longues** (jusqu'à 15 jours), fixation de la date.

**Transverse**
- **E-mails** : invitations, rappels de séance, relance de vote, date fixée, annulation, sécurité du compte.
- **Temps quasi réel** (SSE) : une modification faite par un autre membre apparaît sans recharger.
- Tableau de bord avec signaux à traiter ; **3 thèmes** (`grimoire-emeraude`, `foret-ancienne`,
  `atelier-cuivre`), chacun avec son propre vocabulaire.

## Démarrage rapide

**Prérequis : Docker Desktop uniquement** (avec WSL2 sur Windows). **Aucun outil Node sur l'hôte** :
toute la chaîne d'outils vit dans les conteneurs.

```bash
cp .env.dev .env      # première fois seulement
docker compose up
```

| Service | Adresse |
|---|---|
| Front (Angular) | http://localhost:4200 |
| API (NestJS) | http://localhost:3000/health |
| Mailpit (e-mails captés) | http://localhost:8025 |

Le premier lancement installe les dépendances (service `deps`) et build : quelques minutes. Ensuite,
**hot reload** sur le front et l'API. Au démarrage, l'API enchaîne `prisma generate`,
`prisma migrate deploy` et le seed du compte admin (identifiants `ADMIN_*` de `.env`).

Les ports sont liés à `127.0.0.1`. Pour tester depuis un téléphone du réseau local : `BIND_HOST=0.0.0.0`
dans `.env`, et l'IP LAN ajoutée à `WEB_ORIGIN` (liste séparée par des virgules).

## Stack

| Élément | Techno |
|---|---|
| Front | Angular 22 + Angular Material, signals — `apps/web` (tests : Vitest via `ng test`) |
| API | NestJS 11 + Prisma 7 — `apps/api` (tests : Jest) |
| Base | PostgreSQL 17 |
| Partagé | `packages/shared` (`@desdispos/shared`) : types **et** valeurs runtime |
| Règles de jeu | `packages/game-rules` (`@desdispos/game-rules`) : règles Ryuutama exécutables (Vitest) |
| E-mail | SMTP (gabarits Handlebars) ; Mailpit en dev |
| Outillage | Monorepo pnpm, 100 % conteneurisé |

## Structure

```
.
├─ apps/
│  ├─ api/
│  │  ├─ src/<domaine>/      # un module NestJS par domaine : auth, parties, characters, scenarios,
│  │  │                      # events, poll, availability, board-games, homme-dragon, realtime, email…
│  │  ├─ game-systems/       # contenu des systèmes (ryuutama/data/*.json, assets PDF)
│  │  ├─ prisma/             # schéma, migrations, seed (admin) et seed-demo
│  │  └─ test/               # tests e2e (Jest, base réelle)
│  └─ web/
│     ├─ src/app/core/       # services (API, temps réel, thème…)
│     ├─ src/app/features/   # pages : dashboard, parties, scenarios, characters, calendar, events,
│     │                      # board-games, homme-dragon, account, auth, join, announcements
│     └─ scripts/            # générateur du registre d'icônes
├─ packages/
│  ├─ shared/                # @desdispos/shared
│  └─ game-rules/            # @desdispos/game-rules
├─ docker/                   # image de dev, Dockerfiles et nginx de prod, script de sauvegarde
├─ docs/                     # spec, backlog, sécurité, checklist, déploiement (+ contenu de règles)
├─ docker-compose.yml        # dev : db + deps + api + web + mailpit
├─ docker-compose.prod.yml   # prod : db + api + web (nginx) + cloudflared (profil tunnel)
├─ .env.dev                  # configuration de dev versionnée (à copier en .env)
└─ .env.prod.example         # modèle de configuration de prod (sans valeurs)
```

Les autres `docs/*.md` (`classes.md`, `magie.md`, `equipement.md`…) sont la matière première du contenu
Ryuutama, pas de la doc de développement.

## Développement

Toutes les commandes se lancent **dans les conteneurs**, stack démarrée — jamais sur l'hôte (les
`node_modules` vivent dans des volumes Docker nommés). Chaque suite tourne dans son propre conteneur :
`pnpm -r test` depuis un conteneur échoue sur l'autre workspace.

```bash
# Tests
docker compose exec api pnpm test                               # API, unitaires (Jest)
docker compose exec api pnpm test:e2e                           # API, e2e (base réelle)
docker compose exec web pnpm test                               # front (Vitest)
docker compose exec -w /work/packages/game-rules api pnpm test  # règles de jeu (Vitest)

# Lint, types, build
docker compose exec api pnpm lint:check    # vérifie sans corriger (`lint` applique --fix)
docker compose exec api pnpm typecheck     # source + specs + scripts prisma/
docker compose exec web pnpm lint
docker compose exec web pnpm build         # seul contrôle de types du front (pas de script typecheck)
```

- Après un changement de `pnpm-lock.yaml`, recréer les **trois** volumes `node_modules` ensemble
  (procédure dans [AGENTS.md](AGENTS.md)).
- Aucune installation de dépendance sans accord explicite (risque supply-chain, cf. [CLAUDE.md](CLAUDE.md)).
- Commentaires et messages d'erreur du code : **en français**.

**CI** (GitHub Actions) :
- `ci.yml` — lint, typecheck et build de l'API, lint et build du front, vérification du registre
  d'icônes, tests unitaires (api, web, game-rules) et e2e sur un vrai Postgres ; la porte `ci-ok`
  agrège ces jobs.
- `codeql.yml` (analyse statique de sécurité) et `audit.yml` (`pnpm audit`, seuil `high`, hebdo et à
  chaque changement de lockfile) — informatifs, **hors** de la porte `ci-ok`.

## Données de démonstration

Un jeu de données de démo (comptes, parties, personnages, votes, invitations…) permet de tester
l'interface sans rien saisir. **Réservé au développement local**, jamais à la production. Les dates sont
relatives au moment du seed.

Remise à zéro complète, **dans cet ordre** :

```bash
docker compose exec api pnpm exec prisma migrate reset --force   # base vide
docker compose exec api pnpm seed                                # compte admin (identifiants de .env)
docker compose restart api                                       # attendre « Nest application successfully started »
docker compose exec api pnpm seed:demo                           # données de démo
```

- Prisma 7 ne lance plus le seed après `migrate reset` : l'étape `pnpm seed` est manuelle.
- Le redémarrage de l'API est indispensable : c'est lui qui crée les systèmes de jeu (Ryuutama) dont le
  seed de démo dépend. Lancé trop tôt, `seed:demo` s'arrête avec un message explicite, sans rien écrire.
- Le seed de démo n'est pas idempotent : si les comptes de démo existent déjà, il ne fait rien.
- Comptes de démo, liens d'invitation et liens à usage unique sont affichés **dans la sortie console**
  du seed — c'est elle qui fait foi. Les e-mails envoyés arrivent dans **Mailpit**.

## Déploiement

Cible actuelle : **Raspberry Pi + Cloudflare Tunnel** (aucun port entrant ouvert), via
`docker-compose.prod.yml` : nginx sert le front et relaie `/api` vers l'API sur une seule origine.
L'API refuse de démarrer avec des secrets de dev ou une configuration non HTTPS ; aucun seed de démo en
production. Sauvegarde de la base et des fichiers envoyés : `docker/backup.sh`.

```bash
cp .env.prod.example .env.prod   # puis générer chaque secret
docker compose -f docker-compose.prod.yml --profile tunnel up -d --build
```

Procédure complète (secrets, tunnel, journaux, sauvegarde et restauration) :
[docs/deploiement.md](docs/deploiement.md) ; installation du Pi pas à pas :
[docs/tuto-raspberry-pi.md](docs/tuto-raspberry-pi.md).

## Sécurité et documentation

- [docs/security.md](docs/security.md) — modèle de menaces et checklist par couche (argon2, throttler,
  Helmet, CSP, validation stricte, autorisation centralisée).
- [docs/checklist.md](docs/checklist.md) — actions manuelles (revues de fin de palier, mises à jour de
  dépendances, câblage temps réel des nouveaux composants).
- [docs/palier-1.md](docs/palier-1.md) — détail du palier comptes / invitations.
- [AGENTS.md](AGENTS.md) et [CLAUDE.md](CLAUDE.md) — consignes pour les agents IA.

## Versions épinglées

Node 24 LTS · pnpm 11.28 · Angular 22 · NestJS 11 · Prisma 7 · PostgreSQL 17
(Node et pnpm : `.tool-versions` et `packageManager` du `package.json` racine).
