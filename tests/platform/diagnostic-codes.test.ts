import { describe, expect, it, vi } from 'vitest';
import { createArchitectureRegistry } from '../../src/platform';
import type { Diagnostic, ExecutionController, Result } from '../../src/platform';
import { stampEvents } from '../../src/platform/events';
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
import type { ArchitectureCalls, Harness } from './helpers/controller-harness';
import { makeArchitecture, makeDescriptor } from './helpers/descriptors';

// ERR-01 and ERR-02 (TEST_STRATEGY section 5.7).
// Expected codes come from DATA_CONTRACTS section 11 and MODULE_CONTRACTS section 2.4,
// never from the implementation's output.

/** The codes DATA_CONTRACTS section 11 lists for the ARCH- and PLT- prefixes, written by hand. */
const CONTRACT_CODES: readonly string[] = [
  'ARCH-UNKNOWN-ID',
  'ARCH-DUPLICATE-ID',
  'ARCH-INVALID-DESCRIPTOR',
  'PLT-NO-PROGRAM',
  'PLT-RUNNING',
  'PLT-NOT-RUNNING',
  'PLT-ALREADY-RUNNING',
  'PLT-ARGUMENT',
  'PLT-BREAKPOINT-RANGE',
  'PLT-MEMORY-RANGE',
  'PLT-ARCHITECTURE-MISMATCH',
  'PLT-INTERNAL',
  'PLT-EVENT-NAMESPACE',
];

/** The breakpoint set used by ERR-02. Address 3 is an instruction boundary with IP 3 (cycle 7). */
const BREAKPOINT = 3;

/** Plays the default script up to a throw after the breakpoint boundary (cycle 8). */
const FAULTING_SCRIPT: readonly FixtureCycle[] = [
  ...defaultScript(FIXTURE_ID).slice(0, 7),
  { throws: 'boom' },
];

function errorOf(result: Result<unknown>): Diagnostic {
  if (result.ok) throw new Error('expected a Result error, got ok');
  return result.error;
}

function fixtureArchitecture() {
  return createFixtureArchitecture({
    architectureId: FIXTURE_ID,
    script: defaultScript(FIXTURE_ID),
  });
}

function fixtureRegistry() {
  return must(createArchitectureRegistry([fixtureArchitecture()]));
}

function runningHarness(): Harness {
  const harness = loadedHarness();
  must(harness.controller.beginRun());
  return harness;
}

// ---------------------------------------------------------------------------------------------
// Part 1: ERR-01. One named test per code.
// ---------------------------------------------------------------------------------------------

interface CodeCase {
  readonly code: string;
  readonly trigger: () => Diagnostic | undefined;
}

const CODE_CASES: readonly CodeCase[] = [
  {
    code: 'ARCH-UNKNOWN-ID',
    trigger: () => errorOf(fixtureRegistry().lookup('no-such-cpu')),
  },
  {
    code: 'ARCH-DUPLICATE-ID',
    trigger: () =>
      errorOf(createArchitectureRegistry([fixtureArchitecture(), fixtureArchitecture()])),
  },
  {
    code: 'ARCH-INVALID-DESCRIPTOR',
    trigger: () =>
      errorOf(
        createArchitectureRegistry([
          makeArchitecture(makeDescriptor('bad-descriptor', { addressBits: 0 })),
        ]),
      ),
  },
  {
    code: 'PLT-NO-PROGRAM',
    trigger: () => errorOf(makeHarness().controller.stepClock()),
  },
  {
    code: 'PLT-RUNNING',
    trigger: () => errorOf(runningHarness().controller.load(fixtureImage())),
  },
  {
    code: 'PLT-NOT-RUNNING',
    trigger: () => errorOf(loadedHarness().controller.endRun()),
  },
  {
    code: 'PLT-ALREADY-RUNNING',
    trigger: () => errorOf(runningHarness().controller.beginRun()),
  },
  {
    code: 'PLT-ARGUMENT',
    trigger: () => errorOf(loadedHarness().controller.runBatch(0)),
  },
  {
    code: 'PLT-BREAKPOINT-RANGE',
    trigger: () => errorOf(loadedHarness().controller.setBreakpoints([64])),
  },
  {
    code: 'PLT-MEMORY-RANGE',
    trigger: () => errorOf(loadedHarness().controller.readMemory({ start: 46, length: 3 })),
  },
  {
    code: 'PLT-ARCHITECTURE-MISMATCH',
    trigger: () =>
      errorOf(loadedHarness().controller.load(fixtureImage({ architectureId: 'other-cpu' }))),
  },
  {
    // A throw inside the architecture becomes a fault whose diagnostic is PLT-INTERNAL.
    code: 'PLT-INTERNAL',
    trigger: () => {
      const harness = loadedHarness({ script: [{ throws: 'boom' }] });
      must(harness.controller.stepClock());
      return harness.controller.snapshot().lastFault;
    },
  },
  {
    // The controller reports this as PLT-INTERNAL; the code itself comes from stampEvents.
    code: 'PLT-EVENT-NAMESPACE',
    trigger: () =>
      errorOf(stampEvents(0, [{ kind: 'bogus-kind', cycleOffset: 1, payload: {} }], FIXTURE_ID)),
  },
];

