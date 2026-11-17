# BITSHIFT-8 — Instruction Set and Architecture

**Status:** **APPROVED** by the product owner on 2026-11-17, including the final review (decision register DR-001 to DR-018, DR-023, DR-051, DR-081 to DR-084). Phase 2 implementation is authorised from this document. It is the specification that Phase 2 implements and that the conformance suite cites. A change to it is a register decision first.
**Supersedes:** the Phase 0 draft, preserved unchanged as [BITSHIFT-8_ISA_DRAFT_PHASE0.md](BITSHIFT-8_ISA_DRAFT_PHASE0.md).
**Derivation:** [PHASE_2_SPECIFICATION_REVIEW.md](PHASE_2_SPECIFICATION_REVIEW.md) revision 2, sections 1 to 11, with the product owner's amendment to the `bitshift-8/step` event (section 10.3).
**Related:** [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md), [EVENT_MODEL.md](../contracts/EVENT_MODEL.md), [DATA_CONTRACTS.md](../contracts/DATA_CONTRACTS.md), [MODULE_CONTRACTS.md](../contracts/MODULE_CONTRACTS.md) §3, [PHASE_2_EXECUTION_PLAN.md](../engineering/PHASE_2_EXECUTION_PLAN.md)

Notation: `←` is a transfer, `M[x]` is the memory byte at address `x`, numbers with `0x` are hexadecimal, all others decimal. "Changes" always means "the new value differs from the old value".

---

## 1. Machine

| Property           | Value                                                                                            | Decision       |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------- |
| Identifier         | `bitshift-8`                                                                                     | DR-069         |
| Display name       | `BITSHIFT-8`                                                                                     | —              |
| Data width         | 8 bits. Values are unsigned, 0 to 255. Arithmetic is modulo 256.                                 | DR-001         |
| Address width      | 8 bits                                                                                           | DR-001         |
| Memory             | 256 bytes, addresses 0x00 to 0xFF. One memory for program and data.                              | DR-001, DR-002 |
| Style              | Accumulator machine with registers A and B. Every ALU result goes to A.                          | DR-001         |
| Instruction length | 1 or 2 bytes: an opcode, then at most one operand byte                                           | DR-001         |
| Addressing         | Implied, immediate (`LDI`), and direct (`LDA`, `STA`, jumps). No indirect or indexed addressing. | DR-007         |
| Execution          | Fetch, decode, execute. One micro-operation per clock cycle.                                     | DR-053         |
| Datapath           | One shared 8-bit bus                                                                             | DR-023         |
| Status register    | None. Flags cannot be read or written as a byte.                                                 | DR-009         |
| Faults             | One: undefined opcode                                                                            | DR-016         |

### 1.1 Memory

Addresses are 8 bits, so every address the CPU can produce is valid: no CPU memory access can be out of range, and there is no memory-range fault. A read has no side effect. A write replaces one byte. Memory changes only through a program load and the `STA` instruction. The only range check is made by the program loader (section 1.2).

### 1.2 Load and reset (DR-003)

1. **Empty machine** (before any load): memory is all 0x00, every register is 0, every flag is 0.
2. **`loadProgram(image)` rejects**, changing nothing:
   - with `bitshift-8/LOAD-MISMATCH`, an image whose `architectureId` is not `bitshift-8`;
   - with `bitshift-8/LOAD-RANGE`, an image whose `origin` is not an integer from 0 to 255, whose `entry` is not an integer from 0 to 255, or whose start address and length exceed the memory, that is, for which `origin + bytes.length` is greater than 256.

   The architecture check comes first.

3. **An accepted load** sets all memory to 0x00, copies the image bytes starting at `origin`, sets every register to 0 and every flag to 0, then sets PC to `entry`. The position within the instruction (section 6) returns to T1.
4. **`reset()`** restores exactly the state after the last accepted load, or the empty machine if there was none, and returns the position to T1.

## 2. Registers (DR-005, DR-006)

