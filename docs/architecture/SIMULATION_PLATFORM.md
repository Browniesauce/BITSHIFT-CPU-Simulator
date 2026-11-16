# BITSHIFT — Simulation Platform

**Status:** Proposed (B), except where marked (A).
**Owner module:** `src/platform/`
**Related:** [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md)

The simulation platform standardises how the application interacts with any CPU. It does not define how any CPU works.

---

## 1. Responsibilities

| #   | Responsibility                | Notes                                                                    |
| --- | ----------------------------- | ------------------------------------------------------------------------ |
| P-1 | Architecture registry         | Lists available architectures and creates instances.                     |
| P-2 | CPU lifecycle                 | Create, load program, reset, halt, fault.                                |
| P-3 | Execution control             | Step by micro-operation, step by instruction, run, pause.                |
| P-4 | Breakpoints                   | Address-based breakpoints checked by the controller (not by the CPU).    |
| P-5 | Event handling                | Collects typed events from the CPU and publishes batches to subscribers. |
| P-6 | Snapshots                     | Produces immutable copies of CPU state on request.                       |
| P-7 | History                       | Keeps a bounded history of snapshots and events for the timeline.        |
| P-8 | Shared result and error types | Small utilities used by all subsystems.                                  |

The platform does **not**: decode instructions, perform arithmetic, know register names beyond the generic register list, or render anything.

## 2. Lifecycle

### 2.1 States (B)

States: `ready`, `running`, `paused`, `halted`, `faulted` (as `CpuState` in DATA_CONTRACTS).

| From                           | Action                             | To      | Condition                                             |
| ------------------------------ | ---------------------------------- | ------- | ----------------------------------------------------- |
| (none)                         | create                             | ready   | Instance created                                      |
| ready, paused                  | run                                | running | Program loaded                                        |
| running                        | pause                              | paused  | User request or batch boundary                        |
| ready, paused                  | step micro-operation / instruction | paused  | Instruction or micro-operation completes without halt |
| running, paused                | HLT executed                       | halted  | Architecture reports halt                             |
| running, paused                | illegal state                      | faulted | Architecture or controller reports fault              |
| halted, faulted                | reset                              | ready   | Program stays loaded                                  |
| ready, paused, halted, faulted | load program                       | ready   | Load succeeds; rejected loads leave state unchanged   |
| any                            | reset                              | ready   | Program stays loaded                                  |

Rules:

- `reset` is allowed from every state and returns the instance to READY with its loaded program intact.
- `loadProgram` is allowed from every state except RUNNING. The controller pauses first if needed.
- HALTED and FAULTED accept `reset` and `loadProgram` only. Step requests return the current state with no event (B).

### 2.2 Execution Granularity (B)

| Granularity                   | Definition                                                          | Used by                                |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Micro-operation (clock-level) | One atomic register transfer or ALU operation within one clock tick | Clock-level stepping                   |
| Instruction                   | All micro-operations for one fetch–decode–execute sequence          | Instruction stepping, timeline entries |
| Run                           | Repeated instruction steps until halt, fault, breakpoint or pause   | Run button                             |

The number of micro-operations per instruction is defined by each architecture and is an open item for BITSHIFT-8 (DR-011).

## 3. Determinism (A)

- The controller advances only on explicit calls. It has no internal timers.
- Run mode is implemented as a loop of bounded batches. Batch size is a controller parameter, not a timing parameter, so the result of N steps does not depend on how long each batch took.
- Tick counters are the only notion of time in the simulation.
- No `Math.random`, `Date.now`, `performance.now` or unseeded iteration over unordered structures inside `src/platform` or `src/architectures`.

## 4. Breakpoints (B)

- A breakpoint is an address (for BITSHIFT-8, 0–255).
- The controller checks the program counter after each instruction boundary during run mode.
- Breakpoints are platform data, not CPU data. The CPU does not know they exist.
- Whether a breakpoint also triggers during clock-level stepping is an open item (DR-027).

## 5. Event Handling

- The CPU returns the events produced by each step (see [EVENT_MODEL.md](../contracts/EVENT_MODEL.md)).
- The controller stamps each event with the controller tick and forwards batches to subscribers.
- Events are not retained by the CPU. Retention is the platform's job (section 6).

## 6. History and Snapshots (B, with open items)

| Item                | Proposal                                                                                         | Status                           |
| ------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| Snapshot creation   | Snapshot is produced on demand by `CpuInstance.snapshot()` and copied, never shared              | Proposed                         |
| Timeline storage    | Bounded ring buffer of instruction-level entries (instruction address, mnemonic, events summary) | Proposed; capacity open (DR-024) |
| Clock-level history | Not stored in v1.0 beyond the current instruction                                                | Proposed                         |
| Backward navigation | Not in v1.0 (reverse execution is v2.0)                                                          | Agreed with scope                |

The timeline in v1.0 is a forward-only log for reading. It must not be presented as reverse execution.

## 7. Error Handling in the Platform (B)

| Situation                                 | Behaviour                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Architecture reports an illegal state     | Controller moves to FAULTED, emits a `fault` event with a diagnostic, and stops advancing.                                  |
| Program load rejected by the architecture | Returns a `Result` error. State does not change.                                                                            |
| Unknown architecture ID requested         | Returns a `Result` error. No instance is created.                                                                           |
| Unexpected exception inside a CPU         | Caught at the controller boundary, converted to a FAULTED state with the message, and logged to the console in development. |

Errors are values (`Result`) at API boundaries. Exceptions are reserved for programmer errors (see [CODING_STANDARDS.md](../engineering/CODING_STANDARDS.md)).

## 8. Performance Notes

- Snapshot copies should be proportional to the state size. For BITSHIFT-8 (256 bytes of RAM and a handful of registers), a full copy per step is acceptable and simplifies correctness. This must be verified against DR-031.
- Event batches are small and bounded per instruction.
- The UI must not re-render on every micro-operation during a run. The store publishes at a bounded rate, decided with the UI (Phase 5).

## 9. Non-Responsibilities

- Rendering, animation and layout (visualization and app layers).
- Assembly rules (assembler).
- Persistence or sharing (out of v1.0).
