import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../../src/platform/snapshots';
import type { Diagnostic } from '../../src/platform/result';
import type { CpuStateCopy, FlagValue, RegisterValue } from '../../src/platform/types';

const MEMORY_BYTES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

interface AlphaDetails {
  phase: number;
  label: string;
}

function makeCopy(): CpuStateCopy {
  return {
    programCounter: 5,
    registers: [
      { name: 'A', bits: 12, value: 0xabc },
      { name: 'PC', bits: 12, value: 5 },
    ],
    flags: [
      { name: 'Z', value: true },
      { name: 'C', value: false },
    ],
    memory: Uint8Array.from(MEMORY_BYTES),
  };
}

function makeDetailedCopy(details: AlphaDetails): CpuStateCopy<AlphaDetails> {
  return { ...makeCopy(), details };
}

const META = {
  architectureId: 'alpha-12',
  cycle: 42,
  state: 'paused',
} as const;

const FAULT: Diagnostic = {
  code: 'PLT-INTERNAL',
  severity: 'error',
  message: 'internal failure',
};

describe('buildSnapshot field values', () => {
  it('takes architectureId, cycle and state from meta and programCounter from the copy', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(snap.architectureId).toBe('alpha-12');
    expect(snap.cycle).toBe(42);
    expect(snap.state).toBe('paused');
    expect(snap.programCounter).toBe(5);
  });

  it('copies register and flag values equal to the inputs', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(snap.registers).toEqual([
      { name: 'A', bits: 12, value: 0xabc },
      { name: 'PC', bits: 12, value: 5 },
    ]);
    expect(snap.flags).toEqual([
      { name: 'Z', value: true },
      { name: 'C', value: false },
    ]);
  });

  it('copies memory with equal bytes in a new buffer', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    expect(Array.from(snap.memory)).toEqual(MEMORY_BYTES);
    expect(snap.memory).not.toBe(copy.memory);
    expect(snap.memory.buffer).not.toBe(copy.memory.buffer);
  });

  it('returns a new snapshot object on each call', () => {
    const copy = makeCopy();
    expect(buildSnapshot(copy, META)).not.toBe(buildSnapshot(copy, META));
  });
});

describe('buildSnapshot freezing', () => {
  it('freezes the snapshot object', () => {
    expect(Object.isFrozen(buildSnapshot(makeCopy(), META))).toBe(true);
  });

  it('freezes the registers array and each register element', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(Object.isFrozen(snap.registers)).toBe(true);
    for (const register of snap.registers) {
      expect(Object.isFrozen(register)).toBe(true);
    }
  });

  it('freezes the flags array and each flag element', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(Object.isFrozen(snap.flags)).toBe(true);
    for (const flag of snap.flags) {
      expect(Object.isFrozen(flag)).toBe(true);
    }
  });

  it('throws when assigning to a frozen snapshot field', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(() => {
      (snap as { cycle: number }).cycle = 1;
    }).toThrow();
    expect(snap.cycle).toBe(42);
  });

  it('throws when assigning to a frozen register element', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(() => {
      (snap.registers[0] as { value: number }).value = 1;
    }).toThrow();
    expect(snap.registers[0]?.value).toBe(0xabc);
  });

  it('throws when pushing onto the frozen registers array', () => {
    const snap = buildSnapshot(makeCopy(), META);
    const extra: RegisterValue = { name: 'X', bits: 12, value: 0 };
    expect(() => {
      (snap.registers as RegisterValue[]).push(extra);
    }).toThrow();
    expect(snap.registers).toHaveLength(2);
  });

  it('throws when pushing onto the frozen flags array', () => {
    const snap = buildSnapshot(makeCopy(), META);
    const extra: FlagValue = { name: 'V', value: false };
    expect(() => {
      (snap.flags as FlagValue[]).push(extra);
    }).toThrow();
    expect(snap.flags).toHaveLength(2);
  });

  it('does not freeze the memory array, which cannot be frozen', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect(Object.isFrozen(snap.memory)).toBe(false);
  });
});

describe('buildSnapshot input isolation', () => {
  it('leaves the input copy, its arrays and elements unfrozen', () => {
    const copy = makeCopy();
    buildSnapshot(copy, META);
    expect(Object.isFrozen(copy)).toBe(false);
    expect(Object.isFrozen(copy.registers)).toBe(false);
    expect(Object.isFrozen(copy.registers[0])).toBe(false);
    expect(Object.isFrozen(copy.flags)).toBe(false);
    expect(Object.isFrozen(copy.flags[0])).toBe(false);
  });

  it('does not change the snapshot when the input register element is mutated', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    (copy.registers[0] as { value: number }).value = 0;
    expect(snap.registers[0]?.value).toBe(0xabc);
    expect(copy.registers[0]?.value).toBe(0);
  });

  it('does not change the snapshot when the input register array is replaced', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    (copy.registers as RegisterValue[])[1] = { name: 'PC', bits: 12, value: 99 };
    expect(snap.registers[1]?.value).toBe(5);
  });

  it('does not change the snapshot when the input flag element is mutated', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    (copy.flags[0] as { value: boolean }).value = false;
    expect(snap.flags[0]?.value).toBe(true);
  });

  it('does not change the snapshot when the input memory is mutated', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    copy.memory[0] = 200;
    expect(snap.memory[0]).toBe(0);
  });

  it('does not change the input when the snapshot memory is mutated', () => {
    const copy = makeCopy();
    const snap = buildSnapshot(copy, META);
    snap.memory[0] = 200;
    expect(copy.memory[0]).toBe(0);
    expect(Array.from(copy.memory)).toEqual(MEMORY_BYTES);
  });
});

describe('buildSnapshot details', () => {
  it('omits the details key when the input copy has no details key', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect('details' in snap).toBe(false);
  });

  it('passes details through by reference', () => {
    const details: AlphaDetails = { phase: 3, label: 'fetch' };
    const snap = buildSnapshot(makeDetailedCopy(details), META);
    expect(snap.details).toBe(details);
    expect(snap.details).toEqual({ phase: 3, label: 'fetch' });
  });

  it('does not freeze the details object', () => {
    const details: AlphaDetails = { phase: 3, label: 'fetch' };
    buildSnapshot(makeDetailedCopy(details), META);
    expect(Object.isFrozen(details)).toBe(false);
  });
});

describe('buildSnapshot lastFault', () => {
  it('omits the lastFault key when meta does not supply one', () => {
    const snap = buildSnapshot(makeCopy(), META);
    expect('lastFault' in snap).toBe(false);
  });

  it('passes a supplied lastFault through as the same object', () => {
    const snap = buildSnapshot(makeCopy(), { ...META, state: 'faulted', lastFault: FAULT });
    expect(snap.lastFault).toBe(FAULT);
    expect(snap.lastFault?.code).toBe('PLT-INTERNAL');
    expect(snap.state).toBe('faulted');
  });
});
