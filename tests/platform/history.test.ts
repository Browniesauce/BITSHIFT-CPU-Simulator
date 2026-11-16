import { describe, expect, it } from 'vitest';
import type { ExecutionHistory } from '../../src/platform/history';
import { createExecutionHistory, createInstructionRecorder } from '../../src/platform/history';
import type { ExecutionEvent, InstructionRecord, StateChange } from '../../src/platform/types';

function makeRecord(index: number): InstructionRecord {
  return {
    index,
    startCycle: index * 2,
    endCycle: index * 2 + 1,
    address: index,
    mnemonic: 'NOP',
    changes: [],
  };
}

function historyOf(limit: number): ExecutionHistory {
  const result = createExecutionHistory(limit);
  if (!result.ok) {
    throw new Error(`expected a history for limit ${String(limit)}`);
  }
  return result.value;
}

function ev(kind: string, cycle: number, payload: unknown): ExecutionEvent {
  return { kind, cycle, sequence: 0, payload };
}

function only(records: readonly InstructionRecord[]): InstructionRecord {
  const [first] = records;
  if (first === undefined) {
    throw new Error('expected exactly one record');
  }
  return first;
}

const LOAD_INSTRUCTION: readonly ExecutionEvent[] = [
  ev('instruction-start', 3, { address: 16, mnemonic: 'LOAD' }),
  ev('micro-operation', 3, { controlSignals: ['read'] }),
  ev('register-write', 4, { register: 'R0', before: 0, after: 7 }),
  ev('bus-transfer', 4, { bus: 'data', value: 7 }),
  ev('flag-update', 4, { flag: 'F0', before: false, after: true }),
  ev('memory-write', 5, { address: 16, before: 1, after: 9 }),
  ev('output-emitted', 6, { before: 0, after: 7 }),
  ev('instruction-end', 6, { address: 16, mnemonic: 'LOAD', nextAddress: 18 }),
];

const EXPECTED_LOAD: InstructionRecord = {
  index: 0,
  startCycle: 3,
  endCycle: 6,
  address: 16,
  mnemonic: 'LOAD',
  changes: [
    { target: 'R0', before: 0, after: 7 },
    { target: 'F0', before: false, after: true },
    { target: 'memory[16]', before: 1, after: 9 },
    { target: 'OUT0', before: 0, after: 7 },
  ],
};

describe('execution history limit (HST-01, HST-02)', () => {
  it('evicts the oldest record and never holds more than the limit', () => {
    const history = historyOf(2);
    for (let i = 0; i < 5; i += 1) {
      history.append(makeRecord(i));
      expect(history.entries().length).toBeLessThanOrEqual(2);
    }
    expect(history.entries().map((record) => record.index)).toEqual([3, 4]);
  });

  it('becomes truncated at the first eviction, not before, and resets on clear', () => {
    const history = historyOf(2);
    expect(history.truncated).toBe(false);
    history.append(makeRecord(0));
    history.append(makeRecord(1));
    expect(history.truncated).toBe(false);
    history.append(makeRecord(2));
    expect(history.truncated).toBe(true);
    history.append(makeRecord(3));
    expect(history.truncated).toBe(true);
    history.clear();
    expect(history.truncated).toBe(false);
    history.append(makeRecord(4));
    expect(history.truncated).toBe(false);
  });
});

describe('execution history argument checks (HST-03)', () => {
  it.each([0, -1, 1.5, Number.NaN])('rejects limit %s with PLT-ARGUMENT', (limit) => {
    const result = createExecutionHistory(limit);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an error result');
    }
    expect(result.error.code).toBe('PLT-ARGUMENT');
  });

  it('accepts a limit of exactly 1', () => {
    const result = createExecutionHistory(1);
    expect(result.ok).toBe(true);
  });
});