describe('ERR-01: every ARCH- and PLT- code in DATA_CONTRACTS section 11 has a triggering test', () => {
  it('the trigger table covers exactly the codes listed in DATA_CONTRACTS section 11', () => {
    expect(CODE_CASES.map((c) => c.code).sort()).toEqual([...CONTRACT_CODES].sort());
  });

  it.each(CODE_CASES)('$code is returned with severity error', ({ code, trigger }) => {
    const diagnostic = trigger();
    expect(diagnostic?.code).toBe(code);
    expect(diagnostic?.severity).toBe('error');
  });
});

// ---------------------------------------------------------------------------------------------
// Part 2: ERR-02. Every Result error leaves the controller unchanged.
// ---------------------------------------------------------------------------------------------

type StateName = 'ready-no-program' | 'ready' | 'running' | 'paused' | 'halted' | 'faulted';

const ALL_STATES: readonly StateName[] = [
  'ready-no-program',
  'ready',
  'running',
  'paused',
  'halted',
  'faulted',
];

/** States in which a run is not active, so run-only requests are refused with PLT-NOT-RUNNING. */
const NOT_RUNNING_STATES: readonly StateName[] = [
  'ready-no-program',
  'ready',
  'paused',
  'halted',
  'faulted',
];

/** Builds a harness in the named state. The breakpoint set is not yet set. */
function harnessIn(state: StateName): Harness {
  if (state === 'ready-no-program') return makeHarness();
  if (state === 'ready') return loadedHarness();
  if (state === 'running') return runningHarness();
  if (state === 'paused') {
    const harness = runningHarness();
    must(harness.controller.endRun());
    return harness;
  }
  const harness = loadedHarness(state === 'faulted' ? { script: FAULTING_SCRIPT } : {});
  must(harness.controller.beginRun());
  must(harness.controller.runBatch(100));
  const reached = harness.controller.snapshot().state;
  if (reached !== state) throw new Error(`expected state ${state}, reached ${reached}`);
  return harness;
}

interface ErrorCase {
  readonly method: string;
  readonly state: StateName;
  readonly case: string;
  readonly call: (controller: ExecutionController) => Result<unknown>;
  readonly expectedCode: string;
}

