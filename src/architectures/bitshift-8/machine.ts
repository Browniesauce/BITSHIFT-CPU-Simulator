import type { FlagDefinition, RegisterDefinition } from '../../platform';

/** Stable architecture identifier for BITSHIFT-8 (ISA §1). */
export const ARCHITECTURE_ID = 'bitshift-8';

/** Human-readable name of the BITSHIFT-8 architecture (ISA §1). */
export const DISPLAY_NAME = 'BITSHIFT-8';

/** Width of a data word in bits (ISA §1). */
export const WORD_BITS = 8;

/** Width of a memory address in bits (ISA §1). */
export const ADDRESS_BITS = 8;

/** Size of the byte-addressed memory in bytes (ISA §1). */
export const MEMORY_BYTES = 256;

/** Names of the BITSHIFT-8 registers (ISA §2). */
export type RegisterName = 'A' | 'B' | 'PC' | 'IR' | 'MAR' | 'MDR' | 'OUT';

/** Names of the BITSHIFT-8 condition flags (ISA §2.1). */
export type FlagName = 'Z' | 'N' | 'C';

/** Register definitions for BITSHIFT-8, in ISA §2 order. */
export const REGISTERS: readonly RegisterDefinition[] = Object.freeze<RegisterDefinition[]>([
  Object.freeze<RegisterDefinition>({
    name: 'A',
    bits: 8,
    role: 'general',
    programmerVisible: true,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'B',
    bits: 8,
    role: 'general',
    programmerVisible: true,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'PC',
    bits: 8,
    role: 'program-counter',
    programmerVisible: true,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'IR',
    bits: 8,
    role: 'instruction',
    programmerVisible: false,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'MAR',
    bits: 8,
    role: 'memory-interface',
    programmerVisible: false,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'MDR',
    bits: 8,
    role: 'memory-interface',
    programmerVisible: false,
  }),
  Object.freeze<RegisterDefinition>({
    name: 'OUT',
    bits: 8,
    role: 'output',
    programmerVisible: true,
  }),
]);

/** Flag definitions for BITSHIFT-8, in the order Z, N, C (ISA §2.1). */
export const FLAGS: readonly FlagDefinition[] = Object.freeze<FlagDefinition[]>([
  Object.freeze<FlagDefinition>({
    name: 'Z',
    description: 'Zero: the last value written to A was 0',
  }),
  Object.freeze<FlagDefinition>({
    name: 'N',
    description: 'Negative: bit 7 of the last value written to A',
  }),
  Object.freeze<FlagDefinition>({
    name: 'C',
    description: 'Carry: carry of the last ADD, or borrow of the last SUB',
  }),
]);
