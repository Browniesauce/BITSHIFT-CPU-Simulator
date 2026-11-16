import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Verifies that the lint configuration enforces the module boundaries and language rules in
// docs/engineering/CODING_STANDARDS.md (sections 2 and 4). If a rule is weakened or removed
// from eslint.config.js, one of these tests fails.

const eslint = new ESLint({ cwd: process.cwd() });

/** Lints `code` as if it were the file at `filePath`, and returns the rule IDs that fired. */
async function firedRules(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) {
    throw new Error(`ESLint returned no result for ${filePath}`);
  }
  return result.messages.map((message) => message.ruleId ?? 'parse-error');
}

const RESTRICTED_IMPORT = 'no-restricted-imports';

describe('import boundaries (CODING_STANDARDS section 4.1)', () => {
  const forbidden: Array<[string, string, string]> = [
    ['platform imports React', 'src/platform/x.ts', "import 'react';"],
    ['platform imports react-dom', 'src/platform/x.ts', "import 'react-dom/client';"],
    [
      'platform imports an architecture',
      'src/platform/x.ts',
      "import '../architectures/bitshift-8';",
    ],
    ['platform imports the assembler', 'src/platform/x.ts', "import '../assembler';"],
    ['platform imports visualization', 'src/platform/x.ts', "import '../visualization';"],
    ['platform imports the app layer', 'src/platform/x.ts', "import '../app/bootstrap';"],
    ['platform imports an animation library', 'src/platform/x.ts', "import 'motion/react';"],
    [
      'architecture imports the assembler',
      'src/architectures/bitshift-8/x.ts',
      "import '../../assembler';",
    ],
    [
      'architecture imports visualization',
      'src/architectures/bitshift-8/x.ts',
      "import '../../visualization';",
    ],
    ['architecture imports React', 'src/architectures/bitshift-8/x.ts', "import 'react';"],
    [
      'assembler imports an architecture',
      'src/assembler/x.ts',
      "import '../architectures/bitshift-8';",
    ],
    ['assembler imports React', 'src/assembler/x.ts', "import 'react';"],
    [
      'visualization imports an architecture',
      'src/visualization/x.ts',
      "import '../architectures/bitshift-8';",
    ],
    ['store imports React', 'src/store/x.ts', "import 'react';"],
    ['store imports an architecture', 'src/store/x.ts', "import '../architectures/bitshift-8';"],
    [
      'features import an architecture',
      'src/features/x.ts',
      "import '../architectures/bitshift-8';",
    ],
    ['components import the assembler', 'src/components/x.tsx', "import '../assembler';"],
  ];

  it.each(forbidden)('rejects: %s', async (_name, filePath, code) => {
    expect(await firedRules(filePath, code)).toContain(RESTRICTED_IMPORT);
  });

  const allowed: Array<[string, string, string]> = [
    [
      'architecture imports the platform',
      'src/architectures/bitshift-8/x.ts',
      "import '../../platform';",
    ],
    ['assembler imports the platform', 'src/assembler/x.ts', "import '../platform';"],
    ['visualization imports React', 'src/visualization/x.tsx', "import 'react';"],
    ['visualization imports the platform', 'src/visualization/x.ts', "import '../platform';"],
    ['features import visualization', 'src/features/x.tsx', "import '../visualization';"],
    [
      'the app layer imports an architecture',
      'src/app/x.ts',
      "import '../architectures/bitshift-8';",
    ],
    ['the app layer imports the assembler', 'src/app/x.ts', "import '../assembler';"],
  ];

  it.each(allowed)('allows: %s', async (_name, filePath, code) => {
    expect(await firedRules(filePath, code)).not.toContain(RESTRICTED_IMPORT);
  });
});

describe('simulation core restrictions (CODING_STANDARDS section 4.2)', () => {
  const globals: Array<[string, string]> = [
    ['window', 'export const a = window;'],
    ['document', 'export const a = document;'],
    ['localStorage', 'export const a = localStorage;'],
    ['setTimeout', 'setTimeout(() => undefined, 0);'],
    ['setInterval', 'setInterval(() => undefined, 0);'],
    ['requestAnimationFrame', 'requestAnimationFrame(() => undefined);'],
    ['Date', 'export const a = new Date();'],
    ['performance', 'export const a = performance;'],
  ];

  it.each(globals)('rejects the %s global in the platform', async (_name, code) => {
    expect(await firedRules('src/platform/x.ts', code)).toContain('no-restricted-globals');
  });

  it('rejects Math.random in the architectures', async () => {
    const code = 'export const a: number = Math.random();';
    expect(await firedRules('src/architectures/bitshift-8/x.ts', code)).toContain(
      'no-restricted-properties',
    );
  });

  it('rejects timers in the assembler', async () => {
    expect(await firedRules('src/assembler/x.ts', 'setTimeout(() => undefined, 0);')).toContain(
      'no-restricted-globals',
    );
  });

  it('allows the same globals in the application layer', async () => {
    const rules = await firedRules('src/app/x.ts', 'export const a: number = Date.now();');
    expect(rules).not.toContain('no-restricted-globals');
    expect(rules).not.toContain('no-restricted-properties');
  });
});

describe('language rules (CODING_STANDARDS section 2)', () => {
  it('rejects enums in src', async () => {
    expect(await firedRules('src/app/x.ts', 'export enum Mode { A }')).toContain(
      'no-restricted-syntax',
    );
  });

  it('rejects default exports in src', async () => {
    expect(await firedRules('src/app/x.ts', 'export default 1;')).toContain('no-restricted-syntax');
  });

  it('rejects any', async () => {
    expect(await firedRules('src/app/x.ts', 'export const a: any = 1;')).toContain(
      '@typescript-eslint/no-explicit-any',
    );
  });

  it('rejects @ts-ignore comments', async () => {
    const code = '// @ts-ignore\nexport const a: number = 1;';
    expect(await firedRules('src/app/x.ts', code)).toContain('@typescript-eslint/ban-ts-comment');
  });

  it('requires explicit return types on exported functions in src', async () => {
    expect(
      await firedRules('src/app/x.ts', 'export function f(a: number) { return a; }'),
    ).toContain('@typescript-eslint/explicit-module-boundary-types');
  });

  it('accepts a conforming module', async () => {
    const code = 'export function f(a: number): number {\n  return a;\n}\n';
    expect(await firedRules('src/platform/x.ts', code)).toEqual([]);
  });
});
