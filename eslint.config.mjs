import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'drizzle/**'],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
      'react': reactPlugin,
      'react-hooks': hooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-img-element': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }
);
