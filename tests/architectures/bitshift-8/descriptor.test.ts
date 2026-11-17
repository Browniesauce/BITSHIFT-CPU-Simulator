import { describe, expect, it } from 'vitest';
import { DESCRIPTOR } from '../../../src/architectures/bitshift-8/descriptor';
import { ISA } from '../../../src/architectures/bitshift-8/isa';
import type { CpuArchitecture } from '../../../src/platform';
import { createArchitectureRegistry } from '../../../src/platform';

// Expected values are hand-written from ISA §1 to §3, not taken from the implementation.

const EXPECTED_DESCRIPTOR_KEYS: readonly string[] = [
  'addressBits',
  'descriptorVersion',
  'displayName',
  'flags',
  'isa',
  'memoryBytes',
  'registers',
  'wordBits',
];

const EXPECTED_REGISTERS = [
  { name: 'A', bits: 8, role: 'general', programmerVisible: true },
  { name: 'B', bits: 8, role: 'general', programmerVisible: true },
  { name: 'PC', bits: 8, role: 'program-counter', programmerVisible: true },
  { name: 'IR', bits: 8, role: 'instruction', programmerVisible: false },
  { name: 'MAR', bits: 8, role: 'memory-interface', programmerVisible: false },
  { name: 'MDR', bits: 8, role: 'memory-interface', programmerVisible: false },
  { name: 'OUT', bits: 8, role: 'output', programmerVisible: true },
];

const EXPECTED_FLAGS = [
  { name: 'Z', description: 'Zero: the last value written to A was 0' },
  { name: 'N', description: 'Negative: bit 7 of the last value written to A' },
  { name: 'C', description: 'Carry: carry of the last ADD, or borrow of the last SUB' },
];

const stub: CpuArchitecture = {
  descriptor: DESCRIPTOR,
  createInstance() {
    throw new Error('createInstance must not be called by the registry');
  },
  visualization: {
    toDatapath: (snapshot) => ({
      architectureId: snapshot.architectureId,
      components: [],
      buses: [],
      activeControlSignals: [],
    }),
  },
};

describe('BITSHIFT-8 architecture descriptor (ISA §1 to §3)', () => {
  it('has exactly the eight fields of ArchitectureDescriptor', () => {
    expect(Object.keys(DESCRIPTOR).sort()).toEqual([...EXPECTED_DESCRIPTOR_KEYS].sort());
  });

  it('has the expected display name, descriptor version and widths (ISA §1)', () => {
    expect(DESCRIPTOR.displayName).toBe('BITSHIFT-8');
    expect(DESCRIPTOR.descriptorVersion).toBe('1.0.0');
    expect(DESCRIPTOR.wordBits).toBe(8);
    expect(DESCRIPTOR.addressBits).toBe(8);
    expect(DESCRIPTOR.memoryBytes).toBe(256);
  });

  it('lists the seven registers in ISA §2 order', () => {
    expect(DESCRIPTOR.registers).toEqual(EXPECTED_REGISTERS);
  });

  it('lists the three flags Z, N, C in ISA §2.1 order', () => {
    expect(DESCRIPTOR.flags).toEqual(EXPECTED_FLAGS);
  });

  it('uses the same ISA object as its isa field', () => {
    expect(DESCRIPTOR.isa).toBe(ISA);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DESCRIPTOR)).toBe(true);
  });
});

describe('BITSHIFT-8 registration (platform registry)', () => {
  it('is accepted by createArchitectureRegistry', () => {
    const result = createArchitectureRegistry([stub]);
    expect(result.ok).toBe(true);
  });

  it('is found by lookup under bitshift-8, returning the same architecture object', () => {
    const result = createArchitectureRegistry([stub]);
    if (!result.ok) throw new Error(`registry rejected the architecture: ${result.error.code}`);
    const found = result.value.lookup('bitshift-8');
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).toBe(stub);
  });

  it('reports ARCH-UNKNOWN-ID for an identifier that is not registered', () => {
    const result = createArchitectureRegistry([stub]);
    if (!result.ok) throw new Error(`registry rejected the architecture: ${result.error.code}`);
    const missing = result.value.lookup('bitshift-16');
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('ARCH-UNKNOWN-ID');
  });
});
