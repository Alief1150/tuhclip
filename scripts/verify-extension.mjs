import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const dist = (...parts) => resolve(root, 'dist', ...parts);

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`verify-extension: FAIL ${message}`);
};

const manifestPath = dist('manifest.json');
if (!existsSync(manifestPath)) {
  fail('dist/manifest.json is missing');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];
if (scripts.length === 0) fail('manifest declares no content_scripts[].js');

for (const script of scripts) {
  const path = dist(script);
  if (!existsSync(path)) {
    fail(`manifest content script is missing: ${script}`);
    continue;
  }
  const source = readFileSync(path, 'utf8');
  const lines = source.split('\n');
  const topLevelImport = lines.some((line) => /^\s*import[\s{*"']/.test(line));
  const topLevelExport = lines.some((line) => /^\s*export\s+(default|const|let|var|function|class|\{|\*)/.test(line));
  if (topLevelImport) fail(`${script} contains a top-level ESM import (content scripts must be standalone)`);
  if (topLevelExport) fail(`${script} contains a top-level ESM export (content scripts must be standalone)`);
  if (!topLevelImport && !topLevelExport) {
    console.log(`verify-extension: OK ${script} is a standalone classic bundle`);
  }
}

const background = manifest.background?.service_worker;
if (background && !existsSync(dist(background))) fail(`background service worker is missing: ${background}`);
const panel = manifest.side_panel?.default_path;
if (panel && !existsSync(dist(panel))) fail(`side panel entry is missing: ${panel}`);

if (failures.length > 0) process.exit(1);
console.log('verify-extension: PASS manifest references resolve to real files');
