# BITSHIFT — Product Specification

**Status:** Draft for product-owner review (Stage 0.1)
**Scope:** Product vision, users, learning goals, journeys and principles. This document says _what_ BITSHIFT is for and _who_ it serves. Feature-level requirements are in [MVP_SCOPE.md](MVP_SCOPE.md). Release direction is in [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md).
**Source tags:** **[A]** established by the product owner · **[B]** proposed in this document, pending approval · **[C]** open question, listed in [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md).

---

## 1. Product Vision [A]

BITSHIFT is an interactive educational computer architecture simulator. A learner writes an assembly program, executes it on a virtual CPU, and watches how the computer processes each instruction internally.

It is a learning environment, not an assembler with a CPU output panel. The learner should be able to see _why_ a program produces its result: which register was read, which bus carried the value, what the ALU computed, which flags changed, and which clock step did each part.

**PROD-001** The product exists to make the internal operation of a CPU visible, step by step, while the learner works with real assembly.

## 2. Problem Statement [B]

Computer architecture is taught through diagrams and final results. Students are asked to trace the fetch–decode–execute cycle on paper, and they often cannot connect a line of assembly to what the hardware does on each clock cycle.

Existing approaches each leave a gap:

| Approach                                  | What it shows                        | What it misses                                          |
| ----------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Static diagrams and slides                | The parts of a CPU                   | The order of events and the state after each step       |
| Text-only assemblers and emulators        | The final register and memory values | The mechanism that produced them                        |
| Desktop simulators that must be installed | Detailed behaviour                   | Setup cost on shared lab machines and for self-learners |

_Assumption (B):_ the gap above is real for the target users. This is based on common course practice, not on a user study. Phase 6 includes learner testing (S-8) to validate it.

**PROD-002** A learner must be able to watch a program execute one clock-level step at a time, see the parts involved, and connect each change back to the assembly line that caused it.

## 3. Target Audience [B]

| Persona          | Context                                              | Goal in BITSHIFT                                        | Typical session                       |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| **Student**      | Introductory computer architecture or systems course | Understand how instructions run; complete lab exercises | 20–60 minutes, guided by lab sheets   |
| **Self-learner** | Programmer learning low-level concepts               | Build a mental model of registers, memory and the CPU   | Open-ended exploration                |
| **Instructor**   | Teaching a lecture or tutorial                       | Demonstrate execution live and set exercises            | Projected screen, step-by-step pacing |

**PROD-003** The primary user is an undergraduate learner. Instructors are a secondary user who needs the same features presented with pacing controls.

_Assumptions (C, see DR-050):_ English-language interface only; no prior assembly knowledge is assumed, but a basic idea of binary and hexadecimal numbers is.

## 4. Core Educational Objectives [A/B]

The brief establishes the topics the product must help learners understand [A]. The objectives below are the product's framing of those topics [B].

| ID    | Objective                                                   | Brief topic                        |
| ----- | ----------------------------------------------------------- | ---------------------------------- |
| EO-01 | Understand what an assembly instruction does                | How assembly instructions work [A] |
| EO-02 | Understand how registers and memory interact                | Registers and memory [A]           |
| EO-03 | Understand the fetch, decode and execute stages             | Fetch, decode and execute [A]      |
| EO-04 | Understand how the ALU computes results and flags           | ALU [A]                            |
| EO-05 | Understand how data moves over buses and datapaths          | Buses and datapaths [A]            |
| EO-06 | Understand how control signals coordinate the CPU           | Control signals [A]                |
| EO-07 | Understand how individual clock cycles build an instruction | Clock cycles [A]                   |

Each objective is tested through the learning outcomes in section 7.

## 5. Primary User Journey [A/B]

The brief defines the journey below [A]. The right-hand column names the product area responsible for each step [B]. Areas are described in section 11.

| Step | User action                                              | Product area                     | Requirements              |
| ---- | -------------------------------------------------------- | -------------------------------- | ------------------------- |
| 1    | Opens BITSHIFT                                           | Workbench shell                  | MVP-025                   |
| 2    | Selects or opens an example program                      | Example library                  | MVP-004                   |
| 3    | Writes or modifies assembly code                         | Editor                           | MVP-001                   |
| 4    | Assembles the program                                    | Editor, assembler                | MVP-002                   |
| 5    | Sees errors, if any                                      | Diagnostics                      | MVP-003                   |
| 6    | Loads the program into BITSHIFT-8                        | Editor, execution controls       | MVP-005                   |
| 7    | Runs or steps through instructions                       | Execution controls               | MVP-011, MVP-012, MVP-013 |
| 8    | Observes CPU state changes                               | State panels                     | MVP-010, MVP-020          |
| 9    | Inspects datapath, registers, memory and control signals | Datapath, memory, control panels | MVP-015 to MVP-019        |
| 10   | Understands how the instruction was executed             | Explanation and timeline         | MVP-021, MVP-022          |

