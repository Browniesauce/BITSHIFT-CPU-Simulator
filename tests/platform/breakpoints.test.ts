import { describe, expect, it } from 'vitest';
import { createBreakpointSet } from '../../src/platform/breakpoints';
import type { BreakpointSet } from '../../src/platform/breakpoints';

const WIDTH = 10; // addressBits; addresses run 0 to 1023

function expectRejected(set: BreakpointSet, addresses: readonly number[], code: string): void {
  const result = set.replace(addresses, WIDTH);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
    expect(result.error.severity).toBe('error');
  }
}

describe('createBreakpointSet', () => {
  it('starts empty', () => {
    const set = createBreakpointSet();
    expect(set.addresses).toEqual([]);
    expect(set.has(0)).toBe(false);
  });

  it('holds addresses after replace', () => {
    const set = createBreakpointSet();
    const result = set.replace([4, 9], WIDTH);
    expect(result.ok).toBe(true);
    expect(set.addresses).toEqual([4, 9]);
    expect(set.has(4)).toBe(true);
    expect(set.has(9)).toBe(true);
    expect(set.has(5)).toBe(false);
  });

  it('replace discards the previous addresses', () => {
    const set = createBreakpointSet();
    set.replace([4, 9], WIDTH);
    set.replace([20], WIDTH);
    expect(set.addresses).toEqual([20]);
    expect(set.has(4)).toBe(false);
    expect(set.has(9)).toBe(false);
    expect(set.has(20)).toBe(true);
  });

  it('sorts ascending and removes duplicates', () => {
    const set = createBreakpointSet();
    const result = set.replace([30, 7, 30, 12, 7], WIDTH);
    expect(result.ok).toBe(true);
    expect(set.addresses).toEqual([7, 12, 30]);
    expect(set.has(12)).toBe(true);
  });

  it('an empty list clears the set', () => {
    const set = createBreakpointSet();
    set.replace([1, 2], WIDTH);
    const result = set.replace([], WIDTH);
    expect(result.ok).toBe(true);
    expect(set.addresses).toEqual([]);
    expect(set.has(1)).toBe(false);
  });

  it('accepts 0 and 1023 for a 10-bit width', () => {
    const set = createBreakpointSet();
    const result = set.replace([0, 1023], WIDTH);
    expect(result.ok).toBe(true);
    expect(set.addresses).toEqual([0, 1023]);
  });

  it('rejects 1024 and -1 for a 10-bit width with PLT-BREAKPOINT-RANGE', () => {
    const set = createBreakpointSet();
    expectRejected(set, [1024], 'PLT-BREAKPOINT-RANGE');
    expectRejected(set, [-1], 'PLT-BREAKPOINT-RANGE');
  });

  it('rejects fractional, NaN and Infinity addresses with PLT-ARGUMENT', () => {
    const set = createBreakpointSet();
    expectRejected(set, [1.5], 'PLT-ARGUMENT');
    expectRejected(set, [NaN], 'PLT-ARGUMENT');
    expectRejected(set, [Infinity], 'PLT-ARGUMENT');
    expectRejected(set, [-Infinity], 'PLT-ARGUMENT');
  });

  it('the first offending address in input order decides the code when out-of-range comes first', () => {
    const set = createBreakpointSet();
    expectRejected(set, [1024, 1.5], 'PLT-BREAKPOINT-RANGE');
  });

  it('the first offending address in input order decides the code when non-integer comes first', () => {
    const set = createBreakpointSet();
    expectRejected(set, [1.5, 1024], 'PLT-ARGUMENT');
  });

  it('a rejected replace leaves the previous set unchanged', () => {
    const set = createBreakpointSet();
    set.replace([3, 7], WIDTH);
    const before = set.addresses;

    expectRejected(set, [5, 1024], 'PLT-BREAKPOINT-RANGE');
    expect(set.addresses).toBe(before);
    expect(set.has(3)).toBe(true);
    expect(set.has(7)).toBe(true);
    expect(set.has(5)).toBe(false);
    expect(set.has(1024)).toBe(false);

    expectRejected(set, [2.5], 'PLT-ARGUMENT');
    expect(set.addresses).toBe(before);
    expect(set.has(3)).toBe(true);
    expect(set.has(2.5)).toBe(false);
  });

  it('published addresses are frozen', () => {
    const set = createBreakpointSet();
    set.replace([8, 2], WIDTH);
    expect(Object.isFrozen(set.addresses)).toBe(true);
    expect(createBreakpointSet().addresses).toEqual([]);
    expect(Object.isFrozen(createBreakpointSet().addresses)).toBe(true);
  });

  it('returns the same addresses object between calls until a successful replace', () => {
    const set = createBreakpointSet();
    set.replace([8, 2], WIDTH);
    const first = set.addresses;
    expect(set.addresses).toBe(first);
    set.replace([1], WIDTH);
    expect(set.addresses).not.toBe(first);
  });

  it('does not mutate or freeze the input array', () => {
    const set = createBreakpointSet();
    const input = [30, 7, 30];
    set.replace(input, WIDTH);
    expect(input).toEqual([30, 7, 30]);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it('reports severity error on every rejection', () => {
    const set = createBreakpointSet();
    expectRejected(set, [-1], 'PLT-BREAKPOINT-RANGE');
    expectRejected(set, [0.5], 'PLT-ARGUMENT');
  });
});
