import { describe, expect, it } from 'vitest';
import { createArchitectureRegistry, createController, ok } from '../../src/platform';
import type {
  ControllerUpdate,
  CpuSnapshot,
  Diagnostic,
  ExecutionController,
  ExecutionEvent,
  InstructionRecord,
  MemoryReadResult,
  Result,
} from '../../src/platform';
import { createFixtureArchitecture, defaultScript } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  fixtureImage,
  loadedHarness,
  makeHarness,
  must,
} from './helpers/controller-harness';

// DET-01 and DET-02 (TEST_STRATEGY section 5.2). The controller is synchronous and has no timers,
// so the same call sequence must produce the same results, snapshots, histories and updates.
//
// The fixture's default script (hand-worked table in fixture-architecture.ts):
//   instructions complete on cycles 4, 7, 11 and 13 (the halt); IP is 1, 3, 4, 4 there.
//   Cycle 3 leaves IP at 0. A breakpoint on 1 hits on cycle 4, on 3 on cycle 7, on 4 on cycle 11.

/** One named request, applied to whichever controller is given. */
type Reply =
  | Result<ControllerUpdate, Diagnostic>
  | Result<void, Diagnostic>
  | Result<MemoryReadResult, Diagnostic>;

interface Call {
  readonly name: string;
  readonly run: (controller: ExecutionController) => Reply;
}

/** What one call looked like from outside: its result, the state after it, and what it delivered. */
interface TraceEntry {
  readonly step: string;
  readonly result: Reply;
  readonly snapshot: CpuSnapshot;
  readonly history: readonly InstructionRecord[];
  /** Updates the subscriber received during this call, in delivery order. */
  readonly delivered: readonly ControllerUpdate[];
}

function call(name: string, run: (controller: ExecutionController) => Reply): Call {
  return { name, run };
}

/**
 * Applies calls in order and records a trace entry after each one. The subscriber is attached
 * before the first call, so every update the controller publishes is seen.
 */
function runTrace(controller: ExecutionController, calls: readonly Call[]): TraceEntry[] {
  const delivered: ControllerUpdate[] = [];
  controller.subscribe((update) => {
    delivered.push(update);
  });
  return calls.map((step): TraceEntry => {
    const before = delivered.length;
    const result = step.run(controller);
    return {
      step: step.name,
      result,
      snapshot: controller.snapshot(),
      history: [...controller.history()],
      delivered: delivered.slice(before),
    };
  });
}

/** The trace of one call without its name, so that two sequences with different labels can be compared. */
function body(entry: TraceEntry): Omit<TraceEntry, 'step'> {
  return {
    result: entry.result,
    snapshot: entry.snapshot,
    history: entry.history,
    delivered: entry.delivered,
  };
}

/** Compares two traces entry by entry. A failure names the call that differs. */
function expectSameTrace(actual: readonly TraceEntry[], expected: readonly TraceEntry[]): void {
  expect(actual.map((e) => e.step)).toEqual(expected.map((e) => e.step));
  expected.forEach((entry, index) => {
    expect(actual[index], `call ${index} (${entry.step})`).toEqual(entry);
  });
}

/** Builds a fresh controller over its own fixture architecture and registry, then traces the calls. */
function traceOn(script: readonly FixtureCycle[], calls: readonly Call[]): TraceEntry[] {
  const { controller } = makeHarness({ script });
  return runTrace(controller, calls);
}

function findEntry(trace: readonly TraceEntry[], step: string): TraceEntry {
  const found = trace.find((entry) => entry.step === step);
  if (found === undefined) throw new Error(`no call named "${step}"`);
  return found;
}

function isUpdate(value: unknown): value is ControllerUpdate {
  return typeof value === 'object' && value !== null && 'reason' in value && 'snapshot' in value;
}

/** The update of a successful call. Fails the test when the call was refused or was not an update. */
function updateOf(entry: TraceEntry): ControllerUpdate {
  const { result } = entry;
  if (!result.ok || !isUpdate(result.value)) throw new Error(`${entry.step}: expected an update`);
  return result.value;
}

