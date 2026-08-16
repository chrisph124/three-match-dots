#!/usr/bin/env node
// Vendored-harness pin-drift check.
//
// The plugins under .tessl/plugins/ auto-load their skills into every agent
// session (via the .github/skills, .claude/skills, .agents/skills and
// .codex/skills symlinks), so an unreviewed pin change is a supply-chain event.
// This gate fails if a plugin manifest's `version` (a git SHA) drifts from the
// vetted value recorded in .github/vendored-pins.json. Re-vet and update
// docs/security-and-supply-chain.md before bumping a pin.
//
// No dependencies — plain Node.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pinsPath = join(repoRoot, '.github', 'vendored-pins.json');
const { pins } = JSON.parse(readFileSync(pinsPath, 'utf8'));

const problems = [];
for (const [pluginDir, expected] of Object.entries(pins)) {
  // Both manifests carry the pin; both must match so neither can silently drift.
  for (const manifest of ['tessl-package.json', 'tile.json']) {
    const path = join(repoRoot, pluginDir, manifest);
    let version;
    try {
      version = JSON.parse(readFileSync(path, 'utf8')).version;
    } catch {
      problems.push(`${pluginDir}/${manifest}: missing or unreadable`);
      continue;
    }
    if (version !== expected) {
      problems.push(
        `${pluginDir}/${manifest}: pin drift — expected ${expected}, found ${version}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('vendored-pins gate: drift detected');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    'A vendored skill plugin changed. Re-vet it (SHA-pinned? autoload side effects?), ' +
      'update docs/security-and-supply-chain.md, then set the new SHA in .github/vendored-pins.json.',
  );
  process.exit(1);
}

console.log(
  `vendored-pins gate: OK — ${Object.keys(pins).length} plugin(s) at their vetted SHA.`,
);
