/** Error-as-value result, used at every API boundary that a caller can misuse (DATA_CONTRACTS §2). */
export type Result<T, E = Diagnostic> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Position in source text. Lines and columns are 1-based (DATA_CONTRACTS §2). */
export interface SourceSpan {
  readonly line: number;
  readonly column: number;
  readonly length: number;
}

/**
 * A structured message. The code identifies the message for tests and tooling.
 * Code prefixes are listed in DATA_CONTRACTS §11.
 */
export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly span?: SourceSpan;
}

/** Builds a successful Result (DATA_CONTRACTS §2). */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/** Builds a failed Result (DATA_CONTRACTS §2). */
export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
