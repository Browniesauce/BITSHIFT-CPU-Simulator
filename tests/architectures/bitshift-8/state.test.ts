import { describe, expect, it } from 'vitest';
import type { ProgramImage } from '../../../src/platform';
import { ARCHITECTURE_ID, FLAGS, REGISTERS } from '../../../src/architectures/bitshift-8/machine';
import type { FlagName, RegisterName } from '../../../src/architectures/bitshift-8/machine';
import type { MachineState } from '../../../src/architectures/bitshift-8/state';
import {
  createState,
  getFlag,
  getRegister,
  increment8,
  loadProgram,
  readByte,
  readState,
  resetState,
  setFlag,
  setRegister,
  writeByte,
} from '../../../src/architectures/bitshift-8/state';

/** Builds a BITSHIFT-8 program image with the given overrides (ISA §1.2). */
function makeImage(overrides: {
  architectureId?: string;
  origin?: number;
  entry?: number;
  bytes?: Uint8Array;
}): ProgramImage {
  return {
    architectureId: ARCHITECTURE_ID,
    origin: 0,
    entry: 0,
    bytes: new Uint8Array(0),
    symbols: {},
    sourceMap: [],
    ...overrides,
  };
}

/** Returns an array of 256 zeros with the given index/value pairs applied (ISA §1.2 rule 3). */
function memoryWith(entries: readonly (readonly [number, number])[]): number[] {
  const expected = new Array<number>(256).fill(0);
  for (const [index, value] of entries) {
    expected[index] = value;
  }
  return expected;
}

/** Creates a machine that has accepted one load, then dirtied its registers, flags and memory (ISA §1.2). */
function dirtyLoadedState(): MachineState {
  const state = createState();
  const result = loadProgram(
    state,
    makeImage({ origin: 3, entry: 3, bytes: new Uint8Array([0xaa, 0xbb]) }),
  );
  expect(result.ok).toBe(true);
  setRegister(state, 'A', 0x42);
  setFlag(state, 'Z', true);
  writeByte(state, 100, 0x09);
  return state;
}

