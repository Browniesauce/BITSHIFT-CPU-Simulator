# BITSHIFT — Phase 1 Execution Plan: Simulation Platform Backbone

**Status:** Revised 2026-11-17. Batches 1 and 2 are done, approved and committed. **Next: Batch 3, the controller (Appendix A).** No slice is gated.
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

**Done in Batch 2:** DR-074 (instance and architecture documents, TEST_STRATEGY), DR-077 b, f, g, DR-078 b, DR-079 item 1 and the empty-registry line. **Done by the supervisor on 2026-11-17 (decisions with no implementing slice):** DR-080 items 1, 3 and 4.

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

| Slice | Builds                                                                                                   | Needs              | Contract                                                       | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Catalogue                                                |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1.3-a | `snapshots.ts`: `buildSnapshot`, freezing helper                                                         | 1.1-a              | MODULE_CONTRACTS §2.6; DATA_CONTRACTS §4                       | The snapshot, its arrays and their elements are frozen. `memory` is a new array with equal bytes. Changing the input copy afterwards does not change the snapshot. The input is neither frozen nor mutated. `lastFault` is absent unless supplied. `details` passes through unread.                                                                                                                                                                                                                                                                            | SNP-03 (snapshots)                                       |
| 1.3-b | `events.ts`: `stampEvents`                                                                               | 1.1-a              | MODULE_CONTRACTS §2.5; EVENT_MODEL §2, §4, §9                  | `cycle = cycleBefore + cycleOffset`. `sequence` counts from 0 within each cycle in emission order. Order is preserved. A namespaced kind with the emitting identifier is forwarded with its payload unchanged. A foreign namespace, an unknown unnamespaced kind, or an architecture-emitted `fault` gives `PLT-EVENT-NAMESPACE`. Output events and payloads are frozen.                                                                                                                                                                                       | EVT-02; EVT-05; EVT-06 (function level); SNP-03 (events) |
| 1.3-c | `history.ts`: `createExecutionHistory`; the recorder that turns stamped events into `InstructionRecord`s | 1.1-a; DR-077 f, g | MODULE_CONTRACTS §2.7; EVENT_MODEL §10; SIMULATION_PLATFORM §8 | The limit is enforced on every append; the oldest record is evicted. `truncated` turns true at the first eviction and false at `clear`. A non-positive or non-integer limit gives `PLT-ARGUMENT`. `entries()` returns the same frozen array until a change. A record opens at `instruction-start`, closes at `instruction-end`, and lists the four state-changing kinds in order with the targets in EVENT_MODEL §10. An instruction that never closes produces no record. `index` restarts at 0 after `clear`. Unknown kinds are ignored. Records are frozen. | HST-01, 02, 03, 05, 07; SNP-03 (records)                 |
| 1.3-d | `breakpoints.ts`: `createBreakpointSet`                                                                  | 1.1-a              | MODULE_CONTRACTS §2.8                                          | `replace` replaces, never adds. `addresses` is sorted ascending and has no duplicates. An address outside `[0, 2^addressBits)` gives `PLT-BREAKPOINT-RANGE`; a non-integer gives `PLT-ARGUMENT`; either leaves the old set unchanged.                                                                                                                                                                                                                                                                                                                          | BRK-03; BRK-04                                           |

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

| Batch | Slices                                                                             | Shape                                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 1.1-a, 1.1-b, 1.3-a, 1.3-b, 1.3-d                                                  | Done and approved.                                                                                                                                                                           |
| 2     | Step 0 (DR-074 contract and type revision), then 1.1-c, 1.2-a, 1.2-b, 1.3-c, 1.5-a | Done and approved.                                                                                                                                                                           |
| 3     | 1.4-a → 1.4-b → 1.4-c → 1.4-d → 1.4-e                                              | Sequential. All five change `controller.ts`, so the implementation cannot run in parallel. The lead writes the controller; the test file of each slice is delegated. Assignment: Appendix A. |
| 4     | 1.5-b, 1.5-c                                                                       | 1.5-b first; its replay helper and determinism tests can be delegated separately.                                                                                                            |

The assignment for Batch 4 is written when Batch 3 is approved.

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

