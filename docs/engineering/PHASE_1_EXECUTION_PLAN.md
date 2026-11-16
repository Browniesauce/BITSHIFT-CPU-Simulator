# BITSHIFT — Phase 1 Execution Plan: Simulation Platform Backbone

**Status:** Revised 2026-11-16 after the product owner's decisions on the readiness review. **Every Phase 1 decision is now made; no slice is gated.** Done and approved: 1.1-a, 1.1-b, 1.3-a, 1.3-b, 1.3-d. Next: Batch 2 (Appendix A).
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

| ID       | Decision                                                                                                                                                                                                                            | Slices it governs                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| DR-039   | The installed stack is approved. Nothing further is introduced.                                                                                                                                                                     | All                                                 |
| DR-073   | Five stages, as in section 3. Slice order may be adjusted for fixture and testing dependencies.                                                                                                                                     | All                                                 |
| DR-074   | Cycle-atomic commit. The platform composes instruction steps and batches from `stepClock()`. `CpuInstance.stepInstruction()` is removed. No instruction-level rollback.                                                             | 1.2-b, 1.5-a, 1.4-b, 1.4-c                          |
| DR-075   | The platform `fault` event takes the next free sequence in its cycle.                                                                                                                                                               | 1.4-c                                               |
| DR-076   | A breakpoint stop moves the controller from `running` to `paused`. It is never a fault.                                                                                                                                             | 1.4-e                                               |
| DR-027   | Breakpoints are checked at instruction boundaries during a run only. A step reports `breakpointHit` only when it completed at least one cycle, ended on an instruction boundary, and the program counter is in the set.             | 1.4-e                                               |
| DR-077 a | `load` and `reset` are always allowed with no program. `stepClock`, `stepInstruction` and `beginRun` return `PLT-NO-PROGRAM`. `runBatch` and `endRun` return `PLT-NOT-RUNNING`.                                                     | 1.4-a, 1.4-b, 1.4-d                                 |
| DR-077 b | The `nextState` table in section 7.                                                                                                                                                                                                 | 1.2-a                                               |
| DR-077 c | Update reason: `fault`, else `halt`, else `breakpoint` (batches only), else the request's own reason.                                                                                                                               | 1.4-a to 1.4-e                                      |
| DR-077 d | Any architecture exception gives `PLT-INTERNAL` and an `Ok` result with a `fault` update. `reset` and `load` both replace an unreliable instance. If replacement also throws, the controller stays `faulted`.                       | 1.2-b, 1.4-a, 1.4-c                                 |
| DR-077 e | `runBatch(maxCycles)` needs a positive integer, else `PLT-ARGUMENT`. The argument is checked before the lifecycle state.                                                                                                            | 1.4-d                                               |
| DR-077 f | `StateChange.target` for memory is `memory[<decimal address>]`, no padding.                                                                                                                                                         | 1.3-c                                               |
| DR-077 g | The platform never sets `InstructionRecord.explanation` and never calls `explainInstruction`.                                                                                                                                       | 1.3-c, 1.4-b                                        |
| DR-077 h | Listeners are called in subscription order after the state is committed. A listener exception is not caught, reaches the caller, and never faults the CPU. A state-changing controller call made from inside a notification throws. | 1.4-a                                               |
| DR-078 b | At most one register with role `'output'` and at most one with role `'program-counter'`, else `ARCH-INVALID-DESCRIPTOR`.                                                                                                            | 1.1-c, 1.4-b                                        |
| DR-079   | Confirmed readings: every `RegisterDefinition.bits` is a positive integer (registry check); an empty registry is valid; payloads are frozen in place; `BreakpointSet` does not validate the address width.                          | 1.1-c (first item); the rest already match the code |

**Deferred, not in Phase 1:** DR-078 a (`breakpoints()` accessor, Phase 5). DR-078 c (typing of `details`, Phase 2, in the `unknown` form). **Open, gating nothing in Phase 1:** DR-022, DR-024.

### 2.2 Contract amendments owed

The approved decisions are not yet in the contract documents. Each amendment is written by the slice that implements it, in the same change as the code (CLAUDE.md §6). The lead implementation agent writes contract text; sub-agents do not. Exact wording: PHASE_1_READINESS_REVIEW §1 (DR-075, DR-076, DR-027), §2.6 (DR-074), §3 (DR-077, DR-078 b) and §4 (DR-077 h).

