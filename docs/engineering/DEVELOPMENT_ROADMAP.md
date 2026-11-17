# BITSHIFT — Development Roadmap (v1.0)

**Status:** Proposed (B). Phase and stage outline (7 phases, 32 stages) is product-owner stated (A). Slices are suggestions.
**Scope:** v1.0 only. See [MVP_SCOPE.md](../product/MVP_SCOPE.md).

This roadmap is a sequence of stages, not a task list. Slices are suggested groupings for planning and may be re-cut during implementation, provided acceptance criteria are kept.

**Totals:** 7 phases, 32 stages (4 + 5 + 5 + 4 + 5 + 5 + 4).

---

## Phase 0 — Product & Architecture Foundation

**Objective:** Define the product, architecture, contracts and engineering rules, and prepare the repository. No CPU implementation.
**Stages:** 4 (0.1–0.4)
**Expected outcomes:** Reviewable documentation set, decision register, repository scaffold, validation report.
**Dependencies:** Product brief.
**Exit criteria:** Phase 0 Done criteria in [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) section 5.

### Stage 0.1 — Product Definition

- **Objective:** Fix what BITSHIFT is and what v1.0 contains.
- **Scope:** Vision, goals, users, journeys, MVP scope, exclusions, release strategy, success criteria.
- **Suggested slices:** (1) product spec; (2) MVP scope and exclusions; (3) release roadmap.
- **Dependencies:** None.
- **Deliverables:** `docs/product/PRODUCT_SPEC.md`, `MVP_SCOPE.md`, `RELEASE_ROADMAP.md`.
- **Acceptance criteria:** Every v1 feature maps to a stage in this roadmap; every exclusion is listed; success criteria are measurable.

### Stage 0.2 — Technology & System Architecture

- **Objective:** Define subsystems, boundaries, data flow, execution model and stack.
- **Scope:** System, platform, CPU strategy and technology docs.
- **Suggested slices:** (1) subsystem map and boundaries; (2) platform and execution model; (3) CPU registration strategy; (4) stack and rationale.
- **Dependencies:** 0.1.
- **Deliverables:** `docs/architecture/` (four documents), `docs/decisions/ADR-001`.
- **Acceptance criteria:** Each subsystem has one owner directory; no two documents disagree on the dependency rules; every stack choice has a rationale and status.

### Stage 0.3 — Contracts & Engineering Standards

- **Objective:** Define typed contracts and the engineering rules that enforce them.
- **Scope:** Data contracts, module contracts, event model, coding standards, test strategy, Definition of Done.
- **Suggested slices:** (1) data contracts; (2) module contracts; (3) event model; (4) engineering standards.
- **Dependencies:** 0.2.
- **Deliverables:** `docs/contracts/` (three), `docs/engineering/` (three of this set).
- **Acceptance criteria:** Each contract in the brief (CPU architecture, instance, snapshot, event, controller, assembler, memory inspection, visualization data) is defined; names match across all documents.

### Stage 0.4 — Repository Foundation & Architecture Review

- **Objective:** Create the repository structure, Claude Code instructions, decision register and validate the whole Phase 0 set.
- **Scope:** Directory layout, minimal scaffold, `CLAUDE.md`, commands, roadmap, ADR index, decision register, validation.
- **Suggested slices:** (1) scaffold and tooling; (2) Claude Code configuration; (3) decision register and ADR index; (4) validation pass.
- **Dependencies:** 0.1–0.3.
- **Deliverables:** Repository layout, `CLAUDE.md`, `.claude/`, `docs/decisions/`, validation report.
- **Acceptance criteria:** Project installs and passes typecheck, test and format check; validation checklist in `/validate-docs` passes.

---

## Phase 1 — Simulation Platform Backbone

**Objective:** Build the architecture-independent platform: registry, lifecycle, controller, events and snapshots, proven with a test-only fixture.
**Stages:** 5 (1.1–1.5). Stage names and order were corrected on 2026-11-16 (DR-073). Slices: [PHASE_1_EXECUTION_PLAN.md](PHASE_1_EXECUTION_PLAN.md).
**Expected outcomes:** A platform that runs any architecture satisfying the contracts. No real CPU yet.
**Dependencies:** Phase 0 approved, including ADR-001 and the Phase 1 items in the blocking summary of the [decision register](../decisions/DECISION_REGISTER.md).
**Exit criteria:** All platform contract tests pass against the fixture; no platform file imports architecture or UI code.

