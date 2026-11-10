# Image de PRODUCTION de l'API (NestJS + Prisma). Construite par docker-compose.prod.yml.
#
# Les paquets du workspace (@master-jdr/shared, @master-jdr/game-rules) exportent leur source TypeScript
# et Node l'exécute nativement (type stripping) — ce qui est refusé sous node_modules/. On garde donc la
# disposition du monorepo (liens symboliques vers packages/*) au lieu de `pnpm deploy`, qui les copierait
# dans node_modules/.
#
# L'image finale garde les devDependencies de l'API : la CLI `prisma` (migrations au démarrage) en est
# une. À alléger plus tard (service de migration séparé) si la taille de l'image gêne sur le Pi.

FROM node:24.17.0-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.28.11 --activate
WORKDIR /app

FROM base AS build
# Manifestes d'abord (couche de dépendances mise en cache tant que le lockfile ne change pas). Tous les
# package.json du workspace sont copiés pour que le lockfile corresponde ; seule l'API est installée.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/game-rules/package.json packages/game-rules/
RUN pnpm install --frozen-lockfile --filter api...

COPY packages/shared packages/shared
COPY packages/game-rules packages/game-rules
COPY apps/api apps/api
WORKDIR /app/apps/api
# prisma.config.ts lit DATABASE_URL même pour `generate` : valeur factice, jamais utilisée pour se connecter.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm prisma generate \
 && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
# Dossier des fichiers envoyés (portraits, couvertures, documents) : monté sur un volume nommé, qui hérite
# à sa création du propriétaire `node` défini ici.
RUN mkdir -p /app/apps/api/uploads && chown node:node /app/apps/api/uploads
USER node
WORKDIR /app/apps/api
EXPOSE 3000
# Migrations, puis compte admin initial (idempotent : ne touche jamais un admin existant), puis l'API.
# Aucun seed de démonstration en production.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/ts-node prisma/seed.ts && node dist/src/main.js"]
