# BITSHIFT — Phase 2 Execution Plan: BITSHIFT-8 CPU Core

**Status:** **Accepted by the product owner on 2026-11-17 (DR-084). Phase 2 implementation is authorised.** No Phase 2 code exists yet. The first assignment is Appendix A.
**Specification:** [BITSHIFT-8_ISA.md](../specifications/BITSHIFT-8_ISA.md) (approved). Every "ISA §n" below refers to it. It is the only source of BITSHIFT-8 values.
**Related:** [BITSHIFT_SUPERVISOR.md](BITSHIFT_SUPERVISOR.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) (Phase 2), [TEST_STRATEGY.md](TEST_STRATEGY.md), [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md), [CODING_STANDARDS.md](CODING_STANDARDS.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md) §3, [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md), [PHASE_1_EXECUTION_PLAN.md](PHASE_1_EXECUTION_PLAN.md)

---

## 1. Overview

**Objective.** Implement BITSHIFT-8 exactly as the approved specification says, as an architecture package behind the Phase 1 platform contracts, with a conformance suite.

**Touches only:** `src/architectures/bitshift-8/` and `tests/architectures/bitshift-8/`. The `.gitkeep` files in those places are removed.

**Must not change:** anything in `src/platform/`, `src/app/`, `src/assembler/`, the contracts, the specification, `eslint.config.js` or `package.json`. **If BITSHIFT-8 cannot be built without changing the platform or a contract, the slice stops and the conflict is reported.** That would mean the architecture has failed (CPU_ARCHITECTURE_STRATEGY §5.4), and it is the product owner's decision.

**Entry conditions.**

1. The product owner has accepted the specification and this plan (DR-084).
2. The documentation of this decision round is committed, so that the first slice is a clean diff.

**Exit conditions.** The roadmap's Phase 2 exit criteria; DEFINITION_OF_DONE §7; conformance tests CNF-01 to CNF-05 and EVT-04 passing; the Phase 1 suite (561 tests) still passing unchanged.

**Not in Phase 2:** the assembler; the composition root in `src/app` and the DR-069 check; the SVG layout; displaying explanations; DR-024, DR-031 and the Dev Container check, which stay open from Phase 1.

---

## 2. Roles and Ownership

| Role                               | Owns in Phase 2                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fable** (engineering supervisor) | This plan; each batch's assignment; the independent audit of every slice; verdicts; the status table. Writes no application code and no tests.      |
| **Sonnet** (sole lead executor)    | All implementation and integration. Delegates the bounded tasks marked "Haiku" below, reads every delegated file in full, runs validation, reports. |
| **Haiku** (sub-agents)             | One bounded task each, on files nobody else touches, with a completion report. No integration, no decisions.                                        |
| **Product owner**                  | Acceptance of each stage and of the phase; any decision this plan does not already contain.                                                         |

Every slice below names its owner. "Haiku" means Sonnet delegates it and remains accountable. "Sonnet" means the lead executor writes it personally, because it is the integration point or too subtle to delegate. In both cases the supervisor audits the result.

**The stop rule applies to every agent:** where the specification or this plan admits two behaviours, do not choose. Stop that task and report. The specification was written so that this should not happen.

---

## 3. Module Map

```
src/architectures/bitshift-8/
  index.ts          public entry: exports `bitshift8: CpuArchitecture`. The only file other code may import.
  machine.ts        constants: identifier, sizes, the seven register definitions, the three flag definitions
  isa.ts            the 22-row instruction table, the IsaDescriptor, displayName()
  descriptor.ts     the ArchitectureDescriptor, assembled from machine.ts and isa.ts
  state.ts          the mutable machine state: create, load, reset, copy out
  alu.ts            the eight ALU operations and the Z, N helper
  decode.ts         opcode → instruction row, and the undefined-opcode diagnostic
  microcode.ts      the typed micro-operation table: fetch, and the execute sequences per opcode
  instance.ts       createInstance(): the sequencer and executor behind CpuInstance
  explanations.ts   explainInstruction()
  visualization.ts  the Phase 2 adapter (ISA §11)

tests/architectures/bitshift-8/
  <module>.test.ts  one file per module above
  conformance/      per-instruction conformance (Stage 2.5)
  integration/      BITSHIFT-8 under the platform controller (Stage 2.5)
  helpers/          test-only builders (program images, expected-event builders)
```

Import rules inside the package: `machine` and `alu` import nothing from the package. `isa` imports `machine`. `descriptor` imports `machine` and `isa`. `state` imports `machine`. `decode` imports `isa`. `microcode` imports `isa` and `alu` (types only, for operation names). `instance` imports all of those. `explanations` imports `isa`. `visualization` imports `machine`. `index` imports `descriptor`, `instance`, `visualization` and `explanations`. No cycles.

