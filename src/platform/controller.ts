import { createBreakpointSet } from './breakpoints';
import { stampEvents } from './events';
import { createExecutionHistory, createInstructionRecorder } from './history';
import { createInstanceGuard } from './instance-guard';
import { nextState } from './lifecycle';
import type { LifecycleAction } from './lifecycle';
import { validateMemoryRange } from './memory-range';
import type { ArchitectureRegistry } from './registry';
import { err, ok } from './result';
import type { Diagnostic, Result } from './result';
import { buildSnapshot } from './snapshots';
import type {
  Address,
  ArchitectureId,
  ClockCycle,
  ControllerUpdate,
  CpuSnapshot,
  CpuState,
  CpuStateCopy,
  ExecutionEvent,
  InstructionRecord,
  MemoryRange,
  MemoryReadResult,
  ProgramImage,
  StepOutcome,
  UpdateReason,
} from './types';

/** Options for creating a controller (MODULE_CONTRACTS §2.4). */
export interface ControllerOptions {
  readonly registry: ArchitectureRegistry;
  readonly architectureId: ArchitectureId; // fixed at creation (SC-D3)
  readonly historyLimit: number; // positive integer; the default is DR-024, not set here
}

/** The single public entry point the application uses to drive a CPU (MODULE_CONTRACTS §2.4). */
export interface ExecutionController {
  readonly architectureId: ArchitectureId;

  /** The current published snapshot. Frozen. Same object until the state changes. */
  snapshot(): CpuSnapshot;
  /** The instruction history, oldest first. Frozen. Same object until the history changes. */
  history(): readonly InstructionRecord[];

  /** Registers a listener for every ControllerUpdate. Returns an unsubscribe function. */
  subscribe(listener: (update: ControllerUpdate) => void): () => void;

  /** Loads an assembled program. Errors: PLT-RUNNING, PLT-ARCHITECTURE-MISMATCH, architecture load errors. */
  load(image: ProgramImage): Result<ControllerUpdate, Diagnostic>;
  /** Restores the post-load state. Allowed in every state. Never returns an error. */
  reset(): ControllerUpdate;

  /** Replaces the breakpoint set. Errors: PLT-BREAKPOINT-RANGE, PLT-ARGUMENT. */
  setBreakpoints(addresses: readonly Address[]): Result<void, Diagnostic>;

  /** Ready or paused → running. Errors: PLT-NO-PROGRAM, PLT-ALREADY-RUNNING. */
  beginRun(): Result<ControllerUpdate, Diagnostic>;
  /** Runs up to maxCycles clock cycles. Errors: PLT-ARGUMENT, PLT-NOT-RUNNING. */
  runBatch(maxCycles: number): Result<ControllerUpdate, Diagnostic>;
  /** Running → paused. Errors: PLT-NOT-RUNNING. */
  endRun(): Result<ControllerUpdate, Diagnostic>;

  /** Advances exactly one clock cycle. Errors: PLT-NO-PROGRAM, PLT-RUNNING. */
  stepClock(): Result<ControllerUpdate, Diagnostic>;
  /** Advances to the next instruction boundary. Errors: PLT-NO-PROGRAM, PLT-RUNNING. */
  stepInstruction(): Result<ControllerUpdate, Diagnostic>;

  /** Reads a memory range as a copy. Error: PLT-MEMORY-RANGE. */
  readMemory(range: MemoryRange): Result<MemoryReadResult, Diagnostic>;
}

/** How one run of the step pipeline ended. */
type CycleEnd =
  { readonly kind: 'committed'; readonly outcome: StepOutcome } | { readonly kind: 'failed' };

const FAILED: CycleEnd = { kind: 'failed' };

function diagnostic(code: string, message: string): Diagnostic {
  return { code, severity: 'error', message };
}

/** A frozen copy of a diagnostic, safe to publish in a snapshot and in a fault event. */
function frozenDiagnostic(source: Diagnostic): Diagnostic {
  const span = source.span === undefined ? {} : { span: Object.freeze({ ...source.span }) };
  return Object.freeze({
    code: source.code,
    severity: source.severity,
    message: source.message,
    ...span,
  });
}

