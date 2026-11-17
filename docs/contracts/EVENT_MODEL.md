# BITSHIFT — Execution Event Model

**Status:** Stage 0.3 contract. Approved elements: `controlSignals` in the shared micro-operation payload (DR-013, SC-18); before and after values on `flag-update` and `output-emitted` (SC-19); namespaced architecture-specific kinds (DR-014, DR-043); the replay invariant as clarified (SC-20); cycle terminology (SC-17, DR-067). The remaining shared payload fields are carried from the Phase 0 draft and are **not** extended here.
**Related:** [DATA_CONTRACTS.md](DATA_CONTRACTS.md), [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md), [SIMULATION_PLATFORM.md](../architecture/SIMULATION_PLATFORM.md), [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md)

Events describe what happened during simulated clock cycles, in terms a visualization can show and a learner can read. They are not logs. Together with snapshots they are the only channel through which the UI learns what changed.

---

## 1. Principles

1. **Typed.** Every kind is a string literal with a typed payload.
2. **Immutable.** Once emitted, an event and its payload are never changed. Payloads are frozen when published.
3. **Ordered.** Events are ordered by `(cycle, sequence)`. Cycles never decrease.
4. **Self-describing.** A state-changing event carries its before and after values, so a consumer never diffs snapshots.
5. **Sufficient, not exhaustive.** Events describe changes. Snapshots describe state.
6. **Deterministic.** The same program and inputs give the same events, in the same order.
7. **Single cycle counter.** Only the platform assigns `cycle`. No architecture or consumer assigns or counts cycles (DR-067).

---

## 2. Envelope and Cycle Assignment

Two forms exist. They are different types.

```ts
/** Produced by the architecture inside a StepOutcome. No absolute cycle. */
export interface ArchitectureEvent {
  readonly kind: string;
  readonly cycleOffset: number; // 1-based cycle index within this step (DATA_CONTRACTS §5)
  readonly payload: unknown;
}

/** Produced by the platform. Published to subscribers and history. */
export interface ExecutionEvent<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly cycle: ClockCycle; // absolute cycle, assigned by the platform (DR-067)
  readonly sequence: number; // 0-based index within that cycle, assigned by the platform
  readonly payload: P;
}
```

**Assignment rule (normative):** for a step that began at platform cycle `c0` (the counter before the step), the platform assigns:

- `cycle = c0 + cycleOffset`, and
- `sequence` = the number of earlier events in the same cycle, in emission order.

The platform does not reorder events. The emission order of the architecture is the sequence order. Architectures never set `cycle` or `sequence` (MODULE_CONTRACTS §2.5, `stampEvents`).

**Faults.** A faulting step has no events (DATA_CONTRACTS §5). The platform emits one `fault` event of its own (section 3.3) at the counter value of the step's start. Its `sequence` is the next free sequence in that cycle, which is the number of events already published with that cycle, and the counter value is unchanged, because the fault completed no cycle (DR-075).

---

## 3. Event Categories

### 3.1 Categories

| Category                 | Meaning                                                          | Mutates replayable state? |
| ------------------------ | ---------------------------------------------------------------- | ------------------------- |
| **State-changing**       | A replayable CPU value changed. Carries `before` and `after`.    | Yes (section 5)           |
| **Informational**        | Describes an action or a value without changing replayable state | No                        |
| **Control-signal**       | Names the control signals active in a micro-operation            | No                        |
| **Instruction boundary** | Marks the start or end of an instruction                         | No                        |
| **Platform-originated**  | Emitted by the platform for a condition it detected              | No (platform fields only) |

Control-signal names are architecture-supplied strings. The shared envelope does not constrain them (SC-18). No BITSHIFT-8 signal name is defined here. Those names come from the Phase 2 specification.

### 3.2 Shared Kinds

Every architecture may emit these kinds. The payloads are the complete shared definitions.

| Kind                | Category             | Payload                                                              | Emitted when                        | Replay effect                                                          | Visualization use                           |
| ------------------- | -------------------- | -------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `micro-operation`   | Control-signal       | `{ controlSignals: readonly string[] }`                              | A micro-operation occurs in a cycle | None                                                                   | Active step label, active signals (MVP-019) |
| `bus-transfer`      | Informational        | `{ bus: string; value: number }`                                     | A value is placed on a named bus    | None                                                                   | Animates the bus                            |
| `register-write`    | State-changing       | `{ register: string; before: number; after: number }`                | A register's value changes          | Sets `registers[register]` to `after`                                  | Highlights the register                     |
| `memory-read`       | Informational        | `{ address: number; value: number }`                                 | A memory byte is read               | None                                                                   | Highlights the cell                         |
| `memory-write`      | State-changing       | `{ address: number; before: number; after: number }`                 | A memory byte is written            | Sets `memory[address]` to `after`                                      | Highlights the cell                         |
| `alu-operation`     | Informational        | `{ operation: string; left: number; right: number; result: number }` | The ALU operates                    | None                                                                   | Animates the ALU                            |
| `flag-update`       | State-changing       | `{ flag: string; before: boolean; after: boolean }`                  | A flag changes                      | Sets `flags[flag]` to `after`                                          | Highlights the flag                         |
| `output-emitted`    | State-changing       | `{ before: number; after: number }`                                  | The output register changes         | Sets the register whose role is `'output'` to `after`                  | Output panel                                |
| `instruction-start` | Instruction boundary | `{ address: number; mnemonic: string }`                              | An instruction begins               | None                                                                   | Timeline entry opens                        |
| `instruction-end`   | Instruction boundary | `{ address: number; mnemonic: string; nextAddress: number }`         | An instruction completes            | None                                                                   | Timeline entry closes                       |
| `halted`            | Informational        | `{ address: number }`                                                | The halt condition is reached       | None (the platform sets the lifecycle state from `StepOutcome.halted`) | Halt indicator                              |
| `fault`             | Platform-originated  | `{ diagnostic: Diagnostic }`                                         | A step faulted                      | None (the platform sets `state` and `lastFault`)                       | Fault banner                                |

