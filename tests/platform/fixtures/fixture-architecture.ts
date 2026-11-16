import type {
  ArchitectureDescriptor,
  ArchitectureEvent,
  CpuArchitecture,
  CpuInstance,
  CpuStateCopy,
  Diagnostic,
  FlagDefinition,
  FlagValue,
  ProgramImage,
  RegisterDefinition,
  RegisterValue,
  Result,
  SharedEventPayloads,
  StepOutcome,
} from '../../../src/platform';
import { err, ok } from '../../../src/platform';

// Test-only fixture. It is a SCRIPT PLAYER, not a CPU: it has no decoder and no instruction
// semantics. It is never imported from src/ and never shipped (TEST_STRATEGY section 4).

/** One scripted clock cycle: completed events, a reported fault, or an internal exception. */
export type FixtureCycle =
  | {
      readonly events: readonly { readonly kind: string; readonly payload: unknown }[];
      readonly instructionCompleted?: boolean;
      readonly halted?: boolean;
    }
  | { readonly fault: Diagnostic }
  | { readonly throws: string };

const MEMORY_BYTES = 48;
const PROGRAM_COUNTER = 'IP';
const OUTPUT_REGISTER = 'OUTR';

const REGISTERS: readonly RegisterDefinition[] = [
  { name: 'W', bits: 16, role: 'general', programmerVisible: true },
  { name: PROGRAM_COUNTER, bits: 6, role: 'program-counter', programmerVisible: true },
  { name: OUTPUT_REGISTER, bits: 4, role: 'output', programmerVisible: true },
];

const FLAGS: readonly FlagDefinition[] = [
  { name: 'F1', description: 'fixture flag 1' },
  { name: 'F2', description: 'fixture flag 2' },
];

/** Mutable state of one instance. Copied wholesale at every boundary. */
interface FixtureState {
  readonly registers: Map<string, number>;
  readonly flags: Map<string, boolean>;
  readonly memory: Uint8Array;
}

function zeroState(): FixtureState {
  return {
    registers: new Map(REGISTERS.map((r): [string, number] => [r.name, 0])),
    flags: new Map(FLAGS.map((f): [string, boolean] => [f.name, false])),
    memory: new Uint8Array(MEMORY_BYTES),
  };
}

function cloneState(state: FixtureState): FixtureState {
  return {
    registers: new Map(state.registers),
    flags: new Map(state.flags),
    memory: new Uint8Array(state.memory),
  };
}

function diagnostic(code: string, message: string): Diagnostic {
  return { code, severity: 'error', message };
}

/** Applies one state-changing event to the fixture's own state. Other kinds change nothing. */
function applyEvent(state: FixtureState, event: ArchitectureEvent): void {
  switch (event.kind) {
    case 'register-write': {
      const p = event.payload as SharedEventPayloads['register-write'];
      if (!state.registers.has(p.register)) throw new Error('script names an unknown register');
      state.registers.set(p.register, p.after);
      return;
    }
    case 'flag-update': {
      const p = event.payload as SharedEventPayloads['flag-update'];
      if (!state.flags.has(p.flag)) throw new Error('script names an unknown flag');
      state.flags.set(p.flag, p.after);
      return;
    }
    case 'memory-write': {
      const p = event.payload as SharedEventPayloads['memory-write'];
      if (p.address < 0 || p.address >= MEMORY_BYTES)
        throw new Error('script writes outside memory');
      state.memory[p.address] = p.after;
      return;
    }
    case 'output-emitted': {
      const p = event.payload as SharedEventPayloads['output-emitted'];
      state.registers.set(OUTPUT_REGISTER, p.after);
      return;
    }
    default:
      return;
  }
}

function fixtureDescriptor(architectureId: string): ArchitectureDescriptor {
  return {
    displayName: `Fixture ${architectureId}`,
    descriptorVersion: '0.0.1',
    wordBits: 16,
    addressBits: 6,
    memoryBytes: MEMORY_BYTES,
    registers: REGISTERS,
    flags: FLAGS,
    isa: {
      architectureId,
      instructions: [
        { mnemonic: 'OP-A', opcode: 0, length: 1, operand: 'none' },
        { mnemonic: 'OP-B', opcode: 1, length: 2, operand: 'address' },
      ],
    },
  };
}

