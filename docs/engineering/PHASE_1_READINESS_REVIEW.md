# BITSHIFT — Phase 1 Readiness Review

**Date:** 2026-11-16. **Author:** engineering supervisor. **For:** the product owner.
**Status:** Review report, now closed. **Every approval it asked for has been decided; see section 9.** Sections 1 to 8 are kept as the analysis the decisions refer to. It approves nothing itself. No contract document, roadmap or source file was changed.
**Related:** [PHASE_1_EXECUTION_PLAN.md](PHASE_1_EXECUTION_PLAN.md), [BITSHIFT_SUPERVISOR.md](BITSHIFT_SUPERVISOR.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md), [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md)

---

## 1. Approved Decisions: Reconciliation

Recorded in the register on 2026-11-16. Contract text for an approved amendment is written in the slice that implements it, in the same change as the code (CLAUDE.md §6). This follows the precedent of DR-069 and DR-070, whose contract follow-ups are also still open.

| ID     | Recorded as            | What changed in the repository                                                                        | Still to do                                              |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| DR-039 | Approved               | Register row; status lines in TECHNOLOGY_STACK (header and §3) and CLAUDE.md §13                      | Nothing                                                  |
| DR-073 | Approved (conditioned) | Register row; plan §3. The fixture is now slice 1.5-a, inside Stage 1.5, implemented before Stage 1.4 | Roadmap correction below, if approved                    |
| DR-075 | Approved               | Register row                                                                                          | One sentence in EVENT_MODEL §2, in slice 1.4-c           |
| DR-076 | Approved (conditioned) | Register row                                                                                          | Contract lines in slice 1.4-e; DR-027 confirmation below |

### DR-039 — stack

Confirmed against `package.json` and a frozen-lockfile install: React 19, TypeScript 5.9, Vite 8, Vitest 5, ESLint 10, Prettier 3, pnpm 10.34.9. Node 24 is the Dev Container image; the host used for verification runs Node 22.19, so Node 24 is confirmed only by the product owner's container check. No Phase 1 slice adds a package.

### DR-073 — stage structure

The five stages are kept exactly. One ordering adjustment is used, as the condition allows: the fixture slice belongs to Stage 1.5 and is implemented before Stage 1.4.

**The roadmap contradiction is genuine.** DEVELOPMENT_ROADMAP names the Phase 1 stages Shared Primitives, Architecture Registry & CPU Lifecycle, Execution Controller, Event Bus & Snapshot Handling, and Platform Fixture & Contract Tests. It also makes Stage 1.3 depend on Stage 1.4. **Minimal correction, not applied:**

1. Rename the five Phase 1 stage headings to the approved names, and move each stage's existing scope lines under the matching heading (shared primitives under 1.1; lifecycle under 1.2; events, snapshots and history under 1.3; controller under 1.4; fixture and contract tests under 1.5).
2. Change the dependency lines so that 1.4 depends on 1.1 to 1.3, and note that the fixture slice of 1.5 is implemented before 1.4.
3. Replace the Phase 1 dependency list "DR-013, DR-014, DR-024, DR-027" with a pointer to the register's blocking summary.
4. Correct two stale section references: the controller is MODULE_CONTRACTS §2.4, and load and reset rules are SIMULATION_PLATFORM §3.

Acceptance criteria and the 32-stage count are unchanged.

### DR-075 — fault event ordering

Rule: the platform `fault` event's `sequence` is the number of events already published with the same `cycle`. That is 0 only when the cycle has no other event. The controller tracks that count across calls, because a fault can follow a completed cycle in a later call. Sentence to replace in EVENT_MODEL §2: "It has `sequence` 0 and the counter value unchanged" becomes "Its `sequence` is the next free sequence in that cycle, and the counter value is unchanged".

### DR-076 — breakpoint stop, reconciled with DR-027 and the lifecycle contract

