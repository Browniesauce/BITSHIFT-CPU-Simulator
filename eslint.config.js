// ESLint flat configuration.
// Encodes the module boundaries and language rules in docs/engineering/CODING_STANDARDS.md
// (sections 2 and 4) and docs/architecture/SYSTEM_ARCHITECTURE.md (DEP-01 to DEP-07).
// Tool choice: DR-021. The rules are verified by tests/tooling/lint-boundaries.test.ts.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const BOUNDARY_MESSAGE =
  'Not allowed here by the module boundaries (CODING_STANDARDS section 4.1).';

/** Matches an import of a top-level `src/` directory, relative or nested. */
const dir = (name) => [`**/${name}`, `**/${name}/**`];

const REACT = ['react', 'react/*', 'react-dom', 'react-dom/*'];
const UI_LIBRARIES = [
  ...REACT,
  'motion',
  'motion/*',
  'framer-motion',
  'tailwindcss',
  'tailwindcss/*',
  '@codemirror/*',
];

/**
 * Builds the single no-restricted-imports rule for one directory.
 * One rule per directory: a later config block replaces, rather than merges, the options.
 */
function restrictImports({ blockedDirs, blockedPackages = [] }) {
  const patterns = [];
  if (blockedDirs.length > 0) {
    patterns.push({ group: blockedDirs.flatMap(dir), message: BOUNDARY_MESSAGE });
  }
  if (blockedPackages.length > 0) {
    patterns.push({
      group: blockedPackages,
      message:
        'UI, animation, styling and editor libraries are not allowed here (CODING_STANDARDS section 4.2).',
    });
  }
  return ['error', { patterns }];
}

/** Directories of `src/` and what each one may not import (CODING_STANDARDS section 4.1). */
const BOUNDARIES = [
  {
    files: ['src/platform/**'],
    blockedDirs: [
      'architectures',
      'assembler',
      'visualization',
      'features',
      'components',
      'store',
      'app',
    ],
    blockedPackages: UI_LIBRARIES,
  },
  {
    // Architectures never import each other. Only one architecture exists in v1.0, so that rule
    // is added with the second architecture (DEP-02).
    files: ['src/architectures/**'],
    blockedDirs: ['assembler', 'visualization', 'features', 'components', 'store', 'app'],
    blockedPackages: UI_LIBRARIES,
  },
  {
    files: ['src/assembler/**'],
    blockedDirs: ['architectures', 'visualization', 'features', 'components', 'store', 'app'],
    blockedPackages: UI_LIBRARIES,
  },
  {
    // Visualization may render with React (Phase 4 onward).
    files: ['src/visualization/**'],
    blockedDirs: ['architectures', 'assembler', 'features', 'components', 'store', 'app'],
  },
  {
    // The React hook wiring lives in src/app, so the store adapter itself has no React.
    files: ['src/store/**'],
    blockedDirs: ['architectures', 'assembler', 'visualization', 'features', 'components', 'app'],
    blockedPackages: REACT,
  },
  {
    files: ['src/features/**', 'src/components/**'],
    blockedDirs: ['architectures', 'assembler', 'app'],
  },
];

/** The simulation core: no DOM, no timers, no clock, no randomness (CODING_STANDARDS section 4.2). */
const SIMULATION_CORE = ['src/platform/**', 'src/architectures/**', 'src/assembler/**'];

const FORBIDDEN_GLOBALS = [
  ['window', 'the DOM'],
  ['document', 'the DOM'],
  ['navigator', 'browser APIs'],
  ['localStorage', 'browser storage'],
  ['sessionStorage', 'browser storage'],
  ['setTimeout', 'timers (the platform has no timers, DR-058)'],
  ['setInterval', 'timers (the platform has no timers, DR-058)'],
  ['requestAnimationFrame', 'timers (the UI owns the run loop, DR-058)'],
  ['Date', 'the wall clock (simulation must be deterministic)'],
  ['performance', 'the wall clock (simulation must be deterministic)'],
].map(([name, what]) => ({
  name,
  message: `The simulation core must not use ${what} (CODING_STANDARDS section 4.2).`,
}));

const FORBIDDEN_PROPERTIES = [
  ['Math', 'random'],
  ['crypto', 'getRandomValues'],
].map(([object, property]) => ({
  object,
  property,
  message:
    'The simulation core must be deterministic: no randomness (CODING_STANDARDS section 4.2).',
}));

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', '.pnpm-store']),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    // Language rules that apply to all TypeScript (CODING_STANDARDS section 2).
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  {
    // Application source only: no enums, no default exports, explicit exported types.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a string-literal union instead of an enum (CODING_STANDARDS section 2).',
        },
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports (CODING_STANDARDS section 2).',
        },
      ],
    },
  },

  ...BOUNDARIES.map(({ files, blockedDirs, blockedPackages }) => ({
    files,
    rules: { 'no-restricted-imports': restrictImports({ blockedDirs, blockedPackages }) },
  })),

  {
    files: SIMULATION_CORE,
    rules: {
      'no-restricted-globals': ['error', ...FORBIDDEN_GLOBALS],
      'no-restricted-properties': ['error', ...FORBIDDEN_PROPERTIES],
    },
  },
]);
