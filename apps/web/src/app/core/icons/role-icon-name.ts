import type { PartieRole } from '@master-jdr/shared';
import type { IconName } from './icon-registry.generated';

/** Icônes de rôle : le seul sous-ensemble que `roleIconName` peut renvoyer. */
export type RoleIconName = Extract<
  IconName,
  'role-mj' | 'role-joueur' | 'role-admin' | 'role-hote'
>;

/**
 * Seule correspondance rôle -> icône de l'application.
 * - `mj` -> `role-mj` ;
 * - `player` et `member` (ralliement) -> `role-joueur` ;
 * - `admin` d'un groupe -> `role-admin` ;
 * - `admin` d'une soirée isolée (`partie.kind === 'ONE_SHOT'`) -> `role-hote`.
 * Le drapeau `soireeIsolee` n'a d'effet que pour `admin`.
 */
export function roleIconName(
  role: PartieRole,
  { soireeIsolee = false }: { soireeIsolee?: boolean } = {},
): RoleIconName {
  switch (role) {
    case 'mj':
      return 'role-mj';
    case 'admin':
      return soireeIsolee ? 'role-hote' : 'role-admin';
    case 'player':
    case 'member':
      return 'role-joueur';
  }
}