/** The sequence used for DET-01. It covers every kind of request and both halves of a run. */
const MAIN_SEQUENCE: readonly Call[] = [
  call('load', (c) => c.load(fixtureImage())),
  call('stepClock to cycle 1', (c) => c.stepClock()),
  call('stepClock to cycle 2', (c) => c.stepClock()),
  call('stepClock to cycle 3', (c) => c.stepClock()),
  call('stepInstruction to cycle 4', (c) => c.stepInstruction()),
  call('setBreakpoints [3]', (c) => c.setBreakpoints([3])),
  call('beginRun', (c) => c.beginRun()),
  call('runBatch(2) to cycle 6', (c) => c.runBatch(2)),
  call('endRun', (c) => c.endRun()),
  call('stepInstruction to cycle 7, hits 3', (c) => c.stepInstruction()),
  call('beginRun again', (c) => c.beginRun()),
  call('stepClock while running (refused)', (c) => c.stepClock()),
  call('runBatch(0) while running (refused)', (c) => c.runBatch(0)),
  call('setBreakpoints [4]', (c) => c.setBreakpoints([4])),
  call('runBatch(1000) to breakpoint 4', (c) => c.runBatch(1000)),
  call('setBreakpoints []', (c) => c.setBreakpoints([])),
  call('beginRun after breakpoint', (c) => c.beginRun()),
  call('runBatch(1000) to halt', (c) => c.runBatch(1000)),
  call('stepClock after halt', (c) => c.stepClock()),
  call('stepInstruction after halt', (c) => c.stepInstruction()),
  call('runBatch(5) after halt (refused)', (c) => c.runBatch(5)),
  call('endRun after halt (refused)', (c) => c.endRun()),
  call('readMemory after halt', (c) => c.readMemory({ start: 0, length: 3 })),
  call('reset', (c) => ok(c.reset())),
  call('setBreakpoints [1, 4]', (c) => c.setBreakpoints([1, 4])),
  call('beginRun after reset', (c) => c.beginRun()),
  call('runBatch(1000) to breakpoint 1', (c) => c.runBatch(1000)),
  call('beginRun after breakpoint 1', (c) => c.beginRun()),
  call('runBatch(1000) to breakpoint 4 again', (c) => c.runBatch(1000)),
  call('beginRun after breakpoint 4', (c) => c.beginRun()),
  call('runBatch(1000) to halt again', (c) => c.runBatch(1000)),
];

describe('DET-01: two fresh controllers, the same calls, the same everything', () => {
  it('every result, snapshot, history and delivered update matches after every call', () => {
    const script = defaultScript(FIXTURE_ID);
    const first = traceOn(script, MAIN_SEQUENCE);
    const second = traceOn(script, MAIN_SEQUENCE);
    expect(first).toHaveLength(MAIN_SEQUENCE.length);
    expectSameTrace(second, first);

    // The sequence must really exercise the controller, or the equality above proves little.
    const errorCodes = first.flatMap((entry) => (entry.result.ok ? [] : [codeOf(entry.result)]));
    expect(errorCodes).toEqual(
      expect.arrayContaining(['PLT-RUNNING', 'PLT-ARGUMENT', 'PLT-NOT-RUNNING']),
    );
    const reasons = first.flatMap((entry) => entry.delivered.map((update) => update.reason));
    expect(reasons).toContain('breakpoint');
    expect(reasons).toContain('halt');
    expect(reasons).not.toContain('fault');

    // Hand-worked values from the default script's table, so the trace is not compared to itself only.
    expect(findEntry(first, 'stepClock to cycle 3').snapshot.programCounter).toBe(0);
    const atFour = updateOf(findEntry(first, 'stepInstruction to cycle 4'));
    expect(atFour.snapshot.cycle).toBe(4);
    expect(atFour.snapshot.programCounter).toBe(1);
    const hitThree = updateOf(findEntry(first, 'stepInstruction to cycle 7, hits 3'));
    expect(hitThree.breakpointHit).toBe(3);
    expect(hitThree.snapshot.cycle).toBe(7);
    const hitFour = updateOf(findEntry(first, 'runBatch(1000) to breakpoint 4'));
    expect(hitFour.reason).toBe('breakpoint');
    expect(hitFour.breakpointHit).toBe(4);
    expect(hitFour.snapshot.cycle).toBe(11);
    expect(hitFour.snapshot.state).toBe('paused');
    const halted = updateOf(findEntry(first, 'runBatch(1000) to halt'));
    expect(halted.reason).toBe('halt');
    expect(halted.snapshot.cycle).toBe(13);
    expect(halted.snapshot.state).toBe('halted');
    const hitOne = updateOf(findEntry(first, 'runBatch(1000) to breakpoint 1'));
    expect(hitOne.breakpointHit).toBe(1);
    expect(hitOne.snapshot.cycle).toBe(4);
  });
});

