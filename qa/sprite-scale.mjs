// Sprite scale check (dev tool, not a suite; NC-ART-ASSETS-1).
// Draws the game's own procedural heart / relay / armour / turret (the real
// classes from game.js, run in Chromium) next to candidate raster sprites at
// the sizes they really get on screen (16-36 world units = ~20-130 CSS px),
// at DPR 1 and 2, so a sprite can be judged where it matters: at game scale,
// not on a contact sheet. Nothing is loaded from the network; the sprites are
// inlined as data URLs.
//   node qa/sprite-scale.mjs --sprites <folder with heart_core_fracture0.png ...> --out qa/out/art/scale
// The folder uses the NC-ART-ASSETS-1 file names (missing files are skipped).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib.mjs';

const require = createRequire(import.meta.url);
const pw = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch { /* next */ } } return null; })();
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

// kind, sprite at full health, sprite when damaged / charged.
const ROWS = [
  ['heart', 'heart_core_fracture0', 'heart_core_fracture2'],
  ['relay', 'relay_idle', 'relay_overload'],
  ['armor', 'armor_v1_damage0', 'armor_v1_damage3'],
  ['turret', 'turret_fork_idle', 'turret_fork_ready'],
];
// On-screen sizes in CSS px: a level-13 grid block at 907x510, a level-5
// ring heart at 907x510, a level-1 block at 907x510, a level-1 block at
// 1920x1080.
const SIZES = [22, 34, 49, 130];

if (!pw) { console.log('NOT RUN: Playwright not installed'); process.exit(2); }
const dir = path.resolve(opt('--sprites', ''));
const out = path.resolve(opt('--out', path.join(ROOT, 'qa', 'out', 'art', 'scale')));
fs.mkdirSync(out, { recursive: true });
const gameSrc = fs.readFileSync(process.env.NC_GAME_JS ? path.resolve(process.env.NC_GAME_JS) : path.join(ROOT, 'game.js'), 'utf8')
  .replace(/window\.addEventListener\('DOMContentLoaded'[\s\S]*$/, '');
const sprites = {};
for (const [, a, b] of ROWS) {
  for (const n of [a, b]) {
    const f = path.join(dir, `${n}.png`);
    if (fs.existsSync(f)) sprites[n] = `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  }
}

const browser = await pw.chromium.launch();
try {
  for (const dpr of [1, 2]) {
    const W = 1220;
    const H = 760;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
    await page.setContent(`<!doctype html><body style="margin:0;background:#07070d"><canvas id="c"></canvas><script>${gameSrc}\nwindow.__SPRITES = ${JSON.stringify(sprites)};</script>`);
    await page.evaluate(async ({ dpr, W, H, ROWS, SIZES }) => {
      const load = (src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });
      const c = document.getElementById('c');
      c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#07070d';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#9ff8ff';
      ctx.fillText(`DPR ${dpr} - per size: procedural full | procedural damaged/ready | sprite full | sprite damaged/ready`, 10, 16);
      let y = 34;
      for (const [kind, a, b] of ROWS) {
        ctx.fillStyle = '#9ff8ff';
        ctx.fillText(kind, 10, y + 10);
        let x = 60;
        for (const s of SIZES) {
          for (const mode of ['p0', 'p1', 's0', 's1']) {
            const cx = x + s / 2;
            const cy = y + 70;
            if (mode[0] === 'p') {
              if (kind === 'turret') {
                // Turret art is ~36 world units across; scale it to the slot.
                const t = new Turret(0, 0, -Math.PI / 2, COLORS.magenta);
                t.x = 0; t.y = 0;
                ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 36, s / 36);
                t.draw(ctx, mode === 'p1' ? 1 : 0.4, 1, false);
                ctx.restore();
              } else {
                const bl = new Block(0, 0, s, 60, 1, kind === 'armor' ? COLORS.cyan : COLORS.amber);
                bl.kind = kind;
                bl.applyCenter(cx, cy);
                if (mode === 'p1') bl.hp = 12;
                Block.drawCore(ctx, [bl], 1.3, false);
              }
            } else {
              const src = window.__SPRITES[mode === 's1' ? b : a];
              const img = src ? await load(src) : null;
              if (img) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s); }
            }
            x += s + 8;
          }
          x += 16;
        }
        y += 180;
      }
    }, { dpr, W, H, ROWS, SIZES });
    await page.screenshot({ path: path.join(out, `sprite-scale-dpr${dpr}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`sprite scale sheets: ${out}`);