| Decision         | Document and section                                                                                                                                                                                                                                                                                           | Slice           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| DR-074           | MODULE_CONTRACTS §3.2 (remove `stepInstruction()`; rule 1 also leaves `readState()` unchanged). DATA_CONTRACTS §5 invariants 1 and 2. SIMULATION_PLATFORM §2.1 rule 1 and table. CPU_ARCHITECTURE_STRATEGY §3, §4.1, §4.2. SYSTEM_ARCHITECTURE §8.2. TEST_STRATEGY CYC-03 and CYC-05. `src/platform/types.ts`. | Batch 2, step 0 |
| DR-074           | MODULE_CONTRACTS §2.4.1, §2.4.3, §2.4.5 (the controller composes from clock steps; earlier cycles stay counted)                                                                                                                                                                                                | 1.4-b, 1.4-c    |
| DR-078 b, DR-079 | DATA_CONTRACTS §3.2 validation list (register `bits`; role uniqueness). MODULE_CONTRACTS §2.1 (an empty list is valid).                                                                                                                                                                                        | 1.1-c           |
| DR-077 b         | MODULE_CONTRACTS §2.2 (the full table). SIMULATION_PLATFORM §3.1 (`fault` arrows from every state).                                                                                                                                                                                                            | 1.2-a           |
| DR-077 f, g      | EVENT_MODEL §10 (target format; the platform does not set `explanation`)                                                                                                                                                                                                                                       | 1.3-c           |
| DR-077 a, c, h   | MODULE_CONTRACTS §2.4.2 and §2.4.6. SIMULATION_PLATFORM §3.2. DATA_CONTRACTS §7.                                                                                                                                                                                                                               | 1.4-a           |
| DR-075, DR-077 d | EVENT_MODEL §2 fault paragraph. MODULE_CONTRACTS §2.4.5.                                                                                                                                                                                                                                                       | 1.4-c           |
| DR-077 e         | MODULE_CONTRACTS §2.4 (`runBatch` comment and §2.4.1 row)                                                                                                                                                                                                                                                      | 1.4-d           |
| DR-076, DR-027   | SIMULATION_PLATFORM §3.1 and §6. MODULE_CONTRACTS §2.4.1 and §2.4.4.                                                                                                                                                                                                                                           | 1.4-e           |
| DR-079           | EVENT_MODEL §7 (payloads frozen in place). MODULE_CONTRACTS §2.8 (width not validated).                                                                                                                                                                                                                        | 1.4-e           |

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

**Purpose.** The single entry point. Each slice adds one behaviour to a passing controller. Controller tests live in one file per slice (`controller-core.test.ts`, `controller-instruction.test.ts`, and so on).