### Stage 1.1 — Architecture Registry

- **Objective:** Create the small shared types and utilities used everywhere, and register architectures.
- **Scope:** `Result`, `Diagnostic`, `SourceSpan`, `ClockCycle`, identifiers, memory range helpers. Registry module.
- **Suggested slices:** (1) `Result` helpers, diagnostic and span types, memory-range validation; (2) registry with explicit list.
- **Dependencies:** Phase 0.
- **Deliverables:** `src/platform/` shared module and registry module; tests in `tests/platform/`.
- **Acceptance criteria:** Helpers are pure; each has unit tests; no React or architecture imports. Unknown IDs return `Result` errors.

### Stage 1.2 — CPU Lifecycle & Instance Management

- **Objective:** Manage instance lifecycle.
- **Scope:** Lifecycle states, load and reset rules from SIMULATION_PLATFORM section 3. The boundary around the architecture instance.
- **Suggested slices:** (1) lifecycle state machine; (2) instance management and load and reset transitions.
- **Dependencies:** 1.1.
- **Deliverables:** Lifecycle and instance modules; contract tests.
- **Acceptance criteria:** Every transition in the state diagram is tested; illegal transitions are rejected with a diagnostic.

### Stage 1.3 — State & Event System

- **Objective:** Deliver ordered, batched events and copied snapshots to subscribers.
- **Scope:** Event envelope, sequence numbering, batching, snapshot copy rules, bounded instruction history, breakpoint set.
- **Suggested slices:** (1) snapshots; (2) event envelope and ordering; (3) bounded history (capacity per DR-024); (4) breakpoint set.
- **Dependencies:** 1.1.
- **Deliverables:** Event, snapshot, history and breakpoint modules; tests.
- **Acceptance criteria:** Events are delivered once and in order; a snapshot never changes after creation; history never exceeds its capacity.

### Stage 1.4 — Execution Controller

- **Objective:** Single entry point for step, run and pause.
- **Scope:** Controller methods from MODULE_CONTRACTS section 2.4; subscriptions; run batches with a cycle budget.
- **Suggested slices:** (1) core and clock step; (2) instruction step and history; (3) fault and internal-error paths; (4) run and pause; (5) breakpoint checks at instruction boundaries.
- **Dependencies:** 1.1 to 1.3. The fixture slice of Stage 1.5 is implemented before this stage, because the controller is tested with it.
- **Deliverables:** Controller module; tests with fixture.
- **Acceptance criteria:** Same program gives same final snapshot for any batch size; pause takes effect within one batch; breakpoints stop at the correct instruction boundary.

### Stage 1.5 — Mock CPU & Verification

- **Objective:** Prove the platform works for an architecture unlike BITSHIFT-8.
- **Scope:** Test-only fixture architecture; full contract test suite.
- **Suggested slices:** (1) fixture with different register widths; (2) contract tests for every platform interface and determinism tests; (3) measurement and phase exit.
- **Dependencies:** 1.1 for the fixture slice; 1.4 for the rest.
- **Deliverables:** `tests/platform/fixtures/`, contract test suite.
- **Acceptance criteria:** Platform tests pass with the fixture; the fixture is never imported from `src/`; determinism tests pass.

---

## Phase 2 — BITSHIFT-8 CPU Core

**Objective:** Implement the BITSHIFT-8 CPU exactly as the approved ISA specifies.
**Stages:** 5 (2.1–2.5)
**Expected outcomes:** A conforming CPU behind the platform contracts, with conformance tests.
**Dependencies:** Phase 1 exit; **approved ISA** (all [C] items in BITSHIFT-8_ISA.md resolved, DR-001 to DR-018 closed).
**Exit criteria:** Conformance suite passes 100%; no UI code in `src/architectures/bitshift-8/`.

### Stage 2.1 — Registers, Flags & Memory

- **Objective:** State storage for BITSHIFT-8.
- **Scope:** Registers from the ISA, flags, 256-byte memory, reset contents, PC wrap.
- **Suggested slices:** (1) register and flag definitions; (2) memory, program load with its range check, reset and PC wrap.
- **Dependencies:** Approved ISA; Phase 1.
- **Deliverables:** Descriptor, registers, memory modules.
- **Acceptance criteria:** Reset state matches spec; PC wraps from 0xFF to 0x00; the program loader rejects, with a diagnostic, an image whose start address and length exceed the 256-byte memory. Addresses are 8 bits, so no CPU memory access can be out of range and no such check exists inside the CPU (DR-084).

