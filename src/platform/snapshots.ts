import type { Diagnostic } from './result';
import type { ArchitectureId, ClockCycle, CpuSnapshot, CpuState, CpuStateCopy } from './types';

/** Builds a frozen platform snapshot from an architecture copy and platform-owned fields (MODULE_CONTRACTS §2.6, DATA_CONTRACTS §4.2-§4.4). */
export function buildSnapshot<TDetails>(
  copy: CpuStateCopy<TDetails>,
  meta: {
    readonly architectureId: ArchitectureId;
    readonly cycle: ClockCycle;
    readonly state: CpuState;
    readonly lastFault?: Diagnostic;
  },
): CpuSnapshot<TDetails> {
  const registers = copy.registers.map((register) => Object.freeze({ ...register }));
  const flags = copy.flags.map((flag) => Object.freeze({ ...flag }));
  const details = 'details' in copy ? { details: copy.details } : {};
  const lastFault = meta.lastFault !== undefined ? { lastFault: meta.lastFault } : {};

  return Object.freeze({
    architectureId: meta.architectureId,
    cycle: meta.cycle,
    state: meta.state,
    programCounter: copy.programCounter,
    registers: Object.freeze(registers),
    flags: Object.freeze(flags),
    memory: new Uint8Array(copy.memory),
    ...details,
    ...lastFault,
  });
}
