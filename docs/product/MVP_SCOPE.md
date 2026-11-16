# BITSHIFT v1.0 — MVP Scope

**Status:** Draft for product-owner review
**Source:** Product brief (Phase 0). See [PRODUCT_SPEC.md](PRODUCT_SPEC.md) for rationale.

This document is the authoritative list of what v1.0 includes and excludes. If a feature is not listed under "In Scope", it is out of scope.

---

## 1. In Scope

| ID    | Feature                            | Included capability                                             | Stage that delivers it |
| ----- | ---------------------------------- | --------------------------------------------------------------- | ---------------------- |
| IN-01 | BITSHIFT-8 CPU                     | One 8-bit CPU with 8-bit addresses and 256 bytes RAM            | 2.1–2.5                |
| IN-02 | Registers and flags                | A, B, PC, IR, MAR, MDR, OUT, TEMP; Zero, Carry, Negative flags  | 2.1                    |
| IN-03 | ALU                                | Arithmetic and logic operations used by the instruction set     | 2.2                    |
| IN-04 | Instruction execution              | Fetch, decode and execute for every defined instruction         | 2.3, 2.4               |
| IN-05 | Clock-level stepping               | Step one micro-operation at a time                              | 2.4, 5.2               |
| IN-06 | Instruction-level stepping and run | Step one instruction; run, pause, reset                         | 1.3, 5.2               |
| IN-07 | Assembly editor                    | Text editor with syntax highlighting (CodeMirror 6)             | 3.4                    |
| IN-08 | Assembler                          | Parsing, encoding, label resolution, diagnostics                | 3.1–3.3                |
| IN-09 | Animated datapath                  | SVG datapath with animated buses and active components          | 4.1–4.4                |
| IN-10 | Register inspection                | Live view of all registers and flags                            | 5.3                    |
| IN-11 | Memory inspection                  | Live view of all 256 bytes, with highlighting of recent access  | 4.5, 5.3               |
| IN-12 | Execution timeline                 | Forward-only log of instructions and events for the current run | 4.5, 5.4               |
| IN-13 | Basic debugging                    | Breakpoints by address, reset, halt-state and fault reporting   | 5.5                    |
| IN-14 | Example programs                   | A bundled set of documented programs with expected results      | 6.1                    |
| IN-15 | Cross-platform browser delivery    | Static web build that runs in modern browsers                   | 6.3, 6.4               |

## 2. Explicit Exclusions

These items are excluded from v1.0 even if they appear adjacent to an in-scope feature.

| ID    | Excluded item                                                                              | Planned release |
| ----- | ------------------------------------------------------------------------------------------ | --------------- |
| EX-01 | Microcode visualization                                                                    | v2.0            |
| EX-02 | Interrupt simulation                                                                       | v2.0            |
| EX-03 | I/O devices (beyond the OUT register display)                                              | v2.0            |
| EX-04 | Advanced debugging (watchpoints on memory, conditional breakpoints, expression evaluation) | v2.0            |
| EX-05 | Reverse execution / stepping backward                                                      | v2.0            |
| EX-06 | Cache and pipeline visualization                                                           | v2.0            |
| EX-07 | Custom CPU configurations                                                                  | v2.0            |
| EX-08 | Digital logic exploration (gate-level views)                                               | v2.0            |
| EX-09 | BITSHIFT-16                                                                                | v3.0            |
| EX-10 | RISC-V RV32I                                                                               | v3.0            |
| EX-11 | Guided lessons and interactive tutorials                                                   | v4.0            |
| EX-12 | Shareable programs and accounts                                                            | v4.0            |
| EX-13 | User-created architectures                                                                 | v4.0            |
| EX-14 | Any backend or server-side storage                                                         | Not planned     |
| EX-15 | Mobile and touch-first layouts _(assumption, see DR-040)_                                  | Not planned     |

## 3. Scope Guardrails

1. A feature may be added to v1.0 only through a recorded decision (an ADR or a register update approved by the product owner).
2. Visual polish that does not change behaviour is allowed. New behaviour is not.
3. Where an in-scope item needs a v2 capability to work well (for example, a reverse-step button), the in-scope version is delivered without that capability and the gap is noted.
4. Architectural flexibility for later releases is allowed. Implementation of later features is not.

## 4. Acceptance Summary

v1.0 is accepted when:

- Every item in section 1 meets its acceptance criteria in [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md).
- No item in section 2 is present in the codebase.
- The success criteria in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) section 9 are met.
