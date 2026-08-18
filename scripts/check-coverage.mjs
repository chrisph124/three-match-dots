#!/usr/bin/env node
// Advisory-diff coverage gate.
//
// A single repo-wide coverage floor is either a lie (native RN/Skia/worklet
// layers Vitest can't reach drag it down) or an arbitrary number picked before
// any baseline exists. Instead — exactly like scripts/check-audit.mjs — a
// committed baseline (.github/coverage-baseline.json) is the source of truth,
// and this gate fails ONLY when coverage drops below it beyond a small epsilon.
//
// It compares at TWO levels against Vitest's coverage-summary.json (v8 provider,
// json-summary reporter):
//   (a) total.*.pct — the whole testable surface, and
//   (b) per-file *.pct — every file present in BOTH baseline and current run.
// Per-file is what stops the gameable case: a PR that adds a big well-tested
// file while an existing file silently regresses keeps `total` flat, so a
// total-only gate would pass. New files (current, not baseline) are reported to
// fold into the next baseline, never failed. Ratchet = update the baseline in
// the same PR that raises coverage.
//
// No dependencies — runs on plain Node after `npm run coverage`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const summaryPath = join(repoRoot, 'coverage', 'coverage-summary.json');
const baselinePath = join(repoRoot, '.github', 'coverage-baseline.json');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function readJson(path, hint) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(`coverage gate: could not read ${path}`);
    console.error(hint);
    process.exit(2);
  }
}

/** coverage-summary.json keys are absolute paths; normalize to repo-relative, forward-slash. */
function toRelative(absPath) {
  return relative(repoRoot, absPath).split(sep).join('/');
}

/** Extract the four metric pcts from a coverage-summary entry into a flat map. */
function pcts(entry) {
  const out = {};
  for (const m of METRICS) out[m] = entry[m].pct;
  return out;
}

/**
 * A baseline entry must carry all four metrics as finite numbers. A missing key
 * would make `cur[m] - base[m]` evaluate to NaN, and `NaN` fails both the drop
 * and rise comparisons — silently masking a regression in that metric. So a
 * hand-trimmed or partially-regenerated baseline is a hard config error, not a pass.
 */
function assertMetrics(entry, label) {
  for (const m of METRICS) {
    if (typeof entry?.[m] !== 'number' || Number.isNaN(entry[m])) {
      console.error(`coverage gate: baseline entry "${label}" is missing numeric metric "${m}".`);
      console.error('Regenerate .github/coverage-baseline.json from `npm run coverage` — do not hand-trim metrics.');
      process.exit(2);
    }
  }
}

const summary = readJson(summaryPath, 'Run `npm run coverage` first — it writes coverage/coverage-summary.json.');
const baseline = readJson(baselinePath, 'Expected the committed baseline .github/coverage-baseline.json.');

const epsilon = typeof baseline.epsilon === 'number' ? baseline.epsilon : 0.5;

// Fail loudly on a malformed baseline rather than silently skipping a metric.
assertMetrics(baseline.total, 'total');
for (const [path, base] of Object.entries(baseline.files ?? {})) assertMetrics(base, path);

// Current per-file map keyed by repo-relative path (drop the synthetic `total`).
const currentFiles = {};
for (const [key, entry] of Object.entries(summary)) {
  if (key === 'total') continue;
  currentFiles[toRelative(key)] = pcts(entry);
}
const currentTotal = pcts(summary.total);

const drops = []; // hard failures: metric fell more than epsilon below baseline
const rises = []; // informational: metric rose more than epsilon above baseline
const newFiles = []; // in current, not baseline — fold into next baseline
const goneFiles = []; // in baseline, not current — deleted/renamed, safe to prune

function compare(label, base, cur) {
  for (const m of METRICS) {
    const delta = cur[m] - base[m];
    if (delta < -epsilon) {
      drops.push(`${label} ${m}: ${base[m]}% → ${cur[m]}% (−${(-delta).toFixed(2)}pp)`);
    } else if (delta > epsilon) {
      rises.push(`${label} ${m}: ${base[m]}% → ${cur[m]}% (+${delta.toFixed(2)}pp)`);
    }
  }
}

compare('total', baseline.total, currentTotal);

const baseFiles = baseline.files ?? {};
for (const [path, base] of Object.entries(baseFiles)) {
  if (path in currentFiles) compare(path, base, currentFiles[path]);
  else goneFiles.push(path);
}
for (const path of Object.keys(currentFiles)) {
  if (!(path in baseFiles)) newFiles.push(path);
}

if (goneFiles.length > 0) {
  console.log(
    `coverage gate: ${goneFiles.length} baseline file(s) no longer measured ` +
      `(${goneFiles.sort().join(', ')}) — safe to prune from .github/coverage-baseline.json.`,
  );
}
if (newFiles.length > 0) {
  console.log(
    `coverage gate: ${newFiles.length} new file(s) not in baseline ` +
      `(${newFiles.sort().join(', ')}) — add them by refreshing .github/coverage-baseline.json.`,
  );
}

if (drops.length > 0) {
  console.error(`coverage gate: ${drops.length} metric(s) dropped > ${epsilon}pp below baseline:`);
  for (const d of drops) console.error(`  - ${d}`);
  console.error(
    'Add tests to restore coverage. Only lower .github/coverage-baseline.json if the drop is ' +
      'intentional and justified (code deleted, not tests) — the baseline is the floor.',
  );
  process.exit(1);
}

if (rises.length > 0) {
  console.log(`coverage gate: OK — and ${rises.length} metric(s) rose above baseline:`);
  for (const r of rises) console.log(`  + ${r}`);
  console.log(
    'Safe to ratchet: refresh .github/coverage-baseline.json in this PR to lock the gain ' +
      '(`npm run coverage` then regenerate the baseline).',
  );
} else {
  console.log(
    `coverage gate: OK — total ${currentTotal.statements}% stmts / ${currentTotal.branches}% branch / ` +
      `${currentTotal.functions}% funcs / ${currentTotal.lines}% lines, at or above baseline (±${epsilon}pp).`,
  );
}
