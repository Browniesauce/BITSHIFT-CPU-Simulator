import { describe, expect, it } from 'vitest';
import type { ControllerUpdate, CpuSnapshot, ExecutionEvent } from '../../src/platform';
import { createFixtureArchitecture, defaultScript } from './fixtures/fixture-architecture';
import type { FixtureCycle } from './fixtures/fixture-architecture';
import {
  FIXTURE_ID,
  fixtureImage,
  loadedHarness,
  makeHarness,
  must,
} from './helpers/controller-harness';
import type { Harness } from './helpers/controller-harness';
import { applyCycle, replayableOf } from './helpers/replay';
import type { ReplayableState } from './helpers/replay';

// Replay invariant (EVENT_MODEL section 5, SC-20). The checker lives in ./helpers/replay.ts and is
// written from the contract alone. Expected values come from the fixture's hand-worked table.

const DESCRIPTOR = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: [] }).descriptor;

/** Hand-worked values after each cycle of defaultScript (fixture-architecture.ts table). */
interface Row {
  readonly cycle: number;
  readonly ip: number;
  readonly w: number;
  readonly outr: number;
  readonly f1: boolean;
  readonly f2: boolean;
  readonly mem20: number;
}

const HAND_WORKED: readonly Row[] = [
  { cycle: 0, ip: 0, w: 0, outr: 0, f1: false, f2: false, mem20: 0 },
  { cycle: 1, ip: 0, w: 0, outr: 0, f1: false, f2: false, mem20: 0 },
  { cycle: 2, ip: 0, w: 0, outr: 0, f1: false, f2: false, mem20: 0 },
  { cycle: 3, ip: 0, w: 1, outr: 0, f1: true, f2: false, mem20: 0 },
  { cycle: 4, ip: 1, w: 1, outr: 0, f1: true, f2: false, mem20: 0 },
  { cycle: 5, ip: 1, w: 1, outr: 0, f1: true, f2: false, mem20: 0 },
  { cycle: 6, ip: 1, w: 1, outr: 0, f1: true, f2: false, mem20: 1 },
  { cycle: 7, ip: 3, w: 1, outr: 0, f1: true, f2: false, mem20: 1 },
  { cycle: 8, ip: 3, w: 1, outr: 0, f1: true, f2: false, mem20: 1 },
  { cycle: 9, ip: 3, w: 1, outr: 0, f1: true, f2: false, mem20: 1 },
  { cycle: 10, ip: 3, w: 1, outr: 1, f1: true, f2: false, mem20: 1 },
  { cycle: 11, ip: 4, w: 1, outr: 1, f1: true, f2: false, mem20: 1 },
  { cycle: 12, ip: 4, w: 1, outr: 1, f1: true, f2: false, mem20: 1 },
  { cycle: 13, ip: 4, w: 1, outr: 1, f1: true, f2: false, mem20: 1 },
];

/** Asserts the replayable state against one hand-worked row. */
function expectRow(state: ReplayableState, row: Row): void {
  expect(state.programCounter).toBe(row.ip);
  expect(state.registers.get('W')).toBe(row.w);
  expect(state.registers.get('OUTR')).toBe(row.outr);
  expect(state.flags.get('F1')).toBe(row.f1);
  expect(state.flags.get('F2')).toBe(row.f2);
  expect(state.memory[20]).toBe(row.mem20);
}

interface Played {
  readonly initial: CpuSnapshot;
  readonly updates: readonly ControllerUpdate[];
  /** States replayed from the events: states[c - 1] is the replay of cycle c. */
  readonly states: readonly ReplayableState[];
}

/**
 * Steps the controller one clock cycle at a time. For every cycle c, replays E(c) onto
 * replayableOf(S(c-1)) and requires the result to equal replayableOf(S(c)).
 */
function replayEveryCycle(harness: Harness, cycles: number): Played {
  const { controller, architecture } = harness;
  const descriptor = architecture.descriptor;
  const initial = controller.snapshot();
  let previous = initial;
  const updates: ControllerUpdate[] = [];
  const states: ReplayableState[] = [];

  for (let c = 1; c <= cycles; c += 1) {
    const update = must(controller.stepClock());
    updates.push(update);
    expect(update.cyclesCompleted).toBe(1);
    expect(update.snapshot.cycle).toBe(c);
    expect(update.events.every((e) => e.cycle === c)).toBe(true);

    const cycleEvents = update.events.filter((e) => e.cycle === c);
    const replayed = applyCycle(replayableOf(previous, descriptor), cycleEvents, descriptor);
    expect(replayed.ok ? undefined : replayed.violation).toBeUndefined();
    if (!replayed.ok) throw new Error(`replay failed at cycle ${c}: ${replayed.violation}`);

    expect(replayed.state).toEqual(replayableOf(update.snapshot, descriptor));
    states.push(replayed.state);
    previous = update.snapshot;
  }
  return { initial, updates, states };
}