/**
 * The mid-run reset design (DET-01, second pair of controllers).
 *
 * Run A is MAIN_SEQUENCE on one controller. Run B is HEAD, then a reset, then MAIN_SEQUENCE without
 * its first call (the load). HEAD leaves the program loaded and the CPU running at cycle 6, with
 * one instruction in the history and no breakpoints set. A reset restores the loaded program to
 * cycle 0 and clears the history (MODULE_CONTRACTS section 2.4.1), so the state after the reset
 * equals the state after A's load. Every later call of B must therefore match the matching call of
 * A: the same results, snapshots, histories and delivered updates. Only the step labels differ.
 */
const HEAD: readonly Call[] = [
  call('head load', (c) => c.load(fixtureImage())),
  call('head stepClock', (c) => c.stepClock()),
  call('head stepInstruction', (c) => c.stepInstruction()),
  call('head beginRun', (c) => c.beginRun()),
  call('head runBatch(2)', (c) => c.runBatch(2)),
];
const MID_RESET: Call = call('reset in the middle', (c) => ok(c.reset()));
const MID_SEQUENCE: readonly Call[] = [...HEAD, MID_RESET, ...MAIN_SEQUENCE.slice(1)];

describe('DET-01 with a reset in the middle of a run', () => {
  it('after the reset, a run matches the uninterrupted run from the same point', () => {
    const script = defaultScript(FIXTURE_ID);
    const plain = traceOn(script, MAIN_SEQUENCE);
    const withResetFirst = traceOn(script, MID_SEQUENCE);
    const withResetSecond = traceOn(script, MID_SEQUENCE);
    expectSameTrace(withResetSecond, withResetFirst);

    // The reset really had something to clear: the head left one history record and a running CPU.
    const beforeReset = withResetFirst[HEAD.length - 1];
    expect(beforeReset.snapshot.state).toBe('running');
    expect(beforeReset.history).toHaveLength(1);
    const reset = withResetFirst[HEAD.length];
    expect(updateOf(reset).reason).toBe('reset');
    expect(reset.snapshot.state).toBe('ready');
    expect(reset.snapshot.cycle).toBe(0);
    expect(reset.history).toHaveLength(0);
    // The equivalent point of the plain run is the state after its load (index 0).
    expect(reset.snapshot).toEqual(plain[0].snapshot);

    // Every call after the reset equals the plain run's call with the same position.
    const tail = withResetFirst.slice(HEAD.length + 1);
    expect(tail).toHaveLength(MAIN_SEQUENCE.length - 1);
    tail.forEach((entry, index) => {
      expect(body(entry), `after reset, call ${index} (${entry.step})`).toEqual(
        body(plain[index + 1]),
      );
    });
  });
});

/** Good cycles shared by the two failing scripts. Cycle 4 is the one that fails. */
const GOOD_CYCLES: readonly FixtureCycle[] = [
  {
    events: [
      { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-X' } },
      { kind: 'micro-operation', payload: { controlSignals: ['s'] } },
    ],
  },
  { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 5 } }] },
  { events: [{ kind: 'flag-update', payload: { flag: 'F1', before: false, after: true } }] },
];

const FAULT: Diagnostic = { code: `${FIXTURE_ID}/BAD-STEP`, severity: 'error', message: 'bad' };

