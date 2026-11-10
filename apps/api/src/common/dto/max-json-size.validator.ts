import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Borne la taille (JSON sérialisé, en caractères) d'un champ libre — objet, tableau ou valeur quelconque
 * que les décorateurs de forme ne contraignent pas. Sans elle, seul le plafond global du corps de requête
 * (100 Ko) limitait ce qu'on stockait dans une fiche. `undefined` et `null` passent (cf. `@IsOptional`).
 */
export function MaxJsonSize(maxChars: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxJsonSize',
      constraints: [maxChars],
      validator: {
        validate: (value: unknown) => {
          if (value === undefined || value === null) return true;
          try {
            return JSON.stringify(value).length <= maxChars;
          } catch {
            return false;
          }
        },
        defaultMessage: () => `$property est trop volumineux (${maxChars} caractères au plus).`,
      },
    },
    options,
  );
}
