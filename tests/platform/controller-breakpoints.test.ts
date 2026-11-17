import { describe, expect, expectTypeOf, it } from 'vitest';
import { createArchitectureRegistry, createController } from '../../src/platform';
import type { CpuArchitecture, ExecutionController, ProgramImage } from '../../src/platform';
import { createFixtureArchitecture, defaultScript } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  fixtureImage,
  loadedHarness,
  must,
} from './helpers/controller-harness';

// Slice 1.4-e: breakpoints (MODULE_CONTRACTS §2.4.4; DR-027, DR-076).
// In the default script the program counter is 0, then 1 after cycle 4, 3 after cycle 7,
// and 4 after cycle 11. It changes only in the last cycle of an instruction.

describe('breakpoint stop in runBatch (BRK-01, DR-076)', () => {
  it('stops right after the instruction that reaches the address, paused and not faulted', () => {
    const { controller } = loadedHarness();
    expect(controller.setBreakpoints([3])).toEqual({ ok: true, value: undefined });
    must(controller.beginRun());
    const update = must(controller.runBatch(1000));
    expect(update.reason).toBe('breakpoint');
    expect(update.breakpointHit).toBe(3);
    expect(update.cyclesCompleted).toBe(7);
    expect(update.snapshot.cycle).toBe(7);
    expect(update.snapshot.programCounter).toBe(3);
    expect(update.snapshot.state).toBe('paused');
    expect('lastFault' in update.snapshot).toBe(false);
    expect(update.events.some((e) => e.kind === 'fault')).toBe(false);
    expect(controller.history()).toHaveLength(2);
  });

  it('after the stop the run must be resumed, and it does not stop at the same address again', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([3]));
    must(controller.beginRun());
    must(controller.runBatch(1000));
    expect(codeOf(controller.runBatch(1000))).toBe('PLT-NOT-RUNNING');

    must(controller.beginRun());
    const rest = must(controller.runBatch(1000));
    expect(rest.reason).toBe('halt');
    expect(rest.cyclesCompleted).toBe(6);
    expect(rest.snapshot.cycle).toBe(13);
    expect('breakpointHit' in rest).toBe(false);
  });

  it('a breakpoint on the address where the run starts does not stop the run there', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([0]));
    must(controller.beginRun());
    const update = must(controller.runBatch(1000));
    expect(update.reason).toBe('halt');
    expect(update.snapshot.cycle).toBe(13);
    expect('breakpointHit' in update).toBe(false);
  });

  it('an address the program counter only passes mid-instruction does not stop the batch', () => {
    // One three-cycle instruction that moves IP to 9 in its second cycle and to 2 in its last,
    // then a one-cycle instruction that halts.
    const script: readonly FixtureCycle[] = [
      { events: [{ kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-X' } }] },
      { events: [{ kind: 'register-write', payload: { register: 'IP', before: 0, after: 9 } }] },
      {
        events: [
          { kind: 'register-write', payload: { register: 'IP', before: 9, after: 2 } },
          { kind: 'instruction-end', payload: { address: 0, mnemonic: 'OP-X', nextAddress: 2 } },
        ],
        instructionCompleted: true,
      },
      {
        events: [{ kind: 'halted', payload: { address: 2 } }],
        instructionCompleted: true,
        halted: true,
      },
    ];
    const passing = loadedHarness({ script }).controller;
    must(passing.setBreakpoints([9]));
    must(passing.beginRun());
    const ran = must(passing.runBatch(1000));
    expect(ran.reason).toBe('halt');
    expect(ran.snapshot.cycle).toBe(4);
    expect('breakpointHit' in ran).toBe(false);

    // The same script does stop on the address it holds at the instruction boundary.
    const stopping = loadedHarness({ script }).controller;
    must(stopping.setBreakpoints([2]));
    must(stopping.beginRun());
    const stopped = must(stopping.runBatch(1000));
    expect(stopped.reason).toBe('breakpoint');
    expect(stopped.breakpointHit).toBe(2);
    expect(stopped.snapshot.cycle).toBe(3);
  });

  it('a halt takes precedence: the halting instruction reports no breakpoint hit', () => {
    const { controller } = loadedHarness();
    // The program counter is 4 from cycle 11 on. The stop after cycle 11 is a breakpoint stop;
    // the halting instruction that follows also ends at 4 and must report only the halt.
    must(controller.setBreakpoints([4]));
    must(controller.beginRun());
    const first = must(controller.runBatch(1000));
    expect(first.reason).toBe('breakpoint');
    expect(first.snapshot.cycle).toBe(11);
    must(controller.beginRun());
    const second = must(controller.runBatch(1000));
    expect(second.reason).toBe('halt');
    expect(second.snapshot.state).toBe('halted');
    expect('breakpointHit' in second).toBe(false);
  });
});

describe('breakpoints and steps (BRK-02, DR-027)', () => {
  it('stepInstruction reports the hit, keeps its own reason and stays paused', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([1]));
    const update = must(controller.stepInstruction());
    expect(update.reason).toBe('instruction-step');
    expect(update.breakpointHit).toBe(1);
    expect(update.snapshot.state).toBe('paused');
    expect(update.snapshot.cycle).toBe(4);
  });

  it('stepClock reports the hit only on the cycle that ends the instruction', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([1]));
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      expect('breakpointHit' in must(controller.stepClock())).toBe(false);
    }
    const fourth = must(controller.stepClock());
    expect(fourth.breakpointHit).toBe(1);
    expect(fourth.reason).toBe('clock-step');
    expect(fourth.snapshot.state).toBe('paused');
    // Cycle 5 is mid-instruction and the program counter is still 1: no hit.
    const fifth = must(controller.stepClock());
    expect(fifth.snapshot.programCounter).toBe(1);
    expect('breakpointHit' in fifth).toBe(false);
  });

  it('a step that does not reach a breakpoint address reports nothing', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([3]));
    expect('breakpointHit' in must(controller.stepInstruction())).toBe(false);
  });
});

