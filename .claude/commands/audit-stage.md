---
description: Audit a BITSHIFT stage against its objectives, deliverables and acceptance criteria
argument-hint: <stage number, for example 0.4 or 2.2>
---

# Audit Stage $ARGUMENTS

You are auditing stage **$ARGUMENTS** of the BITSHIFT development roadmap. Work read-only: do not edit files. Report findings only.

## Steps

1. **Locate the stage definition.** Open `docs/engineering/DEVELOPMENT_ROADMAP.md` and find the section for stage $ARGUMENTS. Record its objective, scope, suggested slices, dependencies, deliverables and acceptance criteria.

2. **Read the rules.** Read `CLAUDE.md`, `docs/engineering/DEFINITION_OF_DONE.md` and `docs/engineering/TEST_STRATEGY.md`.

3. **Check dependencies.** For each dependency listed in the stage, confirm it is complete (its deliverables exist and its own acceptance criteria are met). Check the decision register for any open item (`docs/decisions/DECISION_REGISTER.md`) that blocks this stage. A blocked stage is reported as blocked, not as failed.

4. **Check deliverables.** For each deliverable, confirm the file or module exists. Use `Glob` and `Grep`. Do not assume a file exists because a document mentions it.

5. **Check acceptance criteria.** For each criterion, state one of:
   - **Met** — with the file and test that prove it.
   - **Partially met** — say what is missing.
   - **Not met** — say what is missing.
   - **Not verifiable** — say what would be needed.

   Run `pnpm test`, `pnpm typecheck` and `pnpm format:check` if the stage contains code. Report the actual output summary. Do not report a command as passing unless you ran it.

6. **Check scope.** Look for work that belongs to a later stage or release (v2–v4 features, or unapproved ISA opcodes). Report it as scope drift.

7. **Check contracts.** If code exists, confirm it matches `docs/contracts/`. Report mismatches; do not fix them.

8. **Check architecture rules.** Confirm the dependency rules in `docs/architecture/SYSTEM_ARCHITECTURE.md` section 3.1 are respected for code in this stage.

## Output Format

```
# Stage $ARGUMENTS Audit

Status: <Complete | In progress | Blocked | Not started>

## Objectives and scope
<one short paragraph: is the objective achieved?>

## Dependencies
| Dependency | Status | Evidence |

## Deliverables
| Deliverable | Exists | Notes |

## Acceptance criteria
| Criterion | Result | Evidence |

## Validation run
| Command | Result |

## Scope drift
<list, or "None found">

## Contract and architecture rule violations
<list, or "None found">

## Recommended actions
1. <most important first>

## Unverifiable items
<list, or "None">
```

Keep the report factual. If a check could not be performed, say so.
