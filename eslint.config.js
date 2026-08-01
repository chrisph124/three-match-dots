const expoConfig = require('eslint-config-expo/flat');
const sonarjs = require('eslint-plugin-sonarjs');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  sonarjs.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'babel.config.js'],
  },
];
