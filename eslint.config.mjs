import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';

const local = {
  rules: { 'max-lines-recommended': builtinRules.get('max-lines') },
};

const migrated = [
  'src/app/ui/**/*.ts',
  'src/app/core/state/**/*.ts',
  'src/app/layout/console/**/*.ts',
  'src/app/features/*/pages/**/*.ts',
  'src/app/features/*/ui/**/*.ts',
  'src/app/features/*/data/**/*.ts',
];

const restrictedSyntax = [
  {
    selector: "CallExpression[callee.name='setInterval']",
    message: 'Use poll() from core/state.',
  },
  {
    selector:
      "MemberExpression[object.name='ChangeDetectionStrategy'][property.name=/^(Eager|Default)$/]",
    message: 'OnPush is the default; new code does not opt out of it.',
  },
  {
    selector: 'Decorator[expression.callee.name=/^Host(Binding|Listener)$/]',
    message: 'Use the host property of the component or directive.',
  },
];

const noGeneratedClient = {
  group: ['**/core/api', '**/core/api/**'],
  message: 'Go through a store or a service in data/.',
};

export default tseslint.config(
  {
    ignores: ['src/app/core/api/**', 'dist/**', 'coverage/**', 'e2e-local/**'],
  },
  {
    files: migrated,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { local },
    rules: {
      'max-lines': ['error', { max: 500 }],
      'local/max-lines-recommended': ['warn', { max: 300 }],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-signal-model': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['src/app/ui/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: ['element', 'attribute'], prefix: 'fl', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'fl', style: 'camelCase' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noGeneratedClient,
            {
              group: ['**/features/**', '**/core/services/**'],
              message: 'Kit components are presentational: inputs, outputs, content.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/features/*/pages/**/*.ts', 'src/app/features/*/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noGeneratedClient] }],
    },
  },
  {
    files: migrated.map((glob) => glob.replace(/\.ts$/, '.html')),
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/no-inline-styles': ['error', { allowBindToStyle: true }],
    },
  },
  {
    files: migrated.map((glob) => glob.replace(/\.ts$/, '.spec.ts')),
    rules: {
      'max-lines': 'off',
      'local/max-lines-recommended': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
