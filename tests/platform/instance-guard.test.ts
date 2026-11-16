import { describe, expect, it } from 'vitest';
import { err, ok } from '../../src/platform';
import type { CpuInstance, Diagnostic, StepOutcome } from '../../src/platform';
import { createInstanceGuard } from '../../src/platform/instance-guard';
import type { Guarded } from '../../src/platform/instance-guard';
import {
  emptyState,
  makeImage,
  makeStubArchitecture,
  makeStubInstance,
  quietOutcome,
} from './helpers/stub-instance';
import type { StubBehaviour, StubInstance } from './helpers/stub-instance';

function guardOf(behaviour: StubBehaviour): {
  guard: ReturnType<typeof createInstanceGuard>;
  stub: StubInstance;
} {
  const stub = makeStubInstance(behaviour);
  const guard = createInstanceGuard(makeStubArchitecture(() => stub.instance));
  return { guard, stub };
}

function expectInternal(result: Guarded<unknown>): void {
  expect(result.kind).toBe('internal');
  if (result.kind === 'internal') {
    expect(result.diagnostic.code).toBe('PLT-INTERNAL');
    expect(result.diagnostic.severity).toBe('error');
  }
}

function messageOf(result: Guarded<unknown>): string {
  return result.kind === 'internal' ? result.diagnostic.message : '';
}

const boom = (): never => {
  throw new Error('boom');
};

const rejected = (): { ok: false; error: Diagnostic } =>
  err({ code: 'stub/LOAD-RANGE', severity: 'error', message: 'x' });

describe('createInstanceGuard: exceptions', () => {
  it('contains a throw from loadProgram', () => {
    const { guard } = guardOf({ loadProgram: boom });
    const result = guard.loadProgram(makeImage(1));
    expectInternal(result);
    expect(messageOf(result)).toContain('boom');
    expect(guard.reliable).toBe(false);
  });

  it('contains a throw from reset', () => {
    const { guard } = guardOf({ reset: boom });
    expectInternal(guard.reset());
    expect(guard.reliable).toBe(false);
  });

  it('contains a throw from stepClock', () => {
    const { guard } = guardOf({ stepClock: boom });
    expectInternal(guard.stepClock());
    expect(guard.reliable).toBe(false);
  });

  it('contains a throw from readState', () => {
    const { guard } = guardOf({ readState: boom });
    expectInternal(guard.readState());
    expect(guard.reliable).toBe(false);
  });

  it('includes a non-Error thrown value in the message', () => {
    const { guard } = guardOf({
      reset: () => {
        throw 'plain text';
      },
    });
    expect(messageOf(guard.reset())).toContain('plain text');
  });

  it('is created unreliable when createInstance throws', () => {
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        throw new Error('no instance');
      }),
    );
    expect(guard.reliable).toBe(false);
    expectInternal(guard.reset());
  });

  it('calls createInstance exactly once at creation', () => {
    let created = 0;
    const stub = makeStubInstance();
    createInstanceGuard(
      makeStubArchitecture(() => {
        created += 1;
        return stub.instance;
      }),
    );
    expect(created).toBe(1);
  });
});

describe('createInstanceGuard: recorded cause', () => {
  it('carries the creation failure in later diagnostics', () => {
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        throw new Error('boom-create');
      }),
    );
    const result = guard.reset();
    expectInternal(result);
    expect(messageOf(result)).toContain('boom-create');
  });

  it('carries a step failure in later diagnostics without calling the instance', () => {
    const { guard, stub } = guardOf({
      stepClock: () => {
        throw new Error('boom-step');
      },
    });
    guard.stepClock();
    const result = guard.readState();
    expectInternal(result);
    expect(messageOf(result)).toContain('boom-step');
    expect(stub.calls.readState).toBe(0);
  });

  it('clears the recorded cause after a successful replace', () => {
    let created = 0;
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        created += 1;
        if (created === 1) {
          throw new Error('boom-first');
        }
        return makeStubInstance().instance;
      }),
    );
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(guard.readState().kind).toBe('ok');
  });
});

