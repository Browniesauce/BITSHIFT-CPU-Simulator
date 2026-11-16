import type { Diagnostic, Result } from './result';
import { err, ok } from './result';
import type { ArchitectureEvent, ArchitectureId, ClockCycle, ExecutionEvent } from './types';

/** Shared event kinds an architecture may emit unnamespaced (EVENT_MODEL §3.2, excluding 'fault'). */
const SHARED_KINDS: ReadonlySet<string> = new Set<string>([
  'micro-operation',
  'bus-transfer',
  'register-write',
  'memory-read',
  'memory-write',
  'alu-operation',
  'flag-update',
  'output-emitted',
  'instruction-start',
  'instruction-end',
  'halted',
]);

/** Separator between an architecture namespace and its custom kind (EVENT_MODEL §4). */
const NAMESPACE_SEPARATOR = '/';

/**
 * Stamps one step's architecture events with absolute cycle and sequence, enforcing kind rules
 * (EVENT_MODEL §2, §4, §9). Pure: returns frozen new events and never mutates the input.
 */
export function stampEvents(
  cycleBefore: ClockCycle,
  events: readonly ArchitectureEvent[],
  architectureId: ArchitectureId,
): Result<readonly ExecutionEvent[], Diagnostic> {
  for (const [index, event] of events.entries()) {
    if (!isAcceptedKind(event.kind, architectureId)) {
      return err(rejectedKindDiagnostic(index, event.kind, architectureId));
    }
  }

  const countPerCycle = new Map<ClockCycle, number>();
  const stamped: ExecutionEvent[] = [];

  for (const event of events) {
    const cycle = cycleBefore + event.cycleOffset;
    const sequence = countPerCycle.get(cycle) ?? 0;
    countPerCycle.set(cycle, sequence + 1);
    deepFreeze(event.payload, new WeakSet<object>());
    stamped.push(Object.freeze({ kind: event.kind, cycle, sequence, payload: event.payload }));
  }

  return ok(Object.freeze(stamped));
}

/** Tells whether an architecture may emit this kind (EVENT_MODEL §4). */
function isAcceptedKind(kind: string, architectureId: ArchitectureId): boolean {
  const separator = kind.indexOf(NAMESPACE_SEPARATOR);
  if (separator === -1) {
    return SHARED_KINDS.has(kind);
  }
  const namespace = kind.slice(0, separator);
  const customPart = kind.slice(separator + NAMESPACE_SEPARATOR.length);
  return namespace === architectureId && customPart.length > 0;
}

/** Builds the PLT-EVENT-NAMESPACE diagnostic for a rejected event (EVENT_MODEL §4). */
function rejectedKindDiagnostic(
  index: number,
  kind: string,
  architectureId: ArchitectureId,
): Diagnostic {
  return {
    code: 'PLT-EVENT-NAMESPACE',
    severity: 'error',
    message:
      `Event ${index} has kind "${kind}", which architecture "${architectureId}" may not emit. ` +
      `Use a shared kind, or a custom kind "${architectureId}/<name>". ` +
      `The 'fault' kind is reserved for the platform.`,
  };
}

/** Freezes plain objects and arrays in place, recursively; other values are left alone (EVENT_MODEL §9). */
function deepFreeze(value: unknown, seen: WeakSet<object>): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    for (const item of items) {
      deepFreeze(item, seen);
    }
    Object.freeze(value);
    return;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return;
  }
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(record)) {
    deepFreeze(record[key], seen);
  }
  Object.freeze(value);
}
