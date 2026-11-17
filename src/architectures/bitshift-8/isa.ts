import type { InstructionDefinition, IsaDescriptor } from '../../platform';
import { ARCHITECTURE_ID } from './machine';

/** The 22 instruction encodings of BITSHIFT-8, in the order of ISA §3. */
export const INSTRUCTIONS: readonly InstructionDefinition[] = Object.freeze<
  InstructionDefinition[]
>([
  Object.freeze<InstructionDefinition>({
    opcode: 0x01,
    mnemonic: 'NOP',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x10,
    mnemonic: 'LDI',
    variant: 'A',
    length: 2,
    operand: 'immediate',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x11,
    mnemonic: 'LDI',
    variant: 'B',
    length: 2,
    operand: 'immediate',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x12,
    mnemonic: 'MOV',
    variant: 'A,B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x13,
    mnemonic: 'MOV',
    variant: 'B,A',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x20,
    mnemonic: 'ADD',
    variant: 'B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x21,
    mnemonic: 'SUB',
    variant: 'B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x22,
    mnemonic: 'INC',
    variant: 'A',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x23,
    mnemonic: 'DEC',
    variant: 'A',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x24,
    mnemonic: 'AND',
    variant: 'B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x25,
    mnemonic: 'OR',
    variant: 'B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x26,
    mnemonic: 'XOR',
    variant: 'B',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x27,
    mnemonic: 'NOT',
    variant: 'A',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x30,
    mnemonic: 'LDA',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x31,
    mnemonic: 'STA',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x40,
    mnemonic: 'JMP',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x41,
    mnemonic: 'JZ',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x42,
    mnemonic: 'JNZ',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x43,
    mnemonic: 'JC',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x44,
    mnemonic: 'JN',
    length: 2,
    operand: 'address',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0x50,
    mnemonic: 'OUT',
    length: 1,
    operand: 'none',
  }),
  Object.freeze<InstructionDefinition>({
    opcode: 0xff,
    mnemonic: 'HLT',
    length: 1,
    operand: 'none',
  }),
]);

/** BITSHIFT-8 instruction set descriptor, keyed by ARCHITECTURE_ID (ISA §3). */
export const ISA: IsaDescriptor = Object.freeze<IsaDescriptor>({
  architectureId: ARCHITECTURE_ID,
  instructions: INSTRUCTIONS,
});

/** The display name of an instruction: the mnemonic, then the variant if there is one (ISA §3 rule 3). */
export function displayName(instruction: InstructionDefinition): string {
  return instruction.variant === undefined
    ? instruction.mnemonic
    : `${instruction.mnemonic} ${instruction.variant}`;
}
