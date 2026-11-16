# BITSHIFT — Release Roadmap

**Status:** Draft for product-owner review
**Authorization:** Only v1.0 is authorized for implementation planning. v2.0 to v4.0 are directional and must not be built or planned in detail until v1.0 is complete and the product owner approves the next release.

---

## Release Overview

| Release  | Theme                                                       | Status      | Authorization  |
| -------- | ----------------------------------------------------------- | ----------- | -------------- |
| **v1.0** | Polished MVP: one CPU, full execution loop, visual datapath | In planning | Authorized     |
| v2.0     | Advanced simulation                                         | Directional | Not authorized |
| v3.0     | Multi-architecture support                                  | Directional | Not authorized |
| v4.0     | Educational platform                                        | Directional | Not authorized |

## v1.0 — Polished MVP

- BITSHIFT-8 CPU (8-bit, 256-byte RAM, accumulator-based).
- Assembler and editor with diagnostics.
- Clock-level and instruction-level execution.
- Animated datapath, register and memory inspection, timeline.
- Basic debugging and bundled example programs.

Detail: [MVP_SCOPE.md](MVP_SCOPE.md) and [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md).

## v2.0 — Advanced Simulation (directional)

Potential capabilities:

- Microcode visualization.
- Interrupt simulation.
- I/O devices.
- Advanced debugging.
- Reverse execution.
- Cache and pipeline visualization.
- Custom CPU configurations.
- Digital logic exploration.

**v1.0 constraint:** reverse execution and pipeline visualization both depend on the snapshot and event model. v1.0 must keep snapshots and events as explicit typed data (see [EVENT_MODEL.md](../contracts/EVENT_MODEL.md)) so that these features can be added without rewriting the CPU core. This does not mean building them in v1.0.

## v3.0 — Multi-Architecture Support (directional)

Potential architectures:

- BITSHIFT-16.
- RISC-V RV32I.

**v1.0 constraint:** the platform must not assume identical registers, flags, word sizes or instruction formats (see [CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md)). ADR-001 records this direction. Registering a second architecture is expected to require a new architecture package and one registry entry, not changes to the platform.

## v4.0 — Educational Platform (directional)

Potential capabilities:

- Guided lessons.
- Shareable programs.
- Interactive tutorials.
- Custom CPU experimentation.
- User-created architectures.

**v1.0 constraint:** v4.0 features that need persistence or sharing would require a backend. v1.0 stays backend-free. Program and architecture data should therefore be kept in plain serialisable formats so a later release can add storage without changing the simulation core.

## Release Gating

A release moves to planning only when:

1. The previous release's acceptance criteria are met and recorded.
2. The product owner approves the next release scope in writing (ADR or register entry).
3. Any architecture changes needed by that release have an accepted ADR.
