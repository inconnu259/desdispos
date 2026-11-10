// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  {
    // Registre d'icônes produit par scripts/generate-icons.mjs : jamais édité ni reformaté à la main,
    // sa fraîcheur est vérifiée par `generate-icons.mjs --check` (CI).
    ignores: ['src/app/core/icons/icon-registry.generated.ts'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Aligné sur apps/api/eslint.config.mjs : les mocks de test (Prisma, HttpClient, etc.)
      // s'appuient largement sur `as any`/`: any` dans ce monorepo ; désactivé plutôt que
      // truffé de eslint-disable sur chaque cast.
      '@typescript-eslint/no-explicit-any': 'off',
      // La convention `_param` = « volontairement non utilisé » est déjà appliquée dans le code
      // (ex. `onPollCreated(_poll)` dans calendar-view) ; sans ce réglage eslint la signalait
      // comme une erreur, ce qui poussait à supprimer un paramètre imposé par une signature.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Un stub vide est idiomatique dans un test : remplacer une méthode par un no-op pour
    // neutraliser un effet de bord. Exiger un corps n'apporterait que du bruit.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
