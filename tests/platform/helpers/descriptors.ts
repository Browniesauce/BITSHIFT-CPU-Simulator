import type {
  ArchitectureDescriptor,
  CpuArchitecture,
  InstructionDefinition,
} from '../../../src/platform';

/** A valid descriptor that is deliberately not BITSHIFT-8: 12-bit words, 10-bit addresses. */
export function makeDescriptor(
  id: string,
  overrides: Partial<ArchitectureDescriptor> = {},
): ArchitectureDescriptor {
  return {
    displayName: `Test ${id}`,
    descriptorVersion: '0.0.1',
    wordBits: 12,
    addressBits: 10,
    memoryBytes: 1000,
    registers: [
      { name: 'R0', bits: 12, role: 'general', programmerVisible: true },
      { name: 'P', bits: 10, role: 'program-counter', programmerVisible: true },
    ],
    flags: [{ name: 'F0', description: 'first flag' }],
    isa: {
      architectureId: id,
      instructions: [
        { mnemonic: 'NOP', opcode: 0, length: 1, operand: 'none' },
        { mnemonic: 'JMP', opcode: 1, length: 2, operand: 'address' },
      ],
    },
    ...overrides,
  };
}

/** Replaces the instruction list of a valid descriptor. */
export function withInstructions(
  id: string,
  instructions: readonly InstructionDefinition[],
): ArchitectureDescriptor {
  return makeDescriptor(id, { isa: { architectureId: id, instructions } });
}

/** A stub architecture. createInstance throws, so any call by the registry fails loudly. */
export function makeArchitecture(descriptor: ArchitectureDescriptor): CpuArchitecture {
  return {
    descriptor,
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
}
