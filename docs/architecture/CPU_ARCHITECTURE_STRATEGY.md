# BITSHIFT — CPU Architecture Strategy

**Status:** Proposed (B). The principle that architectures own their semantics is product-owner stated (A).
**Related:** [SIMULATION_PLATFORM.md](SIMULATION_PLATFORM.md), [ADR-001](../decisions/ADR-001-modular-simulation-platform.md), [BITSHIFT-8 ISA draft](../specifications/BITSHIFT-8_ISA.md)

---

## 1. Principle

Each CPU is a self-contained architecture package. The platform standardises how the application talks to a CPU. It does not force all CPUs to share registers, flags, word sizes, instruction formats or micro-operation sets.

This is the central decision that makes BITSHIFT-16 and RISC-V RV32I (v3.0) possible without rewriting the platform. See [ADR-001](../decisions/ADR-001-modular-simulation-platform.md).

## 2. What Is Shared and What Is Not

| Concern                                                                         | Shared (platform) | Per architecture                                                  |
| ------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| Lifecycle (create, load, reset, halt, fault)                                    | Yes               | —                                                                 |
| Step, run and breakpoint control                                                | Yes               | —                                                                 |
| Event envelope (tick, kind, payload)                                            | Yes               | Payload types per architecture                                    |
| Snapshot envelope (architecture ID, tick, halted, PC, register list, flag list) | Yes               | Register names, widths, flag names, extra fields                  |
| Program image container (origin, bytes, source map)                             | Yes               | Byte encoding rules                                               |
| Register set                                                                    | —                 | Yes                                                               |
| Flags                                                                           | —                 | Yes                                                               |
| Word and address width                                                          | —                 | Yes                                                               |
| Memory size and layout                                                          | —                 | Yes                                                               |
| ALU operations                                                                  | —                 | Yes                                                               |
| Instruction set and encoding                                                    | —                 | Yes (exposed through an ISA descriptor)                           |
| Decode and execute semantics                                                    | —                 | Yes                                                               |
| Micro-operation set                                                             | —                 | Yes (within the shared micro-operation envelope, see EVENT_MODEL) |
| Visualization adapter                                                           | —                 | Yes (per architecture view model)                                 |

## 3. Architecture Package Layout

Every architecture lives under `src/architectures/<architecture-id>/` with the same internal shape. Files are created only when the phase that needs them starts (no speculative files).

```
src/architectures/bitshift-8/
├── descriptor.ts       # ArchitectureDescriptor: id, name, version, ISA descriptor, memory layout
├── isa.ts              # Instruction table: mnemonic, opcode, operand kinds, byte length
├── registers.ts        # Register and flag definitions
├── alu.ts              # ALU operations and flag rules
├── decode.ts           # Opcode → instruction mapping
├── microcode.ts        # Micro-operation sequences per instruction (or semantics module)
├── instance.ts         # CpuInstance implementation
├── snapshot.ts         # Snapshot builder
├── visualization.ts    # Adapter: snapshot + events → datapath view model
└── index.ts            # Public entry: exports the descriptor only
```

Only `index.ts` is public. Other modules are internal to the package.

## 4. Registration Strategy (B)

**Decision proposed:** a single explicit registry module, with static imports, lists every architecture.

```ts
// src/platform/registry.ts (contract, not yet implemented)
export const architectures: readonly ArchitectureDescriptor[] = [
  bitshift8Descriptor,
  // future: bitshift16Descriptor, riscv32iDescriptor
];
```

Why this and not alternatives:

| Option                                    | Verdict                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Static list in one module (chosen)        | Simple, tree-shakeable, easy to test, no runtime discovery                              |
| Dynamic plugin loading from files or URLs | Rejected for v1.0. Needs security review and a plugin API. Not justified by v1.0 scope. |
| Automatic discovery via file-system glob  | Rejected. Hides dependencies and complicates the build.                                 |
| Dependency-injection container            | Rejected. Adds abstraction with no benefit at this size.                                |

Adding a new architecture in a later release must require: a new package directory, one entry in the registry, and tests in `tests/architectures/<id>/`. No platform code change.

## 5. Architecture Descriptor (contract summary)

The descriptor is the only thing the rest of the application reads at startup. Full type is in [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md).

| Field              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `id`               | Stable identifier, lowercase kebab-case, e.g. `bitshift-8`   |
| `displayName`      | Human name, e.g. `BITSHIFT-8`                                |
| `wordBits`         | Data width (8 for BITSHIFT-8)                                |
| `addressBits`      | Address width (8 for BITSHIFT-8)                             |
| `memoryBytes`      | Memory size (256 for BITSHIFT-8)                             |
| `registers`        | Generic list of register definitions (name, width, role)     |
| `flags`            | Generic list of flag definitions (name, bit)                 |
| `isa`              | Instruction descriptor used by the assembler and the decoder |
| `createInstance()` | Factory for a `CpuInstance`                                  |

## 6. Assembler and Architecture Coupling (B)

- The assembler does not know BITSHIFT-8 mnemonics. It reads the ISA descriptor provided by the selected architecture.
- The ISA descriptor provides mnemonics, operand kinds, opcode values and byte lengths. Encoding rules that go beyond this table belong to the architecture.
- Whether the ISA descriptor is data-only (a table) or code (functions) is open (DR-015).

## 7. Visualization and Architecture Coupling (B)

- Each architecture supplies a visualization adapter that maps its snapshot and events to a view model.
- The shared visualization components accept generic view-model shapes (for example, "bus with label and active state"). Architecture-specific layouts are data, not forked components.
- A new architecture may need a new datapath diagram. That diagram is an SVG asset plus a layout definition, not a change to the platform.

## 8. Testing Strategy per Architecture

- Each architecture has its own conformance suite in `tests/architectures/<id>/`.
- The platform is tested with a **test-only fixture architecture** in `tests/platform/` that implements the contracts with trivial semantics. The fixture is not shipped and is not a CPU. This proves the platform does not depend on BITSHIFT-8.

## 9. Anti-Patterns (rejected)

- A shared "universal register file" that every architecture must fit into.
- Platform code that branches on `architectureId`. Architecture differences must be expressed through descriptor data or the adapter interface.
- Architectures importing each other's internals.
- Visualization code that reads CPU internals directly rather than through a snapshot.
- Adding v2 or v3 architectures "to be ready". Build the contracts and stop there.

## 10. Open Questions

- Whether the ISA descriptor is data-only (DR-015).
- Whether micro-operations are visible to the platform as generic events or as architecture-typed payloads (DR-013).
- Whether an architecture may define its own event kinds (DR-014).
