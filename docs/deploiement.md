# Déploiement en production — Raspberry Pi + Cloudflare Tunnel

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

## À mettre en place (pas encore fait)

- **Sauvegardes** : base (`docker compose -f docker-compose.prod.yml exec db pg_dump -U <user> <db>`)
  et volume `uploads` (portraits, couvertures, documents), copiées hors du Pi, avec un test de
  restauration.
- **Épingler** l'image `cloudflared` sur une version précise une fois le tunnel validé.
- **Scan des images** (Trivy) et détection de secrets (Gitleaks) en CI — cf. `docs/security.md`.
