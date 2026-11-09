'use strict';

// Palette "Fractured Intelligence" (NC-ART-1, docs/GAME_DESIGN.md "Visual
// identity"). Every colour has one meaning: graphite = the AI's material,
// cyan = its outer armour circuits and the player's balls, violet = its inner
// shield, amber = the AI's energy (the heart/prime module, relays, conduits),
// magenta = the player's breach (volley, lances, aim, cracks it opens),
// green = money only, white = impacts and hot cores.
const COLORS = {
  cyan: '#00f3ff',
  ice: '#9ff8ff',
  pink: '#ff007f',
  magenta: '#ff2bb0',
  violet: '#a46bff',
  green: '#39ff14',
  // Energy (NC-ORIGINAL-1): relays, the volley meter, aim marks.
  amber: '#ffc400',
  white: '#ffffff',
  // Graphite structure tones.
  void: '#07070d',
  plate: '#141826',
  plateFace: '#20263a',
  plateHi: '#3a4463',
  plateDark: '#090a11',
  trace: '#1c2536',
};
// Cosmetic caps (NC-ART-1): relay surge arcs alive at once, crack lines per
// plate, fracture lines of the breach finale.
const MAX_ARCS = 8;
const BREACH_LINES = 10;
// Seconds the new core takes to assemble outward from the heart (draw only).
const CORE_ASSEMBLY_TIME = 0.45;

const SAVE_KEY = 'neonCrusher.save.v1';
// Copy of a save that could not be loaded exactly as written (unreadable JSON,
// unknown format, invalid values). Written BEFORE the game's first save, so
// the player's original data is never lost (docs/SAVE.md).
const SAVE_BACKUP_KEY = 'neonCrusher.save.v1.bak';
// Upper bound for the saved integer counters: keeps every derived number
// (1.5^n costs, HP, income) finite. Unreachable in normal play.
const SAVE_INT_MAX = 1000;
const SAVE_INT_FIELDS = ['level', 'maxBalls', 'fireRateLevel', 'damageLevel'];
const MAX_PARTICLES = 400;

// Fixed simulation step (NC-03): the game advances in equal 1/240 s steps
// whatever the display refresh rate (60/144/165 Hz all run the same steps),
// so hits, income and RNG use do not depend on the monitor. A frame longer
// than MAX_FRAME_DT (tab switch, hitch) is clamped: the game slows down
// instead of running a burst of steps.
const SIM_STEP = 1 / 240;
const MAX_FRAME_DT = 0.05;
// Minimum gap between a turret centre and the core's bounding box (NC-14).
const TURRET_CLEARANCE = 20;
// Turrets sit this far beyond the core extent when the canvas allows it.
const TURRET_MARGIN = 44;
// Turrets stay this far inside the canvas edge on the short axis.
const TURRET_EDGE_INSET = 20;
// World scale (NC-09, NC-CORE-1A): the game simulates a world whose short
// side is at most WORLD_SHORT_SIDE units and draws it scaled up to fill the
// canvas. A bigger screen shows the same field larger instead of a bigger
// field with the same small core, so the hit rate (and the first purchase)
// no longer depends on the screen size. Canvases with a short side up to
// this size are drawn 1:1 exactly as before.
const WORLD_SHORT_SIDE = 250;
// Floating "+$n" labels on hits: capped so a full field stays cheap (NC-13).
const MAX_FLOAT_TEXTS = 10;
const FLOAT_TEXT_LIFE = 0.8;

// ---------------------------------------------------------------------------
// Breach system (NC-ORIGINAL-1, docs/GAME_DESIGN.md "Breach"). Every core
// hides a HEART at its centre under armour blocks; some armour blocks are
// energy RELAYS. Turrets charge a synchronised VOLLEY: the player clicks/taps
// (or presses Space) and every turret fires a piercing lance at that point.
// A lance has a power budget that armour absorbs block by block, so where the
// player aims decides how deep it drills. A destroyed relay sends a shockwave
// to its neighbours and recharges the volley at once; a destroyed heart
// shatters the whole core outward. Idle play stays possible: an unused volley
// fires by itself (autopilot) at a random armour block after a delay.
// ---------------------------------------------------------------------------
// Turrets refill the field to maxBalls one ball per turret every this many ms
// (fixed; the old fire-rate upgrade now speeds up the volley: NC-10).
const BALL_REFILL_INTERVAL = 700;
// Volley charge time (s) = max(VOLLEY_MIN_CHARGE, VOLLEY_BASE_CHARGE x
// VOLLEY_CHARGE_FACTOR^(chargeLevel-1)); chargeLevel = saved fireRateLevel.
const VOLLEY_BASE_CHARGE = 11;
const VOLLEY_CHARGE_FACTOR = 0.9;
const VOLLEY_MIN_CHARGE = 2;
// A fresh session starts with this much charge (first volley in ~3 s).
const VOLLEY_START_CHARGE = 0.7;
// Seconds a ready volley waits for the player before the autopilot fires it.
const VOLLEY_AUTO_DELAY = 5;
// Lance power per turret = LANCE_POWER x ball damage (the Hit power level):
// a volley concentrates that many ball hits on one line. Linear, like the
// balls, so block HP (x1.5 per level) still sets the pace (no runaway).
const LANCE_POWER = 8;
// Half-width of a lance (world units): wider than half a grid gap, so a lance
// can never slip between two blocks.
const LANCE_HALF_WIDTH = 3;
// Heart HP = HEART_HP x the level's block HP.
const HEART_HP = 6;
// Relay shockwave: radius in block steps (block size + gap); damage =
// SHOCK_DAMAGE x ball damage to every block it reaches.
const SHOCK_RADIUS_STEPS = 1.6;
const SHOCK_DAMAGE = 6;
// Bonus cash, in multiples of the level's money per hit.
const RELAY_BONUS = 4;
const HEART_BONUS = 6;
const SHATTER_PAY = 1;
// Speed (world units/s) of the shatter wave after the heart breaks.
const SHATTER_SPEED = 240;
const MAX_LANCES = 8;
const MAX_RINGS = 12;
// Audio preference (not part of the progress save; docs/SAVE.md).
const AUDIO_PREF_KEY = 'neonCrusher.audio.v1';

// ---------------------------------------------------------------------------
// Localization: one table, English is the default and the fallback.
// ---------------------------------------------------------------------------

const DEFAULT_LANGUAGE = 'en';
const STRINGS = {
  en: {
    locale: 'en-US',
    cash: 'Cash',
    level: 'Level',
    buyBall: 'Buy new ball',
    balls: 'Balls: {n}',
    fireRate: 'Volley charge',
    chargeDesc: 'Lvl {n} · {s} s',
    damage: 'Hit power',
    upgradeLevel: 'Lvl {n}',
    core: 'Core',
    volley: 'Volley',
    volleyReady: 'VOLLEY READY',
    hintStart: 'Hits pay cash · break the heart to shatter the core',
    hintBuy: 'Buy a new ball!',
    hintVolley: 'Click or tap the core to fire a volley',
    breached: 'CORE SHATTERED',
    relay: 'RECHARGED',
    levelUp: 'LEVEL {n}',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
  },
  pl: {
    locale: 'pl-PL',
    cash: 'Kasa',
    level: 'Poziom',
    buyBall: 'Kup nową kulę',
    balls: 'Kulki: {n}',
    fireRate: 'Ładowanie salwy',
    chargeDesc: 'Lvl {n} · {s} s',
    damage: 'Siła uderzenia',
    upgradeLevel: 'Lvl {n}',
    core: 'Rdzeń',
    volley: 'Salwa',
    volleyReady: 'SALWA GOTOWA',
    hintStart: 'Trafienia dają kasę · rozbij serce, by skruszyć rdzeń',
    hintBuy: 'Kup nową kulę!',
    hintVolley: 'Kliknij lub dotknij rdzeń, by oddać salwę',
    breached: 'RDZEŃ ROZBITY',
    relay: 'PRZEŁADOWANIE',
    levelUp: 'POZIOM {n}',
    soundOn: 'Dźwięk włączony',
    soundOff: 'Dźwięk wyłączony',
  },
};

/** Picks the UI language: an explicit `?lang=xx` in the URL first, then the
 *  browser's preferred languages; anything unsupported falls back to English.
 *  (The CrazyGames SDK locale replaces the browser list once the SDK is added.) */
function detectLanguage(nav, search) {
  const candidates = [];
  const match = /[?&]lang=([a-zA-Z-]+)/.exec(search || '');
  if (match) candidates.push(match[1]);
  if (nav) {
    if (Array.isArray(nav.languages)) candidates.push(...nav.languages);
    if (nav.language) candidates.push(nav.language);
  }
  for (const tag of candidates) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (Object.prototype.hasOwnProperty.call(STRINGS, base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

function translate(lang, key, vars) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANGUAGE];
  let text = table[key] !== undefined ? table[key] : STRINGS[DEFAULT_LANGUAGE][key];
  if (text === undefined) return key;
  if (vars) for (const name of Object.keys(vars)) text = text.split(`{${name}}`).join(String(vars[name]));
  return text;
}

function formatMoney(value, lang) {
  const locale = (STRINGS[lang] || STRINGS[DEFAULT_LANGUAGE]).locale;
  return `$${Math.floor(value).toLocaleString(locale)}`;
}

/**
 * Validates parsed save data field by field (docs/SAVE.md). Returns the
 * accepted values and `exact`: true only for a well-formed v1 save that is
 * taken over unchanged. Invalid fields fall back to the defaults (they are
 * simply not returned); the caller backs up the raw data when `exact` is false.
 */
function sanitizeSave(data) {
  const values = {};
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { values, exact: false };
  const known = ['cash', ...SAVE_INT_FIELDS];
  let exact = Object.keys(data).every((k) => known.includes(k));

  const cash = data.cash;
  if (typeof cash === 'number' && Number.isFinite(cash) && cash >= 0) values.cash = cash;
  else exact = false;

  for (const field of SAVE_INT_FIELDS) {
    const v = data[field];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
      values[field] = Math.min(Math.floor(v), SAVE_INT_MAX);
      if (values[field] !== v) exact = false;
    } else {
      exact = false;
    }
  }
  return { values, exact };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/** Deterministic pseudo-random value in [0, 1) from an integer (cosmetic
 *  detail: crack layouts, plate patterns, arcs). Never Math.random in
 *  drawing: the simulation RNG must not depend on frames drawn (NC-03). */
function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Adds a chamfered rectangle to the current path. `c` = corner cuts
 *  [top-left, top-right, bottom-right, bottom-left] in units. */
function chamferPath(ctx, x, y, w, h, c) {
  ctx.moveTo(x + c[0], y);
  ctx.lineTo(x + w - c[1], y);
  ctx.lineTo(x + w, y + c[1]);
  ctx.lineTo(x + w, y + h - c[2]);
  ctx.lineTo(x + w - c[2], y + h);
  ctx.lineTo(x + c[3], y + h);
  ctx.lineTo(x, y + h - c[3]);
  ctx.lineTo(x, y + c[0]);
  ctx.closePath();
}

/** Adds a regular polygon (n sides, radius r, rotation a) to the path. */
function polygonPath(ctx, cx, cy, r, n, a) {
  for (let i = 0; i < n; i++) {
    const t = a + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    else ctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
  }
  ctx.closePath();
}

/** Adds a jagged line from (x0, y0) to (x1, y1) to the path: `n` segments,
 *  sideways jitter up to `amp`, layout fixed by `seed`. */
function jaggedPath(ctx, x0, y0, x1, y1, n, amp, seed) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const o = (hash01(seed + i * 131) - 0.5) * 2 * amp;
    ctx.lineTo(x0 + dx * t + px * o, y0 + dy * t + py * o);
  }
  ctx.lineTo(x1, y1);
}

/** Distance along a ray (unit direction) to where it enters an axis-aligned
 *  box, 0 if it starts inside, null if it misses (slab method). */
function rayBoxEnter(ox, oy, dx, dy, x0, y0, x1, y1) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, x0, x1], [oy, dy, y0, y1]]) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
    } else {
      let t0 = (lo - o) / d;
      let t1 = (hi - o) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tmin = Math.max(tmin, t0);
      tmax = Math.min(tmax, t1);
    }
  }
  if (tmax < Math.max(tmin, 0)) return null;
  return Math.max(tmin, 0);
}

