import { isDevMode } from '@angular/core';

// Production : le front et l'API partagent UNE origine — nginx sert le front et relaie `/api/*` vers
// l'API (docker/nginx.conf). Cookie de session same-origin, aucun CORS, CSP `connect-src 'self'`.
//
// Développement : l'API tourne sur le port 3000 du même hôte. Dérivé de l'hôte courant plutôt que figé
// sur `localhost`, afin de pouvoir ouvrir l'app depuis un AUTRE appareil du réseau local — typiquement un
// vrai téléphone, pour valider le rendu mobile (BIND_HOST=0.0.0.0 + IP LAN dans WEB_ORIGIN, cf. .env.dev).
//
// `isDevMode()` est fixé à la compilation : le build de production définit `ngDevMode = false`.
const DEV_API_PORT = 3000;

export const API_BASE = isDevMode()
  ? `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`
  : '/api';
