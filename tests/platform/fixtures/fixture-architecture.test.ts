import { describe, expect, it } from 'vitest';
import { createArchitectureRegistry } from '../../../src/platform';
import type {
  ArchitectureEvent,
  CpuStateCopy,
  Diagnostic,
  ProgramImage,
  SharedEventPayloads,
  StepOutcome,
} from '../../../src/platform';
import type { FixtureCycle } from './fixture-architecture';
import { createFixtureArchitecture, defaultScript } from './fixture-architecture';

const ID = 'fixture-a';
const OTHER = 'fixture-b';
const OUTCOME_KEYS = ['cyclesCompleted', 'instructionCompleted', 'halted', 'fault', 'events'];

/** Flat, comparable view of a state copy. */
interface View {
  readonly programCounter: number;
  readonly w: number;
  readonly outr: number;
  readonly f1: boolean;
  readonly f2: boolean;
  readonly memory: readonly (readonly [number, number])[];
}

interface Expected extends View {
  readonly instructionCompleted: boolean;
  readonly halted: boolean;
}

/** State after reset, before any load: all zero. */
const INITIAL: View = { programCounter: 0, w: 0, outr: 0, f1: false, f2: false, memory: [] };

/** Hand-worked table from fixture-architecture.ts, one row per cycle of defaultScript. */
const HAND_TABLE: readonly Expected[] = [
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 0,
    w: 0,
    outr: 0,
    f1: false,
    f2: false,
    memory: [],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 0,
    w: 0,
    outr: 0,
    f1: false,
    f2: false,
    memory: [],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 0,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [],
  },
  {
    instructionCompleted: true,
    halted: false,
    programCounter: 1,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 1,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 1,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: true,
    halted: false,
    programCounter: 3,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 3,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 3,
    w: 1,
    outr: 0,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 3,
    w: 1,
    outr: 1,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: true,
    halted: false,
    programCounter: 4,
    w: 1,
    outr: 1,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: false,
    halted: false,
    programCounter: 4,
    w: 1,
    outr: 1,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
  {
    instructionCompleted: true,
    halted: true,
    programCounter: 4,
    w: 1,
    outr: 1,
    f1: true,
    f2: false,
    memory: [[20, 1]],
  },
];

function fixtureOf(id: string, script: readonly FixtureCycle[] = defaultScript(id)) {
  return createFixtureArchitecture({ architectureId: id, script });
}

function program(
  architectureId: string,
  origin: number,
  entry: number,
  bytes: number[],
): ProgramImage {
  return {
    architectureId,
    origin,
    entry,
    bytes: Uint8Array.from(bytes),
    symbols: {},
    sourceMap: [],
  };
}

function diagnostic(code: string): Diagnostic {
  return { code, severity: 'error', message: 'test diagnostic' };
}

function viewOf(state: CpuStateCopy): View {
  const register = (name: string): number =>
    state.registers.find((r) => r.name === name)?.value ?? Number.NaN;
  const flag = (name: string): boolean => state.flags.find((f) => f.name === name)?.value ?? false;
  const memory: [number, number][] = [];
  state.memory.forEach((value, address) => {
    if (value !== 0) memory.push([address, value]);
  });
  return {
    programCounter: state.programCounter,
    w: register('W'),
    outr: register('OUTR'),
    f1: flag('F1'),
    f2: flag('F2'),
    memory,
  };
}

/** Mutable model used to replay state-changing events (EVENT_MODEL section 5.2). */
interface Model {
  readonly registers: Map<string, number>;
  readonly flags: Map<string, boolean>;
  readonly memory: number[];
}

function modelOf(state: CpuStateCopy): Model {
  return {
    registers: new Map(state.registers.map((r): [string, number] => [r.name, r.value])),
    flags: new Map(state.flags.map((f): [string, boolean] => [f.name, f.value])),
    memory: Array.from(state.memory),
  };
}