/** Distance along a ray from a point inside a box to the box's edge. */
function rayBoxExit(ox, oy, dx, dy, x0, y0, x1, y1) {
  let t = Infinity;
  if (dx > 1e-12) t = Math.min(t, (x1 - ox) / dx);
  if (dx < -1e-12) t = Math.min(t, (x0 - ox) / dx);
  if (dy > 1e-12) t = Math.min(t, (y1 - oy) / dy);
  if (dy < -1e-12) t = Math.min(t, (y0 - oy) / dy);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

class Particle {
  constructor() {
    this.active = false;
  }

  init(x, y, vx, vy, color, radius, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.active = true;
    return this;
  }

  update(dt) {
    this.vy += 420 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // 0.985 per 1/60 s (the original per-frame drag at 60 Hz), now per time.
    this.vx *= Math.pow(0.985, dt * 60);
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  /** A spark: a short streak along its velocity, thinning as it dies (the
   *  pool sets the glow once per colour: ParticlePool.draw). */
  drawStreak(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.lineWidth = Math.max(0.6, this.radius * 0.9 * t);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
    ctx.stroke();
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.lineCap = 'round';
    this.drawStreak(ctx);
    ctx.restore();
  }
}

class ParticlePool {
  constructor(max) {
    this.max = max;
    this.pool = [];
    this.active = [];
  }

  spawn(x, y, color, opts = {}) {
    if (this.active.length >= this.max) return;
    const p = this.pool.pop() || new Particle();
    const angle = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2;
    const speed = randRange(opts.minSpeed || 30, opts.maxSpeed || 160);
    p.init(
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color,
      randRange(opts.minRadius || 1.5, opts.maxRadius || 3.5),
      randRange(opts.minLife || 0.35, opts.maxLife || 0.8)
    );
    this.active.push(p);
  }

  burst(x, y, color, count, opts = {}) {
    for (let i = 0; i < count; i++) this.spawn(x, y, color, opts);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.update(dt);
      if (!p.active) {
        this.active.splice(i, 1);
        this.pool.push(p);
      }
    }
  }

  /** Batched by colour: one glow setup per colour instead of a save/restore
   *  and a shadow per particle (NC-13). */
  draw(ctx) {
    if (!this.active.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowBlur = 8;
    let color = null;
    for (const p of this.active) {
      if (p.color !== color) {
        color = p.color;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
      }
      p.drawStreak(ctx);
    }
    ctx.restore();
  }
}

/** "+$n" label that rises and fades where a ball hit the core. */
class FloatText {
  /** `fontSize` is in world units, chosen by the game so the label keeps a
   *  readable screen size whatever the world scale. */
  constructor(x, y, text, color, fontSize) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.life = FLOAT_TEXT_LIFE;
    this.big = false;
  }

  update(dt) {
    this.y -= 28 * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / FLOAT_TEXT_LIFE, 0, 1);
    if (this.big) {
      // Event labels get a graphite backing so they stay readable over a
      // shattering core (NC-ART-1).
      ctx.font = `bold ${this.fontSize.toFixed(2)}px "Segoe UI", Arial, sans-serif`;
      const m = typeof ctx.measureText === 'function' ? ctx.measureText(this.text) : null;
      const w = (m && m.width ? m.width : this.text.length * this.fontSize * 0.6) + this.fontSize * 1.2;
      const h = this.fontSize * 1.6;
      ctx.fillStyle = COLORS.plateDark;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(0.5, this.fontSize * 0.08);
      ctx.beginPath();
      chamferPath(ctx, this.x - w / 2, this.y - h / 2, w, h, [h * 0.3, 0, h * 0.3, 0]);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.font = `bold ${this.fontSize.toFixed(2)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

/** Expanding neon ring (relay shockwave, core shatter, aim feedback). */
class Ring {
  constructor(x, y, radius, color, life, width) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.width = width;
  }

  update(dt) {
    this.life -= dt;
  }

  /** A thin ring with a hexagonal echo inside: the game's shockwaves are
   *  angular like its armour, not plain circles. */
  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    const r = Math.max(0.1, this.radius * (1 - t * t));
    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (0.4 + t * 0.6);
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (r > 6) {
      ctx.globalAlpha = t * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      polygonPath(ctx, this.x, this.y, r * 0.82, 6, Math.PI / 6 + (1 - t) * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** A volley lance: a piercing magenta beam from a turret, fading in 0.35 s.
 *  Signature effect "signal fracture": as it fades the beam splits into a
 *  cyan and an amber ghost on either side. */
class Lance {
  constructor(x0, y0, x1, y1, color) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.color = color;
    this.life = 0.35;
  }

  update(dt) {
    this.life -= dt;
  }

  draw(ctx) {
    const t = clamp(this.life / 0.35, 0, 1);
    const dx = this.x1 - this.x0;
    const dy = this.y1 - this.y0;
    const len = Math.hypot(dx, dy) || 1;
    const split = (1 - t) * 3.5;
    const px = (-dy / len) * split;
    const py = (dx / len) * split;
    ctx.save();
    ctx.lineCap = 'round';
    // Chromatic ghosts (no shadow: cheap).
    ctx.lineWidth = 1;
    ctx.globalAlpha = t * 0.8;
    ctx.strokeStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.moveTo(this.x0 + px, this.y0 + py);
    ctx.lineTo(this.x1 + px, this.y1 + py);
    ctx.stroke();
    ctx.strokeStyle = COLORS.amber;
    ctx.beginPath();
    ctx.moveTo(this.x0 - px, this.y0 - py);
    ctx.lineTo(this.x1 - px, this.y1 - py);
    ctx.stroke();
    // The beam.
    ctx.globalAlpha = t;
    ctx.strokeStyle = this.color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = this.color;
    ctx.lineWidth = 1 + 5 * t;
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(this.x1, this.y1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1.6 * t;
    ctx.stroke();
    // Pierce mark where the beam ends: a small X.
    const k = 2 + 4 * t;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x1 - k, this.y1 - k);
    ctx.lineTo(this.x1 + k, this.y1 + k);
    ctx.moveTo(this.x1 + k, this.y1 - k);
    ctx.lineTo(this.x1 - k, this.y1 + k);
    ctx.stroke();
    ctx.restore();
  }
}

/** Relay surge (NC-ART-1): a jagged amber arc from a broken relay to a
 *  turret — the visible link between a relay and the volley recharge. */
class Arc {
  constructor(x0, y0, x1, y1, seed) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.seed = seed;
    this.life = 0.4;
  }

  update(dt) {
    this.life -= dt;
  }

  draw(ctx) {
    const t = clamp(this.life / 0.4, 0, 1);
    // The arc travels: its head reaches the turret in the first third.
    const reach = Math.min(1, (1 - t) * 3 + 0.05);
    const x1 = this.x0 + (this.x1 - this.x0) * reach;
    const y1 = this.y0 + (this.y1 - this.y0) * reach;
    const seed = this.seed + Math.floor(t * 12) * 977;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = COLORS.amber;
    ctx.shadowColor = COLORS.amber;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    jaggedPath(ctx, this.x0, this.y0, x1, y1, 9, 5, seed);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Synthesised Web Audio effects (no audio files). The AudioContext is
 * created on the first user gesture (autoplay rules) and resumed on every
 * gesture (iOS interruptions). Each sound has a minimum gap, so a field full
 * of balls cannot flood the mixer. Mute persists under AUDIO_PREF_KEY.
 * Everything is guarded: no AudioContext (old browser, the QA harness) =
 * silent game, never an error.
 */
class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastPlayed = Object.create(null);
    try {
      this.muted = localStorage.getItem(AUDIO_PREF_KEY) === 'muted';
    } catch (err) {
      // No storage: default (sound on), nothing to remember.
    }
  }

  /** Call inside a user gesture handler. */
  unlock() {
    if (!this.ctx) {
      const AC = typeof AudioContext !== 'undefined' ? AudioContext
        : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null); // eslint-disable-line no-undef
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state !== 'running' && this.ctx.resume) this.ctx.resume().catch(() => {});
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) this.ctx.suspend().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    try {
      localStorage.setItem(AUDIO_PREF_KEY, muted ? 'muted' : 'on');
    } catch (err) {
      // Preference not remembered; the game goes on.
    }
  }

  /** One tone: oscillator type, start/end frequency, duration, volume. */
  tone(type, f0, f1, dur, vol, delay = 0) {
    const ac = this.ctx;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  play(name) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const gaps = { hit: 0.07, break: 0.06, volley: 0.1, ready: 0.5, relay: 0.15, shatter: 0.5, buy: 0.05, deny: 0.25, level: 0.5 };
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed[name] || -1) < (gaps[name] || 0.05)) return;
    this.lastPlayed[name] = now;
    try {
      switch (name) {
        // Pitch from the clock, not Math.random (the simulation's RNG must
        // not depend on whether sound is on).
        case 'hit': this.tone('sine', 620 + ((now * 7919) % 1) * 280, 420, 0.05, 0.05); break;
        case 'break': this.tone('square', 260, 70, 0.12, 0.06); break;
        case 'volley': this.tone('sawtooth', 1100, 160, 0.28, 0.09); this.tone('sine', 220, 60, 0.3, 0.12); break;
        case 'ready': this.tone('triangle', 660, 660, 0.08, 0.08); this.tone('triangle', 990, 990, 0.12, 0.08, 0.09); break;
        case 'relay': this.tone('triangle', 300, 1400, 0.22, 0.1); break;
        case 'shatter': this.tone('sine', 140, 35, 0.7, 0.22); this.tone('sawtooth', 600, 80, 0.5, 0.06); break;
        case 'buy': this.tone('square', 520, 520, 0.06, 0.05); this.tone('square', 780, 780, 0.09, 0.05, 0.06); break;
        case 'deny': this.tone('sine', 180, 140, 0.08, 0.05); break;
        case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.07, i * 0.07)); break;
        default: break;
      }
    } catch (err) {
      // A failing node must never stop the game.
    }
  }
}

class Block {
  constructor(offsetX, offsetY, size, maxHp, moneyPerHit, color) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.size = size;
    // Geometry as generated for the level; resize scales from these (NC-15).
    this.baseOffsetX = offsetX;
    this.baseOffsetY = offsetY;
    this.baseSize = size;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.moneyPerHit = moneyPerHit;
    this.color = color;
    this.alive = true;
    this.x = 0;
    this.y = 0;
    this.hitFlash = 0;
    // 'armor' | 'relay' | 'heart' (NC-ORIGINAL-1).
    this.kind = 'armor';
    // Seconds until the shatter wave breaks this block (null = not shattering).
    this.shatter = null;
    // Cosmetic only (NC-ART-1): armour layer (0 = outer, 1 = inner shield
    // around the heart), a stable seed for its circuit pattern and cracks,
    // and the plate corner that points away from the heart (cut deeper, so
    // the core reads as overlapping scales radiating from its centre).
    this.layer = 0;
    this.seed = (Math.imul(Math.round(offsetX * 8), 73856093) ^ Math.imul(Math.round(offsetY * 8), 19349663)) | 0;
    const sx = offsetX === 0 ? (hash01(this.seed) < 0.5 ? -1 : 1) : Math.sign(offsetX);
    const sy = offsetY === 0 ? (hash01(this.seed + 7) < 0.5 ? -1 : 1) : Math.sign(offsetY);
    this.outCorner = sy < 0 ? (sx < 0 ? 0 : 1) : (sx < 0 ? 3 : 2);
    this.variant = Math.floor(hash01(this.seed + 13) * 3);
  }

  /** Damage stage 0 (intact) .. 3 (nearly broken): cracks and edge light. */
  get damageStage() {
    const r = this.hp / this.maxHp;
    return r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
  }

  /** Corner cuts of the armour plate (world units) for chamferPath. */
  plateCuts(inset) {
    const s = this.size - inset * 2;
    const c = [s * 0.08, s * 0.08, s * 0.08, s * 0.08];
    c[this.outCorner] = s * 0.24;
    return c;
  }

  platePath(ctx, inset) {
    chamferPath(ctx, this.x + inset, this.y + inset, this.size - inset * 2, this.size - inset * 2, this.plateCuts(inset));
  }

  /** The slab's raised top face: inset and nudged toward the top-left. */
  facePath(ctx) {
    const i = Math.max(1.5, this.size * 0.11);
    const d = this.size * 0.05;
    chamferPath(ctx, this.x + i - d, this.y + i - d, this.size - i * 2, this.size - i * 2, this.plateCuts(i));
  }

  /** Honeycomb cell texture in `color` (cached; null where an offscreen
   *  canvas or patterns are unavailable, e.g. the QA harness). */
  static cellPattern(ctx, color) {
    Block.patterns = Block.patterns || new Map();
    if (Block.patterns.has(color)) return Block.patterns.get(color);
    let pattern = null;
    try {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof ctx.createPattern === 'function') {
        const r = 3;
        const w = r * 3;
        const h = Math.sqrt(3) * r;
        const scale = 4;
        const c = document.createElement('canvas');
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        const g = c.getContext('2d');
        g.scale(c.width / w, c.height / h);
        g.strokeStyle = color;
        g.globalAlpha = 0.35;
        g.lineWidth = 0.35;
        g.beginPath();
        for (const [ox, oy] of [[0, 0], [w, 0], [0, h], [w, h], [1.5 * r, h / 2]]) polygonPath(g, ox, oy, r * 0.92, 6, 0);
        g.stroke();
        pattern = ctx.createPattern(c, 'repeat') || null;
        if (pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
          pattern.setTransform(new DOMMatrix().scale(w / c.width, h / c.height));
        }
      }
    } catch (err) {
      pattern = null;
    }
    Block.patterns.set(color, pattern);
    return pattern;
  }

  /** The plate's lit rim: the two edges around its outward corner (the side
   *  that faces the turrets), drawn brighter than the rest of the outline. */
  litPath(ctx, inset) {
    const x = this.x + inset;
    const y = this.y + inset;
    const s = this.size - inset * 2;
    const c = this.plateCuts(inset);
    const p = [
      x + c[0], y, x + s - c[1], y, x + s, y + c[1], x + s, y + s - c[2],
      x + s - c[2], y + s, x + c[3], y + s, x, y + s - c[3], x, y + c[0],
    ];
    const k = this.outCorner;
    for (let i = 0; i < 4; i++) {
      const j = ((2 * k - 2 + i) % 8 + 8) % 8;
      if (i === 0) ctx.moveTo(p[j * 2], p[j * 2 + 1]);
      else ctx.lineTo(p[j * 2], p[j * 2 + 1]);
    }
  }

  /** Micro-circuit: the plate's node (where the neural lattice attaches:
   *  Game.drawNetwork) and one of three slot patterns. Armour only. */
  tracePath(ctx) {
    const s = this.size;
    const cx = this.cx;
    const cy = this.cy;
    // Inward axis (toward the heart), snapped to the plate's major axis.
    const horiz = Math.abs(this.offsetX) >= Math.abs(this.offsetY);
    const ix = horiz ? -Math.sign(this.offsetX || 1) : 0;
    const iy = horiz ? 0 : -Math.sign(this.offsetY || 1);
    const px = -iy;
    const py = ix;
    const n = s * 0.07;
    ctx.rect(cx - n, cy - n, n * 2, n * 2);
    const slot = (d, w) => {
      ctx.moveTo(cx - ix * s * d + px * s * w, cy - iy * s * d + py * s * w);
      ctx.lineTo(cx - ix * s * d - px * s * w, cy - iy * s * d - py * s * w);
    };
    if (this.variant === 0) { slot(0.2, 0.22); slot(0.3, 0.16); }
    else if (this.variant === 1) { slot(0.26, 0.26); }
    else {
      ctx.moveTo(cx + px * n, cy + py * n);
      ctx.lineTo(cx + px * s * 0.26, cy + py * s * 0.26);
      ctx.lineTo(cx + px * s * 0.26 - ix * s * 0.24, cy + py * s * 0.26 - iy * s * 0.24);
    }
  }

  /** Cracks for the current damage stage: up to 3 jagged lines from one
   *  fixed impact point toward the plate's edges (they grow with damage). */
  crackPath(ctx, stage) {
    const s = this.size;
    const ox = this.x + s * (0.3 + 0.4 * hash01(this.seed + 21));
    const oy = this.y + s * (0.3 + 0.4 * hash01(this.seed + 22));
    for (let i = 0; i < stage; i++) {
      const a = hash01(this.seed + 30 + i) * Math.PI * 2;
      const len = s * (0.3 + 0.12 * stage);
      const ex = clamp(ox + Math.cos(a) * len, this.x + 1, this.x + s - 1);
      const ey = clamp(oy + Math.sin(a) * len, this.y + 1, this.y + s - 1);
      jaggedPath(ctx, ox, oy, ex, ey, 3, s * 0.07, this.seed + 40 + i * 17);
    }
  }

  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

  applyCenter(cx, cy) {
    this.x = cx + this.offsetX - this.size / 2;
    this.y = cy + this.offsetY - this.size / 2;
  }

  applyScale(scale) {
    this.offsetX = this.baseOffsetX * scale;
    this.offsetY = this.baseOffsetY * scale;
    this.size = this.baseSize * scale;
  }

  takeHit(damage) {
    this.hp -= damage;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
  }

  /** Draws this block alone (the game draws the whole core in batches:
   *  Block.drawCore). */
  draw(ctx, time) {
    Block.drawCore(ctx, [this], time, false);
  }

  /**
   * Draws a set of blocks in batches (NC-ART-1): one path per pass and
   * colour instead of a save/restore and a shadow per block (NC-13).
   * Armour = graphite plates (chamfered, the outward corner cut deeper), an
   * inner panel line, circuit traces, a glowing edge in the layer colour that
   * dims with damage, cracks that grow with damage; relays and the heart have
   * their own silhouettes; broken blocks split into four shards.
   */
  static drawCore(ctx, blocks, time, reducedMotion, underlay) {
    const armour = [];
    const relays = [];
    const hearts = [];
    const dying = [];
    for (const b of blocks) {
      if (!b.alive) dying.push(b);
      else if (b.kind === 'heart') hearts.push(b);
      else if (b.kind === 'relay') relays.push(b);
      else armour.push(b);
    }
    ctx.save();
    ctx.lineJoin = 'round';
    if (armour.length || relays.length) {
      // 1. Slab bodies: the dark sides of each armour slab (relays get a
      //    darker housing).
      ctx.fillStyle = COLORS.plateDark;
      ctx.beginPath();
      for (const b of armour) b.platePath(ctx, 0.5);
      for (const b of relays) chamferPath(ctx, b.x + 0.5, b.y + 0.5, b.size - 1, b.size - 1, [b.size * 0.2, b.size * 0.2, b.size * 0.2, b.size * 0.2]);
      ctx.fill();
      // 2. Raised top face, nudged toward the top-left so the bottom-right
      //    wall shows (a faceted slab, not a flat tile), with a lit bevel.
      ctx.fillStyle = COLORS.plateFace;
      ctx.beginPath();
      for (const b of armour) b.facePath(ctx);
      ctx.fill();
      ctx.strokeStyle = COLORS.plateHi;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 3. Circuit traces and 4. glowing edges, per colour and damage stage.
    const groups = new Map();
    for (const b of armour) {
      const key = `${b.color}|${b.damageStage}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    ctx.lineWidth = 1;
    for (const [key, list] of groups) {
      const color = key.split('|')[0];
      // Material: a honeycomb cell texture on the face (cached pattern, one
      // fill per colour) and circuits in the layer colour (no glow: cheap).
      const pattern = Block.cellPattern(ctx, color);
      ctx.fillStyle = pattern || color;
      ctx.globalAlpha = pattern ? 0.5 : 0.07;
      ctx.beginPath();
      for (const b of list) b.facePath(ctx);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      for (const b of list) b.tracePath(ctx);
      ctx.stroke();
    }
    // The neural lattice runs over the plate bodies, under their rims.
    if (underlay) underlay(ctx);
    // The glow is a wide translucent underlay stroked on the same path, not
    // shadowBlur: a blurred core-sized batch cost ~3 ms per frame at
    // 1920x1080 in software raster (NC-13).
    ctx.shadowBlur = 0;
    for (const [key, list] of groups) {
      const [color, stageText] = key.split('|');
      const stage = Number(stageText);
      const light = [1, 0.8, 0.62, 0.48][stage] * (stage === 3 && !reducedMotion ? 0.85 + 0.15 * Math.sin(time * 9) : 1);
      ctx.strokeStyle = color;
      // Dim full outline, then the bright lit rim with its glow.
      ctx.lineWidth = 1;
      ctx.globalAlpha = light * 0.55;
      ctx.beginPath();
      for (const b of list) b.platePath(ctx, 0.5);
      ctx.stroke();
      ctx.beginPath();
      for (const b of list) b.litPath(ctx, 0.5);
      ctx.lineWidth = 5;
      ctx.globalAlpha = light * 0.2;
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = light;
      ctx.stroke();
      if (stage > 0) {
        // 5. Cracks: the breach (magenta) burning through, white-hot core.
        ctx.beginPath();
        for (const b of list) b.crackPath(ctx, stage);
        ctx.strokeStyle = COLORS.magenta;
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 1;
        ctx.stroke();
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    // 6. Shatter wave pending: the plate's edge turns white.
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = COLORS.white;
    ctx.beginPath();
    let marked = false;
    for (const b of armour) if (b.shatter !== null) { b.platePath(ctx, 0.5); marked = true; }
    if (marked) ctx.stroke();
    // 7. Hit flashes: a white edge that fades in 0.25 s.
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    for (const b of armour) {
      if (b.hitFlash <= 0) continue;
      ctx.globalAlpha = b.hitFlash * 0.9;
      ctx.beginPath();
      b.platePath(ctx, 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of relays) b.drawRelay(ctx, time, reducedMotion);
    for (const b of hearts) b.drawHeart(ctx, time, reducedMotion);
    if (dying.length) Block.drawShards(ctx, dying);
    ctx.restore();
  }

  /** A broken block flies apart as four triangular shards (centre to each
   *  edge), drifting outward while it fades (hitFlash 1 -> 0 in 0.25 s). */
  static drawShards(ctx, dying) {
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
    for (const b of dying) {
      const t = b.hitFlash;
      if (t <= 0) continue;
      const s = b.size;
      const d = (1 - t) * s * 0.6;
      const cx = b.cx;
      const cy = b.cy;
      ctx.globalAlpha = t;
      ctx.fillStyle = COLORS.plate;
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const nx = i === 1 ? 1 : i === 3 ? -1 : 0;
        const ny = i === 0 ? -1 : i === 2 ? 1 : 0;
        const ox = cx + nx * d + ny * d * 0.25;
        const oy = cy + ny * d - nx * d * 0.25;
        const h = s * 0.5 * (0.6 + 0.4 * t);
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + nx * h - ny * h, oy + ny * h + nx * h);
        ctx.lineTo(ox + nx * h + ny * h, oy + ny * h - nx * h);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Relay: a hexagonal capacitor in a dark chamfered housing, an amber
   *  charge that pulses and three terminals; dims as it is damaged. */
  drawRelay(ctx, time, reducedMotion) {
    const s = this.size;
    const cx = this.cx;
    const cy = this.cy;
    const stage = this.damageStage;
    const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * 5 + this.seed);
    const r = s * 0.42;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.amber;
    ctx.shadowColor = COLORS.amber;
    // Housing edge (faint) and terminals.
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    chamferPath(ctx, this.x + 0.5, this.y + 0.5, s - 1, s - 1, [s * 0.2, s * 0.2, s * 0.2, s * 0.2]);
    for (let i = 0; i < 6; i += 2) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5);
    }
    ctx.stroke();
    // Hexagon shell.
    ctx.globalAlpha = [1, 0.85, 0.7, 0.55][stage];
    ctx.shadowBlur = 10 + this.hitFlash * 10;
    ctx.lineWidth = 1.7;
    ctx.fillStyle = COLORS.plate;
    ctx.beginPath();
    polygonPath(ctx, cx, cy, r, 6, -Math.PI / 2);
    ctx.fill();
    ctx.stroke();
    // Charge cell.
    ctx.fillStyle = COLORS.amber;
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.beginPath();
    polygonPath(ctx, cx, cy, r * 0.55, 6, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.white;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    polygonPath(ctx, cx, cy, Math.max(1, r * 0.2), 4, 0);
    ctx.fill();
    if (stage > 0) {
      ctx.shadowBlur = 4;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      this.crackPath(ctx, stage);
      ctx.stroke();
    }
    if (stage >= 2) {
      // Overload: arcs crawl over the shell (the relay is about to blow).
      const tick = reducedMotion ? 1 : Math.floor(time * 14);
      ctx.strokeStyle = COLORS.amber;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < stage - 1; i++) {
        const a = hash01(this.seed + tick * 7 + i) * Math.PI * 2;
        const a2 = a + 1.1;
        jaggedPath(ctx, cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, cx + Math.cos(a2) * r * 1.2, cy + Math.sin(a2) * r * 1.2, 3, s * 0.08, this.seed + tick + i * 5);
      }
      ctx.stroke();
    }
    if (this.hitFlash > 0) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = this.hitFlash;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.beginPath();
      polygonPath(ctx, cx, cy, r, 6, -Math.PI / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The heart: the AI's prime module, a "fracture sigil" (NC-ART-1). An
   * octagonal amber housing; a seal of six rotating segments that fall away
   * as the heart loses HP; inside, a faceted amber crystal split in two
   * halves around a seam of light holding three data cells. The halves part and the cells brighten as the heart weakens, so
   * its state reads at a glance (closed = full HP, wide open = about to
   * break). The rogue AI's prime module: a geometric sign, not a face or eye.
   */
  drawHeart(ctx, time, reducedMotion) {
    const hp = clamp(this.hp / this.maxHp, 0, 1);
    const open = 1 - hp;
    const s = this.size / 2;
    const cx = this.x + s;
    const cy = this.y + s;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3.2);
    const c = this.size * 0.28;
    ctx.save();
    ctx.lineJoin = 'round';
    // Housing.
    ctx.fillStyle = COLORS.plateDark;
    ctx.strokeStyle = COLORS.amber;
    ctx.shadowColor = COLORS.amber;
    ctx.shadowBlur = 12 + pulse * 6 + this.hitFlash * 18;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    chamferPath(ctx, this.x + 0.5, this.y + 0.5, this.size - 1, this.size - 1, [c, c, c, c]);
    ctx.fill();
    ctx.stroke();
    // Seal: six segments, one lost per sixth of HP.
    const segments = Math.ceil(hp * 6 - 1e-9);
    const spin = reducedMotion ? 0 : time * 0.6;
    ctx.lineWidth = Math.max(1.2, s * 0.1);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let i = 0; i < segments; i++) {
      const a = spin + (i / 6) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * s * 0.74, cy + Math.sin(a) * s * 0.74);
      ctx.arc(cx, cy, s * 0.74, a, a + 0.72);
    }
    ctx.stroke();
    // Split crystal: two faceted amber halves (light upper facets, deep
    // lower facets: a solid, glowing energy crystal).
    const H = s * 0.6;
    const W = s * 0.42;
    const g = s * (0.05 + 0.3 * open);
    ctx.shadowBlur = 8 + 6 * pulse;
    ctx.fillStyle = '#ffd25a';
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(cx + sx * g, cy - H);
      ctx.lineTo(cx + sx * (g + W), cy);
      ctx.lineTo(cx + sx * g, cy);
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b8650a';
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(cx + sx * g, cy);
      ctx.lineTo(cx + sx * (g + W), cy);
      ctx.lineTo(cx + sx * g, cy + H);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = '#fff1c4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(cx + sx * g, cy - H);
      ctx.lineTo(cx + sx * (g + W), cy);
      ctx.lineTo(cx + sx * g, cy + H);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.shadowColor = COLORS.amber;
    // In the fracture: the module's three data cells on a light seam
    // (a column of nodes, deliberately not an eye). They brighten and drift
    // apart as the heart opens.
    const cell = Math.max(0.8, s * (0.1 + 0.06 * open));
    const gapY = H * (0.42 + 0.2 * open);
    ctx.globalAlpha = 0.5 + 0.5 * open;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = Math.max(0.6, g * 0.35);
    ctx.shadowBlur = 8 + 14 * open;
    ctx.beginPath();
    ctx.moveTo(cx, cy - H * 0.92);
    ctx.lineTo(cx, cy + H * 0.92);
    ctx.stroke();
    ctx.globalAlpha = 0.75 + 0.25 * open;
    ctx.fillStyle = COLORS.white;
    ctx.shadowBlur = 10 + 16 * open + pulse * 4;
    ctx.beginPath();
    for (const k of [-1, 0, 1]) polygonPath(ctx, cx, cy + k * gapY, cell * (k === 0 ? 1.35 : 1), 4, 0);
    ctx.fill();
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.beginPath();
      chamferPath(ctx, this.x + 0.5, this.y + 0.5, this.size - 1, this.size - 1, [c, c, c, c]);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Ball {
  constructor(x, y, angle, speed, radius, color) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed;
    this.radius = radius;
    this.color = color;
    this.trailTimer = 0;
    this.flash = 0;
  }

  normalizeSpeed() {
    const mag = Math.hypot(this.vx, this.vy) || 1;
    const scale = this.speed / mag;
    this.vx *= scale;
    this.vy *= scale;
  }

  bounceWalls(width, height) {
    let bounced = false;
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
      bounced = true;
    } else if (this.x + this.radius > width) {
      this.x = width - this.radius;
      this.vx = -Math.abs(this.vx);
      bounced = true;
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
      bounced = true;
    } else if (this.y + this.radius > height) {
      this.y = height - this.radius;
      this.vy = -Math.abs(this.vy);
      bounced = true;
    }
    if (bounced) {
      const jitter = randRange(-0.12, 0.12);
      const cosA = Math.cos(jitter);
      const sinA = Math.sin(jitter);
      const vx = this.vx * cosA - this.vy * sinA;
      const vy = this.vx * sinA + this.vy * cosA;
      this.vx = vx;
      this.vy = vy;
      this.normalizeSpeed();
    }
  }

  collideBlock(block) {
    const closestX = clamp(this.x, block.x, block.x + block.size);
    const closestY = clamp(this.y, block.y, block.y + block.size);
    const dx = this.x - closestX;
    const dy = this.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= this.radius * this.radius) return null;

    let nx, ny, push;
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      nx = dx / dist;
      ny = dy / dist;
      push = this.radius - dist;
    } else {
      // Centre inside the block (level regenerated or resized on top of the
      // ball): leave through the nearest face, fully (NC-02).
      const overlapLeft = this.x - block.x;
      const overlapRight = block.x + block.size - this.x;
      const overlapTop = this.y - block.y;
      const overlapBottom = block.y + block.size - this.y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapLeft) { nx = -1; ny = 0; }
      else if (minOverlap === overlapRight) { nx = 1; ny = 0; }
      else if (minOverlap === overlapTop) { nx = 0; ny = -1; }
      else { nx = 0; ny = 1; }
      push = minOverlap + this.radius;
      this.x += nx * (push + 0.5);
      this.y += ny * (push + 0.5);
      push = null; // already resolved
    }

    const dot = this.vx * nx + this.vy * ny;
    // Only an approaching ball bounces and scores (NC-01); one already moving
    // away keeps its velocity and simply leaves the contact.
    if (dot >= 0) return null;

    this.vx = this.vx - 2 * dot * nx;
    this.vy = this.vy - 2 * dot * ny;
    this.normalizeSpeed();

    if (push !== null) {
      this.x += nx * (push + 0.5);
      this.y += ny * (push + 0.5);
    }

    return { x: closestX, y: closestY };
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
  }

  draw(ctx) {
    Ball.drawAll(ctx, [this]);
  }

  /** All balls in batched passes (NC-ART-1): a short motion trail, a soft
   *  halo, a rim in the ball's colour and a white-hot centre. The glow is a
   *  translucent halo instead of shadowBlur: a blurred batch spanning the
   *  whole field cost ~22 ms per frame at 1920x1080 with 60 balls in software
   *  raster (NC-13); the halo costs almost nothing and looks the same at
   *  this size. Balls stay the brightest small objects on the field. */
  static drawAll(ctx, balls) {
    if (!balls.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    const byColor = new Map();
    for (const b of balls) {
      const key = b.flash > 0 ? COLORS.white : b.color;
      if (!byColor.has(key)) byColor.set(key, []);
      byColor.get(key).push(b);
    }
    for (const [color, list] of byColor) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04);
      }
      ctx.stroke();
      const halo = color === COLORS.white ? 2.8 : 1.95;
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x + b.radius * halo, b.y);
        ctx.arc(b.x, b.y, b.radius * halo, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x + b.radius * 1.4, b.y);
        ctx.arc(b.x, b.y, b.radius * 1.4, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x + b.radius, b.y);
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    for (const b of balls) {
      ctx.moveTo(b.x + b.radius * 0.55, b.y);
      ctx.arc(b.x, b.y, b.radius * 0.55, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

class Turret {
  constructor(offsetX, offsetY, angle, color) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.angle = angle;
    this.color = color;
    // Unit direction from the core centre (set by placeTurrets).
    this.dirX = 0;
    this.dirY = 0;
    this.x = 0;
    this.y = 0;
    this.cooldown = 0;
    this.flash = 0;
  }

  applyCenter(cx, cy) {
    this.x = cx + this.offsetX;
    this.y = cy + this.offsetY;
  }

  update(dt, game) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.cooldown -= dt * 1000;
    if (this.cooldown <= 0) {
      this.cooldown = game.fireInterval;
      if (game.balls.length < game.maxBalls) {
        game.spawnBallFromTurret(this);
        this.flash = 1;
      }
    }
  }

  /** `charge` 0..1 = the volley meter: the turret glows brighter while it
   *  charges and pulses white when the volley is ready. */
  /**
   * "Fork emitter" (NC-ART-1): a round pad with a cyan rim, a hexagonal
   * graphite base, two rails aimed at the core, a magenta capacitor between
   * the rails that fills with the
   * volley charge and a four-segment charge ring around the base. Ready: the
   * capacitor is full, a spark jumps between the rail tips and the ring
   * pulses. Firing: a white flash at the muzzle.
   */
  draw(ctx, charge, time, reducedMotion) {
    const ready = charge >= 1;
    const pulse = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(time * 6);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.lineJoin = 'round';
    // Pad: a round graphite platform with a cyan rim.
    ctx.fillStyle = COLORS.plateDark;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Charge ring: four quarter segments around the base (breach magenta).
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    for (let i = 0; i < 4; i++) {
      const fill = clamp(charge * 4 - i, 0, 1);
      const a = Math.PI + i * (Math.PI / 2) + 0.12;
      ctx.globalAlpha = 0.18;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, 13, a, a + Math.PI / 2 - 0.24);
      ctx.stroke();
      if (fill > 0) {
        ctx.globalAlpha = ready ? 0.6 + 0.4 * pulse : 0.9;
        ctx.shadowBlur = ready ? 10 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, 13, a, a + (Math.PI / 2 - 0.24) * fill);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // Rails.
    ctx.fillStyle = COLORS.plate;
    ctx.strokeStyle = COLORS.ice;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 6 + this.flash * 12;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(1, side * 3);
      ctx.lineTo(15, side * 3.2);
      ctx.lineTo(17, side * 5.2);
      ctx.lineTo(3, side * 7.5);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    // Base.
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    polygonPath(ctx, 0, 0, 8.5, 6, 0);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.plateHi;
    ctx.lineWidth = 1;
    ctx.beginPath();
    polygonPath(ctx, 0, 0, 5, 6, 0);
    ctx.stroke();
    // Capacitor between the rails.
    ctx.fillStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = ready ? 12 : 5;
    ctx.globalAlpha = ready ? 0.75 + 0.25 * pulse : 0.85;
    ctx.fillRect(2, -1.4, 13 * clamp(charge, 0, 1), 2.8);
    ctx.globalAlpha = 1;
    if (ready) {
      // Spark between the rail tips (deterministic: changes 12x per second).
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      jaggedPath(ctx, 16.5, -4.6, 16.5, 4.6, 4, 2.2, reducedMotion ? 3 : Math.floor(time * 12));
      ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = this.flash;
      ctx.shadowColor = COLORS.white;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      polygonPath(ctx, 19, 0, 2 + 4 * this.flash, 4, 0);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.wrapper = canvas.parentElement;

    // World size (units); the canvas shows it scaled by viewScale (>= 1).
    this.width = 0;
    this.height = 0;
    this.viewScale = 1;
    this.dpr = 1;

    this.cash = 0;
    this.level = 1;
    this.maxBalls = 1;
    this.fireRateLevel = 1;
    this.damageLevel = 1;

    this.blocks = [];
    this.balls = [];
    this.turrets = [];
    this.particles = new ParticlePool(MAX_PARTICLES);
    this.floatTexts = [];
    // Total HP of the level's core as generated (progress bar).
    this.coreTotalHp = 0;
    // The level's armour block HP, money per hit and grid step (breach maths).
    this.blockHp = 10;
    this.blockMoney = 1;
    this.blockStep = 0;

    // Ball refill interval (fixed) and volley charge time (charge upgrade).
    this.fireInterval = BALL_REFILL_INTERVAL;
    this.chargeTime = VOLLEY_BASE_CHARGE;

    // Volley state (session only, never saved).
    this.volleyCharge = VOLLEY_START_CHARGE;
    this.volleyReadyFor = 0;
    this.pendingVolley = null;
    this.manualVolleys = 0;
    this.autoVolleys = 0;
    this.coresShattered = 0;
    this.lances = [];
    this.rings = [];
    // Cosmetic effects (NC-ART-1): relay surge arcs, the breach finale, the
    // moment the current core was generated (assembly animation), the cached
    // background.
    this.arcs = [];
    this.breach = null;
    // Neural lattice of the current core (buildNetwork) and the volley's
    // synchronisation flash between the turrets.
    this.links = [];
    this.syncFlash = 0;
    // Lattice pulse phase; its speed follows the core's damage (refreshed
    // with the UI tick, so a hit never makes the pulses jump).
    this.netPhase = 0;
    this.netSpeed = 0.35;
    this.coreBornAt = -10;
    this.bgCanvas = null;
    this.bgKey = '';
    this.aim = null;
    this.banner = null;
    this.time = 0;
    this.screenFlash = 0;
    this.shake = 0;
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sound = new Sound();

    this.uiTimer = 0;
    this.saveTimer = 0;

    this.lastTime = 0;
    this.accumulator = 0;
    this.simSteps = 0; // fixed steps run so far (test seam, not saved)

    // Unscaled core geometry of the current level (fitCoreToCanvas).
    this.coreExtent = 0;
    this.coreRadius = 0;
    this.coreScale = 1;

    this.saveBlocked = false;
    this.lang = detectLanguage(
      typeof navigator !== 'undefined' ? navigator : null,
      typeof location !== 'undefined' ? location.search : ''
    );

    this.ui = {
      cashLabel: document.getElementById('labelCash'),
      levelLabel: document.getElementById('labelLevel'),
      buyBallTitle: document.getElementById('titleBuyBall'),
      fireRateTitle: document.getElementById('titleFireRate'),
      damageTitle: document.getElementById('titleDamage'),
      cash: document.getElementById('statCash'),
      level: document.getElementById('statLevel'),
      buyBall: document.getElementById('btnBuyBall'),
      buyBallDesc: document.getElementById('descBuyBall'),
      buyBallCost: document.getElementById('costBuyBall'),
      fireRate: document.getElementById('btnFireRate'),
      fireRateDesc: document.getElementById('descFireRate'),
      fireRateCost: document.getElementById('costFireRate'),
      damage: document.getElementById('btnDamage'),
      damageDesc: document.getElementById('descDamage'),
      damageCost: document.getElementById('costDamage'),
      hint: document.getElementById('hint'),
      mute: document.getElementById('btnMute'),
    };

    this.applyLanguage();
    this.loadSave();
    this.recalcFireInterval();
    this.bindUpgradeButtons();
    this.bindFieldInput();
    this.bindMuteButton();
    this.bindResize();
    this.bindPersistenceHooks();

    this.resize(true);
    this.generateCore(this.level);
    this.spawnInitialBalls();
    this.updateUI();

    requestAnimationFrame((t) => this.loop(t));
  }

  get ballDamage() {
    return this.damageLevel;
  }

  /** Power of one turret's lance (HP it can remove along its line). */
  get lancePower() {
    return LANCE_POWER * this.ballDamage;
  }

  get volleyReady() {
    return this.volleyCharge >= 1;
  }

  costFor(base, level) {
    return Math.ceil(base * Math.pow(1.5, level - 1));
  }

  get ballCost() { return this.costFor(10, this.maxBalls); }
  get fireRateCost() { return this.costFor(15, this.fireRateLevel); }
  get damageCost() { return this.costFor(15, this.damageLevel); }

  /** The saved `fireRateLevel` is the volley-charge upgrade level (NC-10:
   *  the old fire rate did nothing once the field was full). Ball refill is
   *  a fixed BALL_REFILL_INTERVAL. */
  recalcFireInterval() {
    this.fireInterval = BALL_REFILL_INTERVAL;
    this.chargeTime = Math.max(VOLLEY_MIN_CHARGE, VOLLEY_BASE_CHARGE * Math.pow(VOLLEY_CHARGE_FACTOR, this.fireRateLevel - 1));
  }

  t(key, vars) {
    return translate(this.lang, key, vars);
  }

  /** Sets every static label to the current language (dynamic ones: updateUI). */
  applyLanguage() {
    if (document.documentElement) document.documentElement.lang = this.lang;
    this.ui.cashLabel.textContent = this.t('cash');
    this.ui.levelLabel.textContent = this.t('level');
    this.ui.buyBallTitle.textContent = this.t('buyBall');
    this.ui.fireRateTitle.textContent = this.t('fireRate');
    this.ui.damageTitle.textContent = this.t('damage');
    this.updateMuteButton();
  }

  loadSave() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      // Storage we cannot read must not be written over blindly.
      this.saveBlocked = true;
      console.warn('Neon Crusher: could not read the save; saving is off for this session:', err);
      return;
    }
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('Neon Crusher: the save is unreadable; keeping a copy and starting fresh:', err);
    }
    const { values, exact } = sanitizeSave(data);
    Object.assign(this, values);
    if (!exact) this.backupRawSave(raw);
  }

  /** Keeps the original save string before the game ever overwrites it.
   *  If even that fails, the session plays without saving. */
  backupRawSave(raw) {
    try {
      localStorage.setItem(SAVE_BACKUP_KEY, raw);
    } catch (err) {
      this.saveBlocked = true;
      console.warn('Neon Crusher: could not back up the save; saving is off for this session:', err);
    }
  }

  save() {
    if (this.saveBlocked) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        level: this.level,
        maxBalls: this.maxBalls,
        fireRateLevel: this.fireRateLevel,
        damageLevel: this.damageLevel,
      }));
    } catch (err) {
      console.warn('Neon Crusher: could not save:', err);
    }
  }

  bindPersistenceHooks() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.save();
        this.sound.suspend();
      }
    });
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('beforeunload', () => this.save());
  }

  bindResize() {
    window.addEventListener('resize', () => this.resize(false));
    window.addEventListener('orientationchange', () => this.resize(false));
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.resize(false));
      ro.observe(this.wrapper);
    }
  }

  resize(isInitial) {
    const rect = this.wrapper.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;
    // World scale (NC-09): a canvas whose short side exceeds WORLD_SHORT_SIDE
    // shows the same world enlarged; smaller canvases stay 1:1.
    const scale = Math.max(1, Math.min(width, height) / WORLD_SHORT_SIDE);

    const oldWidth = this.width;
    const oldHeight = this.height;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

    this.viewScale = scale;
    this.dpr = dpr;
    this.width = width / scale;
    this.height = height / scale;

    if (!isInitial && oldWidth > 0 && oldHeight > 0) {
      const scaleX = this.width / oldWidth;
      const scaleY = this.height / oldHeight;
      for (const ball of this.balls) {
        ball.x = clamp(ball.x * scaleX, ball.radius, this.width - ball.radius);
        ball.y = clamp(ball.y * scaleY, ball.radius, this.height - ball.radius);
      }
    }

    this.fitCoreToCanvas();
  }

  /** Scales the level's core down (never up past its generated size) so that
   *  blocks and turrets fit the canvas with TURRET_CLEARANCE between them,
   *  then places the turrets and re-centres everything. Called after every
   *  level generation and every resize; block HP and state are untouched
   *  (NC-14, NC-15). On canvases where the core already fits, scale = 1 and
   *  the geometry is exactly the generated one. */
  fitCoreToCanvas() {
    const half = Math.min(this.width, this.height) / 2;
    const room = half - TURRET_EDGE_INSET - TURRET_CLEARANCE;
    const scale = this.coreRadius > 0 ? clamp(room / this.coreRadius, 0.2, 1) : 1;
    this.coreScale = scale;
    for (const block of this.blocks) block.applyScale(scale);
    const dist = Math.min(this.coreExtent * scale + TURRET_MARGIN, half - TURRET_EDGE_INSET);
    for (const turret of this.turrets) {
      turret.offsetX = turret.dirX * dist;
      turret.offsetY = turret.dirY * dist;
    }
    this.repositionCoreAndTurrets();
    for (const ball of this.balls) this.ejectFromCore(ball);
  }

  /** A ball whose centre is inside a block (the level was generated or the
   *  core resized on top of it) is moved straight away from the core centre
   *  until it touches no block: no hit, no bounce (NC-02). Pushing it out of
   *  one block alone is not enough: grid gaps (5 px) are narrower than a ball. */
  ejectFromCore(ball) {
    const alive = this.blocks.filter((b) => b.alive);
    const embedded = (b) => ball.x > b.x && ball.x < b.x + b.size && ball.y > b.y && ball.y < b.y + b.size;
    if (!alive.some(embedded)) return;
    const touching = (b) => {
      const dx = ball.x - clamp(ball.x, b.x, b.x + b.size);
      const dy = ball.y - clamp(ball.y, b.y, b.y + b.size);
      return dx * dx + dy * dy < ball.radius * ball.radius;
    };
    let dx = ball.x - this.width / 2;
    let dy = ball.y - this.height / 2;
    if (Math.hypot(dx, dy) < 1e-6) { dx = ball.vx; dy = ball.vy; }
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 500 && alive.some(touching); i++) {
      ball.x += (dx / len) * 2;
      ball.y += (dy / len) * 2;
    }
    ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
    ball.y = clamp(ball.y, ball.radius, this.height - ball.radius);
  }

  repositionCoreAndTurrets() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (const block of this.blocks) block.applyCenter(cx, cy);
    for (const turret of this.turrets) turret.applyCenter(cx, cy);
  }

  gridLayout(level) {
    const n = Math.min(3 + Math.floor((level - 1) / 2), 7);
    const shortSide = Math.min(this.width, this.height);
    const size = clamp(Math.floor((shortSide * 0.55) / n) - 4, 16, 36);
    const gap = 5;
    const step = size + gap;
    const span = n * step - gap;
    const points = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        points.push({
          x: col * step - span / 2 + size / 2,
          y: row * step - span / 2 + size / 2,
        });
      }
    }
    return { points, size, n, extent: span / 2 + size };
  }

  circleLayout(level) {
    const size = clamp(Math.floor(Math.min(this.width, this.height) * 0.045), 18, 28);
    const rings = level >= 5 ? 2 : 1;
    const baseRadius = Math.min(this.width, this.height) * 0.2 + Math.min(level * 4, 60);
    const points = [];
    let maxR = 0;
    for (let ring = 0; ring < rings; ring++) {
      const r = baseRadius - ring * (size + 8);
      maxR = Math.max(maxR, r);
      const circumference = 2 * Math.PI * r;
      const count = Math.max(8, Math.floor(circumference / (size + 6)));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
    }
    return { points, size, extent: maxR + size };
  }

  generateCore(level) {
    this.blocks = [];
    const hpMul = Math.pow(1.5, level - 1);
    const moneyMul = Math.pow(1.5, level - 1);
    const maxHp = Math.max(1, Math.round(10 * hpMul));
    const moneyPerHit = Math.max(1, Math.round(1 * moneyMul));

    const useGrid = level % 2 === 1;
    const layout = useGrid ? this.gridLayout(level) : this.circleLayout(level);

    for (const p of layout.points) {
      this.blocks.push(new Block(p.x, p.y, layout.size, maxHp, moneyPerHit, COLORS.cyan));
    }
    this.blockHp = maxHp;
    this.blockMoney = moneyPerHit;
    this.blockStep = layout.size + (useGrid ? 5 : 8);
    this.placeHeart(layout, useGrid, maxHp, moneyPerHit);
    this.markInnerShield(layout, useGrid);
    this.placeRelays(level);
    this.buildNetwork();
    this.coreBornAt = this.time;
    this.coreTotalHp = this.blocks.reduce((sum, b) => sum + b.maxHp, 0);

    // Half-size of the core's bounding box, measured from the generated blocks.
    this.coreRadius = 0;
    for (const b of this.blocks) {
      this.coreRadius = Math.max(this.coreRadius, Math.abs(b.baseOffsetX) + b.baseSize / 2, Math.abs(b.baseOffsetY) + b.baseSize / 2);
    }
    this.coreExtent = layout.extent;
    this.placeTurrets(level);
    this.fitCoreToCanvas();
  }

  /** The heart sits at the core's centre (NC-ORIGINAL-1). Odd grid: it
   *  replaces the centre block; even grid: it replaces the four central
   *  blocks with one 2x2 heart; ring: it floats inside the ring(s). */
  placeHeart(layout, useGrid, maxHp, moneyPerHit) {
    let size;
    if (useGrid && layout.n % 2 === 1) {
      const centre = this.blocks.findIndex((b) => Math.abs(b.offsetX) < 1e-6 && Math.abs(b.offsetY) < 1e-6);
      this.blocks.splice(centre, 1);
      size = layout.size;
    } else if (useGrid) {
      const half = layout.size;
      this.blocks = this.blocks.filter((b) => Math.abs(b.offsetX) > half || Math.abs(b.offsetY) > half);
      size = layout.size * 2 + 5;
    } else {
      size = Math.round(layout.size * 1.4);
    }
    const heart = new Block(0, 0, size, HEART_HP * maxHp, moneyPerHit, COLORS.amber);
    heart.kind = 'heart';
    this.blocks.push(heart);
  }

  /** Cosmetic (NC-ART-1): the armour layer touching the heart is its inner
   *  shield, edged violet; the rest is cyan. Only cores with at least two
   *  layers have one (a 3x3 core stays all cyan, so on level 1 the amber
   *  heart stands alone in the middle). */
  markInnerShield(layout, useGrid) {
    const heart = this.blocks.find((b) => b.kind === 'heart');
    if (!heart) return;
    if (useGrid) {
      if (layout.n < 5) return;
      const reach = heart.size / 2 + layout.size + 6;
      for (const b of this.blocks) {
        if (b.kind === 'armor' && Math.max(Math.abs(b.offsetX), Math.abs(b.offsetY)) <= reach) { b.layer = 1; b.color = COLORS.violet; }
      }
    } else {
      let maxR = 0;
      for (const b of this.blocks) if (b.kind === 'armor') maxR = Math.max(maxR, Math.hypot(b.offsetX, b.offsetY));
      for (const b of this.blocks) {
        if (b.kind === 'armor' && Math.hypot(b.offsetX, b.offsetY) < maxR - layout.size * 0.5) { b.layer = 1; b.color = COLORS.violet; }
      }
    }
  }

  /** Cosmetic (NC-ART-1, "Fractured Intelligence"): the core is drawn as one
   *  digital organism, a lattice linking every block to its direct
   *  neighbours (grid: up/down/left/right; rings: along and between rings)
   *  and the innermost blocks to the heart. It mirrors the real structure
   *  (which blocks touch, where the heart is); it is not a mechanic. */
  buildNetwork() {
    this.links = [];
    const blocks = this.blocks;
    const heart = blocks.find((b) => b.kind === 'heart');
    const reach = this.blockStep * 1.25;
    const others = blocks.filter((b) => b.kind !== 'heart');
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = others[i];
        const b = others[j];
        if (Math.hypot(a.baseOffsetX - b.baseOffsetX, a.baseOffsetY - b.baseOffsetY) <= reach) this.links.push({ a, b, axon: false });
      }
    }
    if (!heart) return;
    const dist = (b) => Math.hypot(b.baseOffsetX, b.baseOffsetY);
    let near = others.filter((b) => Math.max(Math.abs(b.baseOffsetX), Math.abs(b.baseOffsetY)) <= heart.baseSize / 2 + this.blockStep * 0.9);
    if (!near.length) {
      // Ring cores: the heart floats inside; six axons to the inner ring.
      const sorted = others.slice().sort((p, q) => dist(p) - dist(q));
      const inner = sorted.filter((b) => dist(b) <= dist(sorted[0]) + 1);
      near = inner.filter((_, i) => i % Math.max(1, Math.floor(inner.length / 6)) === 0).slice(0, 6);
    }
    for (const b of near) this.links.push({ a: b, b: heart, axon: true });
  }

  /** Energy relays: min(1 + floor((L-2)/3), 4) random armour blocks from
   *  level 2 (none on level 1, so the first core teaches the heart alone). */
  placeRelays(level) {
    const count = level >= 2 ? Math.min(1 + Math.floor((level - 2) / 3), 4) : 0;
    const armour = this.blocks.filter((b) => b.kind === 'armor');
    for (let i = 0; i < count && armour.length; i++) {
      const pick = armour.splice(Math.floor(Math.random() * armour.length), 1)[0];
      pick.kind = 'relay';
      pick.color = COLORS.amber;
    }
  }

  /** Creates the level's turrets (N/E/S/W of the core, aimed at it);
   *  fitCoreToCanvas sets their distance from the core. */
  placeTurrets(level) {
    const count = Math.min(1 + Math.floor((level - 1) / 3), 4);
    const compass = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];
    this.turrets = [];
    for (let i = 0; i < count; i++) {
      const dir = compass[i];
      // Aimed at the core (NC-CORE-1A): every new ball starts with a hit.
      // Magenta = the player's breach: every turret's lance (NC-ART-1).
      const turret = new Turret(0, 0, Math.atan2(-dir.dy, -dir.dx), COLORS.magenta);
      turret.dirX = dir.dx;
      turret.dirY = dir.dy;
      this.turrets.push(turret);
    }
  }

  spawnInitialBalls() {
    this.balls = [];
    const initialCount = Math.min(this.maxBalls, 1);
    for (let i = 0; i < initialCount; i++) {
      const turret = this.turrets[i % this.turrets.length];
      this.spawnBallFromTurret(turret);
    }
  }

  spawnBallFromTurret(turret) {
    const spread = randRange(-0.5, 0.5);
    const angle = turret.angle + spread;
    const speed = randRange(230, 280);
    const radius = 5;
    // Up to 22 units ahead of the turret, but always outside the core's box
    // (the turret aims at the core and may sit only TURRET_CLEARANCE away).
    const gap = Math.hypot(turret.offsetX, turret.offsetY) - this.coreRadius * this.coreScale;
    const spawnDist = clamp(gap - radius - 2, 0, 22);
    const x = turret.x + Math.cos(turret.angle) * spawnDist;
    const y = turret.y + Math.sin(turret.angle) * spawnDist;
    // Three tints of the player's cyan; the random pick is kept exactly as
    // before so the simulation's random sequence is unchanged (NC-ART-1).
    const colors = [COLORS.cyan, COLORS.ice, COLORS.cyan];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.balls.push(new Ball(x, y, angle, speed, radius, color));
  }

  bindUpgradeButtons() {
    const buy = (button, cost, apply) => (event) => {
      this.sound.unlock();
      // A mouse click leaves focus on the button; drop it so Space stays the
      // volley key (keyboard activation keeps focus: event.detail === 0).
      if (event && event.detail > 0 && button.blur) button.blur();
      const price = cost();
      if (this.cash < price) return;
      this.cash -= price;
      apply();
      this.sound.play('buy');
      // Restart the one-shot purchase flash.
      button.classList.remove('shop-btn--bought');
      void button.offsetWidth;
      button.classList.add('shop-btn--bought');
      this.updateUI();
    };

    this.ui.buyBall.addEventListener('click', buy(this.ui.buyBall, () => this.ballCost, () => {
      this.maxBalls += 1;
    }));

    this.ui.fireRate.addEventListener('click', buy(this.ui.fireRate, () => this.fireRateCost, () => {
      this.fireRateLevel += 1;
      this.recalcFireInterval();
    }));

    this.ui.damage.addEventListener('click', buy(this.ui.damage, () => this.damageCost, () => {
      this.damageLevel += 1;
      for (const ball of this.balls) ball.flash = 1;
    }));
  }

  /** Field input: a click/tap aims the volley (mouse, pen, touch through
   *  Pointer Events); Space fires it at the heart; M toggles sound. Hovering
   *  with a mouse shows the lance lines while the volley is ready. */
  bindFieldInput() {
    const canvas = this.canvas;
    if (!canvas.addEventListener) return;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.preventDefault) e.preventDefault();
      this.sound.unlock();
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.requestVolley(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      this.aim = e.pointerType === 'mouse' ? this.screenToWorld(e.clientX, e.clientY) : null;
    });
    canvas.addEventListener('pointerleave', () => { this.aim = null; });
    window.addEventListener('keydown', (e) => {
      const onButton = e.target && e.target.tagName === 'BUTTON';
      if (e.code === 'Space' && !onButton) {
        e.preventDefault();
        this.sound.unlock();
        if (!e.repeat) this.requestVolley(this.width / 2, this.height / 2);
      } else if (e.code === 'KeyM' && !e.repeat) {
        this.sound.unlock();
        this.toggleMute();
      }
    });
  }

  bindMuteButton() {
    if (!this.ui.mute) return;
    this.ui.mute.addEventListener('click', (event) => {
      this.sound.unlock();
      if (event && event.detail > 0 && this.ui.mute.blur) this.ui.mute.blur();
      this.toggleMute();
    });
  }

  toggleMute() {
    this.sound.setMuted(!this.sound.muted);
    this.updateMuteButton();
  }

  updateMuteButton() {
    const btn = this.ui.mute;
    if (!btn) return;
    const label = this.t(this.sound.muted ? 'soundOff' : 'soundOn');
    btn.textContent = this.sound.muted ? '\u266A\u0338' : '\u266A';
    btn.title = label;
    if (btn.setAttribute) {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', this.sound.muted ? 'true' : 'false');
    }
    btn.classList.toggle('icon-btn--off', this.sound.muted);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.wrapper.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / this.viewScale, 0, this.width),
      y: clamp((clientY - rect.top) / this.viewScale, 0, this.height),
    };
  }

  /** Queues a volley at a world point; it fires on the next fixed step, so
   *  input never runs outside the simulation (NC-03). A click while the
   *  volley is charging only shows a small "not yet" ring. */
  requestVolley(x, y) {
    if (!this.volleyReady) {
      this.addRing(x, y, 10, COLORS.white, 0.25, 1.5);
      this.sound.play('deny');
      return false;
    }
    this.pendingVolley = { x, y, manual: true };
    return true;
  }

  /** Every turret fires a lance through (x, y). Returns false if not ready. */
  fireVolley(x, y, manual) {
    if (!this.volleyReady) return false;
    this.volleyCharge = 0;
    this.volleyReadyFor = 0;
    if (manual) this.manualVolleys += 1;
    else this.autoVolleys += 1;
    for (const turret of this.turrets) {
      this.castLance(turret, x, y);
      turret.flash = 1;
    }
    this.addRing(x, y, 14, COLORS.white, 0.3, 2);
    this.syncFlash = 1;
    this.shake = Math.max(this.shake, 0.12);
    this.sound.play('volley');
    // Instant response to the player: hint, cash and cursor now, not at the
    // next 0.15 s UI tick.
    if (manual) this.updateUI();
    return true;
  }

  /** Autopilot target for an unused volley: a random armour block (not the
   *  heart, not a relay), so aiming by hand is clearly better. */
  autoTarget() {
    const armour = this.blocks.filter((b) => b.alive && b.kind === 'armor');
    const pool = armour.length ? armour : this.blocks.filter((b) => b.alive);
    if (!pool.length) return { x: this.width / 2, y: this.height / 2 };
    const b = pool[Math.floor(Math.random() * pool.length)];
    return { x: b.cx, y: b.cy };
  }

  /** A lance from the turret through (tx, ty) to the edge of the field. Every
   *  block it crosses (block box grown by LANCE_HALF_WIDTH) absorbs damage up
   *  to its HP from the lance's power budget, nearest first; the lance stops
   *  where the budget runs out. */
  castLance(turret, tx, ty) {
    let dx = tx - turret.x;
    let dy = ty - turret.y;
    let len = Math.hypot(dx, dy);
    if (len < 1) { dx = this.width / 2 - turret.x; dy = this.height / 2 - turret.y; len = Math.hypot(dx, dy) || 1; }
    dx /= len;
    dy /= len;
    const maxT = rayBoxExit(turret.x, turret.y, dx, dy, 0, 0, this.width, this.height);
    const w = LANCE_HALF_WIDTH;
    const crossed = [];
    for (const b of this.blocks) {
      if (!b.alive) continue;
      const t = rayBoxEnter(turret.x, turret.y, dx, dy, b.x - w, b.y - w, b.x + b.size + w, b.y + b.size + w);
      if (t !== null && t <= maxT) crossed.push({ b, t });
    }
    crossed.sort((a, b) => a.t - b.t);
    let power = this.lancePower;
    let endT = maxT;
    for (const { b, t } of crossed) {
      if (power <= 0) break;
      if (!b.alive) continue; // broken by a relay shockwave from this lance
      const dmg = Math.min(power, b.hp);
      power -= dmg;
      this.hitBlock(b, dmg, turret.x + dx * t, turret.y + dy * t, 'lance');
      if (power <= 0) endT = t + b.size * 0.5;
    }
    if (this.lances.length < MAX_LANCES) {
      this.lances.push(new Lance(turret.x, turret.y, turret.x + dx * endT, turret.y + dy * endT, turret.color));
    }
  }

  addRing(x, y, radius, color, life, width) {
    if (this.rings.length < MAX_RINGS) this.rings.push(new Ring(x, y, radius, color, life, width));
  }

  /** One hit on a block from any source: pays the block's money per hit,
   *  deals damage, shows feedback and resolves a destruction. */
  hitBlock(block, damage, x, y, source) {
    this.cash += block.moneyPerHit;
    this.addFloatText(x, y, block.moneyPerHit, COLORS.green);
    this.particles.burst(x, y, block.color, source === 'ball' ? 6 : 10, {
      minSpeed: 40, maxSpeed: 150, minLife: 0.25, maxLife: 0.5,
    });
    if (source === 'ball') this.sound.play('hit');
    if (block.takeHit(damage)) this.onBlockDestroyed(block);
  }

  onBlockDestroyed(block) {
    this.particles.burst(block.cx, block.cy, block.color, 18, {
      minSpeed: 60, maxSpeed: 220, minLife: 0.4, maxLife: 0.9, minRadius: 2, maxRadius: 4,
    });
    this.sound.play('break');
    if (block.kind === 'relay') this.triggerRelay(block);
    else if (block.kind === 'heart') this.shatterCore(block);
  }

  /** Relay: bonus cash, full volley charge and a shockwave that damages every
   *  block within SHOCK_RADIUS_STEPS (chains through other relays). */
  triggerRelay(relay) {
    const bonus = RELAY_BONUS * relay.moneyPerHit;
    this.cash += bonus;
    // Above the core (never over the heart); chained relays stack upward.
    const stacked = this.floatTexts.filter((f) => f.big && f.life > FLOAT_TEXT_LIFE * 0.8).length;
    const top = this.height / 2 - this.coreRadius * this.coreScale - 14 - stacked * 16 / Math.max(1, this.viewScale);
    this.addBigText(this.width / 2, Math.max(14, top), `${this.t('relay')} +${formatMoney(bonus, this.lang)}`, COLORS.amber);
    if (this.volleyCharge < 1) {
      this.volleyCharge = 1;
      this.volleyReadyFor = 0;
    }
    const radius = SHOCK_RADIUS_STEPS * this.blockStep * this.coreScale;
    this.addRing(relay.cx, relay.cy, radius, COLORS.amber, 0.45, 3);
    // Surge to every turret: the recharge made visible (cosmetic).
    for (const t of this.turrets) {
      if (this.arcs.length < MAX_ARCS) this.arcs.push(new Arc(relay.cx, relay.cy, t.x, t.y, relay.seed + this.arcs.length * 31));
    }
    this.sound.play('relay');
    const damage = SHOCK_DAMAGE * this.ballDamage;
    for (const b of this.blocks) {
      if (!b.alive || b === relay) continue;
      if (Math.hypot(b.cx - relay.cx, b.cy - relay.cy) <= radius) this.hitBlock(b, damage, b.cx, b.cy, 'shock');
    }
  }

  /** Heart destroyed: the rest of the core breaks in a wave from the centre;
   *  each block pays SHATTER_PAY x money per hit, the heart HEART_BONUS x. */
  shatterCore(heart) {
    const bonus = HEART_BONUS * heart.moneyPerHit;
    this.cash += bonus;
    this.coresShattered += 1;
    // Below the core: not on top of the breaking plates, nor under the
    // level banner that follows (NC-ART-1).
    const below = heart.cy + this.coreRadius * this.coreScale + 16;
    this.addBigText(heart.cx, Math.min(this.height - 14, below), `${this.t('breached')} +${formatMoney(bonus, this.lang)}`, COLORS.amber);
    for (const b of this.blocks) {
      if (b.alive && b.shatter === null) b.shatter = Math.hypot(b.cx - heart.cx, b.cy - heart.cy) / SHATTER_SPEED;
    }
    // Breach finale (cosmetic): the seal implodes, the sigil splits, fracture
    // lines run outward and a magenta front marks the shatter wave.
    const reach = this.coreRadius * this.coreScale * 1.5;
    this.breach = { x: heart.cx, y: heart.cy, t: 0, size: heart.size, reach, life: reach / SHATTER_SPEED + 0.7, seed: this.level * 7919 };
    this.screenFlash = 1;
    this.shake = Math.max(this.shake, 0.35);
    this.volleyCharge = 1;
    this.volleyReadyFor = 0;
    this.sound.play('shatter');
  }

  /** Advances the shatter wave: due blocks break and pay. */
  updateShatter(dt) {
    for (const b of this.blocks) {
      if (!b.alive || b.shatter === null) continue;
      b.shatter -= dt;
      if (b.shatter > 0) continue;
      const pay = SHATTER_PAY * b.moneyPerHit;
      this.cash += pay;
      this.addFloatText(b.cx, b.cy, pay, b.color);
      b.alive = false;
      b.hitFlash = 1;
      this.particles.burst(b.cx, b.cy, b.color, 10, {
        minSpeed: 80, maxSpeed: 260, minLife: 0.4, maxLife: 0.9, minRadius: 2, maxRadius: 4,
      });
    }
  }

  updateVolley(dt) {
    if (this.pendingVolley) {
      const v = this.pendingVolley;
      this.pendingVolley = null;
      this.fireVolley(v.x, v.y, v.manual);
    }
    if (this.volleyCharge < 1) {
      this.volleyCharge = Math.min(1, this.volleyCharge + dt / this.chargeTime);
      if (this.volleyCharge >= 1) {
        this.volleyReadyFor = 0;
        this.sound.play('ready');
      }
    } else {
      this.volleyReadyFor += dt;
      if (this.volleyReadyFor >= VOLLEY_AUTO_DELAY) {
        const p = this.autoTarget();
        this.fireVolley(p.x, p.y, false);
      }
    }
  }

  updateUI() {
    this.ui.cash.textContent = formatMoney(this.cash, this.lang);
    this.ui.level.textContent = String(this.level);

    this.ui.buyBallDesc.textContent = this.t('balls', { n: this.maxBalls });
    this.ui.buyBallCost.textContent = formatMoney(this.ballCost, this.lang);
    this.ui.buyBall.disabled = this.cash < this.ballCost;

    const seconds = this.chargeTime.toLocaleString((STRINGS[this.lang] || STRINGS[DEFAULT_LANGUAGE]).locale, { maximumFractionDigits: 1 });
    this.ui.fireRateDesc.textContent = this.t('chargeDesc', { n: this.fireRateLevel, s: seconds });
    this.ui.fireRateCost.textContent = formatMoney(this.fireRateCost, this.lang);
    this.ui.fireRate.disabled = this.cash < this.fireRateCost;

    this.ui.damageDesc.textContent = this.t('upgradeLevel', { n: this.damageLevel });
    this.ui.damageCost.textContent = formatMoney(this.damageCost, this.lang);
    this.ui.damage.disabled = this.cash < this.damageCost;

    this.updateHint();
    if (this.canvas.style) this.canvas.style.cursor = this.volleyReady ? 'crosshair' : 'default';
  }

  /** True until the player's first purchase on a fresh save (derived from the
   *  saved state, so nothing new is stored and returning players never see
   *  the hint). */
  get isNewPlayer() {
    return this.level === 1 && this.maxBalls === 1 && this.fireRateLevel === 1 && this.damageLevel === 1;
  }

  /** Non-blocking hint over the field (pointer-events: none). For every
   *  player, until the first hand-aimed volley of the session: how to fire
   *  (shown while the volley is ready). For a new player: where cash comes
   *  from and the goal, then the first purchase. Nothing is stored. */
  updateHint() {
    const hint = this.ui.hint;
    const volleyHint = this.manualVolleys === 0 && this.volleyReady;
    const newPlayer = this.isNewPlayer;
    const canBuy = newPlayer && this.cash >= this.ballCost;
    const show = volleyHint || newPlayer;
    hint.hidden = !show;
    if (show) {
      const text = this.t(volleyHint ? 'hintVolley' : (canBuy ? 'hintBuy' : 'hintStart'));
      if (hint.textContent !== text) hint.textContent = text;
    }
    hint.classList.toggle('hint--action', volleyHint);
    this.ui.buyBall.classList.toggle('shop-btn--suggested', canBuy && !volleyHint);
  }

  handleBallBlockCollisions() {
    // Broad phase: every block lies inside the core's bounding box, so a ball
    // that does not reach that box cannot touch any block (exact, no effect
    // on results; keeps the fixed-step cost low while balls fly elsewhere).
    const cx = this.width / 2;
    const cy = this.height / 2;
    const reach = this.coreRadius * this.coreScale;
    for (const ball of this.balls) {
      if (Math.abs(ball.x - cx) > reach + ball.radius || Math.abs(ball.y - cy) > reach + ball.radius) continue;
      for (const block of this.blocks) {
        if (!block.alive) continue;
        const contact = ball.collideBlock(block);
        if (!contact) continue;
        this.hitBlock(block, this.ballDamage, contact.x, contact.y, 'ball');
        break;
      }
    }
  }

  addFloatText(x, y, amount, color) {
    if (this.floatTexts.length >= MAX_FLOAT_TEXTS) return;
    // 12 px on screen, growing gently on big screens (at most 18 px).
    const screenPx = 12 * Math.min(1.5, this.viewScale);
    this.floatTexts.push(new FloatText(x, y - 8, '+' + formatMoney(amount, this.lang), color, screenPx / this.viewScale));
  }

  /** Larger event label (relay, shatter); always shown, replaces the oldest
   *  label when the cap is reached. */
  addBigText(x, y, text, color) {
    if (this.floatTexts.length >= MAX_FLOAT_TEXTS) this.floatTexts.shift();
    const screenPx = 15 * Math.min(1.5, this.viewScale);
    const label = new FloatText(x, y, text, color, screenPx / this.viewScale);
    label.life = FLOAT_TEXT_LIFE * 1.6;
    label.big = true;
    this.floatTexts.push(label);
  }

  /** Share of the current core's HP already destroyed, 0..1. */
  get coreProgress() {
    if (this.coreTotalHp <= 0) return 0;
    let left = 0;
    for (const b of this.blocks) if (b.alive) left += Math.max(0, b.hp);
    return clamp(1 - left / this.coreTotalHp, 0, 1);
  }

  update(dt) {
    this.time += dt;
    this.updateVolley(dt);
    for (const turret of this.turrets) turret.update(dt, this);

    for (const ball of this.balls) {
      ball.update(dt);
      ball.bounceWalls(this.width, this.height);
    }

    this.handleBallBlockCollisions();

    this.updateShatter(dt);
    for (const block of this.blocks) block.update(dt);
    const aliveRemaining = this.blocks.some((b) => b.alive);
    this.blocks = this.blocks.filter((b) => b.alive || b.hitFlash > 0);

    if (!aliveRemaining) {
      this.level += 1;
      this.generateCore(this.level);
      this.banner = { text: this.t('levelUp', { n: this.level }), life: 1.4 };
      // The banner owns the top of the field: event labels above the core go.
      this.floatTexts = this.floatTexts.filter((f) => !(f.big && f.y < this.height / 2));
      this.sound.play('level');
    }

    this.particles.update(dt);
    for (const f of this.floatTexts) f.update(dt);
    if (this.floatTexts.length && this.floatTexts.some((f) => f.life <= 0)) this.floatTexts = this.floatTexts.filter((f) => f.life > 0);
    for (const l of this.lances) l.update(dt);
    if (this.lances.length && this.lances[0].life <= 0) this.lances = this.lances.filter((l) => l.life > 0);
    for (const ring of this.rings) ring.update(dt);
    for (const a of this.arcs) a.update(dt);
    if (this.arcs.length && this.arcs.some((a) => a.life <= 0)) this.arcs = this.arcs.filter((a) => a.life > 0);
    if (this.breach) {
      this.breach.t += dt;
      if (this.breach.t >= this.breach.life) this.breach = null;
    }
    if (this.rings.length && this.rings.some((ring) => ring.life <= 0)) this.rings = this.rings.filter((ring) => ring.life > 0);
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt * 3);
    if (this.syncFlash > 0) this.syncFlash = Math.max(0, this.syncFlash - dt * 3);
    this.netPhase += dt * this.netSpeed;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    this.uiTimer += dt;
    if (this.uiTimer >= 0.15) {
      this.uiTimer = 0;
      this.updateUI();
      this.netSpeed = 0.35 + 1.4 * this.coreProgress;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.save();
    }
  }

  draw() {
    const ctx = this.ctx;
    this.drawBackground(ctx);

    const shaking = this.shake > 0 && !this.reducedMotion;
    if (shaking) {
      ctx.save();
      // Deterministic wobble: draw() must never consume Math.random, or the
      // simulation would depend on the number of frames drawn (NC-03).
      const a = this.shake * 10;
      ctx.translate(Math.sin(this.time * 91) * a, Math.cos(this.time * 77) * a);
    }
    this.drawFieldMarks(ctx);
    this.drawAimPreview(ctx);
    Block.drawCore(ctx, this.visibleBlocks(), this.time, this.reducedMotion, (c) => {
      this.drawNetwork(c);
      this.drawConduits(c);
    });
    this.drawHeartLock(ctx);
    this.drawSync(ctx);
    for (const turret of this.turrets) turret.draw(ctx, this.volleyCharge, this.time, this.reducedMotion);
    this.drawBreach(ctx);
    for (const l of this.lances) l.draw(ctx);
    for (const a of this.arcs) a.draw(ctx);
    for (const ring of this.rings) ring.draw(ctx);
    this.particles.draw(ctx);
    Ball.drawAll(ctx, this.balls);
    for (const f of this.floatTexts) f.draw(ctx);
    if (shaking) ctx.restore();

    if (this.screenFlash > 0) {
      // Breach flash: a magenta-white veil, gentle and single (no strobe);
      // much weaker with prefers-reduced-motion.
      ctx.save();
      ctx.globalAlpha = this.screenFlash * (this.reducedMotion ? 0.06 : 0.2);
      ctx.fillStyle = COLORS.magenta;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = this.screenFlash * (this.reducedMotion ? 0.04 : 0.12);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    this.drawCoreProgress(ctx);
    this.drawVolleyMeter(ctx);
    this.drawBanner(ctx);
  }

  /** Blocks to draw: while a new core assembles (CORE_ASSEMBLY_TIME after
   *  generation), plates appear outward from the heart. Drawing only; the
   *  blocks are solid from the first step. */
  visibleBlocks() {
    const age = this.time - this.coreBornAt;
    if (this.reducedMotion || age >= CORE_ASSEMBLY_TIME) return this.blocks;
    const reach = (this.coreRadius * this.coreScale * 1.5) * (age / CORE_ASSEMBLY_TIME);
    return this.blocks.filter((b) => b.kind === 'heart' || Math.hypot(b.offsetX, b.offsetY) <= reach);
  }

  /**
   * Static backdrop, rendered once per canvas size into an offscreen canvas
   * (NC-ART-1): graphite with a soft light behind the core, a sparse dot
   * field that fades toward the edges, two containment rings with ticks
   * around the core and bottom corner brackets. No full neon grid. Where an
   * offscreen canvas is unavailable (QA harness) the plain colour is used.
   */
  drawBackground(ctx) {
    const key = `${this.canvas.width}x${this.canvas.height}@${this.viewScale}`;
    if (this.bgKey !== key) {
      this.bgKey = key;
      this.bgCanvas = this.renderBackground();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = COLORS.void;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.restore();
  }

  renderBackground() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    let canvas;
    let g;
    try {
      canvas = document.createElement('canvas');
      canvas.width = this.canvas.width;
      canvas.height = this.canvas.height;
      g = canvas.getContext('2d');
    } catch (err) {
      return null;
    }
    if (!g || typeof g.createRadialGradient !== 'function') return null;
    const s = this.dpr * this.viewScale;
    g.setTransform(s, 0, 0, s, 0, 0);
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    const far = Math.hypot(cx, cy);
    g.fillStyle = COLORS.void;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, far);
    glow.addColorStop(0, '#15142a');
    glow.addColorStop(0.45, '#0c0c18');
    glow.addColorStop(1, '#05050a');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // Dot field.
    g.fillStyle = '#2a3a52';
    const step = 14;
    for (let y = (cy % step); y < h; y += step) {
      for (let x = (cx % step); x < w; x += step) {
        const d = Math.hypot(x - cx, y - cy) / far;
        g.globalAlpha = 0.55 * (1 - d) * (1 - d);
        g.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
    const short = Math.min(w, h);
    // The AI's wider infrastructure: a few dark circuit routes run in from
    // the field edges toward the core (orthogonal, one 45-degree bend, a pad
    // at the end). Fixed layout, very low contrast: depth, not a grid.
    g.strokeStyle = '#141d2d';
    g.fillStyle = '#1a2538';
    g.lineWidth = 1.2;
    g.lineJoin = 'round';
    const stopR = short * 0.5;
    for (let i = 0; i < 16; i++) {
      const side = i % 4;
      const f = 0.08 + 0.84 * hash01(911 + i * 17);
      let x = side === 0 ? f * w : side === 1 ? w : side === 2 ? f * w : 0;
      let y = side === 0 ? 0 : side === 1 ? f * h : side === 2 ? h : f * h;
      const dirX = side === 1 ? -1 : side === 3 ? 1 : 0;
      const dirY = side === 0 ? 1 : side === 2 ? -1 : 0;
      g.beginPath();
      g.moveTo(x, y);
      const run = (Math.hypot(cx - x, cy - y) - stopR) * (0.35 + 0.4 * hash01(977 + i));
      if (run <= 4) continue;
      x += dirX * run;
      y += dirY * run;
      g.lineTo(x, y);
      // Bend 45 degrees toward the core and stop short of the rings.
      const bx = Math.sign(cx - x) || 1;
      const by = Math.sign(cy - y) || 1;
      const diag = Math.max(0, (Math.hypot(cx - x, cy - y) - stopR) * 0.5);
      x += (dirX === 0 ? bx : dirX) * diag * 0.7071;
      y += (dirY === 0 ? by : dirY) * diag * 0.7071;
      g.lineTo(x, y);
      g.stroke();
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    // Containment rings and ticks.
    g.globalAlpha = 1;
    g.strokeStyle = '#162033';
    g.lineWidth = 1;
    for (const r of [short * 0.36, short * 0.47]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#1e2b42';
    g.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r0 = short * 0.47;
      const len = i % 18 === 0 ? 9 : i % 6 === 0 ? 5 : 2.5;
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    }
    g.stroke();
    // Arena frame: a chamfered bezel just inside the walls the balls bounce
    // off, with a few dim light strips (cyan sides, amber bottom corners).
    const m = 3;
    const cut = Math.min(22, short * 0.08);
    g.strokeStyle = '#1d2236';
    g.lineWidth = 2;
    g.beginPath();
    chamferPath(g, m, m, w - m * 2, h - m * 2, [cut, cut, cut, cut]);
    g.stroke();
    g.lineWidth = 2;
    g.globalAlpha = 0.45;
    g.strokeStyle = COLORS.cyan;
    g.beginPath();
    for (const fy of [0.38, 0.62]) {
      g.moveTo(m, h * fy - 6); g.lineTo(m, h * fy + 6);
      g.moveTo(w - m, h * fy - 6); g.lineTo(w - m, h * fy + 6);
    }
    g.stroke();
    g.strokeStyle = COLORS.amber;
    g.beginPath();
    g.moveTo(m + cut + 6, h - m); g.lineTo(m + cut + 18, h - m);
    g.moveTo(w - m - cut - 6, h - m); g.lineTo(w - m - cut - 18, h - m);
    g.stroke();
    g.globalAlpha = 1;
    return canvas;
  }

  /** Live layer of the backdrop: a slow scanning arc on the outer
   *  containment ring (static with prefers-reduced-motion). */
  drawFieldMarks(ctx) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const r = Math.min(this.width, this.height) * 0.47;
    const a = this.reducedMotion ? -Math.PI / 2 : this.time * 0.35;
    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + 0.9);
    ctx.stroke();
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + Math.PI, a + Math.PI + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  /** Relay energy lines (NC-ART-1): an amber power pipe (axis run + one
   *  45-degree run) from every relay into the heart with energy flowing
   *  along it, and a zigzag link between
   *  relays close enough for one's shockwave to reach the other (a chain). */
  drawConduits(ctx) {
    let heart = null;
    const relays = [];
    for (const b of this.blocks) {
      if (!b.alive) continue;
      if (b.kind === 'heart') heart = b;
      else if (b.kind === 'relay') relays.push(b);
    }
    if (!relays.length) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (heart) {
      // Power pipes: straight along the major axis, then one 45-degree run
      // into the heart (drawn under the relay and heart housings).
      ctx.beginPath();
      for (const r of relays) {
        const dx = heart.cx - r.cx;
        const dy = heart.cy - r.cy;
        ctx.moveTo(r.cx, r.cy);
        if (Math.abs(dx) >= Math.abs(dy)) ctx.lineTo(heart.cx - Math.sign(dx) * Math.abs(dy), r.cy);
        else ctx.lineTo(r.cx, heart.cy - Math.sign(dy) * Math.abs(dx));
        ctx.lineTo(heart.cx, heart.cy);
      }
      ctx.strokeStyle = COLORS.plateDark;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = COLORS.amber;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = '#fff1c4';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1;
      if (ctx.setLineDash) ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = this.reducedMotion ? 0 : -this.time * 22;
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    }
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 1.2;
    const reach = SHOCK_RADIUS_STEPS * this.blockStep * this.coreScale;
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = COLORS.amber;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    let links = 0;
    for (let i = 0; i < relays.length; i++) {
      for (let j = i + 1; j < relays.length; j++) {
        const a = relays[i];
        const b = relays[j];
        if (Math.hypot(a.cx - b.cx, a.cy - b.cy) > reach) continue;
        jaggedPath(ctx, a.cx, a.cy, b.cx, b.cy, 5, 2.5, a.seed + b.seed + (this.reducedMotion ? 0 : Math.floor(this.time * 8)));
        links += 1;
      }
    }
    if (links) ctx.stroke();
    ctx.restore();
  }

  /**
   * The core's neural lattice (NC-ART-1, "Fractured Intelligence"): thin
   * links between neighbouring blocks' nodes and magenta axons into the
   * heart, with signal pulses flowing inward. The organism reacts: a hit
   * lights the struck block's links; as the core loses HP the lattice
   * brightens and its pulses speed up; a link to a destroyed block is cut to
   * a sparking stub; links ahead of the shatter wave flicker white.
   */
  drawNetwork(ctx) {
    if (!this.links.length) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const k = this.coreScale;
    const age = this.time - this.coreBornAt;
    if (!this.reducedMotion && age < CORE_ASSEMBLY_TIME) return;
    const stress = clamp((this.netSpeed - 0.35) / 1.4, 0, 1);
    const phase = this.reducedMotion ? 0 : this.netPhase;
    const nodeR = (b) => (b.kind === 'heart' ? b.size * 0.5 : b.kind === 'relay' ? b.size * 0.42 : b.size * 0.08);
    const live = [];
    const axons = [];
    const hot = [];
    const marked = [];
    const stubs = [];
    for (const l of this.links) {
      const ea = l.a.alive;
      const eb = l.b.alive;
      if (ea && eb) {
        (l.axon ? axons : live).push(l);
        if (l.a.hitFlash > 0 || l.b.hitFlash > 0) hot.push(l);
        if (l.a.shatter !== null || l.b.shatter !== null) marked.push(l);
      } else if (ea !== eb && !l.axon) {
        stubs.push(ea ? [l.a, l.b] : [l.b, l.a]);
      }
    }
    const seg = (path, list) => {
      for (const l of list) {
        const ax = cx + l.a.baseOffsetX * k;
        const ay = cy + l.a.baseOffsetY * k;
        const bx = cx + l.b.baseOffsetX * k;
        const by = cy + l.b.baseOffsetY * k;
        const d = Math.hypot(bx - ax, by - ay) || 1;
        const ra = nodeR(l.a);
        const rb = nodeR(l.b);
        if (d <= ra + rb) continue;
        path.moveTo(ax + ((bx - ax) / d) * ra, ay + ((by - ay) / d) * ra);
        path.lineTo(bx - ((bx - ax) / d) * rb, by - ((by - ay) / d) * rb);
      }
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.22 + 0.25 * stress;
    ctx.beginPath();
    seg(ctx, live);
    ctx.stroke();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55 + 0.3 * stress;
    ctx.beginPath();
    seg(ctx, axons);
    ctx.stroke();
    if (hot.length) {
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      seg(ctx, hot);
      ctx.stroke();
    }
    if (marked.length) {
      ctx.strokeStyle = COLORS.white;
      ctx.globalAlpha = this.reducedMotion ? 0.6 : 0.35 + 0.35 * Math.sin(this.time * 40);
      ctx.beginPath();
      seg(ctx, marked);
      ctx.stroke();
    }
    // Severed links: a stub from the surviving node, sparking at its end.
    if (stubs.length) {
      const tick = this.reducedMotion ? 0 : Math.floor(this.time * 10);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      const ends = [];
      for (const [alive, dead] of stubs) {
        const ax = cx + alive.baseOffsetX * k;
        const ay = cy + alive.baseOffsetY * k;
        const dx = cx + dead.baseOffsetX * k - ax;
        const dy = cy + dead.baseOffsetY * k - ay;
        const ex = ax + dx * 0.42;
        const ey = ay + dy * 0.42;
        jaggedPath(ctx, ax + dx * 0.12, ay + dy * 0.12, ex, ey, 2, 1.2, alive.seed + dead.seed);
        if (hash01(alive.seed + dead.seed + tick) < 0.5) ends.push(ex, ey);
      }
      ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let i = 0; i < ends.length; i += 2) ctx.rect(ends[i] - 0.8, ends[i + 1] - 0.8, 1.6, 1.6);
      ctx.fill();
    }
    // Signal pulses toward the heart on about half of the links.
    ctx.globalAlpha = 0.9;
    for (const [list, color] of [[live, COLORS.ice], [axons, '#fff1c4']]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const l of list) {
        const h = hash01(l.a.seed * 3 + l.b.seed);
        if (!l.axon && h > 0.5) continue;
        // Outer end first: pulses run inward.
        const outerA = Math.hypot(l.a.baseOffsetX, l.a.baseOffsetY) >= Math.hypot(l.b.baseOffsetX, l.b.baseOffsetY);
        const p = l.axon || outerA ? [l.a, l.b] : [l.b, l.a];
        const f = (phase + h * 7) % 1;
        const x = cx + (p[0].baseOffsetX + (p[1].baseOffsetX - p[0].baseOffsetX) * f) * k;
        const y = cy + (p[0].baseOffsetY + (p[1].baseOffsetY - p[0].baseOffsetY) * f) * k;
        ctx.rect(x - 0.9, y - 0.9, 1.8, 1.8);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  /** Volley synchronisation (cosmetic): for 0.33 s after a volley, an amber
   *  line ties the turrets together and each fires in step. */
  drawSync(ctx) {
    if (this.syncFlash <= 0 || this.turrets.length < 2) return;
    ctx.save();
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = this.syncFlash * 0.8;
    if (ctx.setLineDash) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    this.turrets.forEach((t, i) => (i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)));
    if (this.turrets.length > 2) ctx.closePath();
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.restore();
  }

  /** Magenta lock-on brackets around the heart while a volley is ready: the target
   *  is obvious without text. Brighter, with dashed lines from every turret,
   *  until the player's first hand-aimed volley (onboarding). */
  drawHeartLock(ctx) {
    if (!this.volleyReady) return;
    const heart = this.blocks.find((b) => b.alive && b.kind === 'heart');
    if (!heart) return;
    const teach = this.manualVolleys === 0;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 5);
    const cx = heart.cx;
    const cy = heart.cy;
    const r = heart.size / 2 + 5 + pulse * 3;
    const k = Math.max(5, heart.size * 0.25);
    ctx.save();
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = teach ? 0.95 : 0.55;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(cx + sx * r, cy + sy * (r - k));
      ctx.lineTo(cx + sx * r, cy + sy * r);
      ctx.lineTo(cx + sx * (r - k), cy + sy * r);
    }
    ctx.stroke();
    if (teach && !this.aim) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25 + 0.25 * pulse;
      if (ctx.setLineDash) ctx.setLineDash([2, 5]);
      ctx.lineDashOffset = this.reducedMotion ? 0 : -this.time * 20;
      ctx.beginPath();
      for (const t of this.turrets) {
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** Breach finale (NC-ART-1), drawn from the heart's position while
   *  `this.breach` lives: implosion of the seal (0-0.2 s), the two halves of
   *  the sigil flying apart, ten fracture lines racing outward, and a
   *  magenta front at the exact radius of the shatter wave. */
  drawBreach(ctx) {
    const b = this.breach;
    if (!b) return;
    const t = b.t;
    const fade = clamp(1 - t / b.life, 0, 1);
    const front = t * SHATTER_SPEED;
    const s = b.size / 2;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Implosion: the seal collapses into the heart.
    if (t < 0.2) {
      const k = 1 - t / 0.2;
      ctx.strokeStyle = COLORS.white;
      ctx.shadowColor = COLORS.amber;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.globalAlpha = k;
      ctx.beginPath();
      polygonPath(ctx, b.x, b.y, s * (0.4 + 1.6 * k), 6, t * 4);
      ctx.stroke();
    }
    // The split sigil: two halves sliding apart.
    const part = Math.min(1, t / 0.5);
    if (part < 1) {
      const off = s * (0.3 + 2.2 * part);
      const H = s * 0.6 * (1 + part * 0.4);
      const W = s * 0.42;
      ctx.globalAlpha = 1 - part;
      ctx.fillStyle = '#ffd25a';
      ctx.strokeStyle = '#fff1c4';
      ctx.shadowColor = COLORS.amber;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x - off, b.y - H);
      ctx.lineTo(b.x - off - W, b.y);
      ctx.lineTo(b.x - off, b.y + H);
      ctx.closePath();
      ctx.moveTo(b.x + off, b.y - H);
      ctx.lineTo(b.x + off + W, b.y);
      ctx.lineTo(b.x + off, b.y + H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Fracture lines.
    const len = Math.min(front, b.reach);
    if (len > 2) {
      ctx.strokeStyle = COLORS.amber;
      ctx.shadowColor = COLORS.amber;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      for (let i = 0; i < BREACH_LINES; i++) {
        const a = (i / BREACH_LINES) * Math.PI * 2 + hash01(b.seed + i) * 0.5;
        const l = len * (0.65 + 0.35 * hash01(b.seed + i + 50));
        jaggedPath(ctx, b.x, b.y, b.x + Math.cos(a) * l, b.y + Math.sin(a) * l, 5, 4, b.seed + i * 13);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Shatter front: exactly where the wave breaks blocks.
    if (front < b.reach * 1.4) {
      ctx.globalAlpha = fade * clamp(1 - front / (b.reach * 1.4), 0, 1);
      ctx.strokeStyle = COLORS.magenta;
      ctx.shadowColor = COLORS.magenta;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(0.1, front), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      polygonPath(ctx, b.x, b.y, Math.max(0.1, front * 0.85), 6, Math.PI / 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** With a mouse over the field and the volley ready: dashed amber lines
   *  from every turret through the cursor, and a rotating bracket reticle
   *  (where the lances go). */
  drawAimPreview(ctx) {
    if (!this.aim || !this.volleyReady) return;
    const x = this.aim.x;
    const y = this.aim.y;
    ctx.save();
    ctx.strokeStyle = COLORS.magenta;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    if (ctx.setLineDash) ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = this.reducedMotion ? 0 : -this.time * 24;
    ctx.beginPath();
    for (const t of this.turrets) {
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.globalAlpha = 0.95;
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.magenta;
    ctx.lineWidth = 1.5;
    const spin = this.reducedMotion ? 0 : this.time * 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 2;
      ctx.moveTo(x + Math.cos(a - 0.35) * 10, y + Math.sin(a - 0.35) * 10);
      ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.lineTo(x + Math.cos(a + 0.35) * 10, y + Math.sin(a + 0.35) * 10);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    polygonPath(ctx, x, y, 2.2, 4, 0);
    ctx.fill();
    ctx.restore();
  }

  /** Segmented HUD bar (screen pixels): `n` slanted cells, the last one
   *  partially filled. Shared by the core and volley meters. */
  drawSegmentBar(ctx, x, y, w, h, value, color, glow) {
    const n = 10;
    const gap = 2;
    const cw = (w - gap * (n - 1)) / n;
    const skew = h * 0.6;
    const cell = (i, fill) => {
      const x0 = x + i * (cw + gap);
      const x1 = x0 + cw * fill;
      ctx.moveTo(x0 + skew, y);
      ctx.lineTo(x1 + skew, y);
      ctx.lineTo(x1, y + h);
      ctx.lineTo(x0, y + h);
      ctx.closePath();
    };
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let i = 0; i < n; i++) cell(i, 1);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const fill = clamp(value * n - i, 0, 1);
      if (fill > 0) cell(i, fill);
    }
    ctx.fill();
  }

  /** Volley charge meter in the field's top-right corner (screen pixels). */
  drawVolleyMeter(ctx) {
    const fieldW = this.width * this.viewScale;
    const w = Math.min(120, fieldW * 0.3);
    const x = fieldW - 10 - w;
    const y = 10;
    const ready = this.volleyReady;
    const label = ready ? this.t('volleyReady') : `${this.t('volley')} ${Math.floor(this.volleyCharge * 100)}%`;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 6);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = ready ? COLORS.white : COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = ready ? 8 + 8 * pulse : 6;
    ctx.fillText(label, x + w, y);
    this.drawSegmentBar(ctx, x, y + 16, w, 5, this.volleyCharge, COLORS.magenta, ready ? 8 + 6 * pulse : 5);
    ctx.restore();
  }

  /** "LEVEL n" banner after a level-up, centred, screen pixels, between two
   *  bracket rules that open as it appears. */
  drawBanner(ctx) {
    if (!this.banner) return;
    const t = clamp(this.banner.life / 1.4, 0, 1);
    const size = Math.round(22 * Math.min(1.6, this.viewScale));
    const cx = (this.width * this.viewScale) / 2;
    const cy = (this.height * this.viewScale) * 0.18;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const m = typeof ctx.measureText === 'function' ? ctx.measureText(this.banner.text) : null;
    const tw = m && m.width ? m.width : this.banner.text.length * size * 0.6;
    const open = this.reducedMotion ? 1 : Math.min(1, (1 - t) * 6);
    const half = tw / 2 + 14;
    const rule = 40 * open;
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - size * 0.4);
    ctx.lineTo(cx - half - 6, cy);
    ctx.lineTo(cx - half, cy + size * 0.4);
    ctx.moveTo(cx - half - 10, cy);
    ctx.lineTo(cx - half - 10 - rule, cy);
    ctx.moveTo(cx + half, cy - size * 0.4);
    ctx.lineTo(cx + half + 6, cy);
    ctx.lineTo(cx + half, cy + size * 0.4);
    ctx.moveTo(cx + half + 10, cy);
    ctx.lineTo(cx + half + 10 + rule, cy);
    ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.shadowBlur = 16;
    ctx.fillText(this.banner.text, cx, cy);
    ctx.restore();
  }

  /** Core destruction meter in the top-left corner of the field, drawn in
   *  screen pixels (a HUD element: same size at any world scale). */
  drawCoreProgress(ctx) {
    const x = 10;
    const y = 10;
    const w = Math.min(120, this.width * this.viewScale * 0.3);
    const progress = this.coreProgress;
    const label = `${this.t('core')} ${Math.floor(progress * 100)}%`;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.amber;
    ctx.shadowColor = COLORS.amber;
    ctx.shadowBlur = 6;
    ctx.fillText(label, x, y);
    this.drawSegmentBar(ctx, x, y + 16, w, 5, progress, COLORS.amber, 6);
    ctx.restore();
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const frameDt = clamp((timestamp - this.lastTime) / 1000, 0, MAX_FRAME_DT);
    this.lastTime = timestamp;

    // Fixed-timestep accumulator (NC-03): the same SIM_STEP updates in the
    // same order at any refresh rate; draw() shows the latest state.
    this.accumulator += frameDt;
    while (this.accumulator >= SIM_STEP) {
      this.update(SIM_STEP);
      this.accumulator -= SIM_STEP;
      this.simSteps += 1;
    }
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  new Game(canvas);
});
