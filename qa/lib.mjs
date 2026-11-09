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
  /** Measurement only (never counted as PASS). */
  info(name, detail) {
    this.rows.push({ status: 'INFO', name, detail });
  }
  counts() {
    const c = { PASS: 0, FAIL: 0, 'NOT RUN': 0, KNOWN: 0, INFO: 0 };
    for (const r of this.rows) c[r.status]++;
    return c;
  }
  /** Prints the table, writes qa/out/<suite>.json, returns the exit code. */
  finish() {
    for (const r of this.rows) {
      console.log(`${r.status.padEnd(7)} ${r.name}${r.detail ? ' -- ' + r.detail : ''}`);
    }
    const c = this.counts();
    const checks = c.PASS + c.FAIL;
    console.log(`\n[${this.suite}] ${c.PASS}/${checks} checks PASS, FAIL ${c.FAIL}, KNOWN ${c.KNOWN}, NOT RUN ${c['NOT RUN']}, INFO ${c.INFO}`);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${this.suite}.json`), JSON.stringify({ suite: this.suite, counts: c, rows: this.rows }, null, 2));
    // A suite that executed no check is NOT RUN, never PASS.
    if (checks === 0 && c.KNOWN === 0) {
      console.log(`[${this.suite}] NOT RUN: no check executed`);
      return 2;
    }
    return c.FAIL > 0 ? 1 : 0;
  }
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

const GAME_SRC_PATH = path.join(ROOT, 'game.js');

/**
 * Loads the real game.js into a fresh vm context.
 * @param {object} o
 * @param {number} o.width/height  CSS size of the canvas wrapper (#gameArea)
 * @param {number} o.dpr           devicePixelRatio
 * @param {number} o.seed          seed for Math.random inside the vm
 * @param {FakeStorage} o.storage  localStorage stand-in
 * @returns harness with the game's classes, a Game factory and a frame pump
 */
export function loadGame({ width = 900, height = 600, dpr = 1, seed = 1, storage = new FakeStorage() } = {}) {
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
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(`(() => { const r = (${mulberry32.toString()})(${seed >>> 0}); Math.random = r; })();`, context);
  vm.runInContext(src, context, { filename: 'game.js' });
  // Top-level class/const declarations of a classic script live in the
  // context's global lexical scope; a second script in the same context sees them.
  const api = vm.runInContext('({ COLORS, SAVE_KEY, MAX_PARTICLES, clamp, randRange, Particle, ParticlePool, Block, Ball, Turret, Game })', context);

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
