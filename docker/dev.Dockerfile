# Image de dev partagée par deps / api / web.
# Node 24 LTS (patch figé) + OpenSSL (requis par le moteur Prisma) + pnpm figé via corepack.
FROM node:24.17.0-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.28.11 --activate

WORKDIR /work
