import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/platform';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  fixtureImage,
  loadedHarness,
  makeHarness,
  must,
} from './helpers/controller-harness';

// Cases added after the independent review of the controller: failures inside load and reset,
// two faults in a row, check order while faulted, snapshot identity, and breakpoints with faults.

const FAULT: Diagnostic = { code: `${FIXTURE_ID}/BAD-STEP`, severity: 'error', message: 'bad' };

describe('an internal failure inside load (DR-077 d)', () => {
  it('a state read that fails after the architecture accepted the program still counts as loaded', () => {
    // Reads: 1 at creation, 2 after the load.
    const { controller, calls } = makeHarness({
      hooks: {
        beforeReadState: (n) => {
          if (n === 2) throw new Error('read failed');
        },
      },
    });
    const result = controller.load(fixtureImage());
    expect(result.ok).toBe(true);
    const failed = must(result);
    expect(failed.reason).toBe('fault');
    expect(failed.snapshot.state).toBe('faulted');
    expect(failed.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(failed.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 0, 0]]);

    // The program is loaded, so a step is the zero-progress answer, not PLT-NO-PROGRAM.
    expect(must(controller.stepClock()).cyclesCompleted).toBe(0);
    expect(calls.stepClock).toBe(0);

    const recovered = controller.reset();
    expect(calls.createInstance).toBe(2);
    expect(recovered.snapshot.state).toBe('ready');
    expect(Array.from(recovered.snapshot.memory.slice(0, 3))).toEqual([7, 8, 9]);
    expect(must(controller.stepClock()).snapshot.cycle).toBe(1);
  });
});

describe('faulted with no program, and two faults in a row (DR-075, DR-080 item 5)', () => {
  it('returns PLT-NO-PROGRAM while faulted, and the second fault takes the next sequence', () => {
    const { controller, calls } = makeHarness({
      hooks: {
        beforeReadState: (n) => {
          if (n === 2) throw new Error('read failed');
        },
        beforeCreate: (n) => {
          if (n === 2) throw new Error('no second instance');
        },
      },
    });
    // No program is loaded. The first reset fails on its state read.
    const first = controller.reset();
    expect(first.snapshot.state).toBe('faulted');
    expect(first.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 0, 0]]);

    expect(codeOf(controller.stepClock())).toBe('PLT-NO-PROGRAM');
    expect(codeOf(controller.stepInstruction())).toBe('PLT-NO-PROGRAM');
    expect(codeOf(controller.beginRun())).toBe('PLT-NO-PROGRAM');
    expect(codeOf(controller.runBatch(1))).toBe('PLT-NOT-RUNNING');
    expect(codeOf(controller.endRun())).toBe('PLT-NOT-RUNNING');
    expect(calls.stepClock).toBe(0);

    // The second reset cannot replace the instance: a second fault at the same cycle.
    const second = controller.reset();
    expect(second.snapshot.state).toBe('faulted');
    expect(second.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 0, 1]]);

    const third = controller.reset();
    expect(calls.createInstance).toBe(3);
    expect(third.snapshot.state).toBe('ready');
    expect('lastFault' in third.snapshot).toBe(false);
  });
});

describe('Result errors notify nobody', () => {
  it('no listener is called for any refused request', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    must(controller.runBatch(1000));
    let notified = 0;
    controller.subscribe(() => {
      notified += 1;
    });
    // Halted: the argument is still checked before the lifecycle state.
    expect(codeOf(controller.runBatch(0))).toBe('PLT-ARGUMENT');
    expect(codeOf(controller.runBatch(1))).toBe('PLT-NOT-RUNNING');
    expect(codeOf(controller.endRun())).toBe('PLT-NOT-RUNNING');
    expect(codeOf(controller.load(fixtureImage({ architectureId: 'other-arch' })))).toBe(
      'PLT-ARCHITECTURE-MISMATCH',
    );
    expect(codeOf(controller.setBreakpoints([64]))).toBe('PLT-BREAKPOINT-RANGE');
    expect(codeOf(controller.readMemory({ start: 48, length: 1 }))).toBe('PLT-MEMORY-RANGE');
    expect(notified).toBe(0);
    expect(controller.history()).toHaveLength(4);
    expect(controller.snapshot().cycle).toBe(13);
  });
});

describe('snapshot identity on load and reset', () => {
  it('a successful load and every reset publish a new snapshot object with equal content', () => {
    const { controller } = loadedHarness();
    const afterLoad = controller.snapshot();
    const firstReset = controller.reset().snapshot;
    expect(firstReset).not.toBe(afterLoad);
    expect(firstReset).toEqual(afterLoad);
    const secondReset = controller.reset().snapshot;
    expect(secondReset).not.toBe(firstReset);
    expect(secondReset).toEqual(firstReset);
    const reloaded = must(controller.load(fixtureImage())).snapshot;
    expect(reloaded).not.toBe(secondReset);
    expect(reloaded).toEqual(secondReset);
    expect(controller.snapshot()).toBe(reloaded);
  });
});

describe('breakpoints with halt and fault', () => {
  it('a call that ends in a fault reports no breakpoint hit', () => {
    // The program counter reaches 2 in the middle of the instruction; the next cycle faults.
    const script: readonly FixtureCycle[] = [
      {
        events: [
          { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-X' } },
          { kind: 'register-write', payload: { register: 'IP', before: 0, after: 2 } },
        ],
      },
      { fault: FAULT },
    ];
    const stepped = loadedHarness({ script }).controller;
    must(stepped.setBreakpoints([2]));
    const byStep = must(stepped.stepInstruction());
    expect(byStep.reason).toBe('fault');
    expect(byStep.snapshot.programCounter).toBe(2);
    expect('breakpointHit' in byStep).toBe(false);

    const batched = loadedHarness({ script }).controller;
    must(batched.setBreakpoints([2]));
    must(batched.beginRun());
    const byBatch = must(batched.runBatch(10));
    expect(byBatch.reason).toBe('fault');
    expect(byBatch.snapshot.state).toBe('faulted');
    expect('breakpointHit' in byBatch).toBe(false);
  });

  it('a clock step that halts on a breakpoint address reports the halt and no hit', () => {
    // The program counter is 4 from cycle 11 on; cycle 13 ends an instruction and halts.
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([4]));
    for (let cycle = 1; cycle <= 10; cycle += 1) must(controller.stepClock());
    expect(must(controller.stepClock()).breakpointHit).toBe(4);
    expect('breakpointHit' in must(controller.stepClock())).toBe(false);
    const halting = must(controller.stepClock());
    expect(halting.reason).toBe('halt');
    expect(halting.snapshot.programCounter).toBe(4);
    expect('breakpointHit' in halting).toBe(false);
  });
});
