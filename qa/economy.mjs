// Economy: upgrade costs, purchases through the real shop buttons, fire
// interval, damage, income per hit, and early-progression pace (bot).
// Expected values = the spec in docs/GAME_DESIGN.md ("Economy").
// Usage: node qa/economy.mjs [--quick]
import { loadGame, Reporter, isMain } from './lib.mjs';

const cost = (base, lvl) => Math.ceil(base * 1.5 ** (lvl - 1));

/** Greedy bot: buys the cheapest affordable upgrade, as often as it can. */
export function greedyBuy(h, g) {
  g.updateUI();
  const opts = [['btnBuyBall', g.ballCost], ['btnDamage', g.damageCost], ['btnFireRate', g.fireRateCost]].sort((a, b) => a[1] - b[1]);
  for (const [id, c] of opts) if (g.cash >= c) { h.el(id).click(); return true; }
  return false;
}

export function run({ quick = false } = {}) {
  const r = new Reporter('economy');

  // --- Cost curves.
  {
    const h = loadGame(); const g = h.newGame();
    let ok = true;
    for (let lvl = 1; lvl <= 40; lvl++) {
      g.maxBalls = lvl; g.fireRateLevel = lvl; g.damageLevel = lvl;
      if (g.ballCost !== cost(10, lvl) || g.fireRateCost !== cost(15, lvl) || g.damageCost !== cost(15, lvl)) ok = false;
    }
    r.check('costs: ball 10 x 1.5^(n-1), volley charge / damage 15 x 1.5^(lvl-1), rounded up (lvl 1-40)', ok);
    g.maxBalls = 1; g.fireRateLevel = 1; g.damageLevel = 1; g.updateUI();
    r.check('starting costs shown in the shop: $10 / $15 / $15', h.el('costBuyBall').textContent === '$10' && h.el('costFireRate').textContent === '$15' && h.el('costDamage').textContent === '$15');
  }

  // --- Purchases through the buttons.
  {
    const h = loadGame(); const g = h.newGame();
    g.cash = 9; g.updateUI();
    r.check('button disabled when cash < cost', h.el('btnBuyBall').disabled === true);
    h.el('btnBuyBall').forceClick();
    r.check('handler guard: forced click with too little cash changes nothing', g.cash === 9 && g.maxBalls === 1);
    g.cash = 100; g.updateUI();
    h.el('btnBuyBall').click();
    r.check('buy ball: -$10, maxBalls 2, next cost $15', g.cash === 90 && g.maxBalls === 2 && g.ballCost === 15);
    h.el('btnFireRate').click();
    r.check('volley charge: -$15, level 2, charge time 11 x 0.9 s, shop shows level and seconds', g.cash === 75 && g.fireRateLevel === 2 && Math.abs(g.chargeTime - 9.9) < 1e-9 && h.el('descFireRate').textContent === 'Lvl 2 · 9.9 s', h.el('descFireRate').textContent);
    h.el('btnDamage').click();
    r.check('damage: -$15, level 2, ball damage 2', g.cash === 60 && g.damageLevel === 2 && g.ballDamage === 2);
    r.check('purchase feedback: the bought button gets the one-shot flash class', h.el('btnDamage').classList.contains('shop-btn--bought'));
    g.fireRateLevel = 50; g.recalcFireInterval();
    r.check('volley charge time floor 2 s; ball refill fixed at 700 ms whatever the charge level', g.chargeTime === 2 && g.fireInterval === 700);
  }

  // --- Income: one hit pays moneyPerHit and deals ballDamage (read live).
  {
    const h = loadGame(); const g = h.newGame();
    g.balls = []; g.damageLevel = 3;
    const b = g.blocks[0]; const hp0 = b.hp; const cash0 = g.cash;
    const ball = new h.Ball(b.x - 4, b.y + b.size / 2, 0, 250, 5, '#fff');
    g.balls.push(ball);
    g.handleBallBlockCollisions();
    r.check('a hit pays moneyPerHit ($1 at L1) and deals damageLevel damage', g.cash === cash0 + 1 && b.hp === hp0 - 3);
    r.check('maxBalls is a cap: turrets never exceed it', (() => { g.maxBalls = 3; h.run(20, 60); return g.balls.length === 3; })());
  }

  // --- NC-10 (closed in NC-ORIGINAL-1): the second upgrade is the volley
  //     charge; it pays off with a full field, even with no player input
  //     (the autopilot fires unused volleys).
  {
    const sim = (fr, seed) => {
      const h = loadGame({ seed }); const g = h.newGame();
      g.maxBalls = 6; for (let i = 1; i < 6; i++) g.spawnBallFromTurret(g.turrets[0]);
      g.fireRateLevel = fr; g.recalcFireInterval();
      h.run(60, 60); return g.cash + (g.level - 1) * 1000;
    };
    const seeds = [1, 2, 3, 4, 5, 6];
    const a = seeds.map((s) => sim(1, s)); const b = seeds.map((s) => sim(12, s));
    const wins = seeds.filter((_, i) => b[i] > a[i]).length;
    r.check('[NC-10] volley-charge upgrade pays off with a full field and no input (charge 12 beats charge 1 in >= 5 of 6 seeds, 60 s)', wins >= 5, `score (cash + 1000 x levels gained): charge 1 = ${a.join(',')}; charge 12 = ${b.join(',')}`);
  }

  // --- Breach system (NC-ORIGINAL-1, docs/GAME_DESIGN.md "Breach").
  {
    const fresh = (seed = 1, w = 907, hh = 339) => { const h = loadGame({ seed, width: w, height: hh }); const g = h.newGame(); g.balls = []; g.maxBalls = 0; return [h, g]; };
    // Volley charge and readiness.
    {
      const [h, g] = fresh();
      const c0 = g.volleyCharge;
      h.run(11 * 0.3 - 0.2, 60);
      const notYet = !g.volleyReady;
      h.run(0.4, 60);
      r.check('a fresh session starts at 70 % charge; volley ready after 30 % of 11 s', Math.abs(c0 - 0.7) < 1e-9 && notYet && g.volleyReady);
    }
    // Lance: power = 8 x ball damage, absorbed by armour in order along the line.
    {
      const [h, g] = fresh();
      g.volleyCharge = 1; g.damageLevel = 3;
      const heart = g.blocks.find((b) => b.kind === 'heart');
      const t = g.turrets[0];
      const above = g.blocks.find((b) => b.kind !== 'heart' && Math.abs(b.offsetX) < 1e-6 && b.offsetY < 0);
      const below = g.blocks.find((b) => b.kind !== 'heart' && Math.abs(b.offsetX) < 1e-6 && b.offsetY > 0);
      const cash0 = g.cash;
      const fired = g.fireVolley(heart.cx, heart.cy, true);
      // 24 power: the armour block in front (10 HP) breaks, the heart (60 HP) takes 14, the block behind nothing.
      r.check('lance from the turret through the heart: front block (10 HP) broken, heart 60 -> 46, block behind untouched (Hit power 3 = 24 power)', fired && !above.alive && heart.hp === 46 && below.hp === below.maxHp && g.volleyCharge === 0, `turret (${t.x.toFixed(0)},${t.y.toFixed(0)}) heart ${heart.hp} below ${below.hp}`);
      r.check('every block a lance damages pays one hit ($1 each at level 1)', g.cash === cash0 + 2);
      r.check('volley not ready: fireVolley does nothing', g.fireVolley(heart.cx, heart.cy, true) === false && heart.hp === 46);
    }
    // A lance cannot slip through the 5-unit gap between two blocks.
    {
      const [, g] = fresh();
      g.volleyCharge = 1;
      const a = g.blocks.find((b) => b.kind !== 'heart' && b.offsetX < 0 && b.offsetY < 0);
      const t = g.turrets[0];
      const gapX = a.x + a.size + 2.5; // middle of the gap right of the top-left block
      g.fireVolley(gapX, g.height / 2, true);
      r.check('a lance aimed into a 5-unit gap still hits a block (lance wider than half a gap)', g.blocks.some((b) => b.hp < b.maxHp || !b.alive), `turret x ${t.x.toFixed(1)}, gap x ${gapX.toFixed(1)}`);
    }
    // Player input: click/tap (pointer) fires on the next fixed step; while charging it does nothing.
    {
      const [h, g] = fresh();
      g.volleyCharge = 0.5;
      const heart = g.blocks.find((b) => b.kind === 'heart');
      const sx = heart.cx * g.viewScale; const sy = heart.cy * g.viewScale;
      h.pointer('pointerdown', sx, sy);
      h.run(0.05, 60);
      const charging = g.manualVolleys === 0 && heart.hp === heart.maxHp;
      g.volleyCharge = 1; g.damageLevel = 10;
      h.pointer('pointerdown', sx, sy, { pointerType: 'touch' });
      const queued = g.manualVolleys === 0;
      h.run(0.05, 60);
      r.check('click/tap while charging does nothing; when ready it fires on the next fixed step at the tapped point (touch)', charging && queued && g.manualVolleys === 1 && heart.hp < heart.maxHp);
      g.volleyCharge = 1;
      const prevented = h.key('Space');
      h.run(0.05, 60);
      r.check('Space fires the volley at the core centre (default prevented)', prevented && g.manualVolleys === 2);
    }
    // Autopilot: an unused volley fires by itself after 5 s at an armour block.
    {
      const [h, g] = fresh(3);
      g.volleyCharge = 1; g.volleyReadyFor = 0;
      h.run(4.9, 60);
      const waiting = g.autoVolleys === 0;
      h.run(0.2, 60);
      const heart = g.blocks.find((b) => b.kind === 'heart');
      r.check('autopilot: a ready volley waits 5 s for the player, then fires by itself at an armour block (not the heart)', waiting && g.autoVolleys === 1 && g.manualVolleys === 0 && heart.hp === heart.maxHp);
    }
    // Relay: bonus, full charge, shockwave to neighbours.
    {
      const [, g] = fresh(2);
      g.level = 2; g.generateCore(2); g.balls = [];
      const relay = g.blocks.find((b) => b.kind === 'relay');
      g.volleyCharge = 0.1;
      const cash0 = g.cash;
      const nearby = g.blocks.filter((b) => b !== relay && Math.hypot(b.cx - relay.cx, b.cy - relay.cy) <= 1.6 * g.blockStep * g.coreScale);
      g.hitBlock(relay, 1e9, relay.cx, relay.cy, 'ball');
      const shocked = nearby.length > 0 && nearby.every((b) => b.hp === b.maxHp - 6 || !b.alive);
      r.check('relay destroyed: volley fully charged, +4x money per hit bonus, shockwave deals 6 x ball damage to blocks within 1.6 steps', g.volleyCharge === 1 && shocked && g.cash === cash0 + relay.moneyPerHit * (1 + 4 + nearby.length), `neighbours ${nearby.length}, cash +${g.cash - cash0}`);
    }
    // Heart: the core shatters outward and the level advances.
    {
      const [h, g] = fresh();
      const heart = g.blocks.find((b) => b.kind === 'heart');
      const others = g.blocks.filter((b) => b !== heart).length;
      const cash0 = g.cash;
      g.volleyCharge = 0;
      g.hitBlock(heart, 1e9, heart.cx, heart.cy, 'lance');
      const marked = g.blocks.filter((b) => b.alive && b.shatter !== null).length;
      h.run(1, 60);
      r.check('heart destroyed: every other block shatters in a wave (each pays 1 hit), +6x bonus, volley recharged, level 2', marked === others && g.level === 2 && g.coresShattered === 1 && g.cash === cash0 + 1 + 6 + others && g.volleyReady, `marked ${marked}/${others}, cash +${g.cash - cash0}, level ${g.level}`);
    }
    // Sound preference: separate key, the progress save untouched.
    {
      const [h, g] = fresh();
      const before = h.storage.getItem('neonCrusher.save.v1');
      h.el('btnMute').click();
      const muted = g.sound.muted && h.storage.getItem('neonCrusher.audio.v1') === 'muted' && h.el('btnMute').attributes['aria-pressed'] === 'true';
      h.key('KeyM');
      const unmuted = !g.sound.muted && h.storage.getItem('neonCrusher.audio.v1') === 'on';
      const h2 = loadGame({ storage: new (h.storage.constructor)({ 'neonCrusher.audio.v1': 'muted' }) }); const g2 = h2.newGame();
      r.check('mute toggle (button and M) persists under neonCrusher.audio.v1, restored on load; progress save key not written by it', muted && unmuted && g2.sound.muted && h.storage.getItem('neonCrusher.save.v1') === before);
    }
  }

  // --- First-minute hint (NC-CORE-1A): shown on a fresh save only, points at
  //     the first purchase once it is affordable, gone after it; never stored.
  {
    const h = loadGame({ width: 907, height: 339 }); const g = h.newGame();
    const hint = h.el('hint'); const buy = h.el('btnBuyBall');
    const s0 = !hint.hidden && hint.textContent === g.t('hintStart') && g.t('hintStart') !== 'hintStart' && !buy.classList.contains('shop-btn--suggested');
    g.volleyCharge = 1; g.updateUI();
    const sV = !hint.hidden && hint.textContent === g.t('hintVolley') && hint.classList.contains('hint--action');
    g.fireVolley(g.width / 2, g.height / 2, true);
    g.cash = 10; g.updateUI();
    const s1 = !hint.hidden && hint.textContent === g.t('hintBuy') && buy.classList.contains('shop-btn--suggested');
    buy.click();
    const s2 = hint.hidden && !buy.classList.contains('shop-btn--suggested');
    g.volleyCharge = 1; g.updateUI();
    const s3 = hint.hidden;
    g.save();
    const saved = JSON.parse(h.storage.getItem('neonCrusher.save.v1'));
    r.check('hint: fresh save explains cash + goal; a ready volley asks for a click/tap until the first aimed volley; then "buy ball" when affordable; hidden after the first purchase', s0 && sV && s1 && s2 && s3, `start=${s0} volley=${sV} affordable=${s1} afterBuy=${s2} afterVolley=${s3}`);
    r.check('hint state is not saved (save keeps exactly its five fields)', Object.keys(saved).sort().join() === 'cash,damageLevel,fireRateLevel,level,maxBalls');
    const st = { 'neonCrusher.save.v1': JSON.stringify({ cash: 3, level: 2, maxBalls: 1, fireRateLevel: 1, damageLevel: 1 }) };
    const h2 = loadGame({ storage: new (h.storage.constructor)(st) }); const g2 = h2.newGame();
    const quiet = h2.el('hint').hidden === true;
    g2.volleyCharge = 1; g2.updateUI();
    r.check('returning player: no first-minute hint; only the volley hint while a volley is ready (until the first aimed volley)', quiet && !h2.el('hint').hidden && h2.el('hint').textContent === g2.t('hintVolley'));
  }

  // --- Cash labels on hits: one "+$n" per hit, capped (NC-13 cost).
  {
    const h = loadGame({ width: 907, height: 339, seed: 4 }); const g = h.newGame();
    let seen = 0; let max = 0; let text = '';
    const ft = (gg) => gg.floatTexts || [];
    h.run(30, 60, (i, gg) => { if (ft(gg).length) { seen++; text = ft(gg)[0].text; } max = Math.max(max, ft(gg).length); });
    const h2 = loadGame({ width: 907, height: 339, seed: 4 }); const g2 = h2.newGame();
    g2.maxBalls = 80; g2.fireRateLevel = 40; g2.recalcFireInterval();
    g2.balls = []; for (let i = 0; i < 80; i++) g2.spawnBallFromTurret(g2.turrets[0]);
    let max2 = 0; h2.run(20, 60, (i, gg) => { max2 = Math.max(max2, ft(gg).length); });
    r.check('hits show a "+$n" label in the money format; at most 10 at once with 80 balls', seen > 0 && text === '+$1' && max2 <= 10 && max2 > 0, `label "${text}", max 1 ball ${max}, max 80 balls ${max2}`);
  }

  // --- Early pace (NC-09): fresh save, time to the first $10 and to clear
  //     level 1, on canvases measured in Chromium at CrazyGames iframe sizes
  //     (800x450 mobile, 907x510 desktop, 1216x684 desktop, 1920x1080 full).
  {
    const canvases = [[800, 279], [907, 339], [1216, 513], [1920, 909]];
    const seeds = quick ? [1, 2, 3] : [1, 2, 3, 4, 5, 6, 7, 8];
    const medians = [];
    for (const [w, hh] of canvases) {
      const ts = [];
      for (const seed of seeds) {
        const h = loadGame({ seed, width: w, height: hh }); const g = h.newGame();
        let t = null; for (let s = 1; s <= 300 && t === null; s++) { h.run(1, 60); if (g.cash >= 10) t = s; }
        ts.push(t ?? 301);
      }
      ts.sort((a, b) => a - b);
      const med = (ts[(ts.length - 1) >> 1] + ts[ts.length >> 1]) / 2;
      medians.push([`${w}x${hh}`, med]);
      r.info(`first purchase ($10), canvas ${w}x${hh}`, `median ${med > 300 ? '>300' : med} s, runs: ${ts.map((t) => (t > 300 ? '>300' : t)).join(',')}`);
    }
    // NC-09 (closed in NC-CORE-1A): conversion = 1 min of play; design target
    // 15-45 s since NC-ORIGINAL-1 (was 20-45 s; the first volley at ~3 s,
    // fired by the autopilot here, adds early cash).
    r.check('[NC-09] median time to the first purchase <= 60 s on every CrazyGames canvas', medians.every(([, m]) => m <= 60), medians.map(([k, m]) => `${k}: ${m > 300 ? '>300' : m} s`).join(', '));
    if (!quick) r.check('[NC-09] median time to the first purchase within the 15-45 s design target on every canvas, no input (8 seeds)', medians.every(([, m]) => m >= 15 && m <= 45), medians.map(([k, m]) => `${k}: ${m} s`).join(', '));
  }
  if (!quick) {
    for (const [w, hh] of [[907, 339], [1920, 909]]) {
      const res = [];
      for (const seed of [1, 2, 3]) {
        const h = loadGame({ seed, width: w, height: hh }); const g = h.newGame();
        let t = null;
        for (let s = 1; s <= 900 && t === null; s++) { h.run(1, 60); while (greedyBuy(h, g)); if (g.level >= 2) t = s; }
        res.push(t === null ? '>15' : (t / 60).toFixed(1));
      }
      r.info(`greedy bot, canvas ${w}x${hh}: minutes to clear level 1`, res.join(', '));
    }
    // Active vs passive (NC-ORIGINAL-1): the same greedy buyer, once aiming
    // every ready volley at the heart, once never touching the field.
    const play = (seed, active) => {
      const h = loadGame({ seed, width: 907, height: 339 }); const g = h.newGame();
      let l1 = null;
      for (let q = 1; q <= 180 * 4; q++) {
        h.run(0.25, 60);
        if (active && g.volleyReady) g.requestVolley(g.width / 2, g.height / 2);
        if (q % 4 === 0) while (greedyBuy(h, g));
        if (l1 === null && g.level >= 2) l1 = q / 4;
      }
      return { l1: l1 ?? 999, level: g.level };
    };
    const act = [1, 2, 3].map((s) => play(s, true)); const pas = [1, 2, 3].map((s) => play(s, false));
    const fmt = (xs) => xs.map((x) => `L1 ${x.l1} s, level ${x.level} at 3 min`).join('; ');
    r.info('active bot (aims every volley at the heart), 907x339', fmt(act));
    r.info('passive bot (never touches the field), 907x339', fmt(pas));
    r.check('active play clearly ahead: in every seed level 1 cleared sooner and >= 2 levels higher at 3 min than passive play; passive play still progresses (level >= 3 at 3 min)', act.every((a, i) => a.l1 < pas[i].l1 && a.level >= pas[i].level + 2) && pas.every((p) => p.level >= 3));
  } else {
    r.notRun('greedy bot level-1 clear time', '--quick');
    r.notRun('active vs passive pace', '--quick');
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run({ quick: process.argv.includes('--quick') }).finish());
