// Self-test of the QA runner (R1 of NC-FOUNDATION-1, GPT review): a suite
// that executed nothing must never let the run end green. Exercises the real
// classifySuite/runSuites/Reporter from qa/lib.mjs with synthetic suites, and
// the real CLI (qa/run-all.mjs, qa/browser-smoke.mjs) in subprocesses.
// Usage: node qa/runner.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, Reporter, runSuites, classifySuite, isMain, readText } from './lib.mjs';

/** Synthetic suite whose Reporter gets `rows` (status list) and flags. */
function fake(name, statuses, { optional = false, unavailable = false, crash = false } = {}) {
  return {
    name, optional,
    run: () => {
      if (crash) throw new Error('synthetic crash');
      const r = new Reporter(`selftest-${name}`);
      for (const s of statuses) {
        if (s === 'PASS') r.check('ok', true);
        else if (s === 'FAIL') r.check('bad', false);
        else if (s === 'KNOWN') r.known('NC-00', 'synthetic defect', true);
        else if (s === 'NOT RUN') r.notRun('skipped', 'synthetic');
        else if (s === 'INFO') r.info('measure', '1');
      }
      if (unavailable) r.envUnavailable('all', 'synthetic: no browser');
      return r;
    },
  };
}

const quietRun = (suites) => runSuites(suites, { print: false, write: false });

function cli(args, env = {}) {
  const res = spawnSync(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

export async function run() {
  const r = new Reporter('runner');
  const PASS = fake('ok', ['PASS', 'INFO']);

  // --- Mandatory suite that executed nothing blocks the run.
  {
    const a = await quietRun([PASS, fake('empty', [])]);
    r.check('mandatory suite with zero checks -> NOT RUN, blocking, run exit 1', a.exitCode === 1 && a.summary[1].status === 'NOT RUN' && a.summary[1].blocking);
    const b = await quietRun([PASS, fake('skipped', ['NOT RUN', 'INFO'])]);
    r.check('mandatory suite with only NOT RUN/INFO rows -> blocking, exit 1', b.exitCode === 1 && b.summary[1].blocking);
    const c = await quietRun([PASS, fake('mand-unavail', [], { unavailable: true })]);
    r.check('environment unavailable does NOT excuse a mandatory suite -> exit 1', c.exitCode === 1 && c.summary[1].blocking);
  }

  // --- Optional browser-smoke may be NOT RUN only for an unavailable environment.
  {
    const a = await quietRun([PASS, fake('smoke', [], { optional: true, unavailable: true })]);
    r.check('optional suite, environment unavailable -> NOT RUN allowed, exit 0', a.exitCode === 0 && a.summary[1].status === 'NOT RUN' && !a.summary[1].blocking);
    const b = await quietRun([PASS, fake('smoke', [], { optional: true })]);
    r.check('optional suite that ran nothing for another reason -> blocking, exit 1', b.exitCode === 1 && b.summary[1].blocking);
  }

  // --- A real FAIL always blocks.
  {
    const a = await quietRun([PASS, fake('bad', ['PASS', 'FAIL'])]);
    const b = await quietRun([PASS, fake('bad-opt', ['PASS', 'FAIL'], { optional: true })]);
    const c = await quietRun([PASS, fake('boom', [], { crash: true })]);
    r.check('FAIL in a mandatory suite -> exit 1', a.exitCode === 1 && a.summary[1].status === 'FAIL');
    r.check('FAIL in an optional suite -> exit 1', b.exitCode === 1 && b.summary[1].status === 'FAIL');
    r.check('crashing suite -> FAIL, exit 1', c.exitCode === 1 && c.summary[1].status === 'FAIL');
    const d = await quietRun([fake('known-fixed', ['PASS'], {}), { name: 'k', run: () => { const x = new Reporter('selftest-k'); x.check('ok', true); x.known('NC-00', 'fixed defect', false); return x; } }]);
    r.check('a KNOWN check whose defect disappeared is a FAIL -> exit 1', d.exitCode === 1 && d.summary[1].status === 'FAIL');
  }

  // --- KNOWN-only is never a full PASS.
  {
    const a = await quietRun([PASS, fake('known-only', ['KNOWN', 'KNOWN', 'INFO'])]);
    r.check('suite with only KNOWN rows -> KNOWN ONLY (not PASS), blocking, exit 1', a.exitCode === 1 && a.summary[1].status === 'KNOWN ONLY' && a.summary[1].blocking);
    const b = await quietRun([fake('mixed', ['PASS', 'KNOWN', 'NOT RUN'])]);
    r.check('PASS with KNOWN and NOT RUN rows -> labelled PASS+KNOWN+NOT RUN, exit 0', b.exitCode === 0 && b.summary[0].status === 'PASS+KNOWN+NOT RUN');
    r.check('only a suite with passing checks and nothing else is plain PASS', classifySuite({ PASS: 3, FAIL: 0, KNOWN: 0, 'NOT RUN': 0, INFO: 2 }).status === 'PASS');
  }

  // --- Empty run and Reporter.finish exit codes (standalone CLI of a suite).
  {
    const a = await quietRun([]);
    r.check('no suite at all -> exit 1', a.exitCode === 1);
    const fin = (statuses, o) => fake('f', statuses, o).run().finish({ ...o, print: false, write: false });
    r.check('Reporter.finish: zero checks -> 2, KNOWN only -> 2, FAIL -> 1, PASS -> 0, optional+unavailable -> 0',
      fin([]) === 2 && fin(['KNOWN']) === 2 && fin(['PASS', 'FAIL']) === 1 && fin(['PASS', 'KNOWN']) === 0 && fin([], { optional: true, unavailable: true }) === 0);
  }

  // --- Suite list: browser-smoke is the only optional suite.
  {
    const src = readText('qa/run-all.mjs');
    const optional = src.split('\n').filter((l) => /optional: true/.test(l));
    r.check('qa/run-all.mjs marks exactly one suite optional: browser-smoke', optional.length === 1 && /name: 'browser-smoke'/.test(optional[0]));
  }

  // --- Real CLI behaviour (subprocesses).
  {
    const a = cli([path.join('qa', 'run-all.mjs'), '--only', 'browser-smoke'], { NC_QA_NO_BROWSER: '1' });
    r.check('CLI: run-all --only browser-smoke without a browser -> exit 0, NOT RUN (optional, allowed)', a.code === 0 && /NOT RUN\s+browser-smoke[\s\S]*optional, allowed/.test(a.out), `exit ${a.code}`);
    const b = cli([path.join('qa', 'run-all.mjs'), '--only', 'no-such-suite']);
    r.check('CLI: run-all --only <unknown suite> -> exit 1 (an empty selection is never green)', b.code === 1, `exit ${b.code}`);
    const c = cli([path.join('qa', 'browser-smoke.mjs')], { NC_QA_NO_BROWSER: '1' });
    r.check('CLI: browser-smoke alone without a browser -> exit 0 with NOT RUN', c.code === 0 && /NOT RUN/.test(c.out), `exit ${c.code}`);
  }
  return r;
}

if (isMain(import.meta.url)) run().then((r) => process.exit(r.finish()));