- **Lifecycle.** The stop uses the transition that already exists: `running` to `paused`, the one `endRun` uses. No new state, no new `LifecycleAction`, no change to `nextState`. The update has reason `breakpoint` and carries `breakpointHit`. `lastFault` is untouched and no `fault` event is emitted.
- **After the stop.** A further `runBatch` returns `PLT-NOT-RUNNING`, as for any paused controller. The user resumes with `beginRun`. The check happens after an instruction boundary, on the new program counter, so resuming does not stop again at the same address.
- **A consequence to be aware of.** A breakpoint on the address where a run starts does not stop that run, because no instruction boundary has been crossed yet. This matches the existing contract wording and common debugger behaviour.
- **DR-027.** Its proposal is "checked at instruction boundaries during run only". MODULE_CONTRACTS §2.4.4 already says steps do not stop but report `breakpointHit`. The two agree once the reporting rule is exact: _a step reports `breakpointHit` only when it completed at least one cycle, ended on an instruction boundary, and the program counter is in the set. Steps never stop and never change lifecycle state because of a breakpoint._ DR-027 is still Open in the register. **Confirmation needed** (section 7).
- **Contract lines for slice 1.4-e:** SIMULATION_PLATFORM §3.1 (label the running → paused arrow "endRun or breakpoint stop") and §6; MODULE_CONTRACTS §2.4.1 (`runBatch` row) and §2.4.4.

---

## 2. DR-074 — Instruction Stepping and Atomicity

**Status: Proposed. Direction agreed by the product owner. Not approved.**

### 2.1 What DR-070 guarantees

"Faulting steps complete zero cycles and emit no events. Exceptions complete zero cycles. Failed steps must not leave partially committed CPU state."

Everything turns on what "step" means. The contracts use it for an architecture call: DATA_CONTRACTS §5 states the invariant on `StepOutcome`, which is the result of one `CpuInstance` call. The controller-level operation is described differently: MODULE_CONTRACTS §2.4.1 says `stepInstruction` "runs to the next instruction boundary, or to halt or fault" and completes "0 or more" cycles.

### 2.2 The three cases

**Case 1 — one clock step fails.**

- _Fault._ The architecture's `stepClock()` must change nothing when it reports a fault. It decides whether the cycle can complete before it writes anything. With one micro-operation per cycle (DR-053) this is a check before a write, not a rollback. The platform counts nothing, stamps nothing, and emits its own `fault` event. DR-070 holds exactly as written.
- _Exception._ The instance may be half-modified. The controller does not read it again. It publishes the last committed state, marks `PLT-INTERNAL`, and discards the instance on the next reset (DR-071). No partial state is ever published.

**Case 2 — an instruction step fails after earlier cycles succeeded.**

Example: an instruction's fetch cycles complete, then decode finds an undefined opcode. Under DR-074 the controller ran those cycles as separate `stepClock()` calls. Each was a complete cycle: counted, stamped, consistent with the replay invariant. The next `stepClock()` faults under Case 1 and changes nothing. The controller's `stepInstruction` returns `Ok` with: `cyclesCompleted` equal to the cycles that completed, their events, one `fault` event, state `faulted`, and a snapshot of the state after the last completed cycle. No history record is produced, because the instruction never ended.

The CPU is not partially committed. It is in the state after _k_ whole cycles, which is the state a real processor is in when a later cycle traps. Every published value agrees with every other: counter, events, snapshot.

**Case 3 — a batch stops normally (halt, breakpoint, or budget).**

Nothing failed, so there is nothing to make atomic. Every cycle the batch ran is committed. A halt counts the cycles the architecture reports and no more. A breakpoint stop happens between cycles, at an instruction boundary. A batch that uses its whole budget may end mid-instruction; the instruction continues in the next call. A batch that ends because of a fault is Case 2.

### 2.3 Why instruction-level rollback is the wrong guarantee

The alternative reading is that a faulting _instruction_ leaves the CPU as it was before the instruction began. That cannot be offered consistently:

- A learner who clock-steps into the same fault has already seen the fetch cycles published. They cannot be withdrawn. So the same program would end in two different states depending on whether the user pressed "step" or "step instruction".
- That breaks determinism as the platform defines it (SIMULATION_PLATFORM §5) and the rule that batch size never changes the result (DET-02).
- It is also less truthful for an educational simulator: the fetch did happen.

So the unit of atomicity has to be the clock cycle, in every stepping mode.

### 2.4 Mechanisms compared

