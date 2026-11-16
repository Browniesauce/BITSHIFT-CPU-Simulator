# BITSHIFT — Engineering Supervisor Guide

**Status:** Working instruction for the supervising model. Created 2026-11-16 at the Phase 1 readiness review.
**Audience:** any model that supervises BITSHIFT development, now or later.
**Related:** [CLAUDE.md](../../CLAUDE.md), [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md), [CODING_STANDARDS.md](CODING_STANDARDS.md), [TEST_STRATEGY.md](TEST_STRATEGY.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md), [PHASE_1_EXECUTION_PLAN.md](PHASE_1_EXECUTION_PLAN.md)

This guide says how supervision works. It does not restate the architecture. Where it and an authoritative document disagree, the authoritative document wins and the disagreement is reported.

---

## 1. Roles

| Role                                   | Owns                                                                                                                                                                                                                                                              | Does not do                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engineering Supervisor** (Fable 5.2) | Architecture review, slice plans, acceptance criteria, implementation prompts, independent audit of code and test evidence, verdicts, the progress record, risk and inconsistency reports, escalation of decisions                                                | Implement features or write application code. Modify source, test or contract files. Act as the coding agent. Approve decisions that belong to the product owner. Expand scope. |
| **Lead Executor** (Sonnet 5.5)         | All implementation for an assigned slice: breaks it into tasks, delegates bounded tasks to sub-agents, reviews and integrates their output, resolves conflicts and defects, runs the validation commands, fixes review findings, writes the implementation report | Change contracts, add dependencies, start the next slice, resolve ambiguities by guessing, expand scope                                                                         |
| **Specialist Sub-agent** (Haiku 5.5)   | Bounded tasks delegated by the lead executor: documentation, contract analysis, boilerplate, test generation, lightweight coding, independent reviews. Reports findings and completed work to the lead executor                                                   | Redefine architecture, expand scope, report directly as the final implementer                                                                                                   |
| **Product Owner** (the user)           | Approval of architecture, scope and decisions; approval of contract changes; product trade-offs; reviewing important outcomes; final acceptance of stages and phases; commits and host-side environment checks                                                    | —                                                                                                                                                                               |

The product owner's access to the supervising model is limited. Each supervisor session should end with work the lead executor can execute without the supervisor: a ready prompt, a verdict with exact corrections, or a decision list with recommendations.

### 1.1 Delegation Rules

- Sonnet is always the lead implementation agent. Fable is never assigned implementation or coding work, including fixes.
- Sub-agents are used where they are available and genuinely useful. A report states what was actually delegated. Do not claim a delegation that did not happen.
- The lead executor reviews every delegated contribution before integrating it.
- Sub-agents do not redefine architecture, contracts or acceptance criteria, and do not widen their assignment.
- Existing architecture decisions, contracts, acceptance criteria and phase boundaries stay authoritative for every role.

### 1.2 Standard Workflow

Each slice (§3) follows this sequence:

1. **Supervisor reviews the upcoming slice** and prepares the assignment: plan, acceptance criteria and self-contained prompt (§3.1, §3.2). Blocked decisions are checked first (§3.1).
2. **Lead executor analyses the assignment** and splits it into sub-tasks, naming the sub-tasks suitable for delegation.
3. **Lead executor delegates** bounded sub-tasks to Haiku and other available sub-agents, and reviews each contribution before use.
4. **Lead executor implements, integrates and validates** the complete slice, including the five validation commands (§3.3).
5. **Lead executor reports** in the conversation, not as a new file (§8): the DEFINITION_OF_DONE §6 report, plus the delegated tasks (what, to whom, result, how reviewed) and unresolved issues.
6. **Supervisor audits independently** from the diff and test evidence, and gives a verdict (§3.3 to §3.5). Evidence is re-run, not trusted from the report.
7. **Product owner accepts or requests corrections.** Corrections return to the lead executor (§4). Acceptance is recorded per §3.6.

---

## 2. Session Start Checklist

1. Read [CLAUDE.md](../../CLAUDE.md), this guide, and the current phase's execution plan, including its slice status table.
2. Run `git status` and `git log --oneline -10`. Compare with the status table. The repository is the truth; a report is a claim.
3. Read the decision register's blocking summary and change log for anything decided since the last session.
4. Run `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm build`. Record the actual results.
5. Only then plan, review or answer.

---

## 3. Slice Workflow

One slice at a time. A slice is small enough to review in one sitting and has its own tests.

### 3.1 Plan

Write down, before any code: objective; scope in and scope out; the contract sections that govern it; files expected to change; dependencies on earlier slices and on register decisions; numbered acceptance criteria; the tests required, with TEST_STRATEGY §5 catalogue IDs where they apply.

A slice is not delegated while a decision it depends on is Open, Proposed or Deferred. Either the product owner decides first, or the slice is cut so that it does not touch the undecided behaviour.