| Slice | Builds                                                                                                                              | Needs                                       | Contract                                               | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                             | Catalogue                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1.4-a | `controller.ts` core: `createController`, `snapshot`, `subscribe`, `load`, `reset`, `stepClock` (including halt), `readMemory`      | 1.1 to 1.3, 1.5-a; DR-077 a, c, d; DR-077 h | MODULE_CONTRACTS §2.4, §2.4.1–§2.4.3, §2.4.6           | The counter is 0 after load and reset and advances by `cyclesCompleted`. A halt adds no cycle and sets `halted`; later steps return `Ok` with zero cycles. Result errors change nothing and do not call the architecture (spy). The same snapshot object is returned until a change. Listeners run before the call returns. `readMemory` returns a copy and never calls the architecture. An earlier snapshot is unchanged by later steps.      | CYC-01, 02, 04, 07; ERR-02, 04, 05, 06, 07 (halted); SNP-01, 02, 04 |
| 1.4-b | `stepInstruction`; history recording; `history()`                                                                                   | 1.4-a; DR-074; DR-078 b                     | §2.4.1; EVENT_MODEL §6, §10                            | Advances exactly the instruction's cycles. Produces the same snapshots, events and history as the equivalent clock steps. Events in an update are ordered by `(cycle, sequence)`. `historyLimit` is the enforced limit. Eviction leaves delivered snapshots and events untouched.                                                                                                                                                               | CYC-03; EVT-01; HST-04, 06                                          |
| 1.4-c | Fault path and `PLT-INTERNAL` path; recovery on reset and load. Writes the DR-075 sentence into EVENT_MODEL §2.                     | 1.4-b; DR-074; DR-077 d                     | §2.4.5; SIMULATION_PLATFORM §9; DR-070, DR-071, DR-075 | A fault outcome: the counter is unchanged by the faulting step, one platform `fault` event with the next free sequence, state `faulted`, `lastFault` set. Cycles completed earlier in the same call stay counted and published. A throw or a rejected event batch: `PLT-INTERNAL`, the published snapshot is the last committed state, steps return `Ok` with zero cycles until reset, and reset uses a new instance with the program reloaded. | CYC-05, 06; EVT-06; ERR-07 (faulted)                                |
| 1.4-d | `beginRun`, `runBatch`, `endRun`                                                                                                    | 1.4-c; DR-077 c, e                          | §2.4.1, §2.4.2; SIMULATION_PLATFORM §3.2, §5           | Never more than `n` cycles. Stops early on halt or fault with the right reason. The final state does not depend on batch size. Pause and resume continue from the same state. Each run-state error code is returned in the state the contract names.                                                                                                                                                                                            | CYC-08; ERR-03; LCY-02; DET-02                                      |
| 1.4-e | `setBreakpoints`; breakpoint stop in `runBatch`; `breakpointHit` on steps. Writes the DR-076 lines into the two contract documents. | 1.4-d; DR-027                               | §2.4.4; SIMULATION_PLATFORM §6; DR-076                 | A batch stops after the instruction boundary whose program counter is in the set, reports the address with reason `breakpoint`, and leaves the controller `paused` with no fault. The next run continues past it. Steps report without stopping. The set survives load and reset. The fixture receives no breakpoint data.                                                                                                                      | BRK-01, 02, 03, 04 (controller level), 05, 06; CYC-08 (breakpoint)  |

**Step pipeline (DR-074).** Every advancing call follows one order, so that a failure at any point publishes nothing half-done:

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

Work runs in batches. One lead implementation agent owns each batch, delegates bounded tasks to sub-agents, integrates, and runs validation. The supervisor audits each batch before the next starts, and each batch is committed on its own.

| Batch | Slices                                                                             | Shape                                                                                                            |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | 1.1-a, 1.1-b, 1.3-a, 1.3-b, 1.3-d                                                  | Done and approved.                                                                                               |
| 2     | Step 0 (DR-074 contract and type revision), then 1.1-c, 1.2-a, 1.2-b, 1.3-c, 1.5-a | Step 0 first, by the lead. Then five tasks in parallel, each owning its own files. Assignment: Appendix A.       |
| 3     | 1.4-a → 1.4-b → 1.4-c → 1.4-d → 1.4-e                                              | Sequential. All five change `controller.ts`, so they cannot run in parallel. Tests for a slice may be delegated. |
| 4     | 1.5-b, 1.5-c                                                                       | 1.5-b first; its replay helper and determinism tests can be delegated separately.                                |

The assignments for Batches 3 and 4 are written when the batch before them is approved.

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

| Slice | Status                | Verdict                  | Date       | Follow-ups                                                                              |
| ----- | --------------------- | ------------------------ | ---------- | --------------------------------------------------------------------------------------- |
| 1.1-a | Committed (1fb2322)   | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Closed: fillers removed in 1.1-b. Open: narrowing of shared payloads, handled in 1.3-c. |
| 1.1-b | Committed (db6703d)   | APPROVED                 | 2026-11-16 | Closed by DR-079: the register `bits` check goes to 1.1-c; an empty list stays valid.   |
| 1.1-c | Batch 2               | —                        | —          | —                                                                                       |
| 1.2-a | Batch 2               | —                        | —          | —                                                                                       |
| 1.2-b | Batch 2               | —                        | —          | —                                                                                       |
| 1.3-a | Done, awaiting commit | APPROVED WITH FOLLOW-UPS | 2026-11-16 | Neutral register and flag names in `snapshots.test.ts`: done in Batch 2.                |
| 1.3-b | Done, awaiting commit | APPROVED                 | 2026-11-16 | Closed by DR-079: payloads are frozen in place.                                         |
| 1.3-c | Batch 2               | —                        | —          | —                                                                                       |
| 1.3-d | Done, awaiting commit | APPROVED                 | 2026-11-16 | Closed by DR-079: the width is not validated.                                           |
| 1.5-a | Batch 2               | —                        | —          | —                                                                                       |
| 1.4-a | Batch 3               | —                        | —          | —                                                                                       |
| 1.4-b | Batch 3               | —                        | —          | —                                                                                       |
| 1.4-c | Batch 3               | —                        | —          | —                                                                                       |
| 1.4-d | Batch 3               | —                        | —          | —                                                                                       |
| 1.4-e | Batch 3               | —                        | —          | —                                                                                       |
| 1.5-b | Batch 4               | —                        | —          | —                                                                                       |
| 1.5-c | Batch 4               | —                        | —          | —                                                                                       |

