# BITSHIFT — Data Contracts

**Status:** Proposed contracts (B). These are architectural contracts, not implemented modules. Examples are illustrative TypeScript and are not yet in the codebase.
**Related:** [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md), [EVENT_MODEL.md](EVENT_MODEL.md), [CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md)

Rules that apply to every contract:

- All values crossing a subsystem boundary are plain data: no class instances, functions or live references.
- Snapshot and event types are `readonly`.
- Numbers are used for addresses and words. Their valid range is fixed by the architecture descriptor, not by the type.
- Identifiers are lowercase kebab-case strings (for example `bitshift-8`).

---

## 1. Shared Primitives

```ts
/** Stable architecture identifier, e.g. 'bitshift-8'. */
export type ArchitectureId = string;

/** Address within an architecture's memory. Valid range comes from the descriptor. */
export type Address = number;

/** Unsigned word value. Width comes from the register or memory definition. */
export type Word = number;

/** Simulation tick. Monotonic within one CPU instance. Starts at 0 after reset. */
export type Tick = number;

/** Error-as-value result used at API boundaries. */
export type Result<T, E = Diagnostic> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Position in source text. Lines and columns are 1-based. */
export interface SourceSpan {
  readonly line: number;
  readonly column: number;
  readonly length: number;
}

/** Diagnostic message used by the assembler, loader and fault reporting. */
export interface Diagnostic {
  readonly code: string; // e.g. 'ASM-UNKNOWN-MNEMONIC'
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly span?: SourceSpan; // present for source-related diagnostics
}
```

## 2. Architecture Descriptor

Read by the platform at startup. Contains no behaviour.

```ts
export interface ArchitectureDescriptor {
  readonly id: ArchitectureId;
  readonly displayName: string;
  readonly descriptorVersion: string; // semantic version of this descriptor
  readonly wordBits: number;
  readonly addressBits: number;
  readonly memoryBytes: number;
  readonly registers: readonly RegisterDefinition[];
  readonly flags: readonly FlagDefinition[];
  readonly isa: IsaDescriptor;
  createInstance(): CpuInstance; // factory; see MODULE_CONTRACTS
}

export interface RegisterDefinition {
  readonly name: string; // e.g. 'A', 'PC'
  readonly bits: number;
  readonly role:
    'general' | 'program-counter' | 'instruction' | 'memory-interface' | 'output' | 'internal';
  readonly programmerVisible: boolean;
}

export interface FlagDefinition {
  readonly name: string; // e.g. 'Z'
  readonly description: string;
}
```

`IsaDescriptor` is defined in section 6 and is subject to DR-015.

## 3. CPU Snapshot

Immutable copy of CPU state at a tick. The platform reads snapshots through the generic envelope. Architectures extend it through a typed `registers` and `flags` list and an optional architecture-specific `details` field.

```ts
export interface CpuSnapshot<TDetails = undefined> {
  readonly architectureId: ArchitectureId;
  readonly tick: Tick;
  readonly state: CpuState;
  readonly programCounter: Address;
  readonly registers: readonly RegisterSnapshot[];
  readonly flags: readonly FlagSnapshot[];
  readonly memory: MemorySnapshot;
  readonly lastFault?: Diagnostic;
  readonly details?: TDetails; // architecture-specific, see below
}

export type CpuState = 'ready' | 'running' | 'paused' | 'halted' | 'faulted';

export interface RegisterSnapshot {
  readonly name: string;
  readonly value: Word;
  readonly bits: number;
}

export interface FlagSnapshot {
  readonly name: string;
  readonly value: boolean;
}

export interface MemorySnapshot {
  readonly bytes: Uint8Array; // copied, never a view into live memory
}
```

Notes:

- `programCounter` is a platform-level field because every architecture has a PC, and the platform uses it for breakpoints. If an architecture has no PC, its descriptor must say so and breakpoints are disabled (B).
- `memory.bytes` is copied. `Uint8Array` is used for compactness; it is still immutable by convention, and the contract requires a copy (DR-031 will confirm this is fast enough).
- `details` (architecture-specific snapshot data, for example BITSHIFT-8's `ir`, `mar`, `mdr`, `temp`) is typed per architecture through the `TDetails` parameter. Its type is exported from the architecture package. The platform treats `details` as opaque and never reads it.

```ts
// BITSHIFT-8 example (architecture package, not platform)
export interface Bitshift8Details {
  readonly ir: Word;
  readonly mar: Address;
  readonly mdr: Word;
  readonly temp: Word;
  readonly out: Word;
}
export type Bitshift8Snapshot = CpuSnapshot<Bitshift8Details>;
```

## 4. Execution Event

Full model in [EVENT_MODEL.md](EVENT_MODEL.md). Shape summary (the `sequence` field is required; see EVENT_MODEL section 2):

```ts
export interface ExecutionEvent<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly tick: Tick;
  readonly sequence: number; // 0-based index within the tick
  readonly payload: P;
}
```

## 5. Program Image

Output of the assembler and input to `CpuInstance.loadProgram`.

```ts
export interface ProgramImage {
  readonly architectureId: ArchitectureId;
  readonly origin: Address; // load address; BITSHIFT-8 default 0x00 (DR-003)
  readonly bytes: Uint8Array;
  readonly entry: Address; // initial PC
  readonly sourceMap: readonly SourceMapEntry[];
  readonly symbols: Readonly<Record<string, Address>>;
}

export interface SourceMapEntry {
  readonly address: Address; // first byte of an instruction
  readonly span: SourceSpan;
  readonly text: string; // source line text for display
}
```

## 6. ISA Descriptor

Describes syntax and encoding that the assembler needs. Whether this is data-only or includes functions is open (DR-015). The proposal below is data-only.

```ts
export interface IsaDescriptor {
  readonly instructions: readonly InstructionDefinition[];
}

export interface InstructionDefinition {
  readonly mnemonic: string; // e.g. 'LDI'
  readonly variant?: string; // e.g. 'A' for LDI A
  readonly opcode: number;
  readonly length: 1 | 2 | 3; // bytes, including opcode
  readonly operand: 'none' | 'immediate' | 'address' | 'register';
}
```

## 7. Assembly Result

```ts
export type AssemblyResult =
  | { readonly ok: true; readonly program: ProgramImage; readonly warnings: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };
```

## 8. Memory Inspection Views

```ts
export interface MemoryRange {
  readonly start: Address;
  readonly length: number;
}

export interface MemoryReadResult {
  readonly range: MemoryRange;
  readonly bytes: Uint8Array; // copy
}
```

## 9. Visualization View Model

Produced by an architecture's visualization adapter. The shared components consume only these shapes.

```ts
export interface DatapathViewModel {
  readonly architectureId: ArchitectureId;
  readonly components: readonly DatapathComponentState[];
  readonly buses: readonly BusState[];
  readonly activeOperation?: string; // human-readable label of the current micro-operation
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

Exact visual shapes are a Phase 4 detail. These types define only what the platform and architecture share.

## 10. Contract Versioning

- Each descriptor carries `descriptorVersion`. Changing a field in a shared contract requires an ADR.
- Adding an optional field is a non-breaking change. Removing or renaming a field is breaking.
- Contracts change through [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) first, then this document, then code.
