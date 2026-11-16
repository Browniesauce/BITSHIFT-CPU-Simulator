import type { Diagnostic, Result } from './result';
import type {
  CpuArchitecture,
  CpuInstance,
  CpuStateCopy,
  ProgramImage,
  StepOutcome,
} from './types';

/** Outcome of a guarded architecture call (MODULE_CONTRACTS §2.4.5). */
export type Guarded<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'internal'; readonly diagnostic: Diagnostic };

/** The only holder of a CPU instance; contains architecture exceptions (MODULE_CONTRACTS §2.3, §2.4.5). */
export interface InstanceGuard {
  /** False after an internal failure, until `replace()` succeeds. */
  readonly reliable: boolean;
  loadProgram(image: ProgramImage): Guarded<Result<void, Diagnostic>>;
  reset(): Guarded<void>;
  stepClock(): Guarded<StepOutcome>;
  readState(): Guarded<CpuStateCopy>;
  /** Discards the instance, creates a new one, and reloads the last accepted program. */
  replace(): Guarded<void>;
}

function internal(detail: string): { readonly kind: 'internal'; readonly diagnostic: Diagnostic } {
  return {
    kind: 'internal',
    diagnostic: { code: 'PLT-INTERNAL', severity: 'error', message: detail },
  };
}

function describeThrown(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/** Returns a description of the first DATA_CONTRACTS §5 violation, or undefined when valid. */
function checkOutcome(outcome: StepOutcome): string | undefined {
  const cycles: unknown = outcome.cyclesCompleted;
  if (cycles !== 0 && cycles !== 1) {
    return 'cyclesCompleted is not 0 or 1';
  }
  if (!Array.isArray(outcome.events)) {
    return 'events is not an array';
  }
  if (outcome.fault !== undefined) {
    if (outcome.cyclesCompleted !== 0 || outcome.halted || outcome.events.length > 0) {
      return 'a fault outcome completed cycles, halted or carried events';
    }
  }
  for (const event of outcome.events) {
    const offset: unknown = event.cycleOffset;
    if (
      typeof offset !== 'number' ||
      !Number.isInteger(offset) ||
      offset < 1 ||
      offset > outcome.cyclesCompleted
    ) {
      return 'an event cycleOffset is outside 1..cyclesCompleted';
    }
  }
  return undefined;
}

/** Creates the guard around one architecture's instance (MODULE_CONTRACTS §2.3, §2.4.5). */
export function createInstanceGuard(architecture: CpuArchitecture): InstanceGuard {
  let instance: CpuInstance | undefined;
  let reliable = false;
  let acceptedImage: ProgramImage | undefined;
  /** The PLT-INTERNAL diagnostic of the most recent failure; cleared by a successful replace. */
  let lastFailure: Diagnostic | undefined;

  function markFailed(detail: string): {
    readonly kind: 'internal';
    readonly diagnostic: Diagnostic;
  } {
    reliable = false;
    const failed = internal(detail);
    lastFailure = failed.diagnostic;
    return failed;
  }

  try {
    instance = architecture.createInstance();
    reliable = true;
  } catch (thrown) {
    instance = undefined;
    markFailed(`The architecture threw: ${describeThrown(thrown)}`);
  }

  function call<T>(operation: (target: CpuInstance) => T): Guarded<T> {
    if (!reliable || instance === undefined) {
      return {
        kind: 'internal',
        diagnostic: lastFailure ?? internal('The architecture instance is unreliable.').diagnostic,
      };
    }
    try {
      return { kind: 'ok', value: operation(instance) };
    } catch (thrown) {
      return markFailed(`The architecture threw: ${describeThrown(thrown)}`);
    }
  }

  return {
    get reliable(): boolean {
      return reliable;
    },
    loadProgram(image: ProgramImage): Guarded<Result<void, Diagnostic>> {
      return call((target) => {
        const loaded = target.loadProgram(image);
        if (loaded.ok) {
          acceptedImage = image;
        }
        return loaded;
      });
    },
    reset(): Guarded<void> {
      return call((target) => {
        target.reset();
      });
    },
    stepClock(): Guarded<StepOutcome> {
      return call((target) => {
        const outcome = target.stepClock();
        const problem = checkOutcome(outcome);
        if (problem !== undefined) {
          throw new Error(`Invalid step outcome: ${problem}`);
        }
        return outcome;
      });
    },
    readState(): Guarded<CpuStateCopy> {
      return call((target) => target.readState());
    },
    replace(): Guarded<void> {
      try {
        const fresh = architecture.createInstance();
        instance = fresh;
        if (acceptedImage !== undefined) {
          const loaded = fresh.loadProgram(acceptedImage);
          if (!loaded.ok) {
            return markFailed(`Reloading the program failed: ${loaded.error.code}`);
          }
        }
        reliable = true;
        lastFailure = undefined;
        return { kind: 'ok', value: undefined };
      } catch (thrown) {
        return markFailed(`Replacing the instance failed: ${describeThrown(thrown)}`);
      }
    },
  };
}
