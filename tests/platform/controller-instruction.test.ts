import { describe, expect, it } from 'vitest';
import type { ExecutionEvent, InstructionRecord } from '../../src/platform';
import { codeOf, loadedHarness, makeHarness, must } from './helpers/controller-harness';

// Slice 1.4-b. The default script has four instructions of 4, 3, 4 and 2 cycles
// (boundaries after cycles 4, 7, 11 and 13), per the table above defaultScript.

/** The history the default script must produce, written by hand from the script (EVENT_MODEL §10). */
const EXPECTED_HISTORY: readonly InstructionRecord[] = [
  {
    index: 0,
    startCycle: 1,
    endCycle: 4,
    address: 0,
    mnemonic: 'OP-A',
    changes: [
      { target: 'W', before: 0, after: 1 },
      { target: 'F1', before: false, after: true },
      { target: 'IP', before: 0, after: 1 },
    ],
  },
  {
    index: 1,
    startCycle: 5,
    endCycle: 7,
    address: 1,
    mnemonic: 'OP-B',
    changes: [
      { target: 'memory[20]', before: 0, after: 1 },
      { target: 'IP', before: 1, after: 3 },
    ],
  },
  {
    index: 2,
    startCycle: 8,
    endCycle: 11,
    address: 3,
    mnemonic: 'OP-C',
    changes: [
      { target: 'OUTR', before: 0, after: 1 },
      { target: 'IP', before: 3, after: 4 },
    ],
  },
  { index: 3, startCycle: 12, endCycle: 13, address: 4, mnemonic: 'OP-D', changes: [] },
];

describe('stepInstruction (CYC-03, DR-074)', () => {
  it('advances exactly the cycles of each instruction and returns all their events', () => {
    const { controller } = loadedHarness();
    const first = must(controller.stepInstruction());
    expect(first.reason).toBe('instruction-step');
    expect(first.cyclesCompleted).toBe(4);
    expect(first.snapshot.cycle).toBe(4);
    expect(first.snapshot.state).toBe('paused');
    expect(first.events.map((e) => e.cycle)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);

    const second = must(controller.stepInstruction());
    expect(second.cyclesCompleted).toBe(3);
    expect(second.snapshot.cycle).toBe(7);
    expect(second.events.map((e) => [e.cycle, e.sequence])).toEqual([
      [5, 0],
      [5, 1],
      [6, 0],
      [6, 1],
      [6, 2],
      [7, 0],
      [7, 1],
    ]);

    expect(must(controller.stepInstruction()).snapshot.cycle).toBe(11);
    const last = must(controller.stepInstruction());
    expect(last.cyclesCompleted).toBe(2);
    expect(last.reason).toBe('halt');
    expect(last.snapshot.state).toBe('halted');
    expect(last.snapshot.cycle).toBe(13);
  });

  it('gives the same snapshots, events and history as the equivalent clock steps', () => {
    const byInstruction = loadedHarness().controller;
    const byClock = loadedHarness().controller;
    const instructionEvents: ExecutionEvent[] = [];
    const clockEvents: ExecutionEvent[] = [];
    for (const boundary of [4, 7, 11, 13]) {
      instructionEvents.push(...must(byInstruction.stepInstruction()).events);
      while (byClock.snapshot().cycle < boundary) {
        clockEvents.push(...must(byClock.stepClock()).events);
      }
      expect(byInstruction.snapshot()).toEqual(byClock.snapshot());
      expect(byInstruction.history()).toEqual(byClock.history());
    }
    expect(instructionEvents).toEqual(clockEvents);
    expect(instructionEvents).toHaveLength(26);
  });

  it('orders events by (cycle, sequence) within and across updates (EVT-01)', () => {
    const { controller } = loadedHarness();
    const all: ExecutionEvent[] = [];
    for (let i = 0; i < 4; i += 1) all.push(...must(controller.stepInstruction()).events);
    for (let i = 1; i < all.length; i += 1) {
      const previous = all[i - 1];
      const current = all[i];
      if (previous === undefined || current === undefined) throw new Error('missing event');
      // A new cycle restarts the sequence at 0; the same cycle continues it by exactly 1.
      const ordered =
        (current.cycle > previous.cycle && current.sequence === 0) ||
        (current.cycle === previous.cycle && current.sequence === previous.sequence + 1);
      expect(ordered).toBe(true);
    }
    expect(all[0]).toMatchObject({ cycle: 1, sequence: 0 });
  });

  it('from the middle of an instruction, finishes that instruction only', () => {
    const { controller } = loadedHarness();
    must(controller.stepClock());
    must(controller.stepClock());
    const update = must(controller.stepInstruction());
    expect(update.cyclesCompleted).toBe(2);
    expect(update.snapshot.cycle).toBe(4);
    expect(controller.history()).toHaveLength(1);
  });

  it('returns PLT-NO-PROGRAM with no program, and makes no progress once halted', () => {
    const empty = makeHarness();
    expect(codeOf(empty.controller.stepInstruction())).toBe('PLT-NO-PROGRAM');
    expect(empty.calls.stepClock).toBe(0);

    const { controller, calls } = loadedHarness();
    for (let i = 0; i < 4; i += 1) must(controller.stepInstruction());
    const snapshot = controller.snapshot();
    const stepsBefore = calls.stepClock;
    const again = must(controller.stepInstruction());
    expect(again.cyclesCompleted).toBe(0);
    expect(again.reason).toBe('instruction-step');
    expect(again.snapshot).toBe(snapshot);
    expect(calls.stepClock).toBe(stepsBefore);
  });
});