---

## Appendix A — Implementation Assignment for Batch 2

Give the text below to the lead implementation agent unchanged. The prompts for the slices already done are in the git history of this file.

````markdown
# BITSHIFT — Phase 1, Batch 2: Step 0 and Slices 1.1-c, 1.2-a, 1.2-b, 1.3-c, 1.5-a

## Roles

You are the **lead implementation agent** (Sonnet). You own decomposition, delegation, integration, validation and the report. Delegate the five slice tasks to Haiku sub-agents (Agent tool, `model: "haiku"`), in parallel, one agent per task, after you have finished Step 0 yourself. If you cannot spawn sub-agents, say so in the report and do the work yourself; never claim delegation that did not happen. You may keep a task yourself if you judge it too subtle to delegate (1.2-b is the likely one); say so in the report.

The engineering supervisor (Fable) audits your diff independently and does not write code. The product owner accepts.

## Prerequisite

`git status` must show a clean tree, with the previous batch (snapshots, events, breakpoints) committed. If it is not clean, stop and report. Do not commit, stage, stash or reset anything yourself.

## Read first

`CLAUDE.md`; `docs/engineering/PHASE_1_EXECUTION_PLAN.md` sections 2, 4, 5 and 7; `docs/engineering/PHASE_1_READINESS_REVIEW.md` sections 2 and 3; `docs/contracts/MODULE_CONTRACTS.md` §2.1 to §2.7 and §3; `docs/contracts/DATA_CONTRACTS.md` §3 to §5 and §11; `docs/contracts/EVENT_MODEL.md` §3, §5, §10; `docs/engineering/TEST_STRATEGY.md` §4 and §5; `docs/engineering/CODING_STANDARDS.md`; the existing code in `src/platform/` and `tests/platform/`.

Where a contract document and the decision register disagree, **the register wins** (the amendments are being written by these slices). All decisions named below are approved.

## Rules for every task

- TypeScript strict. No `any`, enums, default exports, `@ts-ignore`, `@ts-expect-error`, or non-null assertions without a reason on the same line. Explicit return types on exports. `import type` for types. A one-line doc comment citing the contract section on each export.
- Platform modules import only `./result` and `./types`. None of this batch's modules imports another. Nothing in `src/` imports from `tests/`. Do not change `src/platform/index.ts`.
- No forbidden globals in `src/platform` (CODING_STANDARDS §4.2). No new dependency. No configuration change.
- Tests: expected values come from the contract or a hand-written script, never from running the code. Assert on diagnostic codes, never on message text. No BITSHIFT-8 names or sizes: no `'bitshift-8'`, no registers called `A`, `B`, `PC`, `IR`, no flags called `Z`, `C`, `N`, no 256-byte memory. Every test has an assertion that can fail.
- **Stop rule.** If a contract or this assignment admits two behaviours, do not choose silently. Take the narrower literal reading, and list it in the report. Do not invent API.
- Sub-agents write code and tests only. **You** write every documentation change.
- Format only the files you touch (`pnpm exec prettier --write <files>`).

## Step 0 — DR-074 contract and type revision (lead, before delegating)

1. `src/platform/types.ts`: remove `stepInstruction()` and its comment from `CpuInstance`. Nothing else.
2. Apply the amendments numbered 2, 3, 5, 6 and 7 in PHASE_1_READINESS_REVIEW §2.6 to: MODULE_CONTRACTS §3.2 and §3.2 normative rule 1; DATA_CONTRACTS §5 invariants 1 and 2; SIMULATION_PLATFORM §2.1 rule 1 and the table row for the instruction step; CPU_ARCHITECTURE_STRATEGY §3, §4.1 and §4.2; SYSTEM_ARCHITECTURE §8.2; TEST_STRATEGY CYC-03 and CYC-05. Change only the sentences those amendments name. Amendment 1 is already in the register. Amendment 4 (MODULE_CONTRACTS §2.4.x) belongs to Batch 3; do not write it now.
3. Run `pnpm typecheck` and `pnpm test`. Both must pass before you delegate.

