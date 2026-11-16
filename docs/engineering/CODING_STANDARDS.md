# BITSHIFT — Coding Standards

**Status:** Proposed (B). Applies to all code from Phase 1 onward. Phase 0 contains no implementation code beyond the placeholder shell.

---

## 1. Language and Tooling

- TypeScript with `strict` enabled (see `tsconfig.json`). `any` is not allowed. `unknown` is preferred at boundaries and narrowed.
- `noUnusedLocals` and `noUnusedParameters` must pass.
- Formatting by Prettier (`.prettierrc.json`). Run `pnpm format` before commit.
- Line endings LF; indentation 2 spaces; final newline required (`.editorconfig`).
- Linting (ESLint) is not yet approved (DR-021). Until then, review enforces the rules below.

## 2. Naming

| Item                       | Convention                                                      | Example                   |
| -------------------------- | --------------------------------------------------------------- | ------------------------- |
| Files (modules)            | kebab-case                                                      | `execution-controller.ts` |
| Files (React components)   | PascalCase                                                      | `RegisterPanel.tsx`       |
| Directories                | kebab-case                                                      | `bitshift-8/`             |
| Types, interfaces, classes | PascalCase                                                      | `CpuSnapshot`             |
| Functions, variables       | camelCase                                                       | `loadProgram`             |
| Constants                  | SCREAMING_SNAKE_CASE for true module constants                  | `MEMORY_BYTES`            |
| Event kinds                | kebab-case string literals                                      | `'register-write'`        |
| Architecture IDs           | lowercase kebab-case                                            | `'bitshift-8'`            |
| Register names in data     | As the architecture documents them                              | `'A'`, `'PC'`             |
| Opcodes in code            | Hexadecimal numeric literals with a comment naming the mnemonic | `0x20 // ADD B`           |

Use consistent terms from the documentation: _micro-operation_, _snapshot_, _execution event_, _execution controller_, _architecture descriptor_, _CPU instance_. Do not introduce synonyms (for example "step result" for `StepOutcome`).

## 3. Module Boundaries

- Follow the dependency rules in [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) section 3.1.
- Each directory exposes an `index.ts` public entry. Other files are internal.
- Simulation directories (`src/platform`, `src/architectures`, `src/assembler`) must not import React, DOM APIs, Zustand, Motion or Tailwind.
- No circular imports.

## 4. Types and Contracts

- Contracts in `docs/contracts/` are the source of truth. Code must match them. A mismatch is a bug in whichever side is wrong, and the doc must be corrected through the decision process.
- Snapshot and event types are `readonly`.
- Prefer discriminated unions over boolean flags for state.
- Exported functions have explicit return types.
- No non-null assertions (`!`) except where a comment explains why the value is guaranteed.

## 5. Determinism

- No `Math.random`, `Date`, `performance.now` or `setTimeout` in simulation code.
- Iteration order must be defined. Do not iterate over `Map`/`Set` built from unordered input when order affects output.
- Numeric operations on 8-bit values must mask explicitly (`& 0xff`). Wrapping is written in code, never assumed.

## 6. Error Handling

- Expected failures (bad input, bad program, unknown ID) are returned as `Result` values with a `Diagnostic`.
- Exceptions are for programmer errors. They must not be used to report user input problems.
- The controller converts unexpected exceptions into a FAULTED state and a `fault` event (see [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md) section 7).
- Error messages are written for learners: say what was wrong and where, in plain language.
- Never swallow errors silently. A `catch` must rethrow, return a `Result`, or record a diagnostic.

## 7. Comments and Documentation

- Comments explain _why_, not _what_. Names should carry the _what_.
- Every exported contract type has a one-line doc comment.
- Architecture code that implements a hardware detail cites the spec section (for example `// BITSHIFT-8 ISA draft §7`).
- Do not leave `TODO` without a decision register ID or a stage reference (for example `// TODO(DR-011)`).

## 8. React and UI Code (Phase 4 onward)

- Components are function components with explicit prop types.
- Components read from the store and dispatch intents. They do not call `CpuInstance` or mutate platform state.
- Animation timing is owned by the visualization layer and does not change simulation results.
- Components must work at 1280px width and larger without horizontal scrolling (desktop target, DR-040). Smaller widths are best-effort.
- Accessible names for interactive controls. Colour is never the only indicator of state.

## 9. Dependencies

- A new dependency requires a justification and a row in [TECHNOLOGY_STACK.md](../architecture/TECHNOLOGY_STACK.md) section 4 in the same change.
- Prefer the platform and the standard library over a package.
- Do not add a package for a single small function.

## 10. Files and Folders

- No speculative files. Create a file when the stage that needs it starts.
- Empty directories keep a `.gitkeep` or `README.md`.
- Generated files (`dist/`, `coverage/`) are not committed.

## 11. Review Checklist

Before a change is reviewed:

- [ ] Types match contracts in `docs/contracts/`.
- [ ] No forbidden imports for the module (section 3).
- [ ] No `any`, no unexplained `!`.
- [ ] Deterministic: no time, randomness or unordered output.
- [ ] Errors are values at boundaries.
- [ ] Tests added per [TEST_STRATEGY.md](TEST_STRATEGY.md).
- [ ] Docs updated if behaviour or contract changed.