describe('history (HST-04 to HST-07)', () => {
  it('holds one hand-checked record per completed instruction, with no explanation', () => {
    const { controller } = loadedHarness();
    for (let i = 0; i < 4; i += 1) must(controller.stepInstruction());
    expect(controller.history()).toEqual(EXPECTED_HISTORY);
    for (const record of controller.history()) {
      expect('explanation' in record).toBe(false);
      expect(Object.isFrozen(record)).toBe(true);
    }
  });

  it('records an instruction when its last clock step completes, not before', () => {
    const { controller } = loadedHarness();
    for (let cycle = 1; cycle <= 3; cycle += 1) must(controller.stepClock());
    expect(controller.history()).toEqual([]);
    must(controller.stepClock());
    expect(controller.history()).toEqual([EXPECTED_HISTORY[0]]);
  });

  it('returns the same frozen array until a record is added, and load and reset empty it', () => {
    const { controller } = loadedHarness();
    must(controller.stepInstruction());
    const first = controller.history();
    expect(Object.isFrozen(first)).toBe(true);
    must(controller.stepClock());
    expect(controller.history()).toBe(first);
    must(controller.stepInstruction());
    expect(controller.history()).not.toBe(first);
    expect(controller.history()).toHaveLength(2);

    controller.reset();
    expect(controller.history()).toEqual([]);
    must(controller.stepInstruction());
    expect(controller.history().map((r) => r.index)).toEqual([0]);
    must(controller.load(controllerImage()));
    expect(controller.history()).toEqual([]);
  });

  it('enforces the limit it was given and keeps the newest records (HST-06)', () => {
    const { controller } = loadedHarness({ historyLimit: 2 });
    for (let i = 0; i < 4; i += 1) {
      must(controller.stepInstruction());
      expect(controller.history().length).toBeLessThanOrEqual(2);
    }
    expect(controller.history()).toEqual([EXPECTED_HISTORY[2], EXPECTED_HISTORY[3]]);
  });

  it('eviction leaves delivered snapshots, updates and history arrays untouched (HST-04)', () => {
    const { controller } = loadedHarness({ historyLimit: 1 });
    const update = must(controller.stepInstruction());
    const historyThen = controller.history();
    const snapshotCopy = structuredClone(update.snapshot);
    const eventsCopy = structuredClone(update.events);
    must(controller.stepInstruction());
    must(controller.stepInstruction());
    expect(controller.history()).toEqual([EXPECTED_HISTORY[2]]);
    expect(update.snapshot).toEqual(snapshotCopy);
    expect(update.events).toEqual(eventsCopy);
    expect(historyThen).toEqual([EXPECTED_HISTORY[0]]);
  });
});

describe('reset and load leave what was already delivered untouched (HST-04)', () => {
  it.each(['reset', 'load'] as const)(
    'a %s does not change delivered snapshots, events or history arrays',
    (action) => {
      const { controller } = loadedHarness();
      const update = must(controller.stepInstruction());
      const historyThen = controller.history();
      const snapshotCopy = structuredClone(update.snapshot);
      const eventsCopy = structuredClone(update.events);
      const historyCopy = structuredClone(historyThen);
      expect(historyThen).toHaveLength(1);

      if (action === 'reset') controller.reset();
      else must(controller.load(controllerImage()));

      // The controller is back at the start and its history is empty ...
      expect(controller.history()).toEqual([]);
      expect(controller.snapshot().cycle).toBe(0);
      // ... while everything handed out before is exactly as it was.
      expect(update.snapshot).toEqual(snapshotCopy);
      expect(update.events).toEqual(eventsCopy);
      expect(historyThen).toEqual(historyCopy);
      expect(historyThen).toHaveLength(1);
    },
  );
});

function controllerImage(): Parameters<ReturnType<typeof loadedHarness>['controller']['load']>[0] {
  return {
    architectureId: 'fixture-a',
    origin: 0,
    entry: 0,
    bytes: new Uint8Array([1]),
    symbols: {},
    sourceMap: [],
  };
}