describe('createInstanceGuard: malformed load result', () => {
  it('treats a non-Result as a failure and keeps the earlier image', () => {
    const loaded: number[] = [];
    let malformed = false;
    const guard = createInstanceGuard(
      makeStubArchitecture(
        () =>
          makeStubInstance({
            loadProgram: (image) => {
              loaded.push(image.bytes[0] ?? -1);
              return (malformed ? undefined : ok(undefined)) as unknown as ReturnType<
                CpuInstance['loadProgram']
              >;
            },
          }).instance,
      ),
    );
    guard.loadProgram(makeImage(1));
    malformed = true;
    const result = guard.loadProgram(makeImage(2));
    expectInternal(result);
    expect(guard.reliable).toBe(false);
    malformed = false;
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(loaded).toEqual([1, 2, 1]);
  });
});

describe('createInstanceGuard: unreliable guard', () => {
  it('does not call the instance again after a failure', () => {
    const { guard, stub } = guardOf({ stepClock: boom });
    guard.stepClock();
    expect(stub.calls.stepClock).toBe(1);
    expectInternal(guard.loadProgram(makeImage(1)));
    expectInternal(guard.reset());
    expectInternal(guard.stepClock());
    expectInternal(guard.readState());
    expect(stub.calls).toEqual({ loadProgram: 0, reset: 0, stepClock: 1, readState: 0 });
  });
});

describe('createInstanceGuard: outcome validation (DATA_CONTRACTS §5)', () => {
  const base = quietOutcome();
  const event = { kind: 'k', cycleOffset: 1, payload: undefined };
  const fault: Diagnostic = { code: 'X/FAULT', severity: 'error', message: 'f' };
  const invalid: readonly (readonly [string, StepOutcome])[] = [
    ['cyclesCompleted 2', { ...base, cyclesCompleted: 2 }],
    ['cyclesCompleted -1', { ...base, cyclesCompleted: -1 }],
    ['cyclesCompleted 0.5', { ...base, cyclesCompleted: 0.5 }],
    ['events not an array', { ...base, events: undefined as unknown as StepOutcome['events'] }],
    ['fault with cyclesCompleted 1', { ...base, cyclesCompleted: 1, fault }],
    ['fault with halted', { ...base, halted: true, fault }],
    ['fault with an event', { ...base, fault, events: [event] }],
    ['event offset 0', { ...base, cyclesCompleted: 1, events: [{ ...event, cycleOffset: 0 }] }],
    [
      'event offset beyond cycles',
      { ...base, cyclesCompleted: 1, events: [{ ...event, cycleOffset: 2 }] },
    ],
    [
      'event offset fractional',
      { ...base, cyclesCompleted: 1, events: [{ ...event, cycleOffset: 0.5 }] },
    ],
    ['event in a zero-cycle step', { ...base, cyclesCompleted: 0, events: [event] }],
  ];

  it.each(invalid)('treats %s like a throw', (_name, outcome) => {
    const { guard } = guardOf({ stepClock: () => outcome });
    expectInternal(guard.stepClock());
    expect(guard.reliable).toBe(false);
  });

  it('passes a valid fault outcome through', () => {
    const outcome: StepOutcome = { ...base, fault };
    const { guard } = guardOf({ stepClock: () => outcome });
    expect(guard.stepClock()).toEqual({ kind: 'ok', value: outcome });
    expect(guard.reliable).toBe(true);
  });

  it('passes a valid zero-cycle outcome through', () => {
    const { guard } = guardOf({});
    expect(guard.stepClock()).toEqual({ kind: 'ok', value: quietOutcome() });
    expect(guard.reliable).toBe(true);
  });

  it('passes a valid one-cycle outcome with events through', () => {
    const outcome: StepOutcome = { ...base, cyclesCompleted: 1, events: [event] };
    const { guard } = guardOf({ stepClock: () => outcome });
    expect(guard.stepClock()).toEqual({ kind: 'ok', value: outcome });
  });
});