function createFixtureInstance(
  architectureId: string,
  script: readonly FixtureCycle[],
): CpuInstance {
  let baseline = zeroState();
  let state = zeroState();
  let position = 0;

  return {
    reset(): void {
      state = cloneState(baseline);
      position = 0;
    },

    loadProgram(image: ProgramImage): Result<void, Diagnostic> {
      if (image.architectureId !== architectureId) {
        return err(
          diagnostic(
            `${architectureId}/LOAD-MISMATCH`,
            'The program was built for another architecture.',
          ),
        );
      }
      if (image.origin < 0 || image.origin + image.bytes.length > MEMORY_BYTES) {
        return err(
          diagnostic(`${architectureId}/LOAD-RANGE`, 'The program does not fit in memory.'),
        );
      }
      const loaded = zeroState();
      loaded.memory.set(image.bytes, image.origin);
      loaded.registers.set(PROGRAM_COUNTER, image.entry);
      baseline = loaded;
      state = cloneState(loaded);
      position = 0;
      return ok(undefined);
    },

    stepClock(): StepOutcome {
      if (position >= script.length) {
        return { cyclesCompleted: 0, instructionCompleted: false, halted: true, events: [] };
      }
      const cycle = script[position];
      if ('throws' in cycle) throw new Error(cycle.throws);
      if ('fault' in cycle) {
        return {
          cyclesCompleted: 0,
          instructionCompleted: false,
          halted: false,
          fault: cycle.fault,
          events: [],
        };
      }
      const events: ArchitectureEvent[] = cycle.events.map((e) => ({
        kind: e.kind,
        cycleOffset: 1,
        payload: e.payload,
      }));
      const next = cloneState(state);
      for (const event of events) applyEvent(next, event);
      state = next;
      position += 1;
      return {
        cyclesCompleted: 1,
        instructionCompleted: cycle.instructionCompleted ?? false,
        halted: cycle.halted ?? false,
        events,
      };
    },

    readState(): CpuStateCopy {
      return {
        programCounter: state.registers.get(PROGRAM_COUNTER) ?? 0,
        registers: REGISTERS.map((r): RegisterValue => ({
          name: r.name,
          bits: r.bits,
          value: state.registers.get(r.name) ?? 0,
        })),
        flags: FLAGS.map((f): FlagValue => ({
          name: f.name,
          value: state.flags.get(f.name) ?? false,
        })),
        memory: new Uint8Array(state.memory),
      };
    },
  };
}

/** Builds a test-only architecture that plays back a fixed script. Each instance has its own cursor. */
export function createFixtureArchitecture(options: {
  readonly architectureId: string;
  readonly script: readonly FixtureCycle[];
}): CpuArchitecture {
  const { architectureId, script } = options;
  return {
    descriptor: fixtureDescriptor(architectureId),
    createInstance: (): CpuInstance => createFixtureInstance(architectureId, script),
    visualization: {
      toDatapath: (snapshot) => ({
        architectureId: snapshot.architectureId,
        components: [],
        buses: [],
        activeControlSignals: [],
      }),
    },
  };
}

// Hand-worked expectations for defaultScript, played from the all-zero state (no program loaded).
// Worked out by hand from the cycle list below, not by running the fixture.
// Columns after each cycle: IP (programCounter), W, OUTR, F1, F2, and the non-zero memory bytes.
// "Completes" is instructionCompleted, "Halts" is halted, both from the cycle's own flags.
//
//  Cyc  Completes  Halts  IP  W  OUTR  F1     F2     Memory
//   0   (initial state)   0   0  0     false  false  none
//   1   no          no     0   0  0     false  false  none
//   2   no          no     0   0  0     false  false  none
//   3   no          no     0   1  0     true   false  none
//   4   yes         no     1   1  0     true   false  none
//   5   no          no     1   1  0     true   false  none
//   6   no          no     1   1  0     true   false  [20]=1
//   7   yes         no     3   1  0     true   false  [20]=1
//   8   no          no     3   1  0     true   false  [20]=1
//   9   no          no     3   1  0     true   false  [20]=1
//  10   no          no     3   1  1     true   false  [20]=1
//  11   yes         no     4   1  1     true   false  [20]=1
//  12   no          no     4   1  1     true   false  [20]=1
//  13   yes         yes    4   1  1     true   false  [20]=1
//  14   past the end: cyclesCompleted 0, halted true, no change
//
// Cycle by cycle: 1 OP-A starts; 2 an alu-operation and a bus-transfer; 3 W = 1 and F1 = true;
// 4 IP 0 -> 1, OP-A ends; 5 OP-B starts; 6 memory[20] = 1, note;
// 7 IP 1 -> 3, OP-B ends; 8 OP-C starts; 9 a memory-read of memory[20];
// 10 OUTR = 1; 11 IP 3 -> 4, OP-C ends; 12 OP-D starts;
// 13 OP-D ends and the halt is reported.

