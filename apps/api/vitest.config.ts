import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Resolve the `@/` source alias for tests; `@pilotage/*` resolve as workspace
// packages via node_modules.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node' },
});
