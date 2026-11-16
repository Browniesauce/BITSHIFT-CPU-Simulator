import { err, ok } from './result';
import type { Diagnostic, Result } from './result';
import type { MemoryRange } from './types';

/** Checks a memory range against a memory size (DATA_CONTRACTS §10). Pure. */
export function validateMemoryRange(
  range: MemoryRange,
  memoryBytes: number,
): Result<MemoryRange, Diagnostic> {
  const { start, length } = range;
  const valid =
    Number.isInteger(start) &&
    start >= 0 &&
    Number.isInteger(length) &&
    length > 0 &&
    start + length <= memoryBytes;
  if (valid) {
    return ok(range);
  }
  return err({
    code: 'PLT-MEMORY-RANGE',
    severity: 'error',
    message: `The memory range (start ${String(start)}, length ${String(length)}) does not fit in a memory of ${String(memoryBytes)} bytes.`,
  });
}