| Option                                                                                                                                                          | DR-070 preserved?                                    | Cost                                                                                                      | Verdict         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| **A. Cycle-atomic commit.** Architecture: a faulting `stepClock()` changes nothing. Platform: commit after each successful cycle; publish only committed state. | Yes, per clock step, identically in all three modes  | One `readState()` per cycle. No new contract method. Measured in slice 1.5-c.                             | **Recommended** |
| B. Platform saves and restores state around each instruction                                                                                                    | Gives instruction-level rollback                     | Needs a new `restoreState` on `CpuInstance`; a full copy per instruction; results differ by stepping mode | Rejected        |
| C. Architecture stages a whole instruction in shadow state and commits at the end                                                                               | Gives instruction-level rollback                     | Clock stepping would have to show uncommitted state or hide it; duplicates state inside every CPU         | Rejected        |
| D. Platform undoes cycles by applying events' `before` values                                                                                                   | Only for replayable fields; not `details` or latches | Incomplete by construction                                                                                | Rejected        |
| E. Keep `CpuInstance.stepInstruction()` and require the architecture to roll back                                                                               | Yes on paper                                         | Every architecture implements rollback; two execution paths that must stay equal                          | Rejected        |

Option A is the simplest and needs no rollback, staging or snapshot machinery.

### 2.5 Does this weaken DR-070?

Not for anything the platform has promised to callers. It does settle a question DR-070 left open, and the product owner should approve that knowingly:

> **DR-070 applies to each clock step. BITSHIFT does not provide instruction-level rollback.** When a later cycle of an instruction faults, the cycles that completed before it stay committed and published.

Under the current contract, DR-070 read literally against `CpuInstance.stepInstruction()` would have required instruction-level rollback inside the architecture. Removing that method removes the only place that reading applied.

### 2.6 Amendments this needs (all pending approval)

The existing contracts cannot express DR-074 without amendment. None of this has been applied.

| #   | Document                                                           | Amendment                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DECISION_REGISTER DR-070                                           | Add: "A step is one `CpuInstance.stepClock()` call. Cycles completed earlier in the same controller call remain committed. Instruction-level rollback is not provided (DR-074)."                                                         |
| 2   | MODULE_CONTRACTS §3.2                                              | Remove `stepInstruction()` from `CpuInstance`. Extend normative rule 1: a step that faults also leaves `readState()` unchanged. This closes the DR-070 follow-up already recorded in the register.                                       |
| 3   | DATA_CONTRACTS §5                                                  | Invariant 1: add "and the architecture's state is unchanged". Invariant 2: remove the `stepInstruction` sentence; `cyclesCompleted` is 0 or 1.                                                                                           |
| 4   | MODULE_CONTRACTS §2.4.1, §2.4.3, §2.4.5                            | State that the controller composes `stepInstruction` and `runBatch` from clock steps, and that a fault or internal error inside such a call leaves earlier cycles counted and published.                                                 |
| 5   | SIMULATION_PLATFORM §2.1                                           | Rule 1 says "an instruction step is not the same as taking all of its clock steps". Reword: the two are different requests, and an instruction step produces exactly the state, events and cycle count of the clock steps it is made of. |
| 6   | CPU_ARCHITECTURE_STRATEGY §3, §4.1, §4.2; SYSTEM_ARCHITECTURE §8.2 | Remove the instance-level `stepInstruction` from the tables and sequence diagrams.                                                                                                                                                       |
| 7   | TEST_STRATEGY §5.4                                                 | CYC-05: add "and `readState()` equals its value before the step". CYC-03: add "and equals the result of the same number of clock steps".                                                                                                 |

### 2.7 Recommendation

Approve DR-074 as: _the platform composes instruction steps and batches from `stepClock()`; `CpuInstance.stepInstruction()` is removed; atomicity is per clock cycle, by Option A; the seven amendments above are applied in the slices that implement them._ Slice 1.1-a is unaffected: it transcribes `CpuInstance` as the contract shows it today, and the method is removed with amendment 2 in slice 1.2-b.

---

## 3. DR-077 and DR-078 — Individual Assessments

**Neither is approved.** "Mandatory" means Phase 1 cannot be implemented without choosing an answer. "Optional" means Phase 1 works without it.

### DR-077 a — requests with no program loaded

