#!/usr/bin/env node
// Advisory-diff audit gate.
//
// A raw `npm audit || true` always exits 0, so a genuinely new advisory just
// becomes finding #25 among the pre-existing ~24 and nobody notices. Instead
// this gate records the current set of advisory *source ids* as an allowlist
// (.github/audit-allowlist.json, triaged in docs/security-and-supply-chain.md)
// and fails ONLY when a new source id appears beyond it. Pre-existing
// build-time advisories stay informational; a new one surfaces loudly.
//
// No dependencies — runs on plain Node before or after `npm ci`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowlistPath = join(repoRoot, '.github', 'audit-allowlist.json');

/** Every distinct numeric advisory `source` id in an `npm audit --json` payload. */
function collectSourceIds(audit) {
  const ids = new Set();
  for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via === 'object' && typeof via.source === 'number') {
        ids.add(via.source);
      }
    }
  }
  return ids;
}

function runAudit() {
  // npm audit exits non-zero when advisories exist; the JSON is still on stdout.
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!result.stdout) {
    console.error('audit gate: `npm audit --json` produced no output');
    console.error(result.stderr ?? '');
    process.exit(2);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error('audit gate: could not parse `npm audit --json` output');
    process.exit(2);
  }
}

const allowed = new Set(JSON.parse(readFileSync(allowlistPath, 'utf8')).allowedAdvisoryIds);
const current = collectSourceIds(runAudit());
const added = [...current].filter((id) => !allowed.has(id)).sort((a, b) => a - b);
const stale = [...allowed].filter((id) => !current.has(id)).sort((a, b) => a - b);

if (stale.length > 0) {
  console.log(
    `audit gate: ${stale.length} allowlisted advisory id(s) no longer present ` +
      `(${stale.join(', ')}) — safe to prune from .github/audit-allowlist.json.`,
  );
}

if (added.length > 0) {
  console.error(
    `audit gate: ${added.length} NEW advisory id(s) beyond the allowlist: ${added.join(', ')}`,
  );
  console.error(
    'Triage each (build-time vs runtime) in docs/security-and-supply-chain.md, then add ' +
      'it to .github/audit-allowlist.json if it is build-time-only. Do NOT run ' +
      '`npm audit fix --force` (it downgrades the Expo/RN pin set).',
  );
  process.exit(1);
}

console.log(
  `audit gate: OK — ${current.size} advisory id(s), all allowlisted (build-time-only).`,
);
