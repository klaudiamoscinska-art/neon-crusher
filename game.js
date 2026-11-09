'use strict';

const COLORS = {
  cyan: '#00f3ff',
  pink: '#ff007f',
  green: '#39ff14',
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
    fireRate: 'Fire rate',
    damage: 'Hit power',
    upgradeLevel: 'Lvl {n}',
  },
  pl: {
    locale: 'pl-PL',
    cash: 'Kasa',
    level: 'Poziom',
    buyBall: 'Kup nową kulę',
    balls: 'Kulki: {n}',
    fireRate: 'Szybkość strzału',
    damage: 'Siła uderzenia',
    upgradeLevel: 'Lvl {n}',
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
    this.vx *= 0.985;
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

class Block {
  constructor(offsetX, offsetY, size, maxHp, moneyPerHit, color) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.size = size;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.moneyPerHit = moneyPerHit;
    this.color = color;
    this.alive = true;
    this.x = 0;
    this.y = 0;
    this.hitFlash = 0;
  }

  applyCenter(cx, cy) {
    this.x = cx + this.offsetX - this.size / 2;
    this.y = cy + this.offsetY - this.size / 2;
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

  draw(ctx) {
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
    ctx.strokeRect(this.x, this.y, this.size, this.size);
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

    let nx, ny;
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      const overlapLeft = this.x - block.x;
      const overlapRight = block.x + block.size - this.x;
      const overlapTop = this.y - block.y;
      const overlapBottom = block.y + block.size - this.y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapLeft) { nx = -1; ny = 0; }
      else if (minOverlap === overlapRight) { nx = 1; ny = 0; }
      else if (minOverlap === overlapTop) { nx = 0; ny = -1; }
      else { nx = 0; ny = 1; }
    }

    const dot = this.vx * nx + this.vy * ny;
    this.vx = this.vx - 2 * dot * nx;
    this.vy = this.vy - 2 * dot * ny;
    this.normalizeSpeed();

    const overlap = this.radius - dist;
    this.x += nx * (overlap + 0.5);
    this.y += ny * (overlap + 0.5);

    return { x: closestX, y: closestY };
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
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

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15 + this.flash * 15;
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

    this.width = 0;
    this.height = 0;

    this.cash = 0;
    this.level = 1;
    this.maxBalls = 1;
    this.fireRateLevel = 1;
    this.damageLevel = 1;

    this.blocks = [];
    this.balls = [];
    this.turrets = [];
    this.particles = new ParticlePool(MAX_PARTICLES);

    this.baseFireInterval = 2200;
    this.fireInterval = this.baseFireInterval;

    this.uiTimer = 0;
    this.saveTimer = 0;

    this.lastTime = 0;

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
    };

    this.applyLanguage();
    this.loadSave();
    this.recalcFireInterval();
    this.bindUpgradeButtons();
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

  costFor(base, level) {
    return Math.ceil(base * Math.pow(1.5, level - 1));
  }

  get ballCost() { return this.costFor(10, this.maxBalls); }
  get fireRateCost() { return this.costFor(15, this.fireRateLevel); }
  get damageCost() { return this.costFor(15, this.damageLevel); }

  recalcFireInterval() {
    this.fireInterval = Math.max(300, this.baseFireInterval * Math.pow(0.85, this.fireRateLevel - 1));
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
      if (document.hidden) this.save();
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

    const oldWidth = this.width;
    const oldHeight = this.height;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.width = width;
    this.height = height;

    if (!isInitial && oldWidth > 0 && oldHeight > 0) {
      const scaleX = width / oldWidth;
      const scaleY = height / oldHeight;
      for (const ball of this.balls) {
        ball.x = clamp(ball.x * scaleX, ball.radius, width - ball.radius);
        ball.y = clamp(ball.y * scaleY, ball.radius, height - ball.radius);
      }
    }

    this.repositionCoreAndTurrets();
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
    return { points, size, extent: span / 2 + size };
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

    this.placeTurrets(level, layout.extent);
    this.repositionCoreAndTurrets();
  }

  placeTurrets(level, extent) {
    const count = Math.min(1 + Math.floor((level - 1) / 3), 4);
    const margin = 44;
    const dist = Math.min(extent + margin, Math.min(this.width, this.height) / 2 - 20);
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
      const offsetX = dir.dx * dist;
      const offsetY = dir.dy * dist;
      const angle = Math.atan2(dir.dy, dir.dx);
      this.turrets.push(new Turret(offsetX, offsetY, angle, colors[i]));
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
    const spawnDist = 22;
    const x = turret.x + Math.cos(turret.angle) * spawnDist;
    const y = turret.y + Math.sin(turret.angle) * spawnDist;
    const colors = [COLORS.cyan, COLORS.pink, COLORS.green];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.balls.push(new Ball(x, y, angle, speed, radius, color));
  }

  bindUpgradeButtons() {
    this.ui.buyBall.addEventListener('click', () => {
      const cost = this.ballCost;
      if (this.cash < cost) return;
      this.cash -= cost;
      this.maxBalls += 1;
      this.updateUI();
    });

    this.ui.fireRate.addEventListener('click', () => {
      const cost = this.fireRateCost;
      if (this.cash < cost) return;
      this.cash -= cost;
      this.fireRateLevel += 1;
      this.recalcFireInterval();
      this.updateUI();
    });

    this.ui.damage.addEventListener('click', () => {
      const cost = this.damageCost;
      if (this.cash < cost) return;
      this.cash -= cost;
      this.damageLevel += 1;
      this.updateUI();
    });
  }

  updateUI() {
    this.ui.cash.textContent = formatMoney(this.cash, this.lang);
    this.ui.level.textContent = String(this.level);

    this.ui.buyBallDesc.textContent = this.t('balls', { n: this.maxBalls });
    this.ui.buyBallCost.textContent = formatMoney(this.ballCost, this.lang);
    this.ui.buyBall.disabled = this.cash < this.ballCost;

    this.ui.fireRateDesc.textContent = this.t('upgradeLevel', { n: this.fireRateLevel });
    this.ui.fireRateCost.textContent = formatMoney(this.fireRateCost, this.lang);
    this.ui.fireRate.disabled = this.cash < this.fireRateCost;

    this.ui.damageDesc.textContent = this.t('upgradeLevel', { n: this.damageLevel });
    this.ui.damageCost.textContent = formatMoney(this.damageCost, this.lang);
    this.ui.damage.disabled = this.cash < this.damageCost;
  }

  handleBallBlockCollisions() {
    for (const ball of this.balls) {
      for (const block of this.blocks) {
        if (!block.alive) continue;
        const contact = ball.collideBlock(block);
        if (!contact) continue;

        this.cash += block.moneyPerHit;
        this.particles.burst(contact.x, contact.y, block.color, 6, {
          minSpeed: 40, maxSpeed: 150, minLife: 0.25, maxLife: 0.5,
        });

        const destroyed = block.takeHit(this.ballDamage);
        if (destroyed) {
          this.particles.burst(
            block.x + block.size / 2,
            block.y + block.size / 2,
            block.color,
            18,
            { minSpeed: 60, maxSpeed: 220, minLife: 0.4, maxLife: 0.9, minRadius: 2, maxRadius: 4 }
          );
        }
        break;
      }
    }
  }

  update(dt) {
    for (const turret of this.turrets) turret.update(dt, this);

    for (const ball of this.balls) {
      ball.update(dt);
      ball.bounceWalls(this.width, this.height);
    }

    this.handleBallBlockCollisions();

    for (const block of this.blocks) block.update(dt);
    const aliveRemaining = this.blocks.some((b) => b.alive);
    this.blocks = this.blocks.filter((b) => b.alive || b.hitFlash > 0);

    if (!aliveRemaining) {
      this.level += 1;
      this.generateCore(this.level);
    }

    this.particles.update(dt);

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

    for (const block of this.blocks) block.draw(ctx);
    for (const turret of this.turrets) turret.draw(ctx);
    this.particles.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    dt = clamp(dt, 0, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  new Game(canvas);
});
