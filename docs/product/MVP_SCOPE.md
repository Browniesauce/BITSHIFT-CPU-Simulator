# BITSHIFT v1.0 — MVP Scope

**Status:** Draft for product-owner review (Stage 0.1)
**Scope:** Feature requirements, acceptance criteria, exclusions and open product questions for v1.0 only.
**Related:** [PRODUCT_SPEC.md](PRODUCT_SPEC.md) (why), [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) (when), [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md) (how and in what stage).

**Source tags:** **[A]** established by the product owner · **[B]** proposed here, pending approval · **[C]** open, see DR register.

---

## 1. Scope Rules

1. If a feature is not listed in section 2, it is out of v1.0.
2. Every MVP feature has an ID (`MVP-NNN`), a purpose, an interaction, a minimum v1.0 level, acceptance criteria and dependencies.
3. Acceptance criteria are testable. Where a criterion needs a human check, it says so.
4. "Minimum" means the smallest version that serves the learning outcomes in PRODUCT_SPEC section 7. Polish that does not change behaviour is allowed. New behaviour is not.
5. A feature may be added only through a register entry approved by the product owner.

## 2. In-Scope Features

Features are grouped as in the product brief (A–E). Each feature lists its roadmap stage in [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md).

### A. Programming Environment

**MVP-001 — Assembly code editor with syntax highlighting** · Stage 3.4

- **Purpose:** Let the learner write and change assembly text comfortably.
- **Interaction:** Type, select, undo and redo; mnemonics, numbers, labels and comments appear in distinct styles.
- **Minimum v1.0:** Plain-text editing with highlighting for mnemonics, operands, numbers, labels and comments. Line numbers.
- **Acceptance:**
  - AC-001-1: Each token class from the ISA listing is highlighted in a distinct style.
  - AC-001-2: Editing a 500-line file does not drop keystrokes (human check).
  - AC-001-3: Highlighting remains correct after undo and redo (test).
- **Depends on:** MVP-002 (token classes), approved ISA (DR-001 to DR-018).

**MVP-002 — Assembly parsing, validation and encoding** · Stages 3.1, 3.2

- **Purpose:** Turn source text into a program the CPU can load, and link each source line to its address.
- **Interaction:** Assembling is triggered by a user action (button or shortcut). Result shows either a loaded program or diagnostics.
- **Minimum v1.0:** Parse every instruction in the approved ISA; resolve labels; encode to bytes; produce a source map (line → address → bytes).
- **Acceptance:**
  - AC-002-1: Every instruction in the ISA assembles to the bytes given in the ISA (golden tests).
  - AC-002-2: Forward and backward label references resolve correctly.
  - AC-002-3: The source map covers every instruction and gives its address.
- **Depends on:** DR-010, DR-012, DR-019, DR-020.

**MVP-003 — Useful error messages** · Stage 3.3

- **Purpose:** Help the learner fix mistakes from the message alone (LO-07).
- **Interaction:** Errors appear in the diagnostics list and as markers in the editor. Selecting an error moves the cursor to its line.
- **Minimum v1.0:** Each error gives a line, a column, the error type and a plain-language explanation. Several errors are reported in one assembly where possible.
- **Acceptance:**
  - AC-003-1: Every error code has a test that checks line and column.
  - AC-003-2: Every message is written in plain language without internal names (human review).
  - AC-003-3: Selecting an error moves the cursor to the correct line (test).
- **Depends on:** MVP-002.

**MVP-004 — Example programs** · Stage 6.1 (library UI in 5.1)

- **Purpose:** Give learners working programs to read, run and modify (journey step 2).
- **Interaction:** Choose an example from a list. Its source loads into the editor. Comments explain expected behaviour.
- **Minimum v1.0:** At least 8 examples (proposed count, DR-047) covering each instruction group in the ISA, each with comments and an automated test of its final state.
- **Acceptance:**
  - AC-004-1: Every example assembles with no errors.
  - AC-004-2: Every example runs to its documented final state (test).
  - AC-004-3: The comments in each example match its behaviour (human review).