| Name | Bits | Reset | Descriptor role    | Programmer-visible | Written by                                       |
| ---- | ---- | ----- | ------------------ | ------------------ | ------------------------------------------------ |
| A    | 8    | 0     | `general`          | Yes                | `LDI A`, `MOV A,B`, `LDA`, every ALU instruction |
| B    | 8    | 0     | `general`          | Yes                | `LDI B`, `MOV B,A`                               |
| PC   | 8    | entry | `program-counter`  | Yes                | Fetch (increment), jumps                         |
| IR   | 8    | 0     | `instruction`      | No                 | Fetch                                            |
| MAR  | 8    | 0     | `memory-interface` | No                 | Fetch, operand fetch, `LDA`, `STA`               |
| MDR  | 8    | 0     | `memory-interface` | No                 | Every memory read; `STA`                         |
| OUT  | 8    | 0     | `output`           | Yes                | `OUT` only                                       |

1. The descriptor lists exactly these seven registers, in this order. All seven are in every state copy.
2. "Not programmer-visible" means no instruction names the register. It is still shown.
3. There is no `TEMP` register.
4. The state copy's `programCounter` is the value of PC.
5. **PC wrap (DR-004).** PC + 1 is taken modulo 256: after 0xFF comes 0x00. A two-byte instruction at 0xFF takes its operand from 0x00.

### 2.1 Flags

The descriptor lists three flags, in this order: `Z`, `N`, `C`. Each is 0 or 1 (false or true). Their rules are in section 5.

## 3. Instruction Set (DR-007, DR-010, DR-012, DR-017)

Twenty mnemonics, twenty-two opcodes. In the flag columns, "A" means "loaded from the new value of A" and "—" means unchanged.

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

1. **Every other opcode is reserved: 234 values, including 0x00.** Executing one is the undefined-opcode fault (section 6.3). None is treated as `NOP`.
2. In the ISA descriptor each row is one `InstructionDefinition`: `mnemonic`, `variant` (absent where the column is empty), `opcode`, `length` (the Bytes column) and `operand`.
3. **Display name.** Wherever one string names an instruction, it is the mnemonic, then one space and the variant if there is one: `NOP`, `LDI A`, `LDI B`, `MOV A,B`, `MOV B,A`, `ADD B`, `SUB B`, `INC A`, `DEC A`, `AND B`, `OR B`, `XOR B`, `NOT A`, `LDA`, `STA`, `JMP`, `JZ`, `JNZ`, `JC`, `JN`, `OUT`, `HLT`. The display name of an undefined opcode is `?`.

## 4. Encoding

```
1-byte instruction:  [ opcode ]
2-byte instruction:  [ opcode ] [ operand ]
```

| Operand kind | Second byte                            | Used by                                      |
| ------------ | -------------------------------------- | -------------------------------------------- |
| `none`       | None                                   | All 1-byte instructions                      |
| `immediate`  | The 8-bit value itself                 | `LDI A`, `LDI B`                             |
| `address`    | An 8-bit memory address, used directly | `LDA`, `STA`, `JMP`, `JZ`, `JNZ`, `JC`, `JN` |

The operand kind `register` is not used.

## 5. Flags (DR-008)

Three rules. Nothing else changes any flag.

1. **Z and N describe the value last written to A.** Z = 1 when that value is 0, otherwise 0. N = bit 7 of that value. They are loaded by `LDI A`, `MOV A,B`, `LDA`, `ADD`, `SUB`, `INC`, `DEC`, `AND`, `OR`, `XOR` and `NOT`.
2. **C is loaded by `ADD` and by `SUB`, every time.** `ADD` loads C with 1 when A + B is greater than 255, otherwise 0. `SUB` loads C with 1 when A is less than B (a borrow), otherwise 0. A and B here are the values before the instruction.
3. `LDI B`, `MOV B,A`, `STA`, `OUT`, the five jumps, `NOP` and `HLT` leave all three flags unchanged. `INC`, `DEC`, `AND`, `OR`, `XOR`, `NOT`, `LDI A`, `MOV A,B` and `LDA` leave C unchanged.

There is no overflow flag.

Worked values:

