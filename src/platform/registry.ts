import { err, ok } from './result';
import type { Diagnostic, Result } from './result';
import type { ArchitectureDescriptor, ArchitectureId, CpuArchitecture } from './types';

/** Validated, read-only collection of architectures with lookup by identifier (MODULE_CONTRACTS §2.1). */
export interface ArchitectureRegistry {
  readonly architectures: readonly CpuArchitecture[];
  lookup(id: ArchitectureId): Result<CpuArchitecture, Diagnostic>;
}

const IDENTIFIER = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function error(code: string, message: string): Diagnostic {
  return { code, severity: 'error', message };
}

function invalid(message: string): Diagnostic {
  return error('ARCH-INVALID-DESCRIPTOR', message);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

/** Returns a diagnostic for the first failed check of DATA_CONTRACTS §3.2, or undefined. */
function validateDescriptor(descriptor: ArchitectureDescriptor): Diagnostic | undefined {
  const { wordBits, addressBits, memoryBytes, isa } = descriptor;

  if (!IDENTIFIER.test(isa.architectureId)) {
    return invalid(`Architecture identifier "${isa.architectureId}" is not lowercase kebab-case.`);
  }

  if (!isPositiveInteger(wordBits)) return invalid('wordBits must be a positive integer.');
  if (!isPositiveInteger(addressBits)) return invalid('addressBits must be a positive integer.');
  if (!isPositiveInteger(memoryBytes)) return invalid('memoryBytes must be a positive integer.');
  if (memoryBytes > 2 ** addressBits) {
    return invalid('memoryBytes must not exceed 2 to the power of addressBits.');
  }

  const registerName = firstDuplicate(descriptor.registers.map((r) => r.name));
  if (registerName !== undefined) return invalid(`Register name "${registerName}" is duplicated.`);
  for (const register of descriptor.registers) {
    if (!isPositiveInteger(register.bits)) {
      return invalid(`Register "${register.name}" bits must be a positive integer.`);
    }
  }
  const outputCount = descriptor.registers.filter((r) => r.role === 'output').length;
  if (outputCount > 1) return invalid('At most one register may have role "output".');
  const programCounterCount = descriptor.registers.filter(
    (r) => r.role === 'program-counter',
  ).length;
  if (programCounterCount > 1) {
    return invalid('At most one register may have role "program-counter".');
  }
  const flagName = firstDuplicate(descriptor.flags.map((f) => f.name));
  if (flagName !== undefined) return invalid(`Flag name "${flagName}" is duplicated.`);

  const pairs = isa.instructions.map((i) => JSON.stringify([i.mnemonic, i.variant ?? null]));
  if (firstDuplicate(pairs) !== undefined) {
    return invalid('An instruction (mnemonic, variant) pair is duplicated.');
  }
  const seenOpcodes = new Set<number>();
  for (const { mnemonic, opcode } of isa.instructions) {
    if (!Number.isInteger(opcode) || opcode < 0 || opcode >= 2 ** wordBits) {
      return invalid(`Opcode of "${mnemonic}" is not an integer that fits in wordBits.`);
    }
    if (seenOpcodes.has(opcode)) return invalid(`Opcode ${opcode} is used more than once.`);
    seenOpcodes.add(opcode);
  }
  return undefined;
}

/** Validates the supplied architectures and builds a registry in the given order (MODULE_CONTRACTS §2.1). */
export function createArchitectureRegistry(
  architectures: readonly CpuArchitecture[],
): Result<ArchitectureRegistry, Diagnostic> {
  const entries = Object.freeze([...architectures]);
  const byId = new Map<ArchitectureId, CpuArchitecture>();

  for (const architecture of entries) {
    const diagnostic = validateDescriptor(architecture.descriptor);
    if (diagnostic !== undefined) return err(diagnostic);
  }
  for (const architecture of entries) {
    const id = architecture.descriptor.isa.architectureId;
    if (byId.has(id)) {
      return err(
        error('ARCH-DUPLICATE-ID', `Architecture identifier "${id}" is registered twice.`),
      );
    }
    byId.set(id, architecture);
  }

  return ok({
    architectures: entries,
    lookup(id: ArchitectureId): Result<CpuArchitecture, Diagnostic> {
      const found = byId.get(id);
      return found === undefined
        ? err(error('ARCH-UNKNOWN-ID', `No architecture is registered with identifier "${id}".`))
        : ok(found);
    },
  });
}