**Notes on payloads:**

- `label`, `sources` and `destinations` are **not** part of the shared micro-operation payload. Whether they become shared fields is deferred to Phase 2 (DR-013, SC-18).
- `output-emitted` names no register. Replay uses the descriptor's register with role `'output'` (DATA_CONTRACTS §3.2). An architecture with no `'output'` register must not emit `output-emitted` as a state change. Such an architecture reports output through informational events only. This boundary is to be confirmed in Phase 2.
- Payload fields are `camelCase`. Numbers are integers. Booleans are `boolean`.

### 3.3 Platform-Originated Kind: `fault`

The platform emits `fault` when a step returns a fault or when an internal error is caught (MODULE_CONTRACTS §2.4.5). The architecture cannot emit it.

---

## 4. Architecture-Specific Kinds (DR-014, DR-043, approved)

- An architecture may define its own kinds. Each kind is namespaced with the architecture identifier: `<architecture-id>/<kind>`, for example `bitshift-8/<kind>`.
- The namespace must equal the emitting architecture's identifier (`isa.architectureId`). Any other namespace is rejected with `PLT-EVENT-NAMESPACE`, and the controller treats it as an internal fault.
- The platform forwards namespaced kinds to subscribers and history unchanged. It does not interpret their payloads.
- Shared visualization ignores unknown kinds. Architecture adapters may read their own kinds.
- An architecture-specific kind must never replace a shared kind for something the shared kinds describe. A register change is always `register-write`.
- No BITSHIFT-8-specific kind or payload is defined in this document. Those are Phase 2 decisions.

---

## 5. Replay Invariant (SC-20, clarified)

### 5.1 Replayable State

The replay invariant covers these fields of `CpuSnapshot`:

- `registers` (by name),
- `flags` (by name),
- `memory` (by address),
- the output register (role `'output'`), which is part of `registers`,
- `programCounter`, **provided** the architecture declares a register with role `'program-counter'`, whose value changes are reported by `register-write`.

It does **not** cover platform-owned fields (`cycle`, `state`, `lastFault`), and it does not cover `details`. Those are checked by other tests (section 5.4).

### 5.2 The Invariant

For each completed cycle `c`, let `S(c-1)` be the snapshot before the cycle and `S(c)` the snapshot after it. Let `E(c)` be the state-changing events with `cycle = c`, in `sequence` order. Then:

> Applying each event in `E(c)`, in order, to the replayable fields of `S(c-1)` produces the replayable fields of `S(c)`.

- **Informational events need not mutate the snapshot.** Events outside the state-changing set in section 3.2 may appear in `E(c)` and are ignored by replay.
- A state-changing event whose `before` value does not equal the value it replaces is a violation.
- A cycle with no state-changing events leaves the replayable fields unchanged.

### 5.3 Program-Counter Boundary

If the architecture has no `'program-counter'` role register, the replay invariant does not cover `programCounter`. That architecture must document how its program counter changes until DR-022 is resolved. Breakpoints still use the snapshot's `programCounter` (DATA_CONTRACTS §3.3).

### 5.4 Where the Invariant Is Tested

- **Platform test (fixture architecture):** replay is checked on every cycle.
- **Architecture conformance test:** replay is checked on every cycle, for every supported instruction, using the architecture's own descriptor. The `details` field is checked by the architecture's own tests.

---

## 6. Ordering, Batching and Delivery

- Events are ordered by `(cycle, sequence)`. Within one step, the order is the architecture's emission order.
- `ControllerUpdate.events` contains the events produced by that call, in that order.
- Across updates, every event of update _k+1_ has a cycle greater than or equal to the last cycle of update _k_, and no event is delivered twice.
- A subscriber never receives an event before the snapshot it refers to is published. The update's `snapshot` is the state after the events of that update.
- Events are not stored by the architecture. Each step returns them and the platform keeps only what the history needs (section 10) and the events of the current update.

---

## 7. Ownership