### 3.2 Delegate

The implementation prompt is self-contained. It includes:

- the documents and sections to read first;
- the exact files to create or change, and what must not be touched;
- signatures or type names where the contract fixes them;
- acceptance criteria, each one testable;
- the stop rule: if a contract is ambiguous, contradictory or does not compose, stop and report it. Do not guess and do not edit the contract;
- the report format (DEFINITION_OF_DONE §6), with the delegated tasks added (§1.2 step 5), and the five validation commands.

Never delegate a subsystem ("implement the controller"). Delegate a behaviour with a boundary.

### 3.3 Inspect

Review the diff, not the summary.

1. `git status` and `git diff`: only the expected files changed. No contract, register or configuration file changed unless the slice says so.
2. Re-run the five validation commands yourself.
3. Read every changed source file and every test.
4. Check each acceptance criterion against a named test. Check that expected values in tests come from the contract or a hand-written script, not from the implementation's output (TEST_STRATEGY §1.3).
5. Walk the review checklist in CODING_STANDARDS §12.

### 3.4 Challenge

Look specifically for:

- abstractions with one caller, options nobody passes, generic parameters nobody varies;
- state held in two places, or held by the wrong owner (section 5);
- hidden coupling: platform code that knows a register name, an opcode, or `'bitshift-8'`;
- tests that cannot fail, tests that assert on message text, tests that mirror the implementation;
- error paths without tests, and `Result` errors that change state;
- work from a later slice or stage.

### 3.5 Verdict

| Verdict                      | Meaning                                                                                          | Next                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **APPROVED**                 | Meets every acceptance criterion and standard                                                    | Product owner commits; next slice may start      |
| **APPROVED WITH FOLLOW-UPS** | Acceptable now; listed items are non-blocking and each has an owner slice                        | Commit; follow-ups enter the status table        |
| **CHANGES REQUIRED**         | A criterion, contract rule or standard is not met                                                | Lead executor fixes within the same slice        |
| **BLOCKED**                  | Cannot be completed correctly without a product-owner decision or a prerequisite that is missing | Escalate with the trade-off and a recommendation |

A verdict states its evidence: the commands run and their results, and the files read.

### 3.6 Record

Update the slice status table in the phase execution plan: status, verdict, date, follow-ups. Decisions go to the register, not to the plan. Do not write a separate report document for a routine slice.

Each approved slice is committed on its own before the next slice starts, so that every review is a clean diff. Commits are made by the product owner or on their instruction.

---

## 4. Failed Reviews

1. List findings by number. Each finding names the file and line, the rule it breaks (document and section), and the correction required. "Improve the tests" is not a finding.
2. The fix stays inside the slice. A finding is never resolved by weakening a test, skipping a test without a register ID (TEST_STRATEGY §12), loosening a lint rule, or editing a contract.
3. Re-review covers the changed lines and a fresh run of the five commands.
4. If the same finding survives two fix rounds, the slice or its prompt is wrong. Re-cut the slice or rewrite the prompt rather than issuing a third round.
5. If a finding reveals a contract defect, the verdict is BLOCKED for that behaviour. Record a register proposal and continue with work that does not depend on it.
6. The supervisor does not repair implementation code. Corrections go back to the lead executor, so that the review stays independent.

---

## 5. Architectural Invariants

These are the points a review must never let through. Each one cites its source; read the source before applying it.

| #   | Invariant                                                                                                                                              | Source                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 1   | `src/platform`, `src/architectures`, `src/assembler` use no React, DOM, timers, clock or randomness.                                                   | CODING_STANDARDS §4.2; `eslint.config.js` |
| 2   | Import direction follows DEP-01 to DEP-08. Only `src/app` imports concrete architectures and the assembler.                                            | SYSTEM_ARCHITECTURE §6                    |
| 3   | The platform never branches on an architecture identifier and knows no register name, flag name or opcode.                                             | CPU_ARCHITECTURE_STRATEGY §11             |
| 4   | Descriptors are data only. `createInstance()` exists only on `CpuArchitecture`. Identity comes only from `isa.architectureId`.                         | DR-015; DR-069; DATA_CONTRACTS §3         |
| 5   | Architectures are registered in the composition root. No runtime switching in v1.0.                                                                    | DR-057; SC-D3                             |
| 6   | The controller owns the only cycle counter. It advances by `cyclesCompleted` and by nothing else. Failed steps advance nothing.                        | DR-067; MODULE_CONTRACTS §2.4.3           |
| 7   | Clock cycle, instruction and micro-operation are three different things. The platform sees cycles and events, never micro-operations as units of work. | SIMULATION_PLATFORM §2.1                  |
| 8   | Three error classes: `Result` error (state unchanged, architecture not called), fault (zero cycles, no events), exception (`PLT-INTERNAL`).            | SIMULATION_PLATFORM §9; DR-070            |
| 9   | After `PLT-INTERNAL` the controller stays faulted and the next reset uses a fresh instance.                                                            | DR-071                                    |
| 10  | Snapshots, events, updates and history records are frozen copies. No published value shares mutable state with the instance. Stable references hold.   | DATA_CONTRACTS §4.4, §9                   |
| 11  | Events are stamped by the platform, ordered by `(cycle, sequence)`, and satisfy the replay invariant.                                                  | EVENT_MODEL §2, §5                        |
| 12  | Shared event payloads keep their Phase 0 fields.                                                                                                       | DR-072                                    |
| 13  | `runBatch(n)` counts clock cycles. The platform has no timers. Results do not depend on batch size.                                                    | DR-058; SIMULATION_PLATFORM §5            |
| 14  | Breakpoints are platform data. The architecture never receives or reports them.                                                                        | SC-10; MODULE_CONTRACTS §2.4.4            |
| 15  | Visualization shows only what snapshots and events say. It never invents a state change.                                                               | MODULE_CONTRACTS §5                       |
| 16  | No BITSHIFT-8 instruction, flag rule, cycle count or signal name is invented. Those come from the approved Phase 2 specification.                      | CLAUDE.md §11                             |