- **Depends on:** MVP-002, MVP-011.

**MVP-005 — Load a program into BITSHIFT-8** · Stage 3.4

- **Purpose:** Connect the assembled program to the CPU so it can run.
- **Interaction:** A "Load" action after successful assembly. The CPU shows the program in memory and PC at the entry address.
- **Minimum v1.0:** Load replaces the previous program and resets the CPU state. A failed assembly does not change the CPU.
- **Acceptance:**
  - AC-005-1: After load, memory matches the program bytes at the origin address (test).
  - AC-005-2: A failed assembly leaves the CPU state unchanged (test).
- **Depends on:** MVP-002, platform load rules (SIMULATION_PLATFORM §2).

### B. CPU Simulation

**MVP-006 — Instruction fetch, decode and execute** · Stages 2.3, 2.4

- **Purpose:** Run instructions as the learner would expect from the textbook model (EO-03).
- **Interaction:** Covered by the execution controls (MVP-011 to MVP-013).
- **Minimum v1.0:** Every instruction in the approved ISA executes. Unknown opcodes produce the fault behaviour approved in DR-016.
- **Acceptance:**
  - AC-006-1: Every approved instruction passes its conformance test (S-1).
  - AC-006-2: An unknown opcode stops execution with a fault message (test).
- **Depends on:** Approved ISA (DR-001 to DR-018).

**MVP-007 — Register operations** · Stage 2.1

- **Purpose:** Let instructions read and write registers (EO-02).
- **Minimum v1.0:** Registers A, B, PC and the flags listed in the ISA. Wrapping of PC is as approved in DR-004.
- **Acceptance:**
  - AC-007-1: Each register holds values within its width; writes are masked (test).
  - AC-007-2: PC wraps as specified (test).
- **Depends on:** DR-002 to DR-005.

**MVP-008 — Memory read and write** · Stage 2.1

- **Purpose:** Show how data moves between registers and memory (EO-02).
- **Minimum v1.0:** 256 bytes of memory with read and write through load and store instructions. No memory editing in the UI (DR-029).
- **Acceptance:**
  - AC-008-1: A byte written by STA is read back by LDA at the same address (test).
  - AC-008-2: Addresses outside 0–255 are rejected with a diagnostic (test).
- **Depends on:** DR-002, DR-003.

**MVP-009 — ALU operations and flags** · Stage 2.2

- **Purpose:** Show how arithmetic and logic produce results and flags (EO-04, LO-03).
- **Minimum v1.0:** Every ALU operation in the ISA, with the flag rules approved in DR-008.
- **Acceptance:**
  - AC-009-1: Each operation has boundary tests (0, 1, 127, 128, 255) (test).
  - AC-009-2: Flags match the approved rule table (test).
- **Depends on:** DR-008.

**MVP-010 — CPU state inspection** · Stage 5.3

- **Purpose:** Let the learner see the state after any step (LO-01, LO-03).
- **Minimum v1.0:** Live values for all programmer-visible registers, all flags, PC and the output register. Display-only registers (for example IR and MAR) are also shown, labelled as internal.
- **Acceptance:**
  - AC-010-1: Displayed values match the snapshot after every step (test).
  - AC-010-2: Values are shown in hexadecimal and decimal (human check).
- **Depends on:** MVP-007, MVP-009, DR-005.

### C. Execution Controls

**MVP-011 — Run, pause, resume and reset** · Stages 1.3, 5.2

- **Purpose:** Let the learner watch a program at a natural pace or stop it (G-3).
- **Interaction:** Run starts from the current state. Pause stops at the next safe point. Resume continues from the paused point. Reset returns to the state after load.
- **Minimum v1.0:** Four distinct actions. Pause takes effect within one run batch. Resume is not the same as Run from the beginning.
- **Acceptance:**
  - AC-011-1: Pause then Resume produces the same final state as an uninterrupted run (test).
  - AC-011-2: Reset returns memory, registers and PC to the post-load state (test).