**PROD-004** Every step in this journey must work without leaving the browser page.

## 6. Key Differentiators [B]

| ID     | Differentiator                                    | Why it matters                                                                 |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| DIF-01 | **Runs in the browser with no installation**      | Works on lab machines and at home                                              |
| DIF-02 | **Visuals driven by real execution events**       | A learner can trust that what they see happened. Visuals are never decorative. |
| DIF-03 | **Clock-level stepping as a first-class control** | Makes the time dimension of execution visible, which most tools hide           |
| DIF-04 | **Assembly and execution are linked**             | Each instruction in the editor maps to its address, bytes and effects          |
| DIF-05 | **Deterministic runs**                            | A lecturer and a student see identical behaviour for the same program          |
| DIF-06 | **Small, complete instruction set**               | Learners can hold the whole machine in their head before moving on             |

DIF-06 depends on the BITSHIFT-8 ISA being kept small. The ISA is not designed here (see section 9 and [BITSHIFT-8_ISA.md](../specifications/BITSHIFT-8_ISA.md)).

## 7. Expected Learning Outcomes [B]

Outcomes are written so that they can be observed. Each is linked to the objectives it tests.

| ID    | After using BITSHIFT, a learner can…                                                             | Objectives    | How it is observed                            |
| ----- | ------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------- |
| LO-01 | Predict the register and memory changes of a single instruction before running it                | EO-01, EO-02  | Prediction exercise in example programs (S-8) |
| LO-02 | Name the stages of the fetch–decode–execute cycle in order for a 1-byte and a 2-byte instruction | EO-03         | Clock-step walkthrough of MVP-013             |
| LO-03 | State which flags change after ADD and SUB and why                                               | EO-04         | Flag display (MVP-010) and a flag exercise    |
| LO-04 | Explain why a conditional jump is or is not taken                                                | EO-03, EO-04  | Jump example with the Zero flag shown         |
| LO-05 | Map an assembly line to its address and machine bytes                                            | EO-01, DIF-04 | Source map and listing view (MVP-002)         |
| LO-06 | Identify which bus and which component carried a value during a step                             | EO-05, EO-06  | Datapath animation (MVP-016, MVP-019)         |
| LO-07 | Fix an assembly error using the diagnostic message alone                                         | EO-01         | Diagnostic message usability check (S-3, S-8) |

## 8. Product Principles [A/B]

Principles 1–4 and 7 are stated in the product brief's guidance [A]. Principles 5 and 6 are proposed by this document [B] and are the basis for the rules in section 9.

| ID      | Principle                                                                      | Source |
| ------- | ------------------------------------------------------------------------------ | ------ |
| PRIN-01 | CPU correctness takes priority over visual effects.                            | [A]    |
| PRIN-02 | Educational clarity takes priority over feature quantity.                      | [A]    |
| PRIN-03 | Visualizations must reflect actual CPU execution state.                        | [A]    |
| PRIN-04 | The interface should make complex concepts approachable.                       | [A]    |
| PRIN-05 | The architecture should support future expansion without overengineering v1.0. | [A]    |
| PRIN-06 | Every MVP feature has measurable acceptance criteria.                          | [B]    |
| PRIN-07 | Keep the initial release achievable and maintainable.                          | [A]    |

**Conflict resolution:** if a visual effect would make a step look different from what the CPU did, the visual effect is removed or changed (PRIN-01, PRIN-03). If a feature would add complexity without improving a learning outcome, it is deferred (PRIN-02, PRIN-07).

## 9. Goals and Non-Goals

### 9.1 Goals (v1.0)

| ID  | Goal                                                                                   | Measure                                                 |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G-1 | Educational clarity: every visual element is labelled and tied to a real CPU component | Reviewed against MVP-015 to MVP-019 acceptance criteria |
| G-2 | Accurate simulation of BITSHIFT-8                                                      | S-1                                                     |
| G-3 | Interactive execution: run, pause, resume, reset, instruction and clock stepping       | MVP-011 to MVP-014                                      |
| G-4 | Visual understanding through an animated datapath                                      | MVP-015, MVP-016                                        |
| G-5 | Modular architecture for later CPUs                                                    | Platform contracts in `docs/contracts/`                 |
| G-6 | Maintainable engineering                                                               | S-4, S-5                                                |

