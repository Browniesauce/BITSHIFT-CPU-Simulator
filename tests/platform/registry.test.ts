import { describe, expect, it } from 'vitest';
import { createArchitectureRegistry } from '../../src/platform';
import type { ArchitectureDescriptor, CpuArchitecture } from '../../src/platform';
import { makeArchitecture, makeDescriptor, withInstructions } from './helpers/descriptors';

const alpha = (): CpuArchitecture => makeArchitecture(makeDescriptor('alpha-12'));
const beta = (): CpuArchitecture =>
  makeArchitecture(makeDescriptor('beta', { wordBits: 16, addressBits: 12, memoryBytes: 4096 }));

function expectInvalid(descriptor: ArchitectureDescriptor): void {
  const result = createArchitectureRegistry([makeArchitecture(descriptor)]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('ARCH-INVALID-DESCRIPTOR');
    expect(result.error.severity).toBe('error');
  }
}

function expectValid(descriptor: ArchitectureDescriptor): void {
  expect(createArchitectureRegistry([makeArchitecture(descriptor)]).ok).toBe(true);
}

describe('createArchitectureRegistry', () => {
  it('registers a single architecture and looks it up', () => {
    const a = alpha();
    const result = createArchitectureRegistry([a]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const found = result.value.lookup('alpha-12');
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.value).toBe(a);
      expect(found.value.descriptor.isa.architectureId).toBe('alpha-12');
    }
  });

  it('registers two architectures with different widths and looks up each', () => {
    const a = alpha();
    const b = beta();
    const result = createArchitectureRegistry([a, b]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foundA = result.value.lookup('alpha-12');
    const foundB = result.value.lookup('beta');
    expect(foundA.ok && foundA.value).toBe(a);
    expect(foundB.ok && foundB.value).toBe(b);
  });

  it('accepts an empty list (reading: the contract does not forbid it)', () => {
    const result = createArchitectureRegistry([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.architectures).toEqual([]);
    const missing = result.value.lookup('alpha-12');
    expect(!missing.ok && missing.error.code).toBe('ARCH-UNKNOWN-ID');
  });

  it('preserves registration order', () => {
    const a = alpha();
    const b = beta();
    const forward = createArchitectureRegistry([a, b]);
    const backward = createArchitectureRegistry([b, a]);
    if (!forward.ok || !backward.ok) throw new Error('expected valid registries');
    expect(forward.value.architectures[0]).toBe(a);
    expect(forward.value.architectures[1]).toBe(b);
    expect(backward.value.architectures[0]).toBe(b);
    expect(backward.value.architectures[1]).toBe(a);
  });

  it('exposes a frozen list that is a copy of the input', () => {
    const a = alpha();
    const input = [a];
    const result = createArchitectureRegistry(input);
    if (!result.ok) throw new Error('expected a valid registry');
    expect(Object.isFrozen(result.value.architectures)).toBe(true);
    expect(result.value.architectures).not.toBe(input);
    input.push(beta());
    expect(result.value.architectures).toHaveLength(1);
    expect(result.value.lookup('beta').ok).toBe(false);
  });

  it('does not mutate or freeze its inputs', () => {
    const a = alpha();
    const before = structuredClone(a.descriptor);
    createArchitectureRegistry([a]);
    expect(a.descriptor).toEqual(before);
    expect(Object.isFrozen(a)).toBe(false);
    expect(Object.isFrozen(a.descriptor)).toBe(false);
    expect(Object.isFrozen(a.descriptor.registers)).toBe(false);
  });

  it('never calls createInstance', () => {
    let calls = 0;
    const spy: CpuArchitecture = {
      ...alpha(),
      createInstance() {
        calls += 1;
        throw new Error('must not be called');
      },
    };
    const result = createArchitectureRegistry([spy]);
    if (result.ok) result.value.lookup('alpha-12');
    expect(calls).toBe(0);
  });

  it('returns ARCH-DUPLICATE-ID when two entries share an identifier', () => {
    const result = createArchitectureRegistry([alpha(), beta(), alpha()]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ARCH-DUPLICATE-ID');
      expect(result.error.severity).toBe('error');
    }
  });

  it('returns ARCH-UNKNOWN-ID from lookup of an unregistered id', () => {
    const result = createArchitectureRegistry([alpha()]);
    if (!result.ok) throw new Error('expected a valid registry');
    const missing = result.value.lookup('gamma');
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe('ARCH-UNKNOWN-ID');
      expect(missing.error.severity).toBe('error');
    }
  });
});

