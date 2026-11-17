import { describe, expect, it } from 'vitest';
import { runAlu, zeroNegative } from '../../../src/architectures/bitshift-8/alu';

// Expected values are hand-written from ISA §3, §5 and §10.2 rule 5, not taken from the implementation.

type Row = readonly [number, number, number, boolean];
type BitwiseRow = readonly [number, number, number];

// ISA §3: ADD B, A <- (A + B) mod 256; carry 1 exactly when A + B > 255 (ISA §5 rule 2).
// Columns: a, b, expected result, expected carry.
const ADD_TABLE: readonly Row[] = [
  [0, 0, 0, false],
  [0, 1, 1, false],
  [0, 127, 127, false],
  [0, 128, 128, false],
  [0, 255, 255, false],
  [1, 0, 1, false],
  [1, 1, 2, false],
  [1, 127, 128, false],
  [1, 128, 129, false],
  [1, 255, 0, true],
  [127, 0, 127, false],
  [127, 1, 128, false],
  [127, 127, 254, false],
  [127, 128, 255, false],
  [127, 255, 126, true],
  [128, 0, 128, false],
  [128, 1, 129, false],
  [128, 127, 255, false],
  [128, 128, 0, true],
  [128, 255, 127, true],
  [255, 0, 255, false],
  [255, 1, 0, true],
  [255, 127, 126, true],
  [255, 128, 127, true],
  [255, 255, 254, true],
];

// ISA §3: SUB B, A <- (A - B) mod 256; carry (borrow) 1 exactly when A < B (ISA §5 rule 2).
// Columns: a, b, expected result, expected carry.
const SUB_TABLE: readonly Row[] = [
  [0, 0, 0, false],
  [0, 1, 255, true],
  [0, 127, 129, true],
  [0, 128, 128, true],
  [0, 255, 1, true],
  [1, 0, 1, false],
  [1, 1, 0, false],
  [1, 127, 130, true],
  [1, 128, 129, true],
  [1, 255, 2, true],
  [127, 0, 127, false],
  [127, 1, 126, false],
  [127, 127, 0, false],
  [127, 128, 255, true],
  [127, 255, 128, true],
  [128, 0, 128, false],
  [128, 1, 127, false],
  [128, 127, 1, false],
  [128, 128, 0, false],
  [128, 255, 129, true],
  [255, 0, 255, false],
  [255, 1, 254, false],
  [255, 127, 128, false],
  [255, 128, 127, false],
  [255, 255, 0, false],
];

// ISA §3: INC A, A <- (A + 1) mod 256. Columns: a, expected result.
const INC_TABLE: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [127, 128],
  [128, 129],
  [255, 0],
];

// ISA §3: DEC A, A <- (A - 1) mod 256. Columns: a, expected result.
const DEC_TABLE: readonly (readonly [number, number])[] = [
  [0, 255],
  [1, 0],
  [127, 126],
  [128, 127],
  [255, 254],
];

// ISA §3: NOT A, A <- bitwise complement of A. Columns: a, expected result.
const NOT_TABLE: readonly (readonly [number, number])[] = [
  [0, 255],
  [1, 254],
  [127, 128],
  [128, 127],
  [255, 0],
];

// ISA §3: AND B, A <- A AND B. Columns: a, b, expected result (hex).
const AND_TABLE: readonly BitwiseRow[] = [
  [0x00, 0x00, 0x00],
  [0x00, 0x01, 0x00],
  [0x00, 0x7f, 0x00],
  [0x00, 0x80, 0x00],
  [0x00, 0xff, 0x00],
  [0x01, 0x00, 0x00],
  [0x01, 0x01, 0x01],
  [0x01, 0x7f, 0x01],
  [0x01, 0x80, 0x00],
  [0x01, 0xff, 0x01],
  [0x7f, 0x00, 0x00],
  [0x7f, 0x01, 0x01],
  [0x7f, 0x7f, 0x7f],
  [0x7f, 0x80, 0x00],
  [0x7f, 0xff, 0x7f],
  [0x80, 0x00, 0x00],
  [0x80, 0x01, 0x00],
  [0x80, 0x7f, 0x00],
  [0x80, 0x80, 0x80],
  [0x80, 0xff, 0x80],
  [0xff, 0x00, 0x00],
  [0xff, 0x01, 0x01],
  [0xff, 0x7f, 0x7f],
  [0xff, 0x80, 0x80],
  [0xff, 0xff, 0xff],
];

