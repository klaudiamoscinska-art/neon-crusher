// Shared helpers for the Neon Crusher QA suites (dev-only, never shipped).
// Node built-ins only: no package.json, no test framework, no dependencies.
//
// The harness loads the REAL runtime `game.js` into a `node:vm` context with a
// minimal fake DOM, so every suite exercises the shipped code, never a copy of
// its logic. Expected values in the suites come from the spec in
// docs/GAME_DESIGN.md, not from re-implementing the formulas.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'qa', 'out');

/** True when `url` (a suite's import.meta.url) is the script Node was started
 *  with. A naive `import.meta.url === 'file://' + argv[1]` never matches on
 *  Windows, so the suite would run nothing and exit 0 (a silent false PASS --
 *  a lesson from GLITCH GULP). */
export function isMain(url) {
  if (!process.argv[1]) return false;
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  return norm(fileURLToPath(url)) === norm(path.resolve(process.argv[1]));
}

export function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

// ---------------------------------------------------------------------------
// Reporter: PASS / FAIL / NOT RUN / KNOWN (a documented open defect).
// ---------------------------------------------------------------------------

/** Known defects confirmed by NC-FOUNDATION-1 and tracked in docs/RISKS.md.
 *  A KNOWN check documents the CURRENT (wrong) behaviour without failing the
 *  run, so CI stays usable while the defect is visible in every report. When
 *  the runtime is fixed the KNOWN check stops matching and turns into a FAIL
 *  ("fixed? update docs/RISKS.md and this check") -- the register can never
 *  silently drift from the code. */