describe('descriptor validation (DATA_CONTRACTS 3.2)', () => {
  it.each(['Alpha', 'alpha_1', 'alpha--1', '-alpha', 'alpha-', '', 'al pha'])(
    'rejects architecture identifier %j',
    (id) => {
      expectInvalid(makeDescriptor(id));
    },
  );

  it.each(['a', 'alpha-12', '8-bit', 'x1-y2-z3'])('accepts architecture identifier %j', (id) => {
    expectValid(makeDescriptor(id));
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects wordBits %j', (wordBits) => {
    expectInvalid(makeDescriptor('t', { wordBits }));
  });

  it.each([0, -1, 2.5, Number.NaN])('rejects addressBits %j', (addressBits) => {
    expectInvalid(makeDescriptor('t', { addressBits }));
  });

  it.each([0, -1, 10.5, Number.NaN])('rejects memoryBytes %j', (memoryBytes) => {
    expectInvalid(makeDescriptor('t', { memoryBytes }));
  });

  it('rejects memoryBytes above 2^addressBits', () => {
    expectInvalid(makeDescriptor('t', { addressBits: 10, memoryBytes: 1025 }));
  });

  it('accepts memoryBytes exactly 2^addressBits', () => {
    expectValid(makeDescriptor('t', { addressBits: 10, memoryBytes: 1024 }));
  });

  it('rejects duplicate register names', () => {
    expectInvalid(
      makeDescriptor('t', {
        registers: [
          { name: 'R0', bits: 12, role: 'general', programmerVisible: true },
          { name: 'R0', bits: 12, role: 'general', programmerVisible: false },
        ],
      }),
    );
  });

  it('rejects duplicate flag names', () => {
    expectInvalid(
      makeDescriptor('t', {
        flags: [
          { name: 'F0', description: 'one' },
          { name: 'F0', description: 'two' },
        ],
      }),
    );
  });

  it('rejects a duplicate (mnemonic, variant) pair', () => {
    expectInvalid(
      withInstructions('t', [
        { mnemonic: 'ADD', variant: 'imm', opcode: 1, length: 2, operand: 'immediate' },
        { mnemonic: 'ADD', variant: 'imm', opcode: 2, length: 2, operand: 'immediate' },
      ]),
    );
  });

  it('rejects the same mnemonic twice without a variant', () => {
    expectInvalid(
      withInstructions('t', [
        { mnemonic: 'ADD', opcode: 1, length: 1, operand: 'none' },
        { mnemonic: 'ADD', opcode: 2, length: 1, operand: 'none' },
      ]),
    );
  });

  it('accepts the same mnemonic with different variants', () => {
    expectValid(
      withInstructions('t', [
        { mnemonic: 'ADD', variant: 'imm', opcode: 1, length: 2, operand: 'immediate' },
        { mnemonic: 'ADD', variant: 'reg', opcode: 2, length: 1, operand: 'register' },
        { mnemonic: 'ADD', opcode: 3, length: 1, operand: 'none' },
      ]),
    );
  });

  it('rejects duplicate opcodes', () => {
    expectInvalid(
      withInstructions('t', [
        { mnemonic: 'A', opcode: 5, length: 1, operand: 'none' },
        { mnemonic: 'B', opcode: 5, length: 1, operand: 'none' },
      ]),
    );
  });

  it.each([-1, 1.5, Number.NaN])('rejects opcode %j', (opcode) => {
    expectInvalid(withInstructions('t', [{ mnemonic: 'A', opcode, length: 1, operand: 'none' }]));
  });

  it('rejects opcode exactly 2^wordBits', () => {
    expectInvalid(
      withInstructions('t', [{ mnemonic: 'A', opcode: 4096, length: 1, operand: 'none' }]),
    );
  });

  it('accepts opcodes 0 and 2^wordBits - 1', () => {
    expectValid(
      withInstructions('t', [
        { mnemonic: 'A', opcode: 0, length: 1, operand: 'none' },
        { mnemonic: 'B', opcode: 4095, length: 1, operand: 'none' },
      ]),
    );
  });

  it('returns the validation error rather than a registry when one entry is invalid', () => {
    const bad = makeArchitecture(makeDescriptor('bad', { wordBits: 0 }));
    const result = createArchitectureRegistry([alpha(), bad]);
    expect(!result.ok && result.error.code).toBe('ARCH-INVALID-DESCRIPTOR');
  });
});
