# BITSHIFT — Coding Standards

**Status:** Stage 0.3. Applies to all code from Phase 1 onward. Phase 0 contains no application code beyond the placeholder shell. Every rule here is either checked by a tool, checked by a named test, or checked in review against the checklist in section 12.
**Related:** [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [TEST_STRATEGY.md](TEST_STRATEGY.md), [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md), [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)

Where a rule duplicates a contract, the contract is the source of truth and this file only states how code must follow it.

---

## 1. Tooling Baseline

| Tool              | Configuration                                                                                                                                                         | Enforced by       | Command             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------- |
| TypeScript        | `tsconfig.json`, `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`                                                                 | Tool              | `pnpm typecheck`    |
| Prettier          | `.prettierrc.json` (single quotes, trailing commas, print width 100)                                                                                                  | Tool              | `pnpm format:check` |
| EditorConfig      | `.editorconfig` (LF, 2-space indent, final newline)                                                                                                                   | Editor and review | —                   |
| Vitest            | `vite.config.ts` (`tests/**/*.test.{ts,tsx}`)                                                                                                                         | Tool              | `pnpm test`         |
| Import boundaries | Phase 1 import test (section 5.4)                                                                                                                                     | Test              | `pnpm test`         |
| Linter            | **Not approved** (DR-021). Until a linter is approved, the rules that a linter would check are enforced by the import test (section 5.4), the test suite, and review. | Review            | —                   |

No rule may depend on a tool that has not been approved. Adding a linter needs a DR-021 decision and a TECHNOLOGY_STACK row (section 9).

---

## 2. TypeScript

1. `any` is not allowed. Use `unknown` at boundaries and narrow it.
2. Every field of a shared type is `readonly`. Arrays in shared types are `readonly T[]`.
3. Exported functions and methods declare their return type.
4. Prefer discriminated unions to boolean combinations. The `Result` type (DATA_CONTRACTS §2) is the model.
5. A non-null assertion (`!`) needs a comment on the same line that states why the value is guaranteed. Without the comment, review rejects it.
6. Use named exports. Default exports are not used in `src/`, so that every import names what it uses.
7. Type-only imports use `import type`.
8. Enums are not used. Use string-literal unions (for example `CpuState`).
9. `@ts-expect-error` and `@ts-ignore` are not used. A type gap is fixed in the type, or documented with a DR reference and reviewed.
10. Numeric 8-bit arithmetic masks explicitly (`value & 0xff`). Wrapping is written in code, never assumed.

---

## 3. Naming and Terminology

### 3.1 Identifiers

| Item                             | Convention                         | Example                      |
| -------------------------------- | ---------------------------------- | ---------------------------- |
| Module file                      | kebab-case                         | `execution-controller.ts`    |
| React component file             | PascalCase                         | `RegisterPanel.tsx`          |
| Test file                        | `<subject>.test.ts`                | `snapshot-isolation.test.ts` |
| Directory                        | kebab-case                         | `bitshift-8/`                |
| Type, interface                  | PascalCase                         | `CpuSnapshot`, `StepOutcome` |
| Function, variable, method       | camelCase                          | `stepClock`, `buildSnapshot` |
| Module constant                  | SCREAMING_SNAKE_CASE               | `MAX_BATCH_CYCLES`           |
| Event kind                       | kebab-case string literal          | `'register-write'`           |
| Architecture-specific event kind | `<architecture-id>/<kind>`         | `bitshift-8/<kind>`          |
| Architecture identifier          | lowercase kebab-case               | `'bitshift-8'`               |
| Diagnostic code                  | UPPER-HYPHEN with area prefix      | `PLT-RUNNING`                |
| Register and flag names          | As the architecture documents them | `'A'`, `'Z'`                 |

### 3.2 Terms

Use the terms in MODULE_CONTRACTS and DATA_CONTRACTS, exactly:

| Concept                             | Term                             | Do not use                                       |
| ----------------------------------- | -------------------------------- | ------------------------------------------------ |
| Unit of simulated time              | `cycle`, `ClockCycle`            | `tick`, `Tick`, `clock tick`                     |
| One atomic action in a cycle        | micro-operation                  | "micro-op step", "sub-step"                      |
| Request to advance one cycle        | `stepClock`                      | `stepMicroOperation`                             |
| Request to advance to a boundary    | `stepInstruction`                | "instruction step result"                        |
| Run request                         | `beginRun`, `runBatch`, `endRun` | `run()`, `pause()`, `selectArchitecture`         |
| Result of one architecture step     | `StepOutcome`                    | "step result", "cycle report"                    |
| Published simulation state          | `CpuSnapshot`                    | "CPU state object", "state copy" in shared types |
| Architecture-internal copy of state | `CpuStateCopy`                   | —                                                |
| Descriptive text for an instruction | explanation                      | "description", "summary"                         |
| Display data                        | view model                       | "render state"                                   |

Terms are checked by the documentation validation pass (Stage 0.3 validation; `/validate-docs`).

### 3.3 Files and Folders

- Each directory under `src/` exposes one public entry, `index.ts`. Other files in the directory are internal and are imported only inside it.
- Architecture packages follow the layout in CPU_ARCHITECTURE_STRATEGY §3. A file is created when the stage that needs it starts.
- No file is created speculatively. Empty directories keep a `.gitkeep`.
- Tests mirror `src/`: `tests/platform`, `tests/architectures/<id>`, `tests/assembler`, `tests/integration`, plus `tests/visualization` when it is first needed.
- Test helpers live in `tests/<area>/helpers/` and are never imported from `src/`.

---

## 4. Module Boundaries and Dependency Direction

### 4.1 Allowed Imports

Read as: the row may import the columns marked "yes".

| Module (directory)                 | `platform`                        | `architectures/<id>`      | `assembler` | `visualization` | `features`, `components`, `store` | React and DOM                    |
| ---------------------------------- | --------------------------------- | ------------------------- | ----------- | --------------- | --------------------------------- | -------------------------------- |
| `src/platform/`                    | —                                 | no                        | no          | no              | no                                | no                               |
| `src/architectures/<id>/`          | yes (types, helpers)              | —                         | no          | no              | no                                | no                               |
| `src/assembler/`                   | yes (types)                       | no                        | —           | no              | no                                | no                               |
| `src/visualization/`               | yes (types)                       | no                        | no          | —               | no                                | rendering only (Phase 4+)        |
| `src/store/`                       | yes (types, controller interface) | no                        | no          | no              | —                                 | no (hook wiring is in `src/app`) |
| `src/features/`, `src/components/` | yes (types, controller interface) | no                        | no          | yes             | yes                               | yes                              |
| `src/app/`                         | yes                               | yes (public entries only) | yes         | yes             | yes                               | startup only                     |

These rules are DEP-01 to DEP-07 in SYSTEM_ARCHITECTURE §6.

### 4.2 Forbidden Inside the Simulation Core

`src/platform/`, `src/architectures/`, `src/assembler/` must not reference, by import or by global name:

- React, `react-dom`, any UI, animation, styling or editor library;
- DOM and browser globals: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`;
- wall-clock and timing: `Date`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`;
- randomness: `Math.random`, `crypto.getRandomValues`.

### 4.3 Dependency Direction

- No circular imports between directories. Review rejects a cycle.
- No module imports from `src/app/` (the composition root is a leaf).
- A module imports another module only through its public entry (`index.ts`), except inside the same directory.

### 4.4 Enforcement

- **Phase 1 test (required):** a test scans imports and global references in the three simulation directories and fails on any item in 4.2 or any import not allowed by 4.1. It uses no new dependency.
- **Review:** the checklist in section 12 covers the same rules for changes outside the test's scope.
- **Lint:** a linter may replace the scan when DR-021 is approved.

---

## 5. Immutability and State Isolation

1. A value that crosses a module boundary is either read-only by type or frozen at runtime. Published snapshots, events, updates and history records are frozen with `Object.freeze`, including their arrays.
2. The platform never mutates an input it receives: architecture copies, program images and event arrays are read, not changed.
3. Architectures have no module-level mutable state. Each instance owns all of its state (MODULE_CONTRACTS §3.1).
4. `Uint8Array` values (memory) are copied on every boundary crossing. A caller that needs a value keeps the copy it received.
5. Functions that build or transform values are pure where the contract says so: `stampEvents`, `buildSnapshot`, `nextState`, `assemble`, and all view functions.
6. Stable references: the controller returns the same snapshot object until the state changes (DATA_CONTRACTS §9). Code that creates a new snapshot object without a state change is a defect.

---

## 6. Error Handling

The three error classes are defined in SIMULATION_PLATFORM §9. Code follows them as follows.

1. **Result error** for a caller mistake or an invalid request. The function returns `err(diagnostic)`. It never throws for these cases.
2. **Fault** for a simulated CPU condition. The architecture returns it in `StepOutcome.fault`. It is not thrown and is not a `Result` error.
3. **Exception** for a programmer error or a broken invariant. It is thrown inside the architecture or the platform. The controller catches it at its boundary and records `PLT-INTERNAL` (MODULE_CONTRACTS §2.4.5). Nothing else catches it.
4. A `catch` block must do one of: rethrow, return a `Result`, or record a diagnostic. An empty `catch` is rejected.
5. Every diagnostic code used in code is listed in DATA_CONTRACTS §11. A new code is added to that list in the same change.
6. Messages are written for a learner: they say what was wrong and where, in plain language. Tests assert on codes, not on message text.
7. The assembler never throws for user input (MODULE_CONTRACTS §4.1). A failed assembly returns diagnostics with spans.

---

## 7. Determinism

1. No timers, clock reads or randomness in the simulation core (section 4.2).
2. Iteration order is defined. Output is never built from iterating an unordered `Map` or `Set` built from input. Sort first.
3. The same sequence of calls must produce the same results. A test proves this (TEST_STRATEGY §4).
4. Batch sizes are counts (`maxCycles`), never durations.

---

## 8. Documentation in Code

1. Each exported contract type or function has a one-line doc comment. The comment states what it is for, not how it works.
2. Comments explain why, not what. A comment that repeats the code is removed.
3. Code that implements a specific rule cites the document and section, for example `// SIMULATION_PLATFORM §2.2`.
4. A `TODO` names its owner: a register ID or a stage, for example `// TODO(DR-011): cycle count`. A `TODO` without one is rejected.
5. A behaviour change that alters a contract is made in the contract document in the same change. The register is updated if a decision changed.

---

## 9. Dependencies

1. A new package requires a row in TECHNOLOGY_STACK §4.2 that states its role, phase and reason, in the same change.
2. Approved for v1.0 is the list in TECHNOLOGY_STACK §4.2. Packages marked **Deferred** or **Not adopted** are not added without a register decision.
3. The simulation core uses no UI, animation, styling or editor library, and no state-management library (DR-054).
4. Do not add a package for one small function.

---

## 10. Formatting and Style

1. `pnpm format` before any commit. `pnpm format:check` must pass.
2. LF line endings. Two-space indentation. Final newline.
3. Lines are at most 100 characters where Prettier wraps them. Tables in Markdown are formatted by Prettier.
4. Imports are grouped: external packages, then `src/` public entries, then relative files.

---

## 11. Application and UI Code (Phase 4 onward)

1. Components are function components with explicit prop types.
2. Components read state through `ControllerStore` (MODULE_CONTRACTS §1.4) and send intents to the controller. They never call an architecture instance or mutate a snapshot.
3. Animation timing belongs to the visualization layer and never changes results (DR-032).
4. The workbench works at 1280 px width and above without horizontal scrolling (DR-040).
5. Every interactive control has an accessible name. Colour is never the only indicator of state.
6. Persistence (editor text) goes through `EditorPersistence` (MODULE_CONTRACTS §1.3). Components never call browser storage directly.

---

## 12. Review Checklist

A change is ready for review when every item is true, or the exception is recorded in the change description.

- [ ] Types match the contracts in `docs/contracts/`, and no contract changed without its document being updated.
- [ ] No `any`, no undocumented `!`, no `@ts-ignore`, no enums, no default exports in `src/`.
- [ ] No forbidden import or global in the simulation core (section 4.2).
- [ ] No cycle counter is kept outside the platform. No architecture reports a cycle number.
- [ ] Published values are frozen or readonly. No input is mutated.
- [ ] Errors follow the three classes (section 6). Every new diagnostic code is in DATA_CONTRACTS §11.
- [ ] Deterministic: no time, randomness or unordered output.
- [ ] Terms match section 3.2.
- [ ] Tests exist for each acceptance criterion (TEST_STRATEGY), and `pnpm test` passes.
- [ ] `pnpm typecheck` and `pnpm format:check` pass.
- [ ] Docs changed where behaviour or a contract changed.
