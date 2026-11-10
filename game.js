'use strict';

// Palette "Network Recovery" (NC-AI-RECOVERY-1, docs/GAME_DESIGN.md "Visual
// identity"). Every colour has one meaning: gunmetal = the network's
// hardware, red/ember = the rogue AI (its corrupted circuits, lattice and
// core), amber = the AI's power (relays, power lines, shields), cyan = the
// player's recovery drones and everything already recovered, magenta = the
// player's OVERRIDE (pulses, aim, target brackets), green = money only,
// white = impacts and hot cores.
const COLORS = {
  // The rogue AI (NC-AI-RECOVERY-1): corrupted circuits and its core.
  hostile: '#ff3b4e',
  ember: '#ff7a2a',
  coreHot: '#ff9a8a',
  // 2.5D hardware tones: tile tops, side walls, bevel light, floor shadow.
  tileTop: '#2a3044',
  tileSide: '#0a0c13',
  tileWall: '#1b2030',
  tileHi: '#8a95bd',
  shadow: 'rgba(0, 0, 0, 0.5)',
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

// ---------------------------------------------------------------------------
// Adaptive defense (NC-AI-RECOVERY-1, docs/GAME_DESIGN.md "Adaptive
// defense"). From sector DEFENSE_FROM_LEVEL the rogue AI periodically
// reroutes power from one outer FIREWALL NODE to shield its core: while the
// shield holds, the core takes SHIELD_FACTOR of any damage. The node is an
// ordinary armour block in a turret's line of fire, marked as breakable;
// destroying it (drone, override pulse, shockwave or autopilot) collapses the
// shield and EXPOSES the core and the blocks on the power line for
// EXPOSE_TIME (EXPOSE_FACTOR damage). A shield never restores HP, never takes
// cash back and always ends by itself after SHIELD_TIME, so an idle player
// is never blocked. Deterministic: the node is picked with hash01, never with
// the simulation RNG.
// ---------------------------------------------------------------------------
const DEFENSE_FROM_LEVEL = 3;
// Seconds after a sector starts before the first reroute, and between the
// end of one reroute (or exposure) and the next.
const DEFENSE_FIRST_DELAY = 8;
const DEFENSE_COOLDOWN = 10;
// Seconds a shield holds when nobody breaks its node.
const SHIELD_TIME = 7;
const SHIELD_FACTOR = 0.5;
const EXPOSE_TIME = 5;
const EXPOSE_FACTOR = 2.5;
// Bonus cash for breaking a node, in multiples of the sector's money per hit.
const OVERRIDE_BONUS = 3;
// A node broken by the player's own override pulse spills the rerouted
// power into the turrets: this much override charge (the autopilot's
// pulses and the drones break nodes too, without this refund).
const BREAK_RECHARGE = 0.5;
// Retry delay when no node can be chosen (no armour in a turret's line).
const DEFENSE_RETRY = 2;
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
    level: 'Sector',
    buyBall: 'New drone',
    balls: 'Drones: {n}',
    fireRate: 'Override charge',
    chargeDesc: 'Lvl {n} · {s} s',
    damage: 'Breach power',
    upgradeLevel: 'Lvl {n}',
    core: 'Recovered',
    volley: 'Override',
    volleyReady: 'OVERRIDE READY',
    hintStart: 'Drones break the AI\'s defences · reach its core',
    hintBuy: 'Deploy a new drone!',
    hintVolley: 'Click or tap the core to fire an override',
    hintDefense: 'AI shield up · hit the marked node to break it',
    breached: 'SECTOR RECOVERED',
    relay: 'RELAY CAPTURED',
    shieldUp: 'AI SHIELD',
    exposed: 'CORE EXPOSED',
    shieldBroken: 'SHIELD BROKEN',
    levelUp: 'SECTOR {n}',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
  },
  pl: {
    locale: 'pl-PL',
    cash: 'Kasa',
    level: 'Sektor',
    buyBall: 'Nowy dron',
    balls: 'Drony: {n}',
    fireRate: 'Ładowanie przejęcia',
    chargeDesc: 'Lvl {n} · {s} s',
    damage: 'Siła przełamania',
    upgradeLevel: 'Lvl {n}',
    core: 'Odzyskano',
    volley: 'Przejęcie',
    volleyReady: 'PRZEJĘCIE GOTOWE',
    hintStart: 'Drony łamią zabezpieczenia AI · dotrzyj do rdzenia',
    hintBuy: 'Wyślij nowego drona!',
    hintVolley: 'Kliknij lub dotknij rdzeń — impuls przejęcia',
    hintDefense: 'Osłona AI · traf oznaczony węzeł, by ją przełamać',
    breached: 'SEKTOR ODZYSKANY',
    relay: 'PRZEKAŹNIK PRZEJĘTY',
    shieldUp: 'OSŁONA AI',
    exposed: 'RDZEŃ ODSŁONIĘTY',
    shieldBroken: 'OSŁONA PRZEŁAMANA',
    levelUp: 'SEKTOR {n}',
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

/** Linear mix of two '#rrggbb' colours (t 0..1) as an 'rgb()' string
 *  (drawing only: the sector-recovery tint of the arena lights). */
function mixColor(a, b, t) {
  const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const k = clamp(t, 0, 1);
  const ch = (i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
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
  constructor(x0, y0, x1, y1, seed, color) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.seed = seed;
    this.color = color || COLORS.cyan;
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
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
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
    const gaps = { hit: 0.07, break: 0.06, volley: 0.1, ready: 0.5, relay: 0.15, shatter: 0.5, buy: 0.05, deny: 0.25, level: 0.5, shield: 0.5, override: 0.3 };
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
        // The AI raises a shield: a low rising hum; the player breaks it: a
        // falling glitch and a bright confirmation chirp.
        case 'shield': this.tone('sawtooth', 90, 180, 0.35, 0.05); this.tone('triangle', 240, 360, 0.3, 0.05, 0.05); break;
        case 'override': this.tone('square', 900, 120, 0.18, 0.05); this.tone('triangle', 880, 1760, 0.16, 0.07, 0.12); break;
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
    // The AI's current firewall node (NC-AI-RECOVERY-1; Game.defense).
    this.firewall = false;
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

  /** 2.5D tile geometry (NC-AI-RECOVERY-1): the tile's footprint is exactly
   *  its collision square (NC-21 closed: no cut corners beyond a 1.5-unit
   *  bevel); its raised top face sits in the top-left of the footprint, so
   *  the side walls show at the bottom and right (light from the top-left,
   *  true top-down view). */
  get wall() {
    return Math.max(1.8, this.size * 0.15);
  }

  bodyPath(ctx) {
    const c = Math.min(1.5, this.size * 0.08);
    chamferPath(ctx, this.x, this.y, this.size, this.size, [c, c, c, c]);
  }

  topPath(ctx) {
    const w = this.wall;
    const c = Math.min(1.5, this.size * 0.08);
    chamferPath(ctx, this.x, this.y, this.size - w, this.size - w, [c, c, c, c]);
  }

  /** Lit bevel: the top face's top and left edges. */
  bevelPath(ctx) {
    const w = this.wall;
    const x = this.x + 0.6;
    const y = this.y + 0.6;
    ctx.moveTo(x, y + this.size - w - 1.5);
    ctx.lineTo(x, y + 1);
    ctx.lineTo(x + 1, y);
    ctx.lineTo(x + this.size - w - 1.5, y);
  }

  /** The AI's corrupted inlay on the top face, one of three hardware
   *  kinds (by `variant`), redrawn in R3 from the motifs of the
   *  NC-NETWORK-RECOVERY-ART-V2 tile sources: a socket (frame + window), a
   *  memory bank (frame + three cells), a port (hexagon). Closed shapes:
   *  filled translucent and stroked in the layer colour. */
  inlayPath(ctx) {
    const t = this.size - this.wall;
    const cx = this.x + t / 2;
    const cy = this.y + t / 2;
    if (this.variant === 2) {
      polygonPath(ctx, cx, cy, t * 0.27, 6, Math.PI / 6);
    } else {
      const w = t * 0.56;
      const h = t * 0.42;
      chamferPath(ctx, cx - w / 2, cy - h / 2, w, h, [h * 0.18, h * 0.18, h * 0.18, h * 0.18]);
    }
  }

  /** The inlay's hot parts (bright fill): the socket's window with a
   *  white-hot dot, the memory bank's three cells, the port's contact. */
  inlayCorePath(ctx) {
    const t = this.size - this.wall;
    const cx = this.x + t / 2;
    const cy = this.y + t / 2;
    if (this.variant === 1) {
      const bw = t * 0.09;
      for (const dx of [-0.15, 0, 0.15]) ctx.rect(cx + dx * t - bw / 2, cy - t * 0.12, bw, t * 0.24);
    } else if (this.variant === 2) {
      ctx.moveTo(cx + t * 0.07, cy);
      ctx.arc(cx, cy, t * 0.07, 0, Math.PI * 2);
    } else {
      ctx.rect(cx - t * 0.16, cy - t * 0.1, t * 0.32, t * 0.2);
    }
  }

  /** Corrupted edge light: an L along the face's left and bottom edges
   *  (the asset set's signature line), plus the port's trace. */
  glowPath(ctx) {
    const t = this.size - this.wall;
    const i = Math.max(1.2, t * 0.08);
    ctx.moveTo(this.x + i, this.y + t * 0.18);
    ctx.lineTo(this.x + i, this.y + t - i);
    ctx.lineTo(this.x + t * 0.88, this.y + t - i);
    if (this.variant === 2) {
      const cx = this.x + t / 2;
      const cy = this.y + t / 2;
      ctx.moveTo(this.x + i, cy);
      ctx.lineTo(cx - t * 0.27, cy);
    }
  }

  /** Micro-circuit: two short contact slots on the face's top edge, away
   *  from the inlay (R3; the lattice attaches at the tile centre). */
  tracePath(ctx) {
    const t = this.size - this.wall;
    const y = this.y + t * 0.14;
    for (const fx of [0.3, 0.7]) {
      ctx.moveTo(this.x + t * fx - t * 0.08, y);
      ctx.lineTo(this.x + t * fx + t * 0.08, y);
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
   * Draws a set of blocks in batches (one path per pass and colour, no
   * save/restore or shadow per block: NC-13). Look "Network Recovery"
   * (NC-AI-RECOVERY-1, docs/GAME_DESIGN.md "Visual identity"): every block is
   * a 2.5D hardware tile on the floor of the AI's network, its footprint
   * exactly the collision square. Floor shadow, side walls, a raised top face
   * with a lit bevel, the AI's corrupted inlay and circuits (red outer
   * layer, ember inner layer), a thin outline on the true collision edge.
   * Damage = the player's recovery breaking in: cyan cracks with white
   * cores, the inlay dims, the last stage flickers. Pending shatter = the
   * tile is already recovered (cyan). Relays and the AI core draw their own
   * silhouette on the same tile base; broken tiles split into shards.
   */
  static drawCore(ctx, blocks, time, reducedMotion, underlay) {
    const tiles = [];
    const armour = [];
    const relays = [];
    const hearts = [];
    const dying = [];
    for (const b of blocks) {
      if (!b.alive) dying.push(b);
      else if (b.kind === 'heart') hearts.push(b);
      else {
        tiles.push(b);
        if (b.kind === 'relay') relays.push(b);
        else armour.push(b);
      }
    }
    ctx.save();
    ctx.lineJoin = 'round';
    const canvasTiles = tiles;
    const canvasArmour = armour;
    if (canvasTiles.length) {
      // 1. Floor shadows (the tiles stand on the network floor): only the
      //    L-shaped strip that shows beside the tile is filled (a full rect
      //    under every tile cost ~1 Mpx of blending per frame at 1920x1080).
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      for (const b of canvasTiles) {
        const s = b.size;
        const x1 = b.x + s;
        const y1 = b.y + s;
        ctx.moveTo(x1, b.y + s * 0.16);
        ctx.lineTo(x1 + s * 0.1, b.y + s * 0.16);
        ctx.lineTo(x1 + s * 0.1, y1 + s * 0.16);
        ctx.lineTo(b.x + s * 0.1, y1 + s * 0.16);
        ctx.lineTo(b.x + s * 0.1, y1);
        ctx.lineTo(x1, y1);
        ctx.closePath();
      }
      ctx.fill();
      // 2. Side walls: the body in the darkest tone (right wall), then the
      //    bottom wall a step lighter, so every tile reads as a solid block.
      ctx.fillStyle = COLORS.tileSide;
      ctx.beginPath();
      for (const b of canvasTiles) b.bodyPath(ctx);
      ctx.fill();
      ctx.fillStyle = COLORS.tileWall;
      ctx.beginPath();
      for (const b of canvasTiles) {
        const w = b.wall;
        const y0 = b.y + b.size - w;
        ctx.moveTo(b.x, y0);
        ctx.lineTo(b.x + b.size - w, y0);
        ctx.lineTo(b.x + b.size - 0.5, b.y + b.size - 0.5);
        ctx.lineTo(b.x + 0.8, b.y + b.size - 0.5);
        ctx.closePath();
      }
      ctx.fill();
      // 3. Raised top faces. AI-held hardware is tinted by its layer (wine
      //    red outer, rust inner) and drains to neutral steel as it takes
      //    damage; relays get a dark neutral top for their capacitor.
      const faces = new Map();
      for (const b of canvasTiles) {
        const key = b.kind === 'relay' ? COLORS.tileTop : b.shatter !== null ? '#1d4654'
          : (b.color === COLORS.ember ? Block.EMBER_FACES : Block.HOSTILE_FACES)[b.damageStage];
        if (!faces.has(key)) faces.set(key, []);
        faces.get(key).push(b);
      }
      for (const [color, list] of faces) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const b of list) b.topPath(ctx);
        ctx.fill();
      }
      // 4. Sheen on the upper part of each face, lit bevel (top/left
      //    edges), dark crease where the face meets the walls.
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      for (const b of canvasTiles) { const t = b.size - b.wall; ctx.rect(b.x + 1, b.y + 1, t - 2, t * 0.38); }
      ctx.fill();
      ctx.strokeStyle = COLORS.tileHi;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (const b of canvasTiles) b.bevelPath(ctx);
      ctx.stroke();
      ctx.strokeStyle = '#05060a';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (const b of canvasTiles) {
        const t = b.size - b.wall;
        ctx.moveTo(b.x + t, b.y + 1.5);
        ctx.lineTo(b.x + t, b.y + t);
        ctx.lineTo(b.x + 1.5, b.y + t);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 5. The AI's corrupted inlay + circuits, per layer colour, damage and
    //    "breath": a slow wave of light runs outward from the core through
    //    the structure (4 brightness steps, so it stays batched) — the
    //    system is alive. Static with prefers-reduced-motion.
    const groups = new Map();
    for (const b of canvasArmour) {
      if (b.shatter !== null) continue;
      const wave = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(time * 2.2 - Math.hypot(b.offsetX, b.offsetY) * 0.09);
      const key = `${b.color}|${b.damageStage}|${Math.min(3, Math.floor(wave * 4))}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    for (const [key, list] of groups) {
      const [color, stageText, breathText] = key.split('|');
      const stage = Number(stageText);
      const light = [1, 0.78, 0.58, 0.42][stage] * [0.62, 0.76, 0.9, 1.04][Number(breathText)] * (stage === 3 && !reducedMotion ? 0.8 + 0.2 * Math.sin(time * 9) : 1);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      // Circuits (no glow: cheap).
      ctx.globalAlpha = 0.32 * light;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const b of list) b.tracePath(ctx);
      ctx.stroke();
      // Inlay: a glowing socket = a translucent wide stroke under a thin one.
      ctx.beginPath();
      for (const b of list) b.inlayPath(ctx);
      ctx.globalAlpha = 0.22 * light;
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = Math.min(1, 1.05 * light);
      ctx.stroke();
      ctx.beginPath();
      for (const b of list) b.glowPath(ctx);
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = Math.min(1, 0.9 * light);
      ctx.stroke();
      ctx.beginPath();
      for (const b of list) b.inlayCorePath(ctx);
      ctx.fillStyle = COLORS.coreHot;
      ctx.globalAlpha = Math.min(1, 1.05 * light);
      ctx.fill();
      ctx.fillStyle = color;
      // Edge of the collision square in the layer colour.
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 * light;
      ctx.beginPath();
      for (const b of list) b.bodyPath(ctx);
      ctx.stroke();
    }
    // The network lattice runs over the tile bodies, under the cracks.
    if (underlay) underlay(ctx);
    // 6. Cracks: the player's recovery (cyan, white-hot core) breaking in.
    const cracked = new Map();
    for (const b of canvasArmour) {
      const stage = b.damageStage;
      if (stage === 0 || b.shatter !== null) continue;
      if (!cracked.has(stage)) cracked.set(stage, []);
      cracked.get(stage).push(b);
    }
    for (const [stage, list] of cracked) {
      ctx.beginPath();
      for (const b of list) b.crackPath(ctx, stage);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.95;
      ctx.stroke();
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // 7. Recovered by the shatter wave (pending): the tile turns cyan.
    const flipped = canvasArmour.filter((b) => b.shatter !== null);
    if (flipped.length) {
      ctx.fillStyle = COLORS.cyan;
      ctx.strokeStyle = COLORS.ice;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      for (const b of flipped) b.topPath(ctx);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const b of flipped) b.bodyPath(ctx);
      ctx.stroke();
    }
    // 8. Hit flashes: a white edge that fades in 0.25 s.
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1.8;
    for (const b of armour) {
      if (b.hitFlash <= 0) continue;
      ctx.globalAlpha = b.hitFlash * 0.9;
      ctx.beginPath();
      b.bodyPath(ctx);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of relays) b.drawRelay(ctx, time, reducedMotion);
    for (const b of hearts) b.drawHeart(ctx, time, reducedMotion);
    if (dying.length) Block.drawShards(ctx, dying);
    ctx.restore();
  }

  /** A broken tile flies apart as four triangular shards (centre to each
   *  edge), drifting outward while it fades (hitFlash 1 -> 0 in 0.25 s);
   *  their edges turn cyan: the cell is recovered. */
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
      ctx.fillStyle = COLORS.tileTop;
      ctx.strokeStyle = b.kind === 'heart' ? COLORS.white : COLORS.cyan;
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

  /** Relay (the AI's power hub): an amber hexagonal capacitor standing on
   *  its tile, a pulsing charge cell and three terminals; arcs crawl over it
   *  when it is about to blow. */
  drawRelay(ctx, time, reducedMotion) {
    const top = this.size - this.wall;
    const cx = this.x + top / 2;
    const cy = this.y + top / 2;
    const s = this.size;
    const stage = this.damageStage;
    const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * 5 + this.seed);
    const r = top * 0.44;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.amber;
    ctx.shadowColor = COLORS.amber;
    // Terminals to the tile's edge.
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 2) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * top * 0.5, cy + Math.sin(a) * top * 0.5);
    }
    ctx.stroke();
    // Edge of the collision square.
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    this.bodyPath(ctx);
    ctx.stroke();
    // Hexagon shell.
    ctx.globalAlpha = [1, 0.85, 0.7, 0.55][stage];
    ctx.shadowBlur = 10 + this.hitFlash * 10;
    ctx.lineWidth = 1.7;
    ctx.fillStyle = COLORS.tileSide;
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
      ctx.strokeStyle = COLORS.cyan;
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

  /** AI core from the atlas (R3): sealed above half HP, fractured below
   *  (the set's "exposed" sprite shows a check mark, read as already
   *  recovered: not used; exposure keeps its magenta ring); a Canvas guard ring
   *  of six segments turns around it (one lost per sixth of HP, the state
   *  the three sprites cannot show), plus the hit flash. */
  drawHeartSprite(ctx, time, reducedMotion) {
    const hp = clamp(this.hp / this.maxHp, 0, 1);
    const id = hp > 0.5 ? 'heart_sealed' : 'heart_fractured';
    const S = this.size;
    if (!Block.atlas.get(id, S * Block.pxScale)) return false;
    const cx = this.cx;
    const cy = this.cy;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3.2);
    ctx.save();
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(this.x + S * 0.08, this.y + S * 0.12, S, S);
    Block.atlas.draw(ctx, id, this.x, this.y, S, Block.pxScale);
    const segments = Math.ceil(hp * 6 - 1e-9);
    const spin = reducedMotion ? 0 : time * 0.6;
    const R = S * 0.72;
    const color = Block.exposedHeart ? COLORS.magenta : COLORS.hostile;
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    ctx.lineWidth = Math.max(1.4, S * 0.055);
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < segments; i++) {
      const a = spin + (i / 6) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.arc(cx, cy, R, a, a + 0.78);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.bodyPath(ctx);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  /**
   * The rogue AI's core (NC-AI-RECOVERY-1): a processor die on a socket —
   * a square silhouette that is exactly its collision box, unlike any tile.
   * Floor shadow; a dark socket with pins running from the die to every
   * edge; the die with a crimson rim; a guard ring of six segments (one
   * falls away per sixth of HP); at the centre a faceted red crystal whose
   * four shards drift apart as the core weakens, the gaps filling with the
   * player's cyan light (closed = full HP, open = about to be recovered).
   * A geometric sign, deliberately no eye, face or skull.
   */
  drawHeart(ctx, time, reducedMotion) {
    if (SPRITE_USE.core && Block.atlas && this.drawHeartSprite(ctx, time, reducedMotion)) return;
    const hp = clamp(this.hp / this.maxHp, 0, 1);
    const open = 1 - hp;
    const S = this.size;
    const w = Math.max(2, S * 0.08);
    const top = S - w;
    const cx = this.x + top / 2;
    const cy = this.y + top / 2;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3.2);
    ctx.save();
    ctx.lineJoin = 'round';
    // Floor shadow and socket (side walls + top).
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(this.x + S * 0.1, this.y + S * 0.14, S, S);
    ctx.fillStyle = COLORS.tileSide;
    ctx.beginPath();
    this.bodyPath(ctx);
    ctx.fill();
    ctx.fillStyle = '#2b1522';
    ctx.fillRect(this.x, this.y, top, top);
    ctx.strokeStyle = COLORS.tileHi;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 0.6, this.y + top);
    ctx.lineTo(this.x + 0.6, this.y + 0.6);
    ctx.lineTo(this.x + top, this.y + 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Data ring: a dashed ring turning around the socket (the AI's
    // signature; light only, nothing solid outside the collision box).
    if (ctx.setLineDash) ctx.setLineDash([S * 0.09, S * 0.07]);
    ctx.lineDashOffset = reducedMotion ? 0 : -time * S * 0.3;
    ctx.strokeStyle = COLORS.hostile;
    ctx.globalAlpha = 0.55 + 0.25 * pulse;
    ctx.lineWidth = Math.max(1, S * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.76, 0, Math.PI * 2);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Pins: from the die to every edge of the socket.
    const die = top * 0.62;
    const d0 = (top - die) / 2;
    const pins = S >= 30 ? 5 : 3;
    ctx.strokeStyle = COLORS.coreHot;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(0.9, top * 0.04);
    ctx.beginPath();
    for (let i = 0; i < pins; i++) {
      const f = this.y + d0 + die * ((i + 0.5) / pins);
      const g = this.x + d0 + die * ((i + 0.5) / pins);
      ctx.moveTo(this.x + 1.2, f); ctx.lineTo(this.x + d0, f);
      ctx.moveTo(this.x + top - 1.2, f); ctx.lineTo(this.x + top - d0, f);
      ctx.moveTo(g, this.y + 1.2); ctx.lineTo(g, this.y + d0);
      ctx.moveTo(g, this.y + top - 1.2); ctx.lineTo(g, this.y + top - d0);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Collision edge.
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.hostile;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    this.bodyPath(ctx);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Die: dark, crimson rim with glow.
    const c = die * 0.18;
    ctx.fillStyle = '#3a0a1c';
    ctx.strokeStyle = COLORS.hostile;
    ctx.shadowColor = COLORS.hostile;
    ctx.shadowBlur = 10 + pulse * 6 + this.hitFlash * 16;
    ctx.lineWidth = 2;
    ctx.beginPath();
    chamferPath(ctx, this.x + d0, this.y + d0, die, die, [c, c, c, c]);
    ctx.fill();
    ctx.stroke();
    // Guard ring: six segments, one lost per sixth of HP.
    const segments = Math.ceil(hp * 6 - 1e-9);
    const spin = reducedMotion ? 0 : time * 0.6;
    const R = die * 0.4;
    ctx.lineWidth = Math.max(1, die * 0.06);
    ctx.lineCap = 'butt';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < segments; i++) {
      const a = spin + (i / 6) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.arc(cx, cy, R, a, a + 0.72);
    }
    ctx.stroke();
    // Crystal: four facets around the centre (upper ones lit, lower ones
    // deep), drifting apart as HP falls; cyan light fills the gaps.
    const r = die * 0.34;
    const g = r * (0.06 + 0.5 * open);
    if (open > 0.02) {
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 6 + 10 * open;
      ctx.globalAlpha = 0.4 + 0.6 * open;
      ctx.lineWidth = Math.max(0.6, g * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx - r - g, cy); ctx.lineTo(cx + r + g, cy);
      ctx.moveTo(cx, cy - r - g); ctx.lineTo(cx, cy + r + g);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = COLORS.hostile;
    ctx.shadowBlur = 8 + 6 * pulse;
    const facet = (sx, sy, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      const ox = cx + sx * g;
      const oy = cy + sy * g;
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + sx * r, oy);
      ctx.lineTo(ox, oy + sy * r);
      ctx.closePath();
      ctx.fill();
    };
    facet(-1, -1, COLORS.coreHot);
    facet(1, -1, '#ff6b6b');
    ctx.shadowBlur = 0;
    facet(-1, 1, '#c21d3a');
    facet(1, 1, '#7d0f24');
    // Hot centre.
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = open > 0.5 ? COLORS.cyan : COLORS.hostile;
    ctx.shadowBlur = 8 + 10 * open + pulse * 4;
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.beginPath();
    polygonPath(ctx, cx, cy, Math.max(0.9, r * 0.28), 4, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.bodyPath(ctx);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Top-face tints of AI-held tiles by damage stage 0..3 (R2): saturated
// wine/rust while intact, draining to neutral steel as recovery breaks in.
Block.HOSTILE_FACES = ['#57233a', '#4a2739', '#3a2c3d', '#2e3346'];
// Sprite atlas globals (R3; set by Game).
Block.atlas = null;
Block.pxScale = 1;
Block.exposedHeart = false;
Block.EMBER_FACES = ['#58301f', '#4b2f26', '#3c2e30', '#2e3346'];

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

  /** All drones in batched passes (NC-AI-RECOVERY-1: the balls are the
   *  player's autonomous recovery drones). A floor shadow offset down-right
   *  (they fly above the network), a short motion trail, a soft halo, a cyan
   *  hull and a white-hot core (a dark casing band was measured at ~0.5 ms
   *  per frame with 60 drones at 1920x1080 and dropped). No shadowBlur: a blurred batch
   *  spanning the whole field cost ~22 ms per frame at 1920x1080 with 60
   *  balls in software raster (NC-13). Drones stay the brightest small
   *  objects on the field. */
  static drawAll(ctx, balls) {
    if (!balls.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    for (const b of balls) {
      ctx.moveTo(b.x + 2.5 + b.radius * 0.9, b.y + 4);
      ctx.arc(b.x + 2.5, b.y + 4, b.radius * 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
    // R3: on big screens / high DPR the drone sprite (one cached raster for
    // all drones; below DRONE_SPRITE_MIN_PX the Canvas drone reads better),
    // trail and shadow stay batched Canvas; a white disc marks the Breach
    // power flash.
    const atlas = Block.atlas;
    const size = balls[0].radius * 2.4;
    if (SPRITE_USE.drone && atlas && size * Block.pxScale >= DRONE_SPRITE_MIN_PX && atlas.get('drone_player', size * Block.pxScale)) {
      ctx.strokeStyle = COLORS.cyan;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const b of balls) {
        ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        ctx.lineTo(b.x - b.vx * 0.034, b.y - b.vy * 0.034);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (const b of balls) atlas.draw(ctx, 'drone_player', b.x - size / 2, b.y - size / 2, size, Block.pxScale);
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      let flashing = false;
      for (const b of balls) {
        if (b.flash <= 0) continue;
        flashing = true;
        ctx.moveTo(b.x + b.radius, b.y);
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      }
      if (flashing) { ctx.globalAlpha = 0.8; ctx.fill(); }
      ctx.restore();
      return;
    }
    const byColor = new Map();
    for (const b of balls) {
      const key = b.flash > 0 ? COLORS.white : b.color;
      if (!byColor.has(key)) byColor.set(key, []);
      byColor.get(key).push(b);
    }
    for (const [color, list] of byColor) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        ctx.lineTo(b.x - b.vx * 0.034, b.y - b.vy * 0.034);
      }
      ctx.stroke();
      const halo = color === COLORS.white ? 2.6 : 1.9;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      for (const b of list) {
        ctx.moveTo(b.x + b.radius * halo, b.y);
        ctx.arc(b.x, b.y, b.radius * halo, 0, Math.PI * 2);
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
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    for (const b of balls) {
      ctx.moveTo(b.x + b.radius * 0.45, b.y);
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
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

  /** Four-segment override charge ring (magenta) at radius `r`, in the
   *  turret's rotated frame; pulses when ready. */
  drawChargeRing(ctx, charge, ready, pulse, r) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    for (let i = 0; i < 4; i++) {
      const fill = clamp(charge * 4 - i, 0, 1);
      const a = Math.PI + i * (Math.PI / 2) + 0.12;
      ctx.globalAlpha = 0.18;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r, a, a + Math.PI / 2 - 0.24);
      ctx.stroke();
      if (fill > 0) {
        ctx.globalAlpha = ready ? 0.6 + 0.4 * pulse : 0.9;
        ctx.shadowBlur = ready ? 10 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, a, a + (Math.PI / 2 - 0.24) * fill);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
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
    // Floor shadow and the pad's side wall (2.5D, light from the top-left;
    // drawn before the rotation so they always fall down-right).
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.arc(this.x + 2.5, this.y + 3.5, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.tileSide;
    ctx.beginPath();
    ctx.arc(this.x + 0.8, this.y + 1.4, 11.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.lineJoin = 'round';
    // Pad: the player's uplink, a round platform with a cyan rim.
    ctx.fillStyle = COLORS.tileTop;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;
    this.drawChargeRing(ctx, charge, ready, pulse, 13);
    // Rails.
    ctx.fillStyle = COLORS.tileSide;
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

// SVG namespace identifier for the embedded sprites (an XML name, never
// fetched; the one http literal qa/integrity.mjs allows).
const SVG_NS = 'http://www.w3.org/2000/svg';
// Which elements draw from the sprite atlas — the winners of the in-game A/B
// (R3, docs/VISUAL_IDENTITY.md): the AI core, the firewall node and, from 30
// device pixels up (big screens, high DPR), the drones. Tiles, relays and
// uplinks lost the A/B and stay Canvas. Every element is drawn by the Canvas
// code until its sprite has loaded, and where images are unavailable (QA
// harness).
const SPRITE_USE = { core: true, node: true, drone: true };
// Drones switch to the sprite only from this size on screen (device px).
const DRONE_SPRITE_MIN_PX = 30;

/**
 * Sprite atlas (NC-AI-RECOVERY-1 R3): the embedded SVG sources are decoded
 * once from data: URIs (no network request) and rasterised on demand at the
 * device-pixel size they are drawn at (rounded up to 4 px), so they stay
 * sharp at DPR 1 and 2 and every world scale. Drawing only: nothing here
 * touches the simulation or its RNG.
 */
class SpriteAtlas {
  constructor() {
    this.images = new Map();
    this.cache = new Map();
    if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    for (const id of Object.keys(SPRITE_SVG)) {
      try {
        const img = new Image();
        img.onload = () => this.images.set(id, img);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="${SVG_NS}" viewBox="0 0 128 128" width="128" height="128">${SPRITE_DEFS}${SPRITE_SVG[id]}</svg>`);
      } catch (err) {
        // No sprite: the Canvas fallback draws this element.
      }
    }
  }

  /** Raster of sprite `id` at about `px` device pixels, or null. */
  get(id, px) {
    const img = this.images.get(id);
    if (!img) return null;
    const n = Math.max(8, Math.min(512, Math.ceil(px / 4) * 4));
    const key = `${id}|${n}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let c = null;
    try {
      c = document.createElement('canvas');
      c.width = n;
      c.height = n;
      c.getContext('2d').drawImage(img, 0, 0, n, n);
    } catch (err) {
      c = null;
    }
    if (this.cache.size > 300) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }

  /** Draws sprite `id` over the world box (x, y, size); false if unavailable. */
  draw(ctx, id, x, y, size, pxScale) {
    const r = this.get(id, size * pxScale);
    if (!r) return false;
    ctx.drawImage(r, x, y, size, size);
    return true;
  }
}

// >>> SPRITES (generated from NC-NETWORK-RECOVERY-ART-V2/svg, 128x128 viewBox; see docs/VISUAL_IDENTITY.md)
const SPRITE_DEFS = '<defs><linearGradient id="metal" x1="0" y1="0" x2=".95" y2="1"><stop stop-color="#73859f"/><stop offset=".32" stop-color="#404d65"/><stop offset=".72" stop-color="#202a3d"/><stop offset="1" stop-color="#45546d"/></linearGradient><linearGradient id="face" x1=".07" y1="0" x2=".90" y2="1"><stop stop-color="#4c5972"/><stop offset=".45" stop-color="#29334a"/><stop offset="1" stop-color="#1d273b"/></linearGradient><linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#22283f"/><stop offset="1" stop-color="#0e182a"/></linearGradient><linearGradient id="red" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#ffb8c5"/><stop offset=".16" stop-color="#ff4a72"/><stop offset=".60" stop-color="#b81e4a"/><stop offset="1" stop-color="#6a1732"/></linearGradient><linearGradient id="cyan" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#eeffff"/><stop offset=".28" stop-color="#41f9fc"/><stop offset=".65" stop-color="#0cb1c9"/><stop offset="1" stop-color="#05738c"/></linearGradient><linearGradient id="amber" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#fff3bc"/><stop offset=".32" stop-color="#ffc558"/><stop offset=".73" stop-color="#ca6328"/><stop offset="1" stop-color="#7b3826"/></linearGradient><linearGradient id="magenta" x1=".2" y1="0" x2=".9" y2="1"><stop stop-color="#ffe6ff"/><stop offset=".38" stop-color="#ff5ce1"/><stop offset="1" stop-color="#962c91"/></linearGradient><radialGradient id="core"><stop stop-color="#fffce9"/><stop offset=".19" stop-color="#ff76a2"/><stop offset=".61" stop-color="#e22b59"/><stop offset="1" stop-color="#83102d"/></radialGradient></defs>';
const SPRITE_SVG = {
  heart_sealed: '<rect x="5" y="13" width="118" height="108" rx="13" fill="#090e1b" stroke="#0a1120" stroke-width="5"/><rect x="4" y="8" width="120" height="100" rx="10" fill="url(#metal)" stroke="#9dacc6" stroke-width="5"/><rect x="12" y="15" width="104" height="88" rx="7" fill="#171e30" stroke="#e6c4d6" stroke-width="4"/><circle cx="19" cy="24" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="19" cy="92" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="109" cy="24" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="109" cy="92" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><path d="M12 35 H28 M100 35 H116" stroke="#ff4e69" stroke-width="5"/><path d="M12 55 H28 M100 55 H116" stroke="#ff4e69" stroke-width="5"/><path d="M12 75 H28 M100 75 H116" stroke="#ff4e69" stroke-width="5"/><path d="M37 25 H92 L107 44 V80 L92 98 H37 L21 80 V44 Z" fill="#080c19" stroke="#f4647a" stroke-width="7"/><path d="M40 31 H88 L100 46 V77 L88 91 H40 L28 77 V46Z" fill="#4b172c" stroke="#ffb9c0" stroke-width="3"/><path d="M65 32 L88 55 L64 87 L39 55 Z" fill="url(#red)" stroke="#ffcad3" stroke-width="6"/><path d="M65 36 L65 81 L81 56Z" fill="#7c1632" opacity=".68"/><path d="M44 56 L64 35 L64 79Z" fill="#ff91a8" opacity=".5"/><path d="M64 42 L76 56 L64 78 L51 56Z" fill="url(#core)" /><rect x="31" y="6" width="15" height="7" fill="#ff3f61"/><rect x="82" y="6" width="15" height="7" fill="#ff3f61"/>',
  heart_fractured: '<rect x="5" y="13" width="118" height="108" rx="13" fill="#090e1b" stroke="#0a1120" stroke-width="5"/><rect x="4" y="8" width="120" height="100" rx="10" fill="url(#metal)" stroke="#9dacc6" stroke-width="5"/><rect x="12" y="15" width="104" height="88" rx="7" fill="#171e30" stroke="#e6c4d6" stroke-width="4"/><circle cx="19" cy="24" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="19" cy="92" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="109" cy="24" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><circle cx="109" cy="92" r="5" fill="#c5cfde" stroke="#293b59" stroke-width="2"/><path d="M12 35 H28 M100 35 H116" stroke="#ff4e69" stroke-width="5"/><path d="M12 55 H28 M100 55 H116" stroke="#ff4e69" stroke-width="5"/><path d="M12 75 H28 M100 75 H116" stroke="#ff4e69" stroke-width="5"/><path d="M37 25 H92 L107 44 V80 L92 98 H37 L21 80 V44 Z" fill="#080c19" stroke="#f4647a" stroke-width="7"/><path d="M40 31 H88 L100 46 V77 L88 91 H40 L28 77 V46Z" fill="#4b172c" stroke="#ffb9c0" stroke-width="3"/><path d="M62 30 L82 47 L67 57 L55 45 Z" fill="url(#red)" stroke="#ffc7d4" stroke-width="5"/><path d="M42 52 L57 61 L55 82 L34 67 Z" fill="url(#red)" stroke="#f6abc4" stroke-width="5"/><path d="M73 59 L95 53 L92 77 L70 89 Z" fill="url(#red)" stroke="#f6abc4" stroke-width="5"/><path d="M64 36 L63 87 M43 61 L91 54" fill="none" stroke="#17e6ee" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" /><rect x="31" y="6" width="15" height="7" fill="#ff3f61"/><rect x="82" y="6" width="15" height="7" fill="#ff3f61"/>',
  firewall_locked: '<rect x="3" y="7" width="122" height="117" rx="5" fill="#0c1020" stroke="#20253a" stroke-width="4"/><rect x="3" y="5" width="121" height="111" rx="5" fill="url(#metal)" stroke="#c0c7d6" stroke-width="5"/><rect x="16" y="18" width="95" height="87" rx="4" fill="#2f1e38" stroke="#b34e8c" stroke-width="5"/><path d="M44 60 V47 Q44 24 64 24 Q84 24 84 47 V60" fill="none" stroke="#ffd9ee" stroke-width="9"/><rect x="37" y="53" width="55" height="39" rx="6" fill="url(#magenta)" stroke="#ffcbf7" stroke-width="6"/><circle cx="64" cy="68" r="6" fill="#631747"/><path d="M64 72 V82" stroke="#631747" stroke-width="6"/><path d="M6 31 V13 H26" fill="none" stroke="#fa42c8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" /><path d="M102 13 H122 V31" fill="none" stroke="#fa42c8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" /><path d="M6 93 V112 H26" fill="none" stroke="#fa42c8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" /><path d="M102 112 H122 V93" fill="none" stroke="#fa42c8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" />',
  firewall_broken: '<rect x="3" y="7" width="122" height="117" rx="5" fill="#0c1020" stroke="#20253a" stroke-width="4"/><rect x="3" y="5" width="121" height="111" rx="5" fill="url(#metal)" stroke="#c0c7d6" stroke-width="5"/><rect x="16" y="18" width="95" height="87" rx="4" fill="#2f1e38" stroke="#b34e8c" stroke-width="5"/><path d="M41 58 L59 77 L93 36" fill="none" stroke="#e9ffff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 58 L59 77 L93 36" fill="none" stroke="#17e6ee" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" /><path d="M10 10 H118 V109 H10 Z" fill="none" stroke="#23e5f3" stroke-width="6"/>',
  drone_player: '<circle cx="64" cy="66" r="54" fill="#001a2a" stroke="#126e8a" stroke-width="6"/><circle cx="64" cy="62" r="47" fill="url(#cyan)" stroke="#e0ffff" stroke-width="8"/><circle cx="64" cy="59" r="29" fill="#046c90" stroke="#78fbff" stroke-width="5"/><circle cx="64" cy="54" r="20" fill="#f9ffff"/><path d="M38 48 L47 40" stroke="#fff" stroke-width="7" stroke-linecap="round"/>',
};
// <<< SPRITES

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
    // Adaptive defense (NC-AI-RECOVERY-1; session only, never saved).
    // `defenseFromLevel` is a test seam: Infinity turns the AI's reaction off
    // (qa/sim-compare.mjs proves the rest of the simulation is unchanged).
    this.defenseFromLevel = DEFENSE_FROM_LEVEL;
    this.heart = null;
    this.defense = null;
    this.exposed = null;
    this.defenseTimer = DEFENSE_FIRST_DELAY;
    this.reroutes = 0;
    this.shieldsBroken = 0;
    this.playerBreaks = 0;
    this.lanceManual = false;
    // Cosmetic: cells recovered in this sector (faint cyan floor marks) and
    // the AI-alert label at the top of the field.
    this.recovered = [];
    this.alert = 0;
    // Event toasts in the HUD's left column (hudLayout).
    this.toasts = [];
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
    // Recovery progress as of the last UI tick (drawing only).
    this.uiProgress = 0;
    this.coreBornAt = -10;
    this.bgCanvas = null;
    this.bgKey = '';
    this.aim = null;
    this.time = 0;
    this.screenFlash = 0;
    this.shake = 0;
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sound = new Sound();
    // Sprite atlas (R3) shared with the static Block drawing code.
    this.sprites = new SpriteAtlas();
    Block.atlas = this.sprites;

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
    // Device pixels per world unit, for sprite rasters (R3).
    Block.pxScale = dpr * scale;

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
      this.blocks.push(new Block(p.x, p.y, layout.size, maxHp, moneyPerHit, COLORS.hostile));
    }
    this.blockHp = maxHp;
    this.blockMoney = moneyPerHit;
    this.blockStep = layout.size + (useGrid ? 5 : 8);
    this.placeHeart(layout, useGrid, maxHp, moneyPerHit);
    this.markInnerShield(layout, useGrid);
    this.placeRelays(level);
    this.buildNetwork();
    this.heart = this.blocks.find((b) => b.kind === 'heart') || null;
    this.defense = null;
    this.exposed = null;
    this.defenseTimer = DEFENSE_FIRST_DELAY;
    this.recovered = [];
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
    const heart = new Block(0, 0, size, HEART_HP * maxHp, moneyPerHit, COLORS.coreHot);
    heart.kind = 'heart';
    this.blocks.push(heart);
  }

  /** Cosmetic (NC-ART-1, recoloured in NC-AI-RECOVERY-1): the armour layer
   *  touching the heart is its inner layer, ember; the rest is AI red. Only
   *  cores with at least two layers have one (a 3x3 core stays all red, so
   *  on sector 1 the core stands alone in the middle). */
  markInnerShield(layout, useGrid) {
    const heart = this.blocks.find((b) => b.kind === 'heart');
    if (!heart) return;
    if (useGrid) {
      if (layout.n < 5) return;
      const reach = heart.size / 2 + layout.size + 6;
      for (const b of this.blocks) {
        if (b.kind === 'armor' && Math.max(Math.abs(b.offsetX), Math.abs(b.offsetY)) <= reach) { b.layer = 1; b.color = COLORS.ember; }
      }
    } else {
      let maxR = 0;
      for (const b of this.blocks) if (b.kind === 'armor') maxR = Math.max(maxR, Math.hypot(b.offsetX, b.offsetY));
      for (const b of this.blocks) {
        if (b.kind === 'armor' && Math.hypot(b.offsetX, b.offsetY) < maxR - layout.size * 0.5) { b.layer = 1; b.color = COLORS.ember; }
      }
    }
  }

  /** Cosmetic (NC-ART-1): the core is drawn as one
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
    this.lanceManual = !!manual;
    const cash0 = this.cash;
    for (const turret of this.turrets) {
      this.castLance(turret, x, y);
      turret.flash = 1;
    }
    this.lanceManual = false;
    if (this.cash > cash0) this.addFloatText(x, y, this.cash - cash0, COLORS.green);
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
    // The recovery units answer the AI on their own: an active firewall node
    // is the autopilot's first target (NC-AI-RECOVERY-1).
    if (this.defense && this.defense.node.alive) return { x: this.defense.node.cx, y: this.defense.node.cy };
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
      // A shielded core soaks more of the pulse, an exposed block less
      // (the factor is read per block: breaking the firewall node with this
      // very pulse exposes the blocks behind it at once).
      const f = this.damageFactor(b, 'lance');
      const dmg = Math.min(power * f, b.hp);
      power -= dmg / f;
      this.hitBlock(b, dmg, turret.x + dx * t, turret.y + dy * t, 'lance', true);
      if (power <= 1e-9) { power = 0; endT = t + b.size * 0.5; }
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
  hitBlock(block, damage, x, y, source, scaled) {
    if (!scaled) damage *= this.damageFactor(block, source);
    this.cash += block.moneyPerHit;
    // One "+$n" per drone hit; a pulse or a shockwave shows one total
    // instead of a label on every block it crosses (R2: less clutter).
    if (source === 'ball') this.addFloatText(x, y, block.moneyPerHit, COLORS.green);
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
    if (block.kind !== 'heart') this.recovered.push(block);
    if (this.defense && block === this.defense.node) this.breakDefense(block);
    if (block.kind === 'relay') this.triggerRelay(block);
    else if (block.kind === 'heart') this.shatterCore(block);
  }

  /** Damage multiplier for a block (NC-AI-RECOVERY-1): the AI's shield on
   *  its core softens every hit; after its firewall node was broken, the
   *  exposed core and power line take EXPOSE_FACTOR from override pulses
   *  and relay shockwaves (the drones keep their normal damage). */
  damageFactor(block, source) {
    if (this.defense && block === this.defense.target) return SHIELD_FACTOR;
    if (source !== 'ball' && this.exposed && this.exposed.blocks.includes(block)) return EXPOSE_FACTOR;
    return 1;
  }

  /** The AI's reaction, advanced every fixed step (deterministic). */
  updateDefense(dt) {
    if (this.alert > 0) this.alert = Math.max(0, this.alert - dt);
    if (this.exposed) {
      this.exposed.t -= dt;
      if (this.exposed.t <= 0) this.exposed = null;
    }
    const heart = this.heart;
    if (this.level < this.defenseFromLevel || !heart || !heart.alive) {
      if (this.defense) this.endDefense();
      return;
    }
    if (this.defense) {
      this.defense.t += dt;
      if (this.defense.t >= SHIELD_TIME) this.endDefense();
      return;
    }
    if (this.exposed) return;
    this.defenseTimer -= dt;
    if (this.defenseTimer > 0) return;
    const node = this.pickDefenseNode();
    if (!node) {
      this.defenseTimer = DEFENSE_RETRY;
      return;
    }
    this.reroutes += 1;
    node.firewall = true;
    this.defense = { node, target: heart, t: 0, path: this.blocksBetween(node, heart) };
    this.alert = 1.6;
    this.addRing(heart.cx, heart.cy, heart.size * 0.9, COLORS.amber, 0.45, 2);
    this.sound.play('shield');
  }

  /** The firewall node: an alive armour block that some turret's pulse
   *  hits first (nothing in front of it on that turret's lance line, R2), so
   *  drones and pulses can always reach it. Chosen with hash01 from the sector and the
   *  reroute count: no simulation RNG is consumed. */
  pickDefenseNode() {
    const alive = this.blocks.filter((b) => b.alive);
    const candidates = [];
    for (const b of alive) {
      if (b.kind !== 'armor') continue;
      for (const t of this.turrets) {
        let dx = b.cx - t.x;
        let dy = b.cy - t.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const tb = rayBoxEnter(t.x, t.y, dx, dy, b.x, b.y, b.x + b.size, b.y + b.size);
        if (tb === null) continue;
        // Same geometry as a lance (boxes grown by LANCE_HALF_WIDTH): a
        // pulse from this turret aimed at the node reaches it first.
        const w = LANCE_HALF_WIDTH;
        const tn = rayBoxEnter(t.x, t.y, dx, dy, b.x - w, b.y - w, b.x + b.size + w, b.y + b.size + w);
        let blocked = false;
        for (const o of alive) {
          if (o === b) continue;
          const to = rayBoxEnter(t.x, t.y, dx, dy, o.x - w, o.y - w, o.x + o.size + w, o.y + o.size + w);
          if (to !== null && to < tn) { blocked = true; break; }
        }
        if (!blocked) { candidates.push(b); break; }
      }
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(hash01(this.level * 7919 + this.reroutes * 104729) * candidates.length)];
  }

  /** Alive blocks crossed by the straight power line from `a` to `b`. */
  blocksBetween(a, b) {
    let dx = b.cx - a.cx;
    let dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const out = [];
    for (const o of this.blocks) {
      if (!o.alive || o === a || o === b) continue;
      const t = rayBoxEnter(a.cx, a.cy, dx, dy, o.x, o.y, o.x + o.size, o.y + o.size);
      if (t !== null && t < len) out.push(o);
    }
    return out;
  }

  /** The shield runs out (or the sector ends): the AI waits, then tries again. */
  endDefense() {
    if (!this.defense) return;
    this.defense.node.firewall = false;
    this.defense = null;
    this.defenseTimer = DEFENSE_COOLDOWN;
  }

  /** The firewall node was destroyed: the shield collapses, the core and the
   *  blocks on the power line are exposed, a small bonus is paid. */
  breakDefense(node) {
    const d = this.defense;
    const heart = d.target;
    this.shieldsBroken += 1;
    if (this.lanceManual) this.playerBreaks += 1;
    if (this.lanceManual) this.volleyCharge = Math.min(1, this.volleyCharge + BREAK_RECHARGE);
    this.endDefense();
    this.exposed = { t: EXPOSE_TIME, blocks: [heart, ...d.path.filter((b) => b.alive)], node: { x: node.cx, y: node.cy, size: node.size } };
    const bonus = OVERRIDE_BONUS * node.moneyPerHit;
    this.cash += bonus;
    this.addToast(`${this.t('shieldBroken')} +${formatMoney(bonus, this.lang)}`, COLORS.magenta);
    this.addRing(heart.cx, heart.cy, heart.size * 1.6, COLORS.magenta, 0.5, 3);
    if (this.arcs.length < MAX_ARCS) this.arcs.push(new Arc(node.cx, node.cy, heart.cx, heart.cy, node.seed, COLORS.cyan));
    this.alert = 0;
    this.sound.play('override');
  }

  /** Relay: bonus cash, full volley charge and a shockwave that damages every
   *  block within SHOCK_RADIUS_STEPS (chains through other relays). */
  triggerRelay(relay) {
    const bonus = RELAY_BONUS * relay.moneyPerHit;
    this.cash += bonus;
    // Above the core (never over the heart); chained relays stack upward.

    this.addToast(`${this.t('relay')} +${formatMoney(bonus, this.lang)}`, COLORS.cyan);
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
    this.endDefense();
    this.exposed = null;
    const bonus = HEART_BONUS * heart.moneyPerHit;
    this.cash += bonus;
    this.coresShattered += 1;
    this.addToast(`${this.t('breached')} +${formatMoney(bonus, this.lang)}`, COLORS.cyan);
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
    // NC-AI-RECOVERY-1: while the AI's shield is up, until the player has
    // broken one node with their own pulse this session.
    const defenseHint = !volleyHint && this.defense !== null && this.playerBreaks === 0;
    const newPlayer = this.isNewPlayer;
    const canBuy = newPlayer && this.cash >= this.ballCost;
    const show = volleyHint || defenseHint || newPlayer;
    hint.hidden = !show;
    if (show) {
      const text = this.t(volleyHint ? 'hintVolley' : defenseHint ? 'hintDefense' : (canBuy ? 'hintBuy' : 'hintStart'));
      if (hint.textContent !== text) hint.textContent = text;
    }
    hint.classList.toggle('hint--action', volleyHint);
    hint.classList.toggle('hint--alert', defenseHint);
    // From the third uplink on one sits at the bottom centre: the pill moves
    // to the bottom-left corner so it never covers it (R2).
    hint.classList.toggle('hint--side', this.turrets.length >= 3);
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
    this.updateDefense(dt);
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
      this.addToast(this.t('levelUp', { n: this.level }), COLORS.cyan, true);
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
    if (this.toasts.length) {
      for (const t of this.toasts) t.life -= dt;
      if (this.toasts[0].life <= 0) this.toasts = this.toasts.filter((t) => t.life > 0);
    }

    this.uiTimer += dt;
    if (this.uiTimer >= 0.15) {
      this.uiTimer = 0;
      this.updateUI();
      this.uiProgress = this.coreProgress;
      this.netSpeed = 0.35 + 1.4 * this.uiProgress;
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
    this.drawRecovered(ctx);
    this.drawAimPreview(ctx);
    Block.exposedHeart = !!(this.exposed && this.heart && this.heart.alive);
    Block.drawCore(ctx, this.visibleBlocks(), this.time, this.reducedMotion, (c) => {
      this.drawNetwork(c);
      this.drawConduits(c);
    });
    this.drawDefense(ctx);
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
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = this.screenFlash * (this.reducedMotion ? 0.04 : 0.12);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    this.drawHud(ctx);
  }

  /** Cells recovered in this sector (NC-AI-RECOVERY-1, cosmetic): every
   *  broken tile leaves a faint cyan outline and node on the floor, so the
   *  recovered part of the sector grows visibly under the AI's structure. */
  drawRecovered(ctx) {
    if (!this.recovered.length) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const k = this.coreScale;
    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.fillStyle = COLORS.cyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const b of this.recovered) {
      const s = b.baseSize * k * 0.8;
      ctx.rect(cx + b.baseOffsetX * k - s / 2, cy + b.baseOffsetY * k - s / 2, s, s);
    }
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.fillStyle = COLORS.cyan;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const b of this.recovered) ctx.rect(cx + b.baseOffsetX * k - 1, cy + b.baseOffsetY * k - 1, 2, 2);
    ctx.fill();
    ctx.restore();
  }

  /** Four corner brackets around (x, y): the "breakable / target" mark. */
  drawBrackets(ctx, x, y, r, k, color, alpha) {
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(x + sx * r, y + sy * (r - k));
      ctx.lineTo(x + sx * r, y + sy * r);
      ctx.lineTo(x + sx * (r - k), y + sy * r);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /**
   * The AI's reaction made visible (NC-AI-RECOVERY-1). While a shield is
   * up: an amber power line from the firewall node into the core with
   * energy flowing along it, an amber hexagonal shield around the core whose
   * six sides go out as its time runs down, and the node itself marked with
   * an amber lock and magenta target brackets (breakable). While the core is
   * exposed: a magenta breach line where the power line ran, magenta edges
   * on the exposed blocks and target brackets on the core.
   */
  drawDefense(ctx) {
    const d = this.defense;
    const e = this.exposed;
    if (!d && !e) return;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 7);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (d) {
      const n = d.node;
      const h = d.target;
      const left = clamp(1 - d.t / SHIELD_TIME, 0, 1);
      ctx.beginPath();
      ctx.moveTo(n.cx, n.cy);
      ctx.lineTo(h.cx, h.cy);
      ctx.strokeStyle = COLORS.amber;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1.3;
      if (ctx.setLineDash) ctx.setLineDash([2, 6]);
      ctx.lineDashOffset = this.reducedMotion ? 0 : -this.time * 40;
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      // Shield around the core: six sides = time left.
      const R = h.size * 0.72 + 4;
      const sides = Math.ceil(left * 6 - 1e-9);
      ctx.fillStyle = COLORS.amber;
      ctx.globalAlpha = 0.07 + 0.05 * pulse;
      ctx.beginPath();
      polygonPath(ctx, h.cx, h.cy, R, 6, -Math.PI / 2);
      ctx.fill();
      // Glow = a wide translucent underlay, not shadowBlur (a blurred
      // core-sized hexagon is expensive in software raster: NC-13).
      ctx.strokeStyle = COLORS.amber;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a0 = -Math.PI / 2 + (i * Math.PI) / 3;
        const a1 = a0 + Math.PI / 3;
        ctx.moveTo(h.cx + Math.cos(a0) * R, h.cy + Math.sin(a0) * R);
        ctx.lineTo(h.cx + Math.cos(a1) * R, h.cy + Math.sin(a1) * R);
      }
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.18;
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.75 + 0.25 * pulse;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      polygonPath(ctx, h.cx, h.cy, R, 6, -Math.PI / 2);
      polygonPath(ctx, h.cx, h.cy, R * 0.8, 6, -Math.PI / 2);
      ctx.stroke();
      // The firewall node: amber edge, a lock, magenta target brackets.
      const top = n.size - n.wall;
      const nx = n.x + top / 2;
      const ny = n.y + top / 2;
      const L = Math.max(4, top * 0.36);
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      n.bodyPath(ctx);
      ctx.stroke();
      // White lock on a dark plate: the one white glyph on the core, so the
      // node never reads as an amber relay (R3: the magenta lock sprite when
      // the atlas is ready).
      ctx.globalAlpha = 1;
      if (SPRITE_USE.node && this.sprites.draw(ctx, 'firewall_locked', n.x, n.y, n.size, Block.pxScale)) {
        // drawn
      } else {
      ctx.fillStyle = COLORS.tileSide;
      ctx.fillRect(n.x + top * 0.16, n.y + top * 0.16, top * 0.68, top * 0.68);
      ctx.fillStyle = COLORS.white;
      ctx.strokeStyle = COLORS.white;
      ctx.fillRect(nx - L / 2, ny - L * 0.1, L, L * 0.62);
      ctx.lineWidth = Math.max(1, L * 0.16);
      ctx.beginPath();
      ctx.arc(nx, ny - L * 0.1, L * 0.3, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = COLORS.tileSide;
      ctx.fillRect(nx - L * 0.07, ny + L * 0.05, L * 0.14, L * 0.3);
      }
      // Rotating magenta target reticle (the player's action colour): four
      // brackets and four ticks pointing in, slowly turning.
      const RR = n.size * 0.78 + pulse * 2;
      const spin = this.reducedMotion ? 0 : this.time * 1.2;
      ctx.strokeStyle = COLORS.magenta;
      ctx.shadowColor = COLORS.magenta;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2;
        ctx.moveTo(n.cx + Math.cos(a - 0.42) * RR, n.cy + Math.sin(a - 0.42) * RR);
        ctx.arc(n.cx, n.cy, RR, a - 0.42, a + 0.42);
        const b = a + Math.PI / 4;
        ctx.moveTo(n.cx + Math.cos(b) * (RR + 4), n.cy + Math.sin(b) * (RR + 4));
        ctx.lineTo(n.cx + Math.cos(b) * (RR - 3), n.cy + Math.sin(b) * (RR - 3));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (e) {
      const h = this.heart;
      const k = clamp(e.t / EXPOSE_TIME, 0, 1);
      // R3: the broken firewall sprite fades out where the node stood.
      const ghost = (e.t - (EXPOSE_TIME - 0.7)) / 0.7;
      if (SPRITE_USE.node && ghost > 0 && e.node.size) {
        ctx.globalAlpha = ghost;
        this.sprites.draw(ctx, 'firewall_broken', e.node.x - e.node.size / 2, e.node.y - e.node.size / 2, e.node.size, Block.pxScale);
        ctx.globalAlpha = 1;
      }
      if (h && h.alive) {
        ctx.strokeStyle = COLORS.magenta;
        ctx.globalAlpha = 0.45 + 0.45 * k;
        ctx.lineWidth = 2;
        if (ctx.setLineDash) ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = this.reducedMotion ? 0 : this.time * 30;
        ctx.beginPath();
        ctx.moveTo(e.node.x, e.node.y);
        ctx.lineTo(h.cx, h.cy);
        ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        ctx.beginPath();
        for (const b of e.blocks) if (b.alive) b.bodyPath(ctx);
        ctx.stroke();
        this.drawBrackets(ctx, h.cx, h.cy, h.size / 2 + 6 + pulse * 3, Math.max(5, h.size * 0.28), COLORS.magenta, 1);
      }
    }
    ctx.restore();
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
    glow.addColorStop(0, '#141a2e');
    glow.addColorStop(0.45, '#0a0d19');
    glow.addColorStop(1, '#04050a');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // The network floor (NC-AI-RECOVERY-1): large dark floor panels with
    // bevelled seams (light top-left edge, dark bottom-right), the 2.5D
    // ground everything else stands on. Fixed, low contrast.
    const panel = 46;
    g.lineWidth = 1;
    for (const [color, dx] of [['#03040a', 0.5], ['#131828', -0.5]]) {
      g.strokeStyle = color;
      g.globalAlpha = 0.5;
      g.beginPath();
      for (let x = (cx % panel) - panel; x < w + panel; x += panel) { g.moveTo(x + dx, 0); g.lineTo(x + dx, h); }
      for (let y = (cy % panel) - panel; y < h + panel; y += panel) { g.moveTo(0, y + dx); g.lineTo(w, y + dx); }
      g.stroke();
    }
    g.globalAlpha = 1;
    // Dot field.
    g.fillStyle = '#2a3a52';
    const step = 14;
    for (let y = (cy % step); y < h; y += step) {
      for (let x = (cx % step); x < w; x += step) {
        const d = Math.hypot(x - cx, y - cy) / far;
        g.globalAlpha = 0.3 * (1 - d) * (1 - d);
        g.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
    const short = Math.min(w, h);
    // The AI's wider infrastructure: a few dark circuit routes run in from
    // the field edges toward the core (orthogonal, one 45-degree bend, a pad
    // at the end). Fixed layout, very low contrast: depth, not a grid.
    // Routes are still the AI's: dim red.
    g.strokeStyle = '#1f121a';
    g.fillStyle = '#2c141e';
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
    g.strokeStyle = '#121a2a';
    g.lineWidth = 1;
    for (const r of [short * 0.36, short * 0.47]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#18233a';
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
    g.strokeStyle = '#1b2134';
    g.lineWidth = 2;
    g.beginPath();
    chamferPath(g, m, m, w - m * 2, h - m * 2, [cut, cut, cut, cut]);
    g.stroke();
    g.globalAlpha = 1;
    return canvas;
  }

  /** Live layer of the backdrop: a slow scanning arc on the outer
   *  containment ring and the arena's light strips. Both show the sector's
   *  owner (NC-AI-RECOVERY-1): AI red at the start, shifting to recovery
   *  cyan with the sector's recovery progress (static scan with
   *  prefers-reduced-motion). */
  drawFieldMarks(ctx) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const w = this.width;
    const h = this.height;
    const r = Math.min(w, h) * 0.47;
    const a = this.reducedMotion ? -Math.PI / 2 : this.time * 0.35;
    const tint = mixColor(COLORS.hostile, COLORS.cyan, this.uiProgress || 0);
    ctx.save();
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + 0.9);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + Math.PI, a + Math.PI + 0.5);
    ctx.stroke();
    const m = 3;
    const cut = Math.min(22, Math.min(w, h) * 0.08);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (const fy of [0.38, 0.62]) {
      ctx.moveTo(m, h * fy - 7); ctx.lineTo(m, h * fy + 7);
      ctx.moveTo(w - m, h * fy - 7); ctx.lineTo(w - m, h * fy + 7);
    }
    ctx.moveTo(m + cut + 6, h - m); ctx.lineTo(m + cut + 22, h - m);
    ctx.moveTo(w - m - cut - 6, h - m); ctx.lineTo(w - m - cut - 22, h - m);
    ctx.moveTo(m + cut + 6, m); ctx.lineTo(m + cut + 22, m);
    ctx.moveTo(w - m - cut - 6, m); ctx.lineTo(w - m - cut - 22, m);
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
   * The AI's lattice (NC-ART-1, recoloured in NC-AI-RECOVERY-1): thin red
   * links between neighbouring tiles' nodes and brighter red axons into the
   * core, with ember pulses flowing inward. The system reacts: a hit
   * lights the struck block's links; as the core loses HP the lattice
   * brightens and its pulses speed up; a link to a destroyed block is cut to
   * a cyan sparking stub (recovered); links ahead of the recovery wave
   * flicker white.
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
    ctx.strokeStyle = COLORS.hostile;
    ctx.globalAlpha = 0.24 + 0.25 * stress;
    ctx.beginPath();
    seg(ctx, live);
    ctx.stroke();
    ctx.strokeStyle = COLORS.hostile;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6 + 0.3 * stress;
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
      ctx.globalAlpha = 0.55;
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
    for (const [list, color] of [[live, COLORS.ember], [axons, COLORS.coreHot]]) {
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

  /** Sector recovery finale (NC-AI-RECOVERY-1), drawn from the core's
   *  position while `this.breach` lives: the core's guard ring implodes
   *  (0-0.2 s), its four red crystal shards fly apart, ten cyan recovery
   *  lines race outward, a cyan front marks the exact radius of the shatter
   *  wave (tiles it passes turn cyan, then break), and a cyan frame opens
   *  around the whole sector: the network is back in the player's hands. */
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
    if (t < 0.2) {
      const k = 1 - t / 0.2;
      ctx.strokeStyle = COLORS.white;
      ctx.shadowColor = COLORS.hostile;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.arc(b.x, b.y, s * (0.3 + 1.4 * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    // The core's crystal: four shards flying apart, turning from red to dark.
    const part = Math.min(1, t / 0.55);
    if (part < 1) {
      const off = s * (0.2 + 2.4 * part);
      const r = s * 0.42;
      ctx.globalAlpha = 1 - part;
      ctx.fillStyle = COLORS.hostile;
      ctx.strokeStyle = COLORS.coreHot;
      ctx.shadowColor = COLORS.hostile;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const ox = b.x + sx * off;
        const oy = b.y + sy * off;
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + sx * r, oy);
        ctx.lineTo(ox, oy + sy * r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    // Recovery lines racing outward.
    const len = Math.min(front, b.reach);
    if (len > 2) {
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      for (let i = 0; i < BREACH_LINES; i++) {
        const a = (i / BREACH_LINES) * Math.PI * 2 + hash01(b.seed + i) * 0.5;
        const l = len * (0.65 + 0.35 * hash01(b.seed + i + 50));
        jaggedPath(ctx, b.x, b.y, b.x + Math.cos(a) * l, b.y + Math.sin(a) * l, 5, 3, b.seed + i * 13);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Shatter front: exactly where the wave recovers tiles.
    if (front < b.reach * 1.4) {
      ctx.globalAlpha = fade * clamp(1 - front / (b.reach * 1.4), 0, 1);
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
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
    // Sector frame: cyan corner brackets open around the recovered sector.
    const open = clamp((t - 0.15) / 0.6, 0, 1);
    if (open > 0) {
      const ease = 1 - (1 - open) * (1 - open);
      const R = b.reach * (0.75 + 0.35 * ease);
      const k = R * 0.32;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(b.x + sx * R, b.y + sy * (R - k));
        ctx.lineTo(b.x + sx * R, b.y + sy * R);
        ctx.lineTo(b.x + sx * (R - k), b.y + sy * R);
      }
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

  /**
   * HUD safe areas (NC-AI-RECOVERY-1 R2), CSS pixels of the field; the one
   * source of truth for where HUD text goes (drawing and `qa/recovery.mjs`
   * both read it). The uplinks sit on the axes (one at top centre) and the
   * core in the middle, so text lives in the two top corners only:
   * left column = recovery meter, then event toasts ("SECTOR n", "SHIELD
   * BROKEN", "RELAY CAPTURED", "SECTOR RECOVERED"); right column = override
   * meter, then the AI alert ("AI SHIELD" / "CORE EXPOSED").
   */
  hudLayout() {
    const fieldW = this.width * this.viewScale;
    // HUD scale (R3): 1 up to 907x510, growing with the world scale to 1.5
    // on big screens, so the text keeps its weight next to the field.
    const u = this.hudScale;
    const meterH = Math.round(22 * u);
    const colW = Math.min(150 * u, (fieldW - 40) / 2);
    const meterW = Math.min(120 * u, colW);
    const rects = [
      { id: 'progress', x: 10, y: 10, w: meterW, h: meterH, u },
      { id: 'override', x: fieldW - 10 - meterW, y: 10, w: meterW, h: meterH, u },
    ];
    const below = 10 + meterH + 8;
    const e = this.exposed && this.heart && this.heart.alive ? this.exposed : null;
    if (this.defense || e) rects.push({ id: 'alert', x: fieldW - 10 - colW, y: below, w: colW, h: meterH, u });
    const maxW = Math.max(colW, Math.min(fieldW * 0.42, 230 * u));
    let y = below;
    for (const t of this.toasts) {
      let size = Math.round((t.big ? 15 : 12) * u);
      let w = this.hudTextWidth(t.text, size) + 18;
      if (w > maxW) { size = Math.max(10, Math.floor(size * (maxW - 18) / (w - 18))); w = Math.min(maxW, this.hudTextWidth(t.text, size) + 18); }
      rects.push({ id: 'toast', x: 10, y, w, h: size + 8, size, toast: t });
      y += size + 12;
    }
    return rects;
  }

  get hudScale() {
    return clamp(this.viewScale * 0.5, 1, 1.5);
  }

  /** Text width in CSS px for HUD layout (bold UI font); an upper estimate
   *  where the context cannot measure (the QA harness). */
  hudTextWidth(text, size) {
    const ctx = this.ctx;
    if (typeof ctx.measureText === 'function') {
      ctx.save();
      ctx.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
      const m = ctx.measureText(text);
      ctx.restore();
      if (m && m.width) return m.width;
    }
    return text.length * size * 0.66;
  }

  /** Event toast (cosmetic): newest at the bottom of the stack, at most 3. */
  addToast(text, color, big) {
    if (this.toasts.length >= 3) this.toasts.shift();
    this.toasts.push({ text, color, life: big ? 1.6 : 1.8, big: !!big });
  }

  /** Screen-space HUD: meters, AI alert, event toasts (hudLayout). */
  drawHud(ctx) {
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 6);
    const locale = (STRINGS[this.lang] || STRINGS[DEFAULT_LANGUAGE]).locale;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textBaseline = 'top';
    for (const r of this.hudLayout()) {
      if (r.id === 'progress' || r.id === 'override' || r.id === 'alert') {
        let label;
        let value;
        let color;
        let glow = 6;
        let textColor;
        if (r.id === 'progress') {
          value = this.uiProgress || 0;
          label = `${this.t('core')} ${Math.floor(this.coreProgress * 100)}%`;
          color = COLORS.cyan;
          ctx.textAlign = 'left';
        } else if (r.id === 'override') {
          const ready = this.volleyReady;
          value = this.volleyCharge;
          label = ready ? this.t('volleyReady') : `${this.t('volley')} ${Math.floor(this.volleyCharge * 100)}%`;
          color = COLORS.magenta;
          textColor = ready ? COLORS.white : COLORS.magenta;
          glow = ready ? 8 + 6 * pulse : 5;
          ctx.textAlign = 'right';
        } else {
          const d = this.defense;
          const secs = (v) => Math.max(0, v).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          color = d ? COLORS.amber : COLORS.magenta;
          label = d ? `${this.t('shieldUp')} ${secs(SHIELD_TIME - d.t)} s` : `${this.t('exposed')} ${secs(this.exposed.t)} s`;
          value = d ? 1 - d.t / SHIELD_TIME : this.exposed.t / EXPOSE_TIME;
          const blink = this.alert > 0 && !this.reducedMotion && Math.floor(this.alert * 5) % 2 === 0;
          textColor = blink ? COLORS.white : color;
          ctx.textAlign = 'right';
        }
        ctx.font = `bold ${Math.round(12 * r.u)}px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = textColor || color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        const tx = ctx.textAlign === 'left' ? r.x : ctx.textAlign === 'right' ? r.x + r.w : r.x + r.w / 2;
        ctx.fillText(label, tx, r.y, r.w);
        this.drawSegmentBar(ctx, r.x, r.y + Math.round(16 * r.u), r.w, Math.round(5 * r.u), value, color, glow);
      } else if (r.id === 'toast') {
        const t = r.toast;
        const a = clamp(t.life / 0.3, 0, 1);
        ctx.globalAlpha = a;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(9, 11, 18, 0.88)';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        chamferPath(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, [r.h * 0.3, 0, r.h * 0.3, 0]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 6;
        ctx.textAlign = 'left';
        ctx.font = `bold ${r.size}px "Segoe UI", Arial, sans-serif`;
        ctx.fillText(t.text, r.x + 9, r.y + 4, r.w - 14);
        ctx.globalAlpha = 1;
      }
    }
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
