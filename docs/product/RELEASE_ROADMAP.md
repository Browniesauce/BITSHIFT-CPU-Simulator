# BITSHIFT — Release Roadmap

**Status:** Draft for product-owner review (Stage 0.1)
**Authorization [A]:** Only v1.0 is authorised for implementation planning. v2.0 to v4.0 are directional. They are not commitments and must not be built or planned in detail until v1.0 is complete and the product owner approves the next release.
**Scope note [A]:** The seven phases and 32 stages in [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md) apply exclusively to v1.0.

**Related:** [PRODUCT_SPEC.md](PRODUCT_SPEC.md), [MVP_SCOPE.md](MVP_SCOPE.md), [ADR-001](../decisions/ADR-001-modular-simulation-platform.md)

---

## 1. Release Overview

| Release  | Theme                | Product outcome                                                                                                        | Authorization   |
| -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| **v1.0** | BITSHIFT-8 Simulator | A complete educational simulation experience for one CPU: assembly, execution, datapath visualization, basic debugging | Authorised [A]  |
| v2.0     | Advanced Simulation  | Deeper study of how a CPU works internally, and more advanced debugging                                                | Directional [A] |
| v3.0     | Multi-Architecture   | Compare and study more than one instruction set                                                                        | Directional [A] |
| v4.0     | Educational Platform | Lessons, sharing and learner-created experiments                                                                       | Directional [A] |

Each release builds on the previous one. A later release may change v1.0 behaviour only through a recorded decision.

## 2. v1.0 — BITSHIFT-8 Simulator [A/B]

**Product outcome:** a learner can complete journey steps 1–10 in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) section 5 on one CPU, and reach the learning outcomes in section 7 of that document.

### 2.1 Capability Groups

| Group                   | Features           | Stages          |
| ----------------------- | ------------------ | --------------- |
| Programming environment | MVP-001 to MVP-005 | 3.1 to 3.4, 6.1 |
| CPU simulation          | MVP-006 to MVP-009 | 2.1 to 2.5      |
| Execution controls      | MVP-011 to MVP-014 | 1.3, 4.4, 5.2   |
| Visualization           | MVP-015 to MVP-020 | 4.1 to 4.5, 5.3 |
| Debugging and learning  | MVP-021 to MVP-023 | 4.5, 5.4, 5.5   |
| Platform and delivery   | MVP-024, MVP-025   | 5.1, 6.3, 6.4   |
| Shared state inspection | MVP-010            | 5.3             |

The full requirement list, with acceptance criteria, is in [MVP_SCOPE.md](MVP_SCOPE.md).

### 2.2 Release Gate for v1.0 [B]

v1.0 is released only when:

1. All MVP features in [MVP_SCOPE.md](MVP_SCOPE.md) section 2 meet their acceptance criteria.
2. No excluded item in [MVP_SCOPE.md](MVP_SCOPE.md) section 3 is present.
3. The learning measure S-8 has been run with real learners and its result recorded.
4. The open product questions that affect shipped behaviour are answered (MVP_SCOPE section 6).
5. The architecture and ISA decisions in [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) that these features depend on are approved.

### 2.3 Known Dependencies [B]

The v1.0 schedule depends on decisions that are not yet approved:

| Dependency                                               | Blocks                    | Register               |
| -------------------------------------------------------- | ------------------------- | ---------------------- |
| BITSHIFT-8 ISA and flag rules                            | MVP-006, MVP-009, MVP-002 | DR-001 to DR-018       |
| Clock-level micro-operation model                        | MVP-013, MVP-019          | DR-011, DR-013         |
| Product additions (control signals, speed, explanations) | MVP-014, MVP-019, MVP-022 | DR-045, DR-046, DR-051 |

If the clock-level micro-operation model is not approved before Phase 2, the v1.0 release date moves, because MVP-013 is part of the product's core value (DIF-03).

## 3. v2.0 — Advanced Simulation (directional)

**Intended product outcome:** learners who have completed v1.0 can study the CPU's internal organisation and advanced debugging.

