# Sécurité — modèle de menaces & checklist (Dés Dispos)

> **Statut : v0.1 — vivant.** Sécurité = transversale : on coche les items au fil des paliers.
> Mémo des actions *manuelles* à ne pas oublier : `docs/checklist.md`.

## Contexte & menaces

App web **avec login**, **auto-hébergée sur un Raspberry Pi**. Principales menaces :

- **Brute-force / credential stuffing** sur le login.
- **Réseau maison exposé** (ports ouverts, IP perso visible).
- **Failles de dépendances** (CVE) et **supply-chain** (paquet malveillant).
- **Fuite de secrets** (clés, mots de passe en clair, `.env` committé).
- **Injection / XSS / CSRF**, élévation de privilèges (un joueur accède aux données d'un autre / du MJ).

## Principes

Defense-in-depth · moindre privilège · **secure by default** · ne jamais faire confiance à l'entrée client ·
isolation des données par utilisateur/partie (un joueur ne voit que ses persos).

## Checklist par couche

### Authentification (dès le palier auth)
- [x] Mots de passe hachés avec **argon2** (ou bcrypt) — jamais en clair.
- [x] **Rate-limiting** sur `/login` (`@nestjs/throttler`, 5/min par visiteur — IP réelle via
      `TRUST_PROXY` + `CF-Connecting-IP`). Pas de verrouillage de compte (il offrirait un déni de service ciblé).
- [x] Cookies de session **HttpOnly + Secure + SameSite=Lax** ; contrôle d'Origin sur les requêtes qui
      modifient (CSRF, login CSRF) ; durée de vie absolue de 30 jours.
- [ ] Politique de mot de passe minimale ; (option) vérification d'e-mail.
- [x] Secrets de signature (JWT/session) **longs, aléatoires, hors du code** — démarrage refusé en prod
      sinon (`apps/api/src/config/env.ts`).

### API (NestJS)
- [x] **Helmet** (en-têtes de sécurité) activé.
- [x] **CORS** verrouillé sur l'origine du front uniquement (en prod : une seule origine, nginx relaie `/api`).
- [x] **Validation** stricte des entrées (`class-validator` + `whitelist: true`, `forbidNonWhitelisted`),
      bornes sur tous les champs libres (`@MaxJsonSize`).
- [x] Requêtes via **Prisma** (paramétrées → pas d'injection SQL).
- [x] **Autorisation** vérifiée à chaque accès (`PermissionService.assert`), y compris à chaque battement
      des flux temps réel.
- [ ] Pas de **stack trace** ni détail interne renvoyé en prod.

### Front (Angular)
- [x] S'appuyer sur l'**échappement automatique** d'Angular ; **jamais** `bypassSecurityTrust*` sans raison.
- [x] **CSP** en place (nginx, `docker/nginx-security-headers.conf`) ; aucun secret côté front.

### Secrets & config
- [x] `.env` **dans `.gitignore`**, `.env.prod.example` committé (sans valeurs).
- [x] **Validation des variables d'env** au démarrage (échec rapide si manquant ou valeur de dev).

### Dépendances
- [x] **`pnpm audit`** automatisé — `.github/workflows/audit.yml` : hebdomadaire, plus à chaque PR
      touchant `pnpm-lock.yaml` ou un `package.json`. Seuil `high`. **Hors de la porte `ci-ok`** :
      une CVE publiée dans la nuit ne doit pas bloquer une PR sans rapport.
- [x] **Dependabot** actif (activé côté GitHub, pas de fichier dans le dépôt).
- [ ] (Option) **Socket** : détection de paquets malveillants.

#### Tri des vulnérabilités résiduelles (2026-08-27)

Un `pnpm update` (dans les plages semver existantes, aucun majeur déplacé) a ramené l'audit de
**51 advisories / 18 paquets / 1 critique** à **7 advisories / 3 paquets / 0 critique**.

Les 3 restants sont **tous transitifs** et **aucun n'est atteignable par le code applicatif** :

| Paquet | Gravité | Chaîne | Pourquoi on ne corrige pas |
|---|---|---|---|
| `linkify-it` | high | `@nestjs-modules/mailer > preview-email > mailparser` | `preview-email` est l'outil d'aperçu d'e-mails dans un navigateur ; jamais invoqué par l'API |
| `nodemailer` | moderate | `@nestjs-modules/mailer > preview-email > mailparser` | idem — la dépendance *directe* `nodemailer` est déjà en 9.x, seule la copie transitive sous `preview-email` reste en 8.x |
| `deepmerge-ts` | high | `@prisma/client > prisma > @prisma/config` | chargeur de config du **CLI** Prisma, pas du client runtime |

**Ne pas les forcer par un `pnpm.overrides`.** Les trois exigent un changement de version
**majeure**, c'est-à-dire une API incompatible livrée à un appelant qui ne l'attend pas
(`preview-email`, `@prisma/config`). Un override ne serait vérifié ni à l'installation, ni au
build, ni au typecheck — il casserait à l'exécution, et pour `deepmerge-ts` cela viserait le
chargeur de config utilisé par `prisma generate` et `migrate deploy`. Aucun gain de sécurité
réel (code inatteignable) contre un risque de casse silencieuse.

**Pourquoi aucun update ne peut les déplacer** — vérifié le 2026-08-27, les trois sont bloquées
par des épinglages **exacts** en amont, sans plage semver à satisfaire :

- `@prisma/config@7.10.0` déclare `deepmerge-ts: "7.1.5"` (version exacte) ;
- `preview-email@3.3.0` — déjà la dernière — déclare `mailparser: "3.9.8"` (version exacte), alors
  que `mailparser@3.9.16` embarque le `linkify-it@5.0.2` corrigé et un `nodemailer` récent.

**Écartées explicitement de l'audit.** `pnpm-workspace.yaml` → `auditConfig.ignoreGhsas` liste les
7 identifiants GHSA **un par un**, chacun commenté avec sa raison et sa condition de retrait.
Jamais par abaissement du seuil : tout ce qui n'est pas listé continue de faire échouer le
workflow, et si l'un de ces paquets reçoit une AUTRE vulnérabilité elle passera au rouge.
`pnpm audit` continue d'ailleurs de les afficher, marquées « ignored ».

**Ce qui les résoudra** : un bump amont de `@nestjs-modules/mailer` et de `prisma`. Dependabot
ouvrira la PR, le workflow d'audit tournera dessus — à ce moment-là, retirer les identifiants
concernés de la liste et vérifier que l'audit reste vert sans eux.

**Piste de fond** : `@nestjs-modules/mailer` tire `mjml` et `preview-email` dont ce projet
n'utilise rien (l'adaptateur en service est `HandlebarsAdapter`). Passer à `nodemailer` en direct
supprimerait la racine de la majorité de ces chaînes. Chantier à chiffrer, non planifié.

### Conteneurs (Docker)
- [x] Image **slim**, exécution en **utilisateur non-root** (`docker/prod.*.Dockerfile`).
- [x] **Aucun secret** dans l'image ; `.dockerignore` complet.
- [ ] **Trivy** : scan CVE des images (en CI).

### Infra (Raspberry Pi) — procédure : `docs/deploiement.md`
- [ ] **Cloudflare Tunnel** → **aucun port entrant ouvert**, IP perso masquée, TLS + WAF/DDoS.
- [ ] OS + Docker **à jour** ; sauvegardes de la base ; (option) fail2ban.

## Outils & quand les utiliser

| Outil | Quoi | Quand | En place ? |
|---|---|---|---|
| **CodeQL** (`.github/workflows/codeql.yml`) | analyse statique de sécurité, native GitHub | PR, push `master`, hebdo | ✅ |
| **`pnpm audit`** (`.github/workflows/audit.yml`) | CVE des dépendances, seuil `high` | hebdo + changement de lockfile | ✅ |
| **Dependabot** | PR de mise à jour | en continu | ✅ (côté GitHub) |
| **`/security-review`** (skill) | revue sécu du diff par l'IA | **fin de chaque palier** | ✅ (manuel) |
| Gitleaks, Trivy, Socket | secrets, CVE d'images, paquets malveillants | — | ❌ non installés |

⚠️ **Semgrep n'est pas installé** et ne l'a jamais été, contrairement à ce que ce document et
`CLAUDE.md` ont longtemps affirmé. L'analyse statique de sécurité est assurée par **CodeQL**.

## Réflexe par tâche
Toute tâche touchant **auth / données / upload / autorisation** → lancer **`/security-review`** avant de clore,
et vérifier les items de couche concernés ci-dessus. (CodeQL tourne sur chaque PR, mais il ne remplace pas cette revue.)