describe('execution history entries (HST-05, SNP-03)', () => {
  it('returns the same frozen array until an append or clear', () => {
    const history = historyOf(3);
    history.append(makeRecord(0));
    const first = history.entries();
    expect(history.entries()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);

    history.append(makeRecord(1));
    const second = history.entries();
    expect(second).not.toBe(first);
    expect(second).toHaveLength(2);
    expect(first).toHaveLength(1);
    expect(history.entries()).toBe(second);

    history.clear();
    const third = history.entries();
    expect(third).not.toBe(second);
    expect(third).toHaveLength(0);
    expect(history.entries()).toBe(third);
  });

  it('lists entries oldest first', () => {
    const history = historyOf(3);
    history.append(makeRecord(7));
    history.append(makeRecord(8));
    expect(history.entries()).toEqual([makeRecord(7), makeRecord(8)]);
  });
});

describe('instruction recorder (EVENT_MODEL §10)', () => {
  it('builds the expected record from a full instruction with all four change kinds in order', () => {
    const recorder = createInstructionRecorder('OUT0');
    const records = recorder.record(LOAD_INSTRUCTION);
    expect(records).toEqual([EXPECTED_LOAD]);
  });

  it('keeps an instruction open across two record calls', () => {
    const recorder = createInstructionRecorder('OUT0');
    expect(recorder.record(LOAD_INSTRUCTION.slice(0, 4))).toEqual([]);
    const records = recorder.record(LOAD_INSTRUCTION.slice(4));
    expect(records).toEqual([EXPECTED_LOAD]);
  });

  it('produces no record for an instruction that never ends', () => {
    const recorder = createInstructionRecorder('OUT0');
    expect(recorder.record(LOAD_INSTRUCTION.slice(0, 7))).toEqual([]);
    expect(recorder.record([])).toEqual([]);
  });

  it('restarts index at 0 after reset and forgets an open instruction', () => {
    const recorder = createInstructionRecorder('OUT0');
    const first = only(recorder.record(LOAD_INSTRUCTION));
    const second = only(recorder.record(LOAD_INSTRUCTION));
    expect(first.index).toBe(0);
    expect(second.index).toBe(1);

    expect(recorder.record([ev('instruction-start', 7, { address: 0, mnemonic: 'NOP' })])).toEqual(
      [],
    );
    recorder.reset();
    expect(
      recorder.record([ev('instruction-end', 9, { address: 0, mnemonic: 'NOP', nextAddress: 1 })]),
    ).toEqual([]);
    const afterReset = only(recorder.record(LOAD_INSTRUCTION));
    expect(afterReset.index).toBe(0);
  });

  it('ignores unknown and namespaced kinds, including namespaced copies of shared kinds', () => {
    const recorder = createInstructionRecorder('OUT0');
    const records = recorder.record([
      ev('instruction-start', 1, { address: 0, mnemonic: 'NOP' }),
      ev('some-unknown-kind', 1, { register: 'R0', before: 0, after: 1 }),
      ev('alpha/custom', 1, { anything: true }),
      ev('alpha/register-write', 2, { register: 'R0', before: 0, after: 1 }),
      ev('bogus', 2, { address: 3, before: 0, after: 1 }),
      ev('instruction-end', 3, { address: 0, mnemonic: 'NOP', nextAddress: 1 }),
    ]);
    expect(only(records).changes).toEqual([]);
  });

  it('gives records with no explanation key', () => {
    const recorder = createInstructionRecorder('OUT0');
    const record = only(recorder.record(LOAD_INSTRUCTION));
    expect(Object.keys(record)).not.toContain('explanation');
    expect('explanation' in record).toBe(false);
  });

  it('freezes the result array, the record, its changes array and each change', () => {
    const recorder = createInstructionRecorder('OUT0');
    const records = recorder.record(LOAD_INSTRUCTION);
    const record = only(records);
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.changes)).toBe(true);
    expect(record.changes).toHaveLength(4);
    for (const change of record.changes) {
      expect(Object.isFrozen(change)).toBe(true);
    }
    expect(() => {
      (record.changes as StateChange[]).push({ target: 'R0', before: 0, after: 1 });
    }).toThrow();
    expect(record.changes).toHaveLength(4);
  });
});

