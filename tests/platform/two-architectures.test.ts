import { describe, expect, it } from 'vitest';
import type {
  ArchitectureRegistry,
  ControllerUpdate,
  CpuArchitecture,
  ExecutionController,
} from '../../src/platform';
import { createArchitectureRegistry, createController } from '../../src/platform';
import { createFixtureArchitecture } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import type { ArchitectureCalls } from './helpers/controller-harness';
import { codeOf, counting, fixtureImage, must } from './helpers/controller-harness';

// Two architectures in one registry (DR-057, DR-069, SC-D3, EVENT_MODEL section 4).
// Expected values are hand-worked from the scripts below, never taken from the implementation.

const ID_A = 'fixture-a';
const ID_B = 'fixture-b';

/** Fixture A: runs to a halt in five cycles. Hand-worked final state in the test below. */
const SCRIPT_A: readonly FixtureCycle[] = [
  // Cycle 1: OP-A starts at address 0.
  { events: [{ kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-A' } }] },
  // Cycle 2: W goes from 0 to 3.
  { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 3 } }] },
  // Cycle 3: F1 goes from false to true, IP goes from 0 to 2, OP-A ends.
  {
    events: [
      { kind: 'flag-update', payload: { flag: 'F1', before: false, after: true } },
      { kind: 'register-write', payload: { register: 'IP', before: 0, after: 2 } },
      { kind: 'instruction-end', payload: { address: 0, mnemonic: 'OP-A', nextAddress: 2 } },
    ],
    instructionCompleted: true,
  },
  // Cycle 4: memory[5] goes from 0 to 9, and A's namespaced note.
  {
    events: [
      { kind: 'memory-write', payload: { address: 5, before: 0, after: 9 } },
      { kind: 'fixture-a/note', payload: { text: 'note from a' } },
    ],
  },
  // Cycle 5: OUTR goes from 0 to 7, and the halt is reported.
  {
    events: [
      { kind: 'output-emitted', payload: { before: 0, after: 7 } },
      { kind: 'halted', payload: { address: 2 } },
    ],
    instructionCompleted: true,
    halted: true,
  },
];

/** Fixture B: a different program, with different values and a different note. */
const SCRIPT_B: readonly FixtureCycle[] = [
  // Cycle 1: OP-B starts at address 0.
  {
    events: [
      { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-B' } },
      { kind: 'micro-operation', payload: { controlSignals: ['b-1'] } },
    ],
  },
  // Cycle 2: W goes from 0 to 11.
  { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 11 } }] },
  // Cycle 3: F2 goes from false to true, memory[9] goes from 0 to 42, and B's namespaced note.
  {
    events: [
      { kind: 'flag-update', payload: { flag: 'F2', before: false, after: true } },
      { kind: 'memory-write', payload: { address: 9, before: 0, after: 42 } },
      { kind: 'fixture-b/note', payload: { text: 'note from b' } },
    ],
  },
  // Cycle 4: W goes from 11 to 12, IP goes from 0 to 4, OP-B ends.
  {
    events: [
      { kind: 'register-write', payload: { register: 'W', before: 11, after: 12 } },
      { kind: 'register-write', payload: { register: 'IP', before: 0, after: 4 } },
      { kind: 'instruction-end', payload: { address: 0, mnemonic: 'OP-B', nextAddress: 4 } },
    ],
    instructionCompleted: true,
  },
  // Cycle 5: OUTR goes from 0 to 6, and the halt is reported.
  {
    events: [
      { kind: 'output-emitted', payload: { before: 0, after: 6 } },
      { kind: 'halted', payload: { address: 4 } },
    ],
    instructionCompleted: true,
    halted: true,
  },
];

interface Pair {
  readonly registry: ArchitectureRegistry;
  readonly callsA: ArchitectureCalls;
  readonly callsB: ArchitectureCalls;
}

/** Builds one registry holding both fixtures, each wrapped in its own call counter. */
function pairRegistry(
  scriptA: readonly FixtureCycle[] = SCRIPT_A,
  scriptB: readonly FixtureCycle[] = SCRIPT_B,
): Pair {
  const a = counting(createFixtureArchitecture({ architectureId: ID_A, script: scriptA }));
  const b = counting(createFixtureArchitecture({ architectureId: ID_B, script: scriptB }));
  const registry = must(createArchitectureRegistry([a.architecture, b.architecture]));
  return { registry, callsA: a.calls, callsB: b.calls };
}

function controllerFor(
  registry: ArchitectureRegistry,
  architectureId: string,
): ExecutionController {
  return must(createController({ registry, architectureId, historyLimit: 100 }));
}