- **Depends on:** MVP-005, MVP-006.

**MVP-012 — Single-instruction stepping** · Stage 5.2

- **Purpose:** Let the learner examine one instruction at a time (EO-01).
- **Minimum v1.0:** One action advances exactly one instruction (DR-028, DR-018).
- **Acceptance:**
  - AC-012-1: N presses of Step instruction produce the state after N instructions (test).
- **Depends on:** MVP-006.

**MVP-013 — Clock-level micro-operation stepping** · Stages 2.4, 5.2

- **Purpose:** Show how individual clock steps build an instruction (EO-07, LO-02). This is the product's most distinctive feature (DIF-03).
- **Interaction:** One action advances one micro-operation. The current micro-operation is named in the control panel.
- **Minimum v1.0:** Stepping for every instruction, with the sequence defined by the approved micro-operation model (DR-011, DR-013).
- **Acceptance:**
  - AC-013-1: The number of clock steps per instruction matches the approved sequence (test).
  - AC-013-2: After the last step of an instruction, the state equals instruction-level stepping (test).
- **Depends on:** DR-011, DR-013, DR-018. **This feature is blocked until those are approved.**

**MVP-014 — Execution speed control** · Stage 4.4

- **Purpose:** Let the learner or instructor set a pace that fits the lesson (PRIN-04).
- **Interaction:** A control selects a speed for run mode and for animation. It does not change results.
- **Minimum v1.0:** Discrete presets (proposed: Slow, Normal, Fast) and an animation-off option (DR-046).
- **Acceptance:**
  - AC-014-1: Changing speed does not change the final state of a run (test).
  - AC-014-2: Animation-off mode shows the same final state (test).
- **Depends on:** MVP-011, MVP-016.

### D. Visualization

**MVP-015 — CPU datapath representation** · Stage 4.1

- **Purpose:** Show where each component sits and how they connect (EO-05).
- **Interaction:** Read-only diagram; hovering a component shows its name (human check).
- **Minimum v1.0:** A labelled diagram with every component in the ISA datapath (registers, ALU, memory interface, control unit, bus) drawn once.
- **Acceptance:**
  - AC-015-1: Every component named in the ISA appears once and has a label (human check).
- **Depends on:** DR-023.

**MVP-016 — Bus and data-movement animation** · Stages 4.2, 4.4

- **Purpose:** Show data moving between components during a step (LO-06).
- **Minimum v1.0:** Each bus transfer event animates the bus it uses. Animation can be turned off (DR-032).
- **Acceptance:**
  - AC-016-1: A bus is shown active only when a bus-transfer event occurs for it (test).
  - AC-016-2: Animation can be disabled and simulation results do not change (test).
- **Depends on:** MVP-015, EVENT_MODEL.

**MVP-017 — Register and ALU visualization** · Stages 4.2, 4.3

- **Purpose:** Show values entering and leaving registers and the ALU (EO-04).
- **Minimum v1.0:** Registers show their value and highlight on change. The ALU shows its two inputs, its operation and its result during the step.
- **Acceptance:**
  - AC-017-1: A register highlights only on a register-write event for it (test).
  - AC-017-2: ALU inputs and result match the alu-operation event (test).
- **Depends on:** MVP-010, MVP-015.

**MVP-018 — Memory visualization** · Stage 4.5

- **Purpose:** Show the 256-byte memory and recent accesses (EO-02).
- **Minimum v1.0:** A grid of all 256 bytes. Bytes read or written in the last step are highlighted. The byte at PC is marked.
- **Acceptance:**
  - AC-018-1: The grid shows 256 cells with correct values (test).
  - AC-018-2: Only bytes accessed in the last step are highlighted (test).
- **Depends on:** MVP-008.

**MVP-019 — Control-signal visualization** · Stage 4.3

