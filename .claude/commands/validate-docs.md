---
description: Validate the BITSHIFT documentation set for contradictions, broken references, naming drift and unresolved decisions
---

# Validate BITSHIFT Documentation

Review every file under `docs/` and the root `README.md` and `CLAUDE.md`. Work read-only: do not edit files. Report findings only.

## Checks

1. **Completeness.** Confirm every document listed in the Phase 0 brief exists:
   - `docs/product/`: PRODUCT_SPEC, MVP_SCOPE, RELEASE_ROADMAP
   - `docs/architecture/`: SYSTEM_ARCHITECTURE, SIMULATION_PLATFORM, CPU_ARCHITECTURE_STRATEGY, TECHNOLOGY_STACK
   - `docs/contracts/`: DATA_CONTRACTS, MODULE_CONTRACTS, EVENT_MODEL
   - `docs/engineering/`: CODING_STANDARDS, TEST_STRATEGY, DEFINITION_OF_DONE, DEVELOPMENT_ROADMAP
   - `docs/specifications/`: BITSHIFT-8_ISA
   - `docs/decisions/`: DECISION_REGISTER, ADR-001, README

2. **Broken references.** Find every Markdown link `[text](path)` and every `DR-NNN` / `ADR-NNN` reference. Check that:
   - relative file links resolve to existing files (and existing `#anchors` where used);
   - every `DR-NNN` used anywhere exists in `docs/decisions/DECISION_REGISTER.md`;
   - every `ADR-NNN` used anywhere exists as a file or is listed as planned in `docs/decisions/README.md`.

3. **Roadmap structure.** In `docs/engineering/DEVELOPMENT_ROADMAP.md`, confirm there are exactly seven phases with 4, 5, 5, 4, 5, 5 and 4 stages (32 total), and that every stage has objective, scope, slices, dependencies, deliverables and acceptance criteria.

4. **Contradictions.** Compare the same fact across documents. In particular check:
   - data width, address width, memory size and register list (ISA vs DATA_CONTRACTS vs CPU_ARCHITECTURE_STRATEGY);
   - the list of v1 features (PRODUCT_SPEC vs MVP_SCOPE vs roadmap);
   - the dependency rules (SYSTEM_ARCHITECTURE vs CODING_STANDARDS vs SIMULATION_PLATFORM);
   - the list of event kinds (EVENT_MODEL vs DATA_CONTRACTS);
   - which dependencies are installed in which phase (TECHNOLOGY_STACK vs `package.json`).

5. **Naming consistency.** Check the terms in CODING_STANDARDS section 2 are used the same way everywhere. Flag synonyms such as "step result" for `StepOutcome`, "CPU state" for `CpuSnapshot`, "architecture id" versus "architectureId", and inconsistent architecture names (`BITSHIFT-8`, `bitshift-8`, `Bitshift8`). Each form must be used only where that form is defined.

6. **Status honesty.** Every decision in the body of a document should be labelled as established (A), proposed (B) or unresolved (C), or should reference a register ID. Flag any proposal that reads as final.

7. **Scope creep.** Check that no v1.0 document includes v2, v3 or v4 features as in-scope. Mentions in the exclusions list and in RELEASE_ROADMAP are allowed.

8. **Unresolved decisions.** List every register item still `Open`, and every `[C]` marker in the ISA, grouped by the phase it blocks. Confirm each blocking item appears in the register.

9. **Stage-to-register coverage.** Confirm each register item marked as blocking a phase is referenced by that phase in DEVELOPMENT_ROADMAP.

## Output Format

```
# Documentation Validation Report

Date: <today>
Files reviewed: <count>

## Summary
| Check | Result | Issue count |
|---|---|---|
| Completeness | Pass / Fail | n |
| Broken references | Pass / Fail | n |
| Roadmap structure | Pass / Fail | n |
| Contradictions | Pass / Fail | n |
| Naming | Pass / Fail | n |
| Status honesty | Pass / Fail | n |
| Scope creep | Pass / Fail | n |
| Unresolved decisions | Info | n |
| Register coverage | Pass / Fail | n |

## Findings
Each finding:
- **Severity:** blocker | major | minor
- **Location:** file and line (as `path:line`)
- **Issue:** one sentence
- **Suggested fix:** one sentence

## Unresolved decisions by phase
<grouped list>

## Next actions
1. <most important first>
```

Do not invent issues. If a check finds nothing, say "None found". Report the number of files and links actually checked.
