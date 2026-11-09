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
    r.check('costs: ball 10 x 1.5^(n-1), fire rate / damage 15 x 1.5^(lvl-1), rounded up (lvl 1-40)', ok);
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
    r.check('fire rate: -$15, level 2, interval 2200 x 0.85', g.cash === 75 && g.fireRateLevel === 2 && Math.abs(g.fireInterval - 1870) < 1e-9);
    h.el('btnDamage').click();
    r.check('damage: -$15, level 2, ball damage 2', g.cash === 60 && g.damageLevel === 2 && g.ballDamage === 2);
    g.fireRateLevel = 50; g.recalcFireInterval();
    r.check('fire interval floor 300 ms', g.fireInterval === 300);
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

  // --- NC-10: once the field holds maxBalls, fire rate changes nothing.
  {
    const sim = (fr) => {
      const h = loadGame({ seed: 5 }); const g = h.newGame();
      g.maxBalls = 6; for (let i = 1; i < 6; i++) g.spawnBallFromTurret(g.turrets[0]);
      g.fireRateLevel = fr; g.recalcFireInterval();
      h.run(60, 60); return g.cash;
    };
    const a = sim(1); const b = sim(25);
    r.known('NC-10', 'fire-rate upgrade has no effect once maxBalls are on the field (balls never despawn)', a === b, `cash after 60 s: fire rate 1 = ${a}, fire rate 25 = ${b}`);
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
    const slow = medians.filter(([, m]) => m > 60);
    r.known('NC-09', 'median time to the first purchase exceeds 60 s on at least one CrazyGames canvas (conversion = 1 min of play)', slow.length > 0, slow.map(([k, m]) => `${k}: ${m > 300 ? '>300' : m} s`).join(', '));
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
  } else {
    r.notRun('greedy bot level-1 clear time', '--quick');
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run({ quick: process.argv.includes('--quick') }).finish());