- **Purpose:** Show which control signals are active during a step (EO-06). Added to the v1.0 list in this stage. See section 6, Q-01.
- **Interaction:** The control panel lists the control signals active in the current micro-operation, named as in the ISA.
- **Minimum v1.0:** Named signals from the micro-operation model. No gate-level signals (EX-08).
- **Acceptance:**
  - AC-019-1: The displayed signals match the active micro-operation's signals in the micro-operation definition (test).
  - AC-019-2: Signals are shown only while their micro-operation is active (test).
- **Depends on:** DR-011, DR-013.

**MVP-020 — Current instruction and execution stage** · Stage 5.3

- **Purpose:** Answer "what is happening right now?" (journey step 8).
- **Minimum v1.0:** Shows the address and mnemonic of the current instruction, and the current stage (fetch, decode or execute) and micro-operation label.
- **Acceptance:**
  - AC-020-1: After every step, the displayed address, mnemonic and stage match the snapshot and events (test).
- **Depends on:** MVP-011 to MVP-013.

### E. Debugging and Learning

**MVP-021 — Execution timeline** · Stages 4.5, 5.4

- **Purpose:** Let the learner review what has run in this session (journey step 10).
- **Interaction:** A list of executed instructions in order. Selecting an entry shows its events.
- **Minimum v1.0:** Forward-only list for the current run. Cleared on reset or load. Bounded in length (DR-024).
- **Acceptance:**
  - AC-021-1: Entries appear in execution order and match the instructions run (test).
  - AC-021-2: The timeline never offers backward stepping (human check; reverse execution is EX-05).
- **Depends on:** MVP-006, DR-024.

**MVP-022 — Instruction explanations** · _Not yet mapped to a roadmap stage. See Q-02._

- **Purpose:** Explain in plain language what each executed instruction did (journey step 10, LO-01).
- **Interaction:** Each timeline entry (MVP-021) has a one-line explanation, such as "A ← A + B; Z and C updated".
- **Minimum v1.0:** Generated from the instruction definition and its result, one line per instruction. Not a tutorial.
- **Acceptance:**
  - AC-022-1: Every instruction in the ISA has an explanation template (test).
  - AC-022-2: The explanation names the registers and flags changed by the instruction (test).
- **Depends on:** MVP-021, DR-045.

**MVP-023 — Basic debugging** · Stage 5.5

- **Purpose:** Let the learner stop at a point of interest and inspect state (journey step 7).
- **Interaction:** Toggle a breakpoint on a source line. Run stops at it. The fault or halt state is shown in a banner with its message.
- **Minimum v1.0:** Address breakpoints. Halt and fault banners. Reset.
- **Acceptance:**
  - AC-023-1: Run stops at each breakpoint address and reports it (test).
  - AC-023-2: Halt and fault states show a message (test).
  - AC-023-3: Reset clears the halt or fault state (test).
- **Depends on:** MVP-011, DR-027.

### F. Platform and Delivery

**MVP-024 — Cross-platform browser delivery** · Stages 6.3, 6.4

- **Purpose:** Let learners use BITSHIFT on Windows, macOS and Linux without installing software (DIF-01).
- **Minimum v1.0:** A static build that runs in current Chrome, Edge, Firefox and Safari.
- **Acceptance:**
  - AC-024-1: Each platform and browser combination is recorded as passed or failed (manual test matrix).
  - AC-024-2: The release build runs when served as static files (test).
- **Depends on:** DR-042, DR-044.

**MVP-025 — Workbench shell and navigation** · Stage 5.1

- **Purpose:** Hold the product areas together (PROD-004).
- **Minimum v1.0:** A single workbench with editor, controls, datapath, state, memory, control, timeline and explanation areas. Navigation between the workbench and the example library.
- **Acceptance:**
  - AC-025-1: Every area in PRODUCT_SPEC section 11 is reachable from the workbench (human check).
  - AC-025-2: The workbench works at 1280 px width without horizontal scrolling (human check, DR-040).