Everything imported from the platform comes from `src/platform` (its `index.ts`) and from nowhere else. Tests may also import `tests/platform/helpers/replay.ts`, which is a test helper, read-only.

---

## 4. Slices

Thirteen slices in the five roadmap stages. Every slice also meets DEFINITION_OF_DONE §2 and §3 and the rules in section 6. Expected values in tests are written by hand from the specification section each test cites, never from running the code (TEST_STRATEGY CNF-04).

### Stage 2.1 — Registers, Flags and Memory

| Slice | Owner | Builds                          | Needs | Specification      | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ----- | ------------------------------- | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1-a | Haiku | `machine.ts`, `machine.test.ts` | —     | ISA §1, §2, §2.1   | 1. Exports the identifier `bitshift-8`, display name `BITSHIFT-8`, word bits 8, address bits 8, memory bytes 256. 2. Exports exactly seven register definitions, in the order and with the bits, role and visibility of ISA §2. 3. Exports exactly three flag definitions in the order Z, N, C, each with a one-line description. 4. Every exported value is frozen, including nested arrays and objects. 5. The file contains data only: no function with behaviour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2.1-b | Haiku | `state.ts`, `state.test.ts`     | 2.1-a | ISA §1.1, §1.2, §2 | 1. A new state is the empty machine of ISA §1.2 rule 1. 2. Each of the four rejection conditions of rule 2 returns its code and leaves the state deeply unchanged; a mismatch is reported in preference to a range error. 3. Boundary loads are accepted: origin 0 with 256 bytes; origin 255 with 1 byte; an empty image; entry 255. 4. An accepted load gives exactly the state of rule 3, including zeroing memory left by an earlier, longer program. 5. `reset` restores the post-load state after registers, flags and memory have been changed, and gives the empty machine when nothing was ever loaded. 6. The state copy has `programCounter` equal to PC, the seven registers and three flags in descriptor order, and 256 memory bytes; every call returns new arrays, new element objects and a new `Uint8Array` (SNP-05). 7. The image passed to `loadProgram` is not mutated, and changing its bytes afterwards does not change the machine. 8. A helper adds 1 modulo 256: 255 gives 0. |

### Stage 2.2 — ALU

| Slice | Owner | Builds                                                                                 | Needs             | Specification | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----- | -------------------------------------------------------------------------------------- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.2-a | Haiku | `alu.ts` (`add`, `sub`), `alu.test.ts`                                                 | —                 | ISA §3, §5    | 1. `add` returns (A + B) mod 256 and carry 1 exactly when A + B > 255. 2. `sub` returns (A − B) mod 256 and carry 1 exactly when A < B. 3. Both are tested for every pair of operands drawn from 0, 1, 127, 128, 255 (25 pairs each), with results and carries written by hand in the test. 4. The worked values of ISA §5 are tests by name. 5. Pure functions; results are always integers from 0 to 255.                                                                                                                              |
| 2.2-b | Haiku | `alu.ts` (`inc`, `dec`, `and`, `or`, `xor`, `not`, and the Z, N helper), `alu.test.ts` | 2.2-a (same file) | ISA §3, §5    | 1. Each operation returns the value of ISA §3, tested at 0, 1, 127, 128 and 255 (all 25 pairs for the two-operand ones). 2. These six report no carry: the result has a carry only for `add` and `sub`. 3. The helper returns Z = 1 exactly for 0 and N = bit 7, tested at 0, 1, 127, 128, 255. 4. One entry point runs an operation by name (`add`, `sub`, `inc`, `dec`, `and`, `or`, `xor`, `not`) and returns the result, the carry where there is one, and the `right` operand value that ISA §10.2 rule 5 prescribes for the event. |

2.2-a and 2.2-b share `alu.ts`, so they are done in order by the same agent or by two agents one after the other, never at once.

### Stage 2.3 — Instruction Set and Decoding