describe('instruction recorder narrow readings', () => {
  it('ignores state-changing events that arrive with no open instruction', () => {
    const recorder = createInstructionRecorder('OUT0');
    expect(
      recorder.record([
        ev('register-write', 1, { register: 'R0', before: 0, after: 1 }),
        ev('flag-update', 1, { flag: 'F0', before: false, after: true }),
        ev('memory-write', 1, { address: 2, before: 0, after: 1 }),
        ev('output-emitted', 1, { before: 0, after: 1 }),
      ]),
    ).toEqual([]);
    const record = only(
      recorder.record([
        ev('instruction-start', 2, { address: 0, mnemonic: 'NOP' }),
        ev('instruction-end', 3, { address: 0, mnemonic: 'NOP', nextAddress: 1 }),
      ]),
    );
    expect(record.changes).toEqual([]);
  });

  it('ignores instruction-end with no open instruction and does not count it', () => {
    const recorder = createInstructionRecorder('OUT0');
    expect(
      recorder.record([ev('instruction-end', 1, { address: 0, mnemonic: 'NOP', nextAddress: 1 })]),
    ).toEqual([]);
    const record = only(
      recorder.record([
        ev('instruction-start', 2, { address: 0, mnemonic: 'NOP' }),
        ev('instruction-end', 3, { address: 0, mnemonic: 'NOP', nextAddress: 1 }),
      ]),
    );
    expect(record.index).toBe(0);
  });

  it('discards an unfinished instruction when a new instruction-start arrives', () => {
    const recorder = createInstructionRecorder('OUT0');
    const records = recorder.record([
      ev('instruction-start', 1, { address: 1, mnemonic: 'AAA' }),
      ev('register-write', 2, { register: 'R0', before: 0, after: 5 }),
      ev('instruction-start', 4, { address: 2, mnemonic: 'BBB' }),
      ev('flag-update', 5, { flag: 'F0', before: false, after: true }),
      ev('instruction-end', 6, { address: 2, mnemonic: 'BBB', nextAddress: 3 }),
    ]);
    expect(records).toEqual([
      {
        index: 0,
        startCycle: 4,
        endCycle: 6,
        address: 2,
        mnemonic: 'BBB',
        changes: [{ target: 'F0', before: false, after: true }],
      },
    ]);
  });

  it('adds no output change when outputRegisterName is undefined', () => {
    const recorder = createInstructionRecorder(undefined);
    const record = only(
      recorder.record([
        ev('instruction-start', 1, { address: 0, mnemonic: 'OUT' }),
        ev('output-emitted', 2, { before: 0, after: 9 }),
        ev('register-write', 2, { register: 'R1', before: 0, after: 4 }),
        ev('instruction-end', 3, { address: 0, mnemonic: 'OUT', nextAddress: 1 }),
      ]),
    );
    expect(record.changes).toEqual([{ target: 'R1', before: 0, after: 4 }]);
  });

  it('ignores an event whose payload lacks a required field', () => {
    const recorder = createInstructionRecorder('OUT0');
    expect(
      recorder.record([ev('instruction-start', 1, { address: '0', mnemonic: 'NOP' })]),
    ).toEqual([]);
    const record = only(
      recorder.record([
        ev('instruction-start', 2, { address: 4, mnemonic: 'MOV' }),
        ev('register-write', 3, { register: 'R0', before: 0 }),
        ev('instruction-end', 4, { address: 4, mnemonic: 'MOV' }),
        ev('instruction-end', 5, { address: 4, mnemonic: 'MOV', nextAddress: 5 }),
      ]),
    );
    expect(record.startCycle).toBe(2);
    expect(record.endCycle).toBe(5);
    expect(record.changes).toEqual([]);
  });
});
