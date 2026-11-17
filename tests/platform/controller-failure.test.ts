import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/platform';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  fixtureImage,
  loadedHarness,
  must,
  register,
} from './helpers/controller-harness';

// Slice 1.4-c: failures in the middle of a call, and recovery (DR-070, DR-071, DR-074, DR-077 d).

const FAULT: Diagnostic = { code: `${FIXTURE_ID}/BAD-STEP`, severity: 'error', message: 'bad' };

/** Two good cycles of one instruction. Cycle 1 has two events; cycle 2 has one. */
const TWO_GOOD_CYCLES: readonly FixtureCycle[] = [
  {
    events: [
      { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-X' } },
      { kind: 'micro-operation', payload: { controlSignals: ['s'] } },
    ],
  },
  { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 5 } }] },
];

const FAULT_ON_THIRD: readonly FixtureCycle[] = [...TWO_GOOD_CYCLES, { fault: FAULT }];
const THROW_ON_THIRD: readonly FixtureCycle[] = [...TWO_GOOD_CYCLES, { throws: 'boom' }];
const FOREIGN_ON_THIRD: readonly FixtureCycle[] = [
  ...TWO_GOOD_CYCLES,
  { events: [{ kind: 'other-arch/custom', payload: {} }] },
];

describe('a failure after earlier cycles of the same call (DR-074)', () => {
  it('a fault on the third cycle keeps the two completed cycles committed and published', () => {
    const { controller } = loadedHarness({ script: FAULT_ON_THIRD });
    const update = must(controller.stepInstruction());
    expect(update.reason).toBe('fault');
    expect(update.cyclesCompleted).toBe(2);
    expect(update.snapshot.cycle).toBe(2);
    expect(update.snapshot.state).toBe('faulted');
    expect(update.snapshot.lastFault).toEqual(FAULT);
    // Cycle 1: two events. Cycle 2: one event, then the fault event with the next sequence.
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([
      ['instruction-start', 1, 0],
      ['micro-operation', 1, 1],
      ['register-write', 2, 0],
      ['fault', 2, 1],
    ]);
    expect(register(update, 'W')).toBe(5);
    expect(controller.history()).toEqual([]);
  });

  it('gives the same published state as two clock steps followed by the faulting step', () => {
    const whole = loadedHarness({ script: FAULT_ON_THIRD }).controller;
    const stepped = loadedHarness({ script: FAULT_ON_THIRD }).controller;
    const wholeUpdate = must(whole.stepInstruction());
    const events = [
      ...must(stepped.stepClock()).events,
      ...must(stepped.stepClock()).events,
      ...must(stepped.stepClock()).events,
    ];
    expect(stepped.snapshot()).toEqual(whole.snapshot());
    expect(events).toEqual(wholeUpdate.events);
  });

  it('a throw on the third cycle does the same with PLT-INTERNAL', () => {
    const { controller } = loadedHarness({ script: THROW_ON_THIRD });
    const update = must(controller.stepInstruction());
    expect(update.reason).toBe('fault');
    expect(update.cyclesCompleted).toBe(2);
    expect(update.snapshot.cycle).toBe(2);
    expect(update.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([
      ['instruction-start', 1, 0],
      ['micro-operation', 1, 1],
      ['register-write', 2, 0],
      ['fault', 2, 1],
    ]);
    expect(register(update, 'W')).toBe(5);
    expect(controller.history()).toEqual([]);
  });

  it('an event in a foreign namespace is an internal fault and its cycle is not counted (EVT-06)', () => {
    const { controller, calls } = loadedHarness({ script: FOREIGN_ON_THIRD });
    const update = must(controller.stepInstruction());
    expect(update.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    // The cause is the namespace rule and not some other internal error (EVT-06).
    expect(update.snapshot.lastFault?.message).toContain('PLT-EVENT-NAMESPACE');
    expect(update.snapshot.cycle).toBe(2);
    expect(update.cyclesCompleted).toBe(2);
    expect(update.events.some((e) => e.kind === 'other-arch/custom')).toBe(false);
    expect(update.events.at(-1)).toMatchObject({ kind: 'fault', cycle: 2, sequence: 1 });

    expect(calls.createInstance).toBe(1);
    controller.reset();
    expect(calls.createInstance).toBe(2);
  });

  it('a state read that throws after a step does not count that cycle', () => {
    // Reads: 1 at creation, 2 after load, 3 after the first step, 4 after the second step.
    const { controller } = loadedHarness({
      script: TWO_GOOD_CYCLES,
      hooks: {
        beforeReadState: (n) => {
          if (n === 4) throw new Error('read failed');
        },
      },
    });
    must(controller.stepClock());
    const update = must(controller.stepClock());
    expect(update.reason).toBe('fault');
    expect(update.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(update.cyclesCompleted).toBe(0);
    expect(update.snapshot.cycle).toBe(1);
    expect(register(update, 'W')).toBe(0);
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 1, 2]]);
  });
});

describe('requests while faulted (ERR-07)', () => {
  it('steps return Ok with zero cycles, the same snapshot and no architecture call', () => {
    const { controller, calls } = loadedHarness({ script: FAULT_ON_THIRD });
    must(controller.stepInstruction());
    const snapshot = controller.snapshot();
    const stepsBefore = calls.stepClock;
    for (const step of [() => controller.stepClock(), () => controller.stepInstruction()]) {
      const update = must(step());
      expect(update.cyclesCompleted).toBe(0);
      expect(update.events).toEqual([]);
      expect(update.snapshot).toBe(snapshot);
    }
    expect(calls.stepClock).toBe(stepsBefore);
  });
});