| Slice | Owner | Builds                                                         | Needs | Specification                            | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ----- | -------------------------------------------------------------- | ----- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.3-a | Haiku | `isa.ts`, `descriptor.ts`, `isa.test.ts`, `descriptor.test.ts` | 2.1-a | ISA §3, §4                               | 1. The instruction table has exactly 22 rows, and each row's opcode, mnemonic, variant, length and operand equal a table written by hand in the test from ISA §3. 2. `displayName` gives the 22 names of ISA §3 rule 3. 3. The `IsaDescriptor` has `architectureId` `bitshift-8` and the 22 definitions. 4. The descriptor has the values of `machine.ts` and this ISA, and no other field. 5. A registry built from an architecture carrying this descriptor is accepted by `createArchitectureRegistry` (use a stub `createInstance` that throws). 6. All exported data is frozen.                                                   |
| 2.3-b | Haiku | `decode.ts`, `decode.test.ts`                                  | 2.3-a | ISA §3 rule 1, §6.3                      | 1. For each of the 22 opcodes, decoding returns that row. 2. For each of the other 234 byte values, including 0x00, decoding reports "undefined"; the test loops over all 256 values and counts 22 and 234. 3. The undefined-opcode diagnostic has code `bitshift-8/UNDEFINED-OPCODE`, severity `error`, and a message containing the opcode and the address in hexadecimal. 4. The display name for an undefined opcode is `?`. 5. Pure.                                                                                                                                                                                              |
| 2.3-c | Haiku | `explanations.ts`, `explanations.test.ts`                      | 2.3-a | ISA §13; DR-045, DR-061, DR-084; MVP-022 | 1. `explainInstruction(record)` returns, for a record whose `mnemonic` is each of the 22 display names, exactly the authored text of ISA §13 (AC-022-1). The test holds the 22 texts, copied by hand from ISA §13. 2. Every text has the two-part structure: what the instruction does, then which flags it updates or that none are changed. 3. Any other mnemonic, including `?`, returns `undefined`. 4. Pure: no state, and no dependence on anything but the record's `mnemonic`. 5. Removing every explanation leaves every execution result unchanged: nothing in the package imports this module except `index.ts` (AC-022-3). |

### Stage 2.4 — Micro-Operations and Sequencing

| Slice | Owner                                           | Builds                                                                   | Needs               | Specification                              | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4-a | Haiku                                           | `microcode.ts`, `microcode.test.ts`                                      | 2.2-b, 2.3-a        | ISA §6, §7, §8, §9                         | 1. A micro-operation is a typed object (a discriminated union, no functions, no strings to parse) carrying its kind, its label and its control signals. 2. The fetch sequence is the four rows of ISA §6.1, with stages. 3. Every one of the 22 opcodes has its execute sequence from ISA §6.2; each conditional jump has two, taken and not taken, and the condition it tests. 4. A test table written by hand from ISA §6 gives the label and signals of every cycle of every opcode, and the code table equals it. 5. Total cycles per instruction equal ISA §7, for both jump outcomes. 6. In every cycle the four rules of ISA §9 hold. 7. Every one of the 17 signals is used at least once, and no other signal name appears. 8. The table is frozen.                                                                                                                                                                                                                                                                                                                             |
| 2.4-b | Sonnet                                          | `instance.ts` (first part), `instance.test.ts`                           | 2.1-b, 2.3-b, 2.4-a | ISA §6.1, §6.2, §10; MODULE_CONTRACTS §3.2 | 1. `stepClock` runs one micro-operation and returns `cyclesCompleted` 1, with `instructionCompleted` true only on an instruction's last cycle. 2. The four fetch cycles change MAR, MDR, IR and PC as ISA §6.1 says. 3. `NOP`, `MOV A,B`, `MOV B,A`, the eight ALU instructions and `OUT` execute as ISA §6.2, with flags per ISA §5. 4. The events of every cycle are exactly those of ISA §10.1, in that order, with the payloads of ISA §10.2 and §10.3; the example of ISA §10.5 is a test, event for event. 5. State-changing events are emitted only on change: a test where a transfer leaves the value unchanged shows the `bus-transfer` and no `register-write`; a test where an ALU result leaves a flag unchanged shows no `flag-update` for it. 6. `instruction-start` carries the display name from the read-ahead, and the read-ahead emits no `memory-read`. 7. `bitshift-8/step` carries `address`, `mnemonic`, `stage` and `label` and **no other field**. 8. No outcome carries a cycle number (CYC-09). 9. `readState` after each step equals the hand-worked state. |
| 2.4-c | Sonnet                                          | `instance.ts` (second part), `instance.test.ts`                          | 2.4-b               | ISA §6.2, §6.3, §6.4, §1.2                 | 1. `LDI A`, `LDI B`, `LDA` and `STA` execute as ISA §6.2, cycle by cycle. 2. `JMP` and each conditional jump follow the taken sequence when the condition holds and the not-taken sequence when it does not, for both values of the tested flag. 3. `HLT` reports `halted` in T5, with `halted` before `instruction-end`, and PC one past the `HLT`. 4. The undefined-opcode fault: three steps complete, the fourth returns the fault with zero cycles and no events, the state copy before and after that step are deeply equal, IR holds the opcode, PC addresses it, and a fifth step returns the same fault (ISA §6.3). 5. `reset` and an accepted load return the position to T1 from the middle of an instruction, and from a faulted or halted machine. 6. A two-byte instruction at 0xFF takes its operand from 0x00 (CNF-02). 7. `STA` to the address of a later instruction changes what is then fetched.                                                                                                                                                                     |
| 2.4-d | Haiku (`visualization.ts`), Sonnet (`index.ts`) | `visualization.ts`, `visualization.test.ts`, `index.ts`, `index.test.ts` | 2.4-c, 2.3-c        | ISA §11; MODULE_CONTRACTS §3.1             | 1. `toDatapath` returns exactly the fields of ISA §11, for hand-built snapshots and events covering: a bus cycle, a memory-read cycle, an ALU cycle, an `OUT` cycle, and a cycle list that is empty. 2. Events of an earlier cycle in `recentEvents` are ignored. 3. It is pure: equal inputs give equal outputs and the inputs are not mutated (VIS-01). 4. Unknown event kinds are ignored (VIS-05). 5. `index.ts` exports one value, `bitshift8`, with the descriptor, `createInstance`, the adapter and `explainInstruction`, and nothing else. 6. Two instances created from it are independent. 7. The package has no module-level mutable state.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Stage 2.5 — Conformance and Reference Programs

