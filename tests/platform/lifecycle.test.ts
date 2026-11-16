import { describe, expect, it } from 'vitest';
import { nextState } from '../../src/platform/lifecycle';
import type { LifecycleAction } from '../../src/platform/lifecycle';
import type { CpuState } from '../../src/platform/types';

// LCY-01: every cell of the lifecycle table, written by hand from the specification table in the
// task (SIMULATION_PLATFORM §3). Do not generate these rows from the implementation.
type Expected = { readonly state: CpuState } | { readonly code: string };

const TABLE: readonly (readonly [LifecycleAction, CpuState, Expected])[] = [
  // load
  ['load', 'ready', { state: 'ready' }],
  ['load', 'running', { code: 'PLT-RUNNING' }],
  ['load', 'paused', { state: 'ready' }],
  ['load', 'halted', { state: 'ready' }],
  ['load', 'faulted', { state: 'ready' }],
  // reset
  ['reset', 'ready', { state: 'ready' }],
  ['reset', 'running', { state: 'ready' }],
  ['reset', 'paused', { state: 'ready' }],
  ['reset', 'halted', { state: 'ready' }],
  ['reset', 'faulted', { state: 'ready' }],
  // begin-run
  ['begin-run', 'ready', { state: 'running' }],
  ['begin-run', 'running', { code: 'PLT-ALREADY-RUNNING' }],
  ['begin-run', 'paused', { state: 'running' }],
  ['begin-run', 'halted', { state: 'halted' }],
  ['begin-run', 'faulted', { state: 'faulted' }],
  // end-run
  ['end-run', 'ready', { code: 'PLT-NOT-RUNNING' }],
  ['end-run', 'running', { state: 'paused' }],
  ['end-run', 'paused', { code: 'PLT-NOT-RUNNING' }],
  ['end-run', 'halted', { code: 'PLT-NOT-RUNNING' }],
  ['end-run', 'faulted', { code: 'PLT-NOT-RUNNING' }],
  // clock-step
  ['clock-step', 'ready', { state: 'paused' }],
  ['clock-step', 'running', { code: 'PLT-RUNNING' }],
  ['clock-step', 'paused', { state: 'paused' }],
  ['clock-step', 'halted', { state: 'halted' }],
  ['clock-step', 'faulted', { state: 'faulted' }],
  // instruction-step (same row as clock-step)
  ['instruction-step', 'ready', { state: 'paused' }],
  ['instruction-step', 'running', { code: 'PLT-RUNNING' }],
  ['instruction-step', 'paused', { state: 'paused' }],
  ['instruction-step', 'halted', { state: 'halted' }],
  ['instruction-step', 'faulted', { state: 'faulted' }],
  // halt
  ['halt', 'ready', { code: 'PLT-INTERNAL' }],
  ['halt', 'running', { state: 'halted' }],
  ['halt', 'paused', { state: 'halted' }],
  ['halt', 'halted', { code: 'PLT-INTERNAL' }],
  ['halt', 'faulted', { code: 'PLT-INTERNAL' }],
  // fault
  ['fault', 'ready', { state: 'faulted' }],
  ['fault', 'running', { state: 'faulted' }],
  ['fault', 'paused', { state: 'faulted' }],
  ['fault', 'halted', { state: 'faulted' }],
  ['fault', 'faulted', { state: 'faulted' }],
];

const STATES: readonly CpuState[] = ['ready', 'running', 'paused', 'halted', 'faulted'];

describe('nextState lifecycle table (LCY-01)', () => {
  it('the hand-written table has exactly 40 entries', () => {
    expect(TABLE).toHaveLength(40);
  });

  it('the table covers every (action, state) pair exactly once', () => {
    const keys = new Set(TABLE.map(([action, state]) => `${action}|${state}`));
    expect(keys.size).toBe(40);
    for (const [action] of TABLE) {
      for (const state of STATES) {
        expect(keys.has(`${action}|${state}`)).toBe(true);
      }
    }
  });

  for (const [action, from, expected] of TABLE) {
    it(`${action} from ${from} gives ${'state' in expected ? expected.state : expected.code}`, () => {
      const result = nextState(from, action);
      if ('state' in expected) {
        expect(result).toEqual({ ok: true, value: expected.state });
      } else {
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe(expected.code);
        expect(result.error.severity).toBe('error');
      }
    });
  }

  it('is pure: the same inputs give the same output on repeated calls', () => {
    for (const [action, from] of TABLE) {
      expect(nextState(from, action)).toEqual(nextState(from, action));
    }
  });

  it('returns a successful result without an error property, and an error without a value', () => {
    const success = nextState('ready', 'load');
    expect(success.ok).toBe(true);
    expect('error' in success).toBe(false);
    const failure = nextState('running', 'load');
    expect(failure.ok).toBe(false);
    expect('value' in failure).toBe(false);
  });
});
