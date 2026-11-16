# BITSHIFT — Technology Stack

**Status:** Proposed (B). The stack is not yet approved by the product owner. The packages listed as "installed" in Phase 0 are tooling only (see section 4).
**Related:** [ADR-002](../decisions/README.md) (planned), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

---

## 1. Stack Summary

| Area                      | Technology               | Version policy                   | Status                          |
| ------------------------- | ------------------------ | -------------------------------- | ------------------------------- |
| Frontend framework        | React                    | Current stable major             | Proposed; installed             |
| Language                  | TypeScript               | 5.9.x (see section 5)            | Proposed; installed             |
| Build tool and dev server | Vite                     | Current stable major             | Proposed; installed             |
| Styling                   | Tailwind CSS             | Current stable major             | Proposed; deferred to Phase 4/5 |
| State management          | Zustand                  | Current stable major             | Proposed; deferred to Phase 5   |
| Animation                 | Motion for React         | Current stable major             | Proposed; deferred to Phase 4   |
| Datapath rendering        | SVG (native, no library) | —                                | Proposed                        |
| Assembly editor           | CodeMirror 6             | Current stable                   | Proposed; deferred to Phase 3   |
| Testing                   | Vitest                   | Current stable major             | Proposed; installed             |
| Package manager           | pnpm                     | 9.x (pinned in `packageManager`) | Proposed; in use                |
| Development environment   | Docker Dev Container     | Node 22 image                    | Proposed; configured            |
| Version control           | Git                      | —                                | In use                          |
| Formatting                | Prettier                 | Current stable major             | Proposed; installed             |

## 2. Rationale

| Choice               | Why                                                                                   | Alternatives considered                                                                   |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| React                | Familiar component model; large ecosystem; suits a panel-based workbench.             | Svelte, Vue, plain DOM. Rejected for ecosystem depth and team familiarity (assumption).   |
| TypeScript           | Typed contracts are a stated requirement. Catches interface drift between subsystems. | Plain JavaScript (rejected: contracts would be unenforced).                               |
| Vite                 | Fast dev server, simple configuration, static output for browser-only delivery.       | Webpack, Next.js (rejected: no server rendering or backend needed).                       |
| Tailwind CSS         | Utility classes keep styling close to components without a large CSS system.          | CSS Modules, styled-components (both workable; Tailwind chosen for speed).                |
| Zustand              | Small store with no provider boilerplate; works with subscriptions outside React.     | Redux Toolkit (heavier than needed), React context (poor fit for high-frequency updates). |
| Motion for React     | Declarative animation for datapath highlights and transitions.                        | CSS-only animation (possible; harder to sequence), GSAP (larger).                         |
| Native SVG           | Full control over datapath diagram; no runtime library needed.                        | Canvas (harder to inspect and test), diagram libraries (too generic).                     |
| CodeMirror 6         | Modular editor with a good extension model for syntax highlighting and diagnostics.   | Monaco (large bundle), plain textarea (no highlighting).                                  |
| Vitest               | Native Vite integration; fast; same config and transforms as the app.                 | Jest (requires separate transform setup).                                                 |
| pnpm                 | Fast, disk-efficient, strict dependency resolution.                                   | npm, yarn.                                                                                |
| Docker Dev Container | Same Node and tooling across Windows, macOS and Linux.                                | Local-only setup (inconsistent across platforms).                                         |

## 3. Constraints

- **No backend (A).** No technology that requires a server process may be added in v1.0.
- **No unjustified dependencies (A).** Each dependency needs a stated reason in the PR or commit that adds it, and a row in this file.
- **Simulation remains framework-free.** `src/platform` and `src/architectures` must not import React, Zustand, Motion or Tailwind (A).

## 4. Dependency Installation Plan

Phase 0 installs only what is needed to build, type-check, test and format an empty application.

| Package                                     | Role                  | Installed in                                            | Reason                                     |
| ------------------------------------------- | --------------------- | ------------------------------------------------------- | ------------------------------------------ |
| react, react-dom                            | UI runtime            | Phase 0                                                 | Minimal shell                              |
| vite, @vitejs/plugin-react                  | Build and dev server  | Phase 0                                                 | Build                                      |
| typescript                                  | Type checking         | Phase 0                                                 | Contracts                                  |
| @types/react, @types/react-dom, @types/node | Types                 | Phase 0                                                 | Type checking; Node types for config files |
| vitest                                      | Test runner           | Phase 0                                                 | Validates test setup; needed in Phase 1    |
| prettier                                    | Formatting            | Phase 0                                                 | Consistent formatting for docs and code    |
| zustand                                     | Store                 | Phase 5 (or Phase 1 if store contract needs it; DR-035) | Store                                      |
| motion                                      | Animation             | Phase 4                                                 | Datapath                                   |
| @codemirror/*                               | Editor                | Phase 3                                                 | Editor                                     |
| tailwindcss                                 | Styling               | Phase 4                                                 | Styling                                    |
| eslint (+ plugins)                          | Lint and import rules | Not decided (DR-021)                                    | Would enforce S-5 import boundaries        |

No dependency outside this table may be added without an entry here.

## 5. Version Notes

- TypeScript is pinned to 5.9.x. The 7.x line resolved initially; it was not adopted in Phase 0 because its toolchain differs from the documented setup and was not validated for this project. Revisit at the Phase 1 review (DR-036).
- `@types/node` is pinned to the Node 22 line to match the Dev Container image.
- Exact versions are recorded in `pnpm-lock.yaml`.

## 6. Scaling Considerations

| Concern                      | Stack implication                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large datapath diagrams      | SVG DOM size grows with components. Keep diagram as a fixed set of elements; update attributes instead of re-creating nodes.                                               |
| High-frequency state updates | Keep store updates batched; avoid one React render per micro-operation during run mode.                                                                                    |
| Heavy simulation             | If DR-031 targets are missed, move execution to a Web Worker. The platform's typed snapshot and event contracts are designed so this is a transport change, not a rewrite. |
| Bundle size                  | Load CodeMirror and Motion only where used; measure in Phase 6.                                                                                                            |

## 7. Cross-Platform Notes

- Development uses the Dev Container so that Windows, macOS and Linux share one Node and pnpm version.
- Line endings are LF (see `.editorconfig`). Git may convert on Windows; this must not change file content in commits.
- Browser targets: current versions of Chrome, Edge, Firefox and Safari (see [PRODUCT_SPEC.md](../product/PRODUCT_SPEC.md) S-6).
