// Art-pass capture and frame-cost probe (dev tool, not a suite; NC-ART-1).
// Serves a game folder in real Chromium and takes the same scenes at the same
// moments, so a base build and a candidate build can be compared side by side:
//   git worktree-free base: mkdir /tmp/base && for f in index.html style.css game.js; do git show origin/main:$f > /tmp/base/$f; done
//   node qa/art-shots.mjs --root /tmp/base --out qa/out/art/before
//   node qa/art-shots.mjs --out qa/out/art/after
//   node qa/art-shots.mjs --sheet qa/out/art/before qa/out/art/after --out qa/out/art/sheets
// Saves are seeded before game.js runs (like qa/browser-smoke.mjs); frame
// cost is measured by wrapping requestAnimationFrame in the test page only
// (no runtime hook). Headless Chromium numbers are indicative, not a device.
// NC-ART-ASSETS-1: the test page also seeds Math.random (mulberry32, per
// scene) so a base and a candidate build start from the same core layout
// (relay positions, ball angles); frame timing still differs slightly.
// Every response is logged: a missing file (404) or a request to another
// host is reported per scene. --labels "<before>" "<after>" names the sheet
// columns.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, mulberry32 } from './lib.mjs';

const require = createRequire(import.meta.url);
const pw = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch { /* next */ } } return null; })();

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

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

const SCENES = [
  // name, viewport, save (null = fresh), action, wait ms after action / load
  { name: '01-first-seconds-907x510', vp: [907, 510], save: null, wait: 2500 },
  { name: '02-first-seconds-800x450-pl', vp: [800, 450], save: null, wait: 2500, locale: 'pl-PL', touch: true },
  { name: '03-relays-level5-1216x684', vp: [1216, 684], save: { cash: 120, level: 5, maxBalls: 5, fireRateLevel: 3, damageLevel: 3 }, wait: 1800 },
  { name: '04-relays-ring-level8-1366x768', vp: [1366, 768], save: { cash: 400, level: 8, maxBalls: 8, fireRateLevel: 4, damageLevel: 4 }, wait: 1800 },
  { name: '05-volley-ready-aim-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 3 }, volley: 'hover' },
  { name: '06-volley-fired-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 3 }, volley: 'click', after: 70 },
  { name: '07-heart-shatter-a-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, volley: 'click', after: 110 },
  { name: '08-heart-shatter-b-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, volley: 'click', after: 330 },
  { name: '09-late-level13-1920x1080', vp: [1920, 1080], save: { cash: 9000, level: 13, maxBalls: 40, fireRateLevel: 10, damageLevel: 12 }, wait: 7000 },
  { name: '10-late-level14-800x450', vp: [800, 450], save: { cash: 9000, level: 14, maxBalls: 40, fireRateLevel: 10, damageLevel: 12 }, wait: 7000 },
  { name: '11-phone-portrait-390x844', vp: [390, 844], save: null, wait: 2500, touch: true },
  { name: '12-tablet-1080x607', vp: [1080, 607], save: { cash: 60, level: 3, maxBalls: 3, fireRateLevel: 2, damageLevel: 2 }, wait: 2500, touch: true },
  { name: '13-reduced-motion-shatter-907x510', vp: [907, 510], save: { cash: 50, level: 5, maxBalls: 4, fireRateLevel: 1, damageLevel: 40 }, volley: 'click', after: 110, reducedMotion: true },
  // NC-ART-ASSETS-1 additions: 10 s into a fresh game, damaged relays,
  // phone landscape, a DPR 2 phone (sprite sharpness).
  { name: '14-first-10s-907x510', vp: [907, 510], save: null, wait: 10000 },
  { name: '15-relays-damaged-level8-907x510', vp: [907, 510], save: { cash: 50, level: 8, maxBalls: 10, fireRateLevel: 1, damageLevel: 8 }, wait: 4500 },
  { name: '16-phone-landscape-844x390', vp: [844, 390], save: { cash: 60, level: 5, maxBalls: 5, fireRateLevel: 2, damageLevel: 3 }, wait: 2500, touch: true },
  { name: '17-phone-dpr2-390x844-level5', vp: [390, 844], dpr: 2, save: { cash: 60, level: 5, maxBalls: 5, fireRateLevel: 2, damageLevel: 3 }, wait: 2500, touch: true },
];

/** Seeds Math.random in the test page (not in the runtime). */
const SEED_SCRIPT = ([src, seed]) => { const r = (0, eval)(`(${src})`)(seed); Math.random = r; };

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
    const only = opt('--only', '');
    for (const s of SCENES.filter((x) => !only || only.split(',').some((k) => x.name.startsWith(k)))) {
      const ctx = await browser.newContext({ viewport: { width: s.vp[0], height: s.vp[1] }, deviceScaleFactor: s.dpr || 1, locale: s.locale || 'en-US', hasTouch: !!s.touch, isMobile: !!s.touch, reducedMotion: s.reducedMotion ? 'reduce' : 'no-preference' });
      await ctx.addInitScript(SEED_SCRIPT, [mulberry32.toString(), SCENES.indexOf(s) + 1]);
      await ctx.addInitScript((save) => {
        localStorage.setItem('neonCrusher.audio.v1', 'muted');
        if (save) localStorage.setItem('neonCrusher.save.v1', JSON.stringify(save));
      }, s.save);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('response', (res) => { if (res.status() >= 400) errs.push(`HTTP ${res.status()} ${res.url()}`); });
      page.on('request', (req) => { if (!req.url().startsWith(base) && !req.url().startsWith('data:')) errs.push(`external request ${req.url()}`); });
      await page.goto(base + 'index.html');
      const box = await page.locator('#gameCanvas').boundingBox();
      const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
      if (s.volley) {
        for (let i = 0; i < 60; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => document.getElementById('hint').classList.contains('hint--action'))) break; }
        if (s.volley === 'hover') { await page.mouse.move(cx + 40, cy - 25); await page.waitForTimeout(250); } else {
          await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(s.after);
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
    for (const [w, h, level] of [[1920, 1080, 13], [800, 450, 14], [907, 510, 1], [1216, 684, 8]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await ctx.addInitScript(SEED_SCRIPT, [mulberry32.toString(), level]);
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
async function sheets(beforeDir, afterDir, out, labels) {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch();
  try {
    for (const f of fs.readdirSync(afterDir).filter((x) => x.endsWith('.png'))) {
      const a = fs.readFileSync(path.join(beforeDir, f)).toString('base64');
      const b = fs.readFileSync(path.join(afterDir, f)).toString('base64');
      const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
      await page.setContent(`<body style="margin:0;background:#111;font:600 18px Arial;color:#ddd">
        <div style="display:flex;gap:8px;padding:8px"><figure style="margin:0"><figcaption>${labels[0]}</figcaption><img src="data:image/png;base64,${a}"></figure>
        <figure style="margin:0"><figcaption>${labels[1]}</figcaption><img src="data:image/png;base64,${b}"></figure></div></body>`);
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
  const l = args.indexOf('--labels');
  await sheets(path.resolve(args[i + 1]), path.resolve(args[i + 2]), out, l >= 0 ? [args[l + 1], args[l + 2]] : ['BEFORE (main)', 'AFTER (candidate)']);
} else {
  const root = path.resolve(opt('--root', ROOT));
  if (!args.includes('--perf-only')) await capture(root, out);
  if (!args.includes('--no-perf')) await perf(root, out);
}