describe('createState (ISA §1.2 rule 1)', () => {
  it('a new state is the empty machine: 256 zero bytes, registers 0, flags false', () => {
    const copy = readState(createState());
    expect(copy.memory.length).toBe(256);
    expect(Array.from(copy.memory)).toEqual(memoryWith([]));
    expect(copy.registers.map((register) => register.value)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(copy.flags.map((flag) => flag.value)).toEqual([false, false, false]);
    expect(copy.programCounter).toBe(0);
  });
});

describe('loadProgram rejection (ISA §1.2 rule 2)', () => {
  const rejections: readonly {
    readonly name: string;
    readonly overrides: {
      architectureId?: string;
      origin?: number;
      entry?: number;
      bytes?: Uint8Array;
    };
    readonly code: string;
  }[] = [
    {
      name: 'another architectureId with LOAD-MISMATCH',
      overrides: { architectureId: 'bitshift-16', origin: 0, entry: 0 },
      code: 'bitshift-8/LOAD-MISMATCH',
    },
    {
      name: 'origin -1 with LOAD-RANGE',
      overrides: { origin: -1, entry: 0 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'origin 256 with LOAD-RANGE',
      overrides: { origin: 256, entry: 0 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'origin 1.5 with LOAD-RANGE',
      overrides: { origin: 1.5, entry: 0 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'entry -1 with LOAD-RANGE',
      overrides: { origin: 0, entry: -1 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'entry 256 with LOAD-RANGE',
      overrides: { origin: 0, entry: 256 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'entry 1.5 with LOAD-RANGE',
      overrides: { origin: 0, entry: 1.5 },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'origin 200 with 57 bytes with LOAD-RANGE',
      overrides: { origin: 200, entry: 0, bytes: new Uint8Array(57) },
      code: 'bitshift-8/LOAD-RANGE',
    },
    {
      name: 'a wrong identifier and a bad origin with LOAD-MISMATCH',
      overrides: { architectureId: 'other', origin: -1, entry: 0 },
      code: 'bitshift-8/LOAD-MISMATCH',
    },
  ];

  it.each(rejections)('rejects $name and leaves the state unchanged', ({ overrides, code }) => {
    const state = dirtyLoadedState();
    const before = readState(state);
    const result = loadProgram(state, makeImage(overrides));
    expect(result).toMatchObject({ ok: false, error: { code, severity: 'error' } });
    expect(readState(state)).toEqual(before);
  });
});

describe('loadProgram rejection and reset (ISA §1.2 rules 2, 4)', () => {
  it('a rejected load does not replace what resetState restores', () => {
    const state = dirtyLoadedState();
    const rejected = loadProgram(state, makeImage({ origin: 256, entry: 0 }));
    expect(rejected).toMatchObject({ ok: false });
    resetState(state);
    const copy = readState(state);
    expect(Array.from(copy.memory)).toEqual(
      memoryWith([
        [3, 0xaa],
        [4, 0xbb],
      ]),
    );
    expect(copy.programCounter).toBe(3);
  });
});

describe('loadProgram accepted boundaries (ISA §1.2 rule 2)', () => {
  it('accepts origin 0 with 256 bytes', () => {
    const state = createState();
    const bytes = new Uint8Array(256).fill(0x7f);
    expect(loadProgram(state, makeImage({ origin: 0, entry: 0, bytes }))).toMatchObject({
      ok: true,
    });
    expect(readByte(state, 255)).toBe(0x7f);
  });

  it('accepts origin 255 with 1 byte', () => {
    const state = createState();
    const result = loadProgram(
      state,
      makeImage({ origin: 255, entry: 0, bytes: new Uint8Array([0x11]) }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(readByte(state, 255)).toBe(0x11);
  });

  it('accepts origin 200 with 56 bytes', () => {
    const state = createState();
    const result = loadProgram(
      state,
      makeImage({ origin: 200, entry: 200, bytes: new Uint8Array(56).fill(0x22) }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(readByte(state, 255)).toBe(0x22);
  });

  it('accepts an empty image', () => {
    const state = createState();
    expect(loadProgram(state, makeImage({ origin: 0, entry: 0 }))).toMatchObject({ ok: true });
  });

  it('accepts entry 255', () => {
    const state = createState();
    const result = loadProgram(state, makeImage({ origin: 0, entry: 255 }));
    expect(result).toMatchObject({ ok: true });
    expect(readState(state).programCounter).toBe(255);
  });
});

describe('loadProgram effect (ISA §1.2 rule 3)', () => {
  it('sets memory to the image at origin, PC to entry, and clears registers and flags', () => {
    const state = createState();
    setRegister(state, 'A', 0x55);
    setFlag(state, 'N', true);
    const result = loadProgram(
      state,
      makeImage({ origin: 10, entry: 10, bytes: new Uint8Array([1, 2, 3]) }),
    );
    expect(result).toMatchObject({ ok: true });
    const copy = readState(state);
    expect(Array.from(copy.memory)).toEqual(
      memoryWith([
        [10, 1],
        [11, 2],
        [12, 3],
      ]),
    );
    expect(copy.registers.map((register) => register.value)).toEqual([0, 0, 10, 0, 0, 0, 0]);
    expect(copy.programCounter).toBe(10);
    expect(copy.flags.map((flag) => flag.value)).toEqual([false, false, false]);
  });

  it('leaves no byte of a long program after a short one is loaded', () => {
    const state = createState();
    loadProgram(state, makeImage({ origin: 0, entry: 0, bytes: new Uint8Array(256).fill(0xaa) }));
    const result = loadProgram(
      state,
      makeImage({ origin: 0, entry: 0, bytes: new Uint8Array([1]) }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(Array.from(readState(state).memory)).toEqual(memoryWith([[0, 1]]));
  });
});

describe('resetState (ISA §1.2 rule 4)', () => {
  it('restores the post-load state after registers, flags and memory were changed', () => {
    const state = createState();
    loadProgram(state, makeImage({ origin: 3, entry: 3, bytes: new Uint8Array([0xaa, 0xbb]) }));
    const postLoad = readState(state);

    setRegister(state, 'A', 0x42);
    setRegister(state, 'PC', 0x20);
    setFlag(state, 'C', true);
    writeByte(state, 3, 0x00);
    writeByte(state, 100, 0x09);
    expect(readState(state)).not.toEqual(postLoad);

    resetState(state);
    expect(readState(state)).toEqual(postLoad);
  });

  it('restores the empty machine when nothing was loaded', () => {
    const state = createState();
    setRegister(state, 'B', 0x33);
    setFlag(state, 'Z', true);
    writeByte(state, 7, 0x44);
    resetState(state);
    const copy = readState(state);
    expect(copy).toEqual(readState(createState()));
    expect(Array.from(copy.memory)).toEqual(memoryWith([]));
    expect(copy.programCounter).toBe(0);
  });
});

describe('readState (ISA §2)', () => {
  it('returns the programCounter, registers in order with bits 8, flags in order, and 256 bytes of memory', () => {
    const state = createState();
    setRegister(state, 'PC', 0x12);
    const copy = readState(state);
    expect(copy.programCounter).toBe(0x12);
    expect(copy.registers.map((register) => register.name)).toEqual([
      'A',
      'B',
      'PC',
      'IR',
      'MAR',
      'MDR',
      'OUT',
    ]);
    expect(copy.registers.map((register) => register.bits)).toEqual([8, 8, 8, 8, 8, 8, 8]);
    expect(copy.registers.find((register) => register.name === 'PC')?.value).toBe(0x12);
    expect(copy.flags.map((flag) => flag.name)).toEqual(['Z', 'N', 'C']);
    expect(copy.memory.length).toBe(256);
  });

  it('matches the REGISTERS and FLAGS definitions of the machine', () => {
    const copy = readState(createState());
    expect(copy.registers.map((register) => register.name)).toEqual(
      REGISTERS.map((definition) => definition.name),
    );
    expect(copy.registers.map((register) => register.bits)).toEqual(
      REGISTERS.map((definition) => definition.bits),
    );
    expect(copy.flags.map((flag) => flag.name)).toEqual(FLAGS.map((definition) => definition.name));
  });

  it('shares no arrays, element objects or buffers between calls, and copies cannot change the state', () => {
    const state = createState();
    writeByte(state, 0, 0x10);
    const first = readState(state);
    const second = readState(state);
    expect(first.memory).not.toBe(second.memory);
    expect(first.memory.buffer).not.toBe(second.memory.buffer);
    expect(first.registers).not.toBe(second.registers);
    expect(first.registers[0]).not.toBe(second.registers[0]);
    expect(first.flags).not.toBe(second.flags);

    first.memory[0] = 0x99;
    expect(readByte(state, 0)).toBe(0x10);
    expect(readState(state).memory[0]).toBe(0x10);
    expect(Object.isFrozen(first.registers)).toBe(true);
    expect(Object.isFrozen(first.flags)).toBe(true);
  });
});

describe('image independence (ISA §1.2 rule 3)', () => {
  it('does not mutate the image and keeps the machine and resetState unaffected by later changes to its bytes', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const image = makeImage({ origin: 0, entry: 0, bytes });
    const state = createState();
    expect(loadProgram(state, image)).toMatchObject({ ok: true });
    expect(Array.from(image.bytes)).toEqual([1, 2, 3]);

    bytes[0] = 0xff;
    expect(readByte(state, 0)).toBe(1);
    setRegister(state, 'A', 0x05);
    writeByte(state, 1, 0x77);
    resetState(state);
    expect(readByte(state, 0)).toBe(1);
    expect(readByte(state, 1)).toBe(2);
    expect(getRegister(state, 'A')).toBe(0);
  });
});

describe('masking (ISA §1, §2)', () => {
  it('setRegister stores the value masked to 8 bits', () => {
    const state = createState();
    const names: readonly RegisterName[] = ['A', 'B'];
    for (const name of names) {
      setRegister(state, name, 256);
      expect(getRegister(state, name)).toBe(0);
      setRegister(state, name, -1);
      expect(getRegister(state, name)).toBe(255);
    }
  });

  it('writeByte masks the address and the value to 8 bits', () => {
    const state = createState();
    writeByte(state, 5, 256);
    expect(readByte(state, 5)).toBe(0);
    writeByte(state, 5, -1);
    expect(readByte(state, 5)).toBe(255);
    writeByte(state, 256, 0x11);
    expect(readByte(state, 0)).toBe(0x11);
    writeByte(state, 257, 0x22);
    expect(readByte(state, 1)).toBe(0x22);
    writeByte(state, -1, 0x33);
    expect(readByte(state, 255)).toBe(0x33);
  });

  it('readByte masks the address to 8 bits', () => {
    const state = createState();
    writeByte(state, 0, 0x11);
    writeByte(state, 1, 0x22);
    writeByte(state, 255, 0x33);
    expect(readByte(state, 256)).toBe(0x11);
    expect(readByte(state, 257)).toBe(0x22);
    expect(readByte(state, -1)).toBe(0x33);
  });

  it('setFlag and getFlag store and return each flag independently', () => {
    const state = createState();
    const names: readonly FlagName[] = ['Z', 'N', 'C'];
    setFlag(state, 'N', true);
    expect(names.map((name) => getFlag(state, name))).toEqual([false, true, false]);
  });

  it('increment8 wraps 255 to 0 and adds one otherwise', () => {
    expect(increment8(255)).toBe(0);
    expect(increment8(7)).toBe(8);
  });
});
