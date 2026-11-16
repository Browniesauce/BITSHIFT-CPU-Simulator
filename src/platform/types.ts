import type { Diagnostic, Result, SourceSpan } from './result';

/** Stable architecture identifier, lowercase kebab-case (DATA_CONTRACTS §2). */
export type ArchitectureId = string;

/** Address within an architecture's memory (DATA_CONTRACTS §2). */
export type Address = number;

/** Unsigned word value; width comes from the register or memory definition (DATA_CONTRACTS §2). */
export type Word = number;

/** Number of simulated clock cycles completed since the last reset, platform-owned (DATA_CONTRACTS §2). */
export type ClockCycle = number;

/** Data-only description of an architecture (DATA_CONTRACTS §3.2). */
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

/** Definition of one register in a descriptor (DATA_CONTRACTS §3.2). */
export interface RegisterDefinition {
  readonly name: string; // unique within the descriptor
  readonly bits: number; // positive integer, at most wordBits for word registers
  readonly role: RegisterRole;
  readonly programmerVisible: boolean;
}

/** Descriptive role of a register (DATA_CONTRACTS §3.2). */
export type RegisterRole =
  'general' | 'program-counter' | 'instruction' | 'memory-interface' | 'output' | 'internal';

/** Definition of one flag in a descriptor (DATA_CONTRACTS §3.2). */
export interface FlagDefinition {
  readonly name: string; // unique within the descriptor, e.g. 'Z'
  readonly description: string;
}

/** Value of one register in a state copy (DATA_CONTRACTS §4.1). */
export interface RegisterValue {
  readonly name: string; // matches RegisterDefinition.name
  readonly bits: number;
  readonly value: Word;
}

/** Value of one flag in a state copy (DATA_CONTRACTS §4.1). */
export interface FlagValue {
  readonly name: string; // matches FlagDefinition.name
  readonly value: boolean;
}

/** The architecture's own copy of its externally visible state (DATA_CONTRACTS §4.1). */
export interface CpuStateCopy<TDetails = undefined> {
  readonly programCounter: Address;
  readonly registers: readonly RegisterValue[];
  readonly flags: readonly FlagValue[];
  readonly memory: Uint8Array;
  readonly details?: TDetails;
}

/** Lifecycle state, owned by the platform (DATA_CONTRACTS §4.2). */
export type CpuState = 'ready' | 'running' | 'paused' | 'halted' | 'faulted';

/** The published view of the simulation at a stop point (DATA_CONTRACTS §4.2). */
export interface CpuSnapshot<TDetails = undefined> extends CpuStateCopy<TDetails> {
  readonly architectureId: ArchitectureId;
  readonly cycle: ClockCycle;
  readonly state: CpuState;
  readonly lastFault?: Diagnostic;
}

/** The work an architecture did in one step (DATA_CONTRACTS §5). */
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

/** An event as produced by an architecture, with no absolute cycle (DATA_CONTRACTS §5). */
export interface ArchitectureEvent {
  readonly kind: string;
  /** Cycle of this step the event belongs to, counted from 1 within the step. */
  readonly cycleOffset: number;
  readonly payload: unknown;
}

/** An event as published by the platform, with cycle and sequence (DATA_CONTRACTS §6). */
export interface ExecutionEvent<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly cycle: ClockCycle;
  readonly sequence: number;
  readonly payload: P;
}

/** Why a controller update was published (DATA_CONTRACTS §7). */
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

/** What the controller publishes after a call (DATA_CONTRACTS §7). */
export interface ControllerUpdate {
  readonly reason: UpdateReason;
  readonly snapshot: CpuSnapshot;
  readonly events: readonly ExecutionEvent[];
  readonly cyclesCompleted: number;
  readonly breakpointHit?: Address;
}

/** A loadable program produced by the assembler (DATA_CONTRACTS §8). */
export interface ProgramImage {
  readonly architectureId: ArchitectureId;
  readonly origin: Address;
  readonly entry: Address;
  readonly bytes: Uint8Array;
  readonly symbols: Readonly<Record<string, Address>>;
  readonly sourceMap: readonly SourceMapEntry[];
}

/** Maps an instruction address to its source line (DATA_CONTRACTS §8). */
export interface SourceMapEntry {
  readonly address: Address;
  readonly span: SourceSpan;
  readonly text: string;
}