| Capability                       | Learning value                                           | Dependency on v1.0              |
| -------------------------------- | -------------------------------------------------------- | ------------------------------- |
| Microcode visualization          | Shows how one instruction is broken into control steps   | Micro-operation model (MVP-013) |
| Interrupt simulation             | Shows how the CPU responds to events outside the program | Snapshot and event model        |
| I/O devices                      | Shows how the CPU exchanges data with devices            | OUT register display (MVP-010)  |
| Advanced debugging               | Watchpoints, conditional breakpoints                     | Breakpoints (MVP-023)           |
| Reverse execution                | Step backward to see what changed                        | Snapshot history (MVP-021)      |
| Cache and pipeline visualization | Shows overlap of instructions and memory hierarchy       | Clock-level events              |
| Advanced CPU configuration       | Changes the parameters of BITSHIFT-8 to see the effect   | ISA descriptor                  |
| Digital logic exploration        | Shows the gates behind the ALU and control unit          | Datapath (MVP-015)              |
| Microcode editing                | Not yet placed; see note                                 | Microcode visualization         |

**Note:** microcode editing appears in the non-goals of the Stage 0.1 brief but is not in the v2.0 direction list. It is listed here as unscheduled. Product owner to decide whether it belongs in v2.0.

**v1.0 constraint:** reverse execution and pipeline visualization depend on the snapshot and event model. v1.0 keeps snapshots and events as explicit typed data ([EVENT_MODEL.md](../contracts/EVENT_MODEL.md)) so these can be added without rewriting the CPU core. This is a constraint on v1.0 design, not v1.0 functionality.

## 4. v3.0 — Multi-Architecture (directional)

**Intended product outcome:** learners can study more than one instruction set and compare them.

| Capability                              | Learning value                                  |
| --------------------------------------- | ----------------------------------------------- |
| BITSHIFT-16                             | A wider-word version of the same teaching model |
| RISC-V RV32I                            | A real, widely used instruction set             |
| Additional architecture implementations | Further comparison and study                    |

**v1.0 constraint:** the platform must not assume identical registers, flags, word sizes or instruction formats ([CPU_ARCHITECTURE_STRATEGY.md](../architecture/CPU_ARCHITECTURE_STRATEGY.md)). ADR-001 records this direction. A new architecture should need a new package and one registry entry, not platform changes.

## 5. v4.0 — Educational Platform (directional)

**Intended product outcome:** BITSHIFT supports structured learning and learner-created work.

| Capability                    | Learning value                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| Guided lessons                | Step-by-step study units tied to the product's learning outcomes |
| Shareable programs            | Learners and instructors exchange programs                       |
| Interactive tutorials         | Lessons that check understanding as the learner works            |
| Custom CPU experimentation    | Learners change a CPU and observe the effect                     |
| User-created architectures    | Learners define their own instruction set                        |
| Expanded learning experiences | Further study modes built on the lessons                         |

**v1.0 constraint:** shareable programs and any account-based feature require storage outside the browser, which means a backend. v1.0 stays backend-free. Program and architecture data is kept in plain, serialisable formats so a later release can add storage without changing the simulation core.

## 6. Release Gating [B]

A release moves to planning only when:

1. The previous release's gate in section 2.2 (or its equivalent) is met and recorded.
2. The product owner approves the next release scope in writing (ADR or register entry).
3. Architecture changes needed by that release have an accepted ADR.
4. Learning measures for the release (for v2 onward, the measure is defined at approval) are agreed.

## 7. Consistency Check (Stage 0.1)

| Check                                                         | Result                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| Every v1.0 feature in the product vision appears in MVP_SCOPE | Pass                                                         |
| Every MVP feature maps to a roadmap stage                     | Pass (MVP-022 mapped to Stages 2.3 and 5.4, DR-045 approved) |
| No v2–v4 capability appears as a v1.0 feature                 | Pass. Only "v1.0 constraints" mention later releases.        |
| Release names and scope match PRODUCT_SPEC and MVP_SCOPE      | Pass                                                         |
| Phases and stages apply only to v1.0                          | Pass; DEVELOPMENT_ROADMAP has no v2–v4 stages                |
| Non-goals in the brief each have a release or "not planned"   | Pass; see MVP_SCOPE section 3                                |
