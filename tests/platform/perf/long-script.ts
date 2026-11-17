import type { FixtureCycle } from '../fixtures/fixture-architecture';

// Test-only generator of long fixture scripts for the performance checks. Every instruction takes
// exactly four clock cycles and the script never halts. A local model of W, IP, F1 and memory
// follows the values the fixture holds, so every `before` equals the actual value at that point.

/** The fixture's W register is 16 bits wide. */
const WORD_MODULUS = 65536;
/** The fixture's IP register is 6 bits wide, so it wraps at 64. */
const ADDRESS_MODULUS = 64;
/** The fixture has 48 bytes of memory. */
const MEMORY_BYTES = 48;
/** The fixture's memory bytes are 0..255. */
const BYTE_MODULUS = 256;
/** The fixture image (bytes 7, 8, 9 at addresses 0..2) is loaded at the start. */
const IMAGE: readonly number[] = [7, 8, 9];
/** Memory writes start above the image so that the image bytes are never overwritten. */
const FIRST_WRITABLE_ADDRESS = IMAGE.length;

/**
 * Builds a script of `instructionCount` instructions, four cycles each, with no halt.
 * Instructions alternate between OP-A and OP-B. Each instruction:
 *   cycle 1: instruction-start and a micro-operation;
 *   cycle 2: a bus-transfer and an alu-operation (informational);
 *   cycle 3: a register-write on W, plus a flag-update of F1 (even instructions)
 *            or a memory-write (odd instructions);
 *   cycle 4: a register-write on IP, then instruction-end with instructionCompleted set.
 * The script is meant for the fixture loaded with fixtureImage(): IP starts at 0.
 */
export function buildLongScript(instructionCount: number): FixtureCycle[] {
  if (!Number.isInteger(instructionCount) || instructionCount < 0) {
    throw new Error('instructionCount must be a non-negative integer');
  }

  const memory: number[] = Array.from(
    { length: MEMORY_BYTES },
    (_, address) => IMAGE[address] ?? 0,
  );
  let w = 0;
  let ip = 0;
  let f1 = false;
  const script: FixtureCycle[] = [];

  for (let i = 0; i < instructionCount; i += 1) {
    const mnemonic = i % 2 === 0 ? 'OP-A' : 'OP-B';
    const address = ip;
    const nextW = (w * 3 + 1) % WORD_MODULUS;
    const nextIp = (ip + 1) % ADDRESS_MODULUS;

    script.push({
      events: [
        { kind: 'instruction-start', payload: { address, mnemonic } },
        { kind: 'micro-operation', payload: { controlSignals: ['sig-1'] } },
      ],
    });

    script.push({
      events: [
        { kind: 'bus-transfer', payload: { bus: 'data', value: w } },
        {
          kind: 'alu-operation',
          payload: { operation: 'scale', left: w, right: 3, result: nextW },
        },
      ],
    });

    if (i % 2 === 0) {
      script.push({
        events: [
          { kind: 'register-write', payload: { register: 'W', before: w, after: nextW } },
          { kind: 'flag-update', payload: { flag: 'F1', before: f1, after: !f1 } },
        ],
      });
      f1 = !f1;
    } else {
      const target = FIRST_WRITABLE_ADDRESS + (i % (MEMORY_BYTES - FIRST_WRITABLE_ADDRESS));
      const before = memory[target] ?? 0;
      const after = (before + 1) % BYTE_MODULUS;
      script.push({
        events: [
          { kind: 'register-write', payload: { register: 'W', before: w, after: nextW } },
          { kind: 'memory-write', payload: { address: target, before, after } },
        ],
      });
      memory[target] = after;
    }

    script.push({
      events: [
        { kind: 'register-write', payload: { register: 'IP', before: ip, after: nextIp } },
        {
          kind: 'instruction-end',
          payload: { address, mnemonic, nextAddress: nextIp },
        },
      ],
      instructionCompleted: true,
    });

    w = nextW;
    ip = nextIp;
  }

  return script;
}
