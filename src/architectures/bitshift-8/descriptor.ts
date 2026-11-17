import type { ArchitectureDescriptor } from '../../platform';
import { ISA } from './isa';
import { ADDRESS_BITS, DISPLAY_NAME, FLAGS, MEMORY_BYTES, REGISTERS, WORD_BITS } from './machine';

/** Data-only BITSHIFT-8 architecture descriptor, built from ISA §1 to §3. */
export const DESCRIPTOR: ArchitectureDescriptor = Object.freeze<ArchitectureDescriptor>({
  displayName: DISPLAY_NAME,
  descriptorVersion: '1.0.0',
  wordBits: WORD_BITS,
  addressBits: ADDRESS_BITS,
  memoryBytes: MEMORY_BYTES,
  registers: REGISTERS,
  flags: FLAGS,
  isa: ISA,
});
