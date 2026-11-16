# BITSHIFT — Module Contracts

**Status:** Stage 0.3 contract. Approved in principle by DR-066 (as amended) and DR-067. These define the public interfaces of each subsystem. They are not implemented.
**Related:** [DATA_CONTRACTS.md](DATA_CONTRACTS.md) (types used here), [EVENT_MODEL.md](EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md)

## 0. How to Read Each Contract

Each public interface lists:

- **Responsibility**: what it is for.
- **Inputs and outputs**: the signature.
- **Errors**: `Result` error codes (DATA_CONTRACTS §11), faults, or none.
- **Ownership**: the module that owns the state.
- **Dependencies**: what it may import or call.
- **Mode**: synchronous or asynchronous. Every interface in this document is **synchronous**. The only asynchrony in BITSHIFT is the UI run loop, which lives in the application layer (§1.4).

Interfaces are kept minimal. A method is included only if a concrete requirement uses it. No abstraction is introduced without one.

Error-class rules apply to every module (SIMULATION_PLATFORM §9):

- A **`Result` error** is a caller mistake or an invalid request. The state is unchanged.
- A **fault** is a simulated CPU condition, reported inside a `StepOutcome`. It is not a `Result` error.
- An **exception** is a programmer error or an invariant violation. The controller converts it into a `PLT-INTERNAL` fault.

---

## 1. Application Layer (`src/app/`, `src/store/`, `src/features/`)

### 1.1 Composition Root

- **Responsibility:** the only place that knows which architectures exist and which architecture is active. Builds the registry, the controller and the assembler binding. Runs once at startup.
- **Inputs:** the architecture list (`src/app/architectures.ts`, DR-057) and `historyLimit` from configuration (DR-024 default, not set here).
- **Outputs:**

```ts
export interface AppServices {
  readonly controller: ExecutionController;
  readonly registry: ArchitectureRegistry;
  readonly assemble: (source: string) => AssemblyResult; // binds the active architecture's ISA
}

export function bootstrap(config: AppConfig): Result<AppServices, Diagnostic>;

export interface AppConfig {
  readonly architectureId: ArchitectureId; // selected here, fixed for the session (SC-D3)
  readonly historyLimit: number;
}
```

- **Errors:** `ARCH-UNKNOWN-ID` if `architectureId` is not registered. Registry validation errors are returned unchanged.
- **Ownership:** application layer. Holds the services for the life of the page.
- **Dependencies:** may import `architectures` (public entries only), `platform`, `assembler`. It is the only module allowed to do so (DEP-06).
- **Mode:** synchronous.

### 1.2 Architecture Registration

Registration is the composition-root list in `src/app/architectures.ts`. It contains one entry per architecture, each imported from its public entry point. Rules:

- Registration is static. There is no runtime discovery and no plugin loading.
- Adding an architecture changes only this list and adds its package and tests (CPU_ARCHITECTURE_STRATEGY §5.4).
- Architecture selection is not switchable at runtime in v1.0 (SC-D3).

### 1.3 Application Persistence (`EditorPersistence`)

```ts
export interface EditorPersistence {
  /** Returns the saved editor text, or the empty string if nothing is saved. */
  load(): Result<string, Diagnostic>;
  save(text: string): Result<void, Diagnostic>;
}
```

- **Responsibility:** keep unsaved editor text between visits in the same browser (DR-048, DR-063). Stores editor text only. It never stores execution state, snapshots, history or breakpoints.
- **Errors:** `APP-PERSISTENCE-UNAVAILABLE` when storage is blocked, full or throws. Every access is wrapped in try and catch. Failure never affects execution; the editor works without persistence and the UI says so.
- **Ownership:** application layer.
- **Dependencies:** browser storage only. No platform, architecture or assembler dependency.
- **Mode:** synchronous.

### 1.4 UI Integration: Subscription Adapter (`src/store/`)

```ts
export interface ControllerStore {
  /** Subscribe to changes of the published snapshot. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
  /** Returns the current published snapshot. Same reference until the state changes. */
  getSnapshot(): CpuSnapshot;
  /** Returns the latest ControllerUpdate events, for event-driven views. */
  getLatestUpdate(): ControllerUpdate | undefined;
}

export function createControllerStore(controller: ExecutionController): ControllerStore;
```

