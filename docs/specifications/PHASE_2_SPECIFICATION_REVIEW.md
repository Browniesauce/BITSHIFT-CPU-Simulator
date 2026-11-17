# BITSHIFT — Phase 2 Specification and Architecture Review

**Date:** 2026-11-17, revision 2 (after independent investigation). **Author:** engineering supervisor. **For:** the product owner.
**Status:** **APPROVED by the product owner on 2026-11-17** (DR-081 to DR-083): all nine lines as recommended, P2-2 withdrawn, N1 amended so that `bitshift-8/step` carries no cycle or step number, N2 to N4 approved. This document is now the record of the proposal and its investigation. **The implementation specification is [BITSHIFT-8_ISA.md](BITSHIFT-8_ISA.md)**, which supersedes sections 1 to 11 here; where they differ (the `step` field of section 10, and the explanation texts), BITSHIFT-8_ISA.md is right. The final review is DR-084.
**Related:** [BITSHIFT-8_ISA.md](BITSHIFT-8_ISA.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) (DR-001 to DR-018, DR-023, DR-051), [DEVELOPMENT_ROADMAP.md](../engineering/DEVELOPMENT_ROADMAP.md) (Phase 2), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md) §3, [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [MVP_SCOPE.md](../product/MVP_SCOPE.md), [PHASE_1_EXECUTION_PLAN.md](../engineering/PHASE_1_EXECUTION_PLAN.md) Appendix A

**How this revision was produced.** The first revision was the supervisor's proposal. It was then investigated by a Sonnet lead with four Haiku specialists (opcodes and encoding; ALU, flags and micro-operations; datapath and control signals; events and platform fit), all read-only. Sonnet verified each claimed defect before reporting it and listed the claims it rejected. The supervisor checked every reported defect against the contracts, the product requirements and the Phase 1 code. Sections 1 to 11 are the specification **as amended**. Section 13 lists every amendment with the original text, the problem and the change, so nothing was altered silently.

The design goal is the product's: **a learner can follow every clock cycle.**

---

## 1. Architecture Overview

| Property           | Value                                                                                            | Register       |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------- |
| Data width         | 8 bits. Values are unsigned, 0 to 255. Arithmetic is modulo 256.                                 | DR-001         |
| Address width      | 8 bits                                                                                           | DR-001         |
| Memory             | 256 bytes, addresses 0x00 to 0xFF. One memory for program and data.                              | DR-001, DR-002 |
| Style              | Accumulator machine with registers A and B. Every ALU result goes to A.                          | DR-001         |
| Instruction length | 1 or 2 bytes: an opcode, then at most one operand byte                                           | DR-001         |
| Addressing         | Implied, immediate (`LDI`), and direct (`LDA`, `STA`, jumps). No indirect or indexed addressing. | DR-007         |
| Execution          | Fetch, decode, execute. One micro-operation per clock cycle.                                     | DR-053         |
| Datapath           | One shared 8-bit bus                                                                             | DR-023         |
| Status register    | None. Flags are shown individually and cannot be read or written as a byte.                      | DR-009         |
| Faults             | One: undefined opcode                                                                            | DR-016         |

**Memory semantics.** Every address is valid. A read has no side effect. A write replaces one byte. Memory changes only through a program load and the `STA` instruction (DR-029).

**Load and reset (DR-003).**

- Before any load: memory is all 0x00, every register is 0, every flag is clear.
- `loadProgram(image)` rejects an image whose `architectureId` is not `bitshift-8` with `bitshift-8/LOAD-MISMATCH`. It rejects with `bitshift-8/LOAD-RANGE` an image whose `origin` or `entry` is not an integer from 0 to 255, or for which `origin + bytes.length` exceeds 256. A rejected load changes nothing.
- An accepted load sets all memory to 0x00, copies the image bytes starting at `origin`, sets every register to 0 and every flag to clear, then sets PC to `entry`.
- `reset()` restores exactly the state after the last accepted load, or the empty machine if there was none.

## 2. Register Specification

| Name | Bits | Reset | Role (descriptor)  | Programmer-visible | Written by                                       |
| ---- | ---- | ----- | ------------------ | ------------------ | ------------------------------------------------ |
| A    | 8    | 0     | `general`          | Yes                | `LDI A`, `MOV A,B`, `LDA`, every ALU instruction |
| B    | 8    | 0     | `general`          | Yes                | `LDI B`, `MOV B,A`                               |
| PC   | 8    | entry | `program-counter`  | Yes                | Fetch (increment), jumps                         |
| IR   | 8    | 0     | `instruction`      | No                 | Fetch                                            |
| MAR  | 8    | 0     | `memory-interface` | No                 | Fetch, operand fetch, `LDA`, `STA`               |
| MDR  | 8    | 0     | `memory-interface` | No                 | Every memory read; `STA`                         |
| OUT  | 8    | 0     | `output`           | Yes                | `OUT` only                                       |

- All seven are in the descriptor, in this order, so all seven are in every snapshot and can be drawn. "Not programmer-visible" means no instruction names the register; the learner still sees it (DR-005).
- **There is no `TEMP` register.** The ALU reads A and B directly, so no micro-operation needs a scratch register.
- OUT changes are reported with `output-emitted`, never with `register-write` (DR-006).
- PC wraps: 0xFF + 1 = 0x00. A two-byte instruction at 0xFF takes its operand from 0x00 (DR-004).

## 3. Opcode and Instruction Table

Twenty mnemonics, twenty-two opcodes. The ten opcodes of the brief are unchanged. In the flag columns, "A" means "set from the new value of A" and "—" means unchanged.

| Opcode | Mnemonic | Variant | Bytes | Operand     | Effect                      | Z, N | C      |
| ------ | -------- | ------- | ----- | ----------- | --------------------------- | ---- | ------ |
| 0x01   | NOP      |         | 1     | `none`      | Nothing                     | —    | —      |
| 0x10   | LDI      | `A`     | 2     | `immediate` | A ← imm                     | A    | —      |
| 0x11   | LDI      | `B`     | 2     | `immediate` | B ← imm                     | —    | —      |
| 0x12   | MOV      | `A,B`   | 1     | `none`      | A ← B                       | A    | —      |
| 0x13   | MOV      | `B,A`   | 1     | `none`      | B ← A                       | —    | —      |
| 0x20   | ADD      | `B`     | 1     | `none`      | A ← (A + B) mod 256         | A    | Carry  |
| 0x21   | SUB      | `B`     | 1     | `none`      | A ← (A − B) mod 256         | A    | Borrow |
| 0x22   | INC      | `A`     | 1     | `none`      | A ← (A + 1) mod 256         | A    | —      |
| 0x23   | DEC      | `A`     | 1     | `none`      | A ← (A − 1) mod 256         | A    | —      |
| 0x24   | AND      | `B`     | 1     | `none`      | A ← A AND B                 | A    | —      |
| 0x25   | OR       | `B`     | 1     | `none`      | A ← A OR B                  | A    | —      |
| 0x26   | XOR      | `B`     | 1     | `none`      | A ← A XOR B                 | A    | —      |
| 0x27   | NOT      | `A`     | 1     | `none`      | A ← bitwise complement of A | A    | —      |
| 0x30   | LDA      |         | 2     | `address`   | A ← M[addr]                 | A    | —      |
| 0x31   | STA      |         | 2     | `address`   | M[addr] ← A                 | —    | —      |
| 0x40   | JMP      |         | 2     | `address`   | PC ← addr                   | —    | —      |
| 0x41   | JZ       |         | 2     | `address`   | If Z = 1 then PC ← addr     | —    | —      |
| 0x42   | JNZ      |         | 2     | `address`   | If Z = 0 then PC ← addr     | —    | —      |
| 0x43   | JC       |         | 2     | `address`   | If C = 1 then PC ← addr     | —    | —      |
| 0x44   | JN       |         | 2     | `address`   | If N = 1 then PC ← addr     | —    | —      |
| 0x50   | OUT      |         | 1     | `none`      | OUT ← A                     | —    | —      |
| 0xFF   | HLT      |         | 1     | `none`      | Stop                        | —    | —      |

- **Every other opcode, 234 in all, is reserved and faults when executed** (DR-017). This includes **0x00**: empty memory is zeros, so a program that runs off its end stops at once with a clear fault instead of sliding through no-ops and wrapping round.
- `INC`, `DEC` and `NOT` work on A only; logic operations take B only; `LDA` loads A (DR-012). There is no `LDB`, `STB`, `CMP`, immediate logic form or indexed addressing. Known cost: copying an array needs either unrolled code or a loop that rewrites its own operand bytes.
- Jumps are absolute (DR-007). `LDI A` and `LDI B` are separate opcodes (DR-010).
- **Display name.** Wherever one string names an instruction (the `mnemonic` field of `instruction-start` and `instruction-end`, and so the timeline), it is the mnemonic, then a space and the variant if there is one: `LDI A`, `MOV A,B`, `ADD B`, `LDA`, `HLT`.

## 4. Instruction Encoding Formats

```
1-byte instruction:  [ opcode ]
2-byte instruction:  [ opcode ] [ operand ]
```

| Operand kind | Meaning of the second byte             | Used by                                      |
| ------------ | -------------------------------------- | -------------------------------------------- |
| `none`       | No second byte                         | All 1-byte instructions                      |
| `immediate`  | The 8-bit value itself                 | `LDI A`, `LDI B`                             |
| `address`    | An 8-bit memory address, used directly | `LDA`, `STA`, `JMP`, `JZ`, `JNZ`, `JC`, `JN` |

The descriptor's `operand` value `'register'` is not used: registers are named by the variant, not by an operand byte. Opcodes fit in `wordBits` (8), are unique, and every (mnemonic, variant) pair is unique, so the descriptor passes every registry rule.

## 5. Flag Semantics (DR-008)

Three rules, and nothing else changes any flag:

1. **Z and N describe the value last written to A.** Z = 1 when that value is 0. N = bit 7 of that value. They are loaded by `LDI A`, `MOV A,B`, `LDA` and the eight ALU instructions.
2. **C is loaded by `ADD` with the carry out of bit 7, and by `SUB` with the borrow** (1 when A < B as unsigned numbers, otherwise 0). Both always load it, so a later `ADD` that does not carry clears a C left by an earlier one.
3. Instructions that write only B (`LDI B`, `MOV B,A`), and `STA`, `OUT`, the jumps, `NOP` and `HLT`, leave all flags unchanged.

There is no overflow flag. Signed overflow is not tracked, so `JN` after arithmetic on large values is not a reliable signed comparison; the learner text says so.

Worked values:

| Before           | Instruction | A after | Z   | N   | C         |
| ---------------- | ----------- | ------- | --- | --- | --------- |
| A = 255, B = 1   | `ADD B`     | 0       | 1   | 0   | 1         |
| A = 127, B = 1   | `ADD B`     | 128     | 0   | 1   | 0         |
| A = 0, B = 1     | `SUB B`     | 255     | 0   | 1   | 1         |
| A = 128, B = 128 | `SUB B`     | 0       | 1   | 0   | 0         |
| A = 255          | `INC A`     | 0       | 1   | 0   | unchanged |
| A = 0            | `DEC A`     | 255     | 0   | 1   | unchanged |
| A = 0            | `NOT A`     | 255     | 0   | 1   | unchanged |

After `SUB B`, `JC` reads as "jump if A was less than B" and `JZ` as "jump if they were equal". This is the borrow sense used by the 8080 and Z80 families; the 6502 and ARM use the opposite sense.

## 6. Micro-Operation Sequences

**One micro-operation per clock cycle:** one register transfer, one memory access, one ALU operation with its result latch, or one PC action. Loading flags is part of the micro-operation that produced the value.

### 6.1 Fetch and decode — the same four cycles for every instruction

| Cycle | Stage  | Micro-operation | Control signals    |
| ----- | ------ | --------------- | ------------------ |
| T1    | fetch  | MAR ← PC        | `pc-out`, `mar-in` |
| T2    | fetch  | MDR ← M[MAR]    | `mem-read`         |
| T3    | fetch  | IR ← MDR        | `mdr-out`, `ir-in` |
| T4    | decode | PC ← PC + 1     | `pc-inc`           |

**Undefined opcode.** T1 to T3 complete normally, so IR holds the opcode. The step that would be T4 finds that IR is not an allocated opcode and returns the fault instead: it completes no cycle, emits no event and changes nothing. The machine is then `faulted` with IR holding the offending byte and **PC still addressing it**. The three completed cycles stay committed (DR-074).

### 6.2 Execute

| Instruction                                      | Cycle | Micro-operation   | Control signals                                   |
| ------------------------------------------------ | ----- | ----------------- | ------------------------------------------------- |
| `NOP`                                            | —     | (none)            | —                                                 |
| `MOV A,B`                                        | T5    | A ← B             | `b-out`, `a-in`, `flags-in`                       |
| `MOV B,A`                                        | T5    | B ← A             | `a-out`, `b-in`                                   |
| `ADD`, `SUB`, `AND`, `OR`, `XOR`                 | T5    | A ← A op B        | `alu-out`, `a-in`, `flags-in`                     |
| `INC`, `DEC`, `NOT`                              | T5    | A ← op A          | `alu-out`, `a-in`, `flags-in`                     |
| `OUT`                                            | T5    | OUT ← A           | `a-out`, `out-in`                                 |
| `HLT`                                            | T5    | halt              | `halt`                                            |
| `LDI A`, `LDI B`                                 | T5    | MAR ← PC          | `pc-out`, `mar-in`                                |
|                                                  | T6    | MDR ← M[MAR]      | `mem-read`                                        |
|                                                  | T7    | PC ← PC + 1       | `pc-inc`                                          |
|                                                  | T8    | A ← MDR / B ← MDR | `mdr-out`, `a-in`, `flags-in` / `mdr-out`, `b-in` |
| `LDA`                                            | T5–T7 | as `LDI` T5–T7    |                                                   |
|                                                  | T8    | MAR ← MDR         | `mdr-out`, `mar-in`                               |
|                                                  | T9    | MDR ← M[MAR]      | `mem-read`                                        |
|                                                  | T10   | A ← MDR           | `mdr-out`, `a-in`, `flags-in`                     |
| `STA`                                            | T5–T7 | as `LDI` T5–T7    |                                                   |
|                                                  | T8    | MAR ← MDR         | `mdr-out`, `mar-in`                               |
|                                                  | T9    | MDR ← A           | `a-out`, `mdr-in`                                 |
|                                                  | T10   | M[MAR] ← MDR      | `mem-write`                                       |
| `JMP`; a conditional jump whose condition holds  | T5    | MAR ← PC          | `pc-out`, `mar-in`                                |
|                                                  | T6    | MDR ← M[MAR]      | `mem-read`                                        |
|                                                  | T7    | PC ← MDR          | `mdr-out`, `pc-in`                                |
| A conditional jump whose condition does not hold | T5    | PC ← PC + 1       | `pc-inc`                                          |

**Conditional jumps** test the flag at the start of T5 and then follow one of two sequences. Flags cannot change between T1 and T5 of a jump, so the choice is fixed for the whole instruction.

## 7. Cycle Counts

| Instruction                                                                               | Cycles |
| ----------------------------------------------------------------------------------------- | ------ |
| `NOP`                                                                                     | 4      |
| `MOV A,B`, `MOV B,A`, `ADD`, `SUB`, `INC`, `DEC`, `AND`, `OR`, `XOR`, `NOT`, `OUT`, `HLT` | 5      |
| `JZ`, `JNZ`, `JC`, `JN` when the condition does not hold                                  | 5      |
| `JMP`; `JZ`, `JNZ`, `JC`, `JN` when the condition holds                                   | 7      |
| `LDI A`, `LDI B`                                                                          | 8      |
| `LDA`, `STA`                                                                              | 10     |

The last cycle of each instruction is its instruction boundary (`instructionCompleted` is true). `HLT`'s T5 also reports `halted`. No instruction takes more than 10 cycles; this is the bound for conformance test CNF-05. Cycle counts that depend on a flag are deliberate: the alternative would show the learner cycles in which nothing happens.

The four-cycle fetch was kept after challenge. A three-cycle fetch needs either memory loading IR directly, which hides MDR, or two transfers in one cycle, which breaks the one-micro-operation rule and would move the fault to after PC has advanced.

## 8. Datapath

**One shared 8-bit bus, named `bus`** (DR-023). Exactly one source may drive it in a cycle.

| Component | Can drive the bus | Can latch from the bus                  | Other connections                                                   |
| --------- | ----------------- | --------------------------------------- | ------------------------------------------------------------------- |
| PC        | Yes (`pc-out`)    | Yes (`pc-in`)                           | Its own incrementer (`pc-inc`), not through the bus                 |
| MAR       | No                | Yes (`mar-in`)                          | Drives the memory address                                           |
| MDR       | Yes (`mdr-out`)   | Yes (`mdr-in`)                          | Loaded from memory by `mem-read`; drives memory data in `mem-write` |
| IR        | No                | Yes (`ir-in`)                           | Feeds the decoder                                                   |
| A         | Yes (`a-out`)     | Yes (`a-in`)                            | Wired directly to the ALU's left input                              |
| B         | Yes (`b-out`)     | Yes (`b-in`)                            | Wired directly to the ALU's right input                             |
| ALU       | Yes (`alu-out`)   | No                                      | Inputs come from A and B directly, never from the bus               |
| OUT       | No                | Yes (`out-in`)                          | Shown in the output panel                                           |
| Memory    | No                | No                                      | Addressed by MAR; exchanges data only with MDR                      |
| Flags     | No                | Z and N from the bus value (`flags-in`) | C from the ALU's carry or borrow, in `ADD` and `SUB` only           |

Transfers between registers, the ALU and MDR use the bus. Memory reads into MDR, memory writes from MDR, and the PC increment do not. Because the ALU reads A and B directly and A latches at the end of the cycle, "A ← A op B" is one cycle with no scratch register.

## 9. Control Signals (DR-051)

Seventeen named signals. No gate-level detail.

| Signal     | Meaning                          | Signal      | Meaning                                                                           |
| ---------- | -------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `pc-out`   | PC drives the bus                | `pc-in`     | PC latches the bus (jumps)                                                        |
| `pc-inc`   | PC ← PC + 1                      | `mar-in`    | MAR latches the bus                                                               |
| `mem-read` | Memory at MAR is loaded into MDR | `mem-write` | MDR is written to memory at MAR                                                   |
| `mdr-out`  | MDR drives the bus               | `mdr-in`    | MDR latches the bus                                                               |
| `ir-in`    | IR latches the bus               | `a-out`     | A drives the bus                                                                  |
| `a-in`     | A latches the bus                | `b-out`     | B drives the bus                                                                  |
| `b-in`     | B latches the bus                | `alu-out`   | The ALU result drives the bus                                                     |
| `out-in`   | OUT latches the bus              | `flags-in`  | Z and N latch from the bus value; in `ADD` and `SUB`, C also latches from the ALU |
| `halt`     | The halt condition is set        |             |                                                                                   |

Rules that hold in every cycle: at most one of `pc-out`, `mdr-out`, `a-out`, `b-out`, `alu-out`; never `mem-read` with `mdr-in`; never `mem-read` with `mem-write`; never `pc-in` with `pc-inc`. Every signal is used by at least one instruction. Which ALU operation runs is carried by the `alu-operation` event, not by a signal per operation.

## 10. Event-Generation Rules

Each completed cycle emits its events with `cycleOffset` 1, in this order:

1. `instruction-start { address, mnemonic }` — only in T1.
2. `bitshift-8/step { address, mnemonic, stage, step, label }` — every cycle.
3. `micro-operation { controlSignals }` — every cycle.
4. `memory-read { address, value }` — in a `mem-read` cycle.
5. `alu-operation { operation, left, right, result }` — in an ALU cycle.
6. `bus-transfer { bus: 'bus', value }` — in a cycle that uses the bus.
7. `memory-write { address, before, after }` — in the `mem-write` cycle, if the byte changes.
8. `register-write { register, before, after }` — for a register (not OUT) whose value changes.
9. `output-emitted { before, after }` — if OUT's value changes.
10. `flag-update { flag, before, after }` — for each flag whose value changes, in the order Z, N, C.
11. `halted { address }` — only in `HLT`'s T5; the address of the `HLT` instruction.
12. `instruction-end { address, mnemonic, nextAddress }` — only in the last cycle; always the last event.

Rules:

- **State-changing events are emitted only when the value changes**, as EVENT_MODEL §3.2 already says. A transfer that leaves a value unchanged is still visible through its `micro-operation` signals and its `bus-transfer`. This keeps highlighting on real changes (MVP-017, AC-017-1) and keeps no-op entries out of the timeline (MVP-021, MVP-022).
- **`instruction-start` and the read-ahead.** In T1 the simulator looks up the byte at PC in its instruction table to obtain the display name. This is labelling done by the simulator, not a CPU memory read: it emits no `memory-read`, drives no signal and changes no state. The byte cannot differ from the one T2 reads, because no write can happen in between. For an undefined opcode the name is `?`.
- **`bitshift-8/step`** is the one architecture-specific event kind (DR-014). `stage` is `'fetch'`, `'decode'` or `'execute'` per section 6. `step` is the cycle number within the instruction, 1 to 10. `label` is the micro-operation text exactly as written in section 6, for example `MAR ← PC`. `address` and `mnemonic` repeat those of the current instruction, so a view that receives only the latest cycle can show "what is happening now" (MVP-020). It is informational and never changes state.
- `alu-operation.operation` is one of `add`, `sub`, `inc`, `dec`, `and`, `or`, `xor`, `not`. `left` is A before the operation. `right` is B for the two-operand operations, 1 for `inc` and `dec`, and 0 for `not`, where it is not used.
- `mnemonic` is the display name of section 3.
- A faulting step emits nothing; the platform emits the `fault` event.
- BITSHIFT-8 uses no snapshot `details`.

**Example: `ADD B` at address 0x04 with A = 3, B = 4, PC = 4, all flags clear, MAR = 2, MDR and IR holding earlier values.**

| Cycle | Events                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1    | `instruction-start {4, 'ADD B'}`; `step {fetch, 1, 'MAR ← PC'}`; `micro-operation [pc-out, mar-in]`; `bus-transfer 4`; `register-write MAR 2→4`                                            |
| T2    | `step {fetch, 2}`; `micro-operation [mem-read]`; `memory-read {4, 0x20}`; `register-write MDR →0x20`                                                                                       |
| T3    | `step {fetch, 3}`; `micro-operation [mdr-out, ir-in]`; `bus-transfer 0x20`; `register-write IR →0x20`                                                                                      |
| T4    | `step {decode, 4}`; `micro-operation [pc-inc]`; `register-write PC 4→5`                                                                                                                    |
| T5    | `step {execute, 5, 'A ← A + B'}`; `micro-operation [alu-out, a-in, flags-in]`; `alu-operation {add, 3, 4, 7}`; `bus-transfer 7`; `register-write A 3→7`; `instruction-end {4, 'ADD B', 5}` |

No `flag-update` appears: Z, N and C were clear and stay clear.

## 11. Minimal Visualization Adapter

`CpuArchitecture.visualization` is required by the contract, and the real datapath view is Phase 4. Phase 2 ships the smallest adapter that is **correct**: every field comes from the snapshot or from an event, and nothing is invented.

`toDatapath(snapshot, recentEvents)` uses only the events whose `cycle` equals `snapshot.cycle`, and returns:

| Field                  | Value                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architectureId`       | `snapshot.architectureId`                                                                                                                                 |
| `components`           | Nine, in this order: `pc`, `ir`, `mar`, `mdr`, `a`, `b`, `out`, `alu`, `memory`                                                                           |
| Register components    | `label` is the register name; `value` from `snapshot.registers`; `active` when a `register-write` for it (or `output-emitted`, for `out`) is in the cycle |
| `alu`                  | `label` `ALU`; `value` is the `result` of the cycle's `alu-operation`, absent otherwise; `active` when there is one                                       |
| `memory`               | `label` `Memory`; no `value`; `active` when the cycle has a `memory-read` or `memory-write`                                                               |
| `buses`                | One: `{ id: 'bus', active, value }` from the cycle's `bus-transfer`; inactive with no value otherwise                                                     |
| `activeControlSignals` | The `controlSignals` of the cycle's `micro-operation`, or empty                                                                                           |
| `activeOperation`      | The `label` of the cycle's `bitshift-8/step`, or absent                                                                                                   |

It is a pure function, defines no layout, positions or animation, and holds no state. With no events for the cycle (after a load or reset) every component is inactive. Phase 4 replaces what is drawn, not this data.

---

## 12. The Nine Approval Decisions

The lines are those of the first revision, in the same order. "As amended" means the wording in sections 1 to 11, which includes the amendments of section 13.

| #   | Decision as originally proposed                                                   | Recommended answer                                                                                | Register                       |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Machine characteristics, unified memory, reset state, no status register          | **Approve**, with the load rules stated in section 1 (amendment A9)                               | DR-001, DR-002, DR-003, DR-009 |
| 2   | Registers, visibility, OUT, removal of TEMP                                       | **Approve as written** (section 2)                                                                | DR-005, DR-006                 |
| 3   | The 22-opcode instruction set, with 0x00 undefined and NOP at 0x01                | **Approve**, with the display-name rule (A9) and two flag cells changed (A5)                      | DR-007, DR-010, DR-012, DR-017 |
| 4   | Flag rules, including "only ADD and SUB change C" and borrow sense for SUB        | **Approve as amended**: Z and N follow A only (A5); C is always loaded by ADD and SUB (A4)        | DR-008                         |
| 5   | PC wrap, HLT, the undefined-opcode fault raised before PC increments, load errors | **Approve as amended**: the fault is raised by the step that would be T4 (A1)                     | DR-004, DR-016, DR-018         |
| 6   | Cycle counts and micro-operation sequences, including 7 and 5 cycles for jumps    | **Approve as amended**: counts unchanged; wording and event order corrected (A1, A6, A7, A8)      | DR-011                         |
| 7   | One shared bus and the control-signal names                                       | **Approve as amended**: the same 17 signals; `flags-in` and the bus rule defined exactly (A4, A6) | DR-023, DR-051                 |
| 8   | Micro-operations as a typed data table                                            | **Approve as amended**: a conditional jump has two sequences (A7)                                 | DR-013 (internal part)         |
| 9   | The four contract points P2-1 to P2-4                                             | **P2-1 approve. P2-2 withdrawn. P2-3 approve as section 11. P2-4 approve** (below)                | New; registered on approval    |

### 12.1 Detail for each line

**Line 1 — machine.** _Draft:_ the ISA marks all of this [B] and DR-002, DR-003 open. _Reasoning:_ one memory lets the learner see that instructions are bytes like any other, and is what makes the 0x00 fault useful. _Consequence:_ one 256-byte array; `loadProgram` and `reset` exactly as section 1. _Depends on:_ nothing.

**Line 2 — registers.** _Draft:_ eight registers including TEMP; IR and OUT open. _Reasoning:_ each of the seven is written by at least one micro-operation and shown changing; TEMP never is. The investigation asked whether MDR or B could be dropped: dropping MDR hides the memory interface the brief lists, and dropping B contradicts the brief's `LDI B` and `ADD B`. _Consequence:_ seven `RegisterDefinition`s. _Depends on:_ line 6 (the sequences prove TEMP is unused).

**Line 3 — instruction set.** _Draft:_ ten opcodes, eleven mnemonics unassigned. _Reasoning:_ the twenty mnemonics are the brief's; the investigation wrote a counted loop, a sum, a comparison and a memory copy in this set, and all work. The memory copy is awkward without indexed addressing, which is outside the brief. _Consequence:_ a 22-row table from which the descriptor, the decoder and the tests are built. _Depends on:_ line 4 for the flag columns.

**Line 4 — flags.** _Draft:_ Z and N on loads; C on ADD and SUB with the borrow rule open; logic operations clear C. _Reasoning:_ section 5's three rules can be said in two sentences. _Example:_ `LDI A,0; LDI B,5; JZ skip` — under the original wording `LDI B` cleared Z and the jump was not taken although A is 0; under the amended rule it is taken. _Consequence:_ one flag routine used by eleven instructions; C handled in two. _Depends on:_ line 7 (`flags-in`).

**Line 5 — PC, halt, fault.** _Draft:_ fault on undefined opcode proposed; HLT leaves PC after HLT. _Reasoning:_ the fault must not undo anything (DR-070) and should leave the evidence on screen. _Trace:_ memory[0] = 0x00, PC = 0. Three clock steps complete: MAR = 0, MDR = 0x00, IR = 0x00, counter = 3. The fourth step returns the fault: counter stays 3, PC stays 0, state `faulted`, one platform `fault` event at cycle 3. _Consequence:_ the instance keeps its position within the instruction between steps, and `reset` clears it. _Depends on:_ line 6.

**Line 6 — cycles.** _Draft:_ timing undefined (DR-011). _Reasoning:_ the investigation re-derived every sequence from the datapath and confirmed 4, 5, 7, 8 and 10; `STA` cannot be shorter because MAR ← MDR and MDR ← A are two bus transfers. _Consequence:_ sections 6 and 7 are the conformance table. _Depends on:_ lines 2 and 7.

**Line 7 — bus and signals.** _Draft:_ DR-023 and DR-051 open, scheduled for later phases. _Reasoning:_ the CPU cannot emit `bus-transfer` or `controlSignals` without them, so they are decided here. No cycle has two bus drivers, and all 17 signals are used. Requests for extra signals (ALU select, carry enable) were rejected as gate-level detail. _Consequence:_ signal names are data in the micro-operation table. _Depends on:_ line 6.

**Line 8 — representation.** _Draft:_ DR-013's internal part open. _Reasoning:_ one table drives execution, events and tests, so they cannot drift apart. _Consequence:_ the table has one sequence per opcode, and two for each conditional jump. _Depends on:_ lines 6 and 7.

**Line 9 — contract points.**

- **P2-1 (read-ahead for the timeline label): approve.** Stated in section 10. Alternatives rejected: emitting `instruction-start` at T3 makes `startCycle` 3 and drops the fetch from the record; a placeholder name would appear in the timeline.
- **P2-2 (emit `register-write` on every write): withdrawn.** The original proposal contradicted EVENT_MODEL §3.2 and AC-017-1, and would have put no-op entries in every timeline record. EVENT_MODEL stays as it is.
- **P2-3 (minimal adapter): approve as section 11.**
- **P2-4 (`details`): approve.** BITSHIFT-8 uses none; `CpuStateCopy`'s default type allows it. DR-078 c stays deferred until an architecture needs typed details.

### 12.2 Additional decisions needed

These arose from the investigation and are not covered by the nine lines.

| #   | Decision                                                                                                                                                | Recommendation                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | BITSHIFT-8 defines one architecture-specific event kind, `bitshift-8/step` (section 10)                                                                 | **Approve.** MVP-020 requires the stage and a micro-operation label after every step, and no shared event carries them. Uses the approved DR-014 mechanism; no shared contract changes. |
| N2  | Which cycles are shown as fetch, decode and execute                                                                                                     | **T1–T3 fetch, T4 decode, T5 onward execute.** The opcode is in IR during T4, and the undefined-opcode fault is then literally a decode fault.                                          |
| N3  | Whether the output panel needs a log of every `OUT`, including repeated values                                                                          | **No.** OUT is a register; a repeated value is not a change. A log would need an EVENT_MODEL amendment.                                                                                 |
| N4  | Three architecture diagnostic codes are added to DATA_CONTRACTS §11: `bitshift-8/UNDEFINED-OPCODE`, `bitshift-8/LOAD-MISMATCH`, `bitshift-8/LOAD-RANGE` | **Approve.** Codes must be listed before they are used.                                                                                                                                 |

## 13. Inconsistencies Found and Their Resolutions

Every difference between the first revision and sections 1 to 11.

| ID  | Original text                                                                                              | Problem                                                                                                                                                               | Resolution                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A1  | "T3: IR ← MDR … An undefined opcode faults here, before T4."                                               | Read literally, T3 itself faults. A faulting step may change nothing (DR-070), so IR would not hold the opcode, contradicting "IR holding it".                        | The fault is returned by the step that would be T4. T1–T3 stay committed (section 6.1).                                 |
| A2  | "BITSHIFT-8 defines no architecture-specific event kinds."                                                 | MVP-020 needs the stage and a micro-operation label. Signals cannot identify the stage (`pc-out, mar-in` is both T1 and T5), and decode had no cycle.                 | One namespaced kind, `bitshift-8/step`; T4 is the decode stage (N1, N2).                                                |
| A3  | P2-2: "`register-write` is emitted for every write, also when the new value equals the old one."           | Contradicts EVENT_MODEL §3.2 and AC-017-1, and fills timeline records with no-op changes: `ADD B` would list eight changes, four of them unchanged values.            | Withdrawn. State-changing events only on change; unchanged transfers remain visible through signals and `bus-transfer`. |
| A4  | "C: set by ADD when the sum exceeds 255"; "`flags-in`: Z and N (and C for ADD, SUB) latch."                | Did not say whether a non-carrying ADD clears C, nor where Z, N and C come from. Two implementations could both claim conformance.                                    | C is always loaded with the carry or borrow, 1 or 0. Z and N latch from the bus value; C from the ALU (sections 5, 9).  |
| A5  | "Z and N are set … by every instruction that writes A or B."                                               | A learner trap: loading B changes the flags a following `JZ` tests, yet no instruction can test B. The flags on B-writes are never useful.                            | Z and N describe the last value written to A. `LDI B` and `MOV B,A` leave flags unchanged and carry no `flags-in`.      |
| A6  | "Every transfer puts one source on the bus"; "exactly one register transfer, memory access or ALU action." | Memory reads, memory writes and the PC increment do not use the bus, and an ALU cycle is an operation plus a latch plus flags.                                        | Reworded in sections 6 and 8. Mutual-exclusion rules for signals added (section 9).                                     |
| A7  | "One data table gives, for each opcode, its list of micro-operations."                                     | A conditional jump's T5 differs with the flag, so one list cannot describe it.                                                                                        | Two sequences per conditional jump, chosen at the start of T5 (section 6.2).                                            |
| A8  | Event order "`bus-transfer`, … `alu-operation`"; "`halted` follows `instruction-end`."                     | The bus value of an ALU cycle was listed before the operation that computes it; and `instruction-end` was said to be both last and followed by `halted`.              | The order of section 10. `halted` comes before `instruction-end`, which is always last.                                 |
| A9  | (Not stated.)                                                                                              | The display name for an instruction with a variant, the `LOAD-RANGE` condition, zero-filling on load, the `halted` address and the unused ALU operand were undefined. | Defined in sections 1, 3 and 10. The three codes go to DATA_CONTRACTS §11 (N4).                                         |

**Confirmed without change:** the 22 opcodes and their uniqueness; the ten opcodes of the brief; all cycle counts; the removal of TEMP; the single bus with no cycle needing two drivers; all 17 signals in use; no need for `details`.

**Claims from the investigation that were rejected:** that the count of reserved opcodes was wrong (256 − 22 is 234, and 0x00 is among them); that `INC` would set C (it assumed hardware the proposal does not describe; the real gap is A4); that ALU-select and carry-enable signals are missing (gate-level detail, excluded by DR-051).

## 14. Phase 2 Implementation Dependencies

Before any Phase 2 code:

1. The product owner approves section 12 (nine lines and N1 to N4).
2. The register is updated: DR-001 to DR-012, DR-013, DR-016, DR-017, DR-018, DR-023 and DR-051 closed, and the new items recorded.
3. BITSHIFT-8_ISA.md is rewritten from sections 1 to 10, every item marked approved.
4. DATA_CONTRACTS §11 lists the three codes; TEST_STRATEGY §5.12 gains the BITSHIFT-8 conformance detail.
5. The Phase 2 execution plan is written, with acceptance criteria per slice.

Phase 2 does **not** depend on: the assembler (tests load programs as bytes); the composition root; the SVG layout; DR-024, DR-031 or the Dev Container check, which stay open from Phase 1; DR-078 c.

Phase 2 reuses from Phase 1, unchanged: the platform, the replay checker, the determinism and invariant suites, and the benchmark harness. If BITSHIFT-8 needs a platform change, the design has failed and that is reported before anything is changed.

**Highest-risk points for implementation:**

1. **Position within the instruction.** The instance must remember which cycle comes next between `stepClock` calls, return the decode fault from the right step without changing anything, pick the jump sequence at T5, and clear its position on `reset` and load.
2. **Flags and the ALU.** Tests and code must both come from section 5, at the values 0, 1, 127, 128 and 255, including the always-loaded C.
3. **Events exactly as section 10.** Emitting only on change, in the fixed order, with the read-ahead label, so that the replay invariant, the timeline and MVP-020 all hold from the same events.

## 15. Recommended Phase 2 Stage and Slice Structure

The five roadmap stages stand. Thirteen slices; each gets acceptance criteria in the Phase 2 execution plan after approval. All code is in `src/architectures/bitshift-8/`, with tests in `tests/architectures/bitshift-8/`.

| Stage                                  | Slice | Content                                                                                                                                                                              |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 Registers, flags and memory        | 2.1-a | Descriptor: seven registers, three flags, sizes. Accepted by the registry.                                                                                                           |
|                                        | 2.1-b | State, `loadProgram` with both rejections, `reset`, `readState`, PC wrap helper                                                                                                      |
| 2.2 ALU                                | 2.2-a | `add` and `sub` with carry and borrow                                                                                                                                                |
|                                        | 2.2-b | `inc`, `dec`, `and`, `or`, `xor`, `not`; the Z and N rule                                                                                                                            |
| 2.3 Instruction set and decoding       | 2.3-a | The 22-row instruction table and the ISA descriptor                                                                                                                                  |
|                                        | 2.3-b | Decode: all 22 opcodes, and the fault for all 234 reserved ones                                                                                                                      |
|                                        | 2.3-c | One explanation per instruction (DR-045); removing them changes no execution result                                                                                                  |
| 2.4 Micro-operations and sequencing    | 2.4-a | The micro-operation table, checked row by row against sections 6 and 9                                                                                                               |
|                                        | 2.4-b | The executor and `stepClock`: fetch, the one-cycle instructions, events per section 10                                                                                               |
|                                        | 2.4-c | Operand fetch, `LDA`, `STA`, jumps, `HLT`, the decode fault                                                                                                                          |
|                                        | 2.4-d | The visualization adapter of section 11 and the public `index.ts`                                                                                                                    |
| 2.5 Conformance and reference programs | 2.5-a | Per-instruction conformance (CNF-01 to CNF-05), each test citing this specification                                                                                                  |
|                                        | 2.5-b | BITSHIFT-8 under the platform: replay on every cycle of every instruction (EVT-04), determinism, breakpoints, history, and small multi-instruction programs with hand-worked results |

Stages 2.1, 2.2 and 2.3 are independent of each other and can run in parallel. 2.4 needs all three. 2.5 needs 2.4.

## 16. Still Open From Phase 1

Unchanged by this document, and recorded in PHASE_1_EXECUTION_PLAN Appendix A:

1. The Node 24 Dev Container check is pending with the product owner.
2. DR-031 (performance target and reference machine) is deferred.
3. DR-024 (history default capacity) is open.
4. The catalogue rows and the technical debt keep the status documented there. The SNP-03 wording change in TEST_STRATEGY is still a proposal awaiting acknowledgement.