/** Applies a cycle's state-changing events, checking each `before` against the replayed value. */
function replay(model: Model, events: readonly ArchitectureEvent[]): void {
  for (const event of events) {
    if (event.kind === 'register-write') {
      const p = event.payload as SharedEventPayloads['register-write'];
      expect(model.registers.get(p.register)).toBe(p.before);
      model.registers.set(p.register, p.after);
    } else if (event.kind === 'output-emitted') {
      const p = event.payload as SharedEventPayloads['output-emitted'];
      expect(model.registers.get('OUTR')).toBe(p.before);
      model.registers.set('OUTR', p.after);
    } else if (event.kind === 'flag-update') {
      const p = event.payload as SharedEventPayloads['flag-update'];
      expect(model.flags.get(p.flag)).toBe(p.before);
      model.flags.set(p.flag, p.after);
    } else if (event.kind === 'memory-write') {
      const p = event.payload as SharedEventPayloads['memory-write'];
      expect(model.memory[p.address]).toBe(p.before);
      model.memory[p.address] = p.after;
    }
  }
}

describe('fixture descriptor', () => {
  it('declares the fixed widths, registers, flags and identifier', () => {
    const { descriptor } = fixtureOf(ID);
    expect(descriptor.wordBits).toBe(16);
    expect(descriptor.addressBits).toBe(6);
    expect(descriptor.memoryBytes).toBe(48);
    expect(descriptor.registers.map((r) => [r.name, r.bits, r.role])).toEqual([
      ['W', 16, 'general'],
      ['IP', 6, 'program-counter'],
      ['OUTR', 4, 'output'],
    ]);
    expect(descriptor.flags.map((f) => f.name)).toEqual(['F1', 'F2']);
    expect(descriptor.isa.architectureId).toBe(ID);
  });

  it('passes createArchitectureRegistry and is found by its identifier', () => {
    const a = fixtureOf(ID);
    const b = fixtureOf(OTHER);
    const registry = createArchitectureRegistry([a, b]);
    if (!registry.ok) throw new Error('expected a valid registry');
    const found = registry.value.lookup(ID);
    expect(found.ok && found.value).toBe(a);
    const missing = registry.value.lookup('fixture-missing');
    expect(!missing.ok && missing.error.code).toBe('ARCH-UNKNOWN-ID');
  });
});

describe('SNP-05 readState isolation', () => {
  it('shares no array or buffer with the instance or with an earlier read', () => {
    const instance = fixtureOf(ID).createInstance();
    expect(instance.loadProgram(program(ID, 3, 2, [0xaa])).ok).toBe(true);
    instance.stepClock();
    instance.stepClock();
    instance.stepClock();

    const first = instance.readState();
    const second = instance.readState();
    expect(second.memory).not.toBe(first.memory);
    expect(second.registers).not.toBe(first.registers);
    expect(second.registers[0]).not.toBe(first.registers[0]);
    expect(second.flags[0]).not.toBe(first.flags[0]);

    const expected = viewOf(second);
    expect(expected.w).toBe(1);
    expect(expected.f1).toBe(true);
    expect(expected.memory).toEqual([[3, 0xaa]]);

    first.memory[3] = 0x77;
    (first.registers[0] as { value: number }).value = 0xffff;
    (first.flags[0] as { value: boolean }).value = false;
    expect(viewOf(instance.readState())).toEqual(expected);
    expect(viewOf(second)).toEqual(expected);

    const early = instance.readState();
    const earlyView = viewOf(early);
    instance.stepClock();
    expect(instance.readState().programCounter).not.toBe(earlyView.programCounter);
    expect(viewOf(early)).toEqual(earlyView);
  });
});