### Stage 2.2 — ALU

- **Objective:** Arithmetic and logic operations with flag rules.
- **Scope:** Add, subtract and logic operations used by the ISA, with Z, C, N rules.
- **Suggested slices:** (1) add and subtract with carry; (2) logic operations; (3) flag rule tests.
- **Dependencies:** 2.1.
- **Deliverables:** ALU module and unit tests.
- **Acceptance criteria:** Every operation has boundary tests (0, 1, 127, 128, 255); flags match the approved table.

### Stage 2.3 — Instruction Set, Encoding & Decoding

- **Objective:** Opcode table, instruction lengths and decoding.
- **Scope:** Full instruction table from the approved ISA; ISA descriptor for the assembler.
- **Suggested slices:** (1) instruction table; (2) decoder; (3) undefined opcode fault.
- **Dependencies:** 2.1, approved opcode allocation.
- **Deliverables:** `isa.ts`, `decode.ts`, descriptor, and concise explanation metadata for each supported instruction (MVP-022; DR-045, approved for v1.0; optional metadata, no AI-generated text).
- **Acceptance criteria:** Every approved opcode decodes to its mnemonic and length; every unallocated opcode produces the approved fault. Every supported instruction has an explanation entry (AC-022-1). Removing all explanation entries leaves execution results unchanged (AC-022-3).

### Stage 2.4 — Micro-Operations & Execution Sequencing

- **Objective:** Clock-level execution of fetch, decode and execute.
- **Scope:** Micro-operation sequences per instruction; `stepClock` and `stepInstruction`; events emitted per EVENT_MODEL.
- **Suggested slices:** (1) fetch micro-operations; (2) execute micro-operations for each instruction group; (3) event emission.
- **Dependencies:** 2.2, 2.3, approved micro-operation representation (DR-013).
- **Deliverables:** Instance, microcode, snapshot modules.
- **Acceptance criteria:** Cycle count per instruction matches DR-011; each micro-operation emits its documented events; snapshots match state after every step.

### Stage 2.5 — Conformance Suite & Reference Programs

- **Objective:** Verify the CPU against the spec as a whole.
- **Scope:** Conformance suite; small programs that exercise several instructions together.
- **Suggested slices:** (1) per-instruction conformance; (2) flag and wrap conformance; (3) multi-instruction programs run through the instance.
- **Dependencies:** 2.4.
- **Deliverables:** `tests/architectures/bitshift-8/`.
- **Acceptance criteria:** 100% of conformance tests pass; every test cites its spec section; expected values are not generated from the implementation.

---

## Phase 3 — Assembler & Programming Environment

**Objective:** Turn source text into loadable programs with clear diagnostics, and provide the editor.
**Stages:** 4 (3.1–3.4)
**Expected outcomes:** Learners can write, assemble and load programs.
**Dependencies:** Phase 2 ISA descriptor; DR-019 and DR-020 (assembler syntax and output) resolved.
**Exit criteria:** Golden tests pass; every diagnostic code has a test; editor loads a program into the controller.

### Stage 3.1 — Lexer & Parser

- **Objective:** Read source into a structured form with spans.
- **Scope:** Tokens, instructions, operands, labels, comments, directives approved in DR-020.
- **Suggested slices:** (1) lexer with spans; (2) instruction-line parser; (3) directive parser.
- **Dependencies:** Phase 2 ISA descriptor.
- **Deliverables:** Lexer and parser modules.
- **Acceptance criteria:** Each token has a span; malformed lines produce diagnostics without throwing.

### Stage 3.2 — Label Resolution & Encoding

- **Objective:** Resolve symbols and produce bytes.
- **Scope:** Two-pass label resolution, operand range checks, encoding via ISA descriptor.
- **Suggested slices:** (1) symbol table; (2) encoding with range checks; (3) source map.
- **Dependencies:** 3.1.
- **Deliverables:** Resolver, encoder, source map.
- **Acceptance criteria:** Forward and backward references resolve; out-of-range operands are diagnosed; source map covers each instruction.

### Stage 3.3 — Diagnostics

- **Objective:** Learner-friendly error reporting.
- **Scope:** Diagnostic codes, messages and spans for every assembler error category.
- **Suggested slices:** (1) code catalogue; (2) message wording review; (3) multi-error collection.
- **Dependencies:** 3.1, 3.2.
- **Deliverables:** Diagnostic catalogue; tests.
- **Acceptance criteria:** Every code has a test; every message includes line and column; the assembler reports several errors per run where possible.

