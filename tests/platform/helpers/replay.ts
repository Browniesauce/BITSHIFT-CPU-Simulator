import type { ArchitectureDescriptor, CpuSnapshot, ExecutionEvent } from '../../../src/platform';

// Replay checker for the replay invariant, written from EVENT_MODEL section 5 alone.
// It imports types only and shares no logic with src/platform, so that it can check the
// platform without proving the platform against itself.

/** The replayable fields of a snapshot (EVENT_MODEL section 5.1). */
export interface ReplayableState {
  readonly registers: ReadonlyMap<string, number>;
  readonly flags: ReadonlyMap<string, boolean>;
  readonly memory: readonly number[];
  /** Present only when the descriptor declares a register of role 'program-counter'. */
  readonly programCounter?: number;
}

const PROGRAM_COUNTER_ROLE = 'program-counter';
const OUTPUT_ROLE = 'output';

type Applied =
  | { readonly ok: true; readonly state: ReplayableState }
  | { readonly ok: false; readonly violation: string };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function roleRegister(descriptor: ArchitectureDescriptor, role: string): string | undefined {
  return descriptor.registers.find((r) => r.role === role)?.name;
}

/** Builds a state from working copies, taking programCounter from the program-counter register. */
function assemble(
  registers: Map<string, number>,
  flags: Map<string, boolean>,
  memory: number[],
  descriptor: ArchitectureDescriptor,
): ReplayableState {
  const pcName = roleRegister(descriptor, PROGRAM_COUNTER_ROLE);
  const pc = pcName === undefined ? undefined : registers.get(pcName);
  return pc === undefined
    ? { registers, flags, memory }
    : { registers, flags, memory, programCounter: pc };
}

/** Extracts the replayable fields of a snapshot. Copies everything; shares no object with it. */
export function replayableOf(
  snapshot: CpuSnapshot,
  descriptor: ArchitectureDescriptor,
): ReplayableState {
  const registers = new Map<string, number>();
  for (const register of snapshot.registers) registers.set(register.name, register.value);
  const flags = new Map<string, boolean>();
  for (const flag of snapshot.flags) flags.set(flag.name, flag.value);
  const memory = Array.from(snapshot.memory);
  return assemble(registers, flags, memory, descriptor);
}

/**
 * Applies the state-changing events of one cycle, in order, to a copy of the state.
 * A state-changing event whose `before` does not match the value it replaces is a violation.
 * Every other kind, including namespaced and unknown kinds, changes nothing.
 */
export function applyCycle(
  state: ReplayableState,
  events: readonly ExecutionEvent[],
  descriptor: ArchitectureDescriptor,
): Applied {
  const registers = new Map(state.registers);
  const flags = new Map(state.flags);
  const memory = [...state.memory];

  for (const event of events) {
    const p = asRecord(event.payload);
    switch (event.kind) {
      case 'register-write': {
        const name = p?.register;
        const before = p?.before;
        const after = p?.after;
        if (typeof name !== 'string' || typeof before !== 'number' || typeof after !== 'number') {
          return { ok: false, violation: `register-write at cycle ${event.cycle} is malformed` };
        }
        if (registers.get(name) !== before) {
          return {
            ok: false,
            violation: `register-write of ${name} at cycle ${event.cycle}: before ${before} does not match state ${String(registers.get(name))}`,
          };
        }
        registers.set(name, after);
        break;
      }
      case 'flag-update': {
        const name = p?.flag;
        const before = p?.before;
        const after = p?.after;
        if (typeof name !== 'string' || typeof before !== 'boolean' || typeof after !== 'boolean') {
          return { ok: false, violation: `flag-update at cycle ${event.cycle} is malformed` };
        }
        if (flags.get(name) !== before) {
          return {
            ok: false,
            violation: `flag-update of ${name} at cycle ${event.cycle}: before ${before} does not match state ${String(flags.get(name))}`,
          };
        }
        flags.set(name, after);
        break;
      }
      case 'memory-write': {
        const address = p?.address;
        const before = p?.before;
        const after = p?.after;
        if (
          typeof address !== 'number' ||
          !Number.isInteger(address) ||
          address < 0 ||
          address >= memory.length ||
          typeof before !== 'number' ||
          typeof after !== 'number'
        ) {
          return { ok: false, violation: `memory-write at cycle ${event.cycle} is malformed` };
        }
        if (memory[address] !== before) {
          return {
            ok: false,
            violation: `memory-write at address ${address}, cycle ${event.cycle}: before ${before} does not match state ${memory[address]}`,
          };
        }
        memory[address] = after;
        break;
      }
      case 'output-emitted': {
        const before = p?.before;
        const after = p?.after;
        if (typeof before !== 'number' || typeof after !== 'number') {
          return { ok: false, violation: `output-emitted at cycle ${event.cycle} is malformed` };
        }
        const outputName = roleRegister(descriptor, OUTPUT_ROLE);
        if (outputName === undefined) {
          return {
            ok: false,
            violation: `output-emitted at cycle ${event.cycle}, but the descriptor has no output register`,
          };
        }
        if (registers.get(outputName) !== before) {
          return {
            ok: false,
            violation: `output-emitted at cycle ${event.cycle}: before ${before} does not match ${outputName} ${String(registers.get(outputName))}`,
          };
        }
        registers.set(outputName, after);
        break;
      }
      default:
        // Informational, control-signal, instruction-boundary, platform and namespaced kinds.
        break;
    }
  }

  return { ok: true, state: assemble(registers, flags, memory, descriptor) };
}