- **Responsibility:** the adapter between the controller and React. Used with React's `useSyncExternalStore` (DR-054, approved) under the constraints of CPU_ARCHITECTURE_STRATEGY §4.4 (SC-28):
  - React stays outside the simulation core. This adapter is in the application layer, and the core does not import it.
  - `getSnapshot` returns the controller's current reference. It never creates a new object per call.
  - The adapter does not copy state. The published objects are already frozen.
- **Errors:** none. Controller errors are returned by the calls that caused them, not through the store.
- **Ownership:** application layer. The controller owns the state.
- **Dependencies:** `ExecutionController`, React (through the hook only, outside this module).
- **Mode:** synchronous. Notifications run after each controller update.

### 1.5 Run Loop (UI-owned timing, DR-058)

- **Responsibility:** while the controller is `running`, call `runBatch(n)` once per animation frame, with `n` from the speed preset (DR-046). Stop by calling `endRun()`.
- **Owner:** application layer, using `requestAnimationFrame`. The simulation core has no timer.
- **Errors:** a `Result` error from a call stops the loop and is shown to the user.
- **Mode:** asynchronous in scheduling only. Each call is synchronous.

---

## 2. Simulation Platform (`src/platform/`)

### 2.1 Architecture Registry

```ts
export interface ArchitectureRegistry {
  readonly architectures: readonly CpuArchitecture[]; // in registration order
  lookup(id: ArchitectureId): Result<CpuArchitecture, Diagnostic>;
}

export function createArchitectureRegistry(
  architectures: readonly CpuArchitecture[],
): Result<ArchitectureRegistry, Diagnostic>;
```

- **Responsibility:** validates the supplied architectures and provides lookup by identifier. It holds no architecture-specific knowledge.
- **Errors:** `ARCH-DUPLICATE-ID` when two entries share an identifier. `ARCH-INVALID-DESCRIPTOR` when a descriptor fails validation (DATA_CONTRACTS §3.2). `ARCH-UNKNOWN-ID` from `lookup`.
- **Ownership:** platform. The list is owned by the composition root.
- **Empty list:** an empty list is valid (DR-079). `architectures` is then empty and every `lookup` returns `ARCH-UNKNOWN-ID`.
- **Dependencies:** platform types only. It imports no architecture module (DEP-01).
- **Mode:** synchronous.

### 2.2 CPU Lifecycle

```ts
// CpuState is defined in DATA_CONTRACTS §4.2 and is not redefined here.

export type LifecycleAction =
  'load' | 'reset' | 'begin-run' | 'end-run' | 'clock-step' | 'instruction-step' | 'halt' | 'fault';

/** Pure transition function. Returns the next state, or an error for a forbidden transition. */
export function nextState(current: CpuState, action: LifecycleAction): Result<CpuState, Diagnostic>;
```

- **Responsibility:** the lifecycle state machine (DR-077 b). The full transition table is below; SIMULATION_PLATFORM §3 gives the diagram.
- **Errors:** `PLT-RUNNING`, `PLT-NOT-RUNNING`, `PLT-ALREADY-RUNNING` for forbidden actions. `PLT-INTERNAL` for a `halt` action in `ready`, `halted` or `faulted`, which a correct controller never requests.

| Action                           | ready             | running               | paused            | halted            | faulted           |
| -------------------------------- | ----------------- | --------------------- | ----------------- | ----------------- | ----------------- |
| `load`                           | ready             | `PLT-RUNNING`         | ready             | ready             | ready             |
| `reset`                          | ready             | ready                 | ready             | ready             | ready             |
| `begin-run`                      | running           | `PLT-ALREADY-RUNNING` | running           | halted            | faulted           |
| `end-run`                        | `PLT-NOT-RUNNING` | paused                | `PLT-NOT-RUNNING` | `PLT-NOT-RUNNING` | `PLT-NOT-RUNNING` |
| `clock-step`, `instruction-step` | paused            | `PLT-RUNNING`         | paused            | halted            | faulted           |
| `halt`                           | `PLT-INTERNAL`    | halted                | halted            | `PLT-INTERNAL`    | `PLT-INTERNAL`    |
| `fault`                          | faulted           | faulted               | faulted           | faulted           | faulted           |

A step taken from `ready` applies the step action first (to `paused`), then `halt` or `fault` if the outcome reports one.