| Slice | Owner                                                     | Builds                              | Needs | Specification                                                             | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------- | ----------------------------------- | ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.5-a | Haiku, one agent per instruction group; Sonnet integrates | `conformance/*.test.ts`, `helpers/` | 2.4-d | ISA §3 to §7, §10; CNF-01 to CNF-05                                       | 1. **CNF-01:** every one of the 22 opcodes has a conformance test that loads the instruction as bytes, steps it to its boundary, and checks every register, every flag, the changed memory, the cycle count and `nextAddress`. ALU and load instructions are tested with A (and B) at 0, 1, 127, 128 and 255. 2. Each conditional jump is tested with its flag 0 and 1. 3. **CNF-02:** PC wrap, including a two-byte instruction at 0xFF. 4. **CNF-03:** every one of the 234 reserved opcodes faults as ISA §6.3, with IR and PC as specified. 5. **CNF-05:** no instruction takes more than 10 cycles, and each takes exactly the count of ISA §7. 6. **CNF-04:** every test names the ISA section it comes from, and its expected values are written out by hand. 7. Groups, one file each: loads and moves; arithmetic; logic; memory; jumps; `NOP`, `OUT`, `HLT` and faults.                                                                                                                                                                                                                                                                                                                                                          |
| 2.5-b | Haiku for each test file; Sonnet integrates               | `integration/*.test.ts`             | 2.5-a | EVENT_MODEL §5; TEST_STRATEGY EVT-04, DET-01, DET-02; DATA_CONTRACTS §3.2 | 1. **EVT-04:** with BITSHIFT-8 under `createController`, the Phase 1 replay checker (`tests/platform/helpers/replay.ts`, unchanged) accepts every cycle of every one of the 22 instructions, including both jump outcomes, PC through `register-write` and OUT through `output-emitted`. 2. An undefined opcode under the controller gives state `faulted`, counter 3, one platform `fault` event at cycle 3, and the snapshot of ISA §6.3. 3. Three reference programs, given as bytes with their hand-worked results: a count-down that writes each value to OUT; the sum 1 + 2 + … + 5 left in memory; a comparison of two bytes that outputs the larger. Each halts with the stated registers, memory, OUT and total cycle count. 4. For those programs: `stepInstruction` equals the same clock steps; batch sizes 1, 7 and 1000 agree (DET-02); two controllers agree after every call (DET-01); a breakpoint stops at the instruction boundary; the history has one record per instruction with the display name. 5. `registry.architectures` containing `bitshift8` and the Phase 1 fixture together selects each by identifier. 6. `git diff -- src/platform` is empty for the whole phase, and all 561 Phase 1 tests still pass. |

---

## 5. Order and Parallelism

```
2.1-a ──┬─► 2.1-b ───────────────┐
        └─► 2.3-a ─┬─► 2.3-b ────┤
                   └─► 2.3-c ──┐ │
2.2-a ─► 2.2-b ────────────────┼─┼─► 2.4-a ─► 2.4-b ─► 2.4-c ─► 2.4-d ─► 2.5-a ─► 2.5-b
                               └─┘
```