/** Fails with a simulated CPU fault, or with an internal exception when `throws` is given. */
const FAULT_SCRIPT: readonly FixtureCycle[] = [...GOOD_CYCLES, { fault: FAULT }];
const THROW_SCRIPT: readonly FixtureCycle[] = [...GOOD_CYCLES, { throws: 'boom' }];

/**
 * A run that fails on cycle 4, is refused while faulted, is recovered by a reset, and fails again
 * on the replayed script. Each reset replays the script from its start (the fixture's reset, or a
 * fresh instance after an internal failure), so the second failure is on cycle 4 again.
 */
const FAILURE_SEQUENCE: readonly Call[] = [
  call('load', (c) => c.load(fixtureImage())),
  call('stepClock to cycle 1', (c) => c.stepClock()),
  call('stepInstruction, fails on cycle 4', (c) => c.stepInstruction()),
  call('stepClock while faulted', (c) => c.stepClock()),
  call('beginRun while faulted', (c) => c.beginRun()),
  call('runBatch(3) while faulted (refused)', (c) => c.runBatch(3)),
  call('endRun while faulted (refused)', (c) => c.endRun()),
  call('reset recovers', (c) => ok(c.reset())),
  call('stepClock after recovery', (c) => c.stepClock()),
  call('beginRun after recovery', (c) => c.beginRun()),
  call('runBatch(1000), fails again on cycle 4', (c) => c.runBatch(1000)),
  call('stepInstruction while faulted', (c) => c.stepInstruction()),
  call('reset after second failure', (c) => ok(c.reset())),
];

/** Runs the failure sequence on two pairs, checks the pairs match, and checks the recovery. */
function checkFailureRecovery(script: readonly FixtureCycle[], expectedCode: string): void {
  const first = traceOn(script, FAILURE_SEQUENCE);
  const second = traceOn(script, FAILURE_SEQUENCE);
  expectSameTrace(second, first);

  const failed = updateOf(findEntry(first, 'stepInstruction, fails on cycle 4'));
  expect(failed.reason).toBe('fault');
  expect(failed.cyclesCompleted).toBe(2);
  expect(failed.snapshot.cycle).toBe(3);
  expect(failed.snapshot.state).toBe('faulted');
  expect(failed.snapshot.lastFault?.code).toBe(expectedCode);

  // While faulted, a clock step completes nothing and the state stays faulted.
  const stillFaulted = updateOf(findEntry(first, 'stepClock while faulted'));
  expect(stillFaulted.cyclesCompleted).toBe(0);
  expect(stillFaulted.snapshot.state).toBe('faulted');
  expect(stillFaulted.snapshot.cycle).toBe(3);
  expect(codeOf(findEntry(first, 'runBatch(3) while faulted (refused)').result)).toBe(
    'PLT-NOT-RUNNING',
  );

  // The reset is the recovery: ready, cycle 0, and no fault left in the snapshot.
  const recovered = updateOf(findEntry(first, 'reset recovers'));
  expect(recovered.snapshot.state).toBe('ready');
  expect(recovered.snapshot.cycle).toBe(0);
  expect('lastFault' in recovered.snapshot).toBe(false);

  // The replayed script fails on the same cycle again.
  const again = updateOf(findEntry(first, 'runBatch(1000), fails again on cycle 4'));
  expect(again.reason).toBe('fault');
  expect(again.snapshot.cycle).toBe(3);
  expect(again.snapshot.lastFault?.code).toBe(expectedCode);
}

describe('DET-01 with a failure (DR-070, DR-071)', () => {
  it('a simulated fault mid-instruction gives the same trace on both pairs, and a reset recovers', () => {
    checkFailureRecovery(FAULT_SCRIPT, FAULT.code);
  });

  it('an exception from the architecture gives the same trace on both pairs, and a reset recovers', () => {
    checkFailureRecovery(THROW_SCRIPT, 'PLT-INTERNAL');
  });
});

