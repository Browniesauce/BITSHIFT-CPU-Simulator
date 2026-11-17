import { describe, expect, it } from 'vitest';
import { loadedHarness, must } from '../helpers/controller-harness';
import { applyCycle, replayableOf } from '../helpers/replay';
import { buildLongScript } from './long-script';

// Correctness of a long run, not its speed. Expected values come from the script's definition
// (four cycles per instruction, IP advancing by one, F1 toggled by even instructions), not from
// the controller's output.

const INSTRUCTIONS = 50;
const CYCLES = 4 * INSTRUCTIONS;
const HISTORY_LIMIT = 10000;

describe('PERF long script through the controller', () => {
  it('runs 50 instructions in 200 cycles with no fault and 50 history records', () => {
    const harness = loadedHarness({
      script: buildLongScript(INSTRUCTIONS),
      historyLimit: HISTORY_LIMIT,
    });
    const { controller } = harness;

    must(controller.beginRun());
    const update = must(controller.runBatch(CYCLES));

    expect(update.reason).toBe('run-batch');
    expect(update.cyclesCompleted).toBe(CYCLES);
    expect(update.snapshot.cycle).toBe(CYCLES);
    expect(update.snapshot.state).toBe('running');
    expect(update.events.some((e) => e.kind === 'fault')).toBe(false);
    expect(harness.calls.stepClock).toBe(CYCLES);

    const records = controller.history();
    expect(records).toHaveLength(INSTRUCTIONS);
    records.forEach((record, i) => {
      expect(record.index).toBe(i);
      expect(record.startCycle).toBe(4 * i + 1);
      expect(record.endCycle).toBe(4 * i + 4);
      expect(record.address).toBe(i);
      expect(record.mnemonic).toBe(i % 2 === 0 ? 'OP-A' : 'OP-B');
    });

    // IP ends at 50 (no wrap yet). F1 is toggled by the 25 even instructions, so it ends true.
    expect(update.snapshot.programCounter).toBe(INSTRUCTIONS);
    expect(update.snapshot.flags.find((f) => f.name === 'F1')?.value).toBe(true);
  });

  it('the replay checker accepts every one of the 200 cycles of the long script', () => {
    const harness = loadedHarness({
      script: buildLongScript(INSTRUCTIONS),
      historyLimit: HISTORY_LIMIT,
    });
    const { controller, architecture } = harness;
    const descriptor = architecture.descriptor;

    // stepClock is allowed from the ready state after a load; beginRun is not needed.
    let previous = controller.snapshot();
    for (let c = 1; c <= CYCLES; c += 1) {
      const update = must(controller.stepClock());
      expect(update.cyclesCompleted).toBe(1);
      expect(update.snapshot.cycle).toBe(c);

      const cycleEvents = update.events.filter((e) => e.cycle === c);
      const replayed = applyCycle(replayableOf(previous, descriptor), cycleEvents, descriptor);
      if (!replayed.ok) throw new Error(`replay failed at cycle ${c}: ${replayed.violation}`);
      expect(replayed.state).toEqual(replayableOf(update.snapshot, descriptor));
      previous = update.snapshot;
    }

    expect(controller.history()).toHaveLength(INSTRUCTIONS);
  });
});