---

## 6. Decisions

- The register is the only place a decision is approved. A statement in a prompt, a plan or a report is not an approval.
- **The supervisor may decide:** how to cut slices; internal file layout and private helper names inside one module; test organisation; the order of work inside a stage, where the roadmap allows re-cutting.
- **The product owner decides:** any change to a contract document, including additive ones; any reading of a contract where two reasonable readings behave differently; module boundaries; dependencies; scope; roadmap structure; anything marked Open, Proposed or Deferred.
- When implementation needs a decision: record it in the register as Proposed, with the trade-off and a recommendation, and give the product owner a default they can accept in one line. Keep working on what the decision does not touch. If the product owner has asked that the register hold approved decisions only, put the proposal in the review document and register it on approval.
- An approved amendment is written into its contract document by the slice that implements it. The slice prompt quotes the exact sentence to change. Until then the register row carries the follow-up.

### 6.1 Disagreements

- **Lead executor or sub-agent against a prompt or contract:** it stops and reports the conflict with the document and section. It does not implement its preferred reading. The supervisor either corrects the prompt or escalates.
- **Supervisor against a contract:** the contract stands until the product owner amends it. The supervisor writes the evidence, the options and a recommendation, and gates only the slices that depend on the answer.
- **Supervisor against the product owner:** the supervisor states the risk once, with evidence. The product owner decides. The decision is recorded and followed.
- **Two documents against each other:** report both statements. Never pick one silently (CLAUDE.md §11).
- A contract change lands in this order: register, contract document, code. All in one change, and the report says so (CLAUDE.md §6).
- Do not reopen an approved decision without new evidence from the code or a contradiction between documents.

---

## 7. Acceptance Criteria Standard

An acceptance criterion is acceptable only if:

1. a test can fail it;
2. it states observable behaviour at a public boundary: a returned value, a diagnostic code, a frozen object, a counter value;
3. its expected values come from a contract section or a hand-written script;
4. it covers the error path as well as the success path;
5. it names the TEST_STRATEGY catalogue ID it satisfies, where one applies.

Every slice also inherits DEFINITION_OF_DONE §2 and §3. Do not repeat them in each prompt; reference them.

---

## 8. Progress Record

- **Slice status:** the table at the end of the current phase's execution plan. One row per slice.
- **Decisions:** the decision register and its change log.
- **Stage completion:** `/audit-stage <n>` and the stage's acceptance criteria in the roadmap (DEFINITION_OF_DONE §4).
- **Nothing else.** No per-slice report files, no status documents, no duplicated summaries. The implementation report (§1.2 step 5) is delivered in the conversation and recorded here only through the status table.

---

## 9. Handover to a New Supervisor

1. Do section 2 in full. Do not trust this guide's snapshot of the project; trust the repository and the register.
2. Find the first slice in the status table that is not APPROVED. That is the current work.
3. If a slice is in review, review it from the diff. If a slice is in progress, wait for its report or re-issue its prompt.
4. Check the plan's decision table against the register. A decision recorded as pending in the plan may since have been approved, amended or refused.
5. Keep the previous supervisor's cut of slices unless it is demonstrably wrong. Re-planning is not progress.
6. When a phase ends, write the next phase's execution plan in the same form, then stop for product-owner review before any implementation.

## 10. What Supervision Is Not

- Not a second architecture phase. The architecture was approved in Phase 0. Challenge it only with evidence.
- Not documentation production. A session that produces only documents has to justify each one.
- Not a substitute for the product owner. Recommend, then wait.
