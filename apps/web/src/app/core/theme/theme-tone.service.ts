import { Injectable, computed, signal } from '@angular/core';
import { THEME_NAMES, THEMES, TONE_MAP, type Theme } from './tones';

const LS_KEY = 'jdr-theme';
const DEFAULT_THEME: Theme = 'grimoire-emeraude';
const THEME_CLASS_PREFIX = 'theme-';
// Identifiants de thème renommés : la valeur de `jdr-theme` écrite avant le renommage reste lisible.
const LEGACY_THEME_ALIASES: Record<string, Theme> = {
  'medieval-steampunk': 'atelier-cuivre',
};

@Injectable({ providedIn: 'root' })
export class ThemeToneService {
  // Le constructeur garde un défaut DÉTERMINISTE (thème mémorisé, sinon `DEFAULT_THEME`) : des
  // dizaines de composants et de specs instancient ce service. Le tirage au hasard d'une première
  // visite n'est fait que par `applyVisitTheme()`, appelé au démarrage de l'application.
  readonly activeTheme = signal<Theme>(this.readStoredTheme() ?? DEFAULT_THEME);
  readonly tone = computed(() => TONE_MAP[this.activeTheme()]);
  readonly themeNames = THEME_NAMES;
  readonly themes = THEMES;

  constructor() {
    this.applyClass(this.activeTheme());
  }

  /**
   * Thème de la visite, posé AVANT le premier rendu d'Angular (initialiseur d'application) : le
   * dernier thème connu localement, sinon un tirage équiprobable parmi `THEMES` — une fois par
   * chargement. Le thème tiré n'est JAMAIS écrit dans le stockage : la visite suivante le prendrait
   * pour un thème connu et le tirage cesserait. Seul `setTheme()` écrit.
   */
  applyVisitTheme(): void {
    const theme = this.readStoredTheme() ?? THEMES[Math.floor(Math.random() * THEMES.length)];
    this.applyClass(theme);
    this.activeTheme.set(theme);
  }

  setTheme(theme: Theme): void {
    this.applyClass(theme);
    this.activeTheme.set(theme);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, theme);
    } catch {
      // Stockage indisponible (mode privé, accès refusé) : le thème reste appliqué pour la session.
    }
  }

  private applyClass(theme: Theme): void {
    if (typeof document === 'undefined') return;
    const body = document.body;
    // Retire TOUTE classe `theme-*` (y compris une classe résiduelle inconnue) avant de poser la sienne.
    for (const cls of Array.from(body.classList)) {
      if (cls.startsWith(THEME_CLASS_PREFIX)) body.classList.remove(cls);
    }
    body.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  }

  /** Thème mémorisé s'il est valide ; `null` si absent, illisible, inconnu ou stockage indisponible. */
  private readStoredTheme(): Theme | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(LS_KEY);
      // Un cache d'avant le renommage garde l'ancien identifiant : il vaut `atelier-cuivre`.
      const stored =
        raw !== null && Object.hasOwn(LEGACY_THEME_ALIASES, raw) ? LEGACY_THEME_ALIASES[raw] : raw;
      return THEMES.includes(stored as Theme) ? (stored as Theme) : null;
    } catch {
      return null;
    }
  }
}
