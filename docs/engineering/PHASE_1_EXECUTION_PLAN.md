# BITSHIFT — Phase 1 Execution Plan: Simulation Platform Backbone

**Status:** Revised 2026-11-16 after the product owner's review. Stage structure approved (DR-073). **Slice 1.1-a is ready to delegate.** Other slices start when the decisions that gate them (section 2) are approved. No Phase 1 code exists yet.
**Related:** [PHASE_1_READINESS_REVIEW.md](PHASE_1_READINESS_REVIEW.md) (analysis behind this plan), [BITSHIFT_SUPERVISOR.md](BITSHIFT_SUPERVISOR.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [TEST_STRATEGY.md](TEST_STRATEGY.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

This plan cuts Phase 1 into 16 slices. It does not restate the contracts. Each slice names the contract sections that govern it.

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

## 2. Decisions and What They Gate

### 2.1 Approved

| ID     | Decision                                                                                        | Applied in                                                           |
| ------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| DR-039 | The installed stack is approved. Nothing further is introduced.                                 | Whole phase. No slice adds a dependency.                             |
| DR-073 | Five stages, as in section 3. Slice order may be adjusted for fixture and testing dependencies. | Section 3 and section 6                                              |
| DR-075 | The platform `fault` event takes the next free sequence in its cycle.                           | Slice 1.4-c, with the EVENT_MODEL §2 sentence                        |
| DR-076 | A breakpoint stop moves the controller from `running` to `paused`. It is never a fault.         | Slice 1.4-e, with the SIMULATION_PLATFORM and MODULE_CONTRACTS lines |

### 2.2 Pending product-owner approval

Detail for each is in the readiness review. A slice does not start while a decision in its "Needs" column (section 5) is pending.

| ID       | Subject                                                                                               | Gates                                          |
| -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| DR-074   | Platform composes instruction steps from clock steps; atomicity is per clock cycle (review §2)        | 1.2-b, 1.5-a, 1.4-b, 1.4-c                     |
| DR-077 a | Requests with no program loaded                                                                       | 1.4-a                                          |
| DR-077 b | Full `nextState` table (section 7)                                                                    | 1.2-a                                          |
| DR-077 c | Update-reason precedence                                                                              | 1.4-a, 1.4-d                                   |
| DR-077 d | Exceptions outside a step; recovery                                                                   | 1.2-b, 1.4-a, 1.4-c                            |
| DR-077 e | `runBatch` argument                                                                                   | 1.4-d                                          |
| DR-077 f | `StateChange.target` format for memory                                                                | 1.3-c                                          |
| DR-077 g | The platform does not set `InstructionRecord.explanation`                                             | 1.3-c                                          |
| DR-078 a | `breakpoints()` accessor (optional for Phase 1)                                                       | Nothing. Added in 1.4-e if approved.           |
| DR-078 b | At most one `'output'` and one `'program-counter'` register                                           | 1.4-b. Added to 1.1-b if approved before then. |
| DR-078 c | Typing of `details` (not needed in Phase 1)                                                           | Nothing in Phase 1. Decide before Phase 2.     |
| DR-027   | Confirm the breakpoint rule for steps, as reconciled with DR-076                                      | 1.4-e                                          |
| Q-1      | Listener behaviour: a listener that throws, or calls the controller during a notification (review §4) | 1.4-a                                          |
| Roadmap  | The minimal DEVELOPMENT_ROADMAP correction for DR-073 (review §1)                                     | Nothing. Documentation only.                   |

DR-022 and DR-024 stay open and gate nothing in Phase 1. DR-036 (TypeScript 5.9.x) needs no change for Phase 1.

**Can run today with no further approval:** 1.1-a, 1.1-b, 1.3-a, 1.3-b, 1.3-d.

---

## 3. Stage Structure (DR-073, approved)

| Stage                                   | Content                                                                    | Slices         |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| 1.1 Architecture Registry               | Shared primitives and contract types; registry and descriptor validation   | 1.1-a, 1.1-b   |
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

Every slice also meets DEFINITION_OF_DONE §2 and §3. Catalogue IDs refer to TEST_STRATEGY §5. "Needs" lists earlier slices and the pending decisions from section 2.2. Each slice gets its own self-contained prompt, written by the supervisor when the slice before it is approved. The prompt for 1.1-a is Appendix A.

### Stage 1.1 — Architecture Registry

**Purpose.** Give the platform its vocabulary and its first module.

| Slice | Builds                                                                       | Needs | Contract                                                          | Acceptance criteria                                                                                                                                                                                                                                                                                                                                 | Catalogue                                       |
| ----- | ---------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1.1-a | `result.ts`, `types.ts`, `memory-range.ts`, `index.ts`                       | —     | DATA_CONTRACTS §2–§10; EVENT_MODEL §3.2, §10; MODULE_CONTRACTS §3 | Appendix A.                                                                                                                                                                                                                                                                                                                                         | CYC-09 (type part); ERR-01 (`PLT-MEMORY-RANGE`) |
| 1.1-b | `registry.ts`: `createArchitectureRegistry`, `lookup`, descriptor validation | 1.1-a | MODULE_CONTRACTS §2.1; DATA_CONTRACTS §3.1, §3.2                  | Each validation rule in DATA_CONTRACTS §3.2 rejects with `ARCH-INVALID-DESCRIPTOR`, one test per rule. Duplicate identifiers give `ARCH-DUPLICATE-ID`. Unknown lookup gives `ARCH-UNKNOWN-ID`. `architectures` keeps registration order and is frozen. The input list is not mutated. Two valid entries each resolve by their `isa.architectureId`. | ERR-08; ERR-01 (`ARCH-` codes)                  |

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

**Purpose.** The single entry point. Each slice adds one behaviour to a passing controller. Controller tests live in one file per slice (`controller-core.test.ts`, `controller-instruction.test.ts`, and so on).

| Slice | Builds                                                                                                                              | Needs                                  | Contract                                               | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                             | Catalogue                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1.4-a | `controller.ts` core: `createController`, `snapshot`, `subscribe`, `load`, `reset`, `stepClock` (including halt), `readMemory`      | 1.1 to 1.3, 1.5-a; DR-077 a, c, d; Q-1 | MODULE_CONTRACTS §2.4, §2.4.1–§2.4.3, §2.4.6           | The counter is 0 after load and reset and advances by `cyclesCompleted`. A halt adds no cycle and sets `halted`; later steps return `Ok` with zero cycles. Result errors change nothing and do not call the architecture (spy). The same snapshot object is returned until a change. Listeners run before the call returns. `readMemory` returns a copy and never calls the architecture. An earlier snapshot is unchanged by later steps.      | CYC-01, 02, 04, 07; ERR-02, 04, 05, 06, 07 (halted); SNP-01, 02, 04 |
| 1.4-b | `stepInstruction`; history recording; `history()`                                                                                   | 1.4-a; DR-074; DR-078 b                | §2.4.1; EVENT_MODEL §6, §10                            | Advances exactly the instruction's cycles. Produces the same snapshots, events and history as the equivalent clock steps. Events in an update are ordered by `(cycle, sequence)`. `historyLimit` is the enforced limit. Eviction leaves delivered snapshots and events untouched.                                                                                                                                                               | CYC-03; EVT-01; HST-04, 06                                          |
| 1.4-c | Fault path and `PLT-INTERNAL` path; recovery on reset and load. Writes the DR-075 sentence into EVENT_MODEL §2.                     | 1.4-b; DR-074; DR-077 d                | §2.4.5; SIMULATION_PLATFORM §9; DR-070, DR-071, DR-075 | A fault outcome: the counter is unchanged by the faulting step, one platform `fault` event with the next free sequence, state `faulted`, `lastFault` set. Cycles completed earlier in the same call stay counted and published. A throw or a rejected event batch: `PLT-INTERNAL`, the published snapshot is the last committed state, steps return `Ok` with zero cycles until reset, and reset uses a new instance with the program reloaded. | CYC-05, 06; EVT-06; ERR-07 (faulted)                                |
| 1.4-d | `beginRun`, `runBatch`, `endRun`                                                                                                    | 1.4-c; DR-077 c, e                     | §2.4.1, §2.4.2; SIMULATION_PLATFORM §3.2, §5           | Never more than `n` cycles. Stops early on halt or fault with the right reason. The final state does not depend on batch size. Pause and resume continue from the same state. Each run-state error code is returned in the state the contract names.                                                                                                                                                                                            | CYC-08; ERR-03; LCY-02; DET-02                                      |
| 1.4-e | `setBreakpoints`; breakpoint stop in `runBatch`; `breakpointHit` on steps. Writes the DR-076 lines into the two contract documents. | 1.4-d; DR-027 confirmation             | §2.4.4; SIMULATION_PLATFORM §6; DR-076                 | A batch stops after the instruction boundary whose program counter is in the set, reports the address with reason `breakpoint`, and leaves the controller `paused` with no fault. The next run continues past it. Steps report without stopping. The set survives load and reset. The fixture receives no breakpoint data.                                                                                                                      | BRK-01, 02, 03, 04 (controller level), 05, 06; CYC-08 (breakpoint)  |

**Step pipeline (pending DR-074).** Every advancing call follows one order, so that a failure at any point publishes nothing half-done:

1. Check the argument, the lifecycle and program presence. On error, return it; nothing else happens.
2. Call the guard's `stepClock`. On an internal failure, take the `PLT-INTERNAL` path.
3. If the outcome is a fault, take the fault path. That step counts nothing.
4. Stamp the events. A rejection takes the `PLT-INTERNAL` path.
5. Read the state through the guard. A failure takes the `PLT-INTERNAL` path.
6. Only now commit the cycle: advance the counter, keep the state copy, feed the recorder, apply halt.
7. When the call ends: build the snapshot from the last committed state copy, freeze the update, notify listeners, return.

`stepInstruction` and `runBatch` repeat steps 2 to 6 once per cycle and do step 7 once. A failure path also ends at step 7, so what is published is always the last committed cycle. Reading state every cycle is the simple, correct form; its cost is measured in 1.5-c before anyone optimises it.

**Notes.** An architecture that never reports `instructionCompleted` makes `stepInstruction` loop forever. The contract defines no bound and Phase 1 does not invent one. It is noted for the Phase 2 conformance suite.

### Stage 1.5 — Mock CPU & Verification (remaining slices)

| Slice | Builds                                                                                                                                                                                                  | Needs | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Catalogue                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1.5-b | Invariant suite: a replay helper in `tests/platform/helpers/`, written from EVENT_MODEL §5 alone; determinism tests; a two-fixture registry test                                                        | 1.4-e | Replay holds on every cycle of the script, including the program counter. Informational and namespaced events do not change replayable state. Two controllers given the same calls produce deeply equal snapshots, events and history at every step. Batch sizes 1, 7 and 1000 agree. A registry of two fixtures selects each by identifier, and an image for one is refused by a controller for the other. Every `PLT-` and `ARCH-` code is triggered by a named test. | EVT-03, 05, 07; DET-01, 02; ERR-01, 02 |
| 1.5-c | Measurement and phase exit: throughput and history cost, reported; a lint rule that stops `src/` importing `tests/`, with its case in `lint-boundaries.test.ts`; catalogue traceability; `/audit-stage` | 1.5-b | Cycles per second through `runBatch`, and append cost and memory at a history limit of 10,000, are reported for DR-024 and DR-031. No test asserts on time. Every Phase 1 catalogue ID maps to a named passing test. A clean install followed by the five commands passes. Audit findings are resolved or recorded.                                                                                                                                                     | DET-03; DR-056 qualification 5         |

**Notes.** A replay helper that shares logic with the platform proves nothing. It imports no platform function, only types.

---

## 6. Implementation Order

```
1.1-a → 1.1-b → 1.2-a → 1.2-b → 1.3-a → 1.3-b → 1.3-c → 1.3-d
      → 1.5-a (fixture) → 1.4-a → 1.4-b → 1.4-c → 1.4-d → 1.4-e
      → 1.5-b → 1.5-c
```

One slice at a time, each reviewed and committed before the next. If a slice is waiting for a decision, the next ungated slice is taken instead; 1.1-a, 1.1-b, 1.3-a, 1.3-b and 1.3-d need no pending decision.

---

## 7. Lifecycle Transitions (for slice 1.2-a; pending DR-077 b)

Derived from SIMULATION_PLATFORM §3.1 and §3.2 and MODULE_CONTRACTS §2.4.2. Cells marked † are not stated in the contracts and are the DR-077 b reading.

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

| Slice | Status                       | Verdict                  | Date       | Follow-ups                                                                                                                                                                                      |
| ----- | ---------------------------- | ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1-a | Done, awaiting commit        | APPROVED WITH FOLLOW-UPS | 2026-11-16 | In 1.1-b: remove the `expect(true).toBe(true)` fillers from `contract-types.test.ts`. In 1.3-c: a narrowing helper is needed to read `SharedEventPayloads` from an `ExecutionEvent`.            |
| 1.1-b | Done, awaiting commit        | APPROVED                 | 2026-11-16 | Two readings need a product-owner ruling, neither blocking: whether `RegisterDefinition.bits` is validated (currently not), and whether an empty architecture list is accepted (currently yes). |
| 1.2-a | Waiting: DR-077 b            | —                        | —          | —                                                                                                                                                                                               |
| 1.2-b | Waiting: DR-074, DR-077 d    | —                        | —          | —                                                                                                                                                                                               |
| 1.3-a | Not started                  | —                        | —          | —                                                                                                                                                                                               |
| 1.3-b | Not started                  | —                        | —          | —                                                                                                                                                                                               |
| 1.3-c | Waiting: DR-077 f, g         | —                        | —          | —                                                                                                                                                                                               |
| 1.3-d | Not started                  | —                        | —          | —                                                                                                                                                                                               |
| 1.5-a | Waiting: DR-074              | —                        | —          | —                                                                                                                                                                                               |
| 1.4-a | Waiting: DR-077 a, c, d; Q-1 | —                        | —          | —                                                                                                                                                                                               |
| 1.4-b | Waiting: DR-074, DR-078 b    | —                        | —          | —                                                                                                                                                                                               |
| 1.4-c | Waiting: DR-074, DR-077 d    | —                        | —          | —                                                                                                                                                                                               |
| 1.4-d | Waiting: DR-077 c, e         | —                        | —          | —                                                                                                                                                                                               |
| 1.4-e | Waiting: DR-027              | —                        | —          | —                                                                                                                                                                                               |
| 1.5-b | Not started                  | —                        | —          | —                                                                                                                                                                                               |
| 1.5-c | Not started                  | —                        | —          | —                                                                                                                                                                                               |

---

## Appendix A — Implementation Prompt for Slice 1.1-a

Give the text below to the implementation agent unchanged.

````markdown
# BITSHIFT — Slice 1.1-a: Shared Primitives and Contract Types

You are the implementation agent for BITSHIFT. Implement exactly this slice. Do not start any other work. Do not commit.

## Read first

1. `CLAUDE.md`
2. `docs/contracts/DATA_CONTRACTS.md` (all of it)
3. `docs/contracts/EVENT_MODEL.md` §2, §3.2, §10
4. `docs/contracts/MODULE_CONTRACTS.md` §3.1, §3.2, §3.4
5. `docs/engineering/CODING_STANDARDS.md` §2 to §5 and §8
6. `docs/engineering/DEFINITION_OF_DONE.md` §2, §3, §6

## Objective

Put the platform's shared vocabulary into code: the `Result` helpers, the contract types, and memory-range validation. This slice contains no simulation behaviour, no registry and no controller.

## Files

Create exactly these files:

| File                                    | Content                                                             |
| --------------------------------------- | ------------------------------------------------------------------- |
| `src/platform/result.ts`                | `Result`, `Diagnostic`, `SourceSpan`, `ok`, `err`                   |
| `src/platform/types.ts`                 | The contract types listed below. Types only. No runtime code.       |
| `src/platform/memory-range.ts`          | `validateMemoryRange`                                               |
| `src/platform/index.ts`                 | Re-exports everything above. The only public entry of the platform. |
| `tests/platform/result.test.ts`         | Tests for `ok` and `err`                                            |
| `tests/platform/memory-range.test.ts`   | Tests for `validateMemoryRange`                                     |
| `tests/platform/contract-types.test.ts` | Type-level tests                                                    |

Delete `src/platform/.gitkeep` and `tests/platform/.gitkeep`. Change no other file. In particular, do not edit anything under `docs/`, and do not edit `eslint.config.js`, `tsconfig.json`, `vite.config.ts` or `package.json`.

## `result.ts`

Transcribe `Result`, `SourceSpan` and `Diagnostic` from DATA_CONTRACTS §2. Add the two helpers with exactly these signatures:

```ts
/** Builds a successful Result (DATA_CONTRACTS §2). */
export function ok<T>(value: T): { readonly ok: true; readonly value: T };
/** Builds a failed Result (DATA_CONTRACTS §2). */
export function err<E>(error: E): { readonly ok: false; readonly error: E };
```

They carry no other behaviour.

## `types.ts`

Transcribe each type below from its contract section **exactly**: same name, same fields, same optionality, same type parameters and defaults, every field `readonly`, every array `readonly T[]`. Add no field, method or type parameter the contract does not show. Give each exported type a one-line doc comment that cites its contract section.

- DATA_CONTRACTS §2: `ArchitectureId`, `Address`, `Word`, `ClockCycle`
- §3.2: `ArchitectureDescriptor`, `RegisterDefinition`, `RegisterRole`, `FlagDefinition`
- §4.1: `RegisterValue`, `FlagValue`, `CpuStateCopy`
- §4.2: `CpuState`, `CpuSnapshot`
- §5: `StepOutcome`, `ArchitectureEvent`
- §6: `ExecutionEvent`
- §7: `UpdateReason`, `ControllerUpdate`
- §8 and §8.1: `ProgramImage`, `SourceMapEntry`, `AssemblyResult`, `IsaDescriptor`, `InstructionDefinition`
- §10: `MemoryRange`, `MemoryReadResult`
- §12: `DatapathViewModel`, `DatapathComponentState`, `BusState` only
- EVENT_MODEL §10: `InstructionRecord`, `StateChange`
- MODULE_CONTRACTS §3.1, §3.2, §3.4: `CpuArchitecture`, `CpuInstance`, `VisualizationAdapter`, as the contract shows them today

The shared event payloads are a table in EVENT_MODEL §3.2. Write them as one interface and one union:

```ts
/** Payload of each shared event kind (EVENT_MODEL §3.2). */
export interface SharedEventPayloads {
  readonly 'micro-operation': { readonly controlSignals: readonly string[] };
  // one entry per row of the table, with exactly the fields in its Payload column, all readonly
}
/** The shared event kinds (EVENT_MODEL §3.2). */
export type SharedEventKind = keyof SharedEventPayloads;
```

`types.ts` imports `Result`, `Diagnostic` and `SourceSpan` with `import type`. `index.ts` re-exports types with `export type { ... }` and functions with `export { ... }`.

## `memory-range.ts`

```ts
/** Checks a memory range against a memory size (DATA_CONTRACTS §10). Pure. */
export function validateMemoryRange(
  range: MemoryRange,
  memoryBytes: number,
): Result<MemoryRange, Diagnostic>;
```

A range is valid when `start` is an integer and at least 0, `length` is a positive integer, and `start + length` is at most `memoryBytes`. A valid range returns `ok` with the range it was given. Any other range returns `err` with code `PLT-MEMORY-RANGE` and severity `'error'`. Write the message in plain language; tests do not read it.

## Not in this slice

Do not define `ArchitectureRegistry`, `LifecycleAction`, `ControllerOptions`, `ExecutionController`, `ExecutionHistory`, `BreakpointSet`, `RegisterView`, `MemoryView`, `ControlSignalView`, `TimelineEntry`, `InstructionExplanation`, `AppServices`, `ControllerStore` or `EditorPersistence`. Do not write any registry, lookup or descriptor-validation code. Do not create a fixture or a stub architecture. Do not create anything under `src/app`, `src/architectures` or `src/assembler`.

## Acceptance criteria

1. `ok(v)` returns `{ ok: true, value: v }` and `err(e)` returns `{ ok: false, error: e }` (runtime test). Both are assignable to `Result<T, E>`, and checking `result.ok` narrows to `value` or `error` (type-level test).
2. `validateMemoryRange` accepts: the whole memory (`start` 0, `length` equal to `memoryBytes`); a single byte at the last address; a range in the middle. Each returns `ok` with a range equal to the input.
3. `validateMemoryRange` rejects, each with code `PLT-MEMORY-RANGE`: a negative `start`; a fractional `start`; `length` 0; a negative `length`; a fractional `length`; `start` equal to `memoryBytes`; a range that ends one byte past the end; `NaN` in either field; `Infinity` in either field.
4. `validateMemoryRange` does not mutate its argument, and equal inputs give equal results.
5. The memory-range tests use at least two memory sizes, and at least one is not 256. Tests assert on diagnostic codes, never on message text.
6. Type-level tests, using `expectTypeOf` from `vitest`, prove:
   - `keyof StepOutcome` is exactly `'cyclesCompleted' | 'instructionCompleted' | 'halted' | 'fault' | 'events'` (TEST_STRATEGY CYC-09: no cycle number, no breakpoint field);
   - `keyof ArchitectureEvent` is exactly `'kind' | 'cycleOffset' | 'payload'`;
   - `keyof ExecutionEvent` is exactly `'kind' | 'cycle' | 'sequence' | 'payload'`;
   - `'id'` and `'programCounter'` are not keys of `ArchitectureDescriptor`;
   - `'cycle'` and `'state'` are not keys of `CpuStateCopy`, and `'architectureId'`, `'cycle'`, `'state'` and `'lastFault'` are keys of `CpuSnapshot`;
   - `keyof SharedEventPayloads['micro-operation']` is exactly `'controlSignals'`;
   - `SharedEventKind` is exactly the twelve kinds in EVENT_MODEL §3.2;
   - `CpuSnapshot['registers']` is `readonly RegisterValue[]`, and `ControllerUpdate['events']` is `readonly ExecutionEvent[]`.

   For "is not a key", use the form `expectTypeOf<'id' extends keyof ArchitectureDescriptor ? true : false>().toEqualTypeOf<false>()`.

7. The type-level tests are effective: temporarily change one expected type to a wrong one, confirm that `pnpm typecheck` fails, then restore it. Say in your report which assertion you used.
8. `src/platform/` imports nothing outside itself. `index.ts` has named exports only.
9. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` and `pnpm build` all pass. The 44 tests that exist today still pass.

## Rules

- TypeScript strict. No `any`, no enums, no default exports, no `@ts-ignore`, no `@ts-expect-error`, no non-null assertions.
- No new dependency. `expectTypeOf` is part of Vitest.
- No CPU-specific value anywhere in `src/` or in the tests: no BITSHIFT-8 register name, opcode or `'bitshift-8'` literal.
- **Stop rule.** If a contract type is ambiguous, contradicts another document, or does not compose with another contract type, do not fix it, do not work around it, and do not edit the contract. If it compiles as written, transcribe it as written and list the problem in your report under "Unresolved issues". If it does not compile as written, stop and report. Two points are already known and are not yours to resolve. Transcribe both as written:
  - `CpuInstance` includes `stepInstruction()`. A pending decision (DR-074) may remove it later.
  - `CpuInstance.readState()` returns `CpuStateCopy` with no type argument, while `CpuStateCopy` and `CpuSnapshot` take `TDetails` (DR-078 c, pending).

## Report

Use the format in `docs/engineering/DEFINITION_OF_DONE.md` §6. For each acceptance criterion give the name of the test that covers it. For each validation command give the actual result. Report anything you did not run as not run.
````