### Stage 3.4 — Editor Integration

- **Objective:** Editor that assembles and loads programs.
- **Scope:** CodeMirror 6 editor, syntax highlighting, diagnostic markers, load-and-run actions.
- **Suggested slices:** (1) editor component; (2) syntax highlighting; (3) diagnostic markers and load action.
- **Dependencies:** 3.3, Phase 1 controller.
- **Deliverables:** Editor feature module.
- **Acceptance criteria:** Editing re-assembles on demand; diagnostics appear at the correct line; loading a program updates controller state.

---

## Phase 4 — Visualization Engine

**Objective:** Build the animated SVG datapath and the inspection visuals, driven only by snapshots and events.
**Stages:** 5 (4.1–4.5)
**Expected outcomes:** A datapath that shows what each micro-operation does.
**Dependencies:** Phase 2 snapshots and events; approved event model (DR-013, DR-014).
**Exit criteria:** Visualization reads only view models; animations are driven by events; layout reviewed at target width.

### Stage 4.1 — SVG Datapath Layout

- **Objective:** Static datapath diagram for BITSHIFT-8.
- **Scope:** Components, labels and positions, mapped to architecture component IDs.
- **Suggested slices:** (1) component layout; (2) labels and legend; (3) id mapping to view model.
- **Dependencies:** Approved datapath design (DR-023).
- **Deliverables:** SVG layout asset and component.
- **Acceptance criteria:** Every component in the ISA's datapath appears once; all IDs match the view model.

### Stage 4.2 — Buses & Register Visualization

- **Objective:** Show bus values and register contents on the diagram.
- **Scope:** Bus state, register value display, active highlighting.
- **Suggested slices:** (1) bus rendering; (2) register value display; (3) highlight state.
- **Dependencies:** 4.1.
- **Deliverables:** Bus and register components.
- **Acceptance criteria:** Bus active state matches `bus-transfer` events; register values match snapshots.

### Stage 4.3 — ALU & Control Visualization

- **Objective:** Show ALU operation and control activity.
- **Scope:** ALU inputs, output and operation label; control signals derived from micro-operation labels.
- **Suggested slices:** (1) ALU panel; (2) micro-operation label display; (3) flag display.
- **Dependencies:** 4.2.
- **Deliverables:** ALU and control components.
- **Acceptance criteria:** ALU panel reflects `alu-operation` events; labels match the active micro-operation.

### Stage 4.4 — Animation of Micro-Operations

- **Objective:** Animate data movement with Motion.
- **Scope:** Transitions for bus transfers and highlights; animation speed control.
- **Suggested slices:** (1) transfer animation; (2) highlight transitions; (3) speed setting.
- **Dependencies:** 4.3, Motion approved.
- **Deliverables:** Animation layer.
- **Acceptance criteria:** Animation can be disabled; disabling it does not change simulation results; each animation completes within its configured duration.

### Stage 4.5 — Memory Inspection & Timeline View

- **Objective:** Memory grid and timeline display.
- **Scope:** 256-byte memory view with recent access highlighting; timeline list from instruction entries.
- **Suggested slices:** (1) memory grid; (2) recent-access highlighting; (3) timeline list.
- **Dependencies:** Phase 1 history; 4.2.
- **Deliverables:** Memory and timeline components.
- **Acceptance criteria:** Memory grid shows all 256 bytes; timeline shows entries in order and is forward-only.

---

## Phase 5 — Interactive Workbench & Debugger

**Objective:** Assemble the full application workbench and basic debugging.
**Stages:** 5 (5.1–5.5)
**Expected outcomes:** A usable application with all v1 panels, controls and debugging.
**Dependencies:** Phases 3 and 4.
**Exit criteria:** Journey steps 1–10 in PRODUCT_SPEC §5 can be completed in the browser.

### Stage 5.1 — Workbench Layout & Navigation

- **Objective:** Panel layout and page structure.
- **Scope:** Application shell, panel arrangement, navigation between example programs and workbench.
- **Suggested slices:** (1) shell layout; (2) panel arrangement; (3) navigation.
- **Dependencies:** Phase 4 components.
- **Deliverables:** App shell and layout components.
- **Acceptance criteria:** All panels are reachable; layout works at 1280px and wider.

### Stage 5.2 — Execution Controls