/** Creates the controller for one architecture of the registry (MODULE_CONTRACTS §2.4). */
export function createController(
  options: ControllerOptions,
): Result<ExecutionController, Diagnostic> {
  const found = options.registry.lookup(options.architectureId);
  if (!found.ok) return err(found.error);
  const architecture = found.value;
  const descriptor = architecture.descriptor;
  const architectureId = descriptor.isa.architectureId; // single source of identity (DR-069)

  const createdHistory = createExecutionHistory(options.historyLimit);
  if (!createdHistory.ok) return err(createdHistory.error);
  const history = createdHistory.value;

  const guard = createInstanceGuard(architecture);
  const initial = guard.readState();
  // No snapshot exists yet, so a failure here cannot be published as a fault update.
  if (initial.kind === 'internal') return err(initial.diagnostic);

  const outputRegister = descriptor.registers.find((register) => register.role === 'output');
  const recorder = createInstructionRecorder(outputRegister?.name);
  const breakpoints = createBreakpointSet();

  // Committed state. Nothing is published that is not committed (DR-074).
  let state: CpuState = 'ready';
  let counter: ClockCycle = 0; // the only authoritative cycle counter (DR-067)
  let programLoaded = false;
  let lastFault: Diagnostic | undefined;
  let committed: CpuStateCopy = initial.value;
  /** Events already published with `cycle === counter`; the next fault event's sequence (DR-075). */
  let eventsAtCounter = 0;
  /** True when the instance must be replaced before it is used again (DR-071). */
  let mustReplace = false;

  let published: CpuSnapshot = buildSnapshot(committed, { architectureId, cycle: counter, state });
  /** What `published` was built from; a new snapshot is built only when one of these changes. */
  let basis: {
    readonly state: CpuState;
    readonly counter: ClockCycle;
    readonly lastFault: Diagnostic | undefined;
    readonly committed: CpuStateCopy;
  } = { state, counter, lastFault, committed };

  let listeners: readonly ((update: ControllerUpdate) => void)[] = [];
  let notifying = false;

  /** Applies a lifecycle action that the controller knows to be legal in the current state. */
  function transition(action: LifecycleAction): void {
    const next = nextState(state, action);
    if (!next.ok) {
      // Programmer error: the controller requested a transition its own checks should prevent.
      throw new Error(`Lifecycle invariant broken: ${action} in state ${state}`);
    }
    state = next.value;
  }

  /** State-changing calls made from inside a listener are programmer errors (DR-077 h). */
  function refuseDuringNotification(operation: string): void {
    if (notifying) {
      throw new Error(`${operation} was called from inside a controller listener.`);
    }
  }

  /** DR-077 c: fault, else halt, else breakpoint (batches), else the request's own reason. */
  function reasonFor(own: UpdateReason, breakpointHit?: Address): UpdateReason {
    if (state === 'faulted') return 'fault';
    if (state === 'halted') return 'halt';
    if (breakpointHit !== undefined && own === 'run-batch') return 'breakpoint';
    return own;
  }

  /** Builds, freezes and delivers the update for one call (MODULE_CONTRACTS §2.4.6). */
  function publish(
    reason: UpdateReason,
    events: readonly ExecutionEvent[],
    cyclesCompleted: number,
    options: { readonly breakpointHit?: Address; readonly forceSnapshot?: boolean } = {},
  ): ControllerUpdate {
    const changed =
      basis.state !== state ||
      basis.counter !== counter ||
      basis.lastFault !== lastFault ||
      basis.committed !== committed;
    if (changed || options.forceSnapshot === true) {
      published = buildSnapshot(committed, {
        architectureId,
        cycle: counter,
        state,
        ...(lastFault === undefined ? {} : { lastFault }),
      });
      basis = { state, counter, lastFault, committed };
    }
    const update: ControllerUpdate = Object.freeze({
      reason,
      snapshot: published,
      events: Object.freeze([...events]),
      cyclesCompleted,
      ...(options.breakpointHit === undefined ? {} : { breakpointHit: options.breakpointHit }),
    });

    // The list is copied, so subscriptions made during a notification apply from the next one.
    const current = listeners;
    notifying = true;
    try {
      for (const listener of current) {
        listener(update); // a throw stops the notification and reaches the caller (DR-080)
      }
    } finally {
      notifying = false;
    }
    return update;
  }

  /** The zero-progress answer for a request made in `halted` or `faulted` (§2.4.2). */
  function noProgress(reason: UpdateReason): ControllerUpdate {
    return publish(reason, [], 0);
  }

  /** Fault path: a simulated CPU fault, or an internal failure. Counts no cycle (DR-070). */
  function enterFault(cause: Diagnostic, events: ExecutionEvent[]): void {
    const fault = frozenDiagnostic(cause);
    transition('fault');
    lastFault = fault;
    events.push(
      Object.freeze({
        kind: 'fault',
        cycle: counter,
        sequence: eventsAtCounter, // the next free sequence in this cycle (DR-075)
        payload: Object.freeze({ diagnostic: fault }),
      }),
    );
    eventsAtCounter += 1;
  }

  /** Internal-failure path: the instance is not used again until it is replaced (DR-071). */
  function enterInternalFault(cause: Diagnostic, events: ExecutionEvent[]): void {
    mustReplace = true;
    enterFault(cause, events);
  }

  /**
   * The step pipeline for one clock cycle (PHASE_1_EXECUTION_PLAN §5, DR-074).
   * Either commits the whole cycle or commits nothing and enters the fault path.
   */
  function runCycle(events: ExecutionEvent[]): CycleEnd {
    const stepped = guard.stepClock();
    if (stepped.kind === 'internal') {
      enterInternalFault(stepped.diagnostic, events);
      return FAILED;
    }
    const outcome = stepped.value;
    if (outcome.fault !== undefined) {
      enterFault(outcome.fault, events);
      return FAILED;
    }
    const stamped = stampEvents(counter, outcome.events, architectureId);
    if (!stamped.ok) {
      enterInternalFault(
        diagnostic(
          'PLT-INTERNAL',
          `The architecture emitted an event the platform rejects (${stamped.error.code}): ${stamped.error.message}`,
        ),
        events,
      );
      return FAILED;
    }
    const read = guard.readState();
    if (read.kind === 'internal') {
      enterInternalFault(read.diagnostic, events);
      return FAILED;
    }

    // Commit. From here on nothing can fail.
    if (outcome.cyclesCompleted > 0) {
      counter += outcome.cyclesCompleted;
      eventsAtCounter = stamped.value.length;
    }
    committed = read.value;
    events.push(...stamped.value);
    for (const record of recorder.record(stamped.value)) {
      history.append(record);
    }
    if (outcome.halted) transition('halt');
    return { kind: 'committed', outcome };
  }

  /** Replaces an unreliable instance. Returns false when the replacement itself failed. */
  function recoverInstance(events: ExecutionEvent[]): boolean {
    if (!mustReplace && guard.reliable) return true;
    const replaced = guard.replace();
    if (replaced.kind === 'internal') {
      enterInternalFault(replaced.diagnostic, events);
      return false;
    }
    mustReplace = false;
    return true;
  }

  /** Clears run data after a successful load or reset (MODULE_CONTRACTS §2.4.1). */
  function restart(copy: CpuStateCopy): void {
    counter = 0;
    eventsAtCounter = 0;
    lastFault = undefined;
    committed = copy;
    history.clear();
    recorder.reset();
    state = 'ready';
  }

  /** DR-027: a step reports a hit only after a completed cycle that ended an instruction. */
  function hitAfter(end: CycleEnd | undefined): Address | undefined {
    if (end === undefined || end.kind !== 'committed') return undefined;
    if (!end.outcome.instructionCompleted || end.outcome.halted) return undefined;
    if (end.outcome.cyclesCompleted < 1) return undefined;
    return breakpoints.has(committed.programCounter) ? committed.programCounter : undefined;
  }

  /** Shared body of stepClock and stepInstruction. */
  function step(
    action: 'clock-step' | 'instruction-step',
    untilBoundary: boolean,
  ): Result<ControllerUpdate, Diagnostic> {
    refuseDuringNotification(action);
    if (!programLoaded) {
      return err(diagnostic('PLT-NO-PROGRAM', 'Load a program before stepping.'));
    }
    const next = nextState(state, action);
    if (!next.ok) return err(next.error);
    if (state === 'halted' || state === 'faulted') return ok(noProgress(action));
    state = next.value;

    const events: ExecutionEvent[] = [];
    const before = counter;
    let end: CycleEnd;
    do {
      end = runCycle(events);
    } while (
      untilBoundary &&
      end.kind === 'committed' &&
      !end.outcome.instructionCompleted &&
      !end.outcome.halted
    );

    const breakpointHit = hitAfter(end);
    return ok(
      publish(reasonFor(action), events, counter - before, {
        ...(breakpointHit === undefined ? {} : { breakpointHit }),
      }),
    );
  }

  const controller: ExecutionController = {
    architectureId,

    snapshot(): CpuSnapshot {
      return published;
    },

    history(): readonly InstructionRecord[] {
      return history.entries();
    },

    subscribe(listener: (update: ControllerUpdate) => void): () => void {
      listeners = [...listeners, listener];
      let active = true;
      return (): void => {
        if (!active) return;
        active = false;
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners = [...listeners.slice(0, index), ...listeners.slice(index + 1)];
        }
      };
    },

    load(image: ProgramImage): Result<ControllerUpdate, Diagnostic> {
      refuseDuringNotification('load');
      const next = nextState(state, 'load');
      if (!next.ok) return err(next.error);
      if (image.architectureId !== architectureId) {
        return err(
          diagnostic(
            'PLT-ARCHITECTURE-MISMATCH',
            `This program was assembled for "${image.architectureId}", but the CPU is "${architectureId}".`,
          ),
        );
      }

      const events: ExecutionEvent[] = [];
      if (!recoverInstance(events)) return ok(publish('fault', events, 0));
      const loaded = guard.loadProgram(image);
      if (loaded.kind === 'internal') {
        enterInternalFault(loaded.diagnostic, events);
        return ok(publish('fault', events, 0));
      }
      if (!loaded.value.ok) return err(loaded.value.error);
      // The architecture has accepted the program, so it is loaded even if the state read fails.
      programLoaded = true;
      const read = guard.readState();
      if (read.kind === 'internal') {
        enterInternalFault(read.diagnostic, events);
        return ok(publish('fault', events, 0));
      }

      restart(read.value);
      return ok(publish('load', events, 0, { forceSnapshot: true }));
    },

    reset(): ControllerUpdate {
      refuseDuringNotification('reset');
      const events: ExecutionEvent[] = [];
      if (!recoverInstance(events)) return publish('fault', events, 0);
      const restored = guard.reset();
      if (restored.kind === 'internal') {
        enterInternalFault(restored.diagnostic, events);
        return publish('fault', events, 0);
      }
      const read = guard.readState();
      if (read.kind === 'internal') {
        enterInternalFault(read.diagnostic, events);
        return publish('fault', events, 0);
      }

      restart(read.value);
      return publish('reset', events, 0, { forceSnapshot: true });
    },

    setBreakpoints(addresses: readonly Address[]): Result<void, Diagnostic> {
      refuseDuringNotification('setBreakpoints');
      return breakpoints.replace(addresses, descriptor.addressBits);
    },

    beginRun(): Result<ControllerUpdate, Diagnostic> {
      refuseDuringNotification('beginRun');
      if (!programLoaded) {
        return err(diagnostic('PLT-NO-PROGRAM', 'Load a program before running.'));
      }
      const next = nextState(state, 'begin-run');
      if (!next.ok) return err(next.error);
      if (state === 'halted' || state === 'faulted') return ok(noProgress('run-start'));
      state = next.value;
      return ok(publish('run-start', [], 0));
    },

    runBatch(maxCycles: number): Result<ControllerUpdate, Diagnostic> {
      refuseDuringNotification('runBatch');
      if (!Number.isInteger(maxCycles) || maxCycles < 1) {
        return err(
          diagnostic('PLT-ARGUMENT', 'The number of cycles to run must be a positive integer.'),
        );
      }
      if (state !== 'running') {
        return err(diagnostic('PLT-NOT-RUNNING', 'The CPU is not running. Start a run first.'));
      }

      const events: ExecutionEvent[] = [];
      const before = counter;
      let breakpointHit: Address | undefined;
      // At most maxCycles pipeline runs, so a cycle that completes nothing still uses budget.
      for (let attempt = 0; attempt < maxCycles; attempt += 1) {
        const end = runCycle(events);
        if (end.kind === 'failed' || end.outcome.halted) break;
        breakpointHit = hitAfter(end);
        if (breakpointHit !== undefined) {
          transition('end-run'); // a breakpoint stop pauses; it is never a fault (DR-076)
          break;
        }
      }
      return ok(
        publish(reasonFor('run-batch', breakpointHit), events, counter - before, {
          ...(breakpointHit === undefined ? {} : { breakpointHit }),
        }),
      );
    },

    endRun(): Result<ControllerUpdate, Diagnostic> {
      refuseDuringNotification('endRun');
      const next = nextState(state, 'end-run');
      if (!next.ok) return err(next.error);
      state = next.value;
      return ok(publish('run-end', [], 0));
    },

    stepClock(): Result<ControllerUpdate, Diagnostic> {
      return step('clock-step', false);
    },

    stepInstruction(): Result<ControllerUpdate, Diagnostic> {
      return step('instruction-step', true);
    },

    readMemory(range: MemoryRange): Result<MemoryReadResult, Diagnostic> {
      const valid = validateMemoryRange(range, descriptor.memoryBytes);
      if (!valid.ok) return err(valid.error);
      const { start, length } = valid.value;
      // Read from the published snapshot: the architecture is never called (ERR-06).
      return ok({
        range: Object.freeze({ start, length }),
        bytes: published.memory.slice(start, start + length),
      });
    },
  };

  return ok(controller);
}