/** Freezes plain objects and arrays in place. Typed arrays are skipped (they cannot be frozen). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !ArrayBuffer.isView(value)) {
    if (!Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value as Readonly<Record<string, unknown>>)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

/** A hand-built snapshot of the fixture. Memory is a Uint8Array, as in CpuSnapshot. */
interface Values {
  readonly ip: number;
  readonly w: number;
  readonly outr: number;
  readonly f1: boolean;
  readonly f2: boolean;
  readonly mem20: number;
}

const ZERO: Values = { ip: 0, w: 0, outr: 0, f1: false, f2: false, mem20: 0 };

function snapshotOf(values: Partial<Values>, cycle = 0): CpuSnapshot {
  const v: Values = { ...ZERO, ...values };
  const memory = new Uint8Array(DESCRIPTOR.memoryBytes);
  memory[20] = v.mem20;
  return {
    architectureId: FIXTURE_ID,
    cycle,
    state: 'running',
    programCounter: v.ip,
    registers: [
      { name: 'W', bits: 16, value: v.w },
      { name: 'IP', bits: 6, value: v.ip },
      { name: 'OUTR', bits: 4, value: v.outr },
    ],
    flags: [
      { name: 'F1', value: v.f1 },
      { name: 'F2', value: v.f2 },
    ],
    memory,
  };
}

/** A hand-built event. Only the fields the replay reads are meaningful. */
function ev(kind: string, payload: unknown, cycle = 1, sequence = 0): ExecutionEvent {
  return { kind, cycle, sequence, payload };
}

describe('EVT-03 replay invariant over the fixture controller', () => {
  it('EVT-03 replays the default script cycle by cycle, including PC and output, to the hand-worked table', () => {
    const harness = loadedHarness();
    const descriptor = harness.architecture.descriptor;
    const { initial, updates, states } = replayEveryCycle(harness, 13);

    expectRow(replayableOf(initial, descriptor), HAND_WORKED[0]);
    HAND_WORKED.slice(1).forEach((row, i) => {
      expectRow(states[i], row);
    });

    expect(harness.calls.stepClock).toBe(13);
    expect(updates).toHaveLength(13);
    expect(updates[12].snapshot.state).toBe('halted');
    expect(updates[12].snapshot.cycle).toBe(13);
  });

  it('EVT-03 replays a second hand-written script that writes memory twice, sets and clears a flag, and writes output twice', () => {
    const script: readonly FixtureCycle[] = [
      {
        events: [
          { kind: 'instruction-start', payload: { address: 0, mnemonic: 'OP-B' } },
          { kind: 'micro-operation', payload: { controlSignals: ['sig-x'] } },
        ],
      },
      {
        events: [{ kind: 'memory-write', payload: { address: 5, before: 0, after: 9 } }],
      },
      {
        events: [{ kind: 'flag-update', payload: { flag: 'F2', before: false, after: true } }],
      },
      {
        events: [
          { kind: 'memory-write', payload: { address: 6, before: 0, after: 3 } },
          { kind: 'register-write', payload: { register: 'W', before: 0, after: 2 } },
        ],
      },
      {
        events: [{ kind: 'output-emitted', payload: { before: 0, after: 2 } }],
      },
      {
        events: [
          { kind: 'flag-update', payload: { flag: 'F2', before: true, after: false } },
          { kind: 'register-write', payload: { register: 'IP', before: 0, after: 2 } },
          { kind: 'instruction-end', payload: { address: 0, mnemonic: 'OP-B', nextAddress: 2 } },
        ],
        instructionCompleted: true,
      },
      {
        events: [
          { kind: 'instruction-start', payload: { address: 2, mnemonic: 'OP-A' } },
          { kind: 'bus-transfer', payload: { bus: 'data', value: 2 } },
        ],
      },
      {
        events: [
          { kind: 'output-emitted', payload: { before: 2, after: 7 } },
          { kind: 'memory-write', payload: { address: 5, before: 9, after: 0 } },
        ],
      },
      {
        events: [
          { kind: 'register-write', payload: { register: 'IP', before: 2, after: 3 } },
          { kind: 'instruction-end', payload: { address: 2, mnemonic: 'OP-A', nextAddress: 3 } },
          { kind: 'halted', payload: { address: 3 } },
        ],
        instructionCompleted: true,
        halted: true,
      },
    ];

    const harness = makeHarness({ script });
    must(harness.controller.load(fixtureImage()));
    const { updates, states } = replayEveryCycle(harness, 9);

    // Hand-worked: memory[5] goes 0, 9, 0; memory[6] goes 0, 3; F2 goes on at cycle 3, off at 6;
    // OUTR goes 0, 2, 7; IP goes 0, 2, 3; W goes 0, 2.
    expect(states[1].memory[5]).toBe(9);
    expect(states[2].flags.get('F2')).toBe(true);
    expect(states[5].flags.get('F2')).toBe(false);
    expect(states[4].registers.get('OUTR')).toBe(2);
    expect(states[7].registers.get('OUTR')).toBe(7);
    expect(states[7].memory[5]).toBe(0);

    const final = states[8];
    expect(final.registers.get('W')).toBe(2);
    expect(final.registers.get('OUTR')).toBe(7);
    expect(final.programCounter).toBe(3);
    expect(final.flags.get('F1')).toBe(false);
    expect(final.flags.get('F2')).toBe(false);
    expect(final.memory[5]).toBe(0);
    expect(final.memory[6]).toBe(3);

    expect(updates).toHaveLength(9);
    expect(updates[8].snapshot.state).toBe('halted');
    expect(updates[8].reason).toBe('halt');
    const outputEvents = updates
      .flatMap((u) => u.events)
      .filter((e) => e.kind === 'output-emitted');
    expect(outputEvents).toHaveLength(2);
  });
});