describe('DET-02: batch size does not change the result', () => {
  interface Finished {
    readonly snapshot: CpuSnapshot;
    readonly cycles: number;
    readonly events: readonly ExecutionEvent[];
    readonly history: readonly InstructionRecord[];
    readonly batches: number;
  }

  /** Runs the default script to its end with one batch size, on a fresh controller. */
  function runToHalt(batchSize: number): Finished {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    let cycles = 0;
    let batches = 0;
    const events: ExecutionEvent[] = [];
    while (controller.snapshot().state === 'running') {
      const update = must(controller.runBatch(batchSize));
      cycles += update.cyclesCompleted;
      events.push(...update.events);
      batches += 1;
      if (batches > 100) throw new Error('the run did not end');
    }
    return {
      snapshot: controller.snapshot(),
      cycles,
      events,
      history: [...controller.history()],
      batches,
    };
  }

  // Batch sizes and the number of batches ceil(13 / size) that the 13-cycle program needs.
  const SIZES: readonly (readonly [number, number])[] = [
    [1, 13],
    [2, 7],
    [3, 5],
    [5, 3],
    [7, 2],
    [13, 1],
    [1000, 1],
  ];

  it('every batch size reaches the same final snapshot, cycle count, events and history', () => {
    const reference = runToHalt(1);
    expect(reference.snapshot.state).toBe('halted');
    expect(reference.snapshot.cycle).toBe(13);
    expect(reference.cycles).toBe(13);
    expect(reference.events.length).toBeGreaterThan(0);
    expect(reference.history).toHaveLength(4);

    for (const [size, expectedBatches] of SIZES) {
      const run = runToHalt(size);
      expect(run.batches, `batches for size ${size}`).toBe(expectedBatches);
      expect(run.snapshot.state, `state for size ${size}`).toBe('halted');
      expect(run.cycles, `cycles for size ${size}`).toBe(13);
      expect(run.snapshot, `snapshot for size ${size}`).toEqual(reference.snapshot);
      expect(run.events, `events for size ${size}`).toEqual(reference.events);
      expect(run.history, `history for size ${size}`).toEqual(reference.history);
    }
  });
});

describe('two controllers sharing one architecture object (DET-01)', () => {
  it('stepping one leaves the other untouched, and the other then behaves like a fresh controller', () => {
    const architecture = createFixtureArchitecture({
      architectureId: FIXTURE_ID,
      script: defaultScript(FIXTURE_ID),
    });
    const registry = must(createArchitectureRegistry([architecture]));
    const make = (): ExecutionController =>
      must(createController({ registry, architectureId: FIXTURE_ID, historyLimit: 100 }));
    const first = make();
    const second = make();
    must(first.load(fixtureImage()));
    must(second.load(fixtureImage()));

    const secondSnapshot = second.snapshot();
    const secondHistory = second.history();

    // Step only the first controller, through one instruction and into the next.
    must(first.stepInstruction());
    must(first.stepInstruction());
    const firstNow = first.snapshot();
    expect(firstNow.cycle).toBe(7);
    expect(firstNow.programCounter).toBe(3);
    expect(first.history()).toHaveLength(2);

    expect(second.snapshot()).toBe(secondSnapshot);
    expect(second.history()).toEqual(secondHistory);
    expect(second.history()).toHaveLength(0);
    expect(second.snapshot().cycle).toBe(0);
    expect(second.snapshot().state).toBe('ready');

    // Now step the second controller. It must match a fresh controller with the same calls.
    const calls: readonly Call[] = [
      call('stepClock', (c) => c.stepClock()),
      call('stepClock', (c) => c.stepClock()),
      call('stepInstruction', (c) => c.stepInstruction()),
      call('beginRun', (c) => c.beginRun()),
      call('runBatch(1000)', (c) => c.runBatch(1000)),
    ];
    const fresh = loadedHarness().controller;
    expectSameTrace(runTrace(second, calls), runTrace(fresh, calls));

    // The first controller is still where it was, and its snapshot object is unchanged.
    expect(first.snapshot()).toBe(firstNow);
    expect(first.history()).toHaveLength(2);
  });
});
