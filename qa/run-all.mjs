// Runs every QA suite in-process and prints one summary.
// Exit 1 on any FAIL; KNOWN (documented open defects, docs/RISKS.md) and
// NOT RUN never turn into PASS and are always listed.
// Usage: node qa/run-all.mjs [--quick] [--base origin/main] [--no-runtime-change]
import fs from 'node:fs';
import path from 'node:path';
import { OUT, isMain } from './lib.mjs';
import * as integrity from './integrity.mjs';
import * as instructions from './instructions.mjs';
import * as physics from './physics.mjs';
import * as levels from './levels.mjs';
import * as economy from './economy.mjs';
import * as save from './save.mjs';
import * as smoke from './browser-smoke.mjs';

if (isMain(import.meta.url)) {
  const argv = process.argv;
  const quick = argv.includes('--quick');
  const bi = argv.indexOf('--base');
  const base = bi > 0 ? argv[bi + 1] : null;
  const suites = [
    ['integrity', () => integrity.run({ base, noRuntimeChange: argv.includes('--no-runtime-change') })],
    ['instructions', () => instructions.run()],
    ['physics', () => physics.run({ quick })],
    ['levels', () => levels.run()],
    ['economy', () => economy.run({ quick })],
    ['save', () => save.run()],
    ['browser-smoke', () => smoke.run()],
  ];
  const summary = [];
  let fail = false;
  for (const [name, fn] of suites) {
    console.log(`\n===== ${name} =====`);
    let code; let counts;
    try { const r = await fn(); code = r.finish(); counts = r.counts(); }
    catch (e) { console.log(`CRASH ${e.stack}`); code = 1; counts = null; }
    if (code === 1) fail = true;
    const status = code === 1 ? 'FAIL' : code === 2 ? 'NOT RUN' : (counts && counts['NOT RUN'] > 0 && counts.PASS === 0 ? 'NOT RUN' : 'PASS');
    summary.push({ name, status, counts });
  }
  console.log('\n===== SUMMARY =====');
  for (const s of summary) {
    const c = s.counts;
    console.log(`${s.status.padEnd(7)} ${s.name.padEnd(14)} ${c ? `PASS ${c.PASS}  FAIL ${c.FAIL}  KNOWN ${c.KNOWN}  NOT RUN ${c['NOT RUN']}` : 'crashed'}`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ quick, base, summary }, null, 2));
  process.exit(fail ? 1 : 0);
}