| Batch | Slices                         | Shape                                                                                                                                                                        |
| ----- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 2.1-a                          | First, alone. Everything else imports it. Issued together with Batch B in one assignment (Appendix A), with a gate: 2.1-a is complete and green before Batch B is delegated. |
| B     | 2.1-b, 2.2-a then 2.2-b, 2.3-a | Three parallel lines on separate files. 2.2-a and 2.2-b are one line, in order.                                                                                              |
| C     | 2.3-b, 2.3-c, 2.4-a            | Three parallel tasks on separate files, after Batch B.                                                                                                                       |
| D     | 2.4-b → 2.4-c → 2.4-d          | Sequential: `instance.ts` is one file and the lead executor writes it. Tests and the adapter may be delegated.                                                               |
| E     | 2.5-a, then 2.5-b              | Within each, one agent per test file in parallel.                                                                                                                            |

The supervisor audits each batch before the next starts, and each approved batch is committed on its own. The assignment for a batch is written when the batch before it is approved, and is appended to this plan.

---

## 6. Rules for Every Slice

1. TypeScript strict. No `any`, enums, default exports, `@ts-ignore`, `@ts-expect-error`, or non-null assertions without a reason on the same line. Explicit return types on exports. `import type` for types. A one-line doc comment citing the ISA section on each export.
2. No React, DOM, timers, clock or randomness (CODING_STANDARDS §4.2; `pnpm lint` enforces it for `src/architectures`).
3. No module-level mutable state. Each instance owns all of its state.
4. 8-bit arithmetic is masked explicitly (`& 0xff`).
5. **Every BITSHIFT-8 value comes from the specification.** No opcode, flag rule, cycle, signal name, label or event that is not in BITSHIFT-8_ISA.md. If something seems to be missing from it, stop and report.
6. The CPU keeps no cycle counter and puts no cycle or step number in any outcome or event (DR-067, DR-083).
7. A faulting step changes nothing (DR-070). There is no `try` or `catch` in the package: the platform's instance guard contains exceptions, and a thrown exception is a programmer error.
8. Tests cite the ISA section they check and write their expected values by hand. They assert on diagnostic codes, never on message text, except that the undefined-opcode message must contain the opcode and address.
9. No dependency is added. `package.json`, `eslint.config.js`, `tsconfig.json` and `vite.config.ts` are not changed.
10. Each slice ends with `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build` passing, and with the implementation report of DEFINITION_OF_DONE §6, which states truthfully which agent did what.

---

## 7. Risks

| Risk                                                                                 | Mitigation                                                                                                                         |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| The position within an instruction is wrong after a fault, a reset, a load or a jump | The lead executor writes `instance.ts`; 2.4-c criteria 4 and 5 test each case; the conformance suite repeats them for every opcode |
| Tests and code share a misreading of the flag rules                                  | ALU tests are written by a different agent from hand-worked tables; the supervisor checks the tables against ISA §5 in the audit   |
| Events drift from the specification (order, only-on-change, the read-ahead)          | ISA §10.5 is a test event for event; EVT-04 replays every cycle of every instruction with the unchanged Phase 1 checker            |
| The micro-operation table and the behaviour diverge                                  | One table drives execution, signals and labels (DR-013); 2.4-a checks it against a hand-written copy of ISA §6                     |
| BITSHIFT-8 turns out to need a platform change                                       | Stop and report. The platform stays untouched for the whole phase (2.5-b criterion 6)                                              |
| The roadmap's Phase 2 text is older than the specification                           | See section 8. The specification governs behaviour; the roadmap's stage structure stands                                           |

---

## 8. Points Settled at the Final Review (DR-084)

1. **`bitshift-8/step` payload.** Stage, label, instruction address and instruction display name. No cycle number and no step counter.
2. **Memory range.** No CPU memory access can be out of range. The only range check is the loader's `LOAD-RANGE` rejection (ISA §1.2), which slice 2.1-b tests. The roadmap wording for Stage 2.1 was corrected.
3. **Explanations.** Authored, human-readable text in ISA §13, which slice 2.3-c implements word for word.

No point is open.

---

## 9. Slice Status

| Slice | Owner         | Status      | Verdict | Date | Follow-ups |
| ----- | ------------- | ----------- | ------- | ---- | ---------- |
| 2.1-a | Haiku         | Not started | —       | —    | —          |
| 2.1-b | Haiku         | Not started | —       | —    | —          |
| 2.2-a | Haiku         | Not started | —       | —    | —          |
| 2.2-b | Haiku         | Not started | —       | —    | —          |
| 2.3-a | Haiku         | Not started | —       | —    | —          |
| 2.3-b | Haiku         | Not started | —       | —    | —          |
| 2.3-c | Haiku         | Not started | —       | —    | —          |
| 2.4-a | Haiku         | Not started | —       | —    | —          |
| 2.4-b | Sonnet        | Not started | —       | —    | —          |
| 2.4-c | Sonnet        | Not started | —       | —    | —          |
| 2.4-d | Haiku, Sonnet | Not started | —       | —    | —          |
| 2.5-a | Haiku, Sonnet | Not started | —       | —    | —          |
| 2.5-b | Haiku, Sonnet | Not started | —       | —    | —          |

