// Level generation: shape alternation, block count, HP/money scaling, turret
// count and placement, geometry inside the canvas, level-up, resize.
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
    h.run(1 / 60, 60);
    r.check('all blocks destroyed -> level 2 and a fresh core', g.level === 2 && g.blocks.some((b) => b.alive) && g.blocks.every((b) => b.alive && b.hp === 15));
    const before = g.level; g.blocks[0].takeHit(1e9); h.run(1 / 60, 60);
    r.check('one block left alive -> no level-up', g.level === before);
  }

  // --- Geometry on canvas sizes from phone to full HD.
  {
    const outside = []; const turretOut = []; const turretOverlap = [];
    for (const [w, hh] of CANVAS_SIZES) {
      const h = loadGame({ width: w, height: hh }); const g = h.newGame();
      for (let L = 1; L <= 30; L++) {
        g.generateCore(L);
        for (const b of g.blocks) if (b.x < 0 || b.y < 0 || b.x + b.size > w || b.y + b.size > hh) { outside.push(`${w}x${hh} L${L}`); break; }
        for (const t of g.turrets) if (t.x < 0 || t.y < 0 || t.x > w || t.y > hh) { turretOut.push(`${w}x${hh} L${L}`); break; }
        for (const t of g.turrets) {
          // Turret triangle reaches ~14 px; a ball spawns 22 px ahead of it.
          const hit = g.blocks.some((b) => t.x > b.x - 14 && t.x < b.x + b.size + 14 && t.y > b.y - 14 && t.y < b.y + b.size + 14);
          if (hit) { turretOverlap.push(`${w}x${hh} L${L}`); break; }
        }
      }
    }
    r.check('every block inside the canvas (8 sizes x 30 levels)', outside.length === 0, outside.slice(0, 6).join(', '));
    r.check('every turret inside the canvas', turretOut.length === 0, turretOut.slice(0, 6).join(', '));
    r.known('NC-14', 'turret placed on/inside the core on small canvases (distance clamped to min(w,h)/2 - 20)', turretOverlap.length > 0, `${turretOverlap.length} cases, e.g. ${turretOverlap.slice(0, 4).join(', ')}`);
  }

  // --- Resize keeps the core centred and blocks' HP.
  {
    const h = loadGame({ width: 900, height: 600 }); const g = h.newGame();
    g.blocks[0].takeHit(3);
    h.resizeTo(600, 900);
    const cx = 300; const cy = 450;
    const centred = g.blocks.every((b) => Math.abs(b.x + b.size / 2 - (cx + b.offsetX)) < 1e-9 && Math.abs(b.y + b.size / 2 - (cy + b.offsetY)) < 1e-9);
    r.check('resize re-centres the core from stored offsets', centred);
    r.check('resize keeps block HP (no regeneration)', g.blocks[0].hp === 7 && g.level === 1);
    r.check('resize sets canvas backing store to CSS size x DPR', h.canvas.width === 600 && h.canvas.height === 900);
    const h2 = loadGame({ width: 1920, height: 900 }); const g2 = h2.newGame(); g2.generateCore(16);
    h2.resizeTo(375, 480);
    const off = g2.blocks.some((b) => b.x < 0 || b.x + b.size > 375 || b.y < 0 || b.y + b.size > 480) || g2.turrets.some((t) => t.x < 0 || t.x > 375 || t.y < 0 || t.y > 480);
    r.known('NC-15', 'big resize (1920x900 -> 375x480) keeps the old layout size: core/turrets leave the canvas', off);
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