/** The outcome of assembling a source text (DATA_CONTRACTS §8). */
export type AssemblyResult =
  | { readonly ok: true; readonly program: ProgramImage; readonly warnings: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** The ISA descriptor, the single source of architecture identity (DATA_CONTRACTS §8.1). */
export interface IsaDescriptor {
  readonly architectureId: ArchitectureId;
  readonly instructions: readonly InstructionDefinition[];
}

/** One instruction encoding in an ISA descriptor (DATA_CONTRACTS §8.1). */
export interface InstructionDefinition {
  readonly mnemonic: string;
  readonly variant?: string;
  readonly opcode: number;
  readonly length: 1 | 2 | 3;
  readonly operand: 'none' | 'immediate' | 'address' | 'register';
}

/** A range of memory bytes (DATA_CONTRACTS §10). */
export interface MemoryRange {
  readonly start: Address;
  readonly length: number;
}

/** The result of reading a memory range (DATA_CONTRACTS §10). */
export interface MemoryReadResult {
  readonly range: MemoryRange;
  readonly bytes: Uint8Array;
}

/** Architecture-specific datapath layout (DATA_CONTRACTS §12). */
export interface DatapathViewModel {
  readonly architectureId: ArchitectureId;
  readonly components: readonly DatapathComponentState[];
  readonly buses: readonly BusState[];
  readonly activeControlSignals: readonly string[];
  readonly activeOperation?: string;
}

/** State of one datapath component (DATA_CONTRACTS §12). */
export interface DatapathComponentState {
  readonly id: string;
  readonly label: string;
  readonly value?: Word;
  readonly active: boolean;
}

/** State of one bus (DATA_CONTRACTS §12). */
export interface BusState {
  readonly id: string;
  readonly active: boolean;
  readonly value?: Word;
}

/** One completed instruction in the history (EVENT_MODEL §10). */
export interface InstructionRecord {
  readonly index: number;
  readonly startCycle: ClockCycle;
  readonly endCycle: ClockCycle;
  readonly address: Address;
  readonly mnemonic: string;
  readonly changes: readonly StateChange[];
  readonly explanation?: string;
}

/** One state change inside an instruction record (EVENT_MODEL §10). */
export interface StateChange {
  readonly target: string;
  readonly before: number | boolean;
  readonly after: number | boolean;
}

/** Payload of each shared event kind (EVENT_MODEL §3.2). */
export interface SharedEventPayloads {
  readonly 'micro-operation': { readonly controlSignals: readonly string[] };
  readonly 'bus-transfer': { readonly bus: string; readonly value: number };
  readonly 'register-write': {
    readonly register: string;
    readonly before: number;
    readonly after: number;
  };
  readonly 'memory-read': { readonly address: number; readonly value: number };
  readonly 'memory-write': {
    readonly address: number;
    readonly before: number;
    readonly after: number;
  };
  readonly 'alu-operation': {
    readonly operation: string;
    readonly left: number;
    readonly right: number;
    readonly result: number;
  };
  readonly 'flag-update': {
    readonly flag: string;
    readonly before: boolean;
    readonly after: boolean;
  };
  readonly 'output-emitted': { readonly before: number; readonly after: number };
  readonly 'instruction-start': { readonly address: number; readonly mnemonic: string };
  readonly 'instruction-end': {
    readonly address: number;
    readonly mnemonic: string;
    readonly nextAddress: number;
  };
  readonly halted: { readonly address: number };
  readonly fault: { readonly diagnostic: Diagnostic };
}

/** The shared event kinds (EVENT_MODEL §3.2). */
export type SharedEventKind = keyof SharedEventPayloads;

/** Packages one architecture: descriptor, factory, adapter and explanations (MODULE_CONTRACTS §3.1). */
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

/** The live, mutable CPU of one architecture (MODULE_CONTRACTS §3.2). */
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

/** Maps platform data to an architecture's datapath view model (MODULE_CONTRACTS §3.4). */
export interface VisualizationAdapter {
  /** Maps a snapshot and the latest cycles' events to a datapath view model. Pure. */
  toDatapath(snapshot: CpuSnapshot, recentEvents: readonly ExecutionEvent[]): DatapathViewModel;
}
