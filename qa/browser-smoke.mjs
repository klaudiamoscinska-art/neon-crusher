// Browser smoke test in real Chromium at the CrazyGames iframe sizes (DPR 1):
// loads without errors or external requests, animates, fits without page
// scroll, shop reachable, save survives a reload. Screenshots: qa/out/shots/.
// Needs Playwright already installed on the machine (never added as a repo
// dependency). Without it every check is NOT RUN -- never PASS.
// Usage: node qa/browser-smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, OUT, Reporter, isMain, CG_FRAMES } from './lib.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch { /* next */ } }
  return null;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export async function run() {
  const r = new Reporter('browser-smoke');
  const pw = loadPlaywright();
  if (!pw) { r.notRun('browser smoke (all checks)', 'Playwright not installed on this machine'); return r; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) { r.notRun('browser smoke (all checks)', `Chromium failed to launch: ${e.message.split('\n')[0]}`); return r; }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const shots = path.join(OUT, 'shots'); fs.mkdirSync(shots, { recursive: true });

  const errors = []; const external = []; const scroll = []; const shopOff = []; const still = []; const sizes = []; const fonts = [];
  let userSelect = null;
  try {
    for (const [w, h] of CG_FRAMES) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
      page.on('request', (q) => { if (!q.url().startsWith(base)) external.push(q.url()); });
      await page.goto(base + 'index.html');
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const c = document.getElementById('gameCanvas').getBoundingClientRect();
        const shop = document.getElementById('shop').getBoundingClientRect();
        let minFont = 99;
        for (const el of document.querySelectorAll('body *')) {
          if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
        }
        return { cw: c.width, ch: c.height, shopBottom: shop.bottom, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, us: getComputedStyle(document.body).userSelect, minFont };
      });
      sizes.push(`${w}x${h}->${Math.round(m.cw)}x${Math.round(m.ch)}`);
      fonts.push(m.minFont);
      userSelect = m.us;
      if (m.sh > h + 1 || m.sw > w + 1) scroll.push(`${w}x${h}`);
      if (m.shopBottom > h + 1) shopOff.push(`${w}x${h}`);
      const a = await page.screenshot();
      await page.waitForTimeout(400);
      const b = await page.screenshot({ path: path.join(shots, `frame-${w}x${h}.png`) });
      if (a.equals(b)) still.push(`${w}x${h}`);
      await page.close();
    }
    r.check('10 CrazyGames frames: no page errors / console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    r.check('no request leaves the local server', external.length === 0, external.slice(0, 3).join(', '));
    r.check('no page scroll at any frame', scroll.length === 0, scroll.join(', '));
    r.check('shop fully visible at every frame', shopOff.length === 0, shopOff.join(', '));
    r.check('canvas animates (two screenshots 400 ms apart differ)', still.length === 0, still.join(', '));
    r.info('canvas size per iframe size', sizes.join(' '));
    r.info('smallest text size at DPR 1 (px)', `${Math.min(...fonts)} (readability: owner/QA judgement, NOT VERIFIED by this check)`);
    r.known('NC-08', 'body has no user-select: none (CrazyGames technical requirement for mobile)', userSelect !== 'none', `computed: ${userSelect}`);

    // Save restored on load, and the running game's own save survives a reload.
    // (Writing localStorage from outside and reloading would be overwritten by
    // the game's beforeunload save, so the save is injected before game.js runs.)
    const ctx = await browser.newContext({ viewport: { width: 907, height: 510 } });
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('qaSeeded')) {
        sessionStorage.setItem('qaSeeded', '1');
        localStorage.setItem('neonCrusher.save.v1', JSON.stringify({ cash: 4321, level: 3, maxBalls: 2, fireRateLevel: 1, damageLevel: 2 }));
      }
    });
    const page = await ctx.newPage();
    await page.goto(base + 'index.html'); await page.waitForTimeout(300);
    const read = () => page.evaluate(() => ({ lvl: document.getElementById('statLevel').textContent, cash: document.getElementById('statCash').textContent, lang: document.documentElement.lang, title: document.querySelector('.shop-btn__title').textContent }));
    const ui = await read();
    r.check('save in localStorage is restored on load (level 3, cash >= $4321)', ui.lvl === '3' && Number(ui.cash.replace(/\D/g, '')) >= 4321, JSON.stringify(ui));
    await page.reload(); await page.waitForTimeout(300);
    const ui2 = await read();
    r.check('reload keeps the progress (beforeunload/pagehide save)', ui2.lvl === '3', JSON.stringify(ui2));
    r.known('NC-07', 'UI exists only in Polish (no English localization; CrazyGames requires English)', ui.lang === 'pl' && /Kup/.test(ui.title), `lang=${ui.lang}, "${ui.title}"`);
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  return r;
}

if (isMain(import.meta.url)) run().then((r) => process.exit(r.finish()));
