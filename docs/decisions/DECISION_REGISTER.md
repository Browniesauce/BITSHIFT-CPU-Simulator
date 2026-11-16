# BITSHIFT — Decision Register

**Status:** Living document. Phase 0 review item.
**Purpose:** The single list of decisions that shape BITSHIFT, with origin and status. Nothing here is final unless it is category **A**, or its status is **Approved**.

## Categories

| Cat.  | Meaning                                                                          | Status vocabulary          | Who decides                           |
| ----- | -------------------------------------------------------------------------------- | -------------------------- | ------------------------------------- |
| **A** | Established by the product owner (stated as a requirement or fact in the brief). | Established                | Already decided                       |
| **B** | Proposed engineering decision, written into the Phase 0 documents as a proposal. | Proposed → Approved        | Product owner approves                |
| **C** | Unresolved question. Needs an answer before the dependent work starts.           | Open → Answered → Approved | Product owner, with engineering input |

A proposal becomes **Approved** only when the product owner says so. Record the change in the change log at the bottom.

## Blocking Summary

| Blocks                   | Items                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Phase 1 (platform)       | DR-013, DR-014, DR-015, DR-022, DR-024, DR-027, DR-035, DR-039    |
| Phase 2 (BITSHIFT-8 CPU) | DR-001 to DR-018 (ISA, memory, flags, micro-operations, stepping) |
| Phase 3 (assembler)      | DR-010, DR-012, DR-019, DR-020                                    |
| Phase 4 (visualization)  | DR-011, DR-023, DR-032                                            |
| Phase 5 (workbench)      | DR-006, DR-029, DR-030, DR-034, DR-038                            |
| Phase 6 (release)        | DR-031, DR-037, DR-042, DR-044, DR-047, DR-052                    |
| Phases 4–5 (product UX)  | DR-045, DR-046, DR-048, DR-049, DR-050, DR-051                    |

---

## A. Established by the Product Owner

| ID   | Decision                                                                                                                                                                                                      | Source        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| A-01 | BITSHIFT is a browser-based educational CPU simulator.                                                                                                                                                        | Brief §1      |
| A-02 | The initial application requires no backend.                                                                                                                                                                  | Brief §1, §4  |
| A-03 | Only v1.0 is authorised for implementation planning. v2.0–v4.0 must not expand v1.0 scope.                                                                                                                    | Brief §2      |
| A-04 | v1.0 scope is the brief's feature list (one CPU, assembly environment, registers and ALU, 256-byte RAM, execution, clock-level stepping, animated datapath, inspection, timeline, basic debugging, examples). | Brief §2      |
| A-05 | Target platforms: Windows, macOS and Linux, through modern browsers.                                                                                                                                          | Brief §1      |
| A-06 | CPU execution is independent of React.                                                                                                                                                                        | Brief §4      |
| A-07 | Simulation is deterministic.                                                                                                                                                                                  | Brief §4      |
| A-08 | UI components do not modify CPU internals directly.                                                                                                                                                           | Brief §4      |
| A-09 | CPU snapshots and execution events are explicitly typed.                                                                                                                                                      | Brief §4      |
| A-10 | Each architecture implements its own hardware semantics. Shared infrastructure does not assume identical registers or instruction formats.                                                                    | Brief §4      |
| A-11 | Phase 0 installs only initial tooling. Do not install every proposed dependency.                                                                                                                              | Brief §4, §12 |
| A-12 | Phase 0 implements no CPU, ALU, assembler, datapath or debugger.                                                                                                                                              | Brief §12     |
| A-13 | The roadmap has seven phases and 32 stages.                                                                                                                                                                   | Brief §9      |
| A-14 | Unapproved proposals must never be presented as final.                                                                                                                                                        | Brief §11     |

---

## B. Proposed Engineering Decisions (pending approval)