const ERROR_CASES: readonly ErrorCase[] = [
  {
    method: 'load',
    state: 'running',
    case: 'a program',
    call: (c) => c.load(fixtureImage()),
    expectedCode: 'PLT-RUNNING',
  },
  ...NOT_RUNNING_STATES.map((state): ErrorCase => ({
    method: 'load',
    state,
    case: 'an image for another architecture',
    call: (c) => c.load(fixtureImage({ architectureId: 'other-cpu' })),
    expectedCode: 'PLT-ARCHITECTURE-MISMATCH',
  })),
  ...ALL_STATES.flatMap((state): ErrorCase[] => [
    {
      method: 'setBreakpoints',
      state,
      case: 'address 64 (out of range)',
      call: (c) => c.setBreakpoints([64]),
      expectedCode: 'PLT-BREAKPOINT-RANGE',
    },
    {
      method: 'setBreakpoints',
      state,
      case: 'address 1.5 (not an integer)',
      call: (c) => c.setBreakpoints([1.5]),
      expectedCode: 'PLT-ARGUMENT',
    },
  ]),
  {
    method: 'beginRun',
    state: 'ready-no-program',
    case: 'no program',
    call: (c) => c.beginRun(),
    expectedCode: 'PLT-NO-PROGRAM',
  },
  {
    method: 'beginRun',
    state: 'running',
    case: 'a run already active',
    call: (c) => c.beginRun(),
    expectedCode: 'PLT-ALREADY-RUNNING',
  },
  ...ALL_STATES.flatMap((state): ErrorCase[] =>
    [0, 1.5, Number.NaN].map((maxCycles): ErrorCase => ({
      method: 'runBatch',
      state,
      case: `maxCycles ${String(maxCycles)}`,
      call: (c) => c.runBatch(maxCycles),
      expectedCode: 'PLT-ARGUMENT',
    })),
  ),
  ...NOT_RUNNING_STATES.map((state): ErrorCase => ({
    method: 'runBatch',
    state,
    case: 'maxCycles 10',
    call: (c) => c.runBatch(10),
    expectedCode: 'PLT-NOT-RUNNING',
  })),
  ...NOT_RUNNING_STATES.map((state): ErrorCase => ({
    method: 'endRun',
    state,
    case: 'no active run',
    call: (c) => c.endRun(),
    expectedCode: 'PLT-NOT-RUNNING',
  })),
  ...(['stepClock', 'stepInstruction'] as const).flatMap((method): ErrorCase[] => [
    {
      method,
      state: 'ready-no-program',
      case: 'no program',
      call: (c) => (method === 'stepClock' ? c.stepClock() : c.stepInstruction()),
      expectedCode: 'PLT-NO-PROGRAM',
    },
    {
      method,
      state: 'running',
      case: 'a run active',
      call: (c) => (method === 'stepClock' ? c.stepClock() : c.stepInstruction()),
      expectedCode: 'PLT-RUNNING',
    },
  ]),
  ...ALL_STATES.flatMap((state): ErrorCase[] =>
    [
      { start: 46, length: 3 },
      { start: 0, length: 0 },
    ].map((range): ErrorCase => ({
      method: 'readMemory',
      state,
      case: `range start ${String(range.start)} length ${String(range.length)}`,
      call: (c) => c.readMemory(range),
      expectedCode: 'PLT-MEMORY-RANGE',
    })),
  ),
];

/** The call totals the architecture has received, for an equality check before and after a call. */
function callTotals(calls: ArchitectureCalls): Record<string, number> {
  return {
    createInstance: calls.createInstance,
    loadProgram: calls.loadProgram,
    reset: calls.reset,
    stepClock: calls.stepClock,
    readState: calls.readState,
    argumentCalls: calls.argumentCounts.length,
  };
}

/**
 * Behavioural check of the breakpoint set: a run from a fresh load must stop at BREAKPOINT with
 * breakpointHit. A run cannot start from halted or faulted, so the program is loaded again first;
 * the breakpoint set is not cleared by load.
 */
function expectRunStopsAtBreakpoint(controller: ExecutionController): void {
  if (controller.snapshot().state === 'running') must(controller.endRun());
  must(controller.load(fixtureImage()));
  must(controller.beginRun());
  const update = must(controller.runBatch(100));
  expect(update.reason).toBe('breakpoint');
  expect(update.breakpointHit).toBe(BREAKPOINT);
}

describe('ERR-02: a Result error leaves the controller unchanged', () => {
  it.each(ERROR_CASES)(
    '$method ($case) in $state returns $expectedCode and changes nothing',
    (row) => {
      const harness = harnessIn(row.state);
      const { controller, calls } = harness;
      must(controller.setBreakpoints([BREAKPOINT]));

      const snapshotBefore = controller.snapshot();
      const historyBefore = controller.history();
      const callsBefore = callTotals(calls);
      const listener = vi.fn();
      controller.subscribe(listener);

      const result = row.call(controller);

      expect(codeOf(result)).toBe(row.expectedCode);
      expect(controller.snapshot()).toBe(snapshotBefore);
      expect(controller.snapshot().cycle).toBe(snapshotBefore.cycle);
      expect(controller.snapshot().state).toBe(snapshotBefore.state);
      expect(controller.history()).toBe(historyBefore);
      expect(listener).not.toHaveBeenCalled();
      expect(callTotals(calls)).toEqual(callsBefore);

      expectRunStopsAtBreakpoint(controller);
    },
  );
});
