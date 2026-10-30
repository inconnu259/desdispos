import { Injectable, signal } from '@angular/core';

/** Une seule clé pour toutes les sections : ce que l'on retient, ce sont les sections que j'ai repliées. */
const LS_KEY = 'master-jdr.event-games.collapsed-sections';

/**
 * Story 49.1 — l'état « replié » des sections de l'onglet des jeux sur place, par section (`host`, puis les
 * suivantes des Stories 49.2 à 49.4). Même forme que `ColumnDockService` : retenu **dans ce navigateur**
 * seulement (jamais en base) ; déplié par défaut. Le stockage peut être absent, plein ou refusé (fenêtre
 * privée) : toute lecture et toute écriture sont sous `try/catch`, et l'onglet marche sans.
 */
@Injectable({ providedIn: 'root' })
export class GamesSectionStateService {
  private readonly _collapsed = signal<ReadonlySet<string>>(this.read());

  /** Les sections repliées. */
  readonly collapsed = this._collapsed.asReadonly();

  isCollapsed(section: string): boolean {
    return this._collapsed().has(section);
  }

  toggle(section: string): void {
    const next = new Set(this._collapsed());
    if (!next.delete(section)) next.add(section);
    this._collapsed.set(next);
    this.write(next);
  }

  private read(): ReadonlySet<string> {
    try {
      if (typeof localStorage === 'undefined') return new Set();
      const raw = localStorage.getItem(LS_KEY);
      if (raw === null) return new Set();
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    } catch {
      return new Set();
    }
  }

  private write(collapsed: ReadonlySet<string>): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (collapsed.size === 0) localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, JSON.stringify([...collapsed]));
    } catch {
      // Stockage indisponible : l'état reste valable pour cette page, sans être retenu.
    }
  }
}
