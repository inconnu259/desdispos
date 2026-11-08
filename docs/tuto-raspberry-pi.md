# Tuto — Installer Dés Dispos sur un Raspberry Pi 4, pas à pas

> Ce tuto part de zéro : du matériel à acheter jusqu'au site accessible en `https://` depuis Internet.
> Pas d'écran ni de clavier pour le Pi : tout se fait depuis ton PC, puis en SSH.
> Mémo technique (architecture, sauvegardes, mises à jour) : [`deploiement.md`](deploiement.md).
>
> ❓ Les écrans de Raspberry Pi Imager et du tableau de bord Cloudflare changent régulièrement : les
> noms de menus ci-dessous peuvent varier légèrement, la logique reste la même.

## Vue d'ensemble

```
Internet ──HTTPS──▶ Cloudflare ◀──connexion SORTANTE── cloudflared ─┐
                    (certificat,                                    │  sur le Pi
                     adresse jdr.exemple.fr)        nginx ◀─────────┘  (Docker)
                                                      │
                                                     API ── PostgreSQL

Ton PC ──SSH (réseau de la maison uniquement)──▶ Pi
```

- **Aucun port à ouvrir sur la box** : c'est le Pi qui appelle Cloudflare, pas l'inverse. Ton IP
  personnelle reste cachée.
- **Le certificat HTTPS est fourni et renouvelé par Cloudflare**, automatiquement.
- **SSH sert uniquement à administrer le Pi** depuis ton réseau local. (Attention à la confusion :
  le « certificat » du site est un certificat **TLS/HTTPS** ; SSH, lui, fonctionne avec une **paire de
  clés** — deux choses différentes, toutes deux couvertes plus bas.)

---

## Étape 1 — Le matériel

| Élément | Recommandation | Pourquoi |
|---|---|---|
| **Raspberry Pi 4** | **4 Go de RAM ou plus** (2 Go : possible, voir étape 6) | Construire le front Angular demande de la mémoire |
| **Alimentation** | **Officielle, USB-C 5 V / 3 A** | Une alimentation faible fait décrocher le SSD → base corrompue |
| **SSD** | **120 à 250 Go** (le site + des années de sauvegardes tiennent dans quelques Go) | Bien plus fiable et rapide qu'une carte SD pour une base de données |
| **Liaison SSD** | **SSD SATA 2,5" + adaptateur USB 3.0 → SATA à puce ASMedia** (ex. StarTech USB3S2SAT3CB), ou un **SSD externe USB** prêt à l'emploi (Samsung T7, Crucial X6…) | Le Pi 4 n'a pas de port M.2 : le SSD passe forcément par l'USB. Éviter les adaptateurs à puce JMicron d'entrée de gamme (déconnexions, lenteurs) |
| **Câble Ethernet** | Recommandé (un câble RJ45 vers la box) | Un serveur en Wi-Fi décroche plus souvent. Le Wi-Fi reste possible (configurable à l'étape 3) |
| **Boîtier** | Avec dissipateur ou petit ventilateur | Le Pi 4 chauffe et ralentit pendant les builds |
| **Carte micro-SD** (celle que tu as) | Seulement pour l'étape 2, si besoin | Mise à jour du programme de démarrage du Pi |
| **Nom de domaine** | Environ 5 à 15 €/an (ex. `exemple.fr`) | L'adresse sympathique du site ; Cloudflare doit gérer ses DNS (étape 9) |
| **Un autre support pour les sauvegardes** | Disque externe, autre PC, stockage distant | Une sauvegarde restée sur le Pi meurt avec lui |

**Sur le Pi 4** : 2 ports **USB 3.0 bleus** (→ le SSD), 2 ports USB 2.0 noirs, 1 port **USB-C qui sert
uniquement à l'alimentation**, 2 micro-HDMI (inutiles ici), 1 port Ethernet.

---

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

**Pi à 2 Go de RAM seulement** : la construction du front risque de manquer de mémoire. Vérifie avec
`free -h` ; si la ligne *Swap* est inférieure à 2 Go, augmente la mémoire d'échange (swap) avant
l'étape 10 — la méthode dépend de la version de Raspberry Pi OS ❓ (voir la documentation officielle).

---

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

## Au quotidien

| Je veux… | Commande (sur le Pi, dans `~/desdispos`) |
|---|---|
| Mettre à jour le site | `git pull && docker compose -f docker-compose.prod.yml --profile tunnel up -d --build` |
| Voir les journaux de l'API | `docker compose -f docker-compose.prod.yml logs -f api` |
| Voir l'état des conteneurs | `docker compose -f docker-compose.prod.yml ps` |
| Arrêter / relancer le site | `docker compose -f docker-compose.prod.yml --profile tunnel stop` / `start` |
| Mettre à jour le Pi | `sudo apt update && sudo apt full-upgrade -y` (automatique pour la sécurité) |
| Faire de la place (vieilles images) | `docker image prune -f` |

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
| Disque USB qui « disparaît » | Alimentation trop faible ou adaptateur JMicron : changer d'adaptateur / d'alimentation |
