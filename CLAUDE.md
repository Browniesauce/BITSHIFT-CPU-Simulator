# CLAUDE.md — BITSHIFT

Project instructions for Claude Code. Read this first in every session.

## 1. What BITSHIFT Is

BITSHIFT is a browser-based educational computer architecture simulator. Learners write assembly programs, run them on virtual CPUs, and watch instructions move through registers, the ALU, memory and buses. The product prioritises educational clarity, accurate simulation, interactive execution, visual understanding, modular architecture and maintainable engineering.

No backend. Everything runs in the browser.

## 2. Current Release and Phase

- **Release:** v1.0 (Polished MVP). Only v1.0 is authorised for implementation planning.
- **Phase:** Phase 0 — Product & Architecture Foundation. Its goal is documentation and repository foundation. **No CPU, ALU, assembler, datapath or debugger code is to be written in Phase 0.**
- **Status:** Phase 0 documents are drafts awaiting product-owner review. See `docs/decisions/DECISION_REGISTER.md`.

## 3. Technology Stack

The stack is **proposed**, not yet approved (decision DR-039). Use only what is installed, unless the stack document says a package is planned for a later phase.

| Area            | Tool                    | Installed now    |
| --------------- | ----------------------- | ---------------- |
| Frontend        | React                   | Yes              |
| Language        | TypeScript (5.9.x)      | Yes              |
| Build           | Vite                    | Yes              |
| Styling         | Tailwind CSS            | Phase 4          |
| State           | Zustand                 | Phase 5 (DR-035) |
| Animation       | Motion for React        | Phase 4          |
| Datapath        | Native SVG              | n/a              |
| Editor          | CodeMirror 6            | Phase 3          |
| Tests           | Vitest                  | Yes              |
| Format          | Prettier                | Yes              |
| Package manager | pnpm 9                  | Yes              |
| Dev environment | Dev Container (Node 22) | Yes              |

Full rationale and dependency plan: `docs/architecture/TECHNOLOGY_STACK.md`.

## 4. Architecture Principles

1. Simulation logic is independent of React and the DOM.
2. Simulation is deterministic: no time, randomness or unordered output in simulation code.
3. UI components never modify CPU internals. They send intents to the execution controller and read immutable snapshots.
4. Snapshots and execution events are explicitly typed and copied across boundaries.
5. Each architecture implements its own hardware semantics. Shared code does not assume identical registers, word sizes or instruction formats.
6. Prefer simple modules and interfaces over plugin frameworks, containers or services.

Subsystem map and dependency rules: `docs/architecture/SYSTEM_ARCHITECTURE.md`.

## 5. Documentation Is the Source of Truth

Read the relevant document before changing architecture or code:

| Topic                            | Document                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| Product and scope                | `docs/product/PRODUCT_SPEC.md`, `MVP_SCOPE.md`, `RELEASE_ROADMAP.md` |
| System design                    | `docs/architecture/`                                                 |
| Contracts (types and interfaces) | `docs/contracts/`                                                    |
| CPU specification                | `docs/specifications/BITSHIFT-8_ISA.md` (DRAFT)                      |
| Coding, testing, done criteria   | `docs/engineering/`                                                  |
| Roadmap                          | `docs/engineering/DEVELOPMENT_ROADMAP.md`                            |
| Open and approved decisions      | `docs/decisions/DECISION_REGISTER.md`                                |

Categories used throughout the docs:

- **[A]** established by the product owner;
- **[B]** proposed, pending approval;
- **[C]** unresolved, needs review.

Never treat a [B] or [C] item as final.

## 6. Repository Structure

```
.claude/            Claude Code configuration and commands
.devcontainer/      Dev Container definition
docs/               Documentation (source of truth)
  product/  architecture/  specifications/  contracts/  engineering/  decisions/
src/
  app/              Application shell
  platform/         Simulation platform: registry, lifecycle, controller, events, snapshots
  architectures/    One folder per CPU (bitshift-8/ in v1.0)
  assembler/        Source text to program image
  visualization/    SVG datapath and view models
  features/         Workbench features (Phase 5)
  components/       Shared UI components
  store/            UI state adapter (Phase 5)
tests/              Mirrors src/: platform, architectures, assembler, integration
public/             Static assets
```

Empty directories are kept with `.gitkeep` or `README.md`. Do not create speculative files.

## 7. Coding Conventions

Full rules in `docs/engineering/CODING_STANDARDS.md`. Summary:

- TypeScript `strict`. No `any`. Explain every non-null `!`.
- Files: kebab-case for modules, PascalCase for React components.
- Event kinds and architecture IDs: kebab-case.
- Mask 8-bit arithmetic explicitly.
- Errors at API boundaries are `Result` values with `Diagnostic`s. Exceptions are for programmer errors only.
- Dependency rules: `src/platform`, `src/architectures` and `src/assembler` never import React, DOM, Zustand, Motion or Tailwind.
- Format with `pnpm format`. LF line endings, 2-space indentation.

## 8. Testing Requirements

Full strategy in `docs/engineering/TEST_STRATEGY.md`. Summary:

- Every implementation slice has testable acceptance criteria written before the code.
- Tests state expected values from the spec, not from the implementation output.
- Every instruction and flag rule has a test once Phase 2 begins.
- Determinism is tested: same input, same snapshots and events.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## 9. Reporting Implementation Changes

After each implementation slice, report:

1. What was built, in a short paragraph.
2. Files created or changed (with paths).
3. Acceptance criteria and their test results.
4. Validation commands run and their results. If a command was not run, say so and say why.
5. Decisions made, labelled [A], [B] or [C].
6. Unresolved issues and the recommended next step.

Do not describe anything as passing unless you ran it and saw it pass.

## 10. Handling Architecture Changes

1. Read the relevant contract and ADRs.
2. If the change alters a shared contract, a module boundary or the stack, stop and write the proposal into `docs/decisions/DECISION_REGISTER.md` (as [B] or [C]). Record an ADR if the change is significant.
3. Do not change an approved contract silently. Update the contract document in the same change as the code, and say so in the report.
4. If a spec is ambiguous or contradicts another document, report the contradiction. Do not guess. Do not invent opcodes, flags or instruction semantics.

## 11. Permanent Rules

1. Read relevant documentation before modifying architecture or code.
2. Never silently change an approved architecture contract.
3. Report contradictions rather than guessing.
4. Do not introduce dependencies without justification. Add a row to `TECHNOLOGY_STACK.md` section 4 in the same change.
5. Keep simulation independent of presentation.
6. Do not implement future-release features in v1.
7. Every implementation slice has testable acceptance criteria.
8. Do not overwrite existing files without inspecting them.
9. Prefer minimal, maintainable solutions.
10. Report completed work, changed files, validation results and unresolved issues.

## 12. Out of Scope for v1.0

Do not build, stub or design in detail:

- Microcode visualization, interrupts, I/O devices, advanced debugging, reverse execution, cache and pipeline visualization, custom CPU configurations, digital logic exploration (v2.0).
- BITSHIFT-16 and RISC-V RV32I (v3.0).
- Guided lessons, shareable programs, tutorials, user-created architectures (v4.0).
- Any backend, accounts or cloud storage.
- Mobile and touch layouts.

Full list: `docs/product/MVP_SCOPE.md` section 2.

## 13. Slash Commands

- `/validate-docs` — documentation consistency check.
- `/audit-stage <n>` — audit a roadmap stage against its acceptance criteria.
