// Adaptive defense (NC-AI-RECOVERY-1): the rogue AI's shield, its firewall
// node, exposure, the autopilot's answer, determinism and idle safety.
// Expected values = the spec in docs/GAME_DESIGN.md ("Adaptive defense"),
// written here as literals, never read from game.js constants.
// Usage: node qa/recovery.mjs [--quick]
import { loadGame, FakeStorage, Reporter, isMain } from './lib.mjs';
import { greedyBuy } from './economy.mjs';

const FROM_SECTOR = 3;
const FIRST_DELAY = 8;
const COOLDOWN = 10;
const SHIELD_TIME = 7;
const SHIELD_FACTOR = 0.5;
const EXPOSE_TIME = 5;
const EXPOSE_FACTOR = 2.5;
const BONUS = 3;
const REFUND = 0.5;

/** A game on `level` with no balls and no autopilot interference unless asked. */
function sector(level, { seed = 1, w = 907, h = 339, balls = false } = {}) {
  const hx = loadGame({ seed, width: w, height: h });
  const g = hx.newGame();
  g.level = level;
  g.generateCore(level);
  if (!balls) { g.balls = []; g.maxBalls = 0; }
  g.volleyCharge = 0;
  return [hx, g];
}

/** Advances in fixed steps (no rendering) until `cond` or `limit` seconds. */
function stepUntil(g, cond, limit) {
  const dt = 1 / 240;
  for (let t = 0; t < limit; t += dt) { if (cond()) return t; g.update(dt); }
  return cond() ? limit : null;
}