describe('EVT-03 checker can fail', () => {
  it.each([
    ['register-write', 'W', ev('register-write', { register: 'W', before: 5, after: 1 })],
    ['flag-update', 'F1', ev('flag-update', { flag: 'F1', before: true, after: false })],
    ['memory-write', 'memory[20]', ev('memory-write', { address: 20, before: 1, after: 2 })],
    ['output-emitted', 'OUTR', ev('output-emitted', { before: 3, after: 1 })],
  ])('EVT-03 reports a wrong before value on %s (%s) as a violation', (_kind, _target, event) => {
    const state = replayableOf(snapshotOf(ZERO), DESCRIPTOR);
    const result = applyCycle(state, [event], DESCRIPTOR);
    expect(result).toEqual({ ok: false, violation: expect.any(String) });
  });

  it.each([
    ['register-write', ev('register-write', { register: 'W', before: 0, after: 1 })],
    ['flag-update', ev('flag-update', { flag: 'F1', before: false, after: true })],
    ['memory-write', ev('memory-write', { address: 20, before: 0, after: 1 })],
    ['output-emitted', ev('output-emitted', { before: 0, after: 1 })],
  ])('EVT-03 accepts the correct before value on %s (control case)', (_kind, event) => {
    const state = replayableOf(snapshotOf(ZERO), DESCRIPTOR);
    const result = applyCycle(state, [event], DESCRIPTOR);
    expect(result.ok).toBe(true);
  });

  it('EVT-03 detects a snapshot that differs from the replayed state', () => {
    const before = replayableOf(snapshotOf(ZERO, 0), DESCRIPTOR);
    const events = [ev('register-write', { register: 'W', before: 0, after: 1 })];
    const replayed = applyCycle(before, events, DESCRIPTOR);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;

    const matching = replayableOf(snapshotOf({ w: 1 }, 1), DESCRIPTOR);
    const differing = replayableOf(snapshotOf({ w: 2 }, 1), DESCRIPTOR);
    expect(replayed.state).toEqual(matching);
    expect(replayed.state).not.toEqual(differing);
  });

  it('EVT-03 detects an event dropped from a cycle', () => {
    const before = replayableOf(snapshotOf(ZERO, 0), DESCRIPTOR);
    const writeW = ev('register-write', { register: 'W', before: 0, after: 1 }, 1, 0);
    const setF1 = ev('flag-update', { flag: 'F1', before: false, after: true }, 1, 1);
    const target = replayableOf(snapshotOf({ w: 1, f1: true }, 1), DESCRIPTOR);

    const full = applyCycle(before, [writeW, setF1], DESCRIPTOR);
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(full.state).toEqual(target);

    const dropped = applyCycle(before, [writeW], DESCRIPTOR);
    expect(dropped.ok).toBe(true);
    if (!dropped.ok) return;
    expect(dropped.state).not.toEqual(target);
    expect(dropped.state.flags.get('F1')).toBe(false);
  });
});

