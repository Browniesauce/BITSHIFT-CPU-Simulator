import type { Diagnostic, Result } from './result';
import { err, ok } from './result';
import type { ExecutionEvent, InstructionRecord, SharedEventPayloads, StateChange } from './types';

/** Bounded, forward-only storage of instruction records (MODULE_CONTRACTS §2.7). */
export interface ExecutionHistory {
  readonly limit: number;
  entries(): readonly InstructionRecord[];
  append(record: InstructionRecord): void;
  clear(): void;
  readonly truncated: boolean;
}

/** Creates a history; a limit that is not a positive integer gives PLT-ARGUMENT (MODULE_CONTRACTS §2.7). */
export function createExecutionHistory(limit: number): Result<ExecutionHistory, Diagnostic> {
  if (!Number.isInteger(limit) || limit < 1) {
    return err({
      code: 'PLT-ARGUMENT',
      severity: 'error',
      message: `History limit must be a positive integer; received ${String(limit)}.`,
    });
  }

  const records: InstructionRecord[] = [];
  let snapshot: readonly InstructionRecord[] | undefined;
  let wasTruncated = false;

  const history: ExecutionHistory = {
    limit,
    entries(): readonly InstructionRecord[] {
      if (snapshot === undefined) {
        snapshot = Object.freeze([...records]);
      }
      return snapshot;
    },
    append(record: InstructionRecord): void {
      if (records.length >= limit) {
        records.shift();
        wasTruncated = true;
      }
      records.push(record);
      snapshot = undefined;
    },
    clear(): void {
      records.length = 0;
      snapshot = undefined;
      wasTruncated = false;
    },
    get truncated(): boolean {
      return wasTruncated;
    },
  };

  return ok(history);
}

/** Turns stamped events into instruction records (EVENT_MODEL §10). */
export interface InstructionRecorder {
  record(events: readonly ExecutionEvent[]): readonly InstructionRecord[];
  reset(): void;
}

/** An instruction that has started and not yet ended. */
interface OpenInstruction {
  readonly address: number;
  readonly mnemonic: string;
  readonly startCycle: number;
  readonly changes: StateChange[];
}

/** Creates a recorder that builds frozen instruction records from events (EVENT_MODEL §10). */
export function createInstructionRecorder(
  outputRegisterName: string | undefined,
): InstructionRecorder {
  let open: OpenInstruction | undefined;
  let index = 0;

  const recorder: InstructionRecorder = {
    record(events: readonly ExecutionEvent[]): readonly InstructionRecord[] {
      const completed: InstructionRecord[] = [];
      for (const event of events) {
        const payload = event.payload;
        switch (event.kind) {
          case 'instruction-start':
            if (isInstructionStart(payload)) {
              open = {
                address: payload.address,
                mnemonic: payload.mnemonic,
                startCycle: event.cycle,
                changes: [],
              };
            }
            break;
          case 'instruction-end':
            if (open !== undefined && isInstructionEnd(payload)) {
              const record: InstructionRecord = Object.freeze({
                index,
                startCycle: open.startCycle,
                endCycle: event.cycle,
                address: open.address,
                mnemonic: open.mnemonic,
                changes: Object.freeze([...open.changes]),
              });
              completed.push(record);
              index += 1;
              open = undefined;
            }
            break;
          case 'register-write':
            if (open !== undefined && isRegisterWrite(payload)) {
              addChange(open, payload.register, payload.before, payload.after);
            }
            break;
          case 'flag-update':
            if (open !== undefined && isFlagUpdate(payload)) {
              addChange(open, payload.flag, payload.before, payload.after);
            }
            break;
          case 'memory-write':
            if (open !== undefined && isMemoryWrite(payload)) {
              addChange(open, `memory[${String(payload.address)}]`, payload.before, payload.after);
            }
            break;
          case 'output-emitted':
            if (
              open !== undefined &&
              outputRegisterName !== undefined &&
              isOutputEmitted(payload)
            ) {
              addChange(open, outputRegisterName, payload.before, payload.after);
            }
            break;
          default:
            break;
        }
      }
      return Object.freeze(completed);
    },
    reset(): void {
      open = undefined;
      index = 0;
    },
  };

  return recorder;
}

/** Appends one frozen change to the open instruction. */
function addChange(
  target: OpenInstruction,
  name: string,
  before: number | boolean,
  after: number | boolean,
): void {
  target.changes.push(Object.freeze({ target: name, before, after }));
}

/** True for any non-null object, so its fields can be checked with `in`. */
function isObjectLike(payload: unknown): payload is object {
  return typeof payload === 'object' && payload !== null;
}

function isInstructionStart(payload: unknown): payload is SharedEventPayloads['instruction-start'] {
  return (
    isObjectLike(payload) &&
    'address' in payload &&
    typeof payload.address === 'number' &&
    'mnemonic' in payload &&
    typeof payload.mnemonic === 'string'
  );
}

function isInstructionEnd(payload: unknown): payload is SharedEventPayloads['instruction-end'] {
  return (
    isObjectLike(payload) &&
    'address' in payload &&
    typeof payload.address === 'number' &&
    'mnemonic' in payload &&
    typeof payload.mnemonic === 'string' &&
    'nextAddress' in payload &&
    typeof payload.nextAddress === 'number'
  );
}

function isRegisterWrite(payload: unknown): payload is SharedEventPayloads['register-write'] {
  return (
    isObjectLike(payload) &&
    'register' in payload &&
    typeof payload.register === 'string' &&
    'before' in payload &&
    typeof payload.before === 'number' &&
    'after' in payload &&
    typeof payload.after === 'number'
  );
}

function isFlagUpdate(payload: unknown): payload is SharedEventPayloads['flag-update'] {
  return (
    isObjectLike(payload) &&
    'flag' in payload &&
    typeof payload.flag === 'string' &&
    'before' in payload &&
    typeof payload.before === 'boolean' &&
    'after' in payload &&
    typeof payload.after === 'boolean'
  );
}

function isMemoryWrite(payload: unknown): payload is SharedEventPayloads['memory-write'] {
  return (
    isObjectLike(payload) &&
    'address' in payload &&
    typeof payload.address === 'number' &&
    'before' in payload &&
    typeof payload.before === 'number' &&
    'after' in payload &&
    typeof payload.after === 'number'
  );
}

function isOutputEmitted(payload: unknown): payload is SharedEventPayloads['output-emitted'] {
  return (
    isObjectLike(payload) &&
    'before' in payload &&
    typeof payload.before === 'number' &&
    'after' in payload &&
    typeof payload.after === 'number'
  );
}
