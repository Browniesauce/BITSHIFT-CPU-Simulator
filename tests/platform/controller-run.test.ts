import { describe, expect, it } from 'vitest';
import { createArchitectureRegistry, createController } from '../../src/platform';
import type {
  CpuArchitecture,
  CpuSnapshot,
  Diagnostic,
  ExecutionEvent,
  InstructionRecord,
} from '../../src/platform';
import { createFixtureArchitecture } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  fixtureImage,
  loadedHarness,
  makeHarness,
  must,
} from './helpers/controller-harness';

// Slice 1.4-d: beginRun, runBatch, endRun (MODULE_CONTRACTS §2.4.1, §2.4.2; DR-077 a, c, e).
// The default script halts on cycle 13.

const FAULT: Diagnostic = { code: `${FIXTURE_ID}/BAD-STEP`, severity: 'error', message: 'bad' };

interface RunResult {
  readonly snapshot: CpuSnapshot;
  readonly events: readonly ExecutionEvent[];
  readonly history: readonly InstructionRecord[];
  readonly batches: number;
}

/** Runs the default script to its end with one batch size. */
function runToEnd(batchSize: number): RunResult {
  const { controller } = loadedHarness();
  must(controller.beginRun());
  const events: ExecutionEvent[] = [];
  let batches = 0;
  while (controller.snapshot().state === 'running') {
    events.push(...must(controller.runBatch(batchSize)).events);
    batches += 1;
    if (batches > 100) throw new Error('the run did not end');
  }
  return { snapshot: controller.snapshot(), events, history: controller.history(), batches };
}

describe('run-state errors (ERR-03, DR-077 a)', () => {
  it('beginRun with no program returns PLT-NO-PROGRAM', () => {
    const { controller, calls } = makeHarness();
    expect(codeOf(controller.beginRun())).toBe('PLT-NO-PROGRAM');
    expect(controller.snapshot().state).toBe('ready');
    expect(calls.stepClock).toBe(0);
  });

  it('runBatch and endRun without an active run return PLT-NOT-RUNNING', () => {
    const empty = makeHarness().controller;
    expect(codeOf(empty.runBatch(5))).toBe('PLT-NOT-RUNNING');
    expect(codeOf(empty.endRun())).toBe('PLT-NOT-RUNNING');

    const { controller, calls } = loadedHarness();
    expect(codeOf(controller.runBatch(5))).toBe('PLT-NOT-RUNNING');
    expect(codeOf(controller.endRun())).toBe('PLT-NOT-RUNNING');
    must(controller.stepClock());
    expect(codeOf(controller.runBatch(5))).toBe('PLT-NOT-RUNNING');
    expect(codeOf(controller.endRun())).toBe('PLT-NOT-RUNNING');
    expect(calls.stepClock).toBe(1);
    expect(controller.snapshot().cycle).toBe(1);
  });

  it('while running: beginRun, steps and load are refused, and nothing changes', () => {
    const { controller, calls } = loadedHarness();
    const started = must(controller.beginRun());
    expect(started.reason).toBe('run-start');
    expect(started.snapshot.state).toBe('running');
    expect(started.cyclesCompleted).toBe(0);
    const snapshot = controller.snapshot();

    expect(codeOf(controller.beginRun())).toBe('PLT-ALREADY-RUNNING');
    expect(codeOf(controller.stepClock())).toBe('PLT-RUNNING');
    expect(codeOf(controller.stepInstruction())).toBe('PLT-RUNNING');
    expect(codeOf(controller.load(fixtureImage()))).toBe('PLT-RUNNING');
    expect(controller.snapshot()).toBe(snapshot);
    expect(calls.stepClock).toBe(0);
    expect(calls.loadProgram).toBe(1);
  });

  it('reset while running gives ready', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    must(controller.runBatch(3));
    const update = controller.reset();
    expect(update.snapshot.state).toBe('ready');
    expect(update.snapshot.cycle).toBe(0);
    expect(codeOf(controller.runBatch(1))).toBe('PLT-NOT-RUNNING');
  });

  it.each([0, -1, 1.5, Number.NaN])('runBatch(%j) returns PLT-ARGUMENT, running or not', (n) => {
    const { controller, calls } = loadedHarness();
    expect(codeOf(controller.runBatch(n))).toBe('PLT-ARGUMENT');
    must(controller.beginRun());
    expect(codeOf(controller.runBatch(n))).toBe('PLT-ARGUMENT');
    expect(calls.stepClock).toBe(0);
    expect(controller.snapshot().cycle).toBe(0);
  });
});

