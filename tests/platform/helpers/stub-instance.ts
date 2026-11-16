import { ok } from '../../../src/platform';
import type {
  CpuArchitecture,
  CpuInstance,
  CpuStateCopy,
  Diagnostic,
  ProgramImage,
  Result,
  StepOutcome,
} from '../../../src/platform';
import { makeDescriptor } from './descriptors';

/** Behaviour of a hand-made stub instance. Every field is optional; the defaults are harmless. */
export interface StubBehaviour {
  readonly loadProgram?: (image: ProgramImage) => Result<void, Diagnostic>;
  readonly reset?: () => void;
  readonly stepClock?: () => StepOutcome;
  readonly readState?: () => CpuStateCopy;
}

/** Call counters for one stub instance. */
export interface StubCalls {
  loadProgram: number;
  reset: number;
  stepClock: number;
  readState: number;
}

/** A hand-made CpuInstance plus its call counters. */
export interface StubInstance {
  readonly instance: CpuInstance;
  readonly calls: StubCalls;
}

/** A valid zero-cycle outcome with no events. */
export function quietOutcome(): StepOutcome {
  return { cyclesCompleted: 0, instructionCompleted: false, halted: false, events: [] };
}

/** An empty state copy. */
export function emptyState(): CpuStateCopy {
  return { programCounter: 0, registers: [], flags: [], memory: new Uint8Array(0) };
}

/** Builds a CpuInstance whose methods follow the given behaviour and count their calls. */
export function makeStubInstance(behaviour: StubBehaviour = {}): StubInstance {
  const calls: StubCalls = { loadProgram: 0, reset: 0, stepClock: 0, readState: 0 };
  const instance: CpuInstance = {
    loadProgram(image) {
      calls.loadProgram += 1;
      return behaviour.loadProgram ? behaviour.loadProgram(image) : ok(undefined);
    },
    reset() {
      calls.reset += 1;
      behaviour.reset?.();
    },
    stepClock() {
      calls.stepClock += 1;
      return behaviour.stepClock ? behaviour.stepClock() : quietOutcome();
    },
    readState() {
      calls.readState += 1;
      return behaviour.readState ? behaviour.readState() : emptyState();
    },
  };
  return { instance, calls };
}

/** An architecture whose createInstance is the given factory. */
export function makeStubArchitecture(
  createInstance: () => CpuInstance,
  id = 'stub',
): CpuArchitecture {
  return {
    descriptor: makeDescriptor(id),
    createInstance,
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

/** A minimal program image for the stub architecture. */
export function makeImage(marker: number, architectureId = 'stub'): ProgramImage {
  return {
    architectureId,
    origin: 0,
    entry: 0,
    bytes: new Uint8Array([marker]),
    symbols: {},
    sourceMap: [],
  };
}
