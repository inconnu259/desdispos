import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import {
  PreloadAllModules,
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import { ThemeToneService } from './core/theme/theme-tone.service';
import { PageTitleStrategy } from './core/title/page-title.strategy';

registerLocaleData(localeFr, 'fr-FR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withPreloading` : les routes en `loadComponent` (cf. `app.routes.ts`) sont téléchargées en
    // arrière-plan dès que l'application a démarré. Le bundle initial reste léger sans que la
    // première navigation vers une route paresseuse attende son morceau.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(), // requis par Angular Material
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    // Titre d'onglet par écran (« Dés Dispos – <page> ») et annonce au lecteur d'écran.
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    // Thème de la visite (dernier thème connu, sinon tirage) posé sur <body> AVANT le premier rendu
    // d'Angular : un initialiseur d'application s'exécute avant l'amorçage du composant racine.
    provideAppInitializer(() => inject(ThemeToneService).applyVisitTheme()),
  ],
};