- **Depends on:** MVP-001 to MVP-023 for their areas.

## 3. Explicit Exclusions

These items are not part of v1.0 even if they appear adjacent to an in-scope feature. The left column is the item; the right column shows where it is planned.

| ID    | Excluded item                                                          | Planned release                       |
| ----- | ---------------------------------------------------------------------- | ------------------------------------- |
| EX-01 | Microcode visualization                                                | v2.0                                  |
| EX-02 | Microcode editing                                                      | Not scheduled                         |
| EX-03 | Interrupt handling and simulation                                      | v2.0                                  |
| EX-04 | Advanced I/O simulation (beyond the OUT register display)              | v2.0                                  |
| EX-05 | Reverse execution / backward stepping                                  | v2.0                                  |
| EX-06 | CPU pipelining and pipeline visualization                              | v2.0                                  |
| EX-07 | Cache simulation and cache visualization                               | v2.0                                  |
| EX-08 | Logic gate-level circuit construction and views                        | v2.0 (as "digital logic exploration") |
| EX-09 | Advanced CPU configuration                                             | v2.0                                  |
| EX-10 | Advanced debugging (watchpoints, conditional breakpoints, expressions) | v2.0                                  |
| EX-11 | BITSHIFT-16                                                            | v3.0                                  |
| EX-12 | RISC-V RV32I                                                           | v3.0                                  |
| EX-13 | Additional architecture implementations                                | v3.0                                  |
| EX-14 | Guided lessons and interactive tutorials                               | v4.0                                  |
| EX-15 | Mobile and touch-first layouts (assumption AS-01, DR-040)              | Not planned                           |
| EX-16 | Custom CPU architecture designer / user-created architectures          | v4.0                                  |
| EX-17 | Shareable programs                                                     | v4.0                                  |
| EX-18 | Custom CPU experimentation                                             | v4.0                                  |
| EX-19 | User authentication and accounts                                       | v4.0 if needed; not in v1.0           |
| EX-20 | Cloud synchronisation                                                  | Not planned                           |
| EX-21 | Multiplayer collaboration                                              | Not planned                           |
| EX-22 | Backend services                                                       | Not planned                           |
| EX-23 | AI-powered tutoring                                                    | Not planned                           |

Items EX-14, EX-16 and EX-17 are v4.0 directions in [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md). "Not scheduled" and "Not planned" mean no release is assigned.

## 4. Optional Items (not acceptance requirements)

Some items are cheap and useful but are not required for v1.0 acceptance. If they are built, they must not block a required item.

- Keyboard shortcuts for the execution controls (named in Stage 5.2). Optional.
- Dark and light theme. Optional.
- Saving the editor text in the browser between visits (see Q-04). Optional until decided.

## 5. Traceability from the Previous Scope List

The previous version of this document used IN-xx identifiers. This table maps them to the new MVP-xxx identifiers so that other documents can be updated.

| Previous | New                                                                    | Notes                                          |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| IN-01    | MVP-006, MVP-007, MVP-008                                              | CPU split into execution, registers and memory |
| IN-02    | MVP-007, MVP-010                                                       | Registers and flags                            |
| IN-03    | MVP-009                                                                | ALU                                            |
| IN-04    | MVP-006                                                                | Instruction execution                          |
| IN-05    | MVP-013                                                                | Clock-level stepping                           |
| IN-06    | MVP-011, MVP-012                                                       | Run, pause, reset; instruction stepping        |
| IN-07    | MVP-001                                                                | Editor                                         |
| IN-08    | MVP-002                                                                | Assembler                                      |
| IN-09    | MVP-015, MVP-016                                                       | Animated datapath                              |
| IN-10    | MVP-010                                                                | Register inspection                            |
| IN-11    | MVP-018                                                                | Memory inspection                              |
| IN-12    | MVP-021                                                                | Timeline                                       |
| IN-13    | MVP-023                                                                | Basic debugging                                |
| IN-14    | MVP-004                                                                | Examples                                       |
| IN-15    | MVP-024                                                                | Cross-platform delivery                        |
| (new)    | MVP-003, MVP-005, MVP-014, MVP-017, MVP-019, MVP-020, MVP-022, MVP-025 | Added from the Stage 0.1 brief; see section 6  |