## Task A — Slice 1.1-c: registry validation (DR-078 b, DR-079)

Files: `src/platform/registry.ts`, `tests/platform/registry.test.ts`. Docs (lead): DATA_CONTRACTS §3.2 validation list gains two bullets; MODULE_CONTRACTS §2.1 gains "An empty list is valid"; TEST_STRATEGY ERR-08 is unchanged in wording.

Add to `validateDescriptor`, after the register-name check: every `RegisterDefinition.bits` is a positive integer; at most one register has role `'output'`; at most one has role `'program-counter'`. Each failure returns `ARCH-INVALID-DESCRIPTOR`. No upper bound on `bits`.

Tests: `bits` of 0, -1, 1.5 and `NaN` rejected; two `'output'` registers rejected; two `'program-counter'` registers rejected; exactly one of each accepted; none of either accepted. All existing registry tests still pass unchanged.

## Task B — Slice 1.2-a: lifecycle (DR-077 b)

Files: `src/platform/lifecycle.ts`, `tests/platform/lifecycle.test.ts`. Docs (lead): the table into MODULE_CONTRACTS §2.2; `fault` arrows from `ready`, `halted` and `faulted` into the SIMULATION_PLATFORM §3.1 diagram.

```ts
export type LifecycleAction =
  'load' | 'reset' | 'begin-run' | 'end-run' | 'clock-step' | 'instruction-step' | 'halt' | 'fault';

/** Pure transition function (MODULE_CONTRACTS §2.2). */
export function nextState(current: CpuState, action: LifecycleAction): Result<CpuState, Diagnostic>;
```

Implement exactly the 40 cells of PHASE_1_EXECUTION_PLAN section 7. A cell that names a state returns `ok(state)`. A cell that names a code returns `err` with that code and severity `'error'`. Pure, no module state.

Tests: one table in the test file, written by hand from section 7, covering all 40 cells (LCY-01). Assert that the test table has exactly 40 entries.

## Task C — Slice 1.2-b: instance guard (DR-074, DR-077 d, DR-070, DR-071)

Files: `src/platform/instance-guard.ts`, `tests/platform/instance-guard.test.ts`, and `tests/platform/helpers/stub-instance.ts` for small hand-made `CpuInstance` stubs. Do not use the fixture from Task E.

```ts
/** Outcome of a guarded architecture call. */
export type Guarded<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'internal'; readonly diagnostic: Diagnostic };

/** The only holder of a CPU instance; contains architecture exceptions (MODULE_CONTRACTS §2.3, §2.4.5). */
export interface InstanceGuard {
  /** False after an internal failure, until `replace()` succeeds. */
  readonly reliable: boolean;
  loadProgram(image: ProgramImage): Guarded<Result<void, Diagnostic>>;
  reset(): Guarded<void>;
  stepClock(): Guarded<StepOutcome>;
  readState(): Guarded<CpuStateCopy>;
  /** Discards the instance, creates a new one, and reloads the last accepted program. */
  replace(): Guarded<void>;
}

export function createInstanceGuard(architecture: CpuArchitecture): InstanceGuard;
```

Behaviour:

1. `createInstanceGuard` calls `architecture.createInstance()` once. If that throws, the guard is created unreliable.
2. Any exception thrown by an architecture call is caught here and nowhere else. The call returns `internal` with code `PLT-INTERNAL`, severity `'error'`, and a message that includes the thrown value's message. The guard becomes unreliable.
3. While unreliable, `loadProgram`, `reset`, `stepClock` and `readState` do not call the instance. They return `internal` with a `PLT-INTERNAL` diagnostic.
4. `stepClock` checks the outcome against DATA_CONTRACTS §5. It is invalid when: `cyclesCompleted` is not 0 or 1; `events` is not an array; a `fault` is present together with a non-zero `cyclesCompleted`, `halted` true, or any event; an event's `cycleOffset` is not an integer from 1 to `cyclesCompleted`. An invalid outcome is treated exactly like a throw.
5. `loadProgram` returns the architecture's `Result` inside `ok`. When that `Result` is ok, the guard remembers the image as the last accepted program. A rejected load does not change the remembered image and does not make the guard unreliable.
6. `replace()` calls `createInstance()` again and, if a program was accepted earlier, loads it into the new instance. If creation throws, or the reload throws or is rejected, the result is `internal` and the guard stays unreliable. Otherwise the guard is reliable.
7. The guard does not log, count cycles, stamp events, or know about lifecycle state.

