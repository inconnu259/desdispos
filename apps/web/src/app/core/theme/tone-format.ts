/**
 * Remplit les trous `{nom}` d'un gabarit de ton avec les valeurs fournies. Une valeur est insérée
 * telle quelle (jamais interprétée comme motif de remplacement : `$&` reste littéral). Un trou sans
 * valeur correspondante est laissé intact.
 */
export function fillTone(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (hole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : hole,
  );
}
