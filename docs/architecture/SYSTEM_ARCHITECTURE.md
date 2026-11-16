# BITSHIFT — System Architecture

**Status:** Proposed (B). Requires product-owner approval before Phase 1 begins.
**Related:** [SIMULATION_PLATFORM.md](SIMULATION_PLATFORM.md), [CPU_ARCHITECTURE_STRATEGY.md](CPU_ARCHITECTURE_STRATEGY.md), [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md), [ADR-001](../decisions/ADR-001-modular-simulation-platform.md)

---

## 1. Architectural Principles

These principles come from the product brief (A) unless marked otherwise.

1. **Simulation is independent of presentation (A).** CPU execution code never imports React, the DOM or any UI library.
2. **Simulation is deterministic (A).** Identical programs and inputs produce identical snapshots and events. The simulation does not read wall-clock time or random numbers.
3. **UI does not modify CPU internals (A).** The UI sends intents (run, step, reset, set breakpoint) to the execution controller and reads immutable snapshots.
4. **Typed snapshots and events (A).** Data crossing a subsystem boundary is an explicitly typed value, not a live object reference.
5. **Each architecture owns its hardware semantics (A).** Shared infrastructure does not assume identical registers, word sizes or instruction formats.
6. **Minimal abstraction (B).** Prefer plain modules and TypeScript interfaces over plugin frameworks, dependency-injection containers or microservices.
7. **No backend in v1 (A).** Everything runs in the browser.

## 2. Major Subsystems

The brief defines five areas. Each maps to a directory under `src/`.

| Area                            | Directory                                                    | Owns                                                                                                                  | Does not own                           |
| ------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A. Application layer            | `src/app/`, `src/features/`, `src/components/`, `src/store/` | Layout, navigation, workbench panels, user preferences, UI state, connection of UI to the controller                  | CPU logic, assembly rules              |
| B. Simulation platform          | `src/platform/`                                              | Architecture registry, CPU lifecycle, execution controller, event bus, snapshot history, breakpoints                  | Any CPU's registers or instructions    |
| C. Architecture implementations | `src/architectures/<id>/`                                    | Registers, memory layout, ALU, decoding, micro-operations, execution semantics, ISA descriptor, visualization adapter | UI rendering, generic execution loop   |
| D. Assembler                    | `src/assembler/`                                             | Lexing, parsing, label resolution, encoding through an architecture's ISA descriptor, diagnostics, source maps        | Execution                              |
| E. Visualization                | `src/visualization/`                                         | SVG datapath, animations, view models derived from snapshots and events                                               | Mutating CPU state, deciding behaviour |

Shared support code (for example typed `Result` helpers) lives in `src/platform/` and must stay small.

## 3. Responsibilities and Boundaries

### 3.1 Dependency Rules

```
 src/app, src/features, src/components
          │  (may import)
          ▼
 src/store  ───────────────►  src/visualization
          │                         │
          ▼                         ▼
 src/platform  ◄──────────  src/architectures/<id>
          ▲                         ▲
          └──────── src/assembler ──┘
```

Rules (B, enforced by review until lint tooling is approved, see DR-021):

- `src/platform` imports no architecture, no assembler, no UI module.
- `src/architectures/<id>` imports `src/platform` contracts only. It never imports another architecture.
- `src/assembler` imports the ISA descriptor of the target architecture and `src/platform` contracts. It never imports execution internals.
- `src/visualization` consumes snapshots, events and view-model adapters. It never holds a reference to a live CPU instance.
- `src/app` and `src/features` may import any module through its public entry point, but simulation logic must not be written inside them.
- Only `src/store` subscribes to the execution controller on behalf of the UI.

### 3.2 Boundary Summary

| Boundary                     | Crosses as                                                           | Direction                   |
| ---------------------------- | -------------------------------------------------------------------- | --------------------------- |
| UI → Controller              | Intent calls (`run`, `stepMicroOperation`, `reset`, `setBreakpoint`) | UI calls controller         |
| Controller → UI              | Immutable snapshot plus batch of execution events                    | Controller notifies store   |
| Assembler → Platform         | `AssemblyResult` containing a `ProgramImage`                         | Pure function output        |
| Platform → Architecture      | `CpuInstance` interface                                              | Platform calls architecture |
| Architecture → Visualization | `CpuSnapshot` and `ExecutionEvent` values                            | Adapter reads               |

Full type definitions are in [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md) and [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md).

## 4. Data Flow

### 4.1 Program Load

```
Editor text ──► Assembler ──► ProgramImage ──► ExecutionController.load() ──► CpuInstance.loadProgram()
                    │
                    └──► Diagnostics ──► Store ──► Editor markers
```

### 4.2 Execution

```
User intent (step / run)
   │
   ▼
ExecutionController ──► CpuInstance.stepMicroOperation()
   │                          │
   │                          ├── ExecutionEvent[] (typed)
   │                          └── (instance state updated internally)
   ▼
CpuSnapshot (immutable copy) + events
   │
   ▼
Store (Zustand, to be approved) ──► Visualization adapter ──► SVG datapath / panels
```

Key point: the instance mutates its own state. Everything that leaves the platform is a copy.

## 5. Execution Model (summary)

Execution is organised around the **clock-level micro-operation** as the smallest observable step. An instruction-level step runs micro-operations until the instruction completes. A run repeats steps until halt, fault or breakpoint. Details are in [SIMULATION_PLATFORM.md](SIMULATION_PLATFORM.md) (B).

## 6. UI and Simulation Communication

- The controller is a plain TypeScript object with no React dependency.
- React components subscribe through a store adapter (Phase 5). They never call `CpuInstance` methods directly.
- Animation runs on the UI side. The simulation advances in discrete steps and never waits on animation frames. The UI may queue steps for playback, but the simulation's results do not depend on frame timing (A, determinism).

## 7. Scaling Considerations

| Concern            | v1.0 approach (B)                                                        | Later option (not decided)                                               |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| History size       | Bounded ring buffer of snapshots and events (DR-024)                     | Persistent history for reverse execution (v2)                            |
| Long runs          | Run loop yields to the UI between batches of steps                       | Web Worker execution, if the performance targets in DR-031 cannot be met |
| More architectures | Separate packages under `src/architectures/`                             | Lazy loading per architecture                                            |
| More views         | Visualization reads view models, so new panels add no simulation changes | Plug-in panels (not planned)                                             |

Each scaling item that is not v1.0 is a candidate for an ADR, not a silent change.

## 8. Known Risks

| Risk                                                    | Mitigation                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform abstractions drift toward BITSHIFT-8 specifics | Platform types use generic register lists and flag lists (DATA_CONTRACTS). Phase 1 uses a test-only fixture architecture to prove the contracts. |
| UI state and CPU state diverge                          | Store holds only snapshots copied from the controller. Tests check that the store never retains a live instance.                                 |
| Event volume slows the UI                               | Events are batched per controller notification. Timeline is bounded (DR-024).                                                                    |
| Ambiguous ISA semantics block Phase 2                   | Phase 2 starts only after the ISA decisions in [BITSHIFT-8_ISA.md](../specifications/BITSHIFT-8_ISA.md) are approved.                            |
