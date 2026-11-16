# BITSHIFT

A browser-based educational computer architecture simulator. Write assembly, run it on a virtual CPU, and watch instructions move through registers, the ALU, memory and buses. It runs entirely in the browser, with no backend.

> **Status:** Phase 0 (product and architecture foundation) is complete. The application is a placeholder shell. The simulator itself, starting with the platform, arrives in Phase 1.

## Technology

React, TypeScript (strict), Vite, Vitest, ESLint, Prettier and pnpm 10, on Node.js 24 in the Dev Container. State uses React's built-in mechanisms and animation is CSS and SVG first. Tailwind CSS and Motion are deferred. The full rationale and the dependency plan are in the [technology stack](docs/architecture/TECHNOLOGY_STACK.md).

## Prerequisites

**Recommended: Dev Container.** It needs Windows, macOS or Linux with:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running,
- [VS Code](https://code.visualstudio.com/) with the Dev Containers extension (`ms-vscode-remote.remote-containers`).

On a machine with 8 GB of RAM, consider limiting WSL 2 memory so Docker leaves room for the host, for example `memory=4GB` under `[wsl2]` in `%UserProfile%\.wslconfig`.

**Alternative: local install.** Node.js 22.13 or newer (24 recommended) and pnpm 10. With Node's bundled Corepack, `corepack enable` then provides the pnpm version pinned in `package.json`.

## Getting Started

### In the Dev Container

1. Start Docker Desktop and wait until it reports that it is running.
2. Open this folder in VS Code.
3. Run **Dev Containers: Reopen in Container** from the command palette.
4. The first start pulls the image and runs `corepack enable && pnpm install --frozen-lockfile`.
5. In the container terminal, run `pnpm dev`. VS Code forwards port 5173, so the app opens at <http://localhost:5173>.

### Locally

```bash
pnpm install
pnpm dev
```

## Commands

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start the Vite dev server on port 5173            |
| `pnpm build`        | Type-check, then build the static site to `dist/` |
| `pnpm preview`      | Serve the production build locally                |
| `pnpm typecheck`    | TypeScript check without emitting files           |
| `pnpm lint`         | ESLint, including the module-boundary rules       |
| `pnpm test`         | Run the Vitest suite once                         |
| `pnpm format`       | Format all files with Prettier                    |
| `pnpm format:check` | Check formatting without changing files           |

Before a change is ready for review, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` and `pnpm build` must all pass ([definition of done](docs/engineering/DEFINITION_OF_DONE.md)).

## Repository Layout

```
src/
  app/             application layer: entry point, shell, and (from Phase 1) the composition root
  platform/        simulation platform, independent of any CPU
  architectures/   CPU implementations (bitshift-8 in v1.0)
  assembler/       assembler
  visualization/   view models and SVG rendering
  features/        workbench features
  components/      shared UI components
  store/           subscription adapter for the UI
tests/             mirrors src/, plus app/ (shell smoke test) and tooling/ (lint boundary tests)
docs/              documentation: product, architecture, contracts, engineering, decisions
.claude/           Claude Code commands
.devcontainer/     Dev Container definition
```

The directories under `src/` other than `app/` are empty until the phases that fill them. Their dependency rules are enforced by `pnpm lint` ([coding standards §4](docs/engineering/CODING_STANDARDS.md)).

## Documentation

Documentation is the source of truth.

- [Product specification](docs/product/PRODUCT_SPEC.md), [v1.0 scope](docs/product/MVP_SCOPE.md) and [release roadmap](docs/product/RELEASE_ROADMAP.md)
- [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) and the [simulation platform](docs/architecture/SIMULATION_PLATFORM.md)
- [Contracts](docs/contracts/): data, modules and events
- [Development roadmap](docs/engineering/DEVELOPMENT_ROADMAP.md)
- [Decision register](docs/decisions/DECISION_REGISTER.md): approved, open and deferred decisions

## Contributing

- Read [CLAUDE.md](CLAUDE.md) and the [coding standards](docs/engineering/CODING_STANDARDS.md).
- AI-assisted development follows the agent hierarchy and standard workflow in the [supervisor guide](docs/engineering/BITSHIFT_SUPERVISOR.md) (§1 and §1.2).
- Changes to architecture or contracts go through the decision register first.
