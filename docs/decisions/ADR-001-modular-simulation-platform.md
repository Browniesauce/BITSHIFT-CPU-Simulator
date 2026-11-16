# ADR-001: Modular Simulation Platform and Multi-Architecture Direction

**Status:** Proposed. Pending product-owner approval.
**Date:** 2026-11-16
**Deciders:** Product owner (approval pending)
**Related:** [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md), [RELEASE_ROADMAP.md](../product/RELEASE_ROADMAP.md)

---

## Context

BITSHIFT v1.0 ships one CPU, BITSHIFT-8. v3.0 is directional and plans BITSHIFT-16 and RISC-V RV32I. The product owner requires that simulation logic stay independent of presentation, that the simulation be deterministic, and that shared infrastructure not assume identical registers or instruction formats.

The application must therefore be organised so that:

1. The CPU core can be built and tested without the UI.
2. The UI can control any CPU through one interface.
3. A second architecture can be added without rewriting the platform, and without shipping speculative code now.

## Decision

Adopt a **modular simulation platform** with these parts:

1. **Simulation platform** (`src/platform/`): architecture registry, lifecycle, execution controller, event handling, snapshots and bounded history. It knows nothing about any specific CPU.
2. **Architecture packages** (`src/architectures/<id>/`): each CPU owns its registers, memory layout, ALU, decoding, micro-operations, ISA descriptor and visualization adapter.
3. **Assembler** (`src/assembler/`): converts text to a program image using the target architecture's ISA descriptor.
4. **Visualization** (`src/visualization/`): renders view models derived from snapshots and events.
5. **Application** (`src/app/`, `src/features/`, `src/components/`, `src/store/`): UI and state, which communicate with the platform only through the execution controller and typed snapshots.

Shared structure is limited to **generic envelopes**: architecture descriptor, snapshot envelope (with generic register and flag lists), execution event envelope, and program image. Everything CPU-specific sits behind the architecture package.

Architectures are **registered explicitly** in one module with static imports. No runtime plugin loading and no dependency-injection container.

Platform implementation is **not started** until this ADR and the platform-relevant decisions in the decision register are approved.

## Alternatives Considered

| Option                                                     | Description                                                                                                | Why not chosen                                                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Single hard-coded CPU                                   | One CPU class wired directly into UI components.                                                           | Makes v3.0 a rewrite. Violates the "UI must not modify CPU internals" rule. Hard to test.                                                             |
| B. Universal CPU model                                     | One generic CPU with configurable registers, word sizes and instruction formats, covering all future CPUs. | Premature abstraction. Forces the v1 code to model cases it does not need. Likely to fit RISC-V poorly. Violates "architectures own their semantics". |
| C. Plugin framework                                        | Architectures loaded dynamically at runtime with a plugin API and manifest.                                | Adds a public API, versioning burden and security review for no v1.0 benefit. Contradicts "avoid unnecessary plugin frameworks".                      |
| D. Chosen: modular platform with per-architecture packages | Shared lifecycle, events and snapshots; CPU semantics per package; explicit registry.                      | Chosen.                                                                                                                                               |
| E. Separate application per architecture                   | Duplicate apps for each CPU.                                                                               | No shared UI, no shared testing, high maintenance.                                                                                                    |

## Rationale

- Keeps the v1.0 build small while leaving a clear path to v3.0.
- Puts the boundary where the product owner asked for it: CPU semantics on one side, presentation on the other.
- Makes determinism testable: the platform's inputs and outputs are typed values.
- Lets tests use a fixture architecture to prove the platform is not secretly BITSHIFT-8-specific.

## Consequences

**Positive**

- BITSHIFT-8 can be built and tested before any UI exists.
- A second architecture needs a new package and one registry entry.
- Visualization and assembler are reusable across architectures.

**Negative / costs**

- More up-front contract work in Phase 0 and Phase 1 than a single-CPU app would need.
- Generic envelopes (register lists, flag lists, event kinds) are slightly less convenient than direct fields for BITSHIFT-8 code. Architecture-specific `details` fields mitigate this.
- Risk of over-generalising. Mitigation: no code for v3.0 architectures is written in v1.0, and the fixture is the only second architecture.

**Constraints for future work**

- No platform code may branch on `architectureId`.
- Any change to shared envelopes requires a new ADR.
- Adding a shared event kind requires an ADR (see [EVENT_MODEL.md](../contracts/EVENT_MODEL.md)).

## Open Points

- Resolved: architectures may define namespaced event kinds (DR-014, approved).
- Resolved: the ISA descriptor is data-only (DR-015, approved).
- Whether the platform requires a PC in every architecture (DR-022).

Tracked in [DECISION_REGISTER.md](DECISION_REGISTER.md).
