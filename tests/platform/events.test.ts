import { describe, expect, it } from 'vitest';
import { stampEvents } from '../../src/platform/events';
import type { ArchitectureEvent, ExecutionEvent } from '../../src/platform/types';

const ID = 'alpha-12';

function event(kind: string, cycleOffset: number, payload: unknown = {}): ArchitectureEvent {
  return { kind, cycleOffset, payload };
}

function unwrap(result: ReturnType<typeof stampEvents>): readonly ExecutionEvent[] {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

describe('stampEvents cycle and sequence', () => {
  it('assigns cycle = cycleBefore + offset and per-cycle sequence in a multi-cycle batch', () => {
    const input = [
      event('micro-operation', 1),
      event('bus-transfer', 1),
      event('register-write', 2),
      event('flag-update', 1),
      event('memory-read', 3),
      event('halted', 2),
    ];
    const out = unwrap(stampEvents(100, input, ID));
    expect(out.map((e) => [e.cycle, e.sequence])).toEqual([
      [101, 0],
      [101, 1],
      [102, 0],
      [101, 2],
      [103, 0],
      [102, 1],
    ]);
  });

  it('preserves input order and kinds', () => {
    const input = [event('halted', 2), event('micro-operation', 1)];
    const out = unwrap(stampEvents(0, input, ID));
    expect(out.map((e) => e.kind)).toEqual(['halted', 'micro-operation']);
    expect(out.map((e) => e.cycle)).toEqual([2, 1]);
  });

  it('counts sequence from zero at cycleBefore 0', () => {
    const out = unwrap(stampEvents(0, [event('halted', 1), event('halted', 1)], ID));
    expect(out.map((e) => [e.cycle, e.sequence])).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });

  it('returns an empty frozen array for empty input', () => {
    const result = stampEvents(5, [], ID);
    expect(result.ok).toBe(true);
    const out = unwrap(result);
    expect(out).toEqual([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe('stampEvents kind rules', () => {
  it.each([
    'micro-operation',
    'bus-transfer',
    'register-write',
    'memory-read',
    'memory-write',
    'alu-operation',
    'flag-update',
    'output-emitted',
    'instruction-start',
    'instruction-end',
    'halted',
  ])('accepts shared kind %j', (kind) => {
    expect(stampEvents(0, [event(kind, 1)], ID).ok).toBe(true);
  });

  it('forwards a namespaced kind for the emitting id unchanged, with the same payload reference', () => {
    const payload = { value: 7 };
    const out = unwrap(stampEvents(0, [event('alpha-12/custom', 1, payload)], ID));
    expect(out[0]?.kind).toBe('alpha-12/custom');
    expect(out[0]?.payload).toBe(payload);
  });

  it.each([
    ['foreign namespace', 'beta/custom'],
    ['unknown bare kind', 'mystery'],
    ['empty part after slash', 'alpha-12/'],
    ['empty kind', ''],
    ['architecture-emitted fault', 'fault'],
    ['shared kind used as a namespace', 'micro-operation/x'],
  ])('rejects %s (%j) with PLT-EVENT-NAMESPACE', (_label, kind) => {
    const result = stampEvents(0, [event(kind, 1)], ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PLT-EVENT-NAMESPACE');
      expect(result.error.severity).toBe('error');
    }
  });

  it('does not freeze payloads of earlier events when a later event is rejected', () => {
    const payload = { address: 1 };
    const result = stampEvents(0, [event('halted', 1, payload), event('fault', 1)], ID);
    expect(result.ok).toBe(false);
    expect(Object.isFrozen(payload)).toBe(false);
  });

  it('rejects the whole batch when one bad event is among good ones', () => {
    const result = stampEvents(0, [event('halted', 1), event('fault', 1), event('halted', 2)], ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PLT-EVENT-NAMESPACE');
  });
});

describe('stampEvents freezing and mutation', () => {
  it('returns a frozen output array of frozen event objects', () => {
    const out = unwrap(stampEvents(0, [event('halted', 1)], ID));
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out[0])).toBe(true);
  });

  it('deep-freezes nested payload arrays and objects', () => {
    const out = unwrap(
      stampEvents(
        0,
        [event('micro-operation', 1, { controlSignals: ['LOAD', 'INC'], meta: { n: 1 } })],
        ID,
      ),
    );
    const payload = out[0]?.payload as {
      controlSignals: readonly string[];
      meta: { n: number };
    };
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.controlSignals)).toBe(true);
    expect(Object.isFrozen(payload.meta)).toBe(true);
  });

  it('does not freeze the input array or the input event objects', () => {
    const input = [event('halted', 1, { address: 0 })];
    const first = input[0];
    stampEvents(0, input, ID);
    expect(Object.isFrozen(input)).toBe(false);
    expect(first).toBeDefined();
    expect(Object.isFrozen(first)).toBe(false);
  });

  it('returns new event objects rather than the input objects', () => {
    const input = [event('halted', 1)];
    const out = unwrap(stampEvents(0, input, ID));
    expect(out[0]).not.toBe(input[0]);
  });

  it('throws when the frozen output is mutated', () => {
    const out = unwrap(stampEvents(0, [event('halted', 1)], ID));
    const mutableList = out as unknown as unknown[];
    const mutableEvent = out[0] as unknown as { kind: string };
    expect(() => {
      mutableList.push({});
    }).toThrow(TypeError);
    expect(() => {
      mutableEvent.kind = 'changed';
    }).toThrow(TypeError);
  });
});
