# BITSHIFT

A browser-based educational computer architecture simulator. Write assembly, run it on a virtual CPU, and watch instructions move through registers, the ALU, memory and buses.

> **Status:** Phase 0 — Product & Architecture Foundation. No simulator is implemented yet. The application shell is a placeholder.

## Getting Started

### Option 1: Dev Container (recommended)

1. Install Docker and the VS Code Dev Containers extension.
2. Open the folder in VS Code and choose **Reopen in Container**.
3. The container runs `corepack enable && pnpm install` on creation.

### Option 2: Local

Requirements: Node.js 20 or later (22 recommended) and pnpm 9.

```bash
pnpm install
```

## Scripts

| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Start the Vite dev server (port 5173)           |
| `pnpm build`        | Type-check and build the static site to `dist/` |
| `pnpm preview`      | Serve the production build locally              |
| `pnpm typecheck`    | TypeScript check without emitting files         |
| `pnpm test`         | Run the Vitest suite                            |
| `pnpm format`       | Format all files with Prettier                  |
| `pnpm format:check` | Check formatting without changing files         |

## Documentation

Start with the product and architecture set:

- [Product specification](docs/product/PRODUCT_SPEC.md)
- [v1.0 scope](docs/product/MVP_SCOPE.md) and [release roadmap](docs/product/RELEASE_ROADMAP.md)
- [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Development roadmap](docs/engineering/DEVELOPMENT_ROADMAP.md)
- [Decision register](docs/decisions/DECISION_REGISTER.md) — open and approved decisions
- [BITSHIFT-8 ISA draft](docs/specifications/BITSHIFT-8_ISA.md) — the first CPU (draft, not approved)

Documentation is the source of truth. Contracts live in [docs/contracts/](docs/contracts/).

## Repository Layout

```
src/
  app/            application shell
  platform/       simulation platform (CPU-independent)
  architectures/  CPU implementations (bitshift-8 in v1.0)
  assembler/      assembler
  visualization/  SVG datapath
  features/ components/ store/   workbench (later phases)
tests/            mirrors src/
docs/             documentation
.claude/          Claude Code configuration
```

## Contributing

- Read [CLAUDE.md](CLAUDE.md) and the [coding standards](docs/engineering/CODING_STANDARDS.md).
- Changes to architecture or contracts go through the [decision register](docs/decisions/DECISION_REGISTER.md) first.
- Definition of done: [docs/engineering/DEFINITION_OF_DONE.md](docs/engineering/DEFINITION_OF_DONE.md).

## Technology

React, TypeScript, Vite, Vitest, pnpm. Further libraries (Tailwind CSS, Motion if needed, CodeMirror 6; Zustand not adopted, DR-054) are planned per the [technology stack](docs/architecture/TECHNOLOGY_STACK.md) and are not yet approved.