- **Ownership:** platform. Only the controller calls it.
- **Dependencies:** platform types.
- **Mode:** synchronous and pure.

### 2.3 CPU Instance Management

- **Responsibility:** the controller creates exactly one architecture instance, through `architecture.createInstance()`, when it is created. It keeps the reference privately. After an internal exception the instance is replaced (section 2.4, error handling).
- **Ownership:** controller. No other module holds the instance (DEP and SIMULATION_PLATFORM §8).
- **Dependencies:** `CpuArchitecture` (architecture public entry).
- **Mode:** synchronous.

### 2.4 Execution Controller

This is the single public entry point the application uses to drive a CPU.

```ts
export interface ControllerOptions {
  readonly registry: ArchitectureRegistry;
  readonly architectureId: ArchitectureId; // fixed at creation (SC-D3)
  readonly historyLimit: number; // positive integer; the default is DR-024, not set here
}

export function createController(
  options: ControllerOptions,
): Result<ExecutionController, Diagnostic>;

export interface ExecutionController {
  readonly architectureId: ArchitectureId;

  /** The current published snapshot. Frozen. Same object until the state changes. */
  snapshot(): CpuSnapshot;
  /** The instruction history, oldest first. Frozen. Same object until the history changes. */
  history(): readonly InstructionRecord[];

  /** Register a listener for every ControllerUpdate. Returns an unsubscribe function. */
  subscribe(listener: (update: ControllerUpdate) => void): () => void;

  /** Load an assembled program. Errors: PLT-RUNNING, PLT-ARCHITECTURE-MISMATCH, architecture load errors. */
  load(image: ProgramImage): Result<ControllerUpdate, Diagnostic>;
  /** Restore the post-load state. Cannot fail. Allowed in every state. */
  reset(): ControllerUpdate;

  /** Replace the breakpoint set. Errors: PLT-BREAKPOINT-RANGE, PLT-ARGUMENT. */
  setBreakpoints(addresses: readonly Address[]): Result<void, Diagnostic>;

  /** Ready or paused → running. Errors: PLT-NO-PROGRAM, PLT-ALREADY-RUNNING. No effect when halted or faulted (see §2.4.2). */
  beginRun(): Result<ControllerUpdate, Diagnostic>;
  /** Run up to maxCycles clock cycles. Errors: PLT-NOT-RUNNING, PLT-ARGUMENT. */
  runBatch(maxCycles: number): Result<ControllerUpdate, Diagnostic>;
  /** Running → paused. Errors: PLT-NOT-RUNNING. */
  endRun(): Result<ControllerUpdate, Diagnostic>;

  /** Advance exactly one clock cycle. Errors: PLT-RUNNING, PLT-NO-PROGRAM. */
  stepClock(): Result<ControllerUpdate, Diagnostic>;
  /** Advance to the next instruction boundary. Errors: PLT-RUNNING, PLT-NO-PROGRAM. */
  stepInstruction(): Result<ControllerUpdate, Diagnostic>;

  /** Read a memory range as a copy. Error: PLT-MEMORY-RANGE. */
  readMemory(range: MemoryRange): Result<MemoryReadResult, Diagnostic>;
}
```

#### 2.4.1 Operation Semantics

| Operation         | Allowed from                   | Effect                                                                                                    | Cycles completed |
| ----------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------- |
| `load`            | ready, paused, halted, faulted | Clears history and the cycle counter; state → ready; keeps breakpoints                                    | 0                |
| `reset`           | any                            | Restores post-load state; cycle counter → 0; clears history; state → ready; keeps program and breakpoints | 0                |
| `setBreakpoints`  | any                            | Replaces the set                                                                                          | 0                |
| `beginRun`        | ready, paused → running        | Sets state running                                                                                        | 0                |
| `runBatch(n)`     | running                        | Runs up to `n` cycles; stops early on halt, fault or breakpoint                                           | 0 to `n`         |
| `endRun`          | running → paused               | Sets state paused                                                                                         | 0                |
| `stepClock`       | ready, paused                  | Runs one cycle                                                                                            | 0 or 1           |
| `stepInstruction` | ready, paused                  | Runs to the next instruction boundary, or to halt or fault                                                | 0 or more        |

#### 2.4.2 Requests That Cannot Make Progress