describe('runBatch (CYC-08, DR-077 c)', () => {
  it('a full batch completes exactly its budget and stays running', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    const update = must(controller.runBatch(5));
    expect(update.reason).toBe('run-batch');
    expect(update.cyclesCompleted).toBe(5);
    expect(update.snapshot.cycle).toBe(5);
    expect(update.snapshot.state).toBe('running');
    expect(update.events.every((e) => e.cycle >= 1 && e.cycle <= 5)).toBe(true);
    expect(controller.history()).toHaveLength(1);
  });

  it('a batch larger than the program stops at the halt', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    const update = must(controller.runBatch(1000));
    expect(update.reason).toBe('halt');
    expect(update.cyclesCompleted).toBe(13);
    expect(update.snapshot.cycle).toBe(13);
    expect(update.snapshot.state).toBe('halted');
    expect(update.events).toHaveLength(26);
  });

  it('a batch that halts on its last budgeted cycle has reason halt', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    const update = must(controller.runBatch(13));
    expect(update.reason).toBe('halt');
    expect(update.cyclesCompleted).toBe(13);
    expect(update.snapshot.state).toBe('halted');
  });

  it('once halted, runBatch is refused and beginRun makes no progress', () => {
    const { controller, calls } = loadedHarness();
    must(controller.beginRun());
    must(controller.runBatch(1000));
    const snapshot = controller.snapshot();
    const stepsBefore = calls.stepClock;
    expect(codeOf(controller.runBatch(5))).toBe('PLT-NOT-RUNNING');
    const again = must(controller.beginRun());
    expect(again.reason).toBe('run-start');
    expect(again.cyclesCompleted).toBe(0);
    expect(again.snapshot).toBe(snapshot);
    expect(controller.snapshot().state).toBe('halted');
    expect(calls.stepClock).toBe(stepsBefore);
  });

  it('a batch that meets a fault stops with reason fault and keeps the earlier cycles', () => {
    const script: readonly FixtureCycle[] = [
      { events: [{ kind: 'micro-operation', payload: { controlSignals: ['s'] } }] },
      { events: [{ kind: 'micro-operation', payload: { controlSignals: ['t'] } }] },
      { fault: FAULT },
    ];
    const { controller } = loadedHarness({ script });
    must(controller.beginRun());
    const update = must(controller.runBatch(10));
    expect(update.reason).toBe('fault');
    expect(update.cyclesCompleted).toBe(2);
    expect(update.snapshot.cycle).toBe(2);
    expect(update.snapshot.state).toBe('faulted');
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([
      ['micro-operation', 1, 0],
      ['micro-operation', 2, 0],
      ['fault', 2, 1],
    ]);
    expect(codeOf(controller.runBatch(1))).toBe('PLT-NOT-RUNNING');
  });

  it('a cycle that completes nothing still uses budget, so a batch always ends', () => {
    // An architecture whose every step completes zero cycles and never halts or faults.
    const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: [] });
    let steps = 0;
    const idle: CpuArchitecture = {
      ...fixture,
      createInstance() {
        const instance = fixture.createInstance();
        return {
          ...instance,
          stepClock() {
            steps += 1;
            return { cyclesCompleted: 0, instructionCompleted: false, halted: false, events: [] };
          },
        };
      },
    };
    const controller = must(
      createController({
        registry: must(createArchitectureRegistry([idle])),
        architectureId: FIXTURE_ID,
        historyLimit: 10,
      }),
    );
    must(controller.load(fixtureImage()));
    must(controller.beginRun());
    const update = must(controller.runBatch(4));
    expect(steps).toBe(4);
    expect(update.reason).toBe('run-batch');
    expect(update.cyclesCompleted).toBe(0);
    expect(update.snapshot.cycle).toBe(0);
    expect(update.snapshot.state).toBe('running');
  });
});

describe('endRun and resuming (LCY-02)', () => {
  it('endRun pauses, and a batch may end in the middle of an instruction', () => {
    const { controller } = loadedHarness();
    must(controller.beginRun());
    must(controller.runBatch(5));
    const paused = must(controller.endRun());
    expect(paused.reason).toBe('run-end');
    expect(paused.cyclesCompleted).toBe(0);
    expect(paused.snapshot.state).toBe('paused');
    expect(paused.snapshot.cycle).toBe(5);

    // Cycle 5 is the first cycle of the second instruction, which ends on cycle 7.
    const finished = must(controller.stepInstruction());
    expect(finished.cyclesCompleted).toBe(2);
    expect(finished.snapshot.cycle).toBe(7);
    expect(controller.history()).toHaveLength(2);
  });

  it('a run paused and resumed ends exactly like an uninterrupted run', () => {
    const whole = runToEnd(1000);

    const { controller } = loadedHarness();
    const events: ExecutionEvent[] = [];
    must(controller.beginRun());
    events.push(...must(controller.runBatch(6)).events);
    must(controller.endRun());
    const resumed = must(controller.beginRun());
    expect(resumed.snapshot.state).toBe('running');
    expect(resumed.snapshot.cycle).toBe(6);
    events.push(...must(controller.runBatch(1000)).events);

    expect(controller.snapshot()).toEqual(whole.snapshot);
    expect(events).toEqual(whole.events);
    expect(controller.history()).toEqual(whole.history);
  });
});

describe('batch size does not change the result (DET-02)', () => {
  it('batch sizes 1, 7 and 1000 reach the same final snapshot, events and history', () => {
    const one = runToEnd(1);
    const seven = runToEnd(7);
    const thousand = runToEnd(1000);
    expect(one.batches).toBe(13);
    expect(seven.batches).toBe(2);
    expect(thousand.batches).toBe(1);

    expect(one.snapshot.cycle).toBe(13);
    expect(one.snapshot.state).toBe('halted');
    for (const other of [seven, thousand]) {
      expect(other.snapshot).toEqual(one.snapshot);
      expect(other.events).toEqual(one.events);
      expect(other.history).toEqual(one.history);
    }
    expect(one.events).toHaveLength(26);
    expect(one.history).toHaveLength(4);
  });
});