- **Current wording.** MODULE_CONTRACTS §2.4.2: "Any step, run or load request with no program loaded returns `PLT-NO-PROGRAM`, except `reset`". The interface comments list different errors: `load` has no `PLT-NO-PROGRAM`; `runBatch` and `endRun` list `PLT-NOT-RUNNING`.
- **Proposed.** `load` and `reset` are always allowed. `stepClock`, `stepInstruction` and `beginRun` return `PLT-NO-PROGRAM`. `runBatch` and `endRun` return `PLT-NOT-RUNNING`. "No program" is a controller flag, not a lifecycle state.
- **Why.** As written, a program could never be loaded. The document also contradicts itself.
- **Phase 1.** Mandatory (slice 1.4-a).
- **Impact.** One sentence in MODULE_CONTRACTS §2.4.2 and one in SIMULATION_PLATFORM §3.2. No type change.
- **Tests.** ERR-04, as already written.
- **Complexity.** None added.
- **Recommendation.** Approve.

### DR-077 b — the full `nextState` table

- **Current wording.** MODULE_CONTRACTS §2.2 declares actions `halt` and `fault` and three error codes. SIMULATION_PLATFORM §3.1 shows `halt` and `fault` only from `running` and `paused`. Nothing says what `nextState` returns for the other cells.
- **Proposed.** The table in the plan, section 7. `fault` is accepted from every state. `halt` from `ready`, `halted` or `faulted` returns `PLT-INTERNAL`.
- **Why.** LCY-01 requires every cell to be tested. `fault` must be reachable from any state because an exception can come from `load` or `reset` (item d). `halt` in those three states cannot happen in a correct controller, so it is reported as an internal error with a code that already exists.
- **Phase 1.** Mandatory (slice 1.2-a).
- **Impact.** Three arrows added to the state diagram; the table added to MODULE_CONTRACTS §2.2. No new diagnostic code.
- **Tests.** LCY-01 becomes a 40-cell table test.
- **Complexity.** None added; it removes guesswork.
- **Recommendation.** Approve.

### DR-077 c — update-reason precedence

- **Current wording.** DATA_CONTRACTS §7: for a run batch, the reason is `'run-batch'` when the full budget ran, and the stop cause when it stopped early. Steps are not covered. A batch that halts on its last budgeted cycle is not covered.
- **Proposed.** One rule for every advancing call: `fault`, else `halt`, else `breakpoint` (batches only), else the request's own reason.
- **Why.** `stepClock` can end in halt or fault, and its reason must be defined. One rule is simpler than a rule per operation.
- **Phase 1.** Mandatory (slices 1.4-a and 1.4-d). The alternative, steps always reporting their own reason, is also workable; a choice is what is required.
- **Impact.** Two sentences in DATA_CONTRACTS §7. Consumers can read the stop cause from `reason` or from `snapshot.state`; they always agree.
- **Tests.** CYC-08 ("with the correct reason") gains step cases.
- **Complexity.** None added.
- **Recommendation.** Approve.

### DR-077 d — exceptions outside a step, and failed recovery

- **Current wording.** MODULE_CONTRACTS §2.4.5 covers an architecture that throws during a step, and says the next `reset` creates a new instance and reloads the program. It says nothing about a throw from `loadProgram`, `reset`, `readState` or `createInstance`, about `load` while internally faulted, or about a replacement that throws again.
- **Proposed.** Any architecture exception gives `PLT-INTERNAL`, and the call returns `Ok` with a `fault` update, because a `Result` error may not change state. Both `reset` and `load` replace an unreliable instance first. If the replacement also throws, the controller stays `faulted`.
- **Why.** `load` is allowed from `faulted`, so it would otherwise call `loadProgram` on an instance the contract calls unreliable. `reset` "cannot fail", so it needs a defined outcome when recovery fails.
- **Phase 1.** Mandatory (slices 1.2-b, 1.4-a, 1.4-c).
- **Impact.** One paragraph in MODULE_CONTRACTS §2.4.5. No type change. `reset` still always returns an update.
- **Tests.** CYC-06 gains: throw during load; load after an internal fault; replacement that throws.
- **Complexity.** Small. It is the same single path as a throwing step, reused.
- **Recommendation.** Approve.

### DR-077 e — the `runBatch` argument

