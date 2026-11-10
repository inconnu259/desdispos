# Tuto — Un Raspberry Pi 4 serveur maison : Dés Dispos, Home Assistant, fichiers et vidéos

> Ce tuto part de zéro : du matériel à acheter jusqu'au site accessible en `https://` depuis Internet,
> puis Home Assistant et un partage de fichiers et de vidéos, accessibles à la maison et — pour tes seuls
> appareils — depuis l'extérieur. Pas d'écran ni de clavier pour le Pi : tout se fait depuis ton PC, en SSH.
> Mémo technique (architecture, sauvegardes, mises à jour) : [`deploiement.md`](deploiement.md).
>
> ❓ Les écrans de Raspberry Pi Imager et du tableau de bord Cloudflare changent régulièrement : les
> noms de menus ci-dessous peuvent varier légèrement, la logique reste la même.

## Sommaire

1. **Partie 1 — Matériel** : étape 1
2. **Partie 2 — Le système** (installation sans écran, SSH, pare-feu, Docker) : étapes 2 à 6
3. **Partie 3 — Le site Dés Dispos**, public sur Internet : étapes 7 à 13
4. **Partie 4 — Accès privé depuis l'extérieur (Tailscale)** : étape 14
5. **Partie 5 — Home Assistant** : étape 15
6. **Partie 6 — Fichiers et vidéos** (partage réseau, Jellyfin) : étapes 16 et 17
7. **Récapitulatif des accès**, au quotidien, dépannage

## Vue d'ensemble

```
                        ┌──────────────────────── Raspberry Pi ─────────────────────────┐
Internet (tout le monde)│                                                               │
  ──HTTPS──▶ Cloudflare ◀── tunnel sortant ── cloudflared ──▶ nginx ──▶ API ──▶ Postgres │  le SITE, seul public
                        │                                                               │
Tes appareils, partout  │                                                               │
  ──Tailscale (chiffré)─┼──▶ Home Assistant :8123   Partage de fichiers   Jellyfin :8096 │  PRIVÉ : tes appareils
                        │                                                               │
Réseau de la maison     │                                                               │
  ──Wi-Fi / Ethernet────┼──▶ les mêmes services + SSH                                   │
                        └───────────────────────────────────────────────────────────────┘
```

Deux portes très différentes, choisies pour tes contraintes :

| | Le site Dés Dispos | Home Assistant, fichiers, vidéos, SSH |
|---|---|---|
| **Qui peut y accéder** | N'importe qui sur Internet (puis les comptes du site) | **Seulement tes appareils**, un par un |
| **Comment** | Cloudflare Tunnel, adresse `https://jdr.exemple.fr` | À la maison : réseau local. Dehors : **Tailscale** (réseau privé) |
| **Visible publiquement** | Oui | **Non** : rien n'est exposé sur Internet |

- **Aucun port à ouvrir sur la box**, pour rien : le tunnel Cloudflare et Tailscale sont tous deux des
  connexions *sortantes* du Pi. Ton IP personnelle reste cachée.
- **Le certificat HTTPS est fourni et renouvelé par Cloudflare**, automatiquement.
- **SSH sert uniquement à administrer le Pi**, depuis la maison ou via Tailscale. (Attention à la confusion :
  le « certificat » du site est un certificat **TLS/HTTPS** ; SSH, lui, fonctionne avec une **paire de
  clés** — deux choses différentes, toutes deux couvertes plus bas.)

---

# Partie 1 — Matériel

## Étape 1 — Le matériel

