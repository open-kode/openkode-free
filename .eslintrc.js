module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Warn, don't error, on patterns common in scaffolding / webview template strings
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'warn',        // require() used inside webview HTML strings
    '@typescript-eslint/ban-ts-comment': 'warn',         // @ts-ignore present in stub modules
    'no-useless-escape': 'warn',                         // regex patterns in template strings
    'no-empty': ['warn', { allowEmptyCatch: true }],     // empty catch blocks are intentional no-ops
    'no-console': 'off',
    '@typescript-eslint/no-require-imports': 'off',
  },
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['out/**', 'node_modules/**', '*.js'],
};