describe('recovery (CYC-06, DR-071, DR-077 d)', () => {
  it('reset after an internal failure uses a new instance with the program reloaded', () => {
    const { controller, calls } = loadedHarness({ script: THROW_ON_THIRD });
    must(controller.stepInstruction());
    expect(calls.createInstance).toBe(1);
    expect(calls.loadProgram).toBe(1);

    const update = controller.reset();
    expect(calls.createInstance).toBe(2);
    expect(calls.loadProgram).toBe(2);
    expect(update.reason).toBe('reset');
    expect(update.snapshot.state).toBe('ready');
    expect(update.snapshot.cycle).toBe(0);
    expect('lastFault' in update.snapshot).toBe(false);
    expect(controller.history()).toEqual([]);
    expect(Array.from(update.snapshot.memory.slice(0, 3))).toEqual([7, 8, 9]);

    // The script runs again from its start.
    must(controller.stepClock());
    const second = must(controller.stepClock());
    expect(second.snapshot.cycle).toBe(2);
    expect(register(second, 'W')).toBe(5);
  });

  it('reset after an ordinary fault keeps the instance and restores the post-load state', () => {
    const { controller, calls } = loadedHarness({ script: FAULT_ON_THIRD });
    must(controller.stepInstruction());
    const update = controller.reset();
    expect(calls.createInstance).toBe(1);
    expect(calls.reset).toBe(1);
    expect(update.snapshot.state).toBe('ready');
    expect(update.snapshot.cycle).toBe(0);
    expect('lastFault' in update.snapshot).toBe(false);
    expect(register(update, 'W')).toBe(0);
  });

  it('load after an internal failure replaces the instance and loads the new program', () => {
    const { controller, calls } = loadedHarness({ script: THROW_ON_THIRD });
    must(controller.stepInstruction());
    const update = must(controller.load(fixtureImage({ bytes: new Uint8Array([4, 5]) })));
    expect(calls.createInstance).toBe(2);
    expect(update.reason).toBe('load');
    expect(update.snapshot.state).toBe('ready');
    expect(update.snapshot.cycle).toBe(0);
    expect('lastFault' in update.snapshot).toBe(false);
    expect(Array.from(update.snapshot.memory.slice(0, 3))).toEqual([4, 5, 0]);
  });

  it('a load rejected right after recovery returns the error and the controller stays faulted', () => {
    const { controller, calls } = loadedHarness({ script: THROW_ON_THIRD });
    const faulted = must(controller.stepInstruction());
    const result = controller.load(fixtureImage({ origin: 47 }));
    expect(codeOf(result)).toBe(`${FIXTURE_ID}/LOAD-RANGE`);
    expect(controller.snapshot().state).toBe('faulted');
    expect(controller.snapshot().lastFault).toEqual(faulted.snapshot.lastFault);
    // The instance was replaced once, by the load; the reset that follows does not replace again.
    expect(calls.createInstance).toBe(2);
    expect(controller.reset().snapshot.state).toBe('ready');
    expect(calls.createInstance).toBe(2);
  });

  it('a replacement that throws leaves the controller faulted, and reset never throws', () => {
    const { controller, calls } = loadedHarness({
      script: THROW_ON_THIRD,
      hooks: {
        beforeCreate: (n) => {
          if (n === 2) throw new Error('no second instance');
        },
      },
    });
    must(controller.stepInstruction());
    const failed = controller.reset();
    expect(calls.createInstance).toBe(2);
    expect(failed.reason).toBe('fault');
    expect(failed.snapshot.state).toBe('faulted');
    expect(failed.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(failed.snapshot.cycle).toBe(2);
    // The first fault took sequence 1 at cycle 2, so this second fault takes sequence 2.
    expect(failed.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 2, 2]]);

    // The third createInstance works, so the next reset recovers.
    const recovered = controller.reset();
    expect(calls.createInstance).toBe(3);
    expect(recovered.reason).toBe('reset');
    expect(recovered.snapshot.state).toBe('ready');
    expect(recovered.snapshot.cycle).toBe(0);
  });

  it('a throw during reset itself gives a fault update, and the next reset recovers', () => {
    let failReads = false;
    const { controller, calls } = loadedHarness({
      script: TWO_GOOD_CYCLES,
      hooks: {
        beforeReadState: () => {
          if (failReads) throw new Error('read failed');
        },
      },
    });
    must(controller.stepClock());
    failReads = true;
    const failed = controller.reset();
    expect(failed.reason).toBe('fault');
    expect(failed.snapshot.state).toBe('faulted');
    expect(failed.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    // Nothing was committed by the failed reset: the published state is still cycle 1.
    expect(failed.snapshot.cycle).toBe(1);

    failReads = false;
    const recovered = controller.reset();
    expect(calls.createInstance).toBe(2);
    expect(recovered.snapshot.state).toBe('ready');
    expect(recovered.snapshot.cycle).toBe(0);
  });

  it('an architecture reset that throws gives a fault update, and the next reset recovers', () => {
    const { controller, calls } = loadedHarness({
      script: TWO_GOOD_CYCLES,
      hooks: {
        beforeReset: (n) => {
          if (n === 1) throw new Error('reset failed');
        },
      },
    });
    must(controller.stepClock());
    const failed = controller.reset();
    expect(failed.reason).toBe('fault');
    expect(failed.snapshot.state).toBe('faulted');
    expect(failed.snapshot.lastFault?.code).toBe('PLT-INTERNAL');

    const recovered = controller.reset();
    expect(calls.createInstance).toBe(2);
    expect(recovered.reason).toBe('reset');
    expect(recovered.snapshot.state).toBe('ready');
    expect(recovered.snapshot.cycle).toBe(0);
  });
});
