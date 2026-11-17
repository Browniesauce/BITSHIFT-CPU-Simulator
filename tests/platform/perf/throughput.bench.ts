// Throughput of the execution controller, through its public API only (test-only).
//
// What one iteration includes, for each of the four benches:
//   Timed body: drives the controller until it has completed exactly 40,000 clock cycles
//               (10,000 four-cycle instructions), using that bench's call pattern:
//               (1) runBatch(1000) repeatedly, (2) runBatch(1) repeatedly,
//               (3) stepInstruction() repeatedly, (4) stepClock() repeatedly.
//               It then checks that the cycle count reached 40,000.
//   Not timed:  beforeEach builds a fresh controller over a new fixture with the 10,000-instruction
//               script and loads it (historyLimit 10000). The runBatch benches then call beginRun;
//               the step benches stay in the ready state, because stepClock and stepInstruction
//               are refused while a run is in progress. Every iteration therefore starts from a
//               fresh controller and measures one complete run.
//
// The script is built once at module level. Options: 1 warmup iteration, 5 measured iterations,
// no time-based sampling, so that the heavy bodies finish quickly.
//
// API note: vitest 5.1 has no top-level bench export. Benches are registered through the `bench`
// fixture of a test (`test(name, async ({ bench }) => ...)`), with options as the second argument,
// and run with `.run()`. Each test gets a long timeout, because one bench is several full runs.
//
// Run: pnpm exec vitest bench --run tests/platform/perf/throughput.bench.ts

import { describe, test } from 'vitest';
import { createArchitectureRegistry, createController } from '../../../src/platform';
import type { ExecutionController } from '../../../src/platform';
import { createFixtureArchitecture } from '../fixtures/fixture-architecture';
import { FIXTURE_ID, fixtureImage, must } from '../helpers/controller-harness';
import { buildLongScript } from './long-script';

const INSTRUCTIONS = 10000;
const CYCLES_PER_INSTRUCTION = 4;
const TOTAL_CYCLES = INSTRUCTIONS * CYCLES_PER_INSTRUCTION;
const HISTORY_LIMIT = 10000;
const BATCH_CYCLES = 1000;
const TEST_TIMEOUT_MS = 600_000;

const SCRIPT = buildLongScript(INSTRUCTIONS);

let controller: ExecutionController | undefined;

/** Builds a fresh controller, loaded, and starts a run when asked. Runs outside the timed body. */
function prepare(startRun: boolean): void {
  // The fixture is used directly, not through the harness: the harness wraps every call in a
  // counting spy, and that bookkeeping would be measured as controller cost.
  const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script: SCRIPT });
  const registry = must(createArchitectureRegistry([fixture]));
  const created = must(
    createController({
      registry,
      architectureId: FIXTURE_ID,
      historyLimit: HISTORY_LIMIT,
    }),
  );
  must(created.load(fixtureImage()));
  if (startRun) must(created.beginRun());
  controller = created;
}

/** The controller prepared for the current iteration. */
function current(): ExecutionController {
  if (controller === undefined) throw new Error('prepare did not create a controller');
  return controller;
}

/** Cycles completed by one call. A call that completes none would loop forever, so it throws. */
function progress(result: ReturnType<ExecutionController['stepClock']>): number {
  const cycles = must(result).cyclesCompleted;
  if (cycles === 0) throw new Error('a controller call completed no cycles');
  return cycles;
}

/** Verifies that the iteration completed exactly the expected number of cycles. */
function expectComplete(c: ExecutionController): void {
  const cycle = c.snapshot().cycle;
  if (cycle !== TOTAL_CYCLES) throw new Error(`expected ${TOTAL_CYCLES} cycles, got ${cycle}`);
}

const BASE_OPTIONS = {
  iterations: 5,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};

/** Options for the runBatch benches: the controller is started before each iteration. */
const RUN_OPTIONS = { ...BASE_OPTIONS, beforeEach: (): void => prepare(true) };

/** Options for the step benches: the controller stays ready before each iteration. */
const STEP_OPTIONS = { ...BASE_OPTIONS, beforeEach: (): void => prepare(false) };

describe('controller throughput: 40,000 cycles (10,000 instructions), fresh run per iteration', () => {
  test(
    'runBatch(1000) until 40,000 cycles',
    async ({ bench }) => {
      await bench('runBatch(1000) until 40,000 cycles', RUN_OPTIONS, () => {
        const c = current();
        let done = 0;
        while (done < TOTAL_CYCLES) {
          done += progress(c.runBatch(BATCH_CYCLES));
        }
        expectComplete(c);
      }).run();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'runBatch(1) until 40,000 cycles',
    async ({ bench }) => {
      await bench('runBatch(1) until 40,000 cycles', RUN_OPTIONS, () => {
        const c = current();
        let done = 0;
        while (done < TOTAL_CYCLES) {
          done += progress(c.runBatch(1));
        }
        expectComplete(c);
      }).run();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'stepInstruction() until 40,000 cycles',
    async ({ bench }) => {
      await bench('stepInstruction() until 40,000 cycles', STEP_OPTIONS, () => {
        const c = current();
        let done = 0;
        while (done < TOTAL_CYCLES) {
          done += progress(c.stepInstruction());
        }
        expectComplete(c);
      }).run();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'stepClock() until 40,000 cycles',
    async ({ bench }) => {
      await bench('stepClock() until 40,000 cycles', STEP_OPTIONS, () => {
        const c = current();
        let done = 0;
        while (done < TOTAL_CYCLES) {
          done += progress(c.stepClock());
        }
        expectComplete(c);
      }).run();
    },
    TEST_TIMEOUT_MS,
  );
});
