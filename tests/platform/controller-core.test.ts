import { describe, expect, it } from 'vitest';
import { createArchitectureRegistry, createController } from '../../src/platform';
import type { ControllerUpdate, CpuArchitecture, Diagnostic } from '../../src/platform';
import { createFixtureArchitecture, defaultScript } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  codeOf,
  counting,
  fixtureImage,
  flag,
  loadedHarness,
  makeHarness,
  must,
  register,
} from './helpers/controller-harness';

// Slice 1.4-a. Expected values come from the contracts and from the hand-written table above
// defaultScript in the fixture, not from running the controller.

const FAULT: Diagnostic = { code: `${FIXTURE_ID}/BAD-STEP`, severity: 'error', message: 'bad' };

/** One ordinary cycle with two events, then whatever the test appends. */
const TWO_EVENT_CYCLE: FixtureCycle = {
  events: [
    { kind: 'micro-operation', payload: { controlSignals: ['s'] } },
    { kind: 'bus-transfer', payload: { bus: 'b', value: 1 } },
  ],
};

describe('createController', () => {
  it('returns ARCH-UNKNOWN-ID for an identifier that is not registered', () => {
    const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: [] });
    const registry = must(createArchitectureRegistry([fixture]));
    const result = createController({ registry, architectureId: 'missing', historyLimit: 10 });
    expect(codeOf(result)).toBe('ARCH-UNKNOWN-ID');
  });

  it.each([0, -1, 1.5, Number.NaN])('returns PLT-ARGUMENT for historyLimit %j', (historyLimit) => {
    const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: [] });
    const registry = must(createArchitectureRegistry([fixture]));
    const result = createController({ registry, architectureId: FIXTURE_ID, historyLimit });
    expect(codeOf(result)).toBe('PLT-ARGUMENT');
  });

  it('starts ready at cycle 0 with a frozen snapshot and exactly one instance', () => {
    const { controller, calls } = makeHarness();
    const snapshot = controller.snapshot();
    expect(snapshot.state).toBe('ready');
    expect(snapshot.cycle).toBe(0);
    expect(snapshot.architectureId).toBe(FIXTURE_ID);
    expect('lastFault' in snapshot).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(controller.architectureId).toBe(FIXTURE_ID);
    expect(calls.createInstance).toBe(1);
  });

  it('returns PLT-INTERNAL when the instance cannot be created', () => {
    const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: [] });
    const broken: CpuArchitecture = {
      ...fixture,
      createInstance() {
        throw new Error('no instance');
      },
    };
    const registry = must(createArchitectureRegistry([broken]));
    const result = createController({ registry, architectureId: FIXTURE_ID, historyLimit: 10 });
    expect(codeOf(result)).toBe('PLT-INTERNAL');
  });
});

describe('cycle counting (CYC-01, CYC-02)', () => {
  it('the counter is 0 after load and after reset, also after steps have run', () => {
    const { controller } = makeHarness();
    expect(must(controller.load(fixtureImage())).snapshot.cycle).toBe(0);
    must(controller.stepClock());
    must(controller.stepClock());
    expect(controller.snapshot().cycle).toBe(2);
    expect(controller.reset().snapshot.cycle).toBe(0);
    must(controller.stepClock());
    expect(controller.snapshot().cycle).toBe(1);
    const reloaded = must(controller.load(fixtureImage()));
    expect(reloaded.snapshot.cycle).toBe(0);
    expect(reloaded.reason).toBe('load');
    expect(reloaded.snapshot.state).toBe('ready');
  });

  it('one completed clock step gives cycle 1 on the snapshot and on every event', () => {
    const { controller } = loadedHarness();
    const update = must(controller.stepClock());
    expect(update.reason).toBe('clock-step');
    expect(update.cyclesCompleted).toBe(1);
    expect(update.snapshot.cycle).toBe(1);
    expect(update.snapshot.state).toBe('paused');
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([
      ['instruction-start', 1, 0],
      ['micro-operation', 1, 1],
    ]);
    expect(controller.snapshot()).toBe(update.snapshot);
  });
});

