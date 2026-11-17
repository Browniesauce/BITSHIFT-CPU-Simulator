// Approximate heap growth of the execution history and of a controller that has run 10,000
// instructions. A plain script: not a test and not a bench, and the name matches neither the test
// nor the bench include pattern.
//
// Run from the repository root (no new dependency, no config change; it uses the installed Vite
// to load this TypeScript file, and needs Node's --expose-gc for exact collections):
//
//   node --expose-gc --input-type=module -e "import { createServer } from 'vite'; const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } }); await server.ssrLoadModule('/tests/platform/perf/history-memory.ts'); await server.close();"
//
// Method: process.memoryUsage().heapUsed is read after several global.gc() calls, once before
// the scenario is built and once after. The difference is an approximation of what the scenario
// retains. It includes anything else allocated in that window and is noisy at the KB level.
// Without --expose-gc the figures are much less reliable and the script says so.

import { createArchitectureRegistry, createController } from '../../../src/platform';
import { createExecutionHistory } from '../../../src/platform/history';
import type { InstructionRecord, StateChange } from '../../../src/platform/types';
import { createFixtureArchitecture } from '../fixtures/fixture-architecture';
import type { FixtureCycle } from '../fixtures/fixture-architecture';
import { FIXTURE_ID, fixtureImage } from '../helpers/controller-harness';

const HISTORY_LIMIT = 10_000;
const INSTRUCTIONS = 10_000;
const CYCLES_PER_INSTRUCTION = 4;
const MNEMONICS = ['LDA', 'ADD', 'STA', 'JMP'] as const;

/** Objects kept alive until the end, so that the measured heap stays referenced. */
const holders: unknown[] = [];

type GcFunction = () => void;

/** Calls global.gc() several times when Node was started with --expose-gc. */
function collect(): boolean {
  const gc = (globalThis as { gc?: GcFunction }).gc;
  if (gc === undefined) {
    return false;
  }
  for (let pass = 0; pass < 3; pass += 1) {
    gc();
  }
  return true;
}

function heapUsed(): number {
  return process.memoryUsage().heapUsed;
}

/** Builds one frozen record shaped like the recorder's output: three changes. */
function makeRecord(index: number): InstructionRecord {
  const changes: readonly StateChange[] = Object.freeze([
    Object.freeze({ target: 'W', before: index, after: index + 1 }),
    Object.freeze({ target: 'IP', before: index % 64, after: (index + 1) % 64 }),
    Object.freeze({ target: 'F1', before: false, after: (index & 1) === 0 }),
  ]);
  return Object.freeze({
    index,
    startCycle: index * CYCLES_PER_INSTRUCTION + 1,
    endCycle: index * CYCLES_PER_INSTRUCTION + CYCLES_PER_INSTRUCTION,
    address: index % 64,
    mnemonic: MNEMONICS[index % MNEMONICS.length] ?? 'LDA',
    changes,
  });
}

/**
 * Fixture script of `count` instructions, four cycles each: instruction-start, a W register-write,
 * an IP register-write (IP wraps at 64), and instruction-end with instructionCompleted. Every
 * "before" value equals the value the previous cycle left, and W stays below 65536.
 */
function buildScript(count: number): FixtureCycle[] {
  const cycles: FixtureCycle[] = [];
  let ip = 0;
  let w = 0;
  for (let i = 0; i < count; i += 1) {
    const nextIp = (ip + 1) % 64;
    const nextW = (i * 3 + 1) % 65536;
    cycles.push({
      events: [{ kind: 'instruction-start', payload: { address: ip, mnemonic: 'OP-A' } }],
    });
    cycles.push({
      events: [{ kind: 'register-write', payload: { register: 'W', before: w, after: nextW } }],
    });
    cycles.push({
      events: [{ kind: 'register-write', payload: { register: 'IP', before: ip, after: nextIp } }],
    });
    cycles.push({
      events: [
        {
          kind: 'instruction-end',
          payload: { address: ip, mnemonic: 'OP-A', nextAddress: nextIp },
        },
      ],
      instructionCompleted: true,
    });
    ip = nextIp;
    w = nextW;
  }
  return cycles;
}