The original brief's v1.0 list is A-04 in DECISION_REGISTER.md. The additions below are proposals.

## 6. Open Product Questions and Assumptions

### 6.1 Scope Additions Requiring Confirmation

| ID   | Question                                                                                                                                                              | Proposal                                                                                       | Register                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Q-01 | The Stage 0.1 brief adds speed control, control-signal visualization, current instruction and stage display, and explicit resume. Confirm they are v1.0 requirements. | Yes. All four map to existing roadmap stages (4.3, 4.4, 5.3, 5.2).                             | [C] DR-051 (control signals) and DR-046 (speed) |
| Q-02 | Instruction explanations (MVP-022) are requested but are not mapped to any roadmap stage.                                                                             | Include in v1.0 as one-line generated text. Add to Stage 5.4 when the roadmap is next revised. | [C] DR-045                                      |

### 6.2 Open Product Questions

| ID   | Question                                                                           | Proposal                                                           | Register                                   |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Q-03 | Speed control form: preset list or continuous slider?                              | Presets plus animation-off                                         | DR-046                                     |
| Q-04 | Should unsaved editor text persist between visits in the same browser?             | Yes, browser-local only. No accounts, no server.                   | DR-048                                     |
| Q-05 | Accessibility baseline?                                                            | WCAG 2.1 AA contrast and keyboard operation of all controls        | DR-049                                     |
| Q-06 | Learner assumptions: English only, undergraduate level.                            | Confirm                                                            | DR-050                                     |
| Q-07 | How many example programs must ship in v1.0?                                       | 8, one or more per instruction group                               | DR-047                                     |
| Q-08 | Is clock-level stepping required for every instruction?                            | Yes; blocked on DR-011 and DR-013                                  | DR-011, DR-013                             |
| Q-09 | How is the learning objective (S-8) measured, and with how many learners?          | At least 5 learners, user test in Phase 6                          | DR-052                                     |
| Q-10 | Should BITSHIFT show a built-in glossary of terms (flags, buses, control signals)? | Not in v1.0. Explanations (MVP-022) and example comments cover it. | Not registered; decide in Stage 5.3 review |

### 6.3 Assumptions

Listed in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) section 12 (AS-01 to AS-05).

## 7. Feasibility Check

Verification performed for Stage 0.1:

| Check                                                             | Result                                                                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every in-scope feature maps to at least one roadmap stage         | Pass, except MVP-022, which needs a stage (Q-02)                                                                                                                     |
| Number of stages (32) covers the in-scope features                | Pass; each stage has at least one feature                                                                                                                            |
| Blocked features                                                  | MVP-006, MVP-013 and MVP-019 are blocked by the open ISA and micro-operation decisions (DR-001 to DR-018, DR-011, DR-013). This is the main schedule risk.           |
| Features with highest technical risk                              | MVP-013 (clock-level stepping), MVP-016 (animation tied to events), MVP-021 (timeline bounds)                                                                        |
| Features that could be cut without breaking the learning outcomes | MVP-014 speed control (fall back to a single speed); MVP-022 explanations (fall back to the event list). Both are flagged as candidates, not recommendations to cut. |

**Conclusion:** the MVP is achievable within the seven-phase, 32-stage roadmap, provided the ISA and micro-operation decisions are approved before Phase 2. Without them, MVP-013 cannot be scheduled.

## 8. Acceptance Summary

v1.0 is accepted when:

1. Every feature in section 2 meets its acceptance criteria.
2. No item in section 3 is present in the codebase.
3. The success criteria in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) section 10 are met, including the learning measure S-8.
4. The open questions in section 6 that affect shipped behaviour are answered.
