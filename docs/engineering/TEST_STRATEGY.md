# BITSHIFT — Test Strategy

**Status:** Proposed (B). Vitest is installed and `pnpm test` runs. No product tests exist in Phase 0.

---

## 1. Philosophy

1. **The simulator is the product's correctness.** Every instruction and flag rule has a test that would fail if the behaviour changed.
2. **Test contracts, not internals.** Tests use public module entry points and typed snapshots, so internal refactors do not break them.
3. **Determinism is tested.** The same input must produce the same snapshots and events on every run.
4. **Tests are specifications.** Test names state the behaviour in the spec's words, for example `ADD B sets carry when the sum exceeds 255`.
5. **Small and fast.** Unit tests run in milliseconds. The full suite should stay well under a minute.

## 2. Test Layout

Mirrors `src/`:

```
tests/
├── platform/          # Controller, registry, lifecycle, event batching, history (uses a test-only fixture architecture)
├── architectures/     # Per-architecture conformance suites
│   └── bitshift-8/    # ALU, flags, decoding, instructions, example programs (Phase 2)
├── assembler/         # Lexer, parser, label resolution, encoding, diagnostics (Phase 3)
└── integration/       # Assemble → load → run → inspect end-to-end (Phase 6, starts earlier for smoke tests)
```

File naming: `<subject>.test.ts`. Test-only helpers go in `tests/<area>/helpers/` and are never imported by `src/`.

## 3. Test Levels

| Level                | Scope                                              | Where                                     | Tools                       | Example                                                      |
| -------------------- | -------------------------------------------------- | ----------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| Unit                 | One function or module                             | `tests/<area>/`                           | Vitest                      | ALU result and flags for each operation                      |
| Contract             | A module against its contract in `docs/contracts/` | `tests/platform/`, `tests/architectures/` | Vitest                      | Snapshot is a copy; `loadProgram` rejects oversize images    |
| Conformance          | Architecture against its spec                      | `tests/architectures/<id>/`               | Vitest                      | Each instruction table row behaves as documented             |
| Assembler            | Source text to program image                       | `tests/assembler/`                        | Vitest                      | Golden tests: source produces expected bytes and diagnostics |
| Integration          | Assembler through controller                       | `tests/integration/`                      | Vitest                      | Example program produces expected output                     |
| Component            | React component with store fixture                 | Phase 5                                   | Decided in Phase 5 (DR-038) | Register panel shows values                                  |
| Manual / exploratory | Browser behaviour, layout, animation               | Checklist per release                     | Human                       | Animation readable at normal speed                           |

## 4. Test-Only Fixture Architecture (Phase 1)

To prove the platform does not depend on BITSHIFT-8, Phase 1 includes a fixture architecture in `tests/platform/fixtures/`:

- Two registers of different widths and one flag, deliberately unlike BITSHIFT-8.
- A tiny deterministic script of micro-operations.
- Never imported by `src/`, never shipped, never called a CPU in documentation.

## 5. Conformance Testing for BITSHIFT-8 (Phase 2)

- Every row of the approved instruction table has at least one test per documented flag effect.
- Every flag rule in the approved ISA has a boundary test (0, 1, 127, 128, 255 and wrap cases).
- Program counter wrap has its own tests.
- Undefined opcodes are tested for the approved fault behaviour.
- Tests cite the spec section they verify.

Tests must not be written from the implementation's output. Expected values come from the spec, and are checked by hand for each new case.

## 6. Determinism Tests

- Run the same program twice with fresh instances; compare full snapshot and event sequences for equality.
- Run with different batch sizes in the controller; final state must match.
- Snapshot taken, then CPU stepped: the earlier snapshot must not change.

## 7. Assembler Tests

- Golden tests: a file of source → expected bytes and source map.
- Error tests: each diagnostic code has a test with an expected span.
- Round trip where possible: assemble, then decode, then compare mnemonics.

## 8. Example Programs

Every bundled example (Phase 6) has:

- A test that assembles, runs to HLT and checks final registers, memory and output.
- A comment in the source explaining the expected result.

## 9. Coverage

- No numeric coverage target in Phase 0 (DR-037 proposes a target for Phase 1 review).
- Simulation core (`src/platform`, `src/architectures`, `src/assembler`) must have a test for every public function.

## 10. Commands

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `pnpm test`         | Run all tests once (`vitest run --passWithNoTests`) |
| `pnpm typecheck`    | Type-check the project                              |
| `pnpm format:check` | Verify formatting                                   |
| `pnpm build`        | Type-check and produce the production build         |

Watch mode (`vitest`) is available for development but not used in CI.

## 11. Failing Tests

- A failing test is not deleted to make a build pass. Either the code or the expectation is wrong, and the expectation is only changed when the spec changes.
- Skipped tests (`it.skip`) require a decision register ID in their name.