describe('stepping the default script by clock', () => {
  // Hand-written from the table above defaultScript: [IP, W, OUTR, F1, memory[20]] after each cycle.
  const TABLE: readonly (readonly [number, number, number, boolean, number])[] = [
    [0, 0, 0, false, 0],
    [0, 0, 0, false, 0],
    [0, 1, 0, true, 0],
    [1, 1, 0, true, 0],
    [1, 1, 0, true, 0],
    [1, 1, 0, true, 1],
    [3, 1, 0, true, 1],
    [3, 1, 0, true, 1],
    [3, 1, 0, true, 1],
    [3, 1, 1, true, 1],
    [4, 1, 1, true, 1],
    [4, 1, 1, true, 1],
    [4, 1, 1, true, 1],
  ];

  it('publishes the table values after every cycle', () => {
    const { controller } = loadedHarness();
    TABLE.forEach(([ip, w, outr, f1, memory20], index) => {
      const update = must(controller.stepClock());
      expect(update.snapshot.cycle).toBe(index + 1);
      expect(update.snapshot.programCounter).toBe(ip);
      expect(register(update, 'IP')).toBe(ip);
      expect(register(update, 'W')).toBe(w);
      expect(register(update, 'OUTR')).toBe(outr);
      expect(flag(update, 'F1')).toBe(f1);
      expect(flag(update, 'F2')).toBe(false);
      expect(update.snapshot.memory[20]).toBe(memory20);
      expect(Array.from(update.snapshot.memory.slice(0, 3))).toEqual([7, 8, 9]);
    });
  });

  it('the halting cycle adds only its own cycle, and later steps make no progress (CYC-07, ERR-07)', () => {
    const { controller, calls } = loadedHarness();
    let last: ControllerUpdate | undefined;
    for (let cycle = 1; cycle <= 13; cycle += 1) last = must(controller.stepClock());
    expect(last?.reason).toBe('halt');
    expect(last?.cyclesCompleted).toBe(1);
    expect(last?.snapshot.state).toBe('halted');
    expect(last?.snapshot.cycle).toBe(13);

    const stepsBefore = calls.stepClock;
    const readsBefore = calls.readState;
    const snapshotBefore = controller.snapshot();
    const again = must(controller.stepClock());
    expect(again.reason).toBe('clock-step');
    expect(again.cyclesCompleted).toBe(0);
    expect(again.events).toEqual([]);
    expect(again.snapshot).toBe(snapshotBefore);
    expect(controller.snapshot().cycle).toBe(13);
    expect(calls.stepClock).toBe(stepsBefore);
    expect(calls.readState).toBe(readsBefore);
  });
});

