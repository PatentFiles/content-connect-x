import globals from 'globals';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import unused from 'eslint-plugin-unused-imports';

export default [{
  files: ['src/**/*.{js,jsx,mjs,cjs}'],
  ...js.configs.recommended,
  ...react.configs.flat.recommended,
  languageOptions: {
    globals: globals.browser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
  settings: { react: { version: 'detect' } },
  plugins: { react, 'react-hooks': hooks, 'unused-imports': unused },
  rules: {
    'no-unused-vars': 'off',
    'react/jsx-uses-vars': 'error',
    'react/jsx-uses-react': 'error',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after', argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper', 'toast-close'] }],
    'react-hooks/rules-of-hooks': 'error',
  },
}];
