#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve the .ts seed script path next to this runner
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsSeed = path.join(__dirname, 'seedM07.ts');

try {
  console.log('Running seed via npx tsx:', tsSeed);
  execSync(`npx tsx "${tsSeed}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run seed script via tsx. Try running: npx tsx', tsSeed);
  process.exit(1);
}
