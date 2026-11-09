'use strict';

const COLORS = {
  cyan: '#00f3ff',
  pink: '#ff007f',
  green: '#39ff14',
  // Energy (NC-ORIGINAL-1): relays, the volley meter, aim marks.
  amber: '#ffc400',
  white: '#ffffff',
};

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

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * t, 0, Math.PI * 2);
    ctx.fill();
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

  draw(ctx) {
    for (const p of this.active) p.draw(ctx);
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
  }

  update(dt) {
    this.y -= 28 * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / FLOAT_TEXT_LIFE, 0, 1);
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

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (0.4 + t * 0.6);
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.1, this.radius * (1 - t * t)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** A volley lance: a piercing beam from a turret, fading in 0.35 s. */
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
    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = this.color;
    ctx.shadowBlur = 22;
    ctx.shadowColor = this.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1 + 5 * t;
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(this.x1, this.y1);
    ctx.stroke();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1.5 * t;
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

  draw(ctx, time) {
    if (this.alive && this.kind === 'heart') { this.drawHeart(ctx, time); return; }
    ctx.save();
    if (!this.alive) {
      ctx.globalAlpha = this.hitFlash * 0.4;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.color;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      ctx.restore();
      return;
    }
    const hpRatio = clamp(this.hp / this.maxHp, 0, 1);
    const alpha = 0.35 + hpRatio * 0.65;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15 + this.hitFlash * 20;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
    if (this.shatter !== null) ctx.strokeStyle = COLORS.white;
    ctx.strokeRect(this.x, this.y, this.size, this.size);
    if (this.kind === 'relay') {
      // Energy relay: a bright diamond inside the block.
      const c = this.size / 2;
      const r = this.size * (0.28 + 0.06 * Math.sin(time * 6));
      ctx.fillStyle = COLORS.white;
      ctx.shadowColor = COLORS.amber;
      ctx.beginPath();
      ctx.moveTo(this.x + c, this.y + c - r);
      ctx.lineTo(this.x + c + r, this.y + c);
      ctx.lineTo(this.x + c, this.y + c + r);
      ctx.lineTo(this.x + c - r, this.y + c);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** The heart: a hollow white-framed reactor (armour is solid) with a
   *  bright core that shrinks with its HP and a rotating pink ring. */
  drawHeart(ctx, time) {
    const hpRatio = clamp(this.hp / this.maxHp, 0, 1);
    const c = this.size / 2;
    const cx = this.x + c;
    const cy = this.y + c;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18 + pulse * 10 + this.hitFlash * 25;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + 1, this.y + 1, this.size - 2, this.size - 2);
    // Rotating ring: two arcs.
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1.5, this.size * 0.07);
    const spin = time * 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.72, spin, spin + 2.2);
    ctx.moveTo(cx + Math.cos(spin + Math.PI) * c * 0.72, cy + Math.sin(spin + Math.PI) * c * 0.72);
    ctx.arc(cx, cy, c * 0.72, spin + Math.PI, spin + Math.PI + 2.2);
    ctx.stroke();
    // Core light.
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, c * (0.15 + 0.35 * hpRatio) * (0.9 + 0.1 * pulse)), 0, Math.PI * 2);
    ctx.fill();
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
    ctx.save();
    ctx.fillStyle = this.flash > 0 ? COLORS.white : this.color;
    ctx.shadowBlur = 15 + this.flash * 20;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
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
  draw(ctx, charge, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (charge >= 1) {
      ctx.strokeStyle = COLORS.white;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.white;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10 + charge * 12 + this.flash * 15;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, 9);
    ctx.lineTo(-8, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.stroke();
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
    const colors = [COLORS.cyan, COLORS.pink, COLORS.green];

    const useGrid = level % 2 === 1;
    const layout = useGrid ? this.gridLayout(level) : this.circleLayout(level);

    layout.points.forEach((p, i) => {
      const color = colors[i % colors.length];
      const block = new Block(p.x, p.y, layout.size, maxHp, moneyPerHit, color);
      this.blocks.push(block);
    });
    this.blockHp = maxHp;
    this.blockMoney = moneyPerHit;
    this.blockStep = layout.size + (useGrid ? 5 : 8);
    this.placeHeart(layout, useGrid, maxHp, moneyPerHit);
    this.placeRelays(level);
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
    const heart = new Block(0, 0, size, HEART_HP * maxHp, moneyPerHit, COLORS.pink);
    heart.kind = 'heart';
    this.blocks.push(heart);
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
    const colors = [COLORS.cyan, COLORS.pink, COLORS.green, COLORS.cyan];

    this.turrets = [];
    for (let i = 0; i < count; i++) {
      const dir = compass[i];
      // Aimed at the core (NC-CORE-1A): every new ball starts with a hit.
      const turret = new Turret(0, 0, Math.atan2(-dir.dy, -dir.dx), colors[i]);
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
    const colors = [COLORS.cyan, COLORS.pink, COLORS.green];
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
    this.addFloatText(x, y, block.moneyPerHit, block.color);
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
    this.addBigText(relay.cx, relay.cy - 10, `${this.t('relay')} +${formatMoney(bonus, this.lang)}`, COLORS.amber);
    if (this.volleyCharge < 1) {
      this.volleyCharge = 1;
      this.volleyReadyFor = 0;
    }
    const radius = SHOCK_RADIUS_STEPS * this.blockStep * this.coreScale;
    this.addRing(relay.cx, relay.cy, radius, COLORS.amber, 0.45, 3);
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
    this.addBigText(heart.cx, heart.cy - 14, `${this.t('breached')} +${formatMoney(bonus, this.lang)}`, COLORS.white);
    for (const b of this.blocks) {
      if (b.alive && b.shatter === null) b.shatter = Math.hypot(b.cx - heart.cx, b.cy - heart.cy) / SHATTER_SPEED;
    }
    this.addRing(heart.cx, heart.cy, Math.max(this.width, this.height) * 0.6, COLORS.pink, 0.7, 5);
    this.addRing(heart.cx, heart.cy, this.coreRadius * this.coreScale * 1.2, COLORS.white, 0.45, 3);
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
      this.sound.play('level');
    }

    this.particles.update(dt);
    for (const f of this.floatTexts) f.update(dt);
    if (this.floatTexts.length && this.floatTexts.some((f) => f.life <= 0)) this.floatTexts = this.floatTexts.filter((f) => f.life > 0);
    for (const l of this.lances) l.update(dt);
    if (this.lances.length && this.lances[0].life <= 0) this.lances = this.lances.filter((l) => l.life > 0);
    for (const ring of this.rings) ring.update(dt);
    if (this.rings.length && this.rings.some((ring) => ring.life <= 0)) this.rings = this.rings.filter((ring) => ring.life > 0);
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt * 3);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    this.uiTimer += dt;
    if (this.uiTimer >= 0.15) {
      this.uiTimer = 0;
      this.updateUI();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.save();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    const shaking = this.shake > 0 && !this.reducedMotion;
    if (shaking) {
      ctx.save();
      // Deterministic wobble: draw() must never consume Math.random, or the
      // simulation would depend on the number of frames drawn (NC-03).
      const a = this.shake * 10;
      ctx.translate(Math.sin(this.time * 91) * a, Math.cos(this.time * 77) * a);
    }
    this.drawAimPreview(ctx);
    for (const block of this.blocks) block.draw(ctx, this.time);
    for (const turret of this.turrets) turret.draw(ctx, this.volleyCharge, this.time);
    for (const l of this.lances) l.draw(ctx);
    for (const ring of this.rings) ring.draw(ctx);
    this.particles.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    for (const f of this.floatTexts) f.draw(ctx);
    if (shaking) ctx.restore();

    if (this.screenFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.screenFlash * (this.reducedMotion ? 0.1 : 0.3);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    this.drawCoreProgress(ctx);
    this.drawVolleyMeter(ctx);
    this.drawBanner(ctx);
  }

  /** With a mouse over the field and the volley ready: dashed lines from
   *  every turret through the cursor, and a crosshair (where lances go). */
  drawAimPreview(ctx) {
    if (!this.aim || !this.volleyReady) return;
    ctx.save();
    ctx.strokeStyle = COLORS.white;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.white;
    if (ctx.setLineDash) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (const t of this.turrets) {
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(this.aim.x, this.aim.y);
    }
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(this.aim.x, this.aim.y, 7, 0, Math.PI * 2);
    ctx.moveTo(this.aim.x - 11, this.aim.y);
    ctx.lineTo(this.aim.x + 11, this.aim.y);
    ctx.moveTo(this.aim.x, this.aim.y - 11);
    ctx.lineTo(this.aim.x, this.aim.y + 11);
    ctx.stroke();
    ctx.restore();
  }

  /** Volley charge meter in the field's top-right corner (screen pixels). */
  drawVolleyMeter(ctx) {
    const fieldW = this.width * this.viewScale;
    const w = Math.min(120, fieldW * 0.3);
    const x = fieldW - 10 - w;
    const y = 10;
    const ready = this.volleyReady;
    const label = ready ? this.t('volleyReady') : `${this.t('volley')} ${Math.floor(this.volleyCharge * 100)}%`;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const color = ready ? COLORS.white : COLORS.amber;
    ctx.fillStyle = color;
    ctx.shadowColor = ready ? COLORS.amber : color;
    ctx.shadowBlur = ready ? 10 + 8 * (0.5 + 0.5 * Math.sin(this.time * 8)) : 8;
    ctx.fillText(label, x + w, y);
    ctx.fillStyle = COLORS.amber;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y + 15, w, 5);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y + 15, w * this.volleyCharge, 5);
    ctx.restore();
  }

  /** "LEVEL n" banner after a level-up, centred, screen pixels. */
  drawBanner(ctx) {
    if (!this.banner) return;
    const t = clamp(this.banner.life / 1.4, 0, 1);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `bold ${Math.round(22 * Math.min(1.6, this.viewScale))}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.white;
    ctx.shadowBlur = 18;
    ctx.shadowColor = COLORS.pink;
    ctx.fillText(this.banner.text, (this.width * this.viewScale) / 2, (this.height * this.viewScale) * 0.18);
    ctx.restore();
  }

  /** Core destruction bar in the top-left corner of the field, drawn in
   *  screen pixels (a HUD element: same size at any world scale). */
  drawCoreProgress(ctx) {
    const x = 10;
    const y = 10;
    const w = Math.min(120, this.width * this.viewScale * 0.3);
    const h = 5;
    const progress = this.coreProgress;
    const label = `${this.t('core')} ${Math.floor(progress * 100)}%`;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.pink;
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.pink;
    ctx.fillText(label, x, y);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y + 15, w, h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y + 15, w * progress, h);
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