| Before             | Instruction | A after | Z   | N   | C         |
| ------------------ | ----------- | ------- | --- | --- | --------- |
| A = 255, B = 1     | `ADD B`     | 0       | 1   | 0   | 1         |
| A = 127, B = 1     | `ADD B`     | 128     | 0   | 1   | 0         |
| A = 0, B = 1       | `SUB B`     | 255     | 0   | 1   | 1         |
| A = 128, B = 128   | `SUB B`     | 0       | 1   | 0   | 0         |
| A = 1, B = 0       | `SUB B`     | 1       | 0   | 0   | 0         |
| A = 255            | `INC A`     | 0       | 1   | 0   | unchanged |
| A = 0              | `DEC A`     | 255     | 0   | 1   | unchanged |
| A = 0              | `NOT A`     | 255     | 0   | 1   | unchanged |
| A = 0xF0, B = 0x0F | `AND B`     | 0       | 1   | 0   | unchanged |

## 6. Clock Cycles and Micro-Operations (DR-011, DR-053)

**One micro-operation per clock cycle:** one register transfer, one memory access, one ALU operation with its result latch, or one PC action. Loading flags is part of the micro-operation that produced the value.

Cycles are named T1, T2, … within an instruction. These names are positions in this specification's tables. The CPU does not count simulated time: the platform owns the only cycle counter (DR-067).

### 6.1 Fetch and decode — the same four cycles for every instruction

| Position | Stage    | Micro-operation (label) | Control signals    |
| -------- | -------- | ----------------------- | ------------------ |
| T1       | `fetch`  | `MAR ← PC`              | `pc-out`, `mar-in` |
| T2       | `fetch`  | `MDR ← M[MAR]`          | `mem-read`         |
| T3       | `fetch`  | `IR ← MDR`              | `mdr-out`, `ir-in` |
| T4       | `decode` | `PC ← PC + 1`           | `pc-inc`           |

### 6.2 Execute — stage `execute` for every cycle from T5

| Instruction                                      | Position | Micro-operation (label) | Control signals               |
| ------------------------------------------------ | -------- | ----------------------- | ----------------------------- |
| `NOP`                                            | —        | (none)                  | —                             |
| `MOV A,B`                                        | T5       | `A ← B`                 | `b-out`, `a-in`, `flags-in`   |
| `MOV B,A`                                        | T5       | `B ← A`                 | `a-out`, `b-in`               |
| `ADD B`                                          | T5       | `A ← A + B`             | `alu-out`, `a-in`, `flags-in` |
| `SUB B`                                          | T5       | `A ← A − B`             | `alu-out`, `a-in`, `flags-in` |
| `INC A`                                          | T5       | `A ← A + 1`             | `alu-out`, `a-in`, `flags-in` |
| `DEC A`                                          | T5       | `A ← A − 1`             | `alu-out`, `a-in`, `flags-in` |
| `AND B`                                          | T5       | `A ← A AND B`           | `alu-out`, `a-in`, `flags-in` |
| `OR B`                                           | T5       | `A ← A OR B`            | `alu-out`, `a-in`, `flags-in` |
| `XOR B`                                          | T5       | `A ← A XOR B`           | `alu-out`, `a-in`, `flags-in` |
| `NOT A`                                          | T5       | `A ← NOT A`             | `alu-out`, `a-in`, `flags-in` |
| `OUT`                                            | T5       | `OUT ← A`               | `a-out`, `out-in`             |
| `HLT`                                            | T5       | `HALT`                  | `halt`                        |
| `LDI A`, `LDI B`                                 | T5       | `MAR ← PC`              | `pc-out`, `mar-in`            |
|                                                  | T6       | `MDR ← M[MAR]`          | `mem-read`                    |
|                                                  | T7       | `PC ← PC + 1`           | `pc-inc`                      |
| `LDI A`                                          | T8       | `A ← MDR`               | `mdr-out`, `a-in`, `flags-in` |
| `LDI B`                                          | T8       | `B ← MDR`               | `mdr-out`, `b-in`             |
| `LDA`                                            | T5–T7    | as `LDI` T5–T7          |                               |
|                                                  | T8       | `MAR ← MDR`             | `mdr-out`, `mar-in`           |
|                                                  | T9       | `MDR ← M[MAR]`          | `mem-read`                    |
|                                                  | T10      | `A ← MDR`               | `mdr-out`, `a-in`, `flags-in` |
| `STA`                                            | T5–T7    | as `LDI` T5–T7          |                               |
|                                                  | T8       | `MAR ← MDR`             | `mdr-out`, `mar-in`           |
|                                                  | T9       | `MDR ← A`               | `a-out`, `mdr-in`             |
|                                                  | T10      | `M[MAR] ← MDR`          | `mem-write`                   |
| `JMP`; a conditional jump whose condition holds  | T5       | `MAR ← PC`              | `pc-out`, `mar-in`            |
|                                                  | T6       | `MDR ← M[MAR]`          | `mem-read`                    |
|                                                  | T7       | `PC ← MDR`              | `mdr-out`, `pc-in`            |
| A conditional jump whose condition does not hold | T5       | `PC ← PC + 1`           | `pc-inc`                      |

