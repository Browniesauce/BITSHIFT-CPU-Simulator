import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';

// Smoke test for the application shell. Server-side rendering needs no DOM environment,
// so no component-test tooling is required (DR-038 is deferred to Phase 5).
describe('App shell', () => {
  const html = renderToString(<App />);

  it('shows the BITSHIFT identity as the page heading', () => {
    expect(html).toMatch(/<h1[^>]*>BITSHIFT<\/h1>/);
  });

  it('is a single main landmark', () => {
    expect(html.match(/<main[\s>]/g)).toHaveLength(1);
  });

  it('explains that the simulator foundation is being prepared', () => {
    expect(html).toContain('The simulator foundation is being prepared');
  });
});
