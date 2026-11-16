# BITSHIFT — Data Contracts

**Status:** Stage 0.3 contract. Approved in principle by DR-066 (as amended) and DR-067 (platform-owned cycle counting). These are architectural contracts, not implemented modules. The TypeScript is normative for shape and ownership; it is not yet in the codebase.
**Related:** [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md), [EVENT_MODEL.md](EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

**Source tags:** items are either _approved_ (decision register reference given), or _boundary_ (a deliberate deferral or unresolved item, named with its register ID). Nothing else is introduced here.

---

## 1. Rules That Apply to Every Contract

1. **Plain data across boundaries.** Values crossing a subsystem boundary contain no class instances, functions or live references. The only exception is the module interfaces in [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md).
2. **Readonly by default.** Every field of a shared type is `readonly`. Arrays are `readonly T[]`.
3. **Immutable once published.** Snapshots, events, updates, history records and view models are immutable once published (see section 9).
4. **Generic platform data, private architecture data.** Shared types name only platform concepts. Architecture-specific values appear only in the typed `details` extension of a snapshot, or in events of a namespaced kind (EVENT_MODEL §9).
5. **Identifiers.** Architecture identifiers are lowercase kebab-case (for example `bitshift-8`). Event kinds are kebab-case, and architecture-specific kinds are namespaced (DR-043, DR-014).
6. **Terminology.** Use _cycle_ and `ClockCycle` for simulated time. Do not use `tick` or `Tick` (SC-17, DR-067).
7. **Numbers.** Addresses and words are integers. Their valid range comes from the architecture descriptor, not from the type.

---

## 2. Shared Primitives

```ts
/** Stable architecture identifier, e.g. 'bitshift-8'. Lowercase kebab-case. */
export type ArchitectureId = string;

/** Address within an architecture's memory. Integer in [0, 2^addressBits). */
export type Address = number;

/** Unsigned word value. Width comes from the register or memory definition. */
export type Word = number;

/**
 * Number of simulated clock cycles completed since the last reset.
 * Platform-owned and authoritative (DR-067). Starts at 0 after reset.
 * Advances by exactly the number of cycles a step reports as completed.
 */
export type ClockCycle = number;

/** Error-as-value result, used at every API boundary that a caller can misuse. */
export type Result<T, E = Diagnostic> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Position in source text. Lines and columns are 1-based. */
export interface SourceSpan {
  readonly line: number;
  readonly column: number;
  readonly length: number;
}

/**
 * A structured message. The code identifies the message for tests and tooling.
 * Code prefixes are listed in section 11.
 */
export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly span?: SourceSpan;
}
```

`ok()` and `err()` helper functions construct `Result` values. They are part of the platform's shared utilities and carry no behaviour of their own.

---

## 3. Architecture Identity and Descriptor

### 3.1 Single Source of Identity (SC-30, approved as amended)

The ISA descriptor identifies its architecture. Every other place that needs an architecture identifier derives it from there.

- `ArchitectureDescriptor` has **no separate `id` field**. Its identifier is `descriptor.isa.architectureId`.
- `ProgramImage.architectureId` is derived from the ISA at assembly time. Callers never supply it.
- `assemble()` takes no separate architecture identifier.
- The controller and the registry key on `isa.architectureId`.

This is the Stage 0.3 reading of SC-30 and of the rule against redundant identity fields. It removes the `id` field the earlier draft had. The product owner should confirm it (see the Stage 0.3 report).

### 3.2 Data-Only Descriptor (DR-015, approved)

```ts
export interface ArchitectureDescriptor {
  readonly displayName: string;
  readonly descriptorVersion: string; // semantic version of this descriptor
  readonly wordBits: number; // positive integer
  readonly addressBits: number; // positive integer
  readonly memoryBytes: number; // positive integer, at most 2^addressBits
  readonly registers: readonly RegisterDefinition[];
  readonly flags: readonly FlagDefinition[];
  readonly isa: IsaDescriptor;
}

export interface RegisterDefinition {
  readonly name: string; // unique within the descriptor
  readonly bits: number; // positive integer; no upper bound in Phase 1 (DR-080)
  readonly role: RegisterRole;
  readonly programmerVisible: boolean;
}

/**
 * Roles are descriptive data. The platform uses 'output' and 'program-counter' only
 * for the replay rules in EVENT_MODEL §5. Other roles are informational.
 */
export type RegisterRole =
  'general' | 'program-counter' | 'instruction' | 'memory-interface' | 'output' | 'internal';

export interface FlagDefinition {
  readonly name: string; // unique within the descriptor, e.g. 'Z'
  readonly description: string;
}
```

The descriptor contains **no functions**. The factory `createInstance()` belongs to `CpuArchitecture` (see [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md) §1).

**Validation.** The registry validates every descriptor when it is registered (MODULE_CONTRACTS §4.1). Failures return `ARCH-INVALID-DESCRIPTOR`. The checks are:

- `isa.architectureId` is a valid identifier.
- Sizes are positive integers, and `memoryBytes` ≤ 2^`addressBits`.
- Register names and flag names are unique within their lists.
- Every register's `bits` is a positive integer (DR-079).
- At most one register has role `'output'`, and at most one has role `'program-counter'` (DR-078 b).
- Instruction `(mnemonic, variant)` pairs are unique, and opcodes are unique and fit in `wordBits`.

### 3.3 Program Counter (SC-14 deferred; DR-022 proposed)

The descriptor has **no `programCounter` field**. SC-14 is deferred until DR-022 is explicitly resolved.

Boundary, stated so that nothing assumes otherwise:

- `CpuStateCopy.programCounter` (section 4) is supplied by the architecture on every state read. Breakpoint checks use this value. They therefore do not depend on the deferred descriptor field.
- A `'program-counter'` register role may be declared. Replay (EVENT_MODEL §5) relies on it. Architectures without such a register must state their program-counter rule in their own documentation until DR-022 is resolved.

---

## 4. CPU State: Architecture Copy and Platform Snapshot

### 4.1 Architecture State Copy (architecture output)

```ts
export interface RegisterValue {
  readonly name: string; // matches RegisterDefinition.name
  readonly bits: number;
  readonly value: Word;
}

export interface FlagValue {
  readonly name: string; // matches FlagDefinition.name
  readonly value: boolean;
}

/**
 * The architecture's own copy of its externally visible state.
 * It carries no cycle number and no lifecycle state. Those are platform-owned.
 */
export interface CpuStateCopy<TDetails = undefined> {
  readonly programCounter: Address; // see 3.3
  readonly registers: readonly RegisterValue[]; // every register in the descriptor
  readonly flags: readonly FlagValue[]; // every flag in the descriptor
  readonly memory: Uint8Array; // owned copy, length = memoryBytes
  readonly details?: TDetails; // architecture-typed extension, opaque to the platform
}
```

### 4.2 Platform Snapshot (platform output)

```ts
/** Lifecycle state, owned by the platform. */
export type CpuState = 'ready' | 'running' | 'paused' | 'halted' | 'faulted';

/**
 * The published view of the simulation at a stop point.
 * Immutable. The platform builds it from a CpuStateCopy plus platform-owned fields.
 */
export interface CpuSnapshot<TDetails = undefined> extends CpuStateCopy<TDetails> {
  readonly architectureId: ArchitectureId;
  readonly cycle: ClockCycle; // platform-owned, authoritative (DR-067)
  readonly state: CpuState; // platform-owned lifecycle state
  readonly lastFault?: Diagnostic; // platform-owned; set when a fault is reported
}
```

Ownership of each field:

| Field                                                       | Owner        | Set by                                                   |
| ----------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| `architectureId`                                            | Platform     | From the controller's architecture (fixed at creation)   |
| `cycle`                                                     | Platform     | Platform cycle counter (DR-067)                          |
| `state`, `lastFault`                                        | Platform     | Lifecycle transitions and fault reports                  |
| `programCounter`, `registers`, `flags`, `memory`, `details` | Architecture | Its state copy, copied by the platform into the snapshot |

### 4.3 Architecture-Private Details

Internal latches, decoder state, micro-operation sequencer state and any internal register not declared in `RegisterDefinition` are **private to the architecture**. They do not appear in any shared type. An architecture may expose selected internal values through `details`, typed by the architecture package. The platform never reads `details`.

```ts
// BITSHIFT-8 example (architecture package). Field names are illustrative until Phase 2.
export interface Bitshift8Details {
  readonly instructionRegister: Word; // boundary: exact fields set in Phase 2 (DR-005)
}
export type Bitshift8Snapshot = CpuSnapshot<Bitshift8Details>;
```

### 4.4 Snapshot Isolation and Immutability

- The architecture returns a `CpuStateCopy` that shares no mutable object with the instance. `memory` is a new array (SIMULATION_PLATFORM §7.4).
- The platform copies the copy into a new `CpuSnapshot`. The platform then freezes the snapshot object and each array in it (`Object.freeze`).
- `memory` is a `Uint8Array`, which cannot be frozen. Consumers must treat it as read-only. Every read of memory through the controller returns a new copy, so consumers never hold a reference into the live memory.
- The controller returns the same snapshot object until the state changes (section 9).

---

## 5. Step Outcome (architecture output)

A step outcome describes **the work the architecture did**. It does not carry the platform's cycle counter.

```ts
export interface StepOutcome {
  /** Clock cycles this step completed. A non-negative integer. A delta, not a counter. */
  readonly cyclesCompleted: number;
  /** True when this step completed the current instruction (an instruction boundary). */
  readonly instructionCompleted: boolean;
  /** True when this step reached the halt condition. */
  readonly halted: boolean;
  /** Present if and only if the step faulted. */
  readonly fault?: Diagnostic;
  /** Events produced by this step, in emission order. See EVENT_MODEL §2. */
  readonly events: readonly ArchitectureEvent[];
}
```

**Invariants (normative):**

1. If `fault` is present, then `cyclesCompleted` is 0, `halted` is false and `events` is empty. A faulting step completes no cycle, and the architecture's state is unchanged.
2. `cyclesCompleted` is a non-negative integer. A `stepClock` call returns 0 or 1.
3. Each event's `cycleOffset` is an integer from 1 to `cyclesCompleted`, inclusive.
4. A `StepOutcome` contains no authoritative cycle count, no cycle number and no breakpoint information (SC-10, amended).

```ts
export interface ArchitectureEvent {
  readonly kind: string; // shared kind or '<architecture-id>/<kind>' (EVENT_MODEL §4, §9)
  /** Cycle of this step the event belongs to, counted from 1 within the step. */
  readonly cycleOffset: number;
  readonly payload: unknown; // typed per kind in EVENT_MODEL §3 and §9
}
```

The platform converts each `ArchitectureEvent` into an `ExecutionEvent` by assigning its absolute cycle and its sequence number (EVENT_MODEL §2). Architectures never assign either.

---

## 6. Execution Event (platform output)

```ts
export interface ExecutionEvent<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly cycle: ClockCycle; // absolute cycle, assigned by the platform (DR-067)
  readonly sequence: number; // 0-based index within that cycle, assigned by the platform
  readonly payload: P;
}
```

Full event model in [EVENT_MODEL.md](EVENT_MODEL.md).

---

## 7. Controller Update (platform output)

```ts
export type UpdateReason =
  | 'load'
  | 'reset'
  | 'run-start'
  | 'run-end'
  | 'run-batch'
  | 'clock-step'
  | 'instruction-step'
  | 'breakpoint'
  | 'halt'
  | 'fault';

export interface ControllerUpdate {
  readonly reason: UpdateReason;
  readonly snapshot: CpuSnapshot; // the snapshot after this call
  readonly events: readonly ExecutionEvent[]; // produced by this call, ordered by (cycle, sequence)
  readonly cyclesCompleted: number; // cycles completed by this call only
  readonly breakpointHit?: Address; // present when the program counter matched a breakpoint (MODULE_CONTRACTS §3)
}
```

`reason` for a run batch is `'run-batch'` when the batch ran its full cycle budget. It is the stop cause (`'breakpoint'`, `'halt'` or `'fault'`) when the batch stopped early.

---

## 8. Program Image and Assembly Result

```ts
export interface ProgramImage {
  /** Derived from the ISA at assembly time (section 3.1). Never supplied by a caller. */
  readonly architectureId: ArchitectureId;
  readonly origin: Address; // load address
  readonly entry: Address; // initial program counter
  readonly bytes: Uint8Array; // owned copy; never mutated after creation
  readonly symbols: Readonly<Record<string, Address>>;
  readonly sourceMap: readonly SourceMapEntry[];
}

export interface SourceMapEntry {
  readonly address: Address; // first byte of an instruction
  readonly span: SourceSpan; // source span of the instruction line
  readonly text: string; // source line text for display
}

export type AssemblyResult =
  | { readonly ok: true; readonly program: ProgramImage; readonly warnings: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };
```

`ProgramImage.architectureId` is a derived copy of the ISA identity, not a second source of truth. The controller compares it with its own architecture before loading (PLT-ARCHITECTURE-MISMATCH).

### 8.1 ISA Descriptor

```ts
export interface IsaDescriptor {
  readonly architectureId: ArchitectureId; // single source of architecture identity (section 3.1)
  readonly instructions: readonly InstructionDefinition[];
}

export interface InstructionDefinition {
  readonly mnemonic: string; // e.g. 'LDI'
  readonly variant?: string; // e.g. 'A' for LDI A
  readonly opcode: number; // integer, fits in wordBits
  readonly length: 1 | 2 | 3; // bytes, including the opcode
  readonly operand: 'none' | 'immediate' | 'address' | 'register';
}
```

Instruction-specific semantics, cycle sequences and explanation text are **not** part of the ISA descriptor. They belong to the architecture package. The opcode allocation itself is the BITSHIFT-8 specification (DR-001 to DR-018, Phase 2).

---

## 9. Ownership, Mutability and Copy Rules

| Data                          | Created by            | Owned by                   | Mutable after publication?              | Crosses boundaries as              |
| ----------------------------- | --------------------- | -------------------------- | --------------------------------------- | ---------------------------------- |
| Architecture descriptor       | Architecture package  | Architecture               | No                                      | Plain data                         |
| Live CPU state                | Architecture instance | Architecture instance      | Yes, only through step and load methods | Never crosses; copies only         |
| `CpuStateCopy`                | Architecture          | Platform (copies it)       | No                                      | Plain data                         |
| `CpuSnapshot`                 | Platform              | Platform                   | No (frozen)                             | Same reference until state changes |
| `ArchitectureEvent`           | Architecture          | Platform                   | No                                      | Within `StepOutcome` only          |
| `ExecutionEvent`              | Platform              | Platform, then subscribers | No (frozen)                             | Inside `ControllerUpdate`          |
| `ControllerUpdate`            | Platform              | Platform, then subscribers | No (frozen)                             | Via `subscribe` and call results   |
| `InstructionRecord` (history) | Platform              | Platform                   | No (frozen)                             | Copy per read                      |
| `ProgramImage`                | Assembler             | Controller after load      | No                                      | Plain data                         |
| View models                   | Visualization         | Visualization or UI        | No                                      | Plain data                         |

**Stable references.** The platform keeps the current snapshot object. It creates a new snapshot only when a state change is reported. Repeated reads with no change return the same object. The application's store reads that reference directly (SC-28).

---

## 10. Memory Views

```ts
export interface MemoryRange {
  readonly start: Address;
  readonly length: number; // positive integer; start + length ≤ memoryBytes
}

export interface MemoryReadResult {
  readonly range: MemoryRange;
  readonly bytes: Uint8Array; // a new copy per read
}
```

A range outside `[0, memoryBytes)` is rejected by the platform before the architecture is called (PLT-MEMORY-RANGE).

---

## 11. Diagnostic Codes

Codes are stable identifiers, written in upper-case with hyphens, grouped by prefix. Tests refer to codes, not to message text.

| Prefix                     | Area                                            | Examples                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCH-`                    | Architecture registry and descriptor validation | `ARCH-UNKNOWN-ID`, `ARCH-DUPLICATE-ID`, `ARCH-INVALID-DESCRIPTOR`                                                                                                                                         |
| `PLT-`                     | Platform controller and lifecycle               | `PLT-NO-PROGRAM`, `PLT-RUNNING`, `PLT-NOT-RUNNING`, `PLT-ALREADY-RUNNING`, `PLT-ARGUMENT`, `PLT-BREAKPOINT-RANGE`, `PLT-MEMORY-RANGE`, `PLT-ARCHITECTURE-MISMATCH`, `PLT-EVENT-NAMESPACE`, `PLT-INTERNAL` |
| `ASM-`                     | Assembler                                       | `ASM-UNKNOWN-MNEMONIC`. The full catalogue is written in Phase 3.                                                                                                                                         |
| `APP-`                     | Application layer                               | `APP-PERSISTENCE-UNAVAILABLE`                                                                                                                                                                             |
| `<architecture-id>/<CODE>` | Architecture-reported faults                    | Defined by each architecture. BITSHIFT-8 codes are defined in Phase 2 (DR-016).                                                                                                                           |

The distinction between `Result` errors, faults and exceptions is defined in [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md) §9 and summarised in [CODING_STANDARDS.md](../engineering/CODING_STANDARDS.md) §6.

---

## 12. Visualization View Models

Produced by the platform's pure view functions and by an architecture's visualization adapter. The shared components consume only these shapes. Nothing here carries state that the simulation does not own.

```ts
export interface RegisterView {
  readonly name: string;
  readonly bits: number;
  readonly value: Word;
  readonly changed: boolean; // true if a register-write in the latest cycles targeted it
}

export interface MemoryView {
  readonly bytes: Uint8Array; // a copy of the snapshot memory
  readonly highlighted: readonly Address[]; // addresses touched by memory events in the latest cycles
}

export interface ControlSignalView {
  readonly activeSignals: readonly string[]; // from micro-operation events, in emission order
}

/** Architecture-specific datapath layout. Produced by the architecture's adapter (DR-062). */
export interface DatapathViewModel {
  readonly architectureId: ArchitectureId;
  readonly components: readonly DatapathComponentState[];
  readonly buses: readonly BusState[];
  readonly activeControlSignals: readonly string[]; // SC-27
  readonly activeOperation?: string;
}

export interface DatapathComponentState {
  readonly id: string; // matches an SVG element id in the architecture's layout
  readonly label: string;
  readonly value?: Word;
  readonly active: boolean;
}

export interface BusState {
  readonly id: string;
  readonly active: boolean;
  readonly value?: Word;
}
```

`TimelineView` is the readonly list of `TimelineEntry` values defined in EVENT_MODEL §10.

---

## 13. Instruction Explanation Metadata (DR-061, DR-045 approved)

```ts
/** Optional descriptive text. Absence is allowed and never affects execution. */
export type InstructionExplanation = string | undefined;
```

The explanation is produced by an optional function on the architecture (MODULE_CONTRACTS §1). It takes an `InstructionRecord` (EVENT_MODEL §10) and returns text or `undefined`. Limited v1.0 scope: concise, authored, deterministic text for supported instructions. No generated or AI text.

---

## 14. Contract Versioning

- Each descriptor carries `descriptorVersion`.
- Adding an optional field to a shared type is non-breaking. Removing, renaming or re-typing a field is breaking and requires an ADR.
- Changes go through [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) first, then this document, then code.
