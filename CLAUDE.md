# CLAUDE.md — BITSHIFT

Engineering guide for Claude Code. Read this first in every session. It points to the authoritative documents rather than repeating them. When this file and a document disagree, the document wins, and the disagreement is reported.

## 1. Project

BITSHIFT is a browser-based educational computer architecture simulator. Learners write assembly, run it on a virtual CPU, and watch instructions move through registers, the ALU, memory and buses. There is no backend. Everything runs in the browser.

Product definition: `docs/product/PRODUCT_SPEC.md`, `MVP_SCOPE.md`, `RELEASE_ROADMAP.md`.

## 2. Where the Project Is

- **Release:** v1.0, BITSHIFT-8 simulator. Only v1.0 is authorised for planning and implementation. v2.0 to v4.0 are directions only.
- **Phase:** Phase 0 (product and architecture foundation). Stages 0.1 to 0.3 are complete and awaiting product-owner acceptance. **Stage 0.4 has not started.**
- **Application code:** none. `src/` contains only the placeholder shell. Do not write simulator code until the phase that owns it has started and its prerequisites are approved.

## 3. Hierarchy and Workflow

Work is organised as **Phase → Stage → Slice → Task** (`docs/engineering/DEFINITION_OF_DONE.md` §1).

1. Find the stage in `docs/engineering/DEVELOPMENT_ROADMAP.md`. Read its objective, deliverables and acceptance criteria.
2. Read the contracts and architecture documents that the stage touches, before changing anything. Name them in the report.
3. Check the decision register for every open item the work depends on. An item marked **Open**, **Proposed** or **Deferred** is not treated as approved.
4. Implement one slice at a time. Each acceptance criterion gets a test (`docs/engineering/TEST_STRATEGY.md`).
5. Finish with the implementation report (`DEFINITION_OF_DONE.md` §6).

**Do not implement future stages early.** If a task needs work from a later stage, stop and report the dependency.

## 4. Approved Decisions That Shape the Code

Authoritative list: `docs/decisions/DECISION_REGISTER.md`. The main ones:

- **Platform owns the only cycle counter** (DR-067). Architectures report `cyclesCompleted`; they never report a cycle number. Failed steps advance nothing.
- **Architecture identity has one source:** the ISA's `architectureId`. The descriptor has no separate `id` (SC-30, Stage 0.3 reading).
- **Descriptors are data-only.** `createInstance()` belongs to `CpuArchitecture` (DR-015).
- **Architecture selection happens at initialization.** No runtime switching in v1.0 (SC-D3).
- **Architectures are registered in the composition root** `src/app/` (DR-057). The platform imports no concrete architecture.
- **The platform has no timers.** The UI calls `runBatch` (DR-058).
- **Breakpoints are platform-owned.** The CPU never sees them and never reports them (SC-10).
- **State:** React's native mechanisms through `useSyncExternalStore`. No state library (DR-054). Animation is CSS and SVG first (DR-055); Motion is deferred (DR-064).
- **Explanations are optional metadata** and never affect execution (DR-061).
- **Persistence** lives in the application layer (DR-063).

## 5. Architecture Boundaries

Subsystem map and dependency rules: `docs/architecture/SYSTEM_ARCHITECTURE.md` §3 and §6. In short:

- `src/platform`, `src/architectures`, `src/assembler` contain no React, DOM, timers, randomness or UI or animation libraries.
- `src/architectures/<id>` imports only platform types. Architectures never import each other.
- `src/assembler` receives the ISA as an argument and touches no CPU instance.
- `src/visualization` consumes snapshots, events and view-model adapters. It never mutates CPU state and never invents state changes.
- Only `src/app` imports concrete architectures and the assembler.

These boundaries are checked by the Phase 1 import test and by review.

## 6. Contracts

Shared types and interfaces: `docs/contracts/`. Their authority:

| Document              | Covers                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| `DATA_CONTRACTS.md`   | Shared data types, ownership, mutability, diagnostic codes             |
| `MODULE_CONTRACTS.md` | Public interface of every subsystem, error behaviour, synchronous mode |
| `EVENT_MODEL.md`      | Event shapes, cycle assignment, ordering, replay invariant             |

