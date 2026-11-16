# BITSHIFT-8 — Instruction Set and Architecture (Draft)

**Status:** DRAFT. Nothing in this document is approved for implementation except items marked **[A]** (product-owner stated). Items marked **[B]** are proposals. Items marked **[C]** are unresolved and block Phase 2 until decided.
**Blocking decisions:** DR-001 to DR-018 in [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md).

---

## 1. Overview

| Property           | Value                                        | Status                                 |
| ------------------ | -------------------------------------------- | -------------------------------------- |
| Data width         | 8 bits                                       | [B] (the brief lists this as proposed) |
| Address width      | 8 bits                                       | [B]                                    |
| Memory             | 256 bytes                                    | [B]                                    |
| Architecture style | Accumulator-based, general registers A and B | [B]                                    |
| Instruction length | 1 or 2 bytes                                 | [B]                                    |
| Execution stages   | Fetch, decode, execute                       | [B]                                    |
| Execution style    | Micro-operation based                        | [B]                                    |

Because the brief lists these characteristics as "proposed", all of them are [B] until the product owner approves this document.

## 2. Registers

| Name | Width | Proposed role                                                                | Programmer-visible?          | Status       |
| ---- | ----- | ---------------------------------------------------------------------------- | ---------------------------- | ------------ |
| A    | 8     | Accumulator; destination of ALU results; implicit operand of most arithmetic | Yes                          | [B]          |
| B    | 8     | General-purpose operand register                                             | Yes                          | [B]          |
| PC   | 8     | Program counter; address of next instruction byte                            | Yes (read; written by jumps) | [B]          |
| IR   | 8     | Instruction register; holds current opcode                                   | No (display only)            | [C] (DR-005) |
| MAR  | 8     | Memory address register; drives address lines                                | No (display only)            | [B]          |
| MDR  | 8     | Memory data register; holds data in transit                                  | No (display only)            | [B]          |
| OUT  | 8     | Output register; value shown in the output panel                             | Yes (written by OUT)         | [C] (DR-006) |
| TEMP | 8     | Internal scratch register used by micro-operations                           | No                           | [B]          |

### 2.1 Flags

| Flag         | Bit | Meaning (proposed)                                                                        | Status |
| ------------ | --- | ----------------------------------------------------------------------------------------- | ------ |
| Z (Zero)     | —   | Set when the result of the last flag-setting operation is 0                               | [B]    |
| C (Carry)    | —   | Set when an unsigned addition carries out of bit 7, or a subtraction borrows (see DR-008) | [C]    |
| N (Negative) | —   | Set to bit 7 of the result                                                                | [B]    |

Flag bit positions in a status byte are not defined. They are needed only if a status register is exposed (DR-009).

## 3. Memory

| Property                 | Proposal                                                                   | Status       |
| ------------------------ | -------------------------------------------------------------------------- | ------------ |
| Organisation             | Single unified memory for program and data (von Neumann)                   | [C] (DR-002) |
| Size                     | 256 bytes, addresses 0x00–0xFF                                             | [B]          |
| Reset contents           | All bytes 0x00                                                             | [B] (DR-003) |
| Program load address     | 0x00                                                                       | [B]          |
| Reset PC                 | 0x00                                                                       | [B]          |
| Memory-mapped I/O        | None                                                                       | [B]          |
| Read and write semantics | Any address is valid. Reads have no side effects. Writes replace the byte. | [B]          |

## 4. Program Counter Behaviour

| Behaviour                              | Proposal                                                           | Status       |
| -------------------------------------- | ------------------------------------------------------------------ | ------------ |
| Increment                              | PC increments by the instruction length after fetching each byte   | [B]          |
| Wrap                                   | PC is taken modulo 256. After 0xFF, the next address is 0x00.      | [B] (DR-004) |
| Instruction crossing the wrap boundary | Allowed. A 2-byte instruction at 0xFF takes its operand from 0x00. | [C] (DR-004) |
| Jump target                            | Absolute 8-bit address. No relative jumps.                         | [B] (DR-007) |

## 5. Instruction Encoding

### 5.1 Byte Format

Proposed: byte 0 is the opcode. Operands, when present, follow as one additional byte. Encodings are one or two bytes total.

```
Byte 0: opcode (8 bits)
Byte 1: operand (8 bits, immediate or address), only for 2-byte instructions
```

Whether LDI A and LDI B share one opcode with a register field, or use two opcodes, is open (DR-010). The brief lists separate opcodes, so the table below follows the brief.

### 5.2 Opcode Table (from brief, preliminary)

