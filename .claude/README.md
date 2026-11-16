# Claude Code Configuration for BITSHIFT

This folder holds the shared Claude Code setup for the project.

## Contents

| Path                        | Purpose                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `../CLAUDE.md`              | Project instructions read at the start of each session. The main source of working rules.                                     |
| `commands/audit-stage.md`   | `/audit-stage` — compares a stage's implementation with its objectives, deliverables and acceptance criteria.                 |
| `commands/validate-docs.md` | `/validate-docs` — checks the documentation set for contradictions, broken references, naming drift and unresolved decisions. |

## Deliberately Not Included

- No hooks, custom agents or permission rules. Add them only when a concrete need appears, and record the reason in the decision register.
- `settings.local.json` is personal and git-ignored.

## Using the Commands

Run from the Claude Code prompt:

```
/validate-docs
/audit-stage 0.4
```

Each command states its own output format.
