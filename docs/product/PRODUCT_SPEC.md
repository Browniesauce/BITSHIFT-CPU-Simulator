# BITSHIFT — Product Specification

**Status:** Draft for product-owner review
**Scope:** BITSHIFT v1.0 (Polished MVP). Later releases are described only in [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md).
**Related:** [MVP_SCOPE.md](MVP_SCOPE.md), [BITSHIFT-8 ISA draft](../specifications/BITSHIFT-8_ISA.md), [Decision register](../decisions/DECISION_REGISTER.md)

---

## 1. Product Vision

BITSHIFT is a browser-based educational computer architecture simulator. A learner writes an assembly program, assembles it, and executes it on a virtual CPU. The application shows how each instruction moves through the program counter, instruction register, memory, registers, the ALU and the buses, so that abstract concepts such as the fetch–decode–execute cycle become visible and inspectable.

Success means a learner can answer "what happened on this clock cycle and why?" for any program they run.

## 2. Goals

| ID  | Goal                     | Notes                                                                                 |
| --- | ------------------------ | ------------------------------------------------------------------------------------- |
| G-1 | Educational clarity      | Every visual element is labelled and tied to a real CPU component.                    |
| G-2 | Accurate simulation      | Behaviour matches the BITSHIFT-8 specification exactly, verified by tests.            |
| G-3 | Interactive execution    | Learners can run, pause, step by instruction and step by clock-level micro-operation. |
| G-4 | Visual understanding     | An animated datapath shows registers, buses, ALU and control activity.                |
| G-5 | Modular architecture     | Simulation logic is separated from presentation so future architectures can be added. |
| G-6 | Maintainable engineering | Typed contracts, deterministic behaviour and a documented test strategy.              |

## 3. Non-Goals (for v1.0)

- Cycle-accurate modelling of real silicon.
- Support for more than one CPU architecture.
- Any server-side component, accounts, cloud storage or multi-user features.
- Microcode editing or visualization, interrupts, I/O devices, caches, pipelines.
- Reverse (backward) execution.
- Lessons, tutorials, program sharing.

## 4. Intended Users

| User                                                                            | Need                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Undergraduate students in introductory computer architecture or systems courses | Understand how instructions execute, prepare for exams and labs. |
| Self-taught programmers                                                         | Learn how high-level ideas map onto registers and memory.        |
| Instructors                                                                     | Demonstrate execution live in class and assign exercises.        |

_Assumption (B):_ users work on a desktop or laptop with a modern browser. Mobile layouts are not a v1.0 goal.

## 5. Core User Journeys

| ID  | Journey                                              | Outcome                                                                              |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| J-1 | Write and assemble a program in the editor           | Learner receives either a loaded program or diagnostics pointing to the source line. |
| J-2 | Step through a program one micro-operation at a time | Learner sees which register, bus or ALU operation is active and what it changes.     |
| J-3 | Run a program to completion                          | Learner sees final register, memory and output values and the HLT state.             |
| J-4 | Debug with breakpoints and reset                     | Learner pauses at an address, inspects state, resets and reruns.                     |
| J-5 | Open an example program and read its comments        | Learner studies a working program and steps through it.                              |
| J-6 | Inspect the execution timeline                       | Learner reviews the sequence of instructions and events that have occurred so far.   |

## 6. v1.0 Functionality

Summary (full list in [MVP_SCOPE.md](MVP_SCOPE.md)):

- One functioning 8-bit CPU: BITSHIFT-8.
- Assembly programming environment with syntax highlighting.
- CPU registers, flags and ALU.
- 256-byte RAM.
- Instruction execution with instruction-level and clock-level stepping.
- Animated datapath.
- Register and memory inspection.
- Execution timeline.
- Basic debugging: breakpoints, reset, clear error reporting.
- Example programs.

## 7. Explicit MVP Exclusions

Any of the following is out of scope for v1.0 and must not be implemented without a scope change recorded in an ADR:

- Microcode visualization, interrupts, I/O devices, advanced debugging, reverse execution, cache and pipeline visualization, custom CPU configurations, digital logic exploration (v2.0).
- BITSHIFT-16 and RISC-V RV32I (v3.0).
- Guided lessons, shareable programs, interactive tutorials, user-created architectures (v4.0).
- Any backend service.

## 8. Future Release Strategy

v2.0 to v4.0 are directional only. The v1.0 architecture must avoid decisions that block them (for example, the platform must not assume a single architecture), but no v2–v4 feature is designed or built in v1.0. See [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md).

## 9. Success Criteria

| ID  | Criterion                                       | Measure                                                                                                                                                         |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | Correct execution                               | 100% of BITSHIFT-8 conformance tests pass.                                                                                                                      |
| S-2 | All example programs behave as documented       | Each example has an automated test with expected final state.                                                                                                   |
| S-3 | Clear diagnostics                               | Every assembler error includes a source line and column.                                                                                                        |
| S-4 | Deterministic runs                              | The same program with the same inputs produces identical snapshots and events on every run.                                                                     |
| S-5 | Separation of concerns                          | Simulation packages have no React or DOM imports (checked by review, and by an import rule when lint tooling is approved).                                      |
| S-6 | Cross-platform use                              | v1.0 runs in current Chrome, Edge, Firefox and Safari on Windows, macOS and Linux.                                                                              |
| S-7 | Responsiveness _(proposed targets, see DR-031)_ | Stepping a micro-operation updates the UI within one frame on a typical laptop; running 10,000 instructions completes in under 2 seconds with animation paused. |

## 10. Open Items

Product and architecture questions that block implementation are tracked in [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md). Items in that register are not final until approved.
