| 1.4-e | Done | APPROVED | 2026-11-17 | As 1.4-a. |

**Status:** Revised 2026-11-17. **Phase 1 is complete in the repository: all 17 slices are approved.** It awaits product-owner acceptance. The exit record, measurements and remaining technical debt are in Appendix A. Phase 2 has not started.
**Related:** [PHASE_1_READINESS_REVIEW.md](PHASE_1_READINESS_REVIEW.md) (analysis behind this plan), [BITSHIFT_SUPERVISOR.md](BITSHIFT_SUPERVISOR.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [TEST_STRATEGY.md](TEST_STRATEGY.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

This plan cuts Phase 1 into 17 slices. It does not restate the contracts. Each slice names the contract sections that govern it.

---

## 1. Overview

**Objective.** Build the architecture-independent platform in `src/platform/`: registry, lifecycle, snapshots, events, history, breakpoints and the execution controller. Prove it with a test-only fixture architecture. No real CPU, no assembler, no UI.

**Touches only:** `src/platform/`, `tests/platform/`, one lint rule in the last slice, and the contract sentences that approved decisions amend. Nothing in `src/app/`, `src/architectures/`, `src/assembler/`, `src/store/` or the UI directories.

**Entry conditions.**

1. Stage 0.4 accepted, including the product owner's Dev Container check on the host. Stage 0.4 is committed (c977c66). The host check is the product owner's to confirm.
2. For each slice, the decisions in section 2 that gate it are approved.

**Exit conditions.** The roadmap's Phase 1 exit criteria, DEFINITION_OF_DONE §7, and every Phase 1 item of the TEST_STRATEGY §5 catalogue (SNP, DET, EVT except EVT-04, CYC, BRK, HST, ERR, LCY) passing against the fixture.

**Completion evidence for every slice.** The implementation report in DEFINITION_OF_DONE §6; each acceptance criterion mapped to a named test; the actual results of `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` and `pnpm build`; a diff that touches only the slice's files. The supervisor re-runs the commands and reads the diff before giving a verdict.

---

## 2. Decisions and Contract Amendments

### 2.1 Decisions (all recorded in the register)

| ID       | Decision                                                                                                                                                                                                                                                                                        | Slices it governs                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| DR-039   | The installed stack is approved. Nothing further is introduced.                                                                                                                                                                                                                                 | All                                                 |
| DR-073   | Five stages, as in section 3. Slice order may be adjusted for fixture and testing dependencies.                                                                                                                                                                                                 | All                                                 |
| DR-074   | Cycle-atomic commit. The platform composes instruction steps and batches from `stepClock()`. `CpuInstance.stepInstruction()` is removed. No instruction-level rollback.                                                                                                                         | 1.2-b, 1.5-a, 1.4-b, 1.4-c                          |
| DR-075   | The platform `fault` event takes the next free sequence in its cycle.                                                                                                                                                                                                                           | 1.4-c                                               |
| DR-076   | A breakpoint stop moves the controller from `running` to `paused`. It is never a fault.                                                                                                                                                                                                         | 1.4-e                                               |
| DR-027   | Breakpoints are checked at instruction boundaries during a run only. A step reports `breakpointHit` only when it completed at least one cycle, ended on an instruction boundary, and the program counter is in the set.                                                                         | 1.4-e                                               |
| DR-077 a | `load` and `reset` are always allowed with no program. `stepClock`, `stepInstruction` and `beginRun` return `PLT-NO-PROGRAM`. `runBatch` and `endRun` return `PLT-NOT-RUNNING`.                                                                                                                 | 1.4-a, 1.4-b, 1.4-d                                 |
| DR-077 b | The `nextState` table in section 7.                                                                                                                                                                                                                                                             | 1.2-a                                               |
| DR-077 c | Update reason: `fault`, else `halt`, else `breakpoint` (batches only), else the request's own reason.                                                                                                                                                                                           | 1.4-a to 1.4-e                                      |
| DR-077 d | Any architecture exception gives `PLT-INTERNAL` and an `Ok` result with a `fault` update. `reset` and `load` both replace an unreliable instance. If replacement also throws, the controller stays `faulted`.                                                                                   | 1.2-b, 1.4-a, 1.4-c                                 |
| DR-077 e | `runBatch(maxCycles)` needs a positive integer, else `PLT-ARGUMENT`. The argument is checked before the lifecycle state.                                                                                                                                                                        | 1.4-d                                               |
| DR-077 f | `StateChange.target` for memory is `memory[<decimal address>]`, no padding.                                                                                                                                                                                                                     | 1.3-c                                               |
| DR-077 g | The platform never sets `InstructionRecord.explanation` and never calls `explainInstruction`.                                                                                                                                                                                                   | 1.3-c, 1.4-b                                        |
| DR-077 h | Listeners are called in subscription order after the state is committed. A listener exception is not caught, reaches the caller, and never faults the CPU. A state-changing controller call made from inside a notification throws.                                                             | 1.4-a                                               |
| DR-078 b | At most one register with role `'output'` and at most one with role `'program-counter'`, else `ARCH-INVALID-DESCRIPTOR`.                                                                                                                                                                        | 1.1-c, 1.4-b                                        |
| DR-079   | Confirmed readings: every `RegisterDefinition.bits` is a positive integer (registry check); an empty registry is valid; payloads are frozen in place; `BreakpointSet` does not validate the address width.                                                                                      | 1.1-c (first item); the rest already match the code |
| DR-080   | The platform does not log. The listener list is copied per notification; a throwing listener stops the notification and its exception reaches the caller; additions and removals apply from the next notification. No bound on instruction steps in Phase 1. Register width has no upper bound. | 1.4-a to 1.4-e                                      |

**Deferred, not in Phase 1:** DR-078 a (`breakpoints()` accessor, Phase 5). DR-078 c (typing of `details`, Phase 2, in the `unknown` form). **Open, gating nothing in Phase 1:** DR-022, DR-024.

### 2.2 Contract amendments owed

Each amendment is written by the slice that implements it, in the same change as the code (CLAUDE.md §6). The lead implementation agent writes contract text; sub-agents do not. Exact wording: PHASE_1_READINESS_REVIEW §1, §2.6, §3 and §4, and the register rows.

**Done in Batch 3:** every row of the table below. **Done in Batch 2:** DR-074 (instance and architecture documents, TEST_STRATEGY), DR-077 b, f, g, DR-078 b, DR-079 item 1 and the empty-registry line. **Done by the supervisor on 2026-11-17 (decisions with no implementing slice):** DR-080 items 1, 3 and 4.

| Decision                | Document and section                                                                    | Slice |
| ----------------------- | --------------------------------------------------------------------------------------- | ----- |
| DR-077 a, c             | MODULE_CONTRACTS §2.4.2. SIMULATION_PLATFORM §3.2. DATA_CONTRACTS §7.                   | 1.4-a |
| DR-077 h, DR-080 item 2 | MODULE_CONTRACTS §2.4.6                                                                 | 1.4-a |
| DR-075                  | EVENT_MODEL §2 fault paragraph                                                          | 1.4-a |
| DR-074                  | MODULE_CONTRACTS §2.4.1 (`stepInstruction` row) and §2.4.3                              | 1.4-b |
| DR-077 d, DR-074        | MODULE_CONTRACTS §2.4.5 (recovery; earlier cycles stay counted)                         | 1.4-c |
| DR-077 e                | MODULE_CONTRACTS §2.4 (`runBatch` comment and §2.4.1 row)                               | 1.4-d |
| DR-076, DR-027          | SIMULATION_PLATFORM §3.1 and §6. MODULE_CONTRACTS §2.4.1 and §2.4.4.                    | 1.4-e |
| DR-079                  | EVENT_MODEL §7 (payloads frozen in place). MODULE_CONTRACTS §2.8 (width not validated). | 1.4-e |

Until a row is done, the contract and the register disagree on that point, and **the register wins**.

---

## 3. Stage Structure (DR-073, approved)

| Stage                                   | Content                                                                    | Slices         |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| 1.1 Architecture Registry               | Shared primitives and contract types; registry and descriptor validation   | 1.1-a to 1.1-c |
| 1.2 CPU Lifecycle & Instance Management | Lifecycle transition function; the instance guard (exception boundary)     | 1.2-a, 1.2-b   |
| 1.3 State & Event System                | Snapshots, event stamping, history and instruction records, breakpoint set | 1.3-a to 1.3-d |
| 1.4 Execution Controller                | The controller, one behaviour per slice                                    | 1.4-a to 1.4-e |
| 1.5 Mock CPU & Verification             | The fixture architecture, the invariant suite, measurement and phase exit  | 1.5-a to 1.5-c |

One ordering adjustment, as DR-073 permits: slice **1.5-a (the fixture)** belongs to Stage 1.5 but is implemented **before Stage 1.4**, because the controller cannot be tested without it. The rest of Stage 1.5 follows Stage 1.4.

---

## 4. Module Map

One flat directory, one public entry. No sub-packages, no classes where a function and a closure do.

```
src/platform/
  index.ts            public entry: types, ok/err, createArchitectureRegistry, createController
  result.ts           Result, Diagnostic, SourceSpan, ok, err
  types.ts            shared contract types (data, events, architecture-facing interfaces)
  memory-range.ts     validateMemoryRange
  registry.ts         createArchitectureRegistry, descriptor validation
  lifecycle.ts        nextState
  instance-guard.ts   exception boundary around one CpuInstance; StepOutcome validation
  snapshots.ts        buildSnapshot, freezing helper
  events.ts           stampEvents
  history.ts          createExecutionHistory, instruction recorder
  breakpoints.ts      createBreakpointSet
  controller.ts       createController

tests/platform/
  <module>.test.ts    one file per module; controller tests are one file per slice
  helpers/            test descriptors, replay helper
  fixtures/           the test-only fixture architecture
```

Dependency direction inside the platform: `result` and `types` are leaves. `memory-range`, `registry`, `lifecycle`, `instance-guard`, `snapshots`, `events`, `history` and `breakpoints` depend only on them and not on each other. `controller` depends on all of them. Nothing imports `controller` except `index`. There is no cycle to manage.

Unit tests may import a platform module file directly. Code outside `src/platform` imports only `index.ts`.

---

## 5. Stages and Slices

Every slice also meets DEFINITION_OF_DONE §2 and §3. Catalogue IDs refer to TEST_STRATEGY §5. "Needs" lists earlier slices and the decisions (section 2.1, all approved) that govern the slice. Each slice gets its own self-contained prompt, written by the supervisor when the slice before it is approved. The prompt for 1.1-a is Appendix A.

### Stage 1.1 — Architecture Registry

**Purpose.** Give the platform its vocabulary and its first module.

| Slice | Builds                                                                       | Needs                   | Contract                                                          | Acceptance criteria                                                                                                                                                                                                                                                                                                                                 | Catalogue                                       |
| ----- | ---------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1.1-a | `result.ts`, `types.ts`, `memory-range.ts`, `index.ts`                       | —                       | DATA_CONTRACTS §2–§10; EVENT_MODEL §3.2, §10; MODULE_CONTRACTS §3 | Appendix A.                                                                                                                                                                                                                                                                                                                                         | CYC-09 (type part); ERR-01 (`PLT-MEMORY-RANGE`) |
| 1.1-b | `registry.ts`: `createArchitectureRegistry`, `lookup`, descriptor validation | 1.1-a                   | MODULE_CONTRACTS §2.1; DATA_CONTRACTS §3.1, §3.2                  | Each validation rule in DATA_CONTRACTS §3.2 rejects with `ARCH-INVALID-DESCRIPTOR`, one test per rule. Duplicate identifiers give `ARCH-DUPLICATE-ID`. Unknown lookup gives `ARCH-UNKNOWN-ID`. `architectures` keeps registration order and is frozen. The input list is not mutated. Two valid entries each resolve by their `isa.architectureId`. | ERR-08; ERR-01 (`ARCH-` codes)                  |
| 1.1-c | `registry.ts`: two more validation rules                                     | 1.1-b; DR-078 b; DR-079 | DATA_CONTRACTS §3.2 as amended                                    | A register whose `bits` is not a positive integer is rejected. More than one register with role `'output'`, or more than one with role `'program-counter'`, is rejected. One of each is accepted, and none of either is accepted. All with `ARCH-INVALID-DESCRIPTOR`. Existing registry tests still pass.                                           | ERR-08                                          |

**Notes.** The types are transcribed, not designed; the reviewer compares `types.ts` with the contract field by field. Registry tests need descriptors but no working CPU: a stub `createInstance` that throws is enough, kept in `tests/platform/helpers/`.

### Stage 1.2 — CPU Lifecycle & Instance Management

**Purpose.** The state machine, and the one place where architecture code is called and its failures are contained.

| Slice | Builds                                                                                                                                                                                                                                                                                        | Needs                   | Contract                                                               | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                           | Catalogue                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1.2-a | `lifecycle.ts`: `nextState`                                                                                                                                                                                                                                                                   | 1.1-a; DR-077 b         | MODULE_CONTRACTS §2.2; SIMULATION_PLATFORM §3; section 7 here          | All 40 cells of the table in section 7 are tested from a table written in the test. Pure: no state between calls.                                                                                                                                                                                                                                                                                                                             | LCY-01; ERR-03 (function level) |
| 1.2-b | `instance-guard.ts`: creates the instance through `createInstance()`; wraps `loadProgram`, `reset`, `stepClock`, `readState`; turns a thrown exception into a `PLT-INTERNAL` diagnostic; validates each `StepOutcome`; replaces the instance and reloads the last accepted program on request | 1.1-a; DR-074; DR-077 d | MODULE_CONTRACTS §2.3, §2.4.5, §3.2; DATA_CONTRACTS §5; DR-070; DR-071 | A throwing stub yields `PLT-INTERNAL` and marks the guard unreliable. An outcome that breaks DATA_CONTRACTS §5 (a fault with cycles or events; negative or fractional cycles; more than one cycle from `stepClock`; a `cycleOffset` outside 1 to `cyclesCompleted`) yields `PLT-INTERNAL`. Replacement calls `createInstance()` again and reloads the last accepted image. A rejected `loadProgram` leaves the last accepted image unchanged. | CYC-06 (guard level)            |

**Notes.** The guard is the only module this plan adds to the list in SYSTEM_ARCHITECTURE §5. It exists so that the `PLT-INTERNAL` rule is tested in isolation and the controller contains no `try`. Tests use small stub instances in `tests/platform/helpers/`, not the fixture. If review finds the guard is only a pass-through, it is folded into the controller.

### Stage 1.3 — State & Event System

**Purpose.** The pure building blocks the controller publishes with. The four slices depend only on 1.1-a and not on each other.

| Slice | Builds                                           | Needs                    | Contract                                      | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                      | Catalogue                                                |
| ----- | ------------------------------------------------ | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1.3-a | `snapshots.ts`: `buildSnapshot`, freezing helper | 1.1-a                    | MODULE_CONTRACTS §2.6; DATA_CONTRACTS §4      | The snapshot, its arrays and their elements are frozen. `memory` is a new array with equal bytes. Changing the input copy afterwards does not change the snapshot. The input is neither frozen nor mutated. `lastFault` is absent unless supplied. `details` passes through unread.                                                                                      | SNP-03 (snapshots)                                       |
| 1.3-b | `events.ts`: `stampEvents`                       | 1.1-a                    | MODULE_CONTRACTS §2.5; EVENT_MODEL §2, §4, §9 | `cycle = cycleBefore + cycleOffset`. `sequence` counts from 0 within each cycle in emission order. Order is preserved. A namespaced kind with the emitting identifier is forwarded with its payload unchanged. A foreign namespace, an unknown unnamespaced kind, or an architecture-emitted `fault` gives `PLT-EVENT-NAMESPACE`. Output events and payloads are frozen. | EVT-02; EVT-05; EVT-06 (function level); SNP-03 (events) |
| 1.3-c | Committed (ca750ce)                              | APPROVED WITH FOLLOW-UPS | 2026-11-17                                    | Closed by the 1.5-c measurement: eviction by array shift costs under 1 percent of run time.                                                                                                                                                                                                                                                                              |
| 1.3-d | `breakpoints.ts`: `createBreakpointSet`          | 1.1-a                    | MODULE_CONTRACTS §2.8                         | `replace` replaces, never adds. `addresses` is sorted ascending and has no duplicates. An address outside `[0, 2^addressBits)` gives `PLT-BREAKPOINT-RANGE`; a non-integer gives `PLT-ARGUMENT`; either leaves the old set unchanged.                                                                                                                                    | BRK-03; BRK-04                                           |

**Notes.**

- **History cost.** `entries()` must be stable and frozen, and appends must be cheap at a limit of 10,000. Rebuilding the array on every append is quadratic over a run. The frozen array is built lazily on read and cached until the next change. Measured in 1.5-c.
- **Recorder across calls.** An instruction stepped by clock spans several controller calls. The recorder keeps the open record between calls and is reset by `load` and `reset`.
- **Output register.** The recorder receives the output register's name as an argument. Finding that name in the descriptor is the controller's job (1.4-b, DR-078 b).

### Stage 1.5, first slice — the fixture (implemented before Stage 1.4)

| Slice | Builds                                                                                                                                                                                                      | Needs         | Contract                                                        | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Catalogue                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1.5-a | `tests/platform/fixtures/`: a scripted `CpuArchitecture` per TEST_STRATEGY §4. A factory takes an architecture identifier and a hand-written script of cycles. Test-only inputs select a fault and a throw. | 1.1-a; DR-074 | TEST_STRATEGY §4; MODULE_CONTRACTS §3.1, §3.2; EVENT_MODEL §3.2 | Two registers of different widths, one with role `'program-counter'`, one with role `'output'`; two flags; a memory size that is not 256. The script emits every shared kind except `fault`, and one namespaced kind. `readState()` returns fresh arrays and a fresh `memory` every call. No outcome carries a cycle number. A faulting step leaves `readState()` deeply equal to its value before the step. Two fixtures with different identifiers can be created. Self-tests state expected values from the script. | SNP-05; CYC-09 (runtime) |

**Notes.** The fixture is a script player, not a small CPU: it has no instruction set and no decoder. It must not drift toward BITSHIFT-8. It is never imported from `src/`.

### Stage 1.4 — Execution Controller

**Purpose.** The single entry point. Five sequential slices on one file, `controller.ts`; each adds behaviour to a passing controller and has its own test file. **The full behaviour, the numbered acceptance criteria and the contract amendments of each slice are in Appendix A**, which is the authoritative specification for this stage.

| Slice | Adds                                                                                                                                                                             | Test file                        | Catalogue                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| 1.4-a | `createController`, `snapshot`, `subscribe`, `load`, `reset`, `stepClock` (with halt, and entry into the fault and internal-failure paths, DR-075), `readMemory`, listener rules | `controller-core.test.ts`        | CYC-01, 02, 04, 05 (entry), 06 (entry), 07; ERR-02, 04, 05, 06, 07 (halted); SNP-01, 02, 04 |
| 1.4-b | `stepInstruction`, history recording, `history`                                                                                                                                  | `controller-instruction.test.ts` | CYC-03; EVT-01; HST-04, 05, 06, 07                                                          |
| 1.4-c | Failure in the middle of a call; recovery on `reset` and `load`                                                                                                                  | `controller-failure.test.ts`     | CYC-05, 06; EVT-06; ERR-07 (faulted)                                                        |
| 1.4-d | `beginRun`, `runBatch`, `endRun`                                                                                                                                                 | `controller-run.test.ts`         | CYC-08; ERR-03; LCY-02; DET-02                                                              |
| 1.4-e | `setBreakpoints`, the breakpoint stop, `breakpointHit` on steps                                                                                                                  | `controller-breakpoints.test.ts` | BRK-01 to BRK-06; CYC-08 (breakpoint)                                                       |

Compared with the earlier cut: entering the fault and internal-failure paths moved from 1.4-c into 1.4-a, because `stepClock`, `load` and `reset` are not correct without it. 1.4-c keeps recovery and failures in the middle of a multi-cycle call.

**Step pipeline (DR-074).** One clock cycle, in an order that publishes nothing half-done:

1. Call the guard's `stepClock`. An internal failure takes the `PLT-INTERNAL` path.
2. If the outcome is a fault, take the fault path. That step counts nothing.
3. Stamp the events. A rejection takes the `PLT-INTERNAL` path.
4. Read the state through the guard. A failure takes the `PLT-INTERNAL` path.
5. Only now commit the cycle: advance the counter, keep the state copy, feed the recorder, apply halt.

A call runs this once or many times, then publishes once: it builds the snapshot from the last committed state copy, freezes the update, notifies listeners and returns. A failure path also ends there, so what is published is always the last committed cycle. Reading state every cycle is the simple, correct form; its cost is measured in 1.5-c before anyone optimises it.

**Notes.** No bound is set on the cycles of an instruction step (DR-080); it becomes a conformance requirement on each architecture in Phase 2.

### Stage 1.5 — Mock CPU & Verification (remaining slices)

| Slice | Builds                                                                                                                                                                                                  | Needs | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Catalogue                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1.5-b | Invariant suite: a replay helper in `tests/platform/helpers/`, written from EVENT_MODEL §5 alone; determinism tests; a two-fixture registry test                                                        | 1.4-e | Replay holds on every cycle of the script, including the program counter. Informational and namespaced events do not change replayable state. Two controllers given the same calls produce deeply equal snapshots, events and history at every step. Batch sizes 1, 7 and 1000 agree. A registry of two fixtures selects each by identifier, and an image for one is refused by a controller for the other. Every `PLT-` and `ARCH-` code is triggered by a named test. | EVT-03, 05, 07; DET-01, 02; ERR-01, 02 |
| 1.5-c | Measurement and phase exit: throughput and history cost, reported; a lint rule that stops `src/` importing `tests/`, with its case in `lint-boundaries.test.ts`; catalogue traceability; `/audit-stage` | 1.5-b | Cycles per second through `runBatch`, and append cost and memory at a history limit of 10,000, are reported for DR-024 and DR-031. No test asserts on time. Every Phase 1 catalogue ID maps to a named passing test. A clean install followed by the five commands passes. Audit findings are resolved or recorded.                                                                                                                                                     | DET-03; DR-056 qualification 5         |

**Notes.** A replay helper that shares logic with the platform proves nothing. It imports no platform function, only types.

---

## 6. Implementation Order

Work runs in batches. One lead implementation agent owns each batch, delegates bounded tasks to sub-agents, integrates, and runs validation. The supervisor audits each batch before the next starts, and each batch is committed on its own.

| Batch | Slices                                                                             | Shape                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 1.1-a, 1.1-b, 1.3-a, 1.3-b, 1.3-d                                                  | Done and approved.                                                                                                                                 |
| 2     | Step 0 (DR-074 contract and type revision), then 1.1-c, 1.2-a, 1.2-b, 1.3-c, 1.5-a | Done and approved.                                                                                                                                 |
| 3     | 1.4-a → 1.4-b → 1.4-c → 1.4-d → 1.4-e                                              | Done. Implemented directly by the supervisor on the product owner's instruction, then reviewed independently by Sonnet. Specification: Appendix A. |
| 4     | 1.5-b, 1.5-c                                                                       | Done and approved.                                                                                                                                 |

All four batches are complete.

---

## 7. Lifecycle Transitions (for slice 1.2-a; DR-077 b, approved)

Derived from SIMULATION_PLATFORM §3.1 and §3.2 and MODULE_CONTRACTS §2.4.2. Cells marked † were not stated in the contracts and are fixed by DR-077 b.

| Action                           | ready             | running               | paused            | halted            | faulted           |
| -------------------------------- | ----------------- | --------------------- | ----------------- | ----------------- | ----------------- |
| `load`                           | ready             | `PLT-RUNNING`         | ready             | ready             | ready             |
| `reset`                          | ready             | ready                 | ready             | ready             | ready             |
| `begin-run`                      | running           | `PLT-ALREADY-RUNNING` | running           | halted            | faulted           |
| `end-run`                        | `PLT-NOT-RUNNING` | paused                | `PLT-NOT-RUNNING` | `PLT-NOT-RUNNING` | `PLT-NOT-RUNNING` |
| `clock-step`, `instruction-step` | paused            | `PLT-RUNNING`         | paused            | halted            | faulted           |
| `halt`                           | `PLT-INTERNAL` †  | halted                | halted            | `PLT-INTERNAL` †  | `PLT-INTERNAL` †  |
| `fault`                          | faulted †         | faulted               | faulted           | faulted †         | faulted †         |

A step taken from `ready` applies the step action first (to `paused`), then `halt` or `fault` if the outcome reports one. A breakpoint stop applies `end-run` (DR-076): no new action and no new state.

---

## 8. Testing Strategy for Phase 1

- **Unit tests** for the pure functions, written from the contract tables, with no fixture.
- **Contract tests** for the controller against the fixture. Expected values come from the fixture's hand-written script.
- **Invariant suites** (replay, determinism, isolation) run over the whole script on every cycle. These are the tests that later run unchanged against BITSHIFT-8.
- **Spies only at the architecture boundary**, to prove "the architecture is not called". No mocks of platform modules.
- **Type-level tests** with Vitest's `expectTypeOf`, checked by `pnpm typecheck`. No `@ts-expect-error`.
- Everything runs in Node. No DOM environment, no timers, no awaits.

---

## 9. Major Risks

| Risk                                                                                                                           | Mitigation                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract gaps are resolved silently by the implementation agent                                                                | Decisions gate slices (section 2); the stop rule in every prompt; a review of each diff against the contract                                                                         |
| The controller absorbs logic that should be pure and separately tested                                                         | Bottom-up order; the controller slices start only after Stages 1.2 and 1.3 are approved                                                                                              |
| The fixture drifts toward a small BITSHIFT-8                                                                                   | The TEST_STRATEGY §4 differences are acceptance criteria of 1.5-a; the fixture plays a script and has no instruction set                                                             |
| Tests assert what the code does, not what the contract says                                                                    | Expected values are traced to a contract section or the script in review                                                                                                             |
| Reading state every cycle is too slow at speed                                                                                 | Measured in 1.5-c against DR-031. Optimise only on evidence, and only in a way the invariant suite still passes                                                                      |
| Events prove too coarse for the Phase 4 datapath                                                                               | Out of Phase 1 scope by DR-072. The platform forwards payloads without reading them, so a later payload change does not touch the controller                                         |
| The Dev Container bind-mounts a `node_modules` that the Windows host installed (Windows binaries, a different pnpm store path) | Delete the host `node_modules` before the first container start. If switching between host and container stays a problem, give `node_modules` its own volume in `devcontainer.json`. |

---

## 10. Slice Status

| Slice | Status              | Verdict                  | Date       | Follow-ups                                                                                                                                                                                   |
| ----- | ------------------- | ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1-a | Committed (1fb2322) | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Closed: fillers removed in 1.1-b. Open: narrowing of shared payloads, handled in 1.3-c.                                                                                                      |
| 1.1-b | Committed (db6703d) | APPROVED                 | 2026-11-16 | Closed by DR-079: the register `bits` check goes to 1.1-c; an empty list stays valid.                                                                                                        |
| 1.1-c | Committed (ca750ce) | APPROVED                 | 2026-11-17 | —                                                                                                                                                                                            |
| 1.2-a | Committed (ca750ce) | APPROVED                 | 2026-11-17 | —                                                                                                                                                                                            |
| 1.2-b | Committed (ca750ce) | APPROVED                 | 2026-11-17 | Approved after one fix round: the cause of a failure is now recorded and returned; a malformed load result is contained.                                                                     |
| 1.3-a | Committed (2659b9d) | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Neutral register and flag names in `snapshots.test.ts`: done in Batch 2.                                                                                                                     |
| 1.3-b | Committed (2659b9d) | APPROVED                 | 2026-11-16 | Closed by DR-079: payloads are frozen in place.                                                                                                                                              |
| 1.3-c | Committed (ca750ce) | APPROVED WITH FOLLOW-UPS | 2026-11-17 | Eviction uses an array shift; measure its cost in 1.5-c before changing it.                                                                                                                  |
| 1.3-d | Committed (2659b9d) | APPROVED                 | 2026-11-16 | Closed by DR-079: the width is not validated.                                                                                                                                                |
| 1.5-a | Committed (ca750ce) | APPROVED                 | 2026-11-17 | Script mnemonics and signal names made neutral in the fix round.                                                                                                                             |
| 1.4-a | Batch 3             | —                        | —          | —                                                                                                                                                                                            |
| 1.4-b | Batch 3             | —                        | —          | —                                                                                                                                                                                            |
| 1.4-c | Batch 3             | —                        | —          | —                                                                                                                                                                                            |
| 1.4-d | Batch 3             | —                        | —          | —                                                                                                                                                                                            |
| 1.4-e | Batch 3             | —                        | —          | —                                                                                                                                                                                            |
| 1.5-b | Done                | APPROVED                 | 2026-11-17 | Sonnet lead with four Haiku test agents; audited by the supervisor. No platform defect found. Also closes the reset-throws test left open by the controller review.                          |
| 1.5-c | Done                | APPROVED                 | 2026-11-17 | Sonnet lead with four Haiku agents; audited by the supervisor, who re-ran the checks and both measurement files. Optimisation is not justified by the numbers. Technical debt: Appendix A.4. |

---

## Appendix A — Phase 1 Exit Record

Recorded by the engineering supervisor on 2026-11-17. The assignments for earlier batches are in the git history of this file. **Phase 1 is complete in the repository and awaits product-owner acceptance.**

### A.1 Exit criteria

| Criterion                                                  | Source                            | Status                       | Evidence                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| All platform contract tests pass against the fixture       | DEVELOPMENT_ROADMAP, Phase 1 exit | PASS                         | `pnpm test`: 24 files, 549 tests, 0 failures                                                                                                    |
| No platform file imports architecture or UI code           | DEVELOPMENT_ROADMAP, Phase 1 exit | PASS                         | Every import in `src/platform` is a sibling file; `pnpm lint` passes                                                                            |
| The fixture is never imported from `src/`                  | Stage 1.5 acceptance              | PASS                         | New lint rule with 13 test cases; search of `src/` finds no `tests/` import                                                                     |
| Determinism tests pass                                     | Stage 1.5 acceptance              | PASS                         | DET-01, DET-02 in `determinism.test.ts`; batch sizes 1, 2, 3, 5, 7, 13, 1000 agree                                                              |
| Every Phase 1 catalogue ID maps to a passing test          | TEST_STRATEGY §5                  | PASS, with five partial rows | Section A.3. No ID is without a test.                                                                                                           |
| Every stage of the phase is done                           | DEFINITION_OF_DONE §7             | PASS                         | Section 10: all 17 slices approved                                                                                                              |
| Regression run on a clean install                          | DEFINITION_OF_DONE §7             | PASS                         | `node_modules` deleted, `pnpm install --frozen-lockfile`, then the five commands, by the lead executor; the supervisor re-ran the five commands |
| Documentation validation                                   | DEFINITION_OF_DONE §5, §7         | PASS                         | 142 Markdown links resolve; every `DR-` reference resolves; no duplicate register ID; `pnpm format:check` passes                                |
| Contract amendments owed by approved decisions are written | Section 2.2                       | PASS                         | Every row done in Batches 2 and 3                                                                                                               |
| Performance measured during implementation                 | DR-056 qualification 5            | PASS                         | Section A.2                                                                                                                                     |
| Performance target met                                     | DR-031                            | DEFERRED                     | DR-031 is still open and has no reference machine. The measured figures are in A.2.                                                             |
| History default capacity                                   | DR-024                            | DEFERRED                     | Open. A.2 supplies the figures for the decision. Needed by the composition root, not by the platform.                                           |
| Verified on Node 24 in the Dev Container                   | DR-041                            | DEFERRED                     | The host used for every check runs Node 22.19. The container check is the product owner's.                                                      |
| Product-owner acceptance recorded in the register          | DEFINITION_OF_DONE §7             | PENDING                      | —                                                                                                                                               |

### A.2 Measurements

Machine: Intel Core i5-1035G1 (4 cores, 8 threads, 1.00 GHz base), 7.77 GB RAM, Windows 10 Home, Node 22.19, Vitest 5.1. Three runs: two by the lead executor, one by the supervisor. Figures are means per run. They include Vitest's module-runner overhead, so a bundled build is expected to be faster. Reproduce with `pnpm exec vitest bench --run --reporter=verbose tests/platform/perf`.

**Throughput: time for 10,000 instructions (40,000 cycles), history limit 10,000**

| Mode                | Lead run 1 | Lead run 2 | Supervisor run |
| ------------------- | ---------- | ---------- | -------------- |
| `runBatch(1000)`    | 149 ms     | 181 ms     | not captured   |
| `runBatch(1)`       | 208 ms     | 208 ms     | 210 ms         |
| `stepInstruction()` | 175 ms     | 243 ms     | 217 ms         |
| `stepClock()`       | 219 ms     | 233 ms     | 212 ms         |

That is roughly 165,000 to 270,000 cycles per second. Against the DR-031 proposal (10,000 instructions in under 2 seconds with animation paused), the slowest run is about 8 times inside the limit on this machine. Run-to-run spread is large (up to 40 percent), so treat these as orders of magnitude.

**History: 100,000 appends**

| Case                                             | Lead run 1 | Lead run 2 | Supervisor run |
| ------------------------------------------------ | ---------- | ---------- | -------------- |
| Limit 100,000, never evicts                      | 5.0 ms     | 5.3 ms     | 4.1 ms         |
| Limit 10,000, evicts on 90,000 appends           | 10.9 ms    | 11.4 ms    | 11.5 ms        |
| Limit 10,000, `entries()` after every append     | 533 ms     | 745 ms     | 575 ms         |
| Limit 10,000, `entries()` after every 40 appends | 23.0 ms    | 29.8 ms    | 23.6 ms        |

**Memory (approximate, heap growth after forced collection):** a history of 10,000 records with three changes each holds about 3.0 MB, about 310 bytes per record.

**Conclusions.**

- **Eviction.** The array-shift eviction costs about 6 to 7 ms per 100,000 appends, about 0.07 microseconds each. For a run of 10,000 instructions that is under 1 ms, well under 1 percent of the run. **Optimisation is not justified.** The follow-up on slice 1.3-c is closed.
- **Per-cycle state read and publish.** Publishing after every cycle (`runBatch(1)`) costs about 30 to 60 ms more per 40,000 cycles than publishing once per 1,000. **Optimisation is not justified.**
- **The one real cost** is reading `entries()` after every single append: about 6 microseconds per read at a limit of 10,000, because the frozen array is rebuilt. A UI that reads once per frame pays about 0.25 microseconds per append. This is a rule for the Phase 5 store (read history at most once per frame), not a platform change.
- One full run of the throughput file stalled once for the lead executor and could not be reproduced in four later runs or in the supervisor's run. It is recorded as unexplained.

### A.3 Catalogue traceability

Every Phase 1 ID has at least one named passing test. Test names are in the files; this table gives the file.

| IDs                      | Test file                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------- |
| SNP-01, SNP-02, SNP-04   | `controller-core.test.ts`                                                              |
| SNP-03                   | `snapshots.test.ts`, `events.test.ts`, `history.test.ts`                               |
| SNP-05, CYC-09 (runtime) | `fixtures/fixture-architecture.test.ts`                                                |
| DET-01, DET-02           | `determinism.test.ts`; also `controller-run.test.ts`, `controller-breakpoints.test.ts` |
| DET-03                   | `tests/tooling/lint-boundaries.test.ts`, and `pnpm lint`                               |
| EVT-01                   | `controller-instruction.test.ts`                                                       |
| EVT-02                   | `events.test.ts`                                                                       |
| EVT-03, EVT-05, EVT-07   | `replay-invariant.test.ts`                                                             |
| EVT-06                   | `events.test.ts`, `controller-failure.test.ts`, `two-architectures.test.ts`            |
| CYC-01, 02, 05, 07       | `controller-core.test.ts`                                                              |
| CYC-03                   | `controller-instruction.test.ts`                                                       |
| CYC-04, ERR-01, ERR-02   | `diagnostic-codes.test.ts`                                                             |
| CYC-06                   | `controller-failure.test.ts`, `instance-guard.test.ts`                                 |
| CYC-08, ERR-03, LCY-02   | `controller-run.test.ts`                                                               |
| CYC-09 (type)            | `contract-types.test.ts`                                                               |
| BRK-01, 02, 05, 06       | `controller-breakpoints.test.ts`                                                       |
| BRK-03, BRK-04           | `breakpoints.test.ts`, `controller-breakpoints.test.ts`                                |
| HST-01, 02, 03, 07       | `history.test.ts`                                                                      |
| HST-04, 05, 06           | `controller-instruction.test.ts`                                                       |
| ERR-04, 05, 06, 07       | `controller-core.test.ts`, `controller-failure.test.ts`                                |
| ERR-08                   | `registry.test.ts`                                                                     |
| LCY-01                   | `lifecycle.test.ts`                                                                    |

**Partial rows** (the ID is tested, but not to the letter of its wording):

| ID     | What is not covered                                                                                                      | Assessment                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| SNP-03 | `memory` is a `Uint8Array` and cannot be frozen                                                                          | By design (DATA_CONTRACTS §4.4). No action.                                               |
| EVT-06 | The controller test asserts the internal fault, not the namespace code as its cause                                      | Covered across two tests. No action.                                                      |
| BRK-06 | Only the argument counts of instance calls are checked                                                                   | The instance interface has no breakpoint input, so nothing more can be passed. No action. |
| DET-03 | The lint tests do not exercise `sessionStorage`, `navigator`, `crypto.getRandomValues`, or `Math.random` in the platform | The rules exist in `eslint.config.js`. Technical debt: add the cases.                     |
| HST-04 | Eviction is checked against delivered snapshots; `clear` and `reset` are not                                             | Technical debt: add one test.                                                             |

### A.4 Technical debt carried out of Phase 1

1. Two small test additions: DET-03 lint cases and the HST-04 `reset` case (A.3).
2. EVT-01's test does not assert that `sequence` restarts at 0 on a new cycle. EVT-02 does, at function level.
3. The unexplained single stall of the throughput measurement (A.2).
4. No bound on the cycles of an instruction step. It becomes conformance test CNF-05 in Phase 2 (DR-080).
5. `details` typing (DR-078 c) must be decided at Phase 2 entry, in the `unknown` form.
6. A `breakpoints()` accessor (DR-078 a) and the rule "read history at most once per frame" belong to Phase 5.
7. DR-069's follow-up, the composition-root check that the selected architecture matches the ISA, belongs to the phase that builds the composition root.
8. Nothing has been verified on Node 24 or inside the Dev Container.
9. Malformed payloads on shared events are ignored by the history recorder, and `output-emitted` from an architecture with no output register is ignored. Both are narrow readings to confirm in Phase 2.
