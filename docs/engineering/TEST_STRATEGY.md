# BITSHIFT — Test Strategy

**Status:** Stage 0.3. Vitest is installed and `pnpm test` runs two tooling tests: an application shell smoke test and the lint boundary-rule tests. No simulator tests exist yet. End-to-end tooling is open (DR-068), and component-test tooling is open (DR-038).
**Related:** [CODING_STANDARDS.md](CODING_STANDARDS.md), [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md)

---

## 1. Principles

1. **The simulation is the product's correctness.** Each contract rule and each flag rule has a test that fails if the rule changes.
2. **Test contracts, not internals.** Tests use public entries and typed values (snapshots, events, results). An internal refactor must not break them.
3. **Expected values come from the specification, never from the implementation's output.** A test that copies a value the code printed is not a test.
4. **Determinism is tested.** Same inputs, same snapshots, events and history, every time.
5. **Test names state the rule.** For example `stepClock: a fault outcome does not advance the cycle counter`.
6. **Fast and isolated.** Unit and contract tests run in milliseconds and need no browser, no DOM and no network.

---

## 2. Test Levels

| Level           | Scope                                              | Location                    | Environment                            | Deterministic?           | Required for                                                                                                                                    |
| --------------- | -------------------------------------------------- | --------------------------- | -------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**        | One function or small module                       | `tests/<area>/`             | Node                                   | Yes                      | Pure functions: `nextState`, `stampEvents`, `buildSnapshot`, `createBreakpointSet`, `createExecutionHistory`, `assemble` stages, view functions |
| **Contract**    | A module against its contract in `docs/contracts/` | `tests/platform/`           | Node, with the fixture architecture    | Yes                      | Controller, registry, history, breakpoints, event system, snapshot management                                                                   |
| **Conformance** | An architecture against its specification          | `tests/architectures/<id>/` | Node                                   | Yes                      | Every instruction, flag rule, boundary and fault. Phase 2.                                                                                      |
| **Assembler**   | Source text to program image, and diagnostics      | `tests/assembler/`          | Node                                   | Yes                      | Golden output, diagnostic codes and spans. Phase 3.                                                                                             |
| **Integration** | Several modules together, without a browser        | `tests/integration/`        | Node                                   | Yes                      | Assemble → load → run → inspect; failed assembly leaves the controller unchanged                                                                |
| **Component**   | React components with a store fixture              | Phase 5                     | DOM environment (tooling open, DR-038) | Yes                      | Panels show what the snapshot says                                                                                                              |
| **End-to-end**  | The built application in a browser                 | Phase 6                     | Browser (tooling open, DR-068)         | Yes, with fixed programs | Journey steps 1–10 in PRODUCT_SPEC §5                                                                                                           |
| **Manual**      | Layout, animation feel, accessibility              | Checklist per release       | Human                                  | No                       | Readability at normal speed; keyboard operation; contrast (DR-049)                                                                              |

Rules:

- A test for platform, architecture, assembler or visualization logic runs in the Node environment. A DOM environment is not used for these.
- Only component and end-to-end tests may depend on rendering.
- Every test in the first four rows is deterministic. A flaky test is a defect, and it is fixed or removed, never retried until it passes.

---

## 3. Test Layout

```
tests/
├── platform/              # Contract tests: controller, registry, lifecycle, events, snapshots, history, breakpoints
│   └── fixtures/          # Test-only architecture (section 4). Never imported from src/.
├── architectures/
│   └── bitshift-8/        # Conformance suite (Phase 2)
├── assembler/             # Assembler stages, golden files, diagnostics (Phase 3)
├── integration/           # Assemble → load → run → inspect (Phase 3 onward; grows in Phase 6)
├── visualization/         # View functions and adapter transforms (first needed in Phase 4)
├── app/                   # Application shell smoke test (server-side render, no DOM environment)
└── tooling/               # Lint boundary-rule tests
```

- File names: `<subject>.test.ts`.
- Golden files live beside their test in `tests/assembler/golden/`.
- Helpers live in `tests/<area>/helpers/` and are imported only by tests.

---

## 4. The Test-Only Fixture Architecture

The platform must work for an architecture that is not BITSHIFT-8. The fixture is built in Phase 1 in `tests/platform/fixtures/`.

It deliberately differs from BITSHIFT-8:

