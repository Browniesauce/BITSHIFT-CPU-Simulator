import { describe, expect, expectTypeOf, it } from 'vitest';
import { err, ok } from '../../src/platform';
import type { Diagnostic, Result } from '../../src/platform';

describe('Result helpers', () => {
  it('ok(v) returns { ok: true, value: v }', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
    const value = { a: 1 };
    expect(ok(value).value).toBe(value);
  });

  it('err(e) returns { ok: false, error: e }', () => {
    expect(err('bad')).toEqual({ ok: false, error: 'bad' });
    const error = { code: 'X', severity: 'error' as const, message: 'm' };
    expect(err(error).error).toBe(error);
  });

  it('ok and err results are assignable to Result and narrow on ok', () => {
    const success: Result<number, string> = ok(1);
    const failure: Result<number, string> = err('no');
    const defaulted: Result<number> = err({ code: 'C', severity: 'warning', message: 'm' });

    for (const result of [success, failure]) {
      if (result.ok) {
        expectTypeOf(result.value).toEqualTypeOf<number>();
      } else {
        expectTypeOf(result.error).toEqualTypeOf<string>();
      }
    }
    if (!defaulted.ok) {
      expectTypeOf(defaulted.error).toEqualTypeOf<Diagnostic>();
    }
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});