---

## Appendix A — First Implementation Assignment (Batches A and B)

Give the text below to the lead executor unchanged. Assignments for later batches are appended here when the batch before them is approved.

````markdown
# BITSHIFT — Phase 2, Batches A and B: Slices 2.1-a, then 2.1-b, 2.2-a, 2.2-b and 2.3-a

## Roles

You are **Sonnet, the sole Lead Executor**: you own implementation, integration, review of delegated work, validation and the report. Delegate each task below to a **Haiku sub-agent** (Agent tool, `model: "haiku"`). Read every file a sub-agent produces **in full** before you integrate it; correct it or send it back where it does not meet its criteria. The engineering supervisor (Fable) audits your diff independently and writes no code. The product owner accepts. If you cannot spawn sub-agents, say so and do the work yourself. Never claim delegation that did not happen.

## Preflight

`git status` is clean on branch `main`, and the latest commit is the Phase 2 documentation package. Otherwise stop and report. Do not run `git add`, `commit`, `stash`, `checkout` or `reset`.

## Read first

`CLAUDE.md`; `docs/specifications/BITSHIFT-8_ISA.md` sections 1 to 5 (this is the only source of BITSHIFT-8 values); `docs/engineering/PHASE_2_EXECUTION_PLAN.md` sections 1 to 6; `docs/engineering/CODING_STANDARDS.md`; `docs/engineering/DEFINITION_OF_DONE.md` §2, §3, §6; `src/platform/index.ts` and `src/platform/types.ts`; `src/platform/registry.ts` (what a valid descriptor is).

## Scope

Create files only under `src/architectures/bitshift-8/` and `tests/architectures/bitshift-8/`. Delete `src/architectures/bitshift-8/.gitkeep` and `tests/architectures/.gitkeep`. **Change nothing else**: no file in `src/platform`, no document, no configuration, no `package.json`. If a task cannot be completed without such a change, stop that task and report the exact conflict.

## Rules for every task

- TypeScript strict. No `any`, enums, default exports, `@ts-ignore`, `@ts-expect-error`, or non-null assertions without a reason on the same line. Explicit return types on exports. `import type` for types. A one-line doc comment citing the ISA section on each export.
- Platform types and helpers are imported from `src/platform` (its `index.ts`) and from nowhere else. Inside the package, follow the import rules of PHASE_2_EXECUTION_PLAN §3.
- No React, DOM, timers, clock or randomness. No module-level mutable state. No `try` or `catch`. 8-bit arithmetic is masked explicitly (`& 0xff`).
- **Every BITSHIFT-8 value comes from BITSHIFT-8_ISA.md.** If something seems to be missing or ambiguous there, stop that task and report. Do not choose.
- Tests cite the ISA section they check, write their expected values by hand (never from running the code), and assert on diagnostic codes, not message text. Every test has an assertion that can fail.
- No dependency is added. Format only the files you touch (`pnpm exec prettier --write <files>`).

## Batch A — Slice 2.1-a (one Haiku agent; finish it before anything else)

Files: `src/architectures/bitshift-8/machine.ts`, `tests/architectures/bitshift-8/machine.test.ts`.

```ts
export const ARCHITECTURE_ID = 'bitshift-8';
export const DISPLAY_NAME = 'BITSHIFT-8';
export const WORD_BITS = 8;
export const ADDRESS_BITS = 8;
export const MEMORY_BYTES = 256;
export type RegisterName = 'A' | 'B' | 'PC' | 'IR' | 'MAR' | 'MDR' | 'OUT';
export type FlagName = 'Z' | 'N' | 'C';
export const REGISTERS: readonly RegisterDefinition[]; // ISA §2, in that order
export const FLAGS: readonly FlagDefinition[]; // Z, N, C, in that order (ISA §2.1)
```

Flag descriptions: Z "Zero: the last value written to A was 0"; N "Negative: bit 7 of the last value written to A"; C "Carry: carry of the last ADD, or borrow of the last SUB".

Acceptance criteria (PHASE_2_EXECUTION_PLAN, slice 2.1-a):

1. The five constants have the values above.
2. `REGISTERS` has exactly seven entries with the name, bits (8), role and visibility of ISA §2, in that order. The test holds the expected table, written by hand.
3. `FLAGS` has exactly three entries, Z, N, C, with the descriptions above.
4. `REGISTERS`, `FLAGS` and each of their elements are frozen.
5. The file exports data and types only: no function.

