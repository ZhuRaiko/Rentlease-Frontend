// Lint exists for one class of bug: a component that calls a different number of hooks from one render to the next
// ("Rendered fewer hooks than expected"), which only shows on a device. rules-of-hooks is an error; exhaustive-deps is advice.
const hooks = require('eslint-plugin-react-hooks');
const parser = require('@typescript-eslint/parser');

module.exports = [
  { ignores: ['android/**', 'node_modules/**', 'vendor/**', 'supabase/**', 'tests/**', 'scripts/**', 'docs/**', '**/*.d.ts'] },
  {
    files: ['App.tsx', 'src/**/*.{ts,tsx}'],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
];
