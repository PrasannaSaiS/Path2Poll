/**
 * @module eslint.config
 * @fileoverview ESLint configuration for Path2Poll backend.
 * Enforces code quality standards including consistent formatting,
 * best practices, and Node.js-specific rules.
 */

export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                process: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                performance: "readonly",
                URL: "readonly",
            },
        },
        rules: {
            // Code quality
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always"],
            "curly": ["error", "multi-line"],
            "no-throw-literal": "error",

            // Best practices
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "no-return-await": "warn",
            "require-await": "warn",

            // Style consistency
            "semi": ["error", "always"],
            "quotes": ["error", "double", { avoidEscape: true }],
            "comma-dangle": ["error", "always-multiline"],
        },
    },
    {
        // Test files — relaxed rules
        files: ["tests/**/*.js"],
        languageOptions: {
            globals: {
                describe: "readonly",
                test: "readonly",
                expect: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                jest: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "off",
            "require-await": "off",
        },
    },
];
