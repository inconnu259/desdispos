import { Injectable, inject, signal } from '@angular/core';
import type { PartieDto } from '@master-jdr/shared';
import { PartiesService } from './parties.service';

/** Formats acceptés par le contrôleur de couverture (`party-cover.controller.ts`). */
export const ACCEPTED_COVER_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Plafond de dépôt appliqué AVANT tout envoi réseau (Story 29.14, AC14).
 *
 * Seule déclaration côté web (Story 53.5), après `party-cover.controller.ts` et
 * `characters.controller.ts` côté serveur — la Story 29.12 a acté que la valeur n'est pas factorisable
 * côté serveur (elle vit dans des décorateurs, qui ne peuvent pas lire une constante importée). Celle-ci
 * ne doit JAMAIS être plus permissive que celle du serveur : elle épargne un aller-retour réseau, elle
 * ne remplace pas la garde serveur.
 */
export const MAX_COVER_SIZE = 5 * 1024 * 1024;

/** Les deux seules clés de refus local d'une image de couverture (registre de textes). */
export type CoverRefusalKey = 'partie.cover_reject_type' | 'partie.cover_reject_size';

/** `null` si le fichier est acceptable, sinon la clé du texte expliquant la cause réelle (AC14/AC15).
 *  Pure : aucun appel réseau. Le serveur reste la garde réelle. */
export function coverRefusal(file: Pick<File, 'type' | 'size'>): CoverRefusalKey | null {
  if (!ACCEPTED_COVER_MIMES.includes(file.type)) return 'partie.cover_reject_type';
  if (file.size > MAX_COVER_SIZE) return 'partie.cover_reject_size';
  return null;
}

/**
 * Unité UNIQUE du dépôt et du retrait de l'image de couverture (Story 53.5) : règles de refus local,
 * garde anti-double envoi (`saving`) et les deux appels de `PartiesService`. Une instance par
 * composant (à déclarer dans ses `providers`) : `saving` ne concerne que ce qu'il envoie.
 *
 * Le droit de changer la couverture n'est PAS décidé ici : le serveur est seul juge
 * (`PartieDto.can.coverUpdate`, garde `PARTIE_COVER_UPDATE`).
 */
@Injectable()
export class CoverUpload {
  private readonly parties = inject(PartiesService);
  private readonly _saving = signal(false);

  /** Vrai pendant un envoi (dépôt ou retrait). */
  readonly saving = this._saving.asReadonly();

  /** Clé du refus local d'un fichier, ou `null` s'il est acceptable (voir `coverRefusal`). */
  refusal(file: Pick<File, 'type' | 'size'>): CoverRefusalKey | null {
    return coverRefusal(file);
  }

  /**
   * Dépose `file` sur la partie. Renvoie la partie mise à jour, ou `null` sans rien envoyer si un
   * envoi est déjà en cours (le `[disabled]` d'un bouton a un délai de peinture : un second
   * déclenchement avant ce délai enverrait deux dépôts concurrents) ou si le fichier est refusé
   * localement (l'appelant qui veut le message appelle `refusal()` d'abord). Un échec remonte à
   * l'appelant et libère `saving`.
   */
  change(partieId: string, file: File): Promise<PartieDto | null> {
    if (coverRefusal(file) !== null) return Promise.resolve(null);
    return this.send(() => this.parties.setCoverImage(partieId, file));
  }

  /** Retire l'image de couverture : la bannière générée reprend sa place. Même contrat que `change()`. */
  remove(partieId: string): Promise<PartieDto | null> {
    return this.send(() => this.parties.removeCoverImage(partieId));
  }

  private async send(call: () => Promise<PartieDto>): Promise<PartieDto | null> {
    if (this._saving()) return null;
    this._saving.set(true);
    try {
      return await call();
    } finally {
      this._saving.set(false);
    }
  }
}