export function run({ quick = false } = {}) {
  const r = new Reporter('recovery');

  // --- Introduced gradually: never on sectors 1-2.
  {
    const counts = [1, 2].map((lvl) => { const [, g] = sector(lvl, { balls: true }); g.maxBalls = 3; for (let i = 0; i < 240 * 60; i++) { g.update(1 / 240); if (g.level !== lvl) break; } return g.reroutes; });
    r.check(`no AI shield on sectors 1-2 (60 s each, drones on)`, counts.every((c) => c === 0), `reroutes ${counts.join(', ')}`);
  }

  // --- First reroute 8 s into sector 3; the node is breakable armour in a turret's line.
  {
    const [, g] = sector(FROM_SECTOR);
    g.volleyCharge = 0; g.chargeTime = 1e9; // no autopilot pulse in this check
    const tStart = stepUntil(g, () => g.defense !== null, 20);
    const d = g.defense;
    const heart = g.blocks.find((b) => b.kind === 'heart');
    let firstHit = false;
    if (d) {
      for (const t of g.turrets) {
        const dx = d.node.cx - t.x; const dy = d.node.cy - t.y; const len = Math.hypot(dx, dy);
        const along = (b) => { // distance along the turret->node line where it enters b (coarse march)
          for (let s = 0; s <= len; s += 0.25) { const x = t.x + (dx / len) * s; const y = t.y + (dy / len) * s; if (x >= b.x && x <= b.x + b.size && y >= b.y && y <= b.y + b.size) return s; }
          return Infinity;
        };
        const tn = along(d.node);
        if (g.blocks.every((b) => !b.alive || b === d.node || along(b) >= tn - 0.3)) firstHit = true;
      }
    }
    r.check(`sector ${FROM_SECTOR}: the AI raises its first shield ${FIRST_DELAY} s into the sector (±1 step)`, tStart !== null && Math.abs(tStart - FIRST_DELAY) <= 1 / 240 + 1e-9, `started at ${tStart} s`);
    r.check('the shield guards the AI core; its firewall node is an alive armour block marked as breakable, hit first on some turret\'s line', d && d.target === heart && d.node.alive && d.node.kind === 'armor' && d.node.firewall === true && firstHit);
    // Damage while shielded: every source x0.5; HP never restored.
    const hp0 = heart.hp;
    g.hitBlock(heart, 4, heart.cx, heart.cy, 'ball');
    const ballOk = Math.abs(heart.hp - (hp0 - 4 * SHIELD_FACTOR)) < 1e-9;
    let restored = false; let prev = heart.hp;
    for (let i = 0; i < 240 * 3; i++) { g.update(1 / 240); if (heart.hp > prev + 1e-12) restored = true; prev = heart.hp; }
    r.check(`shielded core takes x${SHIELD_FACTOR} damage; the shield never restores HP`, ballOk && !restored, `hp ${hp0} -> ${heart.hp}`);
    // Expiry after 7 s without a break; next reroute after the 10 s cooldown.
    const tEnd = stepUntil(g, () => g.defense === null, 20);
    const expiredAfter = 3 + tEnd;
    const tNext = stepUntil(g, () => g.defense !== null, 30);
    r.check(`an unbroken shield ends by itself after ${SHIELD_TIME} s; the next one comes ${COOLDOWN} s later`, Math.abs(expiredAfter - SHIELD_TIME) <= 2 / 240 && Math.abs(tNext - COOLDOWN) <= 2 / 240 && g.reroutes === 2, `ended after ${expiredAfter.toFixed(3)} s, next after ${tNext} s`);
  }

  // --- Breaking the node: shield collapses, core + power line exposed, bonus; refund only for the player's pulse.
  {
    const breakWith = (manual) => {
      const [, g] = sector(5);
      stepUntil(g, () => g.defense !== null, 20);
      const d = g.defense; const heart = d.target; const node = d.node;
      const cash0 = g.cash; const mph = node.moneyPerHit;
      g.volleyCharge = 0.1;
      g.lanceManual = manual; // what fireVolley sets while its lances fly
      g.hitBlock(node, 1e9, node.cx, node.cy, manual ? 'lance' : 'ball');
      g.lanceManual = false;
      return { g, heart, node, d, cash0, mph };
    };
    const a = breakWith(true);
    const ex = a.g.exposed;
    r.check(`node destroyed by the player's pulse: shield gone, core + power line exposed for ${EXPOSE_TIME} s, +${BONUS}x money per hit, +${REFUND * 100} % override charge`,
      a.g.defense === null && ex && ex.blocks.includes(a.heart) && a.d.path.every((b) => ex.blocks.includes(b)) && Math.abs(ex.t - EXPOSE_TIME) < 1e-9
      && a.g.cash === a.cash0 + a.mph * (1 + BONUS) && Math.abs(a.g.volleyCharge - (0.1 + REFUND)) < 1e-9 && a.g.playerBreaks === 1 && a.node.firewall === false,
      `cash +${a.g.cash - a.cash0} (mph ${a.mph}), charge ${a.g.volleyCharge.toFixed(2)}, path ${a.d.path.length}`);
    const b = breakWith(false);
    r.check('node destroyed by a drone: same collapse and bonus, but no override refund and not counted as the player\'s break', b.g.defense === null && b.g.exposed && Math.abs(b.g.volleyCharge - 0.1) < 1e-9 && b.g.playerBreaks === 0 && b.g.shieldsBroken === 1);
    // Exposed core: x2.5 from pulses and shockwaves, x1 from drones; ends after 5 s.
    const heart = a.heart; const h0 = heart.hp;
    a.g.hitBlock(heart, 2, heart.cx, heart.cy, 'ball');
    const ballHit = h0 - heart.hp;
    a.g.hitBlock(heart, 2, heart.cx, heart.cy, 'shock');
    const shockHit = h0 - ballHit - heart.hp;
    // A pulse with nothing in front of the core: per turret power 8 x damage 1 -> 8 x 2.5 = 20 HP.
    const saved = a.g.blocks.filter((b) => b !== heart && b.alive);
    for (const b of saved) b.alive = false;
    a.g.volleyCharge = 1; a.g.damageLevel = 1;
    const h1 = heart.hp;
    a.g.fireVolley(heart.cx, heart.cy, true);
    const pulseHit = h1 - heart.hp;
    for (const b of saved) b.alive = true;
    r.check(`exposed core: x${EXPOSE_FACTOR} damage from shockwaves and override pulses, x1 from drones`, ballHit === 2 && Math.abs(shockHit - 2 * EXPOSE_FACTOR) < 1e-9 && Math.abs(pulseHit - a.g.turrets.length * 8 * EXPOSE_FACTOR) < 1e-9, `drone ${ballHit}, shock ${shockHit}, pulse (${a.g.turrets.length} turrets x power 8) ${pulseHit}`);
    const tEx = stepUntil(a.g, () => a.g.exposed === null, 10);
    const tNext = stepUntil(a.g, () => a.g.defense !== null, 20);
    r.check(`exposure ends after ${EXPOSE_TIME} s with no new shield during it; the next shield comes ${COOLDOWN} s after the exposure`, tEx !== null && Math.abs(tEx - EXPOSE_TIME) <= 2 / 240 && tNext !== null && Math.abs(tNext - COOLDOWN) <= 2 / 240 && a.g.reroutes === 2, `exposure ${tEx} s, next shield after ${tNext} s`);
  }

  // --- A pulse through the node at the shielded core: the node breaks first, the rest of the pulse hits an exposed line.
  {
    const [, g] = sector(5);
    stepUntil(g, () => g.defense !== null, 20);
    const node = g.defense.node;
    g.volleyCharge = 1; g.damageLevel = 50;
    const fired = g.fireVolley(node.cx, node.cy, true);
    r.check('an override pulse aimed at the firewall node breaks it and collapses the shield in the same step (counted as the player\'s break)', fired && !node.alive && g.defense === null && g.exposed !== null && g.playerBreaks === 1);
  }

  // --- Autopilot answers the AI: an unused pulse goes to the node.
  {
    const [, g] = sector(5);
    stepUntil(g, () => g.defense !== null, 20);
    const node = g.defense.node;
    const p = g.autoTarget();
    r.check('while a shield is up the autopilot\'s target is the firewall node', Math.abs(p.x - node.cx) < 1e-9 && Math.abs(p.y - node.cy) < 1e-9);
  }

  // --- A new sector clears the AI's state; the state is never saved.
  {
    const st = new FakeStorage();
    const hx = loadGame({ seed: 2, width: 907, height: 339, storage: st });
    const g = hx.newGame();
    g.level = 4; g.generateCore(4); g.balls = []; g.maxBalls = 0; g.chargeTime = 1e9; g.volleyCharge = 0;
    stepUntil(g, () => g.defense !== null, 20);
    const heart = g.blocks.find((b) => b.kind === 'heart');
    g.hitBlock(heart, 1e12, heart.cx, heart.cy, 'lance');
    const cleared = g.defense === null && g.exposed === null;
    g.save();
    const saved = JSON.parse(st.getItem('neonCrusher.save.v1'));
    const g2 = loadGame({ seed: 2, width: 907, height: 339, storage: new FakeStorage({ 'neonCrusher.save.v1': JSON.stringify(saved) }) }).newGame();
    r.check('the core breaking ends the shield and any exposure; save keeps exactly its five v1 fields; a reload starts unshielded with the 8 s delay', cleared && Object.keys(saved).sort().join() === 'cash,damageLevel,fireRateLevel,level,maxBalls' && g2.defense === null && g2.defenseTimer === FIRST_DELAY);
  }

  // --- Determinism: the same shields at 60/144/165 Hz (same seed).
  {
    const log = (hz) => {
      const hx = loadGame({ seed: 7, width: 1216, height: 513, storage: new FakeStorage({ 'neonCrusher.save.v1': JSON.stringify({ cash: 0, level: 5, maxBalls: 6, fireRateLevel: 3, damageLevel: 3 }) }) });
      const g = hx.newGame();
      const events = [];
      let was = null;
      hx.run(90, hz, (i, gg) => { const d = gg.defense; if (d && d !== was) events.push(`${gg.simSteps - Math.round(d.t * 240)}:${gg.level}:${gg.blocks.indexOf(d.node)}`); was = d; });
      return { events: events.join(' '), cash: g.cash, level: g.level, broken: g.shieldsBroken };
    };
    const a = log(60); const b = log(144); const c = log(165);
    r.check('same seed -> identical shields (step, sector, node), cash and sector at 60/144/165 Hz (90 s, drones + autopilot)', a.events.length > 0 && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c), `60 Hz: ${a.events.split(' ').length} shields, broken ${a.broken}, cash ${a.cash}; 144 Hz cash ${b.cash}; 165 Hz cash ${c.cash}`);
  }

  // --- Idle safety: no input, greedy buyer, from sector 3: progress never stalls, no shield outlives 7 s.
  {
    const seeds = quick ? [1] : [1, 2, 3];
    const rows = [];
    let ok = true;
    for (const seed of seeds) {
      const hx = loadGame({ seed, width: 907, height: 339, storage: new FakeStorage({ 'neonCrusher.save.v1': JSON.stringify({ cash: 0, level: 3, maxBalls: 3, fireRateLevel: 2, damageLevel: 2 }) }) });
      const g = hx.newGame();
      let longest = 0; let cur = null; let since = 0; let minCash = Infinity; let maxLevelDrop = 0; let lastLevel = g.level; let lastCash = g.cash; let cashDrop = false;
      for (let s = 0; s < 240; s++) {
        hx.run(1, 60, (i, gg) => {
          if (gg.defense && gg.defense === cur) since += 1 / 60; else { cur = gg.defense; since = 0; }
          longest = Math.max(longest, since);
          if (gg.level < lastLevel) maxLevelDrop = Math.max(maxLevelDrop, lastLevel - gg.level);
          lastLevel = gg.level;
          if (gg.cash < lastCash - 1e-9) cashDrop = true; // only purchases spend (done outside the frame loop)
          lastCash = gg.cash;
        });
        while (greedyBuy(hx, g));
        lastCash = g.cash;
        minCash = Math.min(minCash, g.cash);
      }
      rows.push(`seed ${seed}: sector 3 -> ${g.level}, shields ${g.reroutes}, broken ${g.shieldsBroken} (autopilot/drones), longest ${longest.toFixed(2)} s`);
      if (!(g.level >= 6 && longest <= SHIELD_TIME + 0.05 && maxLevelDrop === 0 && !cashDrop && g.reroutes > 0)) ok = false;
    }
    r.check('no input (autopilot + greedy buyer), 4 min from sector 3: >= 3 sectors recovered, no shield lasts > 7 s, the sector and cash never go back', ok, rows.join('; '));
  }

  // --- Onboarding: the shield hint appears with the first shield and stops after the player's own break.
  {
    const [hx, g] = sector(5);
    g.manualVolleys = 1; // the override hint was already learnt
    stepUntil(g, () => g.defense !== null, 20);
    g.updateUI();
    const hint = hx.el('hint');
    const shown = !hint.hidden && hint.textContent === g.t('hintDefense') && hint.classList.contains('hint--alert') && g.t('hintDefense') !== 'hintDefense';
    g.volleyCharge = 1; g.damageLevel = 50;
    g.fireVolley(g.defense.node.cx, g.defense.node.cy, true);
    stepUntil(g, () => g.defense !== null, 30);
    g.updateUI();
    r.check('shield hint (amber) while a shield is up, until the player breaks one node with their own pulse', shown && (hint.hidden || hint.textContent !== g.t('hintDefense')));
  }

  // --- HUD safe areas (R2): meters, AI alert and event toasts never overlap
  //     each other, stay inside the field and never cover the core, the
  //     firewall node, relays or an uplink. Worst case: shield or exposure
  //     up + three toasts with the longest texts, EN and PL, 8 field sizes
  //     (CrazyGames canvases + phone portrait), sectors 3-14.
  {
    const sizes = [[800, 279], [821, 291], [907, 339], [1077, 435], [1080, 436], [1216, 513], [1920, 909], [390, 620]];
    const bad = [];
    let cases = 0;
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const lang of ['en', 'pl']) {
      for (const [w, h] of sizes) {
        for (const lvl of [3, 4, 5, 8, 11, 14]) {
          const hx = loadGame({ seed: 3, width: w, height: h, navigator: lang === 'pl' ? { languages: ['pl-PL'] } : undefined });
          const g = hx.newGame();
          g.level = lvl; g.generateCore(lvl); g.balls = []; g.maxBalls = 0; g.chargeTime = 1e9; g.volleyCharge = 0;
          stepUntil(g, () => g.defense !== null, 30);
          if (!g.defense) { bad.push(`${lang} ${w}x${h} L${lvl}: no shield`); continue; }
          const node = g.defense.node;
          const money = '+$9,999,999';
          for (const phase of ['shield', 'exposed']) {
            if (phase === 'exposed') { g.hitBlock(node, 1e12, node.cx, node.cy, 'ball'); }
            g.toasts = [];
            g.addToast(g.t('levelUp', { n: 14 }), '#fff', true);
            g.addToast(`${g.t('relay')} ${money}`, '#fff');
            g.addToast(`${g.t(phase === 'shield' ? 'breached' : 'shieldBroken')} ${money}`, '#fff');
            const k = g.viewScale;
            const hud = g.hudLayout();
            const fieldW = g.width * k; const fieldH = g.height * k;
            const box = (b) => ({ x: b.x * k, y: b.y * k, w: b.size * k, h: b.size * k });
            const targets = g.blocks.filter((b) => b.alive && (b.kind !== 'armor' || b === node)).map((b) => ({ id: b.kind === 'armor' ? 'node' : b.kind, ...box(b) }));
            for (const t of g.turrets) targets.push({ id: 'uplink', x: (t.x - 14) * k, y: (t.y - 14) * k, w: 28 * k, h: 28 * k });
            cases++;
            for (let i = 0; i < hud.length; i++) {
              const a = hud[i];
              if (a.x < 0 || a.y < 0 || a.x + a.w > fieldW + 0.5 || a.y + a.h > fieldH + 0.5) bad.push(`${lang} ${w}x${h} L${lvl} ${phase}: ${a.id} outside the field`);
              for (let j = i + 1; j < hud.length; j++) if (hit(a, hud[j])) bad.push(`${lang} ${w}x${h} L${lvl} ${phase}: ${a.id} overlaps ${hud[j].id}`);
              for (const t of targets) if (hit(a, t)) bad.push(`${lang} ${w}x${h} L${lvl} ${phase}: ${a.id} covers ${t.id}`);
            }
          }
        }
      }
    }
    r.check(`HUD text (meters, AI alert, 3 longest event toasts) never overlaps itself, leaves the field or covers the core / node / relays / uplinks (EN + PL, 8 field sizes, sectors 3-14, shield and exposure: ${cases} layouts)`, bad.length === 0, bad.slice(0, 6).join('; ') + (bad.length > 6 ? ` ... (${bad.length})` : ''));
  }

  // --- Pace: active play that breaks nodes stays clearly ahead of passive play.
  if (!quick) {
    const play = (seed, active) => {
      const hx = loadGame({ seed, width: 907, height: 339 }); const g = hx.newGame();
      for (let q = 1; q <= 300 * 4; q++) {
        hx.run(0.25, 60);
        if (active && g.volleyReady) {
          const n = g.defense && g.defense.node.alive ? g.defense.node : null;
          g.requestVolley(n ? n.cx : g.width / 2, n ? n.cy : g.height / 2);
        }
        if (q % 4 === 0) while (greedyBuy(hx, g));
      }
      return g.level;
    };
    const act = [1, 2, 3].map((s) => play(s, true)); const pas = [1, 2, 3].map((s) => play(s, false));
    r.info('sector at 5 min, 907x339: active (breaks nodes, else aims at the core) / passive', `${act.join(',')} / ${pas.join(',')}`);
    r.check('active play >= passive play + 3 sectors at 5 min in every seed; passive still reaches sector 5', act.every((a, i) => a >= pas[i] + 3) && pas.every((p) => p >= 5), `active ${act.join(',')}, passive ${pas.join(',')}`);
  } else {
    r.notRun('active vs passive pace with shields', '--quick');
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run({ quick: process.argv.includes('--quick') }).finish());
