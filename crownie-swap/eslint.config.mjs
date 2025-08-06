import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [{
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
        parser: tsparser,
        parserOptions: {
            ecmaVersion: 2022,
            sourceType: 'module'
        }
    },
    plugins: {
        '@typescript-eslint': tseslint
    },
    rules: {
        "no-console": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off"
    }
}];