| ID     | Proposal                                                                                                                                                                 | Where it is applied                       | Status   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------- |
| DR-022 | Platform requires a program counter in every architecture. An architecture without a PC has breakpoints disabled.                                                        | DATA_CONTRACTS §3                         | Proposed |
| DR-025 | Snapshots are full copies per request, not diffs.                                                                                                                        | DATA_CONTRACTS §3; SIMULATION_PLATFORM §8 | Proposed |
| DR-026 | Run mode advances in batches of N instruction steps. N is a controller parameter, measured in Phase 1.                                                                   | SIMULATION_PLATFORM §3                    | Proposed |
| DR-028 | In the UI, "Step" means one micro-operation. "Step instruction" is a separate control.                                                                                   | SIMULATION_PLATFORM §2.2                  | Proposed |
| DR-029 | v1.0 does not allow editing memory directly in the UI. Memory changes come only from loading a program.                                                                  | MODULE_CONTRACTS §2                       | Proposed |
| DR-032 | Animation is optional, speed-adjustable, and never affects simulation results.                                                                                           | DEVELOPMENT_ROADMAP 4.4                   | Proposed |
| DR-033 | v1.0 runs the simulation on the main thread. A Web Worker is used only if DR-031 targets are missed.                                                                     | SYSTEM_ARCHITECTURE §7                    | Proposed |
| DR-034 | The store publishes to the UI at most once per run batch, not per micro-operation. Refined in Stage 0.2 to at most once per animation frame (SIMULATION_PLATFORM §10.4). | SIMULATION_PLATFORM §8                    | Proposed |
| DR-036 | TypeScript is pinned to 5.9.x. Revisit at the Phase 1 review, including the 7.x line.                                                                                    | TECHNOLOGY_STACK §5                       | Proposed |
| DR-040 | v1.0 targets desktop browsers only. Minimum supported layout width is 1280 px. Mobile and touch layouts are out of scope.                                                | MVP_SCOPE EX-15; CODING_STANDARDS §8      | Proposed |
| DR-041 | The Dev Container uses the Node 22 base image with corepack and pnpm 9. A custom Dockerfile is not needed in v1.0.                                                       | TECHNOLOGY_STACK §1                       | Proposed |
| DR-043 | Architecture-specific event kinds are namespaced as `<architecture-id>/<kind>`.                                                                                          | EVENT_MODEL §4                            | Proposed |
| DR-044 | Browser support is the current stable Chrome, Edge, Firefox and Safari, with no older version floor.                                                                     | PRODUCT_SPEC S-6                          | Proposed |

---

### B2. Architecture Proposals (Stage 0.2)

| ID     | Proposal                                                                                                                                                                                                                                                            | Reason and document                                                                                                      | Status   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| DR-053 | One clock cycle holds exactly one micro-operation in v1.0. Micro-operation events carry the names of the active control signals.                                                                                                                                    | Keeps the learner's model simple and makes clock step = micro-operation step (MVP-013, MVP-019). SIMULATION_PLATFORM §2. | Proposed |
| DR-054 | Do not adopt Zustand in v1.0. Use React's `useSyncExternalStore` with a small hand-written store over the controller's `subscribe`. Supersedes DR-035 once approved.                                                                                                | State is small and the controller already provides subscription. Removes a dependency. TECHNOLOGY_STACK §2.5.            | Proposed |
| DR-055 | Animation starts with CSS transitions and SVG attribute changes. Motion for React is adopted only if needed (DR-064).                                                                                                                                               | Most motion is state-driven. TECHNOLOGY_STACK §2.6.                                                                      | Proposed |
| DR-056 | Execution history stores one instruction record per instruction (addresses, cycles, before and after changes, explanation). Full snapshots are kept only for the current state and the previous state. Clock-level events are kept only for the latest instruction. | Compact; supports the forward-only timeline; allows future reverse execution. SIMULATION_PLATFORM §7–8.                  | Proposed |
| DR-057 | Architectures are registered in a composition root in `src/app/`, which passes the list to the platform. The platform's registry defines only the entry type and the lookup.                                                                                        | Corrects the earlier draft that imported BITSHIFT-8 into the platform. SYSTEM_ARCHITECTURE DEP-01, CPU strategy §5.      | Proposed |
| DR-058 | The platform has no timers. It exposes `beginRun`, `runBatch(n)` and `endRun`. The UI run loop owns timing.                                                                                                                                                         | Keeps results independent of time. Resolves a conflict between SIMULATION_PLATFORM §3 and MODULE_CONTRACTS §3.           | Proposed |
| DR-059 | No client-side router in v1.0. One workbench view; examples are chosen inside it.                                                                                                                                                                                   | Desktop-only (DR-040) and a single product area set (MVP-025). SYSTEM_ARCHITECTURE §10.                                  | Proposed |
| DR-060 | The assembler receives the ISA descriptor as an argument and imports no architecture module.                                                                                                                                                                        | Keeps the assembler independent of specific CPUs. SYSTEM_ARCHITECTURE DEP-03.                                            | Proposed |
| DR-061 | Each architecture supplies an instruction explanation function (MVP-022). It is pure and takes an instruction record. The UI displays its output.                                                                                                                   | Explanations depend on the architecture's semantics. CPU strategy §4.1, §7.                                              | Proposed |
| DR-062 | Visualization imports no architecture module. The app passes each architecture's visualization adapter to the view layer as a value.                                                                                                                                | Keeps visualization generic. SYSTEM_ARCHITECTURE DEP-04.                                                                 | Proposed |
| DR-063 | Editor text persistence (DR-048) is an application-layer adapter over browser storage. Every access is wrapped in try and catch. The platform has no storage.                                                                                                       | Keeps the platform storage-free. TECHNOLOGY_STACK §5.                                                                    | Proposed |