// ISA §3: OR B, A <- A OR B. Columns: a, b, expected result (hex).
const OR_TABLE: readonly BitwiseRow[] = [
  [0x00, 0x00, 0x00],
  [0x00, 0x01, 0x01],
  [0x00, 0x7f, 0x7f],
  [0x00, 0x80, 0x80],
  [0x00, 0xff, 0xff],
  [0x01, 0x00, 0x01],
  [0x01, 0x01, 0x01],
  [0x01, 0x7f, 0x7f],
  [0x01, 0x80, 0x81],
  [0x01, 0xff, 0xff],
  [0x7f, 0x00, 0x7f],
  [0x7f, 0x01, 0x7f],
  [0x7f, 0x7f, 0x7f],
  [0x7f, 0x80, 0xff],
  [0x7f, 0xff, 0xff],
  [0x80, 0x00, 0x80],
  [0x80, 0x01, 0x81],
  [0x80, 0x7f, 0xff],
  [0x80, 0x80, 0x80],
  [0x80, 0xff, 0xff],
  [0xff, 0x00, 0xff],
  [0xff, 0x01, 0xff],
  [0xff, 0x7f, 0xff],
  [0xff, 0x80, 0xff],
  [0xff, 0xff, 0xff],
];

// ISA §3: XOR B, A <- A XOR B. Columns: a, b, expected result (hex).
const XOR_TABLE: readonly BitwiseRow[] = [
  [0x00, 0x00, 0x00],
  [0x00, 0x01, 0x01],
  [0x00, 0x7f, 0x7f],
  [0x00, 0x80, 0x80],
  [0x00, 0xff, 0xff],
  [0x01, 0x00, 0x01],
  [0x01, 0x01, 0x00],
  [0x01, 0x7f, 0x7e],
  [0x01, 0x80, 0x81],
  [0x01, 0xff, 0xfe],
  [0x7f, 0x00, 0x7f],
  [0x7f, 0x01, 0x7e],
  [0x7f, 0x7f, 0x00],
  [0x7f, 0x80, 0xff],
  [0x7f, 0xff, 0x80],
  [0x80, 0x00, 0x80],
  [0x80, 0x01, 0x81],
  [0x80, 0x7f, 0xff],
  [0x80, 0x80, 0x00],
  [0x80, 0xff, 0x7f],
  [0xff, 0x00, 0xff],
  [0xff, 0x01, 0xfe],
  [0xff, 0x7f, 0x80],
  [0xff, 0x80, 0x7f],
  [0xff, 0xff, 0x00],
];

// ISA §5 rule 1: zero is 1 when the value is 0; negative is bit 7. Columns: value, Z, N.
const ZN_TABLE: readonly (readonly [number, boolean, boolean])[] = [
  [0, true, false],
  [1, false, false],
  [127, false, false],
  [128, false, true],
  [255, false, true],
];

describe('ALU add (ISA §3, §5 rule 2, §10.2 rule 5)', () => {
  ADD_TABLE.forEach(([a, b, result, carry]) => {
    it(`ADD: a=${String(a)}, b=${String(b)} gives result ${String(result)}, carry ${String(carry)}`, () => {
      const out = runAlu('add', a, b);
      expect(out.result).toBe(result);
      expect(out.carry).toBe(carry);
    });
  });
});

describe('ALU sub (ISA §3, §5 rule 2, §10.2 rule 5)', () => {
  SUB_TABLE.forEach(([a, b, result, carry]) => {
    it(`SUB: a=${String(a)}, b=${String(b)} gives result ${String(result)}, borrow ${String(carry)}`, () => {
      const out = runAlu('sub', a, b);
      expect(out.result).toBe(result);
      expect(out.carry).toBe(carry);
    });
  });
});