| Slice | Status              | Verdict                  | Date       | Follow-ups                                                                                                               |
| ----- | ------------------- | ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1.1-a | Committed (1fb2322) | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Closed: fillers removed in 1.1-b. Open: narrowing of shared payloads, handled in 1.3-c.                                  |
| 1.1-b | Committed (db6703d) | APPROVED                 | 2026-11-16 | Closed by DR-079: the register `bits` check goes to 1.1-c; an empty list stays valid.                                    |
| 1.1-c | Committed (ca750ce) | APPROVED                 | 2026-11-17 | —                                                                                                                        |
| 1.2-a | Committed (ca750ce) | APPROVED                 | 2026-11-17 | —                                                                                                                        |
| 1.2-b | Committed (ca750ce) | APPROVED                 | 2026-11-17 | Approved after one fix round: the cause of a failure is now recorded and returned; a malformed load result is contained. |
| 1.3-a | Committed (2659b9d) | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Neutral register and flag names in `snapshots.test.ts`: done in Batch 2.                                                 |
| 1.3-b | Committed (2659b9d) | APPROVED                 | 2026-11-16 | Closed by DR-079: payloads are frozen in place.                                                                          |
| 1.3-c | Committed (ca750ce) | APPROVED WITH FOLLOW-UPS | 2026-11-17 | Eviction uses an array shift; measure its cost in 1.5-c before changing it.                                              |
| 1.3-d | Committed (2659b9d) | APPROVED                 | 2026-11-16 | Closed by DR-079: the width is not validated.                                                                            |
| 1.5-a | Committed (ca750ce) | APPROVED                 | 2026-11-17 | Script mnemonics and signal names made neutral in the fix round.                                                         |
| 1.4-a | Batch 3             | —                        | —          | —                                                                                                                        |
| 1.4-b | Batch 3             | —                        | —          | —                                                                                                                        |
| 1.4-c | Batch 3             | —                        | —          | —                                                                                                                        |
| 1.4-d | Batch 3             | —                        | —          | —                                                                                                                        |
| 1.4-e | Batch 3             | —                        | —          | —                                                                                                                        |
| 1.5-b | Batch 4             | —                        | —          | —                                                                                                                        |
| 1.5-c | Batch 4             | —                        | —          | —                                                                                                                        |

---

## Appendix A — Implementation Assignment for Batch 3 (the controller)

Give the text below to the lead implementation agent unchanged. Earlier assignments are in the git history of this file.

````markdown
# BITSHIFT — Phase 1, Batch 3: The Execution Controller (Slices 1.4-a to 1.4-e)

## Roles

You are the **sole lead implementation agent** (Sonnet). You write `src/platform/controller.ts` and every documentation sentence yourself. The engineering supervisor (Fable) audits independently and writes no code. The product owner accepts.

**Delegation.** The five slices are sequential and all change `controller.ts`, so the implementation cannot be parallelised. For each slice, delegate the **test file** to one Haiku sub-agent (Agent tool, `model: "haiku"`): give it the public API, the fixture's API, the slice's acceptance criteria and the test rules, and let it write the tests while you implement. Then read its test file **in full**, correct it where it does not test the criterion it claims, and make it pass by fixing the controller, never by weakening the test. If you cannot spawn sub-agents, say so and write the tests yourself. Never claim delegation that did not happen.

## Prerequisite

`git status` shows a clean tree with Batch 2 committed (ca750ce or later). Otherwise stop and report. Do not commit, stage, stash or reset anything.

## Read first

`CLAUDE.md`; `docs/engineering/PHASE_1_EXECUTION_PLAN.md` sections 2, 4, 5 and 7; `docs/decisions/DECISION_REGISTER.md` rows DR-067, DR-070, DR-071, DR-074 to DR-080 and DR-027; `docs/contracts/MODULE_CONTRACTS.md` §2 in full; `docs/contracts/DATA_CONTRACTS.md` §4 to §7, §9 to §11; `docs/contracts/EVENT_MODEL.md` §2, §6, §8, §10; `docs/architecture/SIMULATION_PLATFORM.md` §2 to §9; `docs/engineering/TEST_STRATEGY.md` §5; every file in `src/platform/`; `tests/platform/fixtures/fixture-architecture.ts` and `tests/platform/helpers/`.

Where a contract document and the decision register disagree, **the register wins**. You write the amendments this batch owes (listed per slice below), changing only the sentences named.

## Rules for the whole batch