- `stepClock`, `stepInstruction` and `beginRun` requested in `halted` or `faulted` return `Ok` with `cyclesCompleted` 0. The state does not change. This is the existing rule (SIMULATION_PLATFORM §3.2).
- `beginRun` requested while `running` returns `PLT-ALREADY-RUNNING`.
- `stepClock` or `stepInstruction` requested while `running` returns `PLT-RUNNING`. The caller must pause first.
- Any step, run or load request with no program loaded returns `PLT-NO-PROGRAM`, except `reset`, which always succeeds.

#### 2.4.3 Cycle Counting (DR-067, approved)

The controller owns the only authoritative cycle counter.

1. The counter is 0 after `reset` and after a successful `load`.
2. The counter increases by exactly `outcome.cyclesCompleted` for each architecture step. It never increases by any other amount.
3. The architecture never reports a cycle number. Events receive their absolute cycle from the controller (EVENT_MODEL §2).
4. **Failed steps do not advance the counter.** This covers all three failure paths:
   - a `Result` error returned before the architecture is called (the architecture is not called);
   - a step whose outcome carries a `fault` (its `cyclesCompleted` is 0 by invariant, DATA_CONTRACTS §5);
   - an exception from the architecture (the controller records `PLT-INTERNAL`; the counter is unchanged).
5. Halt, fault and breakpoint handling never add to the counter. They change lifecycle state or report a breakpoint hit. They do not advance time.
6. The snapshot's `cycle` and every `ControllerUpdate` report the counter value after the call.

#### 2.4.4 Breakpoint Semantics

- Breakpoints are platform data. The architecture never receives them.
- During `runBatch`, the controller compares the snapshot's `programCounter` with the breakpoint set after each instruction boundary. A match stops the batch, and the update's `breakpointHit` carries the address.
- During `stepClock` and `stepInstruction`, the controller does not stop, because a step already completed. If the resulting program counter is in the set, the update reports `breakpointHit`. Whether clock steps should also stop is open (DR-027).

#### 2.4.5 Error Handling Inside the Controller

- `PLT-INTERNAL`: if the architecture throws, the controller sets state `faulted`, records the diagnostic in `lastFault`, emits a `fault` event, and counts no cycle. The instance is treated as unreliable. The controller creates a new instance and reloads the last program on the next `reset`. Until then, step and run requests return `Ok` with 0 cycles.
- The controller never swallows an exception without recording it.

#### 2.4.6 Other Rules

- Synchronous. Each call completes before it returns. The subscriber notifications for that call run before it returns.
- Deterministic (SIMULATION_PLATFORM §5). No timers. No randomness. The result depends only on the sequence of calls.
- `snapshot()` and `history()` return frozen objects. A new object is created only when the underlying state changes.
- The controller is the only holder of the architecture instance.

### 2.5 Event System

Internal to the platform. The contract is in [EVENT_MODEL.md](EVENT_MODEL.md) §2 and §6.

```ts
/** Assigns absolute cycle and sequence to one step's architecture events. Pure. */
export function stampEvents(
  cycleBefore: ClockCycle,
  events: readonly ArchitectureEvent[],
  architectureId: ArchitectureId,
): Result<readonly ExecutionEvent[], Diagnostic>;
```

- **Responsibility:** assigns `cycle` and `sequence`, checks event namespaces (PLT-EVENT-NAMESPACE), and preserves emission order.
- **Errors:** `PLT-EVENT-NAMESPACE` when a namespaced kind does not match the emitting architecture. The controller treats this as an internal fault.
- **Ownership:** platform.
- **Dependencies:** platform types.
- **Mode:** synchronous and pure.

### 2.6 Snapshot Management

```ts
/** Builds a frozen snapshot from an architecture copy and platform-owned fields. Pure. */
export function buildSnapshot<TDetails>(
  copy: CpuStateCopy<TDetails>,
  meta: {
    readonly architectureId: ArchitectureId;
    readonly cycle: ClockCycle;
    readonly state: CpuState;
    readonly lastFault?: Diagnostic;
  },
): CpuSnapshot<TDetails>;
```

- **Responsibility:** copies the architecture copy into a new object, and freezes the snapshot and its arrays. Keeps `memory` as a separate copy.
- **Errors:** none. Invalid copies are the architecture's fault and are caught as `PLT-INTERNAL`.
- **Ownership:** platform.
- **Dependencies:** platform and data types.
- **Mode:** synchronous and pure.

