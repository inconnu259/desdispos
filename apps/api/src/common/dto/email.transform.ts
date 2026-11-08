/**
 * Normalise une adresse e-mail entrante avant validation : espaces rognés, minuscules. Les adresses sont
 * stockées et comparées en minuscules partout — sinon `Bob@x.fr` et `bob@x.fr` donnaient deux comptes
 * distincts, et une invitation à `bob@x.fr` ne retrouvait pas le compte `Bob@x.fr`.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Variante `@Transform` de class-transformer ; laisse intact ce qui n'est pas une chaîne. */
export function normalizeEmailIfString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? normalizeEmail(value) : value;
}