export class Reporter {
  constructor(suite) {
    this.suite = suite;
    this.rows = [];
    this.unavailable = false; // set only by envUnavailable()
  }
  /** cond true = PASS, false = FAIL. */
  check(name, cond, detail = '') {
    this.rows.push({ status: cond ? 'PASS' : 'FAIL', name, detail });
    return cond;
  }
  /** `stillBroken` true = the documented defect is still present (KNOWN). */
  known(id, name, stillBroken, detail = '') {
    if (stillBroken) this.rows.push({ status: 'KNOWN', name: `[${id}] ${name}`, detail });
    else this.rows.push({ status: 'FAIL', name: `[${id}] ${name}`, detail: `behaviour changed -- defect fixed? update docs/RISKS.md and this check. ${detail}` });
  }
  notRun(name, reason) {
    this.rows.push({ status: 'NOT RUN', name, detail: reason });
  }
  /** The machine lacks what the suite needs (e.g. Playwright/Chromium).
   *  Only an OPTIONAL suite may end NOT RUN for this reason without failing
   *  the run (classifySuite); a mandatory suite still blocks. */
  envUnavailable(name, reason) {
    this.unavailable = true;
    this.notRun(name, reason);
  }
  /** Measurement only (never counted as PASS). */
  info(name, detail) {
    this.rows.push({ status: 'INFO', name, detail });
  }
  counts() {
    const c = { PASS: 0, FAIL: 0, 'NOT RUN': 0, KNOWN: 0, INFO: 0 };
    for (const r of this.rows) c[r.status]++;
    return c;
  }
  /** Prints the table, writes qa/out/<suite>.json, returns the exit code:
   *  0 = not blocking, 1 = FAIL, 2 = blocking NOT RUN / KNOWN ONLY. */
  finish({ optional = false, print = true, write = true } = {}) {
    const c = this.counts();
    const v = classifySuite(c, { optional, unavailable: this.unavailable });
    if (print) {
      for (const r of this.rows) console.log(`${r.status.padEnd(7)} ${r.name}${r.detail ? ' -- ' + r.detail : ''}`);
      console.log(`\n[${this.suite}] ${c.PASS}/${c.PASS + c.FAIL} checks PASS, FAIL ${c.FAIL}, KNOWN ${c.KNOWN}, NOT RUN ${c['NOT RUN']}, INFO ${c.INFO} => ${v.status}${v.blocking ? ' (blocking)' : ''}: ${v.reason}`);
    }
    if (write) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${this.suite}.json`), JSON.stringify({ suite: this.suite, counts: c, verdict: v, rows: this.rows }, null, 2));
    }
    return v.status === 'FAIL' ? 1 : v.blocking ? 2 : 0;
  }
}

/**
 * The one place that decides what a suite's result means (used by
 * Reporter.finish and qa/run-all.mjs; self-tested by qa/runner.mjs).
 *  - crash or any FAIL                        -> FAIL, blocking
 *  - nothing executed (no PASS, no KNOWN)     -> NOT RUN, blocking, unless the
 *    suite is optional AND reported its environment unavailable
 *  - only KNOWN, no PASS                      -> KNOWN ONLY, blocking (nothing verified)
 *  - PASS > 0                                 -> PASS / PASS+KNOWN / PASS+NOT RUN ..., not blocking
 */
export function classifySuite(counts, { optional = false, unavailable = false, crashed = false } = {}) {
  if (crashed || !counts) return { status: 'FAIL', blocking: true, reason: 'suite crashed' };
  if (counts.FAIL > 0) return { status: 'FAIL', blocking: true, reason: `${counts.FAIL} failing check(s)` };
  if (counts.PASS === 0 && counts.KNOWN === 0) {
    if (optional && unavailable) return { status: 'NOT RUN', blocking: false, reason: 'optional suite, environment unavailable (allowed)' };
    return { status: 'NOT RUN', blocking: true, reason: optional ? 'optional suite executed no check without reporting an unavailable environment' : 'mandatory suite executed no check' };
  }
  if (counts.PASS === 0) return { status: 'KNOWN ONLY', blocking: true, reason: 'only known defects, no passing check' };
  const tags = [counts.KNOWN ? 'KNOWN' : '', counts['NOT RUN'] ? 'NOT RUN' : ''].filter(Boolean);
  return { status: ['PASS', ...tags].join('+'), blocking: false, reason: tags.length ? `passing checks; also ${tags.join(' and ')} rows (listed above)` : 'all checks pass' };
}

/**
 * Runs suites, classifies each one and returns { exitCode, summary }.
 * exitCode 1 if no suite ran or any suite blocks; 0 otherwise.
 */
export async function runSuites(suites, { print = true, write = true } = {}) {
  const log = print ? (...a) => console.log(...a) : () => {};
  const summary = [];
  for (const s of suites) {
    log(`\n===== ${s.name}${s.optional ? ' (optional)' : ''} =====`);
    let counts = null; let verdict;
    try {
      const r = await s.run();
      r.finish({ optional: !!s.optional, print, write });
      counts = r.counts();
      verdict = classifySuite(counts, { optional: !!s.optional, unavailable: r.unavailable });
    } catch (e) {
      log(`CRASH ${e.stack}`);
      verdict = classifySuite(null, { crashed: true });
    }
    summary.push({ name: s.name, optional: !!s.optional, counts, ...verdict });
  }
  const exitCode = summary.length === 0 || summary.some((s) => s.blocking) ? 1 : 0;
  log('\n===== SUMMARY =====');
  if (summary.length === 0) log('FAIL    no suite was run');
  for (const s of summary) {
    const c = s.counts;
    log(`${s.status.padEnd(16)} ${s.name.padEnd(14)} ${c ? `PASS ${c.PASS}  FAIL ${c.FAIL}  KNOWN ${c.KNOWN}  NOT RUN ${c['NOT RUN']}` : 'crashed'}  ${s.blocking ? '<- BLOCKS' : ''}${!s.blocking && s.status === 'NOT RUN' ? '(optional, allowed)' : ''}`);
  }
  log(`\nRESULT: ${exitCode === 0 ? 'PASS (no blocking suite)' : 'FAIL (see BLOCKS above)'}`);
  return { exitCode, summary };
}

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) -- replaces Math.random inside the vm only.
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Fake DOM + vm harness around the real game.js.
// ---------------------------------------------------------------------------

function makeElement(id) {
  const handlers = {};
  return {
    id,
    textContent: '',
    disabled: false,
    style: {},
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    /** Mirrors a real click: a disabled <button> dispatches nothing. */
    click() { if (this.disabled) return false; for (const fn of handlers.click || []) fn({ type: 'click' }); return true; },
    /** Calls the handler even when disabled (tests the code's own guard). */
    forceClick() { for (const fn of handlers.click || []) fn({ type: 'click' }); },
  };
}

/** Canvas 2D context stub: every method is a no-op, every property settable.
 *  Counts calls so performance probes can measure draw work per frame. */
function makeContext() {
  const calls = Object.create(null);
  const state = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop === '__calls') return calls;
      if (prop in target) return target[prop];
      return (...args) => { calls[prop] = (calls[prop] || 0) + 1; return undefined; };
    },
    set(target, prop, value) {
      if (prop === 'shadowBlur' && value > 0) calls.__shadowBlurSet = (calls.__shadowBlurSet || 0) + 1;
      target[prop] = value;
      return true;
    },
  });
  return ctx;
}

export class FakeStorage {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial)); this.throwOnGet = false; this.throwOnSet = false; this.writes = 0; }
  getItem(k) { if (this.throwOnGet) throw new Error('SecurityError: storage denied'); return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (this.throwOnSet) throw new Error('QuotaExceededError'); this.writes++; this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

// NC_GAME_JS=<path> runs the suites against another game.js (e.g. the base
// version extracted with `git show origin/main:game.js`) on the same machine.
const GAME_SRC_PATH = process.env.NC_GAME_JS ? path.resolve(process.env.NC_GAME_JS) : path.join(ROOT, 'game.js');

/**
 * Loads the real game.js into a fresh vm context.
 * @param {object} o
 * @param {number} o.width/height  CSS size of the canvas wrapper (#gameArea)
 * @param {number} o.dpr           devicePixelRatio
 * @param {number} o.seed          seed for Math.random inside the vm
 * @param {FakeStorage} o.storage  localStorage stand-in
 * @param {object} o.navigator     navigator stand-in ({ languages, language }); omitted = none
 * @param {string} o.search        location.search (e.g. '?lang=pl')
 * @returns harness with the game's classes, a Game factory and a frame pump
 */
export function loadGame({ width = 900, height = 600, dpr = 1, seed = 1, storage = new FakeStorage(), navigator = undefined, search = '' } = {}) {
  const src = fs.readFileSync(GAME_SRC_PATH, 'utf8');
  const winHandlers = {};
  const docHandlers = {};
  const rafQueue = [];
  const elements = new Map();
  const consoleLog = [];
  const size = { width, height };

  const wrapper = { getBoundingClientRect: () => ({ width: size.width, height: size.height, top: 0, left: 0 }) };
  const ctx = makeContext();
  const canvas = { width: 0, height: 0, style: {}, parentElement: wrapper, getContext: () => ctx };

  const document = {
    hidden: false,
    documentElement: { lang: 'en' },
    getElementById(id) {
      if (id === 'gameCanvas') return canvas;
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    addEventListener(type, fn) { (docHandlers[type] ||= []).push(fn); },
  };

  const sandbox = {
    console: { log: (...a) => consoleLog.push(['log', a.join(' ')]), warn: (...a) => consoleLog.push(['warn', a.join(' ')]), error: (...a) => consoleLog.push(['error', a.join(' ')]) },
    document,
    localStorage: storage,
    devicePixelRatio: dpr,
    requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
    addEventListener(type, fn) { (winHandlers[type] ||= []).push(fn); },
    location: { search },
  };
  // No navigator unless a test passes one (= a browser without language info).
  if (navigator !== undefined) sandbox.navigator = navigator;
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(`(() => { const r = (${mulberry32.toString()})(${seed >>> 0}); Math.random = r; })();`, context);
  vm.runInContext(src, context, { filename: 'game.js' });
  // Top-level class/const declarations of a classic script live in the
  // context's global lexical scope; a second script in the same context sees them.
  // Names added in NC-BASIC-1 / NC-PHYS-1 are optional so the same suites can run against an
  // older base game.js (base-vs-candidate comparison on one machine).
  const optionalNames = ['SAVE_BACKUP_KEY', 'SAVE_INT_MAX', 'STRINGS', 'DEFAULT_LANGUAGE', 'detectLanguage', 'translate', 'formatMoney', 'sanitizeSave', 'SIM_STEP', 'MAX_FRAME_DT', 'TURRET_CLEARANCE'];
  const api = vm.runInContext(`({ COLORS, SAVE_KEY, MAX_PARTICLES, clamp, randRange, Particle, ParticlePool, Block, Ball, Turret, Game, ${optionalNames.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} })`, context);

  let now = 0;
  const h = {
    ...api,
    context, canvas, ctx, storage, elements, consoleLog, winHandlers, docHandlers,
    /** Constructs the Game exactly like the DOMContentLoaded handler does. */
    newGame() { h.game = new api.Game(canvas); return h.game; },
    /** Fires window/document events the game listens to. */
    fireWindow(type) { for (const fn of winHandlers[type] || []) fn({ type }); },
    fireDocument(type) { for (const fn of docHandlers[type] || []) fn({ type }); },
    resizeTo(w, hgt) { size.width = w; size.height = hgt; h.fireWindow('resize'); },
    /** Pumps requestAnimationFrame callbacks at `hz` for `seconds` of game time,
     *  through Game.loop (so the real dt clamp applies). Returns frame count. */
    run(seconds, hz = 60, onFrame = null) {
      const step = 1000 / hz;
      const frames = Math.round(seconds * hz);
      for (let i = 0; i < frames; i++) {
        now += step;
        const queue = rafQueue.splice(0, rafQueue.length);
        for (const fn of queue) fn(now);
        if (onFrame) onFrame(i, h.game);
      }
      return frames;
    },
    el: (id) => document.getElementById(id),
  };
  return h;
}

/** CrazyGames iframe sizes (docs/CRAZYGAMES.md, read 2026-11-09). These are
 *  WHOLE-iframe sizes; the canvas gets what is left after the top bar and the
 *  shop, which only a browser can measure (qa/browser-smoke.mjs). */
export const CG_FRAMES = [
  [907, 510], [1216, 684], [1077, 606], [821, 462], [1366, 768],
  [1920, 1080], [1536, 864], [1280, 720], [800, 450], [1080, 607],
];