- **Current wording.** "Errors: `PLT-NOT-RUNNING`, `PLT-ARGUMENT`." What makes the argument invalid is not stated.
- **Proposed.** `maxCycles` must be a positive integer. The argument is checked before the lifecycle state.
- **Why.** Needed to write the check and its test. It matches the `historyLimit` rule.
- **Phase 1.** Mandatory (slice 1.4-d). Trivial.
- **Impact.** One sentence in MODULE_CONTRACTS §2.4.
- **Tests.** One ERR-01 case: 0, a negative number, a fraction.
- **Complexity.** None.
- **Recommendation.** Approve.

### DR-077 f — `StateChange.target` for memory

- **Current wording.** EVENT_MODEL §10: `target` is a "register name, flag name, or `'memory[<address>]'`". No number format.
- **Proposed.** Decimal, no padding: `memory[16]`.
- **Why.** HST-07 asserts the exact string. Decimal is independent of address width; the UI formats for display.
- **Phase 1.** Mandatory (slice 1.3-c). Hexadecimal would work equally; a choice is what is required.
- **Impact.** A few words in EVENT_MODEL §10. Phase 4's timeline view parses or reformats it.
- **Tests.** HST-07.
- **Complexity.** None.
- **Recommendation.** Approve decimal.

### DR-077 g — who sets `InstructionRecord.explanation`

- **Current wording.** EVENT_MODEL §10: `explanation` is "filled by calling the architecture's optional function, at display time". DATA_CONTRACTS §9: records are frozen when published. MODULE_CONTRACTS §3.3: the function "runs only when the timeline displays an entry" and is never on the execution path.
- **Proposed.** The platform never sets `explanation` and never calls `explainInstruction`. The display layer does.
- **Why.** It is what the three statements already imply together, but an implementer reading only §10 would wire the call into the controller, putting explanation text on the execution path against DR-061.
- **Phase 1.** Mandatory as an instruction to the implementer (slice 1.3-c). It needs a clarifying sentence, not a contract change.
- **Impact.** One sentence in EVENT_MODEL §10. Whether the field should stay on the platform record at all is a Phase 4 question and is not raised here.
- **Tests.** One assertion: platform records have no `explanation`.
- **Complexity.** Removes some.
- **Recommendation.** Approve.

### DR-078 a — `breakpoints()` accessor

- **Current wording.** `ExecutionController` has `setBreakpoints` and no reader. MODULE_CONTRACTS §6.4: "The UI keeps no separate copy that could diverge."
- **Proposed.** Add `breakpoints(): readonly Address[]`: frozen, sorted, the same object until the set changes.
- **Why.** The UI is told not to keep a copy but cannot ask for the set.
- **Phase 1.** **Optional.** No Phase 1 test needs it; BRK-01 to BRK-06 are behavioural. It is needed in Phase 5.
- **Impact.** One additive method on the controller interface. `BreakpointSet.addresses` already holds the value.
- **Tests.** One stable-reference test.
- **Complexity.** Negligible. Note that `setBreakpoints` sends no update to subscribers, so a store would not be notified; that is a Phase 5 design point and is not solved by this.
- **Recommendation.** Approve as an additive item for slice 1.4-e, or defer to Phase 5. Either is safe.

### DR-078 b — at most one `'output'` and one `'program-counter'` register

- **Current wording.** DATA_CONTRACTS §3.2 lists four validation checks; role uniqueness is not among them. EVENT_MODEL §3.2 and §5.1 refer to "the register whose role is `'output'`" and "a register with role `'program-counter'`".
- **Proposed.** Add a fifth check: at most one register with each of those two roles. Failure gives `ARCH-INVALID-DESCRIPTOR`.
- **Why.** History needs the output register's name for `output-emitted`, and the replay check needs both. With two candidates the behaviour is undefined.
- **Phase 1.** **Mandatory to choose an answer** before slice 1.4-b. The alternative is "the first such register in descriptor order", which also needs approval and fails silently instead of at registration.
- **Impact.** One bullet in DATA_CONTRACTS §3.2; one rule and one test in the registry.
- **Tests.** ERR-08 gains two cases.
- **Complexity.** Lower than the alternative.
- **Recommendation.** Approve the validation rule.

### DR-078 c — typing of `details`