describe('CYC-09 outcomes carry no cycle number', () => {
  it('every outcome has only the five StepOutcome keys and never a cycle key', () => {
    const instance = fixtureOf(ID).createInstance();
    const outcomes: StepOutcome[] = [];
    for (let i = 0; i < HAND_TABLE.length + 1; i += 1) outcomes.push(instance.stepClock());
    for (const outcome of outcomes) {
      const keys = Object.keys(outcome);
      expect(keys).not.toContain('cycle');
      expect(keys.every((key) => OUTCOME_KEYS.includes(key))).toBe(true);
      expect('fault' in outcome).toBe(false);
    }
  });

  it('a fault outcome also has only the five keys', () => {
    const script: FixtureCycle[] = [{ fault: diagnostic(`${ID}/BAD`) }];
    const outcome = fixtureOf(ID, script).createInstance().stepClock();
    const keys = Object.keys(outcome);
    expect(keys).toContain('fault');
    expect(keys.every((key) => OUTCOME_KEYS.includes(key))).toBe(true);
    expect(keys).not.toContain('cycle');
  });

  it('past the end of the script, reports halted with zero cycles and no events', () => {
    const instance = fixtureOf(ID).createInstance();
    for (let i = 0; i < HAND_TABLE.length; i += 1) instance.stepClock();
    const before = viewOf(instance.readState());
    const outcome = instance.stepClock();
    expect(outcome).toEqual({
      cyclesCompleted: 0,
      instructionCompleted: false,
      halted: true,
      events: [],
    });
    expect(viewOf(instance.readState())).toEqual(before);
  });

  it('every successful cycle reports one cycle, and each event has cycleOffset 1', () => {
    const instance = fixtureOf(ID).createInstance();
    for (let i = 0; i < HAND_TABLE.length; i += 1) {
      const outcome = instance.stepClock();
      expect(outcome.cyclesCompleted).toBe(1);
      expect(outcome.events.every((e) => e.cycleOffset === 1)).toBe(true);
    }
  });
});

describe('defaultScript against the hand-worked table', () => {
  it('starts from the all-zero state after reset', () => {
    const instance = fixtureOf(ID).createInstance();
    expect(viewOf(instance.readState())).toEqual(INITIAL);
  });

  it('state after each cycle equals the hand-worked table, with completes and halts flags', () => {
    const instance = fixtureOf(ID).createInstance();
    HAND_TABLE.forEach((row, index) => {
      const outcome = instance.stepClock();
      const { instructionCompleted, halted, ...view } = row;
      expect(outcome.cyclesCompleted, `cycle ${index + 1}`).toBe(1);
      expect(outcome.instructionCompleted, `cycle ${index + 1}`).toBe(instructionCompleted);
      expect(outcome.halted, `cycle ${index + 1}`).toBe(halted);
      expect(viewOf(instance.readState()), `cycle ${index + 1}`).toEqual(view);
    });
  });

  it('IP (the register) equals the programCounter after every cycle', () => {
    const instance = fixtureOf(ID).createInstance();
    for (let i = 0; i < HAND_TABLE.length; i += 1) {
      instance.stepClock();
      const state = instance.readState();
      expect(state.registers.find((r) => r.name === 'IP')?.value).toBe(state.programCounter);
    }
  });

  it('replays every state-changing event: each before matches, and the result is the next state', () => {
    const instance = fixtureOf(ID).createInstance();
    const model = modelOf(instance.readState());
    for (let i = 0; i < HAND_TABLE.length; i += 1) {
      const outcome = instance.stepClock();
      replay(model, outcome.events);
      expect(modelOf(instance.readState()), `cycle ${i + 1}`).toEqual(model);
    }
    expect(model.registers.get('IP')).toBe(4);
  });

  it('emits the eleven emittable shared kinds and one namespaced kind, and no fault kind', () => {
    const kinds = new Set<string>();
    for (const cycle of defaultScript(ID)) {
      if ('events' in cycle) for (const event of cycle.events) kinds.add(event.kind);
    }
    expect(kinds).toEqual(
      new Set([
        'micro-operation',
        'bus-transfer',
        'register-write',
        'memory-read',
        'memory-write',
        'alu-operation',
        'flag-update',
        'output-emitted',
        'instruction-start',
        'instruction-end',
        'halted',
        `${ID}/note`,
      ]),
    );
    expect(kinds.has('fault')).toBe(false);
  });

  it('covers at least three instructions and ends its last instruction in a halted cycle', () => {
    const cycles = defaultScript(ID);
    const starts = cycles.filter(
      (c) => 'events' in c && c.events.some((e) => e.kind === 'instruction-start'),
    );
    expect(starts.length).toBeGreaterThanOrEqual(3);
    const last = cycles[cycles.length - 1];
    expect('halted' in last && last.halted).toBe(true);
  });
});

