# BITSHIFT — Module Contracts

**Status:** Proposed contracts (B). Architectural contracts, not implemented modules.
**Related:** [DATA_CONTRACTS.md](DATA_CONTRACTS.md), [EVENT_MODEL.md](EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md)

Each contract lists the module that owns it, its public methods, and what callers may and may not assume.

---

## 1. CPU Architecture

**Owner:** `src/architectures/<id>/index.ts`
**Purpose:** Provides the descriptor and instance factory for one CPU.

```ts
export interface CpuArchitecture {
  readonly descriptor: ArchitectureDescriptor;
  createInstance(): CpuInstance;
  /** Optional: visualization adapter for this architecture. */
  readonly visualization: VisualizationAdapter;
}
```

Rules:

- Exposes only `index.ts` to the rest of the app.
- Must not hold mutable module-level state. Each instance has its own state.

## 2. CPU Instance

**Owner:** architecture package (implements the interface).
**Purpose:** The live, mutable CPU. Only the execution controller calls it.

```ts
export interface CpuInstance {
  readonly architectureId: ArchitectureId;
  reset(): void;
  loadProgram(image: ProgramImage): Result<void>;
  /** Advances by one clock-level micro-operation. Returns events produced. */
  stepMicroOperation(): StepOutcome;
  /** Advances until the current instruction completes, halts or faults. */
  stepInstruction(): StepOutcome;
  snapshot(): CpuSnapshot;
  readMemory(range: MemoryRange): MemoryReadResult;
}

export interface StepOutcome {
  readonly events: readonly ExecutionEvent[];
  readonly state: CpuState;
  readonly instructionCompleted: boolean;
}
```

Rules:

- A CPU instance is single-threaded and must not be called re-entrantly.
- `stepMicroOperation` and `stepInstruction` return `StepOutcome` with `events` empty when the CPU is halted or faulted.
- `snapshot()` must return a copy. Callers may keep it indefinitely.
- The instance never calls UI code, never logs to the console in normal operation, and never reads the clock.
- Writing to memory from outside is not part of this contract in v1.0. Program loading goes through `loadProgram` only (DR-029 on memory editing from the UI).

## 3. Execution Controller

**Owner:** `src/platform/` (controller module).
**Purpose:** Single entry point for the application to control a CPU.

```ts
export interface ExecutionController {
  readonly state: CpuState;
  readonly snapshot: CpuSnapshot; // latest copy

  selectArchitecture(id: ArchitectureId): Result<void>;
  load(image: ProgramImage): Result<void>;
  reset(): void;

  stepMicroOperation(): void;
  stepInstruction(): void;
  run(): void;
  pause(): void;

  setBreakpoints(addresses: readonly Address[]): void;

  subscribe(listener: ControllerListener): Unsubscribe;
}

export interface ControllerListener {
  (update: ControllerUpdate): void;
}

export interface ControllerUpdate {
  readonly snapshot: CpuSnapshot;
  readonly events: readonly ExecutionEvent[]; // events since last update, in tick order
  readonly reason: 'step' | 'run-batch' | 'reset' | 'load' | 'breakpoint' | 'halt' | 'fault';
}

export type Unsubscribe = () => void;
```

Rules:

- Methods are fire-and-forget. Results appear through `subscribe`. This keeps the controller usable without React and keeps run mode batched.
- `run()` returns immediately. Batches are scheduled by the controller's own loop, which the UI can stop with `pause()`.
- `setBreakpoints` replaces the set; it does not add to it.
- The controller is the only holder of a `CpuInstance`.

## 4. Assembler

**Owner:** `src/assembler/`
**Purpose:** Converts source text to a `ProgramImage` using an ISA descriptor.

```ts
export interface Assembler {
  assemble(source: string, isa: IsaDescriptor, architectureId: ArchitectureId): AssemblyResult;
}
```

Rules:

- Pure function: same input gives same output. No I/O.
- Never throws for bad user input. Errors are returned as diagnostics.
- Each stage (lex, parse, resolve labels, encode) is internal, and each is testable on its own (see [TEST_STRATEGY.md](../engineering/TEST_STRATEGY.md)).
- Diagnostics always carry a `SourceSpan` when they relate to source text.

Output-format and directive syntax are open (DR-019 and DR-020).

## 5. Memory Inspection

**Owner:** the architecture implements; the platform exposes through the controller.
**Purpose:** Read-only access to memory for inspectors and the timeline.

```ts
export interface MemoryInspector {
  read(range: MemoryRange): MemoryReadResult;
  /** Addresses changed by the most recent step, for highlighting. */
  recentlyWritten(): readonly Address[];
  recentlyRead(): readonly Address[];
}
```

Rules:

- Inspection never mutates memory and never advances the CPU.
- Ranges outside the architecture's memory return a diagnostic, not a clamped result (B).

## 6. Visualization Adapter

**Owner:** `src/architectures/<id>/visualization.ts` (implements); `src/visualization/` (consumes).
**Purpose:** Converts snapshot and events to a view model.

```ts
export interface VisualizationAdapter {
  toDatapath(snapshot: CpuSnapshot, recentEvents: readonly ExecutionEvent[]): DatapathViewModel;
  /** Human-readable label for an event, used by the timeline. */
  describeEvent(event: ExecutionEvent): string;
}
```

Rules:

- Pure. Given the same inputs, returns the same view model.
- Does not access the CPU instance or the controller.
- The shared visualization layer does not know architecture names.

## 7. Store Adapter (Application layer)

**Owner:** `src/store/` (Phase 5).
**Purpose:** Holds UI-facing copies of controller output. Components read from here.

Rules:

- Stores snapshots and event batches. Never stores a `CpuInstance` or controller reference in state.
- Dispatches intents to the controller. Components do not call `CpuInstance` directly.
- Store shape is decided in Phase 5 (DR-035 on whether Zustand is introduced earlier).

## 8. Ownership Summary

| Contract             | Owner module                    | Consumers               | May be changed by                             |
| -------------------- | ------------------------------- | ----------------------- | --------------------------------------------- |
| CpuArchitecture      | architectures/<id>              | platform registry       | Architecture owner, with platform review      |
| CpuInstance          | architectures/<id>              | platform controller     | Architecture owner                            |
| ExecutionController  | platform                        | store, app              | Platform owner, with ADR for breaking changes |
| Assembler            | assembler                       | app/features            | Assembler owner                               |
| MemoryInspector      | architectures/<id> via platform | visualization, features | Platform owner                                |
| VisualizationAdapter | architectures/<id>              | visualization           | Architecture owner                            |
| Shared data types    | platform                        | everyone                | Requires ADR                                  |

Ownership is by module, and module owners are the people or agent role responsible for review. See [CODING_STANDARDS.md](../engineering/CODING_STANDARDS.md).
