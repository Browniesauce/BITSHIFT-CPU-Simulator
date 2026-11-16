# BITSHIFT — Definition of Done

**Status:** Stage 0.3. Applies to every task, slice, stage and phase from now on.
**Related:** [CODING_STANDARDS.md](CODING_STANDARDS.md) (section 12 review checklist), [TEST_STRATEGY.md](TEST_STRATEGY.md) (test IDs), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) (stages and acceptance criteria), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

Each criterion below is checkable. Where a criterion names a command, the command's actual result is what counts. A criterion that was not run is reported as **not run**, never as passing.

---

## 1. Hierarchy

| Level | Meaning                                                         | Example                       |
| ----- | --------------------------------------------------------------- | ----------------------------- |
| Phase | A group of stages with one objective                            | Phase 2 — BITSHIFT-8 CPU Core |
| Stage | A unit in the roadmap with deliverables and acceptance criteria | Stage 2.2 — ALU               |
| Slice | A small, testable part of a stage                               | "ADD sets carry"              |
| Task  | One change to one area, inside a slice                          | One function and its tests    |

A slice is the unit of implementation work. A stage is done when its slices are done and its acceptance criteria are verified.

---

## 2. Task Done (for any change)

A task is done when all of these are true:

- [ ] The change is in the scope of the current stage. Work for a later stage is not included (CLAUDE.md §2).
- [ ] The relevant contract and architecture documents were read before the change. The report names them.
- [ ] Behaviour matches the contract. If the change alters a contract, the contract document and the register are updated in the same change.
- [ ] `pnpm typecheck` passes (when code changed).
- [ ] `pnpm lint` passes (when code changed).
- [ ] `pnpm format:check` passes (when any file changed).
- [ ] `pnpm test` passes, and no test was removed, weakened or skipped without a register ID (TEST_STRATEGY §12).
- [ ] The review checklist in CODING_STANDARDS §12 is satisfied, or every exception is recorded.
- [ ] Documentation changed by the task has valid links (section 5).
- [ ] The implementation report (section 6) is written.

---

## 3. Slice Done (implementation)

A slice is done when, in addition to section 2:

- [ ] Each acceptance criterion of the slice has at least one test, and the test ID or name is listed in the report.
- [ ] Each test in the catalogue (TEST_STRATEGY §5) that applies to the slice has been run and passes. A catalogue item not applicable to the slice is listed as such.
- [ ] Determinism is covered: the slice's tests include a repeat-run comparison where output is produced (DET-01 for platform changes).
- [ ] Snapshot isolation is covered for any change that publishes a snapshot, event or history record (SNP-01 to SNP-05).
- [ ] Error handling is covered: every new `Result` error code is triggered by a test, and every new code is listed in DATA_CONTRACTS §11 (ERR-01).
- [ ] No simulation-core file imports a forbidden module or global (CODING_STANDARDS §4.2; enforced by `pnpm lint`, DET-03).
- [ ] No dependency was added without a TECHNOLOGY_STACK §4.2 row.

---

## 4. Stage Done

A stage is done when, in addition to section 3:

- [ ] Every slice of the stage is done.
- [ ] Every deliverable named in DEVELOPMENT_ROADMAP for the stage exists. Missing deliverables are listed, not hidden.
- [ ] Every acceptance criterion of the stage is verified. Each has a result recorded as passed, failed or not run.
- [ ] The stage's documentation is current, and `pnpm build` passes where the stage produces an application.
- [ ] Open issues are recorded in the decision register with an ID, or in the stage report with an owner.
- [ ] `/audit-stage <n>` has been run, and its findings are resolved or recorded.

---

## 5. Documentation Changes

A documentation change is done when:

- [ ] Every Markdown link resolves. The check is the link checker run over `docs/`, `CLAUDE.md` and `README.md`. Known false positives are named in the report.
- [ ] Every `DR-NNN` reference resolves to a row in DECISION_REGISTER, and no ID appears in two rows.
- [ ] Every status claim matches the register. An item marked approved in a document is approved in the register, and a deferred item is still deferred in both.
- [ ] Terms match CODING_STANDARDS §3.2 (for example `cycle`, not `tick`).
- [ ] `pnpm format:check` passes.
- [ ] A change to a contract leaves no contradicting statement in another contract or architecture document. A contradiction found in a review is a blocker.
- [ ] Contract documents were changed only by a stage or a task that the roadmap or the product owner authorised.

---

## 6. Implementation Report

Every completed task or slice reports, in this order:

1. **What was built**, in one short paragraph.
2. **Files created or changed**, with paths. Application source files are listed separately.
3. **Acceptance criteria and tests**: each criterion, the test IDs that cover it, and the result (passed, failed, or not run, with the reason).
4. **Validation commands**: each command, its result, and any warning. A command that was not run is listed as not run.
5. **Decisions**: each decision made, labelled as approved (register ID), proposed (B), or open (C). A new decision is never reported as approved.
6. **Unresolved issues**, with their register ID and the stage where they are addressed.
7. **Next step**, in one sentence.

A report that summarises a failed or skipped check as passing does not meet this definition.

---

## 7. Phase Done

A phase is done when:

- [ ] Every stage in the phase is done (section 4).
- [ ] The phase's exit criteria in DEVELOPMENT_ROADMAP are met, each with a recorded result.
- [ ] A regression run passes: the full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build`, on a clean install (`pnpm install --frozen-lockfile`).
- [ ] The documentation validation pass (section 5) is clean, or each finding is recorded.
- [ ] The product owner has reviewed the outcome and recorded acceptance in the register change log.

---

## 8. Stage 0.3 Specifically

Stage 0.3 — Contracts & Engineering Standards — is done when:

- [ ] DATA_CONTRACTS, MODULE_CONTRACTS and EVENT_MODEL describe the approved architecture, with no `tick`, `Tick`, `stepMicroOperation`, `run()`, `pause()` or `selectArchitecture` left in them (the search is recorded).
- [ ] No contract states an authoritative cycle counter outside the platform, and `StepOutcome` has no cycle number (CYC-09 is the test-level equivalent).
- [ ] The ISA identifies the architecture, and no other field duplicates that identity (INT-03).
- [ ] The three engineering documents (CODING_STANDARDS, TEST_STRATEGY, DEFINITION_OF_DONE) exist and state the rules above.
- [ ] CLAUDE.md states the hierarchy, the approval rule and the commands, and points to these documents instead of repeating them.
- [ ] Deferred items remain deferred: DR-022 and SC-14, DR-064, DR-065. Open items remain open: DR-011, DR-013 (internal part), DR-031, DR-068.
- [ ] No application source file was changed (`git diff --stat -- src` is empty).
- [ ] Stage 0.4 has not been started.

---

## 9. Changing This Document

This document changes through the register: the change is recorded as a decision, and the change log is updated in the same change.
