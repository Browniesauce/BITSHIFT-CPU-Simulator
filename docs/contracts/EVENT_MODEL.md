# BITSHIFT — Execution Event Model

**Status:** Proposed (B). Event kinds are a draft list for review, not final.
**Related:** [DATA_CONTRACTS.md](DATA_CONTRACTS.md), [MODULE_CONTRACTS.md](MODULE_CONTRACTS.md), [DR-013 and DR-014 in the decision register](../decisions/DECISION_REGISTER.md)

Events describe what the CPU did during a step, in terms a visualization can animate and a learner can read. They are not logs. They are the only channel, besides snapshots, through which the UI learns what changed.

---

## 1. Principles

1. **Typed.** Every event kind is a string literal and has a typed payload.
2. **Ordered.** Events within one step have strictly increasing sequence within the tick. Ticks never go backwards.
3. **Complete for display.** Every visible state change in the datapath has a corresponding event.
4. **Sufficient, not exhaustive.** Events do not carry the full CPU state; snapshots do.
5. **Deterministic.** Same program and inputs give the same events in the same order.

## 2. Envelope

```ts
export interface ExecutionEvent<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly tick: Tick; // tick of the micro-operation that produced it
  readonly sequence: number; // 0-based index within the tick
  readonly payload: P;
}
```

`sequence` is added to the envelope so ordering is explicit when several events share a tick.

## 3. Shared Event Kinds (proposed)

These kinds are defined by the platform. Every architecture may emit them. Payloads use generic names so they do not assume BITSHIFT-8 specifics.

| Kind                | Payload                                                              | Emitted when                     | Visualization use                |
| ------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| `micro-operation`   | `{ label: string; sources: string[]; destinations: string[] }`       | A micro-operation executes       | Labels the active step in the UI |
| `bus-transfer`      | `{ bus: string; value: number }`                                     | A value is placed on a named bus | Animates the bus                 |
| `register-write`    | `{ register: string; before: number; after: number }`                | A register changes               | Highlights register              |
| `memory-read`       | `{ address: number; value: number }`                                 | Memory is read                   | Highlights memory cell           |
| `memory-write`      | `{ address: number; before: number; after: number }`                 | Memory is written                | Highlights memory cell           |
| `alu-operation`     | `{ operation: string; left: number; right: number; result: number }` | ALU executes                     | Animates ALU                     |
| `flag-update`       | `{ flag: string; value: boolean }`                                   | A flag changes                   | Highlights flag                  |
| `output-emitted`    | `{ value: number }`                                                  | Output register is written       | Output panel                     |
| `instruction-start` | `{ address: number; mnemonic: string }`                              | An instruction begins            | Timeline entry                   |
| `instruction-end`   | `{ address: number; mnemonic: string; nextAddress: number }`         | An instruction completes         | Timeline entry                   |
| `halted`            | `{ address: number }`                                                | HLT completes                    | Halt state                       |
| `fault`             | `{ diagnostic: Diagnostic }`                                         | Illegal state detected           | Fault banner                     |

Rules (B):

- Payload field names are `camelCase`.
- Event kind names are `kebab-case`.
- Values are numbers. Booleans are `boolean`. No objects beyond the listed fields.

## 4. Architecture-Specific Events (open, DR-014)

An architecture may need events with no shared equivalent (for example BITSHIFT-8's `decode` or `ir-load`). Proposed rule:

- Architecture events use a namespaced kind: `<architecture-id>/<kind>`, for example `bitshift-8/decode`.
- The platform forwards them without interpreting them.
- Shared visualization ignores unknown kinds. Architecture adapters can read them.
- Architecture events must not replace shared events for things that are shared (for example, a register write must always be a `register-write`).

Whether architectures may define new kinds at all is an open decision (DR-014).

## 5. Ordering and Batching

- A **micro-operation step** emits zero or more events, all with the same `tick`.
- An **instruction step** emits events from all micro-operations it runs, in tick order.
- The controller delivers events in batches (`ControllerUpdate.events`), preserving order across batches.
- No event is delivered twice. Batches are disjoint.

## 6. Event Retention

- Events are not stored by the CPU. Each step returns its events and then forgets them.
- The platform keeps a bounded history of instruction-level summaries for the timeline (SIMULATION_PLATFORM section 6). Capacity is open (DR-024).
- Clock-level events are kept only for the most recent step.

## 7. Timeline Entries (derived)

The timeline is built from `instruction-start` and `instruction-end` events, plus `fault` and `halted`. Each entry:

```ts
export interface TimelineEntry {
  readonly index: number; // 0-based, per run
  readonly startTick: Tick;
  readonly endTick: Tick;
  readonly address: number;
  readonly mnemonic: string;
  readonly summary: string; // from VisualizationAdapter.describeEvent
}
```

Timeline entries are immutable once written. The timeline is forward-only in v1.0.

## 8. Examples

Micro-operation step of a fetch (illustrative only, because the BITSHIFT-8 sequence is not yet approved):

```ts
[
  {
    kind: 'micro-operation',
    tick: 4,
    sequence: 0,
    payload: { label: 'MAR ← PC', sources: ['PC'], destinations: ['MAR'] },
  },
  { kind: 'bus-transfer', tick: 4, sequence: 1, payload: { bus: 'address', value: 0x00 } },
  {
    kind: 'register-write',
    tick: 4,
    sequence: 2,
    payload: { register: 'MAR', before: 0x00, after: 0x00 },
  },
];
```

## 9. Versioning

- Adding a new shared kind requires an ADR.
- Changing a payload field of a shared kind is a breaking change and requires an ADR.
- Architecture-specific kinds are versioned with the architecture's `descriptorVersion`.

## 10. Future Compatibility (v2.0 directional)

Reverse execution and pipeline visualization will need event history at clock resolution. v1.0 keeps events as plain data with a stable envelope so this can be added by keeping a longer history, not by changing event shapes. This is a constraint on v1.0, not a v1.0 feature.