/** A hand-written script that emits every shared kind except `fault`, and one namespaced kind. */
export function defaultScript(architectureId: string): readonly FixtureCycle[] {
  return [
    // Cycle 1: OP-A starts at address 0.
    {
      events: [
        { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-A' } },
        { kind: 'micro-operation', payload: { controlSignals: ['sig-1', 'sig-2'] } },
      ],
    },
    // Cycle 2: an alu-operation and a bus-transfer.
    {
      events: [
        { kind: 'alu-operation', payload: { operation: 'op-1', left: 0, right: 1, result: 1 } },
        { kind: 'bus-transfer', payload: { bus: 'data', value: 1 } },
      ],
    },
    // Cycle 3: W becomes 1 and F1 becomes true.
    {
      events: [
        { kind: 'register-write', payload: { register: 'W', before: 0, after: 1 } },
        { kind: 'flag-update', payload: { flag: 'F1', before: false, after: true } },
      ],
    },
    // Cycle 4: IP advances to 1 and OP-A completes.
    {
      events: [
        { kind: 'register-write', payload: { register: PROGRAM_COUNTER, before: 0, after: 1 } },
        { kind: 'instruction-end', payload: { address: 0, mnemonic: 'OP-A', nextAddress: 1 } },
      ],
      instructionCompleted: true,
    },
    // Cycle 5: OP-B starts at address 1.
    {
      events: [
        { kind: 'instruction-start', payload: { address: 1, mnemonic: 'OP-B' } },
        { kind: 'micro-operation', payload: { controlSignals: ['sig-3'] } },
      ],
    },
    // Cycle 6: memory[20] becomes 1.
    {
      events: [
        { kind: 'bus-transfer', payload: { bus: 'address', value: 20 } },
        { kind: 'memory-write', payload: { address: 20, before: 0, after: 1 } },
        { kind: `${architectureId}/note`, payload: { text: 'note text' } },
      ],
    },
    // Cycle 7: IP advances to 3 and OP-B completes.
    {
      events: [
        { kind: 'register-write', payload: { register: PROGRAM_COUNTER, before: 1, after: 3 } },
        { kind: 'instruction-end', payload: { address: 1, mnemonic: 'OP-B', nextAddress: 3 } },
      ],
      instructionCompleted: true,
    },
    // Cycle 8: OP-C starts at address 3.
    {
      events: [
        { kind: 'instruction-start', payload: { address: 3, mnemonic: 'OP-C' } },
        { kind: 'micro-operation', payload: { controlSignals: ['sig-4'] } },
      ],
    },
    // Cycle 9: a memory-read of memory[20], which holds 1.
    {
      events: [
        { kind: 'memory-read', payload: { address: 20, value: 1 } },
        { kind: 'bus-transfer', payload: { bus: 'data', value: 1 } },
      ],
    },
    // Cycle 10: OUTR becomes 1.
    {
      events: [{ kind: 'output-emitted', payload: { before: 0, after: 1 } }],
    },
    // Cycle 11: IP advances to 4 and OP-C completes.
    {
      events: [
        { kind: 'register-write', payload: { register: PROGRAM_COUNTER, before: 3, after: 4 } },
        { kind: 'instruction-end', payload: { address: 3, mnemonic: 'OP-C', nextAddress: 4 } },
      ],
      instructionCompleted: true,
    },
    // Cycle 12: OP-D starts at address 4.
    {
      events: [
        { kind: 'instruction-start', payload: { address: 4, mnemonic: 'OP-D' } },
        { kind: 'micro-operation', payload: { controlSignals: ['sig-5'] } },
      ],
    },
    // Cycle 13: OP-D ends and the halt is reported. The last instruction ends in a halted cycle.
    {
      events: [
        { kind: 'instruction-end', payload: { address: 4, mnemonic: 'OP-D', nextAddress: 4 } },
        { kind: 'halted', payload: { address: 4 } },
      ],
      instructionCompleted: true,
      halted: true,
    },
  ];
}