### 9.2 Non-Goals (v1.0)

These are excluded from v1.0. Each is either placed in a later release or not planned. The full list with release mapping is in [MVP_SCOPE.md](MVP_SCOPE.md) section 3.

- BITSHIFT-16 and RISC-V RV32I implementation.
- CPU pipelining and cache simulation.
- Interrupt handling and advanced I/O simulation.
- Microcode editing and microcode visualization.
- Logic gate-level circuit construction.
- A custom CPU architecture designer.
- User authentication, accounts and cloud synchronisation.
- Multiplayer collaboration.
- Backend services.
- AI-powered tutoring.
- Cycle-accurate modelling of real silicon.

Future ambitions must not inflate v1.0. A feature is considered for v1.0 only if it serves a learning outcome in section 7 and has an acceptance test.

## 10. Success Criteria

| ID  | Criterion                             | Measure                                                                                                                                                            | Status                            |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| S-1 | Correct execution                     | 100% of BITSHIFT-8 conformance tests pass                                                                                                                          | [B]                               |
| S-2 | Example programs behave as documented | Each example has an automated test with expected final state                                                                                                       | [B]                               |
| S-3 | Clear diagnostics                     | Every assembler error includes a source line and column                                                                                                            | [B]                               |
| S-4 | Deterministic runs                    | Same program and inputs give identical snapshots and events                                                                                                        | [A] (A-07)                        |
| S-5 | Separation of concerns                | Simulation packages have no React or DOM imports                                                                                                                   | [A] (A-06)                        |
| S-6 | Cross-platform use                    | Runs in current Chrome, Edge, Firefox and Safari on Windows, macOS and Linux                                                                                       | [A] (A-05); browsers [B] (DR-044) |
| S-7 | Responsiveness                        | One micro-operation updates the UI within one frame; 10,000 instructions in under 2 s with animation paused                                                        | [C] (DR-031)                      |
| S-8 | Learning effectiveness                | With at least 5 learners (number proposed) who have completed one course unit, at least 4 complete journey steps 1–10 unaided and answer LO-01 and LO-02 correctly | [C] (DR-052)                      |

S-8 is a learning measure and is not satisfied by automated tests. It is run as a user test in Phase 6.

## 11. Product Areas and Responsibilities

These are the areas a learner interacts with. They describe _responsibility_, not component design. Visual and component decisions belong to the visualization and workbench stages.

| Area                    | Responsibility                                                                              | Requirements                |
| ----------------------- | ------------------------------------------------------------------------------------------- | --------------------------- |
| Workbench shell         | Holds the areas together and provides navigation between example programs and the workbench | MVP-025                     |
| Editor                  | Write, highlight and assemble source; show where the cursor is                              | MVP-001, MVP-002            |
| Diagnostics             | Report assembler errors with line and column                                                | MVP-003                     |
| Example library         | Provide documented programs that demonstrate instructions                                   | MVP-004                     |
| Execution controls      | Load, run, pause, resume, reset, step instruction, step clock, set speed                    | MVP-005, MVP-011 to MVP-014 |
| Datapath                | Show components, buses and active paths; animate movement                                   | MVP-015, MVP-016            |
| Register and flag panel | Show current values of registers and flags                                                  | MVP-007, MVP-010, MVP-017   |
| Memory panel            | Show 256 bytes and recent access                                                            | MVP-008, MVP-018            |
| Control panel           | Show the current instruction, stage and active control signals                              | MVP-019, MVP-020            |
| Timeline                | Show what has run, forward only                                                             | MVP-021                     |
| Explanation             | Describe each executed instruction in plain language                                        | MVP-022                     |
| Debug controls          | Breakpoints, halt and fault information                                                     | MVP-023                     |

## 12. Assumptions [B]

| ID    | Assumption                                           | Consequence if wrong                                    |
| ----- | ---------------------------------------------------- | ------------------------------------------------------- |
| AS-01 | Users have a desktop or laptop with a modern browser | Layout and touch support need re-scoping (DR-040)       |
| AS-02 | Learners have no prior assembly experience           | Editor needs more guidance (example library grows)      |
| AS-03 | Courses use short programs (tens of instructions)    | Performance targets (S-7) may need revision             |
| AS-04 | No user data needs to leave the browser              | A backend would be needed for any sharing feature       |
| AS-05 | Instructors use the same product for teaching        | Pacing controls and presentation mode may need priority |

## 13. Open Questions

Product questions that are not yet decided are listed in [MVP_SCOPE.md](MVP_SCOPE.md) section 6 and in [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) (DR-045 to DR-052). They are not final until approved.
