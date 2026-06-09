import { defineConfig, configDefaults } from 'vitest/config'

// Parse every test and source file as tsx (a superset of ts and jsx) so the oxc
// transformer handles the .ts/.tsx codebase with the automatic JSX runtime, letting
// test files render components without importing React.
export default defineConfig({
  oxc: {
    include: /\.[jt]sx?$/,
    exclude: /node_modules/,
    lang: 'tsx',
    jsx: { runtime: 'automatic', importSource: 'react' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Integration tests need a live Supabase stack; they run via their own config
    // (npm run test:integration), not the default fast suite.
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
  },
})
