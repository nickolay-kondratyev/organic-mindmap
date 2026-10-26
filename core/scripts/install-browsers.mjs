// Installs Playwright Chromium unless it is already present. Runs from `prepare` (local `npm install` / `npm ci`
// in this repo only), NOT `postinstall`, so consumers installing the published package never execute it.
// WHY the check: `playwright install` takes a lock inside PLAYWRIGHT_BROWSERS_PATH first; on machines where
// browsers are pre-provisioned in a read-only dir that lock blocks forever, hanging `npm install`.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const executable = chromium.executablePath();
if (existsSync(executable)) {
  console.log(`Playwright Chromium already installed at path=[${executable}]`);
} else {
  execSync('npx playwright install chromium', { stdio: 'inherit' });
}