Rules:

- Do not change a contract silently. A contract change is a register decision first, then the document, then the code, in one change.
- Diagnostic codes are listed in `DATA_CONTRACTS.md` §11 before they are used.
- Errors follow three classes: `Result` errors for caller mistakes, faults for simulated CPU conditions, and exceptions for programmer errors (`SIMULATION_PLATFORM.md` §9).

## 7. Conventions

Full rules: `docs/engineering/CODING_STANDARDS.md`. Summary:

- TypeScript `strict`. No `any`. Use `readonly` on shared types. No enums. No default exports in `src/`.
- Terminology: `cycle` and `ClockCycle`, never `tick` or `Tick`. Use the terms in CODING_STANDARDS §3.2.
- Published values are frozen; inputs are never mutated; memory is copied at each boundary.
- Format with `pnpm format`. LF line endings.
- No dependency without a row in `docs/architecture/TECHNOLOGY_STACK.md` §4.2 in the same change.

## 8. Testing

Full strategy: `docs/engineering/TEST_STRATEGY.md`. Summary:

- Platform, architecture, assembler and visualization logic is tested in Node, without React or a browser.
- Snapshot isolation, determinism, event ordering and the replay invariant, cycle counting, history limits, error handling and breakpoints each have named tests (sections 5.1 to 5.9 of that document).
- Expected values come from the specification, never from the implementation's output.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## 9. Documentation Rules

- Categories: **[A]** established by the product owner; **[B]** proposed; **[C]** open. A proposal is never presented as final.
- Decision IDs are kept. Do not delete a historical decision. Mark it superseded and say by what.
- Before finishing a documentation change, check links, `DR-` references and formatting (`DEFINITION_OF_DONE.md` §5).
- Do not modify product requirements, or the approved roadmap, without the product owner's approval recorded in the register.

## 10. Reporting

After each task or slice, report (`DEFINITION_OF_DONE.md` §6):

1. What was built, in a short paragraph.
2. Files changed, with paths.
3. Acceptance criteria, the tests that cover them, and their results.
4. Validation commands run and their results. Anything not run is reported as not run.
5. Decisions, labelled approved, proposed or open, with register IDs.
6. Unresolved issues and the next step.

Do not describe anything as passing unless it was run and seen to pass.

## 11. Standing Rules

1. Read the relevant documents before changing architecture or code.
2. Never silently change an approved contract or decision.
3. Report contradictions. Do not guess between two documents.
4. Do not introduce dependencies without a justification and a stack row.
5. Keep the simulation independent of presentation.
6. Do not implement future-release or future-stage features.
7. Every slice has testable acceptance criteria.
8. Do not overwrite a file without reading it first.
9. Prefer minimal, maintainable solutions.
10. Do not invent BITSHIFT-8 instructions, flags, cycle counts, micro-operation sequences or control-signal names. Those come from the Phase 2 specification (DR-001 to DR-018, DR-011, DR-013).

## 12. Out of Scope for v1.0

- Microcode visualization, interrupts, I/O devices, advanced debugging, reverse execution, cache and pipeline visualization, custom CPU configurations, digital logic exploration (v2.0).
- BITSHIFT-16 and RISC-V RV32I (v3.0).
- Guided lessons, shareable programs, tutorials, user-created architectures (v4.0).
- Any backend, accounts or cloud storage. Mobile and touch layouts.
- AI-generated explanations or tutoring.

Full list: `docs/product/MVP_SCOPE.md` §3.

## 13. Stack Status

The technology stack is **proposed**; its approval is pending (DR-039). The approved items are: no state library (DR-054) and CSS-first animation (DR-055). Deferred: Motion (DR-064) and Tailwind (DR-065). Current stack and the dependency plan: `docs/architecture/TECHNOLOGY_STACK.md`.

## 14. Slash Commands

- `/validate-docs`: documentation consistency check.
- `/audit-stage <n>`: audit a roadmap stage against its acceptance criteria.