### 2.7 Execution History

```ts
export interface ExecutionHistory {
  readonly limit: number; // positive integer, set at creation
  entries(): readonly InstructionRecord[]; // frozen; oldest first
  append(record: InstructionRecord): void; // evicts the oldest record when at the limit
  clear(): void;
  /** True once any record has been evicted in this run. Drives the "earlier entries removed" notice. */
  readonly truncated: boolean;
}

export function createExecutionHistory(limit: number): Result<ExecutionHistory, Diagnostic>;
```

- **Responsibility:** bounded, forward-only storage of instruction records (DR-056 requirements 1–3). `append` is the only write path. Eviction, `clear` and reset never change the snapshot or events already delivered.
- **Errors:** `PLT-ARGUMENT` when `limit` is not a positive integer.
- **Ownership:** platform, owned by the controller.
- **Dependencies:** `InstructionRecord` type (EVENT_MODEL §10).
- **Mode:** synchronous.

### 2.8 Breakpoint Management

```ts
export interface BreakpointSet {
  replace(addresses: readonly Address[], addressBits: number): Result<void, Diagnostic>;
  has(address: Address): boolean;
  readonly addresses: readonly Address[]; // sorted ascending
}

export function createBreakpointSet(): BreakpointSet;
```

- **Responsibility:** the address set and its validation. `replace` rejects any address outside `[0, 2^addressBits)`, and leaves the old set unchanged on error.
- **Errors:** `PLT-BREAKPOINT-RANGE`, `PLT-ARGUMENT` (non-integer).
- **Ownership:** platform, owned by the controller.
- **Dependencies:** platform types.
- **Mode:** synchronous.

---

## 3. Architecture Implementations (`src/architectures/<id>/`)

### 3.1 CPU Architecture

```ts
export interface CpuArchitecture {
  /** Data-only descriptor (DATA_CONTRACTS §3.2). */
  readonly descriptor: ArchitectureDescriptor;
  /** Creates a fresh instance in its post-reset state. The only factory (DR-015, SC-13). */
  createInstance(): CpuInstance;
  /** Visualization adapter, supplied to the view layer as a value (DR-062). */
  readonly visualization: VisualizationAdapter;
  /** Optional explanation text for a completed instruction (DR-061). Pure. Never on the execution path. */
  explainInstruction?(record: InstructionRecord): string | undefined;
}
```

- **Responsibility:** packages one architecture: its descriptor, factory, visualization adapter and optional explanations.
- **Errors:** none at this boundary.
- **Ownership:** architecture package. Only `index.ts` is exported (DEP-02).
- **Dependencies:** platform types only (DEP-02).
- **Mode:** synchronous.

### 3.2 CPU Instance

```ts
export interface CpuInstance {
  /** Returns the architecture to its post-load state, with the loaded program intact. */
  reset(): void;
  /** Validates and loads a program image. Returns a Result error if it does not fit or does not match. */
  loadProgram(image: ProgramImage): Result<void, Diagnostic>;
  /** Executes one clock cycle, or reports a fault. Never advances any platform counter. */
  stepClock(): StepOutcome;
  /** Returns a copy of the externally visible state. Shares no mutable object with the instance. */
  readState(): CpuStateCopy;
}
```

- **Responsibility:** the live, mutable CPU. Implements fetch, decode and execute internally. Reports what it did in `StepOutcome`.
- **Inputs and outputs:** as above. `readState` never fails.
- **Errors:** `loadProgram` returns `Result` errors in the architecture's namespace, for example architecture-namespaced codes (`<architecture-id>/<CODE>`, DATA_CONTRACTS §11) defined in Phase 2. Faults are reported in `StepOutcome.fault`, not as errors.
- **Ownership:** architecture instance owns its internal state completely. The controller is the only caller.
- **Dependencies:** platform types. Architecture-internal modules (ALU, decoder, micro-operation sequencer) are private to the package.
- **Mode:** synchronous. Not re-entrant. Single-threaded.

**Architecture-private operations** (not part of this contract): ALU operations, instruction decoding, micro-operation sequencing, internal latches and the mapping of internal state into `CpuStateCopy.details`. Their shape is a Phase 2 concern and depends on DR-011 and DR-013 (internal representation). This contract does not decide them.