describe('fault cycles', () => {
  it('leave readState deeply equal, return the fault, and can be repeated', () => {
    const fault = diagnostic(`${ID}/BAD-OPCODE`);
    const script: FixtureCycle[] = [
      { fault },
      { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 7 } }] },
    ];
    const instance = fixtureOf(ID, script).createInstance();
    const before = instance.readState();
    for (let i = 0; i < 3; i += 1) {
      const outcome = instance.stepClock();
      expect(outcome.cyclesCompleted).toBe(0);
      expect(outcome.events).toEqual([]);
      expect(outcome.halted).toBe(false);
      expect(outcome.instructionCompleted).toBe(false);
      expect(outcome.fault).toEqual(fault);
      expect(instance.readState()).toEqual(before);
    }
  });

  it('does not advance the script: the cycle after a fault is never reached while it repeats', () => {
    const script: FixtureCycle[] = [
      { fault: diagnostic(`${ID}/BAD-OPCODE`) },
      { events: [{ kind: 'register-write', payload: { register: 'W', before: 0, after: 7 } }] },
    ];
    const instance = fixtureOf(ID, script).createInstance();
    instance.stepClock();
    expect(instance.stepClock().fault?.code).toBe(`${ID}/BAD-OPCODE`);
    expect(viewOf(instance.readState()).w).toBe(0);
  });
});

describe('throwing cycles', () => {
  it('throw an Error, leave the state unchanged, and do not advance the script', () => {
    const script: FixtureCycle[] = [{ throws: 'boom' }];
    const instance = fixtureOf(ID, script).createInstance();
    const before = instance.readState();
    expect(() => instance.stepClock()).toThrow(Error);
    expect(() => instance.stepClock()).toThrow(Error);
    expect(instance.readState()).toEqual(before);
  });
});

