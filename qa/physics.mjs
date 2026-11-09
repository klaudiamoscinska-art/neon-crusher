// Physics: Ball vs walls, Ball vs Block (circle-AABB), energy conservation,
// approach check (NC-01), push-out of embedded balls (NC-02), tunnelling bound,
// refresh-rate consistency at 60/144/165 Hz (NC-03). Runs the real game.js (qa/lib.mjs).
// Usage: node qa/physics.mjs [--quick]
import { loadGame, Reporter, isMain } from './lib.mjs';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

export function run({ quick = false } = {}) {
  const r = new Reporter('physics');
  const h = loadGame({ seed: 11 });
  const { Ball, Block } = h;

  // A 20 px block spanning x/y 90..110.
  const block = () => { const b = new Block(0, 0, 20, 10, 1, '#fff'); b.applyCenter(100, 100); return b; };

  // --- Reflection from each face: normal component flips, tangential kept, speed kept.
  const faces = [
    ['left face', 86, 100, 250, 0, -250, 0],
    ['right face', 114, 100, -250, 0, 250, 0],
    ['top face', 100, 86, 0, 250, 0, -250],
    ['bottom face', 100, 114, 0, -250, 0, 250],
  ];
  for (const [name, x, y, vx, vy, evx, evy] of faces) {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    const hit = b.collideBlock(block());
    r.check(`collideBlock ${name}: reflects the normal component`, hit && near(b.vx, evx) && near(b.vy, evy), `v=(${b.vx.toFixed(2)},${b.vy.toFixed(2)})`);
  }
  {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 86; b.y = 100; b.vx = 200; b.vy = 150;
    b.collideBlock(block());
    r.check('collideBlock oblique: tangential component kept, speed kept', near(b.vy, 150) && near(b.vx, -200) && near(Math.hypot(b.vx, b.vy), 250));
    r.check('collideBlock: ball pushed out of contact (no overlap after resolve)', b.x + b.radius <= 90 + 1e-9, `x=${b.x}`);
  }
  {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 50; b.y = 50; b.vx = 250; b.vy = 0;
    r.check('collideBlock: no contact far away returns null and leaves velocity', b.collideBlock(block()) === null && b.vx === 250);
  }
  {
    // Corner: closest point is the corner, normal is diagonal.
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 87; b.y = 87; const s = 250 / Math.SQRT2; b.vx = s; b.vy = s;
    b.collideBlock(block());
    r.check('collideBlock corner: diagonal approach reflected back', near(b.vx, -s, 1e-6) && near(b.vy, -s, 1e-6));
  }

  // --- NC-01: only an approaching ball bounces and scores.
  {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 113; b.y = 100; b.vx = 250; b.vy = 0; // overlapping the right face, already moving away
    const hit = b.collideBlock(block());
    r.check('[NC-01] ball overlapping a face but moving away: no bounce, no hit (velocity kept)', hit === null && b.vx === 250 && b.vy === 0, `hit=${!!hit}, vx after=${b.vx}`);
    const c = new Ball(0, 0, 0, 250, 5, '#fff'); c.x = 113; c.y = 100; c.vx = 0; c.vy = 250; // grazing: tangential motion only
    r.check('[NC-01] tangential motion along a face (v.n = 0): no bounce, no hit', c.collideBlock(block()) === null && c.vy === 250);
  }

  // --- NC-02: a ball whose centre is inside a block leaves it at once and
  //     cannot score again while embedded.
  {
    const overlaps = (b, blk) => {
      const cx = Math.min(Math.max(b.x, blk.x), blk.x + blk.size); const cy = Math.min(Math.max(b.y, blk.y), blk.y + blk.size);
      return (b.x - cx) ** 2 + (b.y - cy) ** 2 < b.radius ** 2;
    };
    const blk = block();
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 100; b.y = 100; b.vx = 0; b.vy = 250; // centre inside the block
    b.collideBlock(blk);
    r.check('[NC-02] centre inside a block: pushed fully out through the nearest face (no overlap left)', !overlaps(b, blk), `pos=(${b.x},${b.y})`);
    r.check('[NC-02] after the push-out a second resolve finds no contact (no repeat hit)', b.collideBlock(blk) === null);
    const d = new Ball(0, 0, 0, 250, 5, '#fff'); d.x = 93; d.y = 101; d.vx = 250; d.vy = 0; // inside near the left face, moving deeper
    const hit = d.collideBlock(blk);
    r.check('[NC-02] centre inside, moving deeper: one bounce out of the nearest face, outside afterwards', !!hit && d.vx < 0 && !overlaps(d, blk), `v=(${d.vx},${d.vy}) pos=(${d.x},${d.y})`);

    // Integration: a ball on the centre of every block, then the level is
    // generated again on top of them (what a level-up does to balls in the
    // core). Resolving collisions 10 times without moving the balls = a stuck
    // ball; it may score at most once.
    const hx = loadGame({ seed: 4 }); const g = hx.newGame();
    g.balls = [];
    for (const blkx of g.blocks) { const bb = new Ball(blkx.x + blkx.size / 2, blkx.y + blkx.size / 2, (g.balls.length * 2.4) % (2 * Math.PI), 250, 5, '#fff'); g.balls.push(bb); }
    g.generateCore(g.level);
    g.damageLevel = 1e-9; const cash0 = g.cash;
    for (let i = 0; i < 10; i++) g.handleBallBlockCollisions();
    const hits = g.cash - cash0;
    const stillInside = g.balls.filter((bb) => g.blocks.some((blkx) => bb.x > blkx.x && bb.x < blkx.x + blkx.size && bb.y > blkx.y && bb.y < blkx.y + blkx.size)).length;
    r.check('[NC-02] level generated on top of balls: at most one hit per ball over 10 resolves', hits <= g.balls.length, `${hits} hits for ${g.balls.length} balls`);
    r.check('[NC-02] no ball centre left inside a block after resolving', stillInside === 0, `${stillInside} inside`);
  }

  // --- Walls: stays inside, speed preserved after jitter.
  {
    let ok = true; let speedOk = true;
    for (let i = 0; i < 200; i++) {
      const ang = (i / 200) * Math.PI * 2;
      const b = new Ball(5, 5, ang, 260, 5, '#fff');
      for (let f = 0; f < 600; f++) { b.update(1 / 60); b.bounceWalls(320, 240); }
      if (b.x < 5 - 1e-9 || b.x > 315 + 1e-9 || b.y < 5 - 1e-9 || b.y > 235 + 1e-9) ok = false;
      if (!near(Math.hypot(b.vx, b.vy), 260, 1e-6)) speedOk = false;
    }
    r.check('bounceWalls: 200 balls x 600 frames stay inside the canvas', ok);
    r.check('bounceWalls: speed preserved after jittered bounces', speedOk);
  }

  // --- Tunnelling bound: the largest step per simulation step (max speed x
  //     SIM_STEP; on a base without a fixed step: x the 0.05 s dt clamp) must
  //     be smaller than the thinnest obstacle the centre can cross (min block
  //     size + 2 x radius). Spec values: speed <= 280, radius 5
  //     (docs/GAME_DESIGN.md); blocks may be scaled down on small canvases.
  {
    const g = h.newGame();
    let maxSpeed = 0;
    for (let i = 0; i < 500; i++) { g.spawnBallFromTurret(g.turrets[0]); }
    for (const b of g.balls) maxSpeed = Math.max(maxSpeed, b.speed);
    const radius = g.balls[0].radius;
    const dtMax = h.SIM_STEP ?? 0.05;
    const step = maxSpeed * dtMax;
    let minSize = Infinity;
    for (const [w, hh] of [[320, 200], [800, 300], [1920, 900]]) {
      const hx = loadGame({ width: w, height: hh, seed: 3 }); const gx = hx.newGame();
      for (let lvl = 1; lvl <= 30; lvl++) { gx.generateCore(lvl); for (const b of gx.blocks) minSize = Math.min(minSize, b.size); }
    }
    r.check('no tunnelling: max step per simulation step < min block size + ball diameter', step < minSize + 2 * radius, `step=${step.toFixed(2)}px, block>=${minSize.toFixed(1)}px, radius=${radius}`);
    r.info('tunnelling margin', `max speed ${maxSpeed.toFixed(1)} px/s, step ${dtMax.toFixed(4)} s -> ${step.toFixed(2)} px/step vs ${(minSize + 2 * radius).toFixed(1)} px`);
  }

  // --- Refresh-rate consistency (CrazyGames "Consistent Physics", NC-03).
  //     (a) Exact: the same seed gives the same game state at 60/144/165 Hz
  //         after the same number of fixed steps (cash, level, ball positions).
  //     (b) Statistical: hit rate over many seeds, blocks indestructible so the
  //         layout stays fixed (1 cash per hit at level 1), 30 s of game time
  //         after a 10 s warm-up, at 60, 144 and 165 Hz.
  {
    const HZ = [60, 144, 165];
    const snapshot = (g) => `${g.cash}|${g.level}|${g.balls.length}|${g.balls.map((b) => `${b.x.toFixed(9)},${b.y.toFixed(9)}`).join(';')}`;
    const trace = (hz, seed) => {
      const hx = loadGame({ seed }); const g = hx.newGame();
      g.maxBalls = 12; g.fireRateLevel = 12; g.recalcFireInterval();
      const at = new Map();
      hx.run(20, hz, (i, gg) => { if (gg.simSteps !== undefined) at.set(gg.simSteps, snapshot(gg)); });
      return at;
    };
    let compared = 0; let mismatch = null;
    const exactSeeds = quick ? [1, 2] : [1, 2, 3, 4, 5, 6];
    for (const seed of exactSeeds) {
      const traces = HZ.map((hz) => trace(hz, seed));
      for (const [steps, snap] of traces[0]) {
        if (steps === 0) continue;
        for (let k = 1; k < traces.length; k++) {
          if (!traces[k].has(steps)) continue;
          compared++;
          if (traces[k].get(steps) !== snap && !mismatch) mismatch = `seed ${seed}, step ${steps}: 60 Hz vs ${HZ[k]} Hz differ`;
        }
      }
    }
    r.check('[NC-03] same seed -> identical state (cash, level, every ball position) at 60/144/165 Hz after the same fixed steps', compared > 0 && !mismatch, mismatch || `${compared} comparisons, seeds ${exactSeeds.join(',')}`);

    const seeds = quick ? 12 : 48;
    const rate = (hz, seed) => {
      const hx = loadGame({ seed }); const g = hx.newGame();
      g.maxBalls = 20; g.fireRateLevel = 15; g.recalcFireInterval(); g.damageLevel = 1e-9;
      hx.run(10, hz); const c0 = g.cash; hx.run(30, hz); return (g.cash - c0) / 30;
    };
    const stats = (hz) => {
      const xs = []; for (let s = 1; s <= seeds; s++) xs.push(rate(hz, s));
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
      return { m, se: sd / Math.sqrt(xs.length) };
    };
    const st = Object.fromEntries(HZ.map((hz) => [hz, stats(hz)]));
    let worstZ = 0; let worstRel = 0;
    for (const hz of [144, 165]) {
      const a = st[60]; const b = st[hz];
      const z = (a.m - b.m) / (Math.sqrt(a.se ** 2 + b.se ** 2) || 1);
      const rel = (a.m - b.m) / a.m;
      worstZ = Math.max(worstZ, Math.abs(z)); worstRel = Math.max(worstRel, Math.abs(rel));
      r.info(`hit rate 60 Hz vs ${hz} Hz`, `${a.m.toFixed(3)}+-${a.se.toFixed(3)} vs ${b.m.toFixed(3)}+-${b.se.toFixed(3)} hits/s, diff ${(rel * 100).toFixed(1)}%, z=${z.toFixed(2)}, seeds=${seeds}`);
    }
    if (quick) r.notRun('[NC-03] refresh-rate statistical verdict (48 seeds)', '--quick uses 12 seeds (full run: node qa/physics.mjs); the exact same-seed check above still ran');
    else r.check('[NC-03] hit rate at 144 and 165 Hz within 2 standard errors and 2 % of 60 Hz (48 seeds)', worstZ < 2 && worstRel < 0.02, `worst |z|=${worstZ.toFixed(2)}, worst diff ${(worstRel * 100).toFixed(1)}%`);
  }

  return r;
}

if (isMain(import.meta.url)) process.exit(run({ quick: process.argv.includes('--quick') }).finish());