---

## C. Unresolved — Require Review

### C1. BITSHIFT-8 Architecture and ISA (blocks Phase 2)

| ID     | Question                                                                                                                         | Proposal (for review)                                                                  | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| DR-001 | Approve the BITSHIFT-8 characteristics: 8-bit data and address, 256 bytes RAM, 1–2 byte instructions, accumulator with A and B.  | Approve as listed in ISA §1                                                            | Open   |
| DR-002 | Memory organisation: unified program and data memory, or split.                                                                  | Unified                                                                                | Open   |
| DR-003 | Reset state: memory and register contents, load address, reset PC.                                                               | All zero; load at 0x00; PC = 0x00                                                      | Open   |
| DR-004 | PC behaviour: modulo-256 wrap, and whether a 2-byte instruction may cross 0xFF → 0x00.                                           | Wrap; crossing allowed                                                                 | Open   |
| DR-005 | Which registers are programmer-visible. IR, MAR, MDR and TEMP are display-only in the proposal.                                  | As proposed in ISA §2                                                                  | Open   |
| DR-006 | OUT: is it a register written by the OUT instruction, and what does "output" mean in the UI?                                     | Register shown in an output panel                                                      | Open   |
| DR-007 | Jump addressing: absolute 8-bit or relative.                                                                                     | Absolute                                                                               | Open   |
| DR-008 | Flags: SUB carry rule (borrow or no-borrow); whether INC, DEC and logic operations change C; whether signed overflow is tracked. | See ISA §7                                                                             | Open   |
| DR-009 | Whether a status register is exposed, and bit positions of Z, C and N if so.                                                     | Not exposed in v1.0                                                                    | Open   |
| DR-010 | LDI A and LDI B: separate opcodes (as the brief lists) or one opcode with a register field.                                      | Separate opcodes                                                                       | Open   |
| DR-011 | Clock ticks and micro-operation sequence per instruction. Needed for clock-level stepping and the timeline.                      | To be specified                                                                        | Open   |
| DR-012 | Mnemonics without opcodes: MOV, INC, DEC, AND, OR, XOR, NOT, JNZ, JC, JN, NOP. Also confirm that LDA targets A.                  | Opcodes and semantics needed                                                           | Open   |
| DR-015 | ISA descriptor: data-only table, or table plus functions.                                                                        | Data-only                                                                              | Open   |
| DR-016 | HLT and fault behaviour: whether the PC stays after HLT, resume rules, and fault on undefined opcode.                            | Fault on undefined opcode; HLT stays until reset                                       | Open   |
| DR-017 | Opcode map policy for unallocated opcodes: reserve them, or allocate later.                                                      | Reserve                                                                                | Open   |
| DR-018 | Stepping boundaries: whether one instruction step may end mid-instruction.                                                       | Instruction boundaries only for instruction steps; any micro-operation for clock steps | Open   |

### C2. Platform, Events and Assembler

| ID     | Question                                                                                                                                                  | Proposal (for review)                              | Status |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| DR-013 | Micro-operation representation: typed objects, RTL-style strings, or functions. Are micro-operations generic events visible to the platform?              | Typed objects; visible as `micro-operation` events | Open   |
| DR-014 | May architectures define their own event kinds?                                                                                                           | Yes, namespaced (DR-043)                           | Open   |
| DR-019 | Assembler syntax: mnemonic case, comment character, number formats, label syntax.                                                                         | To be proposed in Phase 3                          | Open   |
| DR-020 | Assembler directives and output format (for example ORG, DB, listing, hex or binary image).                                                               | To be proposed in Phase 3                          | Open   |
| DR-024 | Timeline history capacity (bounded ring buffer of instruction entries).                                                                                   | 10,000 entries                                     | Open   |
| DR-027 | Breakpoints during clock-level stepping.                                                                                                                  | Checked at instruction boundaries during run only  | Open   |
| DR-035 | Zustand timing: introduced in Phase 5, or earlier if the controller subscription needs it. Superseded in part by DR-054 (proposed: do not adopt Zustand). | Phase 5                                            | Open   |

