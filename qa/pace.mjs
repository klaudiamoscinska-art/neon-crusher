// Progression-pace measurement (a tool, not a suite: prints numbers, never
// PASS/FAIL; not part of run-all). Used to report the economy impact of a
// runtime change, base vs candidate on the same machine and seeds:
//   NC_GAME_JS=/tmp/base-game.js node qa/pace.mjs [--hz 60,144] [--quick]
//   node qa/pace.mjs [--hz 60,144,165]
// Measures, from a fresh save at CrazyGames canvas sizes:
//  - time to the first purchase ($10), median over seeds;
//  - early income: fresh save, no purchases (1 ball), cash per minute over
//    5 minutes, mean +- standard error over 48 seeds (--only early);
//  - mid-game hit rate: level 5 (5x5 grid), 10 balls, indestructible blocks,
//    hits per second over 2 minutes after 20 s warm-up, 48 seeds (--only mid);
//  - greedy bot (buys the cheapest affordable upgrade every second): cash
//    earned per minute over 10 minutes (spent + kept), level reached, and the
//    level at 1/3/5/10 min. --bot passive (default: never touches the field;
//    on NC-ORIGINAL-1 the autopilot fires unused volleys) or --bot active
//    (NC-ORIGINAL-1: aims every ready volley at the heart within 0.25 s).
//    --canvas 907x339,1216x513 picks canvases; --skip-first skips the
//    first-purchase runs.
import { loadGame, isMain } from './lib.mjs';
import { greedyBuy } from './economy.mjs';

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function firstPurchase({ w, h, hz, seeds, limit = 300 }) {
  const ts = [];
  for (const seed of seeds) {
    const hx = loadGame({ seed, width: w, height: h }); const g = hx.newGame();
    let t = null; for (let s = 1; s <= limit && t === null; s++) { hx.run(1, hz); if (g.cash >= 10) t = s; }
    ts.push(t ?? limit + 1);
  }
  return { median: median(ts), mean: mean(ts), runs: ts };
}

export function earlyIncome({ w, h, hz, seeds, minutes = 5 }) {
  const xs = [];
  for (const seed of seeds) {
    const hx = loadGame({ seed, width: w, height: h }); const g = hx.newGame();
    hx.run(minutes * 60, hz); xs.push(g.cash / minutes);
  }
  const m = mean(xs);
  const se = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length);
  return { mean: m, se };
}

export function midHitRate({ w, h, hz, seeds, level = 5, balls = 10 }) {
  const xs = [];
  for (const seed of seeds) {
    const hx = loadGame({ seed, width: w, height: h }); const g = hx.newGame();
    g.level = level; g.generateCore(level); g.maxBalls = balls; g.fireRateLevel = 20; g.recalcFireInterval(); g.damageLevel = 1e-9;
    const pay = g.blocks[0].moneyPerHit;
    hx.run(20, hz); const c0 = g.cash; hx.run(120, hz); xs.push((g.cash - c0) / pay / 120);
  }
  const m = mean(xs);
  const se = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length);
  return { mean: m, se };
}

export function greedyIncome({ w, h, hz, seeds, minutes = 10, bot = 'passive' }) {
  const perMin = []; const levels = []; const at = { 1: [], 3: [], 5: [], 10: [] };
  for (const seed of seeds) {
    const hx = loadGame({ seed, width: w, height: h }); const g = hx.newGame();
    let spent = 0;
    for (let s = 1; s <= minutes * 60; s++) {
      for (let q = 0; q < 4; q++) {
        hx.run(0.25, hz);
        if (bot === 'active' && g.volleyReady) g.requestVolley(g.width / 2, g.height / 2);
      }
      for (;;) { const before = g.cash; if (!greedyBuy(hx, g)) break; spent += before - g.cash; }
      if (at[s / 60]) at[s / 60].push(g.level);
    }
    perMin.push((g.cash + spent) / minutes); levels.push(g.level);
  }
  const levelAt = Object.fromEntries(Object.entries(at).filter(([, v]) => v.length).map(([k, v]) => [k, median(v)]));
  return { perMinMean: mean(perMin), perMinMedian: median(perMin), levelMedian: median(levels), perMin, levels, levelAt };
}

if (isMain(import.meta.url)) {
  const argv = process.argv;
  const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
  const quick = argv.includes('--quick');
  const hzs = arg('--hz', '60,144').split(',').map(Number);
  const fpSeeds = Array.from({ length: quick ? 4 : 16 }, (_, i) => i + 1);
  const botSeeds = Array.from({ length: quick ? 2 : 8 }, (_, i) => i + 1);
  const canvases = arg('--canvas', null) ? arg('--canvas').split(',').map((c) => c.split('x').map(Number)) : [[800, 279], [907, 339], [1216, 513], [1920, 909]];
  const only = arg('--only', null);
  const bot = arg('--bot', 'passive');
  const skipFirst = argv.includes('--skip-first');
  const out = { game: process.env.NC_GAME_JS || 'game.js', firstPurchase: {}, early: {}, greedy: {} };
  for (const hz of hzs) {
    if (only === 'early') {
      for (const [w, h] of canvases) {
        const r = earlyIncome({ w, h, hz, seeds: Array.from({ length: quick ? 12 : 48 }, (_, i) => i + 1) });
        out.early[`${hz}Hz ${w}x${h}`] = r;
        console.log(`early income    ${hz} Hz ${w}x${h}: ${r.mean.toFixed(2)} +- ${r.se.toFixed(2)} $/min (1 ball, no purchases)`);
      }
      continue;
    }
    if (only === 'mid') {
      for (const [w, h] of canvases.slice(0, 3)) {
        const r = midHitRate({ w, h, hz, seeds: Array.from({ length: quick ? 12 : 48 }, (_, i) => i + 1) });
        out.mid = out.mid || {}; out.mid[`${hz}Hz ${w}x${h}`] = r;
        console.log(`mid-game hits   ${hz} Hz ${w}x${h}: ${r.mean.toFixed(2)} +- ${r.se.toFixed(2)} hits/s (L5 grid, 10 balls)`);
      }
      continue;
    }
    for (const [w, h] of skipFirst ? [] : canvases) {
      const r = firstPurchase({ w, h, hz, seeds: fpSeeds });
      out.firstPurchase[`${hz}Hz ${w}x${h}`] = r;
      console.log(`first purchase  ${hz} Hz ${w}x${h}: median ${r.median} s, mean ${r.mean.toFixed(1)} s, runs ${r.runs.join(',')}`);
    }
    for (const [w, h] of canvases.slice(0, 3)) {
      const r = greedyIncome({ w, h, hz, seeds: botSeeds, bot });
      out.greedy[`${hz}Hz ${w}x${h}`] = r;
      console.log(`greedy 10 min ${bot} ${hz} Hz ${w}x${h}: earned/min mean ${r.perMinMean.toFixed(1)}, median ${r.perMinMedian.toFixed(1)}, level median ${r.levelMedian} (levels ${r.levels.join(',')}), level at 1/3/5/10 min ${Object.values(r.levelAt).join('/')}`);
    }
  }
  console.log(JSON.stringify(out));
}
