import type {
  CpuStateCopy,
  Diagnostic,
  FlagValue,
  ProgramImage,
  RegisterValue,
  Result,
} from '../../platform';
import { err, ok } from '../../platform';
import type { FlagName, RegisterName } from './machine';
import { ARCHITECTURE_ID, MEMORY_BYTES } from './machine';

/** Register names in the ISA §2 order used by state copies. */
const REGISTER_ORDER: readonly RegisterName[] = ['A', 'B', 'PC', 'IR', 'MAR', 'MDR', 'OUT'];

/** Flag names in the ISA §2.1 order used by state copies. */
const FLAG_ORDER: readonly FlagName[] = ['Z', 'N', 'C'];

/** Every BITSHIFT-8 register is 8 bits wide (ISA §2). */
const REGISTER_BITS = 8;

/** Mask that keeps the low 8 bits of a value (ISA §1). */
const BYTE_MASK = 0xff;

/** Largest legal origin or entry address (ISA §1.2 rule 2). */
const MAX_ADDRESS = 255;

/** The state captured by the last accepted load, used by resetState (ISA §1.2 rule 4). */
interface LoadedSnapshot {
  readonly memory: Uint8Array;
  readonly entry: number;
}

/** The mutable state of one BITSHIFT-8 machine (ISA §1, §2). Owned by one instance. */
export interface MachineState {
  memory: Uint8Array;
  registers: Record<RegisterName, number>;
  flags: Record<FlagName, boolean>;
  loaded: LoadedSnapshot | undefined;
}

/** Builds a register store with every register at 0 (ISA §1.2 rule 1). */
function zeroRegisters(): Record<RegisterName, number> {
  return { A: 0, B: 0, PC: 0, IR: 0, MAR: 0, MDR: 0, OUT: 0 };
}

/** Builds a flag store with every flag clear (ISA §1.2 rule 1). */
function clearFlags(): Record<FlagName, boolean> {
  return { Z: false, N: false, C: false };
}

/** Returns true when the value is an integer in the byte-address range 0..255 (ISA §1.2 rule 2). */
function isByteAddress(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ADDRESS;
}

/** Puts a memory image and entry point into the state, with all registers and flags cleared (ISA §1.2 rule 3). */
function restore(state: MachineState, memoryImage: Uint8Array, entry: number): void {
  state.memory.set(memoryImage);
  state.registers = zeroRegisters();
  state.flags = clearFlags();
  state.registers.PC = entry;
}

/** Creates the empty machine: all memory, registers and flags zero (ISA §1.2 rule 1). */
export function createState(): MachineState {
  return {
    memory: new Uint8Array(MEMORY_BYTES),
    registers: zeroRegisters(),
    flags: clearFlags(),
    loaded: undefined,
  };
}

/** Validates and loads a program image, rejecting it without changes when invalid (ISA §1.2 rules 2, 3). */
export function loadProgram(state: MachineState, image: ProgramImage): Result<void, Diagnostic> {
  if (image.architectureId !== ARCHITECTURE_ID) {
    return err({
      code: 'bitshift-8/LOAD-MISMATCH',
      severity: 'error',
      message: `Image targets architecture "${image.architectureId}", expected "${ARCHITECTURE_ID}".`,
    });
  }
  if (
    !isByteAddress(image.origin) ||
    !isByteAddress(image.entry) ||
    image.origin + image.bytes.length > MEMORY_BYTES
  ) {
    return err({
      code: 'bitshift-8/LOAD-RANGE',
      severity: 'error',
      message: 'Image origin, entry or length does not fit the 256-byte memory.',
    });
  }

  const memoryImage = new Uint8Array(MEMORY_BYTES);
  memoryImage.set(image.bytes, image.origin);
  state.loaded = { memory: memoryImage, entry: image.entry };
  restore(state, memoryImage, image.entry);
  return ok(undefined);
}

/** Restores the state after the last accepted load, or the empty machine if none (ISA §1.2 rule 4). */
export function resetState(state: MachineState): void {
  const loaded = state.loaded;
  if (loaded === undefined) {
    restore(state, new Uint8Array(MEMORY_BYTES), 0);
    return;
  }
  restore(state, loaded.memory, loaded.entry);
}

/** Returns a frozen copy of the state with fresh arrays and memory buffer (ISA §2). */
export function readState(state: MachineState): CpuStateCopy {
  const registers: readonly RegisterValue[] = Object.freeze(
    REGISTER_ORDER.map((name) =>
      Object.freeze<RegisterValue>({ name, bits: REGISTER_BITS, value: state.registers[name] }),
    ),
  );
  const flags: readonly FlagValue[] = Object.freeze(
    FLAG_ORDER.map((name) => Object.freeze<FlagValue>({ name, value: state.flags[name] })),
  );
  const copy: CpuStateCopy = {
    programCounter: state.registers.PC,
    registers,
    flags,
    memory: new Uint8Array(state.memory),
  };
  return Object.freeze(copy);
}

/** Returns the value of a register (ISA §2). */
export function getRegister(state: MachineState, name: RegisterName): number {
  return state.registers[name];
}

/** Stores a register value masked to 8 bits (ISA §2). */
export function setRegister(state: MachineState, name: RegisterName, value: number): void {
  state.registers[name] = value & BYTE_MASK;
}

/** Returns the value of a condition flag (ISA §2.1). */
export function getFlag(state: MachineState, name: FlagName): boolean {
  return state.flags[name];
}

/** Stores the value of a condition flag (ISA §2.1). */
export function setFlag(state: MachineState, name: FlagName, value: boolean): void {
  state.flags[name] = value;
}

/** Reads one memory byte; the address is masked to 8 bits (ISA §1). */
export function readByte(state: MachineState, address: number): number {
  return state.memory[address & BYTE_MASK] ?? 0;
}

/** Writes one memory byte; the address and value are masked to 8 bits (ISA §1). */
export function writeByte(state: MachineState, address: number, value: number): void {
  state.memory[address & BYTE_MASK] = value & BYTE_MASK;
}

/** Increments an 8-bit value, wrapping from 255 to 0 (ISA §2). */
export function increment8(value: number): number {
  return (value + 1) & BYTE_MASK;
}