- two registers of different widths (for example 4 bits and 16 bits), with one of them named as `'program-counter'`;
- two flags;
- a memory of a different size;
- a fixed, short script of cycles that emits every shared event kind;
- one deliberately faulting opcode in the script, and one step that throws, selected by a test-only input.

It is never shipped, never imported from `src/`, and never described as a CPU. It is used by every platform contract test. Its expected values come from its script, written by hand.

---

## 5. Required Test Catalogue

Each item has a stable ID so that the Definition of Done can refer to it. An item is satisfied by at least one named test.

### 5.1 Snapshot Isolation (SNP)

| ID     | Test                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| SNP-01 | After a snapshot is taken, stepping the instance does not change the earlier snapshot's registers, flags, memory or program counter.      |
| SNP-02 | Mutating the memory array returned by `readMemory`, or by a snapshot, does not change the instance or later reads.                        |
| SNP-03 | Snapshot objects, their arrays and published events are frozen: an attempt to assign a field throws in strict mode.                       |
| SNP-04 | `controller.snapshot()` returns the same object for repeated calls with no state change, and a new object after a change.                 |
| SNP-05 | The architecture's `readState()` shares no array or buffer with the instance: changing its result does not change the next `readState()`. |

### 5.2 Determinism (DET)

| ID     | Test                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DET-01 | Two fresh controllers, given the same program and the same call sequence, produce identical snapshot, event and history sequences (deep equality, every step).                             |
| DET-02 | Running a program with `runBatch(1)`, `runBatch(7)` and `runBatch(1000)` reaches the same final snapshot, the same cycle count and the same events.                                        |
| DET-03 | No platform or architecture module references the forbidden globals in CODING_STANDARDS §4.2 (enforced by `pnpm lint`; the rules are verified by `tests/tooling/lint-boundaries.test.ts`). |

### 5.3 Event Ordering and Replay (EVT)

| ID     | Test                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EVT-01 | Within an update, events are ordered by `(cycle, sequence)`. Cycles never decrease across updates.                                                                                 |
| EVT-02 | `stampEvents` assigns `cycle = cycleBefore + cycleOffset`, and `sequence` counts up within each cycle, in emission order.                                                          |
| EVT-03 | The replay invariant (EVENT_MODEL §5.2) holds for every cycle of the fixture script: applying each cycle's state-changing events to the previous replayable state yields the next. |
| EVT-04 | The same replay check passes for every BITSHIFT-8 instruction, on every cycle (conformance suite, Phase 2).                                                                        |
| EVT-05 | An event with an unknown namespaced kind is forwarded unchanged, and does not change replayable state.                                                                             |
| EVT-06 | An event whose namespace does not match the architecture is rejected with `PLT-EVENT-NAMESPACE`, and the controller reports an internal fault.                                     |
| EVT-07 | Informational events (for example `micro-operation`, `bus-transfer`) do not change replayable state, and the replay check still passes.                                            |

### 5.4 Cycle Counting (CYC, DR-067)

| ID     | Test                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CYC-01 | The counter is 0 after `reset` and after a successful `load`.                                                                                                                   |
| CYC-02 | After one `stepClock` that completes one cycle, the counter is 1, and the snapshot and events report cycle 1.                                                                   |
| CYC-03 | `stepInstruction` over an N-cycle instruction increases the counter by exactly N.                                                                                               |
| CYC-04 | A `Result` error from `stepClock` (for example while running) leaves the counter, the snapshot and the history unchanged. The architecture is not called (verified with a spy). |
| CYC-05 | A step whose outcome is a fault leaves the counter unchanged, emits exactly one platform `fault` event, and sets `state` to `faulted`.                                          |
| CYC-06 | An architecture that throws leaves the counter unchanged, sets `PLT-INTERNAL` as `lastFault`, and the next `reset` replaces the instance.                                       |
| CYC-07 | A halt reached during a step does not add a cycle beyond the `cyclesCompleted` reported. Halt, fault and breakpoint never change the counter.                                   |
| CYC-08 | `runBatch(n)` never runs more than `n` cycles, and stops early at a halt, fault or breakpoint with the correct reason.                                                          |
| CYC-09 | No `StepOutcome` produced by the architecture contains a cycle number. (Type test and a runtime check on the fixture.)                                                          |

### 5.5 Breakpoints (BRK)