- TypeScript strict. No `any`, enums, default exports, `@ts-ignore`, `@ts-expect-error`, or non-null assertions without a reason on the same line. Explicit return types on exports. `import type` for types. A one-line doc comment citing the contract section on each export.
- `controller.ts` imports only from the other files in `src/platform/`. **It contains no `catch`:** every architecture call goes through the instance guard. It does not log (DR-080). No forbidden globals (CODING_STANDARDS §4.2). No new dependency. No configuration change.
- Use the existing modules as they are: `nextState`, `createInstanceGuard`, `buildSnapshot`, `stampEvents`, `createExecutionHistory`, `createInstructionRecorder`, `createBreakpointSet`, `validateMemoryRange`. Do not change their behaviour. If one of them cannot support what this assignment requires, stop and report; do not work around it.
- The controller never branches on an architecture identifier and never names a register, flag or opcode. It never calls `explainInstruction` (DR-077 g).
- Tests: one file per slice, against the fixture, through the public `createController` API. Expected values come from the contract and from the fixture's hand-written script table, never from running the code. Assert on codes, not message text. No BITSHIFT-8 names or sizes. Every test has an assertion that can fail. Use a counting wrapper around the fixture architecture to prove "the architecture is not called" and "a new instance is created".
- **Stop rule.** Where this assignment and the register leave two behaviours open, take the narrower literal reading and list it in the report. Do not invent API or decisions. The readings marked **(reading)** below are prescribed: implement them and list them.
- Each slice must end green (`pnpm typecheck`, `pnpm lint`, `pnpm test`) before you start the next. `ExecutionController` grows slice by slice: in each slice the interface declares only the members implemented so far. After 1.4-e it equals MODULE_CONTRACTS §2.4 exactly.

## Step 0 (before 1.4-a)

`src/platform/types.ts`: the comment on `RegisterDefinition.bits` becomes `// positive integer` (DR-080: no upper bound). Nothing else in that file.

## Shared definitions

```ts
export interface ControllerOptions {
  readonly registry: ArchitectureRegistry;
  readonly architectureId: ArchitectureId;
  readonly historyLimit: number;
}
export function createController(
  options: ControllerOptions,
): Result<ExecutionController, Diagnostic>;
```

**Committed state.** The controller holds: the lifecycle state; the cycle counter; whether a program is loaded; `lastFault`; the last committed `CpuStateCopy`; the number of events already published at the current counter value; and the current frozen snapshot. Nothing is published that is not committed.

**The step pipeline** (plan section 5), for one clock cycle:

1. Guard `stepClock()`. `internal` → internal-failure path.
2. Outcome has `fault` → fault path. That step counts nothing.
3. `stampEvents(counter, outcome.events, architectureId)`. An error → internal-failure path, and the instance must be replaced before it is used again, exactly as if it had thrown.
4. Guard `readState()`. `internal` → internal-failure path.
5. Commit: counter += `cyclesCompleted`; keep the state copy; update the per-cycle event count; (from 1.4-b) feed the recorder and append completed records to the history; if `outcome.halted`, apply the `halt` action.

A call may run the pipeline once (`stepClock`) or many times (`stepInstruction`, `runBatch`). It publishes **once**, at its end.

