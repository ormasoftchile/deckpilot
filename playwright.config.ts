import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/visual',
  snapshotDir: './test/visual/snapshots',
  updateSnapshots: 'missing',
  use: {
    baseURL: 'http://localhost:5175',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'cd packages/web && npx vite --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
