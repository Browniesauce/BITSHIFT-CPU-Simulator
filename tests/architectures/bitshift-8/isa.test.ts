import { describe, expect, it } from 'vitest';
import { INSTRUCTIONS, ISA, displayName } from '../../../src/architectures/bitshift-8/isa';
import type { InstructionDefinition } from '../../../src/platform';

// Expected values are hand-written from the ISA §3 table and rules, not taken from the implementation.

interface ExpectedRow {
  readonly opcode: number;
  readonly mnemonic: string;
  readonly variant?: string;
  readonly length: 1 | 2 | 3;
  readonly operand: 'none' | 'immediate' | 'address' | 'register';
}

const EXPECTED_ROWS: readonly ExpectedRow[] = [
  { opcode: 0x01, mnemonic: 'NOP', length: 1, operand: 'none' },
  { opcode: 0x10, mnemonic: 'LDI', variant: 'A', length: 2, operand: 'immediate' },
  { opcode: 0x11, mnemonic: 'LDI', variant: 'B', length: 2, operand: 'immediate' },
  { opcode: 0x12, mnemonic: 'MOV', variant: 'A,B', length: 1, operand: 'none' },
  { opcode: 0x13, mnemonic: 'MOV', variant: 'B,A', length: 1, operand: 'none' },
  { opcode: 0x20, mnemonic: 'ADD', variant: 'B', length: 1, operand: 'none' },
  { opcode: 0x21, mnemonic: 'SUB', variant: 'B', length: 1, operand: 'none' },
  { opcode: 0x22, mnemonic: 'INC', variant: 'A', length: 1, operand: 'none' },
  { opcode: 0x23, mnemonic: 'DEC', variant: 'A', length: 1, operand: 'none' },
  { opcode: 0x24, mnemonic: 'AND', variant: 'B', length: 1, operand: 'none' },
  { opcode: 0x25, mnemonic: 'OR', variant: 'B', length: 1, operand: 'none' },
  { opcode: 0x26, mnemonic: 'XOR', variant: 'B', length: 1, operand: 'none' },
  { opcode: 0x27, mnemonic: 'NOT', variant: 'A', length: 1, operand: 'none' },
  { opcode: 0x30, mnemonic: 'LDA', length: 2, operand: 'address' },
  { opcode: 0x31, mnemonic: 'STA', length: 2, operand: 'address' },
  { opcode: 0x40, mnemonic: 'JMP', length: 2, operand: 'address' },
  { opcode: 0x41, mnemonic: 'JZ', length: 2, operand: 'address' },
  { opcode: 0x42, mnemonic: 'JNZ', length: 2, operand: 'address' },
  { opcode: 0x43, mnemonic: 'JC', length: 2, operand: 'address' },
  { opcode: 0x44, mnemonic: 'JN', length: 2, operand: 'address' },
  { opcode: 0x50, mnemonic: 'OUT', length: 1, operand: 'none' },
  { opcode: 0xff, mnemonic: 'HLT', length: 1, operand: 'none' },
];

const EXPECTED_DISPLAY_NAMES: readonly string[] = [
  'NOP',
  'LDI A',
  'LDI B',
  'MOV A,B',
  'MOV B,A',
  'ADD B',
  'SUB B',
  'INC A',
  'DEC A',
  'AND B',
  'OR B',
  'XOR B',
  'NOT A',
  'LDA',
  'STA',
  'JMP',
  'JZ',
  'JNZ',
  'JC',
  'JN',
  'OUT',
  'HLT',
];

/** Hand-written opcode-to-display-name pairs for the ten named opcodes (ISA §3). */
const EXPECTED_NAMED_OPCODES: readonly (readonly [number, string])[] = [
  [0x10, 'LDI A'],
  [0x11, 'LDI B'],
  [0x20, 'ADD B'],
  [0x21, 'SUB B'],
  [0x30, 'LDA'],
  [0x31, 'STA'],
  [0x40, 'JMP'],
  [0x41, 'JZ'],
  [0x50, 'OUT'],
  [0xff, 'HLT'],
];

function rowByOpcode(opcode: number): InstructionDefinition {
  const found = INSTRUCTIONS.find((row) => row.opcode === opcode);
  if (found === undefined) throw new Error(`No row with opcode ${opcode}`);
  return found;
}

describe('BITSHIFT-8 instruction table (ISA §3)', () => {
  it('has exactly 22 rows', () => {
    expect(INSTRUCTIONS).toHaveLength(22);
  });

  it('matches the 22 rows of the ISA §3 table row for row', () => {
    expect(INSTRUCTIONS.length).toBe(EXPECTED_ROWS.length);
    EXPECTED_ROWS.forEach((expected, index) => {
      const actual = INSTRUCTIONS[index];
      expect(actual).toBeDefined();
      if (actual === undefined) return;
      expect(actual.opcode).toBe(expected.opcode);
      expect(actual.mnemonic).toBe(expected.mnemonic);
      expect(actual.length).toBe(expected.length);
      expect(actual.operand).toBe(expected.operand);
      if (expected.variant === undefined) {
        expect('variant' in actual).toBe(false);
      } else {
        expect(actual.variant).toBe(expected.variant);
      }
    });
  });

  it('has no variant key on rows whose variant column is empty (ISA §3 rule 2)', () => {
    const withoutVariant = EXPECTED_ROWS.filter((row) => row.variant === undefined);
    expect(withoutVariant).toHaveLength(10);
    for (const expected of withoutVariant) {
      expect('variant' in rowByOpcode(expected.opcode)).toBe(false);
    }
  });

  it('has unique opcodes and unique (mnemonic, variant) pairs', () => {
    const opcodes = INSTRUCTIONS.map((row) => row.opcode);
    expect(new Set(opcodes).size).toBe(22);

    const pairs = INSTRUCTIONS.map((row) => `${row.mnemonic}|${row.variant ?? ''}`);
    expect(new Set(pairs).size).toBe(22);
  });

  it('has exactly 20 distinct mnemonics', () => {
    const mnemonics = INSTRUCTIONS.map((row) => row.mnemonic);
    expect(new Set(mnemonics).size).toBe(20);
  });

  it('gives the named opcodes the expected display names (ISA §3)', () => {
    for (const [opcode, name] of EXPECTED_NAMED_OPCODES) {
      expect(displayName(rowByOpcode(opcode))).toBe(name);
    }
  });

  it('is frozen, and so is each row', () => {
    expect(Object.isFrozen(INSTRUCTIONS)).toBe(true);
    for (const row of INSTRUCTIONS) {
      expect(Object.isFrozen(row)).toBe(true);
    }
  });
});

describe('BITSHIFT-8 display names (ISA §3 rule 3)', () => {
  it('gives the 22 expected display names in table order', () => {
    expect(INSTRUCTIONS.map((row) => displayName(row))).toEqual(EXPECTED_DISPLAY_NAMES);
  });
});

describe('BITSHIFT-8 ISA descriptor (ISA §3)', () => {
  it('has the architecture identifier bitshift-8', () => {
    expect(ISA.architectureId).toBe('bitshift-8');
  });

  it('lists the same instructions as the instruction table, in the same order', () => {
    expect(ISA.instructions).toBe(INSTRUCTIONS);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ISA)).toBe(true);
  });
});