**Gate:** `pnpm typecheck`, `pnpm lint` and `pnpm test` pass with 2.1-a in place before Batch B is delegated.

## Batch B — three parallel lines (one Haiku agent per line)

The three lines touch different files and may run at the same time. Line 2 is two slices on one file, done in order by one agent.

### Line 1 — Slice 2.1-b: machine state

Files: `src/architectures/bitshift-8/state.ts`, `tests/architectures/bitshift-8/state.test.ts`. Imports `machine.ts` and platform types.

```ts
/** The mutable state of one BITSHIFT-8 machine (ISA §1, §2). Owned by one instance. */
export interface MachineState {
  /* fields are private to this module's functions */
}
export function createState(): MachineState; // the empty machine, ISA §1.2 rule 1
export function loadProgram(state: MachineState, image: ProgramImage): Result<void, Diagnostic>; // ISA §1.2 rules 2, 3
export function resetState(state: MachineState): void; // ISA §1.2 rule 4
export function readState(state: MachineState): CpuStateCopy; // ISA §2
export function getRegister(state: MachineState, name: RegisterName): number;
export function setRegister(state: MachineState, name: RegisterName, value: number): void; // stores value & 0xff
export function getFlag(state: MachineState, name: FlagName): boolean;
export function setFlag(state: MachineState, name: FlagName, value: boolean): void;
export function readByte(state: MachineState, address: number): number; // address & 0xff
export function writeByte(state: MachineState, address: number, value: number): void; // both masked
export function increment8(value: number): number; // (value + 1) & 0xff
```

This slice does not track the position within an instruction; that belongs to slice 2.4-b.

Acceptance criteria (slice 2.1-b), each with at least one named test:

1. A new state is the empty machine: 256 zero bytes, seven registers 0, three flags false.
2. `loadProgram` rejects, leaving the state deeply unchanged (compare a state copy taken before and after): another `architectureId` → `bitshift-8/LOAD-MISMATCH`; `origin` -1, 256 or 1.5 → `bitshift-8/LOAD-RANGE`; `entry` -1, 256 or 1.5 → `bitshift-8/LOAD-RANGE`; origin 200 with 57 bytes → `bitshift-8/LOAD-RANGE`. An image with both a wrong identifier and a bad origin reports `LOAD-MISMATCH`. All have severity `error`.
3. Accepted at the boundaries: origin 0 with 256 bytes; origin 255 with 1 byte; origin 200 with 56 bytes; an empty image; entry 255.
4. An accepted load gives: memory all zero except the image bytes at `origin`; all registers 0 except PC = `entry`; all flags false. Loading a short program after a long one leaves no byte of the long one.
5. `resetState` restores the post-load state after registers, flags and memory were changed through the setters, and gives the empty machine when nothing was loaded.
6. `readState` returns `programCounter` equal to PC, the seven registers in ISA §2 order each with `bits` 8, the three flags in the order Z, N, C, and a 256-byte `memory`. Two calls share no array, element object or buffer, and changing a result changes nothing in the state (SNP-05).
7. The image passed to `loadProgram` is not mutated, and changing its `bytes` afterwards does not change the machine or what `resetState` restores.
8. `setRegister` and `writeByte` mask to 8 bits (256 stores 0; -1 stores 255). `readByte` and `writeByte` mask the address. `increment8(255)` is 0 and `increment8(7)` is 8.

### Line 2 — Slices 2.2-a then 2.2-b: the ALU

Files: `src/architectures/bitshift-8/alu.ts`, `tests/architectures/bitshift-8/alu.test.ts`. Imports nothing from the package.

```ts
export type AluOperation = 'add' | 'sub' | 'inc' | 'dec' | 'and' | 'or' | 'xor' | 'not';
/** Result of one ALU operation (ISA §3, §5, §10.2 rule 5). */
export interface AluResult {
  readonly result: number; // 0 to 255
  readonly right: number; // the right operand reported in the alu-operation event
  readonly carry?: boolean; // present only for 'add' and 'sub'
}
export function runAlu(operation: AluOperation, a: number, b: number): AluResult;
/** Z and N for a value written to A (ISA §5 rule 1). */
export function zeroNegative(value: number): { readonly zero: boolean; readonly negative: boolean };
```

`right` is `b` for `add`, `sub`, `and`, `or`, `xor`; 1 for `inc` and `dec`; 0 for `not` (ISA §10.2 rule 5). `inc`, `dec` and `not` ignore `b`.