**Conditional jumps** (`JZ`, `JNZ`, `JC`, `JN`) read their flag at the start of T5 and then follow one of the two sequences above. The conditions are: `JZ` Z = 1; `JNZ` Z = 0; `JC` C = 1; `JN` N = 1.

### 6.3 Undefined opcode (DR-016)

1. T1, T2 and T3 complete normally. After T3, IR holds the opcode.
2. If IR does not hold one of the 22 opcodes of section 3, the next step, the one that would be T4, **returns the fault** instead: `cyclesCompleted` 0, no events, and the diagnostic. It changes nothing.
3. The diagnostic has code `bitshift-8/UNDEFINED-OPCODE`, severity `error`, and a message that states the opcode and the address it was fetched from, both in hexadecimal.
4. The machine then shows IR holding the offending byte and PC still addressing it. Every later step returns the same fault until a reset or a load.

### 6.4 Halt (DR-016)

`HLT` is fetched and decoded like any instruction, so PC ends one past the `HLT`. Its T5 reports `halted` and ends the instruction. The machine stays halted until a reset or a load.

## 7. Cycle Counts

| Instruction                                                                                               | Cycles |
| --------------------------------------------------------------------------------------------------------- | ------ |
| `NOP`                                                                                                     | 4      |
| `MOV A,B`, `MOV B,A`, `ADD B`, `SUB B`, `INC A`, `DEC A`, `AND B`, `OR B`, `XOR B`, `NOT A`, `OUT`, `HLT` | 5      |
| `JZ`, `JNZ`, `JC`, `JN` when the condition does not hold                                                  | 5      |
| `JMP`; `JZ`, `JNZ`, `JC`, `JN` when the condition holds                                                   | 7      |
| `LDI A`, `LDI B`                                                                                          | 8      |
| `LDA`, `STA`                                                                                              | 10     |

1. Every completed step reports `cyclesCompleted` 1.
2. The last cycle of an instruction reports `instructionCompleted` true; every other cycle reports false (DR-018).
3. `HLT`'s T5 reports `halted` true; every other cycle reports false.
4. No instruction takes more than 10 cycles (conformance test CNF-05).

## 8. Datapath (DR-023)

One shared 8-bit bus, named `bus`. At most one source drives it in a cycle.

| Component | Drives the bus | Latches from the bus                    | Other connections                                                   |
| --------- | -------------- | --------------------------------------- | ------------------------------------------------------------------- |
| PC        | `pc-out`       | `pc-in`                                 | Its own incrementer (`pc-inc`), not through the bus                 |
| MAR       | —              | `mar-in`                                | Drives the memory address                                           |
| MDR       | `mdr-out`      | `mdr-in`                                | Loaded from memory by `mem-read`; drives memory data in `mem-write` |
| IR        | —              | `ir-in`                                 | Feeds the decoder                                                   |
| A         | `a-out`        | `a-in`                                  | Wired directly to the ALU's left input                              |
| B         | `b-out`        | `b-in`                                  | Wired directly to the ALU's right input                             |
| ALU       | `alu-out`      | —                                       | Inputs come from A and B directly, never from the bus               |
| OUT       | —              | `out-in`                                | Shown in the output panel                                           |
| Memory    | —              | —                                       | Addressed by MAR; exchanges data only with MDR                      |
| Flags     | —              | Z and N from the bus value (`flags-in`) | C from the ALU's carry or borrow, in `ADD` and `SUB` only           |