describe('entering the faulted state (CYC-05, CYC-06, DR-075)', () => {
  it('a fault outcome counts nothing and emits one fault event with the next free sequence', () => {
    const { controller } = loadedHarness({ script: [TWO_EVENT_CYCLE, { fault: FAULT }] });
    const first = must(controller.stepClock());
    const update = must(controller.stepClock());
    expect(update.reason).toBe('fault');
    expect(update.cyclesCompleted).toBe(0);
    expect(update.snapshot.cycle).toBe(1);
    expect(update.snapshot.state).toBe('faulted');
    expect(update.snapshot.lastFault).toEqual(FAULT);
    expect(update.events).toHaveLength(1);
    // Cycle 1 already has sequences 0 and 1, so the fault event takes 2.
    expect(update.events[0]).toEqual({
      kind: 'fault',
      cycle: 1,
      sequence: 2,
      payload: { diagnostic: FAULT },
    });
    expect(Object.isFrozen(update.events[0])).toBe(true);
    expect(update.snapshot.registers).toEqual(first.snapshot.registers);
    expect(update.snapshot.flags).toEqual(first.snapshot.flags);
    expect(Array.from(update.snapshot.memory)).toEqual(Array.from(first.snapshot.memory));
    expect(update.snapshot.programCounter).toBe(first.snapshot.programCounter);
  });

  it('a fault at cycle 0 takes sequence 0', () => {
    const { controller } = loadedHarness({ script: [{ fault: FAULT }] });
    const update = must(controller.stepClock());
    expect(update.events.map((e) => [e.kind, e.cycle, e.sequence])).toEqual([['fault', 0, 0]]);
    expect(update.snapshot.cycle).toBe(0);
  });

  it('an architecture that throws gives Ok, PLT-INTERNAL and no cycle', () => {
    const { controller } = loadedHarness({ script: [{ throws: 'boom' }] });
    const result = controller.stepClock();
    expect(result.ok).toBe(true);
    const update = must(result);
    expect(update.reason).toBe('fault');
    expect(update.snapshot.state).toBe('faulted');
    expect(update.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(update.snapshot.cycle).toBe(0);
    expect(update.cyclesCompleted).toBe(0);
    expect(update.events.map((e) => e.kind)).toEqual(['fault']);
  });
});

describe('Result errors change nothing (CYC-04, ERR-02, ERR-04, ERR-05)', () => {
  it('stepClock with no program returns PLT-NO-PROGRAM and does not call the architecture', () => {
    const { controller, calls } = makeHarness();
    let notified = 0;
    controller.subscribe(() => {
      notified += 1;
    });
    const snapshot = controller.snapshot();
    const callsBefore = { ...calls, argumentCounts: calls.argumentCounts.length };
    expect(codeOf(controller.stepClock())).toBe('PLT-NO-PROGRAM');
    expect(controller.snapshot()).toBe(snapshot);
    expect(controller.snapshot().cycle).toBe(0);
    expect({ ...calls, argumentCounts: calls.argumentCounts.length }).toEqual(callsBefore);
    expect(notified).toBe(0);
  });

  it('reset with no program succeeds and stays ready', () => {
    const { controller } = makeHarness();
    const update = controller.reset();
    expect(update.reason).toBe('reset');
    expect(update.snapshot.state).toBe('ready');
    expect(update.snapshot.cycle).toBe(0);
  });

  it('a mismatched image returns PLT-ARCHITECTURE-MISMATCH before the architecture is called', () => {
    const { controller, calls } = makeHarness();
    const snapshot = controller.snapshot();
    const result = controller.load(fixtureImage({ architectureId: 'other-arch' }));
    expect(codeOf(result)).toBe('PLT-ARCHITECTURE-MISMATCH');
    expect(calls.loadProgram).toBe(0);
    expect(controller.snapshot()).toBe(snapshot);
  });

  it('a load the architecture rejects returns its code and leaves the loaded program running', () => {
    const { controller } = loadedHarness();
    must(controller.stepClock());
    const snapshot = controller.snapshot();
    let notified = 0;
    controller.subscribe(() => {
      notified += 1;
    });
    const result = controller.load(fixtureImage({ origin: 47 }));
    expect(codeOf(result)).toBe(`${FIXTURE_ID}/LOAD-RANGE`);
    expect(controller.snapshot()).toBe(snapshot);
    expect(controller.snapshot().cycle).toBe(1);
    expect(notified).toBe(0);
    expect(must(controller.stepClock()).snapshot.cycle).toBe(2);
  });
});

describe('snapshots (SNP-01, SNP-02, SNP-04)', () => {
  it('snapshot() is the same object until a change and a new one after', () => {
    const { controller } = loadedHarness();
    const first = controller.snapshot();
    expect(controller.snapshot()).toBe(first);
    must(controller.stepClock());
    const second = controller.snapshot();
    expect(second).not.toBe(first);
    expect(controller.snapshot()).toBe(second);
  });

  it('an earlier snapshot is unchanged by later steps', () => {
    const { controller } = loadedHarness();
    must(controller.stepClock());
    const earlier = controller.snapshot();
    const copy = structuredClone(earlier);
    for (let i = 0; i < 9; i += 1) must(controller.stepClock());
    expect(controller.snapshot().cycle).toBe(10);
    expect(earlier).toEqual(copy);
    expect(earlier.memory[20]).toBe(0);
    expect(controller.snapshot().memory[20]).toBe(1);
  });

  it('changing the memory of a snapshot or of a read changes nothing later', () => {
    const { controller } = loadedHarness();
    controller.snapshot().memory[0] = 99;
    const read = must(controller.readMemory({ start: 0, length: 3 }));
    read.bytes[1] = 55;
    const next = must(controller.stepClock());
    expect(Array.from(next.snapshot.memory.slice(0, 3))).toEqual([7, 8, 9]);
    expect(Array.from(must(controller.readMemory({ start: 0, length: 3 })).bytes)).toEqual([
      7, 8, 9,
    ]);
  });
});

describe('readMemory (ERR-06)', () => {
  it('rejects a range outside memory without calling the architecture', () => {
    const { controller, calls } = loadedHarness();
    const readsBefore = calls.readState;
    expect(codeOf(controller.readMemory({ start: 46, length: 3 }))).toBe('PLT-MEMORY-RANGE');
    expect(codeOf(controller.readMemory({ start: -1, length: 1 }))).toBe('PLT-MEMORY-RANGE');
    expect(calls.readState).toBe(readsBefore);
  });

  it('returns the bytes of the range in a new array on every call', () => {
    const { controller, calls } = loadedHarness();
    const readsBefore = calls.readState;
    const a = must(controller.readMemory({ start: 1, length: 2 }));
    const b = must(controller.readMemory({ start: 1, length: 2 }));
    expect(a.range).toEqual({ start: 1, length: 2 });
    expect(Array.from(a.bytes)).toEqual([8, 9]);
    expect(b.bytes).not.toBe(a.bytes);
    expect(must(controller.readMemory({ start: 0, length: 48 })).bytes).toHaveLength(48);
    expect(calls.readState).toBe(readsBefore);
  });
});

describe('listeners (DR-077 h, DR-080)', () => {
  it('are called once per update, in subscription order, before the call returns', () => {
    const { controller } = loadedHarness();
    const log: string[] = [];
    const seen: ControllerUpdate[] = [];
    controller.subscribe((update) => {
      log.push('first');
      seen.push(update);
    });
    controller.subscribe(() => {
      log.push('second');
    });
    const update = must(controller.stepClock());
    expect(log).toEqual(['first', 'second']);
    expect(seen[0]).toBe(update);
    expect(Object.isFrozen(update)).toBe(true);
    expect(Object.isFrozen(update.events)).toBe(true);
    controller.reset();
    expect(log).toEqual(['first', 'second', 'first', 'second']);
  });

  it('stop being called after unsubscribing, and unsubscribing twice is harmless', () => {
    const { controller } = loadedHarness();
    let count = 0;
    const unsubscribe = controller.subscribe(() => {
      count += 1;
    });
    must(controller.stepClock());
    unsubscribe();
    unsubscribe();
    must(controller.stepClock());
    expect(count).toBe(1);
  });

  it('a throwing listener stops the notification, and the state stays committed', () => {
    const { controller } = loadedHarness();
    let later = 0;
    let armed = true;
    controller.subscribe(() => {
      if (armed) throw new Error('listener failed');
    });
    controller.subscribe(() => {
      later += 1;
    });
    expect(() => controller.stepClock()).toThrow('listener failed');
    expect(later).toBe(0);
    expect(controller.snapshot().cycle).toBe(1);
    expect(controller.snapshot().state).toBe('paused');
    expect('lastFault' in controller.snapshot()).toBe(false);

    armed = false;
    const next = must(controller.stepClock());
    expect(next.snapshot.cycle).toBe(2);
    expect(later).toBe(1);
  });

  it('a listener added or removed during a notification takes effect from the next one', () => {
    const { controller } = loadedHarness();
    const log: string[] = [];
    let added = false;
    let removeB: () => void = () => undefined;
    controller.subscribe(() => {
      log.push('a');
      removeB();
      if (!added) {
        added = true;
        controller.subscribe(() => {
          log.push('c');
        });
      }
    });
    removeB = controller.subscribe(() => {
      log.push('b');
    });
    must(controller.stepClock());
    expect(log).toEqual(['a', 'b']);
    must(controller.stepClock());
    expect(log).toEqual(['a', 'b', 'a', 'c']);
  });

  it('refuses state-changing calls made from inside a listener, and allows reads', () => {
    const { controller } = loadedHarness();
    const thrown: string[] = [];
    let reads = 0;
    let inside = false;
    const attempt = (name: string, call: () => unknown): void => {
      try {
        call();
      } catch {
        thrown.push(name);
      }
    };
    controller.subscribe(() => {
      if (inside) return;
      inside = true;
      attempt('load', () => controller.load(fixtureImage()));
      attempt('reset', () => controller.reset());
      attempt('setBreakpoints', () => controller.setBreakpoints([1]));
      attempt('beginRun', () => controller.beginRun());
      attempt('runBatch', () => controller.runBatch(1));
      attempt('endRun', () => controller.endRun());
      attempt('stepClock', () => controller.stepClock());
      attempt('stepInstruction', () => controller.stepInstruction());
      controller.snapshot();
      controller.history();
      must(controller.readMemory({ start: 0, length: 1 }));
      reads += 1;
    });
    const update = must(controller.stepClock());
    expect(thrown).toEqual([
      'load',
      'reset',
      'setBreakpoints',
      'beginRun',
      'runBatch',
      'endRun',
      'stepClock',
      'stepInstruction',
    ]);
    expect(reads).toBe(1);
    expect(update.snapshot.cycle).toBe(1);
    expect(controller.snapshot().cycle).toBe(1);
    expect(controller.snapshot().state).toBe('paused');
  });
});

describe('the default script is the one the table describes', () => {
  it('has thirteen cycles', () => {
    expect(defaultScript(FIXTURE_ID)).toHaveLength(13);
  });

  it('counting() forwards to the fixture unchanged', () => {
    const fixture = createFixtureArchitecture({
      architectureId: FIXTURE_ID,
      script: defaultScript(FIXTURE_ID),
    });
    const { architecture, calls } = counting(fixture);
    const instance = architecture.createInstance();
    instance.stepClock();
    instance.readState();
    expect(calls).toMatchObject({ createInstance: 1, stepClock: 1, readState: 1 });
  });
});
