import { err, ok } from './result';
import type { Diagnostic, Result } from './result';
import type { CpuState } from './types';

/** Request that moves the CPU lifecycle (MODULE_CONTRACTS §2.2). */
export type LifecycleAction =
  'load' | 'reset' | 'begin-run' | 'end-run' | 'clock-step' | 'instruction-step' | 'halt' | 'fault';

type LifecycleCode = 'PLT-RUNNING' | 'PLT-ALREADY-RUNNING' | 'PLT-NOT-RUNNING' | 'PLT-INTERNAL';

/** One cell of the transition table: either the next state, or the code of the refusal. */
type Cell =
  | { readonly kind: 'state'; readonly state: CpuState }
  | { readonly kind: 'error'; readonly code: LifecycleCode };

function to(state: CpuState): Cell {
  return { kind: 'state', state };
}

function refuse(code: LifecycleCode): Cell {
  return { kind: 'error', code };
}

/** Transition table of SIMULATION_PLATFORM §3, indexed by action then by current state. */
const TRANSITIONS: Readonly<Record<LifecycleAction, Readonly<Record<CpuState, Cell>>>> = {
  load: {
    ready: to('ready'),
    running: refuse('PLT-RUNNING'),
    paused: to('ready'),
    halted: to('ready'),
    faulted: to('ready'),
  },
  reset: {
    ready: to('ready'),
    running: to('ready'),
    paused: to('ready'),
    halted: to('ready'),
    faulted: to('ready'),
  },
  'begin-run': {
    ready: to('running'),
    running: refuse('PLT-ALREADY-RUNNING'),
    paused: to('running'),
    halted: to('halted'),
    faulted: to('faulted'),
  },
  'end-run': {
    ready: refuse('PLT-NOT-RUNNING'),
    running: to('paused'),
    paused: refuse('PLT-NOT-RUNNING'),
    halted: refuse('PLT-NOT-RUNNING'),
    faulted: refuse('PLT-NOT-RUNNING'),
  },
  'clock-step': {
    ready: to('paused'),
    running: refuse('PLT-RUNNING'),
    paused: to('paused'),
    halted: to('halted'),
    faulted: to('faulted'),
  },
  'instruction-step': {
    ready: to('paused'),
    running: refuse('PLT-RUNNING'),
    paused: to('paused'),
    halted: to('halted'),
    faulted: to('faulted'),
  },
  halt: {
    ready: refuse('PLT-INTERNAL'),
    running: to('halted'),
    paused: to('halted'),
    halted: refuse('PLT-INTERNAL'),
    faulted: refuse('PLT-INTERNAL'),
  },
  fault: {
    ready: to('faulted'),
    running: to('faulted'),
    paused: to('faulted'),
    halted: to('faulted'),
    faulted: to('faulted'),
  },
};

const MESSAGES: Readonly<Record<LifecycleCode, string>> = {
  'PLT-RUNNING': 'The CPU is running. Pause or halt it before making this request.',
  'PLT-ALREADY-RUNNING': 'The CPU is already running.',
  'PLT-NOT-RUNNING': 'The CPU is not running, so there is no run to change.',
  'PLT-INTERNAL': 'The controller made a lifecycle request that the current state does not allow.',
};

/** Pure transition function (MODULE_CONTRACTS §2.2, SIMULATION_PLATFORM §3). */
export function nextState(
  current: CpuState,
  action: LifecycleAction,
): Result<CpuState, Diagnostic> {
  const cell = TRANSITIONS[action][current];
  if (cell.kind === 'state') return ok(cell.state);
  return err({ code: cell.code, severity: 'error', message: MESSAGES[cell.code] });
}