- **Current wording.** `CpuInstance.readState(): CpuStateCopy`, and `CpuStateCopy<TDetails = undefined>`.
- **Problem, verified with the compiler.** An instance whose `readState()` returns `CpuStateCopy<SomeDetails>` is not assignable to `CpuInstance`: "Type 'D' is not assignable to type 'undefined'". BITSHIFT-8 is expected to use `details` (DATA_CONTRACTS §4.3).
- **Proposed, revised from the register row.** The simplest fix is not a type parameter on `CpuInstance` and `CpuArchitecture`. It is to have the platform-facing signatures use `CpuStateCopy<unknown>` and `CpuSnapshot<unknown>`. The platform never reads `details`, so `unknown` is the accurate type, and no generic has to be threaded through the registry and controller. The same compiler check passes with this form.
- **Phase 1.** **Optional.** The fixture does not need `details`; `buildSnapshot` is already generic and its pass-through is unit-tested in slice 1.3-a.
- **Impact.** Two signatures in MODULE_CONTRACTS §3.2 and §2.4. Consumers that want typed details narrow them in the architecture's own adapter.
- **Tests.** One type-level test.
- **Complexity.** The revised form adds none. The original form would add generics in four places.
- **Recommendation.** Defer to Phase 2 entry, and decide it there in the revised form. Slice 1.1-a transcribes the contract as written and reports the gap.

### Summary

| Item     | Phase 1               | Recommendation                 |
| -------- | --------------------- | ------------------------------ |
| DR-077 a | Mandatory             | Approve                        |
| DR-077 b | Mandatory             | Approve                        |
| DR-077 c | Mandatory (a choice)  | Approve                        |
| DR-077 d | Mandatory             | Approve                        |
| DR-077 e | Mandatory, trivial    | Approve                        |
| DR-077 f | Mandatory (a choice)  | Approve decimal                |
| DR-077 g | Mandatory, clarifying | Approve                        |
| DR-078 a | Optional              | Approve, or defer to Phase 5   |
| DR-078 b | Mandatory (a choice)  | Approve                        |
| DR-078 c | Optional              | Defer to Phase 2, revised form |

---

## 4. Review of the 18 Slices

Each slice was checked for objective, scope, dependencies, files, contract references, acceptance criteria, tests and completion evidence. Slice IDs below are the ones from the first plan; the last column gives the ID in the revised plan.

| Old ID | Subject                       | Finding                                                                                                                                                                                    | Action                                                                       | New ID |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| 1.1-a  | Primitives and types          | Sound. Prompt issues in section 5.                                                                                                                                                         | Prompt revised                                                               | 1.1-a  |
| 1.1-b  | Registry                      | Sound. Was shown as gated by DR-078 b; it is not, because it can implement the four checks the contract lists.                                                                             | Gate removed                                                                 | 1.1-b  |
| 1.2-a  | Lifecycle                     | Sound, but untestable until the table is approved.                                                                                                                                         | Gate stated: DR-077 b                                                        | 1.2-a  |
| 1.2-b  | Instance guard                | Sound. Depends on DR-074 (it wraps `stepClock` only) and DR-077 d, which the first plan did not say. Uses stubs, not the fixture, so no forward dependency.                                | Gates stated                                                                 | 1.2-b  |
| 1.3-a  | Snapshots                     | Sound and ungated.                                                                                                                                                                         | None                                                                         | 1.3-a  |
| 1.3-b  | Event stamping                | Included the platform `fault` event, which has no user until the controller's fault path.                                                                                                  | `fault` event moved to 1.4-c; slice is now ungated                           | 1.3-b  |
| 1.3-c  | History and recorder          | Depended on the descriptor to find the output register, which tied it to DR-078 b. Missing: what happens to an instruction that never ends.                                                | Recorder takes the register name as an argument; "no record" criterion added | 1.3-c  |
| 1.3-d  | Breakpoint set                | Sound and ungated.                                                                                                                                                                         | None                                                                         | 1.3-d  |
| 1.4-a  | Fixture core                  | Sat in Stage 1.4, which bent the approved stage structure. Split from "fixture completion" for no technical reason: the fixture is a script player and can emit every kind from the start. | Moved to Stage 1.5, implemented before 1.4; merged with old 1.5-a            | 1.5-a  |
| 1.4-b  | Controller core               | Halt handling was listed in a later slice, but `stepClock` cannot be correct without it. CYC-04 and CYC-07 belong here. Listener behaviour was unspecified (Q-1).                          | Halt moved in; catalogue corrected; Q-1 raised                               | 1.4-a  |
| 1.4-c  | Instruction step and history  | Sound. Depends on DR-074.                                                                                                                                                                  | Gate stated; "equals the equivalent clock steps" made a criterion            | 1.4-b  |
| 1.4-d  | Fault and internal paths      | Sound. Now also owns the `fault` event and the DR-075 contract sentence.                                                                                                                   | Scope extended as noted                                                      | 1.4-c  |
| 1.4-e  | Run control                   | Sound.                                                                                                                                                                                     | Gates stated                                                                 | 1.4-d  |
| 1.4-f  | Breakpoints in the controller | Sound. Now owns the DR-076 contract lines.                                                                                                                                                 | Updated for DR-076                                                           | 1.4-e  |
| 1.5-a  | Fixture completion            | Unnecessary split; see old 1.4-a.                                                                                                                                                          | Merged                                                                       | 1.5-a  |
| 1.5-b  | Invariant suite               | Sound. Takes over the two-fixture registry test.                                                                                                                                           | Extended                                                                     | 1.5-b  |
| 1.5-c  | Measurement                   | Too small to stand alone.                                                                                                                                                                  | Merged with phase exit                                                       | 1.5-c  |
| 1.5-d  | Phase exit                    | Too small to stand alone.                                                                                                                                                                  | Merged with measurement                                                      | 1.5-c  |