**Fault path and internal-failure path** (both): apply the `fault` action; set `lastFault` (the architecture's diagnostic, or a `PLT-INTERNAL` diagnostic); add one platform event `{ kind: 'fault', cycle: counter, sequence: <events already published at this counter value>, payload: { diagnostic } }`, frozen (DR-075); stop the call. Cycles committed earlier in the same call stay committed and their events stay in the update (DR-074). The snapshot is built from the last committed state copy; an unreliable instance is never read.

**Publishing.** Build a `ControllerUpdate`: `reason` by DR-077 c (`fault`, else `halt`, else `breakpoint` for batches, else the request's own reason); `snapshot`; `events` of this call in order; `cyclesCompleted` of this call; `breakpointHit` when it applies (1.4-e). Freeze the update and its `events` array. A new snapshot object is built only when the counter, the lifecycle state, `lastFault` or the committed state copy changed in this call; otherwise the same snapshot object is reused. **(reading)** A successful `load` and every `reset` always publish a new snapshot object.

**Listeners** (DR-077 h, DR-080). After the state is committed, take a copy of the listener list and call each listener once, in subscription order, with the update. If a listener throws, stop at once and let the exception reach the caller; later listeners are not called for that update; the CPU does not fault and the committed state stays. A listener added or removed during a notification takes effect from the next notification. While a notification is running, a call to `load`, `reset`, `setBreakpoints`, `beginRun`, `runBatch`, `endRun`, `stepClock` or `stepInstruction` throws an `Error` (programmer error) and changes nothing; `snapshot`, `history`, `readMemory`, `subscribe` and unsubscribing are allowed. The "notifying" mark is cleared even when a listener throws (use `try`/`finally` **without** `catch`; this one `try` is allowed). A `Result` error is returned to the caller only; listeners are not notified of it.

**Check order for every advancing request (DR-080 item 5):** (1) the argument, where there is one; (2) no program loaded → `PLT-NO-PROGRAM` for `stepClock`, `stepInstruction` and `beginRun`, in every lifecycle state including `halted` and `faulted`; (3) otherwise the lifecycle refusal from `nextState` (`PLT-RUNNING`, `PLT-ALREADY-RUNNING`); `runBatch` and `endRun` without an active run return `PLT-NOT-RUNNING`; (4) if the state is `halted` or `faulted`: return `Ok` with zero cycles, no events, the request's own reason and the **same** snapshot object, without calling the architecture. Every `Result` error leaves all state unchanged and does not call the architecture.

---

## Slice 1.4-a — Core

**Builds:** `createController`, `architectureId`, `snapshot()`, `subscribe()`, `load()`, `reset()`, `stepClock()`, `readMemory()`. Files: `src/platform/controller.ts`, `tests/platform/controller-core.test.ts`, `tests/platform/helpers/controller-harness.ts` (builds a controller over the fixture, a program image for it, and the counting wrapper). `src/platform/index.ts` exports `createController` and the types `ExecutionController` and `ControllerOptions`.

**Behaviour.**

- `createController`: unknown identifier → `ARCH-UNKNOWN-ID` from the registry, unchanged; bad `historyLimit` → `PLT-ARGUMENT`. It creates the guard (one `createInstance()` call) and reads the initial state. **(reading)** If the instance cannot be created or read at this point, it returns `err` with the `PLT-INTERNAL` diagnostic, because no snapshot exists to publish. The first snapshot has state `ready`, cycle 0, no `lastFault`.
- `load(image)`: `PLT-RUNNING` while running; `image.architectureId` different from the controller's → `PLT-ARCHITECTURE-MISMATCH`, checked by the controller before the architecture is called; a load rejected by the architecture returns that error unchanged. On success: counter 0, history and recorder cleared, `lastFault` cleared, state `ready`, breakpoints kept, reason `load`.
- `reset()`: allowed in every state, with or without a program. Calls the guard's `reset`, then: counter 0, history and recorder cleared, `lastFault` cleared, state `ready`, program and breakpoints kept, reason `reset`.
- `stepClock()`: one run of the pipeline. `ready` or `paused` → `paused`, unless the outcome halts or faults. Reason `clock-step`, or `halt`, or `fault`.
- A fault outcome, or an internal failure in `stepClock`, `load` or `reset`, takes the fault or internal-failure path and returns `Ok` with that update (DR-077 d). Recovery from an internal failure is slice 1.4-c: in this slice, `reset` and `load` after an internal failure need not work yet, and no test may rely on them.
- `readMemory(range)`: validated with `validateMemoryRange` against the descriptor's `memoryBytes`; returns a new copy of the bytes from the current snapshot; never calls the architecture.

**Acceptance criteria.**

1. Creation: `ARCH-UNKNOWN-ID` and `PLT-ARGUMENT` cases; the first snapshot is `ready`, cycle 0, frozen; exactly one instance was created.
2. CYC-01: the counter is 0 after `load` and after `reset`, including after steps have run.
3. CYC-02: after one completed clock step the snapshot's `cycle` is 1, every event of the update has `cycle` 1, sequences count from 0, and the state is `paused`.
4. Stepping the fixture's default script cycle by cycle gives, after every step, the register, flag, memory and program-counter values of the fixture's hand-written table.
5. CYC-07 and ERR-07 (halted): the halting cycle adds exactly the cycles it reports; reason is `halt`; state is `halted`; a further `stepClock` returns `Ok` with zero cycles, the same snapshot object, and no architecture call.
6. CYC-05 (entry): a fault cycle leaves the counter unchanged, gives state `faulted`, `lastFault` equal to the fault, reason `fault`, and exactly one event, of kind `fault`, whose `sequence` is the number of events already published at that cycle (test it after a cycle that had events, and at cycle 0 with none). The state fields of the snapshot equal those before the faulting step.
7. CYC-06 (entry): a throwing cycle gives `Ok`, state `faulted`, `lastFault.code` `PLT-INTERNAL`, counter unchanged, one `fault` event.
8. CYC-04, ERR-02, ERR-04, ERR-05: `stepClock` with no program → `PLT-NO-PROGRAM`; `reset` with no program succeeds; mismatched image → `PLT-ARCHITECTURE-MISMATCH`; a load the fixture rejects returns the fixture's code. After each error the snapshot object, counter and history are unchanged, no listener was called, and the architecture was not called for the two controller-side errors.
9. SNP-01, SNP-02, SNP-04: `snapshot()` returns the same object until a change and a new one after; a snapshot taken earlier is deeply unchanged after later steps; changing the `memory` of a snapshot or of a `readMemory` result changes nothing later.
10. ERR-06: `readMemory` out of range → `PLT-MEMORY-RANGE`, with no architecture call; in range → the expected bytes in a new array on every call.
11. Listeners: called once per update, in subscription order, before the call returns, with a frozen update equal to the returned one; unsubscribe works; a throwing listener stops the notification, the exception reaches the caller, later listeners are not called, the state is committed and not `faulted`, and the next call notifies normally; a listener added or removed during a notification takes effect from the next one; each of the state-changing calls made from inside a listener throws and changes nothing; reads from inside a listener work.

**Contract amendments (you):** MODULE_CONTRACTS §2.4.2 and SIMULATION_PLATFORM §3.2 (DR-077 a, and the check order); DATA_CONTRACTS §7 (DR-077 c); MODULE_CONTRACTS §2.4.6 (DR-077 h and DR-080 listener rules); EVENT_MODEL §2 fault paragraph (DR-075).

## Slice 1.4-b — Instruction step and history

**Builds:** `stepInstruction()`, `history()`; the recorder and history are fed in pipeline step 5. File: `tests/platform/controller-instruction.test.ts`.

**Behaviour.** `stepInstruction()` repeats the pipeline until an outcome reports `instructionCompleted` or `halted`, or the fault or internal path is taken. There is no cycle bound (DR-080). One update: reason `instruction-step`, or `halt`, or `fault`. `history()` returns the history's `entries()`. The recorder is created with the name of the descriptor's register of role `'output'`, or `undefined` if there is none. Records are appended in order as their instruction completes, whichever request ran the cycles.

**Acceptance criteria.**

1. CYC-03: one `stepInstruction` over an N-cycle instruction of the script raises the counter by exactly N, and the update holds the events of all N cycles.
2. Equivalence: two controllers on the same script, one stepped by instruction and one by clock, have deeply equal snapshots and histories at every instruction boundary, and the concatenated events are deeply equal.
3. EVT-01: in every update, events are ordered by `(cycle, sequence)`; across updates no cycle decreases.
4. `stepInstruction` from the middle of an instruction finishes that instruction only.
5. HST-07 at controller level: after the script, `history()` holds one record per completed instruction, with the `index`, `startCycle`, `endCycle`, `address`, `mnemonic` and `changes` worked out by hand from the script. No record has an `explanation` key.
6. HST-05: `history()` returns the same frozen array until a record is added; `load` and `reset` empty it.
7. HST-06 and HST-04: with `historyLimit` 2 and a longer run, `history()` never exceeds 2 and holds the newest records; a snapshot and an update captured before the eviction are deeply unchanged after it.
8. `PLT-RUNNING` is deferred to 1.4-d; `PLT-NO-PROGRAM` and the halted no-op hold for `stepInstruction` as for `stepClock`.

**Contract amendments (you):** MODULE_CONTRACTS §2.4.1 (the `stepInstruction` row: composed from clock steps) and §2.4.3 (DR-074).

## Slice 1.4-c — Failure inside a call, and recovery

**Builds:** the mid-call failure cases and recovery. File: `tests/platform/controller-failure.test.ts`.

**Behaviour.** After an internal failure the controller remembers that the instance must be replaced (the guard is unreliable, or an event batch was rejected). The next `reset` or `load` first calls the guard's `replace()`. If `replace()` fails, the call takes the internal-failure path again and the controller stays `faulted`. `reset` after a successful replacement continues as a normal reset. `load` after a successful replacement continues as a normal load; **(reading)** if that load is then rejected with a `Result` error, the error is returned and the controller stays `faulted` with its `lastFault`. After an ordinary fault (not internal), `reset` and `load` do not replace the instance.

**Acceptance criteria.**

1. DR-074: an instruction whose third cycle is a fault cycle, run with `stepInstruction`: `cyclesCompleted` is 2; the update holds the events of the two cycles followed by one `fault` event whose `cycle` is the counter and whose `sequence` is the number of events of that cycle; the snapshot equals the state after the second cycle; `history()` gained no record.
2. The same script with a throwing third cycle: the same, with `lastFault.code` `PLT-INTERNAL`.
3. EVT-06: a cycle that emits a kind in a foreign namespace gives `PLT-INTERNAL`, does not count that cycle, publishes none of that cycle's events, and the next `reset` creates a new instance.
4. ERR-07 (faulted): in `faulted`, `stepClock` and `stepInstruction` return `Ok` with zero cycles, the same snapshot object and no architecture call.
5. CYC-06: after an internal failure, `reset` creates exactly one new instance, reloads the last program, and gives state `ready`, counter 0, no `lastFault`, empty history; the script then runs from its start with the table's values.
6. After an ordinary fault, `reset` creates no new instance and restores the post-load state.
7. `load` after an internal failure replaces the instance and loads the new program.
8. A replacement that throws leaves the controller `faulted` with `PLT-INTERNAL`; `reset` still returns an update and never throws.
9. A read failure after a successful step (the state read throws) takes the internal-failure path and does not count the cycle.

**Contract amendments (you):** MODULE_CONTRACTS §2.4.5 (DR-077 d, and that earlier cycles stay counted); SIMULATION_PLATFORM §9 if a sentence there contradicts it.

## Slice 1.4-d — Run control

**Builds:** `beginRun()`, `runBatch(maxCycles)`, `endRun()`. File: `tests/platform/controller-run.test.ts`.

**Behaviour.** `beginRun`: `ready` or `paused` → `running`, reason `run-start`; `halted` or `faulted` → the no-op of the check order. `runBatch(maxCycles)`: the argument must be a positive integer (`PLT-ARGUMENT`, checked first); not running → `PLT-NOT-RUNNING`. **(reading)** It makes at most `maxCycles` pipeline runs, so a cycle that completes nothing still uses budget. It stops early on halt or on the fault or internal path. Reason: `fault`, else `halt`, else `run-batch`. The state stays `running` unless it halted or faulted. `endRun`: `running` → `paused`, reason `run-end`; otherwise `PLT-NOT-RUNNING`.

**Acceptance criteria.**

1. ERR-03: `beginRun` while running → `PLT-ALREADY-RUNNING`; `runBatch` and `endRun` when not running → `PLT-NOT-RUNNING`; `stepClock`, `stepInstruction` and `load` while running → `PLT-RUNNING`; `beginRun` with no program → `PLT-NO-PROGRAM`. `reset` while running gives `ready`.
2. `runBatch` with 0, -1, 1.5 and `NaN` → `PLT-ARGUMENT`, also when not running.
3. CYC-08: `runBatch(n)` completes at most `n` cycles; a batch that stops at the halt has reason `halt` and state `halted`; one that meets a fault cycle has reason `fault`; a full batch has reason `run-batch` and state `running`; a batch that halts on its last budgeted cycle has reason `halt`.
4. After `halted`, `runBatch` returns `PLT-NOT-RUNNING` and `beginRun` is the no-op.
5. DET-02: running the script to its halt with batch sizes 1, 7 and 1000 gives deeply equal final snapshots, cycle counts, concatenated events and histories.
6. LCY-02: a run paused with `endRun` in the middle of an instruction and resumed with `beginRun` reaches the same final snapshot, events and history as an uninterrupted run.
7. A batch may end in the middle of an instruction; a following `endRun` then `stepInstruction` finishes that instruction only.

**Contract amendments (you):** MODULE_CONTRACTS §2.4 (`runBatch` comment) and §2.4.1 (`runBatch` row) for DR-077 e.

## Slice 1.4-e — Breakpoints

**Builds:** `setBreakpoints(addresses)`; the breakpoint stop in `runBatch`; `breakpointHit` on steps. File: `tests/platform/controller-breakpoints.test.ts`. Do **not** add a `breakpoints()` accessor (DR-078 a is deferred).

**Behaviour.** `setBreakpoints` calls the breakpoint set's `replace` with the descriptor's `addressBits` and returns its result. It is allowed in every state, publishes no update and notifies no listener. In `runBatch`, after a cycle is committed, if that cycle's outcome has `instructionCompleted`, did not halt, and the committed `programCounter` is in the set: apply the `end-run` action (state `paused`), stop the batch, reason `breakpoint`, `breakpointHit` = that address (DR-076, DR-027). No fault, no `fault` event, `lastFault` untouched. For `stepClock` and `stepInstruction`: the update carries `breakpointHit` only when the call completed at least one cycle, its last cycle ended an instruction, and the program counter is in the set; the lifecycle state is unaffected. **(reading)** A call that ends in halt or fault reports no `breakpointHit`.

**Acceptance criteria.**

1. BRK-01: with a breakpoint on the address the program counter has after the script's second instruction, `runBatch(1000)` stops right after that instruction: reason `breakpoint`, `breakpointHit` that address, state `paused`, no `lastFault`, no `fault` event, and `cyclesCompleted` equal to the cycles of the first two instructions.
2. After that stop, `runBatch` returns `PLT-NOT-RUNNING`; `beginRun` then `runBatch(1000)` runs on to the halt without stopping at the same address again.
3. A breakpoint on the address where the run starts does not stop the run there.
4. A breakpoint whose address the program counter only passes in the middle of an instruction does not stop the batch. (The default script changes the program counter only in the last cycle of an instruction, so this needs a small custom script that writes it mid-instruction.)
5. BRK-02: `stepInstruction` that ends on a breakpoint address reports `breakpointHit` and state `paused`, with reason `instruction-step`; `stepClock` reports it only for the cycle that ends the instruction; a mid-instruction `stepClock` does not.
6. BRK-03, BRK-04: an out-of-range address → `PLT-BREAKPOINT-RANGE`, a fractional one → `PLT-ARGUMENT`, and in both cases the earlier set still stops the run; a second `setBreakpoints` replaces the first.
7. BRK-05: the set survives `load` and `reset`.
8. BRK-06: no method of the fixture instance ever receives a breakpoint value (the instance interface has no such input; assert on the calls recorded by the counting wrapper).
9. DET-02 again with a breakpoint set: batch sizes 1, 7 and 1000 stop at the same cycle with deeply equal updates' events and snapshots.
10. Type-level: `keyof ExecutionController` is exactly `'architectureId' | 'snapshot' | 'history' | 'subscribe' | 'load' | 'reset' | 'setBreakpoints' | 'beginRun' | 'runBatch' | 'endRun' | 'stepClock' | 'stepInstruction' | 'readMemory'`.

**Contract amendments (you):** SIMULATION_PLATFORM §3.1 (label the running → paused arrow "endRun or breakpoint stop") and §6; MODULE_CONTRACTS §2.4.1 (`runBatch` row) and §2.4.4 (DR-076, DR-027, and the reading above); EVENT_MODEL §7 (payloads are frozen in place) and MODULE_CONTRACTS §2.8 (the set does not validate the width) for DR-079.

---

## Final validation (lead)

1. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`. All pass. 329 tests exist before this batch; none removed or weakened.
2. `controller.ts` contains no `catch`, no `console`, and no architecture-specific name. Say how you checked.
3. `git status` and `git diff`: only `src/platform/controller.ts`, `src/platform/index.ts`, `src/platform/types.ts` (the one comment), the five test files, `tests/platform/helpers/controller-harness.ts`, and the contract documents named above have changed.
4. After the documentation edits: every Markdown link you touched resolves, and `pnpm format:check` passes.

## Out of scope

The replay helper, cross-controller determinism suite (DET-01), measurement and phase exit (Batch 4). Anything in `src/app`, `src/architectures`, `src/assembler`, `src/store`. DR-078 a and c. A bound on instruction steps. Logging.

## Report

Per slice: who wrote the tests (Haiku or you) and whether the agent actually ran; files; test count; every change you made to Haiku's tests and why; the contract sentences as they now read; each acceptance criterion with the name of the test that covers it. Then: every reading taken; anything that could not be done and why; the actual result of each of the five commands and the total test count; `git status --short`; the file list for one commit. Do not approve your own work.
````
