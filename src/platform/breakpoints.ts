import { err, ok } from './result';
import type { Diagnostic, Result } from './result';
import type { Address } from './types';

/** A set of platform-owned breakpoint addresses (MODULE_CONTRACTS §2.8). */
export interface BreakpointSet {
  /** Replaces the whole set after validating every address; on error the set is unchanged (MODULE_CONTRACTS §2.8). */
  replace(addresses: readonly Address[], addressBits: number): Result<void, Diagnostic>;
  /** Reports whether the address is in the set (MODULE_CONTRACTS §2.8). */
  has(address: Address): boolean;
  /** The current addresses, sorted ascending, unique and frozen (MODULE_CONTRACTS §2.8). */
  readonly addresses: readonly Address[]; // sorted ascending
}

/** Creates an empty breakpoint set (MODULE_CONTRACTS §2.8). */
export function createBreakpointSet(): BreakpointSet {
  let sorted: readonly Address[] = Object.freeze([]);
  let members: ReadonlySet<Address> = new Set<Address>();

  return {
    replace(addresses: readonly Address[], addressBits: number): Result<void, Diagnostic> {
      const limit = 2 ** addressBits;
      const accepted = new Set<Address>();
      for (const address of addresses) {
        if (!Number.isInteger(address)) {
          return err({
            code: 'PLT-ARGUMENT',
            severity: 'error',
            message: `Breakpoint address ${String(address)} is not an integer.`,
          });
        }
        if (address < 0 || address >= limit) {
          return err({
            code: 'PLT-BREAKPOINT-RANGE',
            severity: 'error',
            message: `Breakpoint address ${String(address)} is outside the ${String(addressBits)}-bit address range.`,
          });
        }
        accepted.add(address);
      }
      sorted = Object.freeze([...accepted].sort((a, b) => a - b));
      members = accepted;
      return ok(undefined);
    },
    has(address: Address): boolean {
      return members.has(address);
    },
    get addresses(): readonly Address[] {
      return sorted;
    },
  };
}