describe('ISA §5 worked rows', () => {
  it('ISA §5 worked row: A=255, B=1, ADD B gives 0, Z=1 N=0 C=1', () => {
    const out = runAlu('add', 255, 1);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(0);
    expect(flags.zero).toBe(true);
    expect(flags.negative).toBe(false);
    expect(out.carry).toBe(true);
  });

  it('ISA §5 worked row: A=127, B=1, ADD B gives 128, Z=0 N=1 C=0', () => {
    const out = runAlu('add', 127, 1);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(128);
    expect(flags.zero).toBe(false);
    expect(flags.negative).toBe(true);
    expect(out.carry).toBe(false);
  });

  it('ISA §5 worked row: A=0, B=1, SUB B gives 255, Z=0 N=1 C=1', () => {
    const out = runAlu('sub', 0, 1);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(255);
    expect(flags.zero).toBe(false);
    expect(flags.negative).toBe(true);
    expect(out.carry).toBe(true);
  });

  it('ISA §5 worked row: A=128, B=128, SUB B gives 0, Z=1 N=0 C=0', () => {
    const out = runAlu('sub', 128, 128);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(0);
    expect(flags.zero).toBe(true);
    expect(flags.negative).toBe(false);
    expect(out.carry).toBe(false);
  });

  it('ISA §5 worked row: A=1, B=0, SUB B gives 1, Z=0 N=0 C=0', () => {
    const out = runAlu('sub', 1, 0);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(1);
    expect(flags.zero).toBe(false);
    expect(flags.negative).toBe(false);
    expect(out.carry).toBe(false);
  });

  it('ISA §5 worked row: A=255, INC A gives 0, Z=1 N=0, C unchanged (no carry key)', () => {
    const out = runAlu('inc', 255, 0);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(0);
    expect(flags.zero).toBe(true);
    expect(flags.negative).toBe(false);
    expect('carry' in out).toBe(false);
  });

  it('ISA §5 worked row: A=0, DEC A gives 255, Z=0 N=1, C unchanged (no carry key)', () => {
    const out = runAlu('dec', 0, 0);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(255);
    expect(flags.zero).toBe(false);
    expect(flags.negative).toBe(true);
    expect('carry' in out).toBe(false);
  });

  it('ISA §5 worked row: A=0, NOT A gives 255, Z=0 N=1, C unchanged (no carry key)', () => {
    const out = runAlu('not', 0, 0);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(255);
    expect(flags.zero).toBe(false);
    expect(flags.negative).toBe(true);
    expect('carry' in out).toBe(false);
  });

  it('ISA §5 worked row: A=0xF0, B=0x0F, AND B gives 0, Z=1 N=0, C unchanged (no carry key)', () => {
    const out = runAlu('and', 0xf0, 0x0f);
    const flags = zeroNegative(out.result);
    expect(out.result).toBe(0);
    expect(flags.zero).toBe(true);
    expect(flags.negative).toBe(false);
    expect('carry' in out).toBe(false);
  });
});

describe('ALU inc, dec, not (ISA §3)', () => {
  INC_TABLE.forEach(([a, result]) => {
    it(`INC: a=${String(a)} gives ${String(result)}`, () => {
      expect(runAlu('inc', a, 0).result).toBe(result);
    });
  });

  DEC_TABLE.forEach(([a, result]) => {
    it(`DEC: a=${String(a)} gives ${String(result)}`, () => {
      expect(runAlu('dec', a, 0).result).toBe(result);
    });
  });

  NOT_TABLE.forEach(([a, result]) => {
    it(`NOT: a=${String(a)} gives ${String(result)}`, () => {
      expect(runAlu('not', a, 0).result).toBe(result);
    });
  });
});

describe('ALU and, or, xor (ISA §3)', () => {
  AND_TABLE.forEach(([a, b, result]) => {
    it(`AND: a=${String(a)}, b=${String(b)} gives ${String(result)}`, () => {
      expect(runAlu('and', a, b).result).toBe(result);
    });
  });

  OR_TABLE.forEach(([a, b, result]) => {
    it(`OR: a=${String(a)}, b=${String(b)} gives ${String(result)}`, () => {
      expect(runAlu('or', a, b).result).toBe(result);
    });
  });

  XOR_TABLE.forEach(([a, b, result]) => {
    it(`XOR: a=${String(a)}, b=${String(b)} gives ${String(result)}`, () => {
      expect(runAlu('xor', a, b).result).toBe(result);
    });
  });
});

