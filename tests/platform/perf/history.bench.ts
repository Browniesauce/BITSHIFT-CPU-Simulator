// Benchmarks for the execution history ring (src/platform/history.ts).
//
// Each bench iteration does the same work: create a fresh history with the stated limit, then
// append 100,000 pre-built frozen InstructionRecords (three StateChange entries each). Record
// construction happens once, at module level, and is NOT measured.
//
// Cases:
//   1. limit 100,000: never evicts. Baseline cost of appends alone.
//   2. limit 10,000: evicts on 90,000 of the appends (Array.shift at the limit).
//   3. limit 10,000, entries() after EVERY append: the worst reader. Each call builds a new
//      frozen copy of up to 10,000 records, so this case is intentionally slow.
//   4. limit 10,000, entries() after every 40 appends. Assumption: the UI reads the history about
//      once per animation frame, and the simulator runs about 10 instructions per frame, so one
//      read per 40 appends (10 instructions x 4 cycles per instruction in the fixture).
//
// Every iteration of every case ends with the entries() length added to `sink`, so the reads
// cannot be optimised away.
//
// API note: vitest 5.1 has no top-level bench export. Benches are registered through the `bench`
// fixture of a test: `test(name, async ({ bench }) => bench(name, fn).run(options))`. The run
// options (iterations, time, warmupIterations) go to `.run()`.
//
// Run: pnpm exec vitest bench --run tests/platform/perf/history.bench.ts

import { describe, test } from 'vitest';
import { createExecutionHistory } from '../../../src/platform/history';
import type { ExecutionHistory } from '../../../src/platform/history';
import type { InstructionRecord, StateChange } from '../../../src/platform/types';

const RECORD_COUNT = 100_000;
const SMALL_LIMIT = 10_000;
const LARGE_LIMIT = 100_000;
const READ_EVERY_APPENDS = 40;
const MNEMONICS = ['LDA', 'ADD', 'STA', 'JMP'] as const;
const RUN_OPTIONS = { iterations: 5, time: 0, warmupIterations: 1 } as const;

/** Per-test timeout: case 3 takes about a second per iteration, so the default 60 s is too short. */
const TEST_TIMEOUT_MS = 600_000;

/** Builds frozen records shaped like the recorder's output: three changes each. */
function buildRecords(count: number): readonly InstructionRecord[] {
  const records: InstructionRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const changes: readonly StateChange[] = Object.freeze([
      Object.freeze({ target: 'W', before: i, after: i + 1 }),
      Object.freeze({ target: 'IP', before: i % 64, after: (i + 1) % 64 }),
      Object.freeze({ target: 'F1', before: false, after: (i & 1) === 0 }),
    ]);
    records.push(
      Object.freeze({
        index: i,
        startCycle: i * 4 + 1,
        endCycle: i * 4 + 4,
        address: i % 64,
        mnemonic: MNEMONICS[i % MNEMONICS.length] ?? 'LDA',
        changes,
      }),
    );
  }
  return Object.freeze(records);
}

/** Pre-built once at module level; outside every measured body. */
const RECORDS = buildRecords(RECORD_COUNT);

/** Receives the entries() lengths so the reads are observable. */
const sink = { total: 0 };

/** Creates a history with the given limit. A bad limit is a programmer error here. */
function freshHistory(limit: number): ExecutionHistory {
  const created = createExecutionHistory(limit);
  if (!created.ok) {
    throw new Error(`history creation failed for limit ${String(limit)}`);
  }
  return created.value;
}

describe('execution history: 100,000 appends per iteration', () => {
  test(
    'limit 100,000, no eviction, no reads (baseline)',
    async ({ bench }) => {
      await bench('limit 100,000, no eviction, no reads (baseline)', () => {
        const history = freshHistory(LARGE_LIMIT);
        for (const record of RECORDS) {
          history.append(record);
        }
        sink.total += history.entries().length;
      }).run(RUN_OPTIONS);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'limit 10,000, evicts on 90,000 appends, one read at the end',
    async ({ bench }) => {
      await bench('limit 10,000, evicts on 90,000 appends, one read at the end', () => {
        const history = freshHistory(SMALL_LIMIT);
        for (const record of RECORDS) {
          history.append(record);
        }
        sink.total += history.entries().length;
      }).run(RUN_OPTIONS);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'limit 10,000, entries() after every append (worst reader)',
    async ({ bench }) => {
      await bench('limit 10,000, entries() after every append (worst reader)', () => {
        const history = freshHistory(SMALL_LIMIT);
        for (const record of RECORDS) {
          history.append(record);
          sink.total += history.entries().length;
        }
      }).run(RUN_OPTIONS);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'limit 10,000, entries() after every 40 appends (one read per frame)',
    async ({ bench }) => {
      await bench('limit 10,000, entries() after every 40 appends (one read per frame)', () => {
        const history = freshHistory(SMALL_LIMIT);
        let appended = 0;
        for (const record of RECORDS) {
          history.append(record);
          appended += 1;
          if (appended % READ_EVERY_APPENDS === 0) {
            sink.total += history.entries().length;
          }
        }
      }).run(RUN_OPTIONS);
    },
    TEST_TIMEOUT_MS,
  );
});
