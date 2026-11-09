// Runs every QA suite in-process and prints one summary.
// Exit 1 when any suite BLOCKS (qa/lib.mjs classifySuite): a FAIL, a crash,
// a mandatory suite that executed no check (NOT RUN), or a suite with only
// KNOWN rows. The single allowed NOT RUN is the OPTIONAL browser-smoke when
// Playwright/Chromium is unavailable. KNOWN and NOT RUN rows are always listed
// and never turn into PASS. The runner itself is self-tested by qa/runner.mjs.
// Usage: node qa/run-all.mjs [--quick] [--base origin/main] [--no-runtime-change] [--only a,b]
import fs from 'node:fs';
import path from 'node:path';
import { OUT, isMain, runSuites } from './lib.mjs';
import * as integrity from './integrity.mjs';
import * as instructions from './instructions.mjs';
import * as runner from './runner.mjs';
import * as physics from './physics.mjs';
import * as levels from './levels.mjs';
import * as economy from './economy.mjs';
import * as save from './save.mjs';
import * as i18n from './i18n.mjs';
import * as smoke from './browser-smoke.mjs';

/** The suite list. Only browser-smoke is optional (needs a browser). */
export function defaultSuites({ quick = false, base = null, noRuntimeChange = false } = {}) {
  return [
    { name: 'integrity', run: () => integrity.run({ base, noRuntimeChange }) },
    { name: 'instructions', run: () => instructions.run() },
    { name: 'runner', run: () => runner.run() },
    { name: 'physics', run: () => physics.run({ quick }) },
    { name: 'levels', run: () => levels.run() },
    { name: 'economy', run: () => economy.run({ quick }) },
    { name: 'save', run: () => save.run() },
    { name: 'i18n', run: () => i18n.run() },
    { name: 'browser-smoke', optional: true, run: () => smoke.run() },
  ];
}

if (isMain(import.meta.url)) {
  const argv = process.argv;
  const arg = (k) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : null; };
  const opts = { quick: argv.includes('--quick'), base: arg('--base'), noRuntimeChange: argv.includes('--no-runtime-change') };
  let suites = defaultSuites(opts);
  const only = arg('--only');
  if (only) {
    const want = only.split(',');
    const unknown = want.filter((n) => !suites.some((s) => s.name === n));
    if (unknown.length) { console.log(`FAIL    unknown suite(s): ${unknown.join(', ')}`); process.exit(1); }
    suites = suites.filter((s) => want.includes(s.name));
  }
  const { exitCode, summary } = await runSuites(suites);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ ...opts, only, exitCode, summary }, null, 2));
  process.exit(exitCode);
}