| Item                               | Owner                                       | Created by        | Read by                             |
| ---------------------------------- | ------------------------------------------- | ----------------- | ----------------------------------- |
| `ArchitectureEvent`                | Architecture                                | Architecture step | Platform only                       |
| `ExecutionEvent` (cycle, sequence) | Platform                                    | Platform stamping | Subscribers, history, visualization |
| Event payload values               | Architecture (content); platform (freezing) | Architecture      | Subscribers                         |
| `fault` event                      | Platform                                    | Platform          | Subscribers                         |

Subscribers and visualization never write events and never assign cycles. Payloads are deep-frozen in place when the platform stamps them; they are not copied (DR-079).

---

## 8. Relation to Snapshots

- Every `ControllerUpdate` carries the snapshot after its events. The snapshot's `cycle` equals the cycle of the last event, or the counter value when there are no events.
- Events describe the change from the previous snapshot to this one, within the replayable fields (section 5).
- The consistency invariant is the replay rule in section 5.2. It is a required test, not an assumption.
- A snapshot is not an event stream, and events are not a substitute for a snapshot. The UI uses both (SIMULATION_PLATFORM §7).

---

## 9. Unknown Kinds and Forward Compatibility

- **Platform:** forwards any kind it does not recognise, unchanged, provided it is namespaced. An unnamespaced unknown kind is a `PLT-EVENT-NAMESPACE` error.
- **Visualization:** ignores unknown kinds. It never fails because of one.
- **History:** stores an unknown kind only if it appears inside an instruction, and ignores it when building the `changes` list (section 10).
- **Replay:** ignores every kind outside section 3.2 (section 5.2).

---

## 10. Instruction History and Timeline

The timeline is built from instruction-boundary events. Each completed instruction becomes one record.

```ts
export interface InstructionRecord {
  readonly index: number; // 0-based within the current run
  readonly startCycle: ClockCycle; // cycle of the instruction-start event
  readonly endCycle: ClockCycle; // cycle of the instruction-end event
  readonly address: Address; // from instruction-start
  readonly mnemonic: string; // from instruction-start
  readonly changes: readonly StateChange[];
  readonly explanation?: string; // optional; from the architecture's explainInstruction (DR-061)
}

export interface StateChange {
  readonly target: string; // register name, flag name, or 'memory[<address>]' (decimal address, no padding, for example 'memory[16]')
  readonly before: number | boolean;
  readonly after: number | boolean;
}

/** The timeline view: the history entries, in order, with the eviction notice. */
export type TimelineEntry = InstructionRecord;
```

**Construction rules:**

- A record starts at `instruction-start` and ends at the matching `instruction-end`.
- `changes` lists every state-changing event between them, in order: `register-write` (target = register name), `flag-update` (target = flag name), `memory-write` (target = `memory[<address>]`, decimal, DR-077 f) and `output-emitted` (target = the output register's name).
- The platform never sets `explanation` and never calls `explainInstruction` (DR-077 g). The display layer fills it.
- `explanation` is filled by calling the architecture's optional function, at display time, when it exists. If it does not exist, or returns `undefined`, the UI shows generic fallback text.
- `index` restarts at 0 after `load` and `reset`.
- Records are immutable and forward-only. There is no backward navigation in v1.0 (EX-05).
- The bounded history and eviction rules are in SIMULATION_PLATFORM §8 (DR-056). Capacity is DR-024.

---

## 11. Illustrative Example

The example uses placeholder names. It does **not** define BITSHIFT-8 signals or cycle sequences (DR-011, DR-013 internal).

```ts
// Two cycles of one hypothetical instruction. Names are placeholders.
const update = {
  reason: 'instruction-step',
  cyclesCompleted: 2,
  events: [
    { kind: 'micro-operation', cycle: 4, sequence: 0, payload: { controlSignals: ['signal-a'] } },
    { kind: 'bus-transfer', cycle: 4, sequence: 1, payload: { bus: 'bus-1', value: 0 } },
    {
      kind: 'register-write',
      cycle: 4,
      sequence: 2,
      payload: { register: 'R1', before: 0, after: 7 },
    },
    { kind: 'micro-operation', cycle: 5, sequence: 0, payload: { controlSignals: ['signal-b'] } },
    {
      kind: 'flag-update',
      cycle: 5,
      sequence: 1,
      payload: { flag: 'F1', before: false, after: true },
    },
  ],
};
```

Replay of cycle 4 changes `R1` from 0 to 7. Replay of cycle 5 changes `F1` from false to true. `bus-transfer` and `micro-operation` are informational and do not change the replayable fields.

---

## 12. Versioning

- Adding a new shared kind requires an ADR.
- Changing a payload of a shared kind is breaking and requires an ADR.
- Architecture-specific kinds are versioned with the architecture's `descriptorVersion`.
- Future reverse execution and pipeline visualization are v2.0 directions (EX-05, EX-06). v1.0 keeps events as plain, typed, self-describing data so that a longer history can be added later without changing event shapes. This is a constraint on v1.0, not a v1.0 feature.