| Mnemonic    | Opcode | Length | Operand         | Proposed semantics                                 | Status                        |
| ----------- | ------ | ------ | --------------- | -------------------------------------------------- | ----------------------------- |
| LDI A, #imm | 0x10   | 2      | 8-bit immediate | A ← imm; update Z, N                               | [B]                           |
| LDI B, #imm | 0x11   | 2      | 8-bit immediate | B ← imm; update Z, N                               | [B]                           |
| ADD B       | 0x20   | 1      | Implicit B      | A ← A + B; update Z, N, C                          | [B]                           |
| SUB B       | 0x21   | 1      | Implicit B      | A ← A − B; update Z, N, C (borrow rule per DR-008) | [B]                           |
| LDA addr    | 0x30   | 2      | 8-bit address   | A ← M[addr]; update Z, N                           | [C] (DR-012: target register) |
| STA addr    | 0x31   | 2      | 8-bit address   | M[addr] ← A; no flags                              | [B]                           |
| JMP addr    | 0x40   | 2      | 8-bit address   | PC ← addr                                          | [B]                           |
| JZ addr     | 0x41   | 2      | 8-bit address   | If Z = 1 then PC ← addr                            | [B]                           |
| OUT         | 0x50   | 1      | Implicit A      | OUT ← A                                            | [C] (DR-006)                  |
| HLT         | 0xFF   | 1      | —               | Stop execution; state becomes HALTED               | [B]                           |

**Important:** this table is preliminary. It does not define the complete instruction set. Section 6 lists the mnemonics with no opcode.

### 5.3 Unallocated Opcodes

Any opcode not listed above is undefined. Proposed behaviour: illegal-opcode fault, state becomes FAULTED, and a diagnostic is emitted (DR-016). No undefined opcode may be silently treated as NOP.

## 6. Mnemonics Without an Assigned Opcode

The following mnemonics appear in the brief but have no opcode. **No opcode or semantics may be invented for them without approval.**

| Mnemonic | Question to resolve                                         |
| -------- | ----------------------------------------------------------- |
| MOV      | Operands and direction (A↔B? other?). See DR-012.           |
| INC      | Target register (A or B?). Flag effects (DR-008).           |
| DEC      | As INC.                                                     |
| AND      | Operand source (B only? immediate?). Carry effect (DR-008). |
| OR       | As AND.                                                     |
| XOR      | As AND.                                                     |
| NOT      | Operates on A only? Flag effects.                           |
| JNZ      | Opcode needed. Semantics clear (branch if Z = 0).           |
| JC       | Opcode needed. Branch if C = 1.                             |
| JN       | Opcode needed. Branch if N = 1.                             |
| NOP      | Opcode needed. Proposed 1 byte, no effect.                  |

## 7. Flag Update Rules (proposed, all open to review)

| Instruction                 | Z         | C         | N         | Status                 |
| --------------------------- | --------- | --------- | --------- | ---------------------- |
| LDI, LDA                    | Yes       | No change | Yes       | [B]                    |
| ADD, SUB                    | Yes       | Yes       | Yes       | [B] (C rule in DR-008) |
| INC, DEC                    | Yes       | No change | Yes       | [C] (DR-008)           |
| AND, OR, XOR, NOT           | Yes       | Cleared   | Yes       | [C] (DR-008)           |
| STA, JMP, JZ, OUT, HLT, NOP | No change | No change | No change | [B]                    |

Signed overflow is not tracked. There is no V flag in the brief (DR-008).

## 8. Execution Model (proposed)

### 8.1 Stages

1. **Fetch:** MAR ← PC; MDR ← M[MAR]; IR ← MDR; PC ← PC + 1.
2. **Decode:** identify instruction length from IR. If 2 bytes, fetch the operand (same pattern as fetch, using PC).
3. **Execute:** perform the instruction's micro-operations.

These micro-operations are a proposal for illustration. The exact sequence and tick count per instruction is open (DR-011).

### 8.2 Timing

Number of clock ticks per instruction is not defined. This affects the clock-level stepping experience and the timeline. [C] (DR-011).

## 9. HLT and Faults

| Situation                                | Proposed behaviour                                                         | Status       |
| ---------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| HLT executed                             | State becomes HALTED. PC is left after HLT. Step requests return no event. | [B] (DR-016) |
| Reset from HALTED                        | Returns to READY with registers and memory as configured                   | [B]          |
| Undefined opcode                         | FAULTED with diagnostic (opcode, address)                                  | [B] (DR-016) |
| Program counter runs past loaded program | Executes whatever bytes are in memory; no special check                    | [B]          |

## 10. Ambiguities Summary

The following must be answered before Phase 2 starts. Each is tracked in the decision register.

1. Whether memory is unified or split (DR-002).
2. Initial memory and register contents on reset (DR-003).
3. PC wrap and instruction crossing wrap (DR-004).
4. Whether IR is programmer-visible (DR-005).
5. Whether OUT is a register, an instruction, or both (DR-006).
6. Absolute versus relative jumps (DR-007).
7. Carry rule for SUB, and flag effects for INC, DEC, logic operations (DR-008).
8. Whether a status register exists (DR-009).
9. LDI encoding: separate opcodes or register field (DR-010).
10. Clock ticks per instruction (DR-011).
11. Target and operands for LDA, MOV, INC, DEC, AND, OR, XOR, NOT (DR-012).
12. Opcodes for JNZ, JC, JN, NOP, MOV, INC, DEC, AND, OR, XOR, NOT (DR-012).
13. Behaviour for undefined opcodes (DR-016).
14. Meaning of "output" for the OUT register (DR-006).
