# BITSHIFT — Definition of Done

**Status:** Proposed (B).
**Related:** [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md), [TEST_STRATEGY.md](TEST_STRATEGY.md), [CODING_STANDARDS.md](CODING_STANDARDS.md)

Three levels of "done" apply. A higher level always includes the lower ones.

---

## 1. Implementation Slice Done

A slice is a small, testable unit of a stage (for example "ALU add with flags"). It is done when:

- [ ] Acceptance criteria for the slice are written before implementation and are testable.
- [ ] Code matches the relevant contract in `docs/contracts/`. Contract changes went through the decision process first.
- [ ] Behaviour matches the spec. Any spec gap was reported, not guessed.
- [ ] Tests exist for every acceptance criterion and pass (`pnpm test`).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm format:check` passes.
- [ ] No forbidden imports (see CODING_STANDARDS section 3).
- [ ] No speculative code for later slices or later releases.
- [ ] The implementation report (section 4) is written.

## 2. Stage Done

A stage (for example "2.2 ALU") is done when:

- [ ] All slices are done.
- [ ] Stage deliverables listed in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) exist.
- [ ] Stage acceptance criteria are verified and each result is recorded.
- [ ] Documentation for the stage's area is up to date.
- [ ] `/audit-stage` (in `.claude/commands/audit-stage.md`) has been run and its findings resolved or recorded.
- [ ] Open issues are logged in the decision register or a stage note, with IDs.

## 3. Phase Done

A phase (for example "Phase 2") is done when:

- [ ] All stages are done.
- [ ] The phase's exit criteria in DEVELOPMENT_ROADMAP are met.
- [ ] `/validate-docs` passes or every finding is resolved or recorded.
- [ ] The product owner has reviewed the phase outcome.

## 4. Implementation Report (required for each slice)

Every completed slice reports:

1. What was built, in one paragraph.
2. Files created or changed.
3. Acceptance criteria and their test results.
4. Validation commands run and their outcome (passed, failed, not run, and why).
5. Decisions made, and any that were proposals (B) or open (C).
6. Unresolved issues and suggested next step.

Failed or skipped validation is reported as such. It is never summarised as passing.

## 5. Phase 0 Specific Done Criteria

Phase 0 is done when:

- [ ] All documents listed in the Phase 0 brief exist.
- [ ] Every internal link resolves (checked with `/validate-docs`).
- [ ] Roadmap has seven phases and 32 stages in total.
- [ ] Every open architectural question is in the decision register with a category (A, B or C).
- [ ] No v2–v4 feature appears in v1 scope documents.
- [ ] Project installs, type-checks, tests and formats without error.
- [ ] Product owner has approved, or has been asked to approve, the items in the decision register marked for review.
