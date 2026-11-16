# CLAUDE.md — BITSHIFT

Engineering guide for Claude Code. Read this first in every session. It points to the authoritative documents rather than repeating them. When this file and a document disagree, the document wins, and the disagreement is reported.

## 1. Project

BITSHIFT is a browser-based educational computer architecture simulator. Learners write assembly, run it on a virtual CPU, and watch instructions move through registers, the ALU, memory and buses. There is no backend. Everything runs in the browser.

Product definition: `docs/product/PRODUCT_SPEC.md`, `MVP_SCOPE.md`, `RELEASE_ROADMAP.md`.

## 2. Where the Project Is

- **Release:** v1.0, BITSHIFT-8 simulator. Only v1.0 is authorised for planning and implementation. v2.0 to v4.0 are directions only.
- **Phase:** Phase 1 (simulation platform backbone), in progress. Phase 0 is complete. Slice status and the next batch: `docs/engineering/PHASE_1_EXECUTION_PLAN.md` §10.
- **Application code:** `src/platform/` is being built slice by slice. `src/app/` holds the placeholder shell. The other `src/` directories are empty by design. Do not write code for a phase that has not started.

## 3. Hierarchy and Workflow

Work is organised as **Phase → Stage → Slice → Task** (`docs/engineering/DEFINITION_OF_DONE.md` §1).

1. Find the stage in `docs/engineering/DEVELOPMENT_ROADMAP.md`. Read its objective, deliverables and acceptance criteria.
2. Read the contracts and architecture documents that the stage touches, before changing anything. Name them in the report.
3. Check the decision register for every open item the work depends on. An item marked **Open**, **Proposed** or **Deferred** is not treated as approved.
4. Implement one slice at a time. Each acceptance criterion gets a test (`docs/engineering/TEST_STRATEGY.md`).
5. Finish with the implementation report (`DEFINITION_OF_DONE.md` §6), including any delegated tasks (§10).

**Do not implement future stages early.** If a task needs work from a later stage, stop and report the dependency.

**Agent roles.** The Engineering Supervisor (Fable 5.2) plans, reviews and audits, and never writes code. The Lead Executor (Sonnet 5.5) owns all implementation and may delegate bounded tasks to the Specialist Sub-agent (Haiku 5.5), reviewing each one before integration. The product owner approves decisions and gives final acceptance. Full hierarchy and the seven-step workflow: `docs/engineering/BITSHIFT_SUPERVISOR.md` §1 and §1.2. The rules in this file apply to every agent, including sub-agents.

Supervision, review verdicts and the slice-by-slice plan: `docs/engineering/BITSHIFT_SUPERVISOR.md` and `docs/engineering/PHASE_1_EXECUTION_PLAN.md`. Where a contract document and the decision register disagree, the register wins until the amendment listed in the plan, section 2.2, is written.

## 4. Approved Decisions That Shape the Code

Authoritative list: `docs/decisions/DECISION_REGISTER.md`. The main ones:

- **Platform owns the only cycle counter** (DR-067). Architectures report `cyclesCompleted`; they never report a cycle number. Failed steps advance nothing.
- **Architecture identity has one source:** the ISA's `architectureId`. The descriptor has no separate `id` (SC-30, Stage 0.3 reading).
- **Descriptors are data-only.** `createInstance()` belongs to `CpuArchitecture` (DR-015).
- **Architecture selection happens at initialization.** No runtime switching in v1.0 (SC-D3).
- **Architectures are registered in the composition root** `src/app/` (DR-057). The platform imports no concrete architecture. The composition root validates that the selected architecture matches the ISA (DR-069).
- **Instruction steps are composed by the platform** from `stepClock()`. The CPU instance has no `stepInstruction()`. Atomicity is per clock cycle; there is no instruction-level rollback (DR-074).
- **Failed steps:** Result errors never invoke the architecture. Faulting steps complete zero cycles and emit no events. Exceptions become `PLT-INTERNAL`, complete zero cycles, and leave the controller faulted. The next reset creates a fresh instance (DR-070, DR-071).
- **Shared event payloads** keep their Phase 0 fields. Changes need explicit approval (DR-072).
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

These boundaries are enforced by `pnpm lint` (`eslint.config.js`) and by review.

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
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`.

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

If any work was delegated, the report also lists each delegated task, the sub-agent that did it, how the lead executor reviewed it, and the result. If nothing was delegated, it says so. Do not claim a delegation that did not happen (`BITSHIFT_SUPERVISOR.md` §1.1, §1.2).

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

The installed technology stack is **approved** (DR-039): React, TypeScript, Vite, Vitest, ESLint (DR-021), Prettier, pnpm 10 and Node 24 in the Dev Container (DR-041), with no state library (DR-054) and CSS-first animation (DR-055). Do not introduce Zustand, Redux, Tailwind, Motion or additional infrastructure. Deferred: Motion (DR-064) and Tailwind (DR-065). Current stack and the dependency plan: `docs/architecture/TECHNOLOGY_STACK.md`.

## 14. Slash Commands

- `/validate-docs`: documentation consistency check.
- `/audit-stage <n>`: audit a roadmap stage against its acceptance criteria.