Tests (CYC-06 at guard level): a throw from each of the four instance methods; a throwing `createInstance`; no instance call while unreliable (count calls on the stub); each invalid-outcome case in rule 4, one test each; a valid fault outcome and a valid zero-cycle outcome pass through; a rejected load keeps the earlier image; `replace` creates a second instance and reloads the last accepted image; `replace` with no program loads nothing; `replace` that fails stays unreliable.

## Task D — Slice 1.3-c: history and instruction recorder (DR-077 f, g)

Files: `src/platform/history.ts`, `tests/platform/history.test.ts`. Docs (lead): EVENT_MODEL §10 gains the target format and the sentence that the platform does not set `explanation`.

```ts
export interface ExecutionHistory {
  readonly limit: number;
  entries(): readonly InstructionRecord[];
  append(record: InstructionRecord): void;
  clear(): void;
  readonly truncated: boolean;
}
export function createExecutionHistory(limit: number): Result<ExecutionHistory, Diagnostic>;

/** Turns stamped events into instruction records (EVENT_MODEL §10). */
export interface InstructionRecorder {
  /** Feeds events in order. Returns the records completed by these events, oldest first. */
  record(events: readonly ExecutionEvent[]): readonly InstructionRecord[];
  /** Forgets any open instruction and restarts `index` at 0. */
  reset(): void;
}
export function createInstructionRecorder(
  outputRegisterName: string | undefined,
): InstructionRecorder;
```

History (MODULE_CONTRACTS §2.7): a limit that is not a positive integer returns `PLT-ARGUMENT`. `append` evicts the oldest record when the history is at its limit. `truncated` becomes true at the first eviction and false after `clear`. `entries()` returns a frozen array, oldest first, and the same array object until the next `append` or `clear`. Build that array on read and cache it; do not rebuild it on every `append`.

