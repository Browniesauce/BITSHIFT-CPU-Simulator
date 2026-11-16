# BITSHIFT — Technology Stack

**Status:** Proposed (Stage 0.2). The stack has **not** been approved (DR-039). This document evaluates each proposed technology, recommends three changes (section 3), and sets the dependency policy. Packages marked "installed" are Phase 0 tooling only.
**Related:** [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md), [SIMULATION_PLATFORM.md](SIMULATION_PLATFORM.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

---

## 1. Requirements the Stack Must Meet

| Requirement                                                          | Source                 |
| -------------------------------------------------------------------- | ---------------------- |
| Runs in modern browsers on Windows, macOS and Linux, with no backend | [A] A-02, A-05; DR-044 |
| Simulation core runs without React or the DOM                        | [A] A-06               |
| Deterministic simulation                                             | [A] A-07               |
| Typed contracts between subsystems                                   | [A] A-09               |
| Responsive during execution at the targets in DR-031                 | PRODUCT_SPEC S-7       |
| Animated, labelled SVG datapath (MVP-015 to MVP-019)                 | Stage 0.1              |
| Assembly editor with highlighting and markers (MVP-001, MVP-003)     | Stage 0.1              |
| Desktop layout at 1280 px and wider (DR-040)                         | Stage 0.1              |
| Static build, no server (MVP-024)                                    | Stage 0.1              |
| Few dependencies, each justified (A-11)                              | [A]                    |

## 2. Evaluation of Each Technology

Each row gives the responsibility, why it fits, the alternatives considered, and its main limitations.

### 2.1 Language: TypeScript

- **Responsibility:** typed contracts across all subsystems; the source of truth for shapes in `docs/contracts/`.
- **Why it fits:** the architecture depends on explicit typed boundaries (AP-04). Type checking catches mismatched snapshots and events at compile time.
- **Alternatives:** plain JavaScript with JSDoc types (no compile-time enforcement of unions and `readonly`).
- **Limitations:** compile step; strict mode adds effort; types do not check runtime data. Runtime checks are needed at the assembler and load boundaries, and they are provided by `Result` values.

### 2.2 UI library: React

- **Responsibility:** rendering the workbench panels and the SVG datapath containers; reacting to store changes; handling user events.
- **Why it fits:** a panel-based workbench is well served by components. React includes `useSyncExternalStore`, which reads an external store without an extra library (see 3.1). The ecosystem covers CodeMirror integration and testing.
- **Alternatives:** Svelte (smaller runtime; built-in stores); Solid (fine-grained updates suit high-frequency values); Vue; plain DOM with web components.
- **Limitations:** React re-renders whole components on changes. A datapath that updates every cycle could be expensive. Mitigation: publish once per frame, memoise cells and panels, and update SVG attributes directly where needed (SIMULATION_PLATFORM §10.4). Solid would avoid some of this, but the team's familiarity and ecosystem outweigh it for v1.0 (assumption, to be confirmed).

### 2.3 Build tool and dev server: Vite

- **Responsibility:** development server, bundling, static production build, test configuration sharing.
- **Why it fits:** fast startup; the same configuration for the app and Vitest; output is static files, which satisfies MVP-024.
- **Alternatives:** Webpack (heavier configuration); Parcel; Rsbuild; esbuild on its own (no dev server or plugin model).
- **Limitations:** fewer built-in features than Webpack for unusual cases. None are expected here.

### 2.4 Styling: Tailwind CSS (proposed; decision open)

- **Responsibility:** layout and styling of workbench panels, theme tokens.
- **Why it fits:** fast to write consistent layouts; a Vite plugin integrates it.
- **Alternatives:** CSS Modules (no utility classes, scoped styles); plain CSS with custom properties for theme tokens; vanilla-extract.
- **Limitations:** class lists can make JSX harder to read. It adds a build-time dependency. For a small app with few components, plain CSS custom properties may be enough.
- **Recommendation:** keep Tailwind as proposed, but confirm at the start of Phase 4 (DR-065). Do not install it in Phase 0 (already the plan).

### 2.5 State management: Zustand (proposed; recommend dropping for v1.0)

- **Responsibility (as proposed):** holds UI-facing copies of snapshots, events and UI state; provides selectors to components.
- **Why it was proposed:** small API; works outside React; selectors avoid unnecessary renders.
- **Assessment:** the controller already provides `subscribe`, and the state the UI needs is small: one snapshot, one previous snapshot, one event batch, diagnostics, and UI preferences. React's `useSyncExternalStore` reads an external store directly, so a small hand-written store (a plain object with `subscribe` and `getSnapshot`) is enough. This removes a dependency.
- **Alternatives:** Zustand (keep); Redux Toolkit (heavier than needed); Jotai (atom model; suits fine-grained UI state but adds a second model); React context (re-renders every consumer on each change; poor fit for per-frame updates).
- **Limitations of dropping it:** selector and devtools support must be written by hand. Acceptable at this size. If UI state grows beyond a few stores, revisit.
- **Recommendation:** drop Zustand from the v1.0 plan. Decision **DR-054** (proposed). This supersedes the Zustand timing in DR-035 once approved.

### 2.6 Animation: Motion for React (proposed; recommend conditional)

- **Responsibility (as proposed):** animating bus transfers, highlights and transitions in the datapath.
- **Assessment:** most of the required motion is state-driven: a bus is active or not, a register is highlighted or not. CSS transitions and the Web Animations API cover these with no dependency. Motion becomes useful only if animations must be sequenced across many elements with timing that depends on the micro-operation, or if layout animation is needed.
- **Alternatives:** CSS transitions and keyframes; Web Animations API; GSAP (large, licence terms to check before any use); react-spring (similar to Motion).
- **Limitations of CSS and WAAPI:** sequencing across elements is more code. Acceptable at the scale of one datapath.
- **Recommendation:** start with CSS and SVG attribute transitions (**DR-055**, proposed). Adopt Motion only if the Phase 4 spike shows it is needed. That decision is **DR-064** (open).

### 2.7 Datapath graphics: native SVG

- **Responsibility:** the datapath diagram: components, buses, labels, active highlights.
- **Why it fits:** each component is a labelled, inspectable element. The diagram is about tens of elements, which SVG handles easily. SVG is accessible through the DOM (labels, focus) and testable through its markup.
- **Alternatives:** Canvas 2D (faster for thousands of shapes; no DOM accessibility; harder to test); WebGL (far beyond the need); diagram libraries (generic, less control over labels and buses).
- **Limitations:** a very large diagram would slow down. Not expected for BITSHIFT-8. Keep the element count fixed and update attributes rather than recreating nodes.

### 2.8 Assembly editor: CodeMirror 6

- **Responsibility:** text editing, highlighting, diagnostic markers, line numbers, undo and redo.
- **Why it fits:** modular packages; a language mode can be written for the assembly syntax; markers show assembler diagnostics; used in many production tools.
- **Alternatives:** Monaco (VS Code's editor; large bundle; heavier to customise for a small language); Ace (older); plain `textarea` (no highlighting, no markers).
- **Limitations:** the assembly language mode must be written (Phase 3). The editor should be loaded only when the workbench opens, to keep the first load small (Phase 6 measurement).

### 2.9 Testing: Vitest

- **Responsibility:** unit, contract, conformance, assembler and integration tests.
- **Why it fits:** shares the Vite configuration; fast; compatible with the Jest API, so the test style is familiar.
- **Alternatives:** Jest (needs its own transform setup for TypeScript and ESM); the built-in `node:test` runner (no dependency, fewer features, no built-in mocking style comparable to Vitest).
- **Limitations:** component tests need a DOM environment (jsdom or happy-dom) and a rendering library. Choice deferred to Phase 5 (DR-038).

### 2.10 Package manager: pnpm

- **Responsibility:** installing and locking dependencies.
- **Why it fits:** strict dependency resolution (a package cannot import what it did not declare); content-addressed storage; consistent installs across platforms.
- **Alternatives:** npm (default, looser resolution); yarn.
- **Limitations:** some tools expect a flat `node_modules`, which needs configuration in rare cases. Pinned to 9.x in `packageManager`.

### 2.11 Development environment: VS Code with Dev Containers

- **Responsibility:** identical Node, pnpm and tooling on Windows, macOS and Linux.
- **Why it fits:** the same container runs everywhere; the team does not need to match local installs.
- **Alternatives:** local installs only (inconsistent); GitHub Codespaces (needs a hosted service and an account; not a dependency of the product).
- **Limitations:** Windows and macOS need a container runtime (Docker Desktop or equivalent), which is heavy. Local setup must remain possible as a fallback.

### 2.12 Formatting: Prettier

- **Responsibility:** consistent formatting of code and documentation.
- **Why it fits:** already in use; zero configuration beyond `.prettierrc.json`.
- **Alternatives:** Biome (formatter and linter in one tool).
- **Limitations:** formatting only. Lint rules are decided separately (DR-021).

### 2.13 Linting and import rules: not yet decided

- ESLint (rule and plugin ecosystem; more setup) or Biome (single tool; fewer plugins).
- The import boundaries in SYSTEM_ARCHITECTURE §6 need a rule. Until a tool is approved, review and the Phase 1 import test enforce them (DR-021).

### 2.14 Version control: Git

- **Responsibility:** history and review. Line endings are LF (see `.editorconfig`).

## 3. Recommended Changes to the Proposed Stack

| Change                        | Proposal                                                                  | Reason                                                                                | Register               |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- |
| Drop Zustand                  | Use React's `useSyncExternalStore` with a small hand-written store        | Removes a dependency; the state is small; the controller already provides `subscribe` | DR-054 [B]             |
| Motion conditional            | Start with CSS and SVG transitions; adopt Motion only if needed           | Most motion is state-driven; avoids a dependency until proven necessary               | DR-055 [B]; DR-064 [C] |
| Tailwind confirmed in Phase 4 | Keep as proposed; confirm against CSS custom properties before installing | Low risk, but not clearly better than plain CSS for a small app                       | DR-065 [C]             |

No other change is proposed. These three changes reduce the dependency list. None adds a dependency.

## 4. Dependency Policy and Plan

### 4.1 Policy

- A dependency is added only with a row in §4.2 stating its role, phase and reason.
- Prefer the platform and the standard library over a package.
- A package used for one small function is not added. Write the function.
- Libraries that hold simulation state, or that run simulation, are rejected: the core stays framework-free (A-06).

### 4.2 Plan

| Package                                     | Role                  | Phase         | Status                                  | Reason                                           |
| ------------------------------------------- | --------------------- | ------------- | --------------------------------------- | ------------------------------------------------ |
| react, react-dom                            | UI runtime            | 0 (installed) | Installed                               | Minimal shell; panel UI                          |
| vite, @vitejs/plugin-react                  | Build and dev server  | 0 (installed) | Installed                               | Build; React transform                           |
| typescript                                  | Type checking         | 0 (installed) | Installed                               | Contracts                                        |
| @types/react, @types/react-dom, @types/node | Types                 | 0 (installed) | Installed                               | Type checking; config files                      |
| vitest                                      | Tests                 | 0 (installed) | Installed                               | Test runner shared with Vite                     |
| prettier                                    | Formatting            | 0 (installed) | Installed                               | Consistent formatting                            |
| @codemirror/* (state, view, language, lint) | Editor                | 3             | Planned                                 | MVP-001, MVP-003                                 |
| tailwindcss (with its Vite plugin)          | Styling               | 4             | Proposed; confirm (DR-065)              | MVP-025 styling                                  |
| motion                                      | Animation             | 4             | Conditional (DR-055, DR-064)            | Only if CSS and SVG transitions are insufficient |
| jsdom or happy-dom, @testing-library/react  | Component tests       | 5             | Decision DR-038                         | Component tests only                             |
| ESLint or Biome                             | Lint and import rules | 1             | Decision DR-021                         | Enforces DEP-01 to DEP-07                        |
| zustand                                     | Store                 | —             | **Removed from plan** (DR-054 proposed) | See §2.5                                         |

### 4.3 Candidates Considered and Rejected

| Candidate     | Category  | Reason rejected                                       |
| ------------- | --------- | ----------------------------------------------------- |
| Redux Toolkit | State     | Heavier than the state needs                          |
| Immer         | State     | Snapshots are already immutable copies; no need       |
| RxJS          | Events    | Controller subscription is simpler; no streams needed |
| Comlink       | Workers   | No worker in v1.0 (DR-033)                            |
| Monaco Editor | Editor    | Large; CodeMirror 6 is sufficient                     |
| GSAP          | Animation | Licence and size to check; CSS and SVG are sufficient |
| D3            | Graphics  | Generic; the datapath is hand-laid SVG                |
| xstate        | Lifecycle | The lifecycle has five states; a table is clearer     |
| lodash        | Utilities | Not needed; use built-ins                             |

## 5. Browser Runtime Requirements

| Requirement               | Used for                            | Fallback                                                                                                |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ES2022 modules and syntax | Entire application                  | None; modern browsers only (DR-044)                                                                     |
| `requestAnimationFrame`   | Run loop frame pacing and animation | None needed                                                                                             |
| `setTimeout`              | Not used for simulation timing      | —                                                                                                       |
| `localStorage`            | Editor text persistence (DR-048)    | Editor works without it; persistence is off and the UI says so. All access is wrapped in try and catch. |
| SVG and CSS transitions   | Datapath                            | None                                                                                                    |

No WebAssembly, no Web Workers, no service worker and no network calls in v1.0.

## 6. Build and Delivery

- `pnpm build` produces static files in `dist/`. No server code.
- Hosting is undecided (DR-042). Any static host works.
- Bundle size is measured in Phase 6. CodeMirror is loaded with the workbench, not in the first paint, if measurements show it matters.

## 7. Scaling Considerations

| Concern                | Stack implication               | Action                                                                                                                              |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| High-frequency updates | React renders per frame at most | One publish per frame (SIMULATION_PLATFORM §10.4)                                                                                   |
| Datapath size          | SVG element count               | Fixed element set; update attributes                                                                                                |
| Heavy simulation       | Could block the UI              | Measure first; then consider a worker (DR-033). The controller's copy-in and copy-out interface would make this a transport change. |
| Bundle size            | Editor and animation libraries  | Lazy-load the workbench if needed (Phase 6)                                                                                         |

## 8. Version Notes

- TypeScript is pinned to 5.9.x. The 7.x line resolved initially, but it was not adopted because it was not validated for this project. Revisit at Phase 1 (DR-036).
- `@types/node` matches the Node 22 line of the Dev Container image.
- Exact versions are recorded in `pnpm-lock.yaml`.
