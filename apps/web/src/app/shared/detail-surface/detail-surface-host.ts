import { ElementRef, type Signal, inject, signal } from '@angular/core';

/** Une ligne du tableau mécanique (Story 31.4, DESIGN §7.2) : libellé d'interface + valeur. */
export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailSurfaceContent {
  title: string;
  /** Corps de texte simple — utilisé quand le terme n'a pas de données structurées. */
  body: string;
  /** Tableau mécanique (Story 31.4) — vide/absent pour un terme sans donnée structurée. */
  rows?: DetailRow[];
  /** Récit d'ambiance, rendu après le tableau (replié par défaut sur mobile). */
  narrative?: string;
}

/**
 * Contenu d'aide d'un terme, ou `null` quand le catalogue ne porte aucun texte — dans ce cas
 * l'appelant ne rend AUCUN déclencheur, plutôt qu'un geste ouvrant une surface vide (FR-19).
 * Partagé par la fiche et l'assistant pour que la règle soit écrite une seule fois.
 *
 * [Review][Patch] Un `label` vide est traité comme une absence d'aide, au même titre qu'un `body`
 * vide — pas de repli générique ici (ex. `'Détail'`) : `h.title` sert aussi de texte visible au
 * bouton (pas seulement de titre de panneau, où `DetailSurface` a déjà son propre repli), un
 * repli silencieux y produirait un bouton sans nom accessible. Un terme sans nom propre n'a de
 * toute façon rien à offrir comme aide utilisable.
 */
export function detailContent(
  label: string | undefined,
  text: string | undefined,
): DetailSurfaceContent | null {
  const title = label?.trim();
  const body = text?.trim();
  return title && body ? { title, body } : null;
}

export interface DetailSurfaceHost {
  /** Contenu affiché, ou `null` quand aucune surface n'est ouverte — à brancher sur le `@if` qui
   *  monte `<app-detail-surface>`. Un seul emplacement, jamais une pile. */
  readonly selected: Signal<DetailSurfaceContent | null>;
  /** À passer tel quel à `DetailSurface.openToken`. */
  readonly openToken: Signal<number>;
  open(title: string, body: string, event: Event): void;
  /** Ouvre un contenu déjà structuré (`talentDetail()`…) — même plomberie que `open()`. */
  openContent(content: DetailSurfaceContent, event: Event): void;
  close(): void;
}

/**
 * Plomberie d'ouverture d'une `DetailSurface`, partagée par tous ses consommateurs.
 *
 * `DetailSurface` est un composant de rendu pur : il ne sait ni s'ouvrir, ni mémoriser quel
 * élément l'a ouvert. Cette fonction porte les trois pièces que chaque consommateur devrait sinon
 * réécrire à l'identique — le contenu courant, le jeton d'ouverture, et le retour du focus au
 * déclencheur — de sorte qu'un nouvel emplacement se câble en quatre liaisons de template et
 * hérite du même comportement, y compris ses deux cas limites vérifiés ci-dessous.
 *
 * À appeler dans un contexte d'injection (initialisation de champ d'un composant) : l'élément hôte
 * sert de repli au focus.
 */
export function createDetailSurfaceHost(): DetailSurfaceHost {
  const hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  const selected = signal<DetailSurfaceContent | null>(null);
  const openToken = signal(0);
  let trigger: HTMLElement | null = null;

  const openContent = (content: DetailSurfaceContent, event: Event): void => {
    trigger = event.currentTarget as HTMLElement;
    // Un seul emplacement, jamais une pile : pas d'empilement de panneaux ni de voiles.
    selected.set(content);
    // Le jeton doit changer même pour deux déclencheurs au titre ET au corps identiques :
    // l'égalité de valeur des signaux empêcherait sinon le focus de rentrer dans le panneau.
    openToken.update((n) => n + 1);
  };

  return {
    selected: selected.asReadonly(),
    openToken: openToken.asReadonly(),

    open: (title: string, body: string, event: Event): void => openContent({ title, body }, event),

    openContent,

    close(): void {
      selected.set(null);
      // Le déclencheur peut avoir quitté le DOM pendant que la surface était ouverte (données
      // rafraîchies, étape d'assistant changée) — `.focus()` sur un nœud détaché est un no-op
      // silencieux, on retombe sur l'hôte plutôt que de renvoyer le focus en haut du document.
      if (trigger?.isConnected) {
        trigger.focus();
      } else {
        const host = hostElement.nativeElement;
        host.setAttribute('tabindex', '-1');
        host.focus();
      }
      trigger = null;
    },
  };
}