describe('EVT-07 informational events do not change replayable state', () => {
  const informational: readonly ExecutionEvent[] = [
    ev('micro-operation', { controlSignals: ['sig'] }),
    ev('bus-transfer', { bus: 'data', value: 1 }),
    ev('alu-operation', { operation: 'op', left: 1, right: 2, result: 3 }),
    ev('memory-read', { address: 20, value: 1 }),
    ev('instruction-start', { address: 3, mnemonic: 'OP-B' }),
    ev('instruction-end', { address: 3, mnemonic: 'OP-B', nextAddress: 4 }),
    ev('halted', { address: 4 }),
  ];

  it.each(informational.map((e) => [e.kind, e] as const))(
    'EVT-07 a cycle holding only %s leaves replayable state unchanged',
    (_kind, event) => {
      const state = replayableOf(
        snapshotOf({ ip: 3, w: 1, outr: 1, f1: true, mem20: 1 }),
        DESCRIPTOR,
      );
      const result = applyCycle(state, [event], DESCRIPTOR);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state).toEqual(state);
    },
  );

  it('EVT-07 a cycle holding all informational kinds together leaves replayable state unchanged', () => {
    const state = replayableOf(
      snapshotOf({ ip: 3, w: 1, outr: 1, f1: true, mem20: 1 }),
      DESCRIPTOR,
    );
    const result = applyCycle(state, informational, DESCRIPTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
  });
});

describe('EVT-05 namespaced architecture events', () => {
  it('EVT-05 delivers the namespaced note event to a subscriber unchanged and it does not change replayable state', () => {
    const harness = loadedHarness();
    const descriptor = harness.architecture.descriptor;
    const seen: ExecutionEvent[] = [];
    harness.controller.subscribe((update) => {
      seen.push(...update.events);
    });

    const { updates } = replayEveryCycle(harness, 13);
    const noteKind = `${FIXTURE_ID}/note`;
    const delivered = seen.filter((e) => e.kind === noteKind);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].kind).toBe(noteKind);
    expect(delivered[0].cycle).toBe(6);

    const scripted = defaultScript(FIXTURE_ID)
      .flatMap((c) => ('events' in c ? c.events : []))
      .find((e) => e.kind === noteKind);
    expect(scripted).toBeDefined();
    expect(delivered[0].payload).toEqual(scripted?.payload);
    expect(delivered[0].payload).toEqual({ text: 'note text' });

    const before = replayableOf(updates[4].snapshot, descriptor);
    const result = applyCycle(before, delivered, descriptor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(before);
  });
});

describe('replay does not mutate its inputs', () => {
  it('EVT-03 applyCycle and replayableOf leave their inputs unchanged, including on a violation', () => {
    const snapshot = deepFreeze(snapshotOf({ w: 0, f1: false, outr: 0 }, 2));
    const snapshotCopy = structuredClone(snapshot);
    const state = replayableOf(snapshot, DESCRIPTOR);
    const stateCopy = structuredClone(state);
    expect(snapshot).toEqual(snapshotCopy);

    const events = deepFreeze([
      ev('register-write', { register: 'W', before: 0, after: 1 }, 3, 0),
      ev('micro-operation', { controlSignals: ['sig'] }, 3, 1),
      ev('flag-update', { flag: 'F1', before: false, after: true }, 3, 2),
      ev('memory-write', { address: 20, before: 0, after: 1 }, 3, 3),
      ev('output-emitted', { before: 0, after: 1 }, 3, 4),
    ]);
    const eventsCopy = structuredClone(events);
    const descriptorCopy = structuredClone(DESCRIPTOR);

    const ok = applyCycle(state, events, DESCRIPTOR);
    expect(ok.ok).toBe(true);
    expect(state).toEqual(stateCopy);
    expect(events).toEqual(eventsCopy);
    expect(DESCRIPTOR).toEqual(descriptorCopy);
    expect(snapshot).toEqual(snapshotCopy);

    const bad = applyCycle(
      state,
      [ev('register-write', { register: 'W', before: 9, after: 1 })],
      DESCRIPTOR,
    );
    expect(bad.ok).toBe(false);
    expect(state).toEqual(stateCopy);
    expect(replayableOf(snapshot, DESCRIPTOR)).toEqual(stateCopy);
    expect(snapshot).toEqual(snapshotCopy);
  });
});
