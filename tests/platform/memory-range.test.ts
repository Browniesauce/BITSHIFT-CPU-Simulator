import { describe, expect, it } from 'vitest';
import { validateMemoryRange } from '../../src/platform';
import type { MemoryRange } from '../../src/platform';

const SIZES = [256, 1000] as const;

function expectRejected(range: MemoryRange, memoryBytes: number): void {
  const result = validateMemoryRange(range, memoryBytes);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('PLT-MEMORY-RANGE');
    expect(result.error.severity).toBe('error');
  }
}

describe.each(SIZES)('validateMemoryRange with %i bytes of memory', (size) => {
  it('accepts the whole memory', () => {
    const range = { start: 0, length: size };
    const result = validateMemoryRange(range, size);
    expect(result).toEqual({ ok: true, value: range });
  });

  it('accepts a single byte at the last address', () => {
    const range = { start: size - 1, length: 1 };
    expect(validateMemoryRange(range, size)).toEqual({ ok: true, value: range });
  });

  it('accepts a range in the middle', () => {
    const range = { start: 10, length: 20 };
    expect(validateMemoryRange(range, size)).toEqual({ ok: true, value: range });
  });

  it('rejects a negative start', () => {
    expectRejected({ start: -1, length: 1 }, size);
  });

  it('rejects a fractional start', () => {
    expectRejected({ start: 1.5, length: 1 }, size);
  });

  it('rejects a length of 0', () => {
    expectRejected({ start: 0, length: 0 }, size);
  });

  it('rejects a negative length', () => {
    expectRejected({ start: 5, length: -1 }, size);
  });

  it('rejects a fractional length', () => {
    expectRejected({ start: 0, length: 1.5 }, size);
  });

  it('rejects a start equal to the memory size', () => {
    expectRejected({ start: size, length: 1 }, size);
  });

  it('rejects a range that ends one byte past the end', () => {
    expectRejected({ start: 0, length: size + 1 }, size);
    expectRejected({ start: size - 1, length: 2 }, size);
  });

  it('rejects NaN in either field', () => {
    expectRejected({ start: NaN, length: 1 }, size);
    expectRejected({ start: 0, length: NaN }, size);
  });

  it('rejects Infinity in either field', () => {
    expectRejected({ start: Infinity, length: 1 }, size);
    expectRejected({ start: 0, length: Infinity }, size);
    expectRejected({ start: -Infinity, length: 1 }, size);
  });

  it('does not mutate its argument and gives equal results for equal inputs', () => {
    const range: MemoryRange = Object.freeze({ start: 3, length: 4 });
    const bad: MemoryRange = Object.freeze({ start: -1, length: 4 });
    const first = validateMemoryRange(range, size);
    const second = validateMemoryRange({ start: 3, length: 4 }, size);
    expect(first).toEqual(second);
    expect(range).toEqual({ start: 3, length: 4 });
    expect(validateMemoryRange(bad, size)).toEqual(validateMemoryRange({ ...bad }, size));
    expect(bad).toEqual({ start: -1, length: 4 });
  });
});