Recorder (EVENT_MODEL §10): the open instruction survives between `record` calls. `instruction-start` opens a record with `address`, `mnemonic` and `startCycle` (the event's cycle). While a record is open, each state-changing event adds one `StateChange`, in order: `register-write` (target is the register name), `flag-update` (target is the flag name), `memory-write` (target is `memory[<address>]` with the address in decimal, for example `memory[16]`), `output-emitted` (target is `outputRegisterName`). `instruction-end` closes the record with `endCycle` and returns it. `index` counts completed records from 0. Records, their `changes` arrays and each change are frozen. A record has no `explanation` key. Every other kind is ignored.

Narrow readings to implement and report: state-changing events with no open instruction are ignored; `instruction-end` with no open instruction is ignored; `instruction-start` while one is open discards the unfinished one; `output-emitted` when `outputRegisterName` is `undefined` adds no change; an event whose payload lacks the fields its kind requires is ignored. Read payloads through type guards, with no casts to `any`.

Tests (HST-01, 02, 03, 05, 07; SNP-03 for records): limit enforced with oldest evicted; `truncated` life cycle; bad limits; stable and frozen `entries()`; a full instruction with all four change kinds in order, expected record written by hand; an instruction split across two `record` calls; an instruction that never ends produces no record; `index` restarts after `reset`; unknown and namespaced kinds ignored; no `explanation` key; frozen at every level.

## Task E — Slice 1.5-a: the fixture architecture (TEST_STRATEGY §4, DR-074)

Files: `tests/platform/fixtures/fixture-architecture.ts` and `tests/platform/fixtures/fixture-architecture.test.ts`. Nothing under `src/`.

The fixture is a **script player**, not a CPU. It has no decoder and no instruction semantics.

```ts
/** One scripted clock cycle. */
export type FixtureCycle =
  | {
      readonly events: readonly { readonly kind: string; readonly payload: unknown }[];
      readonly instructionCompleted?: boolean;
      readonly halted?: boolean;
    }
  | { readonly fault: Diagnostic }
  | { readonly throws: string };

export function createFixtureArchitecture(options: {
  readonly architectureId: string;
  readonly script: readonly FixtureCycle[];
}): CpuArchitecture;

/** A hand-written script that emits every shared kind except `fault`, and one namespaced kind. */
export function defaultScript(architectureId: string): readonly FixtureCycle[];
```

Descriptor: `wordBits` 16, `addressBits` 6, `memoryBytes` 48. Registers: `W` (16 bits, `'general'`), `IP` (6 bits, `'program-counter'`), `OUTR` (4 bits, `'output'`). Flags: `F1`, `F2`. A small ISA with two instructions, unused by the fixture itself. `visualization` returns an empty view model. No `explainInstruction`.

Instance behaviour:

- `loadProgram(image)`: rejects an image whose `architectureId` differs with code `<architectureId>/LOAD-MISMATCH`, and one that does not fit in memory with `<architectureId>/LOAD-RANGE`; a rejected load changes nothing. An accepted load zeroes memory, copies `bytes` at `origin`, zeroes the registers and flags, sets `IP` to `entry`, and rewinds the script.
- `reset()`: restores the state as it was right after the last accepted load, and rewinds the script. Before any load, that is the all-zero state.
- `stepClock()` plays the next script cycle:
  - an `events` cycle completes one cycle. Each event gets `cycleOffset` 1. The fixture applies the state-changing ones to its own state: `register-write`, `flag-update`, `memory-write`, and `output-emitted` (which sets `OUTR`). It returns `cyclesCompleted` 1 with the cycle's `instructionCompleted` and `halted` flags (default false);
  - a `fault` cycle returns `cyclesCompleted` 0, no events, the fault, and changes nothing. The script position does not advance;
  - a `throws` cycle throws an `Error` with that message;
  - past the end of the script, it returns `cyclesCompleted` 0, no events, `halted` true.
- `readState()`: `programCounter` is the value of `IP`. Registers and flags are in descriptor order. Every call returns new arrays, new element objects and a new `Uint8Array`.
- No `stepInstruction`. No cycle counter. No breakpoint input of any kind.

`defaultScript` covers at least three instructions (`instruction-start` … `instruction-end`), the last ending in a `halted` cycle, and uses all eleven emittable shared kinds plus one kind named `<architectureId>/note`. Every state-changing event's `before` must equal the fixture's actual value at that point, and `IP` must change through `register-write` events. Above the script, write a comment table giving the expected `W`, `IP`, `OUTR`, `F1`, `F2` and changed memory bytes after every cycle, worked out by hand.

Tests (SNP-05, CYC-09 runtime): the state after each cycle of `defaultScript` equals the hand-written table; `readState()` shares nothing with the instance or with an earlier `readState()`; no outcome has a `cycle` key or any key beyond the five in `StepOutcome`; a fault cycle leaves `readState()` deeply equal to before and can be repeated; a `throws` cycle throws; load rejections with both codes change nothing; `reset` restores the post-load state and rewinds; two fixtures with different identifiers are independent; the descriptor passes `createArchitectureRegistry`.

## Also in this batch (lead)

`tests/platform/snapshots.test.ts`: rename the register and flag names `A`, `PC`, `Z`, `C` to neutral names (for example `R0`, `P`, `F0`, `F1`). Change nothing else in that file.

## Integration and validation (lead)

1. Read every file your sub-agents wrote, line by line. Fix defects or send them back. You are accountable for correctness.
2. Confirm the file ownership held: each task touched only its own files.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`. All must pass. 194 tests exist before this batch; none may be removed or weakened.
4. Check `git status` and `git diff`: only the files this assignment names have changed.

## Out of scope

`controller.ts`; anything in `src/app`, `src/architectures`, `src/assembler`; `index.ts`; the replay helper and determinism tests (Batch 4); DR-078 a and DR-078 c; any contract sentence not named above.

## Report

In this order: (A) delegation: which agents were actually used, for what, concurrently or not, and anything you kept or rewrote yourself; (B) per task: files, behaviour, tests added; (C) every documentation sentence you changed, with document and section; (D) every reading taken under the stop rule; (E) the actual result of each of the five commands and the total test count; (F) the exact file list for one commit. Report anything not run as not run. Do not approve your own work.
````
