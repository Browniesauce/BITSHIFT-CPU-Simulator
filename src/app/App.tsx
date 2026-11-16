import type { ReactElement } from 'react';

/**
 * Placeholder workbench for the application foundation.
 * It shows the product identity and an empty state. It contains no simulator functionality:
 * the editor, CPU views and execution controls belong to later phases.
 */
export function App(): ReactElement {
  return (
    <main className="shell">
      <header className="shell__header">
        <h1 className="shell__title">BITSHIFT</h1>
        <p className="shell__tagline">
          See how a computer runs your program, one clock cycle at a time.
        </p>
      </header>

      <section className="shell__empty" aria-labelledby="workbench-status">
        <h2 id="workbench-status" className="shell__empty-title">
          The workbench is not ready yet
        </h2>
        <p>
          The simulator foundation is being prepared. The assembly editor, the CPU views and the
          execution controls will appear here in later phases.
        </p>
      </section>
    </main>
  );
}
