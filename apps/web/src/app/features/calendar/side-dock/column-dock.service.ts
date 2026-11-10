import { Injectable, signal } from '@angular/core';

/** Une seule clé pour toutes les colonnes de droite : ce que l'on retient, c'est « j'ai rangé la colonne ». */
const LS_KEY = 'master-jdr.calendar.column-closed';

/**
 * Story 46.1 — l'état « rangé » de la colonne de droite des calendriers (MJ, joueur, groupe, plateau).
 *
 * Un seul booléen sert les deux largeurs : ≥ 768 px la colonne se range en dock, en dessous la liste de l'automate se
 * replie. Retenu **dans ce navigateur** seulement (jamais en base) ; ouvert par défaut. Le stockage peut être absent,
 * plein ou refusé (fenêtre privée) : toute lecture et toute écriture sont sous `try/catch`, et la page marche sans.
 */
@Injectable({ providedIn: 'root' })
export class ColumnDockService {
  private readonly _closed = signal(this.read());

  /** `true` : la colonne est rangée (dock) ou la liste repliée. */
  readonly closed = this._closed.asReadonly();

  set(closed: boolean): void {
    this._closed.set(closed);
    this.write(closed);
  }

  toggle(): void {
    this.set(!this._closed());
  }

  /** Entrer en Destinée rouvre la colonne : on ne regarde pas un vote derrière un dock. */
  open(): void {
    if (this._closed()) this.set(false);
  }

  private read(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(LS_KEY) === 'closed';
    } catch {
      return false;
    }
  }

  private write(closed: boolean): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (closed) localStorage.setItem(LS_KEY, 'closed');
      else localStorage.removeItem(LS_KEY);
    } catch {
      // Stockage indisponible : l'état reste valable pour cette page, sans être retenu.
    }
  }
}