| Élément | Recommandation | Pourquoi |
|---|---|---|
| **Raspberry Pi 4** | **4 Go minimum, 8 Go conseillés** avec Home Assistant et Jellyfin (2 Go : le site seul, voir étape 6) | Le site, sa base, Home Assistant et Jellyfin tournent ensemble ; construire le front Angular demande aussi de la mémoire |
| **Alimentation** | **Officielle, USB-C 5 V / 3 A** | Une alimentation faible fait décrocher le SSD → base corrompue |
| **SSD (système)** | **250 Go** suffisent pour le système, le site, Home Assistant et les sauvegardes | Bien plus fiable et rapide qu'une carte SD pour une base de données |
| **Disque pour les fichiers et vidéos** (si tu en as beaucoup) | Un **disque dur externe 3,5" avec sa propre alimentation** (1 à 4 To), ou un SSD système plus grand (1 To) | Les vidéos prennent vite des centaines de Go. Un disque 2,5" alimenté par le Pi **en plus** du SSD dépasse ce que les ports USB fournissent (1,2 A au total) : prendre un disque alimenté, ou un hub USB alimenté |
| **Liaison SSD** | **SSD SATA 2,5" + adaptateur USB 3.0 → SATA à puce ASMedia** (ex. StarTech USB3S2SAT3CB), ou un **SSD externe USB** prêt à l'emploi (Samsung T7, Crucial X6…) | Le Pi 4 n'a pas de port M.2 : le SSD passe forcément par l'USB. Éviter les adaptateurs à puce JMicron d'entrée de gamme (déconnexions, lenteurs) |
| **Câble Ethernet** | Recommandé (un câble RJ45 vers la box) | Un serveur en Wi-Fi décroche plus souvent. Le Wi-Fi reste possible (configurable à l'étape 3) |
| **Boîtier** | Avec dissipateur ou petit ventilateur | Le Pi 4 chauffe et ralentit pendant les builds |
| **Carte micro-SD** (celle que tu as) | Seulement pour l'étape 2, si besoin | Mise à jour du programme de démarrage du Pi |
| **Nom de domaine** | Environ 5 à 15 €/an (ex. `exemple.fr`) | L'adresse sympathique du site ; Cloudflare doit gérer ses DNS (étape 9) |
| **Un autre support pour les sauvegardes** | Disque externe, autre PC, stockage distant | Une sauvegarde restée sur le Pi meurt avec lui |
| **(Selon tes appareils domotiques)** Dongle Zigbee / Z-Wave USB | Seulement si tes appareils parlent Zigbee ou Z-Wave | Le Wi-Fi et le Bluetooth sont gérés par le Pi lui-même. Brancher le dongle via une **rallonge USB** (le port USB 3.0 voisin le brouille) |

**Sur le Pi 4** : 2 ports **USB 3.0 bleus** (→ le SSD), 2 ports USB 2.0 noirs, 1 port **USB-C qui sert
uniquement à l'alimentation**, 2 micro-HDMI (inutiles ici), 1 port Ethernet.

---

# Partie 2 — Le système

## Étape 2 — (Si besoin) Autoriser le Pi à démarrer sur USB

Le Pi 4 sait démarrer sur un disque USB **sans carte SD**, à condition que son programme de démarrage
(le *bootloader*, stocké dans une petite puce du Pi) soit assez récent. **Les Pi 4 achetés depuis
2020 l'ont d'origine** : tu peux tenter directement l'étape 3, et ne revenir ici que si le Pi ne démarre
pas sur le SSD.

Mise à jour sans écran, avec la carte SD :

1. Sur ton PC, installe **Raspberry Pi Imager** (voir étape 3).
2. Choisis l'appareil **Raspberry Pi 4**, puis comme système : *Misc utility images* → *Bootloader
   (Pi 4 family)* → **USB Boot**. Comme stockage : **la carte SD**. Écris.
3. Mets la carte SD dans le Pi (sans SSD), branche l'alimentation.
4. Attends : quand la **LED verte clignote vite et en continu** (après une dizaine de secondes), c'est
   terminé. Débranche le Pi et retire la carte SD : elle ne servira plus.

---

## Étape 3 — Installer le système sur le SSD, depuis ton PC

Le système s'installe **directement sur le SSD**, branché à ton PC en USB. Pas de carte SD.

### 3.1 Créer ta clé SSH (une seule fois, sur ton PC)

Une clé SSH remplace le mot de passe pour te connecter au Pi : bien plus sûr. Dans PowerShell :

```powershell
ssh-keygen -t ed25519 -C "pc-perso"
```

Accepte l'emplacement proposé, et choisis une phrase de passe (recommandé). Deux fichiers sont créés
dans `C:\Users\<toi>\.ssh\` :
- `id_ed25519` : la clé **privée**. Ne quitte jamais ton PC, ne se partage jamais.
- `id_ed25519.pub` : la clé **publique**. C'est elle qu'on donne au Pi.

Pour l'afficher (à copier à l'étape suivante) :

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

### 3.2 Écrire le système sur le SSD

1. Télécharge et installe **Raspberry Pi Imager** : https://www.raspberrypi.com/software/
2. Branche le SSD sur ton PC (avec son adaptateur USB).
3. Dans Imager :
   - **Appareil** : Raspberry Pi 4.
   - **Système** : *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**. *Lite* = sans bureau
     graphique (inutile sur un serveur) ; **64-bit obligatoire** (les images Docker du projet sont en ARM64).
   - **Stockage** : **le SSD**. ⚠️ Vérifie bien la taille affichée : tout le contenu du disque choisi sera
     effacé.
4. Quand Imager propose de **personnaliser le système** (« Modifier les réglages » / *OS customisation*),
   réponds **oui** — c'est ce qui évite d'avoir besoin d'un écran :
   - **Nom d'hôte** : par ex. `desdispos` (tu pourras joindre le Pi par `desdispos.local`).
   - **Utilisateur et mot de passe** : par ex. `jdr` + un mot de passe solide (il servira pour `sudo`).
   - **Wi-Fi** : seulement si tu n'utilises pas de câble Ethernet (nom du réseau, mot de passe, pays FR).
   - **Paramètres régionaux** : fuseau `Europe/Paris`, clavier `fr`.
   - **Services → SSH** : **activer**, avec **« Autoriser seulement l'authentification par clé
     publique »**, et colle ta clé publique (le contenu de `id_ed25519.pub`).
5. Écris, attends la vérification, éjecte le SSD.

---

## Étape 4 — Premier démarrage et connexion en SSH

1. Branche le **SSD sur un port USB bleu** du Pi, le **câble Ethernet** vers la box, puis
   l'**alimentation** en dernier. Pas de carte SD.
2. Attends 1 à 2 minutes (le premier démarrage agrandit le système et applique tes réglages).
3. Depuis ton PC :

   ```powershell
   ssh jdr@desdispos.local
   ```

   Si `desdispos.local` ne répond pas, va dans l'interface de ta box (liste des appareils connectés),
   repère `desdispos` et son adresse IP, puis `ssh jdr@192.168.1.xx`.
4. À la première connexion, SSH demande de confirmer l'empreinte du Pi : réponds `yes`.

**Fixer l'adresse du Pi** : dans l'interface de la box, menu DHCP / réseau local, crée un **bail
statique** (adresse réservée) pour le Pi. Son IP locale ne changera plus.

> C'est le **seul** réglage à faire sur la box. **N'ouvre aucun port** et ne configure aucune redirection
> (NAT/PAT) : le tunnel Cloudflare n'en a pas besoin, et c'est justement ce qui protège ton réseau.

---

## Étape 5 — Préparer le système

Toutes les commandes qui suivent se tapent **sur le Pi**, dans la session SSH.

```bash
# Mises à jour
sudo apt update && sudo apt full-upgrade -y

# Mises à jour de sécurité automatiques
sudo apt install -y unattended-upgrades git
sudo dpkg-reconfigure -plow unattended-upgrades   # répondre « Oui »

sudo reboot
```

Reconnecte-toi en SSH après une minute.

**Vérifier que SSH refuse les mots de passe** (Imager l'a normalement réglé à l'étape 3) :

```bash
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
```

Attendu : `passwordauthentication no` et `permitrootlogin no`. Sinon, corrige dans
`/etc/ssh/sshd_config` puis `sudo systemctl restart ssh` — **en gardant ta session ouverte** tant que
tu n'as pas vérifié qu'une nouvelle connexion fonctionne.

**Pare-feu** : SSH accessible seulement depuis le réseau de la maison (adapte `192.168.1.0/24` à la
plage de ta box) :

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw enable
```

---

## Étape 6 — Installer Docker

Suivre la procédure officielle « Install Docker Engine on Debian » (méthode par dépôt `apt`) :
https://docs.docker.com/engine/install/debian/ — Raspberry Pi OS 64 bits est une Debian ARM64.

Puis, pour lancer `docker` sans `sudo` :

```bash
sudo usermod -aG docker $USER
exit
```

Reconnecte-toi, puis vérifie :

```bash
docker run --rm hello-world
docker compose version
```

> ⚠️ Être dans le groupe `docker` équivaut à être administrateur du Pi : réserve-le à ton compte.

> ⚠️ **Docker et le pare-feu** : un port publié par Docker (`ports: - '8096:8096'`) **contourne `ufw`**
> (Docker écrit ses propres règles réseau) — il serait joignable de tout le réseau, quoi que dise `ufw`.
> D'où deux règles suivies dans ce tuto : les conteneurs du site ne publient que sur `127.0.0.1`, et
> Home Assistant et Jellyfin tournent en **réseau hôte** (`network_mode: host`), où `ufw` s'applique
> normalement.

**Pi à 2 Go de RAM seulement** : la construction du front risque de manquer de mémoire. Vérifie avec
`free -h` ; si la ligne *Swap* est inférieure à 2 Go, augmente la mémoire d'échange (swap) avant
l'étape 10 — la méthode dépend de la version de Raspberry Pi OS ❓ (voir la documentation officielle).

---

# Partie 3 — Le site Dés Dispos (public)

## Étape 7 — Récupérer le site

```bash
git clone https://github.com/inconnu259/jdr-master.git ~/desdispos
cd ~/desdispos
```

Si le dépôt est **privé**, GitHub demandera une authentification : le plus propre est une
**clé de déploiement en lecture seule** (GitHub → dépôt → *Settings* → *Deploy keys*), générée sur le
Pi avec `ssh-keygen -t ed25519`, puis un clone en `git@github.com:inconnu259/jdr-master.git`.

---

## Étape 8 — Les secrets de production

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
nano .env.prod
```

Génère chaque secret **sur le Pi** (jamais une valeur de `.env.dev`, qui est publique) :

```bash
openssl rand -base64 48     # → SESSION_SECRET
openssl rand -hex 24        # → POSTGRES_PASSWORD (hexadécimal : pas de caractère à échapper dans DATABASE_URL)
openssl rand -base64 18     # → ADMIN_PASSWORD
```

À remplir :
- `POSTGRES_PASSWORD`, et **le même** dans `DATABASE_URL` à la place de `<POSTGRES_PASSWORD>` ;
- `WEB_ORIGIN` : l'adresse publique choisie à l'étape 9, par ex. `https://jdr.exemple.fr` ;
- `SESSION_SECRET` ;
- `ADMIN_EMAIL`, `ADMIN_PSEUDO`, `ADMIN_PASSWORD` : ton compte administrateur, créé au premier démarrage ;
- la partie `MAIL_*` : voir l'étape 11 (tu peux la remplir plus tard, mais `MAIL_HOST` et `MAIL_FROM`
  doivent exister pour que l'API démarre).

L'API **refuse de démarrer** si un secret est trop court ou vaut celui de `.env.dev` : c'est voulu.

---

## Étape 9 — L'adresse publique et le tunnel Cloudflare

### 9.1 Le nom de domaine

1. Crée un compte gratuit sur https://dash.cloudflare.com.
2. Deux cas :
   - **Acheter le domaine chez Cloudflare** (*Domain Registration*) : le plus simple, au prix coûtant.
   - **Domaine déjà acheté ailleurs** (OVH, Gandi…) : *Add a domain* dans Cloudflare, qui te donne deux
     **serveurs de noms** ; remplace ceux de ton registraire par ceux-là (dans l'interface du
     registraire). La bascule prend de quelques minutes à quelques heures.
3. Choisis l'adresse du site, par exemple **`jdr.exemple.fr`** (un sous-domaine) ou `exemple.fr`.

### 9.2 Le tunnel

1. Dans Cloudflare : **Zero Trust** → *Networks* → **Tunnels** → *Create a tunnel* → type
   **Cloudflared** → nom : `desdispos`.
2. À l'écran d'installation, choisis **Docker** : Cloudflare affiche une commande contenant
   `--token eyJ...`. **Copie uniquement le jeton** (la longue chaîne après `--token`), pas la commande.
3. Sur le Pi :

   ```bash
   cd ~/desdispos
   nano .env.tunnel            # une seule ligne : TUNNEL_TOKEN=le_jeton_copié
   chmod 600 .env.tunnel
   ```

   (Avec `nano` plutôt qu'un `echo`, le jeton ne reste pas dans l'historique du shell.)

   (Fichier séparé de `.env.prod` : l'image `cloudflared`, fournie par un tiers, ne reçoit pas les
   secrets du site.)
4. De retour dans Cloudflare, **Public Hostname** (ou *Published application routes*) :
   - *Subdomain* : `jdr` · *Domain* : `exemple.fr`
   - *Service* : type **HTTP**, URL **`web:8080`**
5. Enregistre. Cloudflare crée l'entrée DNS tout seul.

### 9.3 Le certificat HTTPS

**Rien à faire** : Cloudflare émet et renouvelle automatiquement le certificat pour `jdr.exemple.fr`.
Dans *SSL/TLS* → *Edge Certificates*, active **Always Use HTTPS** (redirige tout `http://` vers
`https://`).

---

## Étape 10 — Lancer le site

```bash
cd ~/desdispos
docker compose -f docker-compose.prod.yml --profile tunnel up -d --build
```

Le premier lancement **construit les images sur le Pi** : compte de l'ordre de 15 à 40 minutes ❓
(selon le Pi et le SSD). Les suivants sont beaucoup plus rapides.

Suivre le démarrage :

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

Attendu : `All migrations have been successfully applied`, `✓ Admin seedé : ...`, puis
`Nest application successfully started`. `Ctrl+C` pour quitter les journaux (le site continue de tourner).

Vérifier :
- **Depuis le Pi** : `curl -I http://127.0.0.1:8080` → `HTTP/1.1 200 OK`.
- **Depuis ton téléphone en 4G** (donc hors de la maison) : ouvre `https://jdr.exemple.fr`, connecte-toi
  avec le compte admin de `.env.prod`.

**Redémarrages** : rien à configurer. Docker démarre avec le Pi, et chaque conteneur est en
`restart: unless-stopped` : après une coupure de courant, le site revient seul.

---

## Étape 11 — Les e-mails (invitations, mot de passe oublié)

Le site envoie des e-mails (liens d'invitation, réinitialisation de mot de passe). Il lui faut un
service d'envoi SMTP, par exemple **Brevo** (offre gratuite suffisante pour un groupe d'amis ❓ —
vérifier les quotas actuels).

1. Crée un compte Brevo, ajoute et **authentifie ton domaine** : Brevo donne des enregistrements DNS
   (**SPF**, **DKIM**, **DMARC**) à créer dans Cloudflare → *DNS*. Sans eux, tes e-mails arrivent en spam.
2. Récupère les identifiants SMTP (hôte, port 587, identifiant, clé) et remplis `.env.prod` :
   `MAIL_HOST`, `MAIL_PORT=587`, `MAIL_USER`, `MAIL_PASSWORD`,
   `MAIL_FROM="Dés Dispos <no-reply@exemple.fr>"`, `MAIL_REQUIRE_TLS=true`.
3. Relance : `docker compose -f docker-compose.prod.yml --profile tunnel up -d`
4. Teste avec « mot de passe oublié » sur ton propre compte.

---

## Étape 12 — (Recommandé) Réserver le site à tes amis : Cloudflare Access

Pour une bande d'amis, inutile que le monde entier puisse même voir la page de connexion. Cloudflare
Access ajoute une porte d'entrée : un code reçu par e-mail, réservé aux adresses autorisées.

**Zero Trust** → *Access* → *Applications* → *Add an application* → **Self-hosted** :
- domaine : `jdr.exemple.fr` ;
- politique : *Allow* → *Emails* → la liste des adresses de tes amis (ou *Emails ending in* pour un domaine) ;
- méthode de connexion : **One-time PIN** (code par e-mail).

Le site garde ses propres comptes : Access se place simplement devant. Pense à ajouter chaque nouvel
ami à la liste avant de l'inviter.

---

## Étape 13 — Sauvegardes

Voir [`deploiement.md` → Sauvegardes](deploiement.md#sauvegardes). En résumé :

```bash
cd ~/desdispos && docker/backup.sh        # sauvegarde manuelle
crontab -e                                 # puis ajouter la ligne ci-dessous
```

```cron
0 3 * * * cd /home/jdr/desdispos && docker/backup.sh >> backups/backup.log 2>&1
```

Puis **copie régulièrement `~/desdispos/backups` hors du Pi**, et fais **une restauration d'essai**
(procédure dans `deploiement.md`).

---

# Partie 4 — Accès privé depuis l'extérieur : Tailscale

## Étape 14 — Un réseau privé pour tes seuls appareils

**Le principe.** Tailscale crée un réseau privé chiffré (un VPN « maillé », basé sur WireGuard) entre
**tes** appareils : le Pi, ton téléphone, ton PC. Où que tu sois, ton téléphone joint le Pi comme s'il
était à la maison — mais **personne d'autre** ne le peut, et **rien n'est exposé sur Internet** : aucun
port ouvert sur la box, aucune adresse publique pour Home Assistant ou tes fichiers.

C'est la réponse à « très restrictif sur l'accès des appareils » : chaque appareil doit être **ajouté
explicitement** à ton réseau Tailscale, et des règles (étape 14.3) disent lequel a le droit de joindre quoi.

**Coût** : l'offre *Personal* est gratuite pour un usage non commercial (en 2026 : jusqu'à 6
utilisateurs, appareils illimités ❓ — vérifier sur https://tailscale.com/pricing).

> **Pourquoi pas le tunnel Cloudflare, comme pour le site ?** Il est fait pour publier un service à
> **tout le monde**. On peut le restreindre avec Cloudflare Access, mais l'application mobile Home
> Assistant gère mal la page de connexion d'Access, et un partage de fichiers réseau (SMB) ne passe pas
> par un tunnel web. Tailscale protège tout d'un coup, appareil par appareil. (Alternative 100 %
> auto-hébergée : WireGuard seul — mais il faut alors ouvrir un port UDP sur la box.)

### 14.1 Installer Tailscale sur le Pi

Procédure officielle pour Linux : https://tailscale.com/download/linux (elle ajoute le dépôt `apt` de
Tailscale, ce qui garde le paquet à jour avec le reste du système). Puis :

