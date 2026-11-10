#!/usr/bin/env bash
# Sauvegarde de production : base PostgreSQL + fichiers envoyés (portraits, couvertures, documents).
# À lancer sur le Pi, depuis la racine du dépôt, stack de prod démarrée. Procédure : docs/deploiement.md.
#
#   docker/backup.sh                       # écrit dans ./backups, garde 14 jours
#   BACKUP_DIR=/mnt/ssd/backups KEEP_DAYS=30 docker/backup.sh
#
# Produit, par exécution, un dossier horodaté contenant :
#   - db.dump      : pg_dump au format custom (restauration sélective possible avec pg_restore) ;
#   - uploads.tgz  : archive du volume des fichiers envoyés ;
#   - SHA256SUMS   : empreintes, pour vérifier une copie avant de la restaurer.
#
# ⚠️ Une sauvegarde qui reste sur le Pi ne protège pas d'une carte SD morte ou d'un vol : copier le
# dossier ailleurs (disque externe, autre machine, stockage distant) après chaque exécution.
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.prod.yml)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="${BACKUP_DIR}/${STAMP}"

if [[ ! -f docker-compose.prod.yml ]]; then
  echo "À lancer depuis la racine du dépôt (docker-compose.prod.yml introuvable)." >&2
  exit 1
fi

# Dossier de sortie lisible par son seul propriétaire : il contient toute la base.
umask 077
mkdir -p "${TARGET}"
# En cas d'échec, pas de dossier à moitié rempli qui ressemblerait à une sauvegarde.
trap 'rm -rf "${TARGET}"; echo "✗ Sauvegarde ÉCHOUÉE, rien n’a été conservé." >&2' ERR

echo "→ Base de données…"
# Variables lues DANS le conteneur (POSTGRES_USER/POSTGRES_DB de .env.prod) : rien n'apparaît sur la
# ligne de commande de l'hôte. Écriture dans un fichier temporaire : un dump interrompu ne doit jamais
# passer pour une sauvegarde complète.
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "${TARGET}/db.dump.partial"
mv "${TARGET}/db.dump.partial" "${TARGET}/db.dump"

echo "→ Fichiers envoyés…"
"${COMPOSE[@]}" exec -T api tar -czf - -C /app/apps/api uploads > "${TARGET}/uploads.tgz.partial"
mv "${TARGET}/uploads.tgz.partial" "${TARGET}/uploads.tgz"

# Contrôles : le dump doit être lisible par pg_restore, l'archive par tar.
"${COMPOSE[@]}" exec -T db pg_restore --list < "${TARGET}/db.dump" > /dev/null
tar -tzf "${TARGET}/uploads.tgz" > /dev/null

(cd "${TARGET}" && sha256sum db.dump uploads.tgz > SHA256SUMS)

# Rotation : supprime les sauvegardes horodatées plus anciennes que KEEP_DAYS jours (et rien d'autre).
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d \
  -regextype posix-extended -regex '.*/[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}' \
  -mtime +"${KEEP_DAYS}" -exec rm -rf {} +

echo "✓ Sauvegarde écrite dans ${TARGET} ($(du -sh "${TARGET}" | cut -f1))"
