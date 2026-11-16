import { describe, expectTypeOf, it } from 'vitest';
import type {
  ArchitectureDescriptor,
  ArchitectureEvent,
  ControllerUpdate,
  CpuSnapshot,
  CpuStateCopy,
  ExecutionEvent,
  RegisterValue,
  SharedEventKind,
  SharedEventPayloads,
  StepOutcome,
} from '../../src/platform';

describe('contract types', () => {
  it('StepOutcome has exactly the contract keys (CYC-09)', () => {
    expectTypeOf<keyof StepOutcome>().toEqualTypeOf<
      'cyclesCompleted' | 'instructionCompleted' | 'halted' | 'fault' | 'events'
    >();
  });

  it('ArchitectureEvent has exactly the contract keys', () => {
    expectTypeOf<keyof ArchitectureEvent>().toEqualTypeOf<'kind' | 'cycleOffset' | 'payload'>();
  });

  it('ExecutionEvent has exactly the contract keys', () => {
    expectTypeOf<keyof ExecutionEvent>().toEqualTypeOf<'kind' | 'cycle' | 'sequence' | 'payload'>();
  });

  it('ArchitectureDescriptor has no id and no programCounter', () => {
    expectTypeOf<'id' extends keyof ArchitectureDescriptor ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<
      'programCounter' extends keyof ArchitectureDescriptor ? true : false
    >().toEqualTypeOf<false>();
  });

  it('CpuStateCopy has no platform fields and CpuSnapshot has them', () => {
    expectTypeOf<'cycle' extends keyof CpuStateCopy ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'state' extends keyof CpuStateCopy ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'architectureId' extends keyof CpuSnapshot ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<'cycle' extends keyof CpuSnapshot ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<'state' extends keyof CpuSnapshot ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<'lastFault' extends keyof CpuSnapshot ? true : false>().toEqualTypeOf<true>();
  });

  it('the shared micro-operation payload has only controlSignals', () => {
    expectTypeOf<keyof SharedEventPayloads['micro-operation']>().toEqualTypeOf<'controlSignals'>();
  });

  it('SharedEventKind is exactly the twelve kinds of EVENT_MODEL 3.2', () => {
    expectTypeOf<SharedEventKind>().toEqualTypeOf<
      | 'micro-operation'
      | 'bus-transfer'
      | 'register-write'
      | 'memory-read'
      | 'memory-write'
      | 'alu-operation'
      | 'flag-update'
      | 'output-emitted'
      | 'instruction-start'
      | 'instruction-end'
      | 'halted'
      | 'fault'
    >();
  });

  it('collection fields are readonly arrays', () => {
    expectTypeOf<CpuSnapshot['registers']>().toEqualTypeOf<readonly RegisterValue[]>();
    expectTypeOf<ControllerUpdate['events']>().toEqualTypeOf<readonly ExecutionEvent[]>();
  });
});
