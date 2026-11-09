// Simulation equality between two game.js builds (dev tool, not a suite;
// NC-ART-1). A visual-only change must leave the simulation bit-identical:
// same seed + same input -> same cash, level, balls and block HP after many
// fixed steps, at 60 and 144 Hz. Also prints draw work per frame (harness
// context counters) for both builds on a late-game state.
// Usage: node qa/sim-compare.mjs <base game.js> [candidate game.js]
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGame, FakeStorage, ROOT } from './lib.mjs';

const self = fileURLToPath(import.meta.url);

/** Runs one scenario in this process (NC_GAME_JS picks the build). */
function scenario(seed, hz, save, w, h) {
  const storage = new FakeStorage(save ? { 'neonCrusher.save.v1': JSON.stringify(save) } : {});
  const hh = loadGame({ width: w, height: h, seed, storage });
  const g = hh.newGame();
  let t = 0;
  // 150 s: buy whatever is affordable every 2 s, aim a volley at the core
  // centre whenever it is ready (every 3rd ready volley is left to the autopilot).
  let ready = 0;
  while (t < 150) {
    hh.run(0.5, hz);
    t += 0.5;
    if (Math.round(t * 2) % 4 === 0) for (const id of ['btnBuyBall', 'btnDamage', 'btnFireRate']) hh.el(id).click();
    if (g.volleyReady && (ready++ % 3) !== 2) hh.pointer('pointerdown', w / 2, h / 2);
  }
  const blocks = g.blocks.filter((b) => b.alive).map((b) => `${b.kind}:${b.hp}`).join(',');
  const balls = g.balls.map((b) => `${b.x.toFixed(6)},${b.y.toFixed(6)}`).join(';');
  return { cash: g.cash, level: g.level, maxBalls: g.maxBalls, steps: g.simSteps, manual: g.manualVolleys, auto: g.autoVolleys, shattered: g.coresShattered, blocks, balls };
}

/** Draw work per frame on a late-game state (harness counters). */
function drawWork(level, balls) {
  const storage = new FakeStorage({ 'neonCrusher.save.v1': JSON.stringify({ cash: 0, level, maxBalls: balls, fireRateLevel: 10, damageLevel: 1 }) });
  const hh = loadGame({ width: 1216, height: 513, seed: 5, storage });
  hh.newGame();
  hh.run(12, 60);
  for (const k of Object.keys(hh.ctx.__calls)) delete hh.ctx.__calls[k];
  const frames = hh.run(2, 60);
  const c = hh.ctx.__calls;
  const per = (k) => ((c[k] || 0) / frames).toFixed(1);
  return `level ${level}, ${balls} balls: shadowBlur sets ${per('__shadowBlurSet')}, save ${per('save')}, fill ${per('fill')}, stroke ${per('stroke')}, arc ${per('arc')}, lineTo ${per('lineTo')}, drawImage ${per('drawImage')} per frame`;
}

if (process.argv[2] === '--child') {
  const out = [];
  for (const [seed, hz, save, w, h] of [[1, 60, null, 907, 339], [2, 144, null, 800, 279], [3, 60, { cash: 500, level: 5, maxBalls: 6, fireRateLevel: 3, damageLevel: 3 }, 1216, 513], [4, 144, { cash: 2000, level: 12, maxBalls: 20, fireRateLevel: 8, damageLevel: 10 }, 1920, 909]]) {
    out.push(scenario(seed, hz, save, w, h));
  }
  out.push(drawWork(1, 1), drawWork(13, 24), drawWork(14, 60));
  process.stdout.write(JSON.stringify(out));
} else {
  const base = path.resolve(process.argv[2] || '');
  const cand = path.resolve(process.argv[3] || path.join(ROOT, 'game.js'));
  const run = (file) => JSON.parse(spawnSync(process.execPath, [self, '--child'], { env: { ...process.env, NC_GAME_JS: file }, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout);
  const a = run(base);
  const b = run(cand);
  let same = true;
  for (let i = 0; i < 4; i++) {
    const eq = JSON.stringify(a[i]) === JSON.stringify(b[i]);
    same &&= eq;
    console.log(`${eq ? 'IDENTICAL' : 'DIFFERENT'} scenario ${i + 1}: level ${a[i].level}/${b[i].level}, cash ${a[i].cash}/${b[i].cash}, steps ${a[i].steps}, volleys manual ${a[i].manual} auto ${a[i].auto}, cores ${a[i].shattered}`);
  }
  for (let i = 4; i < 7; i++) console.log(`base:      ${a[i]}\ncandidate: ${b[i]}`);
  console.log(same ? 'RESULT: simulation identical in all scenarios' : 'RESULT: simulation DIFFERS');
  process.exit(same ? 0 : 1);
}