| ID     | Test                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| BRK-01 | `runBatch` stops at a breakpoint address after an instruction boundary and reports `breakpointHit` with that address.                              |
| BRK-02 | `stepClock` and `stepInstruction` do not stop at a breakpoint. If the resulting program counter is in the set, the update reports `breakpointHit`. |
| BRK-03 | A breakpoint outside `[0, 2^addressBits)` is rejected with `PLT-BREAKPOINT-RANGE`, and the previous set is unchanged.                              |
| BRK-04 | `setBreakpoints` replaces the set. It does not add to it.                                                                                          |
| BRK-05 | Breakpoints persist across `load` and `reset`.                                                                                                     |
| BRK-06 | The architecture never receives breakpoint data (verified with the fixture: its inputs contain no breakpoint field).                               |

### 5.6 History Limits (HST, DR-056)

| ID     | Test                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HST-01 | Appending beyond the limit evicts the oldest record; the length never exceeds the limit.                                                                   |
| HST-02 | `truncated` becomes true on the first eviction and stays true until `clear`.                                                                               |
| HST-03 | `createExecutionHistory` rejects a limit that is not a positive integer (`PLT-ARGUMENT`).                                                                  |
| HST-04 | Eviction, `clear` and `reset` do not change the current snapshot or events already delivered.                                                              |
| HST-05 | `history()` returns the same frozen array until the history changes.                                                                                       |
| HST-06 | The limit given to `createController` is the limit enforced (configurable, not a constant).                                                                |
| HST-07 | Records are frozen. A `changes` entry matches the `register-write`, `flag-update`, `memory-write` or `output-emitted` events of its instruction, in order. |

### 5.7 Error Handling (ERR)

| ID     | Test                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERR-01 | Each `PLT-` code in DATA_CONTRACTS §11 is returned by at least one test that triggers it.                                                                                           |
| ERR-02 | Every `Result` error leaves the snapshot, history, breakpoints and counter unchanged.                                                                                               |
| ERR-03 | `beginRun` while running returns `PLT-ALREADY-RUNNING`; `runBatch` while paused returns `PLT-NOT-RUNNING`; a step while running returns `PLT-RUNNING`.                              |
| ERR-04 | A step with no program loaded returns `PLT-NO-PROGRAM`; `reset` succeeds in that state.                                                                                             |
| ERR-05 | A `load` with a mismatched `architectureId` returns `PLT-ARCHITECTURE-MISMATCH`.                                                                                                    |
| ERR-06 | A `readMemory` range outside memory returns `PLT-MEMORY-RANGE` and the architecture is not called.                                                                                  |
| ERR-07 | A step in `halted` or `faulted` returns `Ok` with zero cycles and no state change.                                                                                                  |
| ERR-08 | Registry validation: duplicate identifiers give `ARCH-DUPLICATE-ID`; an invalid descriptor gives `ARCH-INVALID-DESCRIPTOR`, with each validation rule (DATA_CONTRACTS §3.2) tested. |

### 5.8 Lifecycle (LCY)

| ID     | Test                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| LCY-01 | `nextState` is tested for every row of the transition table in SIMULATION_PLATFORM §3.1, and rejects every forbidden transition. |
| LCY-02 | Pause and resume continue from the same state: a run paused and resumed reaches the same final snapshot as an uninterrupted run. |

### 5.9 Store and Persistence (STR, PER)

| ID     | Test                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| STR-01 | `ControllerStore.getSnapshot()` returns the same reference until the controller state changes (Node test; no React needed).                  |
| STR-02 | Each controller update notifies the store's subscribers exactly once.                                                                        |
| PER-01 | When storage throws, `EditorPersistence.load` and `save` return `APP-PERSISTENCE-UNAVAILABLE`, and the controller's behaviour is unaffected. |

### 5.10 Assembler and Integration (ASM, INT)

| ID     | Test                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ASM-01 | Each instruction in the ISA assembles to its specified bytes (golden tests, Phase 3).                                                     |
| ASM-02 | Every error produces a diagnostic with a code and a span on the offending line.                                                           |
| ASM-03 | `assemble` is pure: the same input gives the same output, and the input is not modified.                                                  |
| INT-01 | A failed assembly leaves the controller's snapshot, history and breakpoints unchanged.                                                    |
| INT-02 | An example program, assembled and loaded, reaches its documented final state (Phase 6 examples; the example test is the acceptance test). |
| INT-03 | The program image's `architectureId` equals the ISA's identifier (single source of truth, DATA_CONTRACTS §3.1).                           |

