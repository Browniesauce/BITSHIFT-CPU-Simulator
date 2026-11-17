/** The eight ALU operations (ISA §3, §10.2 rule 5). */
export type AluOperation = 'add' | 'sub' | 'inc' | 'dec' | 'and' | 'or' | 'xor' | 'not';

/** Result of one ALU operation (ISA §3, §5, §10.2 rule 5). */
export interface AluResult {
  readonly result: number; // 0 to 255
  readonly right: number; // the right operand reported in the alu-operation event
  readonly carry?: boolean; // present only for 'add' and 'sub'
}

/** Performs one 8-bit ALU operation; pure (ISA §3, §5, §10.2 rule 5). */
export function runAlu(operation: AluOperation, a: number, b: number): AluResult {
  switch (operation) {
    case 'add':
      return { result: (a + b) & 0xff, right: b, carry: a + b > 0xff };
    case 'sub':
      return { result: (a - b) & 0xff, right: b, carry: a < b };
    case 'inc':
      return { result: (a + 1) & 0xff, right: 1 };
    case 'dec':
      return { result: (a - 1) & 0xff, right: 1 };
    case 'and':
      return { result: a & b & 0xff, right: b };
    case 'or':
      return { result: (a | b) & 0xff, right: b };
    case 'xor':
      return { result: (a ^ b) & 0xff, right: b };
    case 'not':
      return { result: ~a & 0xff, right: 0 };
  }
}

/** Z and N for a value written to A (ISA §5 rule 1). */
export function zeroNegative(value: number): {
  readonly zero: boolean;
  readonly negative: boolean;
} {
  return { zero: value === 0, negative: (value & 0x80) !== 0 };
}