**Normative rules for implementers:**

1. A step that faults returns `cyclesCompleted` 0, no events and `fault` set (DATA_CONTRACTS §5). A step that faults also leaves `readState()` unchanged.
2. `readState` returns fresh arrays and a fresh `memory` copy every call.
3. The instance does not log in normal operation and does not read the clock.
4. Program memory writes come only from `loadProgram` (DR-029).

### 3.3 Optional Instruction Explanation

Part of `CpuArchitecture` (section 3.1). Covered here for the rules:

- Input: an `InstructionRecord` (EVENT_MODEL §10). Output: text or `undefined`.
- It is pure. It runs only when the timeline displays an entry.
- A missing explanation shows the generic fallback text in the UI. It never blocks execution, and execution results never depend on it (DR-061).

### 3.4 Visualization Adapter (architecture)

```ts
export interface VisualizationAdapter {
  /** Maps a snapshot and the latest cycles' events to a datapath view model. Pure. */
  toDatapath(snapshot: CpuSnapshot, recentEvents: readonly ExecutionEvent[]): DatapathViewModel;
}
```

- **Responsibility:** the architecture-specific datapath layout and state mapping (DATA_CONTRACTS §12).
- **Errors:** none. An adapter that cannot map a value returns the last good view model through its caller; it never mutates state.
- **Ownership:** architecture package.
- **Dependencies:** platform types only.
- **Mode:** synchronous and pure.

`describeEvent` is not part of the adapter. Timeline text comes from `explainInstruction` (SC-26).

---

## 4. Assembler (`src/assembler/`)

### 4.1 Assembler Interface

```ts
export function assemble(source: string, isa: IsaDescriptor): AssemblyResult;
```

- **Responsibility:** converts source text to a `ProgramImage` using the instruction set supplied as data. Returns diagnostics for every problem it finds.
- **Inputs:**
  - `source`: the editor text, any string, including empty.
  - `isa`: the instruction-set descriptor. Its `architectureId` is the identity of the result (DATA_CONTRACTS §3.1). No separate architecture argument exists (SC-30).
- **Outputs:** `AssemblyResult`, which is either `ok` with the program, its warnings and its symbols, or `not ok` with diagnostics. Machine code is in `program.bytes`. Symbols are in `program.symbols`. The source map is in `program.sourceMap`.
- **Errors:** every error is a `Diagnostic` in the result, with a `SourceSpan` where the problem is in the source. The function never throws for user input.
- **Ownership:** the result is a fresh value owned by the caller.
- **Dependencies:** platform types and the `IsaDescriptor` data type. It imports no architecture module (DEP-03).
- **Mode:** synchronous and pure. Same input, same output. No I/O. No access to any CPU instance or controller.

### 4.2 Processing Stages (internal)

| Stage             | Input                            | Output                           | Diagnostics                           |
| ----------------- | -------------------------------- | -------------------------------- | ------------------------------------- |
| Lexical analysis  | text                             | tokens with spans                | invalid characters, malformed numbers |
| Parsing           | tokens                           | instruction lines and directives | unknown mnemonic, wrong operand shape |
| Validation        | parsed lines and `IsaDescriptor` | checked lines                    | operand out of range, unknown variant |
| Symbol resolution | checked lines                    | address for each label           | undefined or duplicate label          |
| Encoding          | resolved lines                   | bytes and source map             | byte ranges beyond the memory size    |

Stages are internal and each is tested alone (TEST_STRATEGY §4). Their concrete rules, directives and output syntax are open (DR-019, DR-020, Phase 3).

### 4.3 Failure Guarantee

A failed assembly returns diagnostics and has no effect on any CPU, controller or store. The UI keeps the previously loaded program. A rejected load leaves the CPU unchanged (MVP-005).

---

## 5. Visualization (`src/visualization/`)

All visualization modules are pure functions of their inputs. None accesses an instance, a controller or the simulation core directly. Their inputs are snapshots, events and history records that the application passes in.

