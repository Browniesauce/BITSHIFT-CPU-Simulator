import { createArchitectureRegistry, createController } from '../../../src/platform';
import type {
  ControllerUpdate,
  CpuArchitecture,
  CpuInstance,
  ExecutionController,
  ProgramImage,
} from '../../../src/platform';
import { createFixtureArchitecture, defaultScript } from '../fixtures/fixture-architecture';
import type { FixtureCycle } from '../fixtures/fixture-architecture';

/** Identifier of the fixture used by the controller tests. Deliberately not a real CPU name. */
export const FIXTURE_ID = 'fixture-a';

/** Calls the controller made on the architecture and its instances. */
export interface ArchitectureCalls {
  createInstance: number;
  loadProgram: number;
  reset: number;
  stepClock: number;
  readState: number;
  /** Number of arguments of every instance call, in call order, tagged with the method name. */
  readonly argumentCounts: [method: string, count: number][];
}

/** Test-only hooks that make the wrapped architecture misbehave at a chosen call. */
export interface Hooks {
  /** Runs before the n-th createInstance (1-based). May throw. */
  readonly beforeCreate?: (n: number) => void;
  /** Runs before the n-th readState across all instances (1-based). May throw. */
  readonly beforeReadState?: (n: number) => void;
  /** Runs before the n-th instance reset across all instances (1-based). May throw. */
  readonly beforeReset?: (n: number) => void;
}

/** Wraps an architecture so that every call on it and on its instances is counted. */
export function counting(
  inner: CpuArchitecture,
  hooks: Hooks = {},
): { readonly architecture: CpuArchitecture; readonly calls: ArchitectureCalls } {
  const calls: ArchitectureCalls = {
    createInstance: 0,
    loadProgram: 0,
    reset: 0,
    stepClock: 0,
    readState: 0,
    argumentCounts: [],
  };
  const wrap = (instance: CpuInstance): CpuInstance => ({
    loadProgram(...args: [ProgramImage]) {
      calls.loadProgram += 1;
      calls.argumentCounts.push(['loadProgram', args.length]);
      return instance.loadProgram(...args);
    },
    reset(...args: []) {
      calls.reset += 1;
      calls.argumentCounts.push(['reset', args.length]);
      hooks.beforeReset?.(calls.reset);
      instance.reset();
    },
    stepClock(...args: []) {
      calls.stepClock += 1;
      calls.argumentCounts.push(['stepClock', args.length]);
      return instance.stepClock();
    },
    readState(...args: []) {
      calls.readState += 1;
      calls.argumentCounts.push(['readState', args.length]);
      hooks.beforeReadState?.(calls.readState);
      return instance.readState();
    },
  });
  const architecture: CpuArchitecture = {
    descriptor: inner.descriptor,
    visualization: inner.visualization,
    createInstance() {
      calls.createInstance += 1;
      hooks.beforeCreate?.(calls.createInstance);
      return wrap(inner.createInstance());
    },
  };
  return { architecture, calls };
}

/** A program image for the fixture: three recognisable bytes at address 0, entry 0. */
export function fixtureImage(overrides: Partial<ProgramImage> = {}): ProgramImage {
  return {
    architectureId: FIXTURE_ID,
    origin: 0,
    entry: 0,
    bytes: new Uint8Array([7, 8, 9]),
    symbols: {},
    sourceMap: [],
    ...overrides,
  };
}

/** Everything a controller test needs. */
export interface Harness {
  readonly controller: ExecutionController;
  readonly calls: ArchitectureCalls;
  readonly architecture: CpuArchitecture;
}

/** Builds a controller over a counted fixture. The default script is the fixture's own. */
export function makeHarness(
  options: {
    readonly script?: readonly FixtureCycle[];
    readonly historyLimit?: number;
    readonly hooks?: Hooks;
  } = {},
): Harness {
  const script = options.script ?? defaultScript(FIXTURE_ID);
  const fixture = createFixtureArchitecture({ architectureId: FIXTURE_ID, script });
  const { architecture, calls } = counting(fixture, options.hooks);
  const registry = createArchitectureRegistry([architecture]);
  if (!registry.ok) throw new Error(`fixture registry failed: ${registry.error.code}`);
  const controller = createController({
    registry: registry.value,
    architectureId: FIXTURE_ID,
    historyLimit: options.historyLimit ?? 100,
  });
  if (!controller.ok) throw new Error(`controller creation failed: ${controller.error.code}`);
  return { controller: controller.value, calls, architecture };
}

/** A harness with the fixture image already loaded. */
export function loadedHarness(options: Parameters<typeof makeHarness>[0] = {}): Harness {
  const harness = makeHarness(options);
  const loaded = harness.controller.load(fixtureImage());
  if (!loaded.ok) throw new Error(`load failed: ${loaded.error.code}`);
  return harness;
}

/** Unwraps a successful controller result, failing the test with the code otherwise. */
export function must<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: { readonly code: string } },
): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

/** The diagnostic code of a failed result, or 'ok'. */
export function codeOf(
  result: { readonly ok: true } | { readonly ok: false; readonly error: { readonly code: string } },
): string {
  return result.ok ? 'ok' : result.error.code;
}

/** The value of a named register in an update's snapshot. */
export function register(update: ControllerUpdate, name: string): number | undefined {
  return update.snapshot.registers.find((r) => r.name === name)?.value;
}

/** The value of a named flag in an update's snapshot. */
export function flag(update: ControllerUpdate, name: string): boolean | undefined {
  return update.snapshot.flags.find((f) => f.name === name)?.value;
}
