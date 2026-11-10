// Art-pass capture and frame-cost probe (dev tool, not a suite; NC-ART-1,
// scenes replaced in NC-AI-RECOVERY-1).
// Serves a game folder in real Chromium and takes the same scenes at the same
// moments, so a base build and a candidate build can be compared side by side:
//   git worktree-free base: mkdir /tmp/base && for f in index.html style.css game.js; do git show origin/main:$f > /tmp/base/$f; done
//   node qa/art-shots.mjs --root /tmp/base --out qa/out/art/before
//   node qa/art-shots.mjs --out qa/out/art/after
//   node qa/art-shots.mjs --sheet qa/out/art/before qa/out/art/after --out qa/out/art/sheets
// Saves are seeded before game.js runs (like qa/browser-smoke.mjs); frame
// cost is measured by wrapping requestAnimationFrame in the test page only
// (no runtime hook). Headless Chromium numbers are indicative, not a device.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib.mjs';

const require = createRequire(import.meta.url);
const pw = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch { /* next */ } } return null; })();

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

// --dpr 2 captures the same scenes at device pixel ratio 2 (R3: sprite
// rasters must stay sharp on high-DPR screens).
const DPR = Number(opt('--dpr', 1));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(root, url === '/' ? 'index.html' : url);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// NC-AI-RECOVERY-1 scene set (the stage's BEFORE/AFTER list). `act`:
//   'defense' waits until the AI raises a shield (base: same moment, it has
//   none), 'break' then clicks the firewall node (base: the same click on the
//   core), 'core' clicks the core when the pulse is ready. The page reads the
//   game through a wrapper around Game.prototype.update installed by this
//   test page only (no runtime hook), like the rAF probe below.
const SCENES = [
  { name: '01-first-10s-907x510', vp: [907, 510], save: null, wait: 10000 },
  { name: '02-first-10s-800x450-pl', vp: [800, 450], save: null, wait: 10000, locale: 'pl-PL', touch: true },
  { name: '03-ai-shield-sector5-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 2, damageLevel: 3 }, act: 'defense', after: 900 },
  { name: '04-ai-shield-sector8-1366x768', vp: [1366, 768], save: { cash: 400, level: 8, maxBalls: 8, fireRateLevel: 4, damageLevel: 5 }, act: 'defense', after: 900 },
  { name: '05-manual-break-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 20, damageLevel: 8 }, act: 'break', after: 140 },
  { name: '06-core-exposed-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 20, damageLevel: 8 }, act: 'break', after: 1200 },
  { name: '07-sector-recovered-a-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, act: 'core', after: 110 },
  { name: '08-sector-recovered-b-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, act: 'core', after: 380 },
  { name: '09-late-sector13-1920x1080', vp: [1920, 1080], save: { cash: 9000, level: 13, maxBalls: 40, fireRateLevel: 10, damageLevel: 12 }, wait: 9500 },
  { name: '10-late-sector14-800x450', vp: [800, 450], save: { cash: 9000, level: 14, maxBalls: 40, fireRateLevel: 10, damageLevel: 12 }, wait: 9500 },
  { name: '11-phone-portrait-390x844', vp: [390, 844], save: null, wait: 4000, touch: true },
  { name: '12-phone-shield-sector4-390x844', vp: [390, 844], save: { cash: 60, level: 4, maxBalls: 4, fireRateLevel: 2, damageLevel: 3 }, act: 'defense', after: 900, touch: true },
  { name: '13-tablet-1080x607', vp: [1080, 607], save: { cash: 60, level: 3, maxBalls: 3, fireRateLevel: 2, damageLevel: 2 }, wait: 4000, touch: true },
  { name: '14-reduced-motion-recovered-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, act: 'core', after: 110, reducedMotion: true },
];

const HOOK = () => {
  // Test page only: remember the running game (no runtime change).
  const tryWrap = () => {
    if (typeof Game === 'undefined') return false; // eslint-disable-line no-undef
    const u = Game.prototype.update; // eslint-disable-line no-undef
    Game.prototype.update = function (dt) { window.__g = this; return u.call(this, dt); }; // eslint-disable-line no-undef
    return true;
  };
  window.addEventListener('DOMContentLoaded', tryWrap, { once: true, capture: true });
};

// Each rAF callback is timed together with a 1-pixel getImageData, which
// forces the canvas to rasterise the frame inside the measurement (otherwise
// Chromium defers the drawing and the number shows JS only).
const RAF_PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__frameMs = [];
  window.requestAnimationFrame = (cb) => raf((t) => {
    const s = performance.now();
    cb(t);
    const c = document.getElementById('gameCanvas');
    if (c && c.width) c.getContext('2d').getImageData(0, 0, 1, 1);
    window.__frameMs.push(performance.now() - s);
  });
};

async function capture(root, out) {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch();
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const log = [];
  try {
    for (const s of SCENES) {
      const ctx = await browser.newContext({ viewport: { width: s.vp[0], height: s.vp[1] }, deviceScaleFactor: DPR, locale: s.locale || 'en-US', hasTouch: !!s.touch, isMobile: !!s.touch, reducedMotion: s.reducedMotion ? 'reduce' : 'no-preference' });
      await ctx.addInitScript((save) => {
        localStorage.setItem('neonCrusher.audio.v1', 'muted');
        if (save) localStorage.setItem('neonCrusher.save.v1', JSON.stringify(save));
      }, s.save);
      await ctx.addInitScript(HOOK);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(base + 'index.html');
      const box = await page.locator('#gameCanvas').boundingBox();
      if (s.act) {
        // Wait (same wall-clock budget on both builds) for a ready pulse, and
        // for 'defense'/'break' also for the AI's shield (the base has none:
        // it times out at the same moment the shield would have appeared).
        const waitFor = async (fn, ms) => {
          const deadline = Date.now() + ms;
          for (;;) {
            await page.waitForTimeout(50);
            if (await page.evaluate(fn) || Date.now() > deadline) return;
          }
        };
        if (s.act !== 'core') await waitFor(() => !!(window.__g && window.__g.defense), 11000);
        if (s.act !== 'defense') await waitFor(() => !!(window.__g && window.__g.volleyReady), 8000);
        if (s.act === 'defense') {
          await page.waitForTimeout(s.after);
        } else {
          const pt = await page.evaluate((act) => {
            const g = window.__g;
            const t = act === 'break' && g.defense ? g.defense.node : g.blocks.find((b) => b.alive && b.kind === 'heart');
            return t ? { x: t.cx * g.viewScale, y: t.cy * g.viewScale } : { x: g.width * g.viewScale / 2, y: g.height * g.viewScale / 2 };
          }, s.act);
          await page.mouse.move(box.x + pt.x, box.y + pt.y);
          await page.mouse.down(); await page.mouse.up();
          await page.waitForTimeout(s.after);
        }
      } else {
        await page.waitForTimeout(s.wait);
      }
      await page.screenshot({ path: path.join(out, `${s.name}.png`) });
      log.push(`${s.name}: ${errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok'}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(out, 'log.txt'), log.join('\n') + '\n');
  console.log(log.join('\n'));
}

/** JS time per rAF callback (update steps + draw) on a late-game save. */
async function perf(root, out) {
  const browser = await pw.chromium.launch();
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const rows = [];
  try {
    for (const [w, h, level] of [[1920, 1080, 13], [800, 450, 14], [907, 510, 1]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: DPR });
      await ctx.addInitScript(RAF_PROBE);
      const save = level === 1 ? null : { cash: 9000, level, maxBalls: 60, fireRateLevel: 10, damageLevel: 12 };
      await ctx.addInitScript((sv) => { localStorage.setItem('neonCrusher.audio.v1', 'muted'); if (sv) localStorage.setItem('neonCrusher.save.v1', JSON.stringify(sv)); }, save);
      const page = await ctx.newPage();
      await page.goto(base + 'index.html');
      await page.waitForTimeout(9000); // field fills with balls
      await page.evaluate(() => { window.__frameMs.length = 0; });
      await page.waitForTimeout(5000);
      const ms = (await page.evaluate(() => window.__frameMs.slice())).sort((a, b) => a - b);
      const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
      const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
      rows.push(`${w}x${h} level ${level}${save ? ' 60 balls' : ' fresh'}: frames/5s ${ms.length}, mean ${mean.toFixed(2)} ms, p50 ${q(0.5).toFixed(2)}, p95 ${q(0.95).toFixed(2)}, max ${ms[ms.length - 1].toFixed(2)}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'perf.txt'), rows.join('\n') + '\n');
  console.log(rows.join('\n'));
}

/** Side-by-side BEFORE | AFTER sheets (JPEG) from two capture folders. */
async function sheets(beforeDir, afterDir, out) {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch();
  try {
    for (const f of fs.readdirSync(afterDir).filter((x) => x.endsWith('.png'))) {
      const a = fs.readFileSync(path.join(beforeDir, f)).toString('base64');
      const b = fs.readFileSync(path.join(afterDir, f)).toString('base64');
      const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
      await page.setContent(`<body style="margin:0;background:#111;font:600 18px Arial;color:#ddd">
        <div style="display:flex;gap:8px;padding:8px"><figure style="margin:0"><figcaption>BEFORE (main)</figcaption><img src="data:image/png;base64,${a}"></figure>
        <figure style="margin:0"><figcaption>AFTER (NC-AI-RECOVERY-1)</figcaption><img src="data:image/png;base64,${b}"></figure></div></body>`);
      await page.waitForTimeout(100);
      const size = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.screenshot({ path: path.join(out, f.replace('.png', '.jpg')), type: 'jpeg', quality: 78, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (!pw) { console.log('NOT RUN: Playwright not installed'); process.exit(2); }
const out = path.resolve(opt('--out', path.join(ROOT, 'qa', 'out', 'art', 'after')));
if (args.includes('--sheet')) {
  const i = args.indexOf('--sheet');
  await sheets(path.resolve(args[i + 1]), path.resolve(args[i + 2]), out);
} else {
  const root = path.resolve(opt('--root', ROOT));
  if (!args.includes('--perf-only')) await capture(root, out);
  if (!args.includes('--no-perf')) await perf(root, out);
}