### C3. Application, Visualization, Performance and Process

| ID     | Question                                                                                                                                                         | Proposal (for review)                                       | Status |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| DR-021 | Enforce import boundaries with ESLint, which is not yet approved as a dependency. Until then, review enforces them.                                              | Add ESLint in Phase 1                                       | Open   |
| DR-023 | Datapath diagram: bus model (single shared bus or several buses) and component IDs.                                                                              | Single shared bus, fixed IDs                                | Open   |
| DR-030 | Startup behaviour: whether the editor loads a bundled example on startup.                                                                                        | Yes, a short example                                        | Open   |
| DR-031 | Performance targets from PRODUCT_SPEC S-7: one micro-operation updates the UI within one frame; 10,000 instructions complete in under 2 s with animation paused. | Confirm                                                     | Open   |
| DR-037 | Coverage target for the simulation core.                                                                                                                         | 90% line coverage in `src/platform` and `src/architectures` | Open   |
| DR-038 | Component test tooling for React (for example React Testing Library).                                                                                            | Decide in Phase 5                                           | Open   |
| DR-039 | Approval of the technology stack as a whole. CLAUDE.md refers to an "approved" stack; approval is still pending.                                                 | Approve TECHNOLOGY_STACK §1                                 | Open   |
| DR-042 | Hosting target for the static release build.                                                                                                                     | Not chosen; must be static                                  | Open   |

### C4. Product Questions (Stage 0.1)

| ID     | Question                                                                                                 | Proposal (for review)                                                           | Status |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| DR-045 | Include instruction explanations (MVP-022) in v1.0? They are not mapped to a roadmap stage.              | Yes, one generated line per instruction; add to Stage 5.4                       | Open   |
| DR-046 | Speed control form (MVP-014): presets or continuous slider?                                              | Presets (Slow, Normal, Fast) plus animation off                                 | Open   |
| DR-047 | Number of example programs in v1.0 (MVP-004).                                                            | 8, at least one per instruction group                                           | Open   |
| DR-048 | Should unsaved editor text persist between visits in the same browser (MVP-001)?                         | Yes, browser-local only; no accounts or server                                  | Open   |
| DR-049 | Accessibility baseline for the workbench.                                                                | WCAG 2.1 AA contrast; all controls keyboard-operable                            | Open   |
| DR-050 | Learner assumptions: English-only interface; undergraduate level; no prior assembly knowledge.           | Confirm (PRODUCT_SPEC AS-02, §3)                                                | Open   |
| DR-051 | Which control signals are shown (MVP-019): named signals from the micro-operation model, not gate-level. | Named signals only                                                              | Open   |
| DR-052 | Learning measure S-8: number of learners and pass threshold for the Phase 6 user test.                   | At least 5 learners; 4 of 5 complete journey unaided and answer LO-01 and LO-02 | Open   |

---

### C5. Architecture Questions (Stage 0.2)

| ID     | Question                                                                                                                                                                                                                                                         | Proposal (for review)                        | Status |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------ |
| DR-064 | Adopt Motion for React for datapath animation (see DR-055).                                                                                                                                                                                                      | Decide at the Phase 4 spike                  | Open   |
| DR-065 | Tailwind CSS or plain CSS with custom properties for styling.                                                                                                                                                                                                    | Confirm at the start of Phase 4              | Open   |
| DR-066 | Apply the contract changes listed in CPU_ARCHITECTURE_STRATEGY §4.3 (run operations, `stepClock` naming, explanation hook, control-signal payloads, `CpuSnapshot.tick` meaning). Until applied, the contract documents disagree with the architecture documents. | Apply in the Stage 0.3 review, once approved | Open   |

---

## Summary

| Category        | Count | Notes                                                            |
| --------------- | ----- | ---------------------------------------------------------------- |
| A (established) | 14    | Do not change without the product owner                          |
| B (proposed)    | 24    | Written into the documents; not final                            |
| C (unresolved)  | 42    | Includes ISA, platform, assembler, process and product questions |

Each ID appears in exactly one table.

## Change Log

| Date       | Change                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Initial register created in Phase 0. No item approved.                                                                                                      |
| 2026-11-16 | Stage 0.1: added DR-045 to DR-052 (product questions). Nothing approved.                                                                                    |
| 2026-11-16 | Stage 0.2: added DR-053 to DR-066 (architecture proposals and questions); refined DR-034; DR-035 superseded in part by DR-054 (proposed). Nothing approved. |
