# Déploiement en production — Raspberry Pi + Cloudflare Tunnel

> **Première installation du Pi, pas à pas (matériel, système, SSH, tunnel, domaine) :**
> [`tuto-raspberry-pi.md`](tuto-raspberry-pi.md).
>
> Fichiers : `docker-compose.prod.yml`, `docker/prod.api.Dockerfile`, `docker/prod.web.Dockerfile`,
> `docker/nginx.conf`, `docker/nginx-security-headers.conf`, `.env.prod.example`.

## Architecture

```
visiteur ──HTTPS──▶ Cloudflare ──tunnel (connexion sortante)──▶ cloudflared ──▶ web (nginx :8080) ──/api──▶ api (:3000) ──▶ db
```

- **Aucun port entrant** n'est ouvert sur la box ni sur le Pi : `cloudflared` ouvre une connexion
  *sortante* vers Cloudflare. Seul `web` est publié, sur `127.0.0.1:8080`, pour un test local.
- **Une seule origine** : nginx sert le front Angular et relaie `/api/*` vers l'API (préfixe retiré).
  Pas de CORS, cookie de session same-site, CSP `connect-src 'self'`.
- **IP réelle** : nginx écrase `X-Forwarded-For` avec `CF-Connecting-IP` ; l'API ne fait confiance
  qu'au réseau Docker (`TRUST_PROXY=uniquelocal`). La limitation de débit (5 connexions/min) est donc
  bien par visiteur.
- L'API **refuse de démarrer** si un secret vaut celui de `.env.dev`, si `SESSION_SECRET` fait moins
  de 32 caractères, ou si `WEB_ORIGIN` n'est pas en `https://` (`apps/api/src/config/env.ts`).

## Avant la première mise en ligne

1. **Pi à jour** : `sudo apt update && sudo apt full-upgrade`, Docker à jour.
2. **Rien d'autre d'exposé** sur le Pi. En particulier, un ancien site PHP (ère Symfony) doit être
   arrêté ou mis à jour : la faille PHP2Shell (CVE-2026-109618 / 109619, octobre 2026) est exploitée
   activement. Vérifier : `php -v` et `systemctl list-units | grep -iE 'php|apache|nginx'`.
3. **Secrets** : `cp .env.prod.example .env.prod`, puis générer chaque secret sur le Pi
   (`openssl rand -base64 48` pour `SESSION_SECRET`, `openssl rand -base64 24` pour les mots de
   passe). `chmod 600 .env.prod`. Ne jamais réutiliser une valeur de `.env.dev` ni d'un ancien
   `.env` présent dans l'historique git.
4. **Tunnel** : dans Cloudflare Zero Trust → Networks → Tunnels, créer un tunnel, ajouter le nom
   public → service `http://web:8080`. Mettre le jeton dans `.env.tunnel` (`TUNNEL_TOKEN=...`,
   `chmod 600`) — fichier séparé pour que l'image tierce `cloudflared` ne reçoive pas les secrets
   de l'application.
5. **(Recommandé) Cloudflare Access** devant le site (code envoyé par e-mail) : pour une bande
   d'amis, cela bloque l'essentiel du trafic hostile avant même qu'il atteigne le Pi.

## Lancer

```bash
docker compose -f docker-compose.prod.yml --profile tunnel up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

Au démarrage, l'API applique les migrations (`prisma migrate deploy`), crée le compte admin s'il
n'existe pas (jamais modifié ensuite), puis démarre. **Aucun seed de démonstration.**

Test local sans tunnel : `docker compose -f docker-compose.prod.yml up -d --build`, puis
`http://127.0.0.1:8080`. Le cookie de session n'y est pas `Secure` (HTTP) ; derrière le tunnel il
l'est.

## Mettre à jour

```bash
git pull
docker compose -f docker-compose.prod.yml --profile tunnel up -d --build
```

## Journaux

Chaque conteneur garde au plus 3 fichiers de 10 Mo (`x-logging` dans `docker-compose.prod.yml`) :
la carte SD ne se remplit pas. Lire : `docker compose -f docker-compose.prod.yml logs -f api`.

## Sauvegardes

`docker/backup.sh` sauvegarde la base (`pg_dump`, format custom) et le volume `uploads` (portraits,
couvertures, documents) dans `./backups/<date>/`, vérifie que les deux sont relisibles, écrit leurs
empreintes (`SHA256SUMS`) et supprime les sauvegardes de plus de 14 jours.

```bash
docker/backup.sh
BACKUP_DIR=/mnt/ssd/backups KEEP_DAYS=30 docker/backup.sh   # autre dossier, autre rétention
```

**Chaque nuit** (`crontab -e` sur le Pi, chemin du dépôt à adapter) :

```cron
0 3 * * * cd /home/pi/master-jdr && docker/backup.sh >> backups/backup.log 2>&1
```

⚠️ **Copier les sauvegardes HORS du Pi** (disque externe, autre machine, stockage distant via
`rsync`/`rclone`) : une sauvegarde restée sur la carte SD meurt avec elle. Le dossier contient toute
la base (e-mails, hash de mots de passe) : le chiffrer s'il quitte la maison.

### Restaurer

À **tester au moins une fois** avant d'en avoir besoin. Remplace la base et les fichiers actuels.

```bash
B=backups/2026-11-09_030000                      # sauvegarde choisie
(cd "$B" && sha256sum -c SHA256SUMS)             # copie intacte ?
docker compose -f docker-compose.prod.yml stop web api
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$B/db.dump"
docker compose -f docker-compose.prod.yml run --rm --no-deps -T api \
  sh -c 'find /app/apps/api/uploads -mindepth 1 -delete && tar -xzf - -C /app/apps/api' < "$B/uploads.tgz"
docker compose -f docker-compose.prod.yml start api web
```

## À mettre en place (pas encore fait)

- **Copie hors du Pi** des sauvegardes (voir ci-dessus), automatisée.
- **Épingler** l'image `cloudflared` sur une version précise une fois le tunnel validé.
- **Scan des images** (Trivy) et détection de secrets (Gitleaks) en CI — cf. `docs/security.md`.