**Result: 16 slices.** Two merges; no slice was split.

**Answers to the specific questions.**

- _Bottom-up?_ Yes. Each slice imports only modules from earlier slices. The module graph in the plan, section 4, has no cycle.
- _Fixture dependencies?_ Resolved. Stages 1.1 to 1.3 need no fixture: registry tests use plain descriptors, and guard tests use small stubs. The fixture is built immediately before the first slice that needs it.
- _Independently testable?_ Yes. Every slice ends with its own passing tests and the five commands.
- _Implementable without guessing?_ Yes for 1.1-a, 1.1-b, 1.3-a, 1.3-b and 1.3-d today. For the rest, only once the decisions in section 7 are answered. That gating is now explicit per slice.
- _Controller manageable?_ Five slices, each adding one behaviour to a passing controller. 1.4-a is the largest; if its review does not fit one sitting, `readMemory` is split out.
- _Catalogue mapping?_ Every Phase 1 catalogue ID is assigned to a slice. Corrections made: CYC-04 and CYC-07 moved to 1.4-a; ERR-07 split between 1.4-a (halted) and 1.4-c (faulted); BRK-03 and BRK-04 covered at function level in 1.3-d and at controller level in 1.4-e. EVT-04, STR, PER, ASM, INT, VIS and CNF belong to later phases.

**One new question found (Q-1, not in the register).** MODULE_CONTRACTS §2.4.6 says listeners run before the call returns. It does not say what happens when a listener throws, or when a listener calls the controller during a notification. Recommended reading: listeners are called in subscription order after the state is committed; a listener's exception is not caught and reaches the caller, and it never faults the CPU, because it is a UI error and not a simulation error; a state-changing controller call made from inside a notification throws, as a programmer error. It gates slice 1.4-a. If approved it can be recorded as DR-077 h.

---

## 5. First Slice Readiness (1.1-a)

| Check                                 | Result                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implements only approved shared types | Yes, after one removal. `SharedExecutionEvent` was a supervisor-invented union with no user in the slice; removed. `SharedEventPayloads` and `SharedEventKind` remain: they are the code form of the EVENT_MODEL §3.2 table and add no field. |
| Avoids CPU-specific assumptions       | Yes. The prompt forbids any BITSHIFT-8 name or literal in source and tests, and requires a memory size other than 256 in the tests.                                                                                                           |
| No registry functionality             | Yes. The exclusion list now also names lookup and descriptor-validation code.                                                                                                                                                                 |
| TypeScript strictness                 | Yes. Strict mode, no `any`, no suppression comments, explicit return types (lint).                                                                                                                                                            |
| Meaningful type-level tests           | Strengthened. Exact key sets for the types where an extra field would break an approved decision (cycle counter, breakpoint field, descriptor `id`). New criterion 7 makes the agent prove the type tests can fail.                           |
| Clear acceptance criteria             | Nine, each testable. `ok` and `err` now have fixed signatures.                                                                                                                                                                                |
| Stops on ambiguity                    | Yes. The stop rule now separates "compiles as written: transcribe and report" from "does not compile: stop". The two known gaps (DR-074, DR-078 c) are named so the agent does not try to fix them.                                           |
| Self-contained                        | Yes. Reading list, files, signatures, exclusions, criteria, rules and report format are all in the prompt.                                                                                                                                    |