/** The call counts that a refused load must leave unchanged. */
function countsOf(calls: ArchitectureCalls): Record<string, number> {
  return {
    createInstance: calls.createInstance,
    loadProgram: calls.loadProgram,
    reset: calls.reset,
    stepClock: calls.stepClock,
    readState: calls.readState,
  };
}

/** Steps the controller `count` clock cycles, collecting every update. */
function stepToEnd(
  controller: ExecutionController,
  updates: ControllerUpdate[],
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    updates.push(must(controller.stepClock()));
  }
}

describe('two architectures in one registry', () => {
  it('createController selects each architecture by identifier', () => {
    const { registry } = pairRegistry();
    const a = controllerFor(registry, ID_A);
    const b = controllerFor(registry, ID_B);
    expect(a.architectureId).toBe(ID_A);
    expect(a.snapshot().architectureId).toBe(ID_A);
    expect(b.architectureId).toBe(ID_B);
    expect(b.snapshot().architectureId).toBe(ID_B);
  });

  it('refuses a program built for the other architecture with PLT-ARCHITECTURE-MISMATCH and changes nothing', () => {
    const { registry, callsA, callsB } = pairRegistry();
    const a = controllerFor(registry, ID_A);
    const b = controllerFor(registry, ID_B);
    const aSnapshot = a.snapshot();
    const bSnapshot = b.snapshot();
    const aBefore = countsOf(callsA);
    const bBefore = countsOf(callsB);

    const refusedByA = a.load(fixtureImage({ architectureId: ID_B }));
    expect(codeOf(refusedByA)).toBe('PLT-ARCHITECTURE-MISMATCH');
    const refusedByB = b.load(fixtureImage({ architectureId: ID_A }));
    expect(codeOf(refusedByB)).toBe('PLT-ARCHITECTURE-MISMATCH');

    expect(countsOf(callsA)).toEqual(aBefore);
    expect(countsOf(callsB)).toEqual(bBefore);
    expect(a.snapshot()).toBe(aSnapshot);
    expect(b.snapshot()).toBe(bSnapshot);
    expect(a.snapshot().cycle).toBe(0);
    expect(a.snapshot().state).toBe('ready');
    expect(b.snapshot().cycle).toBe(0);
    expect(b.snapshot().state).toBe('ready');
  });

  it('runs each controller its own script to its own final state', () => {
    const { registry } = pairRegistry();
    const a = controllerFor(registry, ID_A);
    const b = controllerFor(registry, ID_B);
    must(a.load(fixtureImage({ architectureId: ID_A })));
    must(b.load(fixtureImage({ architectureId: ID_B })));

    const aUpdates: ControllerUpdate[] = [];
    const bUpdates: ControllerUpdate[] = [];
    stepToEnd(a, aUpdates, 5);
    stepToEnd(b, bUpdates, 5);

    const finalA = a.snapshot();
    expect(finalA.cycle).toBe(5);
    expect(finalA.state).toBe('halted');
    expect(finalA.registers.find((r) => r.name === 'W')?.value).toBe(3);
    expect(finalA.registers.find((r) => r.name === 'IP')?.value).toBe(2);
    expect(finalA.registers.find((r) => r.name === 'OUTR')?.value).toBe(7);
    expect(finalA.flags.find((f) => f.name === 'F1')?.value).toBe(true);
    expect(finalA.flags.find((f) => f.name === 'F2')?.value).toBe(false);
    expect(finalA.memory[5]).toBe(9);

    const finalB = b.snapshot();
    expect(finalB.cycle).toBe(5);
    expect(finalB.state).toBe('halted');
    expect(finalB.registers.find((r) => r.name === 'W')?.value).toBe(12);
    expect(finalB.registers.find((r) => r.name === 'IP')?.value).toBe(4);
    expect(finalB.registers.find((r) => r.name === 'OUTR')?.value).toBe(6);
    expect(finalB.flags.find((f) => f.name === 'F1')?.value).toBe(false);
    expect(finalB.flags.find((f) => f.name === 'F2')?.value).toBe(true);
    expect(finalB.memory[9]).toBe(42);

    // The halt is reported on the fifth cycle of each script, and only there.
    expect(aUpdates[3]?.reason).toBe('clock-step');
    expect(aUpdates[4]?.reason).toBe('halt');
    expect(bUpdates[3]?.reason).toBe('clock-step');
    expect(bUpdates[4]?.reason).toBe('halt');
    expect(aUpdates[0]?.snapshot.architectureId).toBe(ID_A);
    expect(bUpdates[0]?.snapshot.architectureId).toBe(ID_B);
  });

  it('delivers each namespaced kind unchanged to its own subscriber only', () => {
    const { registry } = pairRegistry();
    const a = controllerFor(registry, ID_A);
    const b = controllerFor(registry, ID_B);
    must(a.load(fixtureImage({ architectureId: ID_A })));
    must(b.load(fixtureImage({ architectureId: ID_B })));

    const aUpdates: ControllerUpdate[] = [];
    const bUpdates: ControllerUpdate[] = [];
    a.subscribe((update) => aUpdates.push(update));
    b.subscribe((update) => bUpdates.push(update));
    stepToEnd(a, [], 5);
    stepToEnd(b, [], 5);

    const aNotes = aUpdates.flatMap((u) => u.events).filter((e) => e.kind.endsWith('/note'));
    const bNotes = bUpdates.flatMap((u) => u.events).filter((e) => e.kind.endsWith('/note'));
    expect(aNotes).toEqual([
      { kind: 'fixture-a/note', cycle: 4, sequence: 1, payload: { text: 'note from a' } },
    ]);
    expect(bNotes).toEqual([
      { kind: 'fixture-b/note', cycle: 3, sequence: 2, payload: { text: 'note from b' } },
    ]);
    expect(aNotes.some((e) => e.kind === 'fixture-b/note')).toBe(false);
    expect(bNotes.some((e) => e.kind === 'fixture-a/note')).toBe(false);
  });

  it('a kind in the other architecture namespace is an internal fault: no cycle counted, no event of that cycle published', () => {
    // Fixture A emits fixture-b/note in its third cycle. Its first two cycles are good.
    const foreignA: readonly FixtureCycle[] = [
      { events: [{ kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-A' } }] },
      { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 3 } }] },
      {
        events: [
          { kind: 'register-write', payload: { register: 'W', before: 3, after: 8 } },
          { kind: `${ID_B}/note`, payload: { text: 'foreign' } },
        ],
      },
    ];
    const { registry } = pairRegistry(foreignA, SCRIPT_B);
    const a = controllerFor(registry, ID_A);
    must(a.load(fixtureImage({ architectureId: ID_A })));
    const received: ControllerUpdate[] = [];
    a.subscribe((update) => received.push(update));

    must(a.stepClock());
    must(a.stepClock());
    const cycleTwoSnapshot = a.snapshot();
    expect(cycleTwoSnapshot.cycle).toBe(2);

    const update = must(a.stepClock());
    expect(update.reason).toBe('fault');
    expect(update.cyclesCompleted).toBe(0);
    expect(update.snapshot.state).toBe('faulted');
    expect(update.snapshot.lastFault?.code).toBe('PLT-INTERNAL');
    expect(update.snapshot.cycle).toBe(2);
    // The register write of the failed cycle is not committed: W stays at its cycle-2 value.
    expect(update.snapshot.registers.find((r) => r.name === 'W')?.value).toBe(3);
    // Only the platform's fault event is published: no event of the failed cycle.
    expect(update.events.map((e) => e.kind)).toEqual(['fault']);
    expect(update.events[0]).toMatchObject({ kind: 'fault', cycle: 2, sequence: 1 });
    expect(update.events.some((e) => e.kind === `${ID_B}/note`)).toBe(false);
    expect(update.events.some((e) => e.cycle === 3)).toBe(false);

    // The subscriber receives the same update.
    expect(received.at(-1)).toBe(update);
    expect(received.at(-1)?.events).toEqual(update.events);
  });

  it('registration order is preserved, in both orders', () => {
    const forward = pairRegistry();
    expect(forward.registry.architectures.map((a) => a.descriptor.isa.architectureId)).toEqual([
      ID_A,
      ID_B,
    ]);

    const a: CpuArchitecture = createFixtureArchitecture({
      architectureId: ID_A,
      script: SCRIPT_A,
    });
    const b: CpuArchitecture = createFixtureArchitecture({
      architectureId: ID_B,
      script: SCRIPT_B,
    });
    const reverse = must(createArchitectureRegistry([b, a]));
    expect(reverse.architectures.map((x) => x.descriptor.isa.architectureId)).toEqual([ID_B, ID_A]);
  });

  it('an unknown identifier gives ARCH-UNKNOWN-ID from both lookup and createController', () => {
    const { registry } = pairRegistry();
    expect(codeOf(registry.lookup('fixture-c'))).toBe('ARCH-UNKNOWN-ID');
    expect(
      codeOf(createController({ registry, architectureId: 'fixture-c', historyLimit: 100 })),
    ).toBe('ARCH-UNKNOWN-ID');
  });
});