```bash
sudo tailscale up
```

La commande affiche un lien : ouvre-le sur ton PC, connecte-toi (compte Google, Microsoft, GitHub…) et
approuve le Pi. Vérifie :

```bash
tailscale ip -4          # l'adresse du Pi dans ton réseau privé, du type 100.x.y.z
```

Dans la console Tailscale (https://login.tailscale.com/admin/machines) : renomme la machine `desdispos`
et, dans son menu, **désactive l'expiration de la clé** (*Disable key expiry*) — sinon le Pi sort du
réseau au bout de quelques mois et tu perds l'accès à distance.

### 14.2 Ajouter tes appareils

Installe l'application **Tailscale** sur ton téléphone et ton PC, connecte-toi avec **le même compte**.
Grâce à **MagicDNS** (activé par défaut), le Pi est joignable par son nom, `desdispos`, depuis n'importe
quel appareil du réseau Tailscale.

Test : sur ton téléphone **en 4G** (Wi-Fi coupé), Tailscale actif, tu pourras ouvrir
`http://desdispos:8123` une fois Home Assistant installé (étape 15).

### 14.3 (Recommandé) Restreindre qui joint quoi

Par défaut, tous les appareils de ton compte Tailscale peuvent se joindre entre eux. Pour être strict,
la console → **Access controls** accepte des règles. Exemple : seuls ton téléphone et ton PC (marqués
`tag:perso`) joignent le Pi (`tag:serveur`), et seulement sur SSH, Home Assistant, Jellyfin et le
partage de fichiers :

```json
{
  "tagOwners": {
    "tag:perso": ["autogroup:admin"],
    "tag:serveur": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["tag:perso"],
      "dst": ["tag:serveur"],
      "ip": ["tcp:22", "tcp:8123", "tcp:8096", "tcp:445"]
    }
  ]
}
```

Puis, dans la liste des machines (*Edit ACL tags*), attribue `tag:serveur` au Pi et `tag:perso` à ton
téléphone et ton PC. Un nouvel appareil, même connecté à ton compte, ne joindra rien tant qu'il n'a pas
ce tag. Active aussi **Device approval** (*Settings*) : tout nouvel appareil doit être approuvé à la main.

❓ La syntaxe des règles évolue : l'éditeur de la console la valide avant d'enregistrer, fie-toi à lui.
⚠️ Si tu te verrouilles dehors, ce n'est pas grave : à la maison, le réseau local fonctionne toujours.

### 14.4 Ouvrir le pare-feu du Pi au réseau Tailscale

```bash
sudo ufw allow in on tailscale0
```

Le trafic Tailscale arrive par l'interface `tailscale0` : il a déjà passé les règles de l'étape 14.3, le
Pi l'accepte. Le reste d'Internet n'atteint toujours rien.

---

# Partie 5 — Home Assistant

## Étape 15 — Installer Home Assistant (version « Container »)

**Quelle version ?** *Home Assistant OS* veut le Pi **pour lui seul** (c'est un système complet) :
incompatible avec le site. On installe donc **Home Assistant Container**, dans Docker, à côté du reste.
Différence pratique : pas de « boutique d'add-ons » intégrée (un add-on n'est qu'un autre conteneur, à
installer soi-même si besoin). Toutes les **intégrations** (lampes, prises, capteurs, box, TV…) restent
disponibles.

### 15.1 Lancer Home Assistant

```bash
mkdir -p ~/homeassistant && cd ~/homeassistant
nano compose.yml
```

```yaml
services:
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    # Réseau hôte : nécessaire à la découverte automatique des appareils (mDNS) ; et ufw s'y applique.
    network_mode: host
    # Accès au matériel (Bluetooth, dongle Zigbee…) — recommandé par la documentation officielle.
    privileged: true
    environment:
      TZ: Europe/Paris
    volumes:
      - ./config:/config
      - /etc/localtime:/etc/localtime:ro
      - /run/dbus:/run/dbus:ro
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '3' }
```

```bash
docker compose up -d
docker compose logs -f        # Ctrl+C une fois le démarrage terminé
```

Référence : https://www.home-assistant.io/installation/raspberrypi-other (procédure officielle, à
consulter en cas de doute — c'est elle qui fait foi).

### 15.2 Ouvrir l'accès sur le Pi

Home Assistant écoute sur le port **8123**. Autorise le réseau de la maison (Tailscale l'est déjà depuis
l'étape 14.4) :

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8123 proto tcp
```

Les conteneurs du site, eux, n'y ont pas accès : leur réseau Docker n'est pas dans les plages autorisées.
Même en cas de faille dans le site, la domotique reste hors de portée.

### 15.3 Premier lancement

Depuis ton PC à la maison : `http://desdispos.local:8123`. Crée le compte propriétaire, puis :
- **Profil → Sécurité → Authentification multifacteur** : active-la (code dans une appli comme Aegis ou
  Google Authenticator). Ce compte pilote la maison : il mérite un second facteur.
- Les appareils détectés apparaissent dans *Paramètres → Appareils et services*.

### 15.4 Depuis l'extérieur

Tailscale actif sur le téléphone, ouvre **`http://desdispos:8123`** — ou, dans l'**application
Home Assistant**, ajoute un serveur avec cette adresse. Le trafic est chiffré par Tailscale de bout en
bout ; rien n'est publié sur Internet.

> **Et accessible à tous sur Internet, sans Tailscale ?** Possible (Cloudflare Tunnel vers le port 8123,
> plus les réglages `use_x_forwarded_for` / `trusted_proxies` de Home Assistant), ou avec l'abonnement
> officiel *Home Assistant Cloud* (environ 6,50 €/mois ❓). Déconseillé ici : une page de connexion de
> domotique exposée au monde entier, pour un usage qui se limite à tes appareils.

### 15.5 Mises à jour et sauvegardes

```bash
cd ~/homeassistant && docker compose pull && docker compose up -d
```

Sauvegardes : *Paramètres → Système → Sauvegardes* crée une archive dans
`~/homeassistant/config/backups/` — à copier hors du Pi avec celles du site.

---

# Partie 6 — Fichiers et vidéos

## Étape 16 — Le disque de stockage et le partage réseau

**Le principe.** Un dossier du Pi (ou un disque entier) est partagé sur le réseau avec **Samba** (le
protocole des dossiers partagés Windows, « SMB ») : il apparaît dans l'Explorateur Windows, le Finder,
et les applis de fichiers des téléphones. Accessible à la maison, et depuis l'extérieur **via Tailscale
seulement**.

> ⛔ **Ne jamais exposer un partage SMB directement sur Internet** (aucun port 445 ouvert sur la box) :
> c'est l'une des portes d'entrée les plus attaquées qui soient. Tailscale suffit.

### 16.1 (Si disque séparé) Préparer le disque

⚠️ **Le formatage efface tout le disque.** Vérifie trois fois son nom avant.

```bash
lsblk -o NAME,SIZE,MODEL,MOUNTPOINT      # repère le nouveau disque, ex. sdb (le SSD système est en général sda)
```

S'il n'a pas encore de partition, crée-en une avec `sudo fdisk /dev/sdb` (`g` table GPT, `n` nouvelle
partition en acceptant les valeurs par défaut, `w` écrire). Puis :

```bash
sudo mkfs.ext4 -L stockage /dev/sdb1
sudo mkdir -p /srv/stockage
sudo blkid /dev/sdb1                     # note la valeur UUID="…"
sudo nano /etc/fstab
```

Ajoute cette ligne (avec ton UUID). `nofail` évite que le Pi refuse de démarrer si le disque est
débranché :

```
UUID=ton-uuid  /srv/stockage  ext4  defaults,nofail  0  2
```

```bash
sudo systemctl daemon-reload && sudo mount -a && df -h /srv/stockage
```

Sans disque séparé, un simple `sudo mkdir -p /srv/stockage` sur le SSD suffit. Dans les deux cas :

```bash
sudo mkdir -p /srv/stockage/documents /srv/stockage/videos
sudo chown -R $USER:$USER /srv/stockage
```

### 16.2 Installer et configurer Samba

```bash
sudo apt install -y samba
sudo smbpasswd -a $USER          # mot de passe du partage : choisis-en un solide
sudo nano /etc/samba/smb.conf
```

Dans la section `[global]`, ajoute :

```ini
   # Seulement le réseau de la maison et le réseau Tailscale, en SMB récent, jamais en invité.
   hosts allow = 127.0.0.1 192.168.1.0/24 100.64.0.0/10
   hosts deny = 0.0.0.0/0
   server min protocol = SMB2_10
   smb encrypt = desired
   map to guest = never
```

Et, tout à la fin du fichier, le partage (`jdr` = ton utilisateur) :

```ini
[stockage]
   path = /srv/stockage
   valid users = jdr
   read only = no
   browseable = yes
```

Pour d'autres personnes de la maison : crée-leur un compte (`sudo adduser --no-create-home --shell /usr/sbin/nologin prenom`, puis
`sudo smbpasswd -a prenom`) et un second partage, par exemple les vidéos en `read only = yes`.

```bash
testparm -s >/dev/null && sudo systemctl restart smbd
sudo ufw allow from 192.168.1.0/24 to any app Samba
```

### 16.3 Y accéder

| Depuis | Adresse (à la maison) | Via Tailscale |
|---|---|---|
| Windows (Explorateur) | `\\desdispos.local\stockage` | `\\desdispos\stockage` |
| macOS (Finder → Aller → Se connecter au serveur) | `smb://desdispos.local/stockage` | `smb://desdispos/stockage` |
| Android | Appli de fichiers avec SMB (ex. *Material Files*), ou **VLC** pour lire les vidéos | idem, Tailscale actif |
| iPhone | App **Fichiers** → *Se connecter au serveur* → `smb://desdispos.local` | `smb://desdispos` |

Identifiant : ton utilisateur (`jdr`) et le mot de passe défini avec `smbpasswd`.

## Étape 17 — (Optionnel) Jellyfin : une vraie médiathèque pour les vidéos

Le partage suffit pour lire une vidéo avec VLC. **Jellyfin** ajoute une médiathèque : affiches, reprise
de lecture, applis TV, téléphone et navigateur.

```bash
mkdir -p ~/jellyfin && cd ~/jellyfin
nano compose.yml
```

```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    restart: unless-stopped
    # Réseau hôte : ufw s'applique (un port publié par Docker le contournerait).
    network_mode: host
    volumes:
      - ./config:/config
      - ./cache:/cache
      - /srv/stockage/videos:/media/videos:ro      # lecture seule : Jellyfin ne touche pas à tes vidéos
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '3' }
```

```bash
docker compose up -d
sudo ufw allow from 192.168.1.0/24 to any port 8096 proto tcp
```

Ensuite `http://desdispos.local:8096` à la maison (`http://desdispos:8096` via Tailscale) : crée le
compte administrateur, ajoute la bibliothèque `/media/videos`.

⚠️ **Limite du Pi 4** : il lit très bien une vidéo **telle quelle** (« lecture directe »), mais
**convertir** une vidéo à la volée (transcodage) le met vite à genoux — au mieux un flux 1080p, pas de
4K ❓. Préfère des vidéos dans un format lu nativement par tes appareils (MP4 / H.264).

---

## Récapitulatif des accès

| Service | À la maison | Depuis l'extérieur | Qui |
|---|---|---|---|
| **Site Dés Dispos** | `https://jdr.exemple.fr` | `https://jdr.exemple.fr` | Tout le monde (comptes du site ; + Cloudflare Access si activé) |
| **Home Assistant** | `http://desdispos.local:8123` | `http://desdispos:8123` (Tailscale) | Tes appareils autorisés + compte HA (2FA) |
| **Fichiers (SMB)** | `\\desdispos.local\stockage` | `\\desdispos\stockage` (Tailscale) | Tes appareils autorisés + utilisateurs Samba |
| **Jellyfin** | `http://desdispos.local:8096` | `http://desdispos:8096` (Tailscale) | Tes appareils autorisés + comptes Jellyfin |
| **SSH (administration)** | `ssh jdr@desdispos.local` | `ssh jdr@desdispos` (Tailscale) | Ta clé SSH uniquement |

Sur la box : **toujours aucun port ouvert**. Seul le site est visible publiquement.

---

## Au quotidien

| Je veux… | Commande (sur le Pi, dans `~/desdispos`) |
|---|---|
| Mettre à jour le site | `git pull && docker compose -f docker-compose.prod.yml --profile tunnel up -d --build` |
| Voir les journaux de l'API | `docker compose -f docker-compose.prod.yml logs -f api` |
| Voir l'état des conteneurs | `docker compose -f docker-compose.prod.yml ps` |
| Arrêter / relancer le site | `docker compose -f docker-compose.prod.yml --profile tunnel stop` / `start` |
| Mettre à jour le Pi | `sudo apt update && sudo apt full-upgrade -y` (automatique pour la sécurité) |
| Faire de la place (vieilles images) | `docker image prune -f` |
| Mettre à jour Home Assistant / Jellyfin | `cd ~/homeassistant` (ou `~/jellyfin`) puis `docker compose pull && docker compose up -d` |
| Voir les appareils de mon réseau Tailscale | `tailscale status` |
| Vérifier le pare-feu | `sudo ufw status numbered` |

---

## Dépannage

| Symptôme | Piste |
|---|---|
| Le Pi ne démarre pas sur le SSD | Étape 2 (bootloader) ; essaie l'autre port bleu ; vérifie l'alimentation officielle |
| `desdispos.local` introuvable | Utilise l'IP vue dans l'interface de la box ; vérifie le câble Ethernet |
| `Permission denied (publickey)` en SSH | La clé publique collée dans Imager ne correspond pas à `id_ed25519.pub` : réécrire le SSD (étape 3) |
| L'API redémarre en boucle | `docker compose -f docker-compose.prod.yml logs api` : souvent « Configuration de production refusée » → corriger `.env.prod` |
| Le site répond « 502 Bad Gateway » sur Internet | Le tunnel tourne mais pas nginx : `ps` ; vérifier que le service du tunnel vise bien `web:8080` |
| « Origine de la requête refusée » à la connexion | `WEB_ORIGIN` ne correspond pas exactement à l'adresse du site (`https://`, pas de `/` final) |
| Les e-mails n'arrivent pas | Dossier spam ; enregistrements SPF/DKIM dans Cloudflare ; journaux de l'API |
| Disque USB qui « disparaît » | Alimentation trop faible ou adaptateur JMicron : changer d'adaptateur / d'alimentation ; disque de stockage 2,5" en plus du SSD → hub USB alimenté |
| Home Assistant injoignable à la maison | `docker compose logs` dans `~/homeassistant` ; règle `ufw` du port 8123 ; plage `192.168.1.0/24` adaptée à ta box ? |
| Rien ne répond via Tailscale | Appli Tailscale active sur le téléphone ? `tailscale status` sur le Pi ; règles *Access controls* (tags) ; clé du Pi expirée (étape 14.1) |
| Le partage SMB refuse la connexion | `testparm -s` ; utilisateur créé avec `smbpasswd -a` ; `hosts allow` ; règle `ufw` Samba |
| Jellyfin saccade | Transcodage en cours : préférer des fichiers MP4/H.264 lus directement |
