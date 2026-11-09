// Level generation: shape alternation, block count, HP/money scaling, turret
// count and placement, turret clearance (NC-14), geometry inside the canvas,
// level-up, resize and core fitting (NC-15), world scale (NC-09).
// Positions are in world units: the canvas shows the world (g.width x
// g.height) magnified by g.viewScale.
// Expected values = the spec in docs/GAME_DESIGN.md ("Levels").
// Usage: node qa/levels.mjs
import { loadGame, Reporter, isMain } from './lib.mjs';

/** Canvas (not iframe) sizes = #gameArea after the top bar and the shop.
 *  The first five were measured in Chromium at CrazyGames iframe sizes
 *  (qa/browser-smoke.mjs INFO, 2026-11-09: 1920x1080, 1216x684, 907x510,
 *  821x462, 800x450); the last three are phone estimates (NOT measured). */
export const CANVAS_SIZES = [[1920, 909], [1216, 513], [907, 339], [821, 291], [800, 279], [667, 230], [375, 480], [320, 380]];

export function run() {
  const r = new Reporter('levels');

  // --- Spec per level on a mid-size canvas.
  {
    const h = loadGame({ width: 900, height: 600 }); const g = h.newGame();
    let shapeOk = true; let hpOk = true; let moneyOk = true; let turretOk = true; let gridCountOk = true; let ringsOk = true;
    for (let L = 1; L <= 20; L++) {
      g.generateCore(L);
      const ys = new Set(g.blocks.map((b) => Math.round(b.offsetY * 1000)));
      const isGrid = ys.size * ys.size === g.blocks.length || ys.size <= 7 && g.blocks.length === ys.size ** 2;
      if ((L % 2 === 1) !== isGrid) shapeOk = false;
      if (L % 2 === 1) { const n = Math.min(3 + Math.floor((L - 1) / 2), 7); if (g.blocks.length !== n * n) gridCountOk = false; }
      else {
        const radii = new Set(g.blocks.map((b) => Math.round(Math.hypot(b.offsetX, b.offsetY))));
        if (radii.size !== (L >= 5 ? 2 : 1)) ringsOk = false;
      }
      const expHp = Math.max(1, Math.round(10 * 1.5 ** (L - 1)));
      const expMoney = Math.max(1, Math.round(1.5 ** (L - 1)));
      if (!g.blocks.every((b) => b.maxHp === expHp && b.hp === expHp)) hpOk = false;
      if (!g.blocks.every((b) => b.moneyPerHit === expMoney)) moneyOk = false;
      if (g.turrets.length !== Math.min(1 + Math.floor((L - 1) / 3), 4)) turretOk = false;
    }
    r.check('odd levels = grid, even levels = circle (L1-20)', shapeOk);
    r.check('grid is NxN with N = min(3 + floor((L-1)/2), 7)', gridCountOk);
    r.check('circle: one ring, two rings from level 5 (even levels)', ringsOk);
    r.check('block HP = round(10 x 1.5^(L-1)) (+50% per level)', hpOk);
    r.check('money per hit = max(1, round(1.5^(L-1)))', moneyOk);
    r.check('turrets = min(1 + floor((L-1)/3), 4)', turretOk);
  }

  // --- Level-up: destroying every block raises the level and regenerates.
  {
    const h = loadGame(); const g = h.newGame();
    for (const b of g.blocks) b.takeHit(1e9);
    h.run(0.1, 60); // a few fixed simulation steps
    // Turrets aim at the core, so a ball may already have chipped a new block.
    r.check('all blocks destroyed -> level 2 and a fresh core', g.level === 2 && g.blocks.length > 0 && g.blocks.every((b) => b.alive && b.maxHp === 15 && b.hp >= 15 - 2));
    const before = g.level; g.blocks[0].takeHit(1e9); h.run(0.1, 60);
    r.check('one block left alive -> no level-up', g.level === before);
  }

  // --- Geometry on canvas sizes from phone to full HD.
  {
    const outside = []; const turretOut = []; const turretOverlap = []; const scaled = []; const minBlockPx = new Map();
    for (const [w, hh] of CANVAS_SIZES) {
      const h = loadGame({ width: w, height: hh }); const g = h.newGame();
      const W = g.width; const H = g.height;
      for (let L = 1; L <= 30; L++) {
        g.generateCore(L);
        if (g.blocks.some((b) => b.baseSize !== undefined && b.size !== b.baseSize)) scaled.push(`${w}x${hh} L${L} x${(g.blocks[0].size / g.blocks[0].baseSize).toFixed(2)}`);
        const onScreen = Math.min(...g.blocks.map((b) => b.size)) * (g.viewScale ?? 1);
        minBlockPx.set(`${w}x${hh}`, Math.min(minBlockPx.get(`${w}x${hh}`) ?? Infinity, onScreen));
        for (const b of g.blocks) if (b.x < 0 || b.y < 0 || b.x + b.size > W || b.y + b.size > H) { outside.push(`${w}x${hh} L${L}`); break; }
        for (const t of g.turrets) if (t.x < 0 || t.y < 0 || t.x > W || t.y > H) { turretOut.push(`${w}x${hh} L${L}`); break; }
        for (const t of g.turrets) {
          // Turret triangle reaches ~14 px; a ball spawns 22 px ahead of it.
          const hit = g.blocks.some((b) => t.x > b.x - 14 && t.x < b.x + b.size + 14 && t.y > b.y - 14 && t.y < b.y + b.size + 14);
          if (hit) { turretOverlap.push(`${w}x${hh} L${L}`); break; }
        }
      }
    }
    r.check('every block inside the canvas (8 sizes x 30 levels)', outside.length === 0, outside.slice(0, 6).join(', '));
    r.check('every turret inside the canvas', turretOut.length === 0, turretOut.slice(0, 6).join(', '));
    r.check('[NC-14] no turret within 14 px of the core (8 sizes x 30 levels)', turretOverlap.length === 0, turretOverlap.length ? `${turretOverlap.length} cases, e.g. ${turretOverlap.slice(0, 4).join(', ')}` : '');
    // Readability (CrazyGames: legible at DPR 1): every block is drawn at
    // least 11 px on screen (the UI text floor) on every canvas and level.
    r.check('every block drawn >= 11 px on screen (8 canvases x 30 levels)', [...minBlockPx].every(([, px]) => px >= 11), [...minBlockPx].map(([k, px]) => `${k}: ${px.toFixed(1)} px`).join(', '));
    r.info('core scaled down to fit (canvas, level, scale)', scaled.length ? `${scaled.length} of ${CANVAS_SIZES.length * 30}: ${scaled.join(', ')}` : 'none');
  }

  // --- Resize keeps the core centred and blocks' HP.
  {
    const h = loadGame({ width: 900, height: 600 }); const g = h.newGame();
    g.blocks[0].takeHit(3);
    h.resizeTo(600, 900);
    const cx = g.width / 2; const cy = g.height / 2; // world centre
    const centred = g.blocks.every((b) => Math.abs(b.x + b.size / 2 - (cx + b.offsetX)) < 1e-9 && Math.abs(b.y + b.size / 2 - (cy + b.offsetY)) < 1e-9);
    r.check('resize re-centres the core from stored offsets', centred);
    r.check('resize keeps block HP (no regeneration)', g.blocks[0].hp === 7 && g.level === 1);
    r.check('resize sets canvas backing store to CSS size x DPR', h.canvas.width === 600 && h.canvas.height === 900);
    const h2 = loadGame({ width: 1920, height: 900 }); const g2 = h2.newGame(); g2.generateCore(16);
    const geom = (gg) => JSON.stringify([gg.blocks.map((b) => [b.x, b.y, b.size]), gg.turrets.map((t) => [t.x, t.y])]);
    const before = geom(g2);
    g2.blocks[3].takeHit(5);
    const offCanvas = (gg, w, hh) => gg.blocks.some((b) => b.x < 0 || b.x + b.size > w || b.y < 0 || b.y + b.size > hh) || gg.turrets.some((t) => t.x < 0 || t.x > w || t.y < 0 || t.y > hh);
    const tooClose = (gg) => gg.turrets.some((t) => gg.blocks.some((b) => t.x > b.x - 14 && t.x < b.x + b.size + 14 && t.y > b.y - 14 && t.y < b.y + b.size + 14));
    h2.resizeTo(375, 480);
    r.check('[NC-15] big resize (1920x900 -> 375x480, level 16): core and turrets inside the canvas', !offCanvas(g2, g2.width, g2.height));
    r.check('[NC-15] after the resize turrets keep clear of the core', !tooClose(g2));
    r.check('[NC-15] resize keeps the level, block count and HP', g2.level === 1 && g2.blocks.length > 0 && g2.blocks[3].hp === g2.blocks[3].maxHp - 5);
    h2.resizeTo(1920, 900);
    r.check('[NC-15] resizing back restores the generated geometry exactly', geom(g2) === before);

    // Resize storm with balls in play: rotations and iframe sizes while the
    // game runs; nothing may leave the canvas and no ball may sit inside a block.
    const h3 = loadGame({ width: 907, height: 339, seed: 9 }); const g3 = h3.newGame();
    g3.maxBalls = 15; g3.fireRateLevel = 15; g3.recalcFireInterval(); g3.generateCore(12);
    h3.run(8, 60);
    const bad = [];
    const seq = [[375, 480], [480, 375], [1920, 909], [320, 380], [800, 279], [667, 230], [1216, 513], [907, 339]];
    for (const [w, hh] of seq) {
      h3.resizeTo(w, hh);
      const W = g3.width; const H = g3.height;
      const ballOut = g3.balls.some((b) => b.x < b.radius - 1e-9 || b.x > W - b.radius + 1e-9 || b.y < b.radius - 1e-9 || b.y > H - b.radius + 1e-9);
      const ballIn = g3.balls.some((b) => g3.blocks.some((k) => k.alive && b.x > k.x && b.x < k.x + k.size && b.y > k.y && b.y < k.y + k.size));
      if (offCanvas(g3, W, H) || ballOut || ballIn || tooClose(g3)) bad.push(`${w}x${hh}${ballOut ? ' ball-out' : ''}${ballIn ? ' ball-in-block' : ''}`);
      h3.run(1, 60);
    }
    r.check('[NC-15] resize sequence with 15 balls in play: core, turrets and balls inside, no ball inside a block, turrets clear', bad.length === 0, bad.join(', '));
  }

  // --- World scale (NC-09, docs/GAME_DESIGN.md "Levels"): a canvas whose
  //     short side exceeds 250 px shows a 250-unit-high world enlarged
  //     (same aspect); smaller canvases are drawn 1:1.
  {
    const rows = []; let ok = true;
    for (const [w, hh, dpr] of [[1920, 909, 1], [907, 339, 2], [800, 279, 1], [667, 230, 1], [375, 480, 3]]) {
      const h = loadGame({ width: w, height: hh, dpr }); const g = h.newGame();
      const expScale = Math.max(1, Math.min(w, hh) / 250);
      const good = Math.abs(g.viewScale - expScale) < 1e-9 && Math.abs(g.width * g.viewScale - w) < 1e-6 && Math.abs(g.height * g.viewScale - hh) < 1e-6
        && h.canvas.width === Math.floor(w * dpr) && h.canvas.height === Math.floor(hh * dpr);
      if (!good) ok = false;
      rows.push(`${w}x${hh}: x${Number(g.viewScale).toFixed(2)} world ${g.width.toFixed(0)}x${g.height.toFixed(0)}`);
    }
    r.check('world scale = max(1, short side / 250); world x scale = canvas; backing store = CSS x DPR', ok, rows.join(', '));
  }

  // --- Turrets aim at the core (NC-CORE-1A): a new ball starts outside the
  //     core and its first flight ends on the core.
  {
    const rows = []; let ok = true;
    for (const [w, hh] of CANVAS_SIZES) {
      for (const L of [1, 4, 7, 10, 16, 30]) {
        const h = loadGame({ width: w, height: hh, seed: L }); const g = h.newGame();
        g.level = L; g.generateCore(L); g.balls = [];
        for (const t of g.turrets) {
          const toCore = Math.atan2(g.height / 2 - t.y, g.width / 2 - t.x);
          const aimErr = Math.abs(Math.atan2(Math.sin(t.angle - toCore), Math.cos(t.angle - toCore)));
          g.spawnBallFromTurret(t);
          const b = g.balls[g.balls.length - 1];
          const inside = g.blocks.some((k) => b.x + b.radius > k.x && b.x - b.radius < k.x + k.size && b.y + b.radius > k.y && b.y - b.radius < k.y + k.size);
          if (aimErr > 1e-9 || inside) { ok = false; rows.push(`${w}x${hh} L${L}${inside ? ' spawn-in-core' : ' aim'}`); }
        }
      }
    }
    r.check('every turret aims at the core centre; a new ball spawns clear of every block (8 sizes x 6 levels)', ok, rows.slice(0, 6).join(', '));
  }

  // --- Core progress bar value.
  {
    const h = loadGame({ width: 907, height: 339 }); const g = h.newGame();
    if (g.coreProgress === undefined) { r.check('core progress: 0 on a fresh core, destroyed HP / total HP, 1 when cleared', false, 'no coreProgress'); return r; }
    const p0 = g.coreProgress;
    const total = g.blocks.length * g.blocks[0].maxHp;
    g.blocks[0].takeHit(3);
    const p1 = g.coreProgress;
    for (const b of g.blocks.slice(1)) b.takeHit(1e9);
    g.blocks[0].takeHit(1e9);
    r.check('core progress: 0 on a fresh core, destroyed HP / total HP, 1 when cleared', p0 === 0 && Math.abs(p1 - 3 / total) < 1e-12 && g.coreProgress === 1, `p0=${p0} p1=${p1.toFixed(4)} end=${g.coreProgress}`);
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