describe('loadProgram', () => {
  it('rejects a mismatched architectureId with the LOAD-MISMATCH code, and changes nothing', () => {
    const accepted = fixtureOf(ID).createInstance();
    const guarded = fixtureOf(ID).createInstance();
    expect(accepted.loadProgram(program(ID, 3, 2, [0xaa, 0xbb])).ok).toBe(true);
    expect(guarded.loadProgram(program(ID, 3, 2, [0xaa, 0xbb])).ok).toBe(true);
    accepted.stepClock();
    accepted.stepClock();
    guarded.stepClock();
    guarded.stepClock();

    const before = guarded.readState();
    const result = guarded.loadProgram(program(OTHER, 0, 0, [1]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(`${ID}/LOAD-MISMATCH`);
    expect(guarded.readState()).toEqual(before);
    expect(guarded.stepClock()).toEqual(accepted.stepClock());
  });

  it('rejects a program that does not fit with the LOAD-RANGE code, and changes nothing', () => {
    const accepted = fixtureOf(ID).createInstance();
    const guarded = fixtureOf(ID).createInstance();
    expect(accepted.loadProgram(program(ID, 3, 2, [0xaa, 0xbb])).ok).toBe(true);
    expect(guarded.loadProgram(program(ID, 3, 2, [0xaa, 0xbb])).ok).toBe(true);
    accepted.stepClock();
    accepted.stepClock();
    guarded.stepClock();
    guarded.stepClock();

    const before = guarded.readState();
    const result = guarded.loadProgram(program(ID, 41, 0, [1, 2, 3, 4, 5, 6, 7, 8]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(`${ID}/LOAD-RANGE`);
    expect(guarded.readState()).toEqual(before);
    expect(guarded.stepClock()).toEqual(accepted.stepClock());
  });

  it('accepts a program that ends exactly at the last byte of memory', () => {
    const instance = fixtureOf(ID).createInstance();
    expect(instance.loadProgram(program(ID, 40, 40, [1, 2, 3, 4, 5, 6, 7, 8])).ok).toBe(true);
    expect(viewOf(instance.readState()).memory.length).toBe(8);
  });

  it('a rejected load before any accepted load leaves the all-zero state', () => {
    const instance = fixtureOf(ID).createInstance();
    expect(instance.loadProgram(program(OTHER, 0, 0, [1])).ok).toBe(false);
    expect(instance.loadProgram(program(ID, 49, 0, [1])).ok).toBe(false);
    expect(viewOf(instance.readState())).toEqual(INITIAL);
  });

  it('an accepted load zeroes state, copies bytes at origin, sets IP to entry and rewinds the script', () => {
    const instance = fixtureOf(ID).createInstance();
    for (let i = 0; i < 6; i += 1) instance.stepClock();
    const first = fixtureOf(ID).createInstance().stepClock();

    const bytes = [0xaa, 0xbb];
    const image = program(ID, 3, 2, bytes);
    expect(instance.loadProgram(image).ok).toBe(true);
    bytes[0] = 0x00;
    image.bytes[1] = 0x00;

    expect(viewOf(instance.readState())).toEqual({
      programCounter: 2,
      w: 0,
      outr: 0,
      f1: false,
      f2: false,
      memory: [
        [3, 0xaa],
        [4, 0xbb],
      ],
    });
    expect(instance.stepClock()).toEqual(first);
  });
});

describe('reset', () => {
  it('before any load, restores the all-zero state and rewinds the script', () => {
    const instance = fixtureOf(ID).createInstance();
    const first = fixtureOf(ID).createInstance().stepClock();
    instance.stepClock();
    instance.stepClock();
    instance.reset();
    expect(viewOf(instance.readState())).toEqual(INITIAL);
    expect(instance.stepClock()).toEqual(first);
  });

  it('restores the state after the last accepted load and rewinds the script', () => {
    const instance = fixtureOf(ID).createInstance();
    instance.loadProgram(program(ID, 3, 2, [0xaa, 0xbb]));
    const afterLoad = instance.readState();
    expect(afterLoad.programCounter).toBe(2);
    expect(afterLoad.memory[3]).toBe(0xaa);
    expect(afterLoad.memory[4]).toBe(0xbb);
    const first = fixtureOf(ID).createInstance().stepClock();

    for (let i = 0; i < 5; i += 1) instance.stepClock();
    expect(instance.readState()).not.toEqual(afterLoad);
    instance.reset();
    expect(instance.readState()).toEqual(afterLoad);
    expect(instance.stepClock()).toEqual(first);
  });

  it('uses the most recent accepted load, not the first one', () => {
    const instance = fixtureOf(ID).createInstance();
    instance.loadProgram(program(ID, 3, 2, [0xaa]));
    instance.loadProgram(program(ID, 10, 5, [0x11]));
    instance.stepClock();
    instance.reset();
    const state = viewOf(instance.readState());
    expect(state.programCounter).toBe(5);
    expect(state.memory).toEqual([[10, 0x11]]);
  });
});

describe('independence of two fixtures', () => {
  it('stepping, loading and scripts of one fixture never affect the other', () => {
    const a = fixtureOf(ID).createInstance();
    const b = fixtureOf(OTHER).createInstance();
    let sixth: StepOutcome | undefined;
    for (let i = 0; i < 6; i += 1) sixth = a.stepClock();
    expect(sixth?.events.map((e) => e.kind)).toContain(`${ID}/note`);

    expect(viewOf(b.readState())).toEqual(INITIAL);
    const bFirst = b.stepClock();
    expect(bFirst.events.map((e) => e.kind)).toEqual(['instruction-start', 'micro-operation']);

    const result = b.loadProgram(program(ID, 0, 0, [1]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(`${OTHER}/LOAD-MISMATCH`);
    expect(a.loadProgram(program(ID, 4, 1, [9])).ok).toBe(true);
    expect(viewOf(b.readState())).toEqual({ ...INITIAL, programCounter: 0 });
  });

  it('registers both fixtures in one registry with distinct identifiers', () => {
    const a = fixtureOf(ID);
    const b = fixtureOf(OTHER);
    const registry = createArchitectureRegistry([a, b]);
    if (!registry.ok) throw new Error('expected a valid registry');
    const foundB = registry.value.lookup(OTHER);
    expect(foundB.ok && foundB.value).toBe(b);
  });
});