interface Measurement {
  readonly label: string;
  readonly bytes: number;
  readonly records: number;
}

function report(measurement: Measurement, gcUsed: boolean): void {
  const mb = measurement.bytes / (1024 * 1024);
  const perRecord = measurement.bytes / measurement.records;
  console.log(measurement.label);
  console.log(`  heap growth: ${String(measurement.bytes)} bytes (${mb.toFixed(2)} MB)`);
  console.log(`  records: ${String(measurement.records)}`);
  console.log(`  per record: ${perRecord.toFixed(1)} bytes`);
  if (!gcUsed) {
    console.log('  WARNING: global.gc is not available; run with --expose-gc. Figures are rough.');
  }
}

/** (a) A history holding 10,000 frozen records, with entries() read once. */
function measureHistory(): Measurement {
  const gcUsed = collect();
  const before = heapUsed();

  const created = createExecutionHistory(HISTORY_LIMIT);
  if (!created.ok) {
    throw new Error(`history creation failed: ${created.error.code}`);
  }
  const history = created.value;
  const records: InstructionRecord[] = [];
  for (let i = 0; i < HISTORY_LIMIT; i += 1) {
    const record = makeRecord(i);
    records.push(record);
    history.append(record);
  }
  const snapshot = history.entries();
  holders.push(records, history, snapshot);

  collect();
  const after = heapUsed();

  const measurement = {
    label: '(a) history of 10,000 records',
    bytes: after - before,
    records: HISTORY_LIMIT,
  };
  report(measurement, gcUsed);
  return measurement;
}

/** (b) A controller that has run 10,000 instructions (40,000 cycles) with historyLimit 10,000. */
function measureController(): Measurement {
  // The script is the test input, so it is built before the baseline and not counted.
  const script = buildScript(INSTRUCTIONS);
  const gcUsed = collect();
  const before = heapUsed();

  const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script });
  const registry = createArchitectureRegistry([fixture]);
  if (!registry.ok) {
    throw new Error(`registry failed: ${registry.error.code}`);
  }
  const controller = createController({
    registry: registry.value,
    architectureId: FIXTURE_ID,
    historyLimit: HISTORY_LIMIT,
  });
  if (!controller.ok) {
    throw new Error(`controller failed: ${controller.error.code}`);
  }
  const loaded = controller.value.load(fixtureImage());
  if (!loaded.ok) {
    throw new Error(`load failed: ${loaded.error.code}`);
  }
  for (let cycle = 0; cycle < INSTRUCTIONS * CYCLES_PER_INSTRUCTION; cycle += 1) {
    const stepped = controller.value.stepClock();
    if (!stepped.ok) {
      throw new Error(`stepClock failed at cycle ${String(cycle)}: ${stepped.error.code}`);
    }
  }
  const historyLength = controller.value.history().length;
  if (historyLength !== HISTORY_LIMIT) {
    throw new Error(`expected ${String(HISTORY_LIMIT)} records, found ${String(historyLength)}`);
  }

  holders.push(controller.value, fixture, registry.value, script);
  collect();
  const after = heapUsed();

  const measurement = {
    label: '(b) controller after 10,000 instructions (40,000 cycles), historyLimit 10,000',
    bytes: after - before,
    records: historyLength,
  };
  report(measurement, gcUsed);
  return measurement;
}

function main(): void {
  console.log('Approximate heap measurement (process.memoryUsage().heapUsed, after global.gc).');
  console.log('This method is approximate; see the header of this file.');
  console.log('');
  measureHistory();
  console.log('');
  measureController();
  console.log('');
  console.log(`Retained objects: ${String(holders.length)} (kept alive until exit).`);
}

main();