describe('createInstanceGuard: loadProgram', () => {
  it('returns the architecture Result inside ok without becoming unreliable', () => {
    const { guard } = guardOf({ loadProgram: rejected });
    expect(guard.loadProgram(makeImage(1))).toEqual({ kind: 'ok', value: rejected() });
    expect(guard.reliable).toBe(true);
  });

  it('keeps the earlier accepted image when a later load is rejected', () => {
    const loaded: number[] = [];
    let accept = true;
    const guard = createInstanceGuard(
      makeStubArchitecture(
        () =>
          makeStubInstance({
            loadProgram: (image) => {
              loaded.push(image.bytes[0] ?? -1);
              return accept ? ok(undefined) : rejected();
            },
          }).instance,
      ),
    );
    guard.loadProgram(makeImage(1));
    accept = false;
    guard.loadProgram(makeImage(2));
    accept = true;
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(loaded).toEqual([1, 2, 1]);
  });
});

describe('createInstanceGuard: replace', () => {
  function trackedGuard(): {
    guard: ReturnType<typeof createInstanceGuard>;
    created: StubInstance[];
  } {
    const created: StubInstance[] = [];
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        const stub = makeStubInstance();
        created.push(stub);
        return stub.instance;
      }),
    );
    return { guard, created };
  }

  it('creates a second instance and reloads the last accepted image', () => {
    const { guard, created } = trackedGuard();
    guard.loadProgram(makeImage(7));
    expect(created).toHaveLength(1);
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(created).toHaveLength(2);
    expect(created[1]?.calls.loadProgram).toBe(1);
    guard.stepClock();
    expect(created[1]?.calls.stepClock).toBe(1);
    expect(created[0]?.calls.stepClock).toBe(0);
  });

  it('loads nothing when no program was accepted', () => {
    const { guard, created } = trackedGuard();
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(created).toHaveLength(2);
    expect(created[1]?.calls.loadProgram).toBe(0);
  });

  it('makes an unreliable guard reliable again when it succeeds', () => {
    let created = 0;
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        created += 1;
        return makeStubInstance(created === 1 ? { stepClock: boom } : {}).instance;
      }),
    );
    guard.stepClock();
    expect(guard.reliable).toBe(false);
    expect(guard.replace()).toEqual({ kind: 'ok', value: undefined });
    expect(guard.reliable).toBe(true);
    expect(guard.readState()).toEqual({ kind: 'ok', value: emptyState() });
  });

  it('stays unreliable when createInstance throws', () => {
    let created = 0;
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        created += 1;
        if (created > 1) {
          throw new Error('again');
        }
        return makeStubInstance({ reset: boom }).instance;
      }),
    );
    guard.reset();
    expectInternal(guard.replace());
    expect(guard.reliable).toBe(false);
    expectInternal(guard.reset());
  });

  it('stays unreliable when the reload throws', () => {
    let created = 0;
    const guard = createInstanceGuard(
      makeStubArchitecture(() => {
        created += 1;
        return makeStubInstance(created === 1 ? {} : { loadProgram: boom }).instance;
      }),
    );
    guard.loadProgram(makeImage(1));
    expectInternal(guard.replace());
    expect(guard.reliable).toBe(false);
  });

  it('stays unreliable when the reload is rejected', () => {
    let created = 0;
    const guard = createInstanceGuard(
      makeStubArchitecture((): CpuInstance => {
        created += 1;
        return makeStubInstance(created === 1 ? {} : { loadProgram: rejected }).instance;
      }),
    );
    guard.loadProgram(makeImage(1));
    expectInternal(guard.replace());
    expect(guard.reliable).toBe(false);
  });
});
