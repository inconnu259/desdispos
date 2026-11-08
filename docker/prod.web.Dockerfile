# Image de PRODUCTION du front : build Angular, puis nginx non-root qui sert les fichiers compilés et
# relaie /api vers l'API (docker/nginx.conf). Construite par docker-compose.prod.yml.

FROM node:24.17.0-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/game-rules/package.json packages/game-rules/
RUN pnpm install --frozen-lockfile --filter web...

COPY packages/shared packages/shared
COPY packages/game-rules packages/game-rules
COPY apps/web apps/web
WORKDIR /app/apps/web
RUN pnpm exec ng build --configuration production

# Image nginx officielle en variante non-root (écoute sur 8080, utilisateur nginx).
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 8080