A cycle uses the bus when one of the five drive signals is asserted. `mem-read`, `mem-write`, `pc-inc` and `halt` cycles do not use the bus.

## 9. Control Signals (DR-051)

Exactly these seventeen names.

| Signal     | Meaning                          | Signal      | Meaning                                                                           |
| ---------- | -------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `pc-out`   | PC drives the bus                | `pc-in`     | PC latches the bus                                                                |
| `pc-inc`   | PC ← PC + 1                      | `mar-in`    | MAR latches the bus                                                               |
| `mem-read` | Memory at MAR is loaded into MDR | `mem-write` | MDR is written to memory at MAR                                                   |
| `mdr-out`  | MDR drives the bus               | `mdr-in`    | MDR latches the bus                                                               |
| `ir-in`    | IR latches the bus               | `a-out`     | A drives the bus                                                                  |
| `a-in`     | A latches the bus                | `b-out`     | B drives the bus                                                                  |
| `b-in`     | B latches the bus                | `alu-out`   | The ALU result drives the bus                                                     |
| `out-in`   | OUT latches the bus              | `flags-in`  | Z and N latch from the bus value; in `ADD` and `SUB`, C also latches from the ALU |
| `halt`     | The halt condition is set        |             |                                                                                   |

Rules that hold in every cycle:

1. At most one of `pc-out`, `mdr-out`, `a-out`, `b-out`, `alu-out`.
2. Never `mem-read` together with `mdr-in`.
3. Never `mem-read` together with `mem-write`.
4. Never `pc-in` together with `pc-inc`.

Within a `micro-operation` event the signals are listed in the order shown in section 6.

## 10. Events

### 10.1 Order within a cycle

Each completed cycle emits its events with `cycleOffset` 1, in this order. An event is emitted only where its condition holds.

| #   | Kind and payload                                      | Emitted                                                                     |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `instruction-start { address, mnemonic }`             | In T1 only                                                                  |
| 2   | `bitshift-8/step { address, mnemonic, stage, label }` | Every cycle                                                                 |
| 3   | `micro-operation { controlSignals }`                  | Every cycle                                                                 |
| 4   | `memory-read { address, value }`                      | In a `mem-read` cycle                                                       |
| 5   | `alu-operation { operation, left, right, result }`    | In an `alu-out` cycle                                                       |
| 6   | `bus-transfer { bus, value }`                         | In a cycle that uses the bus (section 8)                                    |
| 7   | `memory-write { address, before, after }`             | In the `mem-write` cycle, if the byte changes                               |
| 8   | `register-write { register, before, after }`          | For the register written in this cycle, if its value changes; never for OUT |
| 9   | `output-emitted { before, after }`                    | In `OUT`'s T5, if OUT changes                                               |
| 10  | `flag-update { flag, before, after }`                 | For each flag that changes, in the order Z, N, C                            |
| 11  | `halted { address }`                                  | In `HLT`'s T5 only                                                          |
| 12  | `instruction-end { address, mnemonic, nextAddress }`  | In the last cycle only; always the last event                               |

### 10.2 Payload values

1. `address` in events 1, 2, 11 and 12 is the address the current instruction's opcode was fetched from. `mnemonic` is its display name (section 3).
2. `nextAddress` is the value of PC after the instruction's last cycle.
3. `bus` is the string `bus`. The `value` of `bus-transfer` is the value driven onto the bus.
4. `memory-read.address` and `memory-write.address` are the value of MAR. `memory-read.value` is the byte read.
5. `alu-operation.operation` is `add`, `sub`, `inc`, `dec`, `and`, `or`, `xor` or `not`. `left` is A before the operation. `right` is B for `add`, `sub`, `and`, `or` and `xor`; 1 for `inc` and `dec`; 0 for `not`, where it is not used. `result` is the value written to A.
6. `register` is the register's name as in section 2. `flag` is `Z`, `N` or `C`. Flag values are booleans.
7. **State-changing events are emitted only when the value changes** (EVENT_MODEL §3.2). A transfer that leaves a value unchanged emits its `micro-operation` and `bus-transfer` and no `register-write`.
8. A faulting step emits nothing. The platform emits the `fault` event.
9. BITSHIFT-8 uses no snapshot `details`.

