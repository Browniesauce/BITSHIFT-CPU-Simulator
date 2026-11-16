# Architecture Decisions

This directory holds two kinds of record:

- **[DECISION_REGISTER.md](DECISION_REGISTER.md)** — every open and proposed decision, with categories A, B and C. Start here.
- **ADR files** (`ADR-NNN-title.md`) — formal records for major decisions only.

## When to Write an ADR

Write an ADR when a decision:

- changes a shared contract or the module boundaries in [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md);
- adds or removes a dependency that changes the stack;
- changes v1.0 scope;
- is hard to reverse.

Do not write an ADR for minor implementation choices. Put those in the implementation report.

## ADR Index

| ADR                                               | Title                                                        | Status   |
| ------------------------------------------------- | ------------------------------------------------------------ | -------- |
| [ADR-001](ADR-001-modular-simulation-platform.md) | Modular simulation platform and multi-architecture direction | Proposed |

## Planned ADRs (not yet written)

These are identified in Phase 0 and will be written when the related decision is ready for review. Their numbers are reserved.

| Planned ADR | Title                                                         | Related register items           |
| ----------- | ------------------------------------------------------------- | -------------------------------- |
| ADR-002     | Technology stack and dependency policy                        | DR-039, DR-021, DR-036           |
| ADR-003     | CPU architecture registration and package layout              | DR-015, DR-022                   |
| ADR-004     | Execution model: micro-operation stepping and run batching    | DR-018, DR-026, DR-028           |
| ADR-005     | Snapshot and execution-history strategy                       | DR-024, DR-025, DR-027           |
| ADR-006     | Micro-operation representation and event model                | DR-013, DR-014, DR-043           |
| ADR-007     | Assembler architecture and output format                      | DR-019, DR-020                   |
| ADR-008     | BITSHIFT-8 ISA ratification (registers, flags, opcode policy) | DR-001 to DR-012, DR-016, DR-017 |
| ADR-009     | Memory model and program loading                              | DR-002, DR-003, DR-029           |

## Status Values

- **Proposed** — written, awaiting approval.
- **Accepted** — approved by the product owner.
- **Superseded** — replaced by a later ADR (link to the replacement).