describe('setBreakpoints (BRK-03, BRK-04, BRK-05)', () => {
  it('rejects bad addresses and keeps the earlier set', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([3]));
    // The fixture has 6 address bits, so 63 is the last valid address.
    expect(codeOf(controller.setBreakpoints([1, 64]))).toBe('PLT-BREAKPOINT-RANGE');
    expect(codeOf(controller.setBreakpoints([-1]))).toBe('PLT-BREAKPOINT-RANGE');
    expect(codeOf(controller.setBreakpoints([1.5]))).toBe('PLT-ARGUMENT');
    expect(codeOf(controller.setBreakpoints([63]))).toBe('ok');
    must(controller.setBreakpoints([3]));

    must(controller.beginRun());
    const update = must(controller.runBatch(1000));
    // Address 1 was in a rejected list, so the run passes it and stops at 3.
    expect(update.breakpointHit).toBe(3);
    expect(update.snapshot.cycle).toBe(7);
  });

  it('replaces the set instead of adding to it', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([1]));
    must(controller.setBreakpoints([3]));
    must(controller.beginRun());
    const update = must(controller.runBatch(1000));
    expect(update.breakpointHit).toBe(3);
    expect(update.snapshot.cycle).toBe(7);
  });

  it('an empty list clears the set', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([1, 3]));
    must(controller.setBreakpoints([]));
    must(controller.beginRun());
    expect(must(controller.runBatch(1000)).reason).toBe('halt');
  });

  it('publishes no update and can be called in every state', () => {
    const { controller } = loadedHarness();
    let notified = 0;
    controller.subscribe(() => {
      notified += 1;
    });
    const snapshot = controller.snapshot();
    must(controller.setBreakpoints([3]));
    expect(notified).toBe(0);
    expect(controller.snapshot()).toBe(snapshot);
    must(controller.beginRun());
    expect(codeOf(controller.setBreakpoints([1]))).toBe('ok');
    expect(must(controller.runBatch(1000)).breakpointHit).toBe(1);
  });

  it('the set survives load and reset', () => {
    const { controller } = loadedHarness();
    must(controller.setBreakpoints([3]));
    must(controller.load(fixtureImage()));
    must(controller.beginRun());
    expect(must(controller.runBatch(1000)).breakpointHit).toBe(3);
    controller.reset();
    must(controller.beginRun());
    const again = must(controller.runBatch(1000));
    expect(again.breakpointHit).toBe(3);
    expect(again.snapshot.cycle).toBe(7);
  });
});

