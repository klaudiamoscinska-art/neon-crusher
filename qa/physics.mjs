// Physics: Ball vs walls, Ball vs Block (circle-AABB), energy conservation,
// tunnelling bound, refresh-rate consistency. Runs the real game.js (qa/lib.mjs).
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

  // --- Known defects (docs/RISKS.md).
  {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 113; b.y = 100; b.vx = 250; b.vy = 0; // overlapping the right face, already moving away
    b.collideBlock(block());
    r.known('NC-01', 'collideBlock reflects a ball that is already moving away (no approach check) -- sends it back into the block', b.vx < 0, `vx after=${b.vx}`);
  }
  {
    const b = new Ball(0, 0, 0, 250, 5, '#fff'); b.x = 100; b.y = 100; b.vx = 0; b.vy = 250; // centre inside the block
    b.collideBlock(block());
    const inside = b.x > 90 && b.x < 110 && b.y > 90 && b.y < 110;
    r.known('NC-02', 'ball whose centre is inside a block is pushed only radius+0.5 and stays inside (repeat hits)', inside, `pos=(${b.x},${b.y})`);
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

  // --- Tunnelling bound: the largest step per frame (max speed x dt clamp)
  //     must be smaller than the thinnest obstacle the centre can cross
  //     (min block size + 2 x radius). Spec values: speed <= 280, dt <= 0.05,
  //     block size >= 16, radius 5 (docs/GAME_DESIGN.md).
  {
    const g = h.newGame();
    let maxSpeed = 0;
    for (let i = 0; i < 500; i++) { g.spawnBallFromTurret(g.turrets[0]); }
    for (const b of g.balls) maxSpeed = Math.max(maxSpeed, b.speed);
    const radius = g.balls[0].radius;
    const step = maxSpeed * 0.05;
    let minSize = Infinity;
    for (const [w, hh] of [[320, 200], [800, 300], [1920, 900]]) {
      const hx = loadGame({ width: w, height: hh, seed: 3 }); const gx = hx.newGame();
      for (let lvl = 1; lvl <= 30; lvl++) { gx.generateCore(lvl); for (const b of gx.blocks) minSize = Math.min(minSize, b.size); }
    }
    r.check('no tunnelling: max step per frame < min block size + ball diameter', step < minSize + 2 * radius, `step=${step.toFixed(1)}px, block>=${minSize}px, radius=${radius}`);
    r.info('tunnelling margin', `max speed ${maxSpeed.toFixed(1)} px/s, dt clamp 0.05 s -> ${step.toFixed(1)} px/frame vs ${minSize + 2 * radius} px`);
  }

  // --- Refresh-rate consistency (CrazyGames "Consistent Physics"): hit rate at
  //     60 Hz vs 144 Hz over many seeds, blocks made indestructible so the
  //     layout stays fixed. Measured as cash/s (1 cash per hit at level 1).
  {
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
    const a = stats(60); const b = stats(144);
    const z = (a.m - b.m) / Math.sqrt(a.se ** 2 + b.se ** 2);
    const rel = (a.m - b.m) / a.m;
    r.info('hit rate 60 Hz vs 144 Hz', `${a.m.toFixed(3)}+-${a.se.toFixed(3)} vs ${b.m.toFixed(3)}+-${b.se.toFixed(3)} hits/s, diff ${(rel * 100).toFixed(1)}%, z=${z.toFixed(2)}, seeds=${seeds}`);
    if (quick) r.notRun('[NC-03] refresh-rate dependence verdict', '--quick uses 12 seeds: too few for a verdict (full run: node qa/physics.mjs)');
    else r.known('NC-03', 'hit rate depends on refresh rate (60 vs 144 Hz differ by > 3 standard errors)', Math.abs(z) > 3, `diff ${(rel * 100).toFixed(1)}%, z=${z.toFixed(2)}`);
  }

  return r;
}

if (isMain(import.meta.url)) process.exit(run({ quick: process.argv.includes('--quick') }).finish());