**Verdict: ready to delegate.** It depends on no pending decision. Its output is the same whichever way DR-074 and DR-078 c are decided, except for one method on `CpuInstance` that slice 1.2-b removes if DR-074 is approved.

---

## 6. Remaining Blockers

1. **Dev Container host check.** Still the product owner's to confirm. It gates the formal acceptance of Stage 0.4, not the technical start of 1.1-a.
2. **DR-074.** Gates four slices, including the fixture and most of the controller.
3. **DR-077 a to g and Q-1.** Gate 1.2-a, 1.2-b, 1.3-c and the controller slices.
4. **DR-078 b.** Gates 1.4-b.
5. **DR-027 confirmation.** Gates 1.4-e.

No tooling, dependency or architecture blocker exists. `typecheck`, `lint`, `test` (44 passing), `format:check` and `build` pass on the host after this review's documentation changes.

---

## 7. Product-Owner Approvals Required

Each can be answered "approved" in one line. The recommendation is in brackets.

1. **DR-074** — platform composes instruction steps and batches from `stepClock()`; `CpuInstance.stepInstruction()` removed; atomicity per clock cycle with no instruction-level rollback; the seven amendments in section 2.6. [Approve]
2. **DR-077 a, b, c, d, e, f, g** — the seven readings in section 3. [Approve all]
3. **DR-078 b** — role-uniqueness validation. [Approve]
4. **DR-078 a** — `breakpoints()` accessor. [Approve, or defer to Phase 5]
5. **DR-078 c** — typing of `details`. [Defer to Phase 2, in the revised `unknown` form]
6. **DR-027** — close it with the step-reporting rule in section 1. [Approve]
7. **Q-1** — listener behaviour, section 4. [Approve; record as DR-077 h]
8. **Roadmap correction** — the four edits in section 1. [Approve]
9. **Stage 0.4 acceptance** after the Dev Container check.

---

## 8. Recommendation

**Start Phase 1 now with slice 1.1-a.** It is ready, ungated, and its prompt is Appendix A of the execution plan.

The 16-slice plan is executable. Five slices can proceed with no further approval. The other eleven need the approvals in section 7, all of which are narrow and have a recommended answer. If items 1, 2, 3, 6 and 7 are approved together, nothing else stands between the project and the end of Phase 1 except the work itself.

No further planning document is needed before implementation.

---

## 9. Product-Owner Decisions (recorded 2026-11-16)

The register is authoritative. This section only maps the requests in section 7 to their outcome.

| Request (section 7)             | Outcome                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. DR-074                       | **Approved.** Option A, cycle-atomic commit. `CpuInstance.stepInstruction()` removed. No instruction-level rollback.                                                                |
| 2. DR-077 a to g                | **Approved**, exactly as presented in section 3.                                                                                                                                    |
| 3. DR-078 b                     | **Approved.**                                                                                                                                                                       |
| 4. DR-078 a                     | **Deferred** to Phase 5.                                                                                                                                                            |
| 5. DR-078 c                     | **Deferred** to Phase 2, in the revised `unknown` form.                                                                                                                             |
| 6. DR-027                       | **Approved**, with the step-reporting rule in section 1.                                                                                                                            |
| 7. Q-1                          | **Approved** and recorded as DR-077 h.                                                                                                                                              |
| 8. Roadmap correction           | **Approved** and applied to DEVELOPMENT_ROADMAP.                                                                                                                                    |
| 9. Stage 0.4 acceptance         | Not part of this decision set.                                                                                                                                                      |
| Readings from the slice reviews | **Confirmed** and recorded as DR-079: register widths are positive integers; an empty registry is valid; payloads are frozen in place; `BreakpointSet` does not validate the width. |

Slice counts in sections 4 and 8 predate these decisions. The current plan has 17 slices: slice 1.1-c was added for the two registry rules.