### 10.3 The `bitshift-8/step` event (DR-083)

The one architecture-specific event kind. It is informational and never changes state.

| Field      | Value                                                                |
| ---------- | -------------------------------------------------------------------- |
| `address`  | As rule 10.2.1                                                       |
| `mnemonic` | As rule 10.2.1                                                       |
| `stage`    | `fetch` for T1 to T3, `decode` for T4, `execute` from T5 (DR-083)    |
| `label`    | The micro-operation label exactly as written in sections 6.1 and 6.2 |

**It carries no cycle number and no step number.** The authoritative cycle of every event is the one the platform stamps on it (DR-067). A consumer that wants "which cycle of the instruction is this" subtracts the platform cycle of the instruction's `instruction-start` from the platform cycle of this event and adds 1.

### 10.4 The read-ahead for `instruction-start` (DR-082)

In T1 the simulator looks up the byte at address PC in its instruction table to obtain the display name. This is labelling done by the simulator. It is not a CPU memory read: it emits no `memory-read`, asserts no signal and changes no state. For an undefined opcode the display name is `?`.

### 10.5 Example

`ADD B` at address 4, with A = 3, B = 4, PC = 4, MAR = 2, all flags 0, and MDR and IR holding other values. `step` abbreviates `bitshift-8/step`; its `address` 4 and `mnemonic` `ADD B` are omitted from the table.

| Position | Events, in order                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1       | `instruction-start {4, 'ADD B'}`; `step {fetch, 'MAR ← PC'}`; `micro-operation [pc-out, mar-in]`; `bus-transfer {bus, 4}`; `register-write {MAR, 2, 4}`                                            |
| T2       | `step {fetch, 'MDR ← M[MAR]'}`; `micro-operation [mem-read]`; `memory-read {4, 0x20}`; `register-write {MDR, …, 0x20}`                                                                             |
| T3       | `step {fetch, 'IR ← MDR'}`; `micro-operation [mdr-out, ir-in]`; `bus-transfer {bus, 0x20}`; `register-write {IR, …, 0x20}`                                                                         |
| T4       | `step {decode, 'PC ← PC + 1'}`; `micro-operation [pc-inc]`; `register-write {PC, 4, 5}`                                                                                                            |
| T5       | `step {execute, 'A ← A + B'}`; `micro-operation [alu-out, a-in, flags-in]`; `alu-operation {add, 3, 4, 7}`; `bus-transfer {bus, 7}`; `register-write {A, 3, 7}`; `instruction-end {4, 'ADD B', 5}` |

No `flag-update` appears: Z, N and C were 0 and stay 0.

## 11. Visualization Adapter for Phase 2 (DR-082)

`toDatapath(snapshot, recentEvents)` is a pure function. It uses only the events whose `cycle` equals `snapshot.cycle`.