describe('ALU carry key presence (ISA §5 rule 3, §10.2 rule 5)', () => {
  it('ADD and SUB results have a carry key', () => {
    expect('carry' in runAlu('add', 1, 2)).toBe(true);
    expect('carry' in runAlu('sub', 1, 2)).toBe(true);
  });

  it('INC, DEC, AND, OR, XOR, NOT results have no carry key at all', () => {
    expect(Object.keys(runAlu('inc', 1, 0)).sort()).toEqual(['result', 'right']);
    expect(Object.keys(runAlu('dec', 1, 0)).sort()).toEqual(['result', 'right']);
    expect(Object.keys(runAlu('and', 1, 2)).sort()).toEqual(['result', 'right']);
    expect(Object.keys(runAlu('or', 1, 2)).sort()).toEqual(['result', 'right']);
    expect(Object.keys(runAlu('xor', 1, 2)).sort()).toEqual(['result', 'right']);
    expect(Object.keys(runAlu('not', 1, 0)).sort()).toEqual(['result', 'right']);
  });

  it('ADD and SUB results have a carry key of boolean type', () => {
    expect(typeof runAlu('add', 255, 255).carry).toBe('boolean');
    expect(typeof runAlu('sub', 0, 255).carry).toBe('boolean');
  });
});

describe('ALU right operand (ISA §10.2 rule 5)', () => {
  // Operands a=12 (0x0c), b=53 (0x35) for every operation.
  it('add reports right = 53', () => {
    expect(runAlu('add', 12, 53).right).toBe(53);
  });

  it('sub reports right = 53', () => {
    expect(runAlu('sub', 12, 53).right).toBe(53);
  });

  it('inc reports right = 1', () => {
    expect(runAlu('inc', 12, 53).right).toBe(1);
  });

  it('dec reports right = 1', () => {
    expect(runAlu('dec', 12, 53).right).toBe(1);
  });

  it('and reports right = 53', () => {
    expect(runAlu('and', 12, 53).right).toBe(53);
  });

  it('or reports right = 53', () => {
    expect(runAlu('or', 12, 53).right).toBe(53);
  });

  it('xor reports right = 53', () => {
    expect(runAlu('xor', 12, 53).right).toBe(53);
  });

  it('not reports right = 0', () => {
    expect(runAlu('not', 12, 53).right).toBe(0);
  });
});

describe('zeroNegative (ISA §5 rule 1)', () => {
  ZN_TABLE.forEach(([value, zero, negative]) => {
    it(`value ${String(value)}: zero ${String(zero)}, negative ${String(negative)}`, () => {
      const flags = zeroNegative(value);
      expect(flags.zero).toBe(zero);
      expect(flags.negative).toBe(negative);
    });
  });
});

describe('ALU results are 8-bit integers and functions are pure', () => {
  const ALL_OPERATIONS = ['add', 'sub', 'inc', 'dec', 'and', 'or', 'xor', 'not'] as const;

  it('every result for the 25-pair operand table is an integer from 0 to 255', () => {
    ADD_TABLE.forEach(([a, b]) => {
      const result = runAlu('add', a, b).result;
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(255);
    });
    SUB_TABLE.forEach(([a, b]) => {
      const result = runAlu('sub', a, b).result;
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(255);
    });
    AND_TABLE.forEach(([a, b]) => {
      const result = runAlu('and', a, b).result;
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(255);
    });
  });

  it('every operation returns an integer from 0 to 255 for the boundary operands 0 and 255', () => {
    ALL_OPERATIONS.forEach((operation) => {
      [0, 255].forEach((a) => {
        [0, 255].forEach((b) => {
          const result = runAlu(operation, a, b).result;
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(255);
        });
      });
    });
  });

  it('runAlu is pure: the same inputs give equal outputs on repeated calls', () => {
    ALL_OPERATIONS.forEach((operation) => {
      const first = runAlu(operation, 200, 100);
      const second = runAlu(operation, 200, 100);
      expect(second).toEqual(first);
    });
  });

  it('zeroNegative is pure: the same input gives equal outputs on repeated calls', () => {
    expect(zeroNegative(128)).toEqual(zeroNegative(128));
    expect(zeroNegative(0)).toEqual(zeroNegative(0));
  });
});