Do 2.2-a (`add`, `sub`) first, with its tests passing, then 2.2-b (the other six and `zeroNegative`).

Acceptance criteria (slices 2.2-a and 2.2-b):

1. `add`: result (a + b) mod 256; carry true exactly when a + b > 255.
2. `sub`: result (a − b) mod 256; carry true exactly when a < b.
3. `add` and `sub` are each tested for all 25 pairs of operands from 0, 1, 127, 128, 255, with the expected result and carry of every pair written out by hand in the test file as a table.
4. The nine worked rows of ISA §5 are tests by name.
5. `inc`, `dec`, `not` at a = 0, 1, 127, 128, 255, and `and`, `or`, `xor` for all 25 pairs, with hand-written expected results.
6. The result object has a `carry` key for `add` and `sub` and no `carry` key for the other six.
7. `right` has the value prescribed above for every operation.
8. `zeroNegative` at 0, 1, 127, 128, 255: zero is true only for 0; negative is true for 128 and 255.
9. Every result is an integer from 0 to 255. The functions are pure.

### Line 3 — Slice 2.3-a: instruction table and descriptor

Files: `src/architectures/bitshift-8/isa.ts`, `src/architectures/bitshift-8/descriptor.ts`, `tests/architectures/bitshift-8/isa.test.ts`, `tests/architectures/bitshift-8/descriptor.test.ts`. `isa.ts` imports `machine.ts`; `descriptor.ts` imports `machine.ts` and `isa.ts`.

```ts
// isa.ts
export const INSTRUCTIONS: readonly InstructionDefinition[]; // the 22 rows of ISA §3, in the order of that table
export const ISA: IsaDescriptor; // architectureId 'bitshift-8', instructions = INSTRUCTIONS
/** The display name of an instruction (ISA §3 rule 3). */
export function displayName(instruction: InstructionDefinition): string;

// descriptor.ts
export const DESCRIPTOR: ArchitectureDescriptor;
```

Rows with an empty Variant column have no `variant` key. `descriptorVersion` is `'1.0.0'`.

Acceptance criteria (slice 2.3-a):

1. `INSTRUCTIONS` has exactly 22 rows. The test holds the 22 expected rows (opcode, mnemonic, variant or none, length, operand), written by hand from ISA §3, and the code equals it row for row.
2. Opcodes are unique; (mnemonic, variant) pairs are unique; there are exactly 20 distinct mnemonics; the ten opcodes 0x10, 0x11, 0x20, 0x21, 0x30, 0x31, 0x40, 0x41, 0x50 and 0xFF belong to `LDI A`, `LDI B`, `ADD B`, `SUB B`, `LDA`, `STA`, `JMP`, `JZ`, `OUT` and `HLT`.
3. `displayName` gives the 22 names of ISA §3 rule 3, checked against a hand-written list.
4. `ISA.architectureId` is `'bitshift-8'`.
5. `DESCRIPTOR` has exactly the fields of `ArchitectureDescriptor`: `displayName` `'BITSHIFT-8'`, `descriptorVersion` `'1.0.0'`, `wordBits` 8, `addressBits` 8, `memoryBytes` 256, the seven registers, the three flags, and `isa`.
6. `createArchitectureRegistry` accepts an architecture carrying `DESCRIPTOR` (use a stub whose `createInstance` throws and a trivial visualization adapter, defined in the test), and `lookup('bitshift-8')` finds it.
7. `INSTRUCTIONS`, each row, `ISA` and `DESCRIPTOR` are frozen.

## Integration and validation (you)

1. Read every delegated file in full. Record each change you make and why.
2. Check each acceptance criterion against a named test, and that expected values are hand-written and match BITSHIFT-8_ISA.md. Check the ALU tables yourself against ISA §5: a wrong table would pass silently.
3. Confirm file ownership held, and that nothing outside the two BITSHIFT-8 directories changed (`git status --short`, `git diff --stat -- src/platform` empty).
4. Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build`. All pass. The 561 existing tests still pass, none removed or weakened.

## Out of scope

`decode.ts`, `explanations.ts`, `microcode.ts`, `instance.ts`, `visualization.ts`, `index.ts`; any event; any stepping; anything in `src/platform`.

## Report

(1) Preflight. (2) Delegation: which Haiku agents actually ran, on which slice, in parallel or not; what you did yourself. (3) Per slice: files, test count, each acceptance criterion with the name of the test that covers it. (4) Every change you made to delegated work, and why. (5) Any point where the specification was missing or ambiguous (not resolved by you). (6) The actual result of each of the five commands and the total test count. (7) `git status --short` and the file list for one commit. Report anything not run as not run. Do not approve your own work.
````