| Function                 | Input                                   | Output                     | Notes                                                                            |
| ------------------------ | --------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `buildRegisterView`      | `CpuSnapshot`, cycle events             | `readonly RegisterView[]`  | `changed` is true for registers named by `register-write` events in those cycles |
| `buildMemoryView`        | `CpuSnapshot`, cycle events             | `MemoryView`               | `highlighted` comes only from `memory-read` and `memory-write` events            |
| `buildControlSignalView` | cycle events                            | `ControlSignalView`        | Names from `micro-operation` events only (SC-18)                                 |
| `buildTimelineView`      | `readonly InstructionRecord[]`          | `readonly TimelineEntry[]` | Forward-only list; includes the truncation notice                                |
| Datapath                 | adapter (section 3.4), snapshot, events | `DatapathViewModel`        | The adapter is supplied as a value (DR-062)                                      |

- **Errors:** none. Unknown event kinds are ignored (EVENT_MODEL §9).
- **Ownership:** visualization owns no simulation state.
- **Dependencies:** platform and data types only. No architecture module (DEP-04).
- **Mode:** synchronous and pure.

**Rule:** visualization never invents a state change to make an animation look right. Every highlight, active signal or moving bus traces back to a snapshot field or a platform event (PRIN-03).

---

## 6. Workbench and Debugger (`src/features/`, `src/components/`)

These modules are the user-facing layer. They use the store (section 1.4), the controller interface, the assembler and the view functions. They never call the architecture directly (DEP-05).

### 6.1 Editor Integration

```ts
export interface EditorModel {
  readonly text: string;
  readonly markers: readonly Diagnostic[]; // from the most recent AssemblyResult
}
```

- **Responsibility:** holds editor text, calls `assemble` on the user's request, and shows diagnostics as markers. On success, it passes the program to `controller.load`.
- **Errors:** an assembly failure is shown as diagnostics. A load failure is shown as the returned `Diagnostic`.
- **Ownership:** editor component state, with text persisted through `EditorPersistence` (section 1.3).
- **Mode:** synchronous.

### 6.2 Execution Controls

- **Responsibility:** one control per controller intent: load, reset, step clock, step instruction, begin run, end run, and the speed preset that sets `n` for `runBatch`.
- **Rule:** each control issues exactly one controller call per activation (DEVELOPMENT_ROADMAP Stage 5.2 acceptance criteria).
- **Errors:** a `Result` error is shown to the user and no state is assumed changed.
- **Mode:** synchronous calls. The run loop is section 1.5.

### 6.3 Simulation Subscriptions

- **Responsibility:** the components subscribe through `ControllerStore` (section 1.4). They read snapshot, history and latest update. They never write to them.
- **Ownership:** read-only consumers.

### 6.4 Debugging Interfaces

- **Responsibility:** breakpoint toggles (sent to `setBreakpoints` with the full set), the halt and fault banners (from `snapshot().state` and `snapshot().lastFault`), and the timeline view (`buildTimelineView`).
- **Rule:** breakpoints are the single set the controller holds. The UI keeps no separate copy that could diverge.
- **Errors:** `PLT-BREAKPOINT-RANGE` is shown next to the toggle.

---

## 7. Ownership Summary

| Contract                                  | Owner                     | Consumers                          | Changed by                                       |
| ----------------------------------------- | ------------------------- | ---------------------------------- | ------------------------------------------------ |
| `ArchitectureDescriptor`, `IsaDescriptor` | Architecture package      | Registry, assembler, visualization | Architecture owner, with a register entry        |
| `CpuArchitecture`, `CpuInstance`          | Architecture package      | Platform controller only           | Architecture owner                               |
| `VisualizationAdapter`                    | Architecture package      | Visualization, application         | Architecture owner                               |
| `ArchitectureRegistry`                    | Platform                  | Composition root                   | Platform owner                                   |
| `ExecutionController`                     | Platform                  | Application, workbench             | Platform owner, with an ADR for breaking changes |
| `ExecutionHistory`, `BreakpointSet`       | Platform                  | Controller, view functions         | Platform owner                                   |
| `assemble`                                | Assembler                 | Editor, composition root           | Assembler owner                                  |
| `EditorPersistence`, `ControllerStore`    | Application layer         | Editor, components                 | Application owner                                |
| Shared data types                         | Platform (DATA_CONTRACTS) | Every module                       | ADR for breaking changes                         |

Module owners are the people or agent role responsible for review. See [CODING_STANDARDS.md](../engineering/CODING_STANDARDS.md) §3.