- **Objective:** Run, pause, step controls bound to the controller.
- **Scope:** Buttons and keyboard shortcuts for step micro-operation, step instruction, run, pause, reset.
- **Suggested slices:** (1) store adapter; (2) control buttons; (3) keyboard shortcuts.
- **Dependencies:** 5.1, Phase 1 controller.
- **Deliverables:** Store and control components.
- **Acceptance criteria:** Each control sends exactly one intent; control state reflects the controller state.

### Stage 5.3 — Register & Memory Inspectors

- **Objective:** Readable inspection panels.
- **Scope:** Register and flag panel, memory panel with navigation, output panel.
- **Suggested slices:** (1) register and flag panel; (2) memory panel; (3) output panel.
- **Dependencies:** 5.2.
- **Deliverables:** Inspector components.
- **Acceptance criteria:** Values match snapshots after every step; values are shown in hex and decimal.

### Stage 5.4 — Execution Timeline Navigation

- **Objective:** Timeline panel with selection and detail.
- **Scope:** Timeline list, selecting an entry shows its events. Forward-only (reverse stepping is out of scope). Entry detail shows the instruction explanation (MVP-022; DR-045, approved), with generic fallback text when none exists.
- **Suggested slices:** (1) list view; (2) entry detail; (3) clear and restart behaviour.
- **Dependencies:** 4.5, 5.3.
- **Deliverables:** Timeline feature.
- **Acceptance criteria:** Entries match executed instructions; the UI never implies backward execution. Explanations display for every supported instruction, and generic fallback text appears where none exists (AC-022-2, AC-022-4).

### Stage 5.5 — Basic Debugging

- **Objective:** Breakpoints, halt and fault display.
- **Scope:** Address breakpoints in the editor and memory view; halt and fault banners; reset.
- **Suggested slices:** (1) breakpoint toggle; (2) run-until-breakpoint; (3) fault and halt banners.
- **Dependencies:** 5.2, Phase 1 breakpoints.
- **Deliverables:** Debug feature.
- **Acceptance criteria:** Run stops at each breakpoint address; fault and halt states are visible with their diagnostic; breakpoint behaviour matches DR-027.

---

## Phase 6 — Integration, Testing & Release

**Objective:** Prove the whole application works, ship example programs and produce the v1.0 static build.
**Stages:** 4 (6.1–6.4)
**Expected outcomes:** A release candidate that meets the v1.0 success criteria.
**Dependencies:** Phase 5.
**Exit criteria:** All v1.0 acceptance criteria in MVP_SCOPE met; release notes and build artefact produced.

### Stage 6.1 — Example Program Library

- **Objective:** Provide documented example programs.
- **Scope:** Example set covering each instruction group; each with expected results.
- **Suggested slices:** (1) example selection and comments; (2) expected-result tests; (3) in-app access.
- **Dependencies:** Phase 3, 5.
- **Deliverables:** Example programs and their tests.
- **Acceptance criteria:** Every example has a passing test; every example's comments match its behaviour.

### Stage 6.2 — End-to-End & Integration Suite

- **Objective:** Test the assembled system across layers.
- **Scope:** Integration tests from source to inspected state; UI smoke tests on key journeys.
- **Suggested slices:** (1) assemble-run-inspect tests; (2) journey smoke tests; (3) regression set.
- **Dependencies:** 6.1.
- **Deliverables:** `tests/integration/` suite.
- **Acceptance criteria:** Journey steps 1–10 of PRODUCT_SPEC §5 pass; integration suite is deterministic.

### Stage 6.3 — Cross-Platform & Browser Verification

- **Objective:** Verify target platforms.
- **Scope:** Windows, macOS, Linux; current Chrome, Edge, Firefox, Safari.
- **Suggested slices:** (1) checklist; (2) run and record results; (3) fix blocking issues.
- **Dependencies:** 6.2.
- **Deliverables:** Verification record.
- **Acceptance criteria:** Each target combination is recorded as passed or failed with notes. Gaps are reported, not hidden.

### Stage 6.4 — Release Packaging & Documentation

- **Objective:** Produce the static build and user-facing docs.
- **Scope:** Production build, README, release notes, known limitations.
- **Suggested slices:** (1) build configuration; (2) user README; (3) release notes and limitations.
- **Dependencies:** 6.3.
- **Deliverables:** Build output, README, release notes.
- **Acceptance criteria:** `pnpm build` succeeds from a clean checkout; the static build runs without a server beyond static hosting; limitations are documented.