describe('the architecture never receives breakpoint data (BRK-06)', () => {
  it('every instance call carries only the arguments of the CpuInstance contract', () => {
    const { controller, calls } = loadedHarness();
    must(controller.setBreakpoints([3]));
    must(controller.beginRun());
    must(controller.runBatch(1000));
    must(controller.stepInstruction());
    controller.reset();
    expect(calls.argumentCounts.length).toBeGreaterThan(10);
    for (const [method, count] of calls.argumentCounts) {
      expect(count).toBe(method === 'loadProgram' ? 1 : 0);
    }
  });
});

describe('the architecture never receives breakpoint data (BRK-06, inputs)', () => {
  it('the program image handed to loadProgram has exactly the ProgramImage fields', () => {
    const fixture = createFixtureArchitecture({
      architectureId: FIXTURE_ID,
      script: defaultScript(FIXTURE_ID),
    });
    const received: ProgramImage[] = [];
    const spy: CpuArchitecture = {
      descriptor: fixture.descriptor,
      visualization: fixture.visualization,
      createInstance: () => {
        const instance = fixture.createInstance();
        return {
          ...instance,
          loadProgram: (image: ProgramImage) => {
            received.push(image);
            return instance.loadProgram(image);
          },
        };
      },
    };
    const registry = must(createArchitectureRegistry([spy]));
    const controller = must(
      createController({ registry, architectureId: FIXTURE_ID, historyLimit: 100 }),
    );
    must(controller.setBreakpoints([1, 3]));
    must(controller.load(fixtureImage()));
    must(controller.setBreakpoints([4]));
    controller.reset();

    expect(received.length).toBeGreaterThan(0);
    for (const image of received) {
      expect(Object.keys(image).sort()).toEqual(
        ['architectureId', 'bytes', 'entry', 'origin', 'sourceMap', 'symbols'].sort(),
      );
      expect(image).toEqual(fixtureImage());
    }
  });
});

describe('batch size with a breakpoint (DET-02)', () => {
  it('batch sizes 1, 7 and 1000 stop at the same cycle with equal snapshots and events', () => {
    const run = (batchSize: number) => {
      const { controller } = loadedHarness();
      must(controller.setBreakpoints([4]));
      must(controller.beginRun());
      const events = [];
      let hit: number | undefined;
      while (controller.snapshot().state === 'running') {
        const update = must(controller.runBatch(batchSize));
        events.push(...update.events);
        hit = update.breakpointHit;
      }
      return { snapshot: controller.snapshot(), events, hit };
    };
    const one = run(1);
    expect(one.snapshot.cycle).toBe(11);
    expect(one.snapshot.state).toBe('paused');
    expect(one.hit).toBe(4);
    for (const other of [run(7), run(1000)]) {
      expect(other.snapshot).toEqual(one.snapshot);
      expect(other.events).toEqual(one.events);
      expect(other.hit).toBe(4);
    }
  });
});

describe('the finished interface', () => {
  it('has exactly the members of MODULE_CONTRACTS §2.4', () => {
    expectTypeOf<keyof ExecutionController>().toEqualTypeOf<
      | 'architectureId'
      | 'snapshot'
      | 'history'
      | 'subscribe'
      | 'load'
      | 'reset'
      | 'setBreakpoints'
      | 'beginRun'
      | 'runBatch'
      | 'endRun'
      | 'stepClock'
      | 'stepInstruction'
      | 'readMemory'
    >();
  });
});