| Field                  | Value                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architectureId`       | `snapshot.architectureId`                                                                                                                                                                                                   |
| `components`           | Nine, with these `id`s in this order: `pc`, `ir`, `mar`, `mdr`, `a`, `b`, `out`, `alu`, `memory`                                                                                                                            |
| The seven registers    | `label` is the register name (`PC`, `IR`, `MAR`, `MDR`, `A`, `B`, `OUT`). `value` is the register's value in the snapshot. `active` is true when the cycle has a `register-write` for it, or an `output-emitted` for `out`. |
| `alu`                  | `label` `ALU`. `active` is true when the cycle has an `alu-operation`; `value` is then its `result`, and is absent otherwise.                                                                                               |
| `memory`               | `label` `Memory`. No `value`. `active` is true when the cycle has a `memory-read` or a `memory-write`.                                                                                                                      |
| `buses`                | One: `id` `bus`. `active` is true when the cycle has a `bus-transfer`; `value` is then that event's value, and is absent otherwise.                                                                                         |
| `activeControlSignals` | The `controlSignals` of the cycle's `micro-operation`, or an empty list                                                                                                                                                     |
| `activeOperation`      | The `label` of the cycle's `bitshift-8/step`, or absent                                                                                                                                                                     |

It defines no layout, position or animation, and holds no state. With no events for the cycle, every component and the bus are inactive.

## 12. Diagnostic Codes

| Code                          | Raised by                          | When        |
| ----------------------------- | ---------------------------------- | ----------- |
| `bitshift-8/UNDEFINED-OPCODE` | `stepClock`, as a fault            | Section 6.3 |
| `bitshift-8/LOAD-MISMATCH`    | `loadProgram`, as a `Result` error | Section 1.2 |
| `bitshift-8/LOAD-RANGE`       | `loadProgram`, as a `Result` error | Section 1.2 |

All have severity `error`.

## 13. Instruction Explanations (DR-045, DR-061, DR-084)

Authored text, one per instruction, keyed by display name. Each has two sentences: what the instruction does, then which flags it updates. `explainInstruction` returns exactly this text for a record whose `mnemonic` is the display name, and `undefined` for any other. Explanations are descriptive only and never affect execution.

| Display name | Explanation                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NOP`        | Does nothing and moves on to the next instruction. No flags are changed.                                                               |
| `LDI A`      | Loads the given value into A. Updates the zero and negative flags.                                                                     |
| `LDI B`      | Loads the given value into B. No flags are changed.                                                                                    |
| `MOV A,B`    | Copies B into A. Updates the zero and negative flags.                                                                                  |
| `MOV B,A`    | Copies A into B. No flags are changed.                                                                                                 |
| `ADD B`      | Adds B to A and stores the 8-bit result in A. Updates the zero, negative and carry flags.                                              |
| `SUB B`      | Subtracts B from A and stores the 8-bit result in A. Updates the zero, negative and carry flags; carry is set when B is larger than A. |
| `INC A`      | Adds 1 to A, wrapping from 255 to 0. Updates the zero and negative flags.                                                              |
| `DEC A`      | Subtracts 1 from A, wrapping from 0 to 255. Updates the zero and negative flags.                                                       |
| `AND B`      | Keeps in A only the bits that are 1 in both A and B. Updates the zero and negative flags.                                              |
| `OR B`       | Sets in A every bit that is 1 in A or in B. Updates the zero and negative flags.                                                       |
| `XOR B`      | Sets in A every bit that differs between A and B. Updates the zero and negative flags.                                                 |
| `NOT A`      | Inverts every bit of A. Updates the zero and negative flags.                                                                           |
| `LDA`        | Loads into A the byte stored at the given memory address. Updates the zero and negative flags.                                         |
| `STA`        | Stores A in memory at the given address. No flags are changed.                                                                         |
| `JMP`        | Continues the program at the given address. No flags are changed.                                                                      |
| `JZ`         | Jumps to the given address if the zero flag is set; otherwise continues with the next instruction. No flags are changed.               |
| `JNZ`        | Jumps to the given address if the zero flag is clear; otherwise continues with the next instruction. No flags are changed.             |
| `JC`         | Jumps to the given address if the carry flag is set; otherwise continues with the next instruction. No flags are changed.              |
| `JN`         | Jumps to the given address if the negative flag is set; otherwise continues with the next instruction. No flags are changed.           |
| `OUT`        | Copies A to the output register. No flags are changed.                                                                                 |
| `HLT`        | Stops the program. No flags are changed.                                                                                               |

## 14. What This Specification Does Not Define

1. Assembler syntax, directives and output format (DR-019, DR-020; Phase 3).
2. The SVG layout of the datapath (Phase 4).
3. Typed snapshot `details` (DR-078 c, deferred; not used).