### 5.11 Visualization Transforms (VIS)

| ID     | Test                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| VIS-01 | Each view function is pure: given the same inputs it returns equal outputs, and the inputs are not modified. |
| VIS-02 | A register is marked `changed` only when a `register-write` for it occurs in the given cycles.               |
| VIS-03 | Memory highlights come only from `memory-read` and `memory-write` events.                                    |
| VIS-04 | Control-signal names come only from `micro-operation` events, in emission order.                             |
| VIS-05 | Unknown event kinds are ignored and never cause an error.                                                    |
| VIS-06 | A view function never returns a value that is not derivable from its inputs (no invented state).             |

### 5.12 Conformance Suite (CNF, Phase 2)

| ID     | Test                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CNF-01 | Every approved instruction behaves as the ISA specification states, for each documented flag effect, with boundary values (0, 1, 127, 128, 255). |
| CNF-02 | Program-counter wrap behaves as specified (DR-004).                                                                                              |
| CNF-03 | Every unallocated opcode produces the approved fault (DR-016, DR-017).                                                                           |
| CNF-04 | Expected values are written from the specification, cite the section, and are checked by hand.                                                   |

---

## 6. Snapshot Isolation and Event Invariant Tests in Detail

These tests are the most important in the platform. They run on the fixture in Phase 1, and on every architecture afterwards.

- **Isolation (SNP-01 to SNP-05):** take a snapshot, mutate or step, and compare with a deep copy taken before the mutation.
- **Replay (EVT-03):** after every cycle, apply the cycle's state-changing events to the previous replayable state and compare with the next snapshot's replayable fields. The comparison covers registers, flags, memory and the output register, and the program counter when the architecture declares a `'program-counter'` role.
- **Fault and exception paths (CYC-05, CYC-06):** the fixture's test-only inputs cause each path, and the test checks the counter, the state and the single `fault` event.

---

## 7. Deterministic Execution and Batching

- Two independent controllers over the same architecture receive the same calls and must produce identical sequences (DET-01).
- The batch size does not change the result (DET-02). Batch sizes used in tests include 1 (single steps), a prime number, and a number larger than the program.
- Tests never sleep, never read the clock to decide expected values, and never depend on the order of asynchronous callbacks. The controller is synchronous, so the tests need no awaits.

---

## 8. Visualization Transformation Tests

- View functions are tested with plain objects, with no React and no DOM (VIS-01 to VIS-06).
- The rendering layer is tested separately, in component tests (Phase 5), and checks only that it displays what the view model says.
- A visual check (for example that an animation reads well) is a manual item, never an automated assertion about pixels.

---

## 9. End-to-End Tests

- End-to-end tests run the built application in a browser against the journey steps in PRODUCT_SPEC §5.
- The tool is not chosen (DR-068). The decision is taken in Phase 6. Until then, no end-to-end test is written, and Phase 5 exit criteria are checked by the integration tests and manual checks.
- End-to-end tests use fixed example programs and check the final visible state. They do not check animation timing.

---

## 10. Coverage

- No numeric coverage target is set in Stage 0.3. DR-037 proposes 90% line coverage in `src/platform` and `src/architectures`, to be decided at the Phase 1 review.
- Regardless of the coverage number, every public function in the simulation core has at least one test that names its contract (`ERR`, `CYC`, `EVT` and the other IDs above).

---

## 11. Commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `pnpm test`         | Run all tests once (`vitest run`). An empty suite fails. |
| `pnpm typecheck`    | Type-check the project (`tsc --noEmit`).                 |
| `pnpm lint`         | Run ESLint, including the module-boundary rules.         |
| `pnpm format:check` | Verify formatting.                                       |
| `pnpm build`        | Type-check and produce the static build.                 |

Watch mode (`vitest`) is for development only and is not used in review.

---

## 12. Failing and Skipped Tests

- A failing test is not deleted or weakened to make a change pass. Either the code or the specification is wrong, and the expectation changes only when the specification changes.
- A skipped test (`it.skip`, `describe.skip`) must name a register ID in its title, for example `DR-011`, and is listed in the implementation report.
- A test that depends on timing, network or randomness is a defect and is rewritten.
