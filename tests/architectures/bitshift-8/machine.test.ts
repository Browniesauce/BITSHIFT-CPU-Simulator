import { describe, expect, it } from 'vitest';
import * as machine from '../../../src/architectures/bitshift-8/machine';
import type { FlagDefinition, RegisterDefinition } from '../../../src/platform';

// Expected values are hand-written from ISA §2 and §2.1, not taken from the implementation.

const EXPECTED_REGISTERS: readonly RegisterDefinition[] = [
  { name: 'A', bits: 8, role: 'general', programmerVisible: true },
  { name: 'B', bits: 8, role: 'general', programmerVisible: true },
  { name: 'PC', bits: 8, role: 'program-counter', programmerVisible: true },
  { name: 'IR', bits: 8, role: 'instruction', programmerVisible: false },
  { name: 'MAR', bits: 8, role: 'memory-interface', programmerVisible: false },
  { name: 'MDR', bits: 8, role: 'memory-interface', programmerVisible: false },
  { name: 'OUT', bits: 8, role: 'output', programmerVisible: true },
];

const EXPECTED_FLAGS: readonly FlagDefinition[] = [
  { name: 'Z', description: 'Zero: the last value written to A was 0' },
  { name: 'N', description: 'Negative: bit 7 of the last value written to A' },
  { name: 'C', description: 'Carry: carry of the last ADD, or borrow of the last SUB' },
];

describe('BITSHIFT-8 machine constants (ISA §2)', () => {
  it('has the expected architecture identifier, display name, widths and memory size', () => {
    expect(machine.ARCHITECTURE_ID).toBe('bitshift-8');
    expect(machine.DISPLAY_NAME).toBe('BITSHIFT-8');
    expect(machine.WORD_BITS).toBe(8);
    expect(machine.ADDRESS_BITS).toBe(8);
    expect(machine.MEMORY_BYTES).toBe(256);
  });
});

describe('BITSHIFT-8 register table (ISA §2)', () => {
  it('has exactly seven registers with the expected name, bits, role and visibility, in order', () => {
    expect(machine.REGISTERS).toHaveLength(7);
    expect(machine.REGISTERS).toEqual(EXPECTED_REGISTERS);
  });

  it('gives each register the expected name in order', () => {
    expect(machine.REGISTERS.map((register) => register.name)).toEqual([
      'A',
      'B',
      'PC',
      'IR',
      'MAR',
      'MDR',
      'OUT',
    ]);
  });
});

describe('BITSHIFT-8 flag table (ISA §2.1)', () => {
  it('has exactly three flags Z, N, C with the specified descriptions', () => {
    expect(machine.FLAGS).toHaveLength(3);
    expect(machine.FLAGS).toEqual(EXPECTED_FLAGS);
  });
});

describe('BITSHIFT-8 table immutability (ISA §2, §2.1)', () => {
  it('freezes REGISTERS and each register definition', () => {
    expect(Object.isFrozen(machine.REGISTERS)).toBe(true);
    for (const register of machine.REGISTERS) {
      expect(Object.isFrozen(register)).toBe(true);
    }
  });

  it('freezes FLAGS and each flag definition', () => {
    expect(Object.isFrozen(machine.FLAGS)).toBe(true);
    for (const flag of machine.FLAGS) {
      expect(Object.isFrozen(flag)).toBe(true);
    }
  });
});

describe('BITSHIFT-8 machine module exports (ISA §2)', () => {
  it('exports data and types only, with no exported function', () => {
    const exported = Object.entries(machine);
    expect(exported.length).toBeGreaterThan(0);
    for (const [name, value] of exported) {
      expect(typeof value, `export ${name} must not be a function`).not.toBe('function');
    }
  });
});
